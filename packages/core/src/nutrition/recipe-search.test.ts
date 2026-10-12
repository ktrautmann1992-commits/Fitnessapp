/**
 * Rezeptsuche (docs/PLAN-PHASE-5.md 19.6, DoD N3): Eigenschaftstest „`recipe-search` liefert nie ein Rezept, das
 * `filter.ts` wegen Schwein (inkl. `eats_pork = null` bei Mischkost, G2), Unverträglichkeit, ‚mag ich nicht‘ oder
 * `pregnancy_caution` ausschließt“; Ernährungsform erweiterbar und gekennzeichnet (K3, G4); weiche Filter.
 */
import { describe, expect, it } from 'vitest';

import type { Recipe } from '../content/recipe-schema';
import { filterRecipe } from './filter';
import { N3_FOODS, N3_RECIPES, usedFoodViolations } from './meal-plan-fixtures';
import { searchRecipes } from './recipe-search';
import { mealPlanProfileSchema } from './schemas';
import { seededRandom } from './test-helpers';

const base = { recipes: N3_RECIPES, foods: N3_FOODS, allowDrafts: true };

describe('searchRecipes', () => {
  it('Eigenschaftstest: harte Ausschlüsse sind in der Suche nie abschaltbar', () => {
    const rnd = seededRandom(1966);
    const groups = ['peanuts', 'gluten', 'dairy', 'eggs', 'fish', 'mushrooms', 'soy'] as const;
    let hits = 0;
    for (let i = 0; i < 200; i += 1) {
      const diet = (['omnivore', 'vegetarian', 'vegan'] as const)[i % 3] as 'omnivore';
      const chosen = groups.filter(() => rnd() < 0.25);
      const profile = mealPlanProfileSchema.parse({
        diet,
        eatsPork: diet === 'omnivore' ? ([true, false, null] as const)[i % 3] : null,
        intolerances: chosen.filter((_, j) => j % 2 === 0),
        dislikes: chosen.filter((_, j) => j % 2 === 1),
      });
      const excludePregnancyCaution = rnd() < 0.4;
      const results = searchRecipes(
        { ...base, profile, excludePregnancyCaution },
        { diets: ['omnivore', 'vegetarian', 'vegan'].filter(() => rnd() < 0.5) as ['vegan'] },
      );
      for (const hit of results) {
        hits += 1;
        const r = filterRecipe(hit.variant.recipe, N3_FOODS, {
          profile,
          excludePregnancyCaution,
          allowDrafts: true,
        });
        // Erlaubt ist nur der Unterschied „Ernährungsform“ (erweiterbar, gekennzeichnet) – die übrigen Ausschlüsse
        // gelten für die tatsächlich verwendeten Zutaten (ggf. mit Ersatzprodukt) unverändert.
        if (!r.ok) expect(hit.outsideProfileDiet).not.toBeNull();
        const excluded = new Set<string>([...profile.intolerances, ...profile.dislikes]);
        expect(hit.variant.facts.allergens.filter((g) => excluded.has(g))).toEqual([]);
        // Unabhängig an den verwendeten Zutaten (eigene Regeln, Wächter N3 S5c); Ernährungsform darf erweitert sein.
        const omitted = new Set(hit.variant.omitted);
        const subs = new Map(hit.variant.substitutions.map((x) => [x.index, x.substituteFoodId]));
        const used = hit.variant.recipe.ingredients.flatMap((ing, index) =>
          omitted.has(index) ? [] : [{ index, foodId: subs.get(index) ?? ing.food_id }],
        );
        const wide = { ...profile, diet: 'omnivore' as const };
        expect(
          usedFoodViolations(hit.variant.recipe, used, wide, excludePregnancyCaution),
          hit.variant.recipe.id,
        ).toEqual([]);
      }
    }
    expect(hits).toBeGreaterThan(500);
  });

  it('W10/G2: eats_pork = null bei Mischkost findet kein Schwein, auch nicht erweitert', () => {
    const results = searchRecipes({
      ...base,
      profile: { diet: 'omnivore', eatsPork: null },
      excludePregnancyCaution: false,
    });
    const ids = results.map((h) => h.variant.recipe.id);
    expect(ids).not.toContain('hack-spaghetti');
    expect(ids).not.toContain('salami-brot');
    expect(ids).not.toContain('milch-gelee');
  });

  it('vegan sucht auch vegetarisch: Treffer gekennzeichnet, Profil-Treffer nicht', () => {
    const profile = { diet: 'vegan' } as const;
    const own = searchRecipes({ ...base, profile, excludePregnancyCaution: false });
    expect(own.every((h) => h.outsideProfileDiet === null)).toBe(true);
    const wider = searchRecipes(
      { ...base, profile, excludePregnancyCaution: false },
      { diets: ['vegetarian'] },
    );
    expect(wider.length).toBeGreaterThan(own.length);
    expect(
      wider.find((h) => h.variant.recipe.id === 'omelett-champignons')?.outsideProfileDiet,
    ).toBe('vegetarian');
    // Erweitern schränkt nie ein.
    expect(
      searchRecipes(
        { ...base, profile: { diet: 'omnivore', eatsPork: true }, excludePregnancyCaution: false },
        { diets: ['vegan'] },
      ).length,
    ).toBe(
      searchRecipes({
        ...base,
        profile: { diet: 'omnivore', eatsPork: true },
        excludePregnancyCaution: false,
      }).length,
    );
  });

  it('weiche Filter: Kategorie, Abschnitt, unter 10 Minuten, Kosten nur freigegeben, Text; sortiert', () => {
    const extra: Recipe[] = [
      {
        ...(N3_RECIPES.find((r) => r.id === 'banane-pur') as Recipe),
        id: 'banane-guenstig',
        title_de: 'Banane günstig',
        categories: ['schnell', 'spar-kueche'],
        section_de: 'Snack',
        total_minutes: 2,
        cost_estimate: {
          eur_per_serving: 0.3,
          as_of: '2026-10-01',
          basis: 'estimate',
          reviewed_by: 'KT',
        },
      },
      {
        ...(N3_RECIPES.find((r) => r.id === 'banane-pur') as Recipe),
        id: 'banane-ungeprueft',
        title_de: 'Banane ungeprüfter Preis',
        categories: ['spar-kueche'],
        cost_estimate: { eur_per_serving: 0.2, as_of: '2026-10-01', basis: 'estimate' },
      },
    ];
    const input = {
      ...base,
      recipes: [...N3_RECIPES, ...extra],
      profile: { diet: 'vegan' } as const,
      excludePregnancyCaution: false,
    };
    const ids = (q: Parameters<typeof searchRecipes>[1]) =>
      searchRecipes(input, q).map((h) => h.variant.recipe.id);
    expect(ids({ categories: ['spar-kueche'] })).toEqual(['banane-guenstig', 'banane-ungeprueft']);
    expect(ids({ maxCostEur: 1 })).toEqual(['banane-guenstig']);
    expect(ids({ section: 'Snack' })).toEqual(['banane-guenstig']);
    expect(ids({ quick: true })).toContain('banane-pur');
    expect(ids({ quick: true })).not.toContain('tofu-paprika');
    expect(ids({ text: 'tofu' }).sort()).toEqual(['tofu-erdnuss-curry', 'tofu-paprika']);
    const all = searchRecipes(input).map((h) => h.variant.recipe.title_de);
    expect(all).toEqual([...all].sort((a, b) => a.localeCompare(b, 'de')));
  });
});

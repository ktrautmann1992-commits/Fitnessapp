/**
 * Etappe N5c (docs/PLAN-PHASE-5.md 19.6, Umsetzungsstand N5a „N5c“): Rezeptsuche in der App und Ratgeber.
 * Auflagen des Wächters: Treffer nur über `filter.ts` mit demselben Profil inkl. `pregnancy_caution` (Eigenschaftstest:
 * kein ausgeschlossenes Rezept in den Treffern, auch nicht über die erweiterte Ernährungsform oder „Zur
 * Einkaufsliste“), Ratgeber nur freigegeben und ohne Heilversprechen (R21), „Zahlen aus“ gilt auch im Ratgeber.
 */
import { describe, expect, it } from 'vitest';

import { CARB_LOADING_NOTICE_DE, type Guide } from '../content/guide-schema';
import type { Recipe } from '../content/recipe-schema';
import { DEMO_GUIDES } from '../demo-nutrition';
import { checkGuide } from '../content/guide-checks';
import { findNutritionTextRuleHits } from '../content/text-rules';
import { filterRecipe } from './filter';
import { guideForDisplay, mentionsEnergyOrMacroGrams, readableGuides } from './guides';
import { buildMealPlanWeek, type MealPlanInput } from './meal-plan';
import { N3_FOODS, N3_RECIPES } from './meal-plan-fixtures';
import {
  recipeForPersonWithDiets,
  recipeSearchDietOptions,
  recipeSearchFacets,
  searchRecipes,
} from './recipe-search';
import {
  mealPlanProfileSchema,
  type MealPlanProfileInput,
  type NutritionInputsInput,
} from './schemas';
import {
  addRecipeToShoppingList,
  newShoppingList,
  parseStoredShoppingList,
  resolveShoppingList,
  shoppingItemOutsideProfileDiet,
  shoppingRecipeOutsideProfileDiet,
} from './shopping-list-store';
import { nutritionTargetsForWeek } from './targets';
import { inputs, MONDAY, seededRandom } from './test-helpers';

const SUNDAY_BEFORE = '2026-10-11';
type PlanInput = Omit<MealPlanInput, 'existingPlan' | 'variant'>;
const female = { sex: 'female' as const, healthFlags: { flags: [] } };
const pregnantFlags = {
  sex: 'female' as const,
  healthFlags: { flags: ['pregnancy', 'conservative_plan'] },
} satisfies Partial<NutritionInputsInput>;

function planInput(
  overrides: Partial<NutritionInputsInput>,
  profile: MealPlanProfileInput,
): PlanInput {
  return {
    targets: nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, mealsPerDay: 4, ...overrides }),
      MONDAY,
    ),
    profile,
    recipes: N3_RECIPES,
    foods: N3_FOODS,
    allowDrafts: true,
    today: SUNDAY_BEFORE,
  };
}

describe('Rezeptsuche: Ernährungsform erweiterbar, alle anderen Ausschlüsse hart (K3, G2, G4)', () => {
  it('Erweitern nur um großzügigere Formen', () => {
    expect(recipeSearchDietOptions('vegan')).toEqual(['vegetarian', 'omnivore']);
    expect(recipeSearchDietOptions('vegetarian')).toEqual(['omnivore']);
    expect(recipeSearchDietOptions('omnivore')).toEqual([]);
  });

  it('Eigenschaftstest: Suche = Einzelprüfung; nie ein Rezept, das filter.ts mit der erweiterten Form ausschließt', () => {
    const rnd = seededRandom(5003);
    const groups = ['peanuts', 'gluten', 'dairy', 'eggs', 'fish', 'mushrooms', 'soy'] as const;
    let checked = 0;
    for (let i = 0; i < 150; i += 1) {
      const diet = (['omnivore', 'vegetarian', 'vegan'] as const)[i % 3] as 'omnivore';
      const chosen = groups.filter(() => rnd() < 0.3);
      const profile = mealPlanProfileSchema.parse({
        diet,
        eatsPork: diet === 'omnivore' ? ([true, false, null] as const)[i % 3] : null,
        intolerances: chosen.filter((_, j) => j % 2 === 0),
        dislikes: chosen.filter((_, j) => j % 2 === 1),
      });
      const excludePregnancyCaution = rnd() < 0.5;
      const extra = recipeSearchDietOptions(profile.diet).filter(() => rnd() < 0.6);
      const ctx = { foods: N3_FOODS, profile, excludePregnancyCaution, allowDrafts: true };
      const hits = searchRecipes({ ...ctx, recipes: N3_RECIPES }, { diets: extra });
      const single = N3_RECIPES.filter((r) => recipeForPersonWithDiets(r, ctx, extra) !== null);
      expect(hits.map((h) => h.variant.recipe.id).sort()).toEqual(single.map((r) => r.id).sort());
      const widest = extra.includes('omnivore')
        ? 'omnivore'
        : extra.includes('vegetarian')
          ? 'vegetarian'
          : profile.diet;
      for (const hit of hits) {
        checked += 1;
        const own = filterRecipe(hit.variant.recipe, N3_FOODS, {
          profile,
          excludePregnancyCaution,
          allowDrafts: true,
        });
        const wide = filterRecipe(hit.variant.recipe, N3_FOODS, {
          profile: { ...profile, diet: widest },
          excludePregnancyCaution,
          allowDrafts: true,
        });
        // Treffer nur über filter.ts: mit der eigenen Form – sonst mit der erweiterten und dann gekennzeichnet.
        expect(own.ok || wide.ok).toBe(true);
        expect(hit.outsideProfileDiet === null).toBe(own.ok);
        if (excludePregnancyCaution) expect(hit.variant.facts.pregnancyCaution).toBe(false);
        const excluded = new Set<string>([...profile.intolerances, ...profile.dislikes]);
        expect(hit.variant.facts.allergens.filter((g) => excluded.has(g))).toEqual([]);
        if (profile.eatsPork !== true) expect(hit.variant.facts.containsPork).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('Schwangerschaft, Erdnuss-Unverträglichkeit, Schwein: auch erweitert nie in den Treffern', () => {
    const ids = (profile: MealPlanProfileInput, pregnancy: boolean) =>
      searchRecipes(
        {
          recipes: N3_RECIPES,
          foods: N3_FOODS,
          profile,
          excludePregnancyCaution: pregnancy,
          allowDrafts: true,
        },
        { diets: ['omnivore'] },
      ).map((h) => h.variant.recipe.id);
    const pregnant = ids({ diet: 'vegan' }, true);
    expect(pregnant).not.toContain('mascarponecreme-roh');
    expect(pregnant).not.toContain('brot-raeucherlachs');
    expect(pregnant).not.toContain('salami-brot');
    const peanut = ids({ diet: 'vegetarian', intolerances: ['peanuts'] }, false);
    expect(peanut).not.toContain('tofu-erdnuss-curry');
    expect(peanut).not.toContain('erdnuss-banane');
    // Vegetarisch erweitert auf „mit Fleisch“: Schwein nur bei eats_pork = true (G2) – hier unbekannt.
    const pork = ids({ diet: 'vegetarian' }, false);
    expect(pork).not.toContain('hack-spaghetti');
    expect(pork).not.toContain('salami-brot');
    expect(pork).toContain('haehnchen-reis');
  });

  it('weiche Filter aus dem Bestand: Kategorien in fester Reihenfolge, Abschnitte, Kosten nur freigegeben', () => {
    const base = N3_RECIPES.find((r) => r.id === 'banane-pur') as Recipe;
    const recipes: Recipe[] = [
      { ...base, id: 'a', categories: ['spar-kueche', 'schnell'], section_de: 'Snack' },
      {
        ...base,
        id: 'b',
        section_de: 'Frühstück',
        cost_estimate: { eur_per_serving: 1, as_of: '2026-10-01', basis: 'estimate' },
      },
    ];
    expect(recipeSearchFacets(recipes)).toEqual({
      categories: ['schnell', 'spar-kueche'],
      sections: ['Frühstück', 'Snack'],
      hasReviewedCosts: false,
    });
    expect(recipeSearchFacets([]).categories).toEqual([]);
    expect(
      recipeSearchFacets([
        {
          ...base,
          cost_estimate: {
            eur_per_serving: 1,
            as_of: '2026-10-01',
            basis: 'estimate',
            reviewed_by: 'KT',
          },
        },
      ]).hasReviewedCosts,
    ).toBe(true);
  });
});

describe('„Zur Einkaufsliste“ für Treffer der erweiterten Suche (19.6 K3/G4)', () => {
  const data = planInput(female, { diet: 'vegan' });
  const plan = buildMealPlanWeek(data);
  const base = newShoppingList(plan, data);

  it('erlaubt mit Kennzeichnung; ohne erweiterte Form wie bisher „passt nicht“', () => {
    expect(
      addRecipeToShoppingList(base, { recipeId: 'omelett-champignons', servings: 2 }, plan, data),
    ).toEqual({ ok: false, reason: 'not_for_you' });
    const added = addRecipeToShoppingList(
      base,
      { recipeId: 'omelett-champignons', servings: 2, diet: 'vegetarian' },
      plan,
      data,
    );
    if (!added.ok) throw new Error('erwartet');
    expect(added.list.recipes).toEqual([
      { recipeId: 'omelett-champignons', servings: 2, diet: 'vegetarian' },
    ]);
    const eggs = added.list.items.find((i) => i.foodId === 'huehnerei');
    expect(eggs).toBeDefined();
    expect(shoppingItemOutsideProfileDiet(eggs!, N3_FOODS, 'vegan')).toBe('vegetarian');
    // Plan-Einträge (vegan) tragen keine Kennzeichnung.
    for (const item of base.items) {
      expect(shoppingItemOutsideProfileDiet(item, N3_FOODS, 'vegan')).toBeNull();
    }
    // Rundweg Gerätespeicher; ältere Listen ohne `diet` bleiben gültig.
    const stored = parseStoredShoppingList(JSON.parse(JSON.stringify(added.list)));
    expect(stored?.recipes[0]?.diet).toBe('vegetarian');
    expect(parseStoredShoppingList(JSON.parse(JSON.stringify(base)))).not.toBeNull();
    expect(
      parseStoredShoppingList({
        ...added.list,
        recipes: [{ recipeId: 'x', servings: 2, diet: 'x' }],
      }),
    ).toBeNull();
    // Beim erneuten Auflösen bleibt das Rezept (Filter erneut mit der erweiterten Form).
    const again = resolveShoppingList(added.list, plan, data);
    expect(again.list.recipes).toHaveLength(1);
  });

  it('Erweitern hebt keinen anderen Ausschluss auf (Schwangerschaft, Unverträglichkeit, Schwein)', () => {
    const pregnant = planInput(pregnantFlags, { diet: 'vegan' });
    expect(
      addRecipeToShoppingList(
        base,
        { recipeId: 'mascarponecreme-roh', servings: 2, diet: 'vegetarian' },
        plan,
        pregnant,
      ),
    ).toEqual({ ok: false, reason: 'not_for_you' });
    const peanut = planInput(female, { diet: 'vegan', intolerances: ['peanuts'] });
    expect(
      addRecipeToShoppingList(
        base,
        { recipeId: 'erdnuss-banane', servings: 1, diet: 'omnivore' },
        plan,
        peanut,
      ),
    ).toEqual({ ok: false, reason: 'not_for_you' });
    expect(
      addRecipeToShoppingList(
        base,
        { recipeId: 'salami-brot', servings: 1, diet: 'omnivore' },
        plan,
        data,
      ),
    ).toEqual({ ok: false, reason: 'not_for_you' });
  });

  it('Schwangerschaft später gesetzt → hinzugefügtes Rezept fällt beim Auflösen weg', () => {
    const added = addRecipeToShoppingList(
      base,
      { recipeId: 'mascarponecreme-roh', servings: 2, diet: 'vegetarian' },
      plan,
      data,
    );
    if (!added.ok) throw new Error('erwartet');
    const pregnant = planInput(pregnantFlags, { diet: 'vegan' });
    const resolved = resolveShoppingList(added.list, plan, pregnant);
    expect(resolved.list.recipes).toEqual([]);
    expect(
      resolved.list.items.filter(
        (i) => !i.checked && N3_FOODS.get(i.foodId ?? '')?.pregnancy_caution,
      ),
    ).toEqual([]);
  });
});

const guideMeta: Guide['meta'] = {
  origin: 'manual',
  model: null,
  batch_id: null,
  created_on: '2026-10-14',
  expert_reviewed: false,
  reviewed_by: 'KT',
  reviewed_at: '2026-10-14',
  review_note: null,
};

function guide(overrides: Partial<Guide>): Guide {
  return {
    id: 'test-ratgeber',
    version: 1,
    status: 'published',
    title_de: 'Unterwegs essen',
    sections: [{ heading_de: 'Grundregeln', body_de: ['Gemüse oder Salat dazu.'] }],
    meta: guideMeta,
    ...overrides,
  };
}

describe('Ratgeber (6.8, Wächter-Auflage N5c)', () => {
  it('nur freigegeben (Testmodus: auch Entwürfe), nie archiviert, nie mit rotem Befund', () => {
    const published = guide({ id: 'frei' });
    const draft = guide({
      id: 'entwurf',
      status: 'draft',
      meta: { ...guideMeta, reviewed_by: null, reviewed_at: null },
    });
    const archived = guide({ id: 'alt', status: 'archived' });
    const claim = guide({
      id: 'versprechen',
      sections: [{ heading_de: 'Grundregeln', body_de: ['Dieses Essen stärkt die Abwehrkräfte.'] }],
    });
    const healing = guide({ id: 'heilung', title_de: 'Heilung durch Essen' });
    const carb = guide({
      id: 'carb',
      sections: [{ heading_de: 'Carb-Loading', body_de: ['Mehr Kohlenhydrate vor dem Rennen.'] }],
    });
    const all = [published, draft, archived, claim, healing, carb];
    expect(readableGuides(all, { allowDrafts: false }).map((g) => g.id)).toEqual(['frei']);
    expect(
      readableGuides(all, { allowDrafts: true })
        .map((g) => g.id)
        .sort(),
    ).toEqual(['entwurf', 'frei']);
    const withNotice = guide({
      id: 'carb-ok',
      sections: [
        {
          heading_de: 'Carb-Loading',
          body_de: ['Mehr Kohlenhydrate vor dem Rennen.'],
          notice_de: CARB_LOADING_NOTICE_DE,
        },
      ],
    });
    expect(readableGuides([withNotice], { allowDrafts: false })).toHaveLength(1);
    // Ungültiges Schema (z. B. veränderter Speicher) → nicht angezeigt.
    expect(readableGuides([{ ...published, title_de: '' }], { allowDrafts: true })).toEqual([]);
  });

  it('Beispiel-Ratgeber (Testmodus) ohne roten Befund; Carb-Loading mit festem Hinweis', () => {
    for (const g of DEMO_GUIDES) {
      expect(
        checkGuide(g).filter((i) => i.severity === 'error'),
        g.id,
      ).toEqual([]);
    }
    expect(readableGuides(DEMO_GUIDES, { allowDrafts: true })).toHaveLength(DEMO_GUIDES.length);
    expect(readableGuides(DEMO_GUIDES, { allowDrafts: false })).toEqual([]);
  });

  it('Zahlen aus: Absätze mit kcal bzw. Makro-Gramm ausgeblendet, feste Hinweise bleiben', () => {
    expect(mentionsEnergyOrMacroGrams('Eine Hauptmahlzeit hat etwa 500 bis 700 kcal.')).toBe(true);
    expect(mentionsEnergyOrMacroGrams('Etwa 2.000 kJ am Tag.')).toBe(true);
    expect(mentionsEnergyOrMacroGrams('8–10 g Kohlenhydrate pro kg Körpergewicht.')).toBe(true);
    expect(mentionsEnergyOrMacroGrams('20 g Eiweiß nach dem Training.')).toBe(true);
    expect(mentionsEnergyOrMacroGrams('3 g/kg KH am Vortag.')).toBe(true);
    expect(mentionsEnergyOrMacroGrams('Nimm 500 ml Wasser mit.')).toBe(false);
    expect(mentionsEnergyOrMacroGrams('Iss 2 Stunden vorher.')).toBe(false);
    expect(mentionsEnergyOrMacroGrams('Kalorien zählen musst du nicht.')).toBe(false);

    const wettkampf = DEMO_GUIDES.find((g) => g.id === 'demo-wettkampf') as Guide;
    const on = guideForDisplay(wettkampf, { showNumbers: true });
    const off = guideForDisplay(wettkampf, { showNumbers: false });
    expect(on.hiddenCount).toBe(0);
    expect(off.hiddenCount).toBe(1);
    const carbOff = off.sections.find((s) => s.heading === 'Carb-Loading');
    expect(carbOff?.notice).toBe(CARB_LOADING_NOTICE_DE);
    expect(carbOff?.hiddenCount).toBe(1);
    expect(JSON.stringify(off)).not.toMatch(/\d\s*g\b/u);
    const unterwegs = DEMO_GUIDES.find((g) => g.id === 'demo-unterwegs') as Guide;
    const offU = guideForDisplay(unterwegs, { showNumbers: false });
    expect(JSON.stringify(offU)).not.toContain('kcal');
    expect(offU.places[0]?.good.length).toBe(2);
    expect(offU.isDraft).toBe(true);
    // Einleitung, Orte und Tipp mit Zahlen werden ebenso ausgeblendet.
    const all = guideForDisplay(
      guide({
        intro_de: 'Ein Snack hat etwa 200 kcal.',
        places: [
          {
            name_de: 'Tankstelle',
            good_de: ['Nüsse, etwa 30 g Fett je Handvoll'],
            less_often_de: [],
            tip_de: 'Ein Riegel hat 250 kcal.',
          },
        ],
      }),
      { showNumbers: false },
    );
    expect(all.intro).toBeNull();
    expect(all.places[0]).toMatchObject({ good: [], tip: null, hiddenCount: 2 });
    expect(all.hiddenCount).toBe(3);
  });
});

describe('Wächter-Prüfung N5c: S1, S2, S3, K1, K2', () => {
  it('S1: Kennzeichnung des Rezepts über dietAllows – entfällt, wenn das Profil inzwischen passt', () => {
    expect(shoppingRecipeOutsideProfileDiet({ diet: 'vegetarian' }, 'vegan')).toBe('vegetarian');
    expect(shoppingRecipeOutsideProfileDiet({ diet: 'omnivore' }, 'vegetarian')).toBe('omnivore');
    // Profil später auf „mit Fleisch“ bzw. „vegetarisch“ geändert → passt, keine Kennzeichnung.
    expect(shoppingRecipeOutsideProfileDiet({ diet: 'vegetarian' }, 'omnivore')).toBeNull();
    expect(shoppingRecipeOutsideProfileDiet({ diet: 'vegetarian' }, 'vegetarian')).toBeNull();
    expect(shoppingRecipeOutsideProfileDiet({}, 'vegan')).toBeNull();
  });

  it('S2/K2: Bindestrich- und zusammengesetzte Wörter, MJ, Prozent', () => {
    for (const text of [
      'Ein 500-kcal-Snack reicht oft.',
      'Keine 2500-Kalorien-Diät.',
      'Dein 2000 Kalorienbedarf ist eine Schätzung.',
      'Etwa 8,4 MJ am Tag.',
      'Rund 1.200 Kilojoule.',
      'Die 30-g-Eiweiß-Regel.',
      'Etwa 30 % Fett in der Mahlzeit.',
      '55 Prozent der Energie aus Kohlenhydraten.',
      '2–3 g/kg KH am Vortag.',
    ]) {
      expect(mentionsEnergyOrMacroGrams(text), text).toBe(true);
    }
    for (const text of [
      'Nimm 500 ml Wasser mit.',
      '30 % der Wege fährst du mit dem Rad.',
      'Iss 2–3 Stunden vorher.',
      '200 g Haferflocken für vier Portionen.',
    ]) {
      expect(mentionsEnergyOrMacroGrams(text), text).toBe(false);
    }
  });

  it('K1: Titel, Überschriften und Ortsnamen mit Zahlen werden bei „Zahlen aus“ ausgeblendet', () => {
    const display = guideForDisplay(
      guide({
        title_de: 'Die 30-g-Eiweiß-Regel',
        sections: [{ heading_de: 'Bis 500 kcal', body_de: ['Iss in Ruhe.'] }],
        places: [{ name_de: '300-kcal-Ecke', good_de: ['Obst'], less_often_de: [] }],
      }),
      { showNumbers: false },
    );
    expect(display.title).toBeNull();
    expect(display.sections[0]).toMatchObject({ heading: null, paragraphs: ['Iss in Ruhe.'] });
    expect(display.places[0]).toMatchObject({ name: null, good: ['Obst'] });
    expect(display.hiddenCount).toBe(3);
    const on = guideForDisplay(guide({ title_de: 'Die 30-g-Eiweiß-Regel' }), { showNumbers: true });
    expect(on.title).toBe('Die 30-g-Eiweiß-Regel');
  });

  it('S3: typische Heilversprechen sind rot (R21) – ohne Fehlalarme in Alltagstexten', () => {
    for (const text of [
      'Das hilft gegen Erkältung.',
      'Kurkuma wirkt entzündungshemmend.',
      'Beugt Krebs vor.',
      'Beugt Muskelkrämpfen wirksam vor.',
      'Zum Vorbeugen von Müdigkeit.',
      'Gut für die Verdauung.',
      'Gut für dein Herz.',
      'Hilft beim Abnehmen.',
      'Unterstützt dich beim Abnehmen.',
      'Senkt den Blutdruck.',
      'Stärkt die Knochen.',
      'Stabilisiert den Blutzucker.',
      'Verdauungsfördernd und mild.',
      'Ideal in der Grippezeit.',
      'Gut für das Herz-Kreislauf-System.',
    ]) {
      const issues = checkGuide(
        guide({ sections: [{ heading_de: 'Grundregeln', body_de: [text] }] }),
      ).filter((i) => i.rule === 'R21');
      expect(issues.length, text).toBeGreaterThan(0);
    }
    for (const text of [
      'Gemüse oder Salat dazu.',
      'Vorbereitung am Vorabend spart Zeit.',
      'Beuge dich beim Schneiden nicht vor.',
      'Das Brot hält sich gut für zwei Tage.',
      'Flusskrebse und Garnelen kalt servieren.',
      'Hilft dir, den Einkauf zu planen.',
      'Wasser vor dem Training trinken.',
    ]) {
      expect(findNutritionTextRuleHits(text), text).toEqual([]);
    }
  });
});

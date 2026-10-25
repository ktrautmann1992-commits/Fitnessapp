/**
 * Rezept-Favoriten (Gründer-Freigabe 25.10.2026, KONZEPT 6.10a): „Lieblingsgericht“ (Herz) und „Nie wieder“.
 * DoD: „Nie wieder“ wird nie geplant (auch nicht als Ergänzungs-Snack, beim Tauschen, im Meal-Prep-Plan); fehlt dann
 * jede Alternative, bleibt der Platz leer mit Grund `recipe_hidden` – Planband und Grenzen unverändert. Herz =
 * gedeckelter Bonus, nie seltener als ohne, Wiederholungsgrenzen und harte Filter gelten weiter. Deterministisch,
 * ohne Vorlieben genau wie bisher. Grenzfälle: leere Liste, alle Rezepte ausgeblendet/Favorit, 1 vs. 8 Mahlzeiten.
 */
import { describe, expect, it } from 'vitest';

import { MEAL_PLAN_SCORING, PORTION_SCALE_LIMITS, RECIPE_PREFERENCE_RULES } from '../constants';
import type { Recipe } from '../content/recipe-schema';
import { filterRecipe, type FilteredRecipe } from './filter';
import {
  buildMealPlanWeek,
  type MealPlanInput,
  type MealPlanWeek,
  swapMealRecipe,
} from './meal-plan';
import {
  independentBand,
  N3_FOODS,
  N3_MEAL_PREP_PLANS,
  N3_RECIPES,
  usedFoodViolations,
} from './meal-plan-fixtures';
import { parseStoredMealPlanWeek, refreshedMealPlan } from './meal-plan-store';
import { applyMealPrepPlan } from './meal-prep-plan';
import {
  mealPlanHasRatedDownRecipes,
  ratingScoreBonus,
  recipeBlockedByRating,
  recipeBlockedOnAnyDay,
  recipeHiddenByUser,
  recipeRatingIndex,
} from './ratings';
import {
  hiddenRecipeEntries,
  RECIPE_PREFERENCE_KINDS,
  type RecipePreferenceInput,
  recipeIdsWithPreference,
  recipePreferenceLimitReached,
  recipePreferenceOf,
  recipePreferenceSchema,
  recipePreferencesSchema,
  setRecipePreference,
} from './recipe-preferences';
import { searchRecipes } from './recipe-search';
import { needsAutomaticReplan } from './replan';
import {
  type MealPlanProfileInput,
  mealPlanProfileSchema,
  type NutritionInputsInput,
} from './schemas';
import { nutritionTargetsForWeek } from './targets';
import { inputs, MONDAY, seededRandom } from './test-helpers';

const SUNDAY_BEFORE = '2026-10-11';
const EPS = 1e-6;
const OMNI: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };

function planInput(
  profile: MealPlanProfileInput = OMNI,
  extra: Partial<MealPlanInput> = {},
  overrides: Partial<NutritionInputsInput> = {},
): MealPlanInput {
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
    ...extra,
  };
}

const hide = (...ids: string[]): RecipePreferenceInput[] =>
  ids.map((recipeId) => ({ recipeId, kind: 'hidden', setOn: SUNDAY_BEFORE }));
const fav = (...ids: string[]): RecipePreferenceInput[] =>
  ids.map((recipeId) => ({ recipeId, kind: 'favorite', setOn: SUNDAY_BEFORE }));

function countOf(plan: MealPlanWeek, recipeId: string): number {
  return plan.days.reduce((n, d) => n + d.meals.filter((m) => m.recipeId === recipeId).length, 0);
}

function mostUsed(plan: MealPlanWeek): string {
  const counts = new Map<string, number>();
  plan.days.forEach((d) =>
    d.meals.forEach((m) => counts.set(m.recipeId, (counts.get(m.recipeId) ?? 0) + 1)),
  );
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? '';
}

function variantOf(id: string): FilteredRecipe {
  const r = filterRecipe(N3_RECIPES.find((x) => x.id === id) as Recipe, N3_FOODS, {
    profile: mealPlanProfileSchema.parse(OMNI),
    excludePregnancyCaution: false,
    allowDrafts: true,
  });
  if (!r.ok) throw new Error(id);
  return r.value;
}

describe('Rezept-Vorlieben: Schema, Setzen, Zurücknehmen', () => {
  it('genau zwei Arten, strikt, gültiges Datum, je Rezept eine Vorliebe', () => {
    expect(RECIPE_PREFERENCE_KINDS).toEqual(['favorite', 'hidden']);
    expect(
      recipePreferenceSchema.safeParse({ recipeId: 'banane-pur', kind: 'hidden', setOn: MONDAY })
        .success,
    ).toBe(true);
    for (const bad of [
      { recipeId: 'banane-pur', kind: 'like', setOn: MONDAY },
      { recipeId: 'banane-pur', kind: 'hidden', setOn: '12.10.2026' },
      { recipeId: 'x', kind: 'hidden', setOn: MONDAY },
      { recipeId: 'banane-pur', kind: 'hidden', setOn: MONDAY, reason: 'taste' },
    ]) {
      expect(recipePreferenceSchema.safeParse(bad).success).toBe(false);
    }
    expect(
      recipePreferencesSchema.safeParse([...hide('banane-pur'), ...fav('banane-pur')]).success,
    ).toBe(false);
  });

  it('setRecipePreference: Herz ↔ „Nie wieder“ ersetzt sich, null nimmt zurück, sortiert nach ID', () => {
    let prefs = setRecipePreference([], {
      recipeId: 'paprika-sticks',
      kind: 'favorite',
      setOn: MONDAY,
    });
    prefs = setRecipePreference(prefs, { recipeId: 'banane-pur', kind: 'hidden', setOn: MONDAY });
    expect(prefs.map((p) => p.recipeId)).toEqual(['banane-pur', 'paprika-sticks']);
    prefs = setRecipePreference(prefs, {
      recipeId: 'paprika-sticks',
      kind: 'hidden',
      setOn: MONDAY,
    });
    expect(recipePreferenceOf(prefs, 'paprika-sticks')).toBe('hidden');
    expect(prefs).toHaveLength(2);
    prefs = setRecipePreference(prefs, { recipeId: 'banane-pur', kind: null, setOn: MONDAY });
    expect(recipePreferenceOf(prefs, 'banane-pur')).toBeNull();
    expect(recipeIdsWithPreference(prefs, 'hidden')).toEqual(['paprika-sticks']);
    expect(recipeIdsWithPreference(undefined, 'favorite')).toEqual([]);
    // Zurücknehmen ohne Vorliebe ist kein Fehler; ungültige Eingaben werfen.
    expect(setRecipePreference([], { recipeId: 'banane-pur', kind: null, setOn: MONDAY })).toEqual(
      [],
    );
    expect(() =>
      setRecipePreference([], { recipeId: 'banane-pur', kind: 'hidden', setOn: 'gestern' }),
    ).toThrow();
  });

  it('Obergrenze: neue Vorliebe bei voller Liste nicht möglich, Ändern einer vorhandenen schon', () => {
    const full = Array.from({ length: RECIPE_PREFERENCE_RULES.maxEntries }, (_, i) => ({
      recipeId: `rezept-${String(i).padStart(4, '0')}`,
    }));
    expect(recipePreferenceLimitReached(full, 'neues-rezept')).toBe(true);
    expect(recipePreferenceLimitReached(full, 'rezept-0007')).toBe(false);
    expect(recipePreferenceLimitReached(full.slice(1), 'neues-rezept')).toBe(false);
  });

  it('„Ausgeblendete Gerichte“: nur „Nie wieder“, nach Titel, unbekannte Rezepte am Ende', () => {
    const prefs = [
      ...hide('paprika-sticks', 'gibt-es-nicht', 'banane-pur'),
      ...fav('overnight-oats'),
    ];
    const entries = hiddenRecipeEntries(prefs, N3_RECIPES);
    expect(entries.map((e) => e.recipeId).at(-1)).toBe('gibt-es-nicht');
    expect(entries.at(-1)?.titleDe).toBeNull();
    expect(entries).toHaveLength(3);
    const titled = entries.filter((e) => e.titleDe !== null).map((e) => e.titleDe as string);
    expect(titled).toEqual([...titled].sort((a, b) => a.localeCompare(b, 'de')));
    expect(hiddenRecipeEntries(undefined, N3_RECIPES)).toEqual([]);
  });
});

describe('„Nie wieder“: wird nie geplant', () => {
  it('ohne Vorlieben bzw. mit leerer Liste: Plan genau wie bisher', () => {
    const base = buildMealPlanWeek(planInput());
    expect(buildMealPlanWeek(planInput(OMNI, { recipePreferences: [] }))).toEqual(base);
  });

  it('das meistgenutzte Rezept ausgeblendet → kommt in der Woche nicht mehr vor, dauerhaft (kein Ablauf)', () => {
    const base = buildMealPlanWeek(planInput());
    const id = mostUsed(base);
    expect(countOf(base, id)).toBeGreaterThan(0);
    const hidden = buildMealPlanWeek(planInput(OMNI, { recipePreferences: hide(id) }));
    expect(countOf(hidden, id)).toBe(0);
    // Auch „vor einem Jahr“ ausgeblendet: weiterhin gesperrt (anders als Daumen runter mit 8 Wochen).
    const old = buildMealPlanWeek(
      planInput(OMNI, {
        recipePreferences: [{ recipeId: id, kind: 'hidden', setOn: '2025-10-01' }],
      }),
    );
    expect(countOf(old, id)).toBe(0);
    const index = recipeRatingIndex(undefined, hide(id));
    expect(recipeHiddenByUser(index, id)).toBe(true);
    expect(recipeBlockedByRating(index, id, '2030-01-01')).toBe(true);
    expect(recipeBlockedOnAnyDay(index, id, [])).toBe(false);
  });

  it('alle Frühstücke ausgeblendet → leerer Platz mit Grund `recipe_hidden`, keine Ergänzung daraus', () => {
    const breakfasts = N3_RECIPES.filter((r) => r.meal_types.includes('breakfast'));
    const plan = buildMealPlanWeek(
      planInput(OMNI, { recipePreferences: hide(...breakfasts.map((r) => r.id)) }),
    );
    for (const day of plan.days) {
      expect(day.meals.some((m) => breakfasts.some((r) => r.id === m.recipeId))).toBe(false);
      expect(day.emptySlots.find((e) => e.slot === 'breakfast')?.reasons).toEqual([
        'recipe_hidden',
      ]);
    }
    expect(parseStoredMealPlanWeek(JSON.parse(JSON.stringify(plan)))).not.toBeNull();
  });

  it('gemischt (ein Teil Daumen runter, Rest ausgeblendet) → beide Gründe, sortiert', () => {
    const breakfasts = N3_RECIPES.filter((r) => r.meal_types.includes('breakfast'));
    const [first, ...rest] = breakfasts;
    if (first === undefined || rest.length === 0) throw new Error('Fixture');
    const plan = buildMealPlanWeek(
      planInput(OMNI, {
        ratings: [{ recipeId: first.id, value: 'down', ratedOn: SUNDAY_BEFORE }],
        recipePreferences: hide(...rest.map((r) => r.id)),
      }),
    );
    const reasons = plan.days[0]?.emptySlots.find((e) => e.slot === 'breakfast')?.reasons;
    expect(reasons).toEqual(['rated_down', 'recipe_hidden']);
  });

  it('„Rezept tauschen“ schlägt ein ausgeblendetes Rezept nicht vor', () => {
    const input = planInput(OMNI, { today: MONDAY }, { today: MONDAY });
    const plan = buildMealPlanWeek(input);
    let checked = 0;
    plan.days.forEach((day, dayIndex) => {
      for (const meal of day.meals.filter((m) => !m.isFill)) {
        const target = { date: day.date, slot: meal.slot as 'lunch' };
        const free = swapMealRecipe(plan, target, input);
        if (!free.ok) continue;
        const chosen = free.plan.days[dayIndex]?.meals.find((m) => m.slot === meal.slot)
          ?.recipeId as string;
        const hidden = swapMealRecipe(plan, target, { ...input, recipePreferences: hide(chosen) });
        checked += 1;
        if (hidden.ok) {
          expect(
            hidden.plan.days[dayIndex]?.meals.find((m) => m.slot === meal.slot)?.recipeId,
          ).not.toBe(chosen);
        } else {
          expect(hidden.reason).toBe('no_alternative');
        }
      }
    });
    expect(checked).toBeGreaterThan(0);
  });

  it('Meal-Prep-Wochenplan mit einem ausgeblendeten Rezept wird nicht angeboten; Herz ändert nichts', () => {
    const vegan: MealPlanProfileInput = { diet: 'vegan' };
    const input = (recipePreferences: RecipePreferenceInput[] = []): MealPlanInput =>
      planInput(vegan, { recipePreferences }, { sex: 'female' });
    const offered = N3_MEAL_PREP_PLANS.filter((p) => applyMealPrepPlan(p, input()).offered);
    expect(offered.length).toBeGreaterThan(0);
    for (const p of offered) {
      for (const recipeId of p.recipe_ids) {
        expect(applyMealPrepPlan(p, input(hide(recipeId))).offered).toBe(false);
        expect(applyMealPrepPlan(p, input(fav(recipeId))).offered).toBe(true);
      }
    }
  });

  it('keine automatische Neuplanung der laufenden Woche (K7); kommende Woche → „Plan aktualisieren“', () => {
    const input = planInput();
    const plan = buildMealPlanWeek(input);
    const id = mostUsed(plan);
    expect(needsAutomaticReplan(plan, { ...input, recipePreferences: hide(id) }).needed).toBe(
      false,
    );
    expect(mealPlanHasRatedDownRecipes(plan, [], SUNDAY_BEFORE, hide(id))).toBe(true);
    expect(mealPlanHasRatedDownRecipes(plan, [], MONDAY, hide(id))).toBe(false);
    expect(mealPlanHasRatedDownRecipes(plan, [], SUNDAY_BEFORE, fav(id))).toBe(false);
    expect(mealPlanHasRatedDownRecipes(plan, [], SUNDAY_BEFORE)).toBe(false);
    const refreshed = refreshedMealPlan(plan, { ...input, recipePreferences: hide(id) });
    expect(countOf(refreshed, id)).toBe(0);
    expect(mealPlanHasRatedDownRecipes(refreshed, [], SUNDAY_BEFORE, hide(id))).toBe(false);
  });
});

describe('„Lieblingsgericht“: bevorzugt, aber gedeckelt', () => {
  it('Bonus = ratingFavorite, mit Daumen hoch NICHT addiert, Deckel unter dem Wiederholungs-Abzug', () => {
    const W = MEAL_PLAN_SCORING;
    expect(W.ratingFavorite).toBeGreaterThan(W.ratingUp);
    expect(W.ratingFavorite).toBeLessThanOrEqual(W.ratingMaxTotal);
    expect(W.ratingMaxTotal).toBeLessThan(W.repeat);
    const banana = variantOf('banane-pur');
    expect(ratingScoreBonus(recipeRatingIndex(undefined, fav('banane-pur')), banana, MONDAY)).toBe(
      W.ratingFavorite,
    );
    const both = recipeRatingIndex(
      [{ recipeId: 'banane-pur', value: 'up', ratedOn: SUNDAY_BEFORE }],
      fav('banane-pur'),
    );
    expect(ratingScoreBonus(both, banana, MONDAY)).toBe(W.ratingFavorite);
    expect(
      ratingScoreBonus(recipeRatingIndex(undefined, fav('paprika-sticks')), banana, MONDAY),
    ).toBe(0);
    // Daumen hoch allein: unverändert wie bisher.
    expect(
      ratingScoreBonus(
        recipeRatingIndex([{ recipeId: 'banane-pur', value: 'up', ratedOn: SUNDAY_BEFORE }]),
        banana,
        MONDAY,
      ),
    ).toBe(W.ratingUp);
  });

  it('je Rezept nie seltener als ohne Herz, über alle Rezepte zusammen häufiger', () => {
    const profiles: MealPlanProfileInput[] = [OMNI, { diet: 'vegetarian' }, { diet: 'vegan' }];
    let gained = 0;
    for (const profile of profiles) {
      const base = buildMealPlanWeek(planInput(profile));
      for (const r of N3_RECIPES) {
        const plan = buildMealPlanWeek(planInput(profile, { recipePreferences: fav(r.id) }));
        expect(countOf(plan, r.id), `${String(profile.diet)} ${r.id}`).toBeGreaterThanOrEqual(
          countOf(base, r.id),
        );
        gained += countOf(plan, r.id) - countOf(base, r.id);
      }
    }
    expect(gained).toBeGreaterThan(0);
  }, 60_000);

  it('alle Rezepte als Favorit → derselbe Plan wie ohne (gleicher Bonus für alle ändert keine Reihenfolge)', () => {
    const base = buildMealPlanWeek(planInput());
    const all = buildMealPlanWeek(
      planInput(OMNI, { recipePreferences: fav(...N3_RECIPES.map((r) => r.id)) }),
    );
    expect(all).toEqual(base);
  });

  it('Herz hebt keinen harten Filter auf: Favorit mit Allergen bleibt draußen (Plan und Suche)', () => {
    const profile = mealPlanProfileSchema.parse({ ...OMNI, intolerances: ['dairy'] });
    const withDairy = N3_RECIPES.filter(
      (r) =>
        !filterRecipe(r, N3_FOODS, {
          profile,
          excludePregnancyCaution: false,
          allowDrafts: true,
        }).ok,
    ).map((r) => r.id);
    expect(withDairy.length).toBeGreaterThan(0);
    const plan = buildMealPlanWeek(planInput(profile, { recipePreferences: fav(...withDairy) }));
    for (const id of withDairy) expect(countOf(plan, id)).toBe(0);
    const hits = searchRecipes(
      {
        recipes: N3_RECIPES,
        foods: N3_FOODS,
        profile,
        excludePregnancyCaution: false,
        allowDrafts: true,
        preferences: fav(...withDairy),
      },
      { favoritesOnly: true },
    );
    expect(hits).toEqual([]);
  });

  it('deterministisch: Reihenfolge der Vorlieben egal', () => {
    const prefs = [...fav('overnight-oats', 'paprika-sticks'), ...hide('banane-pur')];
    const a = buildMealPlanWeek(planInput(OMNI, { recipePreferences: prefs }));
    const b = buildMealPlanWeek(planInput(OMNI, { recipePreferences: [...prefs].reverse() }));
    expect(a).toEqual(b);
  });
});

describe('Eigenschaftstest: Vorlieben ändern nie Planband, Grenzen oder harte Ausschlüsse', () => {
  it('1–8 Mahlzeiten, alle Ernährungsformen, Schwangerschaft, ohne Einwilligung', () => {
    const rnd = seededRandom(25_102_026);
    const groups = ['peanuts', 'gluten', 'dairy', 'eggs', 'fish', 'soy'] as const;
    let checkedMeals = 0;
    for (let i = 0; i < 48; i += 1) {
      const diet = (['omnivore', 'vegetarian', 'vegan'] as const)[i % 3] as 'omnivore';
      const profile = mealPlanProfileSchema.parse({
        diet,
        eatsPork: diet === 'omnivore' ? rnd() < 0.5 : null,
        intolerances: groups.filter(() => rnd() < 0.15),
        cookingMode: i % 4 === 0 ? 'meal_prep' : 'daily',
        mealprepDays: i % 4 === 0 ? 1 + (i % 3) : null,
      });
      const pregnant = i % 5 === 0;
      const noConsent = i % 7 === 0;
      const overrides: Partial<NutritionInputsInput> = {
        mealsPerDay: 1 + (i % 8),
        sex: 'female',
        healthFlags: pregnant ? { flags: ['pregnancy', 'conservative_plan'] } : { flags: [] },
        ...(noConsent && !pregnant
          ? { healthDataConsent: false, bodyMetricsRows: [], healthFlags: null }
          : {}),
      };
      const prefs: RecipePreferenceInput[] = N3_RECIPES.flatMap((r): RecipePreferenceInput[] => {
        const x = rnd();
        if (x < 0.2) return hide(r.id);
        return x < 0.45 ? fav(r.id) : [];
      });
      const input = planInput(profile, { recipePreferences: prefs }, overrides);
      const plan = buildMealPlanWeek(input);
      const hidden = new Set(recipeIdsWithPreference(prefs, 'hidden'));
      for (const day of plan.days) {
        const targets = input.targets.days.find((d) => d.date === day.date);
        if (targets === undefined) throw new Error(day.date);
        expect(day.band).toEqual(targets.band);
        if (day.status === 'complete' && targets.band !== null) {
          const [min, max] = independentBand(targets);
          const kcal = day.meals.reduce((sum, m) => sum + m.nutrients.kcal, 0);
          expect(kcal).toBeGreaterThanOrEqual(min - 1 - EPS);
          expect(kcal).toBeLessThanOrEqual(max + 1 + EPS);
        }
        for (const meal of day.meals) {
          checkedMeals += 1;
          expect(hidden.has(meal.recipeId)).toBe(false);
          expect(meal.factor).toBeGreaterThanOrEqual(PORTION_SCALE_LIMITS.min - EPS);
          expect(meal.factor).toBeLessThanOrEqual(PORTION_SCALE_LIMITS.max + EPS);
          const recipe = N3_RECIPES.find((r) => r.id === meal.recipeId) as Recipe;
          const pregnancy = targets.recipeExclusions.includes('pregnancy_caution');
          expect(usedFoodViolations(recipe, meal.ingredients, profile, pregnancy)).toEqual([]);
        }
      }
    }
    expect(checkedMeals).toBeGreaterThan(400);
  }, 60_000);
});

describe('Rezeptsuche mit Vorlieben', () => {
  const base = {
    recipes: N3_RECIPES,
    foods: N3_FOODS,
    profile: OMNI,
    excludePregnancyCaution: false,
    allowDrafts: true,
  };

  it('„Nie wieder“ ist ausgeblendet, Herz markiert, „Nur Lieblingsgerichte“ filtert', () => {
    const all = searchRecipes(base);
    expect(all.every((h) => !h.favorite)).toBe(true);
    const [a, b] = all;
    if (a === undefined || b === undefined) throw new Error('Fixture');
    const prefs = [...hide(a.variant.recipe.id), ...fav(b.variant.recipe.id)];
    const hits = searchRecipes({ ...base, preferences: prefs });
    expect(hits.some((h) => h.variant.recipe.id === a.variant.recipe.id)).toBe(false);
    expect(hits).toHaveLength(all.length - 1);
    expect(hits.find((h) => h.variant.recipe.id === b.variant.recipe.id)?.favorite).toBe(true);
    const only = searchRecipes({ ...base, preferences: prefs }, { favoritesOnly: true });
    expect(only.map((h) => h.variant.recipe.id)).toEqual([b.variant.recipe.id]);
    // Ohne Favoriten: „Nur Lieblingsgerichte“ ergibt eine leere Liste (kein Fehler).
    expect(searchRecipes(base, { favoritesOnly: true })).toEqual([]);
  });
});

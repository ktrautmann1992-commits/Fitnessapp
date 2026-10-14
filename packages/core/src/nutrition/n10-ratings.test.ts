/**
 * Etappe N10 – Bewertung nach dem Essen (KONZEPT 6.10, docs/PLAN-PHASE-5.md 19.7 N10, gratis, ohne KI).
 * DoD: „8 Wochen genau“, „Plan bleibt deterministisch“, „`food_dislikes` schließt aus“, „Grund ‚Unverträglich‘ landet
 * nie in einer gespeicherten Bewertung“; dazu K6 „kein Grund ändert Energie, Portionen oder Grenzen“ als
 * Eigenschaftstest (jeder Tag im Planband oder `below_floor`, Faktoren 0,5–2,0, nie ein ausgeschlossenes Rezept),
 * Meal-Prep-Plan mit Daumen runter (19.6 Nr. 8), Grenzfälle (keine Bewertungen, alle Kandidaten abgelehnt, 1 vs. 8
 * Mahlzeiten, `no_targets`).
 */
import { describe, expect, it } from 'vitest';

import { MEAL_PLAN_SCORING, PORTION_SCALE_LIMITS, RECIPE_RATING_RULES } from '../constants';
import type { Recipe } from '../content/recipe-schema';
import { addDays } from '../dates';
import { filterRecipe, foodAllowedForPerson, type FilteredRecipe } from './filter';
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
  activeRatingReasons,
  addFoodDislikes,
  foodDislikeChoices,
  foodDislikesSchema,
  mealPlanHasRatedDownRecipes,
  mealRatable,
  RECIPE_RATING_CHOICES,
  RECIPE_RATING_REASONS,
  ratingExclusionLastDay,
  ratingScoreBonus,
  recipeBlockedByRating,
  type RecipeRatingInput,
  recipeRatingFromChoice,
  recipeRatingIndex,
  recipeRatingLimitReached,
  recipeRatingSchema,
  recipeRatingsSchema,
  recipeSatietyIndex,
  removeFoodDislike,
  removeRecipeRating,
  upsertRecipeRating,
} from './ratings';
import { needsAutomaticReplan } from './replan';
import { searchRecipes } from './recipe-search';
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

function recipeDays(plan: MealPlanWeek, recipeId: string): string[] {
  return plan.days.filter((d) => d.meals.some((m) => m.recipeId === recipeId)).map((d) => d.date);
}

function countOf(plan: MealPlanWeek, recipeId: string): number {
  return plan.days.reduce((n, d) => n + d.meals.filter((m) => m.recipeId === recipeId).length, 0);
}

function variantOf(id: string, profile: MealPlanProfileInput = OMNI): FilteredRecipe {
  const r = filterRecipe(N3_RECIPES.find((x) => x.id === id) as Recipe, N3_FOODS, {
    profile: mealPlanProfileSchema.parse(profile),
    excludePregnancyCaution: false,
    allowDrafts: true,
  });
  if (!r.ok) throw new Error(id);
  return r.value;
}

/** Häufigstes Rezept eines Plans (für Tests mit „ein Rezept, das sicher vorkommt“). */
function mostUsed(plan: MealPlanWeek): string {
  const counts = new Map<string, number>();
  plan.days.forEach((d) =>
    d.meals.forEach((m) => counts.set(m.recipeId, (counts.get(m.recipeId) ?? 0) + 1)),
  );
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? '';
}

describe('Bewertung: Schema und Datenschutz (KONZEPT 6.10, Art. 9)', () => {
  it('„Unverträglich“ ist kein speicherbarer Grund – weder in der Liste noch im Schema', () => {
    expect(RECIPE_RATING_REASONS).toEqual(['taste', 'effort', 'cost', 'satiety']);
    expect(RECIPE_RATING_REASONS as readonly string[]).not.toContain('intolerant');
    expect(RECIPE_RATING_CHOICES).toContain('intolerant');
    for (const reason of ['intolerant', 'unvertraeglich', 'Unverträglich', 'allergy']) {
      expect(
        recipeRatingSchema.safeParse({
          recipeId: 'banane-pur',
          value: 'down',
          reason,
          ratedOn: MONDAY,
        }).success,
      ).toBe(false);
    }
  });

  it('strikt: keine zusätzlichen Felder, Grund nur bei Daumen runter, je Rezept eine Bewertung', () => {
    const base = { recipeId: 'banane-pur', value: 'down', reason: 'taste', ratedOn: MONDAY };
    expect(recipeRatingSchema.safeParse(base).success).toBe(true);
    expect(recipeRatingSchema.safeParse({ ...base, note: 'Bauchweh' }).success).toBe(false);
    expect(recipeRatingSchema.safeParse({ ...base, value: 'up' }).success).toBe(false);
    expect(recipeRatingSchema.safeParse({ ...base, value: 'up', reason: null }).success).toBe(true);
    expect(recipeRatingSchema.safeParse({ ...base, ratedOn: '2026-13-01' }).success).toBe(false);
    expect(recipeRatingSchema.safeParse({ ...base, recipeId: 'Kein Slug!' }).success).toBe(false);
    expect(
      recipeRatingsSchema.safeParse([base, { ...base, value: 'up', reason: null }]).success,
    ).toBe(false);
  });

  it('recipeRatingFromChoice: „Unverträglich“ → Grund null + Dialog; Daumen hoch verwirft Gründe', () => {
    const intolerant = recipeRatingFromChoice({
      recipeId: 'erdnuss-banane',
      value: 'down',
      choice: 'intolerant',
      ratedOn: MONDAY,
    });
    expect(intolerant).toEqual({
      rating: { recipeId: 'erdnuss-banane', value: 'down', reason: null, ratedOn: MONDAY },
      offerFoodDislikes: true,
    });
    // Auch serialisiert (Gerätespeicher, späterer Payload) taucht der Grund nirgends auf.
    expect(JSON.stringify(intolerant.rating)).not.toMatch(/intoler|unvertr/i);
    expect(
      recipeRatingFromChoice({
        recipeId: 'x-y',
        value: 'up',
        choice: 'intolerant',
        ratedOn: MONDAY,
      }),
    ).toEqual({
      rating: { recipeId: 'x-y', value: 'up', reason: null, ratedOn: MONDAY },
      offerFoodDislikes: false,
    });
    for (const reason of RECIPE_RATING_REASONS) {
      const d = recipeRatingFromChoice({
        recipeId: 'x-y',
        value: 'down',
        choice: reason,
        ratedOn: MONDAY,
      });
      expect(d.rating.reason).toBe(reason);
      expect(d.offerFoodDislikes).toBe(false);
    }
    expect(
      recipeRatingFromChoice({ recipeId: 'x-y', value: 'down', choice: null, ratedOn: MONDAY })
        .rating.reason,
    ).toBeNull();
  });

  it('Eigenschaftstest: keine Auswahl erzeugt je eine Bewertung mit Gesundheitsgrund', () => {
    for (const value of ['up', 'down'] as const) {
      for (const choice of [...RECIPE_RATING_CHOICES, null]) {
        const { rating } = recipeRatingFromChoice({
          recipeId: 'x-y',
          value,
          choice,
          ratedOn: MONDAY,
        });
        expect(JSON.stringify(rating)).not.toMatch(/intoler|unvertr/i);
        expect(recipeRatingSchema.safeParse(rating).success).toBe(true);
      }
    }
  });

  it('upsert/remove: je Rezept die letzte Bewertung, sortiert; zurücknehmen entfernt sie', () => {
    let list = upsertRecipeRating([], { recipeId: 'b-b', value: 'up', ratedOn: MONDAY });
    list = upsertRecipeRating(list, {
      recipeId: 'a-a',
      value: 'down',
      reason: 'cost',
      ratedOn: MONDAY,
    });
    list = upsertRecipeRating(list, { recipeId: 'b-b', value: 'down', ratedOn: '2026-10-13' });
    expect(list.map((r) => [r.recipeId, r.value])).toEqual([
      ['a-a', 'down'],
      ['b-b', 'down'],
    ]);
    expect(removeRecipeRating(list, 'a-a').map((r) => r.recipeId)).toEqual(['b-b']);
    expect(removeRecipeRating(list, 'gibt-es-nicht')).toHaveLength(2);
  });

  it('nur nach dem Essen: bewertbar am Tag selbst und danach, nie vorher', () => {
    expect(mealRatable(MONDAY, MONDAY)).toBe(true);
    expect(mealRatable(SUNDAY_BEFORE, MONDAY)).toBe(true);
    expect(mealRatable('2026-10-13', MONDAY)).toBe(false);
  });
});

describe('Daumen runter: 8 Wochen genau (tagesgenau, deterministisch)', () => {
  const rated = (ratedOn: string): RecipeRatingInput[] => [
    { recipeId: 'banane-pur', value: 'down', ratedOn },
  ];

  it('Bewertungstag + 55 Tage gesperrt, Tag 57 wieder frei; vorher nie', () => {
    expect(RECIPE_RATING_RULES.downExclusionDays).toBe(56);
    expect(ratingExclusionLastDay('2026-10-14')).toBe('2026-12-08');
    const index = recipeRatingIndex(rated('2026-10-14'));
    expect(recipeBlockedByRating(index, 'banane-pur', '2026-10-13')).toBe(false);
    expect(recipeBlockedByRating(index, 'banane-pur', '2026-10-14')).toBe(true);
    expect(recipeBlockedByRating(index, 'banane-pur', '2026-12-08')).toBe(true);
    expect(recipeBlockedByRating(index, 'banane-pur', '2026-12-09')).toBe(false);
    expect(recipeBlockedByRating(index, 'anderes-rezept', '2026-10-20')).toBe(false);
    // Über einen Jahreswechsel und Schaltjahr hinweg (2028-02-29).
    expect(ratingExclusionLastDay('2027-12-20')).toBe(addDays('2027-12-20', 55));
    expect(ratingExclusionLastDay('2028-01-10')).toBe('2028-03-05');
    // Daumen hoch sperrt nie.
    const up = recipeRatingIndex([{ recipeId: 'banane-pur', value: 'up', ratedOn: MONDAY }]);
    expect(recipeBlockedByRating(up, 'banane-pur', MONDAY)).toBe(false);
  });

  it('im Plan: gesperrt an den Tagen bis zum letzten Tag, ab dem Folgetag wieder möglich', () => {
    const base = buildMealPlanWeek(planInput());
    const id = mostUsed(base);
    expect(countOf(base, id)).toBeGreaterThan(1);
    // Ganze Woche gesperrt.
    const blocked = buildMealPlanWeek(
      planInput(OMNI, { ratings: [{ recipeId: id, value: 'down', ratedOn: SUNDAY_BEFORE }] }),
    );
    expect(countOf(blocked, id)).toBe(0);
    // Letzter gesperrter Tag = Dienstag → Mo/Di nie, danach erlaubt.
    const tuesday = addDays(MONDAY, 1);
    const ratedOn = addDays(tuesday, -55);
    expect(ratingExclusionLastDay(ratedOn)).toBe(tuesday);
    const partly = buildMealPlanWeek(
      planInput(OMNI, { ratings: [{ recipeId: id, value: 'down', ratedOn }] }),
    );
    expect(recipeDays(partly, id).every((d) => d > tuesday)).toBe(true);
    expect(countOf(partly, id)).toBeGreaterThan(0);
    // Abgelaufen (Tag 57 = Montag) → derselbe Plan wie ohne Bewertung.
    const expired = buildMealPlanWeek(
      planInput(OMNI, {
        ratings: [{ recipeId: id, value: 'down', ratedOn: addDays(MONDAY, -56) }],
      }),
    );
    expect(expired).toEqual(base);
  });

  it('Plan bleibt deterministisch: gleiche Eingaben → gleicher Plan, Reihenfolge der Bewertungen egal', () => {
    const ratings: RecipeRatingInput[] = [
      { recipeId: 'banane-pur', value: 'down', reason: 'effort', ratedOn: SUNDAY_BEFORE },
      { recipeId: 'overnight-oats', value: 'up', ratedOn: '2026-10-01' },
      { recipeId: 'paprika-sticks', value: 'down', reason: 'satiety', ratedOn: '2026-09-30' },
    ];
    const a = buildMealPlanWeek(planInput(OMNI, { ratings }));
    const b = buildMealPlanWeek(planInput(OMNI, { ratings: [...ratings].reverse() }));
    expect(a).toEqual(b);
    expect(buildMealPlanWeek(planInput(OMNI, { ratings }))).toEqual(a);
    // Ohne Bewertungen bzw. mit leerer Liste: unverändert gegenüber bisher (Engine-Version bleibt).
    expect(buildMealPlanWeek(planInput(OMNI, { ratings: [] }))).toEqual(
      buildMealPlanWeek(planInput()),
    );
  });

  it('Bewertungen lösen keine automatische Neuplanung aus (laufende Woche bleibt, K7)', () => {
    const plan = buildMealPlanWeek(planInput());
    const id = mostUsed(plan);
    const check = needsAutomaticReplan(plan, {
      ...planInput(OMNI, {
        ratings: [{ recipeId: id, value: 'down', reason: 'taste', ratedOn: SUNDAY_BEFORE }],
      }),
    });
    expect(check.needed).toBe(false);
  });

  it('„Rezept tauschen“ schlägt ein abgelehntes Rezept nicht vor', () => {
    const today = MONDAY;
    const input = planInput(OMNI, { today }, { today });
    const plan = buildMealPlanWeek(input);
    let checked = 0;
    plan.days.forEach((day, dayIndex) => {
      for (const meal of day.meals.filter((m) => !m.isFill)) {
        const target = { date: day.date, slot: meal.slot as 'lunch' };
        const free = swapMealRecipe(plan, target, input);
        if (!free.ok) continue;
        const chosen = free.plan.days[dayIndex]?.meals.find((m) => m.slot === meal.slot)
          ?.recipeId as string;
        const rated = swapMealRecipe(plan, target, {
          ...input,
          ratings: [{ recipeId: chosen, value: 'down', ratedOn: today }],
        });
        checked += 1;
        if (rated.ok) {
          expect(
            rated.plan.days[dayIndex]?.meals.find((m) => m.slot === meal.slot)?.recipeId,
          ).not.toBe(chosen);
        } else {
          expect(rated.reason).toBe('no_alternative');
        }
      }
    });
    expect(checked).toBeGreaterThan(0);
  });

  it('alle Kandidaten eines Platzes abgelehnt → leerer Platz mit Grund `rated_down` (kein Filter-Grund)', () => {
    const breakfasts = N3_RECIPES.filter((r) => r.meal_types.includes('breakfast'));
    const ratings = breakfasts.map((r) => ({
      recipeId: r.id,
      value: 'down' as const,
      ratedOn: SUNDAY_BEFORE,
    }));
    const plan = buildMealPlanWeek(planInput(OMNI, { ratings }));
    for (const day of plan.days) {
      expect(day.meals.some((m) => m.slot === 'breakfast')).toBe(false);
      expect(day.emptySlots.find((e) => e.slot === 'breakfast')?.reasons).toEqual(['rated_down']);
      // Ergänzungs-Snacks: ebenfalls nie ein abgelehntes Rezept.
      expect(day.meals.some((m) => breakfasts.some((r) => r.id === m.recipeId))).toBe(false);
    }
    // Der gespeicherte Plan mit diesem Grund ist gültig (Gerätespeicher).
    expect(parseStoredMealPlanWeek(JSON.parse(JSON.stringify(plan)))).not.toBeNull();
  });
});

describe('Gründe und Daumen hoch: nur Reihenfolge (K6)', () => {
  it('ratingScoreBonus: Daumen hoch, „Zu aufwendig“ (≤ 15 Min.), „Macht nicht satt“, „Zu teuer“', () => {
    const W = MEAL_PLAN_SCORING;
    const banana = variantOf('banane-pur');
    expect(ratingScoreBonus(recipeRatingIndex([]), banana, MONDAY)).toBe(0);
    const up = recipeRatingIndex([{ recipeId: 'banane-pur', value: 'up', ratedOn: SUNDAY_BEFORE }]);
    expect(ratingScoreBonus(up, banana, MONDAY)).toBe(W.ratingUp);
    const effort = recipeRatingIndex([
      { recipeId: 'hack-spaghetti', value: 'down', reason: 'effort', ratedOn: SUNDAY_BEFORE },
    ]);
    expect(activeRatingReasons(effort, MONDAY)).toEqual(new Set(['effort']));
    const quick =
      (banana.recipe.total_minutes ?? banana.recipe.prep_minutes + banana.recipe.cook_minutes) <=
      15;
    expect(ratingScoreBonus(effort, banana, MONDAY)).toBe(quick ? W.ratingQuick : 0);
    // Gründe wirken nur innerhalb der 8 Wochen.
    expect(activeRatingReasons(effort, addDays(SUNDAY_BEFORE, 56)).size).toBe(0);
    expect(ratingScoreBonus(effort, banana, addDays(SUNDAY_BEFORE, 56))).toBe(0);
    const satiety = recipeRatingIndex([
      { recipeId: 'hack-spaghetti', value: 'down', reason: 'satiety', ratedOn: SUNDAY_BEFORE },
    ]);
    const s = recipeSatietyIndex(banana);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
    expect(ratingScoreBonus(satiety, banana, MONDAY)).toBeCloseTo(W.ratingSatiety * s, 9);
    // „Zu teuer“: nur mit freigegebener Schätzung; billiger = mehr Bonus, ≥ Bezugswert = 0.
    const cost = recipeRatingIndex([
      { recipeId: 'hack-spaghetti', value: 'down', reason: 'cost', ratedOn: SUNDAY_BEFORE },
    ]);
    const withCost = (eur: number, reviewed: boolean): FilteredRecipe => ({
      ...banana,
      recipe: {
        ...banana.recipe,
        cost_estimate: {
          eur_per_serving: eur,
          as_of: '2026-10-01',
          ...(reviewed ? { reviewed_by: 'Prüferin', reviewed_on: '2026-10-02' } : {}),
        } as Recipe['cost_estimate'],
      },
    });
    expect(ratingScoreBonus(cost, banana, MONDAY)).toBe(0);
    expect(ratingScoreBonus(cost, withCost(1, false), MONDAY)).toBe(0);
    expect(ratingScoreBonus(cost, withCost(1, true), MONDAY)).toBeCloseTo(W.ratingCheaper * 0.8, 9);
    expect(ratingScoreBonus(cost, withCost(0, true), MONDAY)).toBeCloseTo(W.ratingCheaper, 9);
    expect(ratingScoreBonus(cost, withCost(9, true), MONDAY)).toBe(0);
  });

  it('Sättigungs-Kennzahl: ohne Energie 0, sonst 0–1', () => {
    const banana = variantOf('banane-pur');
    const zero: FilteredRecipe = {
      ...banana,
      facts: { ...banana.facts, perServing: { ...banana.facts.perServing, kcal: 0 } },
    };
    expect(recipeSatietyIndex(zero)).toBe(0);
    for (const r of N3_RECIPES) {
      const v = filterRecipe(r, N3_FOODS, {
        profile: mealPlanProfileSchema.parse(OMNI),
        excludePregnancyCaution: false,
        allowDrafts: true,
      });
      if (!v.ok) continue;
      const s = recipeSatietyIndex(v.value);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it('Daumen hoch: je Rezept nie seltener als ohne Bewertung, über alle Rezepte zusammen häufiger (H1)', () => {
    const profiles: MealPlanProfileInput[] = [OMNI, { diet: 'vegetarian' }, { diet: 'vegan' }];
    let gained = 0;
    for (const profile of profiles) {
      const base = buildMealPlanWeek(planInput(profile));
      for (const r of N3_RECIPES) {
        const up = buildMealPlanWeek(
          planInput(profile, {
            ratings: [{ recipeId: r.id, value: 'up', ratedOn: SUNDAY_BEFORE }],
          }),
        );
        // Wiederholungsgrenzen und Planband gelten weiter – „häufiger“ heißt nie „öfter als erlaubt“, aber nie seltener.
        expect(countOf(up, r.id), `${String(profile.diet)} ${r.id}`).toBeGreaterThanOrEqual(
          countOf(base, r.id),
        );
        gained += countOf(up, r.id) - countOf(base, r.id);
      }
    }
    expect(gained).toBeGreaterThan(0);
  }, 60_000);

  it('S2: Summe aller Bewertungs-Boni bleibt strikt unter dem Wiederholungs-Abzug', () => {
    const W = MEAL_PLAN_SCORING;
    expect(W.ratingMaxTotal).toBeLessThan(W.repeat);
    expect(W.ratingMaxTotal).toBeGreaterThan(0);
    const banana = variantOf('banane-pur');
    const all: FilteredRecipe = {
      ...banana,
      recipe: {
        ...banana.recipe,
        prep_minutes: 5,
        cook_minutes: 0,
        total_minutes: 5,
        cost_estimate: {
          eur_per_serving: 0,
          as_of: '2026-10-01',
          basis: 'estimate',
          reviewed_by: 'Prüferin',
        },
      },
    };
    const index = recipeRatingIndex([
      { recipeId: 'banane-pur', value: 'up', ratedOn: SUNDAY_BEFORE },
      { recipeId: 'a-a', value: 'down', reason: 'effort', ratedOn: SUNDAY_BEFORE },
      { recipeId: 'b-b', value: 'down', reason: 'cost', ratedOn: SUNDAY_BEFORE },
      { recipeId: 'c-c', value: 'down', reason: 'satiety', ratedOn: SUNDAY_BEFORE },
    ]);
    const bonus = ratingScoreBonus(index, all, MONDAY);
    expect(bonus).toBe(W.ratingMaxTotal);
    expect(bonus).toBeLessThan(W.repeat);
    // Eigenschaft über alle Fixture-Rezepte und Kombinationen: nie ≥ repeat.
    for (const r of N3_RECIPES) {
      const v = filterRecipe(r, N3_FOODS, {
        profile: mealPlanProfileSchema.parse(OMNI),
        excludePregnancyCaution: false,
        allowDrafts: true,
      });
      if (!v.ok) continue;
      const i = recipeRatingIndex([
        { recipeId: r.id, value: 'up', ratedOn: SUNDAY_BEFORE },
        { recipeId: 'a-a', value: 'down', reason: 'effort', ratedOn: SUNDAY_BEFORE },
        { recipeId: 'c-c', value: 'down', reason: 'satiety', ratedOn: SUNDAY_BEFORE },
      ]);
      expect(ratingScoreBonus(i, v.value, MONDAY)).toBeLessThan(W.repeat);
    }
  });

  it('S3: vorberechnete Sperren und Gründe – 2.000 Bewertungen liefern denselben Plan wie die wirksamen allein', () => {
    const relevant: RecipeRatingInput[] = [
      { recipeId: 'banane-pur', value: 'down', reason: 'effort', ratedOn: SUNDAY_BEFORE },
      { recipeId: 'overnight-oats', value: 'up', ratedOn: SUNDAY_BEFORE },
    ];
    // Viele weitere Bewertungen für Rezepte, die es nicht gibt, bzw. abgelaufene (ohne Wirkung).
    const filler: RecipeRatingInput[] = Array.from({ length: 1998 }, (_, i) => ({
      recipeId: `alt-${i}`,
      value: i % 2 === 0 ? 'up' : 'down',
      reason: i % 2 === 0 ? null : 'taste',
      ratedOn: i % 2 === 0 ? SUNDAY_BEFORE : addDays(MONDAY, -100),
    }));
    const few = buildMealPlanWeek(planInput(OMNI, { ratings: relevant }));
    const many = buildMealPlanWeek(planInput(OMNI, { ratings: [...filler, ...relevant] }));
    expect(many).toEqual(few);
    // Gründe je Tag gemerkt: zweiter Aufruf liefert dasselbe Objekt.
    const index = recipeRatingIndex([...filler, ...relevant]);
    expect(activeRatingReasons(index, MONDAY)).toBe(activeRatingReasons(index, MONDAY));
  });

  it('Eigenschaftstest K6: Bewertungen ändern nie Planband, Grenzen oder Ausschlüsse', () => {
    const rnd = seededRandom(10_010);
    const groups = ['peanuts', 'gluten', 'dairy', 'eggs', 'fish', 'mushrooms', 'soy'] as const;
    const foodIds = [
      ...new Set(N3_RECIPES.flatMap((r) => r.ingredients.map((i) => i.food_id))),
    ].sort();
    let checkedDays = 0;
    for (let i = 0; i < 60; i += 1) {
      const diet = (['omnivore', 'vegetarian', 'vegan'] as const)[i % 3] as 'omnivore';
      const profile = mealPlanProfileSchema.parse({
        diet,
        eatsPork: diet === 'omnivore' ? rnd() < 0.5 : null,
        intolerances: groups.filter(() => rnd() < 0.15),
        dislikedFoods: foodIds.filter(() => rnd() < 0.08),
        cookingMode: i % 4 === 0 ? 'meal_prep' : 'daily',
        mealprepDays: i % 4 === 0 ? 1 + (i % 3) : null,
      });
      const mealsPerDay = 1 + (i % 8);
      const pregnant = i % 5 === 0;
      // Schwangerschaft = `no_targets` (Faktor 1); ohne Einwilligung = ohne Körperdaten.
      const noConsent = i % 7 === 0;
      const overrides: Partial<NutritionInputsInput> = {
        mealsPerDay,
        sex: 'female',
        healthFlags: pregnant ? { flags: ['pregnancy', 'conservative_plan'] } : { flags: [] },
        ...(noConsent && !pregnant
          ? { healthDataConsent: false, bodyMetricsRows: [], healthFlags: null }
          : {}),
      };
      const ratings: RecipeRatingInput[] = N3_RECIPES.flatMap((r): RecipeRatingInput[] => {
        const x = rnd();
        if (x < 0.25) {
          return [
            {
              recipeId: r.id,
              value: 'down' as const,
              reason: RECIPE_RATING_REASONS[Math.floor(rnd() * 4)] ?? null,
              ratedOn: addDays(MONDAY, -Math.floor(rnd() * 70)),
            },
          ];
        }
        return x < 0.45
          ? [{ recipeId: r.id, value: 'up' as const, ratedOn: addDays(MONDAY, -3) }]
          : [];
      });
      const input = planInput(profile, { ratings }, overrides);
      const plan = buildMealPlanWeek(input);
      const index = recipeRatingIndex(ratings);
      for (const day of plan.days) {
        const targets = input.targets.days.find((d) => d.date === day.date);
        if (targets === undefined) throw new Error(day.date);
        // Planband unverändert aus den Zielen (nie durch eine Bewertung).
        expect(day.band).toEqual(targets.band);
        if (day.status === 'complete' && targets.band !== null) {
          const [min, max] = independentBand(targets);
          const kcal = day.meals.reduce((sum, m) => sum + m.nutrients.kcal, 0);
          expect(kcal).toBeGreaterThanOrEqual(min - 1 - EPS);
          expect(kcal).toBeLessThanOrEqual(max + 1 + EPS);
        }
        if (day.status === 'no_targets') {
          expect(day.meals.every((m) => m.factor === 1)).toBe(true);
        }
        for (const meal of day.meals) {
          checkedDays += 1;
          expect(meal.factor).toBeGreaterThanOrEqual(PORTION_SCALE_LIMITS.min - EPS);
          expect(meal.factor).toBeLessThanOrEqual(PORTION_SCALE_LIMITS.max + EPS);
          // Abgelehnte Rezepte nie an einem gesperrten Tag.
          expect(recipeBlockedByRating(index, meal.recipeId, day.date)).toBe(false);
          const recipe = N3_RECIPES.find((r) => r.id === meal.recipeId) as Recipe;
          const pregnancy = targets.recipeExclusions.includes('pregnancy_caution');
          expect(usedFoodViolations(recipe, meal.ingredients, profile, pregnancy)).toEqual([]);
          // „mag ich nicht“ je Lebensmittel: nie verwendet.
          expect(
            meal.ingredients.filter((ing) => profile.dislikedFoods.includes(ing.foodId)),
          ).toEqual([]);
        }
      }
    }
    expect(checkedDays).toBeGreaterThan(500);
  }, 60_000);
});

describe('food_dislikes: „mag ich nicht“ je Lebensmittel, hart (filter.ts)', () => {
  const ctx = (profile: MealPlanProfileInput) => ({
    profile: mealPlanProfileSchema.parse(profile),
    excludePregnancyCaution: false,
    allowDrafts: true,
  });

  it('schließt jedes Rezept mit dem Lebensmittel aus (Grund „mag ich nicht“), ohne Ersatzprodukt', () => {
    for (const recipe of N3_RECIPES) {
      for (const ingredient of recipe.ingredients) {
        const result = filterRecipe(
          recipe,
          N3_FOODS,
          ctx({ ...OMNI, dislikedFoods: [ingredient.food_id] }),
        );
        if (ingredient.optional) {
          // Optionale Zutat: weggelassen statt ausgeschlossen (S3).
          if (result.ok) {
            expect(result.value.omitted).toContain(recipe.ingredients.indexOf(ingredient));
          }
          continue;
        }
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reasons).toContain('dislike');
      }
    }
  });

  it('Milch abgelehnt: kein Ersatz über `substitutes` (der gilt nur für Gruppen)', () => {
    const recipe = N3_RECIPES.find((r) =>
      r.ingredients.some((i) => i.food_id === 'vollmilch' && !i.optional),
    );
    if (recipe === undefined) throw new Error('Fixture ohne Vollmilch');
    expect(filterRecipe(recipe, N3_FOODS, ctx({ ...OMNI, dislikedFoods: ['vollmilch'] })).ok).toBe(
      false,
    );
    // Laktose-Unverträglichkeit + laktosefreie Milch abgelehnt → nur Haferdrink oder gar nicht.
    const r = filterRecipe(
      recipe,
      N3_FOODS,
      ctx({ ...OMNI, intolerances: ['lactose'], dislikedFoods: ['milch-laktosefrei'] }),
    );
    if (r.ok) {
      expect(r.value.substitutions.map((s) => s.substituteFoodId)).not.toContain(
        'milch-laktosefrei',
      );
    }
  });

  it('foodAllowedForPerson und Rezeptsuche halten die Abneigung ein', () => {
    const c = ctx({ ...OMNI, dislikedFoods: ['banane'] });
    expect(foodAllowedForPerson(N3_FOODS.get('banane'), c)).toBe(false);
    expect(foodAllowedForPerson(N3_FOODS.get('reis'), c)).toBe(true);
    const hits = searchRecipes({
      recipes: N3_RECIPES,
      foods: N3_FOODS,
      profile: { ...OMNI, dislikedFoods: ['banane'] },
      excludePregnancyCaution: false,
      allowDrafts: true,
    });
    for (const hit of hits) {
      const omitted = new Set(hit.variant.omitted);
      expect(
        hit.variant.recipe.ingredients.some(
          (ing, i) => ing.food_id === 'banane' && !omitted.has(i),
        ),
      ).toBe(false);
    }
  });

  it('Essensplan: kein Rezept mit abgelehntem Lebensmittel; ältere Profile ohne Feld bleiben gültig', () => {
    const base = buildMealPlanWeek(planInput());
    const someFood = base.days[0]?.meals[0]?.ingredients[0]?.foodId as string;
    const plan = buildMealPlanWeek(planInput({ ...OMNI, dislikedFoods: [someFood] }));
    for (const day of plan.days) {
      for (const meal of day.meals) {
        expect(meal.ingredients.some((i) => i.foodId === someFood)).toBe(false);
      }
    }
    expect(mealPlanProfileSchema.parse(OMNI).dislikedFoods).toEqual([]);
    expect(
      mealPlanProfileSchema.safeParse({ ...OMNI, dislikedFoods: ['a-a', 'a-a'] }).success,
    ).toBe(false);
  });

  it('Abneigung neu → automatische Neuplanung ab heute (wie Gruppen-Abneigungen)', () => {
    const plan = buildMealPlanWeek(planInput());
    const used = plan.days[3]?.meals[0]?.ingredients[0]?.foodId as string;
    const check = needsAutomaticReplan(plan, planInput({ ...OMNI, dislikedFoods: [used] }));
    expect(check.needed).toBe(true);
    expect(check.reasons).toContain('recipe_excluded');
  });

  it('Dialog-Auswahl: jede Zutat einmal, ohne schon abgelehnte, nichts vorausgewählt; leere Auswahl speichert nichts', () => {
    const ingredients = [
      { foodId: 'banane' },
      { foodId: 'erdnuesse' },
      { foodId: 'banane' },
      { foodId: 'unbekannt' },
    ];
    expect(foodDislikeChoices(ingredients, N3_FOODS, [])).toEqual([
      { foodId: 'banane', nameDe: N3_FOODS.get('banane')?.name_de },
      { foodId: 'erdnuesse', nameDe: N3_FOODS.get('erdnuesse')?.name_de },
    ]);
    expect(foodDislikeChoices(ingredients, N3_FOODS, ['banane']).map((c) => c.foodId)).toEqual([
      'erdnuesse',
    ]);
    expect(foodDislikeChoices([], N3_FOODS, [])).toEqual([]);
    expect(addFoodDislikes(['banane'], [])).toEqual({ ok: false, reason: 'nothing_selected' });
    expect(addFoodDislikes(['banane'], ['erdnuesse', 'banane'])).toEqual({
      ok: true,
      dislikes: ['banane', 'erdnuesse'],
    });
    expect(addFoodDislikes([], ['Kein Slug'])).toEqual({ ok: false, reason: 'invalid' });
    const full = Array.from({ length: RECIPE_RATING_RULES.maxFoodDislikes }, (_, i) => `f-${i}`);
    expect(addFoodDislikes(full, ['noch-eins'])).toEqual({ ok: false, reason: 'limit' });
    expect(removeFoodDislike(['banane', 'erdnuesse'], 'banane')).toEqual(['erdnuesse']);
    expect(foodDislikesSchema.safeParse(['a-a', 'a-a']).success).toBe(false);
  });
});

describe('Meal-Prep-Wochenplan mit Daumen runter (19.6 Nr. 8, K7)', () => {
  const vegan: MealPlanProfileInput = { diet: 'vegan' };
  const input = (ratings: RecipeRatingInput[] = []): MealPlanInput => ({
    ...planInput(vegan, { ratings }, { sex: 'female' }),
  });

  it('ein Rezept des Plans abgelehnt → ganzer Plan nicht angeboten, nach 8 Wochen wieder', () => {
    const offered = N3_MEAL_PREP_PLANS.filter((p) => applyMealPrepPlan(p, input()).offered);
    expect(offered.length).toBeGreaterThan(0);
    for (const p of offered) {
      for (const recipeId of p.recipe_ids) {
        expect(
          applyMealPrepPlan(p, input([{ recipeId, value: 'down', ratedOn: SUNDAY_BEFORE }]))
            .offered,
        ).toBe(false);
        // Bewertet vor genau 8 Wochen + 1 Tag (letzter Sperrtag = Samstag davor) → wieder angeboten.
        expect(
          applyMealPrepPlan(
            p,
            input([{ recipeId, value: 'down', ratedOn: addDays(SUNDAY_BEFORE, -56) }]),
          ).offered,
        ).toBe(true);
        // Daumen hoch ändert nichts am Angebot.
        expect(
          applyMealPrepPlan(p, input([{ recipeId, value: 'up', ratedOn: SUNDAY_BEFORE }])).offered,
        ).toBe(true);
      }
    }
  });
});

describe('S1: gespeicherter Plan einer noch nicht begonnenen Woche mit abgelehntem Rezept', () => {
  it('nur vor Wochenbeginn, nur an gesperrten Tagen; laufende Woche nie', () => {
    const plan = buildMealPlanWeek(planInput());
    const id = mostUsed(plan);
    const down: RecipeRatingInput[] = [{ recipeId: id, value: 'down', ratedOn: SUNDAY_BEFORE }];
    expect(mealPlanHasRatedDownRecipes(plan, down, SUNDAY_BEFORE)).toBe(true);
    // Woche hat begonnen → laufende Woche bleibt (K7).
    expect(mealPlanHasRatedDownRecipes(plan, down, MONDAY)).toBe(false);
    // Ohne Bewertung, mit Daumen hoch, abgelaufen oder anderes Rezept → nein.
    expect(mealPlanHasRatedDownRecipes(plan, [], SUNDAY_BEFORE)).toBe(false);
    expect(mealPlanHasRatedDownRecipes(plan, undefined, SUNDAY_BEFORE)).toBe(false);
    expect(
      mealPlanHasRatedDownRecipes(
        plan,
        [{ recipeId: id, value: 'up', ratedOn: SUNDAY_BEFORE }],
        SUNDAY_BEFORE,
      ),
    ).toBe(false);
    expect(
      mealPlanHasRatedDownRecipes(
        plan,
        [{ recipeId: id, value: 'down', ratedOn: addDays(MONDAY, -60) }],
        SUNDAY_BEFORE,
      ),
    ).toBe(false);
    expect(
      mealPlanHasRatedDownRecipes(
        plan,
        [{ recipeId: 'gibt-es-nicht', value: 'down', ratedOn: SUNDAY_BEFORE }],
        SUNDAY_BEFORE,
      ),
    ).toBe(false);
    // Sperre endet vor dem ersten Vorkommen → nein.
    const firstDay = plan.days.find((d) => d.meals.some((m) => m.recipeId === id))?.date as string;
    const lastBefore = addDays(firstDay, -1);
    const endsBefore = addDays(lastBefore, -55);
    if (
      plan.days.filter((d) => d.meals.some((m) => m.recipeId === id)).length > 0 &&
      endsBefore <= SUNDAY_BEFORE
    ) {
      const onlyLater = plan.days.filter(
        (d) => d.date > lastBefore && d.meals.some((m) => m.recipeId === id),
      );
      expect(onlyLater.length).toBeGreaterThan(0);
      expect(
        mealPlanHasRatedDownRecipes(
          plan,
          [{ recipeId: id, value: 'down', ratedOn: endsBefore }],
          SUNDAY_BEFORE,
        ),
      ).toBe(false);
    }
  });

  it('„Plan aktualisieren“ (refreshedMealPlan) entfernt das Rezept, danach kein Hinweis mehr', () => {
    const input = planInput();
    const plan = buildMealPlanWeek(input);
    const id = mostUsed(plan);
    const ratings: RecipeRatingInput[] = [{ recipeId: id, value: 'down', ratedOn: SUNDAY_BEFORE }];
    const refreshed = refreshedMealPlan(plan, { ...input, ratings });
    expect(countOf(refreshed, id)).toBe(0);
    expect(mealPlanHasRatedDownRecipes(refreshed, ratings, SUNDAY_BEFORE)).toBe(false);
  });
});

describe('H4: Obergrenze der Bewertungen', () => {
  it('neue Bewertung bei voller Liste nicht möglich, Ändern einer vorhandenen schon; nichts wird aufgeräumt', () => {
    const full = Array.from({ length: RECIPE_RATING_RULES.maxRatings }, (_, i) => ({
      recipeId: `r-${i}`,
    }));
    expect(recipeRatingLimitReached(full, 'neu-neu')).toBe(true);
    expect(recipeRatingLimitReached(full, 'r-5')).toBe(false);
    expect(recipeRatingLimitReached(full.slice(1), 'neu-neu')).toBe(false);
  });
});

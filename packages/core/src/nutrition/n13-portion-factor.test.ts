/**
 * Etappe N13 – Portionsfaktor beim gemeinsamen Kochen (docs/PLAN-PHASE-5.md 19.7 N13, KONZEPT 6.12, Wächter-Befund
 * S1): Faktor je Person aus IHREN Zielen (0,6–1,8), Beilagen getrennt (Rolle `carb`) bei gleicher Eiweißquelle,
 * Rundung 10 g bei Beilagen und ganze Eier, `no_targets`/ohne Einwilligung Faktor 1, Tagesausgleich nur über die
 * übrigen Plätze – über der Obergrenze keine geteilte Portion (eigener Vorschlag), unter der Untergrenze Ausgleich
 * oder `below_floor`. Eigenschaftstest „Portionsfaktor hebt nie über die Obergrenze und drückt nie unter die
 * Untergrenze ohne `below_floor`“ mit eigener Erwartungsregel (`usedFoodViolations`).
 */
import { describe, expect, it } from 'vitest';

import { COUPLE_PORTION_LIMITS, PORTION_SCALE_LIMITS } from '../constants';
import { ing, makeRecipe } from '../content/nutrition-fixtures';
import type { Recipe } from '../content/recipe-schema';
import { withDemoRoles } from '../demo-nutrition';
import { addDays } from '../dates';
import { filterRecipe, type FilteredRecipe } from './filter';
import {
  buildMealPlanWeek,
  dayWithinPlanBand,
  mealTargetKcal,
  swapMealRecipe,
  type MealPlanInput,
  type MealPlanWeek,
  type PlannedMeal,
} from './meal-plan';
import { N3_FOODS, N3_RECIPES, usedFoodViolations } from './meal-plan-fixtures';
import { toMealPlanPayload } from './meal-plan-payload';
import { mealPlanMatchesRecipes, parseStoredMealPlanWeek } from './meal-plan-store';
import {
  couplePortionFactor,
  planSharedMeals,
  type SharedMealsPerson,
  sharedCookingAmounts,
  sharedMealPortions,
  type SharedPortionPerson,
} from './portion-factor';
import { scalePortion } from './scale';
import { applyIngredientSwap } from './substitute';
import { DEMO_SUBSTITUTIONS } from '../demo-nutrition';
import {
  mealPlanProfileSchema,
  type MealPlanProfileInput,
  type NutritionInputsInput,
} from './schemas';
import { nutritionTargetsForWeek } from './targets';
import {
  type IndependentLimits,
  independentLimits,
  inputs,
  MONDAY,
  seededRandom,
} from './test-helpers';
import type { MealSlotId } from './timing';

const SUNDAY_BEFORE = addDays(MONDAY, -1);
const RECIPES = N3_RECIPES.map(withDemoRoles);
const omni: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };
const F = COUPLE_PORTION_LIMITS.factor;
const week = Array.from({ length: 7 }, (_, i) => addDays(MONDAY, i));

const metrics = (heightCm: number, weightKg: number) => [
  { measuredOn: '2026-10-01', heightCm, weightKg },
];
/** Kleine Person mit Fettverlust (Tagesziel ca. 1.460 kcal, 5 Mahlzeiten). */
const SMALL: Partial<NutritionInputsInput> = {
  sex: 'female',
  birthDate: '1995-01-01',
  bodyMetricsRows: metrics(155, 46),
  goalType: 'fat_loss',
  activityLevel: 'sedentary',
  mealsPerDay: 5,
};
/** Große, sehr aktive Person mit Muskelaufbau (Tagesziel ca. 5.200 kcal, 3 Mahlzeiten). */
const BIG: Partial<NutritionInputsInput> = {
  sex: 'male',
  birthDate: '1995-01-01',
  bodyMetricsRows: metrics(195, 110),
  goalType: 'muscle_gain',
  activityLevel: 'very_active',
  mealsPerDay: 3,
};
/** 17 Jahre: Überschussdeckel 5 % (4.9), schmales Planband. */
const MINOR: Partial<NutritionInputsInput> = {
  sex: 'male',
  birthDate: '2009-06-01',
  bodyMetricsRows: metrics(165, 52),
  goalType: 'muscle_gain',
  activityLevel: 'sedentary',
  mealsPerDay: 3,
};

function planInput(
  overrides: Partial<NutritionInputsInput>,
  options: {
    readonly profile?: MealPlanProfileInput;
    readonly recipes?: readonly Recipe[];
    readonly today?: string;
    readonly ratings?: MealPlanInput['ratings'];
  } = {},
): MealPlanInput {
  const today = options.today ?? SUNDAY_BEFORE;
  return {
    targets: nutritionTargetsForWeek(inputs({ today, ...overrides }), MONDAY),
    profile: options.profile ?? omni,
    recipes: options.recipes ?? RECIPES,
    foods: N3_FOODS,
    allowDrafts: true,
    today,
    ...(options.ratings !== undefined ? { ratings: options.ratings } : {}),
  };
}

function person(
  key: string,
  overrides: Partial<NutritionInputsInput>,
  options: Parameters<typeof planInput>[1] = {},
): SharedMealsPerson {
  return {
    key,
    input: planInput(overrides, options),
    healthDataConsent: overrides.healthDataConsent ?? true,
  };
}

function variant(recipeId: string, profile: MealPlanProfileInput = omni, recipes = RECIPES) {
  const recipe = recipes.find((r) => r.id === recipeId) as Recipe;
  const r = filterRecipe(recipe, N3_FOODS, {
    profile: mealPlanProfileSchema.parse(profile),
    excludePregnancyCaution: false,
    allowDrafts: true,
  });
  if (!r.ok) throw new Error(`Rezept ${recipeId} passt nicht: ${r.reasons.join(',')}`);
  return r.value;
}

const PAYLOAD_INPUTS = {
  diet: 'omnivore',
  meals_per_day: 4,
  cooking_mode: 'daily',
  mealprep_days: null,
  mealprep_slots: 'lunch',
} as const;

function sharedPerson(
  key: string,
  v: FilteredRecipe,
  target: number | null,
  consent = true,
): SharedPortionPerson {
  return { key, variant: v, mealTargetKcal: target, healthDataConsent: consent };
}

function mealAt(plan: MealPlanWeek, date: string, slot: string): PlannedMeal | undefined {
  return plan.days.find((d) => d.date === date)?.meals.find((m) => m.slot === slot && !m.isFill);
}

const grams = (p: { ingredients: readonly { foodId: string; grams: number }[] }, foodId: string) =>
  p.ingredients.filter((i) => i.foodId === foodId).reduce((sum, i) => sum + i.grams, 0);

// ---------------------------------------------------------------------------------------------------------
// Faktor je Person
// ---------------------------------------------------------------------------------------------------------

describe('couplePortionFactor (19.7 N13): Ziel ÷ kcal je Portion, 0,6–1,8', () => {
  it('rechnet Ziel ÷ kcal, auf 0,01 gerundet', () => {
    expect(
      couplePortionFactor({ mealTargetKcal: 700, kcalPerServing: 560, healthDataConsent: true }),
    ).toEqual({
      factor: 1.25,
      basis: 'target',
      clamped: null,
    });
    expect(
      couplePortionFactor({ mealTargetKcal: 1000, kcalPerServing: 3000, healthDataConsent: true })
        .factor,
    ).toBe(F.min);
  });

  it('sehr unterschiedliche Kalorienziele (1.400 vs. 3.800 kcal): 0,6 bzw. 1,8 (begrenzt)', () => {
    // 1.400 × 25 % = 350 kcal vs. 3.800 × 35 % = 1.330 kcal bei 700 kcal je Portion.
    expect(
      couplePortionFactor({ mealTargetKcal: 350, kcalPerServing: 700, healthDataConsent: true }),
    ).toEqual({
      factor: 0.6,
      basis: 'target',
      clamped: 'min',
    });
    expect(
      couplePortionFactor({ mealTargetKcal: 1330, kcalPerServing: 700, healthDataConsent: true }),
    ).toEqual({
      factor: 1.8,
      basis: 'target',
      clamped: 'max',
    });
  });

  it('no_targets → Faktor 1; ohne Einwilligung → Faktor 1 (auch wenn ein Ziel übergeben wird); 0 kcal → 1', () => {
    expect(
      couplePortionFactor({ mealTargetKcal: null, kcalPerServing: 600, healthDataConsent: true }),
    ).toEqual({
      factor: 1,
      basis: 'no_targets',
      clamped: null,
    });
    expect(
      couplePortionFactor({ mealTargetKcal: 1200, kcalPerServing: 600, healthDataConsent: false }),
    ).toEqual({
      factor: 1,
      basis: 'no_consent',
      clamped: null,
    });
    expect(
      couplePortionFactor({ mealTargetKcal: 500, kcalPerServing: 0, healthDataConsent: true })
        .basis,
    ).toBe('no_kcal');
  });

  it('Zod an der Grenze: negative, unendliche oder fehlende Werte werfen', () => {
    expect(() =>
      couplePortionFactor({ mealTargetKcal: -1, kcalPerServing: 500, healthDataConsent: true }),
    ).toThrow();
    expect(() =>
      couplePortionFactor({
        mealTargetKcal: 500,
        kcalPerServing: Number.POSITIVE_INFINITY,
        healthDataConsent: true,
      }),
    ).toThrow();
    expect(() =>
      couplePortionFactor({ mealTargetKcal: 500, kcalPerServing: 500 } as never),
    ).toThrow();
  });

  it('Spannweite liegt innerhalb von PORTION_SCALE_LIMITS (0,5–2,0)', () => {
    expect(F.min).toBeGreaterThanOrEqual(PORTION_SCALE_LIMITS.min);
    expect(F.max).toBeLessThanOrEqual(PORTION_SCALE_LIMITS.max);
  });
});

describe('mealTargetKcal: Anteil des Platzes × Bandmitte DIESER Person (schon durch clampCalorieTarget)', () => {
  it('rechnet aus den Tageszielen; null bei no_targets und fehlendem Platz', () => {
    const day = nutritionTargetsForWeek(inputs({ today: SUNDAY_BEFORE, ...BIG }), MONDAY)
      .days[0] as Parameters<typeof mealTargetKcal>[0];
    const band = day.band as { min: number; max: number };
    const share = day.slots.find((s) => s.slot === 'dinner')?.share as number;
    expect(mealTargetKcal(day, 'dinner')).toBeCloseTo((share * (band.min + band.max)) / 2, 9);
    expect(mealTargetKcal(day, 'snack_afternoon')).toBeNull();
    const noTargets = nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, healthDataConsent: false }),
      MONDAY,
    ).days[0] as Parameters<typeof mealTargetKcal>[0];
    expect(mealTargetKcal(noTargets, 'dinner')).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------
// Portionen an einem Gericht
// ---------------------------------------------------------------------------------------------------------

describe('sharedMealPortions: gleichmäßig, Beilagen getrennt, Rundung', () => {
  const curry = variant('tofu-erdnuss-curry'); // 797 kcal, Beilage Reis 75 g (Rolle carb)

  it('uniform: jede Zutat × Faktor der Person, Beilage auf 10 g, Nährwerte nach der Rundung', () => {
    const [a, b] = sharedMealPortions(
      [sharedPerson('a', curry, 400), sharedPerson('b', curry, 1300)],
      N3_FOODS,
      'uniform',
    );
    expect(a?.factor).toBe(F.min); // 400 / 797 = 0,50 → 0,6
    expect(b?.factor).toBe(1.63);
    expect(grams(a!.portion, 'tofu')).toBe(90); // 150 × 0,6
    expect(grams(b!.portion, 'tofu')).toBe(245); // 150 × 1,63 = 244,5 → 5er-Schritt
    // Beilage Reis: 75 × 0,6 = 45 → 10-g-Schritt 50; 75 × 1,63 = 122,25 → 120.
    expect(grams(a!.portion, 'reis')).toBe(50);
    expect(grams(b!.portion, 'reis')).toBe(120);
    const kcal = a!.portion.ingredients.reduce(
      (sum, i) => sum + (i.grams * (N3_FOODS.get(i.foodId)?.nutrients_per_100g.kcal ?? 0)) / 100,
      0,
    );
    expect(a!.portion.nutrients.kcal).toBeCloseTo(kcal, 6);
  });

  it('sides: Eiweißquelle und übrige Zutaten gleich für alle, Beilage je Person auf ihr Ziel', () => {
    const portions = sharedMealPortions(
      [sharedPerson('a', curry, 600), sharedPerson('b', curry, 1100)],
      N3_FOODS,
      'sides',
    );
    const [a, b] = portions;
    expect(a?.scaling).toBe('sides');
    expect(a?.factors.main).toBe(b?.factors.main);
    for (const food of ['tofu', 'kokosmilch', 'erdnuesse', 'paprika']) {
      expect(grams(a!.portion, food)).toBe(grams(b!.portion, food));
    }
    expect(grams(a!.portion, 'reis')).toBeLessThan(grams(b!.portion, 'reis'));
    for (const p of portions) {
      expect(p.factors.side).toBeGreaterThanOrEqual(F.min);
      expect(p.factors.side).toBeLessThanOrEqual(F.max);
      expect(p.factors.main).toBeGreaterThanOrEqual(F.min);
      expect(p.factors.main).toBeLessThanOrEqual(F.max);
    }
    // Beilage gleicht in Richtung des Ziels aus (näher als die gemeinsame Portion ohne getrennte Beilage).
    const sameForAll = sharedMealPortions(
      [sharedPerson('a', curry, 850), sharedPerson('b', curry, 850)],
      N3_FOODS,
      'sides',
    );
    expect(Math.abs(a!.portion.nutrients.kcal - 600)).toBeLessThan(
      Math.abs((sameForAll[0] as typeof a)!.portion.nutrients.kcal - 600),
    );
  });

  it('Reihenfolge der Personen egal (deterministisch)', () => {
    const people = [
      sharedPerson('a', curry, 500),
      sharedPerson('b', curry, 1200),
      sharedPerson('c', curry, null),
    ];
    for (const mode of ['uniform', 'sides'] as const) {
      const forward = sharedMealPortions(people, N3_FOODS, mode);
      const backward = sharedMealPortions([...people].reverse(), N3_FOODS, mode);
      for (const p of forward) expect(backward.find((x) => x.key === p.key)).toEqual(p);
    }
  });

  it('Rezept ohne Beilage: sides wirkt wie uniform (scaling no_side)', () => {
    const omelett = variant('omelett-champignons');
    const [sides] = sharedMealPortions([sharedPerson('a', omelett, 500)], N3_FOODS, 'sides');
    const [uniform] = sharedMealPortions([sharedPerson('a', omelett, 500)], N3_FOODS, 'uniform');
    expect(sides?.scaling).toBe('no_side');
    expect(sides?.portion).toEqual(uniform?.portion);
  });

  it('Eier bleiben ganz – bei jedem Faktor', () => {
    const omelett = variant('omelett-champignons'); // 3 Eier je Portion
    for (let target = 150; target <= 900; target += 37) {
      const [p] = sharedMealPortions([sharedPerson('a', omelett, target)], N3_FOODS, 'uniform');
      const egg = p!.portion.ingredients.find((i) => i.foodId === 'huehnerei');
      expect(Number.isInteger(egg?.amount)).toBe(true);
      expect(egg?.amount).toBeGreaterThanOrEqual(1);
    }
  });

  it('5-Portionen-Rezept: Menge je Person = Rezeptmenge ÷ 5 × Faktor; Kochmenge = Summe der Portionen', () => {
    const recipe = makeRecipe({
      id: 'eintopf-fuenf',
      title_de: 'Hähnchen-Reis-Topf für fünf',
      meal_types: ['main'],
      training_tags: [],
      servings: 5,
      ingredients: [
        ing('haehnchenbrust', 750, 'g', { role: 'protein', heated: true }),
        ing('reis', 375, 'g', { role: 'carb' }),
        ing('paprika', 5, 'piece', { role: 'vegetable' }),
        ing('huehnerei', 5, 'piece', { heated: true }),
        ing('salz', 2, 'pinch', { scales: false, role: 'seasoning' }),
      ],
    });
    const v = variant('eintopf-fuenf', omni, [recipe]);
    const perServing = v.facts.perServing.kcal;
    const portions = sharedMealPortions(
      [sharedPerson('a', v, perServing * 0.8), sharedPerson('b', v, perServing * 1.5)],
      N3_FOODS,
      'uniform',
    );
    expect(portions.map((p) => p.factor)).toEqual([0.8, 1.5]);
    expect(grams(portions[0]!.portion, 'haehnchenbrust')).toBe(120); // 750 / 5 × 0,8
    expect(grams(portions[1]!.portion, 'haehnchenbrust')).toBe(225); // 750 / 5 × 1,5
    expect(grams(portions[0]!.portion, 'reis')).toBe(60); // 75 × 0,8 = 60 (10-g-Schritt)
    expect(grams(portions[1]!.portion, 'reis')).toBe(110); // 75 × 1,5 = 112,5 → 110
    // Salz skaliert nicht: je Person 2 Prisen ÷ 5 → gerundet 1 Prise (nie 0).
    expect(portions[0]!.portion.ingredients.find((i) => i.foodId === 'salz')?.amount).toBe(1);
    const total = sharedCookingAmounts(portions.map((p) => p.portion));
    expect(total.find((t) => t.foodId === 'haehnchenbrust')?.grams).toBe(345);
    expect(total.find((t) => t.foodId === 'reis')?.grams).toBe(170);
    const eggs = total.find((t) => t.foodId === 'huehnerei');
    expect(Number.isInteger(eggs?.amount)).toBe(true);
  });

  it('Beilagen-Rundung: ab 20 g auf 10 g, darunter normale Rundung, nie 0', () => {
    const tiny = makeRecipe({
      id: 'mini-reis',
      meal_types: ['snack'],
      servings: 1,
      ingredients: [ing('reis', 12, 'g', { role: 'carb' }), ing('paprika', 1, 'piece')],
    });
    const v = variant('mini-reis', omni, [tiny]);
    const [p] = sharedMealPortions(
      [sharedPerson('a', v, v.facts.perServing.kcal * 0.6)],
      N3_FOODS,
      'uniform',
    );
    expect(grams(p!.portion, 'reis')).toBe(7); // 12 × 0,6 = 7,2 → 1-g-Schritt (unter 20 g)
  });

  it('1 Person: sides = eigener Faktor; viele Personen (6) gehen, 7 nicht', () => {
    const [one] = sharedMealPortions([sharedPerson('a', curry, 900)], N3_FOODS, 'sides');
    expect(one?.factors.main).toBe(one?.factor);
    const six = sharedMealPortions(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((k, i) => sharedPerson(k, curry, 400 + i * 250)),
      N3_FOODS,
      'sides',
    );
    expect(six).toHaveLength(6);
    expect(new Set(six.map((p) => p.factors.main)).size).toBe(1);
    expect(() =>
      sharedMealPortions(
        ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k) => sharedPerson(k, curry, 800)),
        N3_FOODS,
        'uniform',
      ),
    ).toThrow(RangeError);
  });

  it('Person ohne Ziele/Einwilligung: genau die Standardportion; der gemeinsame Faktor kommt nur von den anderen', () => {
    const portions = sharedMealPortions(
      [
        sharedPerson('a', curry, 1200),
        sharedPerson('b', curry, 1200, false),
        sharedPerson('c', curry, null),
      ],
      N3_FOODS,
      'sides',
    );
    const [a, b, c] = portions;
    expect(b?.basis).toBe('no_consent');
    expect(c?.basis).toBe('no_targets');
    for (const p of [b, c]) {
      expect(p?.factor).toBe(1);
      expect(p?.portion.ingredients).toEqual(scalePortion(curry, 1, N3_FOODS).ingredients);
    }
    expect(a?.factors.main).toBe(a?.factor); // nur a hat Ziele
  });
});

// ---------------------------------------------------------------------------------------------------------
// Wochen mit geteilten Mahlzeiten
// ---------------------------------------------------------------------------------------------------------

/** Wie `haehnchen-reis`, aber mit schwerer OPTIONALER Zutat (80 g Erdnüsse, ca. 480 kcal) – Wächter N13 B1. */
const HEAVY_OPTIONAL: Recipe = (() => {
  const base = RECIPES.find((r) => r.id === 'haehnchen-reis') as Recipe;
  return {
    ...base,
    id: 'haehnchen-reis-nuss',
    ingredients: [...base.ingredients, ing('erdnuesse', 80, 'g', { optional: true })],
    declared_allergens: [...base.declared_allergens, 'peanuts'],
  };
})();

function expectSafeWeek(plan: MealPlanWeek, label: string) {
  for (const day of plan.days) {
    expect(dayWithinPlanBand(day, day.band), `${label} ${day.date}`).toBe(true);
    if (day.band !== null) expect(['complete', 'below_floor']).toContain(day.status);
    for (const meal of day.meals) {
      expect(meal.factor).toBeGreaterThanOrEqual(PORTION_SCALE_LIMITS.min);
      expect(meal.factor).toBeLessThanOrEqual(PORTION_SCALE_LIMITS.max);
    }
  }
}

describe('planSharedMeals (S1): Ausgleich nur über die übrigen Plätze, nie über die Obergrenze', () => {
  it('sehr unterschiedliche Kalorienziele: 0,6 / 1,8 und beide Tage im Planband (Ausgleich)', () => {
    const result = planSharedMeals({
      mode: 'uniform',
      persons: [person('a', SMALL), person('b', BIG)],
      meals: week.map((date) => ({
        date,
        slot: 'dinner' as const,
        recipeId: 'tofu-erdnuss-curry',
      })),
    });
    const [a, b] = result.persons;
    for (const p of result.persons) expectSafeWeek(p.plan, p.key);
    for (const meal of result.meals) {
      expect(meal.portions.map((x) => [x.key, x.factor])).toEqual([
        ['a', F.min],
        ['b', F.max],
      ]);
    }
    for (const date of week) {
      expect(mealAt(a!.plan, date, 'dinner')?.recipeId).toBe('tofu-erdnuss-curry');
      expect(mealAt(a!.plan, date, 'dinner')?.factor).toBe(F.min);
      expect(mealAt(b!.plan, date, 'dinner')?.factor).toBe(F.max);
      expect(mealAt(b!.plan, date, 'dinner')?.fixed).toBe(true);
    }
    expect(a!.outcomes.every((o) => o.shared && o.reason === null)).toBe(true);
    expect(b!.outcomes.every((o) => o.shared)).toBe(true);
    // Ausgleich: die große Person erreicht ihr Band über die übrigen Plätze bzw. Ergänzungs-Snacks.
    const bigDay = b!.plan.days[0]!;
    expect(bigDay.status).toBe('complete');
    expect(bigDay.meals.some((m) => !m.fixed && (m.factor > 1 || m.isFill))).toBe(true);
  }, 60_000);

  it('Person unter 18 mit Überschussdeckel: über der Obergrenze → keine geteilte Portion, eigener Vorschlag', () => {
    const xxl = makeRecipe({
      id: 'riesen-nudeln',
      title_de: 'Riesen-Nudelteller',
      meal_types: ['main'],
      training_tags: [],
      servings: 1,
      ingredients: [
        ing('spaghetti', 500, 'g', { role: 'carb' }),
        ing('olivenoel', 100, 'g', { role: 'fat' }),
        ing('erdnuesse', 200, 'g', { role: 'fat' }),
        ing('tomaten-passiert', 200, 'ml', { role: 'vegetable' }),
      ],
    });
    const recipes = [...RECIPES, xxl];
    const result = planSharedMeals({
      mode: 'sides',
      persons: [person('teen', MINOR, { recipes }), person('b', BIG, { recipes })],
      meals: week.map((date) => ({ date, slot: 'dinner' as const, recipeId: 'riesen-nudeln' })),
    });
    const teen = result.persons.find((p) => p.key === 'teen')!;
    const partner = result.persons.find((p) => p.key === 'b')!;
    expect(teen.plan.days[0]?.band).not.toBeNull();
    // Schon 0,6 Portionen (ca. 2.300 kcal) liegen über der Obergrenze der Person unter 18 (ca. 2.240 kcal).
    const ceiling = (teen.plan.days[0]?.band as { max: number }).max;
    const v = filterRecipe(xxl, N3_FOODS, {
      profile: mealPlanProfileSchema.parse(omni),
      excludePregnancyCaution: false,
      allowDrafts: true,
    });
    expect(v.ok && v.value.facts.perServing.kcal * F.min > ceiling).toBe(true);
    for (const p of result.persons) expectSafeWeek(p.plan, p.key);
    expect(teen.outcomes.every((o) => !o.shared && o.reason === 'above_ceiling')).toBe(true);
    for (const date of week) {
      const dinner = mealAt(teen.plan, date, 'dinner');
      // Eigener Vorschlag nach 6.3 (nicht die geteilte, feste Portion).
      expect(dinner?.fixed ?? false).toBe(false);
    }
    expect(partner.outcomes.every((o) => o.shared)).toBe(true);
    // Die Portionen werden ohne die Person unter 18 berechnet (nur noch die Partnerin/der Partner).
    for (const meal of result.meals) expect(meal.portions.map((p) => p.key)).toEqual(['b']);
  }, 60_000);

  it('Person unter 18, knapp passend: erst die übrigen Plätze senken – reicht das nicht, eigener Vorschlag', () => {
    const big = makeRecipe({
      id: 'grosse-nudeln',
      title_de: 'Großer Nudelteller',
      meal_types: ['main'],
      training_tags: [],
      servings: 1,
      ingredients: [
        ing('spaghetti', 400, 'g', { role: 'carb' }),
        ing('olivenoel', 60, 'g', { role: 'fat' }),
        ing('erdnuesse', 150, 'g', { role: 'fat' }),
        ing('tomaten-passiert', 200, 'ml', { role: 'vegetable' }),
      ],
    });
    const recipes = [...RECIPES, big];
    const result = planSharedMeals({
      mode: 'sides',
      persons: [person('teen', MINOR, { recipes }), person('b', BIG, { recipes })],
      meals: week.map((date) => ({ date, slot: 'dinner' as const, recipeId: 'grosse-nudeln' })),
    });
    const teen = result.persons.find((p) => p.key === 'teen')!;
    for (const p of result.persons) expectSafeWeek(p.plan, p.key);
    const sharedDays = teen.outcomes.filter((o) => o.shared);
    const ceilingDays = teen.outcomes.filter((o) => o.reason === 'above_ceiling');
    expect(sharedDays.length).toBeGreaterThan(0);
    expect(ceilingDays.length).toBeGreaterThan(0);
    expect(sharedDays.length + ceilingDays.length).toBe(7);
    for (const o of sharedDays) {
      const day = teen.plan.days.find((d) => d.date === o.date)!;
      // Ausgleich nur über die übrigen Plätze: keine Mahlzeit gestrichen, die anderen gesenkt.
      expect(day.emptySlots).toEqual([]);
      expect(day.meals.filter((m) => !m.fixed && !m.isFill).every((m) => m.factor < 1)).toBe(true);
      expect(day.status).toBe('complete');
    }
    for (const o of ceilingDays) {
      expect(mealAt(teen.plan, o.date, 'dinner')?.fixed ?? false).toBe(false);
    }
  }, 60_000);

  it('no_targets (ohne Einwilligung, Schwangerschaft) → Faktor 1, Standardportion', () => {
    const result = planSharedMeals({
      mode: 'sides',
      persons: [
        person('a', { healthDataConsent: false }),
        person('b', { sex: 'female', healthFlags: { flags: ['pregnancy', 'conservative_plan'] } }),
        person('c', BIG),
      ],
      meals: [{ date: MONDAY, slot: 'dinner', recipeId: 'haehnchen-reis' }],
    });
    const portions = result.meals[0]!.portions;
    expect(portions.find((p) => p.key === 'a')).toMatchObject({ factor: 1, basis: 'no_consent' });
    expect(portions.find((p) => p.key === 'b')).toMatchObject({ factor: 1, basis: 'no_targets' });
    for (const key of ['a', 'b']) {
      const plan = result.persons.find((p) => p.key === key)!.plan;
      expect(plan.days[0]?.status).toBe('no_targets');
      const meal = mealAt(plan, MONDAY, 'dinner')!;
      expect(meal.factor).toBe(1);
      expect(meal.ingredients).toEqual(
        scalePortion(variant('haehnchen-reis'), 1, N3_FOODS).ingredients,
      );
    }
    expectSafeWeek(result.persons.find((p) => p.key === 'c')!.plan, 'c');
  }, 60_000);

  it('Ausschlüsse bleiben hart: vegane Person bekommt kein Hähnchen, sondern einen eigenen Vorschlag', () => {
    const result = planSharedMeals({
      mode: 'uniform',
      persons: [person('omni', BIG), person('vegan', SMALL, { profile: { diet: 'vegan' } })],
      meals: week.map((date) => ({ date, slot: 'dinner' as const, recipeId: 'haehnchen-reis' })),
    });
    const vegan = result.persons.find((p) => p.key === 'vegan')!;
    expect(vegan.outcomes.every((o) => !o.shared && o.reason === 'excluded')).toBe(true);
    expect(
      vegan.plan.days.flatMap((d) => d.meals).some((m) => m.recipeId === 'haehnchen-reis'),
    ).toBe(false);
    const veganProfile = mealPlanProfileSchema.parse({ diet: 'vegan' });
    for (const day of vegan.plan.days) {
      for (const meal of day.meals) {
        const recipe = RECIPES.find((r) => r.id === meal.recipeId) as Recipe;
        expect(
          usedFoodViolations(
            recipe,
            meal.ingredients.map((i) => ({ index: i.index, foodId: i.foodId })),
            veganProfile,
            false,
          ),
        ).toEqual([]);
      }
    }
    expect(result.persons.find((p) => p.key === 'omni')!.outcomes.every((o) => o.shared)).toBe(
      true,
    );
  }, 60_000);

  it('Daumen runter, vergangener Tag, fehlender Platz und unbekanntes Rezept → nicht geteilt (mit Grund)', () => {
    const wednesday = addDays(MONDAY, 2);
    const result = planSharedMeals({
      mode: 'uniform',
      persons: [
        person('a', SMALL, {
          today: wednesday,
          ratings: [{ recipeId: 'lachs-reis', value: 'down', reason: null, ratedOn: wednesday }],
        }),
        person('b', BIG, { today: wednesday }),
      ],
      meals: [
        { date: MONDAY, slot: 'dinner', recipeId: 'haehnchen-reis' },
        { date: wednesday, slot: 'dinner', recipeId: 'lachs-reis' },
        { date: wednesday, slot: 'snack_afternoon', recipeId: 'banane-pur' },
        { date: addDays(MONDAY, 3), slot: 'dinner', recipeId: 'gibt-es-nicht' },
      ],
    });
    const reasons = (key: string) =>
      result.persons.find((p) => p.key === key)!.outcomes.map((o) => [o.date, o.slot, o.reason]);
    expect(reasons('a')).toEqual([
      [MONDAY, 'dinner', 'past_day'],
      [wednesday, 'dinner', 'rated_down'],
      [wednesday, 'snack_afternoon', null],
      [addDays(MONDAY, 3), 'dinner', 'not_found'],
    ]);
    expect(reasons('b')).toEqual([
      [MONDAY, 'dinner', 'past_day'],
      [wednesday, 'dinner', null],
      [wednesday, 'snack_afternoon', 'slot_missing'], // 3 Mahlzeiten: kein Nachmittags-Snack
      [addDays(MONDAY, 3), 'dinner', 'not_found'],
    ]);
  }, 60_000);

  it('1 vs. 7 Tage: nur die genannten Tage werden geteilt, die übrigen wie ohne Teilen', () => {
    const one = planSharedMeals({
      mode: 'uniform',
      persons: [person('a', SMALL), person('b', BIG)],
      meals: [{ date: MONDAY, slot: 'dinner', recipeId: 'lachs-reis' }],
    });
    const seven = planSharedMeals({
      mode: 'uniform',
      persons: [person('a', SMALL), person('b', BIG)],
      meals: week.map((date) => ({ date, slot: 'dinner' as const, recipeId: 'lachs-reis' })),
    });
    expect(one.persons.every((p) => p.outcomes.length === 1 && p.outcomes[0]?.shared)).toBe(true);
    expect(seven.persons.every((p) => p.outcomes.filter((o) => o.shared).length === 7)).toBe(true);
    const alone = buildMealPlanWeek(planInput(SMALL));
    const a = one.persons[0]!.plan;
    // Dienstag (unabhängig von Montag bis auf Wiederholungs-Zähler): Plätze außer dem Abendessen gleich besetzt.
    expect(a.days.slice(1).every((d) => dayWithinPlanBand(d, d.band))).toBe(true);
    expect(alone.days.length).toBe(a.days.length);
    for (const p of [...one.persons, ...seven.persons]) expectSafeWeek(p.plan, p.key);
  }, 60_000);

  it('1 Person und viele Personen (6) gehen; leerer Katalog → not_found ohne Absturz', () => {
    const solo = planSharedMeals({
      mode: 'sides',
      persons: [person('a', BIG)],
      meals: [{ date: MONDAY, slot: 'dinner', recipeId: 'haehnchen-reis' }],
    });
    expect(solo.persons[0]?.outcomes[0]?.shared).toBe(true);
    const many = planSharedMeals({
      mode: 'sides',
      persons: [
        person('a', SMALL),
        person('b', BIG),
        person('c', MINOR),
        person('d', {}),
        person('e', { birthDate: '1950-01-01' }),
        person('f', { healthDataConsent: false }),
      ],
      meals: [{ date: MONDAY, slot: 'dinner', recipeId: 'haehnchen-reis' }],
    });
    expect(many.persons).toHaveLength(6);
    for (const p of many.persons) expectSafeWeek(p.plan, p.key);
    const empty = planSharedMeals({
      mode: 'uniform',
      persons: [person('a', SMALL, { recipes: [] }), person('b', BIG, { recipes: [] })],
      meals: [{ date: MONDAY, slot: 'dinner', recipeId: 'haehnchen-reis' }],
    });
    expect(empty.persons.every((p) => p.outcomes[0]?.reason === 'not_found')).toBe(true);
    expect(empty.meals[0]?.portions).toEqual([]);
  }, 60_000);

  it('deterministisch; Reihenfolge der Personen egal', () => {
    const request = {
      mode: 'sides' as const,
      persons: [person('a', SMALL), person('b', BIG)],
      meals: week.map((date) => ({ date, slot: 'dinner' as const, recipeId: 'haehnchen-reis' })),
    };
    const first = planSharedMeals(request);
    expect(planSharedMeals(request)).toEqual(first);
    const reversed = planSharedMeals({ ...request, persons: [...request.persons].reverse() });
    for (const p of first.persons) {
      expect(reversed.persons.find((x) => x.key === p.key)).toEqual(p);
    }
  }, 60_000);

  it('Zod an der Grenze: doppelte Personen/Plätze, ungültiger Schlüssel, 7 Personen, andere Woche', () => {
    const meals = [{ date: MONDAY, slot: 'dinner' as const, recipeId: 'haehnchen-reis' }];
    expect(() =>
      planSharedMeals({ mode: 'uniform', persons: [person('a', SMALL), person('a', BIG)], meals }),
    ).toThrow();
    expect(() =>
      planSharedMeals({
        mode: 'uniform',
        persons: [person('a', SMALL)],
        meals: [...meals, ...meals],
      }),
    ).toThrow();
    expect(() =>
      planSharedMeals({ mode: 'uniform', persons: [person('Anna', SMALL)], meals }),
    ).toThrow();
    expect(() =>
      planSharedMeals({
        mode: 'uniform',
        persons: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k) => person(k, {})),
        meals,
      }),
    ).toThrow();
    const other = person('b', BIG);
    expect(() =>
      planSharedMeals({
        mode: 'uniform',
        persons: [
          person('a', SMALL),
          {
            ...other,
            input: {
              ...other.input,
              targets: nutritionTargetsForWeek(
                inputs({ today: SUNDAY_BEFORE, ...BIG }),
                addDays(MONDAY, 7),
              ),
            },
          },
        ],
        meals,
      }),
    ).toThrow('dieselbe Woche');
    expect(() =>
      planSharedMeals({
        mode: 'uniform',
        persons: [
          person('a', SMALL),
          { ...other, input: { ...other.input, foods: new Map(N3_FOODS) } },
        ],
        meals,
      }),
    ).toThrow('Lebensmittel-Katalog');
  });

  it('Wächter N13 S2: Plan mit geteilter Mahlzeit ist bis P1 nicht speicherbar – in BEIDEN Modi, für jede Person', () => {
    for (const mode of ['uniform', 'sides'] as const) {
      const result = planSharedMeals({
        mode,
        persons: [person('a', SMALL), person('b', BIG)],
        meals: [{ date: MONDAY, slot: 'dinner', recipeId: 'haehnchen-reis' }],
      });
      for (const p of result.persons) {
        expect(mealAt(p.plan, MONDAY, 'dinner')?.shared).toBe(true);
        expect(mealPlanMatchesRecipes(p.plan, RECIPES, N3_FOODS), `${mode} ${p.key}`).toBe(false);
        expect(parseStoredMealPlanWeek(JSON.parse(JSON.stringify(p.plan)))).toBeNull();
        // Wächter N13 NS1: Auch die Umwandlung in die gespeicherte Form lehnt ab, statt `shared` still zu verlieren.
        expect(() => toMealPlanPayload(p.plan, PAYLOAD_INPUTS)).toThrow('bis P1 nicht speicherbar');
      }
    }
  }, 60_000);
});

describe('Leistung mit großem Katalog (Lehre N10/N11)', () => {
  it('zwei Personen, 7 geteilte Abendessen, ca. 600 Rezepte: unter 15 s', () => {
    const big: Recipe[] = [];
    for (let k = 0; k < 32; k += 1) {
      for (const r of RECIPES) big.push({ ...r, id: k === 0 ? r.id : `${r.id}-k${k}` });
    }
    const start = performance.now();
    const result = planSharedMeals({
      mode: 'sides',
      persons: [person('a', SMALL, { recipes: big }), person('b', BIG, { recipes: big })],
      meals: week.map((date) => ({ date, slot: 'dinner' as const, recipeId: 'haehnchen-reis' })),
    });
    expect(performance.now() - start).toBeLessThan(15_000);
    expect(result.persons.every((p) => p.outcomes.every((o) => o.shared))).toBe(true);
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------------------
// Eigenschaftstest
// ---------------------------------------------------------------------------------------------------------

describe('Eigenschaftstest (19.7 N13 DoD): Portionsfaktor hebt nie über die Obergrenze und drückt nie unter die Untergrenze ohne below_floor', () => {
  it('zufällige Personen (Alter 16–85, 40–150 kg, 1–8 Mahlzeiten, ohne Einwilligung, schwanger, vegan …)', () => {
    const random = seededRandom(1313);
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
    const mains = RECIPES.filter((r) => r.meal_types.includes('main')).map((r) => r.id);
    const pool = [...RECIPES, HEAVY_OPTIONAL];
    const limitsByKey = new Map<string, (date: string) => IndependentLimits | null>();
    let independentChecks = 0;
    const diets: MealPlanProfileInput[] = [
      omni,
      { diet: 'omnivore' },
      { diet: 'vegetarian' },
      { diet: 'vegan' },
      { diet: 'omnivore', eatsPork: true, intolerances: ['peanuts'] },
    ];
    let shared = 0;
    let notShared = 0;
    let factorChecks = 0;
    for (let run = 0; run < 40; run += 1) {
      const count = 1 + Math.floor(random() * 3);
      const persons = Array.from({ length: count }, (_, i): SharedMealsPerson => {
        const age = 16 + Math.floor(random() * 70);
        const female = random() < 0.5;
        const pregnant = female && random() < 0.1;
        const overrides: Partial<NutritionInputsInput> = {
          sex: female ? 'female' : 'male',
          birthDate: `${2025 - age}-03-01`,
          bodyMetricsRows: metrics(
            150 + Math.floor(random() * 50),
            40 + Math.floor(random() * 110),
          ),
          goalType: pick(['fat_loss', 'muscle_gain', 'general_fitness', 'endurance'] as const),
          activityLevel: pick(['sedentary', 'light', 'active', 'very_active'] as const),
          mealsPerDay: 1 + Math.floor(random() * 8),
          healthDataConsent: random() > 0.15,
          healthFlags: { flags: pregnant ? ['pregnancy', 'conservative_plan'] : [] },
        };
        limitsByKey.set(`p${i}`, (date) =>
          independentLimits({ today: SUNDAY_BEFORE, ...overrides }, date),
        );
        return person(`p${i}`, overrides, { profile: pick(diets), recipes: pool });
      });
      const days = 1 + Math.floor(random() * 7);
      const slot: MealSlotId = pick(['dinner', 'lunch', 'main'] as const);
      // Die Hälfte der Gerichte mit schwerer optionaler Zutat (80 g Erdnüsse, Wächter N13 B1).
      const meals = week.slice(0, days).map((date) => ({
        date,
        slot,
        recipeId: random() < 0.5 ? HEAVY_OPTIONAL.id : pick(mains),
      }));
      const mode = random() < 0.5 ? ('uniform' as const) : ('sides' as const);
      const result = planSharedMeals({ mode, persons, meals });
      for (const p of result.persons) {
        const input = persons.find((x) => x.key === p.key)!.input;
        const profile = mealPlanProfileSchema.parse(input.profile);
        expectSafeWeek(p.plan, `Lauf ${run} ${p.key}`);
        // Unabhängiges Kalorien-Orakel (Wächter N13 S5): Grenzen direkt aus Grundumsatz/Gesamtumsatz, nicht aus dem Plan.
        for (const day of p.plan.days) {
          const limits = limitsByKey.get(p.key)?.(day.date) ?? null;
          if (limits === null || day.status === 'no_targets') continue;
          const kcal = day.meals.reduce((sum, m) => sum + m.nutrients.kcal, 0);
          const withOptional = kcal + day.meals.reduce((sum, m) => sum + m.optionalKcal, 0);
          expect(withOptional, `Obergrenze Lauf ${run} ${p.key} ${day.date}`).toBeLessThanOrEqual(
            limits.upper,
          );
          if (day.status === 'complete') {
            expect(kcal, `Untergrenze Lauf ${run} ${p.key} ${day.date}`).toBeGreaterThanOrEqual(
              limits.lower,
            );
          }
          independentChecks += 1;
        }
        for (const day of p.plan.days) {
          const pregnancy =
            input.targets.days
              .find((d) => d.date === day.date)
              ?.recipeExclusions.includes('pregnancy_caution') ?? false;
          for (const meal of day.meals) {
            const recipe = input.recipes.find((r) => r.id === meal.recipeId) as Recipe;
            expect(
              usedFoodViolations(
                recipe,
                meal.ingredients.map((i) => ({ index: i.index, foodId: i.foodId })),
                profile,
                pregnancy,
              ),
              `Lauf ${run} ${p.key} ${day.date} ${meal.recipeId}`,
            ).toEqual([]);
          }
        }
        for (const outcome of p.outcomes) {
          if (!outcome.shared) {
            notShared += 1;
            continue;
          }
          shared += 1;
          const meal = mealAt(p.plan, outcome.date, outcome.slot);
          expect(meal?.recipeId).toBe(outcome.recipeId);
          const info = result.meals
            .find((m) => m.date === outcome.date && m.slot === outcome.slot)
            ?.portions.find((x) => x.key === p.key);
          expect(info).toBeDefined();
          expect(meal?.factor).toBe(info?.factor);
          if (info?.basis === 'target') {
            factorChecks += 1;
            for (const f of [info.factor, info.mainFactor, info.sideFactor]) {
              expect(f).toBeGreaterThanOrEqual(F.min);
              expect(f).toBeLessThanOrEqual(F.max);
            }
          } else {
            expect(info?.factor).toBe(1);
          }
        }
      }
    }
    // Der Test prüft wirklich etwas: geteilte und nicht geteilte Mahlzeiten, Faktoren aus Zielen.
    expect(shared).toBeGreaterThan(20);
    expect(notShared).toBeGreaterThan(5);
    expect(factorChecks).toBeGreaterThan(10);
    expect(independentChecks).toBeGreaterThan(200);
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------------------
// Wächter-Prüfung N13
// ---------------------------------------------------------------------------------------------------------

describe('Wächter N13 B1: optionale Zutaten der geteilten Portion heben den Tag nie über die Obergrenze', () => {
  it('schwere optionale Zutat (80 g Erdnüsse): über der Obergrenze → eigener Vorschlag, jeder Tag im Band', () => {
    const recipes = [...RECIPES, HEAVY_OPTIONAL];
    const random = seededRandom(1316);
    let aboveCeiling = 0;
    let checked = 0;
    for (let run = 0; run < 30; run += 1) {
      const persons = [0, 1].map((i) =>
        person(
          `p${i}`,
          {
            sex: random() < 0.5 ? 'female' : 'male',
            birthDate: `${2025 - (16 + Math.floor(random() * 60))}-03-01`,
            bodyMetricsRows: metrics(
              150 + Math.floor(random() * 50),
              40 + Math.floor(random() * 110),
            ),
            goalType: (['fat_loss', 'muscle_gain', 'general_fitness'] as const)[run % 3],
            activityLevel: (['sedentary', 'light', 'active', 'very_active'] as const)[run % 4],
            mealsPerDay: 1 + Math.floor(random() * 5),
          },
          { recipes },
        ),
      );
      const result = planSharedMeals({
        mode: run % 2 === 0 ? 'uniform' : 'sides',
        persons,
        meals: week.map((date) => ({ date, slot: 'dinner' as const, recipeId: HEAVY_OPTIONAL.id })),
      });
      for (const p of result.persons) {
        for (const day of p.plan.days) {
          expect(dayWithinPlanBand(day, day.band), `Lauf ${run} ${p.key} ${day.date}`).toBe(true);
          checked += 1;
        }
        aboveCeiling += p.outcomes.filter((o) => o.reason === 'above_ceiling').length;
      }
    }
    expect(checked).toBe(30 * 2 * 7);
    expect(aboveCeiling).toBeGreaterThan(0);
  }, 60_000);
});

describe('Wächter N13 S1: Tausch an Tagen mit geteilter Mahlzeit', () => {
  // Größerer Katalog (Kopien mit eigener ID), damit „Rezept tauschen“ Alternativen außerhalb der Woche findet.
  const catalog = [0, 1, 2, 3].flatMap((k) =>
    RECIPES.map((r) => (k === 0 ? r : { ...r, id: `${r.id}-k${k}` })),
  );
  const setup = () => {
    const result = planSharedMeals({
      mode: 'sides',
      persons: [
        person('a', { ...SMALL, mealsPerDay: 3 }, { recipes: catalog }),
        person('b', BIG, { recipes: catalog }),
      ],
      meals: [{ date: MONDAY, slot: 'dinner', recipeId: 'haehnchen-reis' }],
    });
    const a = result.persons.find((p) => p.key === 'a')!;
    expect(a.outcomes[0]?.shared).toBe(true);
    const input = {
      ...planInput({ ...SMALL, mealsPerDay: 3 }, { recipes: catalog }),
      substitutions: DEMO_SUBSTITUTIONS,
    };
    // `planInput` setzt weder `existingPlan` noch `variant`.
    return { plan: a.plan, input };
  };

  it('„Rezept tauschen“ einer ANDEREN Mahlzeit: geteilte Portion bleibt exakt (Gramm und kcal)', () => {
    const { plan, input } = setup();
    const shared = mealAt(plan, MONDAY, 'dinner')!;
    let tried = 0;
    for (const slot of ['breakfast', 'lunch'] as const) {
      const swapped = swapMealRecipe(plan, { date: MONDAY, slot }, input);
      if (!swapped.ok) continue;
      tried += 1;
      const after = mealAt(swapped.plan, MONDAY, 'dinner')!;
      expect(after.ingredients).toEqual(shared.ingredients);
      expect(after.nutrients).toEqual(shared.nutrients);
      expect(after.shared).toBe(true);
      expect(dayWithinPlanBand(swapped.plan.days[0]!, swapped.plan.days[0]!.band)).toBe(true);
    }
    expect(tried).toBeGreaterThan(0);
  }, 60_000);

  it('„Rezept tauschen“ der geteilten Mahlzeit selbst: danach eine eigene Mahlzeit (nicht geteilt, nicht fest)', () => {
    const { plan, input } = setup();
    const swapped = swapMealRecipe(plan, { date: MONDAY, slot: 'dinner' }, input);
    expect(swapped.ok).toBe(true);
    if (!swapped.ok) return;
    const after = mealAt(swapped.plan, MONDAY, 'dinner')!;
    expect(after.shared).toBeUndefined();
    expect(after.fixed).toBe(false);
    expect(after.recipeId).not.toBe('haehnchen-reis');
    expect(dayWithinPlanBand(swapped.plan.days[0]!, swapped.plan.days[0]!.band)).toBe(true);
  }, 60_000);

  it('Zutaten-Austausch: in einer anderen Mahlzeit bleibt die geteilte Portion exakt; in der geteilten → eigene Mahlzeit', () => {
    const { plan, input } = setup();
    const shared = mealAt(plan, MONDAY, 'dinner')!;
    // Andere Mahlzeit: jede Zutat mit Rolle ausprobieren, bis ein Tausch klappt.
    let other = 0;
    for (const meal of plan.days[0]!.meals) {
      if (meal.isFill || meal.slot === 'dinner') continue;
      const recipe = catalog.find((r) => r.id === meal.recipeId) as Recipe;
      recipe.ingredients.forEach((ing, index) => {
        if (ing.role === undefined) return;
        for (const sub of DEMO_SUBSTITUTIONS.filter((x) => x.food_id === ing.food_id)) {
          const res = applyIngredientSwap(
            plan,
            { date: MONDAY, slot: meal.slot as MealSlotId, index },
            sub.substitute_food_id,
            input,
          );
          if (!res.ok) continue;
          other += 1;
          const after = mealAt(res.plan, MONDAY, 'dinner')!;
          expect(after.ingredients).toEqual(shared.ingredients);
          expect(after.nutrients).toEqual(shared.nutrients);
          expect(after.shared).toBe(true);
        }
      });
    }
    // Geteilte Mahlzeit selbst: Hähnchen → Tofu.
    const own = applyIngredientSwap(
      plan,
      { date: MONDAY, slot: 'dinner', index: 0 },
      'tofu',
      input,
    );
    expect(own.ok).toBe(true);
    if (own.ok) {
      const after = mealAt(own.plan, MONDAY, 'dinner')!;
      expect(after.shared).toBeUndefined();
      expect(after.fixed).toBe(false);
      expect(after.ingredients.some((i) => i.foodId === 'tofu')).toBe(true);
      expect(dayWithinPlanBand(own.plan.days[0]!, own.plan.days[0]!.band)).toBe(true);
    }
    expect(other).toBeGreaterThan(0);
  }, 60_000);
});

describe('Wächter N13 S3 und G-N13-2', () => {
  it('S3: ohne Einwilligung, aber Ziele aus Gesundheitsdaten → Fehler', () => {
    const p = person('a', BIG);
    expect(() =>
      planSharedMeals({
        mode: 'uniform',
        persons: [{ ...p, healthDataConsent: false }],
        meals: [{ date: MONDAY, slot: 'dinner', recipeId: 'haehnchen-reis' }],
      }),
    ).toThrow('ohne Einwilligung');
  });

  it('G-N13-2 (sichere Voreinstellung): gemeinsamer Faktor = der KLEINSTE der Personen mit Zielen', () => {
    const curry = variant('tofu-erdnuss-curry');
    const portions = sharedMealPortions(
      [
        sharedPerson('a', curry, 600),
        sharedPerson('b', curry, 1300),
        sharedPerson('c', curry, 900),
      ],
      N3_FOODS,
      'sides',
    );
    const smallest = Math.min(...portions.map((p) => p.factor));
    for (const p of portions) expect(p.factors.main).toBe(smallest);
    // Niemand bekommt mehr Hauptkomponente als das eigene Ziel verlangt.
    for (const p of portions) expect(p.factors.main).toBeLessThanOrEqual(p.factor);
  });
});

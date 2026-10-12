/**
 * Meal-Prep-Wochenpläne (docs/PLAN-PHASE-5.md 19.6, B1, K7, G3) und Kochtermine (6.4).
 * DoD 19.6: „`applyMealPrepPlan` liefert nie ein Rezept, das `filter.ts` ausschließt“ (Erdnuss + vegane Woche mit
 * Erdnuss-Curry, Schwangerschaft + Fisch-Woche, `eats_pork = false` + Fleisch-Woche, „mag ich nicht“ + Pilz-Woche),
 * Gratis-Plan „erster passender oder keiner“, Haltbarkeit R9/`storage_plan`, Planband.
 */
import { describe, expect, it } from 'vitest';

import { ing, makeRecipe } from '../content/nutrition-fixtures';
import type { Food } from '../content/food-schema';
import type { Recipe } from '../content/recipe-schema';
import { daysBetween } from '../dates';
import { filterRecipe } from './filter';
import type { MealPlanInput } from './meal-plan';
import { independentBand, N3_FOODS, N3_MEAL_PREP_PLANS, N3_RECIPES } from './meal-plan-fixtures';
import { mealPrepCookEvents, mealPrepKeeping } from './meal-prep';
import { applyMealPrepPlan, cookDaySchedule, selectFreeMealPrepPlan } from './meal-prep-plan';
import { type MealPlanProfileInput, mealPlanProfileSchema } from './schemas';
import { nutritionTargetsForWeek } from './targets';
import { inputs, MONDAY, seededRandom } from './test-helpers';

const SUNDAY_BEFORE = '2026-10-11';

function plan(id: string) {
  const found = N3_MEAL_PREP_PLANS.find((p) => p.id === id);
  if (found === undefined) throw new Error(id);
  return found;
}

function input(
  profile: MealPlanProfileInput,
  options: {
    pregnant?: boolean;
    mealsPerDay?: number;
    recipes?: readonly Recipe[];
    today?: string;
  } = {},
): MealPlanInput {
  return {
    targets: nutritionTargetsForWeek(
      inputs({
        today: options.today ?? SUNDAY_BEFORE,
        sex: 'female',
        mealsPerDay: options.mealsPerDay ?? 4,
        healthFlags:
          options.pregnant === true ? { flags: ['pregnancy', 'conservative_plan'] } : { flags: [] },
      }),
      MONDAY,
    ),
    profile,
    recipes: options.recipes ?? N3_RECIPES,
    foods: N3_FOODS,
    allowDrafts: true,
    today: options.today ?? SUNDAY_BEFORE,
  };
}

describe('mealPrepCookEvents (6.4)', () => {
  it('1–7 Kochtage decken jeden Tag genau einmal, Sonntag davor zählt für Montag', () => {
    for (let days = 1; days <= 7; days += 1) {
      const events = mealPrepCookEvents(MONDAY, days);
      expect(events).toHaveLength(days);
      expect(events.flatMap((e) => e.dayIndices)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    }
    expect(mealPrepCookEvents(MONDAY, 1)[0]?.cookDate).toBe(SUNDAY_BEFORE);
    expect(mealPrepCookEvents(MONDAY, 2).map((e) => e.cookDate)).toEqual([
      SUNDAY_BEFORE,
      '2026-10-14',
    ]);
    expect(() => mealPrepCookEvents(MONDAY, 0)).toThrow();
    expect(() => mealPrepCookEvents(MONDAY, 8)).toThrow();
  });

  it('Haltbarkeit mit den tatsächlichen Zutaten: Reis/Fisch/Hack 1 Tag, einfrierbar nur Rezept UND Zutaten', () => {
    const profile = mealPlanProfileSchema.parse({ diet: 'omnivore', eatsPork: true });
    const ctx = { profile, excludePregnancyCaution: false, allowDrafts: true };
    const keep = (id: string) => {
      const r = filterRecipe(N3_RECIPES.find((x) => x.id === id) as Recipe, N3_FOODS, ctx);
      if (!r.ok) throw new Error(id);
      return mealPrepKeeping(r.value, N3_FOODS);
    };
    expect(keep('hack-spaghetti')).toEqual({ fridgeDays: 1, freezable: true });
    expect(keep('lachs-reis')).toEqual({ fridgeDays: 1, freezable: false });
    expect(keep('spaghetti-tomatensauce')).toEqual({ fridgeDays: 3, freezable: true });
    expect(keep('omelett-champignons')).toEqual({ fridgeDays: 0, freezable: false });
  });

  it('R9 gegen falsche Rezept-Angabe: Rezept sagt 3 Tage, Reis hält 1 Tag → 1 Tag; Ersatz zählt mit', () => {
    const profile = mealPlanProfileSchema.parse({ diet: 'vegetarian', intolerances: ['dairy'] });
    const falsch = makeRecipe({
      id: 'reis-milch-vorrat',
      meal_types: ['main'],
      ingredients: [ing('reis', 75, 'g'), ing('vollmilch', 200, 'ml')],
      meal_prep: { suitable: true, fridge_days: 3, freezable: true },
    });
    const r = filterRecipe(falsch, N3_FOODS, {
      profile,
      excludePregnancyCaution: false,
      allowDrafts: true,
    });
    if (!r.ok) throw new Error('gefiltert');
    // Haferdrink statt Milch (S4): nicht einfrierbar → das Gericht auch nicht.
    expect(r.value.substitutions[0]?.substituteFoodId).toBe('haferdrink');
    expect(mealPrepKeeping(r.value, N3_FOODS)).toEqual({ fridgeDays: 1, freezable: false });
  });

  it('S5b: Einfrieren wird am ERSATZPRODUKT geprüft (Original einfrierbar, Ersatz nicht)', () => {
    const milk = N3_FOODS.get('vollmilch') as Food;
    const foods = new Map(N3_FOODS);
    foods.set('vollmilch', { ...milk, freezable: true, max_fridge_days: 3 });
    const profile = mealPlanProfileSchema.parse({ diet: 'vegetarian', intolerances: ['dairy'] });
    const suppe = makeRecipe({
      id: 'milch-suppe',
      meal_types: ['main'],
      ingredients: [ing('kokosmilch', 100, 'ml'), ing('vollmilch', 200, 'ml')],
      meal_prep: { suitable: true, fridge_days: 2, freezable: true },
    });
    const ctx = { profile, excludePregnancyCaution: false, allowDrafts: true };
    const plain = filterRecipe(suppe, foods, {
      ...ctx,
      profile: mealPlanProfileSchema.parse({ diet: 'vegetarian' }),
    });
    if (!plain.ok) throw new Error('gefiltert');
    expect(mealPrepKeeping(plain.value, foods)).toEqual({ fridgeDays: 2, freezable: true });
    const r = filterRecipe(suppe, foods, ctx);
    if (!r.ok) throw new Error('gefiltert');
    expect(r.value.substitutions[0]?.substituteFoodId).toBe('haferdrink');
    // Haferdrink: nicht einfrierbar, hält 2 Tage.
    expect(mealPrepKeeping(r.value, foods)).toEqual({ fridgeDays: 2, freezable: false });
  });
});

describe('applyMealPrepPlan – kompletter Filter je Rezept (B1)', () => {
  it('Erdnuss-Unverträglichkeit + vegane Woche mit Erdnuss-Curry → nicht angeboten, ohne Grund', () => {
    const offer = applyMealPrepPlan(
      plan('a-vegan-woche'),
      input({ diet: 'vegan', intolerances: ['peanuts'] }),
    );
    expect(offer).toEqual({ offered: false });
    expect(applyMealPrepPlan(plan('a-vegan-woche'), input({ diet: 'vegan' })).offered).toBe(true);
  });

  it('Schwangerschaft + Fisch nur als unbestätigte Annahme erhitzt → nicht angeboten', () => {
    const profile: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };
    expect(applyMealPrepPlan(plan('b-fisch-woche'), input(profile, { pregnant: true }))).toEqual({
      offered: false,
    });
    expect(applyMealPrepPlan(plan('b-fisch-woche'), input(profile)).offered).toBe(true);
  });

  it('eats_pork = false bzw. null + Fleisch-Woche (Hack gemischt) → nicht angeboten', () => {
    for (const eatsPork of [false, null]) {
      expect(
        applyMealPrepPlan(plan('c-fleisch-woche'), input({ diet: 'omnivore', eatsPork })).offered,
      ).toBe(false);
    }
    expect(
      applyMealPrepPlan(plan('c-fleisch-woche'), input({ diet: 'omnivore', eatsPork: true }))
        .offered,
    ).toBe(true);
  });

  it('„mag ich nicht: Pilze“ + Pilz-Woche → nicht angeboten', () => {
    expect(
      applyMealPrepPlan(plan('d-pilz-woche'), input({ diet: 'vegan', dislikes: ['mushrooms'] }))
        .offered,
    ).toBe(false);
  });

  it('Eigenschaftstest: kein Rezept im angebotenen Plan, das filter.ts ausschließt', () => {
    const rnd = seededRandom(1906);
    const groups = ['peanuts', 'gluten', 'soy', 'fish', 'mushrooms', 'onion_garlic'] as const;
    let offered = 0;
    for (let i = 0; i < 120; i += 1) {
      const diet = (['omnivore', 'vegetarian', 'vegan'] as const)[i % 3] as 'omnivore';
      const chosen = groups.filter(() => rnd() < 0.2);
      const profile = mealPlanProfileSchema.parse({
        diet,
        eatsPork: diet === 'omnivore' ? ([true, false, null] as const)[i % 3] : null,
        intolerances: chosen.filter((_, j) => j % 2 === 0),
        dislikes: chosen.filter((_, j) => j % 2 === 1),
      });
      const pregnant = rnd() < 0.3;
      const mealsPerDay = 1 + (i % 8);
      for (const mealPrepPlan of N3_MEAL_PREP_PLANS) {
        const data = input(profile, { pregnant, mealsPerDay });
        const offer = applyMealPrepPlan(mealPrepPlan, data);
        if (!offer.offered) continue;
        offered += 1;
        for (const day of offer.plan.days) {
          const t = data.targets.days.find((d) => d.date === day.date);
          const exclude = t?.recipeExclusions.includes('pregnancy_caution') ?? true;
          for (const meal of day.meals) {
            const r = filterRecipe(
              N3_RECIPES.find((x) => x.id === meal.recipeId) as Recipe,
              N3_FOODS,
              {
                profile,
                excludePregnancyCaution: exclude,
                allowDrafts: true,
              },
            );
            expect(r.ok, `${mealPrepPlan.id} ${day.date} ${meal.recipeId}`).toBe(true);
          }
          // Planband (B1) bzw. below_floor; nie über der Obergrenze (G3).
          if (t?.band != null) {
            const [min, max] = independentBand(t);
            const optional = day.meals.reduce((n, m) => n + m.optionalKcal, 0);
            expect(day.totals.kcal + optional).toBeLessThanOrEqual(max + 1e-6);
            if (day.status === 'complete')
              expect(day.totals.kcal).toBeGreaterThanOrEqual(min - 1e-6);
            else expect(day.notices).toContain('day_below_floor');
          }
        }
      }
    }
    expect(offered).toBeGreaterThan(50);
  });
});

describe('applyMealPrepPlan – Plätze, Haltbarkeit, Vorrang (K7, R9)', () => {
  const vegan: MealPlanProfileInput = { diet: 'vegan', cookingMode: 'meal_prep', mealprepDays: 3 };

  it('Frühstück/Mittag/Snack Mo–Fr aus dem Plan, Abendessen und Wochenende frei; ersetzt mealprep_days', () => {
    const offer = applyMealPrepPlan(plan('a-vegan-woche'), input(vegan));
    expect(offer.offered).toBe(true);
    if (!offer.offered) return;
    expect(offer.plan.mealPrepPlanId).toBe('a-vegan-woche');
    offer.plan.days.forEach((day, i) => {
      const fromPlan = day.meals.filter((m) => m.mealPrepPlanId === 'a-vegan-woche');
      if (i < 5) {
        expect(fromPlan.map((m) => m.slot).sort()).toEqual([
          'breakfast',
          'lunch',
          'snack_afternoon',
        ]);
        expect(day.meals.find((m) => m.slot === 'dinner')?.mealPrepPlanId).toBeNull();
      } else {
        expect(fromPlan).toEqual([]);
      }
      // Keine Kochtermine aus mealprep_days (sonst wäre Mittwoch ein Kochtag).
      expect(day.meals.filter((m) => m.prepKind === 'cook')).toEqual([]);
    });
  });

  it('storage_plan sagt „Kühlschrank“, R9 gewinnt: Curry ab Tag 2 eingefroren, Hafer-Frühstück frisch', () => {
    const offer = applyMealPrepPlan(plan('a-vegan-woche'), input(vegan));
    if (!offer.offered) throw new Error('nicht angeboten');
    const meals = (slot: string) =>
      offer.plan.days.slice(0, 5).map((d) => d.meals.find((m) => m.slot === slot));
    expect(meals('lunch').map((m) => m?.storage)).toEqual([
      'fridge',
      'freeze',
      'freeze',
      'freeze',
      'freeze',
    ]);
    expect(meals('breakfast').map((m) => m?.prepKind)).toEqual([
      'leftover',
      'fresh',
      'fresh',
      'fresh',
      'fresh',
    ]);
    expect(meals('snack_afternoon').map((m) => m?.storage)).toEqual([
      'fridge',
      'fridge',
      'fridge',
      null,
      null,
    ]);
    for (const day of offer.plan.days) {
      for (const meal of day.meals.filter((m) => m.storage === 'fridge')) {
        expect(daysBetween(meal.cookDate, day.date)).toBeLessThanOrEqual(
          meal.recipeId === 'paprika-sticks' ? 3 : 1,
        );
      }
    }
  });

  it('Platz fehlt im Layout (2 Mahlzeiten: kein Frühstück) → nicht angeboten; 1 Mahlzeit nur mit Hauptgericht', () => {
    expect(applyMealPrepPlan(plan('a-vegan-woche'), input(vegan, { mealsPerDay: 2 })).offered).toBe(
      false,
    );
    const mainOnly = { ...plan('d-pilz-woche'), recipe_ids: ['champignon-reis'] };
    expect(applyMealPrepPlan(mainOnly, input({ diet: 'vegan' }, { mealsPerDay: 1 })).offered).toBe(
      true,
    );
  });

  it('Kochtag schon vorbei: heute gekocht, vergangene Tage nicht belegt', () => {
    const offer = applyMealPrepPlan(
      plan('d-pilz-woche'),
      input({ diet: 'vegan' }, { today: '2026-10-14' }),
    );
    if (!offer.offered) throw new Error('nicht angeboten');
    const lunch = offer.plan.days.map((d) => d.meals.find((m) => m.slot === 'lunch'));
    expect(lunch[2]).toMatchObject({ prepKind: 'cook', cookDate: '2026-10-14' });
    expect(lunch[3]).toMatchObject({ prepKind: 'leftover', storage: 'fridge' });
    expect(lunch[4]?.prepKind).toBe('fresh');
    expect(lunch[0]?.mealPrepPlanId).toBeNull();
    expect(
      applyMealPrepPlan(plan('d-pilz-woche'), input({ diet: 'vegan' }, { today: '2026-10-17' })),
    ).toEqual({
      offered: false,
    });
  });

  it('G3: liegt ein Tag auch mit Faktor 0,5 über der Obergrenze → nicht angeboten', () => {
    const riesig = makeRecipe({
      id: 'riesen-portion',
      title_de: 'Riesen-Portion',
      meal_types: ['main'],
      ingredients: [ing('olivenoel', 30, 'tbsp'), ing('reis', 500, 'g')],
      meal_prep: { suitable: true, fridge_days: 1, freezable: true },
    });
    const recipes = [...N3_RECIPES, riesig];
    const big = { ...plan('d-pilz-woche'), id: 'e-riesen-woche', recipe_ids: ['riesen-portion'] };
    expect(applyMealPrepPlan(big, input({ diet: 'vegan' }, { recipes }))).toEqual({
      offered: false,
    });
  });

  it('Entwurf nur im Testmodus', () => {
    expect(
      applyMealPrepPlan(plan('a-vegan-woche'), { ...input(vegan), allowDrafts: false }).offered,
    ).toBe(false);
  });
});

describe('selectFreeMealPrepPlan (19.6 Nr. 3)', () => {
  it('erster passender Plan in fester Reihenfolge, sonst keiner', () => {
    const omni = selectFreeMealPrepPlan(
      [...N3_MEAL_PREP_PLANS].reverse(),
      input({ diet: 'omnivore', eatsPork: true }),
    );
    expect(omni?.mealPrepPlan.id).toBe('a-vegan-woche');
    const noPeanuts = selectFreeMealPrepPlan(
      N3_MEAL_PREP_PLANS,
      input({ diet: 'omnivore', eatsPork: false, intolerances: ['peanuts'] }),
    );
    expect(noPeanuts?.mealPrepPlan.id).toBe('b-fisch-woche');
    expect(
      selectFreeMealPrepPlan(
        N3_MEAL_PREP_PLANS,
        input({ diet: 'vegan', intolerances: ['peanuts'], dislikes: ['mushrooms'] }),
      ),
    ).toBeNull();
  });
});

describe('cookDaySchedule', () => {
  it('Schritte nach Startminute mit Minuten bis zum nächsten Schritt', () => {
    expect(cookDaySchedule(plan('a-vegan-woche'))).toEqual([
      { startMin: 0, textDe: 'Reis aufsetzen.', minutesUntilNext: 10 },
      { startMin: 10, textDe: 'Gemüse schneiden.', minutesUntilNext: 10 },
      { startMin: 20, textDe: 'Hauptgericht kochen.', minutesUntilNext: null },
    ]);
  });
});

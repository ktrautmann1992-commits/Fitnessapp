/**
 * Etappe N7 (docs/PLAN-PHASE-5.md 7.3): Grenz-Schemas für die Datenbank – `toShoppingListPayload` (Einkaufsliste →
 * `replace_shopping_list`) und die Plätze des Essensplans. Die Feldlisten gleicht db-sync.test.ts mit den
 * SQL-Funktionen ab; hier die Abbildung und die Grenzfälle (leere Liste, 1 und 12 Portionen, eigene Einträge,
 * erweiterte Ernährungsform, Zeitraum, Höchstzahlen, kein Gesundheitsgrund in der Payload).
 */
import { describe, expect, it } from 'vitest';

import { MEAL_SLOT_TIMES, RECIPE_SERVINGS_PICKER, SHOPPING_LIST_ROUNDING } from '../constants';
import { buildMealPlanWeek, EXTRA_SLOTS, type MealPlanInput } from './meal-plan';
import { N3_FOODS, N3_RECIPES } from './meal-plan-fixtures';
import {
  MEAL_PLAN_SLOT_KEYS,
  mealPlanItemPayloadSchema,
  toMealPlanPayload,
} from './meal-plan-payload';
import { addManualShoppingItem } from './shopping-list';
import {
  shoppingListPayloadSchema,
  toShoppingListPayload,
  type ShoppingListPayload,
} from './shopping-list-payload';
import { newShoppingList, type StoredShoppingList } from './shopping-list-store';
import { nutritionTargetsForWeek } from './targets';
import { inputs, MONDAY } from './test-helpers';

type PlanInput = Omit<MealPlanInput, 'existingPlan' | 'variant'>;

function data(mealsPerDay: number): PlanInput {
  return {
    targets: nutritionTargetsForWeek(
      inputs({ today: '2026-10-11', mealsPerDay, sex: 'female', healthFlags: { flags: [] } }),
      MONDAY,
    ),
    profile: { diet: 'omnivore', eatsPork: true },
    recipes: N3_RECIPES,
    foods: N3_FOODS,
    allowDrafts: true,
    today: '2026-10-11',
  };
}

function list(mealsPerDay = 4): StoredShoppingList {
  const input = data(mealsPerDay);
  return newShoppingList(buildMealPlanWeek(input), input);
}

describe('toShoppingListPayload (replace_shopping_list, N7)', () => {
  it('bildet jede gespeicherte Liste verlustfrei ab (1, 4 und 8 Mahlzeiten)', () => {
    for (const mealsPerDay of [1, 4, 8]) {
      const stored = list(mealsPerDay);
      const payload = toShoppingListPayload(stored);
      expect(payload.week_start).toBe(stored.weekStart);
      expect(payload.from_date).toBe(stored.from);
      expect(payload.to_date).toBe(stored.to);
      expect(payload.uses_health_data).toBe(stored.usesHealthData);
      expect(payload.plan_key).toBe(stored.planKey);
      expect(payload.items.map((i) => i.item_key)).toEqual(stored.items.map((i) => i.itemKey));
      expect(payload.items.map((i) => i.checked)).toEqual(stored.items.map((i) => i.checked));
    }
  });

  it('eigene Einträge, zusätzliche Rezepte mit 1 und 12 Portionen, erweiterte Ernährungsform', () => {
    const base = addManualShoppingItem(list(), { labelDe: 'Kaffee' });
    const stored: StoredShoppingList = {
      ...base,
      recipes: [
        { recipeId: 'overnight-oats', servings: RECIPE_SERVINGS_PICKER.min },
        { recipeId: 'tofu-erdnuss-curry', servings: RECIPE_SERVINGS_PICKER.max, diet: 'vegan' },
      ],
    };
    const payload = toShoppingListPayload(stored);
    expect(payload.recipes).toEqual([
      { recipe_id: 'overnight-oats', servings: 1, diet: null },
      { recipe_id: 'tofu-erdnuss-curry', servings: 12, diet: 'vegan' },
    ]);
    const manual = payload.items.filter((i) => i.is_manual);
    expect(manual).toHaveLength(1);
    expect(manual[0]?.item_key.startsWith('manual|')).toBe(true);
    expect(manual[0]?.food_id).toBeNull();
  });

  it('leere Liste ist gültig', () => {
    const stored: StoredShoppingList = { ...list(), items: [], recipes: [] };
    expect(toShoppingListPayload(stored).items).toEqual([]);
  });

  it('lehnt unbekannte Felder, falschen Zeitraum, falsche Schlüssel und zu viele eigene Einträge ab', () => {
    const payload: ShoppingListPayload = toShoppingListPayload(list());
    expect(shoppingListPayloadSchema.safeParse({ ...payload, user_id: 'x' }).success).toBe(false);
    expect(shoppingListPayloadSchema.safeParse({ ...payload, to_date: '2026-10-19' }).success).toBe(
      false,
    );
    expect(
      shoppingListPayloadSchema.safeParse({ ...payload, week_start: '2026-10-13' }).success,
    ).toBe(false);
    const item = payload.items[0];
    expect(item).toBeDefined();
    if (item === undefined) return;
    expect(
      shoppingListPayloadSchema.safeParse({
        ...payload,
        items: [{ ...item, is_manual: true }],
      }).success,
    ).toBe(false);
    expect(shoppingListPayloadSchema.safeParse({ ...payload, items: [item, item] }).success).toBe(
      false,
    );
    const manual = Array.from({ length: SHOPPING_LIST_ROUNDING.manualItemsMax + 1 }, (_, n) => ({
      ...item,
      item_key: `manual|${n}`,
      food_id: null,
      is_manual: true,
    }));
    expect(shoppingListPayloadSchema.safeParse({ ...payload, items: manual }).success).toBe(false);
    expect(
      shoppingListPayloadSchema.safeParse({ ...payload, items: manual.slice(1) }).success,
    ).toBe(true);
    expect(
      shoppingListPayloadSchema.safeParse({
        ...payload,
        recipes: [{ recipe_id: 'overnight-oats', servings: 13, diet: null }],
      }).success,
    ).toBe(false);
  });

  it('enthält keine Gründe, kcal oder Gesundheitsangaben – nur Felder der Tabellen', () => {
    const text = JSON.stringify(toShoppingListPayload(list()));
    for (const word of ['kcal', 'intoler', 'pregnan', 'reason', 'weight']) {
      expect(text).not.toContain(word);
    }
  });
});

describe('MEAL_PLAN_SLOT_KEYS (meal_plan_items.slot, N7)', () => {
  it('= alle Mahlzeiten-Plätze plus Ergänzungs-Snacks, jeder Plan nutzt nur diese', () => {
    expect([...MEAL_PLAN_SLOT_KEYS].sort()).toEqual(
      [...Object.keys(MEAL_SLOT_TIMES), ...EXTRA_SLOTS].sort(),
    );
    for (const mealsPerDay of [1, 8]) {
      const plan = buildMealPlanWeek(data(mealsPerDay));
      const payload = toMealPlanPayload(plan, {
        diet: 'omnivore',
        meals_per_day: mealsPerDay,
        cooking_mode: 'daily',
        mealprep_days: null,
        mealprep_slots: 'lunch',
      });
      for (const item of payload.items) {
        expect(MEAL_PLAN_SLOT_KEYS).toContain(item.slot);
      }
    }
  });
});

describe('Zutaten-Änderungen je Stelle (Wächter N7 S3)', () => {
  const plan = buildMealPlanWeek(data(4));
  const payload = toMealPlanPayload(plan, {
    diet: 'omnivore',
    meals_per_day: 4,
    cooking_mode: 'daily',
    mealprep_days: null,
    mealprep_slots: 'lunch',
  });
  const base = payload.items[0];

  it('dieselbe Zutat an zwei Stellen: Ersatz an Stelle 0 und Weglassen an Stelle 2 sind gültig', () => {
    expect(base).toBeDefined();
    if (base === undefined) return;
    const item = {
      ...base,
      substitutions: [{ index: 0, food_id: 'milch', substitute_food_id: 'haferdrink' }],
      omitted_optional: [{ index: 2, food_id: 'milch' }],
      ingredient_swaps: [],
    };
    expect(mealPlanItemPayloadSchema.safeParse(item).success).toBe(true);
    // Dasselbe Ersatz-Paar an beiden Stellen (wie der Filter es je Stelle erzeugt) ist ebenfalls gültig.
    expect(
      mealPlanItemPayloadSchema.safeParse({
        ...item,
        substitutions: [
          { index: 0, food_id: 'milch', substitute_food_id: 'haferdrink' },
          { index: 2, food_id: 'milch', substitute_food_id: 'haferdrink' },
        ],
        omitted_optional: [],
      }).success,
    ).toBe(true);
  });

  it('je Stelle höchstens eine Änderung; ohne Index oder außerhalb 0–19 abgelehnt', () => {
    if (base === undefined) return;
    const twice = {
      ...base,
      substitutions: [{ index: 2, food_id: 'milch', substitute_food_id: 'haferdrink' }],
      omitted_optional: [{ index: 2, food_id: 'milch' }],
      ingredient_swaps: [],
    };
    expect(mealPlanItemPayloadSchema.safeParse(twice).success).toBe(false);
    for (const change of [
      { food_id: 'milch', substitute_food_id: 'haferdrink' },
      { index: -1, food_id: 'milch', substitute_food_id: 'haferdrink' },
      { index: 20, food_id: 'milch', substitute_food_id: 'haferdrink' },
      { index: 1.5, food_id: 'milch', substitute_food_id: 'haferdrink' },
    ]) {
      expect(
        mealPlanItemPayloadSchema.safeParse({ ...base, substitutions: [change] }).success,
      ).toBe(false);
    }
  });

  it('jede Änderung im erzeugten Plan trägt die Stelle der Zutat', () => {
    for (const mealsPerDay of [1, 4, 8]) {
      const p = toMealPlanPayload(buildMealPlanWeek(data(mealsPerDay)), {
        diet: 'omnivore',
        meals_per_day: mealsPerDay,
        cooking_mode: 'daily',
        mealprep_days: null,
        mealprep_slots: 'lunch',
      });
      for (const item of p.items) {
        for (const c of [
          ...item.substitutions,
          ...item.omitted_optional,
          ...item.ingredient_swaps,
        ]) {
          expect(Number.isInteger(c.index)).toBe(true);
        }
      }
    }
  });
});

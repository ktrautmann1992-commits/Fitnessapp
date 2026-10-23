/**
 * Einkaufsliste (docs/PLAN-PHASE-5.md 6.5, 12.1, W22 Core): Aggregation über Einheiten, Aufrunden (nie 0), Stück vs.
 * Gramm, Vorrat getrennt, Abteilungen, Häkchen über `item_key`, eigene Einträge, Zeitraum, Ersatzprodukt statt
 * Original, Neuerzeugung („nicht mehr im Plan“).
 */
import { describe, expect, it } from 'vitest';

import { SHOPPING_CATEGORIES } from '../content/food-schema';
import { addDays } from '../dates';
import type { MealPlanWeek, PlannedMeal } from './meal-plan';
import { N3_FOODS } from './meal-plan-fixtures';
import type { ScaledIngredient } from './scale';
import {
  addManualShoppingItem,
  buildShoppingList,
  parseShoppingQuantity,
  rebuildShoppingList,
  removeManualShoppingItem,
  roundShoppingAmount,
  setShoppingItemChecked,
  type ShoppingListItem,
  uncheckAllShoppingItems,
} from './shopping-list';
import { zeroNutrients } from './recipe-nutrients';

const WEEK = '2026-10-12';

function ingredient(
  foodId: string,
  amount: number,
  unit: ScaledIngredient['unit'],
  extra: Partial<ScaledIngredient> = {},
): ScaledIngredient {
  const food = N3_FOODS.get(foodId);
  const perUnit =
    unit === 'g'
      ? 1
      : unit === 'ml'
        ? (food?.units.ml_to_g ?? 1)
        : unit === 'piece'
          ? (food?.units.piece_g ?? 1)
          : unit === 'tbsp'
            ? (food?.units.tbsp_g ?? 1)
            : unit === 'tsp'
              ? (food?.units.tsp_g ?? 1)
              : 0.5;
  return {
    index: 0,
    foodId,
    originalFoodId: null,
    amount,
    unit,
    optional: false,
    grams: amount * perUnit,
    ...extra,
  };
}

function meal(ingredients: ScaledIngredient[], extra: Partial<PlannedMeal> = {}): PlannedMeal {
  return {
    slot: 'lunch',
    role: null,
    recipeId: 'test',
    recipeVersion: 1,
    titleDe: 'Test',
    recipeStatus: 'draft',
    factor: 1,
    ingredients,
    nutrients: zeroNutrients(),
    optionalKcal: 0,
    substitutions: [],
    omittedOptional: [],
    prepKind: 'fresh',
    cookDate: WEEK,
    storage: null,
    isFill: false,
    fixed: false,
    mealPrepPlanId: null,
    ...extra,
  };
}

function week(mealsByDay: PlannedMeal[][], usesHealthData = false): MealPlanWeek {
  return {
    weekStart: WEEK,
    variant: 0,
    engineVersion: 1,
    usesHealthData,
    mealPrepPlanId: null,
    notices: [],
    days: mealsByDay.map((meals, i) => ({
      date: addDays(WEEK, i),
      mode: 'full',
      status: 'complete',
      meals: meals.map((m) => (m.prepKind === 'fresh' ? { ...m, cookDate: addDays(WEEK, i) } : m)),
      totals: zeroNutrients(),
      band: null,
      safetyKey: '',
      emptySlots: [],
      notices: [],
    })),
  };
}

describe('roundShoppingAmount', () => {
  it('Gramm/ml unter 100 auf 10, ab 100 auf 50, Stück ganz – immer aufgerundet, nie 0', () => {
    expect(roundShoppingAmount(1, 'g')).toBe(10);
    expect(roundShoppingAmount(0.2, 'ml')).toBe(10);
    expect(roundShoppingAmount(91, 'g')).toBe(100);
    expect(roundShoppingAmount(100, 'g')).toBe(100);
    expect(roundShoppingAmount(101, 'g')).toBe(150);
    expect(roundShoppingAmount(0.5, 'piece')).toBe(1);
    expect(roundShoppingAmount(2.5, 'piece')).toBe(3);
    expect(roundShoppingAmount(3, 'piece')).toBe(3);
    expect(roundShoppingAmount(0, 'g')).toBe(0);
  });
});

describe('buildShoppingList', () => {
  it('summiert über Tage und Einheiten (EL → g), Stück bleibt Stück, Prise = nach Geschmack', () => {
    const list = buildShoppingList(
      week([
        [
          meal([
            ingredient('reis', 75, 'g'),
            ingredient('olivenoel', 1, 'tbsp'),
            ingredient('salz', 1, 'pinch'),
          ]),
        ],
        [meal([ingredient('reis', 80, 'g'), ingredient('olivenoel', 5, 'g')])],
        [meal([ingredient('huehnerei', 3, 'piece'), ingredient('huehnerei', 1.5, 'piece')])],
      ]),
      N3_FOODS,
    );
    const byKey = new Map(list.items.map((i) => [i.itemKey, i]));
    expect(byKey.get('reis|g')).toMatchObject({ amount: 200, unit: 'g', isPantry: true });
    expect(byKey.get('olivenoel|g')).toMatchObject({ amount: 20, unit: 'g' });
    expect(byKey.get('huehnerei|piece')).toMatchObject({ amount: 5, unit: 'piece' });
    expect(byKey.get('salz|pinch')).toMatchObject({ amount: null, unit: null });
  });

  it('Gramm-Mengen eines Stück-Lebensmittels zählen in Stück (Eier, Paprika)', () => {
    const list = buildShoppingList(
      week([[meal([ingredient('paprika', 1, 'piece'), ingredient('paprika', 100, 'g')])]]),
      N3_FOODS,
    );
    expect(list.items.map((i) => [i.itemKey, i.amount])).toEqual([['paprika|piece', 2]]);
  });

  it('nach Abteilung (feste Reihenfolge) und Name sortiert, Vorrat am Ende', () => {
    const list = buildShoppingList(
      week([
        [
          meal([
            ingredient('reis', 75, 'g'),
            ingredient('tofu', 200, 'g'),
            ingredient('banane', 1, 'piece'),
            ingredient('lachs', 150, 'g'),
            ingredient('paprika', 1, 'piece'),
          ]),
        ],
      ]),
      N3_FOODS,
    );
    const nonPantry = list.items.filter((i) => !i.isPantry);
    const ranks = nonPantry.map((i) => SHOPPING_CATEGORIES.indexOf(i.category));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(nonPantry.map((i) => i.labelDe).slice(0, 2)).toEqual(['Banane', 'Paprika rot']);
    expect(list.items.at(-1)).toMatchObject({ itemKey: 'reis|g', isPantry: true });
  });

  it('Ersatzprodukt statt Original (S4), ohne Grund', () => {
    const list = buildShoppingList(
      week([[meal([ingredient('haferdrink', 250, 'ml', { originalFoodId: 'vollmilch' })])]]),
      N3_FOODS,
    );
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({
      itemKey: 'haferdrink|ml',
      labelDe: 'Haferdrink',
      substituteFor: ['vollmilch'],
    });
  });

  it('Zeitraum: Meal-Prep wird zum Kochtag gekauft, Sonntag davor zählt zur Woche', () => {
    const cooked = meal([ingredient('reis', 75, 'g')], {
      prepKind: 'leftover',
      cookDate: '2026-10-11',
      storage: 'fridge',
    });
    const plan = week([[cooked], [cooked], [], [meal([ingredient('tofu', 100, 'g')])]]);
    expect(
      buildShoppingList(plan, N3_FOODS)
        .items.map((i) => i.itemKey)
        .sort(),
    ).toEqual(['reis|g', 'tofu|g']);
    const firstDays = buildShoppingList(plan, N3_FOODS, { from: WEEK, to: '2026-10-13' });
    expect(firstDays.items.map((i) => [i.itemKey, i.amount])).toEqual([['reis|g', 150]]);
    const later = buildShoppingList(plan, N3_FOODS, { from: '2026-10-13', to: '2026-10-18' });
    expect(later.items.map((i) => i.itemKey)).toEqual(['tofu|g']);
    expect(() =>
      buildShoppingList(plan, N3_FOODS, { from: '2026-10-14', to: '2026-10-13' }),
    ).toThrow();
  });

  it('leerer Plan → leere Liste; Gesundheitsbezug wie der Plan', () => {
    expect(buildShoppingList(week([[]], true), N3_FOODS)).toMatchObject({
      items: [],
      usesHealthData: true,
    });
  });
});

describe('Häkchen, eigene Einträge, Neuerzeugung (R2-S4, W22 Core)', () => {
  const first = week([
    [
      meal([
        ingredient('reis', 75, 'g'),
        ingredient('raeucherlachs', 40, 'g'),
        ingredient('banane', 1, 'piece'),
      ]),
    ],
  ]);

  it('Häkchen setzen, eigener Eintrag ≤ 80 Zeichen, kein Doppel, löschen', () => {
    let list = buildShoppingList(first, N3_FOODS);
    list = setShoppingItemChecked(list, 'reis|g', true);
    expect(list.items.find((i) => i.itemKey === 'reis|g')?.checked).toBe(true);
    list = addManualShoppingItem(list, { labelDe: 'Kaffee', category: 'drinks' });
    list = addManualShoppingItem(list, { labelDe: 'Kaffee' });
    expect(list.items.filter((i) => i.isManual)).toHaveLength(1);
    expect(() => addManualShoppingItem(list, { labelDe: 'x'.repeat(81) })).toThrow();
    expect(() => addManualShoppingItem(list, { labelDe: '   ' })).toThrow();
    expect(removeManualShoppingItem(list, 'manual|kaffee').items.some((i) => i.isManual)).toBe(
      false,
    );
  });

  it('Neuerzeugung: Häkchen über item_key, Menge geändert markiert, abgehakt-weggefallen bleibt, offen-weggefallen weg, eigene bleiben', () => {
    let list = buildShoppingList(first, N3_FOODS);
    list = setShoppingItemChecked(list, 'reis|g', true);
    list = setShoppingItemChecked(list, 'raeucherlachs|g', true);
    list = addManualShoppingItem(list, { labelDe: 'Kaffee', category: 'drinks' });
    // Neuplanung (z. B. Schwangerschaft): Räucherlachs und Banane fallen weg, mehr Reis, neu Tofu.
    const next = week([[meal([ingredient('reis', 150, 'g'), ingredient('tofu', 200, 'g')])]]);
    const rebuilt = rebuildShoppingList(list, next, N3_FOODS);
    const byKey = new Map(rebuilt.items.map((i) => [i.itemKey, i]));
    expect(byKey.get('reis|g')).toMatchObject({ checked: true, amountChanged: true, amount: 150 });
    expect(byKey.get('tofu|g')).toMatchObject({ checked: false, amountChanged: false });
    expect(byKey.get('raeucherlachs|g')).toMatchObject({ checked: true, notInPlan: true });
    expect(byKey.has('banane|piece')).toBe(false);
    expect(byKey.get('manual|kaffee')).toMatchObject({ isManual: true, labelDe: 'Kaffee' });
  });
});

describe('Reiter „Einkaufen“ (20.10.2026): Menge eigener Einträge, abgehakt hinzufügen, alle Haken zurücksetzen', () => {
  const plan = week([[meal([ingredient('reis', 75, 'g'), ingredient('banane', 1, 'piece')])]]);

  it('parseShoppingQuantity: g/kg/ml/l/Stück, Komma, leer; ungültig bei Unsinn, 0, Bruchstück, zu groß, zu lang', () => {
    expect(parseShoppingQuantity('500 g')).toEqual({ ok: true, amount: 500, unit: 'g' });
    expect(parseShoppingQuantity('1,5 kg')).toEqual({ ok: true, amount: 1500, unit: 'g' });
    expect(parseShoppingQuantity('250ml')).toEqual({ ok: true, amount: 250, unit: 'ml' });
    expect(parseShoppingQuantity('1 L')).toEqual({ ok: true, amount: 1000, unit: 'ml' });
    expect(parseShoppingQuantity('3')).toEqual({ ok: true, amount: 3, unit: 'piece' });
    expect(parseShoppingQuantity('3 Stück')).toEqual({ ok: true, amount: 3, unit: 'piece' });
    expect(parseShoppingQuantity('2 Stk.')).toEqual({ ok: true, amount: 2, unit: 'piece' });
    expect(parseShoppingQuantity('0,25 l')).toEqual({ ok: true, amount: 250, unit: 'ml' });
    expect(parseShoppingQuantity('  ')).toEqual({ ok: true, amount: null, unit: null });
    for (const bad of [
      'viel',
      '0',
      '0 g',
      '1,5',
      '1,5 Stück',
      '2 Packungen',
      '1.000 g',
      '1001 kg',
      '-1 g',
      '1'.repeat(40),
      42,
      null,
    ]) {
      expect(parseShoppingQuantity(bad), String(bad)).toEqual({ ok: false });
    }
    expect(parseShoppingQuantity('1000 kg')).toEqual({ ok: true, amount: 1_000_000, unit: 'g' });
  });

  it('eigener Eintrag mit Menge; Menge ohne Einheit bzw. 0 abgelehnt', () => {
    let list = buildShoppingList(plan, N3_FOODS);
    list = addManualShoppingItem(list, { labelDe: 'Joghurt', amount: 500, unit: 'g' });
    expect(list.items.find((i) => i.itemKey === 'manual|joghurt')).toMatchObject({
      amount: 500,
      unit: 'g',
      checked: false,
    });
    expect(() => addManualShoppingItem(list, { labelDe: 'Quark', amount: 5 })).toThrow();
    expect(() => addManualShoppingItem(list, { labelDe: 'Quark', amount: 0, unit: 'g' })).toThrow();
  });

  it('abgehakt hinzufügen (Scan); gleicher Text vorhanden → der vorhandene wird abgehakt', () => {
    let list = buildShoppingList(plan, N3_FOODS);
    list = addManualShoppingItem(list, { labelDe: 'Müsli', checked: true });
    expect(list.items.find((i) => i.itemKey === 'manual|müsli')?.checked).toBe(true);
    list = addManualShoppingItem(list, { labelDe: 'Kaffee' });
    list = addManualShoppingItem(list, { labelDe: 'kaffee', checked: true });
    expect(list.items.filter((i) => i.isManual)).toHaveLength(2);
    expect(list.items.find((i) => i.itemKey === 'manual|kaffee')).toMatchObject({
      checked: true,
      labelDe: 'Kaffee',
    });
  });

  it('höchstens 100 eigene Einträge – auch beim Scan', () => {
    let list = buildShoppingList(plan, N3_FOODS);
    for (let i = 0; i < 100; i += 1) list = addManualShoppingItem(list, { labelDe: `E${i}` });
    expect(() => addManualShoppingItem(list, { labelDe: 'Neu', checked: true })).toThrow(
      'Höchstens 100',
    );
  });

  it('uncheckAllShoppingItems: alles offen, „nicht mehr im Plan“ fällt weg, eigene bleiben; leere Liste', () => {
    let list = buildShoppingList(plan, N3_FOODS);
    list = setShoppingItemChecked(list, 'reis|g', true);
    list = addManualShoppingItem(list, { labelDe: 'Kaffee', checked: true });
    const stale: ShoppingListItem = {
      ...(list.items[0] as ShoppingListItem),
      itemKey: 'lachs|g',
      foodId: 'lachs',
      labelDe: 'Lachs',
      checked: true,
      notInPlan: true,
    };
    list = { ...list, items: [...list.items, stale] };
    const reset = uncheckAllShoppingItems(list);
    expect(reset.items.every((i) => !i.checked)).toBe(true);
    expect(reset.items.some((i) => i.itemKey === 'lachs|g')).toBe(false);
    expect(reset.items.some((i) => i.itemKey === 'manual|kaffee')).toBe(true);
    expect(uncheckAllShoppingItems({ ...list, items: [] }).items).toEqual([]);
  });
});

describe('Gleiches Produkt im Laden (SHOPPING_SAME_PRODUCT)', () => {
  const base = [...N3_FOODS.values()][0]!;
  const as = (id: string, name: string) => ({
    ...base,
    id,
    name_de: name,
    units: {},
    pantry: false,
  });
  const foods = new Map(
    [as('karotte', 'Karotte'), as('karotten', 'Karotten'), as('moehre', 'Möhre')].map((f) => [
      f.id,
      f,
    ]),
  );
  const g = (foodId: string, grams: number): ScaledIngredient => ({
    index: 0,
    foodId,
    originalFoodId: null,
    amount: grams,
    unit: 'g',
    optional: false,
    grams,
  });

  it('Karotte, Karotten und Möhre stehen als EIN Eintrag mit Summe', () => {
    const list = buildShoppingList(
      week([[meal([g('karotte', 100), g('moehre', 300)])], [meal([g('karotten', 350)])]]),
      foods,
    );
    expect(list.items.map((i) => [i.itemKey, i.labelDe, i.amount])).toEqual([
      ['karotten|g', 'Karotten', 750],
    ]);
  });

  it('fehlt das Ziel im Katalog, bleibt der eigene Eintrag', () => {
    const only = new Map([['moehre', as('moehre', 'Möhre')]]);
    const list = buildShoppingList(week([[meal([g('moehre', 120)])]]), only);
    expect(list.items.map((i) => i.itemKey)).toEqual(['moehre|g']);
  });
});

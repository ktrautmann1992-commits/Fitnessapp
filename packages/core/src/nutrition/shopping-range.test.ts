/**
 * Einkaufsliste: Standard-Zeitraum „3 Tage | Ganze Woche“ und Abteilungen zum Auf- und Zuklappen
 * (docs/PLAN-EINKAUFEN-AUSDAUER.md 3, Gründer-Entscheidung 23.10.2026 „Beides“). Grenzfälle: Montag, Samstag (nur noch
 * 2 Tage), Sonntag (1 Tag), Sonntag davor, nächste und vergangene Woche, alte Wochenliste mit Häkchen, selbst
 * gewählter Zeitraum, 1 vs. 8 Mahlzeiten.
 */
import { describe, expect, it } from 'vitest';

import { SHOPPING_DEFAULT_DAYS } from '../constants';
import { addDays, daysBetween } from '../dates';
import { buildMealPlanWeek, type MealPlanInput } from './meal-plan';
import { N3_FOODS, N3_RECIPES } from './meal-plan-fixtures';
import type { MealPlanProfileInput, NutritionInputsInput } from './schemas';
import {
  buildShoppingList,
  setShoppingItemChecked,
  shoppingDepartments,
  type ShoppingListItem,
} from './shopping-list';
import {
  newShoppingList,
  resolveShoppingList,
  shoppingDefaultRange,
  shoppingListRangeValid,
  shoppingListTargetRange,
  shoppingRangeIsAutomatic,
  type StoredShoppingList,
  withShoppingListRange,
} from './shopping-list-store';
import { nutritionTargetsForWeek } from './targets';
import { inputs, MONDAY } from './test-helpers';

const SUNDAY_BEFORE = '2026-10-11';
const TUESDAY = '2026-10-13';
const WEDNESDAY = '2026-10-14';
const THURSDAY = '2026-10-15';
const SATURDAY = '2026-10-17';
const SUNDAY = '2026-10-18';
const NEXT_MONDAY = '2026-10-19';
const omni: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };
const female = { sex: 'female' as const, healthFlags: { flags: [] } };

type PlanInput = Omit<MealPlanInput, 'existingPlan' | 'variant'>;

function input(overrides: Partial<NutritionInputsInput> = {}, today = SUNDAY_BEFORE): PlanInput {
  return {
    targets: nutritionTargetsForWeek(inputs({ today, mealsPerDay: 4, ...overrides }), MONDAY),
    profile: omni,
    recipes: N3_RECIPES,
    foods: N3_FOODS,
    allowDrafts: true,
    today,
  };
}

const byKey = (list: { items: readonly ShoppingListItem[] }, key: string) =>
  list.items.find((i) => i.itemKey === key);

function tickAll(list: StoredShoppingList): StoredShoppingList {
  return list.items.reduce((acc, item) => setShoppingItemChecked(acc, item.itemKey, true), list);
}

describe('shoppingDefaultRange (3 Tage = heute + 2, innerhalb der Woche)', () => {
  it('Konstante: 3 Tage', () => {
    expect(SHOPPING_DEFAULT_DAYS).toBe(3);
  });

  it('Montag: Mo–Mi; Ganze Woche: Mo–So', () => {
    expect(shoppingDefaultRange(MONDAY, MONDAY, 'days')).toEqual({ from: MONDAY, to: WEDNESDAY });
    expect(shoppingDefaultRange(MONDAY, MONDAY, 'week')).toEqual({ from: MONDAY, to: SUNDAY });
  });

  it('Mittwoch: Mi–Fr; Ganze Woche ab heute bis Sonntag', () => {
    expect(shoppingDefaultRange(MONDAY, WEDNESDAY, 'days')).toEqual({
      from: WEDNESDAY,
      to: addDays(WEDNESDAY, 2),
    });
    expect(shoppingDefaultRange(MONDAY, WEDNESDAY, 'week')).toEqual({
      from: WEDNESDAY,
      to: SUNDAY,
    });
  });

  it('Samstag: nur noch 2 Tage (Sa–So); Sonntag: nur Sonntag – nie über die Woche hinaus', () => {
    expect(shoppingDefaultRange(MONDAY, SATURDAY, 'days')).toEqual({ from: SATURDAY, to: SUNDAY });
    expect(shoppingDefaultRange(MONDAY, SUNDAY, 'days')).toEqual({ from: SUNDAY, to: SUNDAY });
    expect(shoppingDefaultRange(MONDAY, SUNDAY, 'week')).toEqual({ from: SUNDAY, to: SUNDAY });
  });

  it('Sonntag davor (zählt für Montag, 6.5) und nächste Woche: die ersten 3 Tage der Woche', () => {
    expect(shoppingDefaultRange(MONDAY, SUNDAY_BEFORE, 'days')).toEqual({
      from: MONDAY,
      to: WEDNESDAY,
    });
    expect(shoppingDefaultRange(NEXT_MONDAY, WEDNESDAY, 'days')).toEqual({
      from: NEXT_MONDAY,
      to: addDays(NEXT_MONDAY, 2),
    });
    expect(shoppingDefaultRange(NEXT_MONDAY, WEDNESDAY, 'week')).toEqual({
      from: NEXT_MONDAY,
      to: addDays(NEXT_MONDAY, 6),
    });
  });

  it('vergangene Woche: die ersten 3 Tage bzw. die ganze Woche', () => {
    expect(shoppingDefaultRange(MONDAY, '2026-10-25', 'days')).toEqual({
      from: MONDAY,
      to: WEDNESDAY,
    });
    expect(shoppingDefaultRange(MONDAY, '2026-10-25', 'week')).toEqual({
      from: MONDAY,
      to: SUNDAY,
    });
  });

  it('jeder Tag von Sonntag davor bis nach der Woche: immer gültig, höchstens 3 Tage, mindestens 1', () => {
    for (let offset = -1; offset <= 8; offset += 1) {
      const today = addDays(MONDAY, offset);
      for (const mode of ['days', 'week'] as const) {
        const range = shoppingDefaultRange(MONDAY, today, mode);
        expect(shoppingListRangeValid(MONDAY, range)).toBe(true);
        expect(shoppingRangeIsAutomatic(MONDAY, range)).toBe(true);
        const days = daysBetween(range.from, range.to) + 1;
        expect(days).toBeGreaterThanOrEqual(1);
        if (mode === 'days') expect(days).toBeLessThanOrEqual(SHOPPING_DEFAULT_DAYS);
      }
    }
  });

  it('ungültige Eingaben werfen (Zod)', () => {
    expect(() => shoppingDefaultRange(TUESDAY, MONDAY, 'days')).toThrow();
    expect(() => shoppingDefaultRange(MONDAY, 'x', 'days')).toThrow();
  });
});

describe('shoppingRangeIsAutomatic / shoppingListTargetRange', () => {
  it('alter Standard (ganze Woche, auch ab einer Neuplanung) und 3-Tage-Zeiträume sehen automatisch aus', () => {
    expect(shoppingRangeIsAutomatic(MONDAY, { from: MONDAY, to: SUNDAY })).toBe(true);
    expect(shoppingRangeIsAutomatic(MONDAY, { from: THURSDAY, to: SUNDAY })).toBe(true);
    expect(shoppingRangeIsAutomatic(MONDAY, { from: TUESDAY, to: THURSDAY })).toBe(true);
    // Selbst gewählt: Mo–Do, nur Dienstag.
    expect(shoppingRangeIsAutomatic(MONDAY, { from: MONDAY, to: THURSDAY })).toBe(false);
    expect(shoppingRangeIsAutomatic(MONDAY, { from: TUESDAY, to: TUESDAY })).toBe(false);
    // Außerhalb der Woche nie.
    expect(shoppingRangeIsAutomatic(MONDAY, { from: SUNDAY_BEFORE, to: SUNDAY })).toBe(false);
  });

  it('keine Liste → automatischer Zeitraum; selbst gewählt bzw. „manual“ → null (bleibt)', () => {
    const base = { weekStart: MONDAY, today: TUESDAY, mode: 'days' as const, manual: false };
    expect(shoppingListTargetRange(null, base)).toEqual({ from: TUESDAY, to: THURSDAY });
    const oldDefault = { weekStart: MONDAY, from: MONDAY, to: SUNDAY };
    expect(shoppingListTargetRange(oldDefault, base)).toEqual({ from: TUESDAY, to: THURSDAY });
    expect(shoppingListTargetRange(oldDefault, { ...base, mode: 'week' })).toEqual({
      from: TUESDAY,
      to: SUNDAY,
    });
    expect(shoppingListTargetRange(oldDefault, { ...base, manual: true })).toBeNull();
    expect(
      shoppingListTargetRange({ weekStart: MONDAY, from: MONDAY, to: THURSDAY }, base),
    ).toBeNull();
    // Liste einer anderen Woche zählt nicht.
    expect(
      shoppingListTargetRange(
        { weekStart: NEXT_MONDAY, from: NEXT_MONDAY, to: addDays(NEXT_MONDAY, 3) },
        base,
      ),
    ).toEqual({ from: TUESDAY, to: THURSDAY });
  });
});

describe('resolveShoppingList mit automatischem Zeitraum', () => {
  it('neue Liste: nur die 3 Tage; weniger oder gleich viele Einträge als die Woche (1 und 8 Mahlzeiten)', () => {
    for (const mealsPerDay of [1, 8]) {
      const data = input({ ...female, mealsPerDay }, MONDAY);
      const plan = buildMealPlanWeek(data);
      const range = shoppingDefaultRange(MONDAY, MONDAY, 'days');
      const result = resolveShoppingList(null, plan, data, { range });
      expect(result.action).toBe('new');
      expect(result.list.from).toBe(MONDAY);
      expect(result.list.to).toBe(WEDNESDAY);
      expect(result.list.items).toEqual(buildShoppingList(plan, N3_FOODS, range).items);
      const week = newShoppingList(plan, data);
      expect(result.list.items.length).toBeLessThanOrEqual(week.items.length);
    }
  });

  it('alte Wochenliste (nie selbst gewählt) → auf 3 Tage umgestellt, Häkchen bleiben; Rückweg zur Woche', () => {
    const data = input(female, MONDAY);
    const plan = buildMealPlanWeek(data);
    const old = tickAll(newShoppingList(plan, data));
    const range = shoppingListTargetRange(old, {
      weekStart: MONDAY,
      today: MONDAY,
      mode: 'days',
      manual: false,
    });
    const result = resolveShoppingList(old, plan, data, { range });
    expect(result.action).toBe('rebuilt');
    if (result.action !== 'rebuilt') throw new Error('rebuilt erwartet');
    expect(result.planChanged).toBe(false);
    expect(result.list.from).toBe(MONDAY);
    expect(result.list.to).toBe(WEDNESDAY);
    // Häkchen über item_key; nichts „nicht mehr im Plan“ (nur der Zeitraum ist kürzer).
    for (const item of result.list.items) {
      expect(item.checked).toBe(byKey(old, item.itemKey)?.checked ?? false);
      expect(item.notInPlan).toBe(false);
    }
    // Danach unverändert: kein erneutes Speichern.
    expect(resolveShoppingList(result.list, plan, data, { range }).action).toBe('stored');
  });

  it('gleicher Zeitraum → „stored“; nächster Tag → Fenster wandert mit, eigene Einträge bleiben', () => {
    const data = input(female, MONDAY);
    const plan = buildMealPlanWeek(data);
    const range = shoppingDefaultRange(MONDAY, MONDAY, 'days');
    const list = newShoppingList(plan, data, range);
    expect(resolveShoppingList(list, plan, data, { range }).action).toBe('stored');
    const withManual = {
      ...list,
      items: [
        ...list.items,
        {
          itemKey: 'manual|kaffee',
          foodId: null,
          labelDe: 'Kaffee',
          amount: null,
          unit: null,
          category: 'other' as const,
          isPantry: false,
          isManual: true,
          checked: false,
          substituteFor: [],
          amountChanged: false,
          notInPlan: false,
        },
      ],
    };
    const tuesday = input(female, TUESDAY);
    const next = resolveShoppingList(withManual, plan, tuesday, {
      range: shoppingDefaultRange(MONDAY, TUESDAY, 'days'),
    });
    expect(next.list.from).toBe(TUESDAY);
    expect(next.list.to).toBe(THURSDAY);
    expect(byKey(next.list, 'manual|kaffee')?.labelDe).toBe('Kaffee');
  });

  it('selbst gewählter Zeitraum bleibt (ohne Zeitraum-Vorgabe)', () => {
    const data = input(female, MONDAY);
    const plan = buildMealPlanWeek(data);
    const custom = withShoppingListRange(
      newShoppingList(plan, data),
      { from: MONDAY, to: THURSDAY },
      plan,
      data,
    );
    const range = shoppingListTargetRange(custom, {
      weekStart: MONDAY,
      today: MONDAY,
      mode: 'days',
      manual: false,
    });
    expect(range).toBeNull();
    const result = resolveShoppingList(custom, plan, data, { range });
    expect(result.action).toBe('stored');
    expect(result.list.to).toBe(THURSDAY);
  });

  it('ungültiger Zeitraum wird ignoriert (gespeicherter bleibt)', () => {
    const data = input(female, MONDAY);
    const plan = buildMealPlanWeek(data);
    const list = newShoppingList(plan, data);
    const result = resolveShoppingList(list, plan, data, {
      range: { from: SUNDAY_BEFORE, to: SUNDAY },
    });
    expect(result.action).toBe('stored');
  });
});

describe('shoppingDepartments (Abteilungen auf- und zuklappen)', () => {
  it('Reihenfolge des Ladens, ohne Vorrat, offene/abgehakte zählen, alles abgehakt → done', () => {
    const data = input(female, MONDAY);
    const plan = buildMealPlanWeek(data);
    const list = newShoppingList(plan, data);
    const departments = shoppingDepartments(list.items);
    expect(departments.length).toBeGreaterThan(0);
    expect(departments.every((d) => d.items.every((i) => !i.isPantry))).toBe(true);
    expect(departments.every((d) => d.open === d.items.length && !d.done)).toBe(true);
    const first = departments[0];
    if (first === undefined) throw new Error('Abteilung erwartet');
    const ticked = first.items.reduce(
      (acc, item) => setShoppingItemChecked(acc, item.itemKey, true),
      list,
    );
    const after = shoppingDepartments(ticked.items).find((d) => d.category === first.category);
    expect(after?.done).toBe(true);
    expect(after?.open).toBe(0);
    expect(after?.checked).toBe(first.items.length);
  });

  it('abgehakte Einträge wandern ans Ende ihrer Abteilung', () => {
    const data = input(female, MONDAY);
    const list = newShoppingList(buildMealPlanWeek(data), data);
    const dept = shoppingDepartments(list.items).find((d) => d.items.length >= 2);
    if (dept === undefined) throw new Error('Abteilung mit 2 Einträgen erwartet');
    const firstKey = (dept.items[0] as { itemKey: string }).itemKey;
    const ticked = setShoppingItemChecked(list, firstKey, true);
    const after = shoppingDepartments(ticked.items).find((d) => d.category === dept.category);
    expect(after?.items.at(-1)?.itemKey).toBe(firstKey);
    expect(after?.items[0]?.checked).toBe(false);
  });

  it('leere Liste → keine Abteilungen', () => {
    expect(shoppingDepartments([])).toEqual([]);
  });
});

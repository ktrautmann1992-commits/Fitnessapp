/**
 * Etappe E2 – Eigene Gerichte in der App (Testmodus; docs/PLAN-AUSWERTUNG.md Abschnitt 7, 2.7): Speichern im
 * Gerätespeicher mit denselben Regeln wie save_custom_meal (Einwilligung, Form, 100 Gerichte), Löschen ohne
 * Einwilligung (Tagebuch behält die Werte, Verweis wird leer), Tagebuch-Einträge mit festem Titel und Verweis, Widerruf
 * löscht die Gerichte (sichere Voreinstellung E2), Export, „neu laden → alles da“ (offline), ungültiger Gerätespeicher.
 * Die Regeln selbst testet packages/core (custom-meal.test.ts).
 */
import {
  buildCustomMeal,
  CUSTOM_MEAL_ENTRY_TITLE,
  type CustomMeal,
  entryFromCustomMeal,
  type FoodLogBuild,
  type FoodLogEntry,
  foodLogDisplayTitle,
  zeroNutrients,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { errorText } from '@/lib/error-text';

import { localBackendOn, planPersonRows, seededBackend, TODAY, USER_ID } from '../test/fixtures';
import { BackendError } from './backend';
import { customMealFromRows, customMealsFromRows } from './custom-meal-rows';
import { localDataExport } from './data-export';
import { upgradeStoredRows } from './legacy-rows';
import type { UserRows } from './types';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const FOODS = new Map(
  [
    {
      id: 'haferflocken',
      name_de: 'Haferflocken',
      units: {},
      nutrients_per_100g: {
        ...zeroNutrients(),
        kcal: 370,
        protein_g: 13.5,
        carbs_g: 58.7,
        fat_g: 7,
      },
    },
    {
      id: 'banane',
      name_de: 'Banane',
      units: { piece_g: 120 },
      nutrients_per_100g: { ...zeroNutrients(), kcal: 93, protein_g: 1.2, carbs_g: 20, fat_g: 0.2 },
    },
  ].map((f) => [
    f.id,
    // Nur die Felder, die die Rezept-Rechnung liest (Gruppen, Tierart, Haltbarkeit …).
    {
      ...f,
      groups: [],
      animal: [],
      meat_kind: [],
      alcohol: false,
      pregnancy_caution: false,
      max_fridge_days: 2,
    } as never,
  ]),
);
const NAME = 'Mein geheimes Porridge';

function meal(n = 1, kcal: number | null = 450, name = 'Shake'): CustomMeal {
  const build = buildCustomMeal(
    {
      id: ID(n),
      name,
      mode: 'direct',
      values: kcal === null ? null : { kcal, protein_g: 30, carbs_g: 50, fat_g: 12.5 },
    },
    FOODS,
  );
  if (!build.ok) throw new Error(build.reason);
  return build.meal;
}

function porridge(n = 2): CustomMeal {
  const build = buildCustomMeal(
    {
      id: ID(n),
      name: NAME,
      mode: 'ingredients',
      servings: 2,
      items: [
        { food_id: 'haferflocken', amount: 120, unit: 'g' },
        { food_id: 'banane', amount: 2, unit: 'piece' },
      ],
    },
    FOODS,
  );
  if (!build.ok) throw new Error(build.reason);
  return build.meal;
}

function ok(build: FoodLogBuild): FoodLogEntry {
  if (!build.ok) throw new Error(build.reason);
  return build.entry;
}

function rows(consent: 'valid' | 'none' = 'valid'): UserRows {
  return planPersonRows({ consent });
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(BackendError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('Eigene Gerichte im Testmodus (E2)', () => {
  it('ohne Einwilligung health_data kein Anlegen (Name = Freitext, sichere Voreinstellung)', async () => {
    const { backend } = seededBackend(rows('none'));
    await expectCode(backend.saveCustomMeal(meal(), rows('none')), 'consent_required');
  });

  it('anlegen, ändern (revision + 1, Zutaten ersetzt), neu laden → alles da (offline)', async () => {
    const { backend, store } = seededBackend(rows());
    let next = await backend.saveCustomMeal(porridge(), rows());
    expect(next.customMeals).toHaveLength(1);
    expect(next.customMeals[0]).toMatchObject({
      id: ID(2),
      user_id: USER_ID,
      name_de: NAME,
      mode: 'ingredients',
      servings: 2,
      revision: 1,
    });
    expect(next.customMealItems.map((i) => [i.order_no, i.food_id])).toEqual([
      [1, 'haferflocken'],
      [2, 'banane'],
    ]);
    const changed = { ...porridge(), items: [porridge().items[1]!], name_de: 'Porridge klein' };
    next = await backend.saveCustomMeal(changed, next);
    expect(next.customMeals[0]).toMatchObject({ revision: 2, name_de: 'Porridge klein' });
    expect(next.customMealItems).toHaveLength(1);
    const reopened = localBackendOn(store, TODAY, '2026-10-03T12:00:00.000Z');
    const loaded = (await reopened.loadRows()).rows;
    expect(customMealsFromRows(loaded)).toEqual([customMealFromRows(next, ID(2))]);
  });

  it('ungültige Angaben abgelehnt – Meldung ohne Namen und ohne Werte', async () => {
    const { backend } = seededBackend(rows());
    const invalid = { ...meal(), name_de: `${NAME} ${'x'.repeat(60)}` };
    const promise = backend.saveCustomMeal(invalid, rows());
    await expectCode(promise, 'custom_meal_rejected');
    const error = await promise.catch((e: unknown) => e);
    expect(errorText(error)).not.toContain(NAME);
    expect(String((error as Error).message)).not.toContain(NAME);
    await expectCode(
      backend.saveCustomMeal({ ...meal(), kcal: 3001 } as CustomMeal, rows()),
      'custom_meal_rejected',
    );
  });

  it('höchstens 100 Gerichte; Ändern geht auch bei 100', async () => {
    const { backend } = seededBackend(rows());
    let next = rows();
    for (let n = 1; n <= 100; n += 1) next = await backend.saveCustomMeal(meal(n), next);
    expect(next.customMeals).toHaveLength(100);
    await expectCode(backend.saveCustomMeal(meal(101), next), 'custom_meal_limit');
    next = await backend.saveCustomMeal(meal(5, 500, 'Geändert'), next);
    expect(next.customMeals.find((m) => m.id === ID(5))).toMatchObject({ name_de: 'Geändert' });
  });

  it('Eintrag aus dem Gericht: fester Titel, Verweis, Schnappschuss; Anzeige mit Namen', async () => {
    const { backend } = seededBackend(rows());
    let next = await backend.saveCustomMeal(meal(1), rows());
    const entry = ok(entryFromCustomMeal(meal(1), 0.5, { id: ID(50), date: TODAY, slot: 'other' }));
    next = await backend.saveFoodLogEntries([entry], next);
    const row = next.foodLogEntries[0]!;
    expect(row).toMatchObject({
      source: 'custom_meal',
      title_de: CUSTOM_MEAL_ENTRY_TITLE,
      custom_meal_id: ID(1),
      kcal: 225,
    });
    expect(JSON.stringify(row)).not.toContain('Shake');
    expect(foodLogDisplayTitle(row, next.customMeals)).toBe('Shake');
    // Gericht ändern: der Eintrag behält seine Werte.
    next = await backend.saveCustomMeal({ ...meal(1, 900) }, next);
    expect(next.foodLogEntries[0]?.kcal).toBe(225);
  });

  it('Verweis auf ein nicht vorhandenes Gericht wird leer gespeichert (wie der Server)', async () => {
    const { backend } = seededBackend(rows());
    const entry = ok(entryFromCustomMeal(meal(9), 1, { id: ID(51), date: TODAY, slot: 'other' }));
    const next = await backend.saveFoodLogEntries([entry], rows());
    expect(next.foodLogEntries[0]).toMatchObject({ custom_meal_id: null, kcal: 450 });
  });

  it('Löschen geht ohne Einwilligung; Tagebuch behält Werte und neutralen Titel, Zutaten weg', async () => {
    const { backend } = seededBackend(rows());
    let next = await backend.saveCustomMeal(porridge(), rows());
    const entry = ok(
      entryFromCustomMeal(porridge(), 1, { id: ID(52), date: TODAY, slot: 'other' }),
    );
    next = await backend.saveFoodLogEntries([entry], next);
    const without = { ...next, consents: rows('none').consents };
    next = await backend.deleteCustomMeal(ID(2), without);
    expect(next.customMeals).toEqual([]);
    expect(next.customMealItems).toEqual([]);
    expect(next.foodLogEntries[0]).toMatchObject({ custom_meal_id: null, kcal: entry.kcal });
    expect(foodLogDisplayTitle(next.foodLogEntries[0]!, next.customMeals)).toBe(
      CUSTOM_MEAL_ENTRY_TITLE,
    );
  });

  it('Widerruf health_data löscht Gerichte und Zutaten (sichere Voreinstellung E2)', async () => {
    const { backend } = seededBackend(rows());
    let next = await backend.saveCustomMeal(porridge(), rows());
    next = await backend.saveCustomMeal(meal(1), next);
    await backend.revokeConsent('health_data');
    const after = (await backend.loadRows()).rows;
    expect(after.customMeals).toEqual([]);
    expect(after.customMealItems).toEqual([]);
    expect(after.foodLogEntries).toEqual([]);
    expect(next.customMeals).toHaveLength(2);
  });

  it('Export enthält Gerichte und Zutaten in Spalten wie die Datenbank', async () => {
    const { backend } = seededBackend(rows());
    const next = await backend.saveCustomMeal(porridge(), rows());
    const file = localDataExport(next, USER_ID, '2026-10-03T12:00:00Z');
    expect(Object.keys(file.data.custom_meals[0] as object).sort()).toEqual(
      [
        'carbs_g',
        'created_at',
        'fat_g',
        'id',
        'kcal',
        'last_write_id',
        'mode',
        'name_de',
        'protein_g',
        'revision',
        'servings',
        'updated_at',
        'user_id',
      ].sort(),
    );
    expect(Object.keys(file.data.custom_meal_items[0] as object).sort()).toEqual(
      ['amount', 'food_id', 'meal_id', 'order_no', 'unit', 'user_id'].sort(),
    );
    expect(file.data.custom_meal_items).toHaveLength(2);
  });

  it('Gerätespeicher ist nicht vertrauenswürdig: ungültige, fremde oder verwaiste Zeilen fallen weg', () => {
    const base = porridge();
    const { items, ...fields } = base;
    const good = {
      ...fields,
      user_id: USER_ID,
      revision: 1,
      last_write_id: 'w',
      created_at: 'a',
      updated_at: 'a',
    };
    const itemRows = items.map((i, index) => ({
      ...i,
      meal_id: base.id,
      user_id: USER_ID,
      order_no: index + 1,
    }));
    const entry = {
      ...ok(entryFromCustomMeal(base, 1, { id: ID(60), date: TODAY, slot: 'other' })),
      user_id: USER_ID,
      revision: 1,
      last_write_id: 'w',
      created_at: 'a',
      updated_at: 'a',
    };
    const orphan = { ...entry, id: ID(61), custom_meal_id: ID(77) };
    // Eintrag aus E1 ohne Feld custom_meal_id (älterer Gerätespeicher).
    const legacy: Record<string, unknown> = {
      ...ok(entryFromCustomMeal(base, 1, { id: ID(62), date: TODAY, slot: 'other' })),
      source: 'quick',
      title_de: 'Snack',
      portion: null,
      user_id: USER_ID,
      revision: 1,
      last_write_id: 'w',
      created_at: 'a',
      updated_at: 'a',
    };
    delete legacy.custom_meal_id;
    const stored = {
      ...rows(),
      customMeals: [
        good,
        // Gültiges direktes Gericht, aber eines anderen Kontos.
        {
          ...meal(3),
          items: undefined,
          user_id: 'fremd',
          revision: 1,
          last_write_id: 'w',
          created_at: 'a',
          updated_at: 'a',
        },
        { ...good, id: ID(4), name_de: 'Zeile\nZwei' },
        { ...good, id: ID(5), mode: 'direct' },
        'kaputt',
      ],
      customMealItems: [...itemRows, { ...itemRows[0], meal_id: ID(99) }],
      foodLogEntries: [entry, orphan, legacy],
    } as unknown as UserRows;
    const upgraded = upgradeStoredRows(stored);
    expect(upgraded.customMeals.map((m) => m.id)).toEqual([base.id]);
    expect(upgraded.customMealItems).toHaveLength(2);
    expect(upgraded.foodLogEntries.map((e) => [e.id, e.custom_meal_id]).sort()).toEqual(
      [
        [ID(60), base.id],
        [ID(61), null],
        [ID(62), null],
      ].sort(),
    );
    const old = { ...rows() } as Partial<UserRows>;
    delete old.customMeals;
    delete old.customMealItems;
    expect(upgradeStoredRows(old as UserRows).customMeals).toEqual([]);
  });
});

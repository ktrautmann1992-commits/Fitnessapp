import { CUSTOM_MEAL_LIMITS, type CustomMeal, customMealSchema } from '@fitnessapp/core';

import { healthConsentStatus } from '../state/flow';
import type { ConsentVersions } from './mapping';
import type { CustomMealItemRow, CustomMealRow, UserRows } from './types';

/**
 * Eigene Gerichte im TESTMODUS (Etappe E2, docs/PLAN-AUSWERTUNG.md Abschnitt 7) – dieselben Regeln wie die
 * Datenbank-Funktion save_custom_meal, soweit sie ohne Datenbank gelten:
 * - nur mit gültiger Einwilligung health_data (Name = Freitext, sichere Voreinstellung E2),
 * - Form und Grenzen wie die CHECKs (Zod, strikt: `customMealSchema` aus packages/core),
 * - höchstens 100 Gerichte je Person (Ändern geht auch bei 100), 30 Zutaten je Gericht,
 * Der Abgleich mit dem Katalog (nur freigegebene Lebensmittel) gilt nur auf dem Server; im Testmodus baut
 * packages/core (`buildCustomMeal`) die Gerichte immer aus dem Bestand (wie E1).
 * Löschen geht immer (Recht auf Löschung); Tagebuch-Einträge behalten ihre Werte und verlieren nur den Verweis
 * (wie `on delete set null (custom_meal_id)`). Rein und getestet (custom-meals.test.ts).
 *
 * Datenschutz: Der Name steht nur im Gerätespeicher bzw. auf dem Bildschirm – nie in Meldungen, Logs oder testIDs.
 */

export type CustomMealSaveCheck =
  { ok: true; meal: CustomMeal } | { ok: false; reason: 'consent_required' | 'invalid' | 'limit' };

export function checkCustomMealSave(
  rows: Pick<UserRows, 'consents' | 'profile' | 'customMeals' | 'customMealItems'>,
  meal: unknown,
  ctx: { versions: ConsentVersions },
): CustomMealSaveCheck {
  if (healthConsentStatus(rows as UserRows, ctx.versions) !== 'valid') {
    return { ok: false, reason: 'consent_required' };
  }
  const parsed = customMealSchema.safeParse(meal);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const value = parsed.data;
  const existing = rows.customMeals.find((m) => m.id === value.id);
  if (existing === undefined && rows.customMeals.length >= CUSTOM_MEAL_LIMITS.maxMeals) {
    return { ok: false, reason: 'limit' };
  }
  return { ok: true, meal: value };
}

/** Gericht übernehmen: neu mit revision 1, vorhanden ganz ersetzt (revision + 1, created_at bleibt), Zutaten neu. */
export function applyCustomMealSave(
  rows: UserRows,
  meal: CustomMeal,
  ctx: { userId: string; now: string; newId: () => string },
): UserRows {
  const existing = rows.customMeals.find((m) => m.id === meal.id);
  const { items, ...fields } = meal;
  const row: CustomMealRow = {
    ...fields,
    user_id: ctx.userId,
    revision: existing ? existing.revision + 1 : 1,
    last_write_id: ctx.newId(),
    created_at: existing?.created_at ?? ctx.now,
    updated_at: ctx.now,
  };
  const itemRows: CustomMealItemRow[] = items.map((item, index) => ({
    ...item,
    meal_id: meal.id,
    user_id: ctx.userId,
    order_no: index + 1,
  }));
  return {
    ...rows,
    customMeals: [...rows.customMeals.filter((m) => m.id !== meal.id), row],
    customMealItems: [...rows.customMealItems.filter((i) => i.meal_id !== meal.id), ...itemRows],
  };
}

/**
 * Gericht löschen (geht immer): Zutaten gehen mit (Kaskade), Tagebuch-Einträge bleiben mit ihren Werten und dem
 * neutralen Titel „Eigenes Gericht“, nur der Verweis wird leer.
 */
export function applyCustomMealDelete(rows: UserRows, id: string): UserRows {
  return {
    ...rows,
    customMeals: rows.customMeals.filter((m) => m.id !== id),
    customMealItems: rows.customMealItems.filter((i) => i.meal_id !== id),
    foodLogEntries: rows.foodLogEntries.map((e) =>
      e.custom_meal_id === id ? { ...e, custom_meal_id: null } : e,
    ),
  };
}

/** Gericht samt Zutaten (in Reihenfolge) aus den Zeilen – null, wenn es das Gericht nicht gibt. */
export function customMealFromRows(
  rows: Pick<UserRows, 'customMeals' | 'customMealItems'>,
  id: string,
): CustomMeal | null {
  const row = rows.customMeals.find((m) => m.id === id);
  if (!row) return null;
  return {
    id: row.id,
    name_de: row.name_de,
    mode: row.mode,
    servings: row.servings,
    kcal: row.kcal,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
    items: rows.customMealItems
      .filter((i) => i.meal_id === id)
      .sort((a, b) => a.order_no - b.order_no)
      .map((i) => ({ food_id: i.food_id, amount: i.amount, unit: i.unit })),
  };
}

/** Alle Gerichte samt Zutaten. */
export function customMealsFromRows(
  rows: Pick<UserRows, 'customMeals' | 'customMealItems'>,
): CustomMeal[] {
  return rows.customMeals.flatMap((m) => {
    const meal = customMealFromRows(rows, m.id);
    return meal ? [meal] : [];
  });
}

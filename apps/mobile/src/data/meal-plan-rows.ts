import {
  type MealPlanWeek,
  mealPlanWeekEditable,
  nutritionWeekRetained,
  parseStoredMealPlanWeek,
  parseStoredShoppingList,
  type StoredShoppingList,
} from '@fitnessapp/core';

import { healthConsentStatus } from '../state/flow';
import type { ConsentVersions } from './mapping';
import {
  mealPlanRowPrepPlanId,
  type MealPlanRow,
  type ShoppingListRow,
  type UserRows,
} from './types';

/**
 * Essensplan speichern im TESTMODUS (docs/PLAN-PHASE-5.md 7.3 `save_meal_plan`, 7.5, Etappe N5) – dieselben Regeln,
 * die der Server ab N7 prüft, soweit sie ohne Datenbank gelten:
 * - nur ein vollständiger Plan der aktuellen Engine-Version (Zod, `parseStoredMealPlanWeek`),
 * - Datumsrahmen: laufende und nächste Woche (`mealPlanWeekEditable`),
 * - ohne gültige Einwilligung health_data kein Plan mit Gesundheitsbezug und kein Faktor ≠ 1 (S9),
 * - höchstens ein (aktiver) Plan je Woche – ersetzt den bisherigen.
 * Das erneute Prüfen von Ernährungsform/Schwein/Ausschlüssen gegen die Rezept-Spalten kommt mit der Datenbank (N7);
 * im Testmodus erzeugt dieselbe Engine (packages/core) den Plan auf dem Gerät. Rein und getestet.
 */

export type MealPlanSaveCheck =
  | { ok: true; plan: MealPlanWeek }
  | { ok: false; reason: 'invalid' | 'out_of_range' | 'consent_required' };

export function checkMealPlanSave(
  plan: unknown,
  ctx: { today: string; rows: UserRows; versions: ConsentVersions },
): MealPlanSaveCheck {
  const parsed = parseStoredMealPlanWeek(plan);
  if (parsed === null) return { ok: false, reason: 'invalid' };
  if (!mealPlanWeekEditable(parsed.weekStart, ctx.today)) {
    return { ok: false, reason: 'out_of_range' };
  }
  if (healthConsentStatus(ctx.rows, ctx.versions) !== 'valid') {
    const scaled = parsed.days.some((day) => day.meals.some((meal) => meal.factor !== 1));
    if (parsed.usesHealthData || scaled) return { ok: false, reason: 'consent_required' };
  }
  return { ok: true, plan: parsed };
}

/**
 * Ersetzt den Plan derselben Woche (höchstens einer je Woche). Der Start des Kochtags (Timer) bleibt nur, solange der
 * gewählte Meal-Prep-Plan derselbe ist.
 */
export function applyMealPlanSave(
  rows: UserRows,
  plan: MealPlanWeek,
  ctx: { id: string; userId: string; now: string; autoAdjusted: boolean; recipesChanged?: boolean },
): UserRows {
  const before = storedMealPlanRow(rows, plan.weekStart);
  const row: MealPlanRow = {
    id: ctx.id,
    user_id: ctx.userId,
    week_start: plan.weekStart,
    uses_health_data: plan.usesHealthData,
    created_at: ctx.now,
    auto_adjusted: ctx.autoAdjusted,
    recipes_changed: ctx.recipesChanged ?? false,
    cook_day_started_at:
      before !== null &&
      plan.mealPrepPlanId !== null &&
      mealPlanRowPrepPlanId(before) === plan.mealPrepPlanId
        ? before.cook_day_started_at
        : null,
    plan,
  };
  return {
    ...rows,
    mealPlans: [...rows.mealPlans.filter((p) => p.week_start !== plan.weekStart), row].sort(
      (a, b) => a.week_start.localeCompare(b.week_start),
    ),
  };
}

/** Gespeicherter Plan der Woche (null = noch keiner). */
export function storedMealPlanRow(rows: UserRows, weekStart: string): MealPlanRow | null {
  return rows.mealPlans.find((p) => p.week_start === weekStart) ?? null;
}

// ---------------------------------------------------------------------------------------------------------
// Einkaufsliste (Etappe N5b, docs/PLAN-PHASE-5.md 6.5, 7.2, 7.3 `replace_shopping_list`)
// ---------------------------------------------------------------------------------------------------------

export type ShoppingListSaveCheck =
  | { ok: true; list: StoredShoppingList }
  | { ok: false; reason: 'invalid' | 'out_of_range' | 'consent_required' };

/**
 * Einkaufsliste speichern im TESTMODUS – dieselben Regeln, die der Server ab N7 prüft, soweit sie ohne Datenbank
 * gelten: gültige Liste (Zod, `parseStoredShoppingList`), Datumsrahmen laufende/nächste Woche, ohne gültige Einwilligung
 * keine Liste mit Gesundheitsbezug (wie Essenspläne, 7.1/K10).
 */
export function checkShoppingListSave(
  list: unknown,
  ctx: { today: string; rows: UserRows; versions: ConsentVersions },
): ShoppingListSaveCheck {
  const parsed = parseStoredShoppingList(list);
  if (parsed === null) return { ok: false, reason: 'invalid' };
  if (!mealPlanWeekEditable(parsed.weekStart, ctx.today)) {
    return { ok: false, reason: 'out_of_range' };
  }
  if (parsed.usesHealthData && healthConsentStatus(ctx.rows, ctx.versions) !== 'valid') {
    return { ok: false, reason: 'consent_required' };
  }
  return { ok: true, list: parsed };
}

/** Ersetzt die Liste derselben Woche (höchstens eine je Woche); `created_at` bleibt. */
export function applyShoppingListSave(
  rows: UserRows,
  list: StoredShoppingList,
  ctx: { id: string; userId: string; now: string },
): UserRows {
  const before = storedShoppingListRow(rows, list.weekStart);
  const row: ShoppingListRow = {
    id: before?.id ?? ctx.id,
    user_id: ctx.userId,
    week_start: list.weekStart,
    uses_health_data: list.usesHealthData,
    created_at: before?.created_at ?? ctx.now,
    updated_at: ctx.now,
    list,
  };
  return {
    ...rows,
    shoppingLists: [...rows.shoppingLists.filter((l) => l.week_start !== list.weekStart), row].sort(
      (a, b) => a.week_start.localeCompare(b.week_start),
    ),
  };
}

/** Gespeicherte Liste der Woche (null = noch keine). */
export function storedShoppingListRow(rows: UserRows, weekStart: string): ShoppingListRow | null {
  return rows.shoppingLists.find((l) => l.week_start === weekStart) ?? null;
}

/** Start des Kochtags setzen bzw. zurücksetzen (null) – nur bei einem Plan mit gewähltem Meal-Prep-Plan. */
export function applyCookDayStart(
  rows: UserRows,
  weekStart: string,
  startedAt: string | null,
): UserRows | null {
  const row = storedMealPlanRow(rows, weekStart);
  if (row === null || mealPlanRowPrepPlanId(row) === null) return null;
  return {
    ...rows,
    mealPlans: rows.mealPlans.map((p) =>
      p.week_start === weekStart ? { ...p, cook_day_started_at: startedAt } : p,
    ),
  };
}

/**
 * Löschfrist (Etappe N7 Teil 2, `MEAL_PLAN_RETENTION_WEEKS`, Gründer-Entscheidung G-N7-2): Pläne und Listen von Wochen
 * vor der Frist entfernen – im Testmodus beim Laden und Speichern, wie `private.purge_expired_nutrition_weeks` auf dem
 * Server. Unverändert (gleiche Referenz), wenn nichts abgelaufen ist.
 */
export function pruneExpiredNutritionWeeks(rows: UserRows, today: string): UserRows {
  const mealPlans = rows.mealPlans.filter((p) => nutritionWeekRetained(p.week_start, today));
  const shoppingLists = rows.shoppingLists.filter((l) =>
    nutritionWeekRetained(l.week_start, today),
  );
  if (
    mealPlans.length === rows.mealPlans.length &&
    shoppingLists.length === rows.shoppingLists.length
  ) {
    return rows;
  }
  return { ...rows, mealPlans, shoppingLists };
}

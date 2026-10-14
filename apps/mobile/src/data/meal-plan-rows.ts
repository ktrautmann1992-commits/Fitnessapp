import { type MealPlanWeek, mealPlanWeekEditable, parseStoredMealPlanWeek } from '@fitnessapp/core';

import { healthConsentStatus } from '../state/flow';
import type { ConsentVersions } from './mapping';
import type { MealPlanRow, UserRows } from './types';

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

/** Ersetzt den Plan derselben Woche (höchstens einer je Woche). */
export function applyMealPlanSave(
  rows: UserRows,
  plan: MealPlanWeek,
  ctx: { id: string; userId: string; now: string; autoAdjusted: boolean },
): UserRows {
  const row: MealPlanRow = {
    id: ctx.id,
    user_id: ctx.userId,
    week_start: plan.weekStart,
    uses_health_data: plan.usesHealthData,
    created_at: ctx.now,
    auto_adjusted: ctx.autoAdjusted,
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

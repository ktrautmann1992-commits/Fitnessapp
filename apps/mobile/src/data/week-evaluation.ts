import {
  addDays,
  evaluationMealPlanUsable,
  foodLogDay,
  type MealPlanWeek,
  type NutritionWeekTargets,
  type PlanLibrary,
  type PlannedSessionTargets,
  type SessionAchievementInput,
  startOfIsoWeek,
  type WeekEvaluationDayInput,
  type WeekBounds,
  type WeekEvaluationInput,
  weekPager,
} from '@fitnessapp/core';

import { dayAchievementInputsAround } from './day-evaluation';
import { summaryInputs } from './log-summary';
import type { UserRows } from './types';

/**
 * Wochenauswertung (docs/PLAN-AUSWERTUNG.md Abschnitt 8, Etappe A3): Abbildung der Zeilen auf die Eingaben von
 * `weekEvaluation()` aus packages/core – Tage Mo–So (Ziele aus `nutritionTargetsForWeek`, Einträge, gespeicherter
 * Essensplan), Einheiten und Einträge (`summaryInputs`), Erfüllungsgrad je Eintrag (`dayAchievementInputs`, wie
 * „Dein Tag“) und Vorgaben je geplanter Einheit. Nur Abbildung, keine Regeln. Rein, getestet. Nie loggen.
 */

export interface WeekNutritionInput {
  readonly targets: NutritionWeekTargets;
  readonly plan: MealPlanWeek | null;
  /** Essensplan der Woche gespeichert bzw. die Woche noch änderbar (`MealPlanState`). */
  readonly planStored: boolean;
  readonly weekEditable: boolean;
}

/** Vorgaben je geplanter Einheit der Woche: Summe der Vorgabe-Sätze bzw. geplante Minuten, Erholungs-/Einstiegswoche. */
export function weekPlannedTargets(
  rows: Pick<UserRows, 'plannedSessions' | 'plannedExercises'>,
  weekStart: string,
): Map<string, PlannedSessionTargets> {
  const weekEnd = addDays(weekStart, 6);
  const result = new Map<string, PlannedSessionTargets>();
  for (const s of rows.plannedSessions) {
    if (s.scheduled_on < weekStart || s.scheduled_on > weekEnd) continue;
    const sets = rows.plannedExercises
      .filter((e) => e.session_id === s.id)
      .reduce((sum, e) => sum + e.sets, 0);
    result.set(s.id, {
      strengthSets: s.kind === 'strength' ? sets : null,
      enduranceMinutes: s.kind === 'endurance' ? s.estimated_minutes : null,
      easyWeek: s.is_deload ? 'recovery' : s.is_intro_week ? 'intro' : null,
    });
  }
  return result;
}

export function weekEvaluationInput(input: {
  readonly rows: UserRows;
  readonly weekStart: string;
  readonly today: string;
  readonly showNumbers: boolean;
  /** Ernährung der Woche; null = nicht berechenbar (kein Ziel, kein Plan). */
  readonly nutrition: WeekNutritionInput | null;
  /** Tagebuch verfügbar (Betriebsart) UND gültige Einwilligung (A-G12). */
  readonly foodLogAvailable: boolean;
  readonly library: PlanLibrary | null;
}): WeekEvaluationInput {
  const { rows, today, nutrition } = input;
  const weekStart = startOfIsoWeek(input.weekStart);
  const { sessions, logs } = summaryInputs(rows);
  const achievements = new Map<string, SessionAchievementInput>();
  const days: WeekEvaluationDayInput[] = [];
  // Einträge an der Wochengrenze (± 1 Tag, Wächter A3 S1) gehören zur Woche ihres Termins.
  for (const offset of [0, 3, 6]) {
    const around = dayAchievementInputsAround(rows, addDays(weekStart, offset), input.library);
    for (const [id, value] of around) achievements.set(id, value);
  }
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(weekStart, i);
    const planDay = nutrition?.plan?.days.find((d) => d.date === date) ?? null;
    const usable =
      planDay !== null &&
      nutrition !== null &&
      evaluationMealPlanUsable({
        planStored: nutrition.planStored,
        weekEditable: nutrition.weekEditable,
        date,
        today,
      });
    days.push({
      date,
      targets: nutrition?.targets.days.find((d) => d.date === date) ?? null,
      foodLog: {
        available: input.foodLogAvailable,
        entries: input.foodLogAvailable ? foodLogDay(rows.foodLogEntries, date) : [],
      },
      mealPlan:
        usable && planDay !== null
          ? {
              slots: planDay.meals.map((m) => m.slot),
              belowFloor: planDay.status === 'below_floor',
            }
          : null,
    });
  }
  return {
    weekStart,
    today,
    showNumbers: input.showNumbers,
    days,
    sessions,
    logs,
    achievements,
    plannedTargets: weekPlannedTargets(rows, weekStart),
  };
}

/**
 * Erste Woche, die auf dem Gerät VOLLSTÄNDIG liegt (Supabase: `logHistoryStart` = heute − 12 Wochen, meist mitten in
 * einer Woche → die Woche danach). null = alles auf dem Gerät (Testmodus).
 */
export function firstCompleteWeek(since: string | null): string | null {
  if (since === null) return null;
  const monday = startOfIsoWeek(since);
  return monday === since ? monday : addDays(monday, 7);
}

/**
 * Blättern in der Wochenauswertung: wie „Woche“ (`weekPager` in den Grenzen `summaryWeekBounds`), aber die gewünschte
 * Woche wird nicht still auf eine andere geklemmt. Älter als der Gerätespeicher → `tooOld` (Weg nur zurück nach vorn);
 * außerhalb der Grenzen → Weg zurück in die Grenzen.
 */
export function weekEvaluationNavigation(
  requested: string,
  bounds: WeekBounds,
  firstComplete: string | null,
): { readonly tooOld: boolean; readonly previous: string | null; readonly next: string | null } {
  const week = startOfIsoWeek(requested);
  if (firstComplete !== null && week < firstComplete) {
    return { tooOld: true, previous: null, next: firstComplete };
  }
  if (week > bounds.last) return { tooOld: false, previous: bounds.last, next: null };
  if (week < bounds.first) return { tooOld: false, previous: null, next: bounds.first };
  const pager = weekPager(week, bounds);
  return { tooOld: false, previous: pager.previous, next: pager.next };
}

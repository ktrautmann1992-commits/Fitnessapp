import {
  addDays,
  cycleModuleOffered,
  type MonthReviewInput,
  type MonthReviewSet,
  type Sex,
  type TrainingCalendarEvent,
  trainingCalendarEvents,
  trainingStartMinutes,
  type TrainingTime,
  WEIGHT_TREND,
  type WeightEntry,
  weightTrendLossLimit,
} from '@fitnessapp/core';

import type { WeightHistoryRow } from './backend';
import { validCycleConsentGrantedAt } from './cycle-backend';
import { summaryInputs } from './log-summary';
import type { ConsentVersions } from './mapping';
import { showEnergyNumbers } from './nutrition-plan';
import type { OnboardingAnswers, UserRows } from './types';

/**
 * Gewichtstrend und Monatsrückblick (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 2–3): Abbildung der Zeilen auf die
 * Eingaben von `weightTrend()` und `monthReview()` aus packages/core. Nur Abbildung, keine Regeln. Rein, getestet.
 * Nie loggen – Gewicht, Essen und Gesundheits-Check sind Gesundheitsdaten.
 */

/** Woher der Gewichtsverlauf geladen wird: Fenster + Vorlauf zum Einschwingen der Glättung. */
export function weightHistoryFrom(today: string): string {
  return addDays(today, -(WEIGHT_TREND.windowDays + WEIGHT_TREND.resetAfterGapDays));
}

export function weightEntriesFromHistory(rows: readonly WeightHistoryRow[]): WeightEntry[] {
  return rows.map((r) => ({ date: r.measured_on, weightKg: Number(r.weight_kg) }));
}

/** Gewichte aus dem Abbild (Supabase-Modus: nur die neuesten Werte – Ersatz ohne Verbindung). */
export function weightEntriesFromRows(rows: Pick<UserRows, 'bodyMetrics'>): WeightEntry[] {
  return rows.bodyMetrics.flatMap((r) =>
    r.weight_kg === null ? [] : [{ date: r.measured_on, weightKg: Number(r.weight_kg) }],
  );
}

export type WeightTrendVisibility =
  /** Ohne gültige Einwilligung health_data: kein Gewicht, Einladung zur Einwilligung. */
  | 'no_consent'
  /** „Kalorienzahlen anzeigen“ aus: Gewicht ebenfalls ausgeblendet (Schutz vor Druck durch Zahlen). */
  | 'hidden_by_numbers'
  /** Von der Person auf diesem Gerät ausgeblendet. */
  | 'hidden'
  | 'visible';

export function weightTrendVisibility(input: {
  readonly rows: UserRows;
  readonly consentValid: boolean;
  readonly hiddenOnDevice: boolean;
}): WeightTrendVisibility {
  if (!input.consentValid) return 'no_consent';
  if (!showEnergyNumbers(input.rows)) return 'hidden_by_numbers';
  return input.hiddenOnDevice ? 'hidden' : 'visible';
}

export interface WeightTrendContext {
  readonly goal: { readonly targetWeightKg: number } | null;
  readonly pregnancy: boolean;
  readonly maxWeeklyLossFraction: number;
  /** Fit im Alter (strengere Grenze 0,5 % – eigener Hinweistext). */
  readonly activeAging: boolean;
  /** Zyklus-Hinweis (nur Text, keine Zyklusdaten) – nur mit gültiger Einwilligung cycle_data. */
  readonly cycleHint: boolean;
}

export function weightTrendContext(input: {
  readonly rows: UserRows;
  readonly answers: OnboardingAnswers;
  readonly versions: ConsentVersions;
  /** Zyklus-Status „schwanger“ (falls bekannt). */
  readonly cyclePregnant?: boolean;
}): WeightTrendContext {
  const { rows, answers } = input;
  const pregnancy =
    (answers.healthScreening?.flags.includes('pregnancy') ?? false) || input.cyclePregnant === true;
  const goal = rows.weightGoal
    ? { targetWeightKg: Number(rows.weightGoal.target_weight_kg) }
    : null;
  const sex = (answers.sex ?? null) as Sex | null;
  return {
    goal,
    pregnancy,
    maxWeeklyLossFraction: weightTrendLossLimit(rows.goals?.goal_type),
    activeAging: rows.goals?.goal_type === 'active_aging',
    cycleHint:
      !pregnancy &&
      cycleModuleOffered(sex) &&
      validCycleConsentGrantedAt(rows.consents, input.versions.cycle_data ?? null) !== null,
  };
}

/** Sätze mit Datum und Übung (Kraft-Steigerungen im Rückblick). */
export function monthReviewSets(
  rows: Pick<UserRows, 'sessionLogs' | 'exerciseLogs' | 'setLogs'>,
): MonthReviewSet[] {
  const dateByLog = new Map(rows.sessionLogs.map((l) => [l.id, l.performed_on] as const));
  const exerciseById = new Map(rows.exerciseLogs.map((e) => [e.id, e] as const));
  return rows.setLogs.flatMap((set) => {
    const exercise = exerciseById.get(set.exercise_log_id);
    const date = exercise ? dateByLog.get(exercise.session_log_id) : undefined;
    if (!exercise || !date) return [];
    return [
      {
        date,
        exerciseId: exercise.exercise_id,
        exerciseName: exercise.exercise_name_de,
        weightKg: set.weight_kg === null ? null : Number(set.weight_kg),
        reps: set.reps,
        done: set.done,
      },
    ];
  });
}

export function monthReviewInput(input: {
  readonly rows: UserRows;
  readonly month: string;
  readonly today: string;
  /** Tagebuch verfügbar (Betriebsart) UND gültige Einwilligung. */
  readonly foodLogAvailable: boolean;
  /** Gewichte nur bei Einwilligung und nicht ausgeblendet; sonst null. */
  readonly weight: readonly WeightEntry[] | null;
}): MonthReviewInput {
  const { rows } = input;
  const { sessions, logs } = summaryInputs(rows);
  const dateByLog = new Map(rows.sessionLogs.map((l) => [l.id, l.performed_on] as const));
  const cardio = rows.cardioLogs.flatMap((c) => {
    const date = dateByLog.get(c.session_log_id);
    return date
      ? [
          {
            date,
            modality: c.modality,
            distanceM: c.distance_m === null ? null : Number(c.distance_m),
          },
        ]
      : [];
  });
  const planDays = rows.mealPlans.flatMap((p) =>
    (p.plan?.days ?? []).map((d) => ({ date: d.date, slots: d.meals.map((m) => m.slot) })),
  );
  return {
    month: input.month,
    today: input.today,
    sessions,
    logs,
    cardio,
    sets: monthReviewSets(rows),
    food: input.foodLogAvailable
      ? {
          entries: rows.foodLogEntries.map((e) => ({
            date: e.eaten_on,
            kcal: e.kcal,
            protein_g: e.protein_g,
            carbs_g: e.carbs_g,
            fat_g: e.fat_g,
            source: e.source,
            slot: e.slot,
          })),
          planDays,
        }
      : null,
    weight: input.weight,
  };
}

/** Uhrzeit der Kalender-Termine: gewählt, sonst Trainingszeit aus dem Ernährungs-Setup, sonst 18:00. */
export function calendarStartMinutes(
  rows: Pick<UserRows, 'nutritionSetup'>,
  chosen: number | null,
): number {
  const time = (rows.nutritionSetup?.training_time ?? null) as TrainingTime | null;
  return trainingStartMinutes(time, chosen);
}

/**
 * Termine für den Handy-Kalender (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 4): offene Einheiten des AKTIVEN Plans ab
 * heute; Einheiten mit Eintrag fallen weg. Nur Name, Tag, Uhrzeit, Dauer (packages/core).
 */
export function desiredCalendarEvents(
  rows: Pick<UserRows, 'plans' | 'plannedSessions' | 'sessionLogs' | 'nutritionSetup'>,
  today: string,
  chosenStartMinutes: number | null,
): TrainingCalendarEvent[] {
  const active = rows.plans.find((p) => p.status === 'active');
  if (!active) return [];
  return trainingCalendarEvents({
    today,
    startMinutes: calendarStartMinutes(rows, chosenStartMinutes),
    loggedSessionIds: new Set(
      rows.sessionLogs.flatMap((l) => (l.planned_session_id ? [l.planned_session_id] : [])),
    ),
    sessions: rows.plannedSessions
      .filter((s) => s.plan_id === active.id)
      .map((s) => ({
        id: s.id,
        scheduledOn: s.scheduled_on,
        status: s.status,
        kind: s.kind,
        nameDe: s.name_de,
        estimatedMinutes: s.estimated_minutes,
      })),
  });
}

import { z } from 'zod';

import { DAILY_METRIC_LIMITS, STEP_GOAL } from '../constants';
import { addDays } from '../dates';

/**
 * Schritte mit Tagesziel (Kachel „Schritte“ auf der Übersicht, Gründer-Wunsch 22.10.2026; docs/PLAN-PHASE-8.md 13.4).
 * Die Schritte kommen als Tageswerte von der Uhr (`daily_metrics`, Europe/Berlin); das Ziel stellt die Person selbst
 * ein (`STEP_GOAL`, gespeichert bei der Anordnung der Übersicht – kein Gesundheitsdatum). Rein.
 */

/** Eigenes Schrittziel: ganze Zahl `STEP_GOAL.min`–`STEP_GOAL.max` in Schritten zu `STEP_GOAL.step`. */
export const stepGoalSchema = z
  .number()
  .int()
  .min(STEP_GOAL.min)
  .max(STEP_GOAL.max)
  .refine((n) => n % STEP_GOAL.step === 0, { message: 'Schrittziel in 500er-Schritten' });

/** Gespeichertes Ziel → gültiges Ziel; fehlend/ungültig → Standard (8.000). */
export function resolveStepGoal(stored: unknown): number {
  const parsed = stepGoalSchema.safeParse(stored);
  return parsed.success ? parsed.data : STEP_GOAL.default;
}

/** Auswahl für „Ziel ändern“: alle erlaubten Ziele (1.000, 1.500, … 30.000). */
export function stepGoalOptions(): number[] {
  const out: number[] = [];
  for (let n = STEP_GOAL.min; n <= STEP_GOAL.max; n += STEP_GOAL.step) out.push(n);
  return out;
}

/** Ziel um eine Stufe (`STEP_GOAL.step`) erhöhen bzw. senken, an den Grenzen festgehalten. */
export function stepGoalNudge(goal: number, direction: 1 | -1): number {
  const current = resolveStepGoal(goal);
  return Math.min(STEP_GOAL.max, Math.max(STEP_GOAL.min, current + direction * STEP_GOAL.step));
}

export interface StepProgress {
  /** Gezählte Schritte (ganze Zahl ≥ 0). */
  readonly steps: number;
  /** Verwendetes Ziel (ungültig → Standard). */
  readonly goal: number;
  /** Schritte / Ziel, ungedeckelt (z. B. 3,125 bei 25.000 von 8.000). */
  readonly ratio: number;
  /** Füllung des Rings 0–1 (gedeckelt). */
  readonly fraction: number;
  /** Prozent, gerundet und ungedeckelt (für Ansage und Anzeige „312 %“). */
  readonly percent: number;
  /** Bis zum Ziel fehlende Schritte (0, wenn erreicht). */
  readonly remaining: number;
  readonly reached: boolean;
}

const cleanSteps = (steps: number): number =>
  Number.isFinite(steps)
    ? Math.min(DAILY_METRIC_LIMITS.steps.max, Math.max(0, Math.round(steps)))
    : 0;

/** Fortschritt zum Tagesziel. Ungültige Schrittzahl → 0, ungültiges Ziel → Standard. */
export function stepProgress(input: { steps: number; goal: number }): StepProgress {
  const steps = cleanSteps(input.steps);
  const goal = resolveStepGoal(input.goal);
  const ratio = steps / goal;
  return {
    steps,
    goal,
    ratio,
    fraction: Math.min(1, ratio),
    percent: Math.round(ratio * 100),
    remaining: Math.max(0, goal - steps),
    reached: steps >= goal,
  };
}

/** Tageswert (Spalten wie `daily_metrics`). */
export interface DailyStepsRow {
  readonly day: string;
  readonly steps: number | null;
}

export interface StepDay {
  readonly day: string;
  /** null = an diesem Tag kein Schrittwert der Uhr. */
  readonly steps: number | null;
  /** Balkenhöhe 0–1 relativ zum größeren Wert aus Ziel und höchstem Tag der Woche. */
  readonly share: number;
  readonly reached: boolean;
}

export interface StepWeek {
  /** Schritte heute (null = noch kein Wert). */
  readonly today: number | null;
  /** Die letzten 7 Tage bis heute, älteste zuerst (heute = letzter Eintrag). */
  readonly days: readonly StepDay[];
  /** Stelle von heute in `days` (immer 6). */
  readonly todayIndex: number;
  /** Tage mit Schrittwert in den letzten 7 Tagen. */
  readonly daysWithData: number;
  /** Tage der letzten 7, an denen das Ziel erreicht wurde. */
  readonly daysReached: number;
}

export const STEP_WEEK_DAYS = 7;

/**
 * Schritte heute und die letzten 7 Tage aus den Tageswerten. `today` = heutiges Datum in Europe/Berlin (wie die
 * Tageswerte). Mehrere Zeilen je Tag (z. B. später mehrere Quellen) werden NICHT addiert – es zählt der größte Wert
 * (sonst doppelt gezählt). Unplausible Werte (außerhalb `DAILY_METRIC_LIMITS.steps`) zählen als fehlend.
 */
export function stepWeek(rows: readonly DailyStepsRow[], today: string, goal: number): StepWeek {
  const target = resolveStepGoal(goal);
  const from = addDays(today, -(STEP_WEEK_DAYS - 1));
  const byDay = new Map<string, number>();
  for (const row of rows) {
    if (row.day < from || row.day > today || row.steps === null) continue;
    const n = row.steps;
    if (
      !Number.isFinite(n) ||
      n < DAILY_METRIC_LIMITS.steps.min ||
      n > DAILY_METRIC_LIMITS.steps.max
    ) {
      continue;
    }
    byDay.set(row.day, Math.max(byDay.get(row.day) ?? 0, Math.round(n)));
  }
  const dayList = Array.from({ length: STEP_WEEK_DAYS }, (_, i) =>
    addDays(today, -(STEP_WEEK_DAYS - 1) + i),
  );
  const scale = Math.max(target, ...byDay.values());
  const days = dayList.map((day): StepDay => {
    const steps = byDay.get(day) ?? null;
    return {
      day,
      steps,
      share: steps === null ? 0 : steps / scale,
      reached: steps !== null && steps >= target,
    };
  });
  return {
    today: byDay.get(today) ?? null,
    days,
    todayIndex: STEP_WEEK_DAYS - 1,
    daysWithData: days.filter((d) => d.steps !== null).length,
    daysReached: days.filter((d) => d.reached).length,
  };
}

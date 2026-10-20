import type { WorkoutRunView, WorkoutTimerStep } from '@fitnessapp/core';

import { t } from '@/i18n';

/**
 * Anzeige-Texte des Workout-Timers (docs/PLAN-WORKOUTS.md Abschnitt 4) – rein, getestet (workout-timer-format.test.ts).
 */

/** Restzeit als „0:45“ bzw. „12:05“. */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface ExerciseNames {
  get(id: string): { readonly name_de: string; readonly unilateral: boolean } | undefined;
}

/** Überschrift des laufenden Schritts. */
export function stepTitle(step: WorkoutTimerStep | null, names: ExerciseNames): string {
  if (step === null) return '';
  if (step.kind === 'prepare') return t.workouts.timer.prepare;
  if (step.kind === 'rest') {
    return step.after === 'round'
      ? t.workouts.timer.restRound
      : step.after === 'set'
        ? t.workouts.timer.restSet
        : t.workouts.timer.rest;
  }
  return names.get(step.exerciseId)?.name_de ?? step.exerciseId;
}

/** Runde bzw. Satz des Schritts („Runde 2 von 3“ / „Satz 1 von 3“). */
export function passText(
  step: Extract<WorkoutTimerStep, { kind: 'work' }> | null,
  view: Pick<WorkoutRunView, 'round' | 'rounds'>,
): string {
  if (step !== null && step.passes > 1 && view.rounds === 1) {
    return t.workouts.timer.set(step.pass, step.passes);
  }
  return t.workouts.timer.round(view.round, view.rounds);
}

/** Dosierung eines Übungs-Schritts („12 Wiederholungen je Seite“ bzw. „40 s“). */
export function doseText(
  step: Extract<WorkoutTimerStep, { kind: 'work' }>,
  names: ExerciseNames,
): string {
  if (step.reps !== null) {
    return t.workouts.timer.reps(step.reps, names.get(step.exerciseId)?.unilateral === true);
  }
  return t.workouts.detail.seconds(step.seconds ?? 0);
}

/** Ansage beim Schrittwechsel (Bildschirmleser). */
export function stepAnnouncement(
  view: Pick<WorkoutRunView, 'step' | 'remainingS' | 'finished'>,
  names: ExerciseNames,
): string {
  if (view.finished || view.step === null) return t.workouts.finish.title;
  const title = stepTitle(view.step, names);
  if (view.step.kind === 'work' && view.step.reps !== null) {
    return `${title}: ${doseText(view.step, names)}`;
  }
  return view.remainingS === null
    ? title
    : `${title}: ${t.workouts.timer.remaining(view.remainingS)}`;
}

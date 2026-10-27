import {
  type Exercise,
  type FlowSafetyInput,
  type RecentActivity,
  recentMainMuscles,
  recoveryRoutineDay,
  recoveryRoutineEnabled,
  type RecoveryRoutineSuggestion,
  suggestRecoveryRoutine,
  type Workout,
} from '@fitnessapp/core';

import type { UserRows } from './types';

/**
 * Vorschlag „Erholungstag: Mobility“ auf „Heute“ (Sportarten Stufe 1 · Etappe Y): Zeilen der App → Eingaben der Regeln
 * in packages/core (recovery-routine.ts). Nur ein Vorschlag – keine geplante Einheit, nichts wird gespeichert.
 */

/** Tagebuch → Aktivitäten (Kraft mit Übungen, Ausdauer mit Art) für recentMainMuscles. */
export function recentActivitiesFromRows(
  rows: Pick<UserRows, 'sessionLogs' | 'exerciseLogs' | 'cardioLogs'>,
): RecentActivity[] {
  return rows.sessionLogs.map((log) => ({
    performedOn: log.performed_on,
    exerciseIds: rows.exerciseLogs
      .filter((e) => e.session_log_id === log.id)
      .map((e) => e.exercise_id),
    enduranceModality: rows.cardioLogs.find((c) => c.session_log_id === log.id)?.modality ?? null,
  }));
}

/** Einheiten des aktiven Plans (null = kein aktiver Plan). */
function activePlanSessions(rows: Pick<UserRows, 'plans' | 'plannedSessions'>) {
  const plan = rows.plans.find((p) => p.status === 'active');
  if (!plan) return null;
  return rows.plannedSessions
    .filter((s) => s.plan_id === plan.id)
    .map((s) => ({ scheduled_on: s.scheduled_on, status: s.status, is_deload: s.is_deload }));
}

export function recoverySuggestionFromRows(input: {
  readonly rows: UserRows;
  readonly today: string;
  readonly workouts: readonly Workout[];
  readonly exercises: ReadonlyMap<string, Exercise>;
  readonly safety: FlowSafetyInput;
}): RecoveryRoutineSuggestion | null {
  const { rows, today } = input;
  const enabled = recoveryRoutineEnabled(rows.appLayout ?? null);
  const day = recoveryRoutineDay(activePlanSessions(rows), today);
  if (!enabled || day === null) return null;
  return suggestRecoveryRoutine({
    enabled,
    day,
    workoutDoneToday: rows.sessionLogs.some(
      (l) => l.source === 'workout' && l.performed_on === today,
    ),
    workouts: input.workouts,
    exercises: input.exercises,
    safety: input.safety,
    muscles: recentMainMuscles(recentActivitiesFromRows(rows), input.exercises, today),
  });
}

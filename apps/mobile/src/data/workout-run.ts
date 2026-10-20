import {
  buildWorkoutTimerPlan,
  type Exercise,
  type Workout,
  workoutLogExercises,
  workoutLogNote,
  type WorkoutRun,
  workoutRunSummary,
  type WorkoutTimerStep,
  startWorkoutRun,
} from '@fitnessapp/core';

import { createFreeDraft, freeDraftKey, type WorkoutDraft } from './workout-draft';

/**
 * Laufendes Workout (docs/PLAN-WORKOUTS.md Abschnitt 4–5). Der Lauf selbst ist reine Zeitrechnung aus packages/core;
 * hier nur, was die App dazu festhält, und der Entwurf für das Tagebuch.
 *
 * Entscheidung (Plan W-E6): Der laufende Timer liegt NUR im Arbeitsspeicher (kein neuer Speicherort für
 * Tagebuch-Daten). Gespeichert wird über den vorhandenen Weg – Entwurf → submitWorkout → verschlüsselte
 * Tagebuch-Warteschlange (offline möglich). Jeder Lauf hat eine feste Eintrags-ID: erneutes Speichern desselben Laufs
 * erzeugt nie einen zweiten Eintrag.
 */
export interface ActiveWorkoutRun {
  readonly ownerUserId: string;
  readonly workoutId: string;
  /** Feste ID des Tagebuch-Eintrags dieses Laufs (keine Doppel-Einträge). */
  readonly logId: string;
  readonly steps: readonly WorkoutTimerStep[];
  readonly run: WorkoutRun;
  /** Beginn als ISO-Zeitstempel (started_at). */
  readonly startedAt: string;
  /** Gespeichert (bzw. in der Warteschlange) – dann nie erneut senden. */
  readonly saved: boolean;
}

export function startActiveRun(input: {
  ownerUserId: string;
  workout: Workout;
  nowMs: number;
  newId: () => string;
}): ActiveWorkoutRun {
  const steps = buildWorkoutTimerPlan(input.workout);
  return {
    ownerUserId: input.ownerUserId,
    workoutId: input.workout.id,
    logId: input.newId(),
    steps,
    run: startWorkoutRun(steps, input.nowMs),
    startedAt: new Date(input.nowMs).toISOString(),
    saved: false,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Ein laufendes Workout je App-Sitzung (Arbeitsspeicher), mit Abonnement für React (useSyncExternalStore)
// ---------------------------------------------------------------------------------------------------------
let active: ActiveWorkoutRun | null = null;
const listeners = new Set<() => void>();

export const activeRunStore = {
  get: (): ActiveWorkoutRun | null => active,
  set(next: ActiveWorkoutRun | null): void {
    active = next;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

// ---------------------------------------------------------------------------------------------------------
// Entwurf für das Tagebuch
// ---------------------------------------------------------------------------------------------------------

export type WorkoutLogDraftResult =
  | { readonly ok: true; readonly draft: WorkoutDraft }
  /** Keine Übung erledigt – nichts zu speichern. */
  | { readonly ok: false; readonly reason: 'nothing_done' };

/**
 * Lauf → Entwurf einer freien Kraft-Einheit (A1b) mit `workoutId`: je Übung nur die erledigten Durchgänge (alle
 * abgehakt), Notiz mit Titel, Sternen, Runden und Minuten (workoutLogNote), Anstrengung freiwillig, Beginn/Ende vom
 * Timer. Die Eintrags-ID ist die feste ID des Laufs.
 */
export function workoutLogDraft(input: {
  readonly active: ActiveWorkoutRun;
  readonly workout: Workout;
  readonly exercises: ReadonlyMap<string, Exercise>;
  readonly nowMs: number;
  /** Heute (Europe/Berlin). */
  readonly today: string;
  readonly sessionRpe: number | null;
  readonly userNote: string;
  readonly newId: () => string;
}): WorkoutLogDraftResult {
  const { active: current, workout } = input;
  const summary = workoutRunSummary(current.steps, current.run, input.nowMs);
  const logged = workoutLogExercises(workout, summary, input.exercises);
  if (logged.length === 0) return { ok: false, reason: 'nothing_done' };
  const picked = logged.flatMap((entry) => {
    const exercise = input.exercises.get(entry.exerciseId);
    return exercise ? [exercise] : [];
  });
  const now = new Date(input.nowMs).toISOString();
  const base = createFreeDraft({
    ownerUserId: current.ownerUserId,
    kind: 'strength',
    modality: 'run',
    exercises: picked,
    performedOn: input.today,
    today: input.today,
    now,
    newId: input.newId,
  });
  const finishedAtMs = current.run.finishedAtMs ?? input.nowMs;
  return {
    ok: true,
    draft: {
      ...base,
      logId: current.logId,
      key: freeDraftKey(current.logId),
      exercises: base.exercises.map((exercise, index) => ({
        ...exercise,
        sets: (logged[index]?.sets ?? []).map((set) => ({ ...set })),
      })),
      startedAt: current.startedAt,
      finishedAt: new Date(finishedAtMs).toISOString(),
      sessionRpe: input.sessionRpe,
      notes: workoutLogNote({
        title: workout.title_de,
        difficulty: workout.difficulty,
        format: workout.format,
        summary,
        userNote: input.userNote,
      }),
      workoutId: workout.id,
    },
  };
}

import type { Workout } from '@fitnessapp/core';

import { newId } from '@/data/create-backend';
import { activeRunStore, startActiveRun } from '@/data/workout-run';

/**
 * Neuen Lauf beginnen (außerhalb des Renderns: Zeitpunkt und ID entstehen beim Tippen). `keepWorkout` = genau diese
 * Fassung in den Player (eigene Workouts, getauschte Übungen; docs/PLAN-EIGENE-WORKOUTS.md).
 */
export function beginWorkoutRun(
  userId: string,
  workout: Workout,
  exercises: ReadonlyMap<string, { readonly unilateral: boolean }> | null,
  keepWorkout = false,
): void {
  activeRunStore.set(
    startActiveRun({
      ownerUserId: userId,
      workout,
      nowMs: Date.now(),
      newId,
      // Zeitfenster für Wiederholungen (Power-Workouts): einseitige Übungen doppelt.
      unilateral: (id) => exercises?.get(id)?.unilateral === true,
      keepWorkout,
    }),
  );
}

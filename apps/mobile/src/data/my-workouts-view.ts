import {
  applyWorkoutVariant,
  CONSERVATIVE_PLAN_RULES,
  type CustomBuildContext,
  customDifficulty,
  customWorkoutFromDefinition,
  customWorkoutId,
  type Exercise,
  type ExperienceLevel,
  isCustomWorkoutId,
  type PlanSafetyRules,
  type Workout,
  type WorkoutSwapContext,
  type WorkoutVariant,
} from '@fitnessapp/core';

import type { CustomWorkoutRow, MyWorkoutsData } from './my-workouts';
import type { UserRows } from './types';

/**
 * Eigene Workouts und Varianten in der App zusammensetzen (docs/PLAN-EIGENE-WORKOUTS.md): Zeilen → Workouts für Liste,
 * Ansicht und Player, „Mag ich nicht“ aus beiden Quellen, Kontext für Bauen und Tauschen. Nur Abbildung – Regeln in
 * packages/core (custom.ts, swap.ts). Rein und getestet.
 */

export interface MyCustomWorkout {
  readonly row: CustomWorkoutRow;
  /** Workout-ID für Player und Tagebuch (customWorkoutId). */
  readonly workoutId: string;
  readonly workout: Workout;
}

/** Eigene Workouts als Workouts (neueste zuerst); ungültige (Übung fehlt) fallen weg. */
export function myCustomWorkouts(
  data: MyWorkoutsData | null,
  lookup: ReadonlyMap<string, Exercise> | null,
): MyCustomWorkout[] {
  if (!data || !lookup) return [];
  return [...data.custom]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))
    .flatMap((row) => {
      const known = row.definition.tracks.every((t) =>
        t.items.every((item) => lookup.has(item.exercise_id)),
      );
      if (!known) return [];
      try {
        const workoutId = customWorkoutId(row.id);
        const workout = customWorkoutFromDefinition(
          row.definition,
          { id: workoutId, name: row.name, today: row.created_at.slice(0, 10) },
          lookup,
        );
        return [{ row, workoutId, workout }];
      } catch {
        return [];
      }
    });
}

/** Eigenes Workout zur Workout-ID (null = keins). */
export function myCustomWorkout(
  data: MyWorkoutsData | null,
  lookup: ReadonlyMap<string, Exercise> | null,
  workoutId: string | undefined,
): MyCustomWorkout | null {
  if (!workoutId || !isCustomWorkoutId(workoutId)) return null;
  return myCustomWorkouts(data, lookup).find((c) => c.workoutId === workoutId) ?? null;
}

/** Gespeicherte Variante eines Bibliotheks-Workouts (null = keine). */
export function variantFor(data: MyWorkoutsData | null, workoutId: string): WorkoutVariant | null {
  return data?.variants.find((v) => v.workout_id === workoutId)?.definition ?? null;
}

export interface ShownLibraryWorkout {
  readonly workout: Workout;
  /** Mindestens eine Übung getauscht („angepasst“). */
  readonly adjusted: boolean;
  readonly swappedIndexes: readonly number[];
  readonly variant: WorkoutVariant | null;
}

/** Bibliotheks-Workout mit persönlicher Variante (Flow-Routinen nie). */
export function shownLibraryWorkout(
  original: Workout,
  data: MyWorkoutsData | null,
  lookup: ReadonlyMap<string, Exercise> | null,
): ShownLibraryWorkout {
  const variant = variantFor(data, original.id);
  if (!variant || !lookup || original.format === 'flow') {
    return { workout: original, adjusted: false, swappedIndexes: [], variant };
  }
  const applied = applyWorkoutVariant(original, variant, lookup);
  return {
    workout: applied.workout,
    adjusted: applied.applied > 0,
    swappedIndexes: applied.swappedIndexes,
    variant,
  };
}

/** „Mag ich nicht“: eigene Liste (exercise_dislikes) plus Übungs-Präferenzen „mag ich nicht“ (beide Orte). */
export function dislikedExerciseIds(
  data: MyWorkoutsData | null,
  rows: Pick<UserRows, 'exercisePreferences'> | null,
): Set<string> {
  return new Set([
    ...(data?.dislikes.map((d) => d.exercise_id) ?? []),
    ...(rows?.exercisePreferences.filter((p) => p.kind === 'dislike').map((p) => p.exercise_id) ??
      []),
  ]);
}

/** Kontext für buildCustomWorkout aus Profil und Sicherheitsregeln (ohne Regeln: vorsichtige Richtung). */
export function customBuildContextFor(
  rows: Pick<UserRows, 'profile'> | null,
  rules: Pick<PlanSafetyRules, 'excludedCautionTags' | 'cautious' | 'beginnerTemplatesOnly'> | null,
  dislikes: ReadonlySet<string>,
): CustomBuildContext {
  const level = (rows?.profile?.experience_level ?? null) as ExperienceLevel | null;
  return {
    level,
    cautious: rules === null ? true : rules.cautious || rules.beginnerTemplatesOnly,
    excludedCautionTags: rules?.excludedCautionTags ?? CONSERVATIVE_PLAN_RULES.excludedCautionTags,
    dislikes,
  };
}

/** Kontext für workoutSwapCandidates (Bibliotheks- und eigene Workouts). */
export function workoutSwapContextFor(input: {
  library: ReadonlyMap<string, Exercise>;
  lookup: ReadonlyMap<string, Exercise> | null;
  available: ReadonlySet<string> | null;
  build: CustomBuildContext;
}): WorkoutSwapContext {
  return {
    library: input.library,
    ...(input.lookup ? { lookup: input.lookup } : {}),
    available: input.available,
    dislikes: input.build.dislikes ?? new Set(),
    excludedCautionTags: input.build.excludedCautionTags,
    maxDifficulty: customDifficulty(input.build).max,
  };
}

/** Ansicht eines Workouts: eigene Workouts unter /eigene-workouts/<id>, sonst /workouts/<id>. */
export function workoutDetailHref(workoutId: string): string {
  return isCustomWorkoutId(workoutId)
    ? `/eigene-workouts/${encodeURIComponent(workoutId)}`
    : `/workouts/${encodeURIComponent(workoutId)}`;
}

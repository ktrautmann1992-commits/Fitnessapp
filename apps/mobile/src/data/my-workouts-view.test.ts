import { buildCustomWorkout, workoutSchema, workoutVariantSchema } from '@fitnessapp/core';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { MyWorkoutsData } from './my-workouts';
import { testLibrary } from './my-workouts-test-library';
import {
  customBuildContextFor,
  dislikedExerciseIds,
  myCustomWorkout,
  myCustomWorkouts,
  shownLibraryWorkout,
  workoutDetailHref,
  workoutSwapContextFor,
} from './my-workouts-view';

const LIB = testLibrary();
const NOW = '2026-11-18T10:00:00.000Z';
const ROW = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

function data(): MyWorkoutsData {
  const built = buildCustomWorkout(
    {
      minutes: 20,
      areas: ['glutes'],
      equipment_ids: [],
      favorite_ids: [],
      dislike_ids: [],
      seed: 9,
    },
    LIB,
    { level: 'beginner', cautious: false, excludedCautionTags: [] },
  );
  return {
    custom: [
      {
        id: ROW,
        user_id: 'a',
        name: 'Mein Po 20',
        definition: built.definition!,
        created_at: NOW,
        updated_at: NOW,
      },
    ],
    variants: [
      {
        user_id: 'a',
        workout_id: 'barbell-burn-30',
        definition: workoutVariantSchema.parse({
          version: 1,
          base_version: 1,
          swaps: [
            {
              index: 4,
              from: 'rumaenisches-kreuzheben-langhantel',
              to: 'rumaenisches-kreuzheben-kurzhantel',
            },
          ],
        }),
        updated_at: NOW,
      },
    ],
    dislikes: [{ user_id: 'a', exercise_id: 'hampelmann', created_at: NOW }],
  };
}

describe('Eigene Workouts in der App', () => {
  it('Zeilen → gültige Workouts mit eigener ID und Namen; Ansicht unter /eigene-workouts', () => {
    const list = myCustomWorkouts(data(), LIB);
    expect(list).toHaveLength(1);
    expect(list[0]?.workoutId).toBe(`eigen-${ROW}`);
    expect(list[0]?.workout.title_de).toBe('Mein Po 20');
    expect(workoutSchema.safeParse(list[0]?.workout).success).toBe(true);
    expect(myCustomWorkout(data(), LIB, `eigen-${ROW}`)?.row.id).toBe(ROW);
    expect(myCustomWorkout(data(), LIB, 'barbell-burn-30')).toBeNull();
    expect(myCustomWorkouts(data(), null)).toEqual([]);
    expect(workoutDetailHref(`eigen-${ROW}`)).toBe(`/eigene-workouts/eigen-${ROW}`);
    expect(workoutDetailHref('barbell-burn-30')).toBe('/workouts/barbell-burn-30');
  });

  it('Übung nicht mehr in der Bibliothek → Workout fällt weg (nie halb im Player)', () => {
    const lib = new Map(LIB);
    const id = data().custom[0]!.definition.tracks[1]!.items[0]!.exercise_id;
    lib.delete(id);
    expect(myCustomWorkouts(data(), lib)).toEqual([]);
  });

  it('Bibliotheks-Workout mit Variante: getauscht, „angepasst“; ohne Variante unverändert', () => {
    const raw = JSON.parse(
      readFileSync(
        new URL('../../../../content/workouts/barbell-burn-30.json', import.meta.url),
        'utf8',
      ),
    ) as unknown;
    const original = workoutSchema.parse(raw);
    const shown = shownLibraryWorkout(original, data(), LIB);
    expect(shown.adjusted).toBe(true);
    expect(shown.swappedIndexes).toEqual([4]);
    expect(shown.workout.exercises[4]?.exercise_id).toBe('rumaenisches-kreuzheben-kurzhantel');
    expect(shown.workout.equipment_ids).toContain('dumbbells');
    const plain = shownLibraryWorkout(original, { ...data(), variants: [] }, LIB);
    expect(plain).toMatchObject({ adjusted: false, workout: original });
  });

  it('„Mag ich nicht“ aus beiden Quellen; Kontext mit vorsichtiger Richtung ohne Regeln', () => {
    const ids = dislikedExerciseIds(data(), {
      exercisePreferences: [
        {
          user_id: 'a',
          exercise_id: 'crunch',
          location: 'home',
          kind: 'dislike',
          replacement_exercise_id: null,
          created_at: NOW,
          updated_at: NOW,
        },
        {
          user_id: 'a',
          exercise_id: 'klimmzug',
          location: 'gym',
          kind: 'not_feasible',
          replacement_exercise_id: null,
          created_at: NOW,
          updated_at: NOW,
        },
      ] as never,
    });
    expect([...ids].sort()).toEqual(['crunch', 'hampelmann']);
    const ctx = customBuildContextFor(null, null, ids);
    expect(ctx.cautious).toBe(true);
    expect(ctx.excludedCautionTags.length).toBeGreaterThan(0);
    const swap = workoutSwapContextFor({ library: LIB, lookup: LIB, available: null, build: ctx });
    expect(swap.maxDifficulty).toBe(2);
    expect(swap.dislikes.has('crunch')).toBe(true);
  });
});

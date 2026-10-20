import { describe, expect, it } from 'vitest';

import { WORKOUT_LIMITS } from '../constants';
import { workoutSchema } from './schema';
import { makeWorkout, workoutItem } from './test-fixtures';

const issues = (value: unknown) => {
  const result = workoutSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe('workoutSchema (Regel W1)', () => {
  it('nimmt das Muster-Workout an', () => {
    expect(issues(makeWorkout())).toEqual([]);
  });

  it('Sterne nur 1–5', () => {
    expect(issues(makeWorkout({ difficulty: 0 }))).not.toEqual([]);
    expect(issues(makeWorkout({ difficulty: 6 }))).not.toEqual([]);
    expect(issues(makeWorkout({ difficulty: 1 }))).toEqual([]);
    expect(issues(makeWorkout({ difficulty: 5 }))).toEqual([]);
  });

  it('Runden 1–10 (Tagebuch: höchstens 10 Sätze je Übung)', () => {
    expect(issues(makeWorkout({ rounds: 1 }))).toEqual([]);
    expect(issues(makeWorkout({ rounds: WORKOUT_LIMITS.rounds.max }))).toEqual([]);
    expect(issues(makeWorkout({ rounds: 11 }))).not.toEqual([]);
    expect(issues(makeWorkout({ rounds: 0 }))).not.toEqual([]);
  });

  it('genau eines von Wiederholungen und Sekunden', () => {
    expect(issues(makeWorkout({ exercises: [workoutItem('a-b-c', { duration_s: 30 })] }))).toEqual(
      expect.arrayContaining([expect.stringContaining('Entweder Wiederholungen')]),
    );
    expect(
      issues(
        makeWorkout({
          exercises: [workoutItem('kniebeuge-kg', { reps: null }), workoutItem('liegestuetz-kg')],
        }),
      ),
    ).toEqual(expect.arrayContaining([expect.stringContaining('Entweder Wiederholungen')]));
  });

  it('mindestens 2, höchstens 12 Übungen und jede nur einmal', () => {
    expect(issues(makeWorkout({ exercises: [workoutItem('kniebeuge-kg')] }))).not.toEqual([]);
    const twelve = Array.from({ length: 12 }, (_, i) => workoutItem(`uebung-${i + 1}`));
    expect(issues(makeWorkout({ exercises: twelve }))).toEqual([]);
    const thirteen = Array.from({ length: 13 }, (_, i) => workoutItem(`uebung-${i + 1}`));
    expect(issues(makeWorkout({ exercises: thirteen }))).not.toEqual([]);
    expect(
      issues(
        makeWorkout({ exercises: [workoutItem('kniebeuge-kg'), workoutItem('kniebeuge-kg')] }),
      ),
    ).toEqual(expect.arrayContaining([expect.stringContaining('höchstens einmal')]));
  });

  it('Intervall: jede Übung nach Zeit', () => {
    expect(issues(makeWorkout({ format: 'interval' }))).toEqual(
      expect.arrayContaining([expect.stringContaining('Intervall')]),
    );
    expect(
      issues(
        makeWorkout({
          format: 'interval',
          exercises: [
            workoutItem('kniebeuge-kg', { reps: null, duration_s: 30 }),
            workoutItem('liegestuetz-kg', { reps: null, duration_s: 30 }),
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('Sätze × Wdh.: Sätze je Übung, eine Runde ohne Rundenpause', () => {
    const sets = [
      workoutItem('kniebeuge-kg', { sets: 3, rest_s: 60 }),
      workoutItem('liegestuetz-kg', { sets: 2, rest_s: 60 }),
    ];
    expect(
      issues(makeWorkout({ format: 'sets_reps', rounds: 1, round_rest_s: 0, exercises: sets })),
    ).toEqual([]);
    expect(issues(makeWorkout({ format: 'sets_reps', exercises: sets }))).toEqual(
      expect.arrayContaining([expect.stringContaining('„rounds“ = 1')]),
    );
    expect(
      issues(
        makeWorkout({
          format: 'sets_reps',
          rounds: 1,
          round_rest_s: 0,
          exercises: [workoutItem('kniebeuge-kg'), workoutItem('liegestuetz-kg')],
        }),
      ),
    ).toEqual(expect.arrayContaining([expect.stringContaining('„sets“ angeben')]));
    expect(
      issues(makeWorkout({ exercises: [workoutItem('kniebeuge-kg', { sets: 2 }), ...sets] })),
    ).toEqual(expect.arrayContaining([expect.stringContaining('Runden statt Sätze')]));
  });

  it('freigegeben nur mit Prüfer; unbekannte Felder abgelehnt', () => {
    const workout = makeWorkout();
    expect(
      issues({ ...workout, meta: { ...workout.meta, reviewed_by: null, reviewed_at: null } }),
    ).toEqual(expect.arrayContaining([expect.stringContaining('Freigegeben ohne Prüfer')]));
    expect(
      issues({
        ...workout,
        status: 'draft',
        meta: { ...workout.meta, reviewed_by: null, reviewed_at: null },
      }),
    ).toEqual([]);
    expect(issues({ ...workout, extra: true })).not.toEqual([]);
  });

  it('Pause 0 s erlaubt, Grenzen der Dosierung', () => {
    expect(
      issues(
        makeWorkout({ exercises: [workoutItem('a-a-a', { rest_s: 0 }), workoutItem('b-b-b')] }),
      ),
    ).toEqual([]);
    expect(
      issues(makeWorkout({ exercises: [workoutItem('a-a-a', { reps: 2 }), workoutItem('b-b-b')] })),
    ).not.toEqual([]);
    expect(
      issues(
        makeWorkout({ exercises: [workoutItem('a-a-a', { reps: 31 }), workoutItem('b-b-b')] }),
      ),
    ).not.toEqual([]);
    expect(
      issues(
        makeWorkout({
          exercises: [workoutItem('a-a-a', { reps: null, duration_s: 121 }), workoutItem('b-b-b')],
        }),
      ),
    ).not.toEqual([]);
  });
});

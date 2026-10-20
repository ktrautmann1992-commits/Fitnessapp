import { describe, expect, it } from 'vitest';

import { SESSION_LOG_LIMITS } from '../constants';
import { freeSessionLogFromInput } from '../log/free-session';
import { codePointLength, sessionLogPayloadSchema } from '../log/schemas';
import {
  EMPTY_WORKOUT_FILTER,
  filterWorkouts,
  workoutDurationBucket,
  workoutLogExercises,
  workoutLogNote,
  workoutSafetyHints,
  workoutStars,
  workoutTileSummary,
} from './library';
import { makeWorkout, workoutItem, workoutLibraryMap } from './test-fixtures';
import {
  advanceWorkoutRun,
  buildWorkoutTimerPlan,
  completeWorkoutStep,
  endWorkoutRun,
  skipWorkoutStep,
  startWorkoutRun,
  workoutRunSummary,
} from './timer';

const list = [
  makeWorkout({ id: 'a-leicht', title_de: 'Leicht kurz', difficulty: 1, minutes: 10 }),
  makeWorkout({
    id: 'b-kurzhantel',
    title_de: 'Mit Hanteln',
    difficulty: 3,
    minutes: 25,
    category: 'upper_body',
    equipment_ids: ['dumbbells'],
  }),
  makeWorkout({
    id: 'c-hart',
    title_de: 'Hart lang',
    difficulty: 5,
    minutes: 40,
    category: 'hiit_cardio',
  }),
  makeWorkout({ id: 'd-entwurf', title_de: 'Entwurf', status: 'draft' }),
  makeWorkout({ id: 'e-leicht', title_de: 'Auch leicht', difficulty: 1, minutes: 10 }),
];

describe('filterWorkouts', () => {
  it('nur freigegebene, sortiert nach Sternen, Dauer, Titel', () => {
    expect(filterWorkouts(list, EMPTY_WORKOUT_FILTER).map((w) => w.id)).toEqual([
      'e-leicht',
      'a-leicht',
      'b-kurzhantel',
      'c-hart',
    ]);
  });

  it('Sterne, Dauer, Kategorie, ohne Geräte – kombinierbar', () => {
    const ids = (filter: Partial<typeof EMPTY_WORKOUT_FILTER>) =>
      filterWorkouts(list, { ...EMPTY_WORKOUT_FILTER, ...filter }).map((w) => w.id);
    expect(ids({ stars: [3, 5] })).toEqual(['b-kurzhantel', 'c-hart']);
    expect(ids({ duration: 'short' })).toEqual(['e-leicht', 'a-leicht']);
    expect(ids({ duration: 'medium' })).toEqual(['b-kurzhantel']);
    expect(ids({ duration: 'long' })).toEqual(['c-hart']);
    expect(ids({ category: 'hiit_cardio' })).toEqual(['c-hart']);
    expect(ids({ noEquipment: true })).toEqual(['e-leicht', 'a-leicht', 'c-hart']);
    expect(ids({ noEquipment: true, stars: [3] })).toEqual([]);
  });

  it('Dauer-Grenzen 15 / 30 Minuten', () => {
    expect(workoutDurationBucket(15)).toBe('short');
    expect(workoutDurationBucket(16)).toBe('medium');
    expect(workoutDurationBucket(30)).toBe('medium');
    expect(workoutDurationBucket(31)).toBe('long');
  });
});

describe('workoutTileSummary', () => {
  it('zählt freigegebene, ohne Geräte und heute erledigte Workouts', () => {
    expect(
      workoutTileSummary(
        list,
        [
          { performed_on: '2026-10-20', source: 'workout' },
          { performed_on: '2026-10-20', source: 'manual' },
          { performed_on: '2026-10-19', source: 'workout' },
        ],
        '2026-10-20',
      ),
    ).toEqual({ total: 4, withoutEquipment: 3, doneToday: 1 });
  });
});

describe('workoutSafetyHints (Hinweis, kein Verbot)', () => {
  const base = {
    beginner: false,
    medicalNotice: false,
    pregnancyNotice: false,
    excludedCautionTags: [],
  };
  const lib = workoutLibraryMap();

  it('Aufwärmen immer', () => {
    expect(workoutSafetyHints(makeWorkout(), base, lib)).toEqual(['warmup']);
  });

  it('ab 4 Sternen Hinweis für Einsteiger, darunter nicht', () => {
    expect(
      workoutSafetyHints(makeWorkout({ difficulty: 4 }), { ...base, beginner: true }, lib),
    ).toEqual(['warmup', 'hard_for_beginner']);
    expect(
      workoutSafetyHints(makeWorkout({ difficulty: 3 }), { ...base, beginner: true }, lib),
    ).toEqual(['warmup']);
    expect(workoutSafetyHints(makeWorkout({ difficulty: 5 }), base, lib)).toEqual(['warmup']);
  });

  it('Gesundheits-Check, Schwangerschaft und ausgeschlossene Übungen', () => {
    const jumps = makeWorkout({
      exercises: [
        workoutItem('hampelmann-kg', { reps: null, duration_s: 30 }),
        workoutItem('kniebeuge-kg'),
      ],
    });
    expect(
      workoutSafetyHints(
        jumps,
        {
          ...base,
          medicalNotice: true,
          pregnancyNotice: true,
          excludedCautionTags: ['high_impact'],
        },
        lib,
      ),
    ).toEqual(['warmup', 'medical', 'pregnancy', 'excluded_exercises']);
  });
});

describe('Tagebuch-Eintrag aus dem Lauf', () => {
  const t0 = 5_000_000;
  const workout = makeWorkout({
    exercises: [
      workoutItem('kniebeuge-kg'),
      workoutItem('rudern-kh', { reps: 12 }),
      workoutItem('unterarmstuetz-kg', { reps: null, duration_s: 30 }),
      workoutItem('split-kg', { reps: null, duration_s: 40 }),
    ],
    equipment_ids: ['dumbbells'],
  });
  const steps = buildWorkoutTimerPlan(workout);

  function finishedRun() {
    let run = startWorkoutRun(steps, t0);
    let now = t0;
    // Jede Übung nach Wiederholungen sofort abhaken, Zeitübungen laufen ab; in Runde 2 Rudern überspringen.
    while (run.finishedAtMs === null) {
      now += 1000;
      run = advanceWorkoutRun(steps, run, now);
      const step = steps[run.index];
      if (run.finishedAtMs !== null || !step) break;
      if (step.kind === 'work' && step.seconds === null) {
        run =
          step.exerciseId === 'rudern-kh' && step.pass === 2
            ? skipWorkoutStep(steps, run, now)
            : completeWorkoutStep(steps, run, now);
      }
    }
    return run;
  }

  it('Sätze je Übung: Wdh. aus dem Workout, Zeitübung mit Sekunden, Körpergewicht nach Zeit ohne Wdh.', () => {
    const run = finishedRun();
    const summary = workoutRunSummary(steps, run, t0 + 10_000_000);
    expect(summary).toMatchObject({ roundsCompleted: 2, rounds: 3, complete: false });
    const exercises = workoutLogExercises(workout, summary, workoutLibraryMap());
    expect(exercises.map((e) => [e.exerciseId, e.sets.length])).toEqual([
      ['kniebeuge-kg', 3],
      ['rudern-kh', 2],
      ['unterarmstuetz-kg', 3],
      ['split-kg', 3],
    ]);
    expect(exercises[1]?.sets[0]).toEqual({
      reps: 12,
      weightKg: null,
      durationS: null,
      rpe: null,
      done: true,
    });
    expect(exercises[2]?.sets[0]).toEqual({
      reps: null,
      weightKg: null,
      durationS: 30,
      rpe: null,
      done: true,
    });
    expect(exercises[3]?.sets[0]).toEqual({
      reps: null,
      weightKg: null,
      durationS: null,
      rpe: null,
      done: true,
    });
  });

  it('wird als Workout-Eintrag eine gültige freie Einheit (nur so dürfen Zeit-Sätze ohne Wdh. sein)', () => {
    const run = finishedRun();
    const summary = workoutRunSummary(steps, run, t0 + 10_000_000);
    const exercises = workoutLogExercises(workout, summary, workoutLibraryMap()).map((e, i) => ({
      id: `00000000-0000-4000-8000-00000000000${i}`,
      exerciseId: e.exerciseId,
      nameDe: e.nameDe,
      loadType: e.loadType,
      incrementKind: 'none' as const,
      sets: e.sets,
      weightConfirmed: false,
    }));
    const input = {
      id: '11111111-1111-4111-8111-111111111111',
      writeId: '22222222-2222-4222-8222-222222222222',
      kind: 'strength' as const,
      performedOn: '2026-10-20',
      today: '2026-10-20',
      exercises,
      cardio: null,
      sessionRpe: 6,
      notes: workoutLogNote({
        title: workout.title_de,
        difficulty: workout.difficulty,
        format: workout.format,
        summary,
        userNote: '',
      }),
      now: '2026-10-20T10:00:00.000Z',
    };
    const result = freeSessionLogFromInput({
      ...input,
      fromWorkout: true,
      startedAt: '2026-10-20T09:40:00.000Z',
      finishedAt: '2026-10-20T10:00:00.000Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toMatchObject({
      source: 'manual',
      is_free: true,
      started_at: '2026-10-20T09:40:00.000Z',
      finished_at: '2026-10-20T10:00:00.000Z',
      session_rpe: 6,
    });
    expect(sessionLogPayloadSchema.safeParse(result.payload).success).toBe(true);
    // Ohne „fromWorkout“ fehlen die Wiederholungen → abgelehnt (Regel der freien Einheit bleibt streng).
    const manual = freeSessionLogFromInput(input);
    expect(manual.ok).toBe(false);
    if (!manual.ok) expect(manual.errors).toContain('invalid_set');
  });

  it('Quelle „workout“ nur bei freien Kraft-Einheiten (Zod)', () => {
    const payload = {
      id: '11111111-1111-4111-8111-111111111111',
      write_id: '22222222-2222-4222-8222-222222222222',
      base_revision: null,
      planned_session_id: '33333333-3333-4333-8333-333333333333',
      planned_date: '2026-10-20',
      kind: 'strength',
      performed_on: '2026-10-20',
      started_at: null,
      finished_at: null,
      status: 'completed',
      session_rpe: null,
      notes: null,
      name_de: 'Ganzkörper A',
      is_intro_week: false,
      is_deload: false,
      source: 'workout',
      client_updated_at: '2026-10-20T10:00:00.000Z',
      exercises: [],
      cardio: null,
    };
    const result = sessionLogPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toContain('source');
  });

  it('übersprungene/fehlende Übungen fehlen im Eintrag', () => {
    let run = startWorkoutRun(steps, t0);
    run = endWorkoutRun(steps, run, t0 + 1000);
    const summary = workoutRunSummary(steps, run, t0 + 2000);
    expect(workoutLogExercises(workout, summary, workoutLibraryMap())).toEqual([]);
    const done = workoutRunSummary(steps, finishedRun(), t0 + 10_000_000);
    expect(workoutLogExercises(workout, done, new Map())).toEqual([]);
  });
});

describe('workoutLogNote und Sterne', () => {
  const summary = {
    roundsCompleted: 3,
    rounds: 3,
    workDone: 9,
    workTotal: 9,
    complete: true,
    activeS: 845,
  };

  it('Titel, Sterne, Runden, Minuten', () => {
    expect(
      workoutLogNote({
        title: 'Bauch-Blitz',
        difficulty: 2,
        format: 'circuit',
        summary,
        userNote: '',
      }),
    ).toBe('Workout „Bauch-Blitz“ (★★☆☆☆) · 3/3 Runden · 14 Min.');
  });

  it('Sätze bei Sätze × Wdh., „vorzeitig beendet“, eigene Notiz in neuer Zeile', () => {
    expect(
      workoutLogNote({
        title: 'Kurzhantel-Basis',
        difficulty: 2,
        format: 'sets_reps',
        summary: { ...summary, workDone: 5, complete: false, activeS: 10 },
        userNote: '  Gut gelaufen  ',
      }),
    ).toBe(
      'Workout „Kurzhantel-Basis“ (★★☆☆☆) · 5/9 Sätze · 1 Min. · vorzeitig beendet\nGut gelaufen',
    );
  });

  it('nie länger als die Notiz-Grenze (eigene Notiz wird gekürzt)', () => {
    const note = workoutLogNote({
      title: 'Test',
      difficulty: 5,
      format: 'circuit',
      summary,
      userNote: '🙂'.repeat(400),
    });
    expect(codePointLength(note)).toBe(SESSION_LOG_LIMITS.notesMaxChars);
    expect(note.endsWith('…')).toBe(true);
  });

  it('Sterne als Zeichen, geklemmt', () => {
    expect(workoutStars(1)).toBe('★☆☆☆☆');
    expect(workoutStars(5)).toBe('★★★★★');
    expect(workoutStars(9)).toBe('★★★★★');
    expect(workoutStars(0)).toBe('★☆☆☆☆');
  });
});

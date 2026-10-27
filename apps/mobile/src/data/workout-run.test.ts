import { randomUUID } from 'node:crypto';

import {
  advanceWorkoutRun,
  completeWorkoutStep,
  endWorkoutRun,
  type Exercise,
  sessionLogPayloadSchema,
  skipWorkoutStep,
  type Workout,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { planPersonRows, seededBackend, TODAY, USER_ID } from '../test/fixtures';
import { draftToPayload } from './workout-draft';
import { markWorkoutSource, workoutsFromBundle, workoutsFromDbRows } from './workout-library';
import { activeRunStore, startActiveRun, workoutLogDraft } from './workout-run';
import { CONTENT_BUNDLE } from '../generated/content-files';

const T0 = Date.parse(`${TODAY}T08:00:00.000Z`);

async function setup() {
  const s = seededBackend(planPersonRows());
  const library = await s.backend.loadPlanLibrary({ allowCached: true });
  if (!library) throw new Error('Keine Bibliothek');
  const { workouts } = await s.backend.loadWorkoutLibrary();
  const find = (id: string) => {
    const workout = workouts.find((w) => w.id === id);
    if (!workout) throw new Error(`Workout ${id} fehlt`);
    return workout;
  };
  return { ...s, exercises: library.exercises as ReadonlyMap<string, Exercise>, workouts, find };
}

/** Lauf bis zum Ende: Zeitübungen laufen ab, Übungen nach Wiederholungen werden sofort abgehakt. */
function runToEnd(active: ReturnType<typeof startActiveRun>) {
  let run = active.run;
  let now = T0;
  for (let i = 0; i < 2000 && run.finishedAtMs === null; i += 1) {
    now += 1000;
    run = advanceWorkoutRun(active.steps, run, now);
    const step = active.steps[run.index];
    if (run.finishedAtMs === null && step?.kind === 'work' && step.seconds === null) {
      run = completeWorkoutStep(active.steps, run, now);
    }
  }
  return { ...active, run, now };
}

describe('Workout-Bibliothek im Testmodus', () => {
  it('lädt die freigegebenen Workouts aus dem Bündel (Startbestand 20–30) plus Lauf-Kraft- und Rudern-Entwürfe', async () => {
    const s = await setup();
    const published = s.workouts.filter((w) => w.status === 'published');
    expect(published.length).toBeGreaterThanOrEqual(20);
    expect(published.length).toBeLessThanOrEqual(30);
    expect(
      s.workouts
        .filter((w) => w.status === 'draft')
        .every((w) => w.category === 'run_strength' || w.category === 'rowing'),
    ).toBe(true);
    // Etappe R: 10 Rudern-Workouts (Entwürfe, im Testmodus als „Testinhalt“).
    expect(s.workouts.filter((w) => w.category === 'rowing')).toHaveLength(10);
    expect(new Set(s.workouts.map((w) => w.difficulty))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(s.workouts.some((w) => w.equipment_ids.length === 0)).toBe(true);
    for (const w of s.workouts) {
      expect(w.minutes).toBeGreaterThanOrEqual(10);
      expect(w.minutes).toBeLessThanOrEqual(45);
      for (const item of w.exercises) expect(s.exercises.has(item.exercise_id)).toBe(true);
    }
  });

  it('workoutsFromBundle: Entwürfe (außer Lauf-Kraft) und Workouts mit blockierendem Befund fehlen', () => {
    const [first, second] = CONTENT_BUNDLE.workoutFiles;
    if (!first || !second) throw new Error('Bündel ohne Workouts');
    const draft = { ...first, data: { ...(first.data as Workout), status: 'draft' } };
    const broken = {
      ...second,
      data: {
        ...(second.data as Workout),
        exercises: [
          ...(second.data as Workout).exercises.slice(1),
          { ...(second.data as Workout).exercises[0], exercise_id: 'gibt-es-nicht' },
        ],
      },
    };
    const ids = workoutsFromBundle(CONTENT_BUNDLE.files, [draft, broken]).map((w) => w.id);
    expect(ids).toEqual([]);
    expect(workoutsFromBundle(CONTENT_BUNDLE.files, [first]).map((w) => w.id)).toEqual([
      (first.data as Workout).id,
    ]);
    // Lauf-Kraft-Entwürfe (docs/PLAN-CALISTHENICS-SCHLINGE.md 4) sind im Testmodus dabei.
    const runStrength = CONTENT_BUNDLE.workoutFiles.filter(
      (f) => (f.data as Workout).category === 'run_strength',
    );
    expect(runStrength.length).toBe(4);
    expect(workoutsFromBundle(CONTENT_BUNDLE.files, runStrength).map((w) => w.status)).toEqual([
      'draft',
      'draft',
      'draft',
      'draft',
    ]);
  });

  it('workoutsFromDbRows: nur gültige freigegebene Zeilen', () => {
    const valid = CONTENT_BUNDLE.workoutFiles[0]?.data as Workout;
    expect(
      workoutsFromDbRows([
        { data: valid },
        { data: { ...valid, status: 'archived' } },
        { data: { id: 'kaputt' } },
      ]).map((w) => w.id),
    ).toEqual([valid.id]);
  });
});

describe('Workout abschließen → freie Einheit am Tag (Herkunft „workout“)', () => {
  it('komplett: Eintrag mit allen Übungen/Runden, Notiz, Anstrengung, Herkunft „workout“', async () => {
    const s = await setup();
    const workout = s.find('bauch-blitz');
    const active = runToEnd(
      startActiveRun({ ownerUserId: USER_ID, workout, nowMs: T0, newId: randomUUID }),
    );
    const result = workoutLogDraft({
      active,
      workout,
      exercises: s.exercises,
      nowMs: active.now,
      today: TODAY,
      sessionRpe: 7,
      userNote: 'Lief gut',
      newId: randomUUID,
    });
    if (!result.ok) throw new Error('kein Entwurf');
    const { draft } = result;
    expect(draft).toMatchObject({ logId: active.logId, workoutId: 'bauch-blitz', isFree: true });
    const payload = draftToPayload(draft, {
      writeId: randomUUID(),
      now: new Date(active.now).toISOString(),
      today: TODAY,
    });
    expect(sessionLogPayloadSchema.safeParse(payload).success).toBe(true);
    expect(payload).toMatchObject({
      is_free: true,
      source: 'manual',
      session_rpe: 7,
      name_de: 'Freie Kraft-Einheit',
      started_at: active.startedAt,
    });
    expect(payload.notes).toBe('Workout „Bauch-Blitz“ (★★☆☆☆) · 3/3 Runden · 12 Min.\nLief gut');
    expect(payload.exercises).toHaveLength(workout.exercises.length);
    expect(payload.exercises.every((e) => e.sets.length === workout.rounds)).toBe(true);

    expect(await s.backend.submitWorkout(draft, payload)).toEqual({
      kind: 'saved',
      orphaned: false,
    });
    const { rows } = await s.backend.loadRows();
    const log = rows.sessionLogs.find((l) => l.id === active.logId);
    expect(log).toMatchObject({ source: 'workout', is_free: true, performed_on: TODAY });
    expect(rows.exerciseLogs.filter((e) => e.session_log_id === active.logId)).toHaveLength(
      workout.exercises.length,
    );

    // Erneut gesendet (gleiche Fassung): kein zweiter Eintrag.
    expect(await s.backend.submitWorkout(draft, payload)).toEqual({
      kind: 'saved',
      orphaned: false,
    });
    const again = await s.backend.loadRows();
    expect(again.rows.sessionLogs.filter((l) => l.source === 'workout')).toHaveLength(1);
  });

  it('vorzeitig beendet mit übersprungener Übung: nur Erledigtes, Notiz „vorzeitig beendet“', async () => {
    const s = await setup();
    const workout = s.find('kurzhantel-basis');
    const active = startActiveRun({ ownerUserId: USER_ID, workout, nowMs: T0, newId: randomUUID });
    let run = completeWorkoutStep(active.steps, active.run, T0 + 1000); // Vorbereitung
    run = completeWorkoutStep(active.steps, run, T0 + 40_000); // Goblet Satz 1
    run = completeWorkoutStep(active.steps, run, T0 + 60_000); // Pause
    run = skipWorkoutStep(active.steps, run, T0 + 61_000); // Goblet Satz 2 übersprungen
    run = endWorkoutRun(active.steps, run, T0 + 120_000);
    const result = workoutLogDraft({
      active: { ...active, run },
      workout,
      exercises: s.exercises,
      nowMs: T0 + 130_000,
      today: TODAY,
      sessionRpe: null,
      userNote: '',
      newId: randomUUID,
    });
    if (!result.ok) throw new Error('kein Entwurf');
    const payload = draftToPayload(result.draft, {
      writeId: randomUUID(),
      now: new Date(T0 + 130_000).toISOString(),
      today: TODAY,
    });
    expect(sessionLogPayloadSchema.safeParse(payload).success).toBe(true);
    expect(payload.exercises).toHaveLength(1);
    expect(payload.exercises[0]).toMatchObject({ exercise_id: 'goblet-kniebeuge' });
    expect(payload.exercises[0]?.sets).toEqual([
      { set_no: 1, reps: 10, weight_kg: null, duration_s: null, rpe: null, done: true },
    ]);
    expect(payload.notes).toContain('1/14 Sätze');
    expect(payload.notes).toContain('vorzeitig beendet');
    expect(payload.finished_at).toBe(new Date(T0 + 120_000).toISOString());
  });

  it('nichts erledigt → kein Entwurf', async () => {
    const s = await setup();
    const workout = s.find('bauch-blitz');
    const active = startActiveRun({ ownerUserId: USER_ID, workout, nowMs: T0, newId: randomUUID });
    const run = endWorkoutRun(active.steps, active.run, T0 + 2000);
    expect(
      workoutLogDraft({
        active: { ...active, run },
        workout,
        exercises: s.exercises,
        nowMs: T0 + 3000,
        today: TODAY,
        sessionRpe: null,
        userNote: '',
        newId: randomUUID,
      }),
    ).toEqual({ ok: false, reason: 'nothing_done' });
  });

  it('markWorkoutSource: nur eigene freie Kraft-Einheit, idempotent', () => {
    const rows = {
      sessionLogs: [
        { id: 'a', is_free: true, kind: 'strength', source: 'manual' },
        { id: 'b', is_free: false, kind: 'strength', source: 'manual' },
        { id: 'c', is_free: true, kind: 'endurance', source: 'manual' },
        { id: 'd', is_free: true, kind: 'strength', source: 'gps' },
      ],
    } as unknown as Parameters<typeof markWorkoutSource>[0];
    const marked = markWorkoutSource(rows, 'a');
    expect(marked.sessionLogs.map((l) => l.source)).toEqual(['workout', 'manual', 'manual', 'gps']);
    expect(markWorkoutSource(marked, 'a')).toBe(marked);
    for (const id of ['b', 'c', 'd', 'x']) expect(markWorkoutSource(rows, id)).toBe(rows);
  });

  it('laufendes Workout: ein Speicher je App-Sitzung mit Abonnement', () => {
    const calls: number[] = [];
    const stop = activeRunStore.subscribe(() => calls.push(1));
    activeRunStore.set(null);
    expect(activeRunStore.get()).toBeNull();
    stop();
    activeRunStore.set(null);
    expect(calls).toHaveLength(1);
  });
});

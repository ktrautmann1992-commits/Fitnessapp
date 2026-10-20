import { describe, expect, it } from 'vitest';

import { WORKOUT_LIMITS } from '../constants';
import { makeWorkout, workoutItem } from './test-fixtures';
import {
  advanceWorkoutRun,
  buildWorkoutTimerPlan,
  completeWorkoutStep,
  endWorkoutRun,
  estimateWorkoutSeconds,
  pauseWorkoutRun,
  resumeWorkoutRun,
  skipWorkoutStep,
  startWorkoutRun,
  type WorkoutTimerStep,
  workoutRunSummary,
  workoutRunView,
} from './timer';

const P = WORKOUT_LIMITS.prepareS * 1000;
const s = (seconds: number) => seconds * 1000;

/** Intervall: 2 Übungen à 20 s, 10 s Pause, Runden-Pause 30 s. */
const interval = (rounds = 2, rest = 10, roundRest = 30) =>
  makeWorkout({
    format: 'interval',
    rounds,
    round_rest_s: roundRest,
    exercises: [
      workoutItem('kniebeuge-kg', { reps: null, duration_s: 20, rest_s: rest }),
      workoutItem('liegestuetz-kg', { reps: null, duration_s: 20, rest_s: rest }),
    ],
  });

const kinds = (steps: readonly WorkoutTimerStep[]) =>
  steps.map((step) =>
    step.kind === 'work'
      ? `W${step.itemIndex}.${step.pass}`
      : step.kind === 'rest'
        ? `R${step.seconds}${step.after[0]}`
        : 'P',
  );

describe('buildWorkoutTimerPlan', () => {
  it('Zirkel: Pause nach jeder Übung, Rundenpause statt Pause nach der letzten, am Ende keine', () => {
    expect(kinds(buildWorkoutTimerPlan(interval()))).toEqual([
      'P',
      'W0.1',
      'R10e',
      'W1.1',
      'R30r',
      'W0.2',
      'R10e',
      'W1.2',
    ]);
  });

  it('0 s Pause: keine Pausen-Schritte', () => {
    expect(kinds(buildWorkoutTimerPlan(interval(2, 0, 0)))).toEqual([
      'P',
      'W0.1',
      'W1.1',
      'W0.2',
      'W1.2',
    ]);
  });

  it('1 Runde: keine Rundenpause', () => {
    expect(kinds(buildWorkoutTimerPlan(interval(1)))).toEqual(['P', 'W0.1', 'R10e', 'W1.1']);
  });

  it('10 Runden: 20 Übungs-Schritte, 9 Rundenpausen', () => {
    const steps = buildWorkoutTimerPlan(interval(10));
    expect(steps.filter((x) => x.kind === 'work')).toHaveLength(20);
    expect(steps.filter((x) => x.kind === 'rest' && x.after === 'round')).toHaveLength(9);
    expect(steps.at(-1)).toMatchObject({ kind: 'work', pass: 10, round: 10 });
  });

  it('Sätze × Wdh.: Satz für Satz, Pause zwischen Sätzen und nach der Übung', () => {
    const steps = buildWorkoutTimerPlan(
      makeWorkout({
        format: 'sets_reps',
        rounds: 1,
        round_rest_s: 0,
        exercises: [
          workoutItem('kniebeuge-kg', { sets: 2, rest_s: 60 }),
          workoutItem('liegestuetz-kg', { sets: 2, rest_s: 45 }),
        ],
      }),
    );
    expect(kinds(steps)).toEqual(['P', 'W0.1', 'R60s', 'W0.2', 'R60e', 'W1.1', 'R45s', 'W1.2']);
    expect(steps[1]).toMatchObject({ seconds: null, reps: 10, passes: 2, round: 1 });
  });

  it('Schätzung: Wiederholungen × 3 s, einseitig doppelt, ohne Vorbereitung', () => {
    const steps = buildWorkoutTimerPlan(makeWorkout());
    expect(estimateWorkoutSeconds(steps)).toBe(420);
    expect(estimateWorkoutSeconds(steps, (id) => id === 'kniebeuge-kg')).toBe(420 + 3 * 30);
  });
});

describe('Lauf', () => {
  const steps = buildWorkoutTimerPlan(interval());
  const t0 = 1_000_000;

  it('läuft nach Zeit automatisch weiter (Vorbereitung → Übung → Pause …)', () => {
    const run = startWorkoutRun(steps, t0);
    expect(workoutRunView(steps, run, t0).view).toMatchObject({
      index: 0,
      remainingS: 5,
      nextWork: { exerciseId: 'kniebeuge-kg', pass: 1 },
    });
    const { view } = workoutRunView(steps, run, t0 + P + s(5));
    expect(view).toMatchObject({ index: 1, remainingS: 15, round: 1, rounds: 2 });
    expect(view.nextWork).toMatchObject({ exerciseId: 'liegestuetz-kg', pass: 1 });
    // In der Pause zeigt die Vorschau die nächste Übung.
    const rest = workoutRunView(steps, run, t0 + P + s(25)).view;
    expect(rest.step).toMatchObject({ kind: 'rest', seconds: 10 });
    expect(rest).toMatchObject({ remainingS: 5, workDone: 1 });
    expect(rest.nextWork).toMatchObject({ exerciseId: 'liegestuetz-kg' });
  });

  it('nach langer Zeit im Hintergrund: Ende erreicht, alle Zeit-Übungen erledigt', () => {
    const run = startWorkoutRun(steps, t0);
    const later = advanceWorkoutRun(steps, run, t0 + s(3600));
    expect(later.finishedAtMs).toBe(t0 + P + s(20 + 10 + 20 + 30 + 20 + 10 + 20));
    const summary = workoutRunSummary(steps, later, t0 + s(3600));
    expect(summary).toMatchObject({
      workDone: 4,
      workTotal: 4,
      roundsCompleted: 2,
      complete: true,
    });
    expect(summary.activeS).toBe(5 + 130);
  });

  it('Pausieren hält die Zeit an, Fortsetzen läuft weiter', () => {
    let run = startWorkoutRun(steps, t0);
    run = pauseWorkoutRun(steps, run, t0 + P + s(5));
    // 60 s pausiert: Stand bleibt.
    expect(workoutRunView(steps, run, t0 + P + s(65)).view).toMatchObject({
      paused: true,
      index: 1,
      remainingS: 15,
    });
    run = resumeWorkoutRun(run, t0 + P + s(65));
    expect(workoutRunView(steps, run, t0 + P + s(75)).view).toMatchObject({
      paused: false,
      index: 1,
      remainingS: 5,
    });
    // Ende verschiebt sich um die Pause.
    const done = advanceWorkoutRun(steps, run, t0 + s(3600));
    expect(done.finishedAtMs).toBe(t0 + P + s(130 + 60));
    expect(workoutRunSummary(steps, done, t0 + s(3600)).activeS).toBe(5 + 130);
  });

  it('doppelt pausieren bzw. fortsetzen ändert nichts', () => {
    const run = pauseWorkoutRun(steps, startWorkoutRun(steps, t0), t0 + s(1));
    expect(pauseWorkoutRun(steps, run, t0 + s(2))).toBe(run);
    const resumed = resumeWorkoutRun(run, t0 + s(3));
    expect(resumeWorkoutRun(resumed, t0 + s(4))).toBe(resumed);
  });

  it('Überspringen: Übung zählt nicht, Pause/Vorbereitung endet sofort', () => {
    let run = startWorkoutRun(steps, t0);
    run = skipWorkoutStep(steps, run, t0 + s(1)); // Vorbereitung beendet
    expect(run.index).toBe(1);
    run = skipWorkoutStep(steps, run, t0 + s(3)); // Übung übersprungen
    expect(run.results[1]).toEqual({ status: 'skipped', seconds: 2 });
    run = completeWorkoutStep(steps, run, t0 + s(4)); // Pause vorzeitig beendet
    expect(workoutRunView(steps, run, t0 + s(4)).view).toMatchObject({
      index: 3,
      remainingS: 20,
      workDone: 0,
      workSkipped: 1,
    });
    const end = advanceWorkoutRun(steps, run, t0 + s(3600));
    const summary = workoutRunSummary(steps, end, t0 + s(3600));
    expect(summary).toMatchObject({ workDone: 3, roundsCompleted: 1, complete: false });
    expect(summary.items[0]?.done.map((d) => d.pass)).toEqual([2]);
    expect(summary.items[0]?.skipped).toBe(1);
  });

  it('Pause beim Überspringen wird aufgehoben', () => {
    let run = pauseWorkoutRun(steps, startWorkoutRun(steps, t0), t0 + s(2));
    run = skipWorkoutStep(steps, run, t0 + s(10));
    expect(run.pausedAtMs).toBeNull();
    expect(run.totalPausedMs).toBe(s(8));
  });

  it('Wiederholungen warten auf „Erledigt“ (Sätze abhaken)', () => {
    const sets = buildWorkoutTimerPlan(
      makeWorkout({
        format: 'sets_reps',
        rounds: 1,
        round_rest_s: 0,
        exercises: [
          workoutItem('kniebeuge-kg', { sets: 2, rest_s: 60 }),
          workoutItem('liegestuetz-kg', { sets: 1, rest_s: 0 }),
        ],
      }),
    );
    let run = startWorkoutRun(sets, t0);
    run = advanceWorkoutRun(sets, run, t0 + s(600));
    expect(run.index).toBe(1);
    expect(workoutRunView(sets, run, t0 + s(600)).view.remainingS).toBeNull();
    run = completeWorkoutStep(sets, run, t0 + s(640));
    expect(run.results[1]).toEqual({ status: 'done', seconds: 635 });
    // Pause 60 s läuft von selbst.
    run = advanceWorkoutRun(sets, run, t0 + s(700));
    expect(run.index).toBe(3);
    run = completeWorkoutStep(sets, run, t0 + s(730)); // Satz 2 abgehakt
    run = completeWorkoutStep(sets, run, t0 + s(740)); // Pause nach der Übung vorzeitig beendet
    expect(run.finishedAtMs).toBeNull();
    run = completeWorkoutStep(sets, run, t0 + s(760));
    expect(run.finishedAtMs).toBe(t0 + s(760));
    const summary = workoutRunSummary(sets, run, t0 + s(800));
    expect(summary).toMatchObject({
      workDone: 3,
      workTotal: 3,
      complete: true,
      roundsCompleted: 1,
    });
  });

  it('Beenden: laufende Übung zählt nicht, Lauf endet jetzt', () => {
    let run = startWorkoutRun(steps, t0);
    run = endWorkoutRun(steps, run, t0 + P + s(30)); // erste Übung fertig, in der Pause beendet
    expect(run.finishedAtMs).toBe(t0 + P + s(30));
    const summary = workoutRunSummary(steps, run, t0 + s(999));
    expect(summary).toMatchObject({
      workDone: 1,
      roundsCompleted: 0,
      complete: false,
      activeS: 35,
    });
    // Nach dem Ende ändert nichts mehr den Lauf.
    expect(completeWorkoutStep(steps, run, t0 + s(1000))).toBe(run);
    expect(skipWorkoutStep(steps, run, t0 + s(1000))).toBe(run);
    expect(endWorkoutRun(steps, run, t0 + s(1000))).toBe(run);
    expect(workoutRunView(steps, run, t0 + s(1000)).view).toMatchObject({
      finished: true,
      step: null,
      nextWork: null,
    });
  });

  it('Uhr springt zurück: nie negative Zeiten', () => {
    const run = startWorkoutRun(steps, t0);
    const { view } = workoutRunView(steps, run, t0 - s(100));
    expect(view).toMatchObject({ index: 0, remainingS: 5, stepElapsedS: 0, activeS: 0 });
  });

  it('leerer Ablauf ist ein Programmierfehler', () => {
    expect(() => startWorkoutRun([], t0)).toThrow(RangeError);
  });
});

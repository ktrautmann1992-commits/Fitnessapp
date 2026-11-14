import { describe, expect, it } from 'vitest';

import { WORKOUT_LIMITS, WORKOUT_PLAYER } from '../constants';
import {
  countdownCue,
  howToLines,
  isPowerWorkout,
  playerFocus,
  repTimeBoxS,
  timeBoxSteps,
  workoutPlayerPlan,
} from './player';
import { makeWorkout, workoutItem } from './test-fixtures';
import {
  buildWorkoutTimerPlan,
  completeWorkoutStep,
  startWorkoutRun,
  workoutRunView,
  type WorkoutWorkStep,
} from './timer';
import { capWorkoutRun, wodTimeCapS } from './wod';

const { minS, maxS } = WORKOUT_PLAYER.timeBox;
const works = (steps: ReturnType<typeof workoutPlayerPlan>) =>
  steps.filter((s): s is WorkoutWorkStep => s.kind === 'work');

describe('isPowerWorkout', () => {
  it('Zirkel, Intervalle und Sätze × Wdh. bekommen Zeitfenster; Flow läuft ohnehin nach Zeit', () => {
    expect(isPowerWorkout({ format: 'circuit' })).toBe(true);
    expect(isPowerWorkout({ format: 'interval' })).toBe(true);
    expect(isPowerWorkout({ format: 'sets_reps' })).toBe(true);
    expect(isPowerWorkout({ format: 'flow' })).toBe(false);
  });
});

describe('repTimeBoxS', () => {
  it('Wiederholungen × 3 s, auf 5 s aufgerundet', () => {
    expect(repTimeBoxS(10)).toBe(30);
    expect(repTimeBoxS(12)).toBe(40);
    expect(repTimeBoxS(15)).toBe(45);
  });

  it('einseitige Übungen doppelt', () => {
    expect(repTimeBoxS(10, true)).toBe(60);
  });

  it('Grenzfälle: Mindest- und Höchstzeit, 0 und negative Werte', () => {
    expect(repTimeBoxS(WORKOUT_LIMITS.reps.min)).toBe(minS);
    expect(repTimeBoxS(1)).toBe(minS);
    expect(repTimeBoxS(0)).toBe(minS);
    expect(repTimeBoxS(-5)).toBe(minS);
    expect(repTimeBoxS(WORKOUT_LIMITS.reps.max)).toBe(maxS);
    expect(repTimeBoxS(WORKOUT_LIMITS.reps.max, true)).toBe(maxS);
  });

  it('bleibt innerhalb der erlaubten Arbeitszeit eines Workouts', () => {
    for (let reps = WORKOUT_LIMITS.reps.min; reps <= WORKOUT_LIMITS.reps.max; reps += 1) {
      for (const uni of [false, true]) {
        const s = repTimeBoxS(reps, uni);
        expect(s).toBeGreaterThanOrEqual(WORKOUT_LIMITS.workS.min);
        expect(s).toBeLessThanOrEqual(WORKOUT_LIMITS.workS.max);
      }
    }
  });
});

describe('workoutPlayerPlan', () => {
  it('Zirkel: jede Übung hat Sekunden, Wiederholungen bleiben als Vorgabe', () => {
    const steps = workoutPlayerPlan(makeWorkout());
    expect(steps[0]).toEqual({ kind: 'prepare', seconds: WORKOUT_LIMITS.prepareS });
    expect(WORKOUT_LIMITS.prepareS).toBe(10);
    for (const step of works(steps)) expect(step.seconds).not.toBeNull();
    const squat = works(steps)[0]!;
    expect(squat).toMatchObject({ reps: 10, seconds: 30, timeBoxed: true });
    // Übung nach Zeit: unverändert, kein Zeitfenster-Merkmal.
    const plank = works(steps)[2]!;
    expect(plank.seconds).toBe(30);
    expect(plank.timeBoxed).toBeUndefined();
  });

  it('einseitige Übungen bekommen das doppelte Zeitfenster', () => {
    const steps = workoutPlayerPlan(makeWorkout(), (id) => id === 'liegestuetz-kg');
    expect(works(steps)[1]!.seconds).toBe(60);
  });

  it('Sätze × Wdh.: jeder Satz mit Zeitfenster, Satzpausen wie bisher – kein Schritt wartet', () => {
    const strength = makeWorkout({
      format: 'sets_reps',
      rounds: 1,
      exercises: [
        workoutItem('kniebeuge-kg', { sets: 3 }),
        workoutItem('liegestuetz-kg', { sets: 3 }),
      ],
    });
    const steps = workoutPlayerPlan(strength);
    expect(steps.map((s) => s.kind)).toEqual(buildWorkoutTimerPlan(strength).map((s) => s.kind));
    expect(works(steps)).toHaveLength(6);
    expect(works(steps).every((s) => s.seconds === 30 && s.timeBoxed)).toBe(true);
  });

  it('Flow bleibt unverändert (schon nach Zeit)', () => {
    const flow = makeWorkout({
      format: 'flow',
      category: 'yoga',
      rounds: 1,
      round_rest_s: 0,
      exercises: [
        workoutItem('kniebeuge-kg', { reps: null, duration_s: 30, rest_s: 0 }),
        workoutItem('liegestuetz-kg', { reps: null, duration_s: 30, rest_s: 0 }),
      ],
    });
    expect(workoutPlayerPlan(flow)).toEqual(buildWorkoutTimerPlan(flow));
  });

  it('1 Übung vs. viele Runden: Länge und Reihenfolge wie der Timer-Plan', () => {
    const single = makeWorkout({
      rounds: 1,
      exercises: [workoutItem('kniebeuge-kg'), workoutItem('liegestuetz-kg')],
    });
    expect(workoutPlayerPlan(single).map((s) => s.kind)).toEqual(
      buildWorkoutTimerPlan(single).map((s) => s.kind),
    );
    const many = makeWorkout({ rounds: WORKOUT_LIMITS.rounds.max });
    expect(workoutPlayerPlan(many)).toHaveLength(buildWorkoutTimerPlan(many).length);
  });

  it('läuft ohne ein einziges Tippen bis zum Ende durch', () => {
    const steps = workoutPlayerPlan(makeWorkout());
    const run = startWorkoutRun(steps, 0);
    const total = steps.reduce((sum, s) => sum + (s.kind === 'work' ? s.seconds! : s.seconds), 0);
    const { view } = workoutRunView(steps, run, total * 1000);
    expect(view.finished).toBe(true);
    expect(view.workDone).toBe(view.workTotal);
    // Kurz vorher: noch nicht fertig.
    expect(workoutRunView(steps, run, total * 1000 - 1).view.finished).toBe(false);
  });

  it('„Fertig“ geht vor Ablauf des Zeitfensters weiter', () => {
    const steps = workoutPlayerPlan(makeWorkout());
    const P = WORKOUT_LIMITS.prepareS * 1000;
    const run = completeWorkoutStep(steps, startWorkoutRun(steps, 0), P + 5000);
    const { view } = workoutRunView(steps, run, P + 5000);
    expect(view.step?.kind).toBe('rest');
    expect(run.results[1]).toEqual({ status: 'done', seconds: 5 });
  });

  it('AMRAP: Zeitlimit beendet den Lauf auch mit Zeitfenstern, ohne Tippen', () => {
    const amrap = makeWorkout({ title_de: 'AMRAP 5 – Test', minutes: 5, rounds: 3 });
    const steps = workoutPlayerPlan(amrap);
    expect(works(steps).every((s) => s.seconds !== null)).toBe(true);
    const cap = wodTimeCapS(amrap);
    const run = capWorkoutRun(steps, startWorkoutRun(steps, 0), 5 * 60 * 1000, cap);
    expect(run.finishedAtMs).toBe(5 * 60 * 1000);
  });
});

describe('playerFocus', () => {
  const steps = workoutPlayerPlan(makeWorkout());
  const run = startWorkoutRun(steps, 0);

  it('Countdown zeigt schon die erste Übung (kommend), ohne kleine Vorschau', () => {
    const { view } = workoutRunView(steps, run, 0);
    const focus = playerFocus(view);
    expect(view.step?.kind).toBe('prepare');
    expect(focus.upcoming).toBe(true);
    expect(focus.exercise?.exerciseId).toBe('kniebeuge-kg');
    expect(focus.next).toBeNull();
  });

  it('während einer Übung: diese Übung groß, „Als Nächstes“ die folgende', () => {
    const { view } = workoutRunView(steps, run, WORKOUT_LIMITS.prepareS * 1000 + 1);
    const focus = playerFocus(view);
    expect(focus).toMatchObject({ upcoming: false });
    expect(focus.exercise?.exerciseId).toBe('kniebeuge-kg');
    expect(focus.next?.exerciseId).toBe('liegestuetz-kg');
  });

  it('in der Pause: die kommende Übung groß', () => {
    const at = (WORKOUT_LIMITS.prepareS + 30) * 1000 + 1;
    const { view } = workoutRunView(steps, run, at);
    expect(view.step?.kind).toBe('rest');
    const focus = playerFocus(view);
    expect(focus.upcoming).toBe(true);
    expect(focus.exercise?.exerciseId).toBe('liegestuetz-kg');
  });

  it('fertig: nichts mehr', () => {
    expect(playerFocus({ step: null, nextWork: null })).toEqual({
      exercise: null,
      upcoming: false,
      next: null,
    });
  });
});

describe('countdownCue', () => {
  const base = {
    finished: false,
    paused: false,
    index: 4,
    step: { kind: 'rest', seconds: 15, after: 'exercise' },
  } as const;

  it('3, 2, 1 Sekunden vor dem Wechsel je ein Signal mit eigenem Schlüssel', () => {
    expect(countdownCue({ ...base, remainingS: 3 })).toEqual({ key: '4:3', secondsLeft: 3 });
    expect(countdownCue({ ...base, remainingS: 1 })).toEqual({ key: '4:1', secondsLeft: 1 });
  });

  it('kein Signal davor, bei 0, pausiert, fertig oder ohne Zeit', () => {
    expect(countdownCue({ ...base, remainingS: 4 })).toBeNull();
    expect(countdownCue({ ...base, remainingS: 0 })).toBeNull();
    expect(countdownCue({ ...base, remainingS: 2, paused: true })).toBeNull();
    expect(countdownCue({ ...base, remainingS: 2, finished: true })).toBeNull();
    expect(countdownCue({ ...base, remainingS: null })).toBeNull();
    expect(countdownCue({ ...base, step: null, remainingS: 2 })).toBeNull();
  });
});

describe('timeBoxSteps', () => {
  it('lässt Schritte ohne Wiederholungen unverändert', () => {
    const steps = buildWorkoutTimerPlan(makeWorkout());
    const boxed = timeBoxSteps(steps);
    expect(boxed.filter((s) => s.kind !== 'work')).toEqual(steps.filter((s) => s.kind !== 'work'));
  });
});

describe('howToLines', () => {
  it('die ersten Schritte der Beschreibung, robust ohne Übung', () => {
    expect(howToLines({ steps_de: ['a', 'b', 'c'] })).toEqual(['a', 'b']);
    expect(howToLines({ steps_de: ['a', 'b', 'c'] }, 3)).toEqual(['a', 'b', 'c']);
    expect(howToLines(null)).toEqual([]);
    expect(howToLines({})).toEqual([]);
    expect(howToLines({ steps_de: ['a'] }, -1)).toEqual([]);
  });
});

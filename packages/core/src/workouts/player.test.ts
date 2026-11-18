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

  it('einseitige Übung nach Wiederholungen: je Seite ein eigenes Zeitfenster, dazwischen der Seitenwechsel', () => {
    const steps = workoutPlayerPlan(makeWorkout({ rounds: 1 }), (id) => id === 'liegestuetz-kg');
    // Vorbereitung, Kniebeuge, Pause, Liegestütz links, Seitenwechsel, Liegestütz rechts, Pause, Unterarmstütz.
    expect(steps.map((s) => (s.kind === 'rest' ? `rest:${s.after}` : s.kind))).toEqual([
      'prepare',
      'work',
      'rest:exercise',
      'work',
      'rest:side',
      'work',
      'rest:exercise',
      'work',
    ]);
    const [left, right] = works(steps).filter((s) => s.exerciseId === 'liegestuetz-kg');
    expect(left).toMatchObject({ side: 'left', reps: 10, seconds: 30, timeBoxed: true });
    expect(right).toMatchObject({ side: 'right', reps: 10, seconds: 30, timeBoxed: true });
    expect(steps[4]).toEqual({ kind: 'rest', seconds: WORKOUT_PLAYER.sideSwitchS, after: 'side' });
    expect(WORKOUT_PLAYER.sideSwitchS).toBe(5);
    // Ohne Seiten-Schritte bliebe es das doppelte Fenster in einem Schritt.
    expect(repTimeBoxS(10, true)).toBe(60);
  });

  it('einseitige Übung nach Zeit: linke Seite volle Zeit → Seite wechseln → rechte Seite volle Zeit → Pause', () => {
    const workout = makeWorkout({
      format: 'interval',
      rounds: 2,
      round_rest_s: 40,
      exercises: [
        workoutItem('split-kg', { reps: null, duration_s: 45, rest_s: 15 }),
        workoutItem('unterarmstuetz-kg', { reps: null, duration_s: 30, rest_s: 15 }),
      ],
    });
    const uni = (id: string) => id === 'split-kg';
    const steps = workoutPlayerPlan(workout, uni);
    const round1 = steps.slice(1, 6);
    expect(round1).toEqual([
      expect.objectContaining({ kind: 'work', exerciseId: 'split-kg', side: 'left', seconds: 45 }),
      { kind: 'rest', seconds: 5, after: 'side' },
      expect.objectContaining({ kind: 'work', exerciseId: 'split-kg', side: 'right', seconds: 45 }),
      { kind: 'rest', seconds: 15, after: 'exercise' },
      expect.objectContaining({ kind: 'work', exerciseId: 'unterarmstuetz-kg', seconds: 30 }),
    ]);
    // Zweiseitige Übung unverändert: keine Seite.
    expect('side' in steps[5]!).toBe(false);
    expect(works(steps)).toHaveLength(6);
    // Beide Seiten gehören zu derselben Runde und demselben Durchgang.
    expect(works(steps).filter((s) => s.round === 2 && s.exerciseId === 'split-kg')).toHaveLength(
      2,
    );
  });

  it('ohne einseitige Übungen bleibt der Plan unverändert', () => {
    const workout = makeWorkout();
    expect(workoutPlayerPlan(workout, () => false)).toEqual(workoutPlayerPlan(workout));
    expect(workoutPlayerPlan(workout).some((s) => s.kind === 'rest' && s.after === 'side')).toBe(
      false,
    );
  });

  it('alle Formate: Zirkel, Intervall, Sätze × Wdh. und WOD teilen einseitige Übungen – Flow nicht', () => {
    const uni = (id: string) => id === 'split-kg';
    const items = [workoutItem('split-kg', { sets: 2 }), workoutItem('kniebeuge-kg', { sets: 2 })];
    for (const workout of [
      makeWorkout({ format: 'circuit', exercises: items }),
      makeWorkout({ format: 'interval', exercises: items }),
      makeWorkout({ format: 'sets_reps', rounds: 1, exercises: items }),
      makeWorkout({
        format: 'circuit',
        title_de: 'AMRAP 12 – Test',
        minutes: 12,
        exercises: items,
      }),
    ]) {
      const sides = works(workoutPlayerPlan(workout, uni)).filter(
        (s) => s.exerciseId === 'split-kg',
      );
      expect(sides.length, workout.format).toBeGreaterThan(0);
      expect(
        sides.every((s) => s.side !== undefined),
        workout.format,
      ).toBe(true);
    }
    const flow = makeWorkout({
      format: 'flow',
      rounds: 1,
      exercises: [workoutItem('split-kg', { reps: null, duration_s: 30, rest_s: 0 })],
    });
    expect(works(workoutPlayerPlan(flow, uni)).every((s) => s.side === undefined)).toBe(true);
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
      nextIsOtherSide: false,
      sideSwitch: false,
    });
  });

  it('einseitig: linke Seite → „Als Nächstes“ ist die rechte Seite; Seitenwechsel zeigt dieselbe Übung', () => {
    const uniSteps = workoutPlayerPlan(
      makeWorkout({
        format: 'interval',
        rounds: 1,
        exercises: [
          workoutItem('split-kg', { reps: null, duration_s: 45, rest_s: 15 }),
          workoutItem('kniebeuge-kg', { reps: null, duration_s: 30 }),
        ],
      }),
      (id) => id === 'split-kg',
    );
    const uniRun = startWorkoutRun(uniSteps, 0);
    const at = (s: number) => workoutRunView(uniSteps, uniRun, s * 1000 + 1).view;
    const prep = WORKOUT_LIMITS.prepareS;
    const left = playerFocus(at(prep));
    expect(left.exercise).toMatchObject({ exerciseId: 'split-kg', side: 'left' });
    expect(left.next).toMatchObject({ exerciseId: 'split-kg', side: 'right' });
    expect(left.nextIsOtherSide).toBe(true);
    const sw = playerFocus(at(prep + 45));
    expect(sw).toMatchObject({ upcoming: true, sideSwitch: true, nextIsOtherSide: false });
    expect(sw.exercise).toMatchObject({ exerciseId: 'split-kg', side: 'right' });
    expect(at(prep + 45).remainingS).toBe(5);
    const right = playerFocus(at(prep + 50));
    expect(right.exercise).toMatchObject({ exerciseId: 'split-kg', side: 'right' });
    expect(right.next?.exerciseId).toBe('kniebeuge-kg');
    expect(right.nextIsOtherSide).toBe(false);
    // Danach die normale Pause.
    expect(at(prep + 95).step).toMatchObject({ kind: 'rest', after: 'exercise', seconds: 15 });
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

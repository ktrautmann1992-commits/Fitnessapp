import { describe, expect, it } from 'vitest';

import { WORKOUT_LIMITS } from '../constants';
import { checkWorkout } from './checks';
import { workoutLogNote } from './library';
import { makeWorkout, workoutItem, workoutLibraryMap } from './test-fixtures';
import {
  buildWorkoutTimerPlan,
  completeWorkoutStep,
  pauseWorkoutRun,
  resumeWorkoutRun,
  startWorkoutRun,
  workoutRunSummary,
} from './timer';
import {
  amrapScore,
  capWorkoutRun,
  wodCapReached,
  wodCapRemainingS,
  wodStyle,
  wodTimeCapS,
  wodTimerPlan,
} from './wod';

const amrap = makeWorkout({ title_de: 'AMRAP 10 – Test', minutes: 10, rounds: 3, round_rest_s: 0 });
const emom = makeWorkout({
  title_de: 'EMOM 6',
  format: 'interval',
  rounds: 3,
  round_rest_s: 20,
  minutes: 6,
  exercises: [
    workoutItem('kniebeuge-kg', { reps: null, duration_s: 40, rest_s: 20 }),
    workoutItem('unterarmstuetz-kg', { reps: null, duration_s: 40, rest_s: 0 }),
  ],
});

describe('wodStyle', () => {
  it('erkennt AMRAP, EMOM, For Time und Chipper am Titelanfang (Groß-/Kleinschreibung egal)', () => {
    expect(wodStyle(amrap)).toBe('amrap');
    expect(wodStyle(emom)).toBe('emom');
    expect(wodStyle(makeWorkout({ title_de: 'For Time – Leiter' }))).toBe('for_time');
    expect(wodStyle(makeWorkout({ title_de: 'chipper', rounds: 1 }))).toBe('chipper');
    expect(wodStyle(makeWorkout({ title_de: 'AMRAP12' }))).toBe('amrap');
  });

  it('kein WOD: anderer Titel, Wortanfang ohne Wortende, falsches Format', () => {
    expect(wodStyle(makeWorkout())).toBeNull();
    expect(wodStyle(makeWorkout({ title_de: 'Chippers Zirkel', rounds: 1 }))).toBeNull();
    expect(wodStyle(makeWorkout({ title_de: 'Mein AMRAP' }))).toBeNull();
    expect(wodStyle(makeWorkout({ title_de: 'AMRAP 10', format: 'sets_reps' }))).toBeNull();
    expect(wodStyle(makeWorkout({ title_de: 'Chipper', rounds: 2 }))).toBeNull();
  });

  it('EMOM nur, wenn jede Übung samt Pause genau eine Minute dauert', () => {
    expect(wodStyle({ ...emom, round_rest_s: 30 })).toBeNull();
    expect(wodStyle({ ...emom, format: 'circuit' })).toBeNull();
    const bad = {
      ...emom,
      exercises: [
        workoutItem('kniebeuge-kg', { reps: null, duration_s: 40, rest_s: 10 }),
        emom.exercises[1]!,
      ],
    };
    expect(wodStyle(bad)).toBeNull();
    // Eine Runde: die letzte Übung höchstens eine Minute (keine Pause danach).
    expect(wodStyle({ ...emom, rounds: 1, round_rest_s: 0 })).toBe('emom');
  });
});

describe('Zeitlimit', () => {
  it('AMRAP/For Time/Chipper = minutes, EMOM und normale Workouts ohne', () => {
    expect(wodTimeCapS(amrap)).toBe(600);
    expect(wodTimeCapS(makeWorkout({ title_de: 'For Time', minutes: 20 }))).toBe(1200);
    expect(wodTimeCapS(emom)).toBeNull();
    expect(wodTimeCapS(makeWorkout())).toBeNull();
  });

  it('AMRAP-Ablauf hat die Höchstzahl Runden, sonst wie buildWorkoutTimerPlan', () => {
    const steps = wodTimerPlan(amrap);
    const rounds = Math.max(...steps.map((s) => (s.kind === 'work' ? s.round : 0)));
    expect(rounds).toBe(WORKOUT_LIMITS.rounds.max);
    expect(wodTimerPlan(emom)).toEqual(buildWorkoutTimerPlan(emom));
  });

  it('endet genau am Limit, ohne Timer-Pausen mitzuzählen', () => {
    const steps = wodTimerPlan(amrap);
    const start = startWorkoutRun(steps, 0);
    expect(capWorkoutRun(steps, start, 599_000, 600).finishedAtMs).toBeNull();
    expect(wodCapRemainingS(start, 599_000, 600)).toBe(1);
    const paused = pauseWorkoutRun(steps, start, 100_000);
    const resumed = resumeWorkoutRun(paused, 160_000);
    expect(capWorkoutRun(steps, resumed, 650_000, 600).finishedAtMs).toBeNull();
    const ended = capWorkoutRun(steps, resumed, 700_000, 600);
    expect(ended.finishedAtMs).toBe(660_000);
    expect(wodCapReached(ended, 600)).toBe(true);
    expect(wodCapRemainingS(ended, 700_000, 600)).toBe(0);
  });

  it('pausiert unter dem Limit: läuft nie ab; pausiert über dem Limit: endet am Limit', () => {
    const steps = wodTimerPlan(amrap);
    const start = startWorkoutRun(steps, 0);
    const pausedEarly = pauseWorkoutRun(steps, start, 300_000);
    expect(capWorkoutRun(steps, pausedEarly, 5_000_000, 600).finishedAtMs).toBeNull();
    const pausedLate = { ...start, pausedAtMs: 650_000 };
    expect(capWorkoutRun(steps, pausedLate, 700_000, 600).finishedAtMs).toBe(600_000);
  });

  it('ohne Limit bzw. schon beendet: unverändert; vorzeitig beendet ist kein erreichtes Limit', () => {
    const steps = buildWorkoutTimerPlan(makeWorkout());
    const start = startWorkoutRun(steps, 0);
    expect(capWorkoutRun(steps, start, 9_999_000, null).finishedAtMs).toBeNull();
    expect(wodCapRemainingS(start, 1000, null)).toBeNull();
    expect(wodCapReached({ ...start, finishedAtMs: 100_000 }, 600)).toBe(false);
    expect(wodCapReached(start, 600)).toBe(false);
    expect(wodCapReached({ ...start, finishedAtMs: 100_000 }, null)).toBe(false);
  });
});

describe('AMRAP-Ergebnis und Notiz', () => {
  it('volle Runden plus Übungen der angefangenen Runde', () => {
    const steps = wodTimerPlan(amrap);
    let run = startWorkoutRun(steps, 0);
    let t = 5_000; // nach der Vorbereitung
    run = completeWorkoutStep(steps, run, t); // Vorbereitung (falls noch offen)
    // Runde 1 (3 Übungen) + 2 Übungen der Runde 2 erledigen.
    for (let i = 0; i < 5; i += 1) {
      t += 20_000;
      run = completeWorkoutStep(steps, run, t);
      // Zeit-Übung (Unterarmstütz 30 s) läuft von selbst; „Erledigt“ beendet sie.
    }
    run = capWorkoutRun(steps, run, 700_000, 600);
    const summary = workoutRunSummary(steps, run, 700_000);
    const score = amrapScore(summary);
    expect(score.rounds).toBeGreaterThanOrEqual(1);
    expect(score.rounds * 3 + score.extra).toBe(summary.workDone);
    const note = workoutLogNote({
      title: amrap.title_de,
      difficulty: amrap.difficulty,
      format: amrap.format,
      summary,
      userNote: '',
      wod: { style: 'amrap', capReached: wodCapReached(run, 600) },
    });
    expect(note).toContain(`AMRAP: ${score.rounds} Runden + ${score.extra} Übungen`);
    expect(note).toContain('Zeitlimit erreicht');
    expect(note).not.toContain('vorzeitig beendet');
  });

  it('For Time: genaue Zeit, wenn alles geschafft', () => {
    const note = workoutLogNote({
      title: 'For Time',
      difficulty: 4,
      format: 'circuit',
      summary: {
        roundsCompleted: 3,
        rounds: 3,
        workDone: 9,
        workTotal: 9,
        complete: true,
        activeS: 754,
      },
      userNote: '',
      wod: { style: 'for_time', capReached: false },
    });
    expect(note).toContain('Zeit 12:34');
    expect(note).toContain('3/3 Runden');
  });

  it('ohne Übungsliste zählt AMRAP nur volle Runden', () => {
    const note = workoutLogNote({
      title: 'AMRAP',
      difficulty: 3,
      format: 'circuit',
      summary: {
        roundsCompleted: 4,
        rounds: 10,
        workDone: 12,
        workTotal: 30,
        complete: false,
        activeS: 600,
      },
      userNote: '',
      wod: { style: 'amrap', capReached: true },
    });
    expect(note).toContain('AMRAP: 4 Runden + 0 Übungen');
  });
});

describe('Regel W6 mit Zeitlimit', () => {
  const library = workoutLibraryMap();
  it('For Time: kürzer geschätzt als das Limit ist in Ordnung, länger nicht', () => {
    const short = makeWorkout({ title_de: 'For Time – Test', minutes: 20 });
    expect(checkWorkout(short, library).filter((i) => i.rule === 'W6')).toEqual([]);
    const long = makeWorkout({ title_de: 'For Time – Test', minutes: 5, rounds: 10 });
    expect(checkWorkout(long, library).some((i) => i.rule === 'W6')).toBe(true);
  });
  it('ohne WOD-Titel gilt die Abweichung in beide Richtungen', () => {
    const w = makeWorkout({ minutes: 20 });
    expect(checkWorkout(w, library).some((i) => i.rule === 'W6')).toBe(true);
  });
});

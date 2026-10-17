import { describe, expect, it } from 'vitest';

import { easyWorkout, structuredWorkout } from './endurance-workouts';
import { hardWorkoutLimits, type WorkoutStep } from './intensity';
import {
  clockElapsedS,
  clockPause,
  clockResume,
  clockStart,
  INTERVAL_CLOCK_IDLE,
  intervalBlocks,
  intervalLoggedMinutes,
  intervalPosition,
  intervalTotalS,
} from './interval-timer';
import { planSafetyRules } from './safety';

/** Intervall-Timer (Etappe WP4): Uhr mit Pause, Stand im Ablauf, „Teile geschafft“, Minuten zum Eintragen. */

const step = (
  part: WorkoutStep['part'],
  kind: WorkoutStep['kind'],
  seconds: number,
  effort: number,
): WorkoutStep => ({ part, kind, seconds, effort });

// 10 min Aufwärmen, 3 × (3 min zügig / 2 min locker) ohne Pause nach der letzten, 5 min Abwärmen.
const steps: WorkoutStep[] = [
  step('warmup', 'easy', 600, 3),
  step('main', 'work', 180, 8),
  step('main', 'rest', 120, 3),
  step('main', 'work', 180, 8),
  step('main', 'rest', 120, 3),
  step('main', 'work', 180, 8),
  step('cooldown', 'easy', 300, 3),
];

describe('Uhr: Start, Pause, Weiter', () => {
  it('nicht gestartet = 0 s', () => {
    expect(clockElapsedS(INTERVAL_CLOCK_IDLE, 1_000_000)).toBe(0);
    expect(clockPause(INTERVAL_CLOCK_IDLE, 5)).toBe(INTERVAL_CLOCK_IDLE);
  });
  it('Pausen zählen nicht, doppeltes Pausieren/Weiter ändert nichts', () => {
    let c = clockStart(0);
    expect(clockElapsedS(c, 61_999)).toBe(61);
    c = clockPause(c, 62_000);
    expect(clockPause(c, 70_000)).toBe(c);
    expect(clockElapsedS(c, 500_000)).toBe(62);
    c = clockResume(c, 100_000);
    expect(clockResume(c, 120_000)).toBe(c);
    expect(clockElapsedS(c, 110_000)).toBe(72);
  });
  it('Geräte-Uhr springt zurück: nie negativ', () => {
    const c = clockStart(50_000);
    expect(clockElapsedS(c, 10_000)).toBe(0);
    expect(clockElapsedS(clockResume(clockPause(c, 60_000), 40_000), 70_000)).toBe(20);
  });
});

describe('intervalPosition', () => {
  it('Summe, erster Schritt, Wechsel genau an der Grenze', () => {
    expect(intervalTotalS(steps)).toBe(1680);
    expect(intervalPosition(steps, 0)).toMatchObject({
      index: 0,
      stepRemainingS: 600,
      workDone: 0,
      workTotal: 3,
      workNo: null,
      finished: false,
    });
    expect(intervalPosition(steps, 599)).toMatchObject({ index: 0, stepRemainingS: 1 });
    expect(intervalPosition(steps, 600)).toMatchObject({
      index: 1,
      stepElapsedS: 0,
      stepRemainingS: 180,
      workNo: 1,
      next: steps[2],
    });
  });
  it('„Teile geschafft“ zählt nur vollständige Belastungs-Abschnitte', () => {
    expect(intervalPosition(steps, 779)).toMatchObject({ workDone: 0, workNo: 1 });
    expect(intervalPosition(steps, 780)).toMatchObject({ index: 2, workDone: 1, workNo: null });
    expect(intervalPosition(steps, 1080)).toMatchObject({ index: 4, workDone: 2 });
    expect(intervalPosition(steps, 1380)).toMatchObject({ index: 6, workDone: 3, next: null });
  });
  it('Ende und darüber hinaus: fertig, letzter Schritt, nichts übrig', () => {
    expect(intervalPosition(steps, 1680)).toMatchObject({
      index: 6,
      finished: true,
      remainingS: 0,
      stepRemainingS: 0,
      workDone: 3,
    });
    expect(intervalPosition(steps, 99_999)).toMatchObject({ elapsedS: 1680, finished: true });
    expect(intervalPosition(steps, -5)).toMatchObject({ index: 0, elapsedS: 0 });
  });
  it('ein einziger Schritt (lockerer Lauf unter 20 min)', () => {
    const one = easyWorkout('easy', 15, 3).steps;
    expect(one).toHaveLength(1);
    expect(intervalPosition(one, 899)).toMatchObject({ index: 0, stepRemainingS: 1, workTotal: 0 });
    expect(intervalPosition(one, 900)).toMatchObject({ finished: true });
  });
  it('leere Liste ist ein Programmierfehler', () => {
    expect(() => intervalPosition([], 0)).toThrow(RangeError);
  });
});

describe('intervalLoggedMinutes („Abbrechen und eintragen“)', () => {
  it('gerundet, mindestens 1, höchstens die geplante Dauer', () => {
    expect(intervalLoggedMinutes(steps, 0)).toBe(1);
    expect(intervalLoggedMinutes(steps, 29)).toBe(1);
    expect(intervalLoggedMinutes(steps, 89)).toBe(1);
    expect(intervalLoggedMinutes(steps, 90)).toBe(2);
    expect(intervalLoggedMinutes(steps, 1_000_000)).toBe(28);
  });
});

describe('intervalBlocks (Übersicht der Schritte)', () => {
  const rules = planSafetyRules(
    { experienceLevel: 'advanced', birthDate: '1990-01-01', healthScreening: { flags: [] } },
    '2026-10-16',
  );
  const options = {
    easyEffort: 3,
    limits: hardWorkoutLimits(rules, 'advanced'),
    level: 'advanced' as const,
    discipline: '10k' as const,
    hardBudgetS: 3600,
  };
  it('eigene Liste: Aufwärmen, 3 × zügig mit Pause dazwischen, Abwärmen', () => {
    expect(intervalBlocks(steps)).toEqual([
      { kind: 'single', step: steps[0] },
      { kind: 'repeat', work: steps[1], rest: steps[2], repeats: 3 },
      { kind: 'single', step: steps[6] },
    ]);
  });
  it('echte Intervall-Einheit aus den Bausteinen', () => {
    const w = structuredWorkout('intervals', 50, options);
    expect(w).not.toBeNull();
    const blocks = intervalBlocks(w?.steps ?? []);
    const repeat = blocks.find((b) => b.kind === 'repeat');
    expect(repeat).toMatchObject({ kind: 'repeat', work: { seconds: 180, effort: 8 } });
    // Alle Schritte stecken genau einmal in der Übersicht.
    const count = blocks.reduce(
      (n, b) => n + (b.kind === 'single' ? 1 : b.repeats + (b.rest ? b.repeats - 1 : 0)),
      0,
    );
    expect(count).toBe(w?.steps.length);
  });
  it('Steigerungen: Pause nach der letzten gehört zur Wiederholung', () => {
    const w = structuredWorkout('strides', 40, options);
    const blocks = intervalBlocks(w?.steps ?? []);
    expect(blocks.map((b) => b.kind)).toEqual(['single', 'single', 'repeat', 'single']);
    const repeat = blocks[2];
    expect(repeat?.kind === 'repeat' ? repeat.repeats : 0).toBeGreaterThanOrEqual(4);
  });
  it('Tempo am Stück: nur einzelne Abschnitte', () => {
    const w = structuredWorkout('tempo', 45, options);
    expect(intervalBlocks(w?.steps ?? []).every((b) => b.kind === 'single')).toBe(true);
  });
});

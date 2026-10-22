import { describe, expect, it } from 'vitest';

import { STEP_GOAL } from '../constants';
import {
  resolveStepGoal,
  stepGoalNudge,
  stepGoalOptions,
  stepGoalSchema,
  stepProgress,
  stepWeek,
} from './steps';

describe('STEP_GOAL', () => {
  it('Standard 8.000 liegt im erlaubten Bereich und auf dem Raster', () => {
    expect(STEP_GOAL.default).toBe(8000);
    expect(stepGoalSchema.safeParse(STEP_GOAL.default).success).toBe(true);
    expect(STEP_GOAL.min % STEP_GOAL.step).toBe(0);
    expect(STEP_GOAL.max % STEP_GOAL.step).toBe(0);
  });
});

describe('stepGoalSchema / resolveStepGoal', () => {
  it('gültige Ziele: Grenzen und 500er-Raster', () => {
    for (const ok of [1000, 1500, 8000, 12_500, 30_000]) {
      expect(stepGoalSchema.safeParse(ok).success).toBe(true);
      expect(resolveStepGoal(ok)).toBe(ok);
    }
  });

  it('ungültige Ziele → Standard', () => {
    const bad: unknown[] = [
      0,
      -8000,
      500,
      999,
      30_500,
      100_000,
      8250,
      8000.5,
      NaN,
      Infinity,
      '8000',
      null,
      undefined,
      {},
    ];
    for (const value of bad) {
      expect(stepGoalSchema.safeParse(value).success).toBe(false);
      expect(resolveStepGoal(value)).toBe(8000);
    }
  });

  it('Auswahl: 1.000 bis 30.000 je 500', () => {
    const options = stepGoalOptions();
    expect(options[0]).toBe(1000);
    expect(options.at(-1)).toBe(30_000);
    expect(options).toHaveLength(59);
    expect(options).toContain(8000);
  });

  it('Stufe hoch/runter, an den Grenzen festgehalten', () => {
    expect(stepGoalNudge(8000, 1)).toBe(8500);
    expect(stepGoalNudge(8000, -1)).toBe(7500);
    expect(stepGoalNudge(1000, -1)).toBe(1000);
    expect(stepGoalNudge(30_000, 1)).toBe(30_000);
    // Ungültiges Ziel → vom Standard aus.
    expect(stepGoalNudge(123, 1)).toBe(8500);
  });
});

describe('stepProgress', () => {
  it('0 Schritte: leerer Ring, ganzes Ziel offen', () => {
    expect(stepProgress({ steps: 0, goal: 8000 })).toEqual({
      steps: 0,
      goal: 8000,
      ratio: 0,
      fraction: 0,
      percent: 0,
      remaining: 8000,
      reached: false,
    });
  });

  it('teilweise: 6.240 von 8.000 = 78 %', () => {
    const p = stepProgress({ steps: 6240, goal: 8000 });
    expect(p.fraction).toBeCloseTo(0.78);
    expect(p.percent).toBe(78);
    expect(p.remaining).toBe(1760);
    expect(p.reached).toBe(false);
  });

  it('genau erreicht', () => {
    const p = stepProgress({ steps: 8000, goal: 8000 });
    expect(p).toMatchObject({ fraction: 1, percent: 100, remaining: 0, reached: true });
  });

  it('weit übertroffen (25.000 von 8.000): Ring voll, Prozent ungedeckelt', () => {
    const p = stepProgress({ steps: 25_000, goal: 8000 });
    expect(p.fraction).toBe(1);
    expect(p.ratio).toBeCloseTo(3.125);
    expect(p.percent).toBe(313);
    expect(p.remaining).toBe(0);
    expect(p.reached).toBe(true);
  });

  it('ungültige Schritte → 0; Bruchteile gerundet; über 100.000 gedeckelt', () => {
    expect(stepProgress({ steps: NaN, goal: 8000 }).steps).toBe(0);
    expect(stepProgress({ steps: -50, goal: 8000 }).steps).toBe(0);
    expect(stepProgress({ steps: 4000.6, goal: 8000 }).steps).toBe(4001);
    expect(stepProgress({ steps: 250_000, goal: 8000 }).steps).toBe(100_000);
  });

  it('ungültiges Ziel → Standard 8.000 (nie Division durch 0)', () => {
    for (const goal of [0, -1, NaN, 7777]) {
      const p = stepProgress({ steps: 4000, goal });
      expect(p.goal).toBe(8000);
      expect(p.percent).toBe(50);
    }
  });

  it('kleinstes und größtes Ziel', () => {
    expect(stepProgress({ steps: 1000, goal: 1000 }).reached).toBe(true);
    expect(stepProgress({ steps: 29_999, goal: 30_000 })).toMatchObject({
      reached: false,
      remaining: 1,
      percent: 100,
    });
  });
});

describe('stepWeek', () => {
  const today = '2026-10-22';

  it('keine Daten: heute null, 7 leere Tage', () => {
    const w = stepWeek([], today, 8000);
    expect(w.today).toBeNull();
    expect(w.days).toHaveLength(7);
    expect(w.days[0]?.day).toBe('2026-10-16');
    expect(w.days[6]?.day).toBe(today);
    expect(w.todayIndex).toBe(6);
    expect(w.days.every((d) => d.steps === null && d.share === 0 && !d.reached)).toBe(true);
    expect(w.daysWithData).toBe(0);
    expect(w.daysReached).toBe(0);
  });

  it('heute und Vortage; Balken relativ zum Ziel; ältere und künftige Tage fallen weg', () => {
    const w = stepWeek(
      [
        { day: '2026-10-15', steps: 20_000 }, // 8 Tage her
        { day: '2026-10-20', steps: 4000 },
        { day: '2026-10-21', steps: 8000 },
        { day: today, steps: 6240 },
        { day: '2026-10-23', steps: 9000 }, // morgen
      ],
      today,
      8000,
    );
    expect(w.today).toBe(6240);
    expect(w.days.map((d) => d.steps)).toEqual([null, null, null, null, 4000, 8000, 6240]);
    expect(w.days[4]?.share).toBe(0.5);
    expect(w.days[5]?.share).toBe(1);
    expect(w.days[5]?.reached).toBe(true);
    expect(w.daysWithData).toBe(3);
    expect(w.daysReached).toBe(1);
  });

  it('Tag über dem Ziel: Skala = höchster Tag', () => {
    const w = stepWeek(
      [
        { day: today, steps: 25_000 },
        { day: '2026-10-21', steps: 5000 },
      ],
      today,
      8000,
    );
    expect(w.days[6]?.share).toBe(1);
    expect(w.days[5]?.share).toBe(0.2);
  });

  it('Tag ohne Schritte und unplausible Werte = fehlend; doppelte Zeilen → größter Wert (nie addiert)', () => {
    const w = stepWeek(
      [
        { day: today, steps: null },
        { day: '2026-10-21', steps: 150_000 },
        { day: '2026-10-20', steps: -5 },
        { day: '2026-10-19', steps: 3000 },
        { day: '2026-10-19', steps: 5000 },
      ],
      today,
      8000,
    );
    expect(w.today).toBeNull();
    expect(w.days.map((d) => d.steps)).toEqual([null, null, null, 5000, null, null, null]);
  });

  it('0 Schritte heute ist ein Wert (nicht fehlend)', () => {
    const w = stepWeek([{ day: today, steps: 0 }], today, 8000);
    expect(w.today).toBe(0);
    expect(w.daysWithData).toBe(1);
  });

  it('ungültiges Ziel → Standard für „erreicht“ und Skala', () => {
    const w = stepWeek([{ day: today, steps: 8000 }], today, 0);
    expect(w.days[6]?.reached).toBe(true);
    expect(w.days[6]?.share).toBe(1);
  });

  it('kleinstes Ziel (1.000) und größtes Ziel (30.000)', () => {
    expect(stepWeek([{ day: today, steps: 1000 }], today, 1000).daysReached).toBe(1);
    const high = stepWeek([{ day: today, steps: 15_000 }], today, 30_000);
    expect(high.daysReached).toBe(0);
    expect(high.days[6]?.share).toBe(0.5);
  });

  it('Monats- und Jahreswechsel', () => {
    const w = stepWeek([{ day: '2026-12-31', steps: 7000 }], '2027-01-02', 8000);
    expect(w.days[0]?.day).toBe('2026-12-27');
    expect(w.days[4]?.steps).toBe(7000);
  });
});

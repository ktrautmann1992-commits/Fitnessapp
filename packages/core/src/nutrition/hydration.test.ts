import { describe, expect, it } from 'vitest';

import { HYDRATION } from '../constants';
import {
  hydrationDayAllowed,
  hydrationEntrySchema,
  hydrationFraction,
  hydrationGoal,
  hydrationHistory,
  hydrationTotal,
  trainingMinutesOfDay,
} from './hydration';

const base = { ageYears: 35, trainingMinutes: 0, maxTempC: null, medicalRestriction: false };

describe('hydrationGoal', () => {
  it('70 kg, 35 Jahre, kein Training: 35 ml/kg × 0,6 = 1.470 → 1.450 ml (auf 50 ml)', () => {
    expect(hydrationGoal({ ...base, weightKg: 70 })).toEqual({
      kind: 'goal',
      goalMl: 1450,
      baseMl: 1450,
      trainingMl: 0,
      heatMl: 0,
    });
  });

  it('ab 51 Jahren 30 ml/kg', () => {
    const g = hydrationGoal({ ...base, weightKg: 70, ageYears: 60 });
    expect(g.kind === 'goal' && g.baseMl).toBe(1250);
  });

  it('Training und Hitze erhöhen das Ziel', () => {
    const g = hydrationGoal({ ...base, weightKg: 70, trainingMinutes: 60, maxTempC: 31 });
    expect(g).toMatchObject({ trainingMl: 500, heatMl: 750, goalMl: 2700 });
    const warm = hydrationGoal({ ...base, weightKg: 70, maxTempC: 25 });
    expect(warm.kind === 'goal' && warm.heatMl).toBe(500);
    const cool = hydrationGoal({ ...base, weightKg: 70, maxTempC: 24.9 });
    expect(cool.kind === 'goal' && cool.heatMl).toBe(0);
  });

  it('Grenzen: sehr leicht → Minimum, sehr schwer + viel Training → Maximum', () => {
    const light = hydrationGoal({ ...base, weightKg: 40 });
    expect(light.kind === 'goal' && light.goalMl).toBe(HYDRATION.goalMl.min);
    const heavy = hydrationGoal({ ...base, weightKg: 160, trainingMinutes: 300, maxTempC: 35 });
    expect(heavy.kind === 'goal' && heavy.goalMl).toBe(HYDRATION.goalMl.max);
  });

  it('Herz-/Nierenerkrankung → kein Ziel; ohne Gewicht → kein Ziel', () => {
    expect(hydrationGoal({ ...base, weightKg: 70, medicalRestriction: true })).toEqual({
      kind: 'no_goal',
      reason: 'medical',
    });
    expect(hydrationGoal({ ...base, weightKg: null })).toEqual({
      kind: 'no_goal',
      reason: 'no_weight',
    });
    expect(hydrationGoal({ ...base, weightKg: 0 })).toEqual({
      kind: 'no_goal',
      reason: 'no_weight',
    });
  });

  it('ohne Alter: wie Erwachsene unter 51', () => {
    const g = hydrationGoal({ ...base, weightKg: 70, ageYears: null });
    expect(g.kind === 'goal' && g.baseMl).toBe(1450);
  });
});

describe('Summen und Verlauf', () => {
  const entries = [
    { day: '2026-10-25', amount_ml: 250 },
    { day: '2026-10-25', amount_ml: 500 },
    { day: '2026-10-23', amount_ml: 1000 },
    { day: '2026-10-10', amount_ml: 750 },
  ];

  it('Tagessumme und 7 Tage (älteste zuerst, leere Tage 0)', () => {
    expect(hydrationTotal(entries, '2026-10-25')).toBe(750);
    const h = hydrationHistory(entries, '2026-10-25');
    expect(h).toHaveLength(7);
    expect(h[0]).toEqual({ day: '2026-10-19', totalMl: 0 });
    expect(h[4]).toEqual({ day: '2026-10-23', totalMl: 1000 });
    expect(h[6]).toEqual({ day: '2026-10-25', totalMl: 750 });
  });

  it('Anteil am Ziel, gedeckelt; ohne Ziel null', () => {
    const goal = hydrationGoal({ ...base, weightKg: 70 });
    expect(hydrationFraction(725, goal)).toBeCloseTo(0.5, 5);
    expect(hydrationFraction(10_000, goal)).toBe(1.5);
    expect(hydrationFraction(500, { kind: 'no_goal', reason: 'medical' })).toBeNull();
  });

  it('Eintragen: heute bis 14 Tage zurück', () => {
    expect(hydrationDayAllowed('2026-10-25', '2026-10-25')).toBe(true);
    expect(hydrationDayAllowed('2026-10-11', '2026-10-25')).toBe(true);
    expect(hydrationDayAllowed('2026-10-10', '2026-10-25')).toBe(false);
    expect(hydrationDayAllowed('2026-10-26', '2026-10-25')).toBe(false);
  });

  it('Trainingsminuten des Tages', () => {
    expect(
      trainingMinutesOfDay(
        [
          { day: '2026-10-25', durationS: 1800 },
          { day: '2026-10-25', durationS: 2700 },
          { day: '2026-10-24', durationS: 3600 },
          { day: '2026-10-25', durationS: null },
        ],
        '2026-10-25',
      ),
    ).toBe(75);
  });
});

describe('hydrationEntrySchema', () => {
  it('Grenzen 50–2.000 ml, ganze Zahl, Datum, strikt', () => {
    const ok = { id: '00000000-0000-4000-8000-000000000001', day: '2026-10-25', amount_ml: 250 };
    expect(hydrationEntrySchema.safeParse(ok).success).toBe(true);
    expect(hydrationEntrySchema.safeParse({ ...ok, amount_ml: 49 }).success).toBe(false);
    expect(hydrationEntrySchema.safeParse({ ...ok, amount_ml: 2001 }).success).toBe(false);
    expect(hydrationEntrySchema.safeParse({ ...ok, amount_ml: 250.5 }).success).toBe(false);
    expect(hydrationEntrySchema.safeParse({ ...ok, day: '25.10.2026' }).success).toBe(false);
    expect(hydrationEntrySchema.safeParse({ ...ok, user_id: 'x' }).success).toBe(false);
  });
});

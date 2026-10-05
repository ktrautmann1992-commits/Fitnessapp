import { describe, expect, it } from 'vitest';

import { calibrateFromSets, heaviestCompletedSet, progressFromStartWeight } from './calibration';
import type { LoggedSet, ProgressionContext } from './types';

const ctx: ProgressionContext = {
  loadType: 'weight',
  repsMin: 8,
  repsMax: 12,
  durationS: null,
  templateSets: 3,
  rpeTarget: 8,
  incrementKind: 'free_weight',
};
const s = (reps: number, weightKg: number, rpe: number | null = null, done = true): LoggedSet => ({
  reps,
  weightKg,
  durationS: null,
  rpe,
  done,
});
const weightOf = (sets: LoggedSet[], confirmed = false) => {
  const r = calibrateFromSets(sets, confirmed, ctx);
  return r.kind === 'calibrated' ? r.progress.weightKg : r.kind;
};

describe('calibrateFromSets (Abschnitt 5.2)', () => {
  it('12 Wdh. + 0 Reserve (Grenze) wird hochgerechnet', () => {
    // e1RM = 20 × (1 + 12/30) = 28; Ziel 8 Wdh. @8 (10 gesamt): 28 / (4/3) = 21
    expect(weightOf([s(12, 20, 10)])).toBe(21);
  });

  it('13 Wdh. (über der Grenze): keine Hochrechnung, eingetragenes Gewicht', () => {
    expect(weightOf([s(13, 20, 10)])).toBe(20);
    expect(weightOf([s(12, 20, 9)])).toBe(20);
  });

  it('ohne RPE gilt „keine Reserve“ (vorsichtigste Schätzung)', () => {
    // 10 Wdh. + 0 = 10 → e1RM 26,67 → 20
    expect(weightOf([s(10, 20, null)])).toBe(20);
    expect(weightOf([s(10, 20, null)])).toBeLessThanOrEqual(weightOf([s(10, 20, 8)]) as number);
  });

  it('nie mehr als 10 % über dem eingetragenen Gewicht', () => {
    // 7 Wdh. @5 (5 Reserve) → e1RM 28; Ziel 3 Wdh. @9 → 28 / (1 + 4/30) ≈ 24,7 → Deckel 20 × 1,1 = 22
    const wide: ProgressionContext = { ...ctx, repsMin: 3, rpeTarget: 9 };
    const r = calibrateFromSets([s(7, 20, 5)], false, wide);
    expect(r).toEqual({ kind: 'calibrated', progress: expect.objectContaining({ weightKg: 22 }) });
  });

  it('schwerster geschaffter Satz zählt; nicht abgehakte und 0 Wdh. nicht', () => {
    expect(
      heaviestCompletedSet([s(8, 20), s(6, 22.5), s(10, 30, null, false), s(0, 40)]),
    ).toMatchObject({
      weightKg: 22.5,
      reps: 6,
    });
    expect(heaviestCompletedSet([s(8, 20), s(10, 20)])).toMatchObject({ reps: 10 });
    expect(weightOf([s(10, 30, null, false)])).toBe('none');
  });

  it('Ergebnis roh (0,5-kg-Raster), auch unter der kleinsten Stufe eines Orts', () => {
    expect(weightOf([s(8, 3, 8)])).toBe(3);
    expect(weightOf([s(8, 0.5, 8)])).toBe(0.5);
  });

  it('absolute Warnschwelle: Kurzhantel > 50 kg nur mit Bestätigung, Langhantel > 200 kg', () => {
    expect(weightOf([s(8, 55, 8)])).toBe('needs_confirmation');
    expect(weightOf([s(8, 55, 8)], true)).toBe(55);
    const bar = { ...ctx, incrementKind: 'barbell' as const };
    expect(calibrateFromSets([s(5, 180, 8)], false, bar).kind).toBe('calibrated');
    expect(calibrateFromSets([s(5, 225, 8)], false, bar).kind).toBe('needs_confirmation');
  });

  it('Halteübung: geplante Dauer, ohne Plan die kürzeste geschaffte (10–120 s)', () => {
    const time: ProgressionContext = {
      ...ctx,
      loadType: 'time',
      repsMin: null,
      durationS: 30,
      incrementKind: 'none',
    };
    expect(calibrateFromSets([], false, time)).toMatchObject({ progress: { durationS: 30 } });
    const hold = (d: number): LoggedSet => ({
      reps: null,
      weightKg: null,
      durationS: d,
      rpe: null,
      done: true,
    });
    const noPlan = { ...time, durationS: null };
    expect(calibrateFromSets([hold(45), hold(40)], false, noPlan)).toMatchObject({
      progress: { durationS: 40 },
    });
    expect(calibrateFromSets([hold(300)], false, noPlan)).toMatchObject({
      progress: { durationS: 120 },
    });
    expect(calibrateFromSets([hold(5)], false, noPlan)).toMatchObject({
      progress: { durationS: 10 },
    });
    expect(calibrateFromSets([], false, noPlan).kind).toBe('none');
  });
});

describe('progressFromStartWeight', () => {
  it('0,5–500 kg, abgerundet auf 0,5 kg; außerhalb ungültig', () => {
    expect(progressFromStartWeight(0.5, false, ctx)).toMatchObject({
      kind: 'ok',
      progress: { weightKg: 0.5 },
    });
    expect(progressFromStartWeight(21.3, false, ctx)).toMatchObject({ progress: { weightKg: 21 } });
    expect(progressFromStartWeight(0.4, false, ctx).kind).toBe('invalid');
    expect(progressFromStartWeight(500.5, true, ctx).kind).toBe('invalid');
    expect(progressFromStartWeight(20, false, { ...ctx, loadType: 'bodyweight' }).kind).toBe(
      'invalid',
    );
  });

  it('über 500 kg abgelehnt, 500 kg Langhantel nur mit Bestätigung', () => {
    const bar = { ...ctx, incrementKind: 'barbell' as const };
    expect(progressFromStartWeight(500, false, bar).kind).toBe('needs_confirmation');
    expect(progressFromStartWeight(500, true, bar)).toMatchObject({ progress: { weightKg: 500 } });
    expect(progressFromStartWeight(501, true, bar).kind).toBe('invalid');
  });
});

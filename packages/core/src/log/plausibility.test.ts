import { describe, expect, it } from 'vitest';

import {
  absoluteWeightThreshold,
  isPlausibleTargetWeight,
  needsLighterConfirmation,
  needsWeightConfirmation,
  setEntryWarnings,
} from './plausibility';

describe('Tippfehler-Schutz (W5)', () => {
  it('mit Zustand: mehr als 10 % darüber braucht Bestätigung', () => {
    expect(needsWeightConfirmation(22, 20, 'free_weight')).toBe(false);
    expect(needsWeightConfirmation(22.01, 20, 'free_weight')).toBe(true);
    expect(needsWeightConfirmation(225, 22.5, 'free_weight')).toBe(true);
    expect(needsWeightConfirmation(10, 20, 'free_weight')).toBe(false);
  });

  it('ohne Zustand: absolute Schwellen je Geräte-Art', () => {
    expect(absoluteWeightThreshold('free_weight')).toBe(50);
    expect(absoluteWeightThreshold('barbell')).toBe(200);
    expect(absoluteWeightThreshold('machine')).toBe(200);
    expect(absoluteWeightThreshold('none')).toBeNull();
    expect(needsWeightConfirmation(50, null, 'free_weight')).toBe(false);
    expect(needsWeightConfirmation(50.5, null, 'free_weight')).toBe(true);
    expect(needsWeightConfirmation(200, null, 'barbell')).toBe(false);
    expect(needsWeightConfirmation(202.5, null, 'machine')).toBe(true);
    expect(needsWeightConfirmation(500, null, 'none')).toBe(false);
  });

  it('setEntryWarnings: Gewicht und Wiederholungen', () => {
    const ctx = { stateWeightKg: 22.5, plannedReps: 10, incrementKind: 'free_weight' as const };
    expect(setEntryWarnings({ weightKg: 22.5, reps: 10 }, ctx)).toEqual([]);
    expect(setEntryWarnings({ weightKg: 225, reps: 10 }, ctx)).toEqual(['confirm_heavier']);
    expect(setEntryWarnings({ weightKg: 22.5, reps: 31 }, ctx)).toEqual(['check_reps']);
    expect(setEntryWarnings({ weightKg: 22.5, reps: 30 }, ctx)).toEqual([]);
    expect(setEntryWarnings({ weightKg: 60, reps: 100 }, { ...ctx, stateWeightKg: null })).toEqual([
      'confirm_absolute',
      'check_reps',
    ]);
    expect(setEntryWarnings({ weightKg: null, reps: 10 }, { ...ctx, plannedReps: null })).toEqual(
      [],
    );
  });

  it('deutlich leichter: unter 50 % des Zustands oder unter der kleinsten Stufe', () => {
    expect(needsLighterConfirmation(20, 40)).toBe(false);
    expect(needsLighterConfirmation(19.5, 40)).toBe(true);
    expect(needsLighterConfirmation(22, 40, [24, 32, 40])).toBe(true);
    expect(needsLighterConfirmation(24, 40, [24, 32, 40])).toBe(false);
    expect(needsLighterConfirmation(2, null)).toBe(false);
    expect(needsLighterConfirmation(50, 40)).toBe(false);
    expect(
      setEntryWarnings(
        { weightKg: 2, reps: 10 },
        { stateWeightKg: 20, plannedReps: 10, incrementKind: 'free_weight', steps: [4, 6] },
      ),
    ).toEqual(['confirm_lighter']);
  });

  it('Ziel-/Startgewicht 0,5–500 kg', () => {
    expect(isPlausibleTargetWeight(0.5)).toBe(true);
    expect(isPlausibleTargetWeight(500)).toBe(true);
    expect(isPlausibleTargetWeight(0.4)).toBe(false);
    expect(isPlausibleTargetWeight(500.01)).toBe(false);
    expect(isPlausibleTargetWeight(Number.NaN)).toBe(false);
  });
});

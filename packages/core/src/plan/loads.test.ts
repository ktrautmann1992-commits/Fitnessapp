import { describe, expect, it } from 'vitest';

import {
  estimateWorkingWeight,
  holdIncrementSeconds,
  incrementKindFor,
  nextLoad,
  nextWeightStep,
  type PerformedSession,
  type ProgressionState,
  sessionAchieved,
  snapToAvailableWeight,
} from './loads';

const weight: ProgressionState = {
  loadType: 'weight',
  repsMin: 8,
  repsMax: 12,
  targetReps: 12,
  templateSets: 3,
  sets: 3,
  durationS: null,
  rpeTarget: 7,
  weightKg: 50,
};
const done = (reps: number, sets = 3, rpe: number | null = 7): PerformedSession => ({
  sets: Array.from({ length: sets }, () => ({ reps, rpe })),
});

describe('snapToAvailableWeight', () => {
  it('größte Stufe ≤ Gewicht, sonst null; ohne Stufen auf 0,5 kg abgerundet', () => {
    expect(snapToAvailableWeight(7, [2, 4, 6, 8])).toBe(6);
    expect(snapToAvailableWeight(1, [2, 4])).toBeNull();
    expect(snapToAvailableWeight(23.7)).toBe(23.5);
    expect(snapToAvailableWeight(0.3)).toBeNull();
  });
});

describe('estimateWorkingWeight (Epley + Reserve)', () => {
  it('nie mehr als 10 % über dem eingetragenen Gewicht', () => {
    const result = estimateWorkingWeight({ weightKg: 40, reps: 10, rpe: 6 }, { reps: 5, rpe: 8 });
    expect(result).toBeLessThanOrEqual(44);
  });

  it('weniger Wiederholungen bei höherem Ziel-RPE → nicht leichter', () => {
    const lighter = estimateWorkingWeight({ weightKg: 40, reps: 8, rpe: 8 }, { reps: 12, rpe: 7 });
    expect(lighter).toBeLessThan(40);
    expect(lighter).toBeGreaterThan(25);
  });

  it('über 12 Wdh. + Reserve wird nicht hochgerechnet', () => {
    expect(estimateWorkingWeight({ weightKg: 20, reps: 15, rpe: 7 }, { reps: 6, rpe: 8 })).toBe(20);
  });

  it('auf eigene Stufen abgerundet, nie über 500 kg', () => {
    expect(
      estimateWorkingWeight(
        { weightKg: 9, reps: 10, rpe: 7 },
        { reps: 10, rpe: 7 },
        [2, 4, 6, 8, 10],
      ),
    ).toBe(8);
    expect(
      estimateWorkingWeight({ weightKg: 480, reps: 5, rpe: 6 }, { reps: 3, rpe: 9 }),
    ).toBeLessThanOrEqual(500);
  });
});

describe('Steigerung', () => {
  it('Art je Übung', () => {
    expect(
      incrementKindFor({ equipment_ids: ['barbell', 'power_rack'], load_type: 'weight' }),
    ).toBe('barbell');
    expect(incrementKindFor({ equipment_ids: ['cable_station'], load_type: 'weight' })).toBe(
      'machine',
    );
    expect(incrementKindFor({ equipment_ids: ['dumbbells'], load_type: 'weight' })).toBe(
      'free_weight',
    );
    expect(incrementKindFor({ equipment_ids: [], load_type: 'bodyweight' })).toBe('none');
  });

  it('nächster Schritt', () => {
    expect(nextWeightStep(50, 'barbell')).toBe(52.5);
    expect(nextWeightStep(30, 'machine')).toBe(32.5);
    expect(nextWeightStep(8, 'free_weight', [4, 6, 8, 10])).toBe(10);
    expect(nextWeightStep(10, 'free_weight', [4, 6, 8, 10])).toBeNull();
    expect(nextWeightStep(8, 'free_weight')).toBe(10);
  });

  it.each([
    [10, 1],
    [20, 2],
    [30, 3],
    [50, 5],
    [60, 5],
    [5, 1],
  ])('Halteübung %i s → +%i s', (duration, increment) => {
    expect(holdIncrementSeconds(duration)).toBe(increment);
  });
});

describe('nextLoad (doppelte Progression)', () => {
  it('unter reps_max: eine geschaffte Einheit → +1 Wiederholung', () => {
    const state = { ...weight, targetReps: 9 };
    expect(nextLoad(state, [done(9)], { incrementKind: 'barbell' })).toEqual({
      kind: 'add_rep',
      targetReps: 10,
    });
    expect(nextLoad(state, [done(8)], { incrementKind: 'barbell' })).toEqual({ kind: 'keep' });
  });

  it('nur EINE Einheit über Ziel → keine Gewichtssteigerung', () => {
    expect(nextLoad(weight, [done(10), done(12)], { incrementKind: 'barbell' })).toEqual({
      kind: 'keep',
    });
  });

  it('zwei Einheiten in Folge, Schritt ≤ 10 % → Gewicht steigt, Wdh. zurück auf reps_min', () => {
    expect(nextLoad(weight, [done(12), done(12)], { incrementKind: 'barbell' })).toEqual({
      kind: 'increase_weight',
      weightKg: 52.5,
      targetReps: 8,
      sets: 3,
      firstSessionRpeTarget: 7,
    });
  });

  it('RPE über Ziel zählt nicht als geschafft', () => {
    expect(
      nextLoad(weight, [done(12, 3, 9), done(12, 3, 9)], { incrementKind: 'barbell' }),
    ).toEqual({ kind: 'keep' });
    expect(
      nextLoad(weight, [done(12, 3, null), done(12, 3, null)], { incrementKind: 'barbell' }).kind,
    ).toBe('increase_weight');
  });

  it('zu wenige Sätze zählen nicht', () => {
    expect(sessionAchieved(weight, done(12, 2))).toBe(false);
  });

  it('Schritt > 10 % (Kurzhantel 4 → 6 kg): erst Wdh. bis reps_max + 2, dann +1 Satz, dann Gewicht', () => {
    const steps = [2, 4, 6, 8];
    const opts = { incrementKind: 'free_weight' as const, steps };
    let state: ProgressionState = { ...weight, weightKg: 4 };
    const two = (reps: number, sets: number) => [done(reps, sets), done(reps, sets)];
    expect(nextLoad(state, two(12, 3), opts)).toEqual({ kind: 'add_rep', targetReps: 13 });
    state = { ...state, targetReps: 13 };
    expect(nextLoad(state, [done(13)], opts)).toEqual({ kind: 'keep' });
    expect(nextLoad(state, two(13, 3), opts)).toEqual({ kind: 'add_rep', targetReps: 14 });
    state = { ...state, targetReps: 14 };
    expect(nextLoad(state, two(14, 3), opts)).toEqual({ kind: 'add_set', sets: 4 });
    state = { ...state, sets: 4 };
    expect(nextLoad(state, two(14, 4), opts)).toEqual({
      kind: 'increase_weight',
      weightKg: 6,
      targetReps: 8,
      sets: 3,
      // Sprung 4 → 6 kg = 50 % (> 25 %): erste Einheit mit dem neuen Gewicht RPE −1.
      firstSessionRpeTarget: 6,
    });
  });

  it('Sprung zwischen 10 und 25 % (10 → 12 kg): nach dem Puffer ohne RPE-Abzug', () => {
    const state: ProgressionState = { ...weight, weightKg: 10, targetReps: 14, sets: 4 };
    const result = nextLoad(state, [done(14, 4), done(14, 4)], {
      incrementKind: 'free_weight',
      steps: [10, 12],
    });
    expect(result).toMatchObject({
      kind: 'increase_weight',
      weightKg: 12,
      firstSessionRpeTarget: 7,
    });
  });

  it('RPE-Abzug nie unter 5', () => {
    const state: ProgressionState = {
      ...weight,
      weightKg: 4,
      targetReps: 14,
      sets: 4,
      rpeTarget: 5,
    };
    const result = nextLoad(state, [done(14, 4, 5), done(14, 4, 5)], {
      incrementKind: 'free_weight',
      steps: [4, 6],
    });
    expect(result).toMatchObject({ firstSessionRpeTarget: 5 });
  });

  it('Puffer nie über 30 Wdh. und 6 Sätze; Satz nur, wenn V9 es erlaubt', () => {
    const high: ProgressionState = {
      ...weight,
      repsMin: 25,
      repsMax: 30,
      targetReps: 30,
      templateSets: 6,
      sets: 6,
      weightKg: 4,
    };
    const result = nextLoad(high, [done(30, 6), done(30, 6)], {
      incrementKind: 'free_weight',
      steps: [4, 6],
    });
    expect(result.kind).toBe('increase_weight');
    const noSet = nextLoad({ ...weight, weightKg: 4, targetReps: 14 }, [done(14), done(14)], {
      incrementKind: 'free_weight',
      steps: [4, 6],
      allowExtraSet: false,
    });
    expect(noSet.kind).toBe('increase_weight');
  });

  it('keine höhere Stufe: erst Puffer, dann Hinweis statt dauerhaft „gleich“', () => {
    const opts = { incrementKind: 'free_weight' as const, steps: [10] };
    expect(nextLoad({ ...weight, weightKg: 10 }, [done(12), done(12)], opts)).toEqual({
      kind: 'add_rep',
      targetReps: 13,
    });
    expect(
      nextLoad({ ...weight, weightKg: 10, targetReps: 14 }, [done(14), done(14)], opts),
    ).toEqual({
      kind: 'add_set',
      sets: 4,
    });
    expect(
      nextLoad(
        { ...weight, weightKg: 10, targetReps: 14, sets: 4 },
        [done(14, 4), done(14, 4)],
        opts,
      ),
    ).toEqual({ kind: 'no_heavier_weight' });
  });

  it('Körpergewicht (Engine 3): Puffer bis reps_max + 2 → +1 Satz → erst dann schwerere Variante', () => {
    const bw: ProgressionState = { ...weight, loadType: 'bodyweight', weightKg: null };
    const none = { incrementKind: 'none' } as const;
    // Unter reps_max: eine geschaffte Einheit reicht für +1 Wdh.
    expect(nextLoad({ ...bw, targetReps: 10 }, [done(10)], none)).toEqual({
      kind: 'add_rep',
      targetReps: 11,
    });
    // Ab reps_max: zwei in Folge nötig.
    expect(nextLoad(bw, [done(12)], none)).toEqual({ kind: 'keep' });
    expect(nextLoad(bw, [done(12), done(12)], none)).toEqual({ kind: 'add_rep', targetReps: 13 });
    expect(nextLoad({ ...bw, targetReps: 13 }, [done(13), done(13)], none)).toEqual({
      kind: 'add_rep',
      targetReps: 14,
    });
    // Puffer-Ende (reps_max + LOAD_PROGRESSION.extraRepsBuffer) → Zusatzsatz.
    expect(nextLoad({ ...bw, targetReps: 14 }, [done(14), done(14)], none)).toEqual({
      kind: 'add_set',
      sets: 4,
    });
    // Mit Zusatzsatz geschafft → Hinweis schwerere Variante.
    expect(nextLoad({ ...bw, targetReps: 14, sets: 4 }, [done(14, 4), done(14, 4)], none)).toEqual({
      kind: 'harder_variant',
    });
  });

  it('Körpergewicht: Puffer höchstens 30 Wdh., Zusatzsatz nur im Rahmen von V9 und höchstens 6 Sätze', () => {
    const bw: ProgressionState = {
      ...weight,
      loadType: 'bodyweight',
      weightKg: null,
      repsMin: 20,
      repsMax: 29,
      targetReps: 29,
    };
    const none = { incrementKind: 'none' } as const;
    expect(nextLoad(bw, [done(29), done(29)], none)).toEqual({ kind: 'add_rep', targetReps: 30 });
    expect(nextLoad({ ...bw, targetReps: 30 }, [done(30), done(30)], none)).toEqual({
      kind: 'add_set',
      sets: 4,
    });
    expect(
      nextLoad({ ...bw, targetReps: 30 }, [done(30), done(30)], { ...none, allowExtraSet: false }),
    ).toEqual({ kind: 'harder_variant' });
    const six = { ...bw, targetReps: 30, templateSets: 6, sets: 6 };
    expect(nextLoad(six, [done(30, 6), done(30, 6)], none)).toEqual({ kind: 'harder_variant' });
  });

  it('Körpergewicht: nur kurze Fassungen (W7) → +Wdh. bis zum Puffer, kein Zusatzsatz, keine Variante', () => {
    const bw: ProgressionState = { ...weight, loadType: 'bodyweight', weightKg: null };
    const short = (reps: number): PerformedSession => ({ ...done(reps, 2), plannedSets: 2 });
    const none = { incrementKind: 'none' } as const;
    expect(nextLoad(bw, [short(12), short(12)], none)).toEqual({ kind: 'add_rep', targetReps: 13 });
    expect(nextLoad({ ...bw, targetReps: 14 }, [short(14), short(14)], none)).toEqual({
      kind: 'keep',
    });
  });

  it('Körpergewicht in der Erholungswoche: kein Schritt', () => {
    const bw: ProgressionState = { ...weight, loadType: 'bodyweight', weightKg: null };
    expect(nextLoad(bw, [done(12), done(12)], { incrementKind: 'none', isDeload: true })).toEqual({
      kind: 'keep',
    });
  });

  it('Band → stärkeres Band', () => {
    expect(
      nextLoad({ ...weight, loadType: 'band', weightKg: null }, [done(12), done(12)], {
        incrementKind: 'none',
      }),
    ).toEqual({ kind: 'stronger_band' });
  });

  it('Halteübung: +min(5, max(1, 10 %)) s nach zwei Einheiten, bei 120 s schwerere Variante', () => {
    const hold: ProgressionState = {
      ...weight,
      loadType: 'time',
      repsMin: null,
      repsMax: null,
      targetReps: null,
      durationS: 30,
      weightKg: null,
    };
    const held = (s: number): PerformedSession => ({
      sets: [{ durationS: s }, { durationS: s }, { durationS: s }],
    });
    expect(nextLoad(hold, [held(30)], { incrementKind: 'none' })).toEqual({ kind: 'keep' });
    expect(nextLoad(hold, [held(30), held(30)], { incrementKind: 'none' })).toEqual({
      kind: 'increase_duration',
      durationS: 33,
    });
    expect(
      nextLoad({ ...hold, durationS: 118 }, [held(118), held(118)], { incrementKind: 'none' }),
    ).toEqual({ kind: 'increase_duration', durationS: 120 });
    expect(
      nextLoad({ ...hold, durationS: 120 }, [held(120), held(120)], { incrementKind: 'none' }),
    ).toEqual({ kind: 'harder_variant' });
  });

  it('Erholungswoche und ohne Einträge: keine Steigerung', () => {
    expect(
      nextLoad(weight, [done(12), done(12)], { incrementKind: 'barbell', isDeload: true }),
    ).toEqual({ kind: 'keep' });
    expect(nextLoad(weight, [], { incrementKind: 'barbell' })).toEqual({ kind: 'keep' });
  });

  it('Gewicht unbekannt („Startgewicht finden“) → bleibt', () => {
    expect(
      nextLoad({ ...weight, weightKg: null }, [done(12), done(12)], { incrementKind: 'barbell' }),
    ).toEqual({ kind: 'keep' });
  });

  it('Phase 4: jede Einheit gegen ihre eigene Satzzahl (kurze Fassung mit 2 Sätzen)', () => {
    const short: PerformedSession = { plannedSets: 2, sets: [{ reps: 12 }, { reps: 12 }] };
    expect(sessionAchieved(weight, short)).toBe(true);
    expect(sessionAchieved(weight, { ...short, plannedSets: 3 })).toBe(false);
    expect(
      sessionAchieved(weight, {
        ...short,
        rpeTarget: 6,
        sets: [{ reps: 12, rpe: 7 }, { reps: 12 }],
      }),
    ).toBe(false);
  });

  it('W7: Gewichtssprung nur, wenn eine der zwei Einheiten die Vorlagen-Satzzahl hatte', () => {
    const state = { ...weight, templateSets: 4, sets: 4 };
    const short: PerformedSession = { plannedSets: 2, sets: [{ reps: 12 }, { reps: 12 }] };
    const full: PerformedSession = { plannedSets: 4, sets: Array(4).fill({ reps: 12 }) };
    // direkter Schritt ≤ 10 % möglich (Langhantel +2,5 kg): Wdh. nur bis reps_max → bleibt
    expect(nextLoad(state, [short, short], { incrementKind: 'barbell' })).toEqual({ kind: 'keep' });
    // großer Sprung (Kurzhantel 20 → 25 kg): Puffer-Wdh. auch mit kurzen Fassungen, aber kein Sprung
    const big = { ...state, weightKg: 20 };
    const db = { incrementKind: 'free_weight' as const, steps: [20, 25] };
    expect(nextLoad(big, [short, short], db)).toEqual({ kind: 'add_rep', targetReps: 13 });
    expect(nextLoad({ ...big, targetReps: 14 }, [short, short], db)).toEqual({ kind: 'keep' });
    expect(nextLoad(state, [short, full], { incrementKind: 'barbell' })).toMatchObject({
      kind: 'increase_weight',
      weightKg: 52.5,
    });
  });

  it('keine Stufe über 500 kg → no_heavier_weight statt Sprung auf dasselbe Gewicht', () => {
    const top = { ...weight, weightKg: 500, targetReps: 14, sets: 4 };
    expect(nextLoad(top, [done(14, 4), done(14, 4)], { incrementKind: 'barbell' })).toEqual({
      kind: 'no_heavier_weight',
    });
    expect(
      nextLoad({ ...weight, weightKg: 497.5 }, [done(12), done(12)], { incrementKind: 'barbell' }),
    ).toMatchObject({ kind: 'increase_weight', weightKg: 500 });
  });
});

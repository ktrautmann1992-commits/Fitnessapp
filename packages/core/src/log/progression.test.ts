import { describe, expect, it } from 'vitest';

import { barbellLoadSteps } from '../equipment';
import {
  buildExerciseLogEntry,
  type PlannedDosage,
  type Prescription,
  prescriptionForDisplay,
  progressFromLogs,
  type ProgressResult,
} from './progression';
import { all, asShown, dates, hold, type SimStep, simulate } from './test-helpers';
import type { ExerciseLogEntry, ExerciseProgress, LoggedSet, ProgressionContext } from './types';

/** Fester Stichtag für Tests ohne Pausen-Bezug. */
const TODAY = '2026-10-20';
const DB_STEPS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22.5, 25, 27.5, 30];
const HOME_STEPS = [4, 6, 8];
const BARBELL = barbellLoadSteps(20, [1.25, 2.5, 5, 10, 15, 20, 25]);

const dumbbell: ProgressionContext = {
  loadType: 'weight',
  repsMin: 8,
  repsMax: 12,
  durationS: null,
  templateSets: 3,
  rpeTarget: 8,
  incrementKind: 'free_weight',
  steps: DB_STEPS,
};
const barbell: ProgressionContext = { ...dumbbell, incrementKind: 'barbell', steps: BARBELL };
const planned: PlannedDosage = {
  sets: 3,
  reps_min: 8,
  reps_max: 12,
  duration_s: null,
  rpe_target: 8,
};

const set = (reps: number, weightKg: number | null, rpe: number | null = null): LoggedSet => ({
  reps,
  weightKg,
  durationS: null,
  rpe,
  done: true,
});

function entry(partial: Partial<ExerciseLogEntry> & { performedOn: string }): ExerciseLogEntry {
  return {
    exerciseId: 'db_bench',
    loggedAt: `${partial.performedOn}T18:00:00Z`,
    status: 'done',
    loadType: 'weight',
    isIntroWeek: false,
    isDeload: false,
    targetSets: 3,
    targetWeightKg: null,
    targetReps: null,
    targetExtraSet: null,
    targetRpe: 8,
    state: null,
    weightConfirmed: false,
    sets: [],
    ...partial,
  };
}

const state = (
  weightKg: number | null,
  targetReps: number,
  extraSet = false,
): ExerciseProgress => ({
  weightKg,
  targetReps,
  extraSet,
  durationS: null,
});

/** Läuft `count` Einheiten, in denen immer genau das Angezeigte geschafft wird. */
function runShown(
  ctx: ProgressionContext,
  count: number,
  start: number,
  extra: Partial<SimStep> = {},
) {
  return simulate(
    'db_bench',
    ctx,
    planned,
    dates('2026-10-05', count).map((date) => ({ date, perform: asShown, ...extra })),
    { progress: { startWeightKg: start } },
  );
}

describe('progressFromLogs – Grundfälle', () => {
  it('ohne Verlauf: kein Gewicht, Ziel reps_min („Startgewicht finden“)', () => {
    const r = progressFromLogs('db_bench', [], dumbbell, { today: TODAY });
    expect(r).toMatchObject({ source: 'none', progress: state(null, 8), step: null, hint: null });
    expect(prescriptionForDisplay(planned, r, { isDeload: false, steps: DB_STEPS })).toEqual({
      sets: 3,
      extraSet: false,
      isReturn: false,
      targetReps: 8,
      weightKg: null,
      chooseLightest: false,
      durationS: null,
      rpeTarget: 8,
    });
  });

  it('eigenes Startgewicht: roh gespeichert, Anzeige auf Stufen abgerundet', () => {
    const r = progressFromLogs('db_bench', [], dumbbell, { today: TODAY, startWeightKg: 21 });
    expect(r.source).toBe('start_weight');
    expect(r.progress.weightKg).toBe(21);
    expect(prescriptionForDisplay(planned, r, { isDeload: false, steps: DB_STEPS }).weightKg).toBe(
      20,
    );
  });

  it('Startgewicht gilt nur ohne Eintrag', () => {
    const entries = [entry({ performedOn: '2026-10-05', sets: [set(10, 20, 8)] })];
    expect(
      progressFromLogs('db_bench', entries, dumbbell, { today: TODAY, startWeightKg: 30 }).source,
    ).toBe('calibration');
  });

  it('Startgewicht über der Schwelle (Kurzhantel 50 kg) nur mit Bestätigung', () => {
    expect(
      progressFromLogs('db_bench', [], dumbbell, { today: TODAY, startWeightKg: 60 }),
    ).toMatchObject({
      source: 'none',
      hint: 'confirm_weight',
    });
    expect(
      progressFromLogs('db_bench', [], dumbbell, {
        today: TODAY,
        startWeightKg: 60,
        startWeightConfirmed: true,
      }).progress.weightKg,
    ).toBe(60);
  });

  it('erster Eintrag kalibriert über estimateWorkingWeight (Epley + Reserve)', () => {
    // 20 kg × 10 bei RPE 8: e1RM = 20 × (1 + 12/30) = 28 → Ziel 8 Wdh. bei RPE 8: 28 / (1 + 10/30) = 21.
    const entries = [entry({ performedOn: '2026-10-05', sets: [set(10, 20, 8), set(8, 20, 8)] })];
    const r = progressFromLogs('db_bench', entries, dumbbell, { today: TODAY });
    expect(r).toMatchObject({ source: 'calibration', progress: state(21, 8) });
    expect(prescriptionForDisplay(planned, r, { isDeload: false, steps: DB_STEPS }).weightKg).toBe(
      20,
    );
  });

  it('eine Einheit geschafft → +1 Wiederholung', () => {
    const { next } = runShown(dumbbell, 1, 20);
    expect(next).toMatchObject({
      source: 'logs',
      progress: state(20, 9),
      step: { kind: 'add_rep' },
    });
  });

  it('nicht geschafft → Zustand bleibt', () => {
    const { next } = simulate(
      'db_bench',
      dumbbell,
      planned,
      [{ date: '2026-10-05', perform: all(7) }],
      { progress: { startWeightKg: 20 } },
    );
    expect(next.progress).toEqual(state(20, 8));
    expect(next.step).toEqual({ kind: 'keep' });
  });

  it('zweimal ab reps_max → Gewicht (Langhantel +2,5 kg, Ziel zurück auf reps_min)', () => {
    const { next, records } = runShown(barbell, 6, 60);
    expect(records.map((r) => r.prescription.targetReps)).toEqual([8, 9, 10, 11, 12, 12]);
    expect(next.progress).toEqual(state(62.5, 8));
    expect(next.firstSessionRpeTarget).toBeNull();
    expect(BARBELL).toContain(62.5);
  });

  it('Kurzhantel 4 → 6 kg (> 10 %): Puffer-Wdh. → Zusatzsatz → Sprung mit RPE −1', () => {
    const { records, next } = runShown({ ...dumbbell, steps: [4, 6, 8] }, 12, 4);
    expect(records.map((r) => [r.prescription.targetReps, r.prescription.sets])).toEqual([
      [8, 3],
      [9, 3],
      [10, 3],
      [11, 3],
      [12, 3],
      [12, 3],
      [13, 3],
      [13, 3],
      [14, 3],
      [14, 3],
      [14, 4],
      [14, 4],
    ]);
    expect(next.progress).toEqual(state(6, 8));
    expect(next.firstSessionRpeTarget).toBe(7);
    expect(
      prescriptionForDisplay(planned, next, { isDeload: false, steps: [4, 6, 8] }),
    ).toMatchObject({ weightKg: 6, sets: 3, targetReps: 8, rpeTarget: 7 });
  });

  it('keine höhere Stufe → Hinweis no_heavier_weight, Zustand bleibt', () => {
    const { next } = runShown({ ...dumbbell, steps: [4] }, 12, 4);
    expect(next.hint).toBe('no_heavier_weight');
    expect(next.progress).toEqual(state(4, 14, true));
  });

  it('500 kg: keine Stufe darüber → no_heavier_weight statt „Sprung“ auf dasselbe Gewicht', () => {
    const entries = [
      entry({
        performedOn: '2026-10-05',
        state: state(500, 14, true),
        targetSets: 4,
        sets: Array(4).fill(set(14, 500)),
      }),
      entry({
        performedOn: '2026-10-07',
        state: state(500, 14, true),
        targetSets: 4,
        sets: Array(4).fill(set(14, 500)),
      }),
    ];
    const r = progressFromLogs('db_bench', entries, { ...barbell, steps: [] }, { today: TODAY });
    expect(r.hint).toBe('no_heavier_weight');
    expect(r.progress.weightKg).toBe(500);
  });

  it('Halteübung 20 s → 22 s, 50 s → 55 s, 120 s → schwerere Variante', () => {
    const plank: ProgressionContext = {
      ...dumbbell,
      loadType: 'time',
      repsMin: null,
      repsMax: null,
      durationS: 20,
      incrementKind: 'none',
      steps: [],
    };
    const plankPlan: PlannedDosage = {
      sets: 3,
      reps_min: null,
      reps_max: null,
      duration_s: 20,
      rpe_target: 7,
    };
    const run = (seconds: number) =>
      simulate(
        'plank',
        { ...plank, durationS: seconds },
        { ...plankPlan, duration_s: seconds },
        dates('2026-10-05', 3).map((date) => ({ date, perform: hold(seconds) })),
      ).next;
    expect(run(20).progress.durationS).toBe(22);
    expect(run(50).progress.durationS).toBe(55);
    expect(run(120)).toMatchObject({ hint: 'harder_variant', progress: { durationS: 120 } });
  });

  it('Band → stärkeres Band (nur Hinweis)', () => {
    const ctx: ProgressionContext = {
      ...dumbbell,
      loadType: 'band',
      incrementKind: 'none',
      steps: [],
    };
    const { next } = simulate(
      'band_row',
      ctx,
      planned,
      dates('2026-10-05', 7).map((date) => ({ date, perform: all(12, { weightKg: null }) })),
    );
    expect(next.hint).toBe('stronger_band');
    expect(next.progress.targetReps).toBe(12);
  });

  it('Körpergewicht (Engine 3): Puffer bis reps_max + 2, dann Zusatzsatz, erst dann schwerere Variante', () => {
    const ctx: ProgressionContext = {
      ...dumbbell,
      loadType: 'bodyweight',
      incrementKind: 'none',
      steps: [],
    };
    // Immer genau das Ziel geschafft.
    const asTarget = (p: Prescription) => all(p.targetReps ?? 0, { weightKg: null })(p);
    const run = (count: number) =>
      simulate(
        'pushup',
        ctx,
        planned,
        dates('2026-10-05', count).map((date) => ({ date, perform: asTarget })),
      );
    // Bei reps_max (12) ohne Hinweis: weiter mit Puffer-Wdh.
    const mid = run(7).next;
    expect(mid.hint).toBeNull();
    expect(mid.progress.targetReps).toBeGreaterThan(12);
    const end = run(20);
    expect(end.next.hint).toBe('harder_variant');
    expect(end.next.progress).toMatchObject({ targetReps: 14, extraSet: true, weightKg: null });
    // Der Zusatzsatz wurde wirklich angezeigt, bevor die Variante kam.
    expect(end.records.some((r) => r.prescription.sets === 4)).toBe(true);
    expect(end.records.every((r) => (r.prescription.targetReps ?? 0) <= 14)).toBe(true);
  });
});

describe('Einstiegs- und Erholungswoche', () => {
  it('Erholungswoche ändert den Zustand nicht – auch zweimal in Folge (W4)', () => {
    const base = runShown(dumbbell, 2, 20);
    const withDeload = simulate(
      'db_bench',
      dumbbell,
      planned,
      [
        { date: '2026-10-20', isDeload: true, perform: asShown },
        { date: '2026-10-22', isDeload: true, perform: asShown },
      ],
      { initial: base.entries },
    );
    expect(withDeload.next.progress).toEqual(base.next.progress);
    // Anzeige in der Erholungswoche: Gewicht × 0,9 abgerundet, kein Zusatzsatz.
    expect(withDeload.records[0]?.prescription.weightKg).toBe(18);
    expect(withDeload.records[0]?.entry.state).toEqual(base.next.progress);
  });

  it('Woche 0 → Woche 1: Einstiegswoche kalibriert das Gewicht (R1), zählt aber nicht doppelt', () => {
    const intro = [
      entry({ performedOn: '2026-10-01', isIntroWeek: true, targetRpe: 7, sets: [set(10, 20, 8)] }),
    ];
    const r = progressFromLogs('db_bench', intro, dumbbell, { today: TODAY });
    expect(r).toMatchObject({ source: 'calibration', progress: state(21, 8) });
    // zweite Einstiegs-Einheit mit gespeichertem Zustand: keine Steigerung
    const second = [
      ...intro,
      entry({
        performedOn: '2026-10-03',
        isIntroWeek: true,
        state: state(21, 8),
        sets: Array(3).fill(set(12, 20)),
      }),
    ];
    expect(progressFromLogs('db_bench', second, dumbbell, { today: TODAY }).progress).toEqual(
      state(21, 8),
    );
    const week1 = prescriptionForDisplay(
      planned,
      progressFromLogs('db_bench', second, dumbbell, { today: TODAY }),
      {
        isDeload: false,
        steps: DB_STEPS,
      },
    );
    expect(week1).toMatchObject({ weightKg: 20, targetReps: 8, sets: 3 });
  });
});

describe('Orte, Fassungen, Pläne (W4, W7)', () => {
  it('Studio → EINE verpatzte Einheit zu Hause → Studio zeigt wieder 22,5 mit Studio-Stand (B1)', () => {
    const homeSteps = [4, 6, 8, 10, 12, 14, 16, 18, 20];
    const studio = runShown(dumbbell, 3, 22.5);
    expect(studio.next.progress).toEqual(state(22.5, 11));
    const home = simulate(
      'db_bench',
      dumbbell,
      planned,
      [{ date: '2026-10-12', steps: homeSteps, perform: all(7) }],
      { initial: studio.entries },
    );
    expect(home.records[0]?.prescription).toMatchObject({ weightKg: 20, targetReps: 11 });
    // Rohwert bleibt 22,5 × 11 – gespeichert und für das Studio
    expect(home.records[0]?.entry.state).toEqual(state(22.5, 11));
    expect(home.next.progress).toEqual(state(22.5, 11));
    expect(home.next.selfChosenWeight).toBe(false);
    const back = prescriptionForDisplay(planned, home.next, { isDeload: false, steps: DB_STEPS });
    expect(back).toMatchObject({ weightKg: 22.5, targetReps: 11 });
  });

  it('Studio → mehrere Einheiten zu Hause (< 4 Wochen) → Studio 22,5 mit gleichem Wdh.-Stand (B1)', () => {
    const homeSteps = [4, 6, 8, 10, 12, 14, 16, 18, 20];
    const studio = runShown(dumbbell, 3, 22.5);
    const home = simulate(
      'db_bench',
      dumbbell,
      planned,
      dates('2026-10-12', 6).map((date) => ({ date, steps: homeSteps, perform: asShown })),
      { initial: studio.entries },
    );
    // zu Hause eigener Fortschritt an 20 kg – wandert nicht ins Studio
    expect(home.records.map((r) => r.prescription.weightKg)).toEqual(Array(6).fill(20));
    expect(home.records.map((r) => r.prescription.targetReps)).toEqual([11, 12, 12, 13, 13, 14]);
    expect(
      home.records.every(
        (r) => r.entry.state?.weightKg === 22.5 && r.entry.state.targetReps === 11,
      ),
    ).toBe(true);
    const back = simulate(
      'db_bench',
      dumbbell,
      planned,
      dates('2026-10-26', 4).map((date) => ({ date, perform: asShown })),
      { initial: home.entries },
    );
    expect(back.records.map((r) => [r.prescription.weightKg, r.prescription.targetReps])).toEqual([
      [22.5, 11],
      [22.5, 12],
      [22.5, 12],
      [22.5, 13],
    ]);
  });

  it('lange Phase zu Hause (> 4 Wochen ohne volles Gewicht) → Studio: erst Wiedereinstieg, dann Studio-Stand (C1)', () => {
    const homeSteps = [4, 6, 8, 10, 12, 14, 16, 18, 20];
    const studio = runShown(dumbbell, 3, 22.5);
    const home = simulate(
      'db_bench',
      dumbbell,
      planned,
      dates('2026-10-12', 12).map((date) => ({ date, steps: homeSteps, perform: asShown })),
      { initial: studio.entries },
    );
    expect(home.records.every((r) => !r.prescription.isReturn)).toBe(true);
    const back = simulate(
      'db_bench',
      dumbbell,
      planned,
      dates('2026-11-10', 3).map((date) => ({ date, perform: asShown })),
      { initial: home.entries },
    );
    expect(
      back.records.map((r) => [
        r.prescription.weightKg,
        r.prescription.targetReps,
        r.prescription.isReturn,
      ]),
    ).toEqual([
      [20, 8, true],
      [22.5, 11, false],
      [22.5, 12, false],
    ]);
    expect(back.records[0]?.entry.isReturn).toBe(true);
    expect(back.records[0]?.entry.state).toEqual(state(22.5, 11));
  });

  it('Mo 20 / Sa 90: kurze Fassung (2 Sätze) zählt als geschafft', () => {
    const ctx = { ...barbell, templateSets: 4 };
    const { next } = simulate(
      'squat',
      ctx,
      { ...planned, sets: 4 },
      [{ date: '2026-10-05', plannedSets: 2, perform: asShown }],
      { progress: { startWeightKg: 60 } },
    );
    expect(next.progress).toEqual(state(60, 9));
  });

  it('W7: zweimal Mo 20 hintereinander → kein Gewichtssprung (Puffer-Wdh. nur bei großem Sprung)', () => {
    const ctx = { ...barbell, templateSets: 4 };
    const entries = ['2026-10-05', '2026-10-12'].map((performedOn) =>
      entry({ performedOn, state: state(60, 12), targetSets: 2, sets: Array(2).fill(set(12, 60)) }),
    );
    expect(progressFromLogs('db_bench', entries, ctx, { today: TODAY }).progress).toEqual(
      state(60, 12),
    );
    const big = ['2026-10-05', '2026-10-12'].map((performedOn) =>
      entry({ performedOn, state: state(20, 12), targetSets: 2, sets: Array(2).fill(set(12, 20)) }),
    );
    expect(
      progressFromLogs(
        'db_bench',
        big,
        { ...dumbbell, templateSets: 4, steps: [20, 25] },
        { today: TODAY },
      ).progress,
    ).toEqual(state(20, 13));
  });

  it('W7: Mo 20 + Sa 90 → Gewichtssprung möglich', () => {
    const ctx = { ...barbell, templateSets: 4 };
    const entries = [
      entry({
        performedOn: '2026-10-05',
        state: state(60, 12),
        targetSets: 2,
        sets: Array(2).fill(set(12, 60)),
      }),
      entry({
        performedOn: '2026-10-10',
        state: state(60, 12),
        targetSets: 4,
        sets: Array(4).fill(set(12, 60)),
      }),
    ];
    expect(progressFromLogs('db_bench', entries, ctx, { today: TODAY }).progress).toEqual(
      state(62.5, 8),
    );
  });

  it('neuer Plan mit anderem Wdh.-Bereich: Anzeige geklemmt', () => {
    const r: Pick<ProgressResult, 'progress' | 'firstSessionRpeTarget'> = {
      progress: state(20, 14),
      firstSessionRpeTarget: null,
    };
    const low = { ...planned, reps_min: 5, reps_max: 6 };
    expect(prescriptionForDisplay(low, r, { isDeload: false, steps: DB_STEPS }).targetReps).toBe(8);
    const high = { ...planned, reps_min: 15, reps_max: 20 };
    expect(prescriptionForDisplay(high, r, { isDeload: false, steps: DB_STEPS }).targetReps).toBe(
      15,
    );
  });

  it('Einträge in falscher Reihenfolge (zwei Geräte) → gleiches Ergebnis', () => {
    const { entries } = runShown(barbell, 6, 60);
    const shuffled = [
      entries[3],
      entries[0],
      entries[5],
      entries[1],
      entries[4],
      entries[2],
    ] as ExerciseLogEntry[];
    expect(progressFromLogs('db_bench', shuffled, barbell, { today: TODAY })).toEqual(
      progressFromLogs('db_bench', entries, barbell, { today: TODAY }),
    );
  });

  it('1 vs. 7 Trainingstage je Woche: Progression hängt nur an den Einträgen', () => {
    const daily = simulate(
      'db_bench',
      barbell,
      planned,
      dates('2026-10-05', 6, 1).map((date) => ({ date, perform: asShown })),
      { progress: { startWeightKg: 60 } },
    );
    const weekly = simulate(
      'db_bench',
      barbell,
      planned,
      dates('2026-10-05', 6, 7).map((date) => ({ date, perform: asShown })),
      { progress: { startWeightKg: 60 } },
    );
    expect(daily.next.progress).toEqual(weekly.next.progress);
  });
});

describe('Widerruf, Alternative, eigenes Gewicht', () => {
  it('nach Widerruf (Zustand und Vorgabe leer): neu kalibriert aus den Ist-Werten', () => {
    const neutral = [
      entry({
        performedOn: '2026-10-05',
        targetRpe: null,
        targetSets: null,
        sets: Array(3).fill(set(12, 22.5, 9)),
      }),
      entry({
        performedOn: '2026-10-07',
        targetRpe: null,
        targetSets: null,
        sets: Array(3).fill(set(10, 22.5, 8)),
      }),
    ];
    const r = progressFromLogs('db_bench', neutral, dumbbell, { today: TODAY });
    // neuester Eintrag: 22,5 × 10 @8 → e1RM 31,5 → Ziel 8 @8: 23,625 → Deckel 24,75 → 23,5
    expect(r).toMatchObject({ source: 'calibration', progress: state(23.5, 8) });
  });

  it('ohne target_rpe gilt das vorsichtige Ziel RPE 7', () => {
    const e = [
      entry({
        performedOn: '2026-10-05',
        state: state(20, 8),
        targetRpe: null,
        sets: Array(3).fill(set(8, 20, 8)),
      }),
    ];
    expect(progressFromLogs('db_bench', e, dumbbell, { today: TODAY }).progress).toEqual(
      state(20, 8),
    );
    const ok = [
      entry({
        performedOn: '2026-10-05',
        state: state(20, 8),
        targetRpe: null,
        sets: Array(3).fill(set(8, 20, 7)),
      }),
    ];
    expect(progressFromLogs('db_bench', ok, dumbbell, { today: TODAY }).progress).toEqual(
      state(20, 9),
    );
  });

  it('vorsichtiger Plan (RPE 7): Satz mit RPE 8 zählt nicht', () => {
    const e = [
      entry({
        performedOn: '2026-10-05',
        state: state(20, 8),
        targetRpe: 7,
        sets: Array(3).fill(set(8, 20, 8)),
      }),
    ];
    expect(
      progressFromLogs('db_bench', e, { ...dumbbell, rpeTarget: 7 }, { today: TODAY }).step,
    ).toEqual({
      kind: 'keep',
    });
  });

  it('Alternative: eigener Verlauf, geplante Übung unverändert; Alternative zweimal → +Wdh. (W6, R2)', () => {
    const planned1 = entry({
      performedOn: '2026-10-05',
      state: state(20, 10),
      sets: Array(3).fill(set(10, 20)),
    });
    const ctxB: ProgressionContext = { ...dumbbell, steps: DB_STEPS };
    const first = buildExerciseLogEntry({
      exerciseId: 'db_fly',
      performedOn: '2026-10-07',
      loggedAt: '2026-10-07T18:00:00Z',
      status: 'alternative',
      loadType: 'weight',
      isIntroWeek: false,
      isDeload: false,
      progress: progressFromLogs('db_fly', [planned1], ctxB, { today: TODAY }),
      prescription: {
        sets: 3,
        extraSet: false,
        isReturn: false,
        targetReps: 8,
        weightKg: 12,
        chooseLightest: false,
        durationS: null,
        rpeTarget: 8,
      },
      sets: [set(10, 12, 8), set(10, 12, 8), set(10, 12, 8)],
    });
    expect(first.state).toBeNull();
    // eigene angezeigte Vorgabe der Alternativ-Übung (R2)
    expect(first.targetWeightKg).toBe(12);
    const afterFirst = progressFromLogs('db_fly', [planned1, first], ctxB, { today: TODAY });
    expect(afterFirst).toMatchObject({ source: 'calibration' });
    const shownB = prescriptionForDisplay(planned, afterFirst, {
      isDeload: false,
      steps: DB_STEPS,
    });
    // kalibriert 12,5 kg (roh), angezeigt 12 kg (Stufe) – genau die Anzeige geschafft
    expect([afterFirst.progress.weightKg, shownB.weightKg]).toEqual([12.5, 12]);
    const second = buildExerciseLogEntry({
      exerciseId: 'db_fly',
      performedOn: '2026-10-09',
      loggedAt: '2026-10-09T18:00:00Z',
      status: 'alternative',
      loadType: 'weight',
      isIntroWeek: false,
      isDeload: false,
      progress: afterFirst,
      prescription: shownB,
      sets: Array(3).fill(set(8, shownB.weightKg)),
    });
    expect(second.state).toEqual(afterFirst.progress);
    const afterSecond = progressFromLogs('db_fly', [planned1, first, second], ctxB, {
      today: TODAY,
    });
    // Rohwert 12,5 bleibt; am Ort (12 kg) +1 Wdh.
    expect(afterSecond.progress).toEqual(state(12.5, 8));
    expect(afterSecond.effective).toEqual(state(12, 9));
    // geplante Übung: unverändert aus ihrem eigenen Eintrag (10 → 11)
    expect(
      progressFromLogs('db_bench', [planned1, first, second], dumbbell, { today: TODAY }).progress,
    ).toEqual(state(20, 11));
  });

  it('selbst gewähltes leichteres Gewicht → neuer Ausgangspunkt ohne Sprung', () => {
    const e = [
      entry({
        performedOn: '2026-10-05',
        state: state(20, 10),
        targetWeightKg: 20,
        sets: Array(3).fill(set(10, 16)),
      }),
    ];
    expect(progressFromLogs('db_bench', e, dumbbell, { today: TODAY })).toMatchObject({
      progress: state(16, 10),
      selfChosenWeight: true,
      step: null,
    });
  });

  it('schwerer bis 10 %: übernommen; > 10 % nur mit Bestätigung (W5)', () => {
    const heavier = (weightKg: number, weightConfirmed: boolean) => [
      entry({
        performedOn: '2026-10-05',
        state: state(60, 10),
        targetWeightKg: 60,
        weightConfirmed,
        sets: Array(3).fill(set(10, weightKg)),
      }),
    ];
    expect(
      progressFromLogs('db_bench', heavier(65, false), barbell, { today: TODAY }).progress.weightKg,
    ).toBe(65);
    // 600 statt 60 (Tippfehler): bleibt bei 60, normales nextLoad (+1 Wdh.)
    expect(
      progressFromLogs('db_bench', heavier(225, false), barbell, { today: TODAY }).progress,
    ).toEqual(state(60, 11));
    expect(
      progressFromLogs('db_bench', heavier(80, true), barbell, { today: TODAY }).progress.weightKg,
    ).toBe(80);
  });

  it('einzelner Ausreißer-Satz (nicht alle gleich) ist kein eigenes Gewicht', () => {
    const e = [
      entry({
        performedOn: '2026-10-05',
        state: state(20, 10),
        targetWeightKg: 20,
        sets: [set(10, 20), set(10, 200), set(10, 20)],
      }),
    ];
    expect(progressFromLogs('db_bench', e, dumbbell, { today: TODAY }).progress).toEqual(
      state(20, 11),
    );
  });

  it('erster Eintrag über der absoluten Schwelle ohne Bestätigung → keine Kalibrierung', () => {
    const e = [entry({ performedOn: '2026-10-05', sets: [set(10, 225, 8)] })];
    expect(progressFromLogs('db_bench', e, dumbbell, { today: TODAY })).toMatchObject({
      source: 'none',
      hint: 'confirm_weight',
      progress: { weightKg: null },
    });
    const confirmed = [
      entry({ performedOn: '2026-10-05', weightConfirmed: true, sets: [set(10, 60, 8)] }),
    ];
    expect(progressFromLogs('db_bench', confirmed, dumbbell, { today: TODAY }).source).toBe(
      'calibration',
    );
  });
});

describe('Grenzen', () => {
  it('0 Wdh. zählt nicht als geschafft; 100 Wdh. schon', () => {
    const zero = [
      entry({ performedOn: '2026-10-05', state: state(20, 8), sets: Array(3).fill(set(0, 20)) }),
    ];
    expect(progressFromLogs('db_bench', zero, dumbbell, { today: TODAY }).progress).toEqual(
      state(20, 8),
    );
    const many = [
      entry({ performedOn: '2026-10-05', state: state(20, 8), sets: Array(3).fill(set(100, 20)) }),
    ];
    expect(progressFromLogs('db_bench', many, dumbbell, { today: TODAY }).progress).toEqual(
      state(20, 9),
    );
  });

  it('1 Satz geplant genügt einer; 10 Sätze gemacht bei 3 geplanten zählen', () => {
    const one = [
      entry({ performedOn: '2026-10-05', state: state(20, 8), targetSets: 1, sets: [set(8, 20)] }),
    ];
    expect(progressFromLogs('db_bench', one, dumbbell, { today: TODAY }).progress.targetReps).toBe(
      9,
    );
    const ten = [
      entry({ performedOn: '2026-10-05', state: state(20, 8), sets: Array(10).fill(set(8, 20)) }),
    ];
    expect(progressFromLogs('db_bench', ten, dumbbell, { today: TODAY }).progress.targetReps).toBe(
      9,
    );
    const tooFew = [
      entry({ performedOn: '2026-10-05', state: state(20, 8), sets: Array(2).fill(set(8, 20)) }),
    ];
    expect(
      progressFromLogs('db_bench', tooFew, dumbbell, { today: TODAY }).progress.targetReps,
    ).toBe(8);
  });

  it('0,5 kg: kleinstes Startgewicht; darunter ungültig', () => {
    const ctx = { ...dumbbell, steps: [] };
    expect(
      progressFromLogs('db_bench', [], ctx, { today: TODAY, startWeightKg: 0.5 }).progress.weightKg,
    ).toBe(0.5);
    expect(progressFromLogs('db_bench', [], ctx, { today: TODAY, startWeightKg: 0.4 }).source).toBe(
      'none',
    );
    expect(
      progressFromLogs('db_bench', [], ctx, {
        today: TODAY,
        startWeightKg: 501,
        startWeightConfirmed: true,
      }).source,
    ).toBe('none');
  });

  it('Zustand unter der kleinsten Stufe → „leichteste Stufe wählen“', () => {
    const r = { progress: state(3, 8), firstSessionRpeTarget: null };
    expect(
      prescriptionForDisplay(planned, r, { isDeload: false, steps: HOME_STEPS }),
    ).toMatchObject({
      weightKg: null,
      chooseLightest: true,
    });
  });

  it('Personen 16 und 95 Jahre: Deckel der Sicherheitsregeln wirken nach der Progression', () => {
    const r = { progress: state(20, 8), firstSessionRpeTarget: null };
    const plan9 = { ...planned, rpe_target: 9 };
    expect(prescriptionForDisplay(plan9, r, { isDeload: false, rpeMax: 8 }).rpeTarget).toBe(8);
    expect(prescriptionForDisplay(plan9, r, { isDeload: false, rpeMax: 7 }).rpeTarget).toBe(7);
  });

  it('Zusatzsatz nicht in der Erholungswoche und nicht über V9 bzw. 6 Sätze', () => {
    const r = { progress: state(20, 14, true), firstSessionRpeTarget: null };
    expect(prescriptionForDisplay(planned, r, { isDeload: false }).sets).toBe(4);
    expect(prescriptionForDisplay(planned, r, { isDeload: true }).sets).toBe(3);
    expect(prescriptionForDisplay(planned, r, { isDeload: false, allowExtraSet: false }).sets).toBe(
      3,
    );
    expect(prescriptionForDisplay({ ...planned, sets: 6 }, r, { isDeload: false }).sets).toBe(6);
  });
});

describe('Roher Zustand zwischen zwei Stufen (Wächter Etappe A, Befund 1)', () => {
  it('kalibriert 21 kg bei Stufen 20/22,5: Rohwert bleibt 21, an 20 kg mit Puffer → Rohwert 22,5 (B1)', () => {
    const ctx = { ...dumbbell, steps: [20, 22.5] };
    const first = [entry({ performedOn: '2026-10-01', sets: [set(10, 20, 8)] })];
    expect(progressFromLogs('db_bench', first, ctx, { today: TODAY }).progress).toEqual(
      state(21, 8),
    );
    const { records, next } = simulate(
      'db_bench',
      ctx,
      planned,
      dates('2026-10-03', 12).map((date) => ({ date, perform: asShown })),
      { initial: first },
    );
    expect(records.every((r) => r.entry.state?.weightKg === 21)).toBe(true);
    expect(
      records.map((r) => [r.prescription.weightKg, r.prescription.targetReps, r.prescription.sets]),
    ).toEqual([
      [20, 8, 3],
      [20, 9, 3],
      [20, 10, 3],
      [20, 11, 3],
      [20, 12, 3],
      [20, 12, 3],
      [20, 13, 3],
      [20, 13, 3],
      [20, 14, 3],
      [20, 14, 3],
      [20, 14, 4],
      [20, 14, 4],
    ]);
    expect(records.every((r) => !r.result.selfChosenWeight)).toBe(true);
    expect(next.progress).toEqual(state(22.5, 8));
  });

  it('Langhantel-Startgewicht 61 kg: Rohwert bleibt 61, W = 60, dann 62,5 (B2)', () => {
    const { records, next } = runShown(barbell, 6, 61);
    expect(records.map((r) => r.prescription.weightKg)).toEqual(Array(6).fill(60));
    expect(records.every((r) => r.entry.state?.weightKg === 61)).toBe(true);
    expect(records.map((r) => r.prescription.targetReps)).toEqual([8, 9, 10, 11, 12, 12]);
    expect(next.progress).toEqual(state(62.5, 8));
  });

  it('Alternative zu Hause mit Rundung: kein eigener Wunsch, Rohwert bleibt (B3)', () => {
    const home = { ...dumbbell, steps: [4, 6, 8, 10, 12] };
    const base = entry({
      exerciseId: 'db_fly',
      performedOn: '2026-10-05',
      status: 'alternative',
      state: state(12.5, 10),
      targetWeightKg: 12,
      targetReps: 10,
      sets: Array(3).fill(set(9, 12)),
    });
    expect(progressFromLogs('db_fly', [base], home, { today: TODAY })).toMatchObject({
      progress: state(12.5, 10),
      effective: state(12, 10),
      selfChosenWeight: false,
    });
    const achieved = { ...base, sets: Array(3).fill(set(10, 12)) };
    expect(progressFromLogs('db_fly', [achieved], home, { today: TODAY })).toMatchObject({
      progress: state(12.5, 10),
      effective: state(12, 11),
    });
  });

  it('deutlich leichter (unter 50 % oder unter kleinster Stufe) nur mit Bestätigung', () => {
    const lighter = (weightKg: number, weightConfirmed: boolean) => [
      entry({
        performedOn: '2026-10-05',
        state: state(40, 10),
        targetWeightKg: 40,
        weightConfirmed,
        sets: Array(3).fill(set(10, weightKg)),
      }),
    ];
    const ctx = { ...dumbbell, steps: [4, 6, 8, 10, 20, 30, 40] };
    expect(
      progressFromLogs('db_bench', lighter(20, false), ctx, { today: TODAY }).progress.weightKg,
    ).toBe(20);
    expect(
      progressFromLogs('db_bench', lighter(19.5, false), ctx, { today: TODAY }).progress,
    ).toEqual(state(40, 10));
    expect(
      progressFromLogs('db_bench', lighter(19.5, true), ctx, { today: TODAY }).progress.weightKg,
    ).toBe(19.5);
    const steps = { ...dumbbell, steps: [24, 32, 40] };
    expect(
      progressFromLogs('db_bench', lighter(22, false), steps, { today: TODAY }).progress,
    ).toEqual(state(40, 10));
    expect(
      progressFromLogs('db_bench', lighter(22, true), steps, { today: TODAY }).progress.weightKg,
    ).toBe(22);
  });
});

describe('Wiedereinstieg nach Pause (C1, RETURN_AFTER_PAUSE)', () => {
  const studio = () => runShown(dumbbell, 3, 22.5); // letzte Einheit 2026-10-09, Zustand 22,5 × 11
  const at = (today: string, entries = studio().entries, ctx = dumbbell) =>
    progressFromLogs('db_bench', entries, ctx, { today });

  it('genau 4 Wochen: noch normal; 4 Wochen + 1 Tag: Wiedereinstieg', () => {
    expect(at('2026-11-06').returnAfterPause).toBe(false);
    expect(at('2026-11-07').returnAfterPause).toBe(true);
    expect(at('2026-11-07').progress).toEqual(state(22.5, 11)); // Rohwert bleibt
  });

  it('Pause im Studio: ×0,9, reps_min, kein Zusatzsatz, RPE −1; zählt nicht, danach Rohwert', () => {
    const entries = [...studio().entries];
    const r = {
      ...at('2026-11-20', entries),
      progress: state(22.5, 11, true),
      effective: state(22.5, 11, true),
    };
    expect(prescriptionForDisplay(planned, r, { isDeload: false, steps: DB_STEPS })).toMatchObject({
      weightKg: 20,
      targetReps: 8,
      sets: 3,
      extraSet: false,
      rpeTarget: 7,
      isReturn: true,
    });
    const back = simulate(
      'db_bench',
      dumbbell,
      planned,
      dates('2026-11-20', 2).map((date) => ({ date, perform: asShown })),
      { initial: entries },
    );
    expect(back.records.map((x) => [x.prescription.weightKg, x.prescription.targetReps])).toEqual([
      [20, 8],
      [22.5, 11],
    ]);
  });

  it('RPE nie unter 5', () => {
    const r = { ...at('2026-11-20'), progress: state(22.5, 11) };
    expect(
      prescriptionForDisplay({ ...planned, rpe_target: 5 }, r, { isDeload: false, steps: DB_STEPS })
        .rpeTarget,
    ).toBe(5);
  });

  it('Erholungswoche direkt nach Pause: das Strengere gewinnt, nie doppelt ×0,9', () => {
    const r = at('2026-11-20');
    const deload = prescriptionForDisplay({ ...planned, sets: 2, rpe_target: 6 }, r, {
      isDeload: true,
      steps: DB_STEPS,
    });
    // 22,5 × 0,9 = 20,25 → 20 (nicht 22,5 × 0,81 = 18,2 → 18); RPE der Erholungswoche 6 (nicht 5)
    expect(deload).toMatchObject({
      weightKg: 20,
      targetReps: 8,
      sets: 2,
      rpeTarget: 6,
      isReturn: true,
    });
  });

  it('Übung erstmals nach Pause im neuen Plan (anderer Wdh.-Bereich, RPE 9)', () => {
    const newPlan = { ...dumbbell, repsMin: 5, repsMax: 8, rpeTarget: 9 };
    const r = at('2026-12-01', studio().entries, newPlan);
    expect(r.returnAfterPause).toBe(true);
    expect(
      prescriptionForDisplay(
        { sets: 4, reps_min: 5, reps_max: 8, duration_s: null, rpe_target: 9 },
        r,
        {
          isDeload: false,
          steps: DB_STEPS,
        },
      ),
    ).toMatchObject({ weightKg: 20, targetReps: 5, sets: 4, rpeTarget: 8 });
  });

  it('ohne Eintrag kein Wiedereinstieg; Training von heute zählt', () => {
    expect(
      progressFromLogs('db_bench', [], dumbbell, { today: '2027-01-01', startWeightKg: 20 })
        .returnAfterPause,
    ).toBe(false);
    expect(
      progressFromLogs('db_bench', studio().entries, dumbbell, { today: TODAY }).returnAfterPause,
    ).toBe(false);
  });
});

describe('Wiedereinstieg: Pause = 28 Tage ohne Training an mindestens dem heute gezeigten Gewicht (D1)', () => {
  const HOME20 = [4, 6, 8, 10, 12, 14, 16, 18, 20];
  const display = (r: ProgressResult, steps: readonly number[]) =>
    prescriptionForDisplay(planned, r, { isDeload: false, steps });

  it('nur zu Hause trainiert, 3 Monate Pause → Wiedereinstieg zu Hause', () => {
    const home = { ...dumbbell, steps: HOME20 };
    const { entries } = runShown(home, 3, 20); // bis 2026-10-09
    const r = progressFromLogs('db_bench', entries, home, { today: '2027-01-10' });
    expect(r.returnAfterPause).toBe(true);
    expect(display(r, HOME20)).toMatchObject({ weightKg: 18, targetReps: 8, isReturn: true });
  });

  it('Rohwert 21 / angezeigt 20 und Pause → Wiedereinstieg', () => {
    const ctx = { ...dumbbell, steps: [16, 18, 20, 22.5] };
    const first = [entry({ performedOn: '2026-10-01', sets: [set(10, 20, 8)] })];
    const { entries } = simulate(
      'db_bench',
      ctx,
      planned,
      dates('2026-10-03', 3).map((date) => ({ date, perform: asShown })),
      { initial: first },
    );
    const r = progressFromLogs('db_bench', entries, ctx, { today: '2026-11-20' });
    expect(r.progress.weightKg).toBe(21);
    expect(r.returnAfterPause).toBe(true);
    expect(display(r, ctx.steps)).toMatchObject({ weightKg: 18, isReturn: true });
    expect(
      progressFromLogs('db_bench', entries, ctx, { today: '2026-10-20' }).returnAfterPause,
    ).toBe(false);
  });

  it('Studio kürzlich, zu Hause nach 5 Wochen ohne Heim-Einheit → KEIN Wiedereinstieg', () => {
    const studio = runShown(dumbbell, 3, 22.5); // Studio 10-05 … 10-09
    const homeOld = entry({
      performedOn: '2026-09-01',
      state: state(22.5, 10),
      targetWeightKg: 20,
      targetReps: 10,
      sets: Array(3).fill(set(10, 20)),
    });
    const r = progressFromLogs(
      'db_bench',
      [homeOld, ...studio.entries],
      { ...dumbbell, steps: HOME20 },
      {
        today: '2026-10-15',
      },
    );
    expect(r.returnAfterPause).toBe(false);
    expect(display(r, HOME20).weightKg).toBe(20);
  });

  it('zu Hause kürzlich, Studio nach 5 Wochen ohne Studio → Wiedereinstieg im Studio', () => {
    const studio = runShown(dumbbell, 3, 22.5); // Studio bis 10-09
    const home = simulate(
      'db_bench',
      dumbbell,
      planned,
      dates('2026-10-20', 10).map((date) => ({ date, steps: HOME20, perform: asShown })),
      { initial: studio.entries },
    );
    const atStudio = progressFromLogs('db_bench', home.entries, dumbbell, { today: '2026-11-15' });
    expect(atStudio.returnAfterPause).toBe(true);
    expect(display(atStudio, DB_STEPS)).toMatchObject({
      weightKg: 20,
      targetReps: 8,
      isReturn: true,
    });
    const atHome = progressFromLogs(
      'db_bench',
      home.entries,
      { ...dumbbell, steps: HOME20 },
      {
        today: '2026-11-15',
      },
    );
    expect(atHome.returnAfterPause).toBe(false);
  });

  it('nur Einstiegswoche, dann 5 Wochen Pause → Wiedereinstieg; gar kein Eintrag → keiner', () => {
    const intro = [entry({ performedOn: '2026-10-01', isIntroWeek: true, sets: [set(10, 20, 8)] })];
    expect(
      progressFromLogs('db_bench', intro, dumbbell, { today: '2026-11-10' }).returnAfterPause,
    ).toBe(true);
    expect(
      progressFromLogs('db_bench', intro, dumbbell, { today: '2026-10-29' }).returnAfterPause,
    ).toBe(false);
    expect(
      progressFromLogs('db_bench', [], dumbbell, { today: '2027-01-01' }).returnAfterPause,
    ).toBe(false);
  });

  it('erster Tag nach einem Gewichtsschritt ist keine Pause', () => {
    const { entries } = runShown(barbell, 6, 60);
    const r = progressFromLogs('db_bench', entries, barbell, { today: '2026-10-17' });
    expect(r.progress.weightKg).toBe(62.5);
    expect(r.returnAfterPause).toBe(false);
  });

  it('Tippfehler-Satz setzt die Uhr nicht zurück (nur einheitliches, plausibles bzw. bestätigtes Gewicht)', () => {
    const studioOld = entry({
      performedOn: '2026-09-01',
      state: state(22.5, 10),
      targetWeightKg: 22.5,
      targetReps: 10,
      sets: Array(3).fill(set(10, 22.5)),
    });
    const home = (sets: LoggedSet[], weightConfirmed = false) =>
      entry({
        performedOn: '2026-10-08',
        state: state(22.5, 10),
        targetWeightKg: 20,
        targetReps: 10,
        weightConfirmed,
        sets,
      });
    const atStudio = (sets: LoggedSet[], confirmed = false) =>
      progressFromLogs('db_bench', [studioOld, home(sets, confirmed)], dumbbell, {
        today: '2026-10-10',
      }).returnAfterPause;
    // 200 kg unbestätigt, ein einzelner Satz 1 × 22,5, ein Satz 10 × 22,5 statt 20 → Wiedereinstieg im Studio
    expect(atStudio(Array(3).fill(set(10, 200)))).toBe(true);
    expect(atStudio([set(10, 20), set(10, 20), set(1, 22.5)])).toBe(true);
    expect(atStudio([set(10, 20), set(10, 20), set(10, 22.5)])).toBe(true);
    // alle Sätze einheitlich 22,5 (plausibel) bzw. bestätigt → es geht weiter
    expect(atStudio(Array(3).fill(set(10, 22.5)))).toBe(false);
    expect(atStudio(Array(3).fill(set(10, 25)), true)).toBe(false);
  });

  it('Anheben vom gerundeten Ort (angezeigt 20 → Rohwert 22,5 per Schritt): erster Tag keine Pause', () => {
    const ctx = { ...dumbbell, steps: [16, 18, 20, 22.5] };
    const first = [entry({ performedOn: '2026-10-01', sets: [set(10, 20, 8)] })];
    const { records, next, entries } = simulate(
      'db_bench',
      ctx,
      planned,
      dates('2026-10-03', 12).map((date) => ({ date, perform: asShown })),
      { initial: first },
    );
    const raised = [...records.map((x) => x.result), next].find(
      (x) => x.progress.weightKg === 22.5,
    );
    expect(raised?.step?.kind).toBe('increase_weight');
    expect(raised?.returnAfterPause).toBe(false);
    // Bezug = Heimgewicht 20 davor: alle bisherigen Einheiten zeigten 20, keine 22,5
    expect(entries.every((e) => e.targetWeightKg === null || e.targetWeightKg <= 20)).toBe(true);
  });

  it('zählender Eintrag ohne angezeigtes Gewicht setzt die Uhr nur bei gestemmtem Gewicht ≥ W zurück', () => {
    const old = entry({
      performedOn: '2026-09-01',
      state: state(25, 10),
      targetWeightKg: 25,
      targetReps: 10,
      sets: Array(3).fill(set(10, 25)),
    });
    const recent = (weight: number) =>
      entry({
        performedOn: '2026-10-08',
        state: state(25, 10),
        sets: Array(3).fill(set(10, weight)),
      });
    const at = (weight: number) =>
      progressFromLogs('db_bench', [old, recent(weight)], dumbbell, { today: '2026-10-10' });
    expect(at(10).returnAfterPause).toBe(true);
    expect(at(25).returnAfterPause).toBe(false);
  });
});

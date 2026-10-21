import { describe, expect, it } from 'vitest';

import { LIVE_ADJUSTMENT, LOAD_PROGRESSION } from '../constants';
import { barbellLoadSteps } from '../equipment';
import { prescriptionForDisplay, progressFromLogs } from '../log/progression';
import type {
  ExerciseLogEntry,
  ExerciseProgress,
  LoggedSet,
  ProgressionContext,
} from '../log/types';
import { planSafetyRules } from '../plan/safety';
import { person } from '../plan/test-library';
import { activeStateOverride } from './apply';
import { computeLiveAdjustments } from './engine';
import type { LiveExerciseEntry } from './inputs';
import {
  clearlyMissed,
  FAST_INCREASE_EXCLUSIONS,
  fastIncrease,
  fastIncreaseExclusion,
  loadReduce,
  reducedState,
} from './rules/state-rules';
import { BENCH, liveInputs, planWithFollowUps, storedFrom, testEnv } from './test-helpers';
import { adjustmentProposalSchema } from './schemas';

const TODAY = '2026-10-16';
const DB_STEPS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22.5, 25];
const HOME_STEPS = [4, 6, 8];
const dumbbell: ProgressionContext = { ...BENCH, incrementKind: 'free_weight', steps: DB_STEPS };

const set = (reps: number, weightKg: number | null, rpe: number | null = null): LoggedSet => ({
  reps,
  weightKg,
  durationS: null,
  rpe,
  done: true,
});
const st = (weightKg: number | null, targetReps: number, extraSet = false): ExerciseProgress => ({
  weightKg,
  targetReps,
  extraSet,
  durationS: null,
});

let counter = 0;
function entry(
  performedOn: string,
  state: ExerciseProgress | null,
  sets: LoggedSet[],
  partial: Partial<ExerciseLogEntry> = {},
): LiveExerciseEntry {
  counter += 1;
  return {
    exerciseId: 'bench',
    performedOn,
    loggedAt: `${performedOn}T18:00:00Z`,
    status: 'done',
    loadType: 'weight',
    isIntroWeek: false,
    isDeload: false,
    targetSets: 3,
    targetWeightKg: state?.weightKg ?? null,
    targetReps: state?.targetReps ?? null,
    targetExtraSet: false,
    targetRpe: 8,
    state,
    weightConfirmed: false,
    sets,
    sessionLogId: `log-${performedOn}-${counter}`,
    ...partial,
  };
}

const plan = planWithFollowUps(person({ experienceLevel: 'advanced' }), '2026-10-05', 1);
if (!plan) throw new Error('Plan fehlt');
// Block 2 läuft (R1 bei Einsteigern erst ab dem zweiten Block).
const sessions = plan.sessions;

function inputs(entries: LiveExerciseEntry[], overrides: Parameters<typeof liveInputs>[1] = {}) {
  return liveInputs(sessions, {
    today: TODAY,
    exerciseEntries: entries,
    contexts: { bench: BENCH },
    ...overrides,
  });
}

const missed60 = (date: string, reps = 5) =>
  entry(date, st(60, 8), [set(reps, 60), set(reps, 60), set(reps, 60)]);

describe('R2 load_reduce', () => {
  it('zweimal deutlich verfehlt (gleicher Zustand) → Gewicht × 0,9, reps_min, kein Zusatzsatz', () => {
    const p = loadReduce(inputs([missed60('2026-10-12'), missed60('2026-10-14')]), 'bench', BENCH);
    expect(p?.rule).toBe('load_reduce');
    expect(p?.stateBefore).toEqual(st(60, 8));
    expect(p?.stateAfter).toEqual({
      weightKg: 54,
      targetReps: 8,
      extraSet: false,
      durationS: null,
    });
    expect(p?.basisSessionLogId).toMatch(/^log-2026-10-14/);
    expect(p?.effectiveFrom).toBe('2026-10-17');
    expect(adjustmentProposalSchema.safeParse(p).success).toBe(true);
  });

  it('nur einmal verfehlt bzw. unterschiedlicher Zustand → nichts', () => {
    const ok = entry('2026-10-12', st(60, 8), [set(8, 60), set(8, 60), set(8, 60)]);
    expect(loadReduce(inputs([ok, missed60('2026-10-14')]), 'bench', BENCH)).toBeNull();
    const other = entry('2026-10-12', st(57.5, 8), [set(5, 57.5), set(5, 57.5), set(5, 57.5)]);
    expect(loadReduce(inputs([other, missed60('2026-10-14')]), 'bench', BENCH)).toBeNull();
  });

  it('genau 50 % der Sätze verfehlt feuert, darunter (1 von 3 = 33 %) nicht', () => {
    const half = (date: string) =>
      entry(date, st(60, 8), [set(5, 60), set(5, 60), set(8, 60), set(8, 60)], { targetSets: 4 });
    expect(clearlyMissed(half('2026-10-12'), BENCH)).toBe(true);
    expect(
      loadReduce(inputs([half('2026-10-12'), half('2026-10-14')]), 'bench', BENCH),
    ).not.toBeNull();
    const third = (date: string) => entry(date, st(60, 8), [set(5, 60), set(8, 60), set(8, 60)]);
    expect(clearlyMissed(third('2026-10-12'), BENCH)).toBe(false);
    expect(
      loadReduce(inputs([third('2026-10-12'), third('2026-10-14')]), 'bench', BENCH),
    ).toBeNull();
  });

  it('RPE ≥ Ziel + 1,5 bei Wdh. unter dem Ziel zählt als verfehlt; fehlende Sätze auch', () => {
    const hard = entry('2026-10-12', st(60, 10), [
      set(9, 60, 9.5),
      set(9, 60, 9.5),
      set(10, 60, 9),
    ]);
    expect(clearlyMissed(hard, BENCH)).toBe(true);
    const short = entry('2026-10-12', st(60, 8), [set(8, 60)]);
    expect(clearlyMissed(short, BENCH)).toBe(true);
  });

  it('Ruhezeit: 13 Tage nach der letzten Senkung nicht, nach 14 Tagen wieder', () => {
    const first = loadReduce(
      inputs([missed60('2026-10-12'), missed60('2026-10-14')]),
      'bench',
      BENCH,
    );
    if (!first) throw new Error('kein R2');
    const before = (days: number) =>
      storedFrom(first, { createdAt: `2026-10-${String(16 - days).padStart(2, '0')}T10:00:00Z` });
    expect(
      loadReduce(
        inputs([missed60('2026-10-12'), missed60('2026-10-14')], { adjustments: [before(13)] }),
        'bench',
        BENCH,
      ),
    ).toBeNull();
    expect(
      loadReduce(
        inputs([missed60('2026-10-12'), missed60('2026-10-14')], { adjustments: [before(14)] }),
        'bench',
        BENCH,
      ),
    ).not.toBeNull();
  });

  it('Rohwert nie mehr als −10 %; Anzeige auf die eigene Stufe abgerundet, kleinste Stufe als Boden', () => {
    expect(reducedState(st(10, 9), dumbbell).weightKg).toBe(9);
    // Zu Hause [4, 6, 8]: 9 → angezeigt 8; Studio: 8 (Stufe ≤ 9) – Rohwert gleich, nur die Anzeige rundet.
    const shownHome = prescriptionForDisplay(
      { sets: 3, reps_min: 8, reps_max: 12, duration_s: null, rpe_target: 8 },
      { progress: st(9, 8), firstSessionRpeTarget: null },
      { isDeload: false, steps: HOME_STEPS },
    );
    expect(shownHome.weightKg).toBe(8);
    // Kleinste Stufe als Boden: 4 kg → 3,6 → bleibt 4 (Gewicht unverändert, nur reps_min).
    expect(reducedState(st(4, 10, true), dumbbell)).toEqual(st(4, 8, false));
    // Langhantel mit Scheiben: 62,5 → 56,25 roh, angezeigt 55.
    const BARBELL = barbellLoadSteps(20, [1.25, 2.5, 5, 10, 15, 20]);
    const raw = reducedState(st(62.5, 10), { ...BENCH, steps: BARBELL }).weightKg as number;
    expect(raw).toBeGreaterThanOrEqual(62.5 * 0.9);
    expect(raw).toBeLessThan(62.5);
    const shown = prescriptionForDisplay(
      { sets: 3, reps_min: 8, reps_max: 12, duration_s: null, rpe_target: 8 },
      { progress: st(raw, 8), firstSessionRpeTarget: null },
      { isDeload: false, steps: BARBELL },
    );
    expect(BARBELL).toContain(shown.weightKg);
    expect(shown.weightKg as number).toBeLessThanOrEqual(raw);
    // Sehr leicht (0,5 kg) und sehr schwer (500 kg)
    expect(reducedState(st(0.5, 8), BENCH).weightKg).toBe(0.5);
    expect(reducedState(st(500, 8), BENCH).weightKg).toBe(450);
  });

  it('Halteübung: Dauer × 0,9 mit 10 s als Boden', () => {
    const plank: ProgressionContext = {
      ...BENCH,
      loadType: 'time',
      repsMin: null,
      repsMax: null,
      durationS: 30,
      incrementKind: 'none',
    };
    const hold = (s: number) => ({
      weightKg: null,
      targetReps: null,
      extraSet: false,
      durationS: s,
    });
    expect(reducedState(hold(30), plank).durationS).toBe(27);
    expect(reducedState(hold(11), plank).durationS).toBe(10);
    expect(reducedState(hold(10), plank).durationS).toBe(10);
  });

  it('Person hat schon selbst leichter trainiert → kein R2 (Vorrang des eigenen Gewichts)', () => {
    const lighter = entry('2026-10-14', st(60, 8), [set(5, 50), set(5, 50), set(5, 50)]);
    expect(loadReduce(inputs([missed60('2026-10-12'), lighter]), 'bench', BENCH)).toBeNull();
  });

  it('Einstiegs-, Erholungswoche und Wiedereinstieg zählen nicht', () => {
    const deload = { ...missed60('2026-10-14'), isDeload: true };
    expect(loadReduce(inputs([missed60('2026-10-12'), deload]), 'bench', BENCH)).toBeNull();
  });
});

describe('R1 fast_increase', () => {
  const easy = (date: string, rpe: number | null = 6) =>
    entry(date, st(60, 12), [set(12, 60, rpe), set(12, 60, rpe), set(12, 60, rpe)]);

  it('alle Sätze reps_max mit RPE ≤ Ziel − 2 → Gewichtsschritt schon nach EINER Einheit', () => {
    const p = fastIncrease(inputs([easy('2026-10-14')]), 'bench', BENCH);
    expect(p?.stateBefore).toEqual(st(60, 12));
    expect(p?.stateAfter).toEqual({
      weightKg: 62.5,
      targetReps: 8,
      extraSet: false,
      durationS: null,
    });
    expect(adjustmentProposalSchema.safeParse(p).success).toBe(true);
    // Gratis (ohne Vorgabe): nach einer Einheit noch kein Schritt.
    expect(
      progressFromLogs('bench', [easy('2026-10-14')], BENCH, { today: TODAY }).progress,
    ).toEqual(st(60, 12));
  });

  it('ein Satz ohne RPE bzw. RPE 6,5 → kein R1', () => {
    const one = entry('2026-10-14', st(60, 12), [
      set(12, 60, 6),
      set(12, 60, null),
      set(12, 60, 6),
    ]);
    expect(fastIncrease(inputs([one]), 'bench', BENCH)).toBeNull();
    expect(fastIncrease(inputs([easy('2026-10-14', 6.5)]), 'bench', BENCH)).toBeNull();
  });

  it('nie bei vorsichtigem Plan, mit 16 oder 95 Jahren, Einsteiger im ersten Block', () => {
    const cautious = planSafetyRules(
      { experienceLevel: 'advanced', birthDate: '1990-01-15', healthScreening: null },
      TODAY,
    );
    expect(
      fastIncrease(inputs([easy('2026-10-14')], { rules: cautious }), 'bench', BENCH),
    ).toBeNull();
    for (const birthDate of ['2010-05-01', '1931-05-01']) {
      expect(
        fastIncrease(inputs([easy('2026-10-14')], { person: { birthDate } }), 'bench', BENCH),
      ).toBeNull();
    }
    expect(
      fastIncrease(inputs([easy('2026-10-14')], { level: 'beginner' }), 'bench', BENCH),
    ).toBeNull();
    // Einsteiger im zweiten Block: erlaubt.
    expect(
      fastIncrease(
        inputs([easy('2026-11-30')], { level: 'beginner', today: '2026-11-30' }),
        'bench',
        BENCH,
      ),
    ).not.toBeNull();
  });

  it('Ausschlussgrund je Fall (Liste = Server private.fast_increase_exclusion), Grenzen 18 und 65 am Geburtstag', () => {
    const cautious = planSafetyRules(
      { experienceLevel: 'advanced', birthDate: '1990-01-15', healthScreening: null },
      TODAY,
    );
    const flagged = planSafetyRules(
      {
        experienceLevel: 'advanced',
        birthDate: '1990-01-15',
        healthScreening: { flags: ['medication', 'conservative_plan'] },
      },
      TODAY,
    );
    const byBirth = (birthDate: string) =>
      fastIncreaseExclusion(inputs([], { person: { birthDate } }));
    expect(fastIncreaseExclusion(inputs([]))).toBeNull();
    expect(fastIncreaseExclusion(inputs([], { rules: cautious }))).toBe('cautious_plan');
    expect(fastIncreaseExclusion(inputs([], { rules: flagged }))).toBe('cautious_plan');
    // 18. Geburtstag heute → erlaubt, einen Tag davor → minor; 65. Geburtstag heute → senior, einen Tag davor erlaubt.
    expect(byBirth('2008-10-17')).toBe('minor');
    expect(byBirth('2008-10-16')).toBeNull();
    expect(byBirth('1961-10-17')).toBeNull();
    expect(byBirth('1961-10-16')).toBe('senior');
    expect(byBirth('2010-05-01')).toBe('minor');
    expect(byBirth('1931-05-01')).toBe('senior');
    expect(fastIncreaseExclusion(inputs([], { level: 'beginner' }))).toBe('beginner_first_block');
    expect(
      fastIncreaseExclusion(inputs([], { level: 'beginner', today: '2026-11-30' })),
    ).toBeNull();
    // Einsteiger ohne Einheiten → ausgeschlossen; nach der letzten Einheit zählt deren Block.
    expect(
      fastIncreaseExclusion(
        liveInputs([], { today: TODAY, level: 'beginner', contexts: { bench: BENCH } }),
      ),
    ).toBe('beginner_first_block');
    expect(
      fastIncreaseExclusion(inputs([], { level: 'beginner', today: '2027-06-01' })),
    ).toBeNull();
    // Reihenfolge: vorsichtig vor Alter vor Einsteiger.
    expect(
      fastIncreaseExclusion(
        inputs([], { rules: cautious, level: 'beginner', person: { birthDate: '2010-05-01' } }),
      ),
    ).toBe('cautious_plan');
    expect(FAST_INCREASE_EXCLUSIONS).toEqual([
      'cautious_plan',
      'active_aging',
      'minor',
      'senior',
      'beginner_first_block',
    ]);
  });

  it('großer Sprung (Kurzhantel 4 → 6 kg) bleibt beim Puffer: nur +1 Wdh.', () => {
    const ctx: ProgressionContext = { ...dumbbell, steps: [4, 6, 8] };
    const e = entry('2026-10-14', st(4, 12), [set(12, 4, 5), set(12, 4, 5), set(12, 4, 5)], {
      targetWeightKg: 4,
    });
    const p = fastIncrease(inputs([e], { contexts: { bench: ctx } }), 'bench', ctx);
    expect(p?.stateAfter).toEqual(st(4, 13));
  });

  it('Wächter B Auflage 2: großer Sprung nach dem Puffer (4 → 6 kg = +50 %) → kein R1, normale Progression', () => {
    const ctx: ProgressionContext = { ...dumbbell, steps: [4, 6, 8] };
    const sets4 = [set(14, 4, 5), set(14, 4, 5), set(14, 4, 5), set(14, 4, 5)];
    const e = entry('2026-10-14', st(4, 14, true), sets4, { targetWeightKg: 4, targetSets: 4 });
    expect(fastIncrease(inputs([e], { contexts: { bench: ctx } }), 'bench', ctx)).toBeNull();
    // Ohne Grenze wäre es ein Sprung nach EINER Einheit; Gratis springt nach zwei Einheiten wie bisher.
    const fast = progressFromLogs('bench', [e], ctx, {
      today: TODAY,
      consecutiveSessionsForStep: LIVE_ADJUSTMENT.fastIncrease.consecutiveSessionsForStep,
    });
    expect(fast.progress.weightKg).toBe(6);
    expect(LIVE_ADJUSTMENT.fastIncrease.maxStepFraction).toBe(LOAD_PROGRESSION.maxIncreaseFraction);
    // Schritt genau innerhalb der Grenze (60 → 62,5 kg = +4,2 %) bleibt erlaubt (Test oben).
  });

  it('500-kg-Deckel: nie ein Gewicht über 500 kg', () => {
    const e = entry('2026-10-14', st(500, 14), [set(14, 500, 5), set(14, 500, 5), set(14, 500, 5)]);
    const p = fastIncrease(inputs([e]), 'bench', BENCH);
    expect((p?.stateAfter?.weightKg ?? 500) <= 500).toBe(true);
  });
});

describe('Konflikt R1/R2 und Anwendung', () => {
  it('R1 und R2 für dieselbe Übung → R2 (Senken schlägt Steigern)', () => {
    // Zweimal verfehlt (R2) – dazu ein „leichter“ letzter Eintrag ist widersprüchlich; R2 gewinnt per Reihenfolge.
    const result = computeLiveAdjustments(
      inputs([missed60('2026-10-12'), missed60('2026-10-14')]),
      testEnv(),
    );
    expect(result.proposals.filter((p) => p.exerciseId === 'bench').map((p) => p.rule)).toEqual([
      'load_reduce',
    ]);
  });

  it('Vorgabe wirkt nur auf ihrem Basis-Eintrag; ein neuerer Eintrag (zweites Gerät) macht sie wirkungslos', () => {
    const entries = [missed60('2026-10-12'), missed60('2026-10-14')];
    const p = loadReduce(inputs(entries), 'bench', BENCH);
    if (!p) throw new Error('kein R2');
    const stored = storedFrom(p);
    const latest = entries[1] as LiveExerciseEntry;
    expect(activeStateOverride('bench', [stored], latest.sessionLogId)).toEqual(p.stateAfter);
    expect(activeStateOverride('bench', [stored], 'neuerer-eintrag')).toBeNull();
    expect(
      activeStateOverride('bench', [{ ...stored, status: 'reverted' }], latest.sessionLogId),
    ).toBeNull();
    const shown = progressFromLogs('bench', entries, BENCH, {
      today: TODAY,
      stateOverride: p.stateAfter,
    });
    expect(shown.progress).toEqual(p.stateAfter);
    expect(shown.step).toBeNull();
  });
});

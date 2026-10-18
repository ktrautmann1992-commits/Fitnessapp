import { describe, expect, it } from 'vitest';

import type {
  ExerciseLogEntry,
  ExerciseProgress,
  LoggedSet,
  ProgressionContext,
} from '../log/types';
import { planSafetyRules } from '../plan/safety';
import { person } from '../plan/test-library';
import type { StoredSession } from '../plan/view';
import type { LiveExerciseEntry } from './inputs';
import { applyPlanChange } from './plan-changes';
import { planContext } from './rules/plan-rules';
import { stagnation, stagnationStart } from './rules/stagnation';
import { adjustmentProposalSchema } from './schemas';
import { BENCH, liveInputs, planWithFollowUps, storedFrom, testEnv } from './test-helpers';
import type { AdjustmentProposal, PlanChange } from './types';

const plan = planWithFollowUps(person({ experienceLevel: 'advanced' }), '2026-10-05', 0);
if (!plan) throw new Error('kein Plan');
const sessions = plan.sessions;
const env = testEnv();
const EX = 'bankdruecken-langhantel';
const TODAY = '2026-10-21';

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

function entry(
  performedOn: string,
  state: ExerciseProgress,
  sets: LoggedSet[],
  partial: Partial<ExerciseLogEntry> = {},
): LiveExerciseEntry {
  return {
    exerciseId: EX,
    performedOn,
    loggedAt: `${performedOn}T18:00:00Z`,
    status: 'done',
    loadType: 'weight',
    isIntroWeek: false,
    isDeload: false,
    targetSets: 3,
    targetWeightKg: state.weightKg,
    targetReps: state.targetReps,
    targetExtraSet: false,
    targetRpe: 8,
    state,
    weightConfirmed: false,
    sets,
    sessionLogId: `log-${performedOn}`,
    ...partial,
  };
}

/** Nicht geschafft (8/8/7), aber nicht deutlich verfehlt → Zustand bleibt, kein R2. */
const stuck = (date: string) => entry(date, st(60, 8), [set(8, 60), set(8, 60), set(7, 60)]);

function run(dates: string[], overrides: Parameters<typeof liveInputs>[1] = {}) {
  const live = liveInputs(sessions, {
    today: TODAY,
    exerciseEntries: dates.map(stuck),
    contexts: { [EX]: BENCH },
    sessionLocations: Object.fromEntries(sessions.map((s) => [s.id, 'gym'] as const)),
    ...overrides,
  });
  return { live, outcome: stagnation(live, planContext(live), env, EX, BENCH) };
}

describe('R4 Stillstand', () => {
  it('3 Einträge über 21 Tage ohne Schritt → Tausch auf die Alternative (gleiches Muster, nicht schwerer)', () => {
    const { outcome } = run(['2026-09-28', '2026-10-12', '2026-10-19']);
    const p = outcome.proposal as AdjustmentProposal;
    expect(p.rule).toBe('stagnation_variation');
    expect(adjustmentProposalSchema.safeParse(p).success).toBe(true);
    expect(p.explainParams.new_exercise_id).toBe('bankdruecken-kurzhantel');
    const after = applyPlanChange(sessions, p.changeAfter as PlanChange);
    // Nur künftige Einheiten des Blocks ab morgen; vergangene behalten die Übung.
    for (const s of after) {
      const had = (sessions.find((x) => x.id === s.id) as StoredSession).exercises.some(
        (e) => e.exercise_id === EX,
      );
      if (!had) continue;
      const swapped = !s.exercises.some((e) => e.exercise_id === EX);
      expect(swapped).toBe(s.scheduled_on > TODAY && s.block_no === 1);
    }
  });

  it('Ort unbekannt → die Alternative muss an JEDEM Ort machbar sein (hier zu Hause ohne Geräte: Liegestütz)', () => {
    const p = run(['2026-09-28', '2026-10-12', '2026-10-19'], { sessionLocations: {} }).outcome
      .proposal;
    expect(p?.explainParams.new_exercise_id).toBe('liegestuetz');
  });

  it('20 statt 21 Tage bzw. 2 statt 3 Einträge → kein Stillstand', () => {
    expect(run(['2026-09-29', '2026-10-12', '2026-10-19']).outcome.proposal).toBeNull();
    expect(run(['2026-09-28', '2026-10-19']).outcome.proposal).toBeNull();
  });

  it('no_heavier_weight ist kein Stillstand', () => {
    const ctx: ProgressionContext = { ...BENCH, incrementKind: 'free_weight', steps: [10, 12] };
    const top = (date: string) =>
      entry(date, st(12, 14, true), [set(14, 12), set(14, 12), set(14, 12), set(14, 12)], {
        targetSets: 4,
        targetWeightKg: 12,
      });
    const live = liveInputs(sessions, {
      today: TODAY,
      exerciseEntries: ['2026-09-28', '2026-10-12', '2026-10-19'].map(top),
      contexts: { [EX]: ctx },
    });
    expect(stagnationStart(live, EX, ctx)).toBeNull();
  });

  it('Alternative nach Sicherheitsregel gesperrt → nächste erlaubte bzw. Erholungswoche/Hinweis', () => {
    const pregnancy = planSafetyRules(
      {
        experienceLevel: 'advanced',
        birthDate: '1990-01-15',
        healthScreening: { flags: ['pregnancy'] },
      },
      TODAY,
    );
    const { outcome } = run(['2026-09-28', '2026-10-12', '2026-10-19'], { rules: pregnancy });
    const p = outcome.proposal;
    if (p?.rule === 'stagnation_variation') {
      const id = p.explainParams.new_exercise_id as string;
      const ex = env.library.get(id);
      expect(ex?.caution_tags.some((t) => pregnancy.excludedCautionTags.includes(t))).toBe(false);
      expect(id).not.toBe('bankdruecken-kurzhantel');
    } else {
      expect(p === null || p.rule === 'deload_forward').toBe(true);
    }
  });

  it('zweiter Tausch derselben Übung im Block → kein Tausch (Erholungswoche vorziehen oder Hinweis)', () => {
    const first = run(['2026-09-28', '2026-10-12', '2026-10-19']).outcome
      .proposal as AdjustmentProposal;
    const { outcome } = run(['2026-09-28', '2026-10-12', '2026-10-19'], {
      adjustments: [storedFrom(first, { createdAt: '2026-10-19T19:00:00Z' })],
    });
    expect(outcome.proposal?.rule).not.toBe('stagnation_variation');
  });

  it('Körpergewicht mit Hinweis harder_variant → kein Tausch', () => {
    const ctx: ProgressionContext = {
      ...BENCH,
      loadType: 'bodyweight',
      incrementKind: 'none',
      repsMin: 8,
      repsMax: 12,
    };
    const top = (date: string) =>
      entry(
        date,
        { weightKg: null, targetReps: 14, extraSet: true, durationS: null },
        [set(14, null), set(14, null), set(14, null), set(14, null)],
        { loadType: 'bodyweight', targetSets: 4, targetWeightKg: null },
      );
    const live = liveInputs(sessions, {
      today: TODAY,
      exerciseEntries: ['2026-09-28', '2026-10-12', '2026-10-19'].map(top),
      contexts: { [EX]: ctx },
    });
    expect(stagnation(live, planContext(live), env, EX, ctx)).toEqual({
      proposal: null,
      hint: null,
    });
  });
});

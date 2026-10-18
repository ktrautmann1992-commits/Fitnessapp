import { describe, expect, it } from 'vitest';

import { LIVE_ADJUSTMENT } from '../constants';
import {
  buildExerciseLogEntry,
  prescriptionForDisplay,
  progressFromLogs,
} from '../log/progression';
import type { ExerciseProgress, LoggedSet } from '../log/types';
import { planSafetyRules } from '../plan/safety';
import { person } from '../plan/test-library';
import type { StoredSession } from '../plan/view';
import {
  activeStateOverride,
  adjustmentMarks,
  applyAdjustmentsToPlan,
  canRevert,
  restoreTemporaryChanges,
} from './apply';
import { computeLiveAdjustments } from './engine';
import { inputFingerprint } from './fingerprint';
import type { LiveExerciseEntry } from './inputs';
import { latestCountingSessionLogId } from './rules/common';
import { fastIncreaseExcluded } from './rules/state-rules';
import { adjustmentProposalSchema } from './schemas';
import { BENCH, liveInputs, planWithFollowUps, storedFrom, testEnv } from './test-helpers';
import type { PlanChange, StoredAdjustment } from './types';

const plan = planWithFollowUps(person({ experienceLevel: 'advanced' }), '2026-10-05', 0);
if (!plan) throw new Error('kein Plan');
const sessions = plan.sessions;
const env = testEnv();
const TODAY = '2026-10-16';

const set = (reps: number, weightKg: number | null, rpe: number | null = null): LoggedSet => ({
  reps,
  weightKg,
  durationS: null,
  rpe,
  done: true,
});
const st = (weightKg: number | null, targetReps: number): ExerciseProgress => ({
  weightKg,
  targetReps,
  extraSet: false,
  durationS: null,
});
function missed(exerciseId: string, date: string): LiveExerciseEntry {
  return {
    exerciseId,
    performedOn: date,
    loggedAt: `${date}T18:00:00Z`,
    status: 'done',
    loadType: 'weight',
    isIntroWeek: false,
    isDeload: false,
    targetSets: 3,
    targetWeightKg: 60,
    targetReps: 8,
    targetExtraSet: false,
    targetRpe: 8,
    state: st(60, 8),
    weightConfirmed: false,
    sets: [set(5, 60), set(5, 60), set(5, 60)],
    sessionLogId: `log-${exerciseId}-${date}`,
  };
}

const FOUR = ['a', 'b', 'c', 'd'];
function fourReductions(adjustments: StoredAdjustment[] = []) {
  return liveInputs(sessions, {
    today: TODAY,
    exerciseEntries: FOUR.flatMap((id) => [missed(id, '2026-10-12'), missed(id, '2026-10-14')]),
    contexts: Object.fromEntries(FOUR.map((id) => [id, BENCH])),
    adjustments,
  });
}

describe('Konflikte und Grenzen der Engine (Plan 5.3)', () => {
  it('4 automatische Änderungen in einer Woche → nur 3, dazu ein Hinweis', () => {
    const result = computeLiveAdjustments(fourReductions(), env);
    expect(result.proposals).toHaveLength(LIVE_ADJUSTMENT.maxAutomaticPerWeek);
    expect(result.hints.some((h) => h.code === 'weekly_limit_reached')).toBe(true);
    for (const p of result.proposals)
      expect(adjustmentProposalSchema.safeParse(p).success).toBe(true);
  });

  it('schon gespeicherte Änderungen dieser Woche zählen mit', () => {
    const first = computeLiveAdjustments(fourReductions(), env).proposals;
    const saved = first.slice(0, 2).map((p) => storedFrom(p));
    const second = computeLiveAdjustments(fourReductions(saved), env);
    expect(second.proposals).toHaveLength(1);
  });

  it('Idempotenz: gleicher Fingerabdruck → keine zweite Anpassung (auch nach Rückgängig)', () => {
    const first = computeLiveAdjustments(fourReductions(), env).proposals;
    const again = computeLiveAdjustments(
      fourReductions(
        first.map((p) => storedFrom(p, { status: 'reverted', createdAt: '2026-10-09T10:00:00Z' })),
      ),
      env,
    );
    expect(
      again.proposals.filter((p) => first.some((q) => q.inputFingerprint === p.inputFingerprint)),
    ).toEqual([]);
  });

  it('deterministisch: gleiche Eingaben → gleiche Vorschläge und Fingerabdrücke', () => {
    expect(computeLiveAdjustments(fourReductions(), env)).toEqual(
      computeLiveAdjustments(fourReductions(), env),
    );
    expect(inputFingerprint('load_reduce', { a: 1, b: [2] })).toBe(
      inputFingerprint('load_reduce', { b: [2], a: 1 }),
    );
    expect(inputFingerprint('load_reduce', { a: 1 })).not.toBe(
      inputFingerprint('load_reduce', { a: 2 }),
    );
  });

  it('Gratis (entitled = false): nie eine Anpassung', () => {
    expect(computeLiveAdjustments({ ...fourReductions(), entitled: false }, env)).toEqual({
      proposals: [],
      hints: [],
    });
  });

  it('kein Kalorien-Eingriff: keine Regel liefert calorie_adjust (reserviert)', () => {
    const result = computeLiveAdjustments(fourReductions(), env);
    expect(result.proposals.some((p) => (p.rule as string) === 'calorie_adjust')).toBe(false);
  });
});

describe('Anwendung (Plan 5.4)', () => {
  it('Vorgabe wird als state_* gespeichert, danach läuft die Kette normal weiter', () => {
    const entries = [missed('bench', '2026-10-12'), missed('bench', '2026-10-14')];
    const input = liveInputs(sessions, {
      today: TODAY,
      exerciseEntries: entries,
      contexts: { bench: BENCH },
    });
    const p = computeLiveAdjustments(input, env).proposals.find((x) => x.rule === 'load_reduce');
    if (!p) throw new Error('kein R2');
    const adj = storedFrom(p);
    const override = activeStateOverride(
      'bench',
      [adj],
      latestCountingSessionLogId('bench', entries),
    );
    const result = progressFromLogs('bench', entries, BENCH, {
      today: '2026-10-19',
      stateOverride: override,
    });
    expect(result.progress).toEqual(p.stateAfter);
    const prescription = prescriptionForDisplay(
      { sets: 3, reps_min: 8, reps_max: 12, duration_s: null, rpe_target: 8 },
      result,
      { isDeload: false },
    );
    const next = buildExerciseLogEntry({
      exerciseId: 'bench',
      performedOn: '2026-10-19',
      loggedAt: '2026-10-19T18:00:00Z',
      status: 'done',
      loadType: 'weight',
      isIntroWeek: false,
      isDeload: false,
      progress: result,
      prescription,
      sets: [set(8, 54), set(8, 54), set(8, 54)],
    });
    expect(next.state).toEqual(p.stateAfter);
    const chained = [...entries, { ...next, sessionLogId: 'log-next' }];
    // Neuer Eintrag → Vorgabe veraltet, Kette rechnet aus dem Tagebuch weiter (+1 Wdh.).
    expect(
      activeStateOverride('bench', [adj], latestCountingSessionLogId('bench', chained)),
    ).toBeNull();
    expect(progressFromLogs('bench', chained, BENCH, { today: '2026-10-21' }).progress).toEqual({
      ...(p.stateAfter as ExerciseProgress),
      targetReps: 9,
    });
    // Rückgängig nur vor dem nächsten Eintrag.
    const state = { sessions, sessionLogs: [], entries, today: TODAY };
    expect(canRevert(adj, state)).toBe(true);
    expect(canRevert(adj, { ...state, entries: chained })).toBe(false);
  });

  it('Sicherheitsregeln greifen zuletzt: RPE-Deckel 7 bei vorsichtigem Plan auch nach R1', () => {
    const cautious = planSafetyRules(
      { experienceLevel: 'advanced', birthDate: '1990-01-15', healthScreening: null },
      TODAY,
    );
    const shown = prescriptionForDisplay(
      { sets: 3, reps_min: 8, reps_max: 12, duration_s: null, rpe_target: 8 },
      { progress: st(62.5, 8), firstSessionRpeTarget: null },
      { isDeload: false, rpeMax: cautious.rpeMax },
    );
    expect(shown.rpeTarget).toBeLessThanOrEqual(7);
  });

  it('restoreTemporaryChanges: Folgeblock erbt keine reduzierten Sätze, ein Tausch bleibt, Ausdauer-Bezug bleibt geplant', () => {
    const week3 = sessions.filter((s) => s.week_no === 3 && s.kind === 'strength');
    const target = week3[0] as StoredSession;
    const reduce: PlanChange = {
      sessions: [
        {
          id: target.id,
          exercises: target.exercises.map((e) => ({ order_no: e.order_no, sets: e.sets - 1 })),
        },
      ],
    };
    const before: PlanChange = {
      sessions: [
        {
          id: target.id,
          exercises: target.exercises.map((e) => ({ order_no: e.order_no, sets: e.sets })),
        },
      ],
    };
    const swapBefore: PlanChange = {
      sessions: [
        {
          id: target.id,
          exercises: [
            {
              order_no: 1,
              exercise_id: target.exercises[0]?.exercise_id as string,
              exercise_name_de: 'x',
            },
          ],
        },
      ],
    };
    const swapAfter: PlanChange = {
      sessions: [
        {
          id: target.id,
          exercises: [
            { order_no: 1, exercise_id: 'goblet-kniebeuge', exercise_name_de: 'Goblet-Kniebeuge' },
          ],
        },
      ],
    };
    const base = {
      kind: 'plan_change' as const,
      requiresConfirmation: false,
      exerciseId: null,
      plannedSessionIds: [target.id],
      basisSessionLogId: null,
      basisPerformedOn: null,
      stateBefore: null,
      stateAfter: null,
      explainParams: {},
      effectiveFrom: target.scheduled_on,
      expiresOn: null,
      engineVersion: 1,
      ruleVersion: 1,
      usesBodyData: false,
      fromHealthPlan: false,
      status: 'applied' as const,
      decidedAt: null,
    };
    const adjustments: StoredAdjustment[] = [
      {
        ...base,
        id: 'v',
        rule: 'volume_reduce',
        changeBefore: before,
        changeAfter: reduce,
        inputFingerprint: 'volume_reduce:0000000000000001',
        createdAt: '2026-10-16T10:00:00Z',
      },
      {
        ...base,
        id: 's',
        rule: 'stagnation_variation',
        changeBefore: swapBefore,
        changeAfter: swapAfter,
        inputFingerprint: 'stagnation_variation:0000000000000002',
        createdAt: '2026-10-17T10:00:00Z',
      },
    ];
    const planned = applyAdjustmentsToPlan(sessions, adjustments);
    const restored = restoreTemporaryChanges(planned, adjustments);
    const r = restored.find((s) => s.id === target.id) as StoredSession;
    expect(r.exercises.map((e) => e.sets)).toEqual(target.exercises.map((e) => e.sets));
    expect(r.exercises[0]?.exercise_id).toBe('goblet-kniebeuge');
    expect(adjustmentMarks(target, adjustments)).toMatchObject({ adjusted: true });
    // Ohne Anpassungen unverändert (Gratis).
    expect(restoreTemporaryChanges(sessions, [])).toEqual(sessions);
    expect(applyAdjustmentsToPlan(sessions, [])).toEqual(sessions);
  });
});

describe('Unsortierte Eingabe (Wächter-Auflage 6)', () => {
  it('Einheiten in beliebiger Reihenfolge → gleiches Ergebnis; Block-Erkennung R1/R4 unabhängig von der Reihenfolge', () => {
    const reversed = [...sessions].reverse();
    const sorted = fourReductions();
    expect(
      computeLiveAdjustments({ ...sorted, plan: { ...sorted.plan, sessions: reversed } }, env),
    ).toEqual(computeLiveAdjustments(sorted, env));
    const block2 = planWithFollowUps(person({ experienceLevel: 'beginner' }), '2026-10-05', 1);
    if (!block2) throw new Error('kein Plan');
    const live = liveInputs([...block2.sessions].reverse(), {
      today: '2026-11-30',
      level: 'beginner',
    });
    expect(fastIncreaseExcluded(live)).toBe(false);
    const early = liveInputs([...block2.sessions].reverse(), {
      today: '2026-10-14',
      level: 'beginner',
    });
    expect(fastIncreaseExcluded(early)).toBe(true);
  });
});

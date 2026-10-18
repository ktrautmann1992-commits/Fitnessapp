import { describe, expect, it } from 'vitest';

import { ENDURANCE_SESSION_LIMITS } from '../constants';
import { addDays } from '../dates';
import { fixed, fullPlan, request, runner } from '../plan/competition-test-helpers';
import { loadWeeksBeforeDeload } from '../plan/deload';
import { generatedCompetitionSessionSchema } from '../plan/generate';
import type { GeneratedSession } from '../plan/schedule';
import { trailingLoadWeeks } from '../plan/periodization';
import type { PlanInputsInput } from '../plan/inputs';
import { FULL_HOME, MONDAY, person } from '../plan/test-library';
import type { StoredSession } from '../plan/view';
import { canRevert, restoreTemporaryChanges } from './apply';
import { computeLiveAdjustments } from './engine';
import type { LiveSessionLog } from './inputs';
import {
  checkWeekInvariants,
  strengthSets,
  swappedCounterpart,
  swappedExerciseLimit,
} from './invariants';
import { applyPlanChange, minSetsFor } from './plan-changes';
import {
  deloadForwardProposal,
  highLoadEndurance,
  highLoadStrength,
  planContext,
  tryDeloadForward,
} from './rules/plan-rules';
import { adjustmentProposalSchema } from './schemas';
import {
  adjustLibrary,
  followUpBlock,
  liveInputs,
  planWithFollowUps,
  sessionLog,
  stored,
  storedFrom,
  testEnv,
} from './test-helpers';
import type { AdjustmentProposal, PlanChange } from './types';
import { eligiblePlannedSessions, planWeeks } from './weeks';

/** Plan ab Montag 05.10.2026 (Woche 1 = Einstiegswoche ohne Woche 0). */
function setup(inputs: PlanInputsInput) {
  const result = planWithFollowUps(inputs, MONDAY, 0);
  if (!result) throw new Error('kein Plan');
  return { ...result, weeks: planWeeks(result.sessions) };
}

const weekStart = (k: number) => addDays(MONDAY, 7 * (k - 1));

/** Einträge mit Belastung `rpe` für alle Kraft-Einheiten der Woche k bis einschließlich `until`. */
function strengthLogs(
  sessions: readonly StoredSession[],
  k: number,
  rpes: readonly number[],
  until: string,
): LiveSessionLog[] {
  const week = sessions.filter(
    (s) => s.kind === 'strength' && s.scheduled_on >= weekStart(k) && s.scheduled_on <= until,
  );
  return week.slice(-rpes.length).map((s, i) =>
    sessionLog(`log-${s.id}`, s.scheduled_on, {
      plannedSessionId: s.id,
      sessionRpe: rpes[i] ?? null,
    }),
  );
}

const advanced = person({ experienceLevel: 'advanced' });
const beginner = person({ experienceLevel: 'beginner' });
const env = testEnv();

function r3(
  inputs: PlanInputsInput,
  k: number,
  rpes: number[],
  level: 'beginner' | 'advanced',
  weekday = 5,
) {
  const { sessions } = setup(inputs);
  const today = addDays(weekStart(k), weekday - 1); // Standard: Freitag
  const logs = strengthLogs(sessions, k, rpes, today);
  const live = liveInputs(sessions, { today, sessionLogs: logs, level });
  return { sessions, live, outcome: highLoadStrength(live, planContext(live), env) };
}

describe('R3 Kraft: hohe Belastung über mehrere Einheiten', () => {
  it('session_rpe 9/9/9 → nächste Woche je Übung 1 Satz weniger (nie unter SESSION_FIT)', () => {
    const { sessions, outcome } = r3(advanced, 2, [9, 9, 9], 'advanced');
    const p = outcome.proposal as AdjustmentProposal;
    expect(p.rule).toBe('volume_reduce');
    expect(adjustmentProposalSchema.safeParse(p).success).toBe(true);
    const after = applyPlanChange(sessions, p.changeAfter as PlanChange);
    const week3 = after.filter((s) => s.week_no === 3 && s.kind === 'strength');
    const before3 = sessions.filter((s) => s.week_no === 3 && s.kind === 'strength');
    week3.forEach((s, i) =>
      s.exercises.forEach((e, j) => {
        const old = before3[i]?.exercises[j]?.sets as number;
        const min = minSetsFor(e.exercise_id, adjustLibrary.exercises);
        expect(e.sets).toBe(old - 1 >= min ? old - 1 : old);
        expect(e.sets).toBeGreaterThanOrEqual(min);
      }),
    );
    // Nur Woche 3 geändert, frühestens morgen.
    expect(
      p.plannedSessionIds.every((id) => sessions.find((s) => s.id === id)?.week_no === 3),
    ).toBe(true);
    expect(p.effectiveFrom > '2026-10-16').toBe(true);
  });

  it('9/9/8 → nichts', () => {
    expect(r3(advanced, 2, [9, 9, 8], 'advanced').outcome).toEqual({ proposal: null, hint: null });
  });

  it('Erholungswoche in 2 Wochen → nur Hinweis; in 3 Wochen → Sätze −1 (Fortgeschrittene L = 4)', () => {
    expect(r3(advanced, 3, [9, 9, 9], 'advanced').outcome.hint?.code).toBe('deload_soon');
    expect(r3(advanced, 2, [9, 9, 9], 'advanced').outcome.proposal?.rule).toBe('volume_reduce');
  });

  it('Einsteiger (L = 5): Woche 4 → Hinweis, Woche 3 → Sätze −1', () => {
    expect(r3(beginner, 4, [9, 9, 9], 'beginner').outcome.hint?.code).toBe('deload_soon');
    expect(r3(beginner, 3, [9, 9, 9], 'beginner').outcome.proposal?.rule).toBe('volume_reduce');
  });

  it('1 vs. 7 Trainingstage', () => {
    const one = person({ experienceLevel: 'advanced', sessionsPerWeek: 1, preferredDays: [1] });
    const { sessions } = setup(one);
    const logs = [2, 3].flatMap((k) =>
      sessions
        .filter((s) => s.week_no === k && s.kind === 'strength')
        .map((s) =>
          sessionLog(`log-${s.id}`, s.scheduled_on, { plannedSessionId: s.id, sessionRpe: 9 }),
        ),
    );
    // Nur 2 Einheiten in 14 Tagen → R3 braucht 3 → nichts.
    const live1 = liveInputs(sessions, { today: '2026-10-19', sessionLogs: logs });
    expect(highLoadStrength(live1, planContext(live1), env).proposal).toBeNull();
    const seven = person({
      experienceLevel: 'advanced',
      sessionsPerWeek: 7,
      preferredDays: [1, 2, 3, 4, 5, 6, 7],
      minutesPerSession: 30,
    });
    const result = r3(seven, 2, [9, 9, 9], 'advanced');
    if (result.outcome.proposal) {
      const p = result.outcome.proposal;
      expect(p.plannedSessionIds.length).toBeGreaterThan(0);
      expect(
        checkWeekInvariants(applyPlanChange(result.sessions, p.changeAfter as PlanChange), {
          maxLoadWeeks: 4,
        }),
      ).toEqual([]);
    }
  });

  it('Ohne Premium (Gratis) entsteht nichts', () => {
    const { live } = r3(advanced, 2, [9, 9, 9], 'advanced');
    expect(computeLiveAdjustments({ ...live, entitled: false }, env)).toEqual({
      proposals: [],
      hints: [],
    });
  });
});

describe('Tausch-Regel deload_forward (Wächter B2)', () => {
  function twice(inputs: PlanInputsInput, level: 'beginner' | 'advanced', k: number) {
    const first = r3(inputs, k - 1, [9, 9, 9], level, 7);
    const prior = storedFrom(first.outcome.proposal as AdjustmentProposal, {
      createdAt: `${addDays(weekStart(k - 1), 6)}T19:00:00Z`,
    });
    const sessions = applyPlanChange(first.sessions, prior.changeAfter as PlanChange);
    const today = addDays(weekStart(k), 6);
    const logs = [...first.live.sessionLogs, ...strengthLogs(sessions, k, [9, 9, 9], today)];
    const live = liveInputs(sessions, { today, sessionLogs: logs, level, adjustments: [prior] });
    return { sessions, live, prior, outcome: highLoadStrength(live, planContext(live), env) };
  }

  it('Fortgeschrittene (L = 4, Start Donnerstag mit Woche 0): k = 2, n = 3, D = 5 → Tausch; ohne Vorwoche nur Sätze −1', () => {
    const inputs = person({ experienceLevel: 'advanced' });
    const result = planWithFollowUps(inputs, '2026-10-08', 0);
    if (!result) throw new Error('kein Plan');
    const sessions0 = result.sessions;
    expect(sessions0.some((s) => s.week_no === 0)).toBe(true);
    const logsOf = (from: string, to: string) =>
      sessions0
        .filter(
          (s) =>
            s.kind === 'strength' &&
            s.week_no >= 1 &&
            s.scheduled_on >= from &&
            s.scheduled_on <= to,
        )
        .map((s) =>
          sessionLog(`log-${s.id}`, s.scheduled_on, { plannedSessionId: s.id, sessionRpe: 9 }),
        );
    // Woche 1 (12.–18.10.): R3 → Sätze −1 in Woche 2.
    const live1 = liveInputs(sessions0, {
      today: '2026-10-16',
      sessionLogs: logsOf('2026-10-12', '2026-10-16'),
    });
    const first = highLoadStrength(live1, planContext(live1), env).proposal as AdjustmentProposal;
    expect(first.rule).toBe('volume_reduce');
    const prior = storedFrom(first);
    const sessions = applyPlanChange(sessions0, prior.changeAfter as PlanChange);
    // Woche 2 (19.–25.10.) wieder dreimal 9 → zweimal in Folge → Tausch.
    const live2 = liveInputs(sessions, {
      today: '2026-10-23',
      sessionLogs: logsOf('2026-10-12', '2026-10-23'),
      adjustments: [prior],
    });
    const p = highLoadStrength(live2, planContext(live2), env).proposal as AdjustmentProposal;
    expect(p.rule).toBe('deload_forward');
    const after = applyPlanChange(sessions, p.changeAfter as PlanChange);
    const weeks = planWeeks(after);
    expect(weeks.find((w) => w.weekNo === 3)?.isDeload).toBe(true);
    expect(weeks.find((w) => w.weekNo === 5)?.isDeload).toBe(false);
    expect(
      checkWeekInvariants(after, { maxLoadWeeks: 4, swappedWeeks: [{ blockNo: 1, weekNo: 5 }] }),
    ).toEqual([]);
    expect(trailingLoadWeeks(after)).toBe(2);
  });

  it('Einsteiger (L = 5): k = 3, n = 4, D = 6 → Tausch; D hat exakt Sätze, RPE und Minuten von D − 1', () => {
    const inputs = person({
      experienceLevel: 'beginner',
      schedule: {
        mode: 'fixed',
        slots: [
          { weekday: 1, kind: 'strength_gym', minutes: 60 },
          { weekday: 3, kind: 'endurance', minutes: 40 },
          { weekday: 5, kind: 'strength_gym', minutes: 60 },
          { weekday: 6, kind: 'strength_gym', minutes: 45 },
        ],
      },
    });
    const { sessions, outcome } = twice(inputs, 'beginner', 3);
    const p = outcome.proposal as AdjustmentProposal;
    expect(p.rule).toBe('deload_forward');
    expect(adjustmentProposalSchema.safeParse(p).success).toBe(true);
    const after = applyPlanChange(sessions, p.changeAfter as PlanChange);
    const weeks = planWeeks(after);
    const w = (n: number) => weeks.find((x) => x.blockNo === 1 && x.weekNo === n);
    expect(w(4)?.isDeload).toBe(true);
    expect(w(6)?.isDeload).toBe(false);
    // Woche 6 = je Einheit die ENTSPRECHENDE Einheit aus Woche 5 (gleiche Vorlagen-Einheit): gleiche Sätze und RPE.
    const week5 = w(5) as NonNullable<ReturnType<typeof w>>;
    let compared = 0;
    for (const s of w(6)?.sessions ?? []) {
      if (s.kind !== 'strength') continue;
      const twin = swappedCounterpart(s, week5);
      expect(twin?.template_day_index).toBe(s.template_day_index);
      for (const e of s.exercises) {
        const t = twin?.exercises.find((x) => x.order_no === e.order_no);
        if (t?.exercise_id !== e.exercise_id) continue;
        expect(e.sets).toBe(t.sets);
        expect(e.rpe_target).toBe(t.rpe_target);
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(5);
    expect(strengthSets(w(6)?.sessions ?? [])).toBeLessThanOrEqual(strengthSets(week5.sessions));
    const minutes = (n: number) =>
      (w(n)?.sessions ?? [])
        .filter((s) => s.kind === 'endurance')
        .reduce((a, s) => a + s.estimated_minutes, 0);
    expect(minutes(6)).toBe(minutes(5));
    // Woche 4 (vorgezogen): Ausdauer ≤ floor(0,6 × Woche 3); Woche 5 ≤ floor(1,1 × Woche 3) (nicht 1,1 × Woche 4).
    expect(minutes(4)).toBeLessThanOrEqual(Math.floor(minutes(3) * 0.6));
    expect(minutes(5)).toBeLessThanOrEqual(Math.floor(minutes(3) * 1.1));
    expect(
      checkWeekInvariants(after, { maxLoadWeeks: 5, swappedWeeks: [{ blockNo: 1, weekNo: 6 }] }),
    ).toEqual([]);

    // Folgeblock: carriedLoadWeeks = trailingLoadWeeks (2) → Folgeblock 3 Belastungswochen, über die Grenze genau L.
    const carried = trailingLoadWeeks(after);
    expect(carried).toBe(2);
    const plan = setup(inputs).plan;
    const restored = restoreTemporaryChanges(after, [storedFrom(p)]);
    const next = stored(followUpBlock(plan, inputs, restored, { carriedLoadWeeks: carried }), 'n');
    const nextWeeks = planWeeks(next);
    expect(nextWeeks.filter((x) => !x.isDeload)).toHaveLength(3);
    expect(nextWeeks.at(-1)?.isDeload).toBe(true);
    expect(
      checkWeekInvariants([...after, ...next], {
        maxLoadWeeks: 5,
        swappedWeeks: [{ blockNo: 1, weekNo: 6 }],
      }),
    ).toEqual([]);
    // Ohne carriedLoadWeeks wären es L + 2 Belastungswochen in Folge – Gegenprobe.
    const naive = stored(followUpBlock(plan, inputs, restored), 'x');
    expect(
      checkWeekInvariants([...after, ...naive], { maxLoadWeeks: 5 }).some(
        (v) => v.code === 'too_many_load_weeks',
      ),
    ).toBe(true);
  });

  it('D − n = 1 → kein Tausch (Fallback); zweiter Tausch im selben Block → kein Tausch', () => {
    const { sessions } = setup(beginner);
    const live = liveInputs(sessions, { today: addDays(weekStart(4), 4), level: 'beginner' });
    expect(tryDeloadForward(live, planContext(live))).toBeNull();
    const ok = liveInputs(sessions, { today: addDays(weekStart(3), 4), level: 'beginner' });
    const swap = tryDeloadForward(ok, planContext(ok));
    expect(swap).not.toBeNull();
    const fake = storedFrom({
      ...(computeLiveAdjustments(ok, env).proposals[0] ?? ({} as AdjustmentProposal)),
      rule: 'deload_forward',
      kind: 'plan_change',
      plannedSessionIds: [sessions.find((s) => s.week_no === 2)?.id as string],
      explainParams: { week_start: weekStart(2), swapped_week_start: weekStart(6) },
      inputFingerprint: 'deload_forward:0000000000000000',
    } as AdjustmentProposal);
    const again = liveInputs(sessions, {
      today: addDays(weekStart(3), 4),
      level: 'beginner',
      adjustments: [fake],
    });
    expect(tryDeloadForward(again, planContext(again))).toBeNull();
  });

  it('Wettkampfplan: kein Tausch (Phasen/Tapering hängen am Makrozyklus)', () => {
    const { sessions } = setup(beginner);
    const competition = sessions.map((s) => ({ ...s, training_phase: 'base' as const }));
    const live = liveInputs(competition, { today: addDays(weekStart(3), 4), level: 'beginner' });
    expect(tryDeloadForward(live, planContext(live))).toBeNull();
  });

  it('Rückgängig nur als Ganzes und nicht mehr nach Beginn einer der Wochen', () => {
    const { sessions } = setup(beginner);
    const live = liveInputs(sessions, { today: addDays(weekStart(3), 4), level: 'beginner' });
    const swap = tryDeloadForward(live, planContext(live));
    if (!swap) throw new Error('kein Tausch');
    const adj = storedFrom(
      deloadForwardProposal(live, planContext(live), swap, 'high_load', null, null),
    );
    const after = applyPlanChange(sessions, swap.pair.after);
    const state = {
      sessions: after,
      sessionLogs: [],
      entries: [],
      today: live.today,
      adjustments: [adj],
      maxLoadWeeks: 5,
    };
    expect(canRevert(adj, state)).toBe(true);
    // Auf dem ursprünglichen Plan (Einheiten stehen nicht auf change_after) nie.
    expect(canRevert(adj, { ...state, sessions })).toBe(false);
    const started = sessions.find((s) => s.week_no === 6) as StoredSession;
    expect(canRevert(adj, { ...state, sessionLogs: [{ plannedSessionId: started.id }] })).toBe(
      false,
    );
  });
});

describe('Laufende Einheit (Wächter S1)', () => {
  it('eligiblePlannedSessions: heute (auch mit offenem Entwurf, noch ohne Eintrag) nie, morgen ja, mit Eintrag nie', () => {
    const { sessions } = setup(advanced);
    const today = '2026-10-14'; // Mittwoch mit geplanter Einheit, Entwurf nur auf dem Gerät
    const todays = sessions.find((s) => s.scheduled_on === today) as StoredSession;
    const next = sessions.find((s) => s.scheduled_on === '2026-10-16') as StoredSession;
    const ids = (logs: { plannedSessionId: string | null }[]) =>
      new Set(eligiblePlannedSessions(sessions, logs, today).map((s) => s.id));
    expect(ids([]).has(todays.id)).toBe(false);
    expect(ids([]).has(next.id)).toBe(true);
    expect(ids([{ plannedSessionId: next.id }]).has(next.id)).toBe(false);
    const skipped = sessions.map((s) =>
      s.id === next.id ? { ...s, status: 'skipped' as const } : s,
    );
    expect(eligiblePlannedSessions(skipped, [], today).some((s) => s.id === next.id)).toBe(false);
    // R3 am Mittwoch: die heutige Einheit (Entwurf vor Tausch) bleibt unverändert und lässt sich speichern.
    const logs = strengthLogs(sessions, 2, [9, 9], '2026-10-13');
    const prior = sessionLog('vorwoche', '2026-10-09', { sessionRpe: 9 });
    const live = liveInputs(sessions, { today, sessionLogs: [prior, ...logs] });
    const p = highLoadStrength(live, planContext(live), env).proposal;
    expect(p?.plannedSessionIds.includes(todays.id) ?? false).toBe(false);
  });

  it('Einheit heute (Entwurf) und Einheit morgen mit Eintrag sind nie betroffen', () => {
    const { sessions } = setup(
      person({
        experienceLevel: 'advanced',
        sessionsPerWeek: 7,
        preferredDays: [1, 2, 3, 4, 5, 6, 7],
        minutesPerSession: 30,
      }),
    );
    const today = '2026-10-18'; // Sonntag Woche 2
    const tomorrow = sessions.find((s) => s.scheduled_on === '2026-10-19') as StoredSession;
    const logs = [
      ...strengthLogs(sessions, 2, [9, 9, 9], today),
      sessionLog('zweites-geraet', '2026-10-19', { plannedSessionId: tomorrow.id }),
    ];
    const live = liveInputs(sessions, { today, sessionLogs: logs });
    const ctx = planContext(live);
    expect(ctx.eligible.has(tomorrow.id)).toBe(false);
    expect(
      sessions.filter((s) => s.scheduled_on <= today).some((s) => ctx.eligible.has(s.id)),
    ).toBe(false);
    const p = highLoadStrength(live, ctx, env).proposal;
    expect(p?.plannedSessionIds.includes(tomorrow.id) ?? false).toBe(false);
    expect((p?.effectiveFrom ?? '9999') > today).toBe(true);
  });
});

describe('R3 Ausdauer endurance_reduce (neu gefasst mit Phase 10 WP3)', () => {
  const runner = person({
    goalType: 'endurance',
    discipline: '10k',
    experienceLevel: 'advanced',
    schedule: {
      mode: 'fixed',
      slots: [
        { weekday: 2, kind: 'endurance', minutes: 60 },
        { weekday: 4, kind: 'endurance', minutes: 60 },
        { weekday: 6, kind: 'endurance', minutes: 90 },
      ],
    },
    homeEquipment: [...FULL_HOME],
  });
  function endurance(efforts: number[]) {
    const { sessions } = setup(runner);
    const today = addDays(weekStart(2), 5);
    const done = sessions.filter(
      (s) => s.kind === 'endurance' && s.week_no === 2 && s.scheduled_on <= today,
    );
    const logs = done.map((s, i) =>
      sessionLog(`log-${s.id}`, s.scheduled_on, {
        plannedSessionId: s.id,
        kind: 'endurance',
        sessionRpe: efforts[i] ?? null,
      }),
    );
    const live = liveInputs(sessions, { today, sessionLogs: logs });
    return { sessions, outcome: highLoadEndurance(live, planContext(live)) };
  }

  it('Anstrengung 6 (lockeres Ziel) → nichts; 7 in 2 von 3 → Minuten × 0,85, nie unter dem Minimum', () => {
    expect(endurance([6, 6, 6]).outcome.proposal).toBeNull();
    const { sessions, outcome } = endurance([7, 5, 7]);
    const p = outcome.proposal as AdjustmentProposal;
    expect(p.rule).toBe('endurance_reduce');
    const after = applyPlanChange(sessions, p.changeAfter as PlanChange);
    for (const s of after.filter((x) => x.week_no === 3 && x.kind === 'endurance')) {
      const old = sessions.find((x) => x.id === s.id) as StoredSession;
      expect(s.estimated_minutes).toBe(
        Math.min(
          old.estimated_minutes,
          Math.max(
            ENDURANCE_SESSION_LIMITS.minSessionMinutes,
            Math.floor(old.estimated_minutes * 0.85),
          ),
        ),
      );
    }
    // Folgewochen nur gesenkt, nie erhöht; Invarianten halten.
    for (const s of after) {
      const old = sessions.find((x) => x.id === s.id) as StoredSession;
      expect(s.estimated_minutes).toBeLessThanOrEqual(old.estimated_minutes);
    }
    expect(checkWeekInvariants(after, { maxLoadWeeks: 4 })).toEqual([]);
  });

  it('kurze Einheiten bleiben beim Minimum statt zu entfallen', () => {
    const { sessions } = setup(runner);
    const target = sessions.find((s) => s.kind === 'endurance' && s.week_no === 3) as StoredSession;
    const short = sessions.map((s) => (s.id === target.id ? { ...s, estimated_minutes: 11 } : s));
    const today = addDays(weekStart(2), 5);
    const logs = sessions
      .filter((s) => s.kind === 'endurance' && s.week_no === 2 && s.scheduled_on <= today)
      .map((s) =>
        sessionLog(`log-${s.id}`, s.scheduled_on, {
          plannedSessionId: s.id,
          kind: 'endurance',
          sessionRpe: 8,
        }),
      );
    const live = liveInputs(short, { today, sessionLogs: logs });
    const p = highLoadEndurance(live, planContext(live)).proposal;
    expect(p?.rule).toBe('endurance_reduce');
    const after = applyPlanChange(short, (p?.changeAfter ?? { sessions: [] }) as PlanChange);
    expect(after.find((s) => s.id === target.id)?.estimated_minutes).toBe(10);
  });
});

describe('Satz-Untergrenze und Gesamtplan', () => {
  it('jede Woche bleibt nach volume_reduce innerhalb der Invarianten (L = loadWeeksBeforeDeload)', () => {
    const { sessions, outcome } = r3(advanced, 2, [9, 9, 9], 'advanced');
    const after = applyPlanChange(
      sessions,
      (outcome.proposal?.changeAfter ?? { sessions: [] }) as PlanChange,
    );
    expect(
      checkWeekInvariants(after, { maxLoadWeeks: loadWeeksBeforeDeload('advanced', false) }),
    ).toEqual([]);
  });
});

describe('Wettkampfplan (Phase 10): endurance_reduce nur an lockeren Einheiten, Schritte passend', () => {
  it('10 km und Triathlon Sprint: harte Einheiten, Koppeltraining und Technik bleiben; Schritte = Dauer; Invarianten halten', () => {
    for (const [discipline, race] of [
      ['10k', '2027-01-30'],
      ['triathlon_sprint', '2027-03-06'],
    ] as const) {
      const plan = fullPlan(
        runner(discipline, 'advanced', {
          schedule: fixed(
            [2, 'endurance', 60],
            [4, 'endurance', 60],
            [6, 'endurance', 60],
            [7, 'endurance', 120],
          ),
        }),
        request(discipline, race),
        MONDAY,
      );
      const sessions = stored(plan.sessions as GeneratedSession[]);
      let checked = 0;
      for (const week of planWeeks(sessions).filter(
        (w) => !w.isDeload && !w.isWeekZero && w.weekNo >= 2,
      )) {
        const today = addDays(week.monday, -2); // Samstag davor
        const done = sessions.filter(
          (s) =>
            s.kind === 'endurance' &&
            s.scheduled_on <= today &&
            s.scheduled_on > addDays(today, -10),
        );
        const logs = done.slice(-3).map((s) =>
          sessionLog(`log-${s.id}`, s.scheduled_on, {
            plannedSessionId: s.id,
            kind: 'endurance',
            sessionRpe: 9,
          }),
        );
        const live = liveInputs(sessions, { today, sessionLogs: logs });
        const inputs = { ...live, plan: { ...live.plan, startDate: plan.plan.start_date } };
        const p = highLoadEndurance(inputs, planContext(inputs)).proposal;
        if (!p) continue;
        checked += 1;
        const after = applyPlanChange(sessions, p.changeAfter as PlanChange);
        for (const s of after) {
          const old = sessions.find((x) => x.id === s.id) as StoredSession;
          if (s.estimated_minutes === old.estimated_minutes) continue;
          expect(['easy', 'recovery', 'long']).toContain(s.workout_type);
          expect(generatedCompetitionSessionSchema.safeParse(s).success, s.id).toBe(true);
        }
        expect(
          checkWeekInvariants(after, { maxLoadWeeks: 4, planStart: plan.plan.start_date }),
        ).toEqual([]);
      }
      expect(checked).toBeGreaterThan(0);
    }
  });
});

describe('Getauschte Woche D: entsprechende Einheit und Wochen-Deckel (Wächter-Auflage 2)', () => {
  it('swappedExerciseLimit: gleiche Übung an gleicher Stelle → deren Dosierung; sonst die KLEINSTE Dosierung in D − 1', () => {
    const ex = (order_no: number, exercise_id: string, sets: number, rpe_target: number) =>
      ({ order_no, exercise_id, sets, rpe_target }) as StoredSession['exercises'][number];
    const prev = {
      sessions: [
        {
          id: 'p1',
          kind: 'strength',
          template_day_index: 1,
          scheduled_on: '2026-10-12',
          original_date: null,
          exercises: [ex(1, 'a', 4, 8), ex(2, 'b', 3, 8)],
        },
        {
          id: 'p2',
          kind: 'strength',
          template_day_index: 2,
          scheduled_on: '2026-10-15',
          original_date: null,
          exercises: [ex(1, 'c', 4, 8), ex(2, 'a', 2, 7)],
        },
      ] as unknown as StoredSession[],
    };
    const d = {
      id: 'd1',
      kind: 'strength',
      template_day_index: 1,
      scheduled_on: '2026-10-19',
      original_date: null,
      exercises: [],
    } as unknown as StoredSession;
    expect(swappedExerciseLimit(d, { order_no: 1, exercise_id: 'a' }, prev)).toEqual({
      sets: 4,
      rpe: 8,
    });
    expect(swappedExerciseLimit(d, { order_no: 3, exercise_id: 'a' }, prev)).toEqual({
      sets: 2,
      rpe: 7,
    });
    expect(swappedExerciseLimit(d, { order_no: 1, exercise_id: 'x' }, prev)).toBeNull();
  });

  it('Woche D mit zweimal der größeren Vorlagen-Einheit → Sätze auf die Summe von D − 1 gedeckelt, Tausch bleibt möglich', () => {
    const inputs = person({
      experienceLevel: 'beginner',
      sessionsPerWeek: 2,
      preferredDays: [2, 5],
    });
    const { sessions } = setup(inputs);
    const weekD = sessions.filter((s) => s.week_no === 6 && s.kind === 'strength');
    const week5 = sessions.filter((s) => s.week_no === 5 && s.kind === 'strength');
    const sets = (s: StoredSession) => s.exercises.reduce((a, e) => a + e.sets, 0);
    // Größte Vorlagen-Einheit der Woche D − 1; beide Einheiten der Erholungswoche werden zu ihr (Erholungs-Dosierung) –
    // wie es eine wechselnde Rotation ergeben kann. Ohne Wochen-Deckel hätte D dann mehr Sätze als D − 1.
    const big = [...week5].sort((a, b) => sets(b) - sets(a))[0] as StoredSession;
    expect(2 * sets(big)).toBeGreaterThan(week5.reduce((a, s) => a + sets(s), 0));
    const manipulated = sessions.map((s) =>
      weekD.includes(s)
        ? {
            ...s,
            template_day_index: big.template_day_index,
            name_de: big.name_de,
            exercises: big.exercises.map((e) => ({
              ...e,
              sets: Math.ceil(e.sets / 2),
              rpe_target: Math.max(5, e.rpe_target - 2),
            })),
          }
        : s,
    );
    const live = liveInputs(manipulated, { today: addDays(weekStart(3), 4), level: 'beginner' });
    const swap = tryDeloadForward(live, planContext(live));
    expect(swap).not.toBeNull();
    const after = planWeeks(
      applyPlanChange(manipulated, (swap as { pair: { after: PlanChange } }).pair.after),
    );
    const D = after.find((w) => w.weekNo === 6);
    const P = after.find((w) => w.weekNo === 5);
    expect(strengthSets(D?.sessions ?? [])).toBeLessThanOrEqual(strengthSets(P?.sessions ?? []));
  });
});

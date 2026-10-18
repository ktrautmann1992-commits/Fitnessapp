/**
 * Eigenschaftstests der Live-Anpassung (docs/PLAN-PHASE-4B.md 5.8): 300 zufällige Eintragsfolgen mit Ausreißern
 * (Grenzen der Zustands-Vorgaben, Wochen-Deckel, nur zulässige Einheiten, Gratis = nichts) und 300 zufällige Pläne mit
 * zufälligen R3/R4-Auslösern (Wochen-Invarianten über BEIDE Blöcke inkl. Folgeblock mit carriedLoadWeeks).
 * Fester Zufalls-Seed – gleiche Läufe in CI.
 */
import { describe, expect, it } from 'vitest';

import { LIVE_ADJUSTMENT } from '../constants';
import { addDays, startOfIsoWeek } from '../dates';
import { all, simulate } from '../log/test-helpers';
import type { LoggedSet, ProgressionContext } from '../log/types';
import { loadWeeksBeforeDeload } from '../plan/deload';
import { trailingLoadWeeks } from '../plan/periodization';
import { planSafetyRules } from '../plan/safety';
import { FULL_HOME, MONDAY, person } from '../plan/test-library';
import { canRevert, restoreTemporaryChanges } from './apply';
import { computeLiveAdjustments } from './engine';
import { checkWeekInvariants } from './invariants';
import { applyPlanChange, enduranceReduceChange, type PlanChangePair } from './plan-changes';
import {
  planContext,
  swappedWeeksOf,
  tryDeloadForward,
  tryVolumeReduce,
  violationsAfter,
} from './rules/plan-rules';
import { adjustmentProposalSchema } from './schemas';
import {
  BENCH,
  followUpBlock,
  liveInputs,
  planWithFollowUps,
  sessionLog,
  stored,
  storedFrom,
  testEnv,
  withLogIds,
} from './test-helpers';
import type { PlanChange } from './types';
import { eligiblePlannedSessions, planWeeks } from './weeks';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const env = testEnv(person({ homeEquipment: [...FULL_HOME] }));
const basePlan = planWithFollowUps(person({ experienceLevel: 'advanced' }), MONDAY, 1);
if (!basePlan) throw new Error('kein Plan');

describe('Eigenschaft: 300 zufällige Eintragsfolgen mit Ausreißern', () => {
  it('Grenzen der Vorgaben, ≤ 3 automatische je Woche, nur zulässige Einheiten, Gratis = nichts', () => {
    const random = rng(4242);
    const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)] as T;
    const STEPS = [[], [4, 6, 8, 10, 12], [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22.5, 25]];
    let proposals = 0;
    for (let run = 0; run < 300; run += 1) {
      const steps = pick(STEPS);
      const ctx: ProgressionContext = {
        ...BENCH,
        incrementKind: steps.length > 0 ? 'free_weight' : 'barbell',
        steps,
      };
      const today = addDays('2026-10-12', Math.floor(random() * 40));
      const count = 2 + Math.floor(random() * 7);
      const start = addDays(today, -2 * count - 1);
      const perform = (): ((p: Parameters<ReturnType<typeof all>>[0]) => LoggedSet[]) => {
        const kind = random();
        if (kind < 0.1) return all(12, { rpe: 5 }); // sehr leicht
        if (kind < 0.25) return all(4, { rpe: 10 }); // deutlich verfehlt
        if (kind < 0.3) return all(10, { weightKg: 200 }); // Tippfehler (unbestätigt)
        return all(8 + Math.floor(random() * 5), {
          rpe: random() < 0.5 ? null : 6 + Math.floor(random() * 4),
        });
      };
      const sim = simulate(
        'bench',
        ctx,
        { sets: 3, reps_min: 8, reps_max: 12, duration_s: null, rpe_target: 8 },
        Array.from({ length: count }, (_, i) => ({
          date: addDays(start, 2 * i),
          isDeload: random() < 0.1,
          perform: perform(),
        })),
        { progress: { startWeightKg: pick([6, 20, 40, 60, 100, 480]) } },
      );
      const entries = withLogIds(sim.entries.filter((e) => e.performedOn < today));
      const sessionLogs = [...new Set(entries.map((e) => e.sessionLogId))].map((id, i) =>
        sessionLog(
          id,
          (entries.find((e) => e.sessionLogId === id) as { performedOn: string }).performedOn,
          {
            sessionRpe: random() < 0.6 ? 9 : 7,
            plannedSessionId: random() < 0.5 ? (basePlan.sessions[i]?.id ?? null) : null,
          },
        ),
      );
      const inputs = liveInputs(basePlan.sessions, {
        today,
        exerciseEntries: entries,
        sessionLogs,
        contexts: { bench: ctx },
        person: { birthDate: pick(['2009-01-01', '1990-01-15', '1950-01-01']) },
        level: pick(['beginner', 'advanced', 'competitive'] as const),
        rules: planSafetyRules(
          {
            experienceLevel: 'advanced',
            birthDate: '1990-01-15',
            healthScreening: random() < 0.2 ? null : { flags: [] },
          },
          today,
        ),
      });
      const frozen = JSON.stringify(inputs);
      const result = computeLiveAdjustments(inputs, env);
      expect(JSON.stringify(inputs)).toBe(frozen);
      expect(computeLiveAdjustments({ ...inputs, entitled: false }, env)).toEqual({
        proposals: [],
        hints: [],
      });
      const automatic = result.proposals.filter((p) => !p.requiresConfirmation);
      expect(automatic.length).toBeLessThanOrEqual(LIVE_ADJUSTMENT.maxAutomaticPerWeek);
      const eligible = new Set(
        eligiblePlannedSessions(inputs.plan.sessions, sessionLogs, today).map((s) => s.id),
      );
      for (const p of result.proposals) {
        proposals += 1;
        expect(adjustmentProposalSchema.safeParse(p).success, JSON.stringify(p)).toBe(true);
        expect(p.effectiveFrom > today).toBe(true);
        for (const id of p.plannedSessionIds) expect(eligible.has(id)).toBe(true);
        const before = p.stateBefore?.weightKg ?? null;
        const after = p.stateAfter?.weightKg ?? null;
        if (after !== null) {
          expect(after).toBeGreaterThanOrEqual(0.5);
          expect(after).toBeLessThanOrEqual(500);
        }
        if (p.rule === 'load_reduce' && before !== null && after !== null) {
          expect(after).toBeLessThanOrEqual(before);
          expect(after).toBeGreaterThanOrEqual(
            Math.min(before, Math.max(before * 0.9, Math.min(...(steps.length ? steps : [0.5])))) -
              1e-9,
          );
        }
        if (
          p.rule === 'fast_increase' &&
          before !== null &&
          after !== null &&
          after > before * 1.1 + 1e-9
        ) {
          // Größer als 10 % nur nach dem Puffer (Zusatzsatz schon erreicht).
          expect(p.stateBefore?.extraSet).toBe(true);
        }
      }
      // Wiederholt mit gespeicherten Vorschlägen: nie zweimal derselbe Fingerabdruck.
      const again = computeLiveAdjustments(
        { ...inputs, adjustments: result.proposals.map((p) => storedFrom(p)) },
        env,
      );
      for (const p of again.proposals) {
        expect(
          result.proposals.some(
            (q) => q.rule === p.rule && q.inputFingerprint === p.inputFingerprint,
          ),
        ).toBe(false);
      }
    }
    expect(proposals).toBeGreaterThan(30);
  });
});

describe('Eigenschaft: Wochen-Invarianten über 300 zufällige Pläne mit R3/R4-Auslösern (Wächter B2)', () => {
  it('nie mehr als L Belastungswochen in Folge, 10-%-Kette, Erholungswochen reduziert, getauschte Woche ≤ Vorwoche – über beide Blöcke', () => {
    const random = rng(7);
    const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)] as T;
    let swaps = 0;
    let reductions = 0;
    let checked = 0;
    for (let run = 0; run < 300; run += 1) {
      const level = pick(['beginner', 'advanced', 'competitive'] as const);
      const cautious = random() < 0.3;
      const days = 1 + Math.floor(random() * 7);
      const weekdays = [1, 2, 3, 4, 5, 6, 7].filter((d) => d <= days);
      const withEndurance = random() < 0.6;
      const enduranceOnly = withEndurance && random() < 0.2;
      const inputs = person({
        experienceLevel: level,
        goalType: enduranceOnly ? 'endurance' : 'muscle_gain',
        ...(enduranceOnly ? { discipline: '10k' as const } : {}),
        healthScreening: cautious ? null : { flags: [] },
        homeEquipment: [...FULL_HOME],
        schedule: {
          mode: 'fixed',
          slots: weekdays.map((weekday, i) => ({
            weekday,
            kind:
              enduranceOnly || (withEndurance && i % 2 === 1)
                ? 'endurance'
                : pick(['strength_gym', 'strength_home'] as const),
            minutes: 30 + 15 * Math.floor(random() * 4),
          })),
        },
      });
      const start = addDays(MONDAY, Math.floor(random() * 7));
      const plan = planWithFollowUps(inputs, start, 0);
      if (!plan) continue;
      const L = loadWeeksBeforeDeload(
        level,
        planSafetyRules(
          {
            experienceLevel: level,
            birthDate: inputs.birthDate,
            healthScreening: inputs.healthScreening ?? null,
          },
          start,
        ).cautious,
      );
      const weeks = planWeeks(plan.sessions);
      const k = Math.floor(random() * Math.max(1, weeks.length - 1));
      const today = addDays((weeks[k] as { monday: string }).monday, Math.floor(random() * 7));
      const live = liveInputs(plan.sessions, { today, level });
      const inputsLive = {
        ...live,
        plan: { ...live.plan, startDate: plan.plan.start_date },
        rules: planSafetyRules(
          {
            experienceLevel: level,
            birthDate: inputs.birthDate,
            healthScreening: inputs.healthScreening ?? null,
          },
          today,
        ),
      };
      const ctx = planContext(inputsLive);
      // Zufälliger Auslöser: Erholungswoche vorziehen (R3 zweimal bzw. R4), Sätze −1 (R3), Ausdauer −15 % (R3).
      const trigger = pick(['forward', 'volume', 'endurance', 'forward'] as const);
      let pair: PlanChangePair | null = null;
      let swappedWeeks: { blockNo: number; weekNo: number }[] = [];
      if (trigger === 'forward') {
        const swap = tryDeloadForward(inputsLive, ctx);
        if (swap) {
          pair = swap.pair;
          const d = ctx.weeks[swap.d] as { blockNo: number; weekNo: number };
          swappedWeeks = [{ blockNo: d.blockNo, weekNo: d.weekNo }];
          swaps += 1;
        }
      } else if (trigger === 'volume') {
        const p = tryVolumeReduce(inputsLive, ctx, env, []);
        if (p) pair = { before: p.changeBefore as PlanChange, after: p.changeAfter as PlanChange };
      } else if (ctx.n >= 0) {
        const candidate = enduranceReduceChange(
          ctx.sessions,
          ctx.weeks[ctx.n] as never,
          ctx.eligible,
          plan.plan.start_date,
        );
        if (
          candidate.after.sessions.length > 0 &&
          violationsAfter(inputsLive, ctx, candidate, ctx.n).length === 0
        ) {
          pair = candidate;
          reductions += 1;
        }
      }
      const after = pair ? applyPlanChange(plan.sessions, pair.after) : plan.sessions;
      // Nur zulässige Einheiten geändert.
      for (const id of pair?.after.sessions.map((s) => s.id) ?? [])
        expect(ctx.eligible.has(id)).toBe(true);
      const adjustments = pair
        ? [
            storedFrom({
              rule:
                trigger === 'forward'
                  ? 'deload_forward'
                  : trigger === 'volume'
                    ? 'volume_reduce'
                    : 'endurance_reduce',
              kind: 'plan_change',
              requiresConfirmation: false,
              exerciseId: null,
              plannedSessionIds: [...new Set(pair.after.sessions.map((s) => s.id))],
              basisSessionLogId: null,
              basisPerformedOn: null,
              stateBefore: null,
              stateAfter: null,
              changeBefore: pair.before,
              changeAfter: pair.after,
              explainParams: {},
              effectiveFrom: addDays(today, 1),
              expiresOn: null,
              inputFingerprint: `volume_reduce:${String(run).padStart(16, '0')}`,
              engineVersion: 1,
              ruleVersion: 1,
              usesBodyData: false,
              fromHealthPlan: false,
            }),
          ]
        : [];
      const carried = trailingLoadWeeks(after);
      const restored = restoreTemporaryChanges(after, adjustments);
      const next = stored(
        followUpBlock(plan.plan, inputs, restored, { carriedLoadWeeks: carried }),
        'n',
      );
      const both = [...after, ...next];
      const violations = checkWeekInvariants(both, {
        maxLoadWeeks: L,
        planStart: plan.plan.start_date,
        swappedWeeks,
      });
      expect(
        violations,
        `${run}: ${trigger} ${level} ${days}T ${JSON.stringify(violations.slice(0, 2))}`,
      ).toEqual([]);
      if (!pair) expect(carried).toBe(0);
      // Folgeblock nach dem Tausch: höchstens L Belastungswochen über die Blockgrenze.
      expect(startOfIsoWeek(next[0]?.scheduled_on ?? today) > today || next.length === 0).toBe(
        true,
      );
      checked += 1;
    }
    expect(checked).toBeGreaterThan(250);
    expect(swaps).toBeGreaterThan(20);
    expect(reductions).toBeGreaterThan(5);
  });
});

describe('Eigenschaft: mehrwöchiger Lauf über die Engine mit zufälligen Rücknahmen (Wächter-Auflage 1)', () => {
  it('Rücknahme nur, wenn keine neuere Änderung dieselben Wochen trifft – Invarianten halten über drei Blöcke', () => {
    const random = rng(99);
    const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)] as T;
    let reverts = 0;
    let blockedNewer = 0;
    const rulesSeen: Record<string, number> = {};
    for (let run = 0; run < 40; run += 1) {
      const level = pick(['beginner', 'advanced', 'competitive'] as const);
      const days = 2 + Math.floor(random() * 5);
      const withEndurance = random() < 0.7;
      const inputs = person({
        experienceLevel: level,
        homeEquipment: [...FULL_HOME],
        schedule: {
          mode: 'fixed',
          slots: [1, 2, 3, 4, 5, 6, 7].slice(0, days).map((weekday, i) => ({
            weekday,
            kind: withEndurance && i % 2 === 1 ? 'endurance' : 'strength_gym',
            minutes: 30 + 15 * Math.floor(random() * 4),
          })),
        },
      });
      const start = addDays(MONDAY, Math.floor(random() * 7));
      const base = planWithFollowUps(inputs, start, 0);
      if (!base) continue;
      const rules = planSafetyRules(
        { experienceLevel: level, birthDate: inputs.birthDate, healthScreening: { flags: [] } },
        start,
      );
      const L = loadWeeksBeforeDeload(level, rules.cautious);
      let sessions = base.sessions;
      const adjustments: ReturnType<typeof storedFrom>[] = [];
      const logs: ReturnType<typeof sessionLog>[] = [];
      let blocks = 1;
      for (let day = start, guard = 0; guard < 160; guard += 1, day = addDays(day, 1)) {
        for (const s of sessions.filter((x) => x.scheduled_on === day && x.status === 'planned')) {
          if (random() < 0.8) {
            logs.push(
              sessionLog(`L${logs.length}`, day, {
                plannedSessionId: s.id,
                kind: s.kind,
                sessionRpe: random() < 0.9 ? 9 : 6,
                isIntroWeek: s.is_intro_week,
                isDeload: s.is_deload,
              }),
            );
            sessions = sessions.map((x) =>
              x.id === s.id ? { ...x, status: 'completed' as const } : x,
            );
          }
        }
        const live = liveInputs(sessions, {
          today: day,
          level,
          sessionLogs: logs,
          adjustments,
          rules,
        });
        const result = computeLiveAdjustments(
          { ...live, plan: { ...live.plan, startDate: base.plan.start_date } },
          env,
        );
        for (const p of result.proposals) {
          const stored = storedFrom(p, {
            id: `a${adjustments.length}`,
            createdAt: `${day}T19:00:${String(adjustments.length % 60).padStart(2, '0')}Z`,
          });
          adjustments.push(stored);
          if (p.kind === 'plan_change')
            sessions = applyPlanChange(sessions, p.changeAfter as PlanChange);
          rulesSeen[p.rule] = (rulesSeen[p.rule] ?? 0) + 1;
        }
        if (random() < 0.12) {
          const state = {
            sessions,
            sessionLogs: logs,
            entries: [],
            today: day,
            adjustments,
            maxLoadWeeks: L,
            planStart: base.plan.start_date,
          };
          const candidates = adjustments.filter(
            (a) => a.kind === 'plan_change' && a.status === 'applied',
          );
          const overlapped = candidates.filter((a) =>
            candidates.some(
              (b) =>
                b !== a &&
                b.createdAt > a.createdAt &&
                b.plannedSessionIds.some((id) => a.plannedSessionIds.includes(id)),
            ),
          );
          // Bevorzugt ältere Anpassungen, über denen schon eine neuere liegt (der kritische Fall).
          const pool = overlapped.length > 0 && random() < 0.6 ? overlapped : candidates;
          const target = pool.length > 0 ? pick(pool) : null;
          if (target) {
            const newer = adjustments.some(
              (b) =>
                b !== target &&
                b.kind === 'plan_change' &&
                b.status === 'applied' &&
                b.createdAt > target.createdAt &&
                b.plannedSessionIds.some((id) => target.plannedSessionIds.includes(id)),
            );
            if (canRevert(target, state)) {
              expect(newer).toBe(false);
              sessions = applyPlanChange(sessions, target.changeBefore as PlanChange);
              adjustments[adjustments.indexOf(target)] = {
                ...target,
                status: 'reverted',
                decidedAt: `${day}T20:00:00Z`,
              };
              reverts += 1;
            } else if (newer) {
              blockedNewer += 1;
            }
          }
        }
        const last = sessions
          .map((s) => s.scheduled_on)
          .sort()
          .at(-1) as string;
        if (day >= startOfIsoWeek(last) && blocks < 3) {
          const carried = trailingLoadWeeks(sessions);
          const next = followUpBlock(
            base.plan,
            inputs,
            restoreTemporaryChanges(sessions, adjustments),
            { carriedLoadWeeks: carried },
          );
          if (next.length === 0) break;
          sessions = [...sessions, ...stored(next, `b${blocks}x`)];
          blocks += 1;
        }
        if (day >= last && blocks >= 3) break;
      }
      const violations = checkWeekInvariants(sessions, {
        maxLoadWeeks: L,
        planStart: base.plan.start_date,
        swappedWeeks: swappedWeeksOf(adjustments, planWeeks(sessions)),
      });
      expect(violations, `${run}: ${JSON.stringify(violations.slice(0, 2))}`).toEqual([]);
    }
    expect(reverts).toBeGreaterThan(5);
    expect(blockedNewer, `reverts ${reverts} ${JSON.stringify(rulesSeen)}`).toBeGreaterThan(0);
  });
});

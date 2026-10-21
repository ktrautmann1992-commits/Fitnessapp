import { LIVE_ADJUSTMENT } from '../../constants';
import { addDays, daysBetween, startOfIsoWeek } from '../../dates';
import { loadWeeksBeforeDeload } from '../../plan/deload';
import { isEnduranceOverload } from '../../plan/intensity';
import { cautiousProgression } from '../../plan/safety';
import type { StoredSession } from '../../plan/view';
import { inputFingerprint } from '../fingerprint';
import type { LiveAdjustmentEnvironment, LiveAdjustmentInputs, LiveSessionLog } from '../inputs';
import { type InvariantViolation, newInvariantViolations } from '../invariants';
import {
  applyPlanChange,
  changedSessionIds,
  deloadForwardChange,
  enduranceReduceChange,
  type PlanChangePair,
  volumeReduceChange,
} from '../plan-changes';
import type { AdjustmentHint, AdjustmentProposal, ExplainParams, StoredAdjustment } from '../types';
import {
  eligiblePlannedSessions,
  isCompetitionPlan,
  type PlanWeek,
  planWeeks,
  tomorrowOf,
} from '../weeks';
import { inRevertCooldown, isEffective, withinDays } from './common';

/**
 * Plan-Änderungen R3 (`volume_reduce`, `deload_forward`, `endurance_reduce`) und die Tausch-Regel (docs/PLAN-PHASE-4B.md
 * 5.2, Wächter B2). Woche k = Kalenderwoche von heute, n = k + 1. Jede Änderung trifft nur Einheiten aus
 * eligiblePlannedSessions() (S1) und wird vor dem Vorschlag mit checkWeekInvariants() geprüft.
 */

export interface PlanContext {
  readonly sessions: readonly StoredSession[];
  readonly weeks: readonly PlanWeek<StoredSession>[];
  readonly eligible: ReadonlySet<string>;
  /** Index der laufenden Woche k bzw. der nächsten Woche n (−1 = keine). */
  readonly k: number;
  readonly n: number;
  readonly maxLoadWeeks: number;
  readonly competition: boolean;
}

export function planContext(inputs: LiveAdjustmentInputs): PlanContext {
  const sessions = inputs.plan.sessions;
  const weeks = planWeeks(sessions);
  const monday = startOfIsoWeek(inputs.today);
  const k = weeks.findIndex((w) => w.monday === monday);
  const n = k >= 0 && weeks[k + 1]?.monday === addDays(monday, 7) ? k + 1 : -1;
  return {
    sessions,
    weeks,
    eligible: new Set(
      eligiblePlannedSessions(sessions, inputs.sessionLogs, inputs.today).map((s) => s.id),
    ),
    k,
    n,
    maxLoadWeeks: loadWeeksBeforeDeload(
      inputs.plan.experienceLevel,
      cautiousProgression(inputs.rules),
    ),
    competition: isCompetitionPlan(sessions),
  };
}

/** Wochen D, die frühere deload_forward-Anpassungen getauscht haben (explain_params.swapped_week_start). */
export function swappedWeeksOf(
  adjustments: readonly StoredAdjustment[],
  weeks: readonly PlanWeek<StoredSession>[],
): { blockNo: number; weekNo: number }[] {
  const out: { blockNo: number; weekNo: number }[] = [];
  for (const a of adjustments) {
    if (a.rule !== 'deload_forward' || !isEffective(a)) continue;
    const monday = a.explainParams.swapped_week_start;
    const d = weeks.find((w) => w.monday === monday);
    if (d) out.push({ blockNo: d.blockNo, weekNo: d.weekNo });
  }
  return out;
}

/** Hat eine wirksame Anpassung dieser Regel Einheiten der Woche getroffen? */
function weekHasRule(
  adjustments: readonly StoredAdjustment[],
  rule: StoredAdjustment['rule'],
  week: PlanWeek<StoredSession>,
  statuses: (a: StoredAdjustment) => boolean = isEffective,
): boolean {
  const ids = new Set(week.sessions.map((s) => s.id));
  return adjustments.some(
    (a) => a.rule === rule && statuses(a) && a.plannedSessionIds.some((id) => ids.has(id)),
  );
}

function planProposal(
  rule: 'volume_reduce' | 'deload_forward' | 'endurance_reduce' | 'stagnation_variation',
  inputs: LiveAdjustmentInputs,
  pair: PlanChangePair,
  fingerprintParts: Readonly<Record<string, unknown>>,
  explainParams: ExplainParams,
  exerciseId: string | null = null,
  basis: LiveSessionLog | null = null,
): AdjustmentProposal {
  const ids = changedSessionIds(pair);
  const dates = inputs.plan.sessions
    .filter((s) => ids.includes(s.id))
    .map((s) => s.scheduled_on)
    .sort();
  return {
    rule,
    kind: 'plan_change',
    requiresConfirmation: false,
    exerciseId,
    plannedSessionIds: ids,
    basisSessionLogId: basis?.id ?? null,
    basisPerformedOn: basis?.performedOn ?? null,
    stateBefore: null,
    stateAfter: null,
    changeBefore: pair.before,
    changeAfter: pair.after,
    explainParams,
    effectiveFrom: dates[0] ?? tomorrowOf(inputs.today),
    expiresOn: null,
    inputFingerprint: inputFingerprint(rule, { plan: inputs.plan.id, ...fingerprintParts }),
    engineVersion: LIVE_ADJUSTMENT.engineVersion,
    ruleVersion: LIVE_ADJUSTMENT.ruleVersion,
    usesBodyData: false,
    fromHealthPlan: inputs.plan.fromHealthPlan,
  };
}

/** Invarianten nach einer Änderung (ab Woche `fromIndex`); leer = gültig. */
export function violationsAfter(
  inputs: LiveAdjustmentInputs,
  ctx: PlanContext,
  pair: PlanChangePair,
  fromIndex: number,
  extraSwapped: readonly { blockNo: number; weekNo: number }[] = [],
): InvariantViolation[] {
  const after = applyPlanChange(ctx.sessions, pair.after);
  const existing = swappedWeeksOf(inputs.adjustments, ctx.weeks);
  const options = {
    maxLoadWeeks: ctx.maxLoadWeeks,
    planStart: inputs.plan.startDate,
    fromMonday: ctx.weeks[fromIndex]?.monday ?? inputs.today,
  };
  // Nur neu entstehende Verstöße zählen (Altverstöße am Blockrand blockieren nichts, Wächter-Auflage 5).
  return newInvariantViolations(
    ctx.sessions,
    after,
    { ...options, swappedWeeks: [...existing, ...extraSwapped] },
    { ...options, swappedWeeks: existing },
  );
}

/** Index der nächsten geplanten Erholungswoche nach Woche k (−1 = keine bekannt). */
export function nextDeloadIndex(ctx: PlanContext): number {
  return ctx.weeks.findIndex((w, i) => i > ctx.k && w.isDeload);
}

/**
 * Tausch-Regel `deload_forward` (Punkt 1): nur ohne Wettkampf (Phasen, Tapering und langer Lauf hängen am
 * Makrozyklus – vorsichtige Lösung, Präzisierung 4b A), D im selben Block wie n, D − n ≥ 2, n ≥ Woche 2 und keine
 * Einstiegswoche, alle Einheiten der Wochen n … D zulässig (S1), höchstens einmal je Block, Invarianten halten.
 */
export function tryDeloadForward(
  inputs: LiveAdjustmentInputs,
  ctx: PlanContext,
): { pair: PlanChangePair; d: number } | null {
  if (ctx.competition || ctx.k < 0 || ctx.n < 0) return null;
  const weekN = ctx.weeks[ctx.n] as PlanWeek<StoredSession>;
  if (weekN.isDeload || weekN.isWeekZero || weekN.isIntro || weekN.weekNo < 2) return null;
  const d = ctx.weeks.findIndex((w, i) => i > ctx.n && w.blockNo === weekN.blockNo && w.isDeload);
  if (d < 0) return null;
  const weekD = ctx.weeks[d] as PlanWeek<StoredSession>;
  if (weekD.weekNo - weekN.weekNo < LIVE_ADJUSTMENT.deloadForward.minWeeksAfterNext) return null;
  for (let i = ctx.n; i <= d; i += 1) {
    if (!(ctx.weeks[i] as PlanWeek<StoredSession>).sessions.every((s) => ctx.eligible.has(s.id))) {
      return null;
    }
  }
  const blockIds = new Set(
    ctx.sessions.filter((s) => s.block_no === weekN.blockNo).map((s) => s.id),
  );
  const alreadyInBlock = inputs.adjustments.some(
    (a) =>
      a.rule === 'deload_forward' &&
      (isEffective(a) || a.status === 'reverted') &&
      a.plannedSessionIds.some((id) => blockIds.has(id)),
  );
  if (alreadyInBlock) return null;
  const pair = deloadForwardChange(
    ctx.sessions,
    ctx.weeks,
    { k: ctx.k, n: ctx.n, d },
    ctx.eligible,
    inputs.rules.rpeMax,
    inputs.plan.startDate,
  );
  // Nur zulässige Einheiten geändert und alle Invarianten erfüllt (sonst Fallback).
  if (!changedSessionIds(pair).every((id) => ctx.eligible.has(id))) return null;
  if (
    violationsAfter(inputs, ctx, pair, ctx.n, [{ blockNo: weekD.blockNo, weekNo: weekD.weekNo }])
      .length > 0
  ) {
    return null;
  }
  return { pair, d };
}

export interface RuleOutcome {
  readonly proposal: AdjustmentProposal | null;
  readonly hint: AdjustmentHint | null;
}

const none: RuleOutcome = { proposal: null, hint: null };

/** Volume-Reduce für Woche n, sofern zulässig und in dieser Woche noch nicht angewandt. */
export function tryVolumeReduce(
  inputs: LiveAdjustmentInputs,
  ctx: PlanContext,
  env: LiveAdjustmentEnvironment,
  basis: readonly LiveSessionLog[],
): AdjustmentProposal | null {
  if (ctx.n < 0) return null;
  const weekN = ctx.weeks[ctx.n] as PlanWeek<StoredSession>;
  if (weekN.isDeload || weekN.isWeekZero || weekN.isIntro) return null;
  if (weekHasRule(inputs.adjustments, 'volume_reduce', weekN)) return null;
  if (
    inRevertCooldown(inputs.adjustments, 'volume_reduce', inputs.today, (a) =>
      a.plannedSessionIds.some((id) => weekN.sessions.some((s) => s.id === id)),
    )
  ) {
    return null;
  }
  const pair = volumeReduceChange(weekN, ctx.eligible, env.library);
  if (pair.after.sessions.length === 0) return null;
  if (violationsAfter(inputs, ctx, pair, ctx.n).length > 0) return null;
  return planProposal(
    'volume_reduce',
    inputs,
    pair,
    { week: `${weekN.blockNo}:${weekN.weekNo}`, basis: basis.map((l) => l.id).sort() },
    { week_start: weekN.monday, sets_reduction: LIVE_ADJUSTMENT.highSessionLoad.setsReduction },
    null,
    basis.at(-1) ?? null,
  );
}

/** Vorschlag `deload_forward` aus einem erfolgreichen Tausch. */
export function deloadForwardProposal(
  inputs: LiveAdjustmentInputs,
  ctx: PlanContext,
  result: { pair: PlanChangePair; d: number },
  reason: 'high_load' | 'stagnation',
  exerciseId: string | null,
  basis: LiveSessionLog | null,
): AdjustmentProposal {
  const weekN = ctx.weeks[ctx.n] as PlanWeek<StoredSession>;
  const weekD = ctx.weeks[result.d] as PlanWeek<StoredSession>;
  return planProposal(
    'deload_forward',
    inputs,
    result.pair,
    {
      from: `${weekN.blockNo}:${weekN.weekNo}`,
      swapped: `${weekD.blockNo}:${weekD.weekNo}`,
      reason,
    },
    { week_start: weekN.monday, swapped_week_start: weekD.monday },
    exerciseId,
    basis,
  );
}

/** Zählende Einheiten im Tagebuch (keine Einstiegs-/Erholungswoche, keine freie Einheit). */
const counting = (l: LiveSessionLog) => !l.isIntroWeek && !l.isDeload && !l.isFree;

const newestFirst = (a: LiveSessionLog, b: LiveSessionLog) =>
  b.performedOn.localeCompare(a.performedOn) || b.loggedAt.localeCompare(a.loggedAt);

/**
 * R3 Kraft: die drei neuesten zählenden Kraft-Einheiten binnen 14 Tagen haben session_rpe ≥ 9. Erholungswoche ≤ 2
 * Wochen entfernt → nur Hinweis; R3 schon in der Vorwoche angewandt → Erholungswoche vorziehen (Tausch-Regel), sonst
 * Fallback `volume_reduce`; sonst `volume_reduce` für die nächste Woche.
 */
export function highLoadStrength(
  inputs: LiveAdjustmentInputs,
  ctx: PlanContext,
  env: LiveAdjustmentEnvironment,
): RuleOutcome {
  const H = LIVE_ADJUSTMENT.highSessionLoad;
  const recent = inputs.sessionLogs
    .filter((l) => l.kind === 'strength' && counting(l))
    .sort(newestFirst)
    .slice(0, H.sessions);
  if (
    recent.length < H.sessions ||
    !recent.every(
      (l) =>
        withinDays(l.performedOn, inputs.today, H.windowDays) &&
        l.sessionRpe !== null &&
        l.sessionRpe >= H.sessionRpeMin,
    )
  ) {
    return none;
  }
  const hint = (code: AdjustmentHint['code']): RuleOutcome => ({
    proposal: null,
    hint: { code, rule: 'volume_reduce', exerciseId: null },
  });
  if (ctx.k < 0 || ctx.n < 0) return hint('rest_this_week');
  const deload = nextDeloadIndex(ctx);
  if (deload >= 0) {
    const weeksAway =
      daysBetween((ctx.weeks[ctx.k] as PlanWeek).monday, (ctx.weeks[deload] as PlanWeek).monday) /
      7;
    if (weeksAway <= H.deloadSoonWeeks) return hint('deload_soon');
  }
  const basis = [...recent].reverse();
  const weekK = ctx.weeks[ctx.k] as PlanWeek<StoredSession>;
  const twiceInRow = weekHasRule(inputs.adjustments, 'volume_reduce', weekK);
  if (twiceInRow) {
    const swap = tryDeloadForward(inputs, ctx);
    if (swap) {
      return {
        proposal: deloadForwardProposal(inputs, ctx, swap, 'high_load', null, basis.at(-1) ?? null),
        hint: null,
      };
    }
  }
  const reduce = tryVolumeReduce(inputs, ctx, env, basis);
  return reduce ? { proposal: reduce, hint: null } : hint('rest_this_week');
}

/**
 * R3 Ausdauer `endurance_reduce` (neu gefasst mit Phase 10 WP3): in 2 der 3 neuesten zählenden Ausdauer-Einträge
 * (binnen 14 Tagen) liegt die Anstrengung bei ≥ enduranceOverloadThreshold(Ziel der geplanten Einheit). Wirkung:
 * Minuten der nächsten Woche × 0,85, Folgewochen neu gedeckelt (nur senken). Im Wettkampfplan nur lockere Arten.
 */
export function highLoadEndurance(inputs: LiveAdjustmentInputs, ctx: PlanContext): RuleOutcome {
  const E = LIVE_ADJUSTMENT.enduranceReduce;
  const recent = inputs.sessionLogs
    .filter(
      (l) =>
        l.kind === 'endurance' &&
        counting(l) &&
        withinDays(l.performedOn, inputs.today, E.windowDays),
    )
    .sort(newestFirst)
    .slice(0, E.latestEntries);
  if (recent.length < E.latestEntries) return none;
  const target = new Map(ctx.sessions.map((s) => [s.id, s.effort_target] as const));
  const overloaded = recent.filter(
    (l) =>
      l.sessionRpe !== null &&
      isEnduranceOverload(
        l.plannedSessionId === null ? null : (target.get(l.plannedSessionId) ?? null),
        l.sessionRpe,
      ),
  );
  if (overloaded.length < E.overloadEntries) return none;
  const hint = (code: AdjustmentHint['code']): RuleOutcome => ({
    proposal: null,
    hint: { code, rule: 'endurance_reduce', exerciseId: null },
  });
  if (ctx.n < 0) return hint('rest_this_week');
  const weekN = ctx.weeks[ctx.n] as PlanWeek<StoredSession>;
  if (weekN.isDeload) return hint('deload_soon');
  if (weekN.isWeekZero || weekN.isIntro) return hint('rest_this_week');
  if (weekHasRule(inputs.adjustments, 'endurance_reduce', weekN)) return none;
  if (
    inRevertCooldown(inputs.adjustments, 'endurance_reduce', inputs.today, (a) =>
      a.plannedSessionIds.some((id) => weekN.sessions.some((s) => s.id === id)),
    )
  ) {
    return none;
  }
  const pair = enduranceReduceChange(ctx.sessions, weekN, ctx.eligible, inputs.plan.startDate);
  if (pair.after.sessions.length === 0) return hint('rest_this_week');
  if (violationsAfter(inputs, ctx, pair, ctx.n).length > 0) return hint('rest_this_week');
  const basis = [...overloaded].reverse();
  return {
    proposal: planProposal(
      'endurance_reduce',
      inputs,
      pair,
      { week: `${weekN.blockNo}:${weekN.weekNo}`, basis: basis.map((l) => l.id).sort() },
      {
        week_start: weekN.monday,
        percent: Math.round(LIVE_ADJUSTMENT.enduranceReduce.factor * 100),
      },
      null,
      basis.at(-1) ?? null,
    ),
    hint: null,
  };
}

import { LIVE_ADJUSTMENT } from '../../constants';
import { addDays, daysBetween, isoWeekday, startOfIsoWeek } from '../../dates';
import type { StoredSession } from '../../plan/view';
import { inputFingerprint } from '../fingerprint';
import type { LiveAdjustmentInputs } from '../inputs';
import type { AdjustmentProposal } from '../types';
import type { PlanWeek } from '../weeks';
import { dateOf } from './common';
import type { PlanContext, RuleOutcome } from './plan-rules';

/**
 * R5 `fewer_days` (docs/PLAN-PHASE-4B.md 5.2): in den letzten 3 ABGESCHLOSSENEN Wochen des aktiven Plans (ohne Woche 0
 * und Einstiegswoche; Erholungswochen zählen mit) geschafft / geplant < 70 % bei mindestens 3 geplanten Einheiten →
 * Vorschlag „ein Trainingstag weniger“ (nur mit Bestätigung). Geschafft = `completed` oder ein Eintrag (auch `partial`).
 * Wegfallen soll der Wochentag mit den meisten Ausfällen. Bei einem Trainingstag nur der Hinweis „Kürzere Einheiten?“.
 * Nicht bei offenem Vorschlag und 28 Tage nach einer Ablehnung.
 */
export function fewerDays(inputs: LiveAdjustmentInputs, ctx: PlanContext): RuleOutcome {
  const A = LIVE_ADJUSTMENT.adherence;
  const currentMonday = startOfIsoWeek(inputs.today);
  const closed = ctx.weeks
    .filter((w) => !w.isWeekZero && !w.isIntro && addDays(w.monday, 7) <= currentMonday)
    .slice(-A.weeks) as PlanWeek<StoredSession>[];
  if (closed.length < A.weeks) return { proposal: null, hint: null };
  const logged = new Set(
    inputs.sessionLogs.map((l) => l.plannedSessionId).filter((id): id is string => id !== null),
  );
  const sessions = closed.flatMap((w) => w.sessions);
  const done = (s: StoredSession) => s.status === 'completed' || logged.has(s.id);
  const planned = sessions.length;
  const completed = sessions.filter(done).length;
  if (planned < A.minPlanned || completed / planned >= A.minShare) {
    return { proposal: null, hint: null };
  }
  const blocked = inputs.adjustments.some(
    (a) =>
      a.rule === 'fewer_days' &&
      ((a.status === 'pending_confirmation' &&
        daysBetween(dateOf(a.createdAt), inputs.today) < LIVE_ADJUSTMENT.proposalExpiresDays) ||
        (a.status === 'declined' &&
          daysBetween(dateOf(a.decidedAt ?? a.createdAt), inputs.today) < A.declineCooldownDays)),
  );
  if (blocked) return { proposal: null, hint: null };
  const weekdayOf = (s: StoredSession) => isoWeekday(s.original_date ?? s.scheduled_on);
  const lastWeek = closed.at(-1) as PlanWeek<StoredSession>;
  const days = new Set(lastWeek.sessions.map(weekdayOf)).size;
  if (days <= 1) {
    return {
      proposal: null,
      hint: { code: 'shorter_sessions', rule: 'fewer_days', exerciseId: null },
    };
  }
  const stats = new Map<number, { missed: number; done: number }>();
  for (const s of sessions) {
    const w = weekdayOf(s);
    const entry = stats.get(w) ?? { missed: 0, done: 0 };
    if (done(s)) entry.done += 1;
    else entry.missed += 1;
    stats.set(w, entry);
  }
  const drop = [...stats.entries()].sort(
    ([wa, a], [wb, b]) => b.missed - a.missed || a.done - b.done || wb - wa,
  )[0]?.[0] as number;
  const proposal: AdjustmentProposal = {
    rule: 'fewer_days',
    kind: 'proposal',
    requiresConfirmation: true,
    exerciseId: null,
    plannedSessionIds: [],
    basisSessionLogId: null,
    basisPerformedOn: null,
    stateBefore: null,
    stateAfter: null,
    changeBefore: { days },
    changeAfter: { days: days - 1, drop_weekday: drop },
    explainParams: { done: completed, planned, days: days - 1, drop_weekday: drop },
    effectiveFrom: addDays(inputs.today, 1),
    expiresOn: addDays(inputs.today, LIVE_ADJUSTMENT.proposalExpiresDays),
    inputFingerprint: inputFingerprint('fewer_days', {
      plan: inputs.plan.id,
      weeks: closed.map((w) => w.monday),
    }),
    engineVersion: LIVE_ADJUSTMENT.engineVersion,
    ruleVersion: LIVE_ADJUSTMENT.ruleVersion,
    usesBodyData: false,
    fromHealthPlan: inputs.plan.fromHealthPlan,
  };
  return { proposal, hint: null };
}

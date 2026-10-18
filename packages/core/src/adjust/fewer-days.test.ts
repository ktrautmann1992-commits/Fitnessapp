import { describe, expect, it } from 'vitest';

import { person } from '../plan/test-library';
import type { StoredSession } from '../plan/view';
import { fewerDays } from './rules/fewer-days';
import { planContext } from './rules/plan-rules';
import { adjustmentProposalSchema } from './schemas';
import { liveInputs, planWithFollowUps, sessionLog, storedFrom } from './test-helpers';

const TODAY = '2026-11-04'; // Woche 5; abgeschlossen: Wochen 2–4 (Woche 1 = Einstiegswoche)

function setup(days: number[]) {
  const result = planWithFollowUps(
    person({ experienceLevel: 'advanced', sessionsPerWeek: days.length, preferredDays: days }),
    '2026-10-05',
    0,
  );
  if (!result) throw new Error('kein Plan');
  return result.sessions;
}

function outcome(
  sessions: readonly StoredSession[],
  done: number,
  overrides: Parameters<typeof liveInputs>[1] = {},
) {
  const window = sessions.filter((s) => s.week_no >= 2 && s.week_no <= 4);
  const logs = window
    .slice(0, done)
    .map((s) => sessionLog(`log-${s.id}`, s.scheduled_on, { plannedSessionId: s.id }));
  const live = liveInputs(sessions, { today: TODAY, sessionLogs: logs, ...overrides });
  return fewerDays(live, planContext(live));
}

describe('R5 fewer_days', () => {
  it('6 von 9 (67 %) → Vorschlag 2 Tage; 7 von 9 (78 %) → nichts', () => {
    const sessions = setup([1, 3, 5]);
    const p = outcome(sessions, 6).proposal;
    expect(p?.rule).toBe('fewer_days');
    expect(p?.requiresConfirmation).toBe(true);
    expect(p?.changeAfter).toMatchObject({ days: 2 });
    expect(p?.explainParams).toMatchObject({ done: 6, planned: 9, days: 2 });
    expect(adjustmentProposalSchema.safeParse(p).success).toBe(true);
    expect(outcome(sessions, 7).proposal).toBeNull();
  });

  it('genau 70 % → nichts, 60 % → Vorschlag (10 geplante Einheiten)', () => {
    const all = setup([1, 2, 4, 6]);
    const window = all.filter((s) => s.week_no >= 2 && s.week_no <= 4);
    const removed = new Set(window.slice(-2).map((s) => s.id));
    const sessions = all.filter((s) => !removed.has(s.id));
    expect(outcome(sessions, 7).proposal).toBeNull();
    expect(outcome(sessions, 6).proposal?.rule).toBe('fewer_days');
  });

  it('wegfallen soll der Tag mit den meisten Ausfällen', () => {
    const sessions = setup([1, 3, 5]);
    // Geschafft: alle außer Mittwoch (und ein Freitag).
    const window = sessions.filter((s) => s.week_no >= 2 && s.week_no <= 4);
    const doneIds = window.filter((s) => !s.scheduled_on.match(/-(14|21|28)$/)).slice(0, 5);
    const logs = doneIds.map((s) =>
      sessionLog(`log-${s.id}`, s.scheduled_on, { plannedSessionId: s.id }),
    );
    const live = liveInputs(sessions, { today: TODAY, sessionLogs: logs });
    expect(fewerDays(live, planContext(live)).proposal?.changeAfter).toMatchObject({
      drop_weekday: 3,
    });
  });

  it('1 Trainingstag → nur Hinweis „Kürzere Einheiten?“', () => {
    const sessions = setup([3]);
    const result = outcome(sessions, 0);
    expect(result.proposal).toBeNull();
    expect(result.hint?.code).toBe('shorter_sessions');
  });

  it('Einstiegswoche ausgeklammert: in Woche 3 gibt es erst 1 abgeschlossene Woche → nichts', () => {
    const sessions = setup([1, 3, 5]);
    const live = liveInputs(sessions, { today: '2026-10-21', sessionLogs: [] });
    expect(fewerDays(live, planContext(live)).proposal).toBeNull();
  });

  it('Ablehnung → 28 Tage Ruhe; offener Vorschlag blockiert, abgelaufener nicht', () => {
    const sessions = setup([1, 3, 5]);
    const p = outcome(sessions, 6).proposal;
    if (!p) throw new Error('kein Vorschlag');
    const declined = (daysAgo: string) =>
      storedFrom(p, {
        status: 'declined',
        createdAt: `${daysAgo}T10:00:00Z`,
        decidedAt: `${daysAgo}T10:00:00Z`,
      });
    expect(outcome(sessions, 6, { adjustments: [declined('2026-10-08')] }).proposal).toBeNull();
    expect(outcome(sessions, 6, { adjustments: [declined('2026-10-07')] }).proposal).not.toBeNull();
    const pending = (created: string) =>
      storedFrom(p, { status: 'pending_confirmation', createdAt: `${created}T10:00:00Z` });
    expect(outcome(sessions, 6, { adjustments: [pending('2026-11-01')] }).proposal).toBeNull();
    expect(outcome(sessions, 6, { adjustments: [pending('2026-10-20')] }).proposal).not.toBeNull();
  });
});

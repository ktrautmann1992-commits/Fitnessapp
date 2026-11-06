import { describe, expect, it } from 'vitest';

import { parseSupplementPrefs, supplementsVisible } from '@/lib/supplement-visibility';
import { planPersonRows, TODAY } from '@/test/fixtures';

import { todayTimingSession } from './supplement-library';
import type { PlannedSessionRow, SessionLogRow, UserPlanRow, UserRows } from './types';

// Supplemente rund ums Training (06.11.2026, docs/PLAN-SUPPLEMENTE-TRAINING.md): Einheit von heute und Schalter.

const PLAN = { id: 'p1', status: 'active' } as unknown as UserPlanRow;

function session(overrides: Partial<PlannedSessionRow>): PlannedSessionRow {
  return {
    id: 's1',
    plan_id: 'p1',
    scheduled_on: TODAY,
    status: 'planned',
    start_time: null,
    estimated_minutes: 60,
    ...overrides,
  } as unknown as PlannedSessionRow;
}

function rowsWith(sessions: PlannedSessionRow[], logs: Partial<SessionLogRow>[] = []): UserRows {
  return {
    ...planPersonRows(),
    plans: [PLAN],
    plannedSessions: sessions,
    sessionLogs: logs as SessionLogRow[],
  };
}

describe('todayTimingSession', () => {
  it('Ruhetag (keine Einheit, nur gestrichene oder andere Tage) → null', () => {
    expect(todayTimingSession(rowsWith([]), TODAY)).toBeNull();
    expect(todayTimingSession(rowsWith([session({ status: 'skipped' })]), TODAY)).toBeNull();
    expect(
      todayTimingSession(rowsWith([session({ scheduled_on: '2000-01-01' })]), TODAY),
    ).toBeNull();
    expect(
      todayTimingSession(
        { ...rowsWith([session({})]), plans: [{ id: 'p1', status: 'replaced' } as never] },
        TODAY,
      ),
    ).toBeNull();
  });

  it('geplante Uhrzeit und geschätzte Dauer; ohne Uhrzeit null', () => {
    expect(
      todayTimingSession(
        rowsWith([session({ start_time: '18:30:00', estimated_minutes: 45 })]),
        TODAY,
      ),
    ).toEqual({ startMinutes: 1110, durationMinutes: 45 });
    expect(todayTimingSession(rowsWith([session({})]), TODAY)).toEqual({
      startMinutes: null,
      durationMinutes: 60,
    });
  });

  it('echter Beginn und echte Dauer einer erledigten Einheit haben Vorrang', () => {
    const start = new Date(2026, 9, 19, 7, 5).toISOString();
    const end = new Date(2026, 9, 19, 8, 50).toISOString();
    const result = todayTimingSession(
      rowsWith(
        [session({ start_time: '18:00', status: 'completed' })],
        [{ planned_session_id: 's1', started_at: start, finished_at: end }],
      ),
      TODAY,
    );
    expect(result).toEqual({ startMinutes: 7 * 60 + 5, durationMinutes: 105 });
  });

  it('zwei Einheiten: früheste Uhrzeit, längste Dauer', () => {
    const result = todayTimingSession(
      rowsWith([
        session({ id: 'a', start_time: '17:00', estimated_minutes: 40 }),
        session({ id: 'b', start_time: '07:00', estimated_minutes: 120 }),
      ]),
      TODAY,
    );
    expect(result).toEqual({ startMinutes: 420, durationMinutes: 120 });
  });
});

describe('Schalter „Nahrungsergänzungsmittel anzeigen“', () => {
  it('ohne Wahl: AUS für neue Nutzer, AN mit gespeicherten Supplement-Daten; eigene Wahl gewinnt', () => {
    expect(supplementsVisible(null, false)).toBe(false);
    expect(supplementsVisible(null, true)).toBe(true);
    expect(supplementsVisible(false, true)).toBe(false);
    expect(supplementsVisible(true, false)).toBe(true);
  });

  it('gespeicherter Wert: gültig gelesen, ungültig → noch nicht gewählt', () => {
    expect(parseSupplementPrefs({ visible: true })).toEqual({ visible: true });
    expect(parseSupplementPrefs({ visible: 'ja' })).toEqual({ visible: null });
    expect(parseSupplementPrefs(null)).toEqual({ visible: null });
  });
});

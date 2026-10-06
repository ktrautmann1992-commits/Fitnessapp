import { describe, expect, it } from 'vitest';

import { rowsWith, USER_ID } from '../test/fixtures';
import {
  closeMissedSessionRows,
  deleteSessionLogRows,
  detachLogs,
  logEntriesFromRows,
  mergeLogRows,
} from './log-rows';
import type { PlannedSessionRow, SessionLogRow, UserPlanRow, UserRows } from './types';

/** Tagebuch als Zeilen (Testmodus wie die Datenbank): Löschen, Verweise, verpasste Einheiten, Progression. */

function plan(id: string, status: 'active' | 'replaced' = 'active'): UserPlanRow {
  return { id, user_id: USER_ID, status, uses_health_data: false } as UserPlanRow;
}

function session(id: string, date: string, overrides: Partial<PlannedSessionRow> = {}) {
  return {
    id,
    plan_id: 'p1',
    user_id: USER_ID,
    scheduled_on: date,
    original_date: null,
    status: 'planned',
    kind: 'strength',
    ...overrides,
  } as PlannedSessionRow;
}

function log(id: string, sessionId: string | null, date: string): SessionLogRow {
  return {
    id,
    user_id: USER_ID,
    planned_session_id: sessionId,
    kind: 'strength',
    performed_on: date,
    started_at: null,
    finished_at: `${date}T18:00:00Z`,
    status: 'completed',
    session_rpe: null,
    notes: null,
    name_de: 'A',
    is_intro_week: false,
    is_deload: false,
    from_health_plan: false,
    revision: 1,
    last_write_id: 'w',
    source: 'manual',
    client_updated_at: `${date}T18:00:00Z`,
    created_at: `${date}T18:00:00Z`,
    updated_at: `${date}T18:00:00Z`,
  };
}

function base(): UserRows {
  return rowsWith({
    plans: [plan('p1')],
    plannedSessions: [
      session('mo', '2026-10-05', { status: 'completed' }),
      session('mi', '2026-10-07'),
      session('alt', '2026-09-28'),
    ],
    sessionLogs: [log('l1', 'mo', '2026-10-05')],
    exerciseLogs: [
      {
        id: 'e1',
        session_log_id: 'l1',
        user_id: USER_ID,
        order_no: 1,
        planned_exercise_id: 'pe-weg',
        exercise_id: 'goblet-kniebeuge',
        exercise_name_de: 'Goblet',
        load_type: 'weight',
        status: 'done',
        target_sets: 3,
        reps_min: 8,
        reps_max: 12,
        target_reps: 8,
        target_extra_set: false,
        target_weight_kg: 20,
        target_duration_s: null,
        target_rpe: 7,
        state_weight_kg: 20,
        state_target_reps: 8,
        state_extra_set: false,
        state_duration_s: null,
        weight_confirmed: false,
        is_return: false,
      },
    ],
    setLogs: [
      {
        exercise_log_id: 'e1',
        user_id: USER_ID,
        set_no: 2,
        reps: 8,
        weight_kg: 20,
        duration_s: null,
        rpe: 8,
        done: true,
      },
      {
        exercise_log_id: 'e1',
        user_id: USER_ID,
        set_no: 1,
        reps: 9,
        weight_kg: 20,
        duration_s: null,
        rpe: null,
        done: true,
      },
    ],
  });
}

describe('log-rows', () => {
  it('Löschen: Kaskade; Einheit wieder geplant, wenn Woche läuft und Tag frei – sonst gestrichen', () => {
    const rows = deleteSessionLogRows(base(), 'l1', '2026-10-06');
    expect(rows.sessionLogs).toHaveLength(0);
    expect(rows.exerciseLogs).toHaveLength(0);
    expect(rows.setLogs).toHaveLength(0);
    expect(rows.plannedSessions.find((s) => s.id === 'mo')?.status).toBe('planned');
    const later = deleteSessionLogRows(base(), 'l1', '2026-10-12');
    expect(later.plannedSessions.find((s) => s.id === 'mo')?.status).toBe('skipped');
    const taken = deleteSessionLogRows(
      { ...base(), plannedSessions: [...base().plannedSessions, session('neu', '2026-10-05')] },
      'l1',
      '2026-10-06',
    );
    expect(taken.plannedSessions.find((s) => s.id === 'mo')?.status).toBe('skipped');
  });

  it('Verweise auf gelöschte Einheiten/Übungen werden leer, Einträge bleiben (B2)', () => {
    const rows = detachLogs({ ...base(), plannedSessions: [] });
    expect(rows.sessionLogs[0]?.planned_session_id).toBeNull();
    expect(rows.exerciseLogs[0]?.planned_exercise_id).toBeNull();
    expect(rows.setLogs).toHaveLength(2);
  });

  it('close_missed_sessions: nur aktiver Plan, nur geplant, nur nach Wochenende', () => {
    const rows = closeMissedSessionRows(base(), '2026-10-07');
    expect(rows.plannedSessions.find((s) => s.id === 'alt')?.status).toBe('skipped');
    expect(rows.plannedSessions.find((s) => s.id === 'mi')?.status).toBe('planned');
    expect(rows.plannedSessions.find((s) => s.id === 'mo')?.status).toBe('completed');
    const replaced = { ...base(), plans: [plan('p1', 'replaced')] };
    expect(closeMissedSessionRows(replaced, '2026-10-07')).toBe(replaced);
  });

  it('Einträge → Progression: Sätze sortiert, Zustand aus state_*, ausgeschlossener Eintrag fehlt', () => {
    const [entry] = logEntriesFromRows(base());
    expect(entry).toMatchObject({
      exerciseId: 'goblet-kniebeuge',
      performedOn: '2026-10-05',
      state: { weightKg: 20, targetReps: 8, extraSet: false, durationS: null },
      targetWeightKg: 20,
    });
    expect(entry?.sets.map((s) => s.reps)).toEqual([9, 8]);
    expect(logEntriesFromRows(base(), 'l1')).toEqual([]);
  });

  it('Zusammenführen ohne Dubletten (12 Wochen + recent_exercise_logs)', () => {
    const a = base();
    const merged = mergeLogRows(a, { ...a, cardioLogs: [] });
    expect(merged.sessionLogs).toHaveLength(1);
    expect(merged.setLogs).toHaveLength(2);
  });
});

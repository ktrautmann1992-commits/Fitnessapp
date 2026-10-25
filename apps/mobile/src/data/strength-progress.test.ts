import { describe, expect, it } from 'vitest';

import { USER_ID } from '../test/fixtures';
import type { LogRows } from './log-rows';
import {
  exerciseStrengthSessions,
  logStrengthComparisons,
  strengthTileItems,
} from './strength-progress';
import type { ExerciseLogRow, SessionLogRow, SetLogRow } from './types';

/** Kraft-Entwicklung (25.10.2026): Abbildung der Tagebuch-Zeilen auf packages/core (`strength-progress.ts`). */

function log(id: string, date: string, extra: Partial<SessionLogRow> = {}): SessionLogRow {
  return {
    id,
    user_id: USER_ID,
    planned_session_id: null,
    kind: 'strength',
    performed_on: date,
    started_at: null,
    finished_at: `${date}T18:30:00Z`,
    status: 'completed',
    session_rpe: null,
    notes: null,
    name_de: `Einheit ${id}`,
    is_intro_week: false,
    is_deload: false,
    from_health_plan: false,
    is_free: false,
    revision: 1,
    last_write_id: 'w',
    source: 'manual',
    client_updated_at: `${date}T18:00:00Z`,
    created_at: `${date}T18:00:00Z`,
    updated_at: `${date}T18:00:00Z`,
    ...extra,
  };
}

function exercise(id: string, logId: string, extra: Partial<ExerciseLogRow> = {}): ExerciseLogRow {
  return {
    id,
    session_log_id: logId,
    user_id: USER_ID,
    order_no: 1,
    planned_exercise_id: null,
    exercise_id: 'kniebeuge',
    exercise_name_de: 'Kniebeuge',
    load_type: 'weight',
    status: 'done',
    target_sets: null,
    reps_min: null,
    reps_max: null,
    target_reps: null,
    target_extra_set: null,
    target_weight_kg: null,
    target_duration_s: null,
    target_rpe: null,
    state_weight_kg: null,
    state_target_reps: null,
    state_extra_set: null,
    state_duration_s: null,
    weight_confirmed: false,
    is_return: false,
    ...extra,
  };
}

function set(exerciseId: string, no: number, kg: number | null, reps = 8): SetLogRow {
  return {
    exercise_log_id: exerciseId,
    user_id: USER_ID,
    set_no: no,
    reps,
    weight_kg: kg,
    duration_s: null,
    rpe: null,
    done: true,
  };
}

function rows(): LogRows {
  return {
    sessionLogs: [
      log('a', '2026-09-20'),
      log('b', '2026-10-04', { is_deload: true }),
      log('c', '2026-10-18'),
    ],
    exerciseLogs: [
      exercise('a1', 'a'),
      exercise('b1', 'b'),
      exercise('c1', 'c'),
      exercise('c2', 'c', {
        order_no: 2,
        exercise_id: 'liegestuetz',
        exercise_name_de: 'Liegestütz',
        load_type: 'bodyweight',
      }),
      exercise('c3', 'c', { order_no: 3, exercise_id: 'rudern', status: 'skipped' }),
    ],
    setLogs: [
      set('a1', 1, 60),
      set('a1', 2, 60),
      set('b1', 1, 48),
      set('c1', 1, 65),
      set('c1', 2, 65),
      set('c2', 1, null, 12),
    ],
    cardioLogs: [],
  };
}

describe('Kraft-Entwicklung aus den Tagebuch-Zeilen', () => {
  it('Einheiten einer Übung chronologisch, Erholungswoche gekennzeichnet', () => {
    const sessions = exerciseStrengthSessions(rows(), 'kniebeuge');
    expect(sessions.map((s) => [s.performedOn, s.topWeightKg, s.isDeload])).toEqual([
      ['2026-09-20', 60, false],
      ['2026-10-04', 48, true],
      ['2026-10-18', 65, false],
    ]);
  });

  it('Eintrag: „+5 kg gegenüber vor 4 Wochen“ je Übung; Erholungswoche „bewusst leichter“; ohne Bezug nichts', () => {
    const c = logStrengthComparisons(rows(), 'c');
    expect(c.get('c1')).toMatchObject({ kind: 'change', delta: 5, weeksAgo: 4 });
    expect(c.get('c2')).toEqual({ kind: 'none' });
    expect(c.has('c3')).toBe(false);
    expect(logStrengthComparisons(rows(), 'b').get('b1')).toEqual({ kind: 'deload' });
    expect(logStrengthComparisons(rows(), 'gibt-es-nicht').size).toBe(0);
  });

  it('Kachel: Übungen mit mindestens 2 Einheiten, mit Namen aus dem neuesten Eintrag', () => {
    const items = strengthTileItems(rows(), '2026-10-25');
    expect(items.map((i) => [i.exerciseId, i.name, i.sessions])).toEqual([
      ['kniebeuge', 'Kniebeuge', 3],
    ]);
    expect(strengthTileItems({ ...rows(), exerciseLogs: [], setLogs: [] }, '2026-10-25')).toEqual(
      [],
    );
  });
});

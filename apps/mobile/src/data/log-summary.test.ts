import { describe, expect, it } from 'vitest';

import { USER_ID } from '../test/fixtures';
import type { LogRows } from './log-rows';
import {
  historyExercises,
  historyLogRows,
  logDetail,
  logRowsSince,
  summaryInputs,
  summaryLogs,
} from './log-summary';
import type {
  CardioLogRow,
  ExerciseLogRow,
  PlannedSessionRow,
  SessionLogRow,
  SetLogRow,
  UserPlanRow,
} from './types';

/** Woche und Verlauf (Etappe D): Abbildung der Zeilen auf die Eingaben aus packages/core. */

function log(id: string, date: string, extra: Partial<SessionLogRow> = {}): SessionLogRow {
  return {
    id,
    user_id: USER_ID,
    planned_session_id: null,
    kind: 'strength',
    performed_on: date,
    started_at: null,
    finished_at: null,
    status: 'completed',
    session_rpe: null,
    notes: null,
    name_de: `Einheit ${id}`,
    is_intro_week: false,
    is_deload: false,
    from_health_plan: false,
    revision: 1,
    last_write_id: 'w',
    source: 'manual',
    client_updated_at: `${date}T18:00:00Z`,
    created_at: `${date}T18:00:00Z`,
    updated_at: `${date}T18:00:00Z`,
    ...extra,
  };
}

function exercise(
  id: string,
  logId: string,
  order: number,
  extra: Partial<ExerciseLogRow> = {},
): ExerciseLogRow {
  return {
    id,
    session_log_id: logId,
    user_id: USER_ID,
    order_no: order,
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

function set(exerciseId: string, no: number, done = true): SetLogRow {
  return {
    exercise_log_id: exerciseId,
    user_id: USER_ID,
    set_no: no,
    reps: 10,
    weight_kg: 20,
    duration_s: null,
    rpe: null,
    done,
  };
}

const cardio: CardioLogRow = {
  session_log_id: 'run',
  user_id: USER_ID,
  modality: 'run',
  duration_s: 1800,
  distance_m: 5000,
  elevation_m: null,
};

function rows(): LogRows {
  return {
    sessionLogs: [
      log('a', '2026-10-05', { planned_session_id: 's1' }),
      log('run', '2026-10-07', { kind: 'endurance' }),
      log('alt', '2026-06-01'),
    ],
    exerciseLogs: [
      exercise('e2', 'a', 2, { exercise_id: 'rudern', exercise_name_de: 'Rudern' }),
      exercise('e1', 'a', 1),
      exercise('e3', 'a', 3, { exercise_id: 'plank', status: 'skipped' }),
      exercise('alt-e', 'alt', 1, { exercise_name_de: 'Kniebeuge (alt)' }),
    ],
    setLogs: [set('e1', 2), set('e1', 1), set('e1', 3, false), set('e2', 1), set('alt-e', 1)],
    cardioLogs: [cardio],
  };
}

describe('summaryInputs / summaryLogs', () => {
  it('abgehakte Sätze je Eintrag, Ausdauer-Summen, aktiver Plan', () => {
    const logs = summaryLogs(rows());
    expect(logs.find((l) => l.id === 'a')).toMatchObject({
      done_sets: 3,
      planned_session_id: 's1',
    });
    expect(logs.find((l) => l.id === 'run')).toMatchObject({
      cardio_duration_s: 1800,
      cardio_distance_m: 5000,
      done_sets: 0,
    });
    const input = summaryInputs({
      ...rows(),
      plans: [
        { id: 'p1', status: 'active' } as UserPlanRow,
        { id: 'p0', status: 'replaced' } as UserPlanRow,
      ],
      plannedSessions: [
        { id: 's1', plan_id: 'p1', scheduled_on: '2026-10-05', status: 'completed' },
        { id: 's0', plan_id: 'p0', scheduled_on: '2026-10-06', status: 'planned' },
      ] as PlannedSessionRow[],
    });
    expect(input.sessions.map((s) => [s.id, s.plan_active])).toEqual([
      ['s1', true],
      ['s0', false],
    ]);
  });
});

describe('Verlauf: vollständiger Zeitraum + nachgeladene ältere Einträge', () => {
  it('logRowsSince nimmt nur Einträge ab dem Datum samt Übungen und Sätzen', () => {
    const recent = logRowsSince(rows(), '2026-09-01');
    expect(recent.sessionLogs.map((l) => l.id)).toEqual(['a', 'run']);
    expect(recent.exerciseLogs.some((e) => e.id === 'alt-e')).toBe(false);
    expect(recent.setLogs.some((s) => s.exercise_log_id === 'alt-e')).toBe(false);
    expect(recent.cardioLogs).toHaveLength(1);
  });

  it('ohne Grenze (Testmodus) alles; mit Grenze plus nachgeladene, ohne Dubletten', () => {
    expect(historyLogRows(rows(), rows(), null).sessionLogs).toHaveLength(3);
    const older: LogRows = {
      sessionLogs: [log('alt', '2026-06-01')],
      exerciseLogs: [exercise('alt-e', 'alt', 1)],
      setLogs: [set('alt-e', 1)],
      cardioLogs: [],
    };
    const merged = historyLogRows(rows(), older, '2026-09-01');
    expect(merged.sessionLogs.map((l) => l.id).sort()).toEqual(['a', 'alt', 'run']);
    expect(merged.setLogs.filter((s) => s.exercise_log_id === 'alt-e')).toHaveLength(1);
  });
});

describe('logDetail und historyExercises', () => {
  it('Übungen nach Reihenfolge, Sätze nach Nummer, Ausdauer', () => {
    const detail = logDetail(rows(), 'a');
    expect(detail?.exercises.map((e) => e.row.id)).toEqual(['e1', 'e2', 'e3']);
    expect(detail?.exercises[0]?.sets.map((s) => s.set_no)).toEqual([1, 2, 3]);
    expect(detail?.cardio).toBeNull();
    expect(logDetail(rows(), 'run')?.cardio?.distance_m).toBe(5000);
    expect(logDetail(rows(), 'fehlt')).toBeNull();
  });

  it('Übungen alphabetisch, Name des neuesten Eintrags, „nicht gemacht“ zählt nicht', () => {
    expect(historyExercises(rows())).toEqual([
      { exerciseId: 'kniebeuge', name: 'Kniebeuge', count: 2, lastOn: '2026-10-05' },
      { exerciseId: 'rudern', name: 'Rudern', count: 1, lastOn: '2026-10-05' },
    ]);
  });
});

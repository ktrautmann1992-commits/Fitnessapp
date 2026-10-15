import { dayEvaluation, type Exercise, type PlanLibrary } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { rowsWith, USER_ID } from '../test/fixtures';
import { dayAchievementInputs, dayExerciseNames, dayTrainingItems } from './day-evaluation';
import type {
  CardioLogRow,
  ExerciseLogRow,
  PlannedSessionRow,
  SessionLogRow,
  SetLogRow,
  UserPlanRow,
} from './types';

/** „Dein Tag“ (Etappe A2): Abbildung der Zeilen auf dayEvaluation()/sessionAchievement() aus packages/core. */

const DAY = '2026-10-13';
const TODAY = '2026-10-15';

function log(id: string, extra: Partial<SessionLogRow> = {}): SessionLogRow {
  return {
    id,
    user_id: USER_ID,
    planned_session_id: null,
    kind: 'strength',
    performed_on: DAY,
    started_at: null,
    finished_at: null,
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
    client_updated_at: `${DAY}T18:00:00Z`,
    created_at: `${DAY}T18:00:00Z`,
    updated_at: `${DAY}T18:00:00Z`,
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
    target_sets: 3,
    reps_min: 8,
    reps_max: 12,
    target_reps: 10,
    target_extra_set: false,
    target_weight_kg: 50,
    target_duration_s: null,
    target_rpe: 8,
    state_weight_kg: null,
    state_target_reps: null,
    state_extra_set: null,
    state_duration_s: null,
    weight_confirmed: false,
    is_return: false,
    ...extra,
  };
}

function set(exerciseId: string, no: number, weight: number, done = true): SetLogRow {
  return {
    exercise_log_id: exerciseId,
    user_id: USER_ID,
    set_no: no,
    reps: 10,
    weight_kg: weight,
    duration_s: null,
    rpe: null,
    done,
  };
}

function planned(id: string, extra: Partial<PlannedSessionRow> = {}): PlannedSessionRow {
  return {
    id,
    plan_id: 'p1',
    user_id: USER_ID,
    block_no: 1,
    week_no: 1,
    scheduled_on: DAY,
    original_date: null,
    status: 'completed',
    kind: 'strength',
    focus: 'full_body',
    name_de: `Geplant ${id}`,
    estimated_minutes: 45,
    effort_target: null,
    endurance_modality: null,
    is_deload: false,
    is_intro_week: false,
    template_day_index: 0,
    warmup_de: '',
    cooldown_de: '',
    updated_at: `${DAY}T08:00:00Z`,
    ...extra,
  } as PlannedSessionRow;
}

const library: PlanLibrary = {
  exercises: new Map([
    [
      'kniebeuge',
      { id: 'kniebeuge', load_type: 'weight', equipment_ids: ['barbell'] } as unknown as Exercise,
    ],
  ]),
  templates: [],
  containsDrafts: false,
};

function rows() {
  return rowsWith({
    plans: [{ id: 'p1', status: 'active', inputs: {} } as unknown as UserPlanRow],
    plannedSessions: [
      planned('s1'),
      planned('s2', { status: 'planned', scheduled_on: '2026-10-14', name_de: 'Morgen' }),
      planned('run', {
        kind: 'endurance',
        estimated_minutes: 30,
        effort_target: 3,
        endurance_modality: 'run',
        scheduled_on: DAY,
        status: 'completed',
        focus: null,
      }),
    ],
    sessionLogs: [
      log('a', { planned_session_id: 's1', is_deload: true }),
      log('r', { planned_session_id: 'run', kind: 'endurance', session_rpe: 7 }),
      log('f', { is_free: true, name_de: 'Freie Kraft-Einheit' }),
    ],
    exerciseLogs: [
      exercise('e2', 'a', 2, {
        exercise_id: 'rudern',
        exercise_name_de: 'Rudern',
        target_weight_kg: 30,
      }),
      exercise('e1', 'a', 1),
      exercise('fe', 'f', 1, {
        target_sets: null,
        target_weight_kg: null,
        reps_min: null,
        target_reps: null,
      }),
    ],
    setLogs: [
      set('e1', 2, 47.5),
      set('e1', 1, 50),
      set('e1', 3, 45),
      set('e2', 1, 30),
      set('e2', 2, 30),
      set('e2', 3, 30, false),
      set('fe', 1, 20),
    ],
    cardioLogs: [
      {
        session_log_id: 'r',
        user_id: USER_ID,
        modality: 'run',
        duration_s: 34 * 60,
        distance_m: 6000,
        elevation_m: null,
      } as CardioLogRow,
    ],
  });
}

describe('dayTrainingItems', () => {
  it('Einträge des Tages (geplant, Ausdauer, frei) – wie in „Woche“', () => {
    const items = dayTrainingItems(rows(), DAY, TODAY);
    expect(items.map((i) => [i.logId, i.status, i.free])).toEqual(
      expect.arrayContaining([
        ['a', 'done', false],
        ['r', 'done', false],
        ['f', 'done', true],
      ]),
    );
    expect(items).toHaveLength(3);
    expect(dayTrainingItems(rows(), '2026-10-14', TODAY).map((i) => i.status)).toEqual(['missed']);
  });
});

describe('dayAchievementInputs', () => {
  it('Kraft: Vorgaben aus dem Schnappschuss, Sätze sortiert, Langhantel aus der Bibliothek', () => {
    const inputs = dayAchievementInputs(rows(), DAY, library);
    const a = inputs.get('a');
    expect(a?.kind).toBe('strength');
    if (a?.kind !== 'strength') return;
    expect(a.easyWeek).toBe('recovery');
    expect(a.exercises.map((e) => e.incrementKind)).toEqual(['barbell', null]);
    expect(a.exercises[0]?.sets.map((s) => s.weightKg)).toEqual([50, 47.5, 45]);
    expect(dayExerciseNames(rows(), 'a')).toEqual(['Kniebeuge', 'Rudern']);
  });

  it('ohne Bibliothek: keine Stufe darunter (nur die Vorgabe zählt)', () => {
    const a = dayAchievementInputs(rows(), DAY, null).get('a');
    expect(a?.kind === 'strength' && a.exercises.map((e) => e.incrementKind)).toEqual([null, null]);
  });

  it('Ausdauer: geplante Minuten und Anstrengung aus der geplanten Einheit', () => {
    expect(dayAchievementInputs(rows(), DAY, library).get('r')).toEqual({
      kind: 'endurance',
      isFree: false,
      easyWeek: null,
      plannedMinutes: 30,
      effortTarget: 3,
      durationS: 34 * 60,
      distanceM: 6000,
      sessionRpe: 7,
    });
  });

  it('zusammen mit dayEvaluation: Langhantel 47,5 zählt (eine Stufe), 45 nicht; Rudern 2/3', () => {
    const r = rows();
    const evaluation = dayEvaluation({
      date: DAY,
      today: TODAY,
      showNumbers: true,
      targets: null,
      foodLog: { available: false, entries: [] },
      mealPlan: null,
      trainingItems: dayTrainingItems(r, DAY, TODAY),
      achievements: dayAchievementInputs(r, DAY, library),
    });
    const byLog = new Map(evaluation.training.items.map((i) => [i.item.logId, i.achievement]));
    expect(byLog.get('a')).toMatchObject({ percent: 66, level: 'mostly', easyWeek: 'recovery' });
    expect(byLog.get('a')?.exercises.map((e) => e.fulfilledSets)).toEqual([2, 2]);
    expect(byLog.get('r')).toMatchObject({
      percent: 100,
      hints: ['effort_above_plan', 'longer_than_planned'],
    });
    expect(byLog.get('f')).toMatchObject({ percent: null, level: 'done' });
  });
});

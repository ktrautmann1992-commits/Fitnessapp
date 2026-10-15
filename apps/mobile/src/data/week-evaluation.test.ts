import {
  type MealPlanWeek,
  nutritionTargetsForWeek,
  type NutritionWeekTargets,
  weekEvaluation,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { rowsWith, USER_ID } from '../test/fixtures';
import type {
  ExerciseLogRow,
  FoodLogEntryRow,
  PlannedExerciseRow,
  PlannedSessionRow,
  SessionLogRow,
  SetLogRow,
  UserPlanRow,
} from './types';
import {
  firstCompleteWeek,
  weekEvaluationInput,
  weekEvaluationNavigation,
  weekPlannedTargets,
} from './week-evaluation';

/** Wochenauswertung (Etappe A3): Abbildung der Zeilen auf weekEvaluation() aus packages/core. */

const MONDAY = '2026-10-12';
const TODAY = '2026-10-15';

function planned(id: string, extra: Partial<PlannedSessionRow> = {}): PlannedSessionRow {
  return {
    id,
    plan_id: 'p1',
    user_id: USER_ID,
    block_no: 1,
    week_no: 1,
    scheduled_on: MONDAY,
    original_date: null,
    status: 'planned',
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
    updated_at: `${MONDAY}T08:00:00Z`,
    ...extra,
  } as PlannedSessionRow;
}

function plannedExercise(id: string, sessionId: string, sets: number): PlannedExerciseRow {
  return { id, session_id: sessionId, sets } as unknown as PlannedExerciseRow;
}

function log(id: string, extra: Partial<SessionLogRow> = {}): SessionLogRow {
  return {
    id,
    user_id: USER_ID,
    planned_session_id: null,
    kind: 'strength',
    performed_on: MONDAY,
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
    client_updated_at: `${MONDAY}T18:00:00Z`,
    created_at: `${MONDAY}T18:00:00Z`,
    updated_at: `${MONDAY}T18:00:00Z`,
    ...extra,
  } as SessionLogRow;
}

function exercise(id: string, logId: string): ExerciseLogRow {
  return {
    id,
    session_log_id: logId,
    user_id: USER_ID,
    order_no: 1,
    planned_exercise_id: null,
    exercise_id: 'liegestuetz',
    exercise_name_de: 'Liegestütz',
    load_type: 'bodyweight',
    status: 'done',
    target_sets: 3,
    reps_min: 8,
    reps_max: 12,
    target_reps: 10,
    target_extra_set: false,
    target_weight_kg: null,
    target_duration_s: null,
    target_rpe: 8,
    state_weight_kg: null,
    state_target_reps: null,
    state_extra_set: null,
    state_duration_s: null,
    weight_confirmed: false,
    is_return: false,
  } as ExerciseLogRow;
}

function set(exerciseId: string, no: number, done = true): SetLogRow {
  return {
    exercise_log_id: exerciseId,
    user_id: USER_ID,
    set_no: no,
    reps: 10,
    weight_kg: null,
    duration_s: null,
    rpe: null,
    done,
  };
}

function food(id: string, date: string, kcal: number | null, slot = 'other'): FoodLogEntryRow {
  return {
    id,
    eaten_on: date,
    source: slot === 'other' ? 'quick' : 'plan_item',
    slot,
    kcal,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    created_at: `${date}T12:00:00Z`,
  } as unknown as FoodLogEntryRow;
}

function targets(): NutritionWeekTargets {
  return nutritionTargetsForWeek(
    {
      today: MONDAY,
      birthDate: '1990-01-01',
      sex: 'male',
      goalType: 'general_fitness',
      experienceLevel: 'beginner',
      healthDataConsent: true,
      bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 180, weightKg: 80 }],
      healthFlags: { flags: [] },
      activityLevel: 'sedentary',
      sessions: [],
    },
    MONDAY,
  );
}

function mealPlan(): MealPlanWeek {
  return {
    days: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-10-${String(12 + i).padStart(2, '0')}`,
      status: i === 1 ? 'below_floor' : 'ok',
      meals: [{ slot: 'breakfast' }, { slot: 'lunch' }],
    })),
  } as unknown as MealPlanWeek;
}

function rows() {
  return rowsWith({
    plans: [{ id: 'p1', status: 'active', inputs: {} } as unknown as UserPlanRow],
    plannedSessions: [
      planned('s1', { status: 'completed' }),
      planned('s2', { scheduled_on: '2026-10-14', is_deload: true }),
      planned('run', {
        kind: 'endurance',
        estimated_minutes: 30,
        scheduled_on: '2026-10-16',
        focus: null,
      }),
      planned('other-week', { scheduled_on: '2026-10-20' }),
    ],
    plannedExercises: [
      plannedExercise('pe1', 's1', 3),
      plannedExercise('pe2', 's1', 2),
      plannedExercise('pe3', 's2', 4),
      plannedExercise('pe4', 'other-week', 9),
    ],
    sessionLogs: [
      log('a', { planned_session_id: 's1' }),
      log('f', { is_free: true, performed_on: '2026-10-13', name_de: 'Freie Kraft-Einheit' }),
    ],
    exerciseLogs: [exercise('e1', 'a'), { ...exercise('fe', 'f'), target_sets: null }],
    setLogs: [set('e1', 1), set('e1', 2), set('e1', 3, false), set('fe', 1)],
    foodLogEntries: [
      food('x1', MONDAY, 300),
      food('x2', '2026-10-13', 200),
      food('x3', '2026-10-14', 100),
      food('x4', '2026-10-15', 2500),
      food('x5', '2026-10-05', 900),
      food('x6', MONDAY, null, 'breakfast'),
    ],
  });
}

describe('weekPlannedTargets', () => {
  it('Summe der Vorgabe-Sätze, geplante Minuten, Erholungswoche – nur Einheiten dieser Woche', () => {
    const map = weekPlannedTargets(rows(), MONDAY);
    expect([...map.keys()].sort()).toEqual(['run', 's1', 's2']);
    expect(map.get('s1')).toEqual({ strengthSets: 5, enduranceMinutes: null, easyWeek: null });
    expect(map.get('s2')).toEqual({
      strengthSets: 4,
      enduranceMinutes: null,
      easyWeek: 'recovery',
    });
    expect(map.get('run')).toEqual({ strengthSets: null, enduranceMinutes: 30, easyWeek: null });
  });

  it('Einstiegswoche', () => {
    const r = rowsWith({ plannedSessions: [planned('i', { is_intro_week: true })] });
    expect(weekPlannedTargets(r, MONDAY).get('i')?.easyWeek).toBe('intro');
  });
});

describe('firstCompleteWeek', () => {
  it('Testmodus: alles auf dem Gerät', () => {
    expect(firstCompleteWeek(null)).toBeNull();
  });
  it('Supabase: Montag bleibt, sonst die Woche danach', () => {
    expect(firstCompleteWeek('2026-07-20')).toBe('2026-07-20');
    expect(firstCompleteWeek('2026-07-23')).toBe('2026-07-27');
  });
});

describe('weekEvaluationNavigation', () => {
  const bounds = { first: '2026-09-28', last: '2026-10-26' };
  it('in den Grenzen wie weekPager', () => {
    expect(weekEvaluationNavigation('2026-10-14', bounds, null)).toEqual({
      tooOld: false,
      previous: '2026-10-05',
      next: '2026-10-19',
    });
    expect(weekEvaluationNavigation('2026-09-28', bounds, null).previous).toBeNull();
    expect(weekEvaluationNavigation('2026-10-26', bounds, null).next).toBeNull();
  });
  it('zu alt für den Gerätespeicher: nicht geklemmt, Weg nach vorn', () => {
    expect(weekEvaluationNavigation('2026-07-06', bounds, '2026-07-27')).toEqual({
      tooOld: true,
      previous: null,
      next: '2026-07-27',
    });
    expect(
      weekEvaluationNavigation('2026-07-27', { ...bounds, first: '2026-07-27' }, '2026-07-27')
        .tooOld,
    ).toBe(false);
  });
  it('außerhalb der Grenzen (ohne Gerätespeicher-Grenze): Weg zurück in die Grenzen', () => {
    expect(weekEvaluationNavigation('2026-12-07', bounds, null)).toEqual({
      tooOld: false,
      previous: '2026-10-26',
      next: null,
    });
    expect(weekEvaluationNavigation('2026-01-05', bounds, null)).toEqual({
      tooOld: false,
      previous: null,
      next: '2026-09-28',
    });
  });
});

describe('weekEvaluationInput', () => {
  const base = {
    weekStart: '2026-10-14',
    today: TODAY,
    showNumbers: true,
    foodLogAvailable: true,
    library: null,
  } as const;

  it('Mo–So, Einträge je Tag, Ziele je Tag, Erfüllungsgrad aus allen Tagen', () => {
    const input = weekEvaluationInput({ ...base, rows: rows(), nutrition: null });
    expect(input.weekStart).toBe(MONDAY);
    expect(input.days.map((d) => d.date)).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
    expect(input.days[0]?.foodLog.entries.map((e) => e.kcal).sort()).toEqual([300, null].sort());
    expect(input.days.every((d) => d.targets === null && d.mealPlan === null)).toBe(true);
    expect([...input.achievements.keys()].sort()).toEqual(['a', 'f']);
    expect(input.plannedTargets.get('s1')?.strengthSets).toBe(5);
  });

  it('ohne Tagebuch (Einwilligung/Betriebsart): keine Einträge', () => {
    const input = weekEvaluationInput({
      ...base,
      rows: rows(),
      nutrition: null,
      foodLogAvailable: false,
    });
    expect(input.days.every((d) => !d.foodLog.available && d.foodLog.entries.length === 0)).toBe(
      true,
    );
  });

  it('Essensplan nur gespeichert – oder laufende Woche ab heute (Wächter A2 S1)', () => {
    const nutrition = (planStored: boolean, weekEditable: boolean) =>
      weekEvaluationInput({
        ...base,
        rows: rows(),
        nutrition: { targets: targets(), plan: mealPlan(), planStored, weekEditable },
      });
    const stored = nutrition(true, false);
    expect(stored.days.every((d) => d.mealPlan !== null)).toBe(true);
    expect(stored.days[1]?.mealPlan).toEqual({ slots: ['breakfast', 'lunch'], belowFloor: true });
    expect(stored.days.every((d) => d.targets?.date === d.date)).toBe(true);
    const editable = nutrition(false, true);
    expect(editable.days.map((d) => d.mealPlan !== null)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(nutrition(false, false).days.every((d) => d.mealPlan === null)).toBe(true);
  });

  it('zusammen mit weekEvaluation: Training und Essen der Woche', () => {
    const r = weekEvaluation(
      weekEvaluationInput({
        ...base,
        rows: rows(),
        nutrition: { targets: targets(), plan: mealPlan(), planStored: true, weekEditable: false },
      }),
    );
    expect(r.training.sessions).toEqual({ done: 1, planned: 3 });
    // s1: 2 von 3 erfüllt (Schnappschuss), s2 offen mit 4 geplanten Sätzen.
    expect(r.training.strengthSets).toEqual({ fulfilled: 2, planned: 7, done: 2 });
    expect(r.training.enduranceMinutes.planned).toBe(30);
    expect(r.training.free.map((f) => f.item.logId)).toEqual(['f']);
    expect(r.easyWeek).toBe('recovery');
    if (r.food.kind !== 'numbers') throw new Error('Zahlen erwartet');
    // Mo, Di, Mi vergangen und sehr wenig → Muster-Hinweis; Do (heute) zählt nicht.
    expect(r.food).toMatchObject({
      entryDays: 3,
      valuedDays: 3,
      belowFloorDays: 3,
      patternNotice: true,
      todayOpen: true,
    });
    // Nur vergangene Tage (Mo–Mi); heute zählt erst danach (Wächter A3 H1).
    expect(r.food.meals).toEqual({ eaten: 1, planned: 6 });
  });
});

describe('Wächter A3 S1: Eintrag an der Wochengrenze', () => {
  it('Sonntags-Einheit am Montag nachgetragen: Erfüllungsgrad in der Woche des Termins', () => {
    const r = rowsWith({
      plans: [{ id: 'p1', status: 'active', inputs: {} } as unknown as UserPlanRow],
      plannedSessions: [planned('sun', { scheduled_on: '2026-10-18', status: 'completed' })],
      sessionLogs: [log('x', { planned_session_id: 'sun', performed_on: '2026-10-19' })],
      exerciseLogs: [exercise('ex', 'x')],
      setLogs: [set('ex', 1), set('ex', 2), set('ex', 3)],
    });
    const a = weekEvaluation(
      weekEvaluationInput({
        rows: r,
        weekStart: MONDAY,
        today: '2026-10-21',
        showNumbers: true,
        nutrition: null,
        foodLogAvailable: true,
        library: null,
      }),
    );
    expect(a.training.sessions).toEqual({ done: 1, planned: 1 });
    expect(a.training.items[0]).toMatchObject({
      date: '2026-10-18',
      item: { performedOn: '2026-10-19' },
      achievement: { percent: 100 },
    });
    const b = weekEvaluation(
      weekEvaluationInput({
        rows: r,
        weekStart: '2026-10-19',
        today: '2026-10-21',
        showNumbers: true,
        nutrition: null,
        foodLogAvailable: true,
        library: null,
      }),
    );
    expect(b.training.sessions).toEqual({ done: 0, planned: 0 });
    expect(b.training.items).toEqual([]);
  });
});

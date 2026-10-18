import { describe, expect, it } from 'vitest';

import { profile, TODAY, USER_ID } from '../test/fixtures';
import { appendKeepsLoadWeeks, isValidOp } from './local-rules';
import type { WriteOp } from './write-ops';

const ctx = { today: TODAY, profile: profile() };
const metrics = (patch: Record<string, unknown> = {}): WriteOp => ({
  kind: 'upsert_body_metrics',
  row: {
    user_id: USER_ID,
    measured_on: TODAY,
    height_cm: 170,
    weight_kg: 70,
    body_fat_pct: null,
    resting_heart_rate_bpm: null,
    ...patch,
  },
});
const measurements = (patch: Record<string, unknown> = {}): WriteOp => ({
  kind: 'upsert_body_measurements',
  row: {
    user_id: USER_ID,
    measured_on: TODAY,
    upper_arm_left_cm: null,
    upper_arm_right_cm: null,
    chest_cm: null,
    shoulders_cm: null,
    waist_cm: 80,
    abdomen_cm: null,
    thigh_left_cm: null,
    thigh_right_cm: null,
    hip_cm: null,
    calf_left_cm: null,
    calf_right_cm: null,
    ...patch,
  },
});
const goals = (patch: Record<string, unknown> = {}): WriteOp => ({
  kind: 'upsert_goals',
  row: {
    user_id: USER_ID,
    goal_type: 'endurance',
    secondary_goal_type: null,
    discipline: 'marathon',
    target_date: null,
    training_location: 'gym',
    ...patch,
  },
});
const slots = (
  rows: { slot_no: number; weekday: number | null; kind?: string; minutes?: number }[],
  userId = USER_ID,
): WriteOp =>
  ({
    kind: 'replace_training_slots',
    rows: rows.map((row) => ({ user_id: userId, kind: 'endurance', minutes: 30, ...row })),
  }) as WriteOp;

describe('Testmodus spiegelt die Wertebereiche der Datenbank (packages/core)', () => {
  it('Körperdaten: Grenzen genau erlaubt, knapp daneben abgelehnt', () => {
    expect(
      isValidOp(
        metrics({ height_cm: 100, weight_kg: 300, body_fat_pct: 3, resting_heart_rate_bpm: 120 }),
        ctx,
      ),
    ).toBe(true);
    expect(isValidOp(metrics({ height_cm: 99.9 }), ctx)).toBe(false);
    expect(isValidOp(metrics({ weight_kg: 300.1 }), ctx)).toBe(false);
    expect(isValidOp(metrics({ resting_heart_rate_bpm: 29 }), ctx)).toBe(false);
    expect(isValidOp(metrics({ resting_heart_rate_bpm: 60.5 }), ctx)).toBe(false);
  });

  it('Messdatum höchstens heute + 1 Tag', () => {
    expect(isValidOp(metrics({ measured_on: '2026-10-04' }), ctx)).toBe(true);
    expect(isValidOp(metrics({ measured_on: '2026-10-05' }), ctx)).toBe(false);
    expect(isValidOp(measurements({ measured_on: '2026-10-05' }), ctx)).toBe(false);
    expect(isValidOp(measurements({ measured_on: '1899-12-31' }), ctx)).toBe(false);
  });

  it('Körperumfänge: Grenzen je Messstelle, mindestens ein Wert', () => {
    expect(isValidOp(measurements({ waist_cm: 40, calf_left_cm: 80 }), ctx)).toBe(true);
    expect(isValidOp(measurements({ calf_left_cm: 81 }), ctx)).toBe(false);
    expect(isValidOp(measurements({ waist_cm: null }), ctx)).toBe(false);
  });

  it('Ziel: Disziplin nur bei Ausdauer, Ort darf leer sein (nur Ausdauer)', () => {
    expect(isValidOp(goals(), ctx)).toBe(true);
    expect(isValidOp(goals({ training_location: null }), ctx)).toBe(true);
    expect(isValidOp(goals({ training_location: 'garden' }), ctx)).toBe(false);
    expect(isValidOp(goals({ goal_type: 'fat_loss' }), ctx)).toBe(false);
  });

  it('Trainingstage: wie replace_training_slots (1–7, lückenlos, fest ODER „Tag egal“, 10–240 min)', () => {
    expect(isValidOp(slots([{ slot_no: 1, weekday: 1 }]), ctx)).toBe(true);
    expect(
      isValidOp(
        slots([1, 2, 3, 4, 5, 6, 7].map((d) => ({ slot_no: d, weekday: d, minutes: 240 }))),
        ctx,
      ),
    ).toBe(true);
    expect(isValidOp(slots([{ slot_no: 1, weekday: null, minutes: 10 }]), ctx)).toBe(true);
    expect(isValidOp(slots([]), ctx)).toBe(false);
    expect(
      isValidOp(slots([1, 2, 3, 4, 5, 6, 7, 8].map((d) => ({ slot_no: d, weekday: null }))), ctx),
    ).toBe(false);
    expect(isValidOp(slots([{ slot_no: 1, weekday: 1, minutes: 9 }]), ctx)).toBe(false);
    expect(isValidOp(slots([{ slot_no: 1, weekday: 1, minutes: 241 }]), ctx)).toBe(false);
    expect(isValidOp(slots([{ slot_no: 1, weekday: 1, minutes: 45.5 }]), ctx)).toBe(false);
    expect(
      isValidOp(
        slots([
          { slot_no: 1, weekday: 1 },
          { slot_no: 2, weekday: null },
        ]),
        ctx,
      ),
    ).toBe(false);
    expect(
      isValidOp(
        slots([
          { slot_no: 1, weekday: 2 },
          { slot_no: 2, weekday: 2 },
        ]),
        ctx,
      ),
    ).toBe(false);
    expect(isValidOp(slots([{ slot_no: 2, weekday: 2 }]), ctx)).toBe(false);
    expect(isValidOp(slots([{ slot_no: 1, weekday: 2, kind: 'yoga' }]), ctx)).toBe(false);
    expect(isValidOp(slots([{ slot_no: 1, weekday: 2 }], 'fremde-id'), ctx)).toBe(false);
  });

  it('Equipment: Gewichtsstufen 0,25–200 kg, Freitext nur bei „Sonstiges“', () => {
    const op = (
      rows: { equipment_id: string; weights_kg: number[]; note: string | null }[],
    ): WriteOp => ({
      kind: 'replace_user_equipment',
      location: 'home',
      rows: rows.map((row) => ({ user_id: USER_ID, location: 'home', bar_kg: null, ...row })),
    });
    expect(
      isValidOp(op([{ equipment_id: 'dumbbells', weights_kg: [0.25, 200], note: null }]), ctx),
    ).toBe(true);
    expect(isValidOp(op([{ equipment_id: 'dumbbells', weights_kg: [201], note: null }]), ctx)).toBe(
      false,
    );
    expect(isValidOp(op([{ equipment_id: 'flat_bench', weights_kg: [5], note: null }]), ctx)).toBe(
      false,
    );
    expect(isValidOp(op([{ equipment_id: 'other', weights_kg: [], note: null }]), ctx)).toBe(false);
  });

  it('Langhantel: Stange 5–25 kg nur bei der Langhantel, Scheiben höchstens 25 kg', () => {
    const op = (row: { equipment_id: string; weights_kg: number[]; bar_kg: number | null }) =>
      ({
        kind: 'replace_user_equipment',
        location: 'home',
        rows: [{ user_id: USER_ID, location: 'home', note: null, ...row }],
      }) as WriteOp;
    expect(isValidOp(op({ equipment_id: 'barbell', weights_kg: [25], bar_kg: 5 }), ctx)).toBe(true);
    expect(isValidOp(op({ equipment_id: 'barbell', weights_kg: [], bar_kg: 25 }), ctx)).toBe(true);
    expect(isValidOp(op({ equipment_id: 'barbell', weights_kg: [27.5], bar_kg: 20 }), ctx)).toBe(
      false,
    );
    expect(isValidOp(op({ equipment_id: 'barbell', weights_kg: [], bar_kg: 4.5 }), ctx)).toBe(
      false,
    );
    expect(isValidOp(op({ equipment_id: 'dumbbells', weights_kg: [30], bar_kg: 20 }), ctx)).toBe(
      false,
    );
  });

  it('Equipment: Studio-Geräte nicht „zu Hause“ (wie der Datenbank-Trigger)', () => {
    const op = (location: 'home' | 'gym'): WriteOp => ({
      kind: 'replace_user_equipment',
      location,
      rows: [
        {
          user_id: USER_ID,
          location,
          equipment_id: 'cable_station',
          weights_kg: [],
          note: null,
          bar_kg: null,
        },
      ],
    });
    expect(isValidOp(op('home'), ctx)).toBe(false);
    expect(isValidOp(op('gym'), ctx)).toBe(true);
  });

  it('Ernährung: Mahlzeiten 1–8, kein Schwein bei vegan, Meal-Prep-Tage nur bei Meal-Prep', () => {
    const op = (patch: Record<string, unknown>): WriteOp => ({
      kind: 'upsert_nutrition_prefs',
      row: {
        user_id: USER_ID,
        diet_type: 'omnivore',
        eats_pork: true,
        meals_per_day: 8,
        cooking_mode: 'meal_prep',
        mealprep_days: 7,
        ...patch,
      },
    });
    expect(isValidOp(op({}), ctx)).toBe(true);
    expect(isValidOp(op({ meals_per_day: 9 }), ctx)).toBe(false);
    expect(isValidOp(op({ diet_type: 'vegan' }), ctx)).toBe(false);
    expect(isValidOp(op({ cooking_mode: 'daily' }), ctx)).toBe(false);
    expect(isValidOp(op({ cooking_mode: null, mealprep_days: null }), ctx)).toBe(true);
  });

  it('Vorlieben: Art passt zum Bereich, „mag“ und „mag nicht“ schließen sich aus', () => {
    const op = (
      scope: 'taste' | 'intolerance',
      rows: [string, 'like' | 'dislike' | 'intolerance'][],
    ): WriteOp => ({
      kind: 'replace_food_preferences',
      scope,
      rows: rows.map(([food_group, kind]) => ({ user_id: USER_ID, food_group, kind })),
    });
    expect(isValidOp(op('taste', [['fish', 'like']]), ctx)).toBe(true);
    expect(isValidOp(op('taste', [['peanuts', 'intolerance']]), ctx)).toBe(false);
    expect(
      isValidOp(
        op('taste', [
          ['fish', 'like'],
          ['fish', 'dislike'],
        ]),
        ctx,
      ),
    ).toBe(false);
    expect(isValidOp(op('taste', [['unicorn', 'like']]), ctx)).toBe(false);
  });

  it('Profil: Zyklus-Interesse nur bei „weiblich“, Mess-Erinnerung 7–90 Tage', () => {
    expect(
      isValidOp(
        { kind: 'update_profile', patch: { sex: 'male', cycle_module_interest: true } },
        ctx,
      ),
    ).toBe(false);
    expect(
      isValidOp(
        { kind: 'update_profile', patch: { sex: 'female', cycle_module_interest: true } },
        ctx,
      ),
    ).toBe(true);
    expect(isValidOp({ kind: 'update_profile', patch: { onboarding_step: 'wearable' } }, ctx)).toBe(
      false,
    );
    const reminder = (interval_days: number): WriteOp => ({
      kind: 'upsert_measurement_reminder',
      row: { user_id: USER_ID, enabled: true, interval_days, next_due_on: null },
    });
    expect(isValidOp(reminder(7), ctx)).toBe(true);
    expect(isValidOp(reminder(91), ctx)).toBe(false);
  });
});

describe('append_plan_block: höchstens L Belastungswochen in Folge (4b Etappe B, wie der Server)', () => {
  const week = (block: number, weekNo: number, monday: string, deload = false) => ({
    block_no: block,
    week_no: weekNo,
    scheduled_on: monday,
    is_deload: deload,
    is_intro_week: false,
    kind: 'strength',
    estimated_minutes: 45,
  });
  const own = [week(1, 1, '2026-10-05'), week(1, 2, '2026-10-12'), week(1, 3, '2026-10-19')];
  const cautious = {
    inputs: { experienceLevel: 'beginner' },
    uses_health_data: false,
    medical_notice: false,
    start_date: '2026-10-05',
  };
  const beginner = { ...cautious, uses_health_data: true };

  it('vorsichtig (L = 4): 4. Belastungswoche gültig, 5. abgelehnt; Erholungswoche dazwischen gültig', () => {
    expect(appendKeepsLoadWeeks(cautious, own, [week(2, 1, '2026-10-26')])).toBe(true);
    const four = [...own, week(2, 1, '2026-10-26')];
    expect(appendKeepsLoadWeeks(cautious, four, [week(3, 1, '2026-11-02')])).toBe(false);
    expect(
      appendKeepsLoadWeeks(cautious, four, [
        week(3, 1, '2026-11-02', true),
        week(3, 2, '2026-11-09'),
      ]),
    ).toBe(true);
  });

  it('Einsteiger mit Gesundheits-Check (L = 5): 5. Belastungswoche gültig; Woche 0 zählt nicht', () => {
    const four = [...own, week(2, 1, '2026-10-26')];
    expect(appendKeepsLoadWeeks(beginner, four, [week(3, 1, '2026-11-02')])).toBe(true);
    expect(
      appendKeepsLoadWeeks(
        cautious,
        [week(1, 0, '2026-10-04'), ...own],
        [week(2, 1, '2026-10-26')],
      ),
    ).toBe(true);
  });
});

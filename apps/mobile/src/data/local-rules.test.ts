import { describe, expect, it } from 'vitest';

import { profile, TODAY, USER_ID } from '../test/fixtures';
import { isValidOp } from './local-rules';
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
    discipline: 'marathon',
    target_date: null,
    sessions_per_week: 7,
    minutes_per_session: 240,
    preferred_days: [1, 7],
    training_location: 'gym',
    ...patch,
  },
});

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

  it('Ziel und Zeitbudget: 1–7 Tage, 10–240 Minuten, Disziplin nur bei Ausdauer', () => {
    expect(isValidOp(goals(), ctx)).toBe(true);
    expect(isValidOp(goals({ sessions_per_week: 8 }), ctx)).toBe(false);
    expect(isValidOp(goals({ minutes_per_session: 9 }), ctx)).toBe(false);
    expect(isValidOp(goals({ preferred_days: [1, 1] }), ctx)).toBe(false);
    expect(isValidOp(goals({ goal_type: 'fat_loss' }), ctx)).toBe(false);
    expect(
      isValidOp(
        goals({ sessions_per_week: null, minutes_per_session: null, preferred_days: [] }),
        ctx,
      ),
    ).toBe(true);
  });

  it('Equipment: Gewichtsstufen 0,25–200 kg, Freitext nur bei „Sonstiges“', () => {
    const op = (
      rows: { equipment_id: string; weights_kg: number[]; note: string | null }[],
    ): WriteOp => ({
      kind: 'replace_user_equipment',
      location: 'home',
      rows: rows.map((row) => ({ user_id: USER_ID, location: 'home', ...row })),
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

  it('Equipment: Studio-Geräte nicht „zu Hause“ (wie der Datenbank-Trigger)', () => {
    const op = (location: 'home' | 'gym'): WriteOp => ({
      kind: 'replace_user_equipment',
      location,
      rows: [
        { user_id: USER_ID, location, equipment_id: 'cable_station', weights_kg: [], note: null },
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

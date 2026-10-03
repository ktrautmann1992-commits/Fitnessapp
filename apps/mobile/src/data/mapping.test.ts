import { describe, expect, it } from 'vitest';

import { consent, NOW, rowsWith, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import {
  answersFromRows,
  applyStepToAnswers,
  planStepWrites,
  toGoalsRow,
  toNutritionPrefsRow,
  versionsFromDocuments,
  type PlanContext,
} from './mapping';
import { planSave } from './plan-save';
import type { OnboardingAnswers, StepSave, UserRows } from './types';
import { applyWriteOps, isDirectOp, isSensitiveOp } from './write-ops';

function ctx(patch: Partial<PlanContext> = {}): PlanContext {
  return {
    userId: USER_ID,
    answers: {},
    nextStep: 'experience',
    now: NOW,
    platform: 'web',
    versions: VERSIONS,
    hasHealthConsent: true,
    ...patch,
  };
}

const fullAnswers: OnboardingAnswers = {
  goal: { goalType: 'endurance', discipline: 'marathon', targetDate: '2027-04-01' },
  timeBudget: { sessionsPerWeek: 4, minutesPerSession: 60, preferredDays: [5, 1, 3] },
  trainingLocation: 'both',
  nutrition: {
    dietType: 'omnivore',
    eatsPork: false,
    mealsPerDay: 3,
    foodPreferences: [
      { foodGroup: 'fish', kind: 'like' },
      { foodGroup: 'peanuts', kind: 'intolerance' },
    ],
  },
  cooking: { cookingMode: 'meal_prep', mealprepDays: 2 },
};

describe('Onboarding → Tabellenzeilen', () => {
  it('Geschlecht: Zyklus-Interesse nur bei „weiblich“, Fortschritt im selben Update', () => {
    const ops = planStepWrites(
      { step: 'sex', sex: 'male', cycleModuleInterest: true },
      ctx({ nextStep: 'health_consent' }),
    );
    expect(ops).toEqual([
      {
        kind: 'update_profile',
        patch: { sex: 'male', cycle_module_interest: null, onboarding_step: 'health_consent' },
      },
    ]);
  });

  it('Einwilligung health_data: Einwilligung in aktueller Version, dann Fortschritt', () => {
    const ops = planStepWrites(
      { step: 'health_consent', granted: true },
      ctx({ hasHealthConsent: false, nextStep: 'body_metrics' }),
    );
    expect(ops[0]).toEqual({
      kind: 'grant_consent',
      consentType: 'health_data',
      version: 1,
      platform: 'web',
    });
    expect(ops.at(-1)).toEqual({
      kind: 'update_profile',
      patch: { onboarding_step: 'body_metrics' },
    });
  });

  it('ohne Einwilligung: nur Fortschritt, keine Einwilligung', () => {
    const ops = planStepWrites(
      { step: 'health_consent', granted: false },
      ctx({ hasHealthConsent: false, nextStep: 'experience' }),
    );
    expect(ops).toEqual([{ kind: 'update_profile', patch: { onboarding_step: 'experience' } }]);
  });

  it('Körperdaten: optionale Felder als null, Messdatum übernommen', () => {
    const save: StepSave = {
      step: 'body_metrics',
      value: { heightCm: 180, weightKg: 80.5 },
      measuredOn: TODAY,
    };
    const [op] = planStepWrites(save, ctx({ nextStep: 'body_measurements' }));
    expect(op).toEqual({
      kind: 'upsert_body_metrics',
      row: {
        user_id: USER_ID,
        measured_on: TODAY,
        height_cm: 180,
        weight_kg: 80.5,
        body_fat_pct: null,
        resting_heart_rate_bpm: null,
      },
    });
    expect(op && isSensitiveOp(op)).toBe(true);
  });

  it('Körperumfänge: Spalten aus MEASUREMENT_SITES + Mess-Erinnerung (28 Tage)', () => {
    const ops = planStepWrites(
      {
        step: 'body_measurements',
        value: { waistCm: 80, upperArmLeftCm: 30.5 },
        measuredOn: TODAY,
        reminderEnabled: true,
      },
      ctx({ nextStep: 'health_screening' }),
    );
    expect(ops[0]).toMatchObject({
      kind: 'upsert_body_measurements',
      row: { waist_cm: 80, upper_arm_left_cm: 30.5, hip_cm: null, measured_on: TODAY },
    });
    expect(ops[1]).toEqual({
      kind: 'upsert_measurement_reminder',
      row: { user_id: USER_ID, enabled: true, interval_days: 28, next_due_on: '2026-10-31' },
    });
  });

  it('Körperumfänge übersprungen → keine Zeile, keine Erinnerung', () => {
    const ops = planStepWrites(
      { step: 'body_measurements', value: null, measuredOn: TODAY, reminderEnabled: true },
      ctx({ nextStep: 'health_screening' }),
    );
    expect(ops).toEqual([
      { kind: 'update_profile', patch: { onboarding_step: 'health_screening' } },
    ]);
  });

  it('Ziel/Zeitbudget/Ort: immer die vollständige goals-Zeile (goal_type ist Pflicht)', () => {
    expect(toGoalsRow(USER_ID, fullAnswers)).toEqual({
      user_id: USER_ID,
      goal_type: 'endurance',
      discipline: 'marathon',
      target_date: '2027-04-01',
      sessions_per_week: 4,
      minutes_per_session: 60,
      preferred_days: [1, 3, 5],
      training_location: 'both',
    });
    expect(() => toGoalsRow(USER_ID, {})).toThrow();
  });

  it('Disziplin wird außerhalb von Ausdauer nie gespeichert', () => {
    const row = toGoalsRow(USER_ID, {
      goal: { goalType: 'fat_loss', discipline: 'marathon', targetDate: null },
    });
    expect(row.discipline).toBeNull();
  });

  it('Ernährung: Schwein nur bei omnivor, Meal-Prep-Tage nur bei Meal-Prep', () => {
    expect(toNutritionPrefsRow(USER_ID, fullAnswers)).toEqual({
      user_id: USER_ID,
      diet_type: 'omnivore',
      eats_pork: false,
      meals_per_day: 3,
      cooking_mode: 'meal_prep',
      mealprep_days: 2,
    });
    const vegan = toNutritionPrefsRow(USER_ID, {
      nutrition: { dietType: 'vegan', eatsPork: true, mealsPerDay: 1, foodPreferences: [] },
      cooking: { cookingMode: 'daily' },
    });
    expect(vegan).toMatchObject({ eats_pork: null, cooking_mode: 'daily', mealprep_days: null });
  });

  it('Unverträglichkeiten nur mit Einwilligung (eigener, sensibler Vorgang)', () => {
    const save: StepSave = { step: 'nutrition', nutrition: fullAnswers.nutrition! };
    const withConsent = planStepWrites(save, ctx({ answers: fullAnswers, nextStep: 'cooking' }));
    const intolerance = withConsent.find(
      (op) => op.kind === 'replace_food_preferences' && op.scope === 'intolerance',
    );
    expect(intolerance).toEqual({
      kind: 'replace_food_preferences',
      scope: 'intolerance',
      rows: [{ user_id: USER_ID, food_group: 'peanuts', kind: 'intolerance' }],
    });
    expect(intolerance && isSensitiveOp(intolerance)).toBe(true);

    const without = planStepWrites(
      save,
      ctx({ answers: fullAnswers, nextStep: 'cooking', hasHealthConsent: false }),
    );
    expect(without.some((op) => isSensitiveOp(op))).toBe(false);
    expect(without).toContainEqual({
      kind: 'replace_food_preferences',
      scope: 'taste',
      rows: [{ user_id: USER_ID, food_group: 'fish', kind: 'like' }],
    });
  });

  it('letzter Schritt: Fortschritt bleibt, onboarding_completed_at wird gesetzt', () => {
    const ops = planStepWrites(
      { step: 'cooking', cooking: { cookingMode: 'daily' } },
      ctx({ answers: { ...fullAnswers, cooking: { cookingMode: 'daily' } }, nextStep: null }),
    );
    expect(ops.at(-1)).toEqual({
      kind: 'update_profile',
      patch: { onboarding_step: 'cooking', onboarding_completed_at: NOW },
    });
  });

  it('Gesundheits-Check: Antworten + bestätigter Hinweis, Flags berechnet die Datenbank', () => {
    const answers = {
      heart_condition: true,
      chest_pain_exercise: false,
      chest_pain_rest: false,
      dizziness: false,
      blood_pressure: false,
      bone_joint: false,
      medication: false,
      other_reason: false,
    };
    const [op] = planStepWrites(
      { step: 'health_screening', answers, acknowledgedAt: NOW },
      ctx({ nextStep: 'experience' }),
    );
    expect(op).toEqual({
      kind: 'insert_health_screening',
      row: { user_id: USER_ID, answers, medical_notice_acknowledged_at: NOW },
    });
    expect(op && isDirectOp(op)).toBe(true);
  });
});

describe('planSave: nächster Schritt nach packages/core', () => {
  const base = rowsWith({ consents: [consent('terms'), consent('privacy')] });

  it('ohne Einwilligung geht es nach „Einwilligung“ direkt zur Erfahrung', () => {
    const planned = planSave(
      { step: 'health_consent', granted: false },
      { userId: USER_ID, answers: {}, rows: base, versions: VERSIONS, platform: 'web', now: NOW },
    );
    expect(planned.next).toBe('experience');
  });

  it('mit Einwilligung geht es zu den Körperdaten', () => {
    const planned = planSave(
      { step: 'health_consent', granted: true },
      { userId: USER_ID, answers: {}, rows: base, versions: VERSIONS, platform: 'web', now: NOW },
    );
    expect(planned.next).toBe('body_metrics');
  });

  it('Trainingsort „Studio“ überspringt Equipment', () => {
    const planned = planSave(
      { step: 'training_location', trainingLocation: 'gym' },
      {
        userId: USER_ID,
        answers: { goal: { goalType: 'muscle_gain', discipline: null, targetDate: null } },
        rows: base,
        versions: VERSIONS,
        platform: 'web',
        now: NOW,
      },
    );
    expect(planned.next).toBe('nutrition');
  });
});

describe('Tabellenzeilen → Antworten (Fortsetzen)', () => {
  it('Hin- und Rückweg ergeben dieselben Antworten', () => {
    let rows: UserRows = rowsWith();
    let answers: OnboardingAnswers = {};
    const saves: StepSave[] = [
      { step: 'sex', sex: 'female', cycleModuleInterest: true },
      { step: 'experience', experienceLevel: 'advanced' },
      { step: 'goal', goal: fullAnswers.goal! },
      { step: 'time_budget', timeBudget: { ...fullAnswers.timeBudget!, preferredDays: [1, 3, 5] } },
      { step: 'training_location', trainingLocation: 'both' },
      {
        step: 'equipment',
        items: [{ equipmentId: 'dumbbells', location: 'home', weightsKg: [2, 4], note: null }],
      },
      { step: 'nutrition', nutrition: fullAnswers.nutrition! },
      { step: 'cooking', cooking: fullAnswers.cooking! },
    ];
    for (const save of saves) {
      answers = applyStepToAnswers(answers, save);
      const ops = planStepWrites(save, ctx({ answers, nextStep: null }));
      rows = applyWriteOps(rows, ops, { now: NOW, newId: () => 'x', flagsFor: () => [] });
    }
    const restored = answersFromRows(rows);
    expect(restored.sex).toBe('female');
    expect(restored.cycleModuleInterest).toBe(true);
    expect(restored.experienceLevel).toBe('advanced');
    expect(restored.goal).toEqual(fullAnswers.goal);
    expect(restored.timeBudget).toEqual({ ...fullAnswers.timeBudget, preferredDays: [1, 3, 5] });
    expect(restored.trainingLocation).toBe('both');
    expect(restored.equipment).toEqual([
      { equipmentId: 'dumbbells', location: 'home', weightsKg: [2, 4], note: null },
    ]);
    expect(restored.nutrition).toEqual(fullAnswers.nutrition);
    expect(restored.cooking).toEqual(fullAnswers.cooking);
  });

  it('unbekannte Geräte und Lebensmittelgruppen werden ignoriert', () => {
    const restored = answersFromRows(
      rowsWith({
        userEquipment: [
          {
            user_id: USER_ID,
            equipment_id: 'laser_sword',
            location: 'home',
            weights_kg: [],
            note: null,
          },
        ],
        nutritionPrefs: {
          user_id: USER_ID,
          diet_type: 'vegan',
          eats_pork: null,
          meals_per_day: 2,
          cooking_mode: null,
          mealprep_days: null,
        },
        foodPreferences: [{ user_id: USER_ID, food_group: 'unicorn', kind: 'like' }],
      }),
    );
    expect(restored.equipment).toBeUndefined();
    expect(restored.nutrition?.foodPreferences).toEqual([]);
    expect(restored.cooking).toBeUndefined();
  });

  it('versionsFromDocuments nimmt die höchste Version je Art', () => {
    expect(
      versionsFromDocuments([
        { type: 'terms', version: 1 },
        { type: 'terms', version: 2 },
        { type: 'health_data', version: 1 },
      ]),
    ).toEqual({ terms: 2, privacy: null, health_data: 1, cycle_data: null });
  });
});

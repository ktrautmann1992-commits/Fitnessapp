import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_FACTORS,
  ADJUSTMENT_OFFSET_MAX_KCAL,
  ADJUSTMENT_STEP_MAX_KCAL,
  EA_MIN_KCAL_PER_KG_FFM,
  MEAL_SLOT_LAYOUTS,
  SURPLUS_CAP,
  TRAINING_KCAL_DAY_MAX,
} from '../constants';
import {
  CALORIE_CAP_CODES,
  NUTRITION_NOTICE_CODES,
  sortCaps,
  sortNotices,
  sortWeightGoalNotices,
  WEIGHT_GOAL_NOTICE_CODES,
} from './notices';
import {
  adjustmentKcalSchema,
  bodyMetricsRowSchema,
  deficitCapSchema,
  nutritionInputsSchema,
  surplusCapSchema,
  weekStartSchema,
} from './schemas';
import { inputs } from './test-helpers';

describe('Schemas der Ernährung', () => {
  it('surplusCap nur in [0,05; 0,10], deficitCap nur in [0; 0,25] (H2)', () => {
    expect(surplusCapSchema.safeParse(0.05).success).toBe(true);
    expect(surplusCapSchema.safeParse(0.1).success).toBe(true);
    expect(surplusCapSchema.safeParse(0).success).toBe(false);
    expect(surplusCapSchema.safeParse(0.049).success).toBe(false);
    expect(surplusCapSchema.safeParse(0.11).success).toBe(false);
    expect(surplusCapSchema.safeParse(undefined).success).toBe(false);
    expect(deficitCapSchema.safeParse(0.25).success).toBe(true);
    expect(deficitCapSchema.safeParse(0.26).success).toBe(false);
    expect(deficitCapSchema.safeParse(-0.01).success).toBe(false);
  });

  it('4b-Versatz höchstens ±1.000; Woche beginnt am Montag', () => {
    expect(adjustmentKcalSchema.safeParse(1000).success).toBe(true);
    expect(adjustmentKcalSchema.safeParse(-1000).success).toBe(true);
    expect(adjustmentKcalSchema.safeParse(1000.5).success).toBe(false);
    expect(weekStartSchema.safeParse('2026-10-12').success).toBe(true);
    expect(weekStartSchema.safeParse('2026-10-18').success).toBe(false);
  });

  it('Körperdaten-Zeile: mindestens ein Wert, Grenzen aus BODY_METRIC_LIMITS', () => {
    expect(
      bodyMetricsRowSchema.safeParse({ measuredOn: '2026-10-01', weightKg: 300 }).success,
    ).toBe(true);
    expect(bodyMetricsRowSchema.safeParse({ measuredOn: '2026-10-01', heightCm: 99 }).success).toBe(
      false,
    );
    expect(
      bodyMetricsRowSchema.safeParse({ measuredOn: '2026-10-01', bodyFatPct: 2 }).success,
    ).toBe(false);
  });

  it('Eingaben: Standardwerte, strikte Objekte', () => {
    const parsed = nutritionInputsSchema.parse(inputs());
    expect(parsed.mealsPerDay).toBe(3);
    expect(parsed.trainingTime).toBeNull();
    expect(nutritionInputsSchema.safeParse({ ...inputs(), extra: 1 }).success).toBe(false);
  });

  it('Abnehmziel (docs/PLAN-ZIELE.md 2.3, Wächter B1): optional, Standard `null`, gespeichertes Ziel streng geprüft', () => {
    expect(nutritionInputsSchema.parse(inputs()).weightGoal).toBeNull();
    const goal = {
      targetWeightKg: 75,
      startDate: '2026-10-12',
      targetDate: '2027-01-04',
      amountMode: 'kg_to_lose',
      timeMode: 'weeks',
    } as const;
    expect(nutritionInputsSchema.parse(inputs({ weightGoal: goal })).weightGoal).toEqual(goal);
    expect(
      nutritionInputsSchema.safeParse(inputs({ weightGoal: { ...goal, targetDate: '2026-10-20' } }))
        .success,
    ).toBe(false);
    expect(new Set(WEIGHT_GOAL_NOTICE_CODES).size).toBe(WEIGHT_GOAL_NOTICE_CODES.length);
    expect(sortWeightGoalNotices(['weight_goal_pace_capped', 'weight_goal_invalid'])).toEqual([
      'weight_goal_invalid',
      'weight_goal_pace_capped',
    ]);
    // Eigene Liste: Die Tages-Hinweise (mit App-Texten aus N4) bleiben unverändert.
    for (const code of WEIGHT_GOAL_NOTICE_CODES) {
      expect(NUTRITION_NOTICE_CODES as readonly string[]).not.toContain(code);
    }
  });

  it('Hinweis- und Grenz-Codes sortiert ohne Doppelungen', () => {
    expect(new Set(NUTRITION_NOTICE_CODES).size).toBe(NUTRITION_NOTICE_CODES.length);
    expect(new Set(CALORIE_CAP_CODES).size).toBe(CALORIE_CAP_CODES.length);
    expect(sortNotices(['early_training', 'underweight', 'underweight'])).toEqual([
      'underweight',
      'early_training',
    ]);
    expect(sortCaps(['gain_cap', 'bmr_floor'])).toEqual(['bmr_floor', 'gain_cap']);
  });
});

// Diese Tests sichern Produktentscheidungen und Grenzen aus dem Plan ab: Wer sie ändert, muss den Test bewusst ändern.
describe('Konstanten Phase 5 (Plan 4.4–4.8)', () => {
  it('Versatz-Begrenzung 150 / 1.000 (H3), EA 30, Trainingsdeckel 3.000, Überschuss 0,05–0,10', () => {
    expect(ADJUSTMENT_STEP_MAX_KCAL).toBe(150);
    expect(ADJUSTMENT_OFFSET_MAX_KCAL).toBe(1000);
    expect(EA_MIN_KCAL_PER_KG_FFM).toBe(30);
    expect(TRAINING_KCAL_DAY_MAX).toBe(3000);
    expect(SURPLUS_CAP).toEqual({ default: 0.1, special: 0.05 });
  });

  it('Alltagsfaktor ohne Angabe = kleinster Faktor 1,45', () => {
    expect(ACTIVITY_FACTORS.default).toBe(
      Math.min(
        ACTIVITY_FACTORS.sedentary,
        ACTIVITY_FACTORS.light,
        ACTIVITY_FACTORS.active,
        ACTIVITY_FACTORS.very_active,
      ),
    );
  });

  it('Mahlzeiten-Layouts 1–8 vollständig', () => {
    expect(Object.keys(MEAL_SLOT_LAYOUTS).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

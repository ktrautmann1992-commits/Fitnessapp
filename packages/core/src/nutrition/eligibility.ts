import { z } from 'zod';

import {
  ACTIVE_AGING_NUTRITION,
  BMI_LIMITS,
  BODY_METRIC_LIMITS,
  NUTRITION_MAX_AGE_YEARS,
  MAX_CALORIE_DEFICIT_FRACTION,
  MIFFLIN_ST_JEOR,
  NUTRITION_AGE_RULES,
  PROTEIN_G_PER_KG,
  SPECIAL_CASE_DEFICIT_CAPS,
  SURPLUS_CAP,
} from '../constants';
import type { GoalType, Sex } from '../enums';
import { goalEnergyDirection, isAllowedGoalPair } from '../goals/profile';
import { HEALTH_FLAGS, type HealthFlag } from '../health-screening';
import { goalTypeSchema, sexSchema } from '../validation';
import { bodyMassIndex } from './body-data';
import { type NutritionNoticeCode, sortNotices } from './notices';
import type { NutritionMode, RecipeExclusion } from './schemas';

/**
 * Sonderfälle der Ernährung (docs/PLAN-PHASE-5.md 4.9) – je TAG bestimmt (Alter, BMI, Flags). Es gilt immer die
 * strengste Regel: `no_targets` > `maintenance_only` > kleinster Defizitdeckel; Überschuss- und Eiweißdeckel: der
 * kleinste Wert gewinnt. Abgeglichen mit `planSafetyRules` (B4): kein Check, Schwangerschaft, Medikamente,
 * Arzt-Hinweis, unter 18 und ab 65 sind in Training UND Ernährung vorsichtig.
 */

export interface EligibilityInputs {
  readonly ageYears: number;
  readonly sex: Sex | null;
  readonly goalType: GoalType;
  /** Nebenziel (docs/PLAN-ZIELE.md 4.4); fehlend = keines. */
  readonly secondaryGoalType?: GoalType | null;
  /** Gültige `health_data`-Einwilligung. Ohne sie gibt es weder Körperdaten noch Flags. */
  readonly healthDataConsent: boolean;
  /** Neueste Größe und neuestes Gewicht; null = fehlt. */
  readonly body: { readonly weightKg: number; readonly heightCm: number } | null;
  /** Flags des neuesten Checks; null = KEIN Gesundheits-Check (B4). */
  readonly healthFlags: readonly HealthFlag[] | null;
}

export interface NutritionEligibility {
  readonly mode: NutritionMode;
  /** Defizitdeckel als Anteil unter TagesbedarfGrenze, in [0; 0,25]. */
  readonly deficitCap: number;
  /** Überschussdeckel, immer gesetzt, in [0,05; 0,10] (H2). */
  readonly surplusCap: number;
  /** Eiweiß-Untergrenze g/kg (0 = keine). */
  readonly proteinMin: number;
  /** Eiweiß-Obergrenze g/kg. */
  readonly proteinCap: number;
  readonly recipeExclusions: readonly RecipeExclusion[];
  readonly notices: readonly NutritionNoticeCode[];
  /** BMI (nur Erwachsene mit Körperdaten und Einwilligung), sonst null. */
  readonly bmi: number | null;
  /** Flags, Körperdaten oder ein Check gehen ein → Gesundheitsdatum (7.1). */
  readonly usesHealthData: boolean;
  /**
   * Fit im Alter (docs/PLAN-FIT-IM-ALTER.md 11): Abnehm-Tempo höchstens 0,5 % Körpergewicht je Woche statt ~1 %
   * (ACTIVE_AGING_NUTRITION). Fehlt → allgemeine Grenze MAX_WEEKLY_WEIGHT_LOSS_FRACTION.
   */
  readonly weeklyLossMaxFraction?: number;
}

const eligibilityInputsSchema = z
  .strictObject({
    ageYears: z.number().int().min(0).max(NUTRITION_MAX_AGE_YEARS),
    sex: sexSchema.nullable(),
    goalType: goalTypeSchema,
    secondaryGoalType: goalTypeSchema.nullable().default(null),
    healthDataConsent: z.boolean(),
    body: z
      .strictObject({
        weightKg: z
          .number()
          .min(BODY_METRIC_LIMITS.weightKg.min)
          .max(BODY_METRIC_LIMITS.weightKg.max),
        heightCm: z
          .number()
          .min(BODY_METRIC_LIMITS.heightCm.min)
          .max(BODY_METRIC_LIMITS.heightCm.max),
      })
      .nullable(),
    healthFlags: z.array(z.enum(HEALTH_FLAGS)).nullable(),
  })
  .refine((value) => isAllowedGoalPair(value.goalType, value.secondaryGoalType), {
    path: ['secondaryGoalType'],
  });

/** Wirksame Sonderfall-Regeln eines Tages (Eingaben mit Zod geprüft, Wächter N1 K1). */
export function nutritionEligibility(rawInput: EligibilityInputs): NutritionEligibility {
  const input = eligibilityInputsSchema.parse(rawInput);
  const notices = new Set<NutritionNoticeCode>();
  const consent = input.healthDataConsent;
  const flags = consent ? input.healthFlags : null;
  const body = consent ? input.body : null;
  const noHealthCheck = flags === null;
  const pregnancy = flags?.includes('pregnancy') ?? false;
  const medical =
    flags?.includes('medication') === true ||
    flags?.includes('medical_clearance_recommended') === true;
  const minor = input.ageYears < NUTRITION_AGE_RULES.minorBelowAge;
  const senior = input.ageYears >= NUTRITION_AGE_RULES.seniorFromAge;
  // Energie-Richtung des Ziel-Profils (Vorzeichen der Anpassung, Wächter S11) ersetzt die Liste DEFICIT_GOALS.
  const deficitGoal =
    goalEnergyDirection({ primary: input.goalType, secondary: input.secondaryGoalType }) ===
    'deficit';

  // Rezept-Ausschluss: Schwangerschaft, oder kein Check bei Geschlecht ≠ männlich (Schwangerschaft nicht
  // ausgeschlossen, B4). Gilt in jedem Modus – auch ohne Einwilligung (dann gibt es keinen Check).
  const recipeExclusions: RecipeExclusion[] =
    pregnancy || (noHealthCheck && input.sex !== 'male') ? ['pregnancy_caution'] : [];

  let deficitCap: number = MAX_CALORIE_DEFICIT_FRACTION;
  let surplusCap: number = SURPLUS_CAP.default;
  let proteinCap: number = PROTEIN_G_PER_KG.max;
  let proteinMin = 0;
  let mode: NutritionMode = 'full';
  let bmi: number | null = null;

  if (consent && noHealthCheck) notices.add('health_check_missing');

  if (!consent || pregnancy || body === null) {
    if (!consent) notices.add('no_health_data_consent');
    if (pregnancy) {
      notices.add('pregnancy_no_targets');
      notices.add('pregnancy_check_update');
      notices.add('pregnancy_caffeine');
    } else {
      notices.add('body_data_missing');
    }
    return {
      mode: 'no_targets',
      deficitCap: 0,
      surplusCap: SURPLUS_CAP.special,
      proteinMin: 0,
      proteinCap: PROTEIN_G_PER_KG.cautiousMax,
      recipeExclusions,
      notices: sortNotices(notices),
      bmi: null,
      usesHealthData: consent && (body !== null || flags !== null),
    };
  }

  if (noHealthCheck) {
    deficitCap = Math.min(deficitCap, SPECIAL_CASE_DEFICIT_CAPS.noHealthCheck);
    surplusCap = Math.min(surplusCap, SURPLUS_CAP.special);
    proteinCap = Math.min(proteinCap, PROTEIN_G_PER_KG.cautiousMax);
    if (input.sex !== 'male') mode = 'maintenance_only';
  }
  if (medical) {
    deficitCap = Math.min(deficitCap, SPECIAL_CASE_DEFICIT_CAPS.medical);
    proteinCap = Math.min(proteinCap, PROTEIN_G_PER_KG.cautiousMax);
    notices.add('medical_consult');
  }
  if (senior) {
    deficitCap = Math.min(deficitCap, SPECIAL_CASE_DEFICIT_CAPS.senior);
    proteinMin = Math.max(proteinMin, PROTEIN_G_PER_KG.senior.min);
    proteinCap = Math.min(proteinCap, PROTEIN_G_PER_KG.senior.max);
  }
  if (minor) {
    // Gründer-Entscheidung 2: kein Defizit (auch nicht über einen 4b-Versatz), Überschuss ≤ 5 %, Eiweiß ≤ 1,6.
    // Keine BMI-Erwachsenengrenzen (für Jugendliche gelten Perzentilen).
    deficitCap = 0;
    surplusCap = Math.min(surplusCap, SURPLUS_CAP.special);
    proteinCap = Math.min(proteinCap, PROTEIN_G_PER_KG.cautiousMax);
    if (deficitGoal) {
      mode = 'maintenance_only';
      notices.add('minor_no_deficit');
    }
  } else {
    bmi = bodyMassIndex(body.weightKg, body.heightCm);
    if (bmi < BMI_LIMITS.underweight) {
      deficitCap = 0;
      if (deficitGoal) mode = 'maintenance_only';
      notices.add('underweight');
      if (bmi < BMI_LIMITS.severeUnderweight) notices.add('severe_underweight');
    } else if (bmi < BMI_LIMITS.lowNormal) {
      deficitCap = Math.min(deficitCap, SPECIAL_CASE_DEFICIT_CAPS.lowNormalBmi);
    }
  }
  if (mode === 'maintenance_only') deficitCap = 0;
  if (
    input.ageYears < MIFFLIN_ST_JEOR.validAge.min ||
    input.ageYears > MIFFLIN_ST_JEOR.validAge.max
  ) {
    notices.add('bmr_estimate_age');
  }

  return {
    mode,
    deficitCap,
    surplusCap,
    proteinMin,
    proteinCap,
    recipeExclusions,
    notices: sortNotices(notices),
    bmi,
    usesHealthData: true,
    ...(input.goalType === 'active_aging'
      ? { weeklyLossMaxFraction: ACTIVE_AGING_NUTRITION.weeklyLossMaxFraction }
      : {}),
  };
}

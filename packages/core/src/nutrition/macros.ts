import { z } from 'zod';

import {
  BMI_LIMITS,
  BODY_METRIC_LIMITS,
  CARBS,
  COMPETITION_NUTRITION,
  FAT_ENERGY_SHARE,
  KCAL_PER_GRAM,
  NUTRITION_ROUNDING,
  PROTEIN_G_PER_KG,
} from '../constants';
import { goalProteinGPerKg, goalUsesEnduranceCarbs, isAllowedGoalPair } from '../goals/profile';
import { goalTypeSchema } from '../validation';
import { bodyMassIndex } from './body-data';
import { ceilTo, roundTo, roundWithin } from './limits';
import { type NutritionNoticeCode, sortNotices } from './notices';

/**
 * Makros (docs/PLAN-PHASE-5.md 4.7). Die Energie (gerundetes Tagesziel) ist verbindlich: Kohlenhydrate sind immer
 * der gerundete Rest (R2-K1) und erhöhen nie das Kalorienziel. Reihenfolge Eiweiß → Fett → Kohlenhydrate (B2).
 */

export const macroInputsSchema = z
  .strictObject({
    targetKcal: z.number().positive().finite(),
    goalType: goalTypeSchema,
    /** Nebenziel (docs/PLAN-ZIELE.md 4.4): Eiweiß und Kohlenhydrat-Regel aus dem Ziel-Profil; fehlend = keines. */
    secondaryGoalType: goalTypeSchema.nullable().default(null),
    weightKg: z.number().min(BODY_METRIC_LIMITS.weightKg.min).max(BODY_METRIC_LIMITS.weightKg.max),
    heightCm: z.number().min(BODY_METRIC_LIMITS.heightCm.min).max(BODY_METRIC_LIMITS.heightCm.max),
    /** Eiweiß-Untergrenze/-Obergrenze in g/kg aus `nutritionEligibility`. */
    proteinMin: z.number().min(0).max(PROTEIN_G_PER_KG.max),
    proteinCap: z.number().positive().max(PROTEIN_G_PER_KG.max),
    /** Trainingsminuten des Tages (für den Kohlenhydrat-Richtwert beim Ziel Ausdauer). */
    trainingMinutes: z
      .number()
      .min(0)
      .max(24 * 60),
    /**
     * Wettkampf-Ernährung (Etappe W1, Plan 10 Abschnitt 10): Kohlenhydrat-Richtwert in g/kg, der zusätzlich angestrebt
     * wird (Carb-Loading 8 g/kg) – NUR als Verschiebung innerhalb der Energie: Fett nie unter 20 %, Eiweiß unverändert
     * (≥ Minimum); reicht die Energie nicht, bleibt es beim Rest (`carbsTargetReached: false`). null = keiner.
     */
    carbsTargetGPerKg: z
      .number()
      .min(0)
      .max(COMPETITION_NUTRITION.carbLoadingGPerKg.max)
      .nullable()
      .default(null),
  })
  .refine((m) => m.proteinMin <= m.proteinCap, { path: ['proteinMin'] })
  .refine((m) => isAllowedGoalPair(m.goalType, m.secondaryGoalType), {
    path: ['secondaryGoalType'],
  });
export type MacroInputs = z.input<typeof macroInputsSchema>;

export interface Macros {
  readonly proteinG: number;
  readonly fatG: number;
  readonly carbsG: number;
  /** Eiweiß in g/kg Referenzgewicht (ungerundet, vor der 5-g-Rundung). */
  readonly proteinGPerKg: number;
  /** Referenzgewicht für Eiweiß (bei BMI ≥ 30 das Gewicht bei BMI 25). */
  readonly referenceWeightKg: number;
  readonly notices: readonly NutritionNoticeCode[];
  /** Nur mit `carbsTargetGPerKg`: Liegen die gerundeten Kohlenhydrate auf diesem Richtwert (±2,5 g Rundung)? */
  readonly carbsTargetReached?: boolean;
}

/** Gewicht, mit dem Eiweiß rechnet: ab BMI 30 das Gewicht bei BMI 25 für die Größe (PRODUKTENTSCHEIDUNG). */
export function proteinReferenceWeight(weightKg: number, heightCm: number): number {
  if (bodyMassIndex(weightKg, heightCm) < BMI_LIMITS.proteinReferenceFrom) return weightKg;
  const m = heightCm / 100;
  return BMI_LIMITS.proteinReference * m * m;
}

/** Kohlenhydrat-Richtwert in g/kg beim Ziel Ausdauer nach Trainingsminuten (untere Werte der Spannen). */
export function enduranceCarbsGPerKg(minutes: number): number {
  for (const row of CARBS.enduranceGPerKg) {
    if (minutes <= row.maxMinutes) return row.gPerKg;
  }
  return CARBS.enduranceGPerKg[CARBS.enduranceGPerKg.length - 1]?.gPerKg ?? 0;
}

const STEP = NUTRITION_ROUNDING.macroG;

/** Makros eines Tages zum (gerundeten) Tagesziel. */
export function nutritionMacros(input: MacroInputs): Macros {
  const m = macroInputsSchema.parse(input);
  const kcal = m.targetKcal;
  const notices = new Set<NutritionNoticeCode>();
  const ref = proteinReferenceWeight(m.weightKg, m.heightCm);
  const selection = { primary: m.goalType, secondary: m.secondaryGoalType };
  const goalPerKg = goalProteinGPerKg(selection);
  const fatMin = (FAT_ENERGY_SHARE.min * kcal) / KCAL_PER_GRAM.fat;
  // Die Energie ist verbindlich: Eiweiß nie mehr, als neben dem Mindestfett ins Tagesziel passt.
  const proteinEnergyMaxG =
    (kcal - KCAL_PER_GRAM.fat * ceilTo(fatMin, STEP)) / KCAL_PER_GRAM.protein;
  const proteinMaxG = Math.min(m.proteinCap * ref, proteinEnergyMaxG);
  const proteinMinG = Math.min(m.proteinMin * ref, proteinMaxG);
  let perKg = Math.min(Math.max(goalPerKg, m.proteinMin), m.proteinCap, proteinMaxG / ref);
  let fatShare: number = FAT_ENERGY_SHARE.default;
  const carbsRest = () =>
    (kcal - KCAL_PER_GRAM.protein * perKg * ref - fatShare * kcal) / KCAL_PER_GRAM.carbs;

  // Ausdauer (Haupt- oder Nebenziel, Ziel-Profil): Richtwert nach Trainingsminuten; reicht der Rest nicht, Fett
  // bis zur Untergrenze senken.
  // Wettkampf (W1): ein zusätzlicher Richtwert (Carb-Loading) verschiebt genauso – nur Fett bis zur Untergrenze.
  const enduranceWanted = goalUsesEnduranceCarbs(selection)
    ? enduranceCarbsGPerKg(m.trainingMinutes) * m.weightKg
    : 0;
  const extraWanted = (m.carbsTargetGPerKg ?? 0) * m.weightKg;
  const wanted = Math.max(enduranceWanted, extraWanted);
  if (wanted > 0 && carbsRest() < wanted) {
    const share =
      (kcal - KCAL_PER_GRAM.protein * perKg * ref - KCAL_PER_GRAM.carbs * wanted) / kcal;
    fatShare = Math.min(fatShare, Math.max(FAT_ENERGY_SHARE.min, share));
    // Der Hinweis zum Ausdauer-Richtwert nur, wenn dieser Richtwert selbst verfehlt wird (der Carb-Loading-Richtwert
    // meldet sich über `carbsTargetReached`).
    if (enduranceWanted > 0 && carbsRest() < enduranceWanted - 1e-9) {
      notices.add('endurance_carbs_below_target');
    }
  }
  // Richtwert 130 g: erst Fett bis 20 %, dann Eiweiß bis 1,6 g/kg; danach nur Hinweis (R2-K1).
  if (carbsRest() < CARBS.referenceMinG) {
    fatShare = FAT_ENERGY_SHARE.min;
    if (carbsRest() < CARBS.referenceMinG && perKg > PROTEIN_G_PER_KG.cautiousMax) {
      const neededPerKg =
        (kcal - fatShare * kcal - KCAL_PER_GRAM.carbs * CARBS.referenceMinG) /
        (KCAL_PER_GRAM.protein * ref);
      perKg = Math.min(perKg, Math.max(PROTEIN_G_PER_KG.cautiousMax, m.proteinMin, neededPerKg));
    }
    if (carbsRest() < CARBS.referenceMinG - 1e-9) notices.add('carbs_below_reference');
  }
  if (perKg > PROTEIN_G_PER_KG.kidneyNoticeAbove + 1e-9) notices.add('protein_kidney_notice');

  // Rundung: Eiweiß → Fett → Kohlenhydrate (gerichtet, B2).
  const proteinG = roundWithin(perKg * ref, proteinMinG, proteinMaxG, STEP);
  const fatG = roundWithin(
    (fatShare * kcal) / KCAL_PER_GRAM.fat,
    fatMin,
    Number.POSITIVE_INFINITY,
    STEP,
  );
  const carbsRaw =
    (kcal - KCAL_PER_GRAM.protein * proteinG - KCAL_PER_GRAM.fat * fatG) / KCAL_PER_GRAM.carbs;
  const carbsG = Math.max(0, roundTo(carbsRaw, STEP));
  return {
    proteinG,
    fatG,
    carbsG,
    proteinGPerKg: perKg,
    referenceWeightKg: ref,
    notices: sortNotices(notices),
    ...(m.carbsTargetGPerKg === null
      ? {}
      : { carbsTargetReached: carbsG >= extraWanted - STEP / 2 - 1e-9 }),
  };
}

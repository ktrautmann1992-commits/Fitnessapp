import { z } from 'zod';

import { ageInYears, isoDateSchema } from '../age';
import {
  ADJUSTMENT_OFFSET_MAX_KCAL,
  BODY_METRIC_LIMITS,
  MAX_CALORIE_DEFICIT_FRACTION,
  NUTRITION_MAX_AGE_YEARS,
  NUTRITION_LIMITS,
  SURPLUS_CAP,
} from '../constants';
import { isoWeekday } from '../dates';
import { ENDURANCE_MODALITIES, PLANNED_SESSION_KINDS, PLANNED_SESSION_STATUSES } from '../enums';
import { HEALTH_FLAGS } from '../health-screening';
import {
  enduranceDisciplineSchema,
  experienceLevelSchema,
  goalTypeSchema,
  sexSchema,
} from '../validation';

/**
 * Zod-Schemas der Ernährungs-Engine (docs/PLAN-PHASE-5.md 4.2, 4.10). Eingaben werden an der Grenze geprüft.
 * Neue Aufzählungen (Alltag, Trainingszeit) bleiben bis Etappe N7 bewusst außerhalb von `enums.ts` (S8).
 */

/** Alltagsaktivität OHNE Sport (Plan 4.4, neue Angabe im Schritt `nutrition_setup`). */
export const ACTIVITY_LEVELS = ['sedentary', 'light', 'active', 'very_active'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
export const activityLevelSchema = z.enum(ACTIVITY_LEVELS);

/** Übliche Trainingszeit (Plan 4.8). `varies` = unterschiedlich → keine Zuordnung vor/nach. */
export const TRAINING_TIMES = [
  'early',
  'morning',
  'midday',
  'afternoon',
  'evening',
  'varies',
] as const;
export type TrainingTime = (typeof TRAINING_TIMES)[number];
export const trainingTimeSchema = z.enum(TRAINING_TIMES);

/** Modus je Tag (Plan 4.9): volles Ziel, nur Erhalt, keine Zahlen. */
export const NUTRITION_MODES = ['full', 'maintenance_only', 'no_targets'] as const;
export type NutritionMode = (typeof NUTRITION_MODES)[number];

/** Rezept-Ausschlüsse aus Sonderfällen (Plan 4.9; Filter ab N3). */
export const RECIPE_EXCLUSIONS = ['pregnancy_caution'] as const;
export type RecipeExclusion = (typeof RECIPE_EXCLUSIONS)[number];

/**
 * Eine Zeile `body_metrics` (nur mit `health_data`-Einwilligung). Zeilen mit nur EINEM Wert sind erlaubt
 * (num_nonnulls ≥ 1); Grenzen wie BODY_METRIC_LIMITS.
 */
export const bodyMetricsRowSchema = z
  .strictObject({
    measuredOn: isoDateSchema,
    heightCm: z
      .number()
      .min(BODY_METRIC_LIMITS.heightCm.min)
      .max(BODY_METRIC_LIMITS.heightCm.max)
      .nullable()
      .default(null),
    weightKg: z
      .number()
      .min(BODY_METRIC_LIMITS.weightKg.min)
      .max(BODY_METRIC_LIMITS.weightKg.max)
      .nullable()
      .default(null),
    bodyFatPct: z
      .number()
      .min(BODY_METRIC_LIMITS.bodyFatPct.min)
      .max(BODY_METRIC_LIMITS.bodyFatPct.max)
      .nullable()
      .default(null),
  })
  .refine(
    (row) => row.heightCm !== null || row.weightKg !== null || row.bodyFatPct !== null,
    'Mindestens ein Wert.',
  );
export type BodyMetricsRow = z.infer<typeof bodyMetricsRowSchema>;
export type BodyMetricsRowInput = z.input<typeof bodyMetricsRowSchema>;

/**
 * Eine Trainingseinheit aus aktivem ODER ersetztem Plan (Plan 4.2, S11a). `effortTarget` 1–4 wie die CHECK-Bedingung
 * von `planned_sessions.effort_target`; `null` = unbekannt (Ersatzwert). Ausdauer ohne Sportart = unbekannte
 * Sportart (Ersatzwert 7,0 MET).
 */
export const nutritionSessionSchema = z.strictObject({
  sessionId: z.string().min(1).max(100),
  planId: z.string().min(1).max(100),
  planStatus: z.enum(['active', 'replaced']),
  scheduledOn: isoDateSchema,
  kind: z.enum(PLANNED_SESSION_KINDS),
  enduranceModality: z.enum(ENDURANCE_MODALITIES).nullable().default(null),
  effortTarget: z.number().int().min(1).max(4).nullable().default(null),
  minutes: z
    .number()
    .min(0)
    .max(24 * 60),
  isDeload: z.boolean().default(false),
  status: z.enum(PLANNED_SESSION_STATUSES),
});
export type NutritionSession = z.infer<typeof nutritionSessionSchema>;
export type NutritionSessionInput = z.input<typeof nutritionSessionSchema>;

/** Gesundheits-Check: `null` = kein Check (B4); sonst die Flags des NEUESTEN Checks. */
export const nutritionHealthFlagsSchema = z
  .strictObject({
    flags: z
      .array(z.enum(HEALTH_FLAGS))
      .refine((flags) => new Set(flags).size === flags.length, 'Jedes Flag nur einmal.'),
  })
  .nullable();

/**
 * Eingaben der Ernährungs-Engine (Plan 4.2). Etappe N1 braucht von den Ernährungs-Vorlieben nur `mealsPerDay`
 * (Timing); Ernährungsform, Abneigungen usw. kommen mit dem Essensplan (N3).
 * Ohne gültige `health_data`-Einwilligung werden Körperdaten und Flags NICHT verwendet (es gibt sie dann nicht).
 */
export const nutritionInputsSchema = z
  .strictObject({
    today: isoDateSchema,
    birthDate: isoDateSchema,
    sex: sexSchema.nullable().default(null),
    goalType: goalTypeSchema,
    experienceLevel: experienceLevelSchema,
    discipline: enduranceDisciplineSchema.nullable().default(null),
    healthDataConsent: z.boolean(),
    bodyMetricsRows: z.array(bodyMetricsRowSchema).max(5000).default([]),
    healthFlags: nutritionHealthFlagsSchema,
    activityLevel: activityLevelSchema.nullable().default(null),
    trainingTime: trainingTimeSchema.nullable().default(null),
    mealsPerDay: z
      .number()
      .int()
      .min(NUTRITION_LIMITS.mealsPerDay.min)
      .max(NUTRITION_LIMITS.mealsPerDay.max)
      .default(3),
    sessions: z
      .array(nutritionSessionSchema)
      .max(500)
      .default([])
      .refine(
        (sessions) => new Set(sessions.map((s) => s.sessionId)).size === sessions.length,
        'Jede Einheit nur einmal.',
      ),
  })
  .refine(
    (inputs) =>
      inputs.birthDate <= inputs.today &&
      ageInYears(inputs.birthDate, inputs.today) <= NUTRITION_MAX_AGE_YEARS,
    { path: ['birthDate'], message: 'Das Geburtsdatum ist nicht plausibel (höchstens 120 Jahre).' },
  );
export type NutritionInputs = z.infer<typeof nutritionInputsSchema>;
export type NutritionInputsInput = z.input<typeof nutritionInputsSchema>;

/**
 * 4b-Versatz in kcal (Plan 4.6, S10): nur die Summe ist hier begrenzt (±1.000); die Schrittweite begrenzt
 * `clampCalorieAdjustment`. Alle Schutzgrenzen greifen danach in `clampCalorieTarget`.
 */
export const adjustmentKcalSchema = z
  .number()
  .min(-ADJUSTMENT_OFFSET_MAX_KCAL)
  .max(ADJUSTMENT_OFFSET_MAX_KCAL);

export const nutritionTargetsOptionsSchema = z
  .strictObject({ adjustmentKcal: adjustmentKcalSchema.default(0) })
  .default({ adjustmentKcal: 0 });

/** Montag einer ISO-Woche. */
export const weekStartSchema = isoDateSchema.refine(
  (date) => isoWeekday(date) === 1,
  'Die Woche beginnt am Montag.',
);

/**
 * `surplusCap` ist IMMER gesetzt und liegt in [0,05; 0,10] (H2) – nie 0 und nie undefiniert, damit das Band bei
 * `maintenance_only` nie zu einem Punkt wird. `deficitCap` liegt in [0; 0,25] (CLAUDE.md).
 */
export const surplusCapSchema = z.number().min(SURPLUS_CAP.special).max(SURPLUS_CAP.default);
export const deficitCapSchema = z.number().min(0).max(MAX_CALORIE_DEFICIT_FRACTION);

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
import {
  COOKING_MODES,
  DIET_TYPES,
  ENDURANCE_MODALITIES,
  PLANNED_SESSION_KINDS,
  PLANNED_SESSION_STATUSES,
} from '../enums';
import { foodGroupSchema } from '../food-groups';
import { HEALTH_FLAGS } from '../health-screening';
import { isAllowedGoalPair } from '../goals/profile';
import { weightGoalSchema } from '../goals/weight-goal-schema';
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
    /** Nebenziel (docs/PLAN-ZIELE.md 4.6): optional, Standard `null` (Wächter B1). */
    secondaryGoalType: goalTypeSchema.nullable().default(null),
    /**
     * Konkretes Abnehmziel (docs/PLAN-ZIELE.md 2.4, Etappe Z2): optional, Standard `null` (Wächter B1). Wirkt nur mit
     * gültiger Einwilligung, im Modus `full` und mit Abnehmen als Haupt- oder Nebenziel – und kann das Defizit nur
     * verkleinern (F5).
     */
    weightGoal: weightGoalSchema.nullable().default(null),
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
  .refine((inputs) => isAllowedGoalPair(inputs.goalType, inputs.secondaryGoalType), {
    path: ['secondaryGoalType'],
    message: 'Diese Kombination von Zielen ist nicht möglich.',
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
  // Zod prüft die Verfeinerung auch nach einem Formatfehler – dann nie werfen, sondern ablehnen (Gerätespeicher).
  (date) => isoDateSchema.safeParse(date).success && isoWeekday(date) === 1,
  'Die Woche beginnt am Montag.',
);

/**
 * `surplusCap` ist IMMER gesetzt und liegt in [0,05; 0,10] (H2) – nie 0 und nie undefiniert, damit das Band bei
 * `maintenance_only` nie zu einem Punkt wird. `deficitCap` liegt in [0; 0,25] (CLAUDE.md).
 */
export const surplusCapSchema = z.number().min(SURPLUS_CAP.special).max(SURPLUS_CAP.default);
export const deficitCapSchema = z.number().min(0).max(MAX_CALORIE_DEFICIT_FRACTION);

// ---------------------------------------------------------------------------------------------------------
// Essensplan (Etappe N3, docs/PLAN-PHASE-5.md 6.1–6.4)
// ---------------------------------------------------------------------------------------------------------

/** Was beim Meal-Prep vorgekocht wird (Plan 6.4, `mealprep_slots`): Mittag (Standard) oder Mittag + Abend. */
export const MEALPREP_SLOT_MODES = ['lunch', 'lunch_dinner'] as const;
export type MealprepSlotMode = (typeof MEALPREP_SLOT_MODES)[number];

const groupList = z
  .array(foodGroupSchema)
  .max(23)
  .default([])
  .refine((groups) => new Set(groups).size === groups.length, 'Jede Gruppe nur einmal.');

/**
 * Vorlieben für den Essensplan (Plan 4.2 `prefs`, 6.1). Unverträglichkeiten sind Art.-9-Daten und kommen nur mit
 * gültiger `health_data`-Einwilligung hierher (die App gibt sie sonst nicht weiter). Die Ernährungsform ist Teil
 * des Schutzes im Essensplan (in der Rezeptsuche erweiterbar, 19.6 K3).
 * - Schwein nur bei `eatsPork === true`; `null` bei Mischkost zählt wie „nein“ (W10, G2).
 * - „Mag ich“ und „mag ich nicht“ derselben Gruppe schließen sich aus (Unique-Index `like_xor_dislike`);
 *   Unverträglichkeit + „mag ich“ ist erlaubt – die Unverträglichkeit gewinnt (K9).
 */
export const mealPlanProfileSchema = z
  .strictObject({
    diet: z.enum(DIET_TYPES),
    eatsPork: z.boolean().nullable().default(null),
    cookingMode: z.enum(COOKING_MODES).default('daily'),
    mealprepDays: z
      .number()
      .int()
      .min(NUTRITION_LIMITS.mealPrepDaysPerWeek.min)
      .max(NUTRITION_LIMITS.mealPrepDaysPerWeek.max)
      .nullable()
      .default(null),
    mealprepSlots: z.enum(MEALPREP_SLOT_MODES).default('lunch'),
    likes: groupList,
    dislikes: groupList,
    intolerances: groupList,
    /** Optional „werktags höchstens X Minuten“ (Plan 6.1, 7.2: 10–120). */
    maxPrepMinutesWeekday: z.number().int().min(10).max(120).nullable().default(null),
  })
  .superRefine((profile, ctx) => {
    if (profile.diet !== 'omnivore' && profile.eatsPork === true) {
      ctx.addIssue({
        code: 'custom',
        path: ['eatsPork'],
        message: 'Bei vegetarischer oder veganer Ernährung gibt es kein Schweinefleisch.',
      });
    }
    if (profile.cookingMode === 'meal_prep' && profile.mealprepDays === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['mealprepDays'],
        message: 'Meal-Prep braucht die Anzahl Kochtage pro Woche (1–7).',
      });
    }
    const dislikes = new Set(profile.dislikes);
    if (profile.likes.some((group) => dislikes.has(group))) {
      ctx.addIssue({
        code: 'custom',
        path: ['likes'],
        message: 'Eine Gruppe kann nicht gleichzeitig „mag ich“ und „mag ich nicht“ sein.',
      });
    }
  });
export type MealPlanProfile = z.infer<typeof mealPlanProfileSchema>;
export type MealPlanProfileInput = z.input<typeof mealPlanProfileSchema>;

// ---------------------------------------------------------------------------------------------------------
// Onboarding-Schritt `nutrition_setup` (Etappe N4, docs/PLAN-PHASE-5.md 8.1)
// ---------------------------------------------------------------------------------------------------------

/**
 * Antworten des Schritts `nutrition_setup`. Die Alltagsaktivität ist PFLICHT (Wächter N1 K7): Ohne Angabe rechnet die
 * Engine mit dem niedrigsten Faktor 1,45, der aktive Menschen unterschätzt – deshalb wird sie wirklich abgefragt.
 * Die Trainingszeit hat die Antwort „unterschiedlich“ (`varies`). `mealprepSlots` nur bei Meal-Prep (sonst `null`).
 * „Kalorienzahlen anzeigen“ ist eine aktive Einstellung (Standard an, Frage 16 B (h)).
 */
export const nutritionSetupStepSchema = z.strictObject({
  activityLevel: activityLevelSchema,
  trainingTime: trainingTimeSchema,
  mealprepSlots: z.enum(MEALPREP_SLOT_MODES).nullable().default(null),
  showEnergyNumbers: z.boolean(),
});
export type NutritionSetupStep = z.infer<typeof nutritionSetupStepSchema>;
export type NutritionSetupStepInput = z.input<typeof nutritionSetupStepSchema>;

/**
 * Gespeicherte Antworten – Spaltennamen wie die künftigen `nutrition_prefs`-Spalten aus Etappe N7 (7.2). Bis N7 nur
 * im Testmodus (Gerätespeicher, wird beim Laden mit diesem Schema geprüft). Kein Gesundheitsdatum.
 */
export const nutritionSetupColumnsSchema = z.strictObject({
  activity_level: activityLevelSchema,
  training_time: trainingTimeSchema,
  mealprep_slots: z.enum(MEALPREP_SLOT_MODES),
  show_energy_numbers: z.boolean(),
});
export type NutritionSetupColumns = z.infer<typeof nutritionSetupColumnsSchema>;

/** Antworten → Spalten (`mealprep_slots` ohne Meal-Prep: Standard „Mittag“, Frage 16 A (10)). */
export function nutritionSetupColumns(step: NutritionSetupStepInput): NutritionSetupColumns {
  const parsed = nutritionSetupStepSchema.parse(step);
  return {
    activity_level: parsed.activityLevel,
    training_time: parsed.trainingTime,
    mealprep_slots: parsed.mealprepSlots ?? 'lunch',
    show_energy_numbers: parsed.showEnergyNumbers,
  };
}

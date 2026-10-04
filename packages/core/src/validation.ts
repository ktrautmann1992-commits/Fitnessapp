import { z } from 'zod';

import { ageInYears, isoDateSchema } from './age';
import {
  BARBELL_BAR_KG,
  BARBELL_PLATE_MAX_KG,
  BIRTH_DATE_MIN,
  BODY_METRIC_LIMITS,
  EQUIPMENT_LIMITS,
  EQUIPMENT_WEIGHT_DECIMALS,
  MIN_AGE_YEARS,
  NUTRITION_LIMITS,
} from './constants';
import {
  APP_LOCALES,
  COOKING_MODES,
  DIET_TYPES,
  ENDURANCE_DISCIPLINES,
  EQUIPMENT_LOCATIONS,
  EXPERIENCE_LEVELS,
  FOOD_PREFERENCE_KINDS,
  GOAL_TYPES,
  SEX_OPTIONS,
  TRAINING_LOCATIONS,
} from './enums';
import {
  BARBELL_ID,
  equipmentIdSchema,
  findEquipment,
  isHomeSelectable,
  OTHER_EQUIPMENT_ID,
} from './equipment';
import { foodGroupSchema } from './food-groups';

/**
 * Zod-Schemas für alle Onboarding-Eingaben (Prüfung in App/Website).
 * Die Grenzen sind dieselben wie die CHECK-Bedingungen in der Datenbank (beide aus constants.ts).
 * Funktionen mit `today` (ISO-Datum) sind deterministisch testbar – die App übergibt das heutige Datum.
 */

function range(limits: { min: number; max: number }, label: string, unit: string) {
  return z
    .number({ error: `${label}: bitte eine Zahl eingeben.` })
    .min(limits.min, `${label}: mindestens ${limits.min}${unit}.`)
    .max(limits.max, `${label}: höchstens ${limits.max}${unit}.`);
}

function intRange(limits: { min: number; max: number }, label: string, unit: string) {
  return range(limits, label, unit).int(`${label}: bitte eine ganze Zahl eingeben.`);
}

// ---------------------------------------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------------------------------------
export const sexSchema = z.enum(SEX_OPTIONS);
export const experienceLevelSchema = z.enum(EXPERIENCE_LEVELS);
export const localeSchema = z.enum(APP_LOCALES);

/** Geburtsdatum: gültiges Datum, nicht vor 1900, nicht in der Zukunft, Mindestalter 16. */
export function createBirthDateSchema(today: string) {
  return isoDateSchema.superRefine((birthDate, ctx) => {
    // Zod prüft Verfeinerungen auch nach einem Formatfehler – dann hier nichts weiter prüfen.
    if (!isoDateSchema.safeParse(birthDate).success) {
      return;
    }
    if (birthDate < BIRTH_DATE_MIN) {
      ctx.addIssue({ code: 'custom', message: 'Bitte ein gültiges Geburtsdatum eingeben.' });
      return;
    }
    if (birthDate > today) {
      ctx.addIssue({ code: 'custom', message: 'Das Geburtsdatum liegt in der Zukunft.' });
      return;
    }
    if (ageInYears(birthDate, today) < MIN_AGE_YEARS) {
      ctx.addIssue({ code: 'custom', message: `Die App ist ab ${MIN_AGE_YEARS} Jahren nutzbar.` });
    }
  });
}

/** Schritt „Geschlecht“ (+ Interesse am Zyklus-Modul nur bei „weiblich“). */
export const sexStepSchema = z
  .strictObject({
    sex: sexSchema,
    cycleModuleInterest: z.boolean().nullable().optional(),
  })
  .refine((value) => value.sex === 'female' || value.cycleModuleInterest == null, {
    path: ['cycleModuleInterest'],
    message: 'Das Zyklus-Modul wird nur bei „weiblich“ angeboten.',
  });

/** Schritt „Trainingserfahrung“. */
export const experienceStepSchema = z.strictObject({ experienceLevel: experienceLevelSchema });

// ---------------------------------------------------------------------------------------------------------
// Körperdaten (nur mit Einwilligung health_data)
// ---------------------------------------------------------------------------------------------------------
export const bodyMetricsStepSchema = z.strictObject({
  heightCm: range(BODY_METRIC_LIMITS.heightCm, 'Größe', ' cm'),
  weightKg: range(BODY_METRIC_LIMITS.weightKg, 'Gewicht', ' kg'),
  bodyFatPct: range(BODY_METRIC_LIMITS.bodyFatPct, 'Körperfett', ' %').nullable().optional(),
  restingHeartRateBpm: intRange(BODY_METRIC_LIMITS.restingHeartRateBpm, 'Ruhepuls', ' Schläge/min')
    .nullable()
    .optional(),
});
export type BodyMetricsStep = z.infer<typeof bodyMetricsStepSchema>;

// ---------------------------------------------------------------------------------------------------------
// Ziel, Trainingsort (abgeleitet, training-schedule.ts)
// ---------------------------------------------------------------------------------------------------------
export const goalTypeSchema = z.enum(GOAL_TYPES);
export const enduranceDisciplineSchema = z.enum(ENDURANCE_DISCIPLINES);
export const trainingLocationSchema = z.enum(TRAINING_LOCATIONS);

/** Schritt „Ziel“: Disziplin nur bei Ausdauer, Wettkampf-/Zieldatum optional und nicht in der Vergangenheit. */
export function createGoalStepSchema(today: string) {
  return z
    .strictObject({
      goalType: goalTypeSchema,
      discipline: enduranceDisciplineSchema.nullable().optional(),
      targetDate: isoDateSchema
        .refine((date) => date >= today, 'Das Datum liegt in der Vergangenheit.')
        .nullable()
        .optional(),
    })
    .refine((value) => value.discipline == null || value.goalType === 'endurance', {
      path: ['discipline'],
      message: 'Eine Disziplin gibt es nur beim Ziel Ausdauer.',
    });
}

/** Wochentag nach ISO 8601: 1 = Montag … 7 = Sonntag. */
export const weekdaySchema = z.number().int().min(1).max(7);

// Der Schritt „Deine Trainingstage“ (ersetzt Zeitbudget + Trainingsort) steht in training-schedule.ts.

// ---------------------------------------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------------------------------------
const WEIGHT_FACTOR = 10 ** EQUIPMENT_WEIGHT_DECIMALS;

/** Höchstens 2 Nachkommastellen (wie numeric(5,2) in der Datenbank); Toleranz für Gleitkomma-Fehler. */
function hasAtMostWeightDecimals(value: number): boolean {
  const scaled = value * WEIGHT_FACTOR;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/** Eine Gewichtsstufe in kg: 0,25–200, höchstens 2 Nachkommastellen, auf 0,01 kg normalisiert. */
export const weightStepKgSchema = range(EQUIPMENT_LIMITS.weightStepKg, 'Gewichtsstufe', ' kg')
  .refine(hasAtMostWeightDecimals, 'Gewichtsstufe: höchstens 2 Nachkommastellen.')
  .transform((value) => Math.round(value * WEIGHT_FACTOR) / WEIGHT_FACTOR);

export const equipmentLocationSchema = z.enum(EQUIPMENT_LOCATIONS);

/** Langhantel-Stange in kg: 5–25, höchstens 2 Nachkommastellen (numeric(4,2) in der Datenbank). */
export const barbellBarKgSchema = range(BARBELL_BAR_KG, 'Stange', ' kg')
  .refine(hasAtMostWeightDecimals, 'Stange: höchstens 2 Nachkommastellen.')
  .transform((value) => Math.round(value * WEIGHT_FACTOR) / WEIGHT_FACTOR);

export const equipmentItemSchema = z
  .strictObject({
    equipmentId: equipmentIdSchema,
    location: equipmentLocationSchema,
    weightsKg: z
      .array(weightStepKgSchema)
      .max(
        EQUIPMENT_LIMITS.maxWeightSteps,
        `Höchstens ${EQUIPMENT_LIMITS.maxWeightSteps} Gewichtsstufen.`,
      )
      .refine(
        (weights) => new Set(weights).size === weights.length,
        'Jede Gewichtsstufe nur einmal.',
      )
      .default([]),
    note: z.string().trim().min(1).max(EQUIPMENT_LIMITS.noteMaxLength).nullable().optional(),
    /** Nur Langhantel: Gewicht der Stange (weightsKg sind dann die Scheiben je Paar). */
    barKg: barbellBarKgSchema.nullable().optional(),
  })
  .superRefine((item, ctx) => {
    const isOther = item.equipmentId === OTHER_EQUIPMENT_ID;
    if (isOther && item.note == null) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Bitte beschreibe das Gerät.' });
    }
    if (!isOther && item.note != null) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Freitext nur bei „Sonstiges“.' });
    }
    // Studio-Geräte (Kabelzug, Maschinen …) gibt es nicht „zu Hause“ – gleiche Regel wie der Trigger
    // private.check_user_equipment_home_selectable() in der Datenbank.
    if (item.location === 'home' && !isHomeSelectable(item.equipmentId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['equipmentId'],
        message: 'Dieses Gerät gibt es nur im Studio.',
      });
    }
    if (item.weightsKg.length > 0 && findEquipment(item.equipmentId)?.hasWeights !== true) {
      ctx.addIssue({
        code: 'custom',
        path: ['weightsKg'],
        message: 'Für dieses Gerät gibt es keine Gewichtsstufen.',
      });
    }
    // Langhantel: Stange getrennt, Scheiben höchstens 25 kg (gleiche Regel wie die CHECKs in user_equipment).
    if (item.barKg != null && item.equipmentId !== BARBELL_ID) {
      ctx.addIssue({
        code: 'custom',
        path: ['barKg'],
        message: 'Eine Stange gibt es nur bei der Langhantel.',
      });
    }
    if (
      item.equipmentId === BARBELL_ID &&
      item.weightsKg.some((weight) => weight > BARBELL_PLATE_MAX_KG)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['weightsKg'],
        message: `Hantelscheiben: höchstens ${BARBELL_PLATE_MAX_KG} kg je Scheibe.`,
      });
    }
  });
export type EquipmentItemInput = z.infer<typeof equipmentItemSchema>;

/** Schritt „Equipment“: jedes Gerät je Ort höchstens einmal (Liste darf leer sein). */
export const equipmentStepSchema = z.strictObject({
  items: z
    .array(equipmentItemSchema)
    .refine(
      (items) =>
        new Set(items.map((item) => `${item.equipmentId}@${item.location}`)).size === items.length,
      'Jedes Gerät je Ort nur einmal.',
    ),
});

// ---------------------------------------------------------------------------------------------------------
// Ernährung und Kochmodus
// ---------------------------------------------------------------------------------------------------------
export const dietTypeSchema = z.enum(DIET_TYPES);
export const cookingModeSchema = z.enum(COOKING_MODES);
export const foodPreferenceKindSchema = z.enum(FOOD_PREFERENCE_KINDS);

export const foodPreferenceSchema = z.strictObject({
  foodGroup: foodGroupSchema,
  kind: foodPreferenceKindSchema,
});
export type FoodPreferenceInput = z.infer<typeof foodPreferenceSchema>;

/**
 * Schritt „Ernährung“. Unverträglichkeiten (kind = intolerance) dürfen nur mit Einwilligung health_data
 * gespeichert werden – siehe foodPreferenceRequiresHealthConsent() in consent.ts.
 */
export const nutritionStepSchema = z
  .strictObject({
    dietType: dietTypeSchema,
    eatsPork: z.boolean().nullable().optional(),
    mealsPerDay: intRange(NUTRITION_LIMITS.mealsPerDay, 'Mahlzeiten pro Tag', ''),
    foodPreferences: z.array(foodPreferenceSchema).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.dietType !== 'omnivore' && value.eatsPork === true) {
      ctx.addIssue({
        code: 'custom',
        path: ['eatsPork'],
        message: 'Bei vegetarischer oder veganer Ernährung gibt es kein Schweinefleisch.',
      });
    }
    const seen = new Set<string>();
    const likeOrDislike = new Set<string>();
    for (const preference of value.foodPreferences) {
      const key = `${preference.foodGroup}:${preference.kind}`;
      if (seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['foodPreferences'], message: 'Doppelter Eintrag.' });
      }
      seen.add(key);
      if (preference.kind !== 'intolerance') {
        if (likeOrDislike.has(preference.foodGroup)) {
          ctx.addIssue({
            code: 'custom',
            path: ['foodPreferences'],
            message: '„Mag ich“ und „mag ich nicht“ schließen sich aus.',
          });
        }
        likeOrDislike.add(preference.foodGroup);
      }
    }
  });
export type NutritionStep = z.infer<typeof nutritionStepSchema>;

/** Schritt „Kochmodus“: Meal-Prep braucht die Anzahl Tage pro Woche (1–7), „täglich frisch“ keine. */
export const cookingStepSchema = z.discriminatedUnion('cookingMode', [
  z.strictObject({ cookingMode: z.literal('daily') }),
  z.strictObject({
    cookingMode: z.literal('meal_prep'),
    mealprepDays: intRange(NUTRITION_LIMITS.mealPrepDaysPerWeek, 'Meal-Prep-Tage pro Woche', ''),
  }),
]);
export type CookingStep = z.infer<typeof cookingStepSchema>;

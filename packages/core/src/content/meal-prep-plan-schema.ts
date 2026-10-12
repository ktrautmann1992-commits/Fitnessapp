import { z } from 'zod';

import { CONTENT_SCHEMA_LIMITS, MEAL_PREP_PLAN_LIMITS } from '../constants';
import { CONTENT_STATUSES } from '../enums';
import { importedContentMetaSchema } from './import-meta';
import { contentIdSchema } from './schemas';

/**
 * Meal-Prep-Wochenpläne `content/meal-prep-plans/<id>.json` (docs/PLAN-PHASE-5.md 19.4, Etappe N2c) – Regel R1
 * (Schema) und R20 (Rezepte, Kochtag, Aufbewahrung). Gekocht wird am Sonntag vor der Woche; der Plan deckt die
 * Mittags-/Frühstücks-/Snack-Slots von Montag bis Freitag ab (Abendessen frisch, 19.6).
 */

/** Wochentage eines Meal-Prep-Plans (Kochtag = Sonntag davor). */
export const PREP_WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
export type PrepWeekday = (typeof PREP_WEEKDAYS)[number];

export const PREP_WEEKDAY_LABELS_DE: Readonly<Record<PrepWeekday, string>> = {
  mon: 'Montag',
  tue: 'Dienstag',
  wed: 'Mittwoch',
  thu: 'Donnerstag',
  fri: 'Freitag',
};

/** Tage zwischen Kochtag (Sonntag) und dem Wochentag: Montag 1 … Freitag 5. */
export function daysAfterCookDay(weekday: PrepWeekday): number {
  return PREP_WEEKDAYS.indexOf(weekday) + 1;
}

/** Aufbewahrung je Rezept und Tag (S10): Kühlschrank, eingefroren oder am Tag frisch gekocht. */
export const STORAGE_METHODS = ['fridge', 'freeze', 'fresh'] as const;
export type StorageMethod = (typeof STORAGE_METHODS)[number];

function text(min: number, max: number) {
  return z
    .string()
    .min(min, `Mindestens ${min} Zeichen.`)
    .max(max, `Höchstens ${max} Zeichen.`)
    .refine((value) => value === value.trim(), 'Kein Leerzeichen am Anfang oder Ende.');
}

const P = MEAL_PREP_PLAN_LIMITS;

export const cookStepSchema = z.strictObject({
  start_min: z
    .number()
    .int('Ganze Zahl erwartet.')
    .min(P.cookStepMinute.min)
    .max(P.cookStepMinute.max),
  text_de: text(3, 300),
});
export type CookStep = z.infer<typeof cookStepSchema>;

export const storagePlanEntrySchema = z.strictObject({
  recipe_id: contentIdSchema,
  weekday: z.enum(PREP_WEEKDAYS),
  method: z.enum(STORAGE_METHODS),
});
export type StoragePlanEntry = z.infer<typeof storagePlanEntrySchema>;

export const mealPrepPlanSchema = z
  .strictObject({
    id: contentIdSchema,
    version: z
      .number()
      .int('Ganze Zahl erwartet.')
      .min(CONTENT_SCHEMA_LIMITS.version.min)
      .max(CONTENT_SCHEMA_LIMITS.version.max),
    status: z.enum(CONTENT_STATUSES),
    title_de: text(3, 100),
    description_de: text(10, 300),
    recipe_ids: z
      .array(contentIdSchema)
      .min(P.recipes.min)
      .max(P.recipes.max)
      .refine((ids) => new Set(ids).size === ids.length, 'Doppelte Einträge.'),
    cook_steps: z.array(cookStepSchema).min(P.cookSteps.min).max(P.cookSteps.max),
    storage_plan: z.array(storagePlanEntrySchema).max(P.recipes.max * PREP_WEEKDAYS.length),
    storage_de: z.array(text(5, 300)).max(P.storageTexts),
    dinner_hint_de: text(5, 300).optional(),
    meta: importedContentMetaSchema,
  })
  .superRefine((plan, ctx) => {
    if (plan.status === 'published' && plan.meta.reviewed_by === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['meta', 'reviewed_by'],
        message: 'Freigegeben ohne Prüfer: bitte „reviewed_by“ und „reviewed_at“ eintragen.',
      });
    }
  });
export type MealPrepPlan = z.infer<typeof mealPrepPlanSchema>;

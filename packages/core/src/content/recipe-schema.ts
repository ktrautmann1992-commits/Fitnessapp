import { z } from 'zod';

import { CONTENT_SCHEMA_LIMITS, MEAL_PREP_FRIDGE_DAYS, RECIPE_SCHEMA_LIMITS } from '../constants';
import { CONTENT_STATUSES, DIET_TYPES } from '../enums';
import { foodGroupSchema } from '../food-groups';
import { recipeUnitSchema } from '../nutrition/units';
import { contentIdSchema, contentMetaSchema } from './schemas';

/**
 * Rezepte `content/recipes/<id>.json` (docs/PLAN-PHASE-5.md 5.2) – Regel R1 („Schema korrekt“, rot auch bei
 * Entwürfen). Einzige Wahrheit sind die Zutaten: Nährwerte, Ernährungsform, Allergene, Schwein und
 * Schwangerschafts-Vorsicht berechnet der Core (`nutrition/recipe-nutrients.ts`); die deklarierten Angaben dienen
 * nur der Gegenprüfung (R3, R6, R7, R8, R13).
 */

export const MEAL_TYPES = ['breakfast', 'main', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const TRAINING_TAGS = ['vor_training', 'waehrend', 'nach_training'] as const;
export type TrainingTag = (typeof TRAINING_TAGS)[number];

function text(min: number, max: number) {
  return z
    .string()
    .min(min, `Mindestens ${min} Zeichen.`)
    .max(max, `Höchstens ${max} Zeichen.`)
    .refine((value) => value === value.trim(), 'Kein Leerzeichen am Anfang oder Ende.');
}

function distinct<T extends z.ZodType>(item: T, max: number, min = 0) {
  return z
    .array(item)
    .min(min)
    .max(max)
    .refine((values) => new Set(values).size === values.length, 'Doppelte Einträge.');
}

const L = RECIPE_SCHEMA_LIMITS;
const intIn = (limits: { min: number; max: number }) =>
  z.number().int('Ganze Zahl erwartet.').min(limits.min).max(limits.max);

/**
 * Zutat (Plan 5.2). `heated` (R2-S2): Pflicht für jede Zutat aus `eggs`, `fish`, `shellfish`, mit `animal: meat`
 * oder Rohmilch – das prüft die Gegenprüfung mit dem Katalog (`checkRecipe`, R1), weil das Schema allein die
 * Gruppen des Lebensmittels nicht kennt.
 */
export const recipeIngredientSchema = z.strictObject({
  food_id: contentIdSchema,
  amount: z.number().finite().min(L.amount.min).max(L.amount.max),
  unit: recipeUnitSchema,
  optional: z.boolean(),
  note_de: text(2, 100).optional(),
  /** Anzeige wie im Rezept, z. B. „1 EL (10 g)“ (aus `alpha5-rezepte.json` → `anzeige`, Import N2c). */
  display_de: text(1, 60).optional(),
  scales: z.boolean(),
  heated: z.boolean().optional(),
});
export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;

const macroG = z.number().finite().min(L.declaredMacroG.min).max(L.declaredMacroG.max);

export const recipeSchema = z
  .strictObject({
    id: contentIdSchema,
    version: intIn(CONTENT_SCHEMA_LIMITS.version),
    status: z.enum(CONTENT_STATUSES),
    title_de: text(3, 100),
    description_de: text(10, 200),
    meal_types: distinct(z.enum(MEAL_TYPES), MEAL_TYPES.length, 1),
    training_tags: distinct(z.enum(TRAINING_TAGS), TRAINING_TAGS.length),
    servings: intIn(L.servings),
    ingredients: z.array(recipeIngredientSchema).min(L.ingredients.min).max(L.ingredients.max),
    steps_de: z.array(text(5, 300)).min(L.steps.min).max(L.steps.max),
    /** Tipp zum Rezept (aus `alpha5-rezepte.json` → `tipp`, Import N2c). */
    tip_de: text(5, 400).optional(),
    /** Freie Anzeige-Schlagworte, z. B. „Unter 10 Minuten“, „zum Mitnehmen“ (→ `tags`, N2c). Keine Fachlogik. */
    tags_de: distinct(text(2, 40), 10).optional(),
    /** Zugehöriger Meal-Prep-Wochenplan (→ `meal_prep_plan`, N2c/N3). */
    meal_prep_plan_id: contentIdSchema.optional(),
    prep_minutes: intIn(L.prepMinutes),
    cook_minutes: intIn(L.cookMinutes),
    no_cook: z.boolean(),
    meal_prep: z.strictObject({
      suitable: z.boolean(),
      fridge_days: z.number().int('Ganze Zahl erwartet.').min(0).max(MEAL_PREP_FRIDGE_DAYS.max),
      freezable: z.boolean(),
    }),
    equipment_de: distinct(text(2, 60), L.equipment),
    declared_per_serving: z.strictObject({
      kcal: z.number().finite().min(L.declaredKcal.min).max(L.declaredKcal.max),
      protein_g: macroG,
      carbs_g: macroG,
      fat_g: macroG,
    }),
    declared_diet: z.enum(DIET_TYPES),
    declared_allergens: distinct(foodGroupSchema, 23),
    contains_pork: z.boolean(),
    declared_pregnancy_caution: z.boolean(),
    /** Reserviert (Plan 2.2: Budget nicht im Kern). */
    cost_level: intIn(L.costLevel).optional(),
    meta: contentMetaSchema,
  })
  .superRefine((recipe, ctx) => {
    if (recipe.no_cook) {
      recipe.ingredients.forEach((ingredient, index) => {
        if (ingredient.heated === true) {
          ctx.addIssue({
            code: 'custom',
            path: ['ingredients', index, 'heated'],
            message: 'Rezept ohne Kochen („no_cook“) kann keine erhitzte Zutat haben.',
          });
        }
      });
    }
    if (recipe.ingredients.every((i) => i.optional)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ingredients'],
        message: 'Mindestens eine Zutat darf nicht optional sein.',
      });
    }
    if (
      !recipe.meal_prep.suitable &&
      (recipe.meal_prep.fridge_days > 0 || recipe.meal_prep.freezable)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['meal_prep'],
        message: 'Nicht für Meal-Prep geeignet: „fridge_days“ = 0 und „freezable“ = false.',
      });
    }
    if (recipe.status === 'published' && recipe.meta.reviewed_by === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['meta', 'reviewed_by'],
        message: 'Freigegeben ohne Prüfer: bitte „reviewed_by“ und „reviewed_at“ eintragen.',
      });
    }
  });
export type Recipe = z.infer<typeof recipeSchema>;

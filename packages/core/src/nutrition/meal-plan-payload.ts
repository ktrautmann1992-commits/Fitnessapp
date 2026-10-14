import { z } from 'zod';

import { isoDateSchema } from '../age';
import {
  INGREDIENT_SUBSTITUTION_LIMITS,
  MEAL_PLAN_ENGINE_VERSION,
  NUTRITION_LIMITS,
  PORTION_SCALE_LIMITS,
  RECIPE_SCHEMA_LIMITS,
} from '../constants';
import { contentIdSchema } from '../content/schemas';
import { addDays } from '../dates';
import { COOKING_MODES, DIET_TYPES } from '../enums';
import { EXTRA_SLOTS, type MealPlanWeek } from './meal-plan';
import { MEALPREP_SLOT_MODES } from '../enums';
import { weekStartSchema } from './schemas';
import type { MealSlotId } from './timing';

/**
 * Payload eines Essensplans zum Speichern (docs/PLAN-PHASE-5.md 7.2/7.3, `mealPlanPayloadSchema`): Testmodus
 * (`localDb`, N4/N5) und `save_meal_plan` (seit N7 in der Datenbank, prüft serverseitig erneut; Feldlisten gleicht
 * db-sync.test.ts ab). Nur bekannte Felder (strikt).
 * `inputs` enthält bewusst KEINE Körperdaten, Flags, Unverträglichkeiten, Abneigungen und kein „ohne Schwein“
 * (K8, 7.1); `uses_health_data` setzt der Server. Keine Ziele, kein Planband (die Engine speichert keine Ziele).
 *
 * Ersatz, Weglassen und Tausch stehen je Zutat-STELLE (`index`) mit dem Lebensmittel dort (Wächter N7 S3); je Stelle
 * höchstens eine Änderung.
 *
 * Hinweis für N7 (Wächter N3 K5): `substitutions` und `omitted_optional` lassen indirekt auf Unverträglichkeiten
 * schließen (z. B. laktosefreie Milch). Der Server setzt deshalb `uses_health_data = true`, sobald Ersatz oder
 * Weglassen vorkommt bzw. Unverträglichkeiten gefiltert wurden (7.1).
 *
 * Zutaten-Austausch (19.7 N9, S7): `ingredient_swaps` nennt je Mahlzeit die getauschten Zutaten (Lebensmittel →
 * Ersatz). `save_meal_plan` (N7) prüft, dass es den Eintrag `published` in `ingredient_substitutions` gibt, und prüft
 * Ernährungsform, Schwein und Unverträglichkeiten mit `groups`, `animal`, `meat_kind` des Ersatzes erneut
 * (`pregnancy_caution` wie bisher nur im Core, R2-K8). Mengen kommen nie aus der Payload. Wie bei Ersatz und
 * Weglassen setzt der Server `uses_health_data = true`, sobald `ingredient_swaps` nicht leer ist (Wächter N9 S5; der
 * Core setzt `usesHealthData` am Plan schon jetzt).
 */

/** Plätze einer Mahlzeit = CHECK-Liste `meal_plan_items.slot` (db-sync.test.ts). */
export const MEAL_PLAN_SLOT_KEYS = [
  'main',
  'breakfast',
  'snack_morning',
  'lunch',
  'snack_afternoon',
  'snack_pre_dinner',
  'dinner',
  'snack_late',
  'snack_night',
  ...EXTRA_SLOTS,
] as const satisfies readonly (MealSlotId | (typeof EXTRA_SLOTS)[number])[];

const macro = z.number().finite().min(0).max(10_000);

/**
 * Stelle einer Zutat im Rezept (0-basiert, = `recipe_ingredients.position`). Ersatz, Weglassen und Tausch gelten je
 * Stelle, nicht je Lebensmittel (Wächter N7 S3): Ein Rezept darf dieselbe Zutat mehrfach enthalten (z. B. Milch einmal
 * Pflicht, einmal optional). `food_id` ist das Lebensmittel an dieser Stelle (der Server prüft beides).
 */
const ingredientIndexSchema = z
  .number()
  .int()
  .min(0)
  .max(RECIPE_SCHEMA_LIMITS.ingredients.max - 1);

/** Ersatzprodukt (S4) bzw. Zutaten-Tausch (N9) an einer Stelle. */
export const ingredientChangeSchema = z.strictObject({
  index: ingredientIndexSchema,
  food_id: contentIdSchema,
  substitute_food_id: contentIdSchema,
});

/** Weggelassene optionale Zutat (S3) an einer Stelle. */
export const ingredientOmissionSchema = z.strictObject({
  index: ingredientIndexSchema,
  food_id: contentIdSchema,
});

export const mealPlanItemPayloadSchema = z
  .strictObject({
    date: isoDateSchema,
    slot: z.enum(MEAL_PLAN_SLOT_KEYS),
    role: z.enum(['pre', 'post', 'pre_snack']).nullable(),
    recipe_id: contentIdSchema,
    recipe_version: z.number().int().min(1),
    title_de: z.string().min(1).max(100),
    factor: z.number().finite().min(PORTION_SCALE_LIMITS.min).max(PORTION_SCALE_LIMITS.max),
    kcal: macro,
    protein_g: macro,
    carbs_g: macro,
    fat_g: macro,
    substitutions: z.array(ingredientChangeSchema).max(RECIPE_SCHEMA_LIMITS.ingredients.max),
    omitted_optional: z.array(ingredientOmissionSchema).max(RECIPE_SCHEMA_LIMITS.ingredients.max),
    ingredient_swaps: z
      .array(ingredientChangeSchema)
      .max(INGREDIENT_SUBSTITUTION_LIMITS.swapsPerMeal),
    is_fill: z.boolean(),
    prep_kind: z.enum(['cook', 'leftover', 'fresh']),
    cook_date: isoDateSchema,
    storage: z.enum(['fridge', 'freeze']).nullable(),
    meal_prep_plan_id: contentIdSchema.nullable(),
    day_status: z.enum(['complete', 'below_floor', 'no_targets']),
  })
  .refine(
    (item) => {
      const indices = [
        ...item.substitutions.map((c) => c.index),
        ...item.omitted_optional.map((c) => c.index),
        ...item.ingredient_swaps.map((c) => c.index),
      ];
      return new Set(indices).size === indices.length;
    },
    { path: ['substitutions'], message: 'Zutat mehrfach geändert.' },
  );
export type MealPlanItemPayload = z.infer<typeof mealPlanItemPayloadSchema>;

export const mealPlanPayloadSchema = z
  .strictObject({
    week_start: weekStartSchema,
    engine_version: z.number().int().min(1).max(MEAL_PLAN_ENGINE_VERSION),
    variant: z.number().int().min(0).max(10_000),
    meal_prep_plan_id: contentIdSchema.nullable(),
    inputs: z.strictObject({
      diet: z.enum(DIET_TYPES),
      meals_per_day: z
        .number()
        .int()
        .min(NUTRITION_LIMITS.mealsPerDay.min)
        .max(NUTRITION_LIMITS.mealsPerDay.max),
      cooking_mode: z.enum(COOKING_MODES),
      mealprep_days: z
        .number()
        .int()
        .min(NUTRITION_LIMITS.mealPrepDaysPerWeek.min)
        .max(NUTRITION_LIMITS.mealPrepDaysPerWeek.max)
        .nullable(),
      mealprep_slots: z.enum(MEALPREP_SLOT_MODES),
    }),
    items: z.array(mealPlanItemPayloadSchema).max(7 * (NUTRITION_LIMITS.mealsPerDay.max + 2)),
  })
  .superRefine((payload, ctx) => {
    const last = addDays(payload.week_start, 6);
    const seen = new Set<string>();
    payload.items.forEach((item, index) => {
      if (item.date < payload.week_start || item.date > last) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'date'],
          message: 'Datum liegt außerhalb der Woche.',
        });
      }
      const key = `${item.date}|${item.slot}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'slot'],
          message: 'Platz an diesem Tag doppelt belegt.',
        });
      }
      seen.add(key);
      // Gekocht wird höchstens am Sonntag vor der Woche und nie nach dem Tag selbst.
      if (item.cook_date < addDays(payload.week_start, -1) || item.cook_date > item.date) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'cook_date'],
          message: 'Kochtag passt nicht zum Tag.',
        });
      }
    });
  });
export type MealPlanPayload = z.infer<typeof mealPlanPayloadSchema>;

/** Wandelt einen Essensplan in die gespeicherte Form (ohne Gesundheitsdaten in `inputs`, K8). */
export function toMealPlanPayload(
  plan: MealPlanWeek,
  inputs: MealPlanPayload['inputs'],
): MealPlanPayload {
  // Geteilte Portionen (N13) haben bis P1 keine Spalte – sonst ginge `shared` beim Speichern still verloren (Wächter N13 NS1).
  if (plan.days.some((day) => day.meals.some((meal) => meal.shared === true))) {
    throw new Error('Pläne mit geteilter Mahlzeit sind bis P1 nicht speicherbar.');
  }
  const round1 = (value: number) => Math.round(value * 10) / 10;
  return mealPlanPayloadSchema.parse({
    week_start: plan.weekStart,
    engine_version: plan.engineVersion,
    variant: plan.variant,
    meal_prep_plan_id: plan.mealPrepPlanId,
    inputs,
    items: plan.days.flatMap((day) =>
      day.meals.map((meal) => ({
        date: day.date,
        slot: meal.slot,
        role: meal.role,
        recipe_id: meal.recipeId,
        recipe_version: meal.recipeVersion,
        title_de: meal.titleDe,
        factor: meal.factor,
        kcal: round1(meal.nutrients.kcal),
        protein_g: round1(meal.nutrients.protein_g),
        carbs_g: round1(meal.nutrients.carbs_g),
        fat_g: round1(meal.nutrients.fat_g),
        substitutions: meal.substitutions.map((s) => ({
          index: s.index,
          food_id: s.foodId,
          substitute_food_id: s.substituteFoodId,
        })),
        omitted_optional: meal.omittedOptional.map((o) => ({ index: o.index, food_id: o.foodId })),
        ingredient_swaps: (meal.ingredientSwaps ?? []).map((x) => ({
          index: x.index,
          food_id: x.foodId,
          substitute_food_id: x.substituteFoodId,
        })),
        is_fill: meal.isFill,
        prep_kind: meal.prepKind,
        cook_date: meal.cookDate,
        storage: meal.storage,
        meal_prep_plan_id: meal.mealPrepPlanId,
        day_status: day.status,
      })),
    ),
  });
}

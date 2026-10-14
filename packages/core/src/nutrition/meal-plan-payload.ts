import { z } from 'zod';

import { isoDateSchema } from '../age';
import {
  INGREDIENT_SUBSTITUTION_LIMITS,
  MEAL_PLAN_ENGINE_VERSION,
  NUTRITION_LIMITS,
  PORTION_SCALE_LIMITS,
} from '../constants';
import { contentIdSchema } from '../content/schemas';
import { addDays } from '../dates';
import { COOKING_MODES, DIET_TYPES } from '../enums';
import { EXTRA_SLOTS, type MealPlanWeek } from './meal-plan';
import { MEALPREP_SLOT_MODES, weekStartSchema } from './schemas';
import type { MealSlotId } from './timing';

/**
 * Payload eines Essensplans zum Speichern (docs/PLAN-PHASE-5.md 7.2/7.3, `mealPlanPayloadSchema`): Testmodus
 * (`localDb`, N4/N5) und später `save_meal_plan` (N7, prüft serverseitig erneut). Nur bekannte Felder (strikt).
 * `inputs` enthält bewusst KEINE Körperdaten, Flags, Unverträglichkeiten, Abneigungen und kein „ohne Schwein“
 * (K8, 7.1); `uses_health_data` setzt der Server. Keine Ziele, kein Planband (die Engine speichert keine Ziele).
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

const SLOT_KEYS = [
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

export const mealPlanItemPayloadSchema = z.strictObject({
  date: isoDateSchema,
  slot: z.enum(SLOT_KEYS),
  role: z.enum(['pre', 'post', 'pre_snack']).nullable(),
  recipe_id: contentIdSchema,
  recipe_version: z.number().int().min(1),
  title_de: z.string().min(1).max(100),
  factor: z.number().finite().min(PORTION_SCALE_LIMITS.min).max(PORTION_SCALE_LIMITS.max),
  kcal: macro,
  protein_g: macro,
  carbs_g: macro,
  fat_g: macro,
  substitutions: z
    .array(z.strictObject({ food_id: contentIdSchema, substitute_food_id: contentIdSchema }))
    .max(20),
  omitted_optional: z.array(contentIdSchema).max(20),
  ingredient_swaps: z
    .array(z.strictObject({ food_id: contentIdSchema, substitute_food_id: contentIdSchema }))
    .max(INGREDIENT_SUBSTITUTION_LIMITS.swapsPerMeal),
  is_fill: z.boolean(),
  prep_kind: z.enum(['cook', 'leftover', 'fresh']),
  cook_date: isoDateSchema,
  storage: z.enum(['fridge', 'freeze']).nullable(),
  meal_prep_plan_id: contentIdSchema.nullable(),
  day_status: z.enum(['complete', 'below_floor', 'no_targets']),
});
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
          food_id: s.foodId,
          substitute_food_id: s.substituteFoodId,
        })),
        omitted_optional: meal.omittedOptional.map((o) => o.foodId),
        ingredient_swaps: (meal.ingredientSwaps ?? []).map((x) => ({
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

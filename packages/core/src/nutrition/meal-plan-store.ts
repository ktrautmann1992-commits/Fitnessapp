import { z } from 'zod';

import { isoDateSchema } from '../age';
import {
  INGREDIENT_SUBSTITUTION_LIMITS,
  MEAL_PLAN_ENGINE_VERSION,
  MEAL_PLAN_RETENTION_WEEKS,
  MEAL_PLAN_UPDATE_MIN_CHANGE,
  MEAL_SLOT_TIMES,
} from '../constants';
import type { OPTIONAL_NUTRIENT_KEYS, REQUIRED_NUTRIENT_KEYS } from '../content/food-schema';
import { contentIdSchema } from '../content/schemas';
import { addDays, startOfIsoWeek } from '../dates';
import { CONTENT_STATUSES } from '../enums';
import { RECIPE_EXCLUSION_REASONS, SLOT_EXCLUSION_REASONS } from './filter';
import {
  buildMealPlanWeek,
  EXTRA_SLOTS,
  type MealPlanInput,
  type MealPlanWeek,
  mealPlanBand,
} from './meal-plan';
import { MEAL_PLAN_NOTICE_CODES } from './notices';
import type { FoodLookup } from '../content/food-schema';
import type { Recipe } from '../content/recipe-schema';
import type { IngredientSubstitution } from '../content/substitution-schema';
import { automaticReplan, needsAutomaticReplan, type ReplanReason } from './replan';
import { NUTRITION_MODES, weekStartSchema } from './schemas';
import { scalePortion } from './scale';
import { resolveIngredientSwaps } from './swap-resolve';
import type { NutritionWeekTargets } from './targets';
import { RECIPE_UNITS } from './units';

/**
 * Gespeicherter Essensplan (docs/PLAN-PHASE-5.md 6.3, 6.6, 7.5, 8.2 Nr. 2–3, Etappe N5): Ab N5 wird der Plan einer
 * Woche gespeichert, damit „Rezept tauschen“, „Andere Vorschläge“ und vergangene Tage fest bleiben. Hier stehen die
 * reinen Regeln dazu – die App speichert nur:
 *
 * - `parseStoredMealPlanWeek`: der Gerätespeicher ist nicht vertrauenswürdig – nur ein vollständiger Plan der
 *   aktuellen Engine-Version (Zod, strikt) wird verwendet, sonst gilt er als nicht vorhanden (neu erstellt).
 * - `resolveMealPlanWeek`: bei jedem Öffnen von „Heute“/„Ernährung“ (6.6): kein Plan → neu; Modus, Deckel, Planband
 *   oder Filter verletzt → automatisch ab heute neu (vergangene Tage bleiben); sonst der gespeicherte Plan, ggf. mit
 *   dem Angebot „Plan aktualisieren“ (Tagesziel ab heute ≥ 5 % geändert, ohne Sicherheitsbezug).
 * - „Andere Vorschläge“ (`mealPlanWithOtherSuggestions`, Variante + 1) und „Plan aktualisieren“
 *   (`refreshedMealPlan`, gleiche Variante) – beide ab heute, vergangene Tage und gekochte Reste fest.
 * - `mealPlanWeekEditable`: gespeichert/geändert wird nur die laufende und die nächste Woche (wie `save_meal_plan`).
 *
 * Gesundheitsdaten: Ein Plan mit `usesHealthData` ist ein Gesundheitsdatum (7.1) – nie loggen; beim Widerruf wird er
 * gelöscht (7.3/7.4).
 */

type PlanInput = Omit<MealPlanInput, 'existingPlan' | 'variant'>;

const MEAL_SLOT_KEYS = Object.keys(MEAL_SLOT_TIMES) as [
  keyof typeof MEAL_SLOT_TIMES,
  ...(keyof typeof MEAL_SLOT_TIMES)[],
];

const amount = z.number().finite().min(0).max(100_000);
const nutrientsSchema = z.strictObject({
  kcal: amount,
  protein_g: amount,
  carbs_g: amount,
  fat_g: amount,
  salt_g: amount,
  sugar_g: amount.nullable(),
  sat_fat_g: amount.nullable(),
  fiber_g: amount.nullable(),
}) satisfies z.ZodType<
  Record<(typeof REQUIRED_NUTRIENT_KEYS)[number], number> &
    Record<(typeof OPTIONAL_NUTRIENT_KEYS)[number], number | null>
>;

const ingredientSchema = z.strictObject({
  index: z.number().int().min(0).max(200),
  foodId: contentIdSchema,
  originalFoodId: contentIdSchema.nullable(),
  amount,
  unit: z.enum(RECIPE_UNITS),
  optional: z.boolean(),
  grams: amount,
  swapped: z.literal(true).optional(),
});

const mealSchema = z.strictObject({
  slot: z.enum([...MEAL_SLOT_KEYS, ...EXTRA_SLOTS]),
  role: z.enum(['pre', 'post', 'pre_snack']).nullable(),
  recipeId: contentIdSchema,
  recipeVersion: z.number().int().min(1),
  titleDe: z.string().min(1).max(200),
  recipeStatus: z.enum(CONTENT_STATUSES),
  factor: z.number().finite().min(0).max(10),
  ingredients: z.array(ingredientSchema).max(200),
  nutrients: nutrientsSchema,
  optionalKcal: amount,
  substitutions: z
    .array(
      z.strictObject({
        index: z.number().int().min(0).max(200),
        foodId: contentIdSchema,
        substituteFoodId: contentIdSchema,
      }),
    )
    .max(50),
  ingredientSwaps: z
    .array(
      z.strictObject({
        index: z.number().int().min(0).max(200),
        foodId: contentIdSchema,
        substituteFoodId: contentIdSchema,
      }),
    )
    .min(1)
    .max(INGREDIENT_SUBSTITUTION_LIMITS.swapsPerMeal)
    .optional(),
  omittedOptional: z
    .array(z.strictObject({ index: z.number().int().min(0).max(200), foodId: contentIdSchema }))
    .max(50),
  prepKind: z.enum(['cook', 'leftover', 'fresh']),
  cookDate: isoDateSchema,
  storage: z.enum(['fridge', 'freeze']).nullable(),
  isFill: z.boolean(),
  fixed: z.boolean(),
  mealPrepPlanId: contentIdSchema.nullable(),
});

const bandSchema = z.strictObject({ min: amount, max: amount }).nullable();

const daySchema = z.strictObject({
  date: isoDateSchema,
  mode: z.enum(NUTRITION_MODES),
  status: z.enum(['complete', 'below_floor', 'no_targets']),
  meals: z.array(mealSchema).max(20),
  totals: nutrientsSchema,
  band: bandSchema,
  safetyKey: z.string().min(1).max(500),
  emptySlots: z
    .array(
      z.strictObject({
        slot: z.enum(MEAL_SLOT_KEYS),
        reasons: z
          .array(z.enum([...RECIPE_EXCLUSION_REASONS, ...SLOT_EXCLUSION_REASONS, 'above_ceiling']))
          .max(30),
      }),
    )
    .max(20),
  notices: z.array(z.enum(MEAL_PLAN_NOTICE_CODES)).max(MEAL_PLAN_NOTICE_CODES.length),
});

/** Gespeicherter Plan – genau die Form von `MealPlanWeek` der aktuellen Engine-Version (sonst ungültig). */
export const storedMealPlanWeekSchema = z
  .strictObject({
    weekStart: weekStartSchema,
    variant: z.number().int().min(0).max(10_000),
    engineVersion: z.literal(MEAL_PLAN_ENGINE_VERSION),
    days: z.array(daySchema).length(7),
    notices: z.array(z.enum(MEAL_PLAN_NOTICE_CODES)).max(MEAL_PLAN_NOTICE_CODES.length),
    usesHealthData: z.boolean(),
    mealPrepPlanId: contentIdSchema.nullable(),
  })
  .superRefine((plan, ctx) => {
    // Zod verfeinert auch nach Formatfehlern weiter – mit kaputtem Datum nie werfen (Gerätespeicher, N5b).
    if (!weekStartSchema.safeParse(plan.weekStart).success || !Array.isArray(plan.days)) return;
    plan.days.forEach((day, index) => {
      if (day.date !== addDays(plan.weekStart, index)) {
        ctx.addIssue({ code: 'custom', path: ['days', index, 'date'], message: 'Falscher Tag.' });
      }
    });
  });

/** Plan aus dem Gerätespeicher; null = ungültig, unvollständig oder ältere Engine-Version. */
export function parseStoredMealPlanWeek(value: unknown): MealPlanWeek | null {
  const parsed = storedMealPlanWeekSchema.safeParse(value);
  if (!parsed.success) return null;
  const plan: MealPlanWeek = parsed.data;
  return plan;
}

/**
 * Passt der gespeicherte Schnappschuss zu den Rezepten (Wächter N5a S2)? Der Gerätespeicher ist nicht vertrauenswürdig:
 * Titel, Status, Zutaten und Nährwerte JEDER Mahlzeit (auch vergangener Tage) müssen sich aus dem Rezept derselben
 * Version, den gespeicherten Ersatzprodukten (nur im Katalog erlaubte `substitutes`), den weggelassenen OPTIONALEN
 * Zutaten, den getauschten Zutaten (19.7 N9: nur Einträge, die es in der Austausch-Tabelle gibt – Menge und Einheit
 * immer aus der Tabelle) und dem Faktor genau wieder ergeben (`scalePortion`); die Tagessumme muss zu den Mahlzeiten passen. Sonst
 * false → der Plan gilt als nicht vorhanden und wird neu erstellt (sichere Richtung – auch wenn sich nur eine
 * Rezept-Version geändert hat). Ob die Mahlzeit ab heute noch durch den Filter der Person kommt, prüft zusätzlich
 * `needsAutomaticReplan`.
 */
/** Tiefer Vergleich unabhängig von der Reihenfolge der Schlüssel (Zod liefert Objekte in Schema-Reihenfolge). */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

export function mealPlanMatchesRecipes(
  plan: MealPlanWeek,
  recipes: readonly Recipe[],
  foods: FoodLookup,
  substitutions: readonly IngredientSubstitution[] = [],
): boolean {
  return plan.days.every((day) => {
    const kcal = day.meals.reduce((sum, meal) => sum + meal.nutrients.kcal, 0);
    if (Math.abs(kcal - day.totals.kcal) > 1) return false;
    return day.meals.every((meal) => {
      const recipe = recipes.find(
        (r) => r.id === meal.recipeId && r.version === meal.recipeVersion,
      );
      if (recipe === undefined) return false;
      // Geteilte Mahlzeiten (19.7 N13) sind bis P1 nicht speicherbar – in beiden Modi (Wächter N13 S2).
      if (meal.shared === true) return false;
      if (meal.titleDe !== recipe.title_de || meal.recipeStatus !== recipe.status) return false;
      const substitutionsOk = meal.substitutions.every((sub) => {
        const ingredient = recipe.ingredients[sub.index];
        const food = foods.get(sub.foodId);
        return (
          ingredient?.food_id === sub.foodId &&
          food !== undefined &&
          food.substitutes.some((x) => x.food_id === sub.substituteFoodId) &&
          foods.get(sub.substituteFoodId) !== undefined
        );
      });
      const omittedOk = meal.omittedOptional.every((o) => {
        const ingredient = recipe.ingredients[o.index];
        return ingredient?.optional === true && ingredient.food_id === o.foodId;
      });
      if (!substitutionsOk || !omittedOk) return false;
      const swaps = resolveIngredientSwaps(
        recipe,
        meal.ingredientSwaps ?? [],
        substitutions,
        foods,
      );
      if (swaps === null) return false;
      // Eine Zutat ist nie zugleich getauscht und ersetzt bzw. weggelassen.
      const touched = new Set([
        ...meal.substitutions.map((x) => x.index),
        ...meal.omittedOptional.map((x) => x.index),
      ]);
      if (swaps.some((x) => touched.has(x.index))) return false;
      try {
        const portion = scalePortion(
          {
            recipe,
            omitted: meal.omittedOptional.map((o) => o.index),
            substitutions: meal.substitutions,
            swaps,
          },
          meal.factor,
          foods,
        );
        return (
          same(portion.ingredients, meal.ingredients) &&
          same(portion.nutrients, meal.nutrients) &&
          Math.abs(portion.optionalKcal - meal.optionalKcal) < 1e-6
        );
      } catch {
        return false;
      }
    });
  });
}

/**
 * Gespeichert bzw. geändert wird nur die laufende und die nächste Woche (Datumsrahmen von `save_meal_plan`, 7.3).
 * Ältere Wochen bleiben, wie sie sind.
 */
export function mealPlanWeekEditable(weekStart: string, today: string): boolean {
  const current = startOfIsoWeek(isoDateSchema.parse(today));
  return weekStart === current || weekStart === addDays(current, 7);
}

/**
 * Löschfrist (Etappe N7 Teil 2, `MEAL_PLAN_RETENTION_WEEKS`, Gründer-Entscheidung G-N7-2): erster Montag, dessen Woche
 * noch gespeichert bleibt – die laufende Woche und die vier Wochen davor. Ältere Pläne und Einkaufslisten löscht der
 * Server (`private.purge_expired_nutrition_weeks`) bzw. der Testmodus beim Laden und Speichern.
 */
export function mealPlanRetentionStart(today: string): string {
  return addDays(startOfIsoWeek(isoDateSchema.parse(today)), -7 * MEAL_PLAN_RETENTION_WEEKS);
}

/** Bleibt die Woche ab `weekStart` (Montag) gespeichert? (sonst nach der Löschfrist gelöscht) */
export function nutritionWeekRetained(weekStart: string, today: string): boolean {
  return isoDateSchema.parse(weekStart) >= mealPlanRetentionStart(today);
}

/** Variante für „Andere Vorschläge“ (6.3 Nr. 7): + 1, nach der höchsten wieder 0 (Schema 0–10 000). */
export function nextMealPlanVariant(variant: number): number {
  return variant >= 10_000 ? 0 : variant + 1;
}

/**
 * „Plan aktualisieren“ anbieten (8.2 Nr. 3)? Ja, wenn an einem Tag ab heute die Mitte des Planbands um mindestens
 * `MEAL_PLAN_UPDATE_MIN_CHANGE` von der Mitte des Bands abweicht, an dem der Plan gemessen wurde. Tage ohne Band
 * (`no_targets`) zählen nicht – ein Moduswechsel plant ohnehin automatisch neu (6.6).
 */
export function mealPlanUpdateSuggested(
  plan: MealPlanWeek,
  targets: Pick<NutritionWeekTargets, 'days'>,
  today: string,
): boolean {
  const from = isoDateSchema.parse(today);
  return plan.days.some((day) => {
    if (day.date < from || day.band === null) return false;
    const current = targets.days.find((d) => d.date === day.date);
    const band = current === undefined ? null : mealPlanBand(current);
    if (band === null) return false;
    const before = (day.band.min + day.band.max) / 2;
    const now = (band.min + band.max) / 2;
    return before > 0 && Math.abs(now - before) / before >= MEAL_PLAN_UPDATE_MIN_CHANGE;
  });
}

export type MealPlanResolution =
  /** Gespeicherter Plan passt; `updateSuggested` = Knopf „Plan aktualisieren“ zeigen. */
  | { readonly action: 'stored'; readonly plan: MealPlanWeek; readonly updateSuggested: boolean }
  /** Kein (gültiger) Plan dieser Woche – neu erstellt (Variante 0). */
  | { readonly action: 'created'; readonly plan: MealPlanWeek }
  /**
   * Gespeicherter Plan derselben Woche passt nicht zu den Rezepten (`mealPlanMatchesRecipes`, Wächter N5a S2: neue
   * Rezept-Version oder veränderter Gerätespeicher) – neu erstellt (Variante 0), AUCH die vergangenen Tage. Die App
   * zeigt dazu einen Hinweis (Wächter N5a Nachprüfung K-b).
   */
  | { readonly action: 'rebuilt'; readonly plan: MealPlanWeek }
  /** Automatisch ab heute neu geplant (6.6) – Hinweis „Dein Plan wurde an deine neuen Angaben angepasst.“ */
  | {
      readonly action: 'replanned';
      readonly plan: MealPlanWeek;
      readonly reasons: readonly ReplanReason[];
    };

/**
 * Plan der Woche beim Öffnen (6.6): Der angezeigte Plan ist IMMER der Plan nach dieser Regel – ein gespeicherter Plan,
 * der den aktuellen Angaben nicht mehr entspricht (z. B. Schwangerschaft gesetzt, neue Unverträglichkeit), wird nie
 * angezeigt, auch nicht bis zum Speichern.
 */
export function resolveMealPlanWeek(
  stored: MealPlanWeek | null,
  input: PlanInput,
): MealPlanResolution {
  const weekStart = input.targets.weekStart;
  if (stored === null || stored.weekStart !== weekStart) {
    return { action: 'created', plan: buildMealPlanWeek({ ...input, variant: 0 }) };
  }
  if (!mealPlanMatchesRecipes(stored, input.recipes, input.foods, input.substitutions)) {
    return { action: 'rebuilt', plan: buildMealPlanWeek({ ...input, variant: 0 }) };
  }
  const check = needsAutomaticReplan(stored, input);
  if (check.needed) {
    return {
      action: 'replanned',
      plan: automaticReplan(stored, null, input).plan,
      reasons: check.reasons,
    };
  }
  return {
    action: 'stored',
    plan: stored,
    updateSuggested: mealPlanUpdateSuggested(stored, input.targets, input.today),
  };
}

/** „Andere Vorschläge“ (6.3 Nr. 7): Variante + 1 ab heute; vergangene Tage und gekochte Reste bleiben. */
export function mealPlanWithOtherSuggestions(stored: MealPlanWeek, input: PlanInput): MealPlanWeek {
  return buildMealPlanWeek({
    ...input,
    existingPlan: stored,
    variant: nextMealPlanVariant(stored.variant),
  });
}

/** „Plan aktualisieren“ (8.2 Nr. 3): gleiche Variante, neu ab heute (Tauschen ab heute wird dabei ersetzt). */
export function refreshedMealPlan(stored: MealPlanWeek, input: PlanInput): MealPlanWeek {
  return buildMealPlanWeek({ ...input, existingPlan: stored, variant: stored.variant });
}

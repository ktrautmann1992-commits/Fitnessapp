import { z } from 'zod';

import { isoDateSchema } from '../age';
import { MEAL_PLAN_ENGINE_VERSION, MEAL_PLAN_FILL } from '../constants';
import type { FoodLookup } from '../content/food-schema';
import type { Recipe } from '../content/recipe-schema';
import type { IngredientSubstitution } from '../content/substitution-schema';
import type { RecipeSubstitution } from './filter';
import {
  assembleWeek,
  daySafetyKey,
  type MealPlanDayStatus,
  type MealPlanInput,
  type MealPlanWeek,
  mealPlanBand,
  type PlannedMeal,
  type PlannedMealDay,
  weekDate,
} from './meal-plan';
import {
  type MealPlanItemPayload,
  type MealPlanPayload,
  mealPlanPayloadSchema,
  toMealPlanPayload,
} from './meal-plan-payload';
import { type MealPlanResolution, resolveMealPlanWeek } from './meal-plan-store';
import { type MealPlanNoticeCode, sortMealPlanNotices } from './notices';
import { addNutrients, zeroNutrients } from './recipe-nutrients';
import { automaticReplan } from './replan';
import { scalePortion } from './scale';
import { resolveIngredientSwaps } from './swap-resolve';
import type { NutritionDayTargets, NutritionWeekTargets } from './targets';

/**
 * Gespeicherter Essensplan AUS DER DATENBANK (Etappe N7 Teil 2, docs/PLAN-PHASE-5.md „Vorschlag N7 Teil 2“ Nr. 1,
 * Gründer-Entscheidung G-N7-1): `meal_plans`/`meal_plan_items` speichern bewusst weder Planband noch Abgleich-Schlüssel
 * (`safetyKey`), Modus, leere Plätze oder Hinweise (Wächter N5a S4, 7.1). Der vollständige Plan der Engine liegt auf
 * dem Gerät im geschützten Speicher; fehlt er (neues Gerät, gelöscht) oder passt er nicht mehr zu den Zeilen, baut
 * `mealPlanWeekFromRecord` ihn aus den Zeilen und dem Bestand neu:
 *
 * - Mahlzeiten aus Rezept (genau diese Version), Faktor, Ersatz, Weglassen und Tausch – Zutaten und Nährwerte immer neu
 *   gerechnet (`scalePortion`, wie `mealPlanMatchesRecipes`), nie aus den gespeicherten Zahlen;
 * - Modus aus `day_status`: `no_targets` ⇔ aktueller Modus `no_targets` → aktueller Modus; sonst ein ANDERER Modus, damit
 *   die normale Prüfung 6.6 (`needsAutomaticReplan`) „Modus geändert“ meldet und ab heute neu plant;
 * - Planband und Abgleich-Schlüssel aus den AKTUELLEN Zielen. Unterschied zum Testmodus: Ein reiner Deckel-Wechsel
 *   (`caps_changed`), bei dem der Plan weiter im neuen Band liegt, plant auf einem neuen Gerät nicht neu – sicher, weil
 *   das Band die Deckel enthält. Leere Plätze und der Hinweis „kein Rezept für diesen Platz“ fehlen bei
 *   rekonstruierten Tagen; die übrigen Tages-Hinweise werden wie in `finishDay` neu bestimmt;
 * - danach gilt die normale Prüfung 6.6 (`resolveMealPlanWeek`: Tagessumme im aktuellen Band, jedes Rezept besteht den
 *   aktuellen Filter inkl. `pregnancy_caution`, Reste halten).
 *
 * Wächter N7 H5: Der Server filtert vergangene Tage nicht erneut – gelesene Zeilen werden deshalb hier noch einmal mit
 * Zod geprüft (`mealPlanRecordSchema` = `mealPlanPayloadSchema`) und laufen danach durch denselben Filter wie jeder
 * Plan. Wächter N7 H9: Archivierte Rezepte sind für Nutzer nicht lesbar – solche Mahlzeiten kommen als „nicht mehr
 * verfügbar“ zurück (`unavailable`, nur Titel und Platz); liegen sie ab heute, wird ab heute neu geplant.
 *
 * Gesundheitsdaten: Ein Plan mit `usesHealthData` ist ein Gesundheitsdatum (7.1) – nie loggen.
 */

/** Ein Essensplan, wie ihn die Datenbank liefert (Payload von `save_meal_plan` + `uses_health_data` vom Server). */
export const mealPlanRecordSchema = z.strictObject({
  usesHealthData: z.boolean(),
  payload: mealPlanPayloadSchema,
});
export type MealPlanRecord = z.infer<typeof mealPlanRecordSchema>;

/** Gelesene Zeilen erneut prüfen (H5); null = ungültig → gilt als nicht vorhanden. */
export function parseMealPlanRecord(value: unknown): MealPlanRecord | null {
  const parsed = mealPlanRecordSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Mahlzeit, deren Rezept (in dieser Version) es im Bestand nicht mehr gibt (H9). */
export interface UnavailableMeal {
  readonly date: string;
  readonly slot: MealPlanItemPayload['slot'];
  readonly titleDe: string;
  readonly isFill: boolean;
}

export interface MealPlanFromRecord {
  readonly plan: MealPlanWeek;
  readonly unavailable: readonly UnavailableMeal[];
}

type RecordInput = Pick<MealPlanInput, 'recipes' | 'foods' | 'substitutions' | 'today'> & {
  readonly targets: NutritionWeekTargets;
};

/** Gehört die Mahlzeit zur Payload genau so (Plätze, Rezepte, Faktoren, Änderungen, gerundete Werte)? */
export function mealPlanPayloadMatches(plan: MealPlanWeek, payload: MealPlanPayload): boolean {
  let own: MealPlanPayload;
  try {
    own = toMealPlanPayload(plan, payload.inputs);
  } catch {
    return false;
  }
  const order = (items: readonly MealPlanItemPayload[]) =>
    [...items].sort((a, b) =>
      a.date === b.date ? (a.slot < b.slot ? -1 : 1) : a.date < b.date ? -1 : 1,
    );
  return (
    own.week_start === payload.week_start &&
    own.engine_version === payload.engine_version &&
    own.variant === payload.variant &&
    own.meal_prep_plan_id === payload.meal_prep_plan_id &&
    canonical(order(own.items)) === canonical(order(payload.items))
  );
}

/** JSON mit sortierten Schlüsseln (Vergleich unabhängig von der Reihenfolge der Felder). */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : v,
  );
}

/** Mahlzeit aus einer Zeile; null = Rezept, Ersatz, Weglassen oder Tausch passt nicht (mehr) zum Bestand. */
function mealFromItem(
  item: MealPlanItemPayload,
  input: RecordInput,
  today: string,
): PlannedMeal | null {
  const recipe: Recipe | undefined = input.recipes.find(
    (r) => r.id === item.recipe_id && r.version === item.recipe_version,
  );
  if (recipe === undefined) return null;
  const foods: FoodLookup = input.foods;
  const substitutions: RecipeSubstitution[] = item.substitutions.map((s) => ({
    index: s.index,
    foodId: s.food_id,
    substituteFoodId: s.substitute_food_id,
  }));
  const substitutionsOk = substitutions.every((sub) => {
    const food = foods.get(sub.foodId);
    return (
      recipe.ingredients[sub.index]?.food_id === sub.foodId &&
      food !== undefined &&
      food.substitutes.some((x) => x.food_id === sub.substituteFoodId) &&
      foods.get(sub.substituteFoodId) !== undefined
    );
  });
  const omittedOk = item.omitted_optional.every((o) => {
    const ingredient = recipe.ingredients[o.index];
    return ingredient?.optional === true && ingredient.food_id === o.food_id;
  });
  if (!substitutionsOk || !omittedOk) return null;
  const swapRefs = item.ingredient_swaps.map((x) => ({
    index: x.index,
    foodId: x.food_id,
    substituteFoodId: x.substitute_food_id,
  }));
  const table: readonly IngredientSubstitution[] = input.substitutions ?? [];
  const swaps = resolveIngredientSwaps(recipe, swapRefs, table, foods);
  if (swaps === null) return null;
  try {
    const portion = scalePortion(
      {
        recipe,
        omitted: item.omitted_optional.map((o) => o.index),
        substitutions,
        swaps,
      },
      item.factor,
      foods,
    );
    return {
      slot: item.slot,
      role: item.role,
      recipeId: recipe.id,
      recipeVersion: recipe.version,
      titleDe: recipe.title_de,
      recipeStatus: recipe.status,
      factor: portion.factor,
      ingredients: portion.ingredients,
      nutrients: portion.nutrients,
      optionalKcal: portion.optionalKcal,
      substitutions,
      ...(swapRefs.length > 0 ? { ingredientSwaps: swapRefs } : {}),
      omittedOptional: item.omitted_optional.map((o) => ({ index: o.index, foodId: o.food_id })),
      prepKind: item.prep_kind,
      cookDate: item.cook_date,
      storage: item.storage,
      isFill: item.is_fill,
      // Schon gekochte Reste haben eine feste Portion (wie `fixedFactor` beim erneuten Ausgleich).
      fixed: item.prep_kind === 'leftover' && item.cook_date < today,
      mealPrepPlanId: item.meal_prep_plan_id,
    };
  } catch {
    return null;
  }
}

/** Modus des rekonstruierten Tages (s. o.): gleich dem aktuellen, wenn `day_status` dazu passt – sonst ein anderer. */
function reconstructedMode(
  status: MealPlanDayStatus | null,
  current: NutritionDayTargets['mode'],
): NutritionDayTargets['mode'] {
  if (status === null) return current;
  const storedNoTargets = status === 'no_targets';
  if (storedNoTargets === (current === 'no_targets')) return current;
  return current === 'no_targets' ? 'full' : 'no_targets';
}

/** Hinweise eines rekonstruierten Tages wie `finishDay` (ohne leere Plätze). */
function dayNotices(
  meals: readonly PlannedMeal[],
  status: MealPlanDayStatus,
  totals: PlannedMealDay['totals'],
  targets: NutritionDayTargets,
  sameMode: boolean,
): MealPlanNoticeCode[] {
  const notices = new Set<MealPlanNoticeCode>();
  if (meals.some((m) => m.isFill)) notices.add('fill_snacks_added');
  if (status === 'below_floor') notices.add('day_below_floor');
  if (status === 'no_targets') notices.add('no_targets_portions');
  if (
    sameMode &&
    status !== 'no_targets' &&
    targets.proteinG !== null &&
    totals.protein_g < MEAL_PLAN_FILL.proteinMinShare * targets.proteinG
  ) {
    notices.add('protein_below_target');
  }
  if (meals.some((m) => m.storage === 'freeze')) notices.add('meal_prep_freeze');
  return sortMealPlanNotices(notices);
}

/** Abgleich-Schlüssel eines rekonstruierten Tages ab heute ohne Mahlzeiten bzw. mit `below_floor` (M1). */
export const RECONSTRUCTED_INCOMPLETE_KEY = 'reconstructed:incomplete';

/**
 * Essensplan aus den Datenbank-Zeilen und dem Bestand (s. o.). null = Zeilen ungültig, andere Woche als die Ziele,
 * ältere Engine-Version oder uneinheitlicher Tages-Status → gilt als nicht vorhanden (neu erstellt).
 */
export function mealPlanWeekFromRecord(
  record: MealPlanRecord,
  input: RecordInput,
): MealPlanFromRecord | null {
  const parsed = parseMealPlanRecord(record);
  if (parsed === null) return null;
  const { payload } = parsed;
  if (payload.engine_version !== MEAL_PLAN_ENGINE_VERSION) return null;
  if (payload.week_start !== input.targets.weekStart) return null;
  const today = isoDateSchema.parse(input.today);
  const unavailable: UnavailableMeal[] = [];
  const days: PlannedMealDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = weekDate(payload.week_start, i);
    const targets = input.targets.days.find((d) => d.date === date);
    if (targets === undefined) return null;
    const items = payload.items.filter((item) => item.date === date);
    const statuses = new Set(items.map((item) => item.day_status));
    if (statuses.size > 1) return null;
    const stored = items[0]?.day_status ?? null;
    const mode = reconstructedMode(stored, targets.mode);
    const sameMode = mode === targets.mode;
    const status: MealPlanDayStatus =
      stored ?? (targets.mode === 'no_targets' ? 'no_targets' : 'below_floor');
    const meals: PlannedMeal[] = [];
    for (const item of items) {
      const meal = mealFromItem(item, input, today);
      if (meal === null) {
        unavailable.push({ date, slot: item.slot, titleDe: item.title_de, isFill: item.is_fill });
      } else {
        meals.push(meal);
      }
    }
    const totals = zeroNutrients();
    meals.forEach((m) => addNutrients(totals, m.nutrients));
    days.push({
      date,
      mode,
      status,
      meals,
      totals,
      band: mode === 'no_targets' ? null : mealPlanBand(targets),
      safetyKey: !sameMode
        ? 'reconstructed:mode_changed'
        : // Wächter N7 Teil 2 M1: Ein Tag ab heute ohne Mahlzeiten oder mit `below_floor` kommt so nicht von der Engine
          // des Geräts, das ihn gerade zeigt (oder ist ein unvollständiger Vorschlag) – ab heute sicher neu planen
          // (6.6 → `caps_changed`). Vergangene Tage bleiben, wie sie waren.
          date >= today && (items.length === 0 || stored === 'below_floor')
          ? RECONSTRUCTED_INCOMPLETE_KEY
          : daySafetyKey(targets),
      emptySlots: [],
      notices: dayNotices(meals, status, totals, targets, sameMode),
    });
  }
  return {
    plan: assembleWeek(days, {
      weekStart: payload.week_start,
      variant: payload.variant,
      usesHealthData: parsed.usesHealthData,
      mealPrepPlanId: payload.meal_prep_plan_id,
    }),
    unavailable,
  };
}

export type MealPlanRecordResolution = MealPlanResolution & {
  /** Vergangene Mahlzeiten, deren Rezept nicht mehr verfügbar ist (H9) – Anzeige „Rezept nicht mehr verfügbar“. */
  readonly unavailable: readonly UnavailableMeal[];
};

/**
 * Plan der Woche aus der Datenbank beim Öffnen (6.6): rekonstruieren, dann wie jeder gespeicherte Plan auflösen. Liegt
 * eine nicht mehr verfügbare Mahlzeit ab heute, wird ab heute automatisch neu geplant (Grund `recipe_excluded`);
 * vergangene Tage bleiben, wie sie waren (die nicht mehr verfügbaren Mahlzeiten dort nur als Hinweis).
 */
export function resolveMealPlanRecord(
  record: MealPlanRecord | null,
  input: Omit<MealPlanInput, 'existingPlan' | 'variant'>,
): MealPlanRecordResolution {
  const rebuilt = record === null ? null : mealPlanWeekFromRecord(record, input);
  if (rebuilt === null) return { ...resolveMealPlanWeek(null, input), unavailable: [] };
  const today = isoDateSchema.parse(input.today);
  const past = rebuilt.unavailable.filter((m) => m.date < today);
  if (rebuilt.unavailable.some((m) => m.date >= today)) {
    return {
      action: 'replanned',
      plan: automaticReplan(rebuilt.plan, null, input).plan,
      reasons: ['recipe_excluded'],
      unavailable: past,
    };
  }
  const resolved = resolveMealPlanWeek(rebuilt.plan, input);
  // Neu erstellt (auch die vergangenen Tage): dann gibt es keine alten Mahlzeiten mehr anzuzeigen.
  const kept = resolved.action === 'stored' || resolved.action === 'replanned';
  return { ...resolved, unavailable: kept ? past : [] };
}

import { z } from 'zod';

import { isoDateSchema } from '../age';
import { RECIPE_SWIPE_RULES } from '../constants';
import type { FoodLookup } from '../content/food-schema';
import { recipeTotalMinutes } from '../content/import-rules';
import type { MealType, Recipe } from '../content/recipe-schema';
import { contentIdSchema } from '../content/schemas';
import { addDays, startOfIsoWeek } from '../dates';
import { mealTypeForSlot } from './filter';
import {
  EXTRA_SLOTS,
  type MealPlanInput,
  type MealPlanWeek,
  type PlannedMeal,
  swapMealRecipe,
} from './meal-plan';
import { type RecipeRatingInput, recipeBlockedOnAnyDay, recipeRatingIndex } from './ratings';
import {
  type RecipePreferenceInput,
  type RecipePreferenceKind,
  recipePreferencesSchema,
} from './recipe-preferences';
import { searchRecipes } from './recipe-search';
import { scaleRecipeForServings } from './scale';
import type { MealPlanProfileInput } from './schemas';
import { stableHashKey } from './stable-hash';
import type { MealSlotId } from './timing';

/**
 * Rezepte entdecken – Wochenauswahl per Wischen (Gründer-Wunsch 01.11.2026, docs/PLAN-REZEPT-SWIPE.md) – gratis,
 * regelbasiert, ohne KI. Nutzt ausschließlich vorhandene Mechanismen, keine Parallelstruktur:
 *
 * - Rechts „Mag ich“ → Herz („Lieblingsgericht“, `recipe_preferences.kind = 'favorite'`) UND beim Knopf „Wochenplan
 *   aktualisieren“ wird das Gericht über `swapMealRecipe` (gleiche Regeln wie „Rezept tauschen“) in die gewählte Woche
 *   gelegt – als „selbst gewählt“ (`meal_plan_items.user_chosen`). Filter, Planband, Obergrenze und Kalorien-
 *   Schutzgrenzen gelten unverändert; passt ein Gericht nirgends, bleibt der Plan, wie er ist (nur das Herz wirkt).
 * - Links „Mag ich nicht“ → „Nie wieder“ (`kind = 'hidden'`), zurückholbar unter „Ausgeblendete Gerichte“.
 * - Oben „Neutral“ → keine Wirkung; das Rezept gilt nur für diese Woche als gesehen (Gerätespeicher, kein
 *   Gesundheitsdatum).
 *
 * Der Stapel nimmt dieselben harten Filter wie Essensplan und Rezeptsuche (`searchRecipes` → `filter.ts`:
 * Ernährungsform des Profils, Schwein, Unverträglichkeiten, „mag ich nicht“, Schwangerschaft, Status) – Treffer
 * außerhalb der Profil-Ernährungsform kommen NICHT in den Stapel (sie dürften nie automatisch in den Plan, G4).
 */

export const RECIPE_SWIPE_CHOICES = ['like', 'dislike', 'neutral'] as const;
export type RecipeSwipeChoice = (typeof RECIPE_SWIPE_CHOICES)[number];
export const recipeSwipeChoiceSchema = z.enum(RECIPE_SWIPE_CHOICES);

/**
 * Welche Vorliebe eine Wisch-Entscheidung setzt: `like` → Herz, `dislike` → „Nie wieder“, `neutral` → nichts
 * (`null` = Vorliebe bleibt unverändert).
 */
export function recipeSwipePreferenceKind(choice: RecipeSwipeChoice): RecipePreferenceKind | null {
  const parsed = recipeSwipeChoiceSchema.parse(choice);
  if (parsed === 'like') return 'favorite';
  if (parsed === 'dislike') return 'hidden';
  return null;
}

/** Eine getroffene Entscheidung (für „Rückgängig“ samt vorheriger Vorliebe). */
export interface RecipeSwipeDecision {
  readonly recipeId: string;
  readonly choice: RecipeSwipeChoice;
  /** Vorliebe vor der Entscheidung (Rückgängig stellt genau sie wieder her). */
  readonly previous: RecipePreferenceKind | null;
}

/**
 * „Rückgängig“ für die letzte Karte: welche Vorliebe wiederherzustellen ist. `undefined` = nichts an den Vorlieben zu
 * ändern (neutral), sonst die vorherige Vorliebe (`null` = keine).
 */
export function recipeSwipeUndoPreference(
  decision: RecipeSwipeDecision,
): RecipePreferenceKind | null | undefined {
  return recipeSwipePreferenceKind(decision.choice) === null ? undefined : decision.previous;
}

// ---------------------------------------------------------------------------------------------------------
// „Neutral“ gesehen (je Woche, Gerätespeicher)
// ---------------------------------------------------------------------------------------------------------

export const recipeSwipeSeenSchema = z.strictObject({
  weekStart: isoDateSchema,
  recipeIds: z.array(contentIdSchema).max(RECIPE_SWIPE_RULES.seenMax),
});
export type RecipeSwipeSeen = z.infer<typeof recipeSwipeSeenSchema>;

/**
 * Gespeicherte „neutral gesehen“-Liste lesen: nur für genau diese Woche (Montag), sonst leer. Ungültiges → leer
 * (sichere Richtung: das Rezept erscheint wieder im Stapel).
 */
export function recipeSwipeSeenFor(raw: unknown, weekStart: string): string[] {
  const parsed = recipeSwipeSeenSchema.safeParse(raw);
  if (!parsed.success || parsed.data.weekStart !== startOfIsoWeek(weekStart)) return [];
  return [...new Set(parsed.data.recipeIds)];
}

/** Rezept als gesehen merken (`add`) bzw. wieder vergessen (Rückgängig). Älteste fallen bei der Obergrenze heraus. */
export function withRecipeSwipeSeen(
  seen: readonly string[],
  recipeId: string,
  add: boolean,
): string[] {
  const id = contentIdSchema.parse(recipeId);
  const rest = seen.filter((s) => s !== id);
  return add ? [...rest, id].slice(-RECIPE_SWIPE_RULES.seenMax) : rest;
}

// ---------------------------------------------------------------------------------------------------------
// Stapel
// ---------------------------------------------------------------------------------------------------------

export interface RecipeSwipeCard {
  readonly recipeId: string;
  readonly titleDe: string;
  readonly mealTypes: readonly MealType[];
  readonly totalMinutes: number;
  /** Nährwerte je Portion des Grundrezepts (ungerundet); null = nicht berechenbar (Karte zeigt dann keine Zahlen). */
  readonly perServing: {
    readonly kcal: number;
    readonly protein_g: number;
    readonly carbs_g: number;
    readonly fat_g: number;
  } | null;
  readonly isDraft: boolean;
}

export interface RecipeSwipeStackInput {
  readonly recipes: readonly Recipe[];
  readonly foods: FoodLookup;
  readonly profile: MealPlanProfileInput;
  readonly excludePregnancyCaution: boolean;
  readonly allowDrafts: boolean;
  readonly redRecipeIds?: ReadonlySet<string>;
  /** Montag der Woche, für die gewählt wird (Reihenfolge und Daumen-runter-Sperren). */
  readonly weekStart: string;
  readonly preferences?: readonly RecipePreferenceInput[];
  readonly ratings?: readonly RecipeRatingInput[];
  /** In dieser Woche schon als „neutral“ gesehen. */
  readonly seen?: readonly string[];
  readonly limit?: number;
}

/** Nährwerte je Portion (kcal, Eiweiß, KH, Fett) – null, wenn nicht berechenbar. */
function cardNutrients(
  variant: Parameters<typeof scaleRecipeForServings>[0],
  recipe: Recipe,
  foods: FoodLookup,
): RecipeSwipeCard['perServing'] {
  try {
    const { perServing } = scaleRecipeForServings(variant, recipe.servings, foods);
    const values = [perServing.kcal, perServing.protein_g, perServing.carbs_g, perServing.fat_g];
    if (!values.every((v) => Number.isFinite(v) && v >= 0)) return null;
    return {
      kcal: perServing.kcal,
      protein_g: perServing.protein_g,
      carbs_g: perServing.carbs_g,
      fat_g: perServing.fat_g,
    };
  } catch {
    return null;
  }
}

/**
 * Kartenstapel: Rezepte, die zur Person passen (dieselben harten Filter wie der Essensplan, nur die
 * Profil-Ernährungsform), ohne Vorliebe (weder Herz noch „Nie wieder“), nicht durch Daumen runter in dieser Woche
 * gesperrt und in dieser Woche nicht schon als „neutral“ gesehen. Reihenfolge fest je Woche (`stableHashKey`, kein
 * Zufall) – nächste Woche mischt sich der Stapel neu. Höchstens `RECIPE_SWIPE_RULES.stackMax` Karten.
 */
export function recipeSwipeStack(input: RecipeSwipeStackInput): RecipeSwipeCard[] {
  const weekStart = startOfIsoWeek(isoDateSchema.parse(input.weekStart));
  const limit = z
    .number()
    .int()
    .min(1)
    .max(RECIPE_SWIPE_RULES.stackMax)
    .parse(input.limit ?? RECIPE_SWIPE_RULES.stackMax);
  const preferences = recipePreferencesSchema.parse(input.preferences ?? []);
  const decided = new Set(preferences.map((p) => p.recipeId));
  const seen = new Set(z.array(contentIdSchema).parse(input.seen ?? []));
  const index = recipeRatingIndex(input.ratings, preferences);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hits = searchRecipes({
    recipes: input.recipes,
    foods: input.foods,
    profile: input.profile,
    excludePregnancyCaution: input.excludePregnancyCaution,
    allowDrafts: input.allowDrafts,
    ...(input.redRecipeIds !== undefined ? { redRecipeIds: input.redRecipeIds } : {}),
    preferences,
  });
  return hits
    .filter(
      (hit) =>
        hit.outsideProfileDiet === null &&
        !decided.has(hit.variant.recipe.id) &&
        !seen.has(hit.variant.recipe.id) &&
        !recipeBlockedOnAnyDay(index, hit.variant.recipe.id, dates),
    )
    .map((hit) => ({ hit, key: stableHashKey('swipe', weekStart, hit.variant.recipe.id) }))
    .sort((a, b) => a.key - b.key || (a.hit.variant.recipe.id < b.hit.variant.recipe.id ? -1 : 1))
    .slice(0, limit)
    .map(({ hit }) => {
      const recipe = hit.variant.recipe;
      return {
        recipeId: recipe.id,
        titleDe: recipe.title_de,
        mealTypes: recipe.meal_types,
        totalMinutes: recipeTotalMinutes(recipe),
        perServing: cardNutrients(hit.variant, recipe, input.foods),
        isDraft: recipe.status === 'draft',
      };
    });
}

// ---------------------------------------------------------------------------------------------------------
// Wirkung auf den Wochenplan
// ---------------------------------------------------------------------------------------------------------

export interface RecipeSwipePlacement {
  readonly recipeId: string;
  readonly date: string;
  readonly slot: MealSlotId;
}

export interface RecipeSwipePlacementResult {
  /** Plan mit den eingeplanten Gerichten (unverändert, wenn nichts passte). */
  readonly plan: MealPlanWeek;
  /** Neu eingeplant (als „selbst gewählt“). */
  readonly placed: readonly RecipeSwipePlacement[];
  /** Stand schon (ab heute) im Plan – nichts zu tun. */
  readonly alreadyPlanned: readonly string[];
  /** Passt in dieser Woche auf keinen freien Platz (Filter, Planband, Schutzgrenzen) – nur das Herz wirkt. */
  readonly unplaced: readonly string[];
}

const EXTRA = new Set<string>(EXTRA_SLOTS);

/** Darf ein „Mag ich“ diese Mahlzeit ersetzen? Nur frisch gekochte, nicht selbst gewählte Plätze ohne Trainingsrolle. */
function replaceable(meal: PlannedMeal): boolean {
  return (
    !meal.isFill &&
    !EXTRA.has(meal.slot) &&
    meal.chosen !== true &&
    meal.shared !== true &&
    !meal.fixed &&
    meal.prepKind === 'fresh' &&
    meal.mealPrepPlanId === null &&
    meal.role === null
  );
}

/**
 * „Wochenplan aktualisieren“ nach dem Wischen: legt die gemochten Rezepte (in Wisch-Reihenfolge) in die Woche – je
 * Gericht der erste passende Platz ab heute, verteilt über die Tage (Tage mit weniger gewählten Gerichten zuerst,
 * höchstens `RECIPE_SWIPE_RULES.maxPicksPerDay` je Tag), Mahlzeit-Art passend (Frühstück/Hauptgericht/Snack).
 *
 * Jeder einzelne Tausch läuft über `swapMealRecipe` mit genau diesem Rezept: harte Filter, Planband, Obergrenze und
 * Kalorien-Schutzgrenzen gelten unverändert, ein vollständiger Tag bleibt vollständig, nichts wird verdrängt. Plätze
 * vor/nach dem Training, Meal-Prep, Reste, geteilte und schon selbst gewählte Mahlzeiten bleiben unberührt.
 * Deterministisch.
 */
export function placeRecipeSwipePicks(
  plan: MealPlanWeek,
  recipeIds: readonly string[],
  input: Omit<MealPlanInput, 'existingPlan' | 'variant'>,
): RecipeSwipePlacementResult {
  const today = isoDateSchema.parse(input.today);
  const ids = [...new Set(z.array(contentIdSchema).parse(recipeIds))];
  const byId = new Map(input.recipes.map((r) => [r.id, r] as const));
  let current = plan;
  const placed: RecipeSwipePlacement[] = [];
  const alreadyPlanned: string[] = [];
  const unplaced: string[] = [];
  const perDay = new Map<string, number>();

  for (const recipeId of ids) {
    const upcoming = current.days.filter((d) => d.date >= today);
    if (upcoming.some((d) => d.meals.some((m) => m.recipeId === recipeId))) {
      alreadyPlanned.push(recipeId);
      continue;
    }
    const recipe = byId.get(recipeId);
    if (recipe === undefined) {
      unplaced.push(recipeId);
      continue;
    }
    const days = upcoming
      .filter((d) => (perDay.get(d.date) ?? 0) < RECIPE_SWIPE_RULES.maxPicksPerDay)
      .sort(
        (a, b) =>
          (perDay.get(a.date) ?? 0) - (perDay.get(b.date) ?? 0) || (a.date < b.date ? -1 : 1),
      );
    let done: RecipeSwipePlacement | null = null;
    for (const day of days) {
      for (const meal of day.meals) {
        if (!replaceable(meal)) continue;
        const slot = meal.slot as MealSlotId;
        // Vorprüfung (billig): Mahlzeit-Art muss passen – den Rest prüft `swapMealRecipe`.
        if (!recipe.meal_types.includes(mealTypeForSlot(slot))) continue;
        const result = swapMealRecipe(current, { date: day.date, slot }, input, { recipeId });
        if (!result.ok) continue;
        current = result.plan;
        done = { recipeId, date: day.date, slot };
        break;
      }
      if (done !== null) break;
    }
    if (done === null) {
      unplaced.push(recipeId);
    } else {
      placed.push(done);
      perDay.set(done.date, (perDay.get(done.date) ?? 0) + 1);
    }
  }
  return { plan: current, placed, alreadyPlanned, unplaced };
}

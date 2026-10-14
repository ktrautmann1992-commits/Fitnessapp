import {
  foodDislikesSchema,
  type RecipeRating,
  recipeRatingSchema,
  removeRecipeRating,
  upsertRecipeRating,
} from '@fitnessapp/core';

import type { FoodDislikeRow, RecipeRatingRow, UserRows } from './types';

/**
 * Bewertung nach dem Essen und „mag ich nicht“ je Lebensmittel im TESTMODUS (docs/PLAN-PHASE-5.md 19.7 N10) – dieselben
 * Regeln, die ab N7 die Tabellen `recipe_ratings`/`food_dislikes` (RLS: nur eigene Zeilen) prüfen, soweit sie ohne
 * Datenbank gelten. Die Regeln selbst stehen in packages/core (`ratings.ts`); hier nur Abbildung auf Zeilen. Rein und
 * getestet (nutrition-n10.test.ts).
 *
 * Datenschutz: Gespeichert werden nur Rezept, Daumen, ein Grund OHNE Gesundheitsbezug und das Datum – der Grund
 * „Unverträglich“ existiert in diesen Zeilen nicht (das Schema kennt ihn nicht). Nie loggen, nie an Analytics.
 */

/** Zeilen → Bewertungen für die Engine (packages/core). */
export function ratingsFromRows(rows: Pick<UserRows, 'recipeRatings'>): RecipeRating[] {
  return rows.recipeRatings.map((row) => ({
    recipeId: row.recipe_id,
    value: row.value,
    reason: row.reason,
    ratedOn: row.rated_on,
  }));
}

/** „Mag ich nicht“ je Lebensmittel als Liste von IDs (für `MealPlanProfile.dislikedFoods`). */
export function dislikedFoodsFromRows(rows: Pick<UserRows, 'foodDislikes'>): string[] {
  return rows.foodDislikes.map((row) => row.food_id).sort();
}

/** Bewertung dieses Rezepts (null = keine). */
export function ratingForRecipe(rows: Pick<UserRows, 'recipeRatings'>, recipeId: string) {
  return ratingsFromRows(rows).find((r) => r.recipeId === recipeId) ?? null;
}

export type RatingSaveCheck =
  { ok: true; ratings: RecipeRating[] } | { ok: false; reason: 'invalid' | 'date' };

/**
 * Bewertung setzen (`rating`) oder zurücknehmen (`null`). Gespeichert wird nur mit dem heutigen Datum (Gerätezeit) –
 * die 8 Wochen zählen ab dem Bewerten. Alles oder nichts.
 */
export function checkRecipeRatingSave(
  rows: Pick<UserRows, 'recipeRatings'>,
  change: { recipeId: string; rating: RecipeRating | null },
  today: string,
): RatingSaveCheck {
  try {
    if (change.rating === null) {
      return { ok: true, ratings: removeRecipeRating(ratingsFromRows(rows), change.recipeId) };
    }
    const parsed = recipeRatingSchema.safeParse(change.rating);
    if (!parsed.success || parsed.data.recipeId !== change.recipeId) {
      return { ok: false, reason: 'invalid' };
    }
    if (parsed.data.ratedOn !== today) return { ok: false, reason: 'date' };
    return { ok: true, ratings: upsertRecipeRating(ratingsFromRows(rows), parsed.data) };
  } catch {
    // Zu viele Bewertungen oder kaputter Gerätespeicher – ohne Werte in der Meldung.
    return { ok: false, reason: 'invalid' };
  }
}

export function applyRecipeRatings(
  rows: UserRows,
  ratings: readonly RecipeRating[],
  userId: string,
): UserRows {
  const next: RecipeRatingRow[] = ratings.map((r) => ({
    user_id: userId,
    recipe_id: r.recipeId,
    value: r.value,
    reason: r.reason,
    rated_on: r.ratedOn,
  }));
  return { ...rows, recipeRatings: next };
}

/** Ganze Liste „mag ich nicht“ je Lebensmittel ersetzen (geprüft: IDs, keine Doppelten, Obergrenze). */
export function checkFoodDislikesSave(
  foodIds: readonly string[],
): { ok: true; foodIds: string[] } | { ok: false } {
  const parsed = foodDislikesSchema.safeParse([...foodIds].sort());
  return parsed.success ? { ok: true, foodIds: parsed.data } : { ok: false };
}

export function applyFoodDislikes(
  rows: UserRows,
  foodIds: readonly string[],
  userId: string,
): UserRows {
  const next: FoodDislikeRow[] = foodIds.map((id) => ({ user_id: userId, food_id: id }));
  return { ...rows, foodDislikes: next };
}

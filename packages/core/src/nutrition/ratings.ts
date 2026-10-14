import { z } from 'zod';

import { isoDateSchema } from '../age';
import { MEAL_PLAN_SCORING, RECIPE_RATING_RULES } from '../constants';
import type { FoodLookup } from '../content/food-schema';
import { recipeTotalMinutes } from '../content/import-rules';
import { contentIdSchema } from '../content/schemas';
import { addDays } from '../dates';
import type { FilteredRecipe } from './filter';
import type { MealPlanWeek } from './meal-plan';

/**
 * Bewertung nach dem Essen (KONZEPT 6.10, docs/PLAN-PHASE-5.md 19.7 N10) – gratis, rein regelbasiert, ohne KI.
 *
 * Feste Regeln:
 * - Daumen hoch → Bonus im Score (häufiger vorschlagen, Wiederholungsgrenzen bleiben).
 * - Daumen runter → das Rezept wird 8 Wochen nicht mehr vorgeschlagen (tagesgenau: am Bewertungstag und den 55 Tagen
 *   danach; ab Tag 57 wieder), deterministisch.
 * - Gründe (nur mit Daumen runter, solange die 8 Wochen laufen): „Zu aufwendig“ → Bonus für Rezepte ≤ 15 Minuten;
 *   „Macht nicht satt“ → Bonus für mehr Ballaststoffe/Volumen je kcal; „Zu teuer“ → Bonus für eine niedrigere
 *   (freigegebene) Kostenschätzung; „Schmeckt mir nicht“ → keine weitere Wirkung.
 * - „Unverträglich“ ist ein Gesundheitsbezug (Art. 9): Er ist KEIN Grund dieses Schemas und wird nie gespeichert – er
 *   führt nur zum Dialog „Zutaten als ‚mag ich nicht‘ übernehmen?“ (einzeln auswählbar, nichts vorausgewählt), dessen
 *   Ergebnis als `food_dislikes` (je Lebensmittel, hart wie „mag ich nicht“, `filter.ts`) gespeichert wird.
 *
 * Kein Grund ändert Energie, Portionen oder Grenzen (K6): Bewertungen ändern NUR die Reihenfolge der Kandidaten bzw.
 * nehmen abgelehnte Rezepte aus den Vorschlägen. Sie heben nie einen Ausschluss aus `filter.ts` auf (der Filter läuft
 * vorher) und berühren das Planband (`clampCalorieTarget`) nicht. Bewertungen sind privat: nie angezeigt (außer der
 * eigenen Bewertung bei diesem Rezept), nie aggregiert, nie an Analytics oder Logs.
 */

export const RECIPE_RATING_VALUES = ['up', 'down'] as const;
export type RecipeRatingValue = (typeof RECIPE_RATING_VALUES)[number];

/**
 * Gespeicherte Gründe (Spalte `recipe_ratings.reason`) – bewusst OHNE „Unverträglich“ (Art. 9, 19.7 N10). Ein Grund nur
 * mit Daumen runter.
 */
export const RECIPE_RATING_REASONS = ['taste', 'effort', 'cost', 'satiety'] as const;
export type RecipeRatingReason = (typeof RECIPE_RATING_REASONS)[number];

/**
 * Auswahl im Dialog: die gespeicherten Gründe plus „Unverträglich“ (`intolerant`). `intolerant` existiert nur im
 * Arbeitsspeicher der Ansicht und wird von `recipeRatingFromChoice` nie in eine Bewertung übernommen.
 */
export const RECIPE_RATING_CHOICES = [...RECIPE_RATING_REASONS, 'intolerant'] as const;
export type RecipeRatingChoice = (typeof RECIPE_RATING_CHOICES)[number];

/**
 * Eine Bewertung (Spalten wie `recipe_ratings` ab N7: user_id, recipe_id, value, reason, rated_on). Je Person und
 * Rezept gilt die letzte Bewertung (eine Zeile je Rezept, ersetzt die vorige).
 */
export const recipeRatingSchema = z
  .strictObject({
    recipeId: contentIdSchema,
    value: z.enum(RECIPE_RATING_VALUES),
    reason: z.enum(RECIPE_RATING_REASONS).nullable().default(null),
    ratedOn: isoDateSchema,
  })
  .refine((r) => r.value === 'down' || r.reason === null, {
    path: ['reason'],
    message: 'Einen Grund gibt es nur bei „Daumen runter“.',
  });
export type RecipeRating = z.infer<typeof recipeRatingSchema>;
export type RecipeRatingInput = z.input<typeof recipeRatingSchema>;

export const recipeRatingsSchema = z
  .array(recipeRatingSchema)
  .max(RECIPE_RATING_RULES.maxRatings)
  .refine(
    (list) => new Set(list.map((r) => r.recipeId)).size === list.length,
    'Je Rezept nur eine Bewertung.',
  );

/** „Mag ich nicht“ je Lebensmittel (`food_dislikes.food_id`). */
export const foodDislikesSchema = z
  .array(contentIdSchema)
  .max(RECIPE_RATING_RULES.maxFoodDislikes)
  .refine((ids) => new Set(ids).size === ids.length, 'Jedes Lebensmittel nur einmal.');

/** Letzter Tag, an dem ein mit Daumen runter bewertetes Rezept noch ausgeschlossen ist (Bewertungstag + 55). */
export function ratingExclusionLastDay(ratedOn: string): string {
  return addDays(isoDateSchema.parse(ratedOn), RECIPE_RATING_RULES.downExclusionDays - 1);
}

/** Daumen runter mit vorberechnetem letzten Sperrtag (Wächter N10 S3: einmal je Bewertung statt je Abfrage). */
interface DownWindow {
  readonly from: string;
  readonly lastDay: string;
  readonly reason: RecipeRatingReason | null;
}

/**
 * Bewertungen einer Person für die Plan-Engine (geprüft, nach Rezept). Sperrfenster sind vorberechnet; die an einem
 * Tag wirkenden Gründe werden je Tag einmal berechnet und gemerkt (reiner Zwischenspeicher, gleiche Ergebnisse).
 */
export interface RecipeRatingIndex {
  readonly byRecipe: ReadonlyMap<string, RecipeRating>;
  readonly downByRecipe: ReadonlyMap<string, DownWindow>;
  readonly reasonsByDate: Map<string, ReadonlySet<RecipeRatingReason>>;
}

/** Leerer Index (ohne Bewertungen) – je Aufruf neu, damit der Tages-Zwischenspeicher nie geteilt wird. */
function emptyIndex(): RecipeRatingIndex {
  return { byRecipe: new Map(), downByRecipe: new Map(), reasonsByDate: new Map() };
}

/** Bewertungen prüfen (Zod an der Grenze) und nach Rezept ablegen. Ohne Bewertungen: leerer Index. */
export function recipeRatingIndex(
  ratings: readonly RecipeRatingInput[] | undefined,
): RecipeRatingIndex {
  if (ratings === undefined || ratings.length === 0) return emptyIndex();
  const parsed = recipeRatingsSchema.parse(ratings);
  const downByRecipe = new Map<string, DownWindow>();
  for (const r of parsed) {
    if (r.value !== 'down') continue;
    downByRecipe.set(r.recipeId, {
      from: r.ratedOn,
      lastDay: addDays(r.ratedOn, RECIPE_RATING_RULES.downExclusionDays - 1),
      reason: r.reason,
    });
  }
  return {
    byRecipe: new Map(parsed.map((r) => [r.recipeId, r])),
    downByRecipe,
    reasonsByDate: new Map(),
  };
}

/** Gilt ein Sperrfenster an diesem Tag (tagesgenau, Bewertungstag eingeschlossen)? */
function windowActiveOn(window: DownWindow, date: string): boolean {
  return window.from <= date && date <= window.lastDay;
}

/** Wird das Rezept an diesem Tag wegen „Daumen runter“ nicht vorgeschlagen (8 Wochen, tagesgenau)? */
export function recipeBlockedByRating(
  index: RecipeRatingIndex,
  recipeId: string,
  date: string,
): boolean {
  const window = index.downByRecipe.get(recipeId);
  return window !== undefined && windowActiveOn(window, date);
}

/** An irgendeinem dieser Tage blockiert (z. B. alle Tage eines Kochtermins bzw. eines Meal-Prep-Plans)? */
export function recipeBlockedOnAnyDay(
  index: RecipeRatingIndex,
  recipeId: string,
  dates: readonly string[],
): boolean {
  const window = index.downByRecipe.get(recipeId);
  return window !== undefined && dates.some((date) => windowActiveOn(window, date));
}

/** Gründe, die an diesem Tag wirken (aus Daumen-runter-Bewertungen innerhalb der 8 Wochen) – je Tag einmal. */
export function activeRatingReasons(
  index: RecipeRatingIndex,
  date: string,
): ReadonlySet<RecipeRatingReason> {
  const cached = index.reasonsByDate.get(date);
  if (cached !== undefined) return cached;
  const reasons = new Set<RecipeRatingReason>();
  for (const window of index.downByRecipe.values()) {
    if (window.reason !== null && windowActiveOn(window, date)) reasons.add(window.reason);
  }
  index.reasonsByDate.set(date, reasons);
  return reasons;
}

/**
 * Sättigungs-Kennzahl 0–1 für „Macht nicht satt“: Mittel aus Ballaststoffen je 100 kcal und Gramm je kcal (Volumen),
 * je durch den Bezugswert geteilt und auf 1 begrenzt (`RECIPE_RATING_RULES.satiety`). Ohne Energie: 0.
 */
export function recipeSatietyIndex(
  variant: Pick<FilteredRecipe, 'facts' | 'recipe' | 'omitted'>,
): number {
  const kcal = variant.facts.perServing.kcal;
  if (!(kcal > 0)) return 0;
  const omitted = new Set(variant.omitted);
  const grams = variant.recipe.ingredients.reduce(
    (sum, ingredient, index) =>
      ingredient.optional || omitted.has(index)
        ? sum
        : sum + (variant.facts.gramsPerServing[index] ?? 0),
    0,
  );
  const { fiberGPer100Kcal, gramsPerKcal } = RECIPE_RATING_RULES.satiety;
  // Ballaststoffe unbekannt (null) zählen wie 0 (kein Bonus statt eines geschätzten).
  const fiber = Math.min(
    ((variant.facts.perServing.fiber_g ?? 0) * 100) / kcal / fiberGPer100Kcal,
    1,
  );
  const volume = Math.min(grams / kcal / gramsPerKcal, 1);
  return (fiber + volume) / 2;
}

/**
 * Bonus im Score eines Kandidaten an diesem Tag (Plan 19.7 N10, `MEAL_PLAN_SCORING`) – ändert nur die Reihenfolge.
 * Ein Kandidat, der hier ankommt, hat den Filter schon bestanden; der Bonus kann daran nichts ändern.
 */
export function ratingScoreBonus(
  index: RecipeRatingIndex,
  candidate: Pick<FilteredRecipe, 'facts' | 'recipe' | 'omitted'>,
  date: string,
  /** Vorab je Tag berechnete Gründe (`activeRatingReasons`, Wächter N10 S3); ohne: hier berechnet (gemerkt). */
  reasonsIn?: ReadonlySet<RecipeRatingReason>,
): number {
  if (index.byRecipe.size === 0) return 0;
  const W = MEAL_PLAN_SCORING;
  let bonus = 0;
  if (index.byRecipe.get(candidate.recipe.id)?.value === 'up') bonus += W.ratingUp;
  const reasons = reasonsIn ?? activeRatingReasons(index, date);
  if (
    reasons.has('effort') &&
    recipeTotalMinutes(candidate.recipe) <= RECIPE_RATING_RULES.quickMaxMinutes
  ) {
    bonus += W.ratingQuick;
  }
  if (reasons.has('satiety')) bonus += W.ratingSatiety * recipeSatietyIndex(candidate);
  const cost = candidate.recipe.cost_estimate;
  if (reasons.has('cost') && cost?.reviewed_by !== undefined) {
    const ref = RECIPE_RATING_RULES.costReferenceEurPerServing;
    bonus += W.ratingCheaper * Math.min(Math.max(1 - cost.eur_per_serving / ref, 0), 1);
  }
  // Wächter N10 S2: Summe gedeckelt, strikt unter dem Wiederholungs-Abzug – Abwechslung behält Vorrang.
  return Math.min(bonus, W.ratingMaxTotal);
}

/**
 * Gespeicherter Plan einer Woche, die noch NICHT begonnen hat, mit einem Rezept, das an seinem Tag wegen „Daumen
 * runter“ gesperrt ist (Wächter N10 S1)? Dann bietet die App „Plan aktualisieren“ an – ohne automatische Neuplanung.
 * Die laufende Woche (Wochenanfang ≤ heute) bleibt wie bisher unverändert (K7); vergangene Wochen ohnehin.
 */
export function mealPlanHasRatedDownRecipes(
  plan: Pick<MealPlanWeek, 'weekStart' | 'days'>,
  ratings: readonly RecipeRatingInput[] | undefined,
  today: string,
): boolean {
  if (plan.weekStart <= isoDateSchema.parse(today)) return false;
  const index = recipeRatingIndex(ratings);
  if (index.downByRecipe.size === 0) return false;
  return plan.days.some((day) =>
    day.meals.some((meal) => recipeBlockedByRating(index, meal.recipeId, day.date)),
  );
}

// ---------------------------------------------------------------------------------------------------------
// Bewerten (Ansicht → gespeicherte Bewertung)
// ---------------------------------------------------------------------------------------------------------

export interface RecipeRatingDecision {
  /** Zu speichernde Bewertung – nie mit „Unverträglich“. */
  readonly rating: RecipeRating;
  /** Dialog „Zutaten als ‚mag ich nicht‘ übernehmen?“ anbieten (nur nach „Unverträglich“). */
  readonly offerFoodDislikes: boolean;
}

/**
 * Auswahl in der Ansicht → Bewertung. „Unverträglich“ wird NIE übernommen (Grund `null`), sondern öffnet nur den
 * Dialog. Ein Grund bei Daumen hoch wird verworfen (Gründe gibt es nur bei Daumen runter).
 */
export function recipeRatingFromChoice(input: {
  readonly recipeId: string;
  readonly value: RecipeRatingValue;
  readonly choice: RecipeRatingChoice | null;
  readonly ratedOn: string;
}): RecipeRatingDecision {
  const choice = input.value === 'down' ? input.choice : null;
  const reason: RecipeRatingReason | null =
    choice === null || choice === 'intolerant' ? null : choice;
  return {
    rating: recipeRatingSchema.parse({
      recipeId: input.recipeId,
      value: input.value,
      reason,
      ratedOn: input.ratedOn,
    }),
    offerFoodDislikes: choice === 'intolerant',
  };
}

/** Bewertung eines Rezepts ersetzen bzw. hinzufügen (je Rezept die letzte), Reihenfolge nach Rezept-ID. */
export function upsertRecipeRating(
  ratings: readonly RecipeRatingInput[],
  rating: RecipeRatingInput,
): RecipeRating[] {
  const next = recipeRatingSchema.parse(rating);
  return recipeRatingsSchema.parse(
    [...ratings.filter((r) => r.recipeId !== next.recipeId), next].sort((a, b) =>
      a.recipeId < b.recipeId ? -1 : a.recipeId > b.recipeId ? 1 : 0,
    ),
  );
}

/**
 * Obergrenze erreicht (Wächter N10 H4)? Eine NEUE Bewertung passt nicht mehr; das Ändern einer vorhandenen geht immer.
 * Aufgeräumt wird bewusst nichts (offene Gründer-Entscheidung G3) – die App zeigt eine verständliche Meldung.
 */
export function recipeRatingLimitReached(
  ratings: readonly Pick<RecipeRatingInput, 'recipeId'>[],
  recipeId: string,
): boolean {
  return (
    ratings.length >= RECIPE_RATING_RULES.maxRatings &&
    !ratings.some((r) => r.recipeId === recipeId)
  );
}

/** Bewertung eines Rezepts zurücknehmen. */
export function removeRecipeRating(
  ratings: readonly RecipeRatingInput[],
  recipeId: string,
): RecipeRating[] {
  return recipeRatingsSchema.parse(ratings.filter((r) => r.recipeId !== recipeId));
}

/** Kann eine geplante Mahlzeit bewertet werden? Nur „nach dem Essen“: Tag ≤ heute. */
export function mealRatable(mealDate: string, today: string): boolean {
  return isoDateSchema.parse(mealDate) <= isoDateSchema.parse(today);
}

// ---------------------------------------------------------------------------------------------------------
// Dialog „Zutaten als ‚mag ich nicht‘ übernehmen?“ (nach „Unverträglich“)
// ---------------------------------------------------------------------------------------------------------

export interface FoodDislikeChoice {
  readonly foodId: string;
  readonly nameDe: string;
}

/**
 * Zutaten der gegessenen Mahlzeit zur Auswahl (S8): je Lebensmittel einmal, in Rezept-Reihenfolge, nur bekannte
 * Lebensmittel, ohne die schon abgelehnten. Es wird NICHTS vorausgewählt – die Ansicht startet mit leerer Auswahl.
 */
export function foodDislikeChoices(
  ingredients: readonly { readonly foodId: string }[],
  foods: FoodLookup,
  existing: readonly string[],
): FoodDislikeChoice[] {
  const taken = new Set(existing);
  const seen = new Set<string>();
  const choices: FoodDislikeChoice[] = [];
  for (const { foodId } of ingredients) {
    const food = foods.get(foodId);
    if (food === undefined || taken.has(foodId) || seen.has(foodId)) continue;
    seen.add(foodId);
    choices.push({ foodId, nameDe: food.name_de });
  }
  return choices;
}

export type FoodDislikesUpdate =
  | { readonly ok: true; readonly dislikes: string[] }
  | { readonly ok: false; readonly reason: 'nothing_selected' | 'limit' | 'invalid' };

/**
 * Bestätigte Auswahl übernehmen: nur ausdrücklich gewählte Lebensmittel (leere Auswahl = nichts speichern), ohne
 * Doppelte, sortiert, höchstens `RECIPE_RATING_RULES.maxFoodDislikes`.
 */
export function addFoodDislikes(
  existing: readonly string[],
  selected: readonly string[],
): FoodDislikesUpdate {
  if (selected.length === 0) return { ok: false, reason: 'nothing_selected' };
  const ids = z.array(contentIdSchema).safeParse(selected);
  if (!ids.success) return { ok: false, reason: 'invalid' };
  const next = [...new Set([...existing, ...ids.data])].sort();
  if (next.length > RECIPE_RATING_RULES.maxFoodDislikes) return { ok: false, reason: 'limit' };
  const parsed = foodDislikesSchema.safeParse(next);
  return parsed.success ? { ok: true, dislikes: parsed.data } : { ok: false, reason: 'invalid' };
}

/** Ein Lebensmittel wieder zulassen. */
export function removeFoodDislike(existing: readonly string[], foodId: string): string[] {
  return foodDislikesSchema.parse(existing.filter((id) => id !== foodId));
}

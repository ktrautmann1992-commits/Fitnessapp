import { z } from 'zod';

import { FRIDGE_SEARCH, PANTRY } from '../constants';
import {
  type Food,
  type FoodLookup,
  SHOPPING_CATEGORIES,
  type ShoppingCategory,
} from '../content/food-schema';
import type { Recipe } from '../content/recipe-schema';
import { contentIdSchema } from '../content/schemas';
import type { FilteredRecipe } from './filter';
import { recipeForPersonWithDiets, type RecipeForPersonContext } from './recipe-search';
import { mealPlanProfileSchema, type MealPlanProfileInput } from './schemas';
import { toGrams } from './units';

/**
 * Kühlschrank-Suche „Was habe ich da?“ (docs/PLAN-PHASE-5.md 19.7 N11, KONZEPT 6.11) – gratis, rein regelbasiert,
 * ohne Echtzeit-KI.
 *
 * 1. Harte Filter ZUERST und unverändert wie in der Rezeptsuche: jedes Rezept läuft über `recipeForPersonWithDiets`
 *    (also `filter.ts`) mit der Ernährungsform des Profils – Schwein, Unverträglichkeiten, „mag ich nicht“ (Gruppen
 *    und Lebensmittel), Schwangerschafts-Vorsicht, Status/Katalog. Die Kühlschrank-Suche erweitert die
 *    Ernährungsform NICHT (Präzisierung N11) und hebt nie einen Ausschluss auf; sie kennt nur die Varianten, die der
 *    Filter liefert (ohne weggelassene optionale Zutaten, mit Ersatzprodukten).
 * 2. Übereinstimmung = Anteil der vorhandenen Zutaten, gewichtet nach Menge in Gramm; Zutaten aus dem Vorrat
 *    (`pantry`) und Gewürze/Backzutaten zählen nur mit `FRIDGE_SEARCH.minorWeight` ihrer Menge. Optionale Zutaten
 *    zählen nicht (weder vorhanden noch fehlend). Verglichen wird das TATSÄCHLICH verwendete Lebensmittel (bei
 *    Ersatz das Ersatzprodukt).
 * 3. Gelistet wird ein Rezept nur, wenn mindestens eine vorhandene Zutat KEIN Gewürz ist (sonst passte jedes Rezept
 *    mit Salz) und die Übereinstimmung mindestens 1 % beträgt (abgerundet, Wächter N11 S1). Sortierung stabil: Übereinstimmung absteigend, dann weniger fehlende Hauptzutaten, Titel, ID.
 * Die Auswahl wird nirgends gespeichert (reine Funktion; die App hält sie nur im Zustand der Ansicht).
 */

export const fridgeSearchQuerySchema = z
  .strictObject({
    /** Ausgewählte Lebensmittel (Katalog-IDs); doppelte zählen einmal. */
    foodIds: z.array(contentIdSchema).max(FRIDGE_SEARCH.maxSelectedFoods).default([]),
    /**
     * Vorratsschrank (Gründer-Freigabe 25.10.2026, `pantry.ts`): Lebensmittel aus dem Vorrat zählen als vorhanden –
     * „fast leer“ nur mit `PANTRY.lowWeight`. Ausgewählte Zutaten gehen vor (zählen voll).
     */
    pantry: z
      .array(z.strictObject({ foodId: contentIdSchema, low: z.boolean() }))
      .max(PANTRY.itemsMax)
      .default([]),
  })
  .default({ foodIds: [], pantry: [] });
export type FridgeSearchQuery = z.input<typeof fridgeSearchQuerySchema>;

export interface FridgeSearchInput {
  readonly recipes: readonly Recipe[];
  readonly foods: FoodLookup;
  readonly profile: MealPlanProfileInput;
  /** Ausschluss `pregnancy_caution` (wie die Rezeptsuche: sobald er an einem Tag der Woche gilt). */
  readonly excludePregnancyCaution: boolean;
  readonly allowDrafts: boolean;
  readonly redRecipeIds?: ReadonlySet<string>;
}

export interface FridgeSearchHit {
  /** Für die Person gefilterte Variante (wie die Rezeptsuche). */
  readonly variant: FilteredRecipe;
  /** Übereinstimmung 0–1 (gewichtet nach Menge, Vorrat/Gewürze wenig). */
  readonly match: number;
  /** Vorhandene Zutaten (Lebensmittel-IDs in Rezept-Reihenfolge, ohne Doppelte). */
  readonly have: readonly string[];
  /** Fehlende Hauptzutaten (nicht Vorrat, kein Gewürz), in Rezept-Reihenfolge, ohne Doppelte. */
  readonly missing: readonly string[];
  /** Fehlende Zutaten aus Vorrat und Gewürzen („hast du wahrscheinlich da“). */
  readonly missingMinor: readonly string[];
  /** Vorhandene Zutaten, die (nur) aus dem Vorratsschrank kommen (Teilmenge von `have`). */
  readonly fromPantry: readonly string[];
}

export interface FridgeFoodOption {
  readonly foodId: string;
  readonly name: string;
  readonly category: ShoppingCategory;
  /** Vorrat oder Gewürz – zählt wenig. */
  readonly minor: boolean;
}

/** Gewürze & Backzutaten: zählen wenig und reichen allein nicht für einen Treffer. */
export function isSeasoningFood(food: Pick<Food, 'shopping_category'>): boolean {
  return food.shopping_category === 'spices_baking';
}

/** Vorrat oder Gewürz („zählt wenig“, Plan 19.7 N11). */
export function isMinorFridgeFood(food: Pick<Food, 'pantry' | 'shopping_category'>): boolean {
  return food.pantry || isSeasoningFood(food);
}

interface UsedIngredient {
  readonly foodId: string;
  readonly food: Food;
  readonly grams: number;
}

/** Nicht-optionale Zutaten der Variante mit dem tatsächlich verwendeten Lebensmittel und der Menge in Gramm. */
function usedIngredients(variant: FilteredRecipe, foods: FoodLookup): UsedIngredient[] {
  const omitted = new Set(variant.omitted);
  const subs = new Map(variant.substitutions.map((s) => [s.index, s.substituteFoodId]));
  const used: UsedIngredient[] = [];
  variant.recipe.ingredients.forEach((ingredient, index) => {
    if (omitted.has(index) || ingredient.optional) return;
    const foodId = subs.get(index) ?? ingredient.food_id;
    const food = foods.get(foodId);
    // Der Filter lässt nur Rezepte mit vorhandenen, umrechenbaren Lebensmitteln durch (R2); sonst zählt die Zutat
    // mit Gewicht 0 (nie als vorhanden).
    if (food === undefined) return;
    const grams = toGrams(ingredient.amount, ingredient.unit, food.units) ?? 0;
    used.push({ foodId, food, grams });
  });
  return used;
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function personContext(input: FridgeSearchInput): RecipeForPersonContext {
  return {
    foods: input.foods,
    profile: mealPlanProfileSchema.parse(input.profile),
    excludePregnancyCaution: input.excludePregnancyCaution,
    allowDrafts: input.allowDrafts,
    ...(input.redRecipeIds !== undefined ? { redRecipeIds: input.redRecipeIds } : {}),
  };
}

/**
 * Varianten aller Rezepte, die zur Person passen (Profil-Ernährungsform, alle harten Ausschlüsse). Hängt NICHT von der
 * Auswahl ab – die App rechnet sie einmal je Profil/Bestand (Wächter N11 S2) und gibt sie an
 * `fridgeSearchFoodOptions`/`searchFridge` weiter; ohne Übergabe rechnen beide sie selbst (gleiches Ergebnis).
 */
export function fridgeSearchVariants(input: FridgeSearchInput): FilteredRecipe[] {
  const ctx = personContext(input);
  const variants: FilteredRecipe[] = [];
  for (const recipe of input.recipes) {
    const hit = recipeForPersonWithDiets(recipe, ctx, []);
    if (hit !== null) variants.push(hit.variant);
  }
  return variants;
}

/**
 * Auswahlliste „Was habe ich da?“: alle Lebensmittel, die in mindestens einem für die Person passenden Rezept
 * (nicht optional) verwendet werden – ausgeschlossene Lebensmittel erscheinen also nie. Nach Abteilung (feste
 * Reihenfolge 5.5), dann Name.
 */
export function fridgeSearchFoodOptions(
  input: FridgeSearchInput,
  variants: readonly FilteredRecipe[] = fridgeSearchVariants(input),
): FridgeFoodOption[] {
  const seen = new Map<string, FridgeFoodOption>();
  for (const variant of variants) {
    for (const { foodId, food } of usedIngredients(variant, input.foods)) {
      if (seen.has(foodId)) continue;
      seen.set(foodId, {
        foodId,
        name: food.name_de,
        category: food.shopping_category,
        minor: isMinorFridgeFood(food),
      });
    }
  }
  const order = new Map(SHOPPING_CATEGORIES.map((c, i) => [c, i]));
  return [...seen.values()].sort(
    (a, b) =>
      (order.get(a.category) ?? 0) - (order.get(b.category) ?? 0) ||
      a.name.localeCompare(b.name, 'de') ||
      (a.foodId < b.foodId ? -1 : a.foodId > b.foodId ? 1 : 0),
  );
}

/**
 * Übereinstimmung eines Rezepts mit der Auswahl (Zutaten mit Gewicht, Plan 19.7 N11). `pantry` = Vorratsschrank
 * (Lebensmittel → Anteil 1 bzw. `PANTRY.lowWeight` bei „fast leer“): eine Zutat aus dem Vorrat zählt mit diesem Anteil
 * als vorhanden, eine ausgewählte immer voll. Ohne Vorrat genau wie bisher.
 */
export function fridgeMatch(
  variant: FilteredRecipe,
  foods: FoodLookup,
  selected: ReadonlySet<string>,
  pantry: ReadonlyMap<string, number> = new Map(),
): Omit<FridgeSearchHit, 'variant'> & { readonly hasMainMatch: boolean } {
  let total = 0;
  let present = 0;
  let hasMainMatch = false;
  const have: string[] = [];
  const fromPantry: string[] = [];
  const missing: string[] = [];
  const missingMinor: string[] = [];
  for (const { foodId, food, grams } of usedIngredients(variant, foods)) {
    const weight = grams * (isMinorFridgeFood(food) ? FRIDGE_SEARCH.minorWeight : 1);
    total += weight;
    const share = selected.has(foodId) ? 1 : (pantry.get(foodId) ?? 0);
    if (share > 0) {
      present += weight * share;
      have.push(foodId);
      if (!selected.has(foodId)) fromPantry.push(foodId);
      if (!isSeasoningFood(food)) hasMainMatch = true;
    } else if (isMinorFridgeFood(food)) {
      missingMinor.push(foodId);
    } else {
      missing.push(foodId);
    }
  }
  const match = total > 0 ? Math.min(1, present / total) : 0;
  return {
    match,
    have: unique(have),
    missing: unique(missing),
    missingMinor: unique(missingMinor),
    fromPantry: unique(fromPantry),
    hasMainMatch,
  };
}

/** Vorrat als Anteile je Lebensmittel (1 bzw. `PANTRY.lowWeight` bei „fast leer“). */
export function pantryShares(
  pantry: readonly { readonly foodId: string; readonly low: boolean }[],
): Map<string, number> {
  const shares = new Map<string, number>();
  for (const item of pantry) {
    const share = item.low ? PANTRY.lowWeight : 1;
    shares.set(item.foodId, Math.max(shares.get(item.foodId) ?? 0, share));
  }
  return shares;
}

/** Übereinstimmung auf feste Stellen gerundet, damit die Sortierung nicht an Rundungsresten hängt. */
function sortKey(match: number): number {
  return Math.round(match * 1e6);
}

/**
 * Kühlschrank-Suche: Treffer für die ausgewählten Zutaten und den Vorratsschrank. Leere Auswahl und leerer Vorrat →
 * keine Treffer (die App zeigt dann den Hinweis „Wähle aus, was du da hast“). Nur Vorrat → „Passt zu deinem Vorrat“.
 * Bei gleicher Übereinstimmung und gleich vielen fehlenden Hauptzutaten zuerst Rezepte mit mehr Vorrats-Zutaten. Gelistet erst ab 1 % Übereinstimmung (abgerundet, wie angezeigt) – keine
 * Karten mit „0 % passt“, z. B. nur Öl ausgewählt (Wächter N11 S1; Gewichtung unverändert, G2 offen).
 * `variants` = schon gefilterte Varianten aus `fridgeSearchVariants(input)` (dieselbe Eingabe!).
 */
export function searchFridge(
  input: FridgeSearchInput,
  rawQuery?: FridgeSearchQuery,
  variants?: readonly FilteredRecipe[],
): FridgeSearchHit[] {
  const query = fridgeSearchQuerySchema.parse(rawQuery);
  const selected = new Set(query.foodIds);
  const pantry = pantryShares(query.pantry);
  if (selected.size === 0 && pantry.size === 0) return [];
  const hits: FridgeSearchHit[] = [];
  for (const variant of variants ?? fridgeSearchVariants(input)) {
    const { hasMainMatch, ...result } = fridgeMatch(variant, input.foods, selected, pantry);
    if (!hasMainMatch || fridgeMatchPercent(result.match) < FRIDGE_SEARCH.minPercent) continue;
    hits.push({ variant, ...result });
  }
  return hits.sort(
    (a, b) =>
      sortKey(b.match) - sortKey(a.match) ||
      a.missing.length - b.missing.length ||
      b.fromPantry.length - a.fromPantry.length ||
      a.variant.recipe.title_de.localeCompare(b.variant.recipe.title_de, 'de') ||
      (a.variant.recipe.id < b.variant.recipe.id ? -1 : 1),
  );
}

/** Übereinstimmung in ganzen Prozent für die Anzeige (abgerundet: 100 % nur, wenn wirklich alles da ist). */
export function fridgeMatchPercent(match: number): number {
  return Math.floor(Math.max(0, Math.min(1, match)) * 100 + 1e-9);
}

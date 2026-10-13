import { z } from 'zod';

import { PORTION_SCALE_LIMITS, RECIPE_SERVINGS_PICKER } from '../constants';
import type { Food, FoodLookup } from '../content/food-schema';
import type { Recipe } from '../content/recipe-schema';
import type { FilteredRecipe, RecipeSubstitution } from './filter';
import {
  addFoodNutrients,
  divideNutrients,
  type RecipeNutrients,
  zeroNutrients,
} from './recipe-nutrients';
import { type RecipeUnit, roundAmount, toGrams } from './units';

/**
 * Portionsskalierung (docs/PLAN-PHASE-5.md 6.2, `scale.ts`): Faktor 0,5–2,0 auf das Grundrezept (÷ `servings`),
 * Rundung je Einheit (nie auf 0), Nährwerte NACH der Rundung neu gerechnet, und der Tagesausgleich ins Planband
 * (B1). Kennt KEINE Schutzgrenzen – das Planband kommt fertig aus `nutritionTargetsForWeek` (`clampCalorieTarget`).
 * Dazu der Portionswähler `scaleRecipeForServings` (19.6, ohne Bezug zu Kalorienzielen).
 */

export interface ScaledIngredient {
  /** Index der Zutat im Rezept. */
  readonly index: number;
  /** Tatsächlich verwendetes Lebensmittel (bei Ersatz das Ersatzprodukt, S4). */
  readonly foodId: string;
  /** Ursprüngliches Lebensmittel, nur bei Ersatz. */
  readonly originalFoodId: string | null;
  readonly amount: number;
  readonly unit: RecipeUnit;
  readonly optional: boolean;
  /** Gerundete Menge in Gramm. */
  readonly grams: number;
}

export interface ScaledPortion {
  readonly factor: number;
  readonly ingredients: readonly ScaledIngredient[];
  /** Nährwerte der gerundeten Mengen (ohne optionale Zutaten, wie `computeRecipeFacts`). */
  readonly nutrients: RecipeNutrients;
  /**
   * kcal der NICHT weggelassenen optionalen Zutaten (Wächter N3 K3): zählen für die Untergrenze nicht (sichere
   * Richtung), für die Obergrenze aber mit – wer sie isst, darf nicht über die Obergrenze kommen.
   */
  readonly optionalKcal: number;
}

type RecipeVariant = Pick<FilteredRecipe, 'recipe' | 'omitted' | 'substitutions'>;

/** Eier werden nur ganz verwendet (Plan 6.2). */
function isWholePiece(food: Food, unit: RecipeUnit): boolean {
  return unit === 'piece' && (food.groups.includes('eggs') || food.animal.includes('egg'));
}

function substitutionMap(substitutions: readonly RecipeSubstitution[]): Map<number, string> {
  return new Map(substitutions.map((s) => [s.index, s.substituteFoodId]));
}

/**
 * Skaliert ein Rezept: `multiplier(scales)` liefert den Faktor je Zutat auf die Rezeptmenge. Weggelassene
 * optionale Zutaten fehlen, Ersatzprodukte stehen statt des Originals.
 */
function scaleIngredients(
  variant: RecipeVariant,
  foods: FoodLookup,
  multiplier: (scales: boolean) => number,
): { ingredients: ScaledIngredient[]; nutrients: RecipeNutrients; optionalKcal: number } {
  const omitted = new Set(variant.omitted);
  const subs = substitutionMap(variant.substitutions);
  const ingredients: ScaledIngredient[] = [];
  const nutrients = zeroNutrients();
  let optionalKcal = 0;
  variant.recipe.ingredients.forEach((ingredient, index) => {
    if (omitted.has(index)) return;
    const foodId = subs.get(index) ?? ingredient.food_id;
    const food = foods.get(foodId);
    if (food === undefined) {
      throw new Error(`Lebensmittel „${foodId}“ fehlt im Katalog.`);
    }
    const raw = ingredient.amount * multiplier(ingredient.scales);
    const amount = roundAmount(raw, ingredient.unit, {
      wholePieces: isWholePiece(food, ingredient.unit),
    });
    const grams = toGrams(amount, ingredient.unit, food.units);
    if (grams === null) {
      throw new Error(`Einheit „${ingredient.unit}“ für „${foodId}“ nicht umrechenbar.`);
    }
    ingredients.push({
      index,
      foodId,
      originalFoodId: subs.has(index) ? ingredient.food_id : null,
      amount,
      unit: ingredient.unit,
      optional: ingredient.optional,
      grams,
    });
    if (!ingredient.optional) {
      addFoodNutrients(nutrients, food, grams);
    } else {
      optionalKcal += (grams * food.nutrients_per_100g.kcal) / 100;
    }
  });
  return { ingredients, nutrients, optionalKcal };
}

const factorSchema = z
  .number()
  .finite()
  .min(PORTION_SCALE_LIMITS.min)
  .max(PORTION_SCALE_LIMITS.max);

/**
 * Eine Portion mit Faktor 0,5–2,0 (Plan 6.2): Menge je Portion = Rezeptmenge ÷ `servings` × Faktor; Zutaten mit
 * `scales: false` (z. B. eine Prise Salz) werden nicht mit dem Faktor vervielfacht. Gerundet nach `roundAmount`.
 */
export function scalePortion(
  variant: RecipeVariant,
  factor: number,
  foods: FoodLookup,
): ScaledPortion {
  const f = factorSchema.parse(factor);
  const servings = variant.recipe.servings;
  const { ingredients, nutrients, optionalKcal } = scaleIngredients(variant, foods, (scales) =>
    scales ? f / servings : 1 / servings,
  );
  return { factor: f, ingredients, nutrients, optionalKcal };
}

export interface ServingsScaled {
  readonly servings: number;
  readonly ingredients: readonly ScaledIngredient[];
  /** Nährwerte aller Portionen zusammen (nach der Rundung). */
  readonly total: RecipeNutrients;
  readonly perServing: RecipeNutrients;
}

const servingsSchema = z
  .number()
  .int()
  .min(RECIPE_SERVINGS_PICKER.min)
  .max(RECIPE_SERVINGS_PICKER.max);

/**
 * Portionswähler (Plan 19.6): 1–12 Portionen, Rundung nach 6.2, Nährwerte nach der Rundung neu. Zutaten mit
 * `scales: false` bleiben bei der Rezeptmenge. Kein Bezug zu Kalorienzielen (das ist das Planband).
 */
export function scaleRecipeForServings(
  variant: RecipeVariant | Recipe,
  servings: number,
  foods: FoodLookup,
): ServingsScaled {
  const n = servingsSchema.parse(servings);
  const v: RecipeVariant =
    'recipe' in variant ? variant : { recipe: variant, omitted: [], substitutions: [] };
  const { ingredients, nutrients } = scaleIngredients(v, foods, (scales) =>
    scales ? n / v.recipe.servings : 1,
  );
  const perServing = divideNutrients(nutrients, n);
  return { servings: n, ingredients, total: nutrients, perServing };
}

// ---------------------------------------------------------------------------------------------------------
// Tagesausgleich ins Planband (B1)
// ---------------------------------------------------------------------------------------------------------

export interface PortionDraft {
  readonly variant: RecipeVariant;
  /** Gewünschter Faktor bei gleichmäßiger Verteilung (Slot-Ziel ÷ kcal je Portion), ungeklemmt. */
  readonly baseFactor: number;
  /** Fester Faktor (z. B. schon gekochte Meal-Prep-Portion) – wird nicht verändert. */
  readonly fixedFactor?: number | undefined;
}

export interface BalancedDay {
  readonly portions: readonly ScaledPortion[];
  readonly totalKcal: number;
  /** `in_band`: Summe ∈ Band; `below`: auch mit allen Faktoren 2,0 unter dem Band; `above`: auch mit 0,5 darüber. */
  readonly status: 'in_band' | 'below' | 'above';
}

const { min: F_MIN, max: F_MAX } = PORTION_SCALE_LIMITS;
const ITERATIONS = 48;

function clampFactor(value: number): number {
  return Math.min(Math.max(value, F_MIN), F_MAX);
}

/**
 * Bringt die Tagessumme ins Band [min, max], Zielpunkt Bandmitte (Plan 6.2, B1). Alle nicht festen Portionen
 * bekommen den Faktor `clamp(baseFactor × m, 0,5, 2,0)` mit einem gemeinsamen `m` (Ausgleich in beide Richtungen);
 * gerechnet wird mit den GERUNDETEN Mengen. Springt die Rundung über das Band, wird je Portion einzeln nachgeregelt.
 */
export function balancePortions(
  drafts: readonly PortionDraft[],
  band: { readonly min: number; readonly max: number },
  foods: FoodLookup,
): BalancedDay {
  const cache = new Map<string, ScaledPortion>();
  const portionAt = (i: number, factor: number): ScaledPortion => {
    const draft = drafts[i] as PortionDraft;
    const f = draft.fixedFactor ?? clampFactor(factor);
    const key = `${i}:${f}`;
    let portion = cache.get(key);
    if (portion === undefined) {
      portion = scalePortion(draft.variant, f, foods);
      cache.set(key, portion);
    }
    return portion;
  };
  const factorsAt = (m: number): number[] =>
    drafts.map((d) => d.fixedFactor ?? clampFactor(d.baseFactor * m));
  const evaluate = (factors: readonly number[]) => {
    const portions = factors.map((f, i) => portionAt(i, f));
    const total = portions.reduce((sum, p) => sum + p.nutrients.kcal, 0);
    // Für die Obergrenze zählen nicht weggelassene optionale Zutaten mit (K3).
    const totalMax = total + portions.reduce((sum, p) => sum + p.optionalKcal, 0);
    return { portions, total, totalMax };
  };
  const fits = (e: { total: number; totalMax: number }) =>
    e.total >= band.min && e.totalMax <= band.max;
  const result = (factors: readonly number[], status: BalancedDay['status']): BalancedDay => {
    const { portions, total } = evaluate(factors);
    return { portions, totalKcal: total, status };
  };

  const adjustable = drafts.some((d) => d.fixedFactor === undefined);
  const smallestBase = Math.min(
    ...drafts.filter((d) => d.fixedFactor === undefined).map((d) => d.baseFactor),
  );
  const mLow = 0;
  const mHigh = adjustable ? F_MAX / Math.max(smallestBase, 1e-6) : 0;
  const low = evaluate(factorsAt(mLow));
  if (low.totalMax > band.max) return result(factorsAt(mLow), 'above');
  const high = evaluate(factorsAt(mHigh));
  if (high.total < band.min) return result(factorsAt(mHigh), 'below');
  if (!adjustable) return result(factorsAt(0), fits(low) ? 'in_band' : 'above');

  /** Kleinstes m mit Summe ≥ `goal` (Summe ist monoton steigend in m). */
  const smallestReaching = (goal: number): { lo: number; hi: number } => {
    let lo = mLow;
    let hi = mHigh;
    for (let k = 0; k < ITERATIONS; k += 1) {
      const mid = (lo + hi) / 2;
      if (evaluate(factorsAt(mid)).total >= goal) hi = mid;
      else lo = mid;
    }
    return { lo, hi };
  };

  const middle = (band.min + band.max) / 2;
  const towardMiddle = smallestReaching(middle);
  const options = [towardMiddle.hi, towardMiddle.lo]
    .map((m) => ({ m, ...evaluate(factorsAt(m)) }))
    .filter((o) => fits(o))
    .sort((a, b) => Math.abs(a.total - middle) - Math.abs(b.total - middle));
  const best = options[0];
  if (best !== undefined) return result(factorsAt(best.m), 'in_band');

  // Rundungssprung über das Band: vom letzten Stand unter der Untergrenze je Portion einzeln nachregeln.
  const reachMin = smallestReaching(band.min);
  const start = factorsAt(reachMin.lo);
  for (let i = 0; i < drafts.length; i += 1) {
    if (drafts[i]?.fixedFactor !== undefined) continue;
    let lo = start[i] as number;
    let hi: number = F_MAX;
    const withFactor = (f: number) => start.map((value, j) => (j === i ? f : value));
    if (evaluate(withFactor(hi)).total < band.min) continue;
    for (let k = 0; k < ITERATIONS; k += 1) {
      const mid = (lo + hi) / 2;
      if (evaluate(withFactor(mid)).total >= band.min) hi = mid;
      else lo = mid;
    }
    const candidate = withFactor(hi);
    if (fits(evaluate(candidate))) return result(candidate, 'in_band');
  }
  // Nicht genau treffbar: lieber über dem Band (der Aufrufer streicht dann) als unter der Untergrenze.
  return result(factorsAt(reachMin.hi), 'above');
}

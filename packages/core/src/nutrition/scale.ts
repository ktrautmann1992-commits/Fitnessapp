import { z } from 'zod';

import { PORTION_SCALE_LIMITS, RECIPE_SERVINGS_PICKER } from '../constants';
import type { Food, FoodLookup } from '../content/food-schema';
import type { Recipe, RecipeIngredient } from '../content/recipe-schema';
import type { AppliedSwap, FilteredRecipe, RecipeSubstitution } from './filter';
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
  /** Ursprüngliches Lebensmittel, nur bei Ersatz (S4) bzw. Zutaten-Austausch (N9). */
  readonly originalFoodId: string | null;
  /** Nur beim Zutaten-Austausch (19.7 N9): vom Nutzer getauscht (sonst fehlt das Feld). */
  readonly swapped?: true;
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

type RecipeVariant = Pick<FilteredRecipe, 'recipe' | 'omitted' | 'substitutions'> & {
  /** Getauschte Zutaten (19.7 N9): Lebensmittel, Menge und Einheit des Ersatzes. */
  readonly swaps?: readonly AppliedSwap[];
};

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
  multiplier: (scales: boolean, original: RecipeIngredient) => number,
  /** Eigene Rundung je Zutat (geteilte Portionen, N13); `null` = Standard nach `roundAmount`. */
  rounding?: (original: RecipeIngredient, unit: RecipeUnit, raw: number) => number | null,
): { ingredients: ScaledIngredient[]; nutrients: RecipeNutrients; optionalKcal: number } {
  const omitted = new Set(variant.omitted);
  const subs = substitutionMap(variant.substitutions);
  const swaps = new Map((variant.swaps ?? []).map((s) => [s.index, s]));
  const ingredients: ScaledIngredient[] = [];
  const nutrients = zeroNutrients();
  let optionalKcal = 0;
  variant.recipe.ingredients.forEach((original, index) => {
    if (omitted.has(index)) return;
    const swap = swaps.get(index);
    const ingredient =
      swap === undefined
        ? original
        : { ...original, food_id: swap.substituteFoodId, amount: swap.amount, unit: swap.unit };
    const foodId = subs.get(index) ?? ingredient.food_id;
    const food = foods.get(foodId);
    if (food === undefined) {
      throw new Error(`Lebensmittel „${foodId}“ fehlt im Katalog.`);
    }
    const raw = ingredient.amount * multiplier(ingredient.scales, original);
    const amount =
      rounding?.(original, ingredient.unit, raw) ??
      roundAmount(raw, ingredient.unit, {
        wholePieces: isWholePiece(food, ingredient.unit),
      });
    const grams = toGrams(amount, ingredient.unit, food.units);
    if (grams === null) {
      throw new Error(`Einheit „${ingredient.unit}“ für „${foodId}“ nicht umrechenbar.`);
    }
    ingredients.push({
      index,
      foodId,
      originalFoodId: subs.has(index) || swap !== undefined ? original.food_id : null,
      amount,
      unit: ingredient.unit,
      optional: ingredient.optional,
      grams,
      ...(swap !== undefined ? { swapped: true as const } : {}),
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

/** Faktoren einer geteilten Portion nach Rollen (19.7 N13): Beilage (`carb`) getrennt, alles andere gemeinsam. */
export interface RolePortionFactors {
  /** Portionsfaktor der Person (Ziel-kcal ÷ kcal je Portion, begrenzt) – steht als `factor` am Ergebnis. */
  readonly portion: number;
  /** Faktor für alle skalierenden Zutaten außer der Beilage (u. a. die Eiweißquelle). */
  readonly main: number;
  /** Faktor für Zutaten mit Rolle `carb` (Beilage). */
  readonly side: number;
  /** Beilagen in g/ml auf diesen Schritt runden (ab `fromG`), sonst Standard-Rundung. */
  readonly sideRounding: { readonly stepG: number; readonly fromG: number } | null;
}

/**
 * Geteilte Portion (19.7 N13, KONZEPT 6.12): wie `scalePortion`, aber mit eigenem Faktor für die Beilage (Rolle
 * `carb`) und optional 10-g-Schritten bei Beilagen. Eier bleiben ganz, eine Menge > 0 wird nie 0, Nährwerte nach der
 * Rundung. Alle Faktoren 0,5–2,0 (`PORTION_SCALE_LIMITS`); die engere Spannweite des Paar-Modus prüft
 * `portion-factor.ts`. Kennt KEINE Schutzgrenzen – den Tag hält der Tagesausgleich im Planband.
 */
export function scalePortionByRole(
  variant: RecipeVariant,
  factors: RolePortionFactors,
  foods: FoodLookup,
): ScaledPortion {
  const portion = factorSchema.parse(factors.portion);
  const main = factorSchema.parse(factors.main);
  const side = factorSchema.parse(factors.side);
  const servings = variant.recipe.servings;
  const step = factors.sideRounding;
  const { ingredients, nutrients, optionalKcal } = scaleIngredients(
    variant,
    foods,
    (scales, original) =>
      scales ? (original.role === 'carb' ? side : main) / servings : 1 / servings,
    (original, unit, raw) => {
      if (step === null || original.role !== 'carb' || !original.scales) return null;
      if ((unit !== 'g' && unit !== 'ml') || raw < step.fromG) return null;
      return Math.max(step.stepG, Math.round(raw / step.stepG) * step.stepG);
    },
  );
  return { factor: portion, ingredients, nutrients, optionalKcal };
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
    'recipe' in variant ? variant : { recipe: variant, omitted: [], substitutions: [], swaps: [] };
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
  /**
   * Feste, schon berechnete Portion (geteilte Mahlzeit, 19.7 N13) – wird unverändert übernommen; verlangt
   * `fixedFactor` (= `fixedPortion.factor`), damit sie wie jede feste Portion nicht ausgeglichen wird.
   */
  readonly fixedPortion?: ScaledPortion | undefined;
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
    if (draft.fixedPortion !== undefined) return draft.fixedPortion;
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

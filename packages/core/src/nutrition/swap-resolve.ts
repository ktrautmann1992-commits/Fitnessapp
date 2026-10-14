import { INGREDIENT_SUBSTITUTION_LIMITS } from '../constants';
import type { Food, FoodLookup } from '../content/food-schema';
import type { Recipe } from '../content/recipe-schema';
import type { IngredientSubstitution } from '../content/substitution-schema';
import type { AppliedSwap, IngredientSwapRef } from './filter';
import { needsHeatedFlag } from './recipe-nutrients';
import { gramsPerUnit, type RecipeUnit, toGrams } from './units';

/**
 * Austausch-Einträge eines Plans auflösen (docs/PLAN-PHASE-5.md 19.7 N9, B2). Der gespeicherte Plan nennt nur
 * „Zutat i: Lebensmittel → Ersatz“ (`IngredientSwapRef`); Menge, Einheit und `heated` kommen IMMER aus der
 * Austausch-Tabelle und dem Rezept – ein veränderter Gerätespeicher kann so keine Mengen unterschieben, und ein
 * Eintrag, den es (in diesem Status) nicht mehr gibt, macht die Mahlzeit ungültig (sichere Richtung).
 *
 * - Nur Zutaten MIT Rolle (`ingredients[].role`, 19.4 S6) und nur Einträge mit genau dieser Rolle.
 * - Menge: Gramm Ersatz = Gramm Original × Faktor. Einheit: Eier (Stückgewicht bekannt) in ganzen Stück; sonst die
 *   Einheit des Rezepts, wenn sie sich für den Ersatz umrechnen lässt (nicht Stück); sonst Gramm.
 * - Erhitzen (B2, Wächter N9 B1): Braucht der Ersatz die Angabe `heated` (Ei, Fisch, Krebs-/Weichtiere, Fleisch,
 *   Rohmilch), gibt es den Tausch NUR, wenn das Rezept gekocht wird (nicht `no_cook`) und das Original ausdrücklich
 *   `heated: true` hat – ohne Import-Annahme an dieser Zutat (eine Bestätigung galt dem Original-Lebensmittel). Sonst
 *   ist der Eintrag für dieses Rezept ungültig – für ALLE Personen, nicht nur in der Schwangerschaft (sonst käme z. B.
 *   rohe Hähnchenbrust in einen kalten Salat). Der Ersatz übernimmt dann `heated: true`.
 */

/** Eintrag der Tabelle zu einer Zutat (Lebensmittel, Ersatz, Rolle); null = gibt es nicht. */
export function substitutionFor(
  table: readonly IngredientSubstitution[],
  foodId: string,
  substituteFoodId: string,
  role: IngredientSubstitution['role'],
): IngredientSubstitution | null {
  return (
    table.find(
      (s) =>
        s.status !== 'archived' &&
        s.food_id === foodId &&
        s.substitute_food_id === substituteFoodId &&
        s.role === role,
    ) ?? null
  );
}

function isEgg(food: Food): boolean {
  return food.groups.includes('eggs') || food.animal.includes('egg');
}

/** Menge und Einheit des Ersatzes für `grams` Gramm (siehe Kopf). */
function substituteAmount(
  grams: number,
  originalUnit: RecipeUnit,
  substitute: Food,
): { amount: number; unit: RecipeUnit } {
  const piece = substitute.units.piece_g;
  if (isEgg(substitute) && piece !== undefined && piece > 0) {
    return { amount: Number((grams / piece).toFixed(6)), unit: 'piece' };
  }
  const perUnit = originalUnit === 'piece' ? null : gramsPerUnit(originalUnit, substitute.units);
  if (perUnit !== null && perUnit > 0) {
    return { amount: Number((grams / perUnit).toFixed(6)), unit: originalUnit };
  }
  return { amount: Number(grams.toFixed(6)), unit: 'g' };
}

/** Darf ein Ersatz, der erhitzt werden muss, an dieser Zutat stehen? (Wächter N9 B1, siehe Kopf.) */
export function swapKeepsHeating(
  recipe: Pick<Recipe, 'ingredients' | 'no_cook'> & {
    readonly meta?: { readonly import_assumptions?: readonly { ingredient_index: number }[] };
  },
  index: number,
): boolean {
  const ingredient = recipe.ingredients[index];
  if (ingredient === undefined || recipe.no_cook || ingredient.heated !== true) return false;
  return !(recipe.meta?.import_assumptions ?? []).some((a) => a.ingredient_index === index);
}

/**
 * Einen Austausch auflösen; null = ungültig (Zutat, Rolle, Tabelle, Katalog, Einheit oder Erhitzen nach B1 passen
 * nicht).
 */
export function resolveIngredientSwap(
  recipe: Pick<Recipe, 'ingredients' | 'no_cook'> & {
    readonly meta?: { readonly import_assumptions?: readonly { ingredient_index: number }[] };
  },
  ref: IngredientSwapRef,
  table: readonly IngredientSubstitution[],
  foods: FoodLookup,
): AppliedSwap | null {
  const ingredient = recipe.ingredients[ref.index];
  if (ingredient === undefined || ingredient.food_id !== ref.foodId) return null;
  if (ingredient.role === undefined) return null;
  const entry = substitutionFor(table, ref.foodId, ref.substituteFoodId, ingredient.role);
  const original = foods.get(ref.foodId);
  const substitute = foods.get(ref.substituteFoodId);
  if (entry === null || original === undefined || substitute === undefined) return null;
  const grams = toGrams(ingredient.amount, ingredient.unit, original.units);
  if (grams === null || grams <= 0) return null;
  const target = substituteAmount(grams * entry.factor, ingredient.unit, substitute);
  if (!(target.amount > 0)) return null;
  if (needsHeatedFlag(substitute) && !swapKeepsHeating(recipe, ref.index)) return null;
  const heated = ingredient.heated;
  return {
    index: ref.index,
    foodId: ref.foodId,
    substituteFoodId: ref.substituteFoodId,
    amount: target.amount,
    unit: target.unit,
    heated,
    substitutionId: entry.id,
  };
}

/**
 * Alle Austausch-Einträge einer Mahlzeit auflösen (nach Index sortiert). null = mindestens einer ungültig, eine Zutat
 * doppelt oder zu viele Einträge – dann gilt die Mahlzeit als nicht mehr passend.
 */
export function resolveIngredientSwaps(
  recipe: Parameters<typeof resolveIngredientSwap>[0],
  refs: readonly IngredientSwapRef[],
  table: readonly IngredientSubstitution[],
  foods: FoodLookup,
): AppliedSwap[] | null {
  if (refs.length > INGREDIENT_SUBSTITUTION_LIMITS.swapsPerMeal) return null;
  if (new Set(refs.map((r) => r.index)).size !== refs.length) return null;
  const resolved: AppliedSwap[] = [];
  for (const ref of [...refs].sort((a, b) => a.index - b.index)) {
    const swap = resolveIngredientSwap(recipe, ref, table, foods);
    if (swap === null) return null;
    resolved.push(swap);
  }
  return resolved;
}

/** Fester Schlüssel einer Austausch-Liste (Vergleich, Zwischenspeicher). */
export function swapKey(refs: readonly IngredientSwapRef[]): string {
  return [...refs]
    .sort((a, b) => a.index - b.index)
    .map((r) => `${r.index}:${r.foodId}>${r.substituteFoodId}`)
    .join(',');
}

import { type Food, isCatalogReviewed } from './food-schema';
import type { Recipe } from './recipe-schema';
import { isDryRunContent, type ContentValidationResult } from './validate';

/**
 * Welche Lebensmittel und Rezepte die Ernährungs-Engine nutzen darf (docs/PLAN-PHASE-5.md 5.3, R2-S6, W24) –
 * Gegenstück zu `selectPlanContent`. Aufruf in der App: `selectNutritionContent(validateContent(files, …),
 * { allowDrafts: true })` im Testmodus (N2c), live `allowDrafts: false`.
 *
 * - Live: nur `published` ohne roten Befund.
 * - Testmodus (`allowDrafts`): zusätzlich `draft` ohne roten Befund. `archived` nie, Probelauf-Inhalte nie.
 * - Lebensmittel nur mit Katalog-Prüfung (R19, auch im Testmodus).
 * - Ein Rezept nur, wenn ALLE seine Lebensmittel (auch optionale) ausgewählt sind.
 * Ausgeschlossenes steht mit Grund in `excluded` (Testmodus-Diagnose).
 */

export type NutritionExclusionReason =
  | 'archived'
  | 'draft_not_allowed'
  | 'dry_run'
  | 'red_issue'
  | 'not_catalog_reviewed'
  | 'food_unavailable';

export interface NutritionExclusion {
  readonly kind: 'food' | 'recipe';
  readonly id: string;
  readonly reason: NutritionExclusionReason;
  /** Bei `food_unavailable`: die fehlenden bzw. ausgeschlossenen Lebensmittel. */
  readonly foodIds?: readonly string[];
}

export interface NutritionLibrary {
  readonly foods: ReadonlyMap<string, Food>;
  /** Nach ID sortiert. */
  readonly recipes: readonly Recipe[];
  /** true = enthält Entwürfe (Kennzeichnung und Allergen-Warnung in der App, K6). */
  readonly containsDrafts: boolean;
  readonly excluded: readonly NutritionExclusion[];
}

export interface SelectNutritionContentOptions {
  readonly allowDrafts: boolean;
}

function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function selectNutritionContent(
  result: Pick<ContentValidationResult, 'foods' | 'recipes' | 'issues'>,
  options: SelectNutritionContentOptions,
): NutritionLibrary {
  const redIds = new Set(
    result.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => `${issue.kind}:${issue.id}`),
  );
  const excluded: NutritionExclusion[] = [];

  const statusReason = (
    kind: 'food' | 'recipe',
    content: Pick<Recipe, 'id' | 'status' | 'meta'>,
  ): NutritionExclusionReason | null => {
    if (content.status === 'archived') {
      return 'archived';
    }
    if (content.status === 'draft' && !options.allowDrafts) {
      return 'draft_not_allowed';
    }
    if (isDryRunContent(content)) {
      return 'dry_run';
    }
    if (redIds.has(`${kind}:${content.id}`)) {
      return 'red_issue';
    }
    return null;
  };

  const foods = new Map<string, Food>();
  for (const food of [...result.foods].sort(byId)) {
    const reason =
      statusReason('food', food) ?? (isCatalogReviewed(food) ? null : 'not_catalog_reviewed');
    if (reason === null) {
      foods.set(food.id, food);
    } else {
      excluded.push({ kind: 'food', id: food.id, reason });
    }
  }

  const recipes: Recipe[] = [];
  for (const recipe of [...result.recipes].sort(byId)) {
    const reason = statusReason('recipe', recipe);
    if (reason !== null) {
      excluded.push({ kind: 'recipe', id: recipe.id, reason });
      continue;
    }
    const unavailable = [
      ...new Set(recipe.ingredients.map((i) => i.food_id).filter((id) => !foods.has(id))),
    ];
    if (unavailable.length > 0) {
      excluded.push({
        kind: 'recipe',
        id: recipe.id,
        reason: 'food_unavailable',
        foodIds: unavailable,
      });
      continue;
    }
    recipes.push(recipe);
  }

  const containsDrafts =
    recipes.some((recipe) => recipe.status === 'draft') ||
    [...foods.values()].some((food) => food.status === 'draft');
  return { foods, recipes, containsDrafts, excluded };
}

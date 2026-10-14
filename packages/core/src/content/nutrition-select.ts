import { type Food, isCatalogReviewed } from './food-schema';
import type { Guide } from './guide-schema';
import type { MealPrepPlan } from './meal-prep-plan-schema';
import type { Recipe } from './recipe-schema';
import type { IngredientSubstitution } from './substitution-schema';
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
 * - Ein Meal-Prep-Plan (19.4) nur, wenn ALLE seine Rezepte ausgewählt sind; Ratgeber nach Status und rotem Befund.
 * - Ein Austausch-Eintrag (19.7 N9) nur, wenn BEIDE Lebensmittel ausgewählt sind (Status, roter Befund R23).
 * Ausgeschlossenes steht mit Grund in `excluded` (Testmodus-Diagnose).
 */

export type NutritionExclusionReason =
  | 'archived'
  | 'draft_not_allowed'
  | 'dry_run'
  | 'red_issue'
  | 'not_catalog_reviewed'
  | 'food_unavailable'
  | 'recipe_unavailable';

type SelectedKind = 'food' | 'recipe' | 'meal_prep_plan' | 'guide' | 'ingredient_substitution';

export interface NutritionExclusion {
  readonly kind: SelectedKind;
  readonly id: string;
  readonly reason: NutritionExclusionReason;
  /** Bei `food_unavailable`: die fehlenden bzw. ausgeschlossenen Lebensmittel. */
  readonly foodIds?: readonly string[];
  /** Bei `recipe_unavailable`: die fehlenden bzw. ausgeschlossenen Rezepte. */
  readonly recipeIds?: readonly string[];
}

export interface NutritionLibrary {
  readonly foods: ReadonlyMap<string, Food>;
  /**
   * Nach ID sortiert. BESTAND, nicht personenbezogen: Ernährungsform, Schwein, Unverträglichkeiten, „mag ich nicht“
   * und Schwangerschaft filtert erst die Engine (`filter.ts`, N3) – nie direkt anzeigen oder einplanen.
   */
  readonly recipes: readonly Recipe[];
  /**
   * Meal-Prep-Pläne, deren Rezepte alle ausgewählt sind (nach ID sortiert). BESTAND, nicht personenbezogen:
   * anzeigen bzw. anwenden nur über `applyMealPrepPlan` mit dem kompletten Filter je Rezept (Plan 19.6, B1, N3).
   */
  readonly mealPrepPlans: readonly MealPrepPlan[];
  /** Ratgeber (nach ID sortiert, offline lesbar). */
  readonly guides: readonly Guide[];
  /**
   * Austausch-Tabelle (19.7 N9, nach ID sortiert), nur Einträge mit ausgewählten Lebensmitteln. BESTAND, nicht
   * personenbezogen: angeboten wird ein Tausch nur über `nutrition/substitute.ts` (kompletter Filter, R11, Planband).
   */
  readonly substitutions: readonly IngredientSubstitution[];
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
  result: Pick<ContentValidationResult, 'foods' | 'recipes' | 'issues'> &
    Partial<Pick<ContentValidationResult, 'mealPrepPlans' | 'guides' | 'substitutions'>>,
  options: SelectNutritionContentOptions,
): NutritionLibrary {
  const redIds = new Set(
    result.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => `${issue.kind}:${issue.id}`),
  );
  const excluded: NutritionExclusion[] = [];

  const statusReason = (
    kind: NutritionExclusion['kind'],
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

  const recipeIds = new Set(recipes.map((recipe) => recipe.id));
  const mealPrepPlans: MealPrepPlan[] = [];
  for (const plan of [...(result.mealPrepPlans ?? [])].sort(byId)) {
    const reason = statusReason('meal_prep_plan', plan);
    if (reason !== null) {
      excluded.push({ kind: 'meal_prep_plan', id: plan.id, reason });
      continue;
    }
    const unavailable = plan.recipe_ids.filter((id) => !recipeIds.has(id));
    if (unavailable.length > 0) {
      excluded.push({
        kind: 'meal_prep_plan',
        id: plan.id,
        reason: 'recipe_unavailable',
        recipeIds: unavailable,
      });
      continue;
    }
    mealPrepPlans.push(plan);
  }

  const guides: Guide[] = [];
  for (const guide of [...(result.guides ?? [])].sort(byId)) {
    const reason = statusReason('guide', guide);
    if (reason === null) {
      guides.push(guide);
    } else {
      excluded.push({ kind: 'guide', id: guide.id, reason });
    }
  }

  const substitutions: IngredientSubstitution[] = [];
  for (const sub of [...(result.substitutions ?? [])].sort(byId)) {
    const reason = statusReason('ingredient_substitution', sub);
    if (reason !== null) {
      excluded.push({ kind: 'ingredient_substitution', id: sub.id, reason });
      continue;
    }
    const unavailable = [sub.food_id, sub.substitute_food_id].filter((id) => !foods.has(id));
    if (unavailable.length > 0) {
      excluded.push({
        kind: 'ingredient_substitution',
        id: sub.id,
        reason: 'food_unavailable',
        foodIds: unavailable,
      });
      continue;
    }
    substitutions.push(sub);
  }

  const containsDrafts =
    recipes.some((recipe) => recipe.status === 'draft') ||
    [...foods.values()].some((food) => food.status === 'draft') ||
    mealPrepPlans.some((plan) => plan.status === 'draft') ||
    guides.some((guide) => guide.status === 'draft') ||
    substitutions.some((sub) => sub.status === 'draft');
  return { foods, recipes, mealPrepPlans, guides, substitutions, containsDrafts, excluded };
}

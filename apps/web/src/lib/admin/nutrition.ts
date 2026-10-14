/**
 * Ernährung im Redaktionsbereich (docs/PLAN-PHASE-5.md 13 N2d, 19.5): Lebensmittel, Rezepte, Meal-Prep-Pläne,
 * Ratgeber und die Austausch-Tabelle (19.7 N9) aus dem Inhalts-Bündel, geprüft mit denselben Regeln wie
 * content:validate (`validateContent`, R1–R23) und
 * mit der Vorschau der Freigabe (`planRecipeRelease`, packages/core – dieselben Gründe für die Sammelfreigabe pro
 * Kategorie und für die Freigabe per ID). Nur ansehen – der Redaktionsbereich schreibt nicht (KONZEPT 3);
 * freigegeben wird über den Workflow content-review.
 *
 * Rein und ohne Next-Abhängigkeit – getestet in nutrition.test.ts. Hier wird nur zusammengestellt, die Regeln
 * stehen in packages/core bzw. packages/content.
 */
import {
  type AllergenExpectations,
  computeRecipeFacts,
  type ContentIssue,
  type ContentStatus,
  type Food,
  type FoodLookup,
  type Guide,
  importAssumptionsState,
  type IngredientSubstitution,
  type ImportAssumptionsState,
  isCatalogReviewed,
  type MealPrepPlan,
  needsExpertReviewLabel,
  type NutritionCatalogContext,
  type NutritionContentFile,
  type NutritionContentFileKind,
  planRecipeRelease,
  RECIPE_CATEGORIES,
  RECIPE_CATEGORY_IDS,
  type Recipe,
  type RecipeCategoryId,
  type RecipeFacts,
  type RecipeReleaseBlocker,
  validateContent,
} from '@fitnessapp/core';
import { type Deviation, recipeImportDeviations } from '@fitnessapp/content/import-report';
import { z } from 'zod';

import { type IssueSummary, normalizeSearch, summarizeIssues } from './catalog';

export interface FoodEntry {
  readonly food: Food;
  readonly issues: readonly ContentIssue[];
  readonly summary: IssueSummary;
  readonly catalogReviewed: boolean;
  readonly needsExpertReview: boolean;
  /** Gruppen laut Erwartungsliste (R18); null = nicht in der Liste bzw. Liste fehlt. */
  readonly expectedGroups: readonly string[] | null;
  /** Rezepte, die das Lebensmittel nutzen. */
  readonly usedIn: readonly { id: string; title: string }[];
  readonly searchText: string;
}

export interface RecipeEntry {
  readonly recipe: Recipe;
  readonly issues: readonly ContentIssue[];
  readonly summary: IssueSummary;
  readonly needsExpertReview: boolean;
  readonly facts: RecipeFacts;
  /** Zutaten, deren Lebensmittel im Katalog fehlt. */
  readonly missingFoodIds: readonly string[];
  /** Zutaten ohne Katalog-Prüfung (R19). */
  readonly unreviewedFoodIds: readonly string[];
  /** Offene (unbestätigte oder nach der Bestätigung geänderte) Import-Annahmen „durchgegart“. */
  readonly openAssumptions: number;
  /** Stand der Import-Annahmen (`changed` = bestätigt, aber Zubereitung seitdem geändert – Fingerabdruck). */
  readonly assumptionsState: ImportAssumptionsState;
  /**
   * Weg zur Freigabe: `category` = Sammelfreigabe einer seiner Kategorien (Art „recipe“), `ids` = ohne Kategorie,
   * nur einzeln per ID (Art „ids“, Gründer-Entscheidung 14.10.2026).
   */
  readonly releasePath: 'category' | 'ids';
  /** Abweichungen Gründer-Datei ↔ berechnet je Portion (Import-Bericht); leer, wenn nicht berechenbar. */
  readonly deviations: readonly Deviation[];
  /** Gründe gegen die Freigabe ohne bzw. mit Häkchen „Import-Annahmen geprüft“ (leer = würde freigegeben). */
  readonly blockers: readonly RecipeReleaseBlocker[];
  readonly blockersWithConfirm: readonly RecipeReleaseBlocker[];
}

/** Gruppe „ohne Kategorie“ (Rezepte ohne zugeordnete Themen-Kategorie). */
export const NO_CATEGORY = 'ohne' as const;
export type RecipeGroupId = RecipeCategoryId | typeof NO_CATEGORY;

export interface RecipeGroup {
  readonly id: RecipeGroupId;
  readonly name: string;
  readonly recipes: readonly RecipeEntry[];
  readonly counts: Readonly<Record<ContentStatus, number>>;
  /** Rezepte mit mindestens einem roten Befund. */
  readonly withRed: number;
  /** Rezepte mit Zutaten ohne Katalog-Prüfung (oder fehlendem Lebensmittel). */
  readonly withUnreviewedFoods: number;
  /** Rezepte mit offenen Import-Annahmen „durchgegart“. */
  readonly withOpenAssumptions: number;
  /** Rezepte mit Abweichungen aus dem Import-Bericht. */
  readonly withDeviations: number;
  /**
   * Entwürfe, die die Freigabe freigeben würde (ohne bzw. mit Häkchen „Import-Annahmen geprüft“) – in Kategorien über
   * die Sammelfreigabe, in „ohne Kategorie“ nur einzeln per ID.
   */
  readonly ready: number;
  readonly readyWithConfirm: number;
}

export interface MealPrepEntry {
  readonly plan: MealPrepPlan;
  readonly issues: readonly ContentIssue[];
  readonly summary: IssueSummary;
  readonly needsExpertReview: boolean;
  readonly recipes: readonly { id: string; title: string | null }[];
}

export interface GuideEntry {
  readonly guide: Guide;
  readonly issues: readonly ContentIssue[];
  readonly summary: IssueSummary;
  readonly needsExpertReview: boolean;
}

/** Austausch-Eintrag (19.7 N9) mit Namen der Lebensmittel und Prüfbericht (R23). */
export interface SubstitutionEntry {
  readonly substitution: IngredientSubstitution;
  readonly foodName: string | null;
  readonly substituteName: string | null;
  readonly issues: readonly ContentIssue[];
  readonly summary: IssueSummary;
  readonly needsExpertReview: boolean;
}

export interface NutritionBrokenFile {
  readonly kind: NutritionContentFileKind;
  readonly id: string;
  readonly issues: readonly ContentIssue[];
}

export interface NutritionAdmin {
  readonly foods: readonly FoodEntry[];
  readonly recipes: readonly RecipeEntry[];
  readonly groups: readonly RecipeGroup[];
  readonly mealPrepPlans: readonly MealPrepEntry[];
  readonly guides: readonly GuideEntry[];
  /** Austausch-Tabelle (Etappe N9), nach Zutat und Ersatz sortiert. */
  readonly substitutions: readonly SubstitutionEntry[];
  readonly foodById: ReadonlyMap<string, FoodEntry>;
  readonly recipeById: ReadonlyMap<string, RecipeEntry>;
  /** Befunde zum ganzen Rezeptbestand (R16) und zu Begleitdateien des Katalogs ohne passendes Lebensmittel. */
  readonly libraryIssues: readonly ContentIssue[];
  /** Dateien, die nicht gelesen werden konnten (Schema, JSON, doppelte ID). */
  readonly brokenFiles: readonly NutritionBrokenFile[];
  /** Fehler in den Begleitdaten (Quellauszug, Erwartungs-/Ausnahmeliste) – dann wird ohne Katalog geprüft. */
  readonly catalogProblems: readonly string[];
  /** true = es gibt noch keine Lebensmittel (Workflow foods-import noch nicht gelaufen). */
  readonly catalogMissing: boolean;
}

const collator = new Intl.Collator('de-DE', { sensitivity: 'base', numeric: true });

function sortIssues(issues: readonly ContentIssue[]): ContentIssue[] {
  return [...issues].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1,
  );
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

/** Für die Vorschau der Sammelfreigabe: Prüfer/Datum sind ohne Einfluss auf die Gründe. */
const PREVIEW = { reviewer: 'Vorschau', date: '2026-01-01', expertReviewed: false } as const;

/** Baut die Ernährungs-Ansicht. `catalog` undefined = ohne Begleitdaten prüfen (alle Lebensmittel rot, R17/R18). */
export function buildNutritionAdmin(
  files: readonly NutritionContentFile[],
  catalog: NutritionCatalogContext | undefined,
  catalogProblems: readonly string[] = [],
): NutritionAdmin {
  const result = validateContent(files, catalog === undefined ? {} : { nutritionCatalog: catalog });
  const byKey = new Map<string, ContentIssue[]>();
  const libraryIssues: ContentIssue[] = [];
  const foodIds = new Set(result.foods.map((food) => food.id));
  for (const issue of result.issues) {
    // R16 (ganzer Bestand) und R18 „Erwartungs-/Ausnahmeliste nennt ein Lebensmittel, das es nicht gibt“.
    const listIssue =
      issue.kind === 'food' &&
      issue.rule === 'R18' &&
      issue.status === null &&
      !foodIds.has(issue.id);
    if (issue.kind === 'recipe_library' || listIssue) {
      libraryIssues.push(issue);
      continue;
    }
    const key = `${issue.kind}:${issue.id}`;
    byKey.set(key, [...(byKey.get(key) ?? []), issue]);
  }
  const issuesFor = (kind: NutritionContentFileKind, id: string) =>
    sortIssues(byKey.get(`${kind}:${id}`) ?? []);

  const foodLookup: FoodLookup = new Map(result.foods.map((food) => [food.id, food]));
  const usedIn = new Map<string, { id: string; title: string }[]>();
  for (const recipe of result.recipes) {
    for (const id of new Set(recipe.ingredients.map((i) => i.food_id))) {
      usedIn.set(id, [...(usedIn.get(id) ?? []), { id: recipe.id, title: recipe.title_de }]);
    }
  }
  const expectations: AllergenExpectations | undefined = catalog?.expectations;

  const foods: FoodEntry[] = result.foods
    .map((food): FoodEntry => {
      const issues = issuesFor('food', food.id);
      return {
        food,
        issues,
        summary: summarizeIssues(issues),
        catalogReviewed: isCatalogReviewed(food),
        needsExpertReview: needsExpertReviewLabel(food.meta),
        expectedGroups: expectations?.[food.id] ?? null,
        usedIn: (usedIn.get(food.id) ?? []).sort((a, b) => collator.compare(a.title, b.title)),
        searchText: normalizeSearch(
          [food.id, food.name_de, ...food.aliases_de, food.source.name, food.source.ref].join(' '),
        ),
      };
    })
    .sort((a, b) => collator.compare(a.food.name_de, b.food.name_de));

  // Vorschau: alle Entwürfe probehalber zugleich. Die Gründe werden je Rezept gefiltert; rezeptübergreifend ist heute
  // nur R16 (ganzer Bestand, kein Grund) – kommen weitere solche Regeln dazu, Vorschau je Kategorie rechnen
  // (Wächter N2d K3). Das vorhandene Ergebnis `result` spart je Vorschau eine Prüfung (K2).
  const planAll = (confirmAssumptions: boolean) =>
    new Map(
      planRecipeRelease(files, catalog, () => true, { ...PREVIEW, confirmAssumptions }, result).map(
        (decision) => [decision.original.id, decision.blockers],
      ),
    );
  const blockers = planAll(false);
  const blockersWithConfirm = planAll(true);

  const assumptionsStates = new Map(
    result.recipes.map((recipe) => [recipe.id, importAssumptionsState(recipe)]),
  );
  const recipes: RecipeEntry[] = result.recipes
    .map((recipe): RecipeEntry => {
      const issues = issuesFor('recipe', recipe.id);
      const facts = computeRecipeFacts(recipe, foodLookup);
      const ids = recipe.ingredients.map((i) => i.food_id);
      return {
        recipe,
        issues,
        summary: summarizeIssues(issues),
        needsExpertReview: needsExpertReviewLabel(recipe.meta),
        facts,
        missingFoodIds: sortedUnique(ids.filter((id) => !foodLookup.has(id))),
        unreviewedFoodIds: sortedUnique(
          ids.filter((id) => {
            const food = foodLookup.get(id);
            return food !== undefined && !isCatalogReviewed(food);
          }),
        ),
        openAssumptions:
          assumptionsStates.get(recipe.id) === 'open' ||
          assumptionsStates.get(recipe.id) === 'changed'
            ? (recipe.meta.import_assumptions?.length ?? 0)
            : 0,
        assumptionsState: assumptionsStates.get(recipe.id) ?? 'none',
        releasePath: (recipe.categories ?? []).length === 0 ? 'ids' : 'category',
        deviations: facts.nutrientsComplete ? recipeImportDeviations(recipe, facts.perServing) : [],
        blockers: blockers.get(recipe.id) ?? [],
        blockersWithConfirm: blockersWithConfirm.get(recipe.id) ?? [],
      };
    })
    .sort((a, b) => collator.compare(a.recipe.title_de, b.recipe.title_de));

  const recipeTitles = new Map(result.recipes.map((r) => [r.id, r.title_de]));
  const mealPrepPlans: MealPrepEntry[] = result.mealPrepPlans
    .map((plan): MealPrepEntry => {
      const issues = issuesFor('meal_prep_plan', plan.id);
      return {
        plan,
        issues,
        summary: summarizeIssues(issues),
        needsExpertReview: needsExpertReviewLabel(plan.meta),
        recipes: plan.recipe_ids.map((id) => ({ id, title: recipeTitles.get(id) ?? null })),
      };
    })
    .sort((a, b) => collator.compare(a.plan.title_de, b.plan.title_de));

  const guides: GuideEntry[] = result.guides
    .map((guide): GuideEntry => {
      const issues = issuesFor('guide', guide.id);
      return {
        guide,
        issues,
        summary: summarizeIssues(issues),
        needsExpertReview: needsExpertReviewLabel(guide.meta),
      };
    })
    .sort((a, b) => collator.compare(a.guide.title_de, b.guide.title_de));

  const foodNames = new Map(result.foods.map((food) => [food.id, food.name_de]));
  const substitutions: SubstitutionEntry[] = result.substitutions
    .map((substitution): SubstitutionEntry => {
      const issues = issuesFor('ingredient_substitution', substitution.id);
      return {
        substitution,
        foodName: foodNames.get(substitution.food_id) ?? null,
        substituteName: foodNames.get(substitution.substitute_food_id) ?? null,
        issues,
        summary: summarizeIssues(issues),
        needsExpertReview: needsExpertReviewLabel(substitution.meta),
      };
    })
    .sort(
      (a, b) =>
        collator.compare(
          a.foodName ?? a.substitution.food_id,
          b.foodName ?? b.substitution.food_id,
        ) ||
        collator.compare(
          a.substituteName ?? a.substitution.substitute_food_id,
          b.substituteName ?? b.substitution.substitute_food_id,
        ),
    );

  const valid = new Set([
    ...foods.map((e) => `food:${e.food.id}`),
    ...recipes.map((e) => `recipe:${e.recipe.id}`),
    ...mealPrepPlans.map((e) => `meal_prep_plan:${e.plan.id}`),
    ...guides.map((e) => `guide:${e.guide.id}`),
    ...substitutions.map((e) => `ingredient_substitution:${e.substitution.id}`),
  ]);
  const brokenFiles: NutritionBrokenFile[] = [];
  for (const [key, issues] of byKey) {
    if (!valid.has(key)) {
      const [kind, ...rest] = key.split(':');
      brokenFiles.push({
        kind: kind as NutritionContentFileKind,
        id: rest.join(':'),
        issues: sortIssues(issues),
      });
    }
  }
  brokenFiles.sort((a, b) => collator.compare(a.id, b.id));

  return {
    foods,
    recipes,
    groups: groupRecipes(recipes),
    mealPrepPlans,
    guides,
    substitutions,
    foodById: new Map(foods.map((entry) => [entry.food.id, entry])),
    recipeById: new Map(recipes.map((entry) => [entry.recipe.id, entry])),
    libraryIssues,
    brokenFiles,
    catalogProblems,
    catalogMissing: result.foods.length === 0,
  };
}

/** Rezepte nach Kategorie (n:m – ein Rezept steht in jeder seiner Kategorien) plus „ohne Kategorie“. */
export function groupRecipes(recipes: readonly RecipeEntry[]): RecipeGroup[] {
  const group = (id: RecipeGroupId, name: string, members: RecipeEntry[]): RecipeGroup => {
    const counts = { draft: 0, published: 0, archived: 0 } satisfies Record<ContentStatus, number>;
    for (const entry of members) counts[entry.recipe.status] += 1;
    return {
      id,
      name,
      recipes: members,
      counts,
      withRed: members.filter((e) => e.summary.errors > 0).length,
      withUnreviewedFoods: members.filter(
        (e) => e.unreviewedFoodIds.length + e.missingFoodIds.length > 0,
      ).length,
      withOpenAssumptions: members.filter((e) => e.openAssumptions > 0).length,
      withDeviations: members.filter((e) => e.deviations.length > 0).length,
      ready: members.filter((e) => e.blockers.length === 0).length,
      readyWithConfirm: members.filter((e) => e.blockersWithConfirm.length === 0).length,
    };
  };
  return [
    ...RECIPE_CATEGORIES.map((category) =>
      group(
        category.id,
        category.name_de,
        recipes.filter((e) => (e.recipe.categories ?? []).includes(category.id)),
      ),
    ),
    group(
      NO_CATEGORY,
      'Ohne Kategorie',
      recipes.filter((e) => (e.recipe.categories ?? []).length === 0),
    ),
  ];
}

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

function first(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single === undefined || single.trim() === '' ? undefined : single;
}

const groupSchema = z
  .enum([...RECIPE_CATEGORY_IDS, NO_CATEGORY])
  .optional()
  .catch(undefined);

/** Gewählte Kategorie aus der Adresszeile (Ungültiges = keine Auswahl). */
export function parseRecipeGroup(params: SearchParams): RecipeGroupId | undefined {
  return groupSchema.parse(first(params, 'kategorie'));
}

export const FOOD_REVIEW_FILTERS = ['offen', 'geprueft'] as const;
export type FoodReviewFilter = (typeof FOOD_REVIEW_FILTERS)[number];

const foodFilterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  pruefung: z.enum(FOOD_REVIEW_FILTERS).optional().catch(undefined),
});
export type FoodFilters = z.infer<typeof foodFilterSchema>;

export function parseFoodFilters(params: SearchParams): FoodFilters {
  return foodFilterSchema.parse({ q: first(params, 'q'), pruefung: first(params, 'pruefung') });
}

export function filterFoods(entries: readonly FoodEntry[], filters: FoodFilters): FoodEntry[] {
  return entries.filter((entry) => {
    if (filters.pruefung === 'offen' && entry.catalogReviewed) return false;
    if (filters.pruefung === 'geprueft' && !entry.catalogReviewed) return false;
    if (filters.q) {
      const words = normalizeSearch(filters.q).split(' ').filter(Boolean);
      if (!words.every((word) => entry.searchText.includes(word))) return false;
    }
    return true;
  });
}

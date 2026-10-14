import { computeRecipeFacts } from '../nutrition/recipe-nutrients';
import { type FoodLookup, isCatalogReviewed } from './food-schema';
import type { Guide } from './guide-schema';
import { hasUnconfirmedImportAssumptions, importAssumptionsFingerprint } from './import-meta';
import type { MealPrepPlan } from './meal-prep-plan-schema';
import type { NutritionCatalogContext } from './recipe-checks';
import type { Recipe, RecipeCategoryId } from './recipe-schema';
import type { ContentIssue, ContentRuleId } from './rules';
import type { IngredientSubstitution } from './substitution-schema';
import {
  type ContentValidationResult,
  type NutritionContentFile,
  validateContent,
} from './validate';

/**
 * Freigabe von Ernährungs-Inhalten (docs/PLAN-PHASE-5.md 19.5, Etappe N2d). Rein, ohne Dateisystem – genutzt vom
 * Workflow `content-review` (packages/content: Art „recipe“ = Sammelfreigabe pro Kategorie, Art „ids“ = einzelne
 * Rezepte, Meal-Prep-Pläne und Ratgeber per ID, Gründer-Entscheidung 14.10.2026) und als Vorschau im
 * Redaktionsbereich (`admin/rezepte`). Eine Stelle für die Regeln – beide Wege nutzen `planRecipeRelease`:
 *
 * Gesetzt wird `published` NUR für Rezepte der Kategorie
 * - ohne roten Befund (geprüft wird der Stand NACH der Freigabe, also mit allen Regeln für freigegebene Inhalte),
 * - mit ausschließlich katalog-geprüften (R19) und freigegebenen Lebensmitteln,
 * - ohne unbestätigte Import-Annahmen „durchgegart“ (`heated`, S4). Bestätigt werden sie nur mit dem zweiten Häkchen
 *   „Import-Annahmen geprüft“ (setzt `meta.import_assumptions_confirmed_by` und den Fingerabdruck
 *   `meta.import_assumptions_fingerprint` über die Zubereitung, `IMPORT_ASSUMPTIONS_FINGERPRINT_FIELDS`). Dabei wird
 *   `declared_pregnancy_caution` neu aus den Zutaten berechnet, weil unbestätigte Annahmen für die Schwangerschaft wie
 *   `heated: false` zählen (Wächter N2c, B1) – sonst meldet R13 rot.
 *
 * Meal-Prep-Pläne (`planNutritionRelease`) nur, wenn alle `recipe_ids` danach freigegeben sind und kein roter Befund
 * (R20 inkl. R9-Aufbewahrung) bleibt; Ratgeber nur ohne roten Befund (R21, Textregeln), mit R21H nur „fachlich
 * geprüft“. Lebensmittel nie über diesen
 * Weg – sie haben ihre eigene Prüfung „Katalog geprüft“ (R19, N2b).
 *
 * Der Workflow öffnet nur einen Pull Request; freigegeben ist erst nach dem Merge durch einen Menschen.
 */

export type RecipeReleaseBlocker =
  /** Rezept ist nicht (mehr) Entwurf – die Sammelfreigabe ändert nur Entwürfe. */
  | { readonly kind: 'not_draft'; readonly status: Recipe['status'] }
  /** Zutaten, deren Lebensmittel im Katalog fehlt (R2). */
  | { readonly kind: 'foods_missing'; readonly foodIds: readonly string[] }
  /** Zutaten ohne menschliche Katalog-Prüfung (R19). */
  | { readonly kind: 'foods_not_catalog_reviewed'; readonly foodIds: readonly string[] }
  /** Zutaten, deren Lebensmittel noch nicht freigegeben ist (freigegebenes Rezept nur mit freigegebenen Lebensmitteln). */
  | { readonly kind: 'foods_not_published'; readonly foodIds: readonly string[] }
  /** Import-Annahmen „durchgegart“ ohne Bestätigung (Häkchen „Import-Annahmen geprüft“ nicht gesetzt). */
  | { readonly kind: 'unconfirmed_assumptions'; readonly count: number }
  /** Rote Befunde im Stand nach der Freigabe. */
  | {
      readonly kind: 'red_issues';
      readonly rules: readonly ContentRuleId[];
      readonly messages: readonly string[];
    };

/** Gründe gegen die Freigabe eines Ernährungs-Inhalts (Rezept, Meal-Prep-Plan, Ratgeber). */
export type NutritionReleaseBlocker =
  | RecipeReleaseBlocker
  /** Meal-Prep-Plan: Rezepte, die nach diesem Lauf nicht freigegeben sind (oder fehlen). */
  | { readonly kind: 'recipes_not_released'; readonly recipeIds: readonly string[] }
  /** Ratgeber mit gelben Befunden zur Fachprüfung (R21H, z. B. Dosierungen) ohne „fachlich geprüft“ (Wächter N2d S6). */
  | {
      readonly kind: 'needs_expert_review';
      readonly rules: readonly ContentRuleId[];
      readonly messages: readonly string[];
    };

export interface RecipeReleaseOptions {
  /** Prüfer (Name oder Kürzel). */
  readonly reviewer: string;
  /** Datum der Freigabe (ISO, Europe/Berlin). */
  readonly date: string;
  /** Häkchen „fachlich geprüft“ → `meta.expert_reviewed = true` (ein gesetztes `true` bleibt immer stehen). */
  readonly expertReviewed: boolean;
  /** Häkchen „Import-Annahmen geprüft“ → offene Annahmen bestätigen. */
  readonly confirmAssumptions: boolean;
}

/** Rezepte einer Kategorie (n:m – ein Rezept kann in mehreren Kategorien stehen). */
export function recipesInCategory<R extends Pick<Recipe, 'categories'>>(
  recipes: readonly R[],
  category: RecipeCategoryId,
): R[] {
  return recipes.filter((recipe) => (recipe.categories ?? []).includes(category));
}

/**
 * Stand des Rezepts NACH der Sammelfreigabe (Status, Prüfvermerk, ggf. bestätigte Annahmen). Version und
 * fachlicher Inhalt bleiben gleich – Ausnahme `declared_pregnancy_caution` beim Bestätigen der Annahmen (s. o.).
 */
export function releasedRecipe(
  recipe: Recipe,
  foods: FoodLookup,
  options: RecipeReleaseOptions,
): Recipe {
  const confirm = options.confirmAssumptions && hasUnconfirmedImportAssumptions(recipe);
  const meta: Recipe['meta'] = {
    ...recipe.meta,
    reviewed_by: options.reviewer,
    reviewed_at: options.date,
    expert_reviewed: recipe.meta.expert_reviewed || options.expertReviewed,
    ...(confirm
      ? {
          import_assumptions_confirmed_by: options.reviewer,
          import_assumptions_fingerprint: importAssumptionsFingerprint(recipe),
        }
      : {}),
  };
  const next: Recipe = { ...recipe, status: 'published', meta };
  if (!confirm) {
    return next;
  }
  return {
    ...next,
    declared_pregnancy_caution: computeRecipeFacts(next, foods).pregnancyCaution,
  };
}

function validationOptions(catalog: NutritionCatalogContext | undefined) {
  return catalog === undefined ? {} : { nutritionCatalog: catalog };
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

/**
 * Gründe, warum ein Rezept NICHT freigegeben wird (leer = freigeben). `released` ist der Stand nach
 * `releasedRecipe`, `releasedIssues` sind die Befunde zu diesem Stand (aus `validateContent`).
 */
export function recipeReleaseBlockers(
  original: Recipe,
  released: Recipe,
  foods: FoodLookup,
  releasedIssues: readonly ContentIssue[],
): RecipeReleaseBlocker[] {
  if (original.status !== 'draft') {
    return [{ kind: 'not_draft', status: original.status }];
  }
  const blockers: RecipeReleaseBlocker[] = [];
  const ids = released.ingredients.map((ingredient) => ingredient.food_id);
  const missing = sortedUnique(ids.filter((id) => !foods.has(id)));
  const notReviewed = sortedUnique(
    ids.filter((id) => {
      const food = foods.get(id);
      return food !== undefined && !isCatalogReviewed(food);
    }),
  );
  const notPublished = sortedUnique(
    ids.filter((id) => {
      const food = foods.get(id);
      return food !== undefined && food.status !== 'published';
    }),
  );
  if (missing.length > 0) {
    blockers.push({ kind: 'foods_missing', foodIds: missing });
  }
  if (notReviewed.length > 0) {
    blockers.push({ kind: 'foods_not_catalog_reviewed', foodIds: notReviewed });
  }
  if (notPublished.length > 0) {
    blockers.push({ kind: 'foods_not_published', foodIds: notPublished });
  }
  if (hasUnconfirmedImportAssumptions(released)) {
    blockers.push({
      kind: 'unconfirmed_assumptions',
      count: released.meta.import_assumptions?.length ?? 0,
    });
  }
  // R19 am Rezept (Lebensmittel nicht katalog-geprüft/freigegeben) und R1 „unbestätigte Import-Annahmen“ stehen
  // schon als eigene Gründe oben – nicht doppelt nennen.
  const red = releasedIssues.filter(
    (issue) =>
      issue.kind === 'recipe' &&
      issue.id === released.id &&
      issue.severity === 'error' &&
      issue.rule !== 'R19' &&
      !(issue.rule === 'R1' && issue.path === 'meta.import_assumptions_confirmed_by'),
  );
  if (red.length > 0) {
    blockers.push({
      kind: 'red_issues',
      rules: [...new Set(red.map((issue) => issue.rule))],
      messages: red.map((issue) => `${issue.rule}: ${issue.message}`),
    });
  }
  return blockers;
}

/** Kurztext eines Grundes (Pull-Request-Text, Redaktionsbereich). */
export function recipeReleaseBlockerText(blocker: NutritionReleaseBlocker): string {
  switch (blocker.kind) {
    case 'recipes_not_released':
      return `Rezepte nicht freigegeben: ${blocker.recipeIds.join(', ')}`;
    case 'needs_expert_review':
      return `gelbe Befunde zur Fachprüfung (${blocker.rules.join(', ')}) – nur mit Häkchen „fachlich geprüft“`;
    case 'not_draft':
      return blocker.status === 'published' ? 'schon freigegeben' : 'zurückgezogen (bleibt so)';
    case 'foods_missing':
      return `Lebensmittel fehlt im Katalog: ${blocker.foodIds.join(', ')}`;
    case 'foods_not_catalog_reviewed':
      return `Lebensmittel nicht katalog-geprüft: ${blocker.foodIds.join(', ')}`;
    case 'foods_not_published':
      return `Lebensmittel nicht freigegeben: ${blocker.foodIds.join(', ')}`;
    case 'unconfirmed_assumptions':
      return `${blocker.count} Import-Annahme${blocker.count === 1 ? '' : 'n'} „durchgegart“ nicht (mehr) bestätigt (Häkchen „Import-Annahmen geprüft“)`;
    case 'red_issues':
      return `rote Befunde: ${blocker.rules.join(', ')}`;
  }
}

export interface RecipeReleaseDecision {
  /** Stand vor der Freigabe. */
  readonly original: Recipe;
  /** Stand nach der Freigabe (nur sinnvoll, wenn `blockers` leer ist). */
  readonly released: Recipe;
  /** Leer = wird freigegeben. */
  readonly blockers: readonly RecipeReleaseBlocker[];
}

/**
 * Plant die Freigabe von Rezepten: alle Rezepte, die `select` auswählt (eine Kategorie oder eine ID-Liste), werden probehalber
 * freigegeben und zusammen mit allen anderen Ernährungs-Inhalten geprüft (`validateContent`, dieselben Regeln wie
 * content:validate). Ergebnis je Rezept in der Reihenfolge der Dateien. Rezepte mit Schemafehler sind nicht dabei
 * (ihre Kategorie ist nicht lesbar; content:validate meldet sie ohnehin rot).
 */
export function planRecipeRelease(
  files: readonly NutritionContentFile[],
  catalog: NutritionCatalogContext | undefined,
  select: (recipe: Recipe) => boolean,
  options: RecipeReleaseOptions,
  /** Schon vorhandenes Ergebnis von `validateContent(files, catalog)` – spart eine Prüfung (Wächter N2d K2). */
  before: ContentValidationResult = validateContent(files, validationOptions(catalog)),
): RecipeReleaseDecision[] {
  const foods: FoodLookup = new Map(before.foods.map((food) => [food.id, food]));
  const candidates = before.recipes.filter(select);
  const releasedById = new Map(
    candidates
      .filter((recipe) => recipe.status === 'draft')
      .map((recipe) => [recipe.id, releasedRecipe(recipe, foods, options)]),
  );
  const after = validateContent(
    files.map((file) => {
      const id = (file.data as { id?: unknown } | undefined)?.id;
      const released =
        file.kind === 'recipe' && typeof id === 'string' ? releasedById.get(id) : undefined;
      return released === undefined ? file : { ...file, data: released };
    }),
    validationOptions(catalog),
  );
  return candidates.map((original) => {
    const released = releasedById.get(original.id) ?? original;
    return {
      original,
      released,
      blockers: recipeReleaseBlockers(original, released, foods, after.issues),
    };
  });
}

/** Ersetzt in `files` die Daten der Inhalte aus `replacements` (Schlüssel `kind:id`). */
function withReplacements(
  files: readonly NutritionContentFile[],
  replacements: ReadonlyMap<string, unknown>,
): NutritionContentFile[] {
  return files.map((file) => {
    const id = (file.data as { id?: unknown } | undefined)?.id;
    const next = typeof id === 'string' ? replacements.get(`${file.kind}:${id}`) : undefined;
    return next === undefined ? file : { ...file, data: next };
  });
}

/** Stand eines Meal-Prep-Plans oder Ratgebers nach der Freigabe (nur Status und Prüfvermerk ändern sich). */
export function releasedContent<T extends MealPrepPlan | Guide | IngredientSubstitution>(
  content: T,
  options: Pick<RecipeReleaseOptions, 'reviewer' | 'date' | 'expertReviewed'>,
): T {
  return {
    ...content,
    status: 'published',
    meta: {
      ...content.meta,
      reviewed_by: options.reviewer,
      reviewed_at: options.date,
      expert_reviewed: content.meta.expert_reviewed || options.expertReviewed,
    },
  };
}

/** Rote Befunde eines Inhalts im Stand nach der Freigabe. */
function redBlocker(
  issues: readonly ContentIssue[],
  kind: 'meal_prep_plan' | 'guide' | 'ingredient_substitution',
  id: string,
): NutritionReleaseBlocker[] {
  const red = issues.filter(
    (issue) => issue.kind === kind && issue.id === id && issue.severity === 'error',
  );
  return red.length === 0
    ? []
    : [
        {
          kind: 'red_issues',
          rules: [...new Set(red.map((issue) => issue.rule))],
          messages: red.map((issue) => `${issue.rule}: ${issue.message}`),
        },
      ];
}

/** Gelbe Befunde, die eine Fachprüfung verlangen: Ratgeber nur mit „fachlich geprüft“ (Wächter N2d S6). */
const EXPERT_REVIEW_RULES: readonly ContentRuleId[] = ['R21H'];

function expertReviewBlocker(
  issues: readonly ContentIssue[],
  id: string,
  expertReviewed: boolean,
): NutritionReleaseBlocker[] {
  if (expertReviewed) return [];
  const hits = issues.filter(
    (issue) =>
      issue.kind === 'guide' &&
      issue.id === id &&
      issue.severity === 'warning' &&
      EXPERT_REVIEW_RULES.includes(issue.rule),
  );
  return hits.length === 0
    ? []
    : [
        {
          kind: 'needs_expert_review',
          rules: [...new Set(hits.map((issue) => issue.rule))],
          messages: hits.map((issue) => `${issue.rule}: ${issue.message}`),
        },
      ];
}

/** Ergebnis je Inhalt bei der Freigabe per ID. */
export type NutritionReleaseDecision =
  | {
      readonly kind: 'recipe';
      readonly original: Recipe;
      readonly released: Recipe;
      readonly blockers: readonly NutritionReleaseBlocker[];
    }
  | {
      readonly kind: 'meal_prep_plan';
      readonly original: MealPrepPlan;
      readonly released: MealPrepPlan;
      readonly blockers: readonly NutritionReleaseBlocker[];
    }
  | {
      readonly kind: 'guide';
      readonly original: Guide;
      readonly released: Guide;
      readonly blockers: readonly NutritionReleaseBlocker[];
    }
  | {
      readonly kind: 'ingredient_substitution';
      readonly original: IngredientSubstitution;
      readonly released: IngredientSubstitution;
      readonly blockers: readonly NutritionReleaseBlocker[];
    };

export interface NutritionReleasePlan {
  /** Je gefundener ID in der Reihenfolge der Eingabe. */
  readonly decisions: readonly NutritionReleaseDecision[];
  /** IDs von Lebensmitteln – NICHT über diesen Weg (eigene Prüfung „Katalog geprüft“, R19). */
  readonly foodIds: readonly string[];
  /** IDs, die es (mit gültigem Schema) weder als Rezept, Meal-Prep-Plan, Ratgeber noch Austausch gibt. */
  readonly unknownIds: readonly string[];
  /** IDs, die es in mehreren Arten gibt (z. B. Rezept und Ratgeber) – nicht eindeutig. */
  readonly ambiguousIds: readonly string[];
}

/**
 * Freigabe von Ernährungs-Inhalten per ID (Workflow content-review, Art „ids“; Gründer-Entscheidungen 14.10.2026):
 * - Rezepte über `planRecipeRelease` mit der ID-Liste als Auswahl – dieselben Gründe und Häkchen wie die
 *   Sammelfreigabe (für Rezepte ohne Kategorie der einzige Weg),
 * - Meal-Prep-Pläne nur, wenn alle `recipe_ids` nach diesem Lauf freigegeben sind (schon vorher oder in diesem Lauf
 *   ohne Grund dagegen) und kein roter Befund bleibt (R20 inkl. Aufbewahrung nach R9),
 * - Ratgeber nur ohne roten Befund (R21, Textregeln inkl. Health-Claims) und mit gelbem R21H (z. B. Dosierungen)
 *   nur mit Häkchen „fachlich geprüft“ (Wächter N2d S6),
 * - Austausch-Einträge (19.7 N9) nur ohne roten Befund im Stand danach (R23: beide Lebensmittel freigegeben und
 *   katalog-geprüft, Messgröße der Rolle ±10 %, kein Alkohol; R10 Hinweis-Text). Gelbes R23H (Süße) blockiert nicht,
 *   steht aber im Prüfbericht des Pull Requests.
 * Geprüft wird jeweils der Stand NACH der Freigabe; Pläne und Ratgeber in einem zweiten Durchgang, in dem nur die
 * tatsächlich freigegebenen Rezepte als freigegeben zählen. Lebensmittel werden nie freigegeben (`foodIds`).
 */
export function planNutritionRelease(
  files: readonly NutritionContentFile[],
  catalog: NutritionCatalogContext | undefined,
  ids: readonly string[],
  options: RecipeReleaseOptions,
): NutritionReleasePlan {
  const before = validateContent(files, validationOptions(catalog));
  const wanted = [...new Set(ids)];
  const wantedSet = new Set(wanted);
  const recipeById = new Map(before.recipes.map((r) => [r.id, r]));
  const planById = new Map(before.mealPrepPlans.map((p) => [p.id, p]));
  const guideById = new Map(before.guides.map((g) => [g.id, g]));
  const subById = new Map(before.substitutions.map((x) => [x.id, x]));
  const foodIdSet = new Set(before.foods.map((f) => f.id));

  const foodIds: string[] = [];
  const unknownIds: string[] = [];
  const ambiguousIds: string[] = [];
  for (const id of wanted) {
    const hits = [recipeById.has(id), planById.has(id), guideById.has(id), subById.has(id)].filter(
      Boolean,
    ).length;
    if (hits > 1) ambiguousIds.push(id);
    else if (hits === 0 && foodIdSet.has(id)) foodIds.push(id);
    else if (hits === 0) unknownIds.push(id);
  }

  const recipeDecisions = new Map(
    planRecipeRelease(files, catalog, (recipe) => wantedSet.has(recipe.id), options, before).map(
      (decision) => [decision.original.id, decision],
    ),
  );
  const plans = wanted.flatMap((id) => {
    const plan = planById.get(id);
    return plan !== undefined && !recipeById.has(id) && !guideById.has(id) ? [plan] : [];
  });
  const guides = wanted.flatMap((id) => {
    const guide = guideById.get(id);
    return guide !== undefined && !recipeById.has(id) && !planById.has(id) && !subById.has(id)
      ? [guide]
      : [];
  });
  const subs = wanted.flatMap((id) => {
    const sub = subById.get(id);
    return sub !== undefined && !recipeById.has(id) && !planById.has(id) && !guideById.has(id)
      ? [sub]
      : [];
  });

  const planDecisions = new Map<string, NutritionReleaseDecision>();
  const guideDecisions = new Map<string, NutritionReleaseDecision>();
  const subDecisions = new Map<string, NutritionReleaseDecision>();
  if (plans.length + guides.length + subs.length > 0) {
    const replacements = new Map<string, unknown>();
    for (const decision of recipeDecisions.values()) {
      if (decision.blockers.length === 0) {
        replacements.set(`recipe:${decision.original.id}`, decision.released);
      }
    }
    for (const plan of plans) {
      if (plan.status === 'draft') {
        replacements.set(`meal_prep_plan:${plan.id}`, releasedContent(plan, options));
      }
    }
    for (const guide of guides) {
      if (guide.status === 'draft') {
        replacements.set(`guide:${guide.id}`, releasedContent(guide, options));
      }
    }
    for (const sub of subs) {
      if (sub.status === 'draft') {
        replacements.set(`ingredient_substitution:${sub.id}`, releasedContent(sub, options));
      }
    }
    const after = validateContent(
      withReplacements(files, replacements),
      validationOptions(catalog),
    );
    const recipesAfter = new Map(after.recipes.map((r) => [r.id, r]));
    for (const plan of plans) {
      const released =
        (replacements.get(`meal_prep_plan:${plan.id}`) as MealPrepPlan | undefined) ?? plan;
      const blockers: NutritionReleaseBlocker[] = [];
      if (plan.status !== 'draft') {
        blockers.push({ kind: 'not_draft', status: plan.status });
      } else {
        const notReleased = plan.recipe_ids.filter(
          (rid) => recipesAfter.get(rid)?.status !== 'published',
        );
        if (notReleased.length > 0) {
          blockers.push({ kind: 'recipes_not_released', recipeIds: notReleased });
        }
        blockers.push(...redBlocker(after.issues, 'meal_prep_plan', plan.id));
      }
      planDecisions.set(plan.id, { kind: 'meal_prep_plan', original: plan, released, blockers });
    }
    for (const guide of guides) {
      const released = (replacements.get(`guide:${guide.id}`) as Guide | undefined) ?? guide;
      const blockers: NutritionReleaseBlocker[] =
        guide.status !== 'draft'
          ? [{ kind: 'not_draft', status: guide.status }]
          : [
              ...redBlocker(after.issues, 'guide', guide.id),
              ...expertReviewBlocker(after.issues, guide.id, released.meta.expert_reviewed),
            ];
      guideDecisions.set(guide.id, { kind: 'guide', original: guide, released, blockers });
    }
    for (const sub of subs) {
      const released =
        (replacements.get(`ingredient_substitution:${sub.id}`) as
          IngredientSubstitution | undefined) ?? sub;
      const blockers: NutritionReleaseBlocker[] =
        sub.status !== 'draft'
          ? [{ kind: 'not_draft', status: sub.status }]
          : redBlocker(after.issues, 'ingredient_substitution', sub.id);
      subDecisions.set(sub.id, {
        kind: 'ingredient_substitution',
        original: sub,
        released,
        blockers,
      });
    }
  }

  const decisions = wanted.flatMap((id): NutritionReleaseDecision[] => {
    if (ambiguousIds.includes(id)) return [];
    const recipe = recipeDecisions.get(id);
    if (recipe !== undefined) return [{ kind: 'recipe', ...recipe }];
    const other = planDecisions.get(id) ?? guideDecisions.get(id) ?? subDecisions.get(id);
    return other === undefined ? [] : [other];
  });
  return { decisions, foodIds, unknownIds, ambiguousIds };
}

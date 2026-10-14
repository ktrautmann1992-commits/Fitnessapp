import { z } from 'zod';

import { RECIPE_EXTENSION_LIMITS } from '../constants';
import { normalizeFoodText } from '../content/allergen-rules';
import type { FoodLookup } from '../content/food-schema';
import { recipeTotalMinutes } from '../content/import-rules';
import { RECIPE_CATEGORY_IDS, type Recipe, type RecipeCategoryId } from '../content/recipe-schema';
import { DIET_TYPES, type DietType } from '../enums';
import { filterRecipe, type FilteredRecipe } from './filter';
import { dietAllows } from './recipe-nutrients';
import { type MealPlanProfileInput, mealPlanProfileSchema } from './schemas';

/**
 * Rezeptsuche (docs/PLAN-PHASE-5.md 19.6): dieselben HARTEN Regeln wie `filter.ts` – Schwein nur bei
 * `eats_pork = true` (`null` bei Mischkost = nein, W10, G2), Unverträglichkeiten, „mag ich nicht“,
 * `pregnancy_caution`, Status/Katalog. Diese Ausschlüsse sind in der Suche NICHT abschaltbar.
 * Die Ernährungsform ist aus dem Profil vorbelegt und ERWEITERBAR (K3, z. B. vegan sucht auch vegetarisch) – sie
 * ist eine Vorliebe, kein Schutz; Treffer außerhalb der Profil-Ernährungsform sind gekennzeichnet und kommen nie
 * in den automatischen Essensplan (G4). Weiche Filter: Kategorie, Abschnitt, „Unter 10 Minuten“, max. Kosten (nur
 * mit freigegebener Schätzung), Text. Sortierung deterministisch (Titel, dann ID).
 */

export const recipeSearchQuerySchema = z
  .strictObject({
    /** Zusätzliche Ernährungsformen (erweitert die Profil-Ernährungsform, schränkt nie ein). */
    diets: z.array(z.enum(DIET_TYPES)).max(3).default([]),
    categories: z.array(z.enum(RECIPE_CATEGORY_IDS)).max(8).default([]),
    section: z.string().trim().min(1).max(RECIPE_EXTENSION_LIMITS.sectionMaxChars).optional(),
    /** „Unter 10 Minuten“: Gesamtzeit des Rezepts ≤ 10 Minuten. */
    quick: z.boolean().default(false),
    /** Höchstkosten je Portion in Euro – nur Rezepte mit FREIGEGEBENER Schätzung. */
    maxCostEur: z
      .number()
      .finite()
      .min(0)
      .max(RECIPE_EXTENSION_LIMITS.costEurPerServing.max)
      .optional(),
    text: z.string().trim().max(100).optional(),
  })
  .default({ diets: [], categories: [], quick: false });
export type RecipeSearchQuery = z.input<typeof recipeSearchQuerySchema>;

export interface RecipeSearchHit {
  readonly variant: FilteredRecipe;
  /** Rezept passt nicht zur Profil-Ernährungsform (Kennzeichnung „passt nicht zu deiner Ernährungsform“). */
  readonly outsideProfileDiet: DietType | null;
}

const DIET_RANK: Readonly<Record<DietType, number>> = { vegan: 0, vegetarian: 1, omnivore: 2 };
const DIETS_BY_RANK: readonly DietType[] = ['vegan', 'vegetarian', 'omnivore'];

/** Die großzügigste der Ernährungsformen (Erweitern, nie Einschränken, K3). */
function widestDiet(profileDiet: DietType, extra: readonly DietType[]): DietType {
  return [profileDiet, ...extra].reduce((a, b) => (DIET_RANK[b] > DIET_RANK[a] ? b : a));
}

/**
 * Ernährungsformen, um die die Suche erweitert werden kann (K3): nur großzügigere als die Profil-Ernährungsform
 * (vegan → vegetarisch, mit Fleisch; vegetarisch → mit Fleisch; mit Fleisch → keine).
 */
export function recipeSearchDietOptions(profileDiet: DietType): DietType[] {
  return DIETS_BY_RANK.filter((diet) => DIET_RANK[diet] > DIET_RANK[profileDiet]);
}

/**
 * Weiche Filter, die der Bestand hergibt (nicht personenbezogen): Kategorien in fester Reihenfolge, Abschnitte
 * alphabetisch, ob es Rezepte mit FREIGEGEBENER Kostenschätzung gibt. Leere Filter werden nicht angeboten.
 */
export function recipeSearchFacets(recipes: readonly Recipe[]): {
  categories: RecipeCategoryId[];
  sections: string[];
  hasReviewedCosts: boolean;
} {
  const categories = new Set(recipes.flatMap((r) => r.categories ?? []));
  const sections = new Set(
    recipes.flatMap((r) => (r.section_de === undefined ? [] : [r.section_de])),
  );
  return {
    categories: RECIPE_CATEGORY_IDS.filter((id) => categories.has(id)),
    sections: [...sections].sort((a, b) => a.localeCompare(b, 'de')),
    hasReviewedCosts: recipes.some((r) => r.cost_estimate?.reviewed_by !== undefined),
  };
}

export interface RecipeForPersonContext {
  readonly foods: FoodLookup;
  readonly profile: MealPlanProfileInput;
  /** Ausschluss `pregnancy_caution` (aus den Tageszielen). */
  readonly excludePregnancyCaution: boolean;
  readonly allowDrafts: boolean;
  readonly redRecipeIds?: ReadonlySet<string>;
}

/**
 * EIN Rezept für die Person – dieselbe Regel wie die Suche (Rezeptansicht aus der Suche, „Zur Einkaufsliste“ eines
 * Suchtreffers): zuerst wie im Essensplan mit der Profil-Ernährungsform (`filterRecipe`), nur wenn das nicht passt mit
 * der erweiterten Form. Alle anderen Ausschlüsse (Schwein, Unverträglichkeiten, „mag ich nicht“,
 * `pregnancy_caution`, Status) gelten unverändert – sie laufen in beiden Fällen durch `filterRecipe`.
 * null = ausgeschlossen.
 */
export function recipeForPersonWithDiets(
  recipe: Recipe,
  ctx: RecipeForPersonContext,
  extraDiets: readonly DietType[] = [],
): RecipeSearchHit | null {
  const profile = mealPlanProfileSchema.parse(ctx.profile);
  const diets = z.array(z.enum(DIET_TYPES)).max(3).parse(extraDiets);
  const searchDiet = widestDiet(profile.diet, diets);
  const filterCtx = (p: typeof profile) => ({
    profile: p,
    excludePregnancyCaution: ctx.excludePregnancyCaution,
    allowDrafts: ctx.allowDrafts,
    ...(ctx.redRecipeIds !== undefined ? { redRecipeIds: ctx.redRecipeIds } : {}),
  });
  const own = filterRecipe(recipe, ctx.foods, filterCtx(profile));
  const result =
    own.ok || searchDiet === profile.diet
      ? own
      : filterRecipe(recipe, ctx.foods, filterCtx({ ...profile, diet: searchDiet }));
  if (!result.ok) return null;
  const diet = result.value.facts.diet;
  return {
    variant: result.value,
    // Nur über die erweiterte Form gefunden → immer gekennzeichnet (G4: nie in den automatischen Plan).
    outsideProfileDiet: own.ok ? null : dietAllows(profile.diet, diet) ? searchDiet : diet,
  };
}

export function searchRecipes(
  input: {
    readonly recipes: readonly Recipe[];
    readonly foods: FoodLookup;
    readonly profile: MealPlanProfileInput;
    /** Ausschluss `pregnancy_caution` (aus den Tageszielen von heute). */
    readonly excludePregnancyCaution: boolean;
    readonly allowDrafts: boolean;
    readonly redRecipeIds?: ReadonlySet<string>;
  },
  rawQuery?: RecipeSearchQuery,
): RecipeSearchHit[] {
  const query = recipeSearchQuerySchema.parse(rawQuery);
  const text = query.text === undefined ? null : normalizeFoodText(query.text);
  const ctx: RecipeForPersonContext = {
    foods: input.foods,
    profile: mealPlanProfileSchema.parse(input.profile),
    excludePregnancyCaution: input.excludePregnancyCaution,
    allowDrafts: input.allowDrafts,
    ...(input.redRecipeIds !== undefined ? { redRecipeIds: input.redRecipeIds } : {}),
  };

  const hits: RecipeSearchHit[] = [];
  for (const recipe of input.recipes) {
    const hit = recipeForPersonWithDiets(recipe, ctx, query.diets);
    if (hit === null) continue;
    if (
      query.categories.length > 0 &&
      !query.categories.some((c) => recipe.categories?.includes(c) === true)
    ) {
      continue;
    }
    if (query.section !== undefined && recipe.section_de !== query.section) continue;
    if (query.quick && recipeTotalMinutes(recipe) > RECIPE_EXTENSION_LIMITS.quickMaxMinutes) {
      continue;
    }
    if (query.maxCostEur !== undefined) {
      const cost = recipe.cost_estimate;
      if (cost?.reviewed_by === undefined || cost.eur_per_serving > query.maxCostEur) continue;
    }
    if (text !== null && text !== '' && !normalizeFoodText(recipe.title_de).includes(text))
      continue;
    hits.push(hit);
  }
  return hits.sort(
    (a, b) =>
      a.variant.recipe.title_de.localeCompare(b.variant.recipe.title_de, 'de') ||
      (a.variant.recipe.id < b.variant.recipe.id ? -1 : 1),
  );
}

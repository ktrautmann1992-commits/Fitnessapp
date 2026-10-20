import {
  isPublishedWithoutExpertReview,
  type DietType,
  type NutritionLibrary,
  type RecipeCategoryId,
  type RecipeSearchQuery,
  recipeSearchDietOptions,
  recipeSearchFacets,
  recipeTotalMinutes,
  scaleRecipeForServings,
  searchRecipes,
  weekExcludesPregnancyCaution,
  type IntoleranceBlockReason,
} from '@fitnessapp/core';

import type { ConsentVersions } from './mapping';
import { mealPlanProfileFromRows, type NutritionWeekResult } from './nutrition-plan';
import type { UserRows } from './types';

/**
 * Rezeptsuche in der App (docs/PLAN-PHASE-5.md 19.6, KONZEPT 6.5, Etappe N5c): gratis, regelbasiert, ohne
 * Echtzeit-KI. Nur Zusammensetzen – die Regeln stehen in packages/core (`searchRecipes` → `filter.ts`). Profil wie
 * im Essensplan (Unverträglichkeiten nur mit gültiger Einwilligung, sonst blockiert), Schwangerschafts-Ausschluss,
 * sobald er an einem Tag der Woche gilt (wie die Rezeptansicht, sichere Richtung). Nie loggen.
 */

export interface RecipeSearchCard {
  id: string;
  title: string;
  description: string;
  totalMinutes: number;
  /** Gekennzeichnet „passt nicht zu deiner Ernährungsform: …“ (K3/G4). */
  outsideProfileDiet: DietType | null;
  /** kcal je Portion des Grundrezepts; nur anzeigen, wenn „Kalorienzahlen“ an sind. null = nicht berechenbar. */
  kcalPerServing: number | null;
  isDraft: boolean;
  /** Freigegeben ohne Fachprüfung (Testphase, Gründer 19.10.2026) → kleines Kennzeichen „Testphase …“. */
  isTestphase: boolean;
}

export type RecipeSearchResult =
  | { kind: 'incomplete' }
  | { kind: 'blocked'; reason: IntoleranceBlockReason }
  | {
      kind: 'ok';
      /** Vorbelegt aus dem Profil. */
      profileDiet: DietType;
      /** Ernährungsformen, um die die Suche erweitert werden kann. */
      dietOptions: DietType[];
      categories: RecipeCategoryId[];
      sections: string[];
      hasReviewedCosts: boolean;
      cards: RecipeSearchCard[];
    };

export function recipeSearchForPerson(input: {
  library: NutritionLibrary;
  rows: UserRows;
  versions: ConsentVersions;
  week: Extract<NutritionWeekResult, { kind: 'ready' }>;
  allowDrafts: boolean;
  query: RecipeSearchQuery;
}): RecipeSearchResult {
  const profile = mealPlanProfileFromRows(input.rows, input.versions);
  if (profile.kind === 'incomplete') return { kind: 'incomplete' };
  if (profile.kind === 'blocked') return { kind: 'blocked', reason: profile.reason };
  const profileDiet = profile.profile.diet;
  const hits = searchRecipes(
    {
      recipes: input.library.recipes,
      foods: input.library.foods,
      profile: profile.profile,
      excludePregnancyCaution: weekExcludesPregnancyCaution(input.week.targets),
      allowDrafts: input.allowDrafts,
    },
    input.query,
  );
  const facets = recipeSearchFacets(input.library.recipes);
  return {
    kind: 'ok',
    profileDiet,
    dietOptions: recipeSearchDietOptions(profileDiet),
    ...facets,
    cards: hits.map((hit) => {
      const recipe = hit.variant.recipe;
      let kcal: number | null;
      try {
        kcal = scaleRecipeForServings(hit.variant, recipe.servings, input.library.foods).perServing
          .kcal;
      } catch {
        kcal = null;
      }
      return {
        id: recipe.id,
        title: recipe.title_de,
        description: recipe.description_de,
        totalMinutes: recipeTotalMinutes(recipe),
        outsideProfileDiet: hit.outsideProfileDiet,
        kcalPerServing: kcal,
        isDraft: recipe.status === 'draft',
        isTestphase: isPublishedWithoutExpertReview(recipe),
      };
    }),
  };
}

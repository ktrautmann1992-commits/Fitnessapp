import {
  type IntoleranceBlockReason,
  type NutritionLibrary,
  type RecipeSwipeCard,
  recipeSwipeStack,
  weekExcludesPregnancyCaution,
} from '@fitnessapp/core';

import type { ConsentVersions } from './mapping';
import { mealPlanProfileFromRows, type NutritionWeekResult } from './nutrition-plan';
import { ratingsFromRows } from './rating-rows';
import { recipePreferencesFromRows } from './recipe-preference-rows';
import type { UserRows } from './types';

/**
 * Kartenstapel „Gerichte entdecken“ (Wischen, 01.11.2026): nur Zusammensetzen – die Regeln stehen in packages/core
 * (`recipeSwipeStack` → `searchRecipes` → `filter.ts`). Profil wie im Essensplan (Unverträglichkeiten nur mit gültiger
 * Einwilligung, sonst blockiert), Schwangerschafts-Ausschluss, sobald er an einem Tag der Woche gilt. Nie loggen.
 */
export type RecipeSwipeStackResult =
  | { kind: 'incomplete' }
  | { kind: 'blocked'; reason: IntoleranceBlockReason }
  | { kind: 'ok'; cards: RecipeSwipeCard[] };

export function recipeSwipeStackForPerson(input: {
  library: NutritionLibrary;
  rows: UserRows;
  versions: ConsentVersions;
  week: Extract<NutritionWeekResult, { kind: 'ready' }>;
  weekStart: string;
  allowDrafts: boolean;
  seen: readonly string[];
}): RecipeSwipeStackResult {
  const profile = mealPlanProfileFromRows(input.rows, input.versions);
  if (profile.kind === 'incomplete') return { kind: 'incomplete' };
  if (profile.kind === 'blocked') return { kind: 'blocked', reason: profile.reason };
  return {
    kind: 'ok',
    cards: recipeSwipeStack({
      recipes: input.library.recipes,
      foods: input.library.foods,
      profile: profile.profile,
      excludePregnancyCaution: weekExcludesPregnancyCaution(input.week.targets),
      allowDrafts: input.allowDrafts,
      weekStart: input.weekStart,
      preferences: recipePreferencesFromRows(input.rows),
      ratings: ratingsFromRows(input.rows),
      seen: input.seen,
    }),
  };
}

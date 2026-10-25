import {
  isPublishedWithoutExpertReview,
  type FilteredRecipe,
  FRIDGE_SEARCH,
  type FridgeFoodOption,
  fridgeMatchPercent,
  fridgeSearchFoodOptions,
  type FridgeSearchInput,
  fridgeSearchVariants,
  type IntoleranceBlockReason,
  type NutritionLibrary,
  recipeCardNutrients,
  type RecipeCardNutrients,
  recipeIdsWithPreference,
  recipeTotalMinutes,
  searchFridge,
  weekExcludesPregnancyCaution,
} from '@fitnessapp/core';

import type { ConsentVersions } from './mapping';
import { mealPlanProfileFromRows, type NutritionWeekResult } from './nutrition-plan';
import { recipePreferencesFromRows } from './recipe-preference-rows';
import type { UserRows } from './types';

/**
 * Kühlschrank-Suche „Was habe ich da?“ in der App (docs/PLAN-PHASE-5.md 19.7 N11, KONZEPT 6.11): gratis,
 * regelbasiert, ohne Echtzeit-KI. Nur Zusammensetzen – die Regeln stehen in packages/core (`searchFridge` →
 * `filter.ts`). Profil wie Rezeptsuche und Essensplan (Unverträglichkeiten nur mit gültiger Einwilligung, sonst
 * blockiert), Schwangerschafts-Ausschluss, sobald er an einem Tag der Woche gilt. Die Auswahl kommt nur aus dem
 * Zustand der Ansicht – sie wird hier nicht gespeichert und nie geloggt.
 */

export interface FridgeSearchCard {
  id: string;
  title: string;
  totalMinutes: number;
  /** Übereinstimmung in ganzen Prozent (abgerundet). */
  percent: number;
  /** Namen der vorhandenen Zutaten. */
  have: string[];
  /** Namen der fehlenden Hauptzutaten (höchstens `FRIDGE_SEARCH.maxMissingShown`). */
  missing: string[];
  /** Weitere fehlende Hauptzutaten, die nicht einzeln genannt werden. */
  missingMore: number;
  /** Namen fehlender Zutaten aus Vorrat und Gewürzen. */
  missingMinor: string[];
  /** Namen der Zutaten, die (nur) aus dem Vorratsschrank kommen (25.10.2026). */
  fromPantry: string[];
  /**
   * kcal, Eiweiß und Kohlenhydrate je Portion des Grundrezepts (packages/core `recipeCardNutrients`); nur anzeigen,
   * wenn „Kalorienzahlen“ an sind. null = nicht berechenbar.
   */
  perServing: RecipeCardNutrients | null;
  isDraft: boolean;
  /** Freigegeben ohne Fachprüfung (Testphase, Gründer 19.10.2026) → kleines Kennzeichen „Testphase …“. */
  isTestphase: boolean;
}

export type FridgeSearchResult =
  | { kind: 'incomplete' }
  | { kind: 'blocked'; reason: IntoleranceBlockReason }
  | {
      kind: 'ok';
      /** Auswahlliste (nur Lebensmittel aus Rezepten, die zur Person passen). */
      options: FridgeFoodOption[];
      cards: FridgeSearchCard[];
      /** true = mindestens ein Treffer ist ein Entwurf (Allergen-Warnung, 19.8 Nr. 9). */
      hasDrafts: boolean;
      /** true = mindestens ein Treffer ist freigegeben ohne Fachprüfung (Testphase → Allergen-Warnung, Wächter M2). */
      hasTestphase: boolean;
    };

export interface FridgeSearchBaseInput {
  library: NutritionLibrary;
  rows: UserRows;
  versions: ConsentVersions;
  week: Extract<NutritionWeekResult, { kind: 'ready' }>;
  allowDrafts: boolean;
}

/** Vorbereitete Suche: hängt nur von Profil, Woche und Bestand ab, NICHT von der Auswahl (Wächter N11 S2). */
export type FridgeSearchPrepared =
  | { kind: 'incomplete' }
  | { kind: 'blocked'; reason: IntoleranceBlockReason }
  | {
      kind: 'ok';
      options: FridgeFoodOption[];
      searchInput: FridgeSearchInput;
      variants: FilteredRecipe[];
      library: NutritionLibrary;
    };

/**
 * Einmal je Profil/Woche/Bestand: Varianten der für die Person passenden Rezepte (`filter.ts`) und die Auswahlliste.
 * Die App merkt sich das Ergebnis (useMemo ohne Auswahl); jedes Antippen rechnet danach nur noch die Übereinstimmung.
 */
export function prepareFridgeSearch(input: FridgeSearchBaseInput): FridgeSearchPrepared {
  const profile = mealPlanProfileFromRows(input.rows, input.versions);
  if (profile.kind === 'incomplete') return { kind: 'incomplete' };
  if (profile.kind === 'blocked') return { kind: 'blocked', reason: profile.reason };
  // Rezept-Favoriten (25.10.2026): mit „Nie wieder“ ausgeblendete Rezepte erscheinen auch hier nicht.
  const hidden = new Set(recipeIdsWithPreference(recipePreferencesFromRows(input.rows), 'hidden'));
  const searchInput: FridgeSearchInput = {
    recipes:
      hidden.size === 0
        ? input.library.recipes
        : input.library.recipes.filter((r) => !hidden.has(r.id)),
    foods: input.library.foods,
    profile: profile.profile,
    excludePregnancyCaution: weekExcludesPregnancyCaution(input.week.targets),
    allowDrafts: input.allowDrafts,
  };
  const variants = fridgeSearchVariants(searchInput);
  return {
    kind: 'ok',
    options: fridgeSearchFoodOptions(searchInput, variants),
    searchInput,
    variants,
    library: input.library,
  };
}

/**
 * Treffer zur Auswahl. `limit` = nur so viele Karten fertig machen (kcal-Berechnung), `total` nennt alle Treffer;
 * die Reihenfolge ist dieselbe wie ohne Grenze.
 */
export function fridgeSearchResults(
  prepared: Extract<FridgeSearchPrepared, { kind: 'ok' }>,
  foodIds: readonly string[],
  limit?: number,
  /** Vorratsschrank (25.10.2026): zählt als vorhanden, „fast leer“ halb (packages/core `pantryShares`). */
  pantry: readonly { readonly foodId: string; readonly low: boolean }[] = [],
): { cards: FridgeSearchCard[]; total: number; hasDrafts: boolean; hasTestphase: boolean } {
  // Nur angebotene Lebensmittel zählen (eine veraltete Auswahl nach einer Profiländerung fällt still weg).
  const offered = new Set(prepared.options.map((o) => o.foodId));
  const ids = [...new Set(foodIds)].filter((id) => offered.has(id));
  const pantryOffered = pantry.filter((p) => offered.has(p.foodId));
  const hits = searchFridge(
    prepared.searchInput,
    { foodIds: ids, pantry: pantryOffered },
    prepared.variants,
  );
  const foods = prepared.library.foods;
  const name = (id: string) => foods.get(id)?.name_de ?? id;
  const shownHits = limit === undefined ? hits : hits.slice(0, Math.max(0, limit));
  const cards = shownHits.map((hit): FridgeSearchCard => {
    const recipe = hit.variant.recipe;
    const shown = hit.missing.slice(0, FRIDGE_SEARCH.maxMissingShown);
    return {
      id: recipe.id,
      title: recipe.title_de,
      totalMinutes: recipeTotalMinutes(recipe),
      percent: fridgeMatchPercent(hit.match),
      // Ausgewählte Zutaten; was nur aus dem Vorratsschrank kommt, steht unter `fromPantry`.
      have: hit.have.filter((id) => !hit.fromPantry.includes(id)).map(name),
      missing: shown.map(name),
      missingMore: hit.missing.length - shown.length,
      missingMinor: hit.missingMinor.map(name),
      fromPantry: hit.fromPantry.map(name),
      perServing: recipeCardNutrients(hit.variant, foods),
      isDraft: recipe.status === 'draft',
      isTestphase: isPublishedWithoutExpertReview(recipe),
    };
  });
  return {
    cards,
    total: hits.length,
    hasDrafts: hits.some((hit) => hit.variant.recipe.status === 'draft'),
    hasTestphase: hits.some((hit) => isPublishedWithoutExpertReview(hit.variant.recipe)),
  };
}

/** Vorbereiten und suchen in einem Schritt (alle Karten) – für Tests und einfache Aufrufer. */
export function fridgeSearchForPerson(
  input: FridgeSearchBaseInput & { foodIds: readonly string[] },
): FridgeSearchResult {
  const prepared = prepareFridgeSearch(input);
  if (prepared.kind !== 'ok') return prepared;
  const { cards, hasDrafts, hasTestphase } = fridgeSearchResults(prepared, input.foodIds);
  return { kind: 'ok', options: prepared.options, cards, hasDrafts, hasTestphase };
}

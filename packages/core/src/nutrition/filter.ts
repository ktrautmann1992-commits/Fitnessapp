import { type Food, type FoodLookup, isCatalogReviewed } from '../content/food-schema';
import { recipeTotalMinutes } from '../content/import-rules';
import type { MealType, Recipe } from '../content/recipe-schema';
import type { FoodGroupId } from '../food-groups';
import {
  computeRecipeFacts,
  dietAllows,
  foodContainsPork,
  foodDiet,
  type RecipeFacts,
} from './recipe-nutrients';
import type { MealPlanProfile } from './schemas';
import type { MealSlotId } from './timing';

/**
 * Rezept-Filter – harte Regeln (docs/PLAN-PHASE-5.md 6.1, 19.6 B1). EINZIGE Stelle, die entscheidet, ob ein
 * Rezept zu einer Person passt; Essensplan, Meal-Prep-Pläne, Rezeptsuche und Tausch rufen sie auf.
 *
 * Ein Rezept passt nur, wenn
 * - Status `published` (Testmodus zusätzlich `draft`), kein roter Befund, alle Lebensmittel im Katalog und
 *   katalog-geprüft (R19), Nährwerte vollständig berechenbar (R2), kein Alkohol (R12);
 * - die Ernährungsform passt (vegan ⊂ vegetarisch ⊂ omnivor; Lab und Gelatine nicht vegetarisch, Honig nicht vegan);
 * - Schwein nur bei `eatsPork === true` (`null` = nein, W10, G2; Gelatine unbekannter Herkunft = Schwein, S5);
 * - keine Gruppe aus Unverträglichkeiten und keine aus „mag ich nicht“ (Gründer-Entscheidung 5: hart; K9:
 *   Unverträglichkeit schlägt „mag ich“);
 * - bei Ausschluss `pregnancy_caution` (Schwangerschaft; kein Check bei Geschlecht ≠ männlich, B4) keine
 *   Schwangerschafts-Vorsicht – aus Katalog-Flag, `heated: false`, `no_cook` und unbestätigter Import-Annahme
 *   „erhitzt“ (`unconfirmed_heated`, Wächter N2c B1).
 *
 * Optionale Zutaten (S3) werden weggelassen statt das Rezept auszuschließen. Ersatz-Zutaten (S4) werden nur
 * genommen, wenn ihr `for_groups` alle verletzten Gruppen der Zutat abdeckt – und dann läuft der KOMPLETTE Filter
 * mit dem Ersatzprodukt erneut (Haferdrink bei Gluten → raus; laktosefreie Milch bei `dairy` → raus).
 * Am Ende prüft `computeRecipeFacts` das ganze Rezept noch einmal (Verteidigung in der Tiefe).
 */

export const RECIPE_EXCLUSION_REASONS = [
  'status',
  'red_issue',
  'food_unavailable',
  'nutrients_incomplete',
  'alcohol',
  'diet',
  'pork',
  'intolerance',
  'dislike',
  'pregnancy_caution',
] as const;
export type RecipeExclusionReason = (typeof RECIPE_EXCLUSION_REASONS)[number];

/** Gründe, aus denen ein (für die Person passendes) Rezept an einem Platz nicht verwendet wird. */
export const SLOT_EXCLUSION_REASONS = [
  'meal_type',
  'meal_prep_unsuitable',
  'prep_time',
  'competition',
  'not_no_cook',
] as const;
export type SlotExclusionReason = (typeof SLOT_EXCLUSION_REASONS)[number];

export interface RecipeFilterContext {
  readonly profile: MealPlanProfile;
  /** Ausschluss `pregnancy_caution` (aus `recipeExclusions` der Tagesziele). */
  readonly excludePregnancyCaution: boolean;
  /** Testmodus: Entwürfe erlaubt (ohne roten Befund, gekennzeichnet). Live: nur `published`. */
  readonly allowDrafts: boolean;
  /** Rezepte mit rotem Befund (aus `validateContent`); `selectNutritionContent` lässt sie schon weg. */
  readonly redRecipeIds?: ReadonlySet<string>;
}

export interface RecipeSubstitution {
  readonly index: number;
  readonly foodId: string;
  readonly substituteFoodId: string;
}

/** Ein für die Person passendes Rezept – ggf. ohne optionale Zutaten und mit Ersatzprodukten. */
export interface FilteredRecipe {
  readonly recipe: Recipe;
  /** Weggelassene OPTIONALE Zutaten (Indizes, S3). */
  readonly omitted: readonly number[];
  /** Ersatzprodukte (S4). */
  readonly substitutions: readonly RecipeSubstitution[];
  /** Angaben mit Weglassungen und Ersatz neu berechnet. */
  readonly facts: RecipeFacts;
}

export type RecipeFilterResult =
  | { readonly ok: true; readonly value: FilteredRecipe }
  | { readonly ok: false; readonly reasons: readonly RecipeExclusionReason[] };

type FoodViolation = 'diet' | 'pork' | 'intolerance' | 'dislike' | 'pregnancy_caution';

interface IngredientViolations {
  readonly kinds: ReadonlySet<FoodViolation>;
  /** Verletzte Gruppen (Unverträglichkeit/„mag ich nicht“). */
  readonly groups: readonly FoodGroupId[];
}

/** Gruppen, die für diese Person ausgeschlossen sind (Unverträglichkeit ∪ „mag ich nicht“). */
function excludedGroups(profile: MealPlanProfile): {
  intolerance: ReadonlySet<FoodGroupId>;
  dislike: ReadonlySet<FoodGroupId>;
} {
  return { intolerance: new Set(profile.intolerances), dislike: new Set(profile.dislikes) };
}

function foodViolations(
  food: Food,
  ctx: RecipeFilterContext,
  groups: ReturnType<typeof excludedGroups>,
): IngredientViolations {
  const kinds = new Set<FoodViolation>();
  const violated: FoodGroupId[] = [];
  if (!dietAllows(ctx.profile.diet, foodDiet(food))) kinds.add('diet');
  if (foodContainsPork(food) && ctx.profile.eatsPork !== true) kinds.add('pork');
  for (const group of food.groups) {
    if (groups.intolerance.has(group)) {
      kinds.add('intolerance');
      violated.push(group);
    } else if (groups.dislike.has(group)) {
      kinds.add('dislike');
      violated.push(group);
    }
  }
  return { kinds, groups: violated };
}

function foodUsable(food: Food | undefined, allowDrafts: boolean): food is Food {
  if (food === undefined || food.status === 'archived' || !isCatalogReviewed(food)) return false;
  return allowDrafts || food.status === 'published';
}

/**
 * Einzelnes Lebensmittel für die Person erlaubt (Ernährungsform, Schwein, Unverträglichkeit, „mag ich nicht“,
 * Schwangerschafts-Hinweis, Katalog-Prüfung)? Für Einträge, die nicht aus einem Rezept kommen (Einkaufsliste aus dem
 * Gerätespeicher, Wächter N5b K1). Sichere Richtung: unbekannt = nein.
 */
export function foodAllowedForPerson(food: Food | undefined, ctx: RecipeFilterContext): boolean {
  if (!foodUsable(food, ctx.allowDrafts)) return false;
  if (ctx.excludePregnancyCaution && food.pregnancy_caution) return false;
  return foodViolations(food, ctx, excludedGroups(ctx.profile)).kinds.size === 0;
}

/** Prüft das fertige Rezept (mit Weglassungen/Ersatz) gegen ALLE Regeln. Leere Liste = passt. */
function finalViolations(
  facts: RecipeFacts,
  ctx: RecipeFilterContext,
  groups: ReturnType<typeof excludedGroups>,
): RecipeExclusionReason[] {
  const reasons = new Set<RecipeExclusionReason>();
  if (!facts.nutrientsComplete || facts.missingFoods.length > 0)
    reasons.add('nutrients_incomplete');
  if (facts.alcohol) reasons.add('alcohol');
  if (!dietAllows(ctx.profile.diet, facts.diet)) reasons.add('diet');
  if (facts.containsPork && ctx.profile.eatsPork !== true) reasons.add('pork');
  for (const group of facts.allergens) {
    if (groups.intolerance.has(group)) reasons.add('intolerance');
    else if (groups.dislike.has(group)) reasons.add('dislike');
  }
  if (ctx.excludePregnancyCaution && facts.pregnancyCaution) reasons.add('pregnancy_caution');
  return RECIPE_EXCLUSION_REASONS.filter((reason) => reasons.has(reason));
}

/** Filtert ein Rezept für eine Person (Plan 6.1). */
export function filterRecipe(
  recipe: Recipe,
  foods: FoodLookup,
  ctx: RecipeFilterContext,
): RecipeFilterResult {
  if (recipe.status === 'archived' || (recipe.status === 'draft' && !ctx.allowDrafts)) {
    return { ok: false, reasons: ['status'] };
  }
  if (ctx.redRecipeIds?.has(recipe.id) === true) return { ok: false, reasons: ['red_issue'] };
  if (recipe.ingredients.some((i) => !foodUsable(foods.get(i.food_id), ctx.allowDrafts))) {
    return { ok: false, reasons: ['food_unavailable'] };
  }
  const groups = excludedGroups(ctx.profile);

  // Schwangerschafts-Gründe je Zutat (Katalog-Flag, ungegart, no_cook, unbestätigte Annahme) aus dem Core.
  const baseFacts = computeRecipeFacts(recipe, foods);
  const pregnancyIndices = new Set(
    ctx.excludePregnancyCaution ? baseFacts.pregnancyReasons.map((r) => r.index) : [],
  );

  const omitted: number[] = [];
  const substitutions: RecipeSubstitution[] = [];
  const blocking = new Set<RecipeExclusionReason>();

  recipe.ingredients.forEach((ingredient, index) => {
    const food = foods.get(ingredient.food_id) as Food;
    const own = foodViolations(food, ctx, groups);
    const kinds = new Set(own.kinds);
    if (pregnancyIndices.has(index)) kinds.add('pregnancy_caution');
    if (food.alcohol) {
      // Alkohol (R12) lässt sich weder weglassen noch ersetzen – das Rezept ist ungültig.
      blocking.add('alcohol');
      return;
    }
    if (kinds.size === 0) return;
    if (ingredient.optional) {
      omitted.push(index);
      return;
    }
    // Ersatz nur für Gruppen-Verletzungen (Unverträglichkeit/„mag ich nicht“), mit passendem `for_groups`.
    const onlyGroups = [...kinds].every((k) => k === 'intolerance' || k === 'dislike');
    const substitute = onlyGroups
      ? food.substitutes.find((sub) => {
          if (!own.groups.every((g) => sub.for_groups.includes(g))) return false;
          const subFood = foods.get(sub.food_id);
          if (!foodUsable(subFood, ctx.allowDrafts) || subFood.alcohol) return false;
          // Kompletter Filter mit dem Ersatzprodukt (S4).
          if (foodViolations(subFood, ctx, groups).kinds.size > 0) return false;
          if (ctx.excludePregnancyCaution) {
            const trial = computeRecipeFacts(recipe, foods, {
              substitutions: new Map([[index, sub.food_id]]),
            });
            if (trial.pregnancyReasons.some((r) => r.index === index)) return false;
          }
          return true;
        })
      : undefined;
    if (substitute !== undefined) {
      substitutions.push({ index, foodId: food.id, substituteFoodId: substitute.food_id });
      return;
    }
    for (const kind of kinds) blocking.add(kind);
  });

  if (blocking.size > 0) {
    return { ok: false, reasons: RECIPE_EXCLUSION_REASONS.filter((r) => blocking.has(r)) };
  }
  const facts = computeRecipeFacts(recipe, foods, {
    omitted: new Set(omitted),
    substitutions: new Map(substitutions.map((s) => [s.index, s.substituteFoodId])),
  });
  const reasons = finalViolations(facts, ctx, groups);
  if (reasons.length > 0) return { ok: false, reasons };
  return { ok: true, value: { recipe, omitted, substitutions, facts } };
}

/** Mahlzeiten-Typ eines Platzes (Plan 6.1 „`meal_types` passt zum Slot“, 19.6 K7). */
export function mealTypeForSlot(slot: MealSlotId): MealType {
  if (slot === 'breakfast') return 'breakfast';
  if (slot === 'lunch' || slot === 'dinner' || slot === 'main') return 'main';
  return 'snack';
}

export interface SlotFitOptions {
  readonly slot: MealSlotId;
  /** Platz wird vorgekocht → `meal_prep.suitable` nötig. */
  readonly mealPrep?: boolean;
  /** Werktags-Zeitlimit in Minuten (null = keins). */
  readonly maxMinutes?: number | null;
  /** Ergänzungs-Snack: `no_cook` + `snack` nötig (Plan 6.2). */
  readonly fill?: boolean;
}

/**
 * Passt ein (für die Person zugelassenes) Rezept an diesen Platz? Wettkampf-Rezepte (Kategorie `wettkampf`)
 * kommen nie automatisch in den Wochenplan (19.6, W1 mit Phase 10).
 */
export function slotFitReasons(recipe: Recipe, options: SlotFitOptions): SlotExclusionReason[] {
  const reasons: SlotExclusionReason[] = [];
  const type = options.fill === true ? 'snack' : mealTypeForSlot(options.slot);
  if (!recipe.meal_types.includes(type)) reasons.push('meal_type');
  if (options.mealPrep === true && !recipe.meal_prep.suitable) reasons.push('meal_prep_unsuitable');
  if (
    options.maxMinutes !== undefined &&
    options.maxMinutes !== null &&
    recipeTotalMinutes(recipe) > options.maxMinutes
  ) {
    reasons.push('prep_time');
  }
  if (recipe.categories?.includes('wettkampf') === true) reasons.push('competition');
  if (options.fill === true && !recipe.no_cook) reasons.push('not_no_cook');
  return reasons;
}

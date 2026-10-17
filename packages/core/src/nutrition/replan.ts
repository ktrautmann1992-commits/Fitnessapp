import { isoDateSchema } from '../age';
import {
  buildMealPlanWeek,
  CandidatePool,
  daySafetyKey,
  daySafetyKeyWithoutWeightGoal,
  dayWithinPlanBand,
  type MealPlanInput,
  type MealPlanWeek,
  mealPlanBand,
  variantForMeal,
} from './meal-plan';
import { leftoverKeeps, mealPrepKeeping } from './meal-prep';
import { rebuildShoppingList, type ShoppingList } from './shopping-list';

/**
 * Automatische Neuplanung bei Moduswechsel (docs/PLAN-PHASE-5.md 6.6, S7, R2-S4). Läuft bei jedem Öffnen von
 * „Heute“/„Ernährung“ und nach Änderungen an Gesundheits-Check, Körperdaten, Einwilligung oder Vorlieben. Es wird
 * nichts gespeichert: Die Ziele werden neu gerechnet und mit dem Plan verglichen. Vergangene Tage bleiben.
 */

export const REPLAN_REASONS = [
  'mode_changed',
  'caps_changed',
  'out_of_band',
  'recipe_excluded',
  'leftover_expired',
  /** Konkretes Abnehmziel neu, geändert, erreicht, abgelaufen oder entfernt (docs/PLAN-ZIELE.md 4.6, Etappe Z5). */
  'weight_goal_changed',
] as const;
export type ReplanReason = (typeof REPLAN_REASONS)[number];

export interface ReplanCheck {
  readonly needed: boolean;
  readonly reasons: readonly ReplanReason[];
  /** Ab diesem Tag wird neu geplant (heute); null, wenn nichts nötig ist. */
  readonly fromDate: string | null;
}

type ReplanInput = Omit<MealPlanInput, 'existingPlan' | 'variant'>;

/**
 * Muss der Plan ab heute automatisch neu geplant werden (6.6)? Ja, wenn sich an einem Tag ab heute der Modus oder
 * die Deckel geändert haben (neues Flag, 18./65. Geburtstag, BMI-Klasse, Check nachgeholt, Widerruf), eine
 * Tagessumme außerhalb des aktuellen Planbands liegt, ein Rezept den Filter nicht mehr besteht (neue
 * Unverträglichkeit/Abneigung, Schwangerschaft) oder ein Rest nicht mehr hält (`leftover_expired`, K-a).
 */
export function needsAutomaticReplan(plan: MealPlanWeek, input: ReplanInput): ReplanCheck {
  const today = isoDateSchema.parse(input.today);
  const pool = new CandidatePool(
    input.recipes,
    input.foods,
    input.profile,
    input.allowDrafts,
    input.redRecipeIds,
    input.substitutions,
  );
  const reasons = new Set<ReplanReason>();
  for (const day of plan.days) {
    if (day.date < today) continue;
    const targets = input.targets.days.find((d) => d.date === day.date);
    if (targets === undefined) continue;
    if (targets.mode !== day.mode) reasons.add('mode_changed');
    else {
      const key = daySafetyKey(targets);
      if (key !== day.safetyKey) {
        reasons.add(
          daySafetyKeyWithoutWeightGoal(key) === daySafetyKeyWithoutWeightGoal(day.safetyKey)
            ? 'weight_goal_changed'
            : 'caps_changed',
        );
      }
    }
    // Genau die Garantie von `buildMealPlanWeek` (Wächter N3 NB1, B2): sonst plante jeder frische Plan sofort neu.
    if (!dayWithinPlanBand(day, mealPlanBand(targets))) reasons.add('out_of_band');
    const exclude = targets.recipeExclusions.includes('pregnancy_caution');
    for (const meal of day.meals) {
      const recipe = input.recipes.find(
        (r) => r.id === meal.recipeId && r.version === meal.recipeVersion,
      );
      // Mit den getauschten Zutaten der Mahlzeit (19.7 N9): Ein Tausch besteht den Filter erneut – sonst Neuplanung.
      const result =
        recipe === undefined ? null : pool.result(recipe, exclude, meal.ingredientSwaps);
      const variant =
        result !== null && result.ok ? variantForMeal(result.value, meal, input.foods) : null;
      if (variant === null) reasons.add('recipe_excluded');
      // Reste nur, solange sie halten (Kochtag + Haltbarkeit ≥ Tag, Wächter N5a K-a): Ein veränderter
      // Gerätespeicher darf keine Reste über die Kühlschrank-Haltbarkeit hinaus zeigen.
      else if (!leftoverKeeps(meal, day.date, mealPrepKeeping(variant, input.foods))) {
        reasons.add('leftover_expired');
      }
    }
  }
  const list = [...reasons].sort();
  return { needed: list.length > 0, reasons: list, fromDate: list.length > 0 ? today : null };
}

/**
 * Automatische Neuplanung ab heute (6.6) – erzeugt im SELBEN Schritt die Einkaufsliste ab heute neu (R2-S4,
 * Zeitraum `max(von, heute)` bis zum bisherigen Ende): Häkchen bleiben
 * über `item_key`, weggefallene abgehakte Einträge „nicht mehr im Plan“, weggefallene offene entfernt, eigene
 * Einträge unverändert.
 */
export function automaticReplan(
  plan: MealPlanWeek,
  shoppingList: ShoppingList | null,
  input: ReplanInput,
): { readonly plan: MealPlanWeek; readonly shoppingList: ShoppingList | null } {
  const next = buildMealPlanWeek({
    ...input,
    existingPlan: plan,
    variant: plan.variant,
  });
  if (shoppingList === null) return { plan: next, shoppingList: null };
  // Nur ab heute neu erzeugen (Wächter N3 B1): Einträge aus Käufen vor heute bleiben nicht offen stehen – sonst
  // stünden nach „schwanger = ja“ z. B. Räucherlachs oder Salami weiter offen auf der Liste. Abgehakte bleiben mit
  // „nicht mehr im Plan“, eigene Einträge unverändert.
  const today = isoDateSchema.parse(input.today);
  if (today > shoppingList.to) return { plan: next, shoppingList };
  const from = shoppingList.from > today ? shoppingList.from : today;
  return {
    plan: next,
    shoppingList: rebuildShoppingList(shoppingList, next, input.foods, {
      from,
      to: shoppingList.to,
    }),
  };
}

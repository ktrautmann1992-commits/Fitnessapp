import { z } from 'zod';

import { MEAL_SLOT_TIMES, NEXT_MEAL_GRACE_MINUTES } from '../constants';
import { foodRuleTexts, matchWordRule, type WordRule } from '../content/allergen-rules';
import type { Food } from '../content/food-schema';
import type { FoodGroupId } from '../food-groups';
import type { MealPlanSlotKey, PlannedMeal, PlannedMealDay } from './meal-plan';
import type { RecipeFacts } from './recipe-nutrients';
import type { NutritionWeekTargets } from './targets';

/**
 * Anzeige-Logik der Ernährung in der App (docs/PLAN-PHASE-5.md 8.1, 8.2, Etappe N4) – rein und getestet, damit die
 * Bildschirme keine Fachlogik enthalten: Reihenfolge der Mahlzeiten, nächste Mahlzeit, Kochtag, Kurz-Zusammenfassung
 * der Wochenziele („Trainingstag ca. … kcal“) und „Enthält: …“ inkl. Kokos (K11).
 * Rechnet KEINE Ziele und keine Grenzen – alle Zahlen kommen fertig aus `nutritionTargetsForWeek` bzw.
 * `buildMealPlanWeek` (einzige Stelle der Schutzgrenzen: `clampCalorieTarget`).
 */

/** Ergänzungs-Snacks haben keine eigene Uhrzeit – sie stehen am Ende des Tages. */
const EXTRA_SLOT_MINUTES: Readonly<Record<'extra_1' | 'extra_2', number>> = {
  extra_1: 24 * 60 - 2,
  extra_2: 24 * 60 - 1,
};

/** Standard-Uhrzeit eines Platzes in Minuten nach Mitternacht (Ergänzungen am Ende). */
export function mealSlotMinutes(slot: MealPlanSlotKey): number {
  return slot === 'extra_1' || slot === 'extra_2'
    ? EXTRA_SLOT_MINUTES[slot]
    : MEAL_SLOT_TIMES[slot];
}

/** Mahlzeiten eines Tages in zeitlicher Reihenfolge (stabil). */
export function mealsInDayOrder(day: Pick<PlannedMealDay, 'meals'>): PlannedMeal[] {
  return day.meals
    .map((meal, index) => ({ meal, index }))
    .sort(
      (a, b) => mealSlotMinutes(a.meal.slot) - mealSlotMinutes(b.meal.slot) || a.index - b.index,
    )
    .map(({ meal }) => meal);
}

const minutesSchema = z
  .number()
  .int()
  .min(0)
  .max(24 * 60);

/**
 * Nächste Mahlzeit ab `nowMinutes` (Minuten nach Mitternacht): die erste, deren Uhrzeit höchstens
 * `NEXT_MEAL_GRACE_MINUTES` zurückliegt; null = alle Mahlzeiten des Tages liegen hinter uns (oder keine).
 */
export function nextMealOfDay(
  day: Pick<PlannedMealDay, 'meals'>,
  nowMinutes: number,
): PlannedMeal | null {
  const now = minutesSchema.parse(nowMinutes);
  return (
    mealsInDayOrder(day).find(
      (meal) => mealSlotMinutes(meal.slot) + NEXT_MEAL_GRACE_MINUTES > now,
    ) ?? null
  );
}

/** Mahlzeiten, die an diesem Tag für mehrere Tage vorgekocht werden (Meal-Prep-Kochtag). */
export function cookDayMeals(day: Pick<PlannedMealDay, 'meals'>): PlannedMeal[] {
  return mealsInDayOrder(day).filter((meal) => meal.prepKind === 'cook');
}

export interface KcalRange {
  readonly min: number;
  readonly max: number;
}

export interface WeekEnergySummary {
  /** Tagesziele an Tagen mit Training (kleinstes und größtes); null = kein solcher Tag mit Ziel. */
  readonly trainingDay: KcalRange | null;
  /** Tagesziele an Ruhetagen; null = kein solcher Tag mit Ziel. */
  readonly restDay: KcalRange | null;
  /** true = mindestens ein Tag ohne Zahlen (`no_targets`) – dann keine Zahl für diese Tage anzeigen. */
  readonly hasDaysWithoutTargets: boolean;
}

/**
 * Kurz-Zusammenfassung für den „Fertig“-Bildschirm (8.1): „Trainingstag ca. 2.150 kcal, Ruhetag ca. 1.950 kcal“.
 * Nimmt die fertig gerundeten Tagesziele unverändert (kein neues Runden, damit keine Zahl unter einer Grenze landet).
 */
export function weekEnergySummary(week: Pick<NutritionWeekTargets, 'days'>): WeekEnergySummary {
  const range = (values: number[]): KcalRange | null =>
    values.length === 0 ? null : { min: Math.min(...values), max: Math.max(...values) };
  const training: number[] = [];
  const rest: number[] = [];
  let hasDaysWithoutTargets = false;
  for (const day of week.days) {
    if (day.targetKcal === null) {
      hasDaysWithoutTargets = true;
      continue;
    }
    (day.sessions.length > 0 ? training : rest).push(day.targetKcal);
  }
  return { trainingDay: range(training), restDay: range(rest), hasDaysWithoutTargets };
}

/**
 * Kokos (K11, Frage 16 B (k)): nach LMIV keine Schalenfrucht (`tree_nuts`), wird aber unter „Enthält“ ausdrücklich
 * genannt. Erkennung über Wortteile wie R18 (`allergen-rules.ts`): „Kokosmilch“, „Kokosraspeln“, „Kokosöl“.
 */
export const COCONUT_RULE: WordRule = { words: ['kokos', 'kokosnuss'], negatives: [] };

export function foodContainsCoconut(
  food: Pick<Food, 'name_de' | 'name_de_plural' | 'aliases_de' | 'source'>,
): boolean {
  return (
    matchWordRule(foodRuleTexts({ ...food, animal: [], meat_kind: [], groups: [] }), COCONUT_RULE)
      .length > 0
  );
}

export interface RecipeContains {
  /** Gruppen aus den Zutaten (inkl. optionaler), Reihenfolge wie FOOD_GROUPS. */
  readonly groups: readonly FoodGroupId[];
  /** Kokos ausdrücklich nennen (K11). */
  readonly coconut: boolean;
}

/**
 * „Enthält: …“ (8.2 Nr. 4): die berechneten Gruppen des Rezepts (mit Weglassungen und Ersatz, inkl. optionaler
 * Zutaten) plus Kokos aus den tatsächlich verwendeten Lebensmitteln.
 */
export function recipeContains(
  facts: Pick<RecipeFacts, 'allergens'>,
  usedFoods: readonly Pick<Food, 'name_de' | 'name_de_plural' | 'aliases_de' | 'source'>[],
): RecipeContains {
  return {
    groups: [...facts.allergens],
    coconut: usedFoods.some((food) => foodContainsCoconut(food)),
  };
}

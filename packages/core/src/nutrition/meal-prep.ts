import { z } from 'zod';

import { MEAL_PREP_COOK_OFFSETS, MEAL_PREP_FRIDGE_DAYS, NUTRITION_LIMITS } from '../constants';
import type { FoodLookup } from '../content/food-schema';
import { addDays, daysBetween } from '../dates';
import type { FilteredRecipe } from './filter';
import type { MealprepSlotMode } from './schemas';
import type { MealSlotId } from './timing';

/**
 * Meal-Prep im Wochenplan (docs/PLAN-PHASE-5.md 6.4, S12, R9): Kochtermine je `mealprep_days`, welche Plätze
 * vorgekocht werden und wie lange ein Gericht hält. Rein, ohne Auswahl-Logik (die steckt in `meal-plan.ts`).
 *
 * Haltbarkeit (R9, sichere Richtung): Kühlschrank höchstens min(`meal_prep.fridge_days` des Rezepts, kleinste
 * `max_fridge_days` der tatsächlich verwendeten Zutaten inkl. Ersatzprodukten, 3 Tage). Reis, Fisch, Hackfleisch
 * und Geflügel halten damit 1 Tag. Länger nur eingefroren – und nur, wenn Rezept UND alle Zutaten einfrierbar
 * sind; sonst wird an diesen Tagen frisch gekocht.
 */

export interface CookEvent {
  /** Tag relativ zum Montag (−1 = Sonntag davor). */
  readonly offset: number;
  readonly cookDate: string;
  /** Abgedeckte Tage der Woche (0 = Montag … 6 = Sonntag). */
  readonly dayIndices: readonly number[];
}

const mealprepDaysSchema = z
  .number()
  .int()
  .min(NUTRITION_LIMITS.mealPrepDaysPerWeek.min)
  .max(NUTRITION_LIMITS.mealPrepDaysPerWeek.max);

/**
 * Kochtermine der Woche (Plan 6.4, `MEAL_PREP_COOK_OFFSETS`). Ein Termin deckt die Tage ab seinem Kochtag (bzw.
 * ab Montag beim Sonntag davor) bis zum Tag vor dem nächsten Termin.
 */
export function mealPrepCookEvents(weekStart: string, mealprepDays: number): CookEvent[] {
  const count = mealprepDaysSchema.parse(mealprepDays) as keyof typeof MEAL_PREP_COOK_OFFSETS;
  const offsets: readonly number[] = MEAL_PREP_COOK_OFFSETS[count];
  return offsets.map((offset, i) => {
    const from = Math.max(offset, 0);
    const next = offsets[i + 1];
    const to = next === undefined ? 6 : Math.max(next, 0) - 1;
    const dayIndices: number[] = [];
    for (let d = from; d <= to; d += 1) dayIndices.push(d);
    return { offset, cookDate: addDays(weekStart, offset), dayIndices };
  });
}

/** Vorgekochte Plätze (Plan 6.4): Mittag bzw. Mittag + Abend; bei 1 Mahlzeit die Hauptmahlzeit. */
export function mealPrepSlots(mode: MealprepSlotMode): readonly MealSlotId[] {
  return mode === 'lunch_dinner' ? ['main', 'lunch', 'dinner'] : ['main', 'lunch'];
}

export interface MealPrepKeeping {
  /** Tage im Kühlschrank nach dem Kochtag (R9). */
  readonly fridgeDays: number;
  /** Einfrieren erlaubt (Rezept und alle verwendeten Zutaten). */
  readonly freezable: boolean;
}

/** Haltbarkeit eines Gerichts mit den TATSÄCHLICH verwendeten Zutaten (Ersatz, Weglassen; S12, R9). */
export function mealPrepKeeping(variant: FilteredRecipe, foods: FoodLookup): MealPrepKeeping {
  const { recipe } = variant;
  if (!recipe.meal_prep.suitable) return { fridgeDays: 0, freezable: false };
  const omitted = new Set(variant.omitted);
  const subs = new Map(variant.substitutions.map((s) => [s.index, s.substituteFoodId]));
  let foodsFreezable = true;
  recipe.ingredients.forEach((ingredient, index) => {
    if (omitted.has(index)) return;
    const food = foods.get(subs.get(index) ?? ingredient.food_id);
    foodsFreezable &&= food?.freezable === true;
  });
  return {
    fridgeDays: Math.max(
      0,
      Math.min(
        recipe.meal_prep.fridge_days,
        variant.facts.maxFridgeDays ?? 0,
        MEAL_PREP_FRIDGE_DAYS.max,
      ),
    ),
    freezable: recipe.meal_prep.freezable && foodsFreezable,
  };
}

export type MealPrepDayUse = 'cook' | 'fridge' | 'freeze' | 'fresh';

/**
 * Was an einem Tag mit einem vorgekochten Gericht passiert (Plan 6.4, R9): am Kochtag frisch gekocht, danach aus
 * dem Kühlschrank, solange es hält, dann eingefroren (nur einfrierbar) oder frisch gekocht.
 */
export function mealPrepDayUse(keeping: MealPrepKeeping, daysAfterCook: number): MealPrepDayUse {
  if (daysAfterCook <= 0) return 'cook';
  if (daysAfterCook <= keeping.fridgeDays) return 'fridge';
  return keeping.freezable ? 'freeze' : 'fresh';
}

/**
 * Hält ein Rest an `date` noch (Wächter N5a Nachprüfung K-a, R9)? Kühlschrank: Kochtag + Haltbarkeit ≥ Tag (und der
 * Kochtag liegt davor); eingefroren: nur, wenn das Gericht mit den verwendeten Zutaten einfrierbar ist. Ein Rest ohne
 * Aufbewahrung gilt als ungültig. Andere Mahlzeiten (`cook`, `fresh`) halten immer. Sichere Richtung: Im Zweifel nein
 * – dann wird ab heute neu geplant.
 */
export function leftoverKeeps(
  meal: { readonly prepKind: string; readonly cookDate: string; readonly storage: string | null },
  date: string,
  keeping: MealPrepKeeping,
): boolean {
  if (meal.prepKind !== 'leftover') return true;
  const days = daysBetween(meal.cookDate, date);
  if (days < 1) return false;
  if (meal.storage === 'fridge') return days <= keeping.fridgeDays;
  if (meal.storage === 'freeze') return keeping.freezable;
  return false;
}

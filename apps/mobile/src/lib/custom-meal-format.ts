import {
  type CustomMeal,
  type CustomMealBuildError,
  type CustomMealValues,
  entryFromCustomMeal,
  type FoodLogEntry,
} from '@fitnessapp/core';

import { t } from '@/i18n';
import type { HealthConsentStatus } from '@/state/flow';

import { entryDetailText } from './food-log-format';
import { formatGrams, formatKcal } from './nutrition-format';

/**
 * Anzeige eigener Gerichte (Etappe E2): nur Formatierung – keine Rechnung (Werte kommen aus packages/core). Bei
 * „Kalorienzahlen aus“ (showNumbers = false) erscheint nirgends eine kcal-Zahl. Fehlertexte ohne Namen und ohne Werte.
 */

/** Detailzeile: „Aus 3 Zutaten · ergibt 2 Portionen · je Portion 465 kcal“ (kcal nur mit Zahlen). */
export function customMealDetailText(
  meal: Pick<CustomMeal, 'mode' | 'servings' | 'kcal' | 'items'>,
  showNumbers: boolean,
): string {
  const parts: string[] =
    meal.mode === 'ingredients'
      ? [t.customMeals.fromItems(meal.items.length), t.customMeals.makesServings(meal.servings)]
      : [meal.kcal === null ? t.customMeals.withoutValues : t.customMeals.directMade];
  if (showNumbers && meal.kcal !== null) {
    parts.push(t.customMeals.perServing(t.foodLog.kcal(formatKcal(meal.kcal))));
  }
  return parts.join(' · ');
}

/** Werte je Portion (nur mit Zahlen): „465 kcal · Eiweiß 16,3 g · Kohlenhydrate 69,1 g · Fett 11,7 g“. */
export function customMealValuesText(values: CustomMealValues): string {
  return [
    t.foodLog.kcal(formatKcal(values.kcal)),
    t.foodLog.macros(
      `${formatGrams(values.protein_g)} g`,
      `${formatGrams(values.carbs_g)} g`,
      `${formatGrams(values.fat_g)} g`,
    ),
  ].join(' · ');
}

/** Text zu einem nicht baubaren Gericht – nie mit Namen oder Zahl. */
export function customMealBuildErrorText(reason: CustomMealBuildError): string {
  switch (reason) {
    case 'name':
      return t.customMeals.nameInvalid;
    case 'values':
      return t.customMeals.kcalInvalid;
    case 'servings':
      return t.customMeals.servingsInvalid;
    case 'items':
      return t.customMeals.itemsInvalid;
    case 'amount':
      return t.foodLog.amountRange;
    case 'unit':
      return t.foodLog.pieceUnavailable;
    case 'missing_food':
      return t.customMeals.missingFood;
    case 'too_much':
      return t.customMeals.tooMuch;
    case 'invalid':
      return t.customMeals.errors.rejected;
  }
}

/**
 * Detailzeile unter „Zuletzt“ (Wächter E2 H2): Für ein eigenes Gericht zeigt sie, was ein Tipp TATSÄCHLICH einträgt –
 * das aktuelle Gericht × die zuletzt gewählte Portion (dieselbe Rechnung wie beim Eintragen, `entryFromCustomMeal`),
 * nicht den alten Schnappschuss. Sonst wie bisher die Werte des Eintrags.
 */
export function recentDetailText(
  item: FoodLogEntry,
  meals: readonly CustomMeal[],
  showNumbers: boolean,
): string {
  if (item.source === 'custom_meal' && item.portion !== null) {
    const meal = meals.find((m) => m.id === item.custom_meal_id);
    const built = meal
      ? entryFromCustomMeal(meal, item.portion, {
          id: item.id,
          date: item.eaten_on,
          slot: item.slot,
        })
      : null;
    if (built?.ok) return entryDetailText(built.entry, showNumbers);
  }
  return entryDetailText(item, showNumbers);
}

/**
 * Was „Eigene Gerichte“ anbietet (Wächter E2 S2): mit gültiger Einwilligung alles; ohne (fehlt oder veraltet) nur
 * Löschen – das geht immer (Recht auf Löschung), Anlegen, Ändern und Eintragen nicht.
 */
export function customMealAccess(consent: HealthConsentStatus): { edit: boolean; delete: true } {
  return { edit: consent === 'valid', delete: true };
}

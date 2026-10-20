import type { CalorieRing, MacroProgress, MealCardGroup } from '@fitnessapp/core';

import { t } from '@/i18n';
import { formatGrams, formatKcal } from '@/lib/nutrition-format';

/**
 * Texte der Tagesübersicht Ernährung (Kalorien-Ring, Makro-Balken, Mahlzeiten-Karten). Nur Formulierung – alle Zahlen
 * (übrig, zu viel, Anteile, Ziele je Mahlzeit) kommen fertig aus packages/core (`nutrition/day-ring.ts`).
 */

export interface RingCenterText {
  /** Große Zahl in der Mitte. */
  readonly value: string;
  /** Wort darunter („übrig“, „zu viel“, „erreicht“, „Tagesziel“). */
  readonly label: string;
  /** Ansage für den Bildschirmleser – in Worten, nie nur über die Farbe. */
  readonly a11y: string;
}

/** Mitte des Rings. `future` = künftiger Tag: nur das Ziel, noch nichts gegessen. */
export function ringCenterText(
  ring: Extract<CalorieRing, { kind: 'ring' }>,
  future: boolean,
): RingCenterText {
  const target = formatKcal(ring.targetKcal);
  const eaten = formatKcal(ring.eatenKcal);
  const a11y = t.nutritionDay.ringA11y;
  if (future) {
    return { value: target, label: t.nutritionDay.dayGoal, a11y: a11y.future(target) };
  }
  if (ring.state === 'over') {
    const over = formatKcal(ring.overKcal);
    return { value: over, label: t.nutritionDay.over, a11y: a11y.over(over, target, eaten) };
  }
  if (ring.state === 'reached') {
    return { value: '0', label: t.nutritionDay.left, a11y: a11y.reached(target) };
  }
  const left = formatKcal(ring.remainingKcal);
  return { value: left, label: t.nutritionDay.left, a11y: a11y.open(left, target, eaten) };
}

/** „47 / 222 g“ und die Ansage dazu. */
export function macroText(
  label: string,
  macro: MacroProgress,
): { readonly value: string; readonly a11y: string } {
  const eaten = formatGrams(macro.eatenG);
  const target = formatGrams(macro.targetG);
  return {
    value: t.nutritionDay.macroValue(eaten, target),
    a11y: t.nutritionDay.macroA11y(label, eaten, target),
  };
}

/** Titel einer Karte; bei nur einer Mahlzeit am Tag heißt „Mittagessen“ wie im Plan „Hauptmahlzeit“. */
export function mealCardTitle(group: MealCardGroup, mainOnly: boolean): string {
  if (group === 'lunch' && mainOnly) return t.nutritionDay.cards.main;
  return t.nutritionDay.cards[group];
}

/** Kalorienzeile einer Karte: „317 / 606 kcal“ bzw. ohne Ziel „317 kcal“, mit Ansage. */
export function mealCardKcalText(
  title: string,
  eatenKcal: number,
  targetKcal: number | null,
): { readonly value: string; readonly a11y: string } {
  const eaten = formatKcal(eatenKcal);
  if (targetKcal === null) {
    return {
      value: t.nutritionDay.cardKcalOnly(eaten),
      a11y: t.nutritionDay.cardA11yNoTarget(title, eaten),
    };
  }
  const target = formatKcal(targetKcal);
  return {
    value: t.nutritionDay.cardKcal(eaten, target),
    a11y: t.nutritionDay.cardA11y(title, eaten, target),
  };
}

/** Vorschau der Einträge einer Karte: höchstens drei Titel, Rest als „…“. */
export function mealCardPreview(titles: readonly string[]): string {
  if (titles.length === 0) return t.nutritionDay.cardEmpty;
  const shown = titles.slice(0, 3).join(', ');
  return titles.length > 3 ? `${shown} …` : shown;
}

import {
  FOOD_PRODUCT_BLOCKING_REASONS,
  type FoodProductCheckReason,
  isoDateInTimeZone,
  type ProductPer100,
} from '@fitnessapp/core';

import { t } from '@/i18n';

import { formatDateDe } from './format';
import { formatKcal, formatNumberDe } from './nutrition-format';

/**
 * Anzeige der Produktabfrage (Etappe E4a): nur Formatierung, keine Rechnung (Werte und Prüfung kommen aus
 * packages/core). Fehlende Werte erscheinen als „–“, nie als 0 (Plan 2.2). Bei „Kalorienzahlen aus“ keine Zahlen.
 */

export const PER100_ROWS = [
  'kcal',
  'protein_g',
  'carbs_g',
  'sugar_g',
  'fat_g',
  'sat_fat_g',
  'fiber_g',
  'salt_g',
] as const satisfies readonly (keyof ProductPer100)[];

/** Wert einer Zeile der Nährwert-Tabelle, z. B. „380 kcal“, „13,5 g“, fehlend „–“. */
export function per100Text(key: keyof ProductPer100, value: number | null): string {
  if (value === null) return t.foodProduct.missingValue;
  return key === 'kcal' ? `${formatKcal(value)} kcal` : `${formatNumberDe(value)} g`;
}

/** Datum (Europe/Berlin) eines Zeitpunkts als „17.10.2026“. */
export function productDateText(timestamp: string): string {
  try {
    return formatDateDe(isoDateInTimeZone(timestamp));
  } catch {
    return '';
  }
}

/** Menge mit Einheit, z. B. „30 g“, „250 ml“. */
export function productAmountText(amount: number, unit: 'g' | 'ml'): string {
  return `${formatNumberDe(amount)} ${unit}`;
}

/**
 * Hinweise zur Prüfung (Plan 2.1/4.4): mit Zahlen die einzelnen Gründe, ohne Zahlen („Zahlen aus“) nur ein Satz ohne
 * Nährwert-Namen.
 */
export function productCheckHints(
  level: 'ok' | 'review' | 'blocked',
  reasons: readonly FoodProductCheckReason[],
  showNumbers: boolean,
): string[] {
  if (!showNumbers) {
    if (level === 'blocked') return [t.foodProduct.blockedNoNumbers];
    if (level === 'review') return [t.foodProduct.reviewNoNumbers];
    return [];
  }
  const blocking = new Set<string>(FOOD_PRODUCT_BLOCKING_REASONS);
  return reasons
    .filter((r) => (level === 'blocked' ? blocking.has(r) : !blocking.has(r)))
    .map((r) => t.foodProduct.reasons[r]);
}

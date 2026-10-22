import {
  FOOD_PRODUCT_BLOCKING_REASONS,
  type FoodProductCheckReason,
  isoDateInTimeZone,
  type ProductPer100,
  type ScanNutrition,
} from '@fitnessapp/core';

import { t } from '@/i18n';

import { formatDateDe } from './format';
import { formatKcal, formatNumberDe, nutrientSourcesText } from './nutrition-format';

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

/** Kompakte Nährwert-Karte beim Scannen im Laden: Energie, Eiweiß, Kohlenhydrate, davon Zucker, Fett, Salz. */
export const SCAN_PER100_ROWS = [
  'kcal',
  'protein_g',
  'carbs_g',
  'sugar_g',
  'fat_g',
  'salt_g',
] as const satisfies readonly (typeof PER100_ROWS)[number][];

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

/** Anzeige der Nährwert-Karte im Einkaufs-Scanner (nur Texte und Schalter, die Auswahl kommt aus packages/core). */
export interface ScanNutritionView {
  readonly title: string;
  /** Zahlen zeigen? Nein bei „Kalorienzahlen aus“ und bei gesperrten Produktdaten. */
  readonly showValues: boolean;
  /** „Nährwerte ausgeblendet (…)“ bei „Kalorienzahlen aus“. */
  readonly hiddenNote: string | null;
  readonly notice: { readonly kind: 'blocked' | 'review'; readonly text: string } | null;
  /** Testmodus-Hinweis (Attrappe mit Testwerten). */
  readonly mockNote: string | null;
  /** Quellenangabe bzw. „Deine Angaben“. */
  readonly sourceText: string;
  /** Link „Mehr zur Lizenz“ (Pflicht bei Daten von Open Food Facts). */
  readonly licenseLink: boolean;
}

/**
 * Regeln wie in der Produktansicht (`ProductCard`): gesperrt → keine Zahlen, nur Hinweis; prüfen → Zahlen mit Hinweis
 * „bitte prüfen“; „Kalorienzahlen aus“ → nie Zahlen; Quellenangabe Open Food Facts (ODbL) mit Lizenz-Link bzw. BLS
 * (Testwerte bei Beispiel-Inhalten) bzw. „Deine Angaben“.
 */
export function scanNutritionView(
  nutrition: ScanNutrition,
  showNumbers: boolean,
  demoFoods: boolean,
): ScanNutritionView {
  const s = t.nutrition.shopping.scan;
  const blocked = nutrition.source === 'product' && nutrition.check.level === 'blocked';
  const review = nutrition.source === 'product' && nutrition.check.level === 'review';
  const notice: ScanNutritionView['notice'] = blocked
    ? {
        kind: 'blocked',
        text: showNumbers ? t.foodProduct.blocked : t.foodProduct.blockedNoNumbers,
      }
    : review
      ? { kind: 'review', text: showNumbers ? s.nutritionReview : t.foodProduct.reviewNoNumbers }
      : null;
  let sourceText: string;
  switch (nutrition.source) {
    case 'product':
      sourceText = t.foodProduct.source(productDateText(nutrition.retrievedAt));
      break;
    case 'own':
      sourceText = s.nutritionOwn;
      break;
    case 'catalog':
      sourceText = demoFoods
        ? t.nutrition.demoSource
        : (nutrientSourcesText([nutrition.foodSource]) ?? '');
  }
  return {
    title: s.nutritionTitle(nutrition.baseUnit),
    showValues: showNumbers && !blocked,
    hiddenNote: showNumbers ? null : t.foodProduct.numbersHidden,
    notice,
    mockNote: nutrition.source === 'product' && nutrition.mock ? t.foodProduct.mockNote : null,
    sourceText,
    licenseLink: nutrition.source === 'product',
  };
}

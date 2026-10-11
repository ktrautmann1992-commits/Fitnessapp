import { z } from 'zod';

import { AMOUNT_ROUNDING, PINCH_G } from '../constants';

/**
 * Einheiten der Rezept-Zutaten (docs/PLAN-PHASE-5.md 4.1 `units.ts`, 5.2, 6.2): Gramm, Milliliter, Stück,
 * Esslöffel, Teelöffel, Prise. Umrechnung in Gramm über die Angaben des Lebensmittels (`units` im Katalog).
 * Neue Aufzählungen bleiben bis Etappe N7 außerhalb von `enums.ts` (S8).
 */
export const RECIPE_UNITS = ['g', 'ml', 'piece', 'tbsp', 'tsp', 'pinch'] as const;
export type RecipeUnit = (typeof RECIPE_UNITS)[number];
export const recipeUnitSchema = z.enum(RECIPE_UNITS, { error: 'Unbekannte Einheit.' });

/** Kurzform in der App und im PDF (Plural nur bei „Prise“ nötig, siehe `unitLabelDe`). */
export const RECIPE_UNIT_LABELS_DE: Readonly<Record<RecipeUnit, string>> = {
  g: 'g',
  ml: 'ml',
  piece: 'Stück',
  tbsp: 'EL',
  tsp: 'TL',
  pinch: 'Prise',
};

/** Umrechnungsangaben eines Lebensmittels (Feld `units` im Katalog, Plan 5.1). */
export interface FoodUnitConversions {
  readonly piece_g?: number | undefined;
  readonly tbsp_g?: number | undefined;
  readonly tsp_g?: number | undefined;
  readonly ml_to_g?: number | undefined;
}

const amountSchema = z.number().finite().nonnegative('Menge darf nicht negativ sein.');

/** Gramm je Einheit für dieses Lebensmittel; null = nicht umrechenbar (Regel R2). */
export function gramsPerUnit(unit: RecipeUnit, conversions: FoodUnitConversions): number | null {
  switch (unit) {
    case 'g':
      return 1;
    case 'ml':
      return conversions.ml_to_g ?? null;
    case 'piece':
      return conversions.piece_g ?? null;
    case 'tbsp':
      return conversions.tbsp_g ?? null;
    case 'tsp':
      return conversions.tsp_g ?? null;
    case 'pinch':
      return PINCH_G;
  }
}

/** true = die Einheit lässt sich für dieses Lebensmittel in Gramm umrechnen (Regel R2). */
export function isUnitConvertible(unit: RecipeUnit, conversions: FoodUnitConversions): boolean {
  return gramsPerUnit(unit, conversions) !== null;
}

/** Menge in Gramm; null = Einheit für dieses Lebensmittel nicht umrechenbar. */
export function toGrams(
  amount: number,
  unit: RecipeUnit,
  conversions: FoodUnitConversions,
): number | null {
  const value = amountSchema.parse(amount);
  const factor = gramsPerUnit(recipeUnitSchema.parse(unit), conversions);
  return factor === null ? null : value * factor;
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Rundet eine (skalierte) Menge je Einheit (Plan 6.2): Gramm/ml auf 5, unter 20 auf 1; Stück auf ½, bei
 * `wholePieces` (z. B. Eier) auf ganze; EL/TL auf ½; Prise ganz. Eine Menge > 0 wird nie auf 0 gerundet –
 * mindestens ein Schritt bleibt (sonst fiele die Zutat stillschweigend weg).
 */
export function roundAmount(
  amount: number,
  unit: RecipeUnit,
  options: { readonly wholePieces?: boolean } = {},
): number {
  const value = amountSchema.parse(amount);
  if (value === 0) {
    return 0;
  }
  const R = AMOUNT_ROUNDING;
  let step: number;
  switch (recipeUnitSchema.parse(unit)) {
    case 'g':
    case 'ml':
      step = value < R.smallMassBelow ? R.smallMassStep : R.massStep;
      break;
    case 'piece':
      step = options.wholePieces === true ? 1 : R.pieceStep;
      break;
    case 'tbsp':
    case 'tsp':
      step = R.spoonStep;
      break;
    case 'pinch':
      step = R.pinchStep;
      break;
  }
  const rounded = roundToStep(value, step);
  // Gleitkomma-Reste (z. B. 0,1 + 0,2) vermeiden.
  return Math.max(step, Number(rounded.toFixed(6)));
}

/** Einheit für die Anzeige, z. B. „2 Prisen“, „1 Prise“, „3 EL“. */
export function unitLabelDe(unit: RecipeUnit, amount: number): string {
  if (unit === 'pinch' && amount !== 1) {
    return 'Prisen';
  }
  return RECIPE_UNIT_LABELS_DE[unit];
}

import { SHOPPING_BUY_UNIT_TOLERANCE, SHOPPING_BUY_UNITS } from '../constants';
import type { ShoppingUnit } from './shopping-list';

/** Einkaufs-Einheit für einen Eintrag: „3 Zwiebeln“, „1 Bund Petersilie“ (Grammzahl zeigt die Oberfläche dahinter). */
export interface ShoppingBuyHint {
  readonly count: number;
  /** Fertiger Text ohne Zahl, passend zur Anzahl („Zwiebel“ bzw. „Zwiebeln“). */
  readonly label: string;
}

/**
 * Einkaufs-Einheit (constants `SHOPPING_BUY_UNITS`) für einen Eintrag in Gramm – nur für Lebensmittel mit Eintrag in
 * der Tabelle; ml, Stück, „nach Geschmack“ und eigene Einträge bleiben wie sie sind (null). Reine Anzeige: die Menge
 * der Liste ändert sich nicht.
 */
export function shoppingBuyHint(
  foodId: string | null | undefined,
  amount: number | null,
  unit: ShoppingUnit | null,
): ShoppingBuyHint | null {
  if (foodId === null || foodId === undefined || unit !== 'g') return null;
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return null;
  if (!Object.hasOwn(SHOPPING_BUY_UNITS, foodId)) return null;
  const def = SHOPPING_BUY_UNITS[foodId];
  if (def === undefined) return null;
  const count = Math.max(1, Math.ceil(amount / def.grams - SHOPPING_BUY_UNIT_TOLERANCE));
  return { count, label: count === 1 ? def.one : def.many };
}

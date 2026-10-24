import { SHOPPING_BUY_UNIT_TOLERANCE, SHOPPING_PURCHASE_LIMITS } from '../constants';
import {
  SHOPPING_BUY_UNITS,
  SHOPPING_CONTAINER_PLURAL,
  type ShoppingBuyUnit,
} from './shopping-buy-unit-table';
import type { ShoppingUnit } from './shopping-list';

export * from './shopping-buy-unit-table';

/**
 * Was im Laden gekauft wird (docs/PLAN-EINKAUFEN-AUSDAUER.md 3 „Einkaufen wie im Laden“, Gründer-Rückmeldung
 * 24.10.2026). Ein Eintrag der Einkaufsliste (Bedarf in g, ml oder Stück) wird in Kaufeinheiten übersetzt:
 *
 * - `quantity` – fett vorn: „2 Packungen“, „1 Netz“, „3“ (bei losen Stücken), null bei Vorrat ohne Menge.
 * - `product` – „Hähnchenbrustfilet“, „Äpfel“, „Olivenöl“.
 * - `detail` – klein dahinter: „à 600 g“, „2 kg“, „10 Stück“, „Vorrat prüfen“, „für den Saft“ oder null.
 * - `text` – alles in einer Zeile für Weitergeben und PDF: „2 Packungen Hähnchenbrustfilet (à 600 g)“.
 *
 * Reine Anzeige: Die Mengen der Liste ändern sich nie. Eigene Einträge (ohne Lebensmittel) bekommen null – die
 * Oberfläche zeigt sie wie eingegeben.
 */
export interface ShoppingPurchase {
  readonly kind: ShoppingBuyUnit['kind'] | 'fallback';
  /** Anzahl der Kaufeinheiten (Packungen, Stück, Bund …); 0 bei Vorrat bzw. „nach Geschmack“. */
  readonly count: number;
  readonly quantity: string | null;
  readonly product: string;
  readonly detail: string | null;
  readonly text: string;
}

export const SHOPPING_STOCK_NOTE = 'Vorrat prüfen';
export const SHOPPING_TO_TASTE_NOTE = 'nach Geschmack';

/** Eintrag der Tabelle für ein Lebensmittel (oder undefined). */
export function shoppingBuyUnit(foodId: string | null | undefined): ShoppingBuyUnit | undefined {
  if (foodId === null || foodId === undefined || !Object.hasOwn(SHOPPING_BUY_UNITS, foodId)) {
    return undefined;
  }
  return SHOPPING_BUY_UNITS[foodId];
}

function decimal(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2, useGrouping: true });
}

/** Größe einer Packung: „500 g“, „1 kg“, „1,5 kg“, „1 l“, „250 ml“, „10 Stück“. */
export function shoppingSizeText(amount: number, measure: 'g' | 'ml' | 'pcs'): string {
  if (measure === 'pcs') return `${decimal(amount)} Stück`;
  if (amount >= 1000) return `${decimal(amount / 1000)} ${measure === 'g' ? 'kg' : 'l'}`;
  return `${decimal(amount)} ${measure}`;
}

function oneLine(quantity: string | null, product: string, detail: string | null): string {
  const head = quantity === null ? product : `${quantity} ${product}`;
  return detail === null ? head : `${head} (${detail})`;
}

/** Anzahl loser Stücke bzw. Einheiten: aufgerundet mit Spielraum (1,1 Zwiebeln → 1), nie 0. */
function countFor(need: number, unitSize: number): number {
  return Math.max(1, Math.ceil(need / unitSize - SHOPPING_BUY_UNIT_TOLERANCE - 1e-9));
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Kombination aus üblichen Größen, die den Bedarf deckt (Spielraum: 0,1 der kleinsten Größe – eine Packung reicht
 * auch, wenn knapp 10 % einer Packung fehlen). Bewertet wird „Menge + Aufschlag je Packung“
 * (`SHOPPING_PURCHASE_LIMITS.packPenalty` × kleinste Größe): wenig Rest, aber nicht drei kleine Becher statt eines
 * großen (400 g Joghurt → 1 × 500 g, nicht 3 × 150 g). Bei Gleichstand weniger verschiedene Größen. Liefert die
 * Anzahl je Größe (absteigend nach Größe).
 */
export function shoppingPackCombination(
  need: number,
  sizes: readonly number[],
): { readonly size: number; readonly count: number }[] {
  const unique = [...new Set(sizes.filter((s) => Number.isInteger(s) && s > 0))].sort(
    (a, b) => b - a,
  );
  if (unique.length === 0) throw new RangeError('Keine Packungsgröße.');
  const smallest = unique[unique.length - 1] as number;
  const largest = unique[0] as number;
  const target = Math.max(0, need - SHOPPING_BUY_UNIT_TOLERANCE * smallest);
  if (target <= 0) return [{ size: smallest, count: 1 }];
  // Sehr großer Bedarf: nur die größte Packung (begrenzt den Rechenaufwand).
  if (target > SHOPPING_PURCHASE_LIMITS.maxPacks * largest) {
    return [{ size: largest, count: Math.ceil(target / largest) }];
  }
  const step = unique.reduce((g, s) => gcd(g, s));
  const goal = Math.ceil(target / step - 1e-9);
  // Mehr als „Ziel + größte Packung“ ist nie besser (eine Packung weniger deckt dann immer noch).
  const limit = goal + largest / step;
  type Entry = { packs: number; counts: number[] };
  const best: (Entry | undefined)[] = new Array<Entry | undefined>(limit + 1);
  best[0] = { packs: 0, counts: unique.map(() => 0) };
  const distinct = (counts: readonly number[]) => counts.filter((c) => c > 0).length;
  const penalty = SHOPPING_PURCHASE_LIMITS.packPenalty * smallest;
  let chosen: { cost: number; entry: Entry } | null = null;
  for (let t = 1; t <= limit; t += 1) {
    for (let i = 0; i < unique.length; i += 1) {
      const prev = best[t - (unique[i] as number) / step];
      if (prev === undefined) continue;
      const counts = prev.counts.slice();
      counts[i] = (counts[i] as number) + 1;
      const candidate = { packs: prev.packs + 1, counts };
      const current = best[t];
      if (
        current === undefined ||
        candidate.packs < current.packs ||
        (candidate.packs === current.packs && distinct(counts) < distinct(current.counts))
      ) {
        best[t] = candidate;
      }
    }
    const entry = best[t];
    if (t < goal || entry === undefined) continue;
    const cost = t * step + penalty * entry.packs;
    if (
      chosen === null ||
      cost < chosen.cost - 1e-9 ||
      (Math.abs(cost - chosen.cost) < 1e-9 &&
        distinct(entry.counts) < distinct(chosen.entry.counts))
    ) {
      chosen = { cost, entry };
    }
  }
  if (chosen === null) return [{ size: largest, count: Math.ceil(target / largest) }];
  const counts = chosen.entry.counts;
  return unique.map((size, i) => ({ size, count: counts[i] as number })).filter((c) => c.count > 0);
}

/** Bedarf in der Einheit der Tabelle (g, ml bzw. Stück). */
function needIn(
  def: Extract<ShoppingBuyUnit, { kind: 'pack' }>,
  amount: number,
  unit: ShoppingUnit,
  pieceGrams: number | undefined,
): number {
  const perUnit = def.gPerUnit ?? 1;
  if (unit === 'piece') {
    if (def.measure === 'pcs') return amount;
    const grams = amount * (pieceGrams ?? def.sizes[0] ?? 1);
    return def.measure === 'ml' ? grams / perUnit : grams;
  }
  // ml und g gelten ohne Dichte als gleich (Rezepte rechnen in g; ml nur bei Wasser).
  if (def.measure === 'g') return amount;
  return amount / perUnit;
}

function packPurchase(
  def: Extract<ShoppingBuyUnit, { kind: 'pack' }>,
  need: number,
): ShoppingPurchase {
  const combo = shoppingPackCombination(need, def.sizes);
  const count = combo.reduce((sum, c) => sum + c.count, 0);
  const label = (size: number) => {
    const index = def.sizes.indexOf(size);
    return def.labels?.[index] ?? shoppingSizeText(size, def.measure);
  };
  let detail: string;
  if (combo.length === 1) {
    const only = combo[0] as { size: number; count: number };
    detail = only.count === 1 ? label(only.size) : `à ${label(only.size)}`;
  } else {
    detail = combo
      .map((c) => (c.count === 1 ? label(c.size) : `${c.count} × ${label(c.size)}`))
      .join(' + ');
  }
  const quantity = `${count} ${count === 1 ? def.container : SHOPPING_CONTAINER_PLURAL[def.container]}`;
  return {
    kind: 'pack',
    count,
    quantity,
    product: def.name,
    detail,
    text: oneLine(quantity, def.name, detail),
  };
}

/**
 * Kaufeinheit eines Eintrags (siehe `ShoppingPurchase`). `pieceGrams` = Stückgewicht des Lebensmittels, falls der
 * Eintrag in Stück zählt (`units.piece_g`). Eigene Einträge (`foodId` null) → null. Unbekanntes Lebensmittel →
 * sicherer Ersatz „1 Packung <Name>“ mit dem Bedarf dahinter.
 */
export function shoppingPurchase(
  item: {
    readonly foodId?: string | null;
    readonly labelDe: string;
    readonly amount: number | null;
    readonly unit: ShoppingUnit | null;
  },
  pieceGrams?: number,
): ShoppingPurchase | null {
  if (item.foodId === null || item.foodId === undefined) return null;
  const def = shoppingBuyUnit(item.foodId);
  const valid =
    item.amount !== null && item.unit !== null && Number.isFinite(item.amount) && item.amount > 0;
  if (def === undefined) {
    const detail = valid
      ? `insgesamt ${item.unit === 'piece' ? `${decimal(item.amount as number)} Stück` : shoppingSizeText(item.amount as number, item.unit as 'g' | 'ml')}`
      : null;
    return {
      kind: 'fallback',
      count: 1,
      quantity: '1 Packung',
      product: item.labelDe,
      detail,
      text: oneLine('1 Packung', item.labelDe, detail),
    };
  }
  if (def.kind === 'stock') {
    const detail = def.note ?? SHOPPING_STOCK_NOTE;
    return {
      kind: 'stock',
      count: 0,
      quantity: null,
      product: def.name,
      detail,
      text: oneLine(null, def.name, detail),
    };
  }
  const product = def.kind === 'loose' ? def.plural : def.name;
  if (!valid) {
    // Nur „eine Prise“ o. Ä. – keine Kaufmenge.
    return {
      kind: def.kind,
      count: 0,
      quantity: null,
      product,
      detail: SHOPPING_TO_TASTE_NOTE,
      text: oneLine(null, product, SHOPPING_TO_TASTE_NOTE),
    };
  }
  const amount = item.amount as number;
  const unit = item.unit as ShoppingUnit;
  if (def.kind === 'pack') return packPurchase(def, needIn(def, amount, unit, pieceGrams));
  // Stück eines Rezepts (Zehe, Scheibe …) sind nicht unbedingt Kaufeinheiten: über Gramm rechnen, wenn bekannt.
  const grams = unit === 'piece' ? amount * (pieceGrams ?? def.pieceG) : amount;
  const count = countFor(grams, def.pieceG);
  const note = def.note ?? null;
  if (def.kind === 'loose') {
    const name = count === 1 ? def.name : def.plural;
    const quantity = String(count);
    return {
      kind: 'loose',
      count,
      quantity,
      product: name,
      detail: note,
      text: oneLine(quantity, name, note),
    };
  }
  const quantity = `${count} ${count === 1 ? def.container : SHOPPING_CONTAINER_PLURAL[def.container]}`;
  return {
    kind: 'piece',
    count,
    quantity,
    product: def.name,
    detail: note,
    text: oneLine(quantity, def.name, note),
  };
}

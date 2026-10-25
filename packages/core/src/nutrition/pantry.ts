import { z } from 'zod';

import { PANTRY, SHOPPING_BUY_UNIT_TOLERANCE } from '../constants';
import type { Food, FoodLookup } from '../content/food-schema';
import { contentIdSchema } from '../content/schemas';
import {
  SHOPPING_CONTAINER_PLURAL,
  shoppingBuyUnit,
  type ShoppingBuyUnit,
  shoppingNeedIn,
  shoppingPurchase,
  shoppingSizeText,
} from './shopping-buy-units';
import { roundShoppingAmount, type ShoppingListItem } from './shopping-list';
import {
  matchScannedProduct,
  type ShoppingProductLink,
  type ScannedProduct,
} from './shopping-scan';

/**
 * Vorratsschrank (Gründer-Freigabe 25.10.2026, KONZEPT 6.13 „Vorratsschrank“): Die Person führt eine Liste, was sie
 * zu Hause hat – Lebensmittel aus dem Katalog, wahlweise mit Menge in Kaufeinheiten („2 Packungen à 500 g“, „3 Äpfel“)
 * und dem Kennzeichen „fast leer“. Reine Regeln ohne UI und ohne KI:
 *
 * 1. Einkaufsliste (`shoppingPantryView`): Was im Vorrat reicht, wandert in den Abschnitt „Schon im Vorrat“; was nur
 *    teilweise reicht, steht mit der Restmenge auf der Liste; „fast leer“ bleibt auf der Liste (nachkaufen). Vorrat ohne
 *    Menge zählt als „da“ (Hinweis „Menge prüfen“). Öl, Essig, Gewürze („Vorrat prüfen“) sind im Vorrat einfach erledigt.
 *    REINE ANZEIGE: Mengen, Häkchen und Schlüssel der gespeicherten Liste ändern sich nie (wie die Kaufeinheiten).
 * 2. Nach dem Einkauf (`pantryAfterShopping`): Abgehakte Einträge mit haltbaren Lebensmitteln (Katalog-Kennzeichen
 *    `pantry`, Tiefkühl oder Vorrat ohne Menge) kommen mit der gekauften Menge in den Vorrat; frische Lebensmittel
 *    (Obst, Gemüse, Fleisch, Kühlregal) nicht – sie werden in der Woche verbraucht.
 * 3. Kühlschrank-Suche und Vorschläge: `fridge-search.ts` zählt Vorrats-Zutaten als vorhanden (`pantryShares`).
 * 4. Strichcode (`matchScannedPantryFood`): dieselben Regeln wie beim Scannen im Laden (`matchScannedProduct`), nur gegen
 *    den ganzen Katalog statt gegen die Liste.
 *
 * Datenschutz: Der Vorrat verrät Konsum (wie gelernte Strichcode-Zuordnungen) – SENSIBEL: nur mit Einwilligung
 * health_data, beim Widerruf gelöscht, im Export, nie in Logs (Migration `pantry_items`).
 */

const multipleOf = (step: number) => (value: number) =>
  Math.abs(Math.round(value / step) * step - value) < 1e-9;

export const pantryItemSchema = z
  .strictObject({
    food_id: contentIdSchema,
    /** Menge in Kaufeinheiten (Packungen, Stück, Bund …); null = „da“, ohne Menge. */
    count: z
      .number()
      .min(PANTRY.countStep)
      .max(PANTRY.countMax)
      .refine(multipleOf(PANTRY.countStep), 'Menge in halben Schritten.')
      .nullable(),
    /** Packungsgröße (g, ml bzw. Stück) bei Packungsware; null = übliche (kleinste) Größe. */
    pack_size: z.number().int().min(1).max(PANTRY.packSizeMax).nullable(),
    /** „fast leer“ – bleibt auf der Einkaufsliste. */
    low: z.boolean(),
  })
  .refine((item) => item.count !== null || item.pack_size === null, {
    message: 'Packungsgröße nur mit Menge.',
  });
export type PantryItem = z.infer<typeof pantryItemSchema>;

/** Wie gekauft wird (für Auswahl und Anzeige der Menge): aus der Tabelle der Kaufeinheiten. */
export type PantryUnitInfo =
  | { readonly kind: 'stock'; readonly name: string }
  | {
      readonly kind: 'pack';
      readonly name: string;
      readonly container: string;
      readonly containerPlural: string;
      readonly sizes: readonly number[];
      readonly sizeLabels: readonly string[];
    }
  | {
      readonly kind: 'count';
      /** Einzahl/Mehrzahl der Einheit: „Apfel“/„Äpfel“ bzw. „Bund“/„Bund“. */
      readonly one: string;
      readonly many: string;
      /** Name des Produkts bei Einheiten mit Behälter („Petersilie“), sonst null. */
      readonly product: string | null;
    };

/** Kaufeinheit eines Lebensmittels für den Vorrat (unbekannt → Packung ohne Größe). */
export function pantryUnitInfo(food: Pick<Food, 'id' | 'name_de'>): PantryUnitInfo {
  const def: ShoppingBuyUnit | undefined = shoppingBuyUnit(food.id);
  if (def === undefined) {
    return {
      kind: 'pack',
      name: food.name_de,
      container: 'Packung',
      containerPlural: 'Packungen',
      sizes: [],
      sizeLabels: [],
    };
  }
  switch (def.kind) {
    case 'stock':
      return { kind: 'stock', name: def.name };
    case 'loose':
      return { kind: 'count', one: def.name, many: def.plural, product: null };
    case 'piece':
      return {
        kind: 'count',
        one: def.container,
        many: SHOPPING_CONTAINER_PLURAL[def.container],
        product: def.name,
      };
    case 'pack':
      return {
        kind: 'pack',
        name: def.name,
        container: def.container,
        containerPlural: SHOPPING_CONTAINER_PLURAL[def.container],
        sizes: def.sizes,
        sizeLabels: def.sizes.map(
          (size, i) => def.labels?.[i] ?? shoppingSizeText(size, def.measure),
        ),
      };
  }
}

function decimal(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

/** Menge als Text: „2 Packungen (à 500 g)“, „3 Äpfel“, „1 Bund Petersilie“; ohne Menge null. */
export function pantryAmountText(
  item: Pick<PantryItem, 'count' | 'pack_size'>,
  food: Pick<Food, 'id' | 'name_de'>,
): string | null {
  if (item.count === null) return null;
  const info = pantryUnitInfo(food);
  const n = item.count;
  const many = n > 1;
  switch (info.kind) {
    case 'stock':
      return null;
    case 'count':
      return info.product === null
        ? `${decimal(n)} ${many ? info.many : info.one}`
        : `${decimal(n)} ${many ? info.many : info.one} ${info.product}`;
    case 'pack': {
      const head = `${decimal(n)} ${many ? info.containerPlural : info.container}`;
      if (item.pack_size === null) return head;
      const index = info.sizes.indexOf(item.pack_size);
      const label =
        index >= 0
          ? (info.sizeLabels[index] as string)
          : shoppingSizeText(item.pack_size, packMeasure(food.id));
      return `${head} (${many ? 'à ' : ''}${label})`;
    }
  }
}

function packMeasure(foodId: string): 'g' | 'ml' | 'pcs' {
  const def = shoppingBuyUnit(foodId);
  return def?.kind === 'pack' ? def.measure : 'g';
}

/**
 * Vorhandene Menge in der Einheit der Tabelle (g, ml bzw. Stück bei Packungen; Gramm bei losen Stücken/Einheiten);
 * null = unbekannt (ohne Menge, Vorrat ohne Menge, Packung ohne bekannte Größe).
 */
export function pantryAvailable(
  item: Pick<PantryItem, 'count' | 'pack_size'>,
  foodId: string,
): number | null {
  if (item.count === null) return null;
  const def = shoppingBuyUnit(foodId);
  if (def === undefined || def.kind === 'stock') return null;
  if (def.kind === 'pack') {
    const size = item.pack_size ?? def.sizes[0];
    return size === undefined ? null : item.count * size;
  }
  return item.count * def.pieceG;
}

/** Bedarf eines Listeneintrags in derselben Einheit wie `pantryAvailable`; null = nicht vergleichbar. */
function needOf(item: ShoppingListItem, pieceGrams: number | undefined): number | null {
  if (item.foodId === null || item.amount === null || item.unit === null || !(item.amount > 0)) {
    return null;
  }
  const def = shoppingBuyUnit(item.foodId);
  if (def === undefined || def.kind === 'stock') return null;
  if (def.kind === 'pack') return shoppingNeedIn(def, item.amount, item.unit, pieceGrams);
  return item.unit === 'piece' ? item.amount * (pieceGrams ?? def.pieceG) : item.amount;
}

export type PantryShoppingStatus =
  /** Nicht im Vorrat (oder eigener Eintrag) – unverändert. */
  | 'buy'
  /** Im Vorrat „fast leer“ – bleibt auf der Liste. */
  | 'low'
  /** Vorrat reicht nur teilweise – Restmenge. */
  | 'partial'
  /** Vorrat reicht. */
  | 'covered'
  /** Im Vorrat ohne Menge (bzw. nicht vergleichbar) – zählt als da, „Menge prüfen“. */
  | 'covered_unknown';

export interface PantryShoppingLine {
  readonly item: ShoppingListItem;
  readonly status: PantryShoppingStatus;
  /** Eintrag mit der noch zu kaufenden Menge (bei `partial` verringert, sonst unverändert). */
  readonly display: ShoppingListItem;
}

export interface PantryShoppingView {
  /** Noch zu kaufen (Reihenfolge der Liste). */
  readonly toBuy: readonly PantryShoppingLine[];
  /** Schon im Vorrat (Reihenfolge der Liste). */
  readonly inPantry: readonly PantryShoppingLine[];
}

/**
 * Einkaufsliste mit dem Vorrat abgleichen (reine Anzeige, Regeln oben unter 1). `pieceGramsOf` = Stückgewicht des
 * Lebensmittels (`units.piece_g`), falls ein Eintrag in Stück zählt. Abgehakte Einträge bleiben, wo sie sind (ein
 * erledigter Kauf wird nicht nachträglich „versteckt“).
 */
export function shoppingPantryView(
  items: readonly ShoppingListItem[],
  pantry: readonly PantryItem[],
  pieceGramsOf: (foodId: string) => number | undefined = () => undefined,
): PantryShoppingView {
  const byFood = new Map(pantry.map((p) => [p.food_id, p]));
  const toBuy: PantryShoppingLine[] = [];
  const inPantry: PantryShoppingLine[] = [];
  for (const item of items) {
    const stock = item.foodId === null || item.isManual ? undefined : byFood.get(item.foodId);
    if (stock === undefined || item.checked) {
      toBuy.push({ item, status: 'buy', display: item });
      continue;
    }
    if (stock.low) {
      toBuy.push({ item, status: 'low', display: item });
      continue;
    }
    const foodId = item.foodId as string;
    const need = needOf(item, pieceGramsOf(foodId));
    const have = pantryAvailable(stock, foodId);
    if (need === null || have === null) {
      inPantry.push({ item, status: 'covered_unknown', display: item });
      continue;
    }
    // Spielraum wie bei den Kaufeinheiten: knapp 10 % einer Einheit fehlen → reicht noch.
    if (have >= need * (1 - SHOPPING_BUY_UNIT_TOLERANCE) - 1e-9) {
      inPantry.push({ item, status: 'covered', display: item });
      continue;
    }
    const amount = item.amount as number;
    const unit = item.unit as NonNullable<ShoppingListItem['unit']>;
    const rest = roundShoppingAmount((amount * (need - have)) / need, unit);
    toBuy.push({ item, status: 'partial', display: { ...item, amount: Math.min(amount, rest) } });
  }
  return { toBuy, inPantry };
}

/** Kommt ein gekauftes Lebensmittel in den Vorrat? Haltbar (`pantry`), Tiefkühl oder Vorrat ohne Menge. */
export function pantryKeepsAfterShopping(
  food: Pick<Food, 'id' | 'pantry' | 'shopping_category'>,
): boolean {
  return (
    food.pantry || food.shopping_category === 'frozen' || shoppingBuyUnit(food.id)?.kind === 'stock'
  );
}

function clampCount(value: number): number {
  const stepped = Math.round(value / PANTRY.countStep) * PANTRY.countStep;
  return Math.min(PANTRY.countMax, Math.max(PANTRY.countStep, stepped));
}

/** Gekaufte Menge eines Eintrags als Vorrats-Menge (Kaufeinheiten), aus `shoppingPurchase`. */
export function pantryAmountFromPurchase(
  item: ShoppingListItem,
  pieceGrams: number | undefined,
): Pick<PantryItem, 'count' | 'pack_size'> {
  const purchase = shoppingPurchase(item, pieceGrams);
  const def = item.foodId === null ? undefined : shoppingBuyUnit(item.foodId);
  if (purchase === null || def === undefined || def.kind === 'stock' || purchase.count <= 0) {
    return { count: null, pack_size: null };
  }
  if (def.kind !== 'pack') return { count: clampCount(purchase.count), pack_size: null };
  const need = needOf(item, pieceGrams);
  const smallest = Math.min(...def.sizes);
  if (need === null || !Number.isFinite(smallest)) {
    return { count: clampCount(purchase.count), pack_size: null };
  }
  // Gleiche Größe: Anzahl × Größe; gemischte Größen → in der kleinsten Größe gezählt.
  const sizes = new Set(def.sizes);
  if (purchase.count > 0 && sizes.size === 1) {
    return { count: clampCount(purchase.count), pack_size: smallest };
  }
  const bought = Math.max(need, smallest);
  return { count: clampCount(Math.ceil(bought / smallest - 1e-9)), pack_size: smallest };
}

export interface PantryAfterShopping {
  readonly items: readonly PantryItem[];
  /** Neu in den Vorrat gekommen bzw. aufgestockt (Lebensmittel-IDs). */
  readonly added: readonly string[];
  readonly updated: readonly string[];
  /** Abgehakt, aber frisch – bleibt draußen. */
  readonly skippedFresh: readonly string[];
  /** Kein Platz mehr (`PANTRY.itemsMax`). */
  readonly skippedFull: readonly string[];
}

/**
 * „Vorrat aktualisieren nach Einkauf“ (Regeln oben unter 2): abgehakte Katalog-Einträge → Vorrat. Gleiches
 * Lebensmittel mit Menge: Mengen werden addiert (bei anderer Packungsgröße in die neue Größe umgerechnet); „fast leer“
 * wird aufgehoben. Eigene Einträge und frische Lebensmittel bleiben draußen. Reihenfolge stabil (bestehende zuerst).
 */
export function pantryAfterShopping(
  pantry: readonly PantryItem[],
  items: readonly ShoppingListItem[],
  foods: FoodLookup,
): PantryAfterShopping {
  const next = new Map(pantry.map((p) => [p.food_id, p]));
  const added: string[] = [];
  const updated: string[] = [];
  const skippedFresh: string[] = [];
  const skippedFull: string[] = [];
  for (const item of items) {
    if (!item.checked || item.isManual || item.foodId === null) continue;
    const food = foods.get(item.foodId);
    if (food === undefined) continue;
    if (!pantryKeepsAfterShopping(food)) {
      if (!skippedFresh.includes(food.id)) skippedFresh.push(food.id);
      continue;
    }
    const bought = pantryAmountFromPurchase(item, food.units.piece_g);
    const existing = next.get(food.id);
    if (existing === undefined) {
      if (next.size >= PANTRY.itemsMax) {
        skippedFull.push(food.id);
        continue;
      }
      next.set(food.id, { food_id: food.id, ...bought, low: false });
      if (!added.includes(food.id)) added.push(food.id);
      continue;
    }
    let merged: PantryItem;
    if (existing.count === null || bought.count === null) {
      merged = { ...existing, ...bought, low: false };
    } else {
      const before = pantryAvailable(existing, food.id);
      const now = pantryAvailable(bought, food.id);
      const unit = pantryAvailable({ count: 1, pack_size: bought.pack_size }, food.id);
      merged =
        before !== null && now !== null && unit !== null && unit > 0
          ? {
              food_id: food.id,
              count: clampCount((before + now) / unit),
              pack_size: bought.pack_size,
              low: false,
            }
          : { ...existing, count: clampCount(existing.count + bought.count), low: false };
    }
    next.set(food.id, merged);
    if (!added.includes(food.id) && !updated.includes(food.id)) updated.push(food.id);
  }
  return { items: [...next.values()], added, updated, skippedFresh, skippedFull };
}

/** Eintrag setzen (neu oder ersetzen), höchstens `PANTRY.itemsMax` (neu über der Grenze → unverändert, `full`). */
export function withPantryItem(
  pantry: readonly PantryItem[],
  item: PantryItem,
): { readonly items: readonly PantryItem[]; readonly full: boolean } {
  const parsed = pantryItemSchema.parse(item);
  const exists = pantry.some((p) => p.food_id === parsed.food_id);
  if (!exists && pantry.length >= PANTRY.itemsMax) return { items: pantry, full: true };
  return {
    items: exists
      ? pantry.map((p) => (p.food_id === parsed.food_id ? parsed : p))
      : [...pantry, parsed],
    full: false,
  };
}

export function withoutPantryItem(
  pantry: readonly PantryItem[],
  foodId: string,
): readonly PantryItem[] {
  return pantry.filter((p) => p.food_id !== foodId);
}

/**
 * Vorrat sortiert für die Anzeige: nach Abteilung (feste Reihenfolge der Einkaufsliste), dann Name. Unbekannte
 * Lebensmittel (nicht im geladenen Katalog) zuletzt.
 */
export function sortPantry<T extends Pick<PantryItem, 'food_id'>>(
  pantry: readonly T[],
  foods: FoodLookup,
  categoryOrder: readonly string[],
): T[] {
  const rank = (id: string) => {
    const food = foods.get(id);
    return food === undefined
      ? Number.MAX_SAFE_INTEGER
      : categoryOrder.indexOf(food.shopping_category);
  };
  const name = (id: string) => foods.get(id)?.name_de ?? id;
  return [...pantry].sort(
    (a, b) =>
      rank(a.food_id) - rank(b.food_id) ||
      name(a.food_id).localeCompare(name(b.food_id), 'de') ||
      (a.food_id < b.food_id ? -1 : 1),
  );
}

// ---------------------------------------------------------------------------------------------------------
// Strichcode → Lebensmittel für den Vorrat
// ---------------------------------------------------------------------------------------------------------

export type PantryScanMatch =
  | { readonly kind: 'match'; readonly foodId: string }
  | { readonly kind: 'choose'; readonly foodIds: readonly string[] }
  | { readonly kind: 'none' };

/**
 * Gescanntes Produkt einem Katalog-Lebensmittel zuordnen (Regeln von `matchScannedProduct`: gelernte Zuordnung zuerst,
 * dann Name/Mehrzahl/Synonyme). Gegen den ganzen Katalog – eindeutig → `match`, mehrere → `choose`, sonst `none`.
 */
export function matchScannedPantryFood(
  product: ScannedProduct,
  foods: FoodLookup,
  links: readonly ShoppingProductLink[] = [],
): PantryScanMatch {
  const items: ShoppingListItem[] = [...foods.values()]
    .filter((food) => food.status !== 'archived')
    .map((food) => ({
      itemKey: `${food.id}|g`,
      foodId: food.id,
      labelDe: food.name_de,
      amount: null,
      unit: null,
      category: food.shopping_category,
      // Für den Vorrat zählt jedes Lebensmittel gleich (kein Nachrang für Vorrats-Lebensmittel wie im Laden).
      isPantry: false,
      isManual: false,
      checked: false,
      substituteFor: [],
      amountChanged: false,
      notInPlan: false,
    }));
  const result = matchScannedProduct(product, { items }, foods, links);
  switch (result.kind) {
    case 'match':
    case 'already_checked':
      return result.item.foodId === null
        ? { kind: 'none' }
        : { kind: 'match', foodId: result.item.foodId };
    case 'choose': {
      const ids = [
        ...new Set(
          result.candidates.map((c) => c.foodId).filter((id): id is string => id !== null),
        ),
      ];
      return ids.length === 1
        ? { kind: 'match', foodId: ids[0] as string }
        : { kind: 'choose', foodIds: ids };
    }
    default:
      return { kind: 'none' };
  }
}

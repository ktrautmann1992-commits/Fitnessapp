import { z } from 'zod';

import { isoDateSchema } from '../age';
import { SHOPPING_LIST_ROUNDING } from '../constants';
import {
  type FoodLookup,
  SHOPPING_CATEGORIES,
  type ShoppingCategory,
} from '../content/food-schema';
import { addDays } from '../dates';
import type { MealPlanWeek } from './meal-plan';
import type { ScaledIngredient } from './scale';

/**
 * Einkaufsliste (docs/PLAN-PHASE-5.md 6.5, R2-S4) – aus dem Essensplan, nach Supermarkt-Abteilungen (5.5).
 *
 * - Aggregation je (Lebensmittel, Grundeinheit); Ersatzprodukte statt Original (S4), weggelassene optionale
 *   Zutaten fehlen (S3), Ergänzungs-Snacks sind enthalten.
 * - EL/TL → Gramm; Milliliter bleiben Milliliter; wird ein Lebensmittel irgendwo in Stück verwendet und ist ein
 *   Stückgewicht bekannt, zählt alles in Stück (natürlicher, z. B. Eier). Prise → „nach Geschmack“.
 * - Mengen AUFGERUNDET auf Kaufschritte (Gramm/ml unter 100 auf 10, sonst auf 50; Stück ganz) – nie 0.
 * - Meal-Prep: gekauft wird zum Kochtag (`cookDate`); der Sonntag vor der Woche zählt zur Woche.
 * - Stabiler Schlüssel `food_id|einheit`: Häkchen bleiben bei Neuerzeugung erhalten, Mengenänderungen markiert.
 * - Keine Marken, keine kcal, keine Gründe (Unverträglichkeiten stehen nirgends, K4: nur das Ersatzprodukt).
 */

export type ShoppingUnit = 'g' | 'ml' | 'piece';

export interface ShoppingListItem {
  /** Stabiler Schlüssel `food_id|einheit` bzw. `manual|…` für eigene Einträge. */
  readonly itemKey: string;
  readonly foodId: string | null;
  readonly labelDe: string;
  /** Aufgerundete Menge; null = „nach Geschmack“ bzw. eigener Eintrag ohne Menge. */
  readonly amount: number | null;
  readonly unit: ShoppingUnit | null;
  readonly category: ShoppingCategory;
  /** „Hast du wahrscheinlich da“ (Vorrat, eingeklappt). */
  readonly isPantry: boolean;
  readonly isManual: boolean;
  readonly checked: boolean;
  /** Ersatzprodukt für diese Original-Lebensmittel (S4; Anzeige „statt …“ nur im Rezept, K4). */
  readonly substituteFor: readonly string[];
  /** Menge hat sich bei der Neuerzeugung geändert. */
  readonly amountChanged: boolean;
  /** Abgehakt, aber nach einer Neuplanung nicht mehr im Plan (R2-S4). */
  readonly notInPlan: boolean;
}

export interface ShoppingList {
  readonly from: string;
  readonly to: string;
  /** Wie der Plan (7.1): eigene Einträge werden beim Widerruf mit gelöscht (K10). */
  readonly usesHealthData: boolean;
  readonly items: readonly ShoppingListItem[];
}

const rangeSchema = z
  .strictObject({ from: isoDateSchema, to: isoDateSchema })
  .refine((r) => r.from <= r.to, 'Der Zeitraum beginnt nach seinem Ende.');

const R = SHOPPING_LIST_ROUNDING;

/** Aufrunden auf Kaufschritte (Plan 6.5): nie 0 für eine Menge > 0. */
export function roundShoppingAmount(amount: number, unit: ShoppingUnit): number {
  if (!(amount > 0)) return 0;
  if (unit === 'piece') return Math.max(R.pieceStep, Math.ceil(amount - 1e-9));
  const step = amount < R.largeFrom ? R.smallStep : R.largeStep;
  return Math.max(step, Math.ceil(amount / step - 1e-9) * step);
}

const categoryRank = (c: ShoppingCategory) => SHOPPING_CATEGORIES.indexOf(c);

function sortItems(items: ShoppingListItem[]): ShoppingListItem[] {
  return items.sort(
    (a, b) =>
      Number(a.isPantry) - Number(b.isPantry) ||
      categoryRank(a.category) - categoryRank(b.category) ||
      a.labelDe.localeCompare(b.labelDe, 'de') ||
      (a.itemKey < b.itemKey ? -1 : a.itemKey > b.itemKey ? 1 : 0),
  );
}

interface Bucket {
  grams: number;
  ml: number;
  pieceGrams: number;
  pinch: boolean;
  usesPieces: boolean;
  substituteFor: Set<string>;
}

/**
 * Einkaufsliste für einen Zeitraum (Standard: die ganze Woche, Plan 6.5). `extras` = zusätzliche Zutaten, die
 * unabhängig vom Zeitraum dazukommen („Zur Einkaufsliste“ aus einer Rezeptansicht, Etappe N5b) – sie werden mit den
 * Plan-Zutaten zusammengezählt (gleicher Schlüssel `food_id|einheit`).
 */
export function buildShoppingList(
  plan: MealPlanWeek,
  foods: FoodLookup,
  range?: { readonly from: string; readonly to: string },
  extras: readonly (readonly ScaledIngredient[])[] = [],
): ShoppingList {
  const { from, to } = rangeSchema.parse(
    range ?? { from: plan.weekStart, to: addDays(plan.weekStart, 6) },
  );
  const buckets = new Map<string, Bucket>();
  const sources: (readonly ScaledIngredient[])[] = [];
  // Was am selben Kochtermin für mehrere Tage gekocht wird, wird zum Kochtag gekauft.
  for (const day of plan.days) {
    for (const meal of day.meals) {
      const purchase = meal.cookDate < plan.weekStart ? plan.weekStart : meal.cookDate;
      if (purchase < from || purchase > to) continue;
      sources.push(meal.ingredients);
    }
  }
  sources.push(...extras);
  for (const ingredients of sources) {
    for (const ingredient of ingredients) {
      const food = foods.get(ingredient.foodId);
      if (food === undefined) throw new Error(`Lebensmittel „${ingredient.foodId}“ fehlt.`);
      const bucket = buckets.get(food.id) ?? {
        grams: 0,
        ml: 0,
        pieceGrams: 0,
        pinch: false,
        usesPieces: false,
        substituteFor: new Set<string>(),
      };
      if (ingredient.originalFoodId !== null) bucket.substituteFor.add(ingredient.originalFoodId);
      switch (ingredient.unit) {
        case 'pinch':
          bucket.pinch = true;
          break;
        case 'ml':
          bucket.ml += ingredient.amount;
          break;
        case 'piece':
          bucket.usesPieces = true;
          bucket.pieceGrams += ingredient.grams;
          break;
        default:
          bucket.grams += ingredient.grams;
      }
      buckets.set(food.id, bucket);
    }
  }

  const items: ShoppingListItem[] = [];
  const push = (foodId: string, unit: ShoppingUnit | null, amount: number | null) => {
    const food = foods.get(foodId);
    if (food === undefined) return;
    const bucket = buckets.get(foodId) as Bucket;
    items.push({
      itemKey: `${foodId}|${unit ?? 'pinch'}`,
      foodId,
      labelDe:
        unit === 'piece' && amount !== null && amount > 1 && food.name_de_plural !== undefined
          ? food.name_de_plural
          : food.name_de,
      amount,
      unit,
      category: food.shopping_category,
      isPantry: food.pantry,
      isManual: false,
      checked: false,
      substituteFor: [...bucket.substituteFor].sort(),
      amountChanged: false,
      notInPlan: false,
    });
  };
  for (const [foodId, bucket] of buckets) {
    const food = foods.get(foodId);
    const pieceG = food?.units.piece_g;
    let grams = bucket.grams;
    if (bucket.usesPieces && pieceG !== undefined) {
      push(foodId, 'piece', roundShoppingAmount((bucket.pieceGrams + grams) / pieceG, 'piece'));
      grams = 0;
    } else {
      grams += bucket.pieceGrams;
    }
    if (grams > 0) push(foodId, 'g', roundShoppingAmount(grams, 'g'));
    if (bucket.ml > 0) push(foodId, 'ml', roundShoppingAmount(bucket.ml, 'ml'));
    if (
      bucket.pinch &&
      grams === 0 &&
      bucket.ml === 0 &&
      !(bucket.usesPieces && pieceG !== undefined)
    ) {
      // Nur in Prisen verwendet → „nach Geschmack“ (Plan 6.5).
      push(foodId, null, null);
    }
  }
  return { from, to, usesHealthData: plan.usesHealthData, items: sortItems(items) };
}

/**
 * Neuerzeugung nach (automatischer) Neuplanung (R2-S4): Häkchen bleiben über `item_key`, geänderte Mengen werden
 * markiert, weggefallene OFFENE Einträge verschwinden, weggefallene ABGEHAKTE bleiben mit „nicht mehr im Plan“,
 * eigene Einträge bleiben unverändert.
 */
export function rebuildShoppingList(
  oldList: ShoppingList,
  newPlan: MealPlanWeek,
  foods: FoodLookup,
  range: { readonly from: string; readonly to: string } = { from: oldList.from, to: oldList.to },
  extras: readonly (readonly ScaledIngredient[])[] = [],
): ShoppingList {
  return mergeShoppingList(oldList, buildShoppingList(newPlan, foods, range, extras), {
    planChanged: true,
  });
}

/**
 * Überträgt Häkchen, eigene Einträge und „nicht mehr im Plan“ von `oldList` auf die frisch erzeugte Liste `fresh`
 * (Schlüssel `item_key`, R2-S4). `planChanged`: Mengenänderungen gegenüber der alten Liste markieren; sonst bleiben
 * die bisherigen Markierungen (gleicher Plan, nur neu gelesen). Weggefallene offene Einträge verschwinden,
 * weggefallene abgehakte bleiben mit „nicht mehr im Plan“, eigene Einträge bleiben unverändert.
 */
export function mergeShoppingList(
  oldList: Pick<ShoppingList, 'items'>,
  fresh: ShoppingList,
  options: { readonly planChanged: boolean },
): ShoppingList {
  const old = new Map(oldList.items.map((item) => [item.itemKey, item]));
  const items: ShoppingListItem[] = fresh.items.map((item) => {
    const before = old.get(item.itemKey);
    if (before === undefined || before.isManual) return item;
    return {
      ...item,
      checked: before.checked,
      amountChanged: options.planChanged
        ? before.amount !== item.amount
        : before.amountChanged && !before.notInPlan,
    };
  });
  const freshKeys = new Set(fresh.items.map((item) => item.itemKey));
  for (const item of oldList.items) {
    if (item.isManual) {
      items.push(item);
    } else if (!freshKeys.has(item.itemKey) && item.checked) {
      items.push({ ...item, notInPlan: true, amountChanged: false });
    }
  }
  return { ...fresh, items: sortItems(items) };
}

const manualItemSchema = z.strictObject({
  labelDe: z
    .string()
    .trim()
    .min(1, 'Bitte einen Eintrag eingeben.')
    .max(R.manualLabelMaxChars, `Höchstens ${R.manualLabelMaxChars} Zeichen.`),
  category: z.enum(SHOPPING_CATEGORIES).default('other'),
});

/** Eigener Eintrag (Plan 6.5): Freitext ≤ 80 Zeichen, Abteilung wählbar. Gleicher Text → kein Doppel. */
export function addManualShoppingItem<L extends ShoppingList>(
  list: L,
  entry: { readonly labelDe: string; readonly category?: ShoppingCategory },
): L {
  const { labelDe, category } = manualItemSchema.parse(entry);
  const itemKey = `manual|${labelDe.toLocaleLowerCase('de')}`;
  if (list.items.some((item) => item.itemKey === itemKey)) return list;
  if (list.items.filter((item) => item.isManual).length >= R.manualItemsMax) {
    throw new RangeError(`Höchstens ${R.manualItemsMax} eigene Einträge.`);
  }
  const item: ShoppingListItem = {
    itemKey,
    foodId: null,
    labelDe,
    amount: null,
    unit: null,
    category,
    isPantry: false,
    isManual: true,
    checked: false,
    substituteFor: [],
    amountChanged: false,
    notInPlan: false,
  };
  return { ...list, items: sortItems([...list.items, item]) };
}

export function removeManualShoppingItem<L extends ShoppingList>(list: L, itemKey: string): L {
  return {
    ...list,
    items: list.items.filter((item) => !(item.isManual && item.itemKey === itemKey)),
  };
}

/** Abhaken (offline möglich, Plan 6.5). */
export function setShoppingItemChecked<L extends ShoppingList>(
  list: L,
  itemKey: string,
  checked: boolean,
): L {
  return {
    ...list,
    items: list.items.map((item) => (item.itemKey === itemKey ? { ...item, checked } : item)),
  };
}

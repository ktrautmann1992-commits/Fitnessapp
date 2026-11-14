import { z } from 'zod';

import { CUSTOM_MEAL_LIMITS, FOOD_HOUSEHOLD_LIMITS, FOOD_LOG_LIMITS } from '../constants';
import type { Food, FoodLookup } from '../content/food-schema';
import { contentIdSchema } from '../content/schemas';
import type { CustomMeal, CustomMealItem } from './custom-meal';
import {
  type FoodLogBuild,
  type FoodLogBuildError,
  type FoodLogEntry,
  type FoodLogSlot,
  type FoodLogTarget,
  type FoodLogUnit,
  entryFromFood,
  finishFoodLogEntry,
  foodLogGroup,
  foodLogUnitsFor,
} from './food-log';
import {
  BREAD_STEM_BY_FOOD,
  FOOD_STAND_INS,
  HOUSEHOLD_UNITS,
  HOUSEHOLD_UNITS_BY_CATEGORY,
  HOUSEHOLD_UNITS_BY_FOOD,
  HOUSEHOLD_UNITS_BY_STAND_IN,
  type HouseholdUnit,
  type HouseholdUnitGrams,
} from './food-household-table';
import { foodKeywordGroups } from './food-search';
import { SHOPPING_BUY_UNITS } from './shopping-buy-unit-table';

/**
 * Freies Eintragen in Haushaltsmengen und „Mahlzeit zusammenstellen“ (Gründer-Rückmeldung Testphase 14.11.2026,
 * docs/PLAN-ESSEN-FREI-EINTRAGEN.md). Reine Logik ohne UI:
 * - Einheiten eines Lebensmittels: Gramm (immer), ml (nur mit Umrechnung im Katalog) und Haushaltsmengen wie
 *   „Scheibe“, „Handvoll“, „Glas“ (`householdUnitsFor`).
 * - Eingabe-Einheit `FoodAmountUnit` = Tagebuch-Einheit (g, ml, Stück) ODER Haushaltsmenge. Haushaltsmengen werden
 *   beim Eintragen in GRAMM umgerechnet (`resolveFoodAmount`) – das Tagebuch, die Datenbank (CHECK unit in g/ml/piece)
 *   und die Nachrechnung des Servers bleiben unverändert. Grenzen: Anzahl 0,5–20 in ½-Schritten, umgerechnet 1–2.000 g.
 * - Korb: mehrere Lebensmittel auf einmal eintragen (`basketEntries`), als eigenes Gericht „Aus Zutaten“ speichern
 *   (`basketCustomMealInput`, Name vorgeschlagen mit `suggestBasketName`).
 * - Plan-Mahlzeit „wie geplant“ / „etwas anderes“ / offen (`planSlotStatus`).
 */

export type { HouseholdUnit, HouseholdUnitGrams } from './food-household-table';
export type { FoodKeywordGroup } from './food-household-table';
export {
  BREAD_STEM_BY_FOOD,
  HOUSEHOLD_UNITS,
  HOUSEHOLD_UNIT_LABELS_DE,
  HOUSEHOLD_UNITS_BY_CATEGORY,
  HOUSEHOLD_UNITS_BY_FOOD,
  HOUSEHOLD_UNITS_BY_STAND_IN,
  FOOD_KEYWORD_GROUPS,
  FOOD_STAND_INS,
} from './food-household-table';
export type { FoodStandIn } from './food-household-table';

// ---------------------------------------------------------------------------------------------------------
// Ersatz für fehlende Alltags-Lebensmittel („Emmentaler“ → Werte wie Gouda, Richtwert)
// ---------------------------------------------------------------------------------------------------------

/** Ersatz-Objekt → Katalog-Lebensmittel, dessen Werte gelten. */
const STAND_IN_BASE = new WeakMap<object, Food>();
const STAND_IN_CACHE = new WeakMap<FoodLookup, Map<string, Food>>();

/**
 * Katalog plus Ersatz-Lebensmittel (`FOOD_STAND_INS`): nur, wenn die echte ID fehlt und der Ersatz im Katalog ist.
 * Der Ersatz trägt Name und Suchbegriffe des fehlenden Lebensmittels, Art und Nährwerte des Ersatzes; Einheiten des
 * Katalogs (Stück, EL, TL) gelten nicht (nur ml-Umrechnung). Gleiche Eingabe → dasselbe Ergebnis-Objekt (Cache).
 */
export function withStandIns(foods: FoodLookup): ReadonlyMap<string, Food> {
  const cached = STAND_IN_CACHE.get(foods);
  if (cached) return cached;
  const result = new Map(foods);
  for (const item of FOOD_STAND_INS) {
    const base = foods.get(item.base);
    if (foods.has(item.id) || base === undefined) continue;
    const food: Food = {
      ...base,
      id: item.id,
      name_de: item.name_de,
      aliases_de: [...item.aliases_de],
      units: base.units.ml_to_g === undefined ? {} : { ml_to_g: base.units.ml_to_g },
    };
    STAND_IN_BASE.set(food, base);
    result.set(item.id, food);
  }
  STAND_IN_CACHE.set(foods, result);
  return result;
}

/** Katalog-Lebensmittel hinter einem Ersatz (null = echtes Lebensmittel). */
export function standInBase(food: object): Food | null {
  return STAND_IN_BASE.get(food) ?? null;
}

/** Titel eines Eintrags aus einem Ersatz: „Emmentaler (≈ Gouda)“. */
export function standInTitle(name: string, baseName: string): string {
  return `${name} (≈ ${baseName})`;
}

/** Einheit bei der Eingabe: Tagebuch-Einheit oder Haushaltsmenge (Stück steckt in beiden – gleiche Bedeutung). */
export const FOOD_AMOUNT_UNITS = ['g', 'ml', ...HOUSEHOLD_UNITS] as const;
export type FoodAmountUnit = (typeof FOOD_AMOUNT_UNITS)[number];

/** Eine wählbare Einheit eines Lebensmittels; `grams` = Gramm je Einheit (bei g = 1, bei ml = Umrechnung). */
export interface FoodAmountOption {
  readonly unit: FoodAmountUnit;
  readonly grams: number;
}

const C = FOOD_HOUSEHOLD_LIMITS.count;

const multipleOf = (step: number) => (value: number) =>
  Math.abs(Math.round(value / step) * step - value) < 1e-9;

/** true = gültige Anzahl einer Haushaltsmenge (0,5–20 in ½-Schritten). */
export function isValidHouseholdCount(count: number): boolean {
  return Number.isFinite(count) && count >= C.min && count <= C.max && multipleOf(C.step)(count);
}

function isHousehold(unit: FoodAmountUnit): unit is HouseholdUnit {
  return (HOUSEHOLD_UNITS as readonly string[]).includes(unit);
}

/** Stückgewicht aus der Einkaufsliste (lose Ware bzw. Packung in Stück mit Gewicht je Stück). */
function shoppingPieceGrams(foodId: string): number | null {
  const buy = SHOPPING_BUY_UNITS[foodId];
  if (buy === undefined) return null;
  if (buy.kind === 'loose') return buy.pieceG;
  if (buy.kind === 'pack' && buy.measure === 'pcs' && buy.gPerUnit !== undefined) {
    return buy.gPerUnit;
  }
  return null;
}

/**
 * Haushaltsmengen eines Lebensmittels, Vorauswahl zuerst: eigene Einträge des Lebensmittels, dann das Stückgewicht
 * der Einkaufsliste („1 Banane“), dann die Standards seiner Art(en). Die Einheiten des Katalogs (`piece_g`, `tbsp_g`, `tsp_g`)
 * haben immer Vorrang vor der Tabelle. Jede Einheit höchstens einmal.
 */
export function householdUnitsFor(
  food: Pick<Food, 'id' | 'name_de' | 'source' | 'units'>,
): HouseholdUnitGrams[] {
  const list: HouseholdUnitGrams[] = [];
  const add = (item: HouseholdUnitGrams) => {
    if (item.grams > 0 && !list.some((x) => x.unit === item.unit)) list.push(item);
  };
  const own =
    HOUSEHOLD_UNITS_BY_FOOD[food.id] ??
    (STAND_IN_BASE.has(food) ? HOUSEHOLD_UNITS_BY_STAND_IN[food.id] : undefined) ??
    [];
  for (const item of own) add(item);
  const shoppingPiece = shoppingPieceGrams(food.id);
  if (shoppingPiece !== null) add({ unit: 'piece', grams: shoppingPiece });
  for (const group of foodKeywordGroups(food)) for (const item of group.units) add(item);
  const catalog: Partial<Record<HouseholdUnit, number | undefined>> = {
    piece: food.units.piece_g,
    tbsp: food.units.tbsp_g,
    tsp: food.units.tsp_g,
  };
  for (const [unit, grams] of Object.entries(catalog) as [HouseholdUnit, number | undefined][]) {
    if (grams === undefined || grams <= 0) continue;
    const at = list.findIndex((x) => x.unit === unit);
    if (at >= 0) list[at] = { unit, grams };
    else list.push({ unit, grams });
  }
  // Rückfall je Kategorie: Jedes Lebensmittel hat mindestens eine Haushaltsmenge (Gründer-Vorgabe 14.11.2026).
  if (list.length === 0)
    for (const item of HOUSEHOLD_UNITS_BY_CATEGORY[food.source.category]) add(item);
  return list;
}

/**
 * Alle wählbaren Einheiten: Haushaltsmengen (Vorauswahl zuerst), dann Gramm, dann ml (nur mit Umrechnung im Katalog).
 * Ohne Haushaltsmenge ist Gramm die Vorauswahl.
 */
export function foodAmountOptions(
  food: Pick<Food, 'id' | 'name_de' | 'source' | 'units'>,
): FoodAmountOption[] {
  const options: FoodAmountOption[] = householdUnitsFor(food).map((x) => ({ ...x }));
  options.push({ unit: 'g', grams: 1 });
  if (foodLogUnitsFor(food).includes('ml') && food.units.ml_to_g !== undefined) {
    options.push({ unit: 'ml', grams: food.units.ml_to_g });
  }
  return options;
}

/** Vorbelegte Menge je Einheit: Haushaltsmenge 1, Gramm/ml 100. */
export function defaultFoodAmount(unit: FoodAmountUnit): number {
  return unit === 'g' || unit === 'ml' ? 100 : 1;
}

export type FoodAmountResolved =
  | {
      readonly ok: true;
      readonly amount: number;
      readonly unit: FoodLogUnit;
      readonly grams: number;
    }
  | { readonly ok: false; readonly reason: 'unit' | 'amount' };

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Menge + Eingabe-Einheit → Tagebuch-Menge: g/ml unverändert (Grenzen des Tagebuchs gelten), Stück mit Gewicht im
 * Katalog bleibt Stück, jede andere Haushaltsmenge → Gramm (Anzahl × Gramm je Einheit, eine Nachkommastelle). `unit` = Einheit nicht für dieses Lebensmittel, `amount` =
 * Anzahl ungültig oder umgerechnet außerhalb 1–2.000 g.
 */
export function resolveFoodAmount(
  food: Pick<Food, 'id' | 'name_de' | 'source' | 'units'>,
  amount: number,
  unit: FoodAmountUnit,
): FoodAmountResolved {
  const option = foodAmountOptions(food).find((o) => o.unit === unit);
  if (option === undefined) return { ok: false, reason: 'unit' };
  if (!isHousehold(unit)) {
    const logUnit: FoodLogUnit = unit;
    const grams = amount * option.grams;
    if (
      !Number.isFinite(amount) ||
      amount < FOOD_LOG_LIMITS.amountMass.min ||
      amount > FOOD_LOG_LIMITS.amountMass.max ||
      !multipleOf(0.1)(amount) ||
      grams > FOOD_LOG_LIMITS.gramsMax
    ) {
      return { ok: false, reason: 'amount' };
    }
    return { ok: true, amount, unit: logUnit, grams };
  }
  if (!isValidHouseholdCount(amount)) return { ok: false, reason: 'amount' };
  // Stück mit Gewicht im Katalog: wie bisher als Stück speichern (gleiche Einträge wie vor dem 14.11.2026).
  if (unit === 'piece' && food.units.piece_g !== undefined && food.units.piece_g > 0) {
    const grams = amount * food.units.piece_g;
    if (grams > FOOD_LOG_LIMITS.gramsMax) return { ok: false, reason: 'amount' };
    return { ok: true, amount, unit: 'piece', grams };
  }
  const grams = round1(amount * option.grams);
  if (grams < FOOD_LOG_LIMITS.amountMass.min || grams > FOOD_LOG_LIMITS.gramsMax) {
    return { ok: false, reason: 'amount' };
  }
  return { ok: true, amount: grams, unit: 'g', grams };
}

/** Tagebuch-Eintrag aus Lebensmittel + Menge in beliebiger Eingabe-Einheit (Werte wie `entryFromFood`). */
export function entryFromFoodAmount(
  food: Pick<Food, 'id' | 'name_de' | 'source' | 'units' | 'nutrients_per_100g'>,
  amount: number,
  unit: FoodAmountUnit,
  target: FoodLogTarget,
): FoodLogBuild {
  const resolved = resolveFoodAmount(food, amount, unit);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  // Ersatz: Werte und Verweis vom Katalog-Lebensmittel, Titel „Emmentaler (≈ Gouda)“ (Richtwert).
  const base = standInBase(food);
  if (base !== null) {
    const build = entryFromFood(base, resolved.amount, resolved.unit, target);
    return build.ok
      ? finishFoodLogEntry({ ...build.entry, title_de: standInTitle(food.name_de, base.name_de) })
      : build;
  }
  return entryFromFood(food, resolved.amount, resolved.unit, target);
}

// ---------------------------------------------------------------------------------------------------------
// Korb: „Mahlzeit zusammenstellen“
// ---------------------------------------------------------------------------------------------------------

/** Ein Lebensmittel im Korb (Zod an der Grenze, z. B. beim Wiederherstellen aus dem Speicher). */
export const basketItemSchema = z.strictObject({
  food_id: contentIdSchema,
  amount: z.number().finite(),
  unit: z.enum(FOOD_AMOUNT_UNITS),
});
export type BasketItem = z.infer<typeof basketItemSchema>;

export const basketSchema = z.array(basketItemSchema).max(FOOD_HOUSEHOLD_LIMITS.basketMaxItems);

/**
 * Lebensmittel in den Korb legen: Gleiches Lebensmittel mit gleicher Einheit wird zusammengezählt (2 + 1 Scheiben =
 * 3 Scheiben), sonst hinten angehängt. null = Korb voll bzw. Summe über der Grenze.
 */
export function addToBasket(basket: readonly BasketItem[], item: BasketItem): BasketItem[] | null {
  const at = basket.findIndex((x) => x.food_id === item.food_id && x.unit === item.unit);
  if (at >= 0) {
    const current = basket[at];
    if (current === undefined) return null;
    const merged = { ...current, amount: round1(current.amount + item.amount) };
    const max = isHousehold(item.unit) ? C.max : FOOD_LOG_LIMITS.amountMass.max;
    if (merged.amount > max) return null;
    return basket.map((x, i) => (i === at ? merged : x));
  }
  if (basket.length >= FOOD_HOUSEHOLD_LIMITS.basketMaxItems) return null;
  return [...basket, { ...item }];
}

/** Ein Lebensmittel aus dem Korb nehmen (Position). */
export function removeFromBasket(basket: readonly BasketItem[], index: number): BasketItem[] {
  return basket.filter((_, i) => i !== index);
}

export type BasketError = FoodLogBuildError | 'empty' | 'missing_food';
export type BasketEntries =
  | { readonly ok: true; readonly entries: FoodLogEntry[] }
  | { readonly ok: false; readonly reason: BasketError; readonly index: number | null };

/**
 * Alle Lebensmittel des Korbs als Tagebuch-Einträge (je Lebensmittel ein Eintrag, gleicher Tag und Platz, neue ids).
 * Alles oder nichts: Ist ein Lebensmittel ungültig, entsteht kein Eintrag (`index` zeigt es).
 */
export function basketEntries(
  basket: readonly BasketItem[],
  foods: FoodLookup,
  target: { readonly date: string; readonly slot: FoodLogSlot },
  newId: () => string,
): BasketEntries {
  if (basket.length === 0) return { ok: false, reason: 'empty', index: null };
  if (basket.length > FOOD_HOUSEHOLD_LIMITS.basketMaxItems) {
    return { ok: false, reason: 'invalid', index: null };
  }
  const entries: FoodLogEntry[] = [];
  for (const [index, item] of basket.entries()) {
    const food = foods.get(item.food_id);
    if (food === undefined) return { ok: false, reason: 'missing_food', index };
    const build = entryFromFoodAmount(food, item.amount, item.unit, {
      id: newId(),
      date: target.date,
      slot: target.slot,
    });
    if (!build.ok) return { ok: false, reason: build.reason, index };
    entries.push(build.entry);
  }
  return { ok: true, entries };
}

/** Zutaten eines eigenen Gerichts aus dem Korb (Haushaltsmengen in Gramm umgerechnet). null = Korb ungültig. */
export function basketCustomMealItems(
  basket: readonly BasketItem[],
  foods: FoodLookup,
): CustomMealItem[] | null {
  if (basket.length === 0 || basket.length > CUSTOM_MEAL_LIMITS.maxItems) return null;
  const items: CustomMealItem[] = [];
  for (const item of basket) {
    const food = foods.get(item.food_id);
    if (food === undefined) return null;
    const resolved = resolveFoodAmount(food, item.amount, item.unit);
    if (!resolved.ok) return null;
    // Ersatz: Zutat ist das Katalog-Lebensmittel (eigene Gerichte rechnen nur mit dem Katalog).
    const foodId = standInBase(food)?.id ?? item.food_id;
    items.push({ food_id: foodId, amount: resolved.amount, unit: resolved.unit });
  }
  return items;
}

/** Eingabe für `buildCustomMeal`: Korb als Gericht „Aus Zutaten“ mit 1 Portion. null = Korb ungültig. */
export function basketCustomMealInput(
  basket: readonly BasketItem[],
  foods: FoodLookup,
  meal: { readonly id: string; readonly name: string },
): {
  readonly id: string;
  readonly name: string;
  readonly mode: 'ingredients';
  readonly servings: 1;
  readonly items: CustomMealItem[];
} | null {
  const items = basketCustomMealItems(basket, foods);
  if (items === null) return null;
  return { id: meal.id, name: meal.name, mode: 'ingredients', servings: 1, items };
}

/** Name ohne Klammerzusatz („Cornflakes (ungezuckert)“ → „Cornflakes“). */
function shortName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Auf höchstens `max` Zeichen (Code-Points) kürzen, am Wortende. */
function clip(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  const cut = chars.slice(0, max).join('');
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : cut).replace(/[\s,]+$/u, '');
}

/**
 * Namensvorschlag für den Korb als Favorit: Brot + ein Belag mit Stamm → „Käsebrot“, „Wurstbrot“ (Butter zählt neben
 * einem anderen Belag nicht mit); sonst „Erstes mit Zweitem und Drittem“ (ohne Klammerzusätze, höchstens 60 Zeichen).
 * Leerer Korb → „Meine Mahlzeit“.
 */
export function suggestBasketName(basket: readonly BasketItem[], foods: FoodLookup): string {
  const list = basket
    .map((item) => foods.get(item.food_id))
    .filter((food): food is Food => food !== undefined);
  if (list.length === 0) return 'Meine Mahlzeit';
  const groups = list.map((food) => foodKeywordGroups(food));
  const breadCount = groups.filter((g) => g.some((x) => x.isBread === true)).length;
  if (breadCount === 1 && list.length >= 2) {
    const toppings = list
      .map((food, i) => ({ food, groups: groups[i] ?? [] }))
      .filter((x) => !x.groups.some((g) => g.isBread === true));
    const stems = toppings
      .map(
        ({ food, groups: g }) =>
          BREAD_STEM_BY_FOOD[food.id] ??
          g.find((x) => x.breadStem !== undefined)?.breadStem ??
          null,
      )
      .filter((stem): stem is string => stem !== null);
    const main = stems.filter((s) => s !== 'Butter');
    const unique = [...new Set(main.length > 0 ? main : stems)];
    if (unique.length === 1 && stems.length === toppings.length) return `${unique[0] ?? ''}brot`;
  }
  // Bowl: Joghurt/Quark/Skyr + mindestens zwei weitere Zutaten → „Joghurt-Bowl“.
  if (list.length >= 3) {
    const bowl = groups.flat().find((g) => g.bowlName !== undefined)?.bowlName;
    if (bowl !== undefined) return bowl;
  }
  const names = list.map((food) => shortName(food.name_de));
  const [first, ...rest] = names;
  if (rest.length === 0) return clip(first ?? 'Meine Mahlzeit', CUSTOM_MEAL_LIMITS.nameMaxChars);
  const tail =
    rest.length === 1 ? rest[0] : `${rest.slice(0, -1).join(', ')} und ${rest.at(-1) ?? ''}`;
  return clip(`${first ?? ''} mit ${tail ?? ''}`, CUSTOM_MEAL_LIMITS.nameMaxChars);
}

// ---------------------------------------------------------------------------------------------------------
// Plan-Mahlzeit: wie geplant, etwas anderes oder offen
// ---------------------------------------------------------------------------------------------------------

export type PlanSlotStatus = 'open' | 'eaten' | 'replaced';

/**
 * Zustand einer Plan-Mahlzeit an einem Tag: `eaten` = „Wie geplant gegessen“ abgehakt; `replaced` = nicht abgehakt,
 * aber für genau diesen Platz etwas anderes eingetragen („Etwas anderes gegessen“) – die Plan-Mahlzeit zählt dann
 * weder als offen noch als gegessen (die Tagessumme enthält nur, was eingetragen ist); sonst `open`.
 */
export function planSlotStatus(
  entries: readonly Pick<FoodLogEntry, 'source' | 'eaten_on' | 'slot'>[],
  date: string,
  slot: FoodLogSlot,
): PlanSlotStatus {
  const sameDay = entries.filter((e) => e.eaten_on === date && e.slot === slot);
  if (sameDay.some((e) => e.source === 'plan_item')) return 'eaten';
  return sameDay.length > 0 ? 'replaced' : 'open';
}

/** Anzahl ersetzter Plan-Mahlzeiten eines Tages (Plätze des Plans). */
export function replacedPlanSlotCount(
  entries: readonly Pick<FoodLogEntry, 'source' | 'eaten_on' | 'slot'>[],
  date: string,
  slots: readonly FoodLogSlot[],
): number {
  return [...new Set(slots)].filter((slot) => planSlotStatus(entries, date, slot) === 'replaced')
    .length;
}

// ---------------------------------------------------------------------------------------------------------
// Schnellauswahl oben im Eintragen-Bildschirm
// ---------------------------------------------------------------------------------------------------------

/**
 * Eigene Gerichte für einen Platz: zuerst die, die zuletzt in derselben Gruppe (Frühstück, Mittag, Abend, Snack)
 * eingetragen wurden (neueste zuerst), dann die übrigen in der gegebenen Reihenfolge.
 */
export function orderCustomMealsForSlot<T extends Pick<CustomMeal, 'id'>>(
  meals: readonly T[],
  entries: readonly (Pick<FoodLogEntry, 'source' | 'custom_meal_id' | 'slot'> & {
    readonly created_at: string;
    readonly updated_at?: string;
  })[],
  slot: FoodLogSlot,
): T[] {
  const group = foodLogGroup(slot);
  const last = new Map<string, string>();
  for (const e of entries) {
    if (e.source !== 'custom_meal' || e.custom_meal_id === null) continue;
    if (foodLogGroup(e.slot) !== group) continue;
    const use = e.updated_at ?? e.created_at;
    if ((last.get(e.custom_meal_id) ?? '') < use) last.set(e.custom_meal_id, use);
  }
  const indexed = meals.map((meal, index) => ({ meal, index }));
  return indexed
    .sort(
      (a, b) =>
        (last.get(b.meal.id) ?? '').localeCompare(last.get(a.meal.id) ?? '') || a.index - b.index,
    )
    .map((x) => x.meal);
}

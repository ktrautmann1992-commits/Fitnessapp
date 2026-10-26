import { z } from 'zod';

import { EATING_OUT } from '../constants';
import { type Food, type FoodLookup, isCatalogReviewed } from '../content/food-schema';
import { contentIdSchema } from '../content/schemas';
import { type FoodLogBuild, type FoodLogTarget, quickEntry } from './food-log';
import { computeRecipeFacts } from './recipe-nutrients';
import { EATING_OUT_DISHES, EATING_OUT_PENDING_FOODS } from './eating-out-mapping';
import {
  EATING_OUT_CATEGORIES,
  type EatingOutCategory,
  type EatingOutDishDef,
  type EatingOutMissingFood,
  type EatingOutPortionKind,
} from './eating-out-table';

export * from './eating-out-mapping';
export * from './eating-out-table';

/**
 * Auswärts essen (Reiter „Unterwegs“ beim Eintragen, Gründer-Freigabe 25.10.2026, KONZEPT 6.1): typische Gerichte aus
 * Restaurant, Imbiss, Kantine, Bäckerei, Café und Fast Food mit Portionswahl – gratis, ohne KI, nur Schätzwerte.
 *
 * - Werte NUR aus dem Lebensmittel-Katalog: Zutaten der Zuordnungsdatei (`content/food-mapping/auswaerts-zuordnung.json`,
 *   geladen in `eating-out-mapping.ts`) mit derselben Rechnung wie Rezepte und eigene Gerichte (`computeRecipeFacts`).
 *   Fehlt eine Zutat im (geladenen) Katalog – z. B. weil sie noch auf den Import über `foods-import` wartet –, ist
 *   das Gericht `unavailable`: ohne Werte, nie mit erfundenen Zahlen und ohne Ersatz durch „ähnliche“ Lebensmittel.
 * - Gerundet auf `EATING_OUT.kcalStep` kcal und ganze Gramm (keine Scheingenauigkeit), angezeigt mit „ca.“.
 * - Ins Tagebuch als Schnelleintrag „Auswärts gegessen“ (`quickEntry`, feste Bezeichnung, kein Freitext – dieselben
 *   Grenzen und dieselbe Datenbank-Prüfung wie jeder Schnelleintrag). Bei „Kalorienzahlen aus“ ohne Werte.
 * - Sichtbar: freigegebene Gerichte immer, Entwürfe nur mit `allowDrafts` (Testmodus, wie Rezept-Entwürfe).
 */

export interface EatingOutPortion {
  readonly id: string;
  readonly label: string;
  readonly factor: number;
}

export interface EatingOutValues {
  readonly kcal: number;
  readonly protein_g: number;
  readonly carbs_g: number;
  readonly fat_g: number;
}

export type EatingOutDishView =
  | {
      readonly kind: 'ok';
      readonly dish: EatingOutDishDef;
      /** Werte der normalen Portion (gerundet). */
      readonly normal: EatingOutValues;
      readonly portions: readonly EatingOutPortion[];
      readonly isDraft: boolean;
    }
  | {
      readonly kind: 'unavailable';
      readonly dish: EatingOutDishDef;
      /** Katalog-IDs der Zutaten, die im geladenen Katalog fehlen bzw. (ohne Entwürfe) nicht nutzbar sind. */
      readonly missingFoods: readonly string[];
      readonly isDraft: boolean;
    };

/** Portionsauswahl einer Art (Faktoren aus `EATING_OUT.portions`). */
export function eatingOutPortions(kind: EatingOutPortionKind): readonly EatingOutPortion[] {
  return EATING_OUT.portions[kind];
}

/** Standard-Portion einer Art: „normal“, bei Pizza „ganze Pizza“, bei Stückware „1 Stück“. */
export function defaultEatingOutPortion(kind: EatingOutPortionKind): string {
  return kind === 'pizza' ? 'whole' : kind === 'piece' ? 'one' : 'normal';
}

function roundStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Schätzwerte runden (10 kcal, ganze Gramm). */
export function roundEatingOutValues(values: EatingOutValues): EatingOutValues {
  return {
    kcal: roundStep(values.kcal, EATING_OUT.kcalStep),
    protein_g: roundStep(values.protein_g, EATING_OUT.macroStep),
    carbs_g: roundStep(values.carbs_g, EATING_OUT.macroStep),
    fat_g: roundStep(values.fat_g, EATING_OUT.macroStep),
  };
}

/**
 * Darf ein Katalog-Lebensmittel für Schätzwerte genutzt werden? Ohne Entwürfe (Supabase-Modus) wie `filter.ts`:
 * veröffentlicht UND katalog-geprüft (R19). Mit Entwürfen (Testmodus, nur für die Gründer-Prüfung) jedes nicht
 * archivierte Lebensmittel – das Gericht trägt dann ohnehin „Entwurf“ und „Schätzwert“.
 */
export function eatingOutFoodUsable(food: Food | undefined, allowDrafts: boolean): boolean {
  if (food === undefined || food.status === 'archived') return false;
  return allowDrafts || (food.status === 'published' && isCatalogReviewed(food));
}

/**
 * Ungerundete Werte einer NORMALEN Portion aus dem Katalog – null, wenn eine Zutat fehlt (nicht im Katalog bzw. nicht
 * nutzbar, siehe `eatingOutFoodUsable`), eine Menge nicht positiv ist oder das Gericht keine Zutaten hat.
 */
export function eatingOutRawValues(
  dish: Pick<EatingOutDishDef, 'items'>,
  foods: FoodLookup,
  allowDrafts = false,
): EatingOutValues | null {
  if (dish.items.length === 0) return null;
  if (
    dish.items.some(
      ([foodId, grams]) => !eatingOutFoodUsable(foods.get(foodId), allowDrafts) || !(grams > 0),
    )
  ) {
    return null;
  }
  const facts = computeRecipeFacts(
    {
      ingredients: dish.items.map(([food_id, amount]) => ({
        food_id,
        amount,
        unit: 'g' as const,
        optional: false,
        scales: true,
      })),
      servings: 1,
      no_cook: false,
      steps_de: [],
    },
    foods,
  );
  if (facts.missingFoods.length > 0 || facts.unconvertible.length > 0) return null;
  const n = facts.perServing;
  return { kcal: n.kcal, protein_g: n.protein_g, carbs_g: n.carbs_g, fat_g: n.fat_g };
}

/** Werte für eine gewählte Portion (gerundet); null = Portion unbekannt oder Gericht nicht berechenbar. */
export function eatingOutPortionValues(
  dish: EatingOutDishDef,
  portionId: string,
  foods: FoodLookup,
  allowDrafts = false,
): EatingOutValues | null {
  const portion = eatingOutPortions(dish.portion).find((p) => p.id === portionId);
  const raw = eatingOutRawValues(dish, foods, allowDrafts);
  if (portion === undefined || raw === null) return null;
  return roundEatingOutValues({
    kcal: raw.kcal * portion.factor,
    protein_g: raw.protein_g * portion.factor,
    carbs_g: raw.carbs_g * portion.factor,
    fat_g: raw.fat_g * portion.factor,
  });
}

/** Ansicht eines Gerichts für die App (Werte der normalen Portion oder „nicht verfügbar“ mit fehlenden Zutaten). */
export function eatingOutDishView(
  dish: EatingOutDishDef,
  foods: FoodLookup,
  allowDrafts = false,
): EatingOutDishView {
  const isDraft = dish.status !== 'released';
  const raw = eatingOutRawValues(dish, foods, allowDrafts);
  if (raw === null) {
    const missingFoods = dish.items
      .filter(([foodId]) => !eatingOutFoodUsable(foods.get(foodId), allowDrafts))
      .map(([foodId]) => foodId);
    return { kind: 'unavailable', dish, missingFoods, isDraft };
  }
  return {
    kind: 'ok',
    dish,
    normal: roundEatingOutValues(raw),
    portions: eatingOutPortions(dish.portion),
    isDraft,
  };
}

export interface EatingOutCatalogInput {
  readonly foods: FoodLookup;
  /** Entwürfe zeigen (Testmodus). */
  readonly allowDrafts: boolean;
  readonly category?: EatingOutCategory | null;
  readonly text?: string | null;
  /** Andere Tabelle (Tests); Standard: `EATING_OUT_DISHES`. */
  readonly dishes?: readonly EatingOutDishDef[];
}

function fold(text: string): string {
  return text
    .toLocaleLowerCase('de-DE')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Auswahlliste „Unterwegs“: nur berechenbare Gerichte, Entwürfe nur mit `allowDrafts`; optional nach Kategorie und
 * Text (alle Wörter, Umlaute gefaltet). Reihenfolge: Kategorie (feste Reihenfolge), dann Tabellen-Reihenfolge.
 */
export function eatingOutCatalog(
  input: EatingOutCatalogInput,
): Extract<EatingOutDishView, { kind: 'ok' }>[] {
  const words = input.text ? fold(input.text).split(' ').filter(Boolean) : [];
  const order = new Map(EATING_OUT_CATEGORIES.map((c, i) => [c, i]));
  const out: Extract<EatingOutDishView, { kind: 'ok' }>[] = [];
  for (const dish of input.dishes ?? EATING_OUT_DISHES) {
    if (dish.status !== 'released' && !input.allowDrafts) continue;
    if (input.category && dish.category !== input.category) continue;
    if (words.length > 0) {
      const name = fold(dish.name_de);
      if (!words.every((w) => name.includes(w))) continue;
    }
    const view = eatingOutDishView(dish, input.foods, input.allowDrafts);
    if (view.kind === 'ok') out.push(view);
  }
  return out
    .map((view, index) => ({ view, index }))
    .sort(
      (a, b) =>
        (order.get(a.view.dish.category) ?? 0) - (order.get(b.view.dish.category) ?? 0) ||
        a.index - b.index,
    )
    .map((x) => x.view);
}

/** Gericht nach ID. */
export function eatingOutDish(
  id: string,
  dishes: readonly EatingOutDishDef[] = EATING_OUT_DISHES,
): EatingOutDishDef | undefined {
  return dishes.find((dish) => dish.id === id);
}

/**
 * Tagebuch-Eintrag „Auswärts gegessen“ (Schnelleintrag) mit den gerundeten Schätzwerten der Portion. `showNumbers`
 * false („Kalorienzahlen aus“) → ohne Werte. Nicht berechenbar → `invalid`.
 */
export function entryFromEatingOut(
  dish: EatingOutDishDef,
  portionId: string,
  foods: FoodLookup,
  target: FoodLogTarget,
  options: { readonly showNumbers?: boolean; readonly allowDrafts?: boolean } = {},
): FoodLogBuild {
  const showNumbers = options.showNumbers ?? true;
  const values = eatingOutPortionValues(dish, portionId, foods, options.allowDrafts ?? false);
  if (values === null) return { ok: false, reason: 'invalid' };
  if (!showNumbers) {
    return quickEntry(
      { label: 'Auswärts gegessen', kcal: null, protein_g: null, carbs_g: null, fat_g: null },
      target,
    );
  }
  return quickEntry({ label: 'Auswärts gegessen', ...values }, target);
}

// ---------------------------------------------------------------------------------------------------------
// „Zuletzt“ und Favoriten im Reiter „Unterwegs“ (nur Gerät, nur IDs und Portion)
// ---------------------------------------------------------------------------------------------------------

export const eatingOutPickSchema = z.strictObject({
  dishId: contentIdSchema,
  portionId: z.string().min(1).max(20),
});
export type EatingOutPick = z.infer<typeof eatingOutPickSchema>;

export const eatingOutPicksSchema = z.strictObject({
  recent: z.array(eatingOutPickSchema).max(EATING_OUT.recentMax).default([]),
  favorites: z.array(contentIdSchema).max(EATING_OUT.favoritesMax).default([]),
});
export type EatingOutPicks = z.infer<typeof eatingOutPicksSchema>;

export const EMPTY_EATING_OUT_PICKS: EatingOutPicks = { recent: [], favorites: [] };

/** Gespeicherte Auswahl lesen (ungültig → leer, nie werfen). */
export function parseEatingOutPicks(value: unknown): EatingOutPicks {
  const parsed = eatingOutPicksSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : EMPTY_EATING_OUT_PICKS;
}

/** Nach dem Eintragen: Gericht (mit Portion) vorn in „Zuletzt“, ein Gericht nur einmal, höchstens `recentMax`. */
export function withEatingOutRecent(picks: EatingOutPicks, pick: EatingOutPick): EatingOutPicks {
  return {
    ...picks,
    recent: [pick, ...picks.recent.filter((p) => p.dishId !== pick.dishId)].slice(
      0,
      EATING_OUT.recentMax,
    ),
  };
}

/** Favorit an/aus; neue Favoriten vorn, höchstens `favoritesMax` (ältester fällt weg). */
export function toggleEatingOutFavorite(picks: EatingOutPicks, dishId: string): EatingOutPicks {
  const has = picks.favorites.includes(dishId);
  return {
    ...picks,
    favorites: has
      ? picks.favorites.filter((id) => id !== dishId)
      : [dishId, ...picks.favorites].slice(0, EATING_OUT.favoritesMax),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Inhaltsstand (für Doku, Redaktion und Tests)
// ---------------------------------------------------------------------------------------------------------

export interface EatingOutContentStatus {
  readonly total: number;
  readonly released: number;
  /** Mit dem geladenen Katalog berechenbar (mit `allowDrafts` auch aus ungeprüften Katalog-Entwürfen). */
  readonly computable: readonly string[];
  /** Katalog-Lebensmittel (IDs), die noch geprüft/veröffentlicht werden müssen, mit Anzahl betroffener Gerichte. */
  readonly unreviewedFoods: readonly { readonly foodId: string; readonly dishes: number }[];
  /** Gerichte ohne Werte mit den fehlenden bzw. nicht nutzbaren Katalog-IDs. */
  readonly blocked: readonly { readonly id: string; readonly missing: readonly string[] }[];
  /**
   * Zutaten, die im Katalog GAR NICHT vorhanden sind („wartet auf Import“), mit Suchbegriffen/Quell-ID aus dem
   * Abschnitt `foods` der Zuordnung und Anzahl betroffener Gerichte – die Liste für den nächsten `foods-import`-Lauf.
   * Ohne Eintrag in `foods` (z. B. aus alpha5-zuordnung.json) stehen Name = ID und keine Suchbegriffe.
   */
  readonly missingFoods: readonly (EatingOutMissingFood & { readonly dishes: number })[];
}

export function eatingOutContentStatus(
  foods: FoodLookup,
  dishes: readonly EatingOutDishDef[] = EATING_OUT_DISHES,
  allowDrafts = false,
  pending: readonly EatingOutMissingFood[] = EATING_OUT_PENDING_FOODS,
): EatingOutContentStatus {
  const computable: string[] = [];
  const blocked: { id: string; missing: string[] }[] = [];
  const missing = new Map<string, EatingOutMissingFood & { dishes: number }>();
  const unreviewed = new Map<string, number>();
  const pendingById = new Map(pending.map((p) => [p.food_id, p]));
  for (const dish of dishes) {
    const view = eatingOutDishView(dish, foods, allowDrafts);
    if (view.kind === 'ok') computable.push(dish.id);
    else blocked.push({ id: dish.id, missing: [...view.missingFoods] });
    for (const foodId of new Set(dish.items.map(([id]) => id))) {
      const food = foods.get(foodId);
      if (food === undefined) {
        const known = pendingById.get(foodId) ?? {
          food_id: foodId,
          name_de: foodId,
          search_de: [],
          source_ref: null,
        };
        missing.set(foodId, { ...known, dishes: (missing.get(foodId)?.dishes ?? 0) + 1 });
      } else if (!eatingOutFoodUsable(food, false)) {
        unreviewed.set(foodId, (unreviewed.get(foodId) ?? 0) + 1);
      }
    }
  }
  return {
    total: dishes.length,
    released: dishes.filter((dish) => dish.status === 'released').length,
    computable,
    unreviewedFoods: [...unreviewed.entries()]
      .map(([foodId, count]) => ({ foodId, dishes: count }))
      .sort((a, b) => b.dishes - a.dishes || (a.foodId < b.foodId ? -1 : 1)),
    blocked,
    missingFoods: [...missing.values()].sort(
      (a, b) => b.dishes - a.dishes || a.name_de.localeCompare(b.name_de, 'de'),
    ),
  };
}

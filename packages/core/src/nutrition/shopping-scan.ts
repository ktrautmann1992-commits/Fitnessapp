import { z } from 'zod';

import { SHOPPING_LIST_ROUNDING, SHOPPING_SCAN } from '../constants';
import { contentIdSchema } from '../content/schemas';
import type { FoodLookup, FoodSource, ShoppingCategory } from '../content/food-schema';
import { barcodeSchema } from './barcode';
import type {
  FoodProductBaseUnit,
  FoodProductCheck,
  ProductPer100,
  UserFoodProduct,
} from './food-product';
import type { ShoppingList, ShoppingListItem } from './shopping-list';

/**
 * Strichcode im Laden (Reiter „Einkaufen“, docs/PLAN-EINKAUFEN-AUSDAUER.md 3, Gründer-Entscheidung EA-G1 vom
 * 20.10.2026): Passt ein gescanntes Produkt zu einem Eintrag der Einkaufsliste? Reine Regeln – die App fragt das
 * Produkt wie beim Eintragen ab (eigene Produkte und gelernte Zuordnungen zuerst, ohne Netz; sonst über unseren
 * Server) und hakt nur ab, was diese Funktion EINDEUTIG zuordnet.
 *
 * Reihenfolge:
 * 1. **Gelernte Zuordnung** Strichcode → Lebensmittel (`shopping_product_links`, nur eigene, bestätigte Wahl aus der
 *    Auswahl): offene Einträge mit diesem Lebensmittel. Steht das Lebensmittel nicht (offen) auf der Liste, gilt das
 *    Ergebnis – kein Rückfall auf den Namen (die Person hat das Produkt bewusst diesem Lebensmittel zugeordnet).
 * 2. **Name**: Produktname gegen Bezeichnung des Eintrags sowie Name, Mehrzahl und Synonyme (`aliases_de`) des
 *    Lebensmittels bzw. den Text eigener Einträge. Eine feste Zuordnung „Produkt von Open Food Facts → Lebensmittel“
 *    gibt es bewusst nicht (docs/PLAN-E4.md X0: OFF-Daten bleiben getrennt vom Katalog, Marken nie auf der Liste).
 *    Normalisiert (`normalizeProductName`): klein, Umlaute/ß gefaltet, ohne Marke, Klammern, Mengen, Werbe-/Füllwörter,
 *    einfache Mehrzahl-Endungen gekappt. Punktzahl: 3 = alle Wörter ganz, 2 = alle Wörter (teils als Wortteil,
 *    „Milch“ ↔ „Vollmilch“), 1 = nur das erste Wort ganz (Katalog-Namen „Hauptwort Zusatz“: „Reis parboiled“ ↔
 *    „Basmati Reis“).
 * 3. Genau ein offener Eintrag in der besten Stufe → `match`; mehrere (auch dasselbe Lebensmittel in g und Stück) →
 *    `choose` (höchstens `SHOPPING_SCAN.candidatesMax`); nur abgehakte Treffer → `already_checked`; sonst `none` mit
 *    vorgeschlagener Abteilung. Vorrat zählt mit, aber nach den übrigen offenen Einträgen.
 * Keine Gesundheitsdaten in Logs; Namen und Nummern werden nie geloggt.
 */

/** Wörter ohne Aussagekraft für den Abgleich (bereits gefaltet, vor dem Kappen der Endungen). */
const FILLER_WORDS: ReadonlySet<string> = new Set([
  'am',
  'an',
  'auf',
  'aus',
  'beutel',
  'bio',
  'classic',
  'das',
  'dem',
  'den',
  'der',
  'des',
  'die',
  'dose',
  'ein',
  'eine',
  'extra',
  'fein',
  'feine',
  'feiner',
  'fettarm',
  'fettarme',
  'flasche',
  'frisch',
  'frische',
  'frischer',
  'frisches',
  'fuer',
  'g',
  'gekocht',
  'getrocknet',
  'glas',
  'im',
  'in',
  'kernig',
  'kernige',
  'kg',
  'klassisch',
  'l',
  'leicht',
  'light',
  'ml',
  'mit',
  'namen',
  'natur',
  'neu',
  'ohne',
  'original',
  'pack',
  'packung',
  'premium',
  'produkt',
  'roh',
  'stk',
  'stueck',
  'tiefgekuehlt',
  'tk',
  'und',
  'vom',
  'von',
  'zart',
  'zarte',
  'zum',
  'zur',
]);

function fold(text: string): string {
  return text
    .toLocaleLowerCase('de')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Einfache Mehrzahl-/Beugungsendung kappen (-en, -n, -e, -s), nur wenn genug übrig bleibt. */
function stem(token: string): string {
  for (const ending of ['en', 'n', 'e', 's']) {
    if (token.endsWith(ending) && token.length - ending.length >= SHOPPING_SCAN.stemMinChars) {
      return token.slice(0, -ending.length);
    }
  }
  return token;
}

/**
 * Name → normalisierte Wörter (siehe Modulkommentar). `brand`: Marke(n), kommagetrennt wie bei Open Food Facts – ihre
 * Wörter werden entfernt. Steuer- und unsichtbare Zeichen zählen als Trenner. Deterministisch, ohne Doppel.
 */
export function normalizeProductName(name: string, brand?: string | null): string[] {
  const brandWords = new Set(
    (brand ?? '')
      .split(',')
      .flatMap((b) => fold(b).split(/[^a-z0-9]+/))
      .filter((w) => w.length >= 2),
  );
  const tokens = fold(name.replace(/\([^)]*\)/g, ' '))
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !/\d/.test(t) && !FILLER_WORDS.has(t) && !brandWords.has(t))
    .map(stem);
  return [...new Set(tokens)];
}

/** 2 = Wort kommt ganz vor, 1 = als Teil eines zusammengesetzten Worts, 0 = gar nicht. */
function tokenScore(term: string, product: readonly string[]): 0 | 1 | 2 {
  if (product.includes(term)) return 2;
  if (term.length < SHOPPING_SCAN.compoundMinChars) return 0;
  return product.some((p) => p.length > term.length && (p.endsWith(term) || p.startsWith(term)))
    ? 1
    : 0;
}

type Score = 0 | 1 | 2 | 3;

/** Bestes Ergebnis über alle Bezeichnungen eines Eintrags (siehe Modulkommentar); `weak` = irgendein Wort passt. */
function itemScore(
  names: readonly string[],
  product: readonly string[],
): { score: Score; weak: boolean } {
  let best: Score = 0;
  let weak = false;
  for (const name of names) {
    const terms = normalizeProductName(name);
    if (terms.length === 0) continue;
    const scores = terms.map((term) => tokenScore(term, product));
    if (scores.some((s) => s > 0)) weak = true;
    const score: Score = !scores.includes(0)
      ? scores.every((s) => s === 2)
        ? 3
        : 2
      : scores[0] === 2
        ? 1
        : 0;
    if (score > best) best = score;
  }
  return { score: best, weak };
}

/** Bezeichnungen eines Eintrags: Text der Liste, dazu Name, Mehrzahl und Synonyme des Lebensmittels. */
function itemNames(item: ShoppingListItem, foods: FoodLookup | undefined): string[] {
  const names = [item.labelDe];
  const food = item.foodId === null ? undefined : foods?.get(item.foodId);
  if (food !== undefined) {
    names.push(food.name_de, ...(food.name_de_plural ? [food.name_de_plural] : []));
    names.push(...food.aliases_de);
  }
  return names;
}

/** Gelernte Zuordnung Strichcode → Lebensmittel (eigene Wahl aus der Auswahl; Tabelle `shopping_product_links`). */
export const shoppingProductLinkSchema = z.strictObject({
  code: barcodeSchema,
  food_id: contentIdSchema,
});
export type ShoppingProductLink = z.infer<typeof shoppingProductLinkSchema>;

export interface ScannedProduct {
  /** Geprüfte Nummer (`normalizeScannedBarcode`/`normalizeBarcode`); null = ohne Nummer (Name eingetippt). */
  readonly code: string | null;
  /** Name des Produkts (OFF bzw. eigenes Produkt); null = unbekannt (nur gelernte Zuordnung möglich). */
  readonly productName: string | null;
  readonly brand?: string | null;
}

export type ShoppingScanMatch =
  /** Genau ein offener Eintrag passt eindeutig → sofort abhaken (mit „Rückgängig“, EA-3). */
  | { readonly kind: 'match'; readonly itemKey: string; readonly item: ShoppingListItem }
  /** Mehrere passen gleich gut → die Person wählt (+ „Keiner davon“); Reihenfolge der Liste. */
  | { readonly kind: 'choose'; readonly candidates: readonly ShoppingListItem[] }
  /** Kein offener, aber ein abgehakter Eintrag passt. */
  | { readonly kind: 'already_checked'; readonly itemKey: string; readonly item: ShoppingListItem }
  /** Nicht auf der Liste – „Zusätzlich hinzufügen?“ mit vorgeschlagener Abteilung. */
  | { readonly kind: 'none'; readonly suggestedCategory: ShoppingCategory };

function decide(
  scored: readonly { item: ShoppingListItem; score: number }[],
): ShoppingScanMatch | null {
  const hits = scored.filter((e) => e.score > 0);
  const open = hits.filter((e) => !e.item.checked);
  if (open.length === 0) {
    const checked = [...hits].sort((a, b) => b.score - a.score)[0];
    return checked === undefined
      ? null
      : { kind: 'already_checked', itemKey: checked.item.itemKey, item: checked.item };
  }
  const best = Math.max(...open.map((e) => e.score));
  let top = open.filter((e) => e.score === best);
  // Vorrat nach den übrigen offenen Einträgen.
  if (top.some((e) => !e.item.isPantry)) top = top.filter((e) => !e.item.isPantry);
  const [first] = top;
  if (top.length === 1 && first !== undefined) {
    return { kind: 'match', itemKey: first.item.itemKey, item: first.item };
  }
  return {
    kind: 'choose',
    candidates: top.slice(0, SHOPPING_SCAN.candidatesMax).map((e) => e.item),
  };
}

/**
 * Gescanntes Produkt mit der Einkaufsliste abgleichen (siehe Modulkommentar). `foods` = Katalog (Synonyme, Abteilung),
 * `links` = eigene gelernte Zuordnungen.
 */
export function matchScannedProduct(
  product: ScannedProduct,
  list: Pick<ShoppingList, 'items'>,
  foods?: FoodLookup,
  links: readonly ShoppingProductLink[] = [],
): ShoppingScanMatch {
  const link = product.code === null ? undefined : links.find((l) => l.code === product.code);
  if (link !== undefined) {
    const linked = decide(
      list.items.filter((i) => i.foodId === link.food_id).map((item) => ({ item, score: 3 })),
    );
    return (
      linked ?? {
        kind: 'none',
        suggestedCategory: foods?.get(link.food_id)?.shopping_category ?? 'other',
      }
    );
  }
  const tokens =
    product.productName === null ? [] : normalizeProductName(product.productName, product.brand);
  if (tokens.length === 0) return { kind: 'none', suggestedCategory: 'other' };
  const scored = list.items.map((item) => ({
    item,
    ...itemScore(itemNames(item, foods), tokens),
  }));
  const decided = decide(scored);
  if (decided !== null) return decided;
  const weak = scored.find((e) => e.weak);
  return { kind: 'none', suggestedCategory: weak?.item.category ?? 'other' };
}

/**
 * Bezeichnung für einen gescannten Artikel, der zusätzlich auf die Liste kommt: nur der Produktname (nie die Marke,
 * X0), Steuerzeichen entfernt, Leerraum zusammengefasst, auf die Länge eigener Einträge gekürzt. null = kein Name.
 */
export function manualItemFromProduct(name: string): string | null {
  const clean = name
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean === '') return null;
  const cut = [...clean].slice(0, SHOPPING_LIST_ROUNDING.manualLabelMaxChars).join('').trim();
  return cut === '' ? null : cut;
}

/**
 * Gelernte Zuordnung speichern (rein): ersetzt eine vorhandene derselben Nummer; höchstens `SHOPPING_SCAN.linksMax`
 * je Person (dann die älteste zuerst raus – Liste in Speicher-Reihenfolge, neueste zuletzt). Geprüft mit Zod.
 */
export function withShoppingProductLink(
  links: readonly ShoppingProductLink[],
  link: ShoppingProductLink,
): ShoppingProductLink[] {
  const parsed = shoppingProductLinkSchema.parse(link);
  const next = [...links.filter((l) => l.code !== parsed.code), parsed];
  return next.slice(Math.max(0, next.length - SHOPPING_SCAN.linksMax));
}

/**
 * Nährwerte zum gescannten Produkt (Wunsch des Gründers vom 22.10.2026: „Beim Barcode Scanner einkaufen sollen auch die
 * Nährwerte angezeigt werden“). Reine Auswahl, keine Rechnung – die App zeigt das Ergebnis nur an:
 * 1. **Eigenes Produkt** mit dieser Nummer → dessen Werte („Deine Angaben“).
 * 2. **Produktabfrage** (Open Food Facts bzw. Attrappe) → Werte je 100 g/ml samt Prüfstufe; bei `blocked` sind alle
 *    Werte null (die App zeigt dann keine Zahlen, nur den Hinweis).
 * 3. **Gelernte Zuordnung** zu einem Katalog-Lebensmittel → dessen Werte je 100 g samt Quelle (BLS), nur wenn das
 *    Lebensmittel im Katalog steht.
 * Sonst null (nichts anzeigen). Nichts wird gespeichert; Nummern und Namen kommen im Ergebnis nicht vor.
 */
export type ScanNutrition =
  | {
      readonly source: 'product';
      readonly baseUnit: FoodProductBaseUnit;
      readonly per100: ProductPer100;
      readonly check: FoodProductCheck;
      /** Testmodus mit Attrappe (ausgedachte Testwerte). */
      readonly mock: boolean;
      /** Abrufzeit der Produktdaten (Quellenangabe „abgerufen am …“). */
      readonly retrievedAt: string;
    }
  | {
      readonly source: 'own';
      readonly baseUnit: FoodProductBaseUnit;
      readonly per100: ProductPer100;
    }
  | {
      readonly source: 'catalog';
      readonly baseUnit: 'g';
      readonly per100: ProductPer100;
      readonly foodSource: FoodSource;
    };

export interface ScanNutritionInput {
  /** Eigenes Produkt mit der gescannten Nummer (`userProductForCode`), sonst null. */
  readonly own: Pick<
    UserFoodProduct,
    'base_unit' | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'sugar_g' | 'salt_g'
  > | null;
  /** Antwort der Produktabfrage (`code: 'found'`), sonst null. */
  readonly found: {
    readonly product: {
      readonly base_unit: FoodProductBaseUnit;
      readonly per100: ProductPer100;
      readonly source: { readonly retrieved_at: string };
    };
    readonly check: FoodProductCheck;
    readonly mock: boolean;
  } | null;
  /** Lebensmittel der gelernten Zuordnung (food_id), sonst null. */
  readonly linkedFoodId: string | null;
}

const EMPTY_PER100: ProductPer100 = {
  kcal: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  sugar_g: null,
  sat_fat_g: null,
  fiber_g: null,
  salt_g: null,
};

export function scanNutrition(input: ScanNutritionInput, foods?: FoodLookup): ScanNutrition | null {
  if (input.own !== null) {
    const o = input.own;
    return {
      source: 'own',
      baseUnit: o.base_unit,
      per100: {
        ...EMPTY_PER100,
        kcal: o.kcal,
        protein_g: o.protein_g,
        carbs_g: o.carbs_g,
        fat_g: o.fat_g,
        sugar_g: o.sugar_g,
        salt_g: o.salt_g,
      },
    };
  }
  if (input.found !== null) {
    const { product, check, mock } = input.found;
    return {
      source: 'product',
      baseUnit: product.base_unit,
      // Gesperrt: nie Zahlen weitergeben, auch wenn die Antwort welche enthielte.
      per100: check.level === 'blocked' ? EMPTY_PER100 : product.per100,
      check,
      mock,
      retrievedAt: product.source.retrieved_at,
    };
  }
  if (input.linkedFoodId === null) return null;
  const food = foods?.get(input.linkedFoodId);
  if (food === undefined) return null;
  const n = food.nutrients_per_100g;
  return {
    source: 'catalog',
    baseUnit: 'g',
    per100: {
      kcal: n.kcal,
      protein_g: n.protein_g,
      carbs_g: n.carbs_g,
      fat_g: n.fat_g,
      sugar_g: n.sugar_g,
      sat_fat_g: n.sat_fat_g,
      fiber_g: n.fiber_g,
      salt_g: n.salt_g,
    },
    foodSource: food.source,
  };
}

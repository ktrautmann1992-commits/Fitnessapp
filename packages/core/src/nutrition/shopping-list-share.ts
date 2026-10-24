import { z } from 'zod';

import { isoDateSchema } from '../age';
import { SHOPPING_LIST_SHARE } from '../constants';
import { SHOPPING_CATEGORIES, SHOPPING_CATEGORY_LABELS_DE } from '../content/food-schema';
import { shoppingPurchase } from './shopping-buy-units';
import { roundShoppingAmount, type ShoppingList, type ShoppingUnit } from './shopping-list';
import { stableHash } from './stable-hash';

/**
 * Einkaufsliste weitergeben (docs/PLAN-PHASE-5.md 19.7 N12, 19.8 Nr. 8, KONZEPT 6.13/18, Etappe N12, gratis).
 *
 * „Weitergeben“ = **privates Weitergeben durch die Person selbst** über den System-Teilen-Dialog (WhatsApp, Notizen,
 * Erinnerungen) bzw. Kopieren – kein öffentliches Teilen, kein Profil, kein Feed, keine Sichtbarkeit für andere
 * Nutzer (KONZEPT 18, „Kein Teilen, keine Community“ bleibt unberührt). Nichts geht an einen Server.
 *
 * Der Text enthält NUR Produktarten und Mengen (g/ml/Stück) nach Abteilung (5.5), optional Vorrat und eigene
 * Einträge, optional erledigte Einträge – **ohne kcal, ohne Gründe, ohne Körpergewicht, ohne Ziele, ohne
 * Unverträglichkeiten, ohne „statt …“, ohne App-Link, ohne Werbung/Affiliate**. Links kommen nur vor, wenn die Person
 * sie selbst in einen eigenen Eintrag schreibt; dort wird nur der Anhang ab „?“/„#“ (Tracking-/Partner-Parameter)
 * entfernt und `javascript:`/`vbscript:` unschädlich gemacht – eine weitergehende Link-Erkennung gibt es bewusst nicht
 * (Kurzlinks oder Domains ohne Schema bleiben stehen, Wächter N12 H2). Datenminimierung über das Schema: Die Eingabe
 * wird auf die nötigen Felder reduziert (`shareableListSchema`), alles andere (`usesHealthData`, `substituteFor`,
 * Markierungen) erreicht den Textaufbau gar nicht; `foodId` dient nur der Einkaufs-Einheit und steht nie im Text.
 *
 * Bewusste Ausnahme wie beim PDF (Plan 11, K4): Ein Ersatzprodukt bzw. eine ausgetauschte Zutat steht mit ihrem
 * Namen in der Liste (sonst würde falsch eingekauft) und kann auf eine Unverträglichkeit schließen lassen – deshalb
 * der Hinweis VOR dem Weitergeben (`shoppingListShareNotice`, Vormerkung N9 S5).
 */

/** Feste Texte (Deutsch; Struktur für weitere Sprachen vorbereitet, CLAUDE.md i18n). */
export interface ShoppingListShareTexts {
  readonly title: (from: string, to: string) => string;
  readonly pantry: string;
  readonly toTaste: string;
  readonly done: string;
  readonly piece: string;
  readonly truncated: (count: number) => string;
}

export const SHOPPING_LIST_SHARE_TEXTS_DE: ShoppingListShareTexts = {
  title: (from, to) => `Einkaufsliste ${from} – ${to}`,
  pantry: 'Vorrat (hast du wahrscheinlich da)',
  toTaste: 'nach Geschmack',
  done: 'erledigt',
  piece: 'Stück',
  truncated: (count) =>
    `… und ${count} ${count === 1 ? 'weiterer Eintrag' : 'weitere Einträge'} (Liste zu lang – nutze das PDF)`,
};

/** Auswahl in der Ansicht „Weitergeben“ (Zod an der Grenze; Standard: nur Offenes, mit Vorrat und eigenen). */
export const shoppingListShareOptionsSchema = z.strictObject({
  /** Erledigte (abgehakte) Einträge mitnehmen – mit „(erledigt)“. „Häkchen optional“ (19.7 N12). */
  includeChecked: z.boolean().default(false),
  /** Vorrat („hast du wahrscheinlich da“) als eigener Abschnitt am Ende. */
  includePantry: z.boolean().default(true),
  /** Eigene Einträge (Freitext der Person, unverändert bis auf die Bereinigung). */
  includeManual: z.boolean().default(true),
});

export type ShoppingListShareOptions = z.output<typeof shoppingListShareOptionsSchema>;
export type ShoppingListShareOptionsInput = z.input<typeof shoppingListShareOptionsSchema>;

/**
 * Was der Textaufbau von einem Eintrag sehen darf. `z.object` (nicht strikt) entfernt alle anderen Felder – so kann
 * nichts Gesundheitsbezogenes (Ersatz-Hinweise, Gesundheitsbezug der Liste, Lebensmittel-IDs, Markierungen) in den
 * Text geraten, auch nicht durch einen späteren Programmierfehler.
 */
const shareableItemSchema = z.object({
  labelDe: z.string(),
  /** Nur für die Kaufeinheit („1 Netz Kartoffeln (2 kg)“, `shoppingPurchase`); erscheint selbst nicht im Text. */
  foodId: z.string().nullable().optional(),
  amount: z.number().nullable(),
  unit: z.enum(['g', 'ml', 'piece']).nullable(),
  category: z.enum(SHOPPING_CATEGORIES),
  isPantry: z.boolean(),
  isManual: z.boolean(),
  checked: z.boolean(),
  notInPlan: z.boolean(),
});

const shareableListSchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    items: z.array(shareableItemSchema),
  })
  .refine((l) => l.from <= l.to, 'Der Zeitraum endet vor seinem Beginn.');

type ShareableItem = z.output<typeof shareableItemSchema>;

export type ShoppingListShareInput = Pick<ShoppingList, 'from' | 'to' | 'items'>;

export type ShoppingListShareResult =
  | {
      readonly ok: true;
      readonly text: string;
      /** Einträge im Text (ohne Überschriften). */
      readonly itemCount: number;
      /** Wegen `SHOPPING_LIST_SHARE.maxChars` nicht mehr im Text (sichtbar vermerkt), sonst 0. */
      readonly omittedForLength: number;
    }
  | {
      readonly ok: false;
      /**
       * `empty` = Liste ohne Einträge; `nothing_selected` = mit dieser Auswahl bleibt nichts übrig; `invalid` =
       * Eingabe ungültig (z. B. Zeitraum endet vor dem Beginn) – nie ein Wurf während der Anzeige (Wächter N12 H5).
       */
      readonly reason: 'empty' | 'nothing_selected' | 'invalid';
    };

/**
 * Unsichtbare bzw. leer wirkende Zeichen, die IMMER entfernt werden (Wächter N12 S1): die ganze Unicode-Kategorie Cf
 * (Formatzeichen: weiches Trennzeichen U+00AD, Bidi-Steuerung, Zero-Width, Wortverbinder, unsichtbare
 * Rechenzeichen U+2061–2064, veraltete Formatzeichen U+206A–206F, Interlinear-Anmerkung U+FFF9–FFFB, Tag-Zeichen
 * U+E0000–E007F („ASCII-Smuggling“) …) sowie Combining Grapheme Joiner U+034F, Hangul-Füller U+115F/U+1160/U+3164/
 * U+FFA0, Khmer U+17B4/17B5, Mongolische Variantenwähler U+180B–180F und Variantenwähler U+FE00–FE0F,
 * U+E0100–E01EF. Ausnahmen nur innerhalb von Emoji-Sequenzen: ZWJ U+200D zwischen zwei Emojis und U+FE0E/U+FE0F
 * direkt nach einem Emoji bzw. einer Tastenkappen-Basis (`emojiContextKeeps`).
 */
const INVISIBLE_RANGES: readonly (readonly [number, number])[] = [
  [0x00ad, 0x00ad],
  [0x034f, 0x034f],
  [0x0600, 0x0605],
  [0x061c, 0x061c],
  [0x06dd, 0x06dd],
  [0x070f, 0x070f],
  [0x0890, 0x0891],
  [0x08e2, 0x08e2],
  [0x115f, 0x1160],
  [0x17b4, 0x17b5],
  [0x180b, 0x180f],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x206f],
  [0x3164, 0x3164],
  [0xfe00, 0xfe0f],
  [0xfeff, 0xfeff],
  [0xffa0, 0xffa0],
  [0xfff9, 0xfffb],
  [0x110bd, 0x110bd],
  [0x110cd, 0x110cd],
  [0x13430, 0x1343f],
  [0x1bca0, 0x1bca3],
  [0x1d173, 0x1d17a],
  [0xe0000, 0xe007f],
  [0xe0100, 0xe01ef],
];

function isInvisible(code: number): boolean {
  return INVISIBLE_RANGES.some(([from, to]) => code >= from && code <= to);
}

function isControl(code: number): boolean {
  return code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029;
}

/** Emoji-Erkennung: Unicode-Eigenschaft, falls die Laufzeit sie kennt, sonst die üblichen Emoji-Blöcke. */
const PICTOGRAPHIC: RegExp | null = (() => {
  try {
    return new RegExp('^\\p{Extended_Pictographic}$', 'u');
  } catch {
    return null;
  }
})();

function isPictographic(code: number): boolean {
  if (PICTOGRAPHIC !== null) return PICTOGRAPHIC.test(String.fromCodePoint(code));
  return (
    (code >= 0x1f000 && code <= 0x1faff) ||
    (code >= 0x2600 && code <= 0x27bf) ||
    (code >= 0x2190 && code <= 0x23ff) ||
    (code >= 0x2b00 && code <= 0x2bff) ||
    [0x00a9, 0x00ae, 0x203c, 0x2049, 0x2122, 0x2139, 0x3030, 0x303d, 0x3297, 0x3299].includes(code)
  );
}

const isSkinTone = (code: number) => code >= 0x1f3fb && code <= 0x1f3ff;
const isKeycapBase = (code: number) =>
  (code >= 0x30 && code <= 0x39) || code === 0x23 || code === 0x2a;

/** ZWJ/Variantenwähler nur innerhalb einer Emoji-Sequenz behalten. */
function emojiContextKeeps(code: number, previous: number | null, next: number | null): boolean {
  if (previous === null) return false;
  if (code === 0x200d) {
    const prevEmoji = isPictographic(previous) || isSkinTone(previous) || previous === 0xfe0f;
    return prevEmoji && next !== null && isPictographic(next);
  }
  if (code === 0xfe0f || code === 0xfe0e) return isPictographic(previous) || isKeycapBase(previous);
  return false;
}

/** Link-Anhang ab „?“ oder „#“ (Tracking-, Partner- und Affiliate-Parameter stehen dort) – auch ohne Wortgrenze. */
const LINK_WITH_QUERY = /((?:https?:\/\/|www\.)[^\s?#]*)[?#]\S*/gi;
/** Skript-Schemata werden ganz ersetzt (in manchen Ziel-Apps klickbar). */
const SCRIPT_LINK = /(?:javascript|vbscript):\S*/gi;
const SCRIPT_LINK_REPLACEMENT = '[Link entfernt]';

type Segmenter = new (
  locale: string,
  options: { granularity: 'grapheme' },
) => { segment(text: string): Iterable<{ segment: string }> };

/** Graphem-Cluster (Intl.Segmenter, falls vorhanden; sonst Codepunkte) – Wächter N12 H1. */
function graphemes(text: string): string[] {
  const SegmenterClass = (Intl as unknown as { Segmenter?: Segmenter }).Segmenter;
  if (typeof SegmenterClass === 'function') {
    return Array.from(
      new SegmenterClass('de', { granularity: 'grapheme' }).segment(text),
      (s) => s.segment,
    );
  }
  return [...text];
}

/**
 * Bereinigt einen Eintrag für den Klartext („Escaping“ für Teilen-Ziele ohne Auszeichnungssprache):
 * Unicode-NFC (Umlaute einheitlich), Steuerzeichen und Zeilenumbrüche → Leerzeichen (eine Zeile je Eintrag, kein
 * Einschleusen von Überschriften), alle unsichtbaren Zeichen entfernt (`INVISIBLE_RANGES`; kein versteckter Text,
 * keine vertauschte Leserichtung), einzelne Surrogate entfernt, Emojis bleiben (ZWJ und Variantenwähler nur innerhalb
 * von Emoji-Sequenzen), Links ohne Anhang ab „?“/„#“, `javascript:`/`vbscript:` ersetzt, Leerraum zusammengefasst,
 * höchstens `labelMaxChars` Graphem-Cluster (mit „…“, ohne halbe Emojis).
 */
export function sanitizeShareLabel(raw: string): string {
  const codes = Array.from(raw.normalize('NFC'), (char) => char.codePointAt(0) ?? 0);
  let cleaned = '';
  let previous: number | null = null;
  for (let i = 0; i < codes.length; i += 1) {
    const code = codes[i] as number;
    if (code >= 0xd800 && code <= 0xdfff) continue; // einzelnes Surrogat
    if (isInvisible(code)) {
      if (!emojiContextKeeps(code, previous, codes[i + 1] ?? null)) continue;
    } else if (isControl(code)) {
      cleaned += ' ';
      previous = null;
      continue;
    }
    cleaned += String.fromCodePoint(code);
    previous = code;
  }
  cleaned = cleaned
    .replace(SCRIPT_LINK, SCRIPT_LINK_REPLACEMENT)
    .replace(LINK_WITH_QUERY, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const clusters = graphemes(cleaned);
  const max = SHOPPING_LIST_SHARE.labelMaxChars;
  return clusters.length > max ? `${clusters.slice(0, max - 1).join('')}…` : cleaned;
}

function groupThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Datum „2026-10-12“ → „12.10.2026“. */
function dateDe(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/**
 * Menge im Text: auf Kaufschritte gerundet (`roundShoppingAmount`, idempotent für Listen aus `buildShoppingList`),
 * ganze Zahlen mit Tausenderpunkt („1.250 g“, „3 Stück“). Ungültige Mengen (≤ 0, NaN, ∞, über
 * `SHOPPING_LIST_SHARE.maxAmount`) → ohne Menge (nie Exponentialschreibweise, Wächter N12 H5).
 */
export function shareAmountText(
  amount: number | null,
  unit: ShoppingUnit | null,
  texts: ShoppingListShareTexts = SHOPPING_LIST_SHARE_TEXTS_DE,
): string | null {
  if (amount === null || unit === null || !Number.isFinite(amount) || amount <= 0) return null;
  const rounded = roundShoppingAmount(amount, unit);
  if (rounded > SHOPPING_LIST_SHARE.maxAmount) return null;
  return `${groupThousands(rounded)} ${unit === 'piece' ? texts.piece : unit}`;
}

function itemLine(item: ShareableItem, texts: ShoppingListShareTexts): string | null {
  const label = sanitizeShareLabel(item.labelDe);
  if (label.length === 0) return null;
  const amount = shareAmountText(item.amount, item.unit, texts);
  let body: string;
  // Lebensmittel aus dem Plan: wie im Laden („2 Packungen Hähnchenbrustfilet (à 600 g)“, „Olivenöl (Vorrat prüfen)“).
  const purchase = item.isManual
    ? null
    : shoppingPurchase({
        foodId: item.foodId,
        labelDe: label,
        amount: amount === null ? null : item.amount,
        unit: item.unit,
      });
  if (purchase !== null) body = purchase.text;
  else if (amount !== null) body = `${amount} ${label}`;
  else if (item.isManual) body = label;
  else body = `${label} – ${texts.toTaste}`;
  return `- ${body}${item.checked ? ` (${texts.done})` : ''}`;
}

function selected(item: ShareableItem, options: ShoppingListShareOptions): boolean {
  if (item.notInPlan) return false; // abgehakt und nicht mehr im Plan – wie im PDF
  if (item.checked && !options.includeChecked) return false;
  if (item.isPantry && !options.includePantry) return false;
  if (item.isManual && !options.includeManual) return false;
  return true;
}

/**
 * Die Einkaufsliste als Klartext zum Weitergeben (19.7 N12 `shoppingListToText`). Aufbau: Titel mit Zeitraum,
 * Abteilungen in fester Reihenfolge (5.5) mit Einträgen in Kaufeinheiten („- 1 Packung Haferflocken (500 g)“, „- 3
 * Bananen“, „- Salz (Vorrat prüfen)“, eigene Einträge wie eingegeben), am Ende der Vorrat. Deterministisch (gleiche Eingabe → gleicher Text,
 * Reihenfolge der Einträge innerhalb der Abteilung wie in der Liste). Leere Liste → `empty`.
 */
export function shoppingListToText(
  list: ShoppingListShareInput,
  optionsInput: ShoppingListShareOptionsInput = {},
  texts: ShoppingListShareTexts = SHOPPING_LIST_SHARE_TEXTS_DE,
): ShoppingListShareResult {
  const parsedOptions = shoppingListShareOptionsSchema.safeParse(optionsInput);
  const parsedList = shareableListSchema.safeParse(list);
  if (!parsedOptions.success || !parsedList.success) return { ok: false, reason: 'invalid' };
  const options = parsedOptions.data;
  const { from, to, items } = parsedList.data;
  if (items.length === 0) return { ok: false, reason: 'empty' };

  const sections: { heading: string; lines: string[] }[] = [];
  const regular = items.filter((item) => !item.isPantry && selected(item, options));
  // SHOPPING_CATEGORIES ist die feste Reihenfolge der Abteilungen (5.5).
  for (const category of SHOPPING_CATEGORIES) {
    const lines = regular
      .filter((item) => item.category === category)
      .map((item) => itemLine(item, texts))
      .filter((line): line is string => line !== null);
    if (lines.length > 0) sections.push({ heading: SHOPPING_CATEGORY_LABELS_DE[category], lines });
  }
  const pantryLines = items
    .filter((item) => item.isPantry && selected(item, options))
    .map((item) => itemLine(item, texts))
    .filter((line): line is string => line !== null);
  if (pantryLines.length > 0) sections.push({ heading: texts.pantry, lines: pantryLines });

  const total = sections.reduce((sum, s) => sum + s.lines.length, 0);
  if (total === 0) return { ok: false, reason: 'nothing_selected' };

  // Zusammensetzen; bei Überlänge sichtbar kürzen (ganze Zeilen, Hinweis mit Anzahl).
  const max = SHOPPING_LIST_SHARE.maxChars;
  const reserve = texts.truncated(total).length + 2;
  let text = texts.title(dateDe(from), dateDe(to));
  let written = 0;
  sectionLoop: for (const section of sections) {
    const heading = `\n\n${section.heading}`;
    // Überschrift nur mit mindestens einem Eintrag darunter (keine leere Abteilung am Ende).
    const first = section.lines[0] ?? '';
    if (text.length + heading.length + 1 + first.length + reserve > max) break;
    text += heading;
    for (const line of section.lines) {
      if (text.length + 1 + line.length + reserve > max) break sectionLoop;
      text += `\n${line}`;
      written += 1;
    }
  }
  const omitted = total - written;
  if (omitted > 0) text += `\n\n${texts.truncated(omitted)}`;
  return { ok: true, text, itemCount: written, omittedForLength: omitted };
}

/** Hinweis vor dem Weitergeben (19.7 N12 „wie K4“, Vormerkung N9 S5). */
export interface ShoppingListShareNotice {
  /** Hinweis muss vor dem Weitergeben bestätigt werden. */
  readonly required: boolean;
  /** Die Liste stammt aus einem Plan mit Gesundheitsbezug (7.1). */
  readonly usesHealthData: boolean;
  /**
   * Ersatz-Einträge der gewählten Auswahl, die eine Zutat des Rezepts ersetzen (Ersatzprodukt oder Zutaten-Austausch,
   * N9) – bereinigt, ohne Doppelte, in Listen-Reihenfolge. Sichere Richtung (Wächter N12 H4): auch Einträge, die
   * wegen der Längengrenze am Ende gekürzt würden, werden genannt. Nur für die Anzeige auf dem eigenen Gerät; der
   * Grund steht nirgends.
   */
  readonly substituteLabels: readonly string[];
}

/** Bei ungültiger Auswahl gilt die weiteste Auswahl (sichere Richtung: eher ein Hinweis zu viel). */
const WIDEST_OPTIONS: ShoppingListShareOptions = {
  includeChecked: true,
  includePantry: true,
  includeManual: true,
};

/**
 * Ob vor dem Weitergeben ein Hinweis nötig ist: bei Gesundheitsbezug der Liste (`usesHealthData`) oder wenn die
 * gewählte Auswahl Ersatzprodukte bzw. ausgetauschte Zutaten enthält. Nie ein Wurf: ungültige Einträge zählen als
 * ausgewählt (sichere Richtung).
 */
export function shoppingListShareNotice(
  list: Pick<ShoppingList, 'usesHealthData' | 'items'>,
  optionsInput: ShoppingListShareOptionsInput = {},
): ShoppingListShareNotice {
  const parsedOptions = shoppingListShareOptionsSchema.safeParse(optionsInput);
  const options = parsedOptions.success ? parsedOptions.data : WIDEST_OPTIONS;
  const labels: string[] = [];
  for (const item of list.items) {
    if (item.substituteFor.length === 0 || item.isManual) continue;
    const parsed = shareableItemSchema.safeParse(item);
    if (parsed.success && !selected(parsed.data, options)) continue;
    const label = sanitizeShareLabel(String(item.labelDe));
    if (label.length > 0 && !labels.includes(label)) labels.push(label);
  }
  return {
    required: list.usesHealthData || labels.length > 0,
    usesHealthData: list.usesHealthData,
    substituteLabels: labels,
  };
}

/**
 * Schlüssel für „Hinweis bestätigt“ (Wächter N12 S3): Eine Bestätigung gilt nur für genau diesen Stand – Zeitraum
 * (`from`/`to`, damit auch die Woche), Gesundheitsbezug, genannte Ersatz-Einträge und der Text selbst (Prüfsumme).
 * Ändert sich eines davon (z. B. Wochenwechsel um Mitternacht, andere Mengen), muss erneut bestätigt werden.
 */
export function shoppingListShareNoticeKey(
  list: Pick<ShoppingList, 'from' | 'to' | 'usesHealthData' | 'items'>,
  optionsInput: ShoppingListShareOptionsInput = {},
): string {
  const notice = shoppingListShareNotice(list, optionsInput);
  const result = shoppingListToText(list, optionsInput);
  return JSON.stringify([
    list.from,
    list.to,
    notice.usesHealthData,
    notice.substituteLabels,
    result.ok ? stableHash(result.text) : result.reason,
    result.ok ? result.text.length : 0,
  ]);
}

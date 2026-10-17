import { z } from 'zod';

import {
  FOOD_LOG_LIMITS,
  FOOD_PRODUCT_CHECK,
  OPEN_FOOD_FACTS,
  RECIPE_CHECK_LIMITS,
  USER_FOOD_PRODUCT_LIMITS,
} from '../constants';
import { barcodeSchema } from './barcode';
import { CUSTOM_MEAL_NAME_EDGE_SPACE_CLASS, CUSTOM_MEAL_NAME_FORBIDDEN_CLASS } from './custom-meal';
import {
  finishFoodLogEntry,
  type FoodLogBuild,
  type FoodLogEntry,
  type FoodLogTarget,
  isValidFoodLogAmount,
  USER_PRODUCT_ENTRY_TITLE,
} from './food-log';

/**
 * Produkte per Barcode-Nummer (Etappe E4a, docs/PLAN-E4.md Abschnitte 2–4; gratis, ohne KI). Reine Logik ohne UI und
 * ohne Netz – gleich auf dem Server (Route POST /api/ernaehrung/produkt in apps/web) und im Testmodus der App:
 * - `sanitizeOffText`: Texte aus Open Food Facts (Crowd-Daten = unvertrauenswürdige Eingaben) bereinigen (4.1),
 * - `normalizeOffProduct`: OFF-Antwort → Werte je 100 g/ml (kJ → kcal, Natrium → Salz, Portion → 100 g, Einheit) (4.3),
 * - `checkProductNutrients`: zweistufige Prüfung (E4-G3): `blocked` (unmöglich/fehlend → Eintragen gesperrt) bzw.
 *   `review` (auffällig → Haken „mit der Packung verglichen“) (4.4),
 * - eigene Produkte (`userFoodProductSchema`, nur für die Person, 2.3/3.4),
 * - Tagebuch-Einträge mit Herkunft `product` (`entryFromProduct`, `entryFromUserProduct`) und die Server-Nachrechnung
 *   (`serverProductEntry`, gleiche Regeln wie save_food_log_entries/private.food_log_product_values, 3.5).
 *
 * Grenzen in `constants.ts` (OPEN_FOOD_FACTS, FOOD_PRODUCT_CHECK, USER_FOOD_PRODUCT_LIMITS). Datenschutz: keine
 * Produktdaten in Logs; Marken nur in der Produktansicht, im Tagebuch, unter „Zuletzt“ und „Favoriten“ (E4-G4), nie in
 * Vorschlägen, Plan, Einkaufsliste, Rezepten oder PDFs. OFF-Daten bleiben getrennt vom BLS-Katalog.
 */

const C = FOOD_PRODUCT_CHECK;
const U = USER_FOOD_PRODUCT_LIMITS;

export const FOOD_PRODUCT_BASE_UNITS = ['g', 'ml'] as const;
export type FoodProductBaseUnit = (typeof FOOD_PRODUCT_BASE_UNITS)[number];

export const FOOD_PRODUCT_CHECK_LEVELS = ['ok', 'review', 'blocked'] as const;
export type FoodProductCheckLevel = (typeof FOOD_PRODUCT_CHECK_LEVELS)[number];

/** Gründe, die das Eintragen aus OFF sperren (Plan 4.4 „blocked“). */
export const FOOD_PRODUCT_BLOCKING_REASONS = [
  'energy_missing',
  'macro_missing',
  'invalid_value',
  'kcal_too_high',
  'macro_too_high',
  'macro_sum_too_high',
  'kj_kcal_mismatch',
  'prepared_only',
] as const;
/** Gründe für „Werte prüfen“ (Plan 4.4 „review“). */
export const FOOD_PRODUCT_REVIEW_REASONS = [
  'atwater_mismatch',
  'kcal_from_kj',
  'from_serving',
  'unit_assumed',
  'sugar_over_carbs',
  'sat_fat_over_fat',
] as const;
/** Nur Hinweise (keine Stufe). */
export const FOOD_PRODUCT_INFO_REASONS = ['upper_bound', 'serving_ignored'] as const;
/** Alle Grund-Codes (sync: CHECK food_products.check_reasons, db-sync.test.ts). */
export const FOOD_PRODUCT_CHECK_REASONS = [
  ...FOOD_PRODUCT_BLOCKING_REASONS,
  ...FOOD_PRODUCT_REVIEW_REASONS,
  ...FOOD_PRODUCT_INFO_REASONS,
] as const;
export type FoodProductCheckReason = (typeof FOOD_PRODUCT_CHECK_REASONS)[number];

export interface FoodProductCheck {
  readonly level: FoodProductCheckLevel;
  /** Codes in fester Reihenfolge (FOOD_PRODUCT_CHECK_REASONS), ohne Doppelte. */
  readonly reasons: readonly FoodProductCheckReason[];
}

/** Platzhalter bei leerem Namen (Plan 2.2/4.1). */
export const PRODUCT_NAME_FALLBACK = 'Produkt ohne Namen';

const codePoints = (text: string) => [...text].length;
const round1 = (value: number) => Math.round(value * 10) / 10;

// ---------------------------------------------------------------------------------------------------------
// 4.1 Texte aus OFF bereinigen
// ---------------------------------------------------------------------------------------------------------

const FORBIDDEN = new RegExp(`[\\u0000${CUSTOM_MEAL_NAME_FORBIDDEN_CLASS}]`, 'gu');
const EDGE_SPACE = new RegExp(
  `^[${CUSTOM_MEAL_NAME_EDGE_SPACE_CLASS}]+|[${CUSTOM_MEAL_NAME_EDGE_SPACE_CLASS}]+$`,
  'gu',
);

/**
 * Crowd-Text → reiner Text (Plan 4.1): HTML/Markup und Links weg, Steuerzeichen, Zero-Width- und Bidi-Zeichen weg
 * (Zeichenklassen wie eigene Gerichte, E2 H1), Leerraum zusammengefasst, auf `maxChars` Zeichen (Code-Points) gekürzt.
 * Kein Text bzw. nur Leerraum → null. Die App zeigt das Ergebnis nur als Text an (nie als HTML).
 */
export function sanitizeOffText(raw: unknown, maxChars: number): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .slice(0, 4000)
    .replace(/<[^>]*>?/gu, ' ')
    .replace(/\b(?:https?:\/\/|www\.)\S*/giu, ' ')
    .replace(/[<>]/gu, ' ')
    .replace(FORBIDDEN, ' ')
    .replace(/\s+/gu, ' ')
    .replace(EDGE_SPACE, '')
    .trim();
  if (cleaned === '') return null;
  const cut = [...cleaned].slice(0, maxChars).join('');
  return cut.replace(EDGE_SPACE, '').trim() || null;
}

/** Marke = erste Angabe vor dem Komma (`brands` ist eine Komma-Liste). */
export function sanitizeOffBrand(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return sanitizeOffText(raw.split(',')[0] ?? '', C.brandMaxChars);
}

// ---------------------------------------------------------------------------------------------------------
// 4.4 Prüfstufen
// ---------------------------------------------------------------------------------------------------------

/** Eingabe der Prüfung: Werte je 100 g/ml (ungerundet), null = fehlt. */
export interface ProductCheckInput {
  readonly baseUnit: FoodProductBaseUnit;
  readonly kcal: number | null;
  /** Angegebene kJ (nur für den Abgleich kJ/kcal; null = nicht angegeben). */
  readonly kj?: number | null;
  readonly protein_g: number | null;
  readonly carbs_g: number | null;
  readonly fat_g: number | null;
  readonly sugar_g?: number | null;
  readonly sat_fat_g?: number | null;
  readonly fiber_g?: number | null;
  readonly salt_g?: number | null;
  readonly polyols_g?: number | null;
  /** Alkohol in GRAMM je 100 (aus % vol umgerechnet). */
  readonly alcohol_g?: number | null;
  /** Gründe aus der Normalisierung (Umrechnungen, ungültige Felder, nur zubereitet). */
  readonly notes?: readonly FoodProductCheckReason[];
}

const isBad = (v: number | null | undefined) =>
  v !== null && v !== undefined && (!Number.isFinite(v) || v < 0);

/**
 * Zweistufige Prüfung (Plan 4.4, E4-G3). `blocked`: Werte fehlen, unmöglich oder vertauscht (kJ als kcal), nur
 * zubereitet. `review`: Atwater weicht um mehr als 20 % (mindestens 10 kcal) ab, Umrechnungen, Zucker > Kohlenhydrate,
 * gesättigte > Fett. Sonst `ok`. Dieselbe Funktion prüft OFF-Produkte und eigene Produkte.
 */
export function checkProductNutrients(input: ProductCheckInput): FoodProductCheck {
  const reasons = new Set<FoodProductCheckReason>(input.notes ?? []);
  const all = [
    input.kcal,
    input.kj,
    input.protein_g,
    input.carbs_g,
    input.fat_g,
    input.sugar_g,
    input.sat_fat_g,
    input.fiber_g,
    input.salt_g,
    input.polyols_g,
    input.alcohol_g,
  ];
  if (all.some(isBad)) reasons.add('invalid_value');
  const v = (x: number | null | undefined) =>
    x === null || x === undefined || isBad(x) ? null : x;
  const kcal = v(input.kcal);
  const kj = v(input.kj);
  const protein = v(input.protein_g);
  const carbs = v(input.carbs_g);
  const fat = v(input.fat_g);
  const fiber = v(input.fiber_g);
  const salt = v(input.salt_g);
  const sugar = v(input.sugar_g);
  const satFat = v(input.sat_fat_g);
  const polyols = v(input.polyols_g);
  const alcohol = v(input.alcohol_g);

  if (kcal === null && !reasons.has('invalid_value')) reasons.add('energy_missing');
  if (protein === null || carbs === null || fat === null) {
    if (!reasons.has('invalid_value')) reasons.add('macro_missing');
  }
  if (kcal !== null && kcal > C.kcalMax) reasons.add('kcal_too_high');
  if (
    [protein, carbs, fat, fiber, salt, sugar, satFat, polyols].some(
      (x) => x !== null && x > C.macroMaxG,
    )
  ) {
    reasons.add('macro_too_high');
  }
  const sum = (protein ?? 0) + (carbs ?? 0) + (fat ?? 0) + (fiber ?? 0) + (salt ?? 0);
  if (sum > C.macroSumMaxG[input.baseUnit]) reasons.add('macro_sum_too_high');
  if (kcal !== null && kj !== null && kcal >= C.kjCheckMinKcal) {
    const ratio = kj / kcal;
    if (ratio < C.kjPerKcalRange.min || ratio > C.kjPerKcalRange.max) {
      reasons.add('kj_kcal_mismatch');
    }
  }

  if (kcal !== null && protein !== null && carbs !== null && fat !== null) {
    const A = RECIPE_CHECK_LIMITS.atwater;
    const poly = Math.min(polyols ?? 0, carbs);
    const estimate =
      A.protein * protein +
      A.carbs * (carbs - poly) +
      A.polyols * poly +
      A.fat * fat +
      A.fiber * (fiber ?? 0) +
      A.alcohol * (alcohol ?? 0);
    const tolerance = Math.max(C.atwaterTolerance * kcal, C.atwaterAbsMinKcal);
    // Fehlen Ballaststoffe, nur „Makros ergeben MEHR als angegeben“ prüfen – fehlende Ballaststoffe können die
    // Lücke nach unten erklären (Plan 4.4).
    const off = fiber === null ? estimate - kcal : Math.abs(estimate - kcal);
    if (off > tolerance) reasons.add('atwater_mismatch');
  }
  if (sugar !== null && carbs !== null && sugar > carbs + C.subsetToleranceG) {
    reasons.add('sugar_over_carbs');
  }
  if (satFat !== null && fat !== null && satFat > fat + C.subsetToleranceG) {
    reasons.add('sat_fat_over_fat');
  }

  const ordered = FOOD_PRODUCT_CHECK_REASONS.filter((r) => reasons.has(r));
  const level: FoodProductCheckLevel = ordered.some((r) =>
    (FOOD_PRODUCT_BLOCKING_REASONS as readonly string[]).includes(r),
  )
    ? 'blocked'
    : ordered.some((r) => (FOOD_PRODUCT_REVIEW_REASONS as readonly string[]).includes(r))
      ? 'review'
      : 'ok';
  return { level, reasons: ordered };
}

// ---------------------------------------------------------------------------------------------------------
// 4.3 OFF-Antwort normalisieren
// ---------------------------------------------------------------------------------------------------------

/** Werte je 100 g/ml, wie gespeichert (kcal ganz, sonst eine Nachkommastelle); null = fehlt bzw. gesperrt. */
export interface ProductPer100 {
  readonly kcal: number | null;
  readonly protein_g: number | null;
  readonly carbs_g: number | null;
  readonly fat_g: number | null;
  readonly sugar_g: number | null;
  readonly sat_fat_g: number | null;
  readonly fiber_g: number | null;
  readonly salt_g: number | null;
}

/**
 * Ergebnis der Normalisierung = Zeile im Zwischenspeicher `food_products` (ohne Abrufzeit). Bei `blocked` sind alle
 * Werte null (Plan 3.3 „null wenn unbrauchbar“) – Name, Marke und Nummer bleiben (für „Eigenes Produkt anlegen“).
 */
export interface NormalizedFoodProduct {
  readonly code: string;
  readonly name_de: string;
  readonly brand_de: string | null;
  readonly quantity_label: string | null;
  readonly base_unit: FoodProductBaseUnit;
  readonly per100: ProductPer100;
  /** Portion bzw. ganze Packung in g/ml – nur, wenn plausibel (1–2.000). */
  readonly serving_g: number | null;
  readonly package_g: number | null;
  readonly check: FoodProductCheck;
  /** `last_modified_t` von OFF als ISO-Zeitpunkt; null = unbekannt. */
  readonly off_last_modified: string | null;
}

export type OffAnswer =
  | { readonly kind: 'found'; readonly product: Record<string, unknown> }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'invalid' };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Antwort von `GET /api/v2/product/<Nummer>` lesen (VOR LIVEGANG PRÜFEN, Plan 1.1): `{ status: 1, product: {…} }` =
 * gefunden, `status: 0` bzw. kein `product` = nicht gefunden. Alles andere = unbrauchbar.
 */
export function parseOffAnswer(raw: unknown): OffAnswer {
  if (!isRecord(raw)) return { kind: 'invalid' };
  if (raw.status === 0 || raw.status === '0') return { kind: 'not_found' };
  if (raw.status !== 1 && raw.status !== '1') return { kind: 'invalid' };
  return isRecord(raw.product) ? { kind: 'found', product: raw.product } : { kind: 'not_found' };
}

/** Wert eines OFF-Felds: fehlt → null, gültige Zahl (auch als reine Dezimal-Zeichenkette) → Zahl, sonst NaN. */
function offNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d{1,7}(\.\d{1,6})?$/.test(value.trim())) {
    return Number(value.trim());
  }
  return Number.NaN;
}

/** Nährwert-Schlüssel in OFF (`nutriments`) – VOR LIVEGANG PRÜFEN (Feld-Doku, Plan 1.1). */
const OFF_NUTRIENT_KEYS = {
  kcal: 'energy-kcal',
  kj: 'energy-kj',
  /** `energy` ohne Zusatz ist laut Recherche kJ (Plan 1.1, Issue #51). */
  energy: 'energy',
  protein_g: 'proteins',
  carbs_g: 'carbohydrates',
  fat_g: 'fat',
  sugar_g: 'sugars',
  sat_fat_g: 'saturated-fat',
  fiber_g: 'fiber',
  salt_g: 'salt',
  sodium_g: 'sodium',
  polyols_g: 'polyols',
  alcohol_vol: 'alcohol',
} as const;

/** Unveränderte OFF-Felder für den Speicher: nur die abgefragten Felder, `nutriments` nur bekannte Schlüssel. */
export function offFieldsForStorage(product: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of OPEN_FOOD_FACTS.fields) {
    if (!(field in product)) continue;
    if (field === 'nutriments') {
      const n = product.nutriments;
      if (!isRecord(n)) continue;
      const bases = Object.values(OFF_NUTRIENT_KEYS) as string[];
      out.nutriments = Object.fromEntries(
        Object.entries(n).filter(([key]) =>
          bases.some(
            (b) =>
              key === `${b}_100g` ||
              key === `${b}_serving` ||
              key === `${b}_prepared_100g` ||
              key === `${b}_modifier`,
          ),
        ),
      );
      continue;
    }
    const value = product[field];
    // Texte gekürzt (Speicher-Grenze), Zahlen/Wahrheitswerte unverändert, sonst weglassen.
    if (typeof value === 'string') out[field] = value.slice(0, 1000);
    else if (typeof value === 'number' || typeof value === 'boolean') out[field] = value;
  }
  return out;
}

function baseUnitOf(product: Record<string, unknown>): {
  unit: FoodProductBaseUnit;
  assumed: boolean;
} {
  const unit =
    typeof product.product_quantity_unit === 'string' ? product.product_quantity_unit : '';
  if (/^\s*ml\s*$/i.test(unit)) return { unit: 'ml', assumed: false };
  if (/^\s*g\s*$/i.test(unit)) return { unit: 'g', assumed: false };
  const quantity = typeof product.quantity === 'string' ? product.quantity : '';
  if (/\d\s*(ml|cl|l)\b/i.test(quantity)) return { unit: 'ml', assumed: false };
  if (/\d\s*(g|kg)\b/i.test(quantity)) return { unit: 'g', assumed: false };
  return { unit: 'g', assumed: true };
}

const plausibleAmount = (x: number | null) =>
  x !== null && Number.isFinite(x) && x >= C.amountG.min && x <= C.amountG.max ? round1(x) : null;

/**
 * OFF-Produkt → Werte je 100 g/ml + Prüfung (Plan 4.3). Die einzigen „Änderungen“ an OFF-Daten (ODbL 4.6, Seite
 * „Lizenzen und Quellen“): kJ → kcal (÷ 4,184), Natrium → Salz (× 2,5), Portion → je 100, Rundung (kcal ganz, sonst
 * 0,1 g), Texte bereinigt und gekürzt.
 */
export function normalizeOffProduct(
  product: Record<string, unknown>,
  code: string,
): NormalizedFoodProduct {
  const n = isRecord(product.nutriments) ? product.nutriments : {};
  const notes = new Set<FoodProductCheckReason>();
  const field = (key: string, suffix: string) => offNumber(n[`${key}${suffix}`]);

  const servingQuantityRaw = offNumber(product.serving_quantity);
  const servingG = plausibleAmount(servingQuantityRaw);
  if (servingQuantityRaw !== null && servingG === null) notes.add('serving_ignored');

  // Energie je 100: kcal bzw. kJ; sonst aus der Portion (nur mit plausibler Portion); sonst nur zubereitet → gesperrt.
  const K = OFF_NUTRIENT_KEYS;
  const energy100 = {
    kcal: field(K.kcal, '_100g'),
    kj: field(K.kj, '_100g') ?? field(K.energy, '_100g'),
  };
  let suffix = '_100g';
  let factor = 1;
  if (energy100.kcal === null && energy100.kj === null) {
    const servingEnergy = field(K.kcal, '_serving') ?? field(K.kj, '_serving');
    const servingEnergyKj = field(K.energy, '_serving');
    if (servingG !== null && (servingEnergy !== null || servingEnergyKj !== null)) {
      suffix = '_serving';
      factor = 100 / servingG;
      notes.add('from_serving');
    } else if (
      field(K.kcal, '_prepared_100g') !== null ||
      field(K.kj, '_prepared_100g') !== null ||
      field(K.energy, '_prepared_100g') !== null
    ) {
      notes.add('prepared_only');
    }
  }
  const read = (key: string) => {
    const value = field(key, suffix);
    return value === null ? null : value * factor;
  };
  let kcal = read(K.kcal);
  const kj = read(K.kj) ?? read(K.energy);
  if (kcal === null && kj !== null && Number.isFinite(kj) && kj >= 0) {
    kcal = kj / C.kjPerKcal;
    notes.add('kcal_from_kj');
  }
  let salt = read(K.salt_g);
  const sodium = read(K.sodium_g);
  if (salt === null && sodium !== null)
    salt = Number.isFinite(sodium) ? sodium * C.saltPerSodium : sodium;
  const alcoholVol = read(K.alcohol_vol);
  const alcoholG =
    alcoholVol === null || !Number.isFinite(alcoholVol)
      ? alcoholVol
      : alcoholVol * C.ethanolDensity;
  for (const key of Object.values(K)) {
    const mod = n[`${key}_modifier`];
    if (mod === '<' || mod === '≤' || mod === '<=') notes.add('upper_bound');
  }
  const unit = baseUnitOf(product);
  if (unit.assumed) notes.add('unit_assumed');

  const values = {
    kcal,
    protein_g: read(K.protein_g),
    carbs_g: read(K.carbs_g),
    fat_g: read(K.fat_g),
    sugar_g: read(K.sugar_g),
    sat_fat_g: read(K.sat_fat_g),
    fiber_g: read(K.fiber_g),
    salt_g: salt,
  };
  const check = checkProductNutrients({
    baseUnit: unit.unit,
    ...values,
    // Der kJ-Abgleich nur, wenn BEIDE angegeben sind (nicht nach eigener Umrechnung).
    kj: notes.has('kcal_from_kj') ? null : kj,
    polyols_g: read(K.polyols_g),
    alcohol_g: alcoholG,
    notes: [...notes],
  });
  const blocked = check.level === 'blocked';
  const keep = (x: number | null, whole = false) =>
    blocked || x === null || !Number.isFinite(x) ? null : whole ? Math.round(x) : round1(x);

  const name =
    sanitizeOffText(product.product_name_de, C.nameMaxChars) ??
    sanitizeOffText(product.product_name, C.nameMaxChars) ??
    sanitizeOffText(product.generic_name_de, C.nameMaxChars) ??
    PRODUCT_NAME_FALLBACK;
  const lastModified = offNumber(product.last_modified_t);
  return {
    code,
    name_de: name,
    brand_de: sanitizeOffBrand(product.brands),
    quantity_label: sanitizeOffText(product.quantity, C.quantityMaxChars),
    base_unit: unit.unit,
    per100: {
      kcal: keep(values.kcal, true),
      protein_g: keep(values.protein_g),
      carbs_g: keep(values.carbs_g),
      fat_g: keep(values.fat_g),
      sugar_g: keep(values.sugar_g),
      sat_fat_g: keep(values.sat_fat_g),
      fiber_g: keep(values.fiber_g),
      salt_g: keep(values.salt_g),
    },
    serving_g: servingG,
    package_g: plausibleAmount(offNumber(product.product_quantity)),
    check,
    off_last_modified:
      lastModified !== null &&
      Number.isFinite(lastModified) &&
      lastModified > 946_684_800 &&
      lastModified < 4_102_444_800
        ? new Date(lastModified * 1000).toISOString()
        : null,
  };
}

/** OFF-Stand älter als 3 Jahre → Hinweis „Angaben vom …“ (keine Stufe, Plan 4.4). */
export function productDataIsOld(offLastModified: string | null, now: string): boolean {
  if (offLastModified === null) return false;
  const then = new Date(offLastModified);
  const limit = new Date(now);
  limit.setUTCFullYear(limit.getUTCFullYear() - C.staleYears);
  return then.getTime() < limit.getTime();
}

// ---------------------------------------------------------------------------------------------------------
// Produktansicht (Antwort der Route, Plan 3.2 Nr. 11)
// ---------------------------------------------------------------------------------------------------------

const per100Value = z.number().min(0).max(C.macroMaxG).nullable();
export const productViewSchema = z.strictObject({
  code: barcodeSchema,
  name_de: z
    .string()
    .min(1)
    .max(C.nameMaxChars * 2),
  brand_de: z
    .string()
    .min(1)
    .max(C.brandMaxChars * 2)
    .nullable(),
  quantity_label: z
    .string()
    .min(1)
    .max(C.quantityMaxChars * 2)
    .nullable(),
  base_unit: z.enum(FOOD_PRODUCT_BASE_UNITS),
  per100: z.strictObject({
    kcal: z.number().int().min(0).max(C.kcalMax).nullable(),
    protein_g: per100Value,
    carbs_g: per100Value,
    fat_g: per100Value,
    sugar_g: per100Value,
    sat_fat_g: per100Value,
    fiber_g: per100Value,
    salt_g: per100Value,
  }),
  serving_g: z.number().min(C.amountG.min).max(C.amountG.max).nullable(),
  package_g: z.number().min(C.amountG.min).max(C.amountG.max).nullable(),
  source: z.strictObject({
    db: z.literal(OPEN_FOOD_FACTS.sourceDb),
    license: z.literal(OPEN_FOOD_FACTS.license),
    retrieved_at: z.iso.datetime({ offset: true }),
    off_last_modified: z.iso.datetime({ offset: true }).nullable(),
  }),
});
export type ProductView = z.infer<typeof productViewSchema>;

export const productCheckSchema = z.strictObject({
  level: z.enum(FOOD_PRODUCT_CHECK_LEVELS),
  reasons: z.array(z.enum(FOOD_PRODUCT_CHECK_REASONS)).max(FOOD_PRODUCT_CHECK_REASONS.length),
});

export function productViewOf(product: NormalizedFoodProduct, retrievedAt: string): ProductView {
  return {
    code: product.code,
    name_de: product.name_de,
    brand_de: product.brand_de,
    quantity_label: product.quantity_label,
    base_unit: product.base_unit,
    per100: product.per100,
    serving_g: product.serving_g,
    package_g: product.package_g,
    source: {
      db: OPEN_FOOD_FACTS.sourceDb,
      license: OPEN_FOOD_FACTS.license,
      retrieved_at: retrievedAt,
      off_last_modified: product.off_last_modified,
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// Tagebuch: Herkunft `product` (Plan 3.5)
// ---------------------------------------------------------------------------------------------------------

/** Was ein Eintrag aus einem OFF-Produkt braucht (Zwischenspeicher bzw. Produktansicht). */
export interface ProductForEntry {
  readonly code: string;
  readonly name_de: string;
  readonly brand_de: string | null;
  readonly base_unit: FoodProductBaseUnit;
  readonly check_level: FoodProductCheckLevel;
  readonly kcal: number | null;
  readonly protein_g: number | null;
  readonly carbs_g: number | null;
  readonly fat_g: number | null;
}

/** Titel im Tagebuch: „Name · Marke“, höchstens 100 Zeichen (FOOD_LOG_LIMITS.titleMaxChars, sync: SQL). */
export function productEntryTitle(name: string, brand: string | null): string {
  const full = brand === null ? name : `${name} · ${brand}`;
  return [...full].slice(0, FOOD_LOG_LIMITS.titleMaxChars).join('').trim();
}

/** Kann aus diesem OFF-Produkt eingetragen werden? (nicht gesperrt, alle vier Werte da) */
export function productUsable(product: ProductForEntry): boolean {
  return (
    product.check_level !== 'blocked' &&
    product.kcal !== null &&
    product.protein_g !== null &&
    product.carbs_g !== null &&
    product.fat_g !== null
  );
}

function per100Entry(
  per: { kcal: number; protein_g: number; carbs_g: number; fat_g: number },
  amount: number,
) {
  const factor = amount / 100;
  return {
    kcal: Math.round(per.kcal * factor),
    protein_g: round1(per.protein_g * factor),
    carbs_g: round1(per.carbs_g * factor),
    fat_g: round1(per.fat_g * factor),
  };
}

/**
 * Eintrag aus einem OFF-Produkt (Plan 2.1 Nr. 5): Menge in g bzw. ml (1–2.000, Einheit = Bezug des Produkts), Werte =
 * je 100 × Menge / 100, gerundet wie der Server (js_round). Gesperrte Produkte → `invalid`; über 3.000 kcal → `too_much`.
 */
export function entryFromProduct(
  product: ProductForEntry,
  amount: number,
  target: FoodLogTarget,
): FoodLogBuild {
  if (!productUsable(product)) return { ok: false, reason: 'invalid' };
  if (!isValidFoodLogAmount(amount, product.base_unit)) return { ok: false, reason: 'amount' };
  return finishFoodLogEntry({
    id: target.id,
    eaten_on: target.date,
    slot: target.slot,
    source: 'product',
    food_id: null,
    recipe_id: null,
    custom_meal_id: null,
    product_code: product.code,
    user_product_id: null,
    title_de: productEntryTitle(product.name_de, product.brand_de),
    amount,
    unit: product.base_unit,
    portion: null,
    ...per100Entry(
      {
        kcal: product.kcal ?? 0,
        protein_g: product.protein_g ?? 0,
        carbs_g: product.carbs_g ?? 0,
        fat_g: product.fat_g ?? 0,
      },
      amount,
    ),
  });
}

/** Eintrag aus einem eigenen Produkt: fester Titel „Eigenes Produkt“ + Verweis (nie Name oder Marke im Tagebuch). */
export function entryFromUserProduct(
  product: Pick<UserFoodProduct, 'id' | 'base_unit' | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>,
  amount: number,
  target: FoodLogTarget,
): FoodLogBuild {
  if (!isValidFoodLogAmount(amount, product.base_unit)) return { ok: false, reason: 'amount' };
  return finishFoodLogEntry({
    id: target.id,
    eaten_on: target.date,
    slot: target.slot,
    source: 'product',
    food_id: null,
    recipe_id: null,
    custom_meal_id: null,
    product_code: null,
    user_product_id: product.id,
    title_de: USER_PRODUCT_ENTRY_TITLE,
    amount,
    unit: product.base_unit,
    portion: null,
    ...per100Entry(product, amount),
  });
}

/** Mengen-Schnellknöpfe (Plan 2.2): ½, 1 und 2 Portionen, ganze Packung – nur plausible (1–2.000). */
export function productAmountChoices(product: {
  readonly serving_g: number | null;
  readonly package_g: number | null;
}): { kind: 'half' | 'serving' | 'double' | 'package'; amount: number }[] {
  const out: { kind: 'half' | 'serving' | 'double' | 'package'; amount: number }[] = [];
  const ok = (x: number) => x >= C.amountG.min && x <= C.amountG.max;
  const s = product.serving_g;
  if (s !== null) {
    if (ok(round1(s / 2))) out.push({ kind: 'half', amount: round1(s / 2) });
    if (ok(s)) out.push({ kind: 'serving', amount: s });
    if (ok(round1(s * 2))) out.push({ kind: 'double', amount: round1(s * 2) });
  }
  if (product.package_g !== null && ok(product.package_g)) {
    out.push({ kind: 'package', amount: product.package_g });
  }
  return out;
}

/**
 * Server-Nachrechnung eines Produkt-Eintrags (Plan 3.5) – GLEICHE Regeln wie save_food_log_entries mit
 * private.food_log_product_values (Abgleich pgTAP 41 und Kreuzvergleich im Harness); der Testmodus speichert damit.
 * OFF-Produkt (Nummer):
 * 1. Ändern desselben Inhalts (gleiche Nummer und Einheit) mit gleicher Menge → Schnappschuss und Titel unverändert,
 * 2. Zeile im Speicher nutzbar → neu aus dem Speicher (Titel „Name · Marke“ vom Server),
 * 3. Zeile fehlt/gesperrt, aber Ändern desselben Inhalts → verhältnisgleich aus dem Schnappschuss,
 * 4. sonst `unavailable` (neuer Eintrag ohne Speicher-Zeile, „Produkt neu abrufen“).
 * Eigenes Produkt (Verweis): wie eigene Gerichte (E2 Nachprüfung S1) – vorhanden → aus dem Produkt; fehlt es
 * (gelöscht/fremd) → Verweis leer, Ändern aus dem Schnappschuss, neu mit den (geprüften) Werten des Geräts.
 */
export function serverProductEntry(
  entry: FoodLogEntry,
  old: FoodLogEntry | null,
  sources: {
    readonly product: ProductForEntry | null;
    readonly userProduct: Pick<
      UserFoodProduct,
      'id' | 'base_unit' | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'
    > | null;
  },
): { kind: 'ok'; entry: FoodLogEntry } | { kind: 'unavailable' } | { kind: 'invalid' } {
  if (entry.source !== 'product' || entry.amount === null || entry.unit === null) {
    return { kind: 'invalid' };
  }
  const amount = entry.amount;
  const finish = (e: FoodLogEntry) => {
    const built = finishFoodLogEntry(e);
    return built.ok
      ? ({ kind: 'ok', entry: built.entry } as const)
      : ({ kind: 'invalid' } as const);
  };
  const rescaled = (from: FoodLogEntry) => {
    const factor = amount / (from.amount ?? amount);
    const s = (v: number | null) => (v === null ? null : round1(v * factor));
    return {
      kcal: from.kcal === null ? null : Math.round(from.kcal * factor),
      protein_g: s(from.protein_g),
      carbs_g: s(from.carbs_g),
      fat_g: s(from.fat_g),
    };
  };
  if (entry.product_code !== null) {
    const p =
      sources.product !== null && sources.product.code === entry.product_code
        ? sources.product
        : null;
    const sameContent =
      old !== null &&
      old.source === 'product' &&
      old.product_code === entry.product_code &&
      old.unit === entry.unit;
    if (sameContent && old.amount === amount) {
      return finish({
        ...entry,
        title_de: old.title_de,
        kcal: old.kcal,
        protein_g: old.protein_g,
        carbs_g: old.carbs_g,
        fat_g: old.fat_g,
      });
    }
    if (p !== null && productUsable(p)) {
      if (p.base_unit !== entry.unit) return { kind: 'invalid' };
      return finish({
        ...entry,
        title_de: productEntryTitle(p.name_de, p.brand_de),
        ...per100Entry(
          {
            kcal: p.kcal ?? 0,
            protein_g: p.protein_g ?? 0,
            carbs_g: p.carbs_g ?? 0,
            fat_g: p.fat_g ?? 0,
          },
          amount,
        ),
      });
    }
    if (sameContent) return finish({ ...entry, title_de: old.title_de, ...rescaled(old) });
    return { kind: 'unavailable' };
  }
  // Eigenes Produkt (bzw. gelöschtes: beide Verweise leer).
  const own =
    sources.userProduct !== null && sources.userProduct.id === entry.user_product_id
      ? sources.userProduct
      : null;
  const sameContent =
    old !== null &&
    old.source === 'product' &&
    old.product_code === null &&
    old.unit === entry.unit &&
    (old.user_product_id === entry.user_product_id ||
      (own === null && (old.user_product_id === null || entry.user_product_id === null)));
  const base = { ...entry, title_de: USER_PRODUCT_ENTRY_TITLE, user_product_id: own?.id ?? null };
  if (sameContent && old.amount === amount) {
    return finish({
      ...base,
      kcal: old.kcal,
      protein_g: old.protein_g,
      carbs_g: old.carbs_g,
      fat_g: old.fat_g,
    });
  }
  if (own !== null) {
    if (own.base_unit !== entry.unit) return { kind: 'invalid' };
    return finish({ ...base, ...per100Entry(own, amount) });
  }
  if (sameContent) return finish({ ...base, ...rescaled(old) });
  return finish(base);
}

/**
 * Menge eines Produkt-Eintrags ändern (Plan 2.4 „Bearbeiten“, wie E2 H2 `rebuildEntry`): gleiche Regeln wie der Server
 * (`serverProductEntry`) – gleiche Menge → Schnappschuss; Produkt im Speicher bzw. eigenes Produkt vorhanden → neu aus
 * der Quelle; sonst verhältnisgleich aus dem Schnappschuss.
 */
export function rebuildProductEntry(
  entry: FoodLogEntry,
  amount: number,
  sources: Parameters<typeof serverProductEntry>[2],
): FoodLogBuild {
  if (entry.source !== 'product' || entry.unit === null || entry.unit === 'piece') {
    return { ok: false, reason: 'invalid' };
  }
  if (!isValidFoodLogAmount(amount, entry.unit)) return { ok: false, reason: 'amount' };
  const result = serverProductEntry({ ...entry, amount }, entry, sources);
  if (result.kind === 'ok') return { ok: true, entry: result.entry };
  return { ok: false, reason: 'invalid' };
}

// ---------------------------------------------------------------------------------------------------------
// Eigene Produkte (Plan 2.3/3.4) – nur für die Person, nie an OFF, nie in den gemeinsamen Speicher
// ---------------------------------------------------------------------------------------------------------

const FORBIDDEN_TEST = new RegExp(`[\\u0000${CUSTOM_MEAL_NAME_FORBIDDEN_CLASS}]`, 'u');
const EDGE_TEST = new RegExp(
  `^[${CUSTOM_MEAL_NAME_EDGE_SPACE_CLASS}]|[${CUSTOM_MEAL_NAME_EDGE_SPACE_CLASS}]$`,
  'u',
);
const validText = (max: number) => (value: string) =>
  codePoints(value) >= 1 &&
  codePoints(value) <= max &&
  !FORBIDDEN_TEST.test(value) &&
  !EDGE_TEST.test(value);

/** Name 1–60 bzw. Marke 1–40 Zeichen, gleiche Zeichenregeln wie eigene Gerichte (sync: CHECK, db-sync.test.ts). */
export const isValidUserProductName = validText(U.nameMaxChars);
export const isValidUserProductBrand = validText(U.brandMaxChars);

const multipleOf01 = (value: number) => Math.abs(Math.round(value * 10) / 10 - value) < 1e-9;
const per100Schema = z
  .number()
  .min(U.per100G.min)
  .max(U.per100G.max)
  .refine(multipleOf01, 'Höchstens eine Nachkommastelle.');

const userProductFields = {
  id: z.uuid(),
  name_de: z.string().refine(isValidUserProductName, 'Ungültiger Name.'),
  brand_de: z.string().refine(isValidUserProductBrand, 'Ungültige Marke.').nullable(),
  code: barcodeSchema.nullable(),
  base_unit: z.enum(FOOD_PRODUCT_BASE_UNITS),
  kcal: z.number().int().min(U.kcal.min).max(U.kcal.max),
  protein_g: per100Schema,
  carbs_g: per100Schema,
  fat_g: per100Schema,
  sugar_g: per100Schema.nullable(),
  salt_g: per100Schema.nullable(),
  serving_g: z
    .number()
    .min(U.servingG.min)
    .max(U.servingG.max)
    .refine(multipleOf01, 'Höchstens eine Nachkommastelle.')
    .nullable(),
  /** Vorausgefüllt aus OFF (nur Merker). */
  based_on_off: z.boolean(),
};

/** Unmögliche Werte (Plan 2.3: „lassen sich nicht speichern“) – Summe wie die CHECK-Bedingung der Tabelle. */
function refineUserProduct(
  value: {
    base_unit: FoodProductBaseUnit;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    salt_g: number | null;
  },
  ctx: z.RefinementCtx,
) {
  const sum = value.protein_g + value.carbs_g + value.fat_g + (value.salt_g ?? 0);
  if (sum > C.macroSumMaxG[value.base_unit] + 1e-9) {
    ctx.addIssue({ code: 'custom', message: 'Unmögliche Werte.' });
  }
}

export const userFoodProductSchema = z
  .strictObject(userProductFields)
  .superRefine(refineUserProduct);
export type UserFoodProduct = z.infer<typeof userFoodProductSchema>;

/** Eingabe an save_user_food_product: zusätzlich write_id (Idempotenz) und base_revision (optimistische Sperre). */
export const userFoodProductPayloadSchema = z
  .strictObject({
    ...userProductFields,
    write_id: z.uuid(),
    base_revision: z.number().int().min(1).nullable(),
  })
  .superRefine(refineUserProduct);
export type UserFoodProductPayload = z.infer<typeof userFoodProductPayloadSchema>;

export const USER_FOOD_PRODUCT_REJECT_CODES = ['invalid', 'limit'] as const;
export const userFoodProductSaveResultSchema = z.union([
  z.strictObject({ result: z.literal('saved'), id: z.uuid(), revision: z.number().int().min(1) }),
  z.strictObject({
    result: z.literal('conflict'),
    reason: z.literal('revision'),
    id: z.uuid(),
    revision: z.number().int().min(1),
  }),
  z.strictObject({
    result: z.literal('conflict'),
    reason: z.literal('deleted'),
    id: z.null(),
    revision: z.null(),
  }),
  z.strictObject({
    result: z.literal('rejected'),
    code: z.enum(USER_FOOD_PRODUCT_REJECT_CODES),
  }),
]);
export type UserFoodProductSaveResult = z.infer<typeof userFoodProductSaveResultSchema>;

/** Prüfung eines eigenen Produkts mit derselben Funktion wie OFF (Plan 2.3): blocked = nicht speicherbar. */
export function checkUserFoodProduct(
  values: Pick<
    UserFoodProduct,
    'base_unit' | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'sugar_g' | 'salt_g'
  >,
): FoodProductCheck {
  return checkProductNutrients({
    baseUnit: values.base_unit,
    kcal: values.kcal,
    protein_g: values.protein_g,
    carbs_g: values.carbs_g,
    fat_g: values.fat_g,
    sugar_g: values.sugar_g,
    salt_g: values.salt_g,
  });
}

/** Darf noch ein eigenes Produkt dazukommen? (höchstens 200) */
export function canAddUserFoodProduct(products: readonly unknown[]): boolean {
  return products.length < U.maxProducts;
}

/** Eigenes Produkt mit dieser Nummer (zuletzt geändertes zuerst) – „Zuerst eigene Produkte“ (Plan 2.1 Nr. 3). */
export function userProductForCode<T extends { code: string | null; updated_at?: string }>(
  products: readonly T[],
  code: string,
): T | null {
  return (
    [...products]
      .filter((p) => p.code === code)
      .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0] ?? null
  );
}

/** Anzeigetitel eines Produkt-Eintrags: bei eigenen Produkten der aktuelle Name (nur Anzeige), sonst der Titel. */
export function productEntryDisplayTitle(
  entry: Pick<FoodLogEntry, 'source' | 'user_product_id' | 'title_de'>,
  products: readonly Pick<UserFoodProduct, 'id' | 'name_de'>[],
): string {
  if (entry.source !== 'product' || entry.user_product_id === null) return entry.title_de;
  return products.find((p) => p.id === entry.user_product_id)?.name_de ?? entry.title_de;
}

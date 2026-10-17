import { z } from 'zod';

import { FOOD_PRODUCT_CHECK, FOOD_PRODUCT_LOOKUP_LIMITS } from '../constants';
import { isoDateInTimeZone } from '../dates';
import { gs1CheckDigit, normalizeBarcode } from './barcode';
import {
  FOOD_PRODUCT_BASE_UNITS,
  FOOD_PRODUCT_CHECK_LEVELS,
  FOOD_PRODUCT_CHECK_REASONS,
  type FoodProductCheckLevel,
  type FoodProductCheckReason,
  type NormalizedFoodProduct,
  normalizeOffProduct,
  offFieldsForStorage,
  parseOffAnswer,
  productCheckSchema,
  productViewOf,
  productViewSchema,
  type ProductForEntry,
} from './food-product';

/**
 * Ablauf EINER Produktabfrage (Etappe E4a, docs/PLAN-E4.md 3.2) – gleich auf dem Server (apps/web, Route POST
 * /api/ernaehrung/produkt) und im Testmodus der App (Attrappe statt Open Food Facts, kein Netz):
 * 1. Nummer prüfen (`normalizeBarcode`): ungültig bzw. Ladencode → ohne Abfrage, ohne Zählung,
 * 2. `begin` (Datenbank bzw. Gerät): Flag, Einwilligung health_data, Limits je Person (60/Stunde, 200/Tag), Speicher
 *    lesen, globaler Deckel (10 OFF-Abfragen je Minute) – atomar beim Aufrufer,
 * 3. Speicher frisch → Antwort ohne OFF; sonst OFF (6 s, nur User-Agent + Accept) → normalisieren + prüfen → speichern,
 * 4. HTTP 429/503 von OFF → 5 Minuten Sperre des globalen Deckels; Fehler werden nicht wiederholt.
 * Logs nur feste Codes (`report`), nie Nummer, Name oder Nutzer-ID.
 */

/** Zeile des Zwischenspeichers `food_products` (ohne Personenbezug, Plan 3.3). */
export interface FoodProductRecord {
  readonly code: string;
  readonly found: boolean;
  /** Unveränderte OFF-Felder (nur die abgefragten); null bei „nicht gefunden“. */
  readonly off_fields: Record<string, unknown> | null;
  readonly name_de: string | null;
  readonly brand_de: string | null;
  readonly quantity_label: string | null;
  readonly base_unit: 'g' | 'ml' | null;
  readonly kcal: number | null;
  readonly protein_g: number | null;
  readonly carbs_g: number | null;
  readonly fat_g: number | null;
  readonly sugar_g: number | null;
  readonly sat_fat_g: number | null;
  readonly fiber_g: number | null;
  readonly salt_g: number | null;
  readonly serving_g: number | null;
  readonly package_g: number | null;
  readonly check_level: FoodProductCheckLevel | null;
  readonly check_reasons: readonly FoodProductCheckReason[];
  readonly normalizer_version: number;
  readonly off_last_modified: string | null;
  readonly retrieved_at: string;
}

/** Zod für eine Zeile aus der Datenbank (Antwort von food_product_lookup) – an der Grenze geprüft. */
export const foodProductRecordSchema = z.strictObject({
  code: z.string().regex(/^(\d{8}|\d{13,14})$/),
  found: z.boolean(),
  off_fields: z.record(z.string(), z.unknown()).nullable(),
  name_de: z.string().nullable(),
  brand_de: z.string().nullable(),
  quantity_label: z.string().nullable(),
  base_unit: z.enum(FOOD_PRODUCT_BASE_UNITS).nullable(),
  kcal: z.number().nullable(),
  protein_g: z.number().nullable(),
  carbs_g: z.number().nullable(),
  fat_g: z.number().nullable(),
  sugar_g: z.number().nullable(),
  sat_fat_g: z.number().nullable(),
  fiber_g: z.number().nullable(),
  salt_g: z.number().nullable(),
  serving_g: z.number().nullable(),
  package_g: z.number().nullable(),
  check_level: z.enum(FOOD_PRODUCT_CHECK_LEVELS).nullable(),
  check_reasons: z.array(z.enum(FOOD_PRODUCT_CHECK_REASONS)),
  normalizer_version: z.number().int(),
  off_last_modified: z.string().nullable(),
  retrieved_at: z.string(),
});

/** Normalisiertes Produkt → Speicher-Zeile. */
export function recordFromProduct(
  product: NormalizedFoodProduct,
  offFields: Record<string, unknown>,
  retrievedAt: string,
): FoodProductRecord {
  return {
    code: product.code,
    found: true,
    off_fields: offFields,
    name_de: product.name_de,
    brand_de: product.brand_de,
    quantity_label: product.quantity_label,
    base_unit: product.base_unit,
    ...product.per100,
    serving_g: product.serving_g,
    package_g: product.package_g,
    check_level: product.check.level,
    check_reasons: product.check.reasons,
    normalizer_version: FOOD_PRODUCT_CHECK.normalizerVersion,
    off_last_modified: product.off_last_modified,
    retrieved_at: retrievedAt,
  };
}

/** „Nicht gefunden“ als Speicher-Zeile (negativer Treffer, gilt 1 Tag). */
export function notFoundRecord(code: string, retrievedAt: string): FoodProductRecord {
  return {
    code,
    found: false,
    off_fields: null,
    name_de: null,
    brand_de: null,
    quantity_label: null,
    base_unit: null,
    kcal: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    sugar_g: null,
    sat_fat_g: null,
    fiber_g: null,
    salt_g: null,
    serving_g: null,
    package_g: null,
    check_level: null,
    check_reasons: [],
    normalizer_version: FOOD_PRODUCT_CHECK.normalizerVersion,
    off_last_modified: null,
    retrieved_at: retrievedAt,
  };
}

/** Speicher-Zeile → was ein Tagebuch-Eintrag braucht (null = nicht gefunden). */
export function productForEntryOf(record: FoodProductRecord): ProductForEntry | null {
  if (!record.found || record.name_de === null || record.base_unit === null) return null;
  return {
    code: record.code,
    name_de: record.name_de,
    brand_de: record.brand_de,
    base_unit: record.base_unit,
    check_level: record.check_level ?? 'blocked',
    kcal: record.kcal,
    protein_g: record.protein_g,
    carbs_g: record.carbs_g,
    fat_g: record.fat_g,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Regeln der Datenbank-Funktion food_product_lookup als reine Funktionen (Testmodus der App, gleiche Grenzen)
// ---------------------------------------------------------------------------------------------------------

/** Zähler je Person und Stunde (ohne Nummer) – wie private.food_product_lookup_counts. */
export interface ProductLookupCount {
  readonly hour_start: string;
  readonly lookups: number;
}

/** Volle Stunde (UTC = Stundengrenze Europe/Berlin) als ISO-Zeitpunkt. */
export function lookupHourStart(now: string): string {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

/**
 * Limit je Person (E4-G13): 200 je Kalendertag Europe/Berlin (zuerst geprüft), 60 je Stunde; null = frei. Gleiche
 * Reihenfolge wie food_product_lookup.
 */
export function productLookupLimit(
  counts: readonly ProductLookupCount[],
  now: string,
): 'hour' | 'day' | null {
  const L = FOOD_PRODUCT_LOOKUP_LIMITS;
  const hour = lookupHourStart(now);
  const today = isoDateInTimeZone(now, 'Europe/Berlin');
  let hourUsed = 0;
  let dayUsed = 0;
  for (const c of counts) {
    if (c.hour_start === hour) hourUsed += c.lookups;
    if (isoDateInTimeZone(c.hour_start, 'Europe/Berlin') === today) dayUsed += c.lookups;
  }
  if (dayUsed >= L.perDay) return 'day';
  if (hourUsed >= L.perHour) return 'hour';
  return null;
}

/** Eine Abfrage zählen (Stunde +1) und Zähler älter als 2 Tage entfernen. */
export function countProductLookup(
  counts: readonly ProductLookupCount[],
  now: string,
): ProductLookupCount[] {
  const hour = lookupHourStart(now);
  const cutoff = Date.parse(now) - FOOD_PRODUCT_LOOKUP_LIMITS.countsRetentionDays * 86_400_000;
  const kept = counts.filter((c) => Date.parse(c.hour_start) >= cutoff);
  const current = kept.find((c) => c.hour_start === hour);
  return current
    ? kept.map((c) => (c === current ? { ...c, lookups: c.lookups + 1 } : c))
    : [...kept, { hour_start: hour, lookups: 1 }];
}

/** Speicher-Zeile noch frisch? Gefunden 30 Tage, „nicht gefunden“ 1 Tag (wie food_product_lookup). */
export function productRecordFresh(
  record: Pick<FoodProductRecord, 'found' | 'retrieved_at'>,
  now: string,
) {
  const L = FOOD_PRODUCT_LOOKUP_LIMITS;
  const age = Date.parse(now) - Date.parse(record.retrieved_at);
  return age < (record.found ? L.cacheFreshDays : L.negativeCacheDays) * 86_400_000;
}

/** Speicher-Zeile abgelaufen (gelöscht wie purge_food_products: gefunden 90 Tage, „nicht gefunden“ 1 Tag)? */
export function productRecordExpired(
  record: Pick<FoodProductRecord, 'found' | 'retrieved_at'>,
  now: string,
): boolean {
  const L = FOOD_PRODUCT_LOOKUP_LIMITS;
  const age = Date.parse(now) - Date.parse(record.retrieved_at);
  return age > (record.found ? L.cacheDeleteDays : L.negativeCacheDays) * 86_400_000;
}

// ---------------------------------------------------------------------------------------------------------
// Antwort der Route (Zod, strikt – auch in der App an der Grenze geprüft)
// ---------------------------------------------------------------------------------------------------------

export const PRODUCT_LOOKUP_ERROR_CODES = [
  'not_found',
  'invalid_code',
  'not_food_code',
  'unavailable',
  'not_configured',
  'no_consent',
  // Nur die Route (vor der Kette):
  'forbidden_origin',
  'unauthorized',
  'invalid_request',
  'failed',
] as const;
export type ProductLookupErrorCode = (typeof PRODUCT_LOOKUP_ERROR_CODES)[number];

export const productLookupResponseSchema = z.discriminatedUnion('code', [
  z.strictObject({
    code: z.literal('found'),
    product: productViewSchema,
    check: productCheckSchema,
    /** true = älterer Speicher-Stand, weil OFF gerade nicht erreichbar war („Stand vom …“). */
    stale: z.boolean(),
    /** true = Testmodus mit Attrappe (ausgedachte Testwerte, keine OFF-Daten). */
    mock: z.boolean(),
  }),
  z.strictObject({ code: z.literal('rate_limited'), scope: z.enum(['hour', 'day']) }),
  z.strictObject({ code: z.enum(PRODUCT_LOOKUP_ERROR_CODES) }),
]);
export type ProductLookupResponse = z.infer<typeof productLookupResponseSchema>;

/** Anfrage an die Route: genau `{ code }` (Nummer im Körper, nie in der Adresse). */
export const productLookupRequestSchema = z.strictObject({
  code: z.string().min(1).max(FOOD_PRODUCT_LOOKUP_LIMITS.maxBodyBytes),
});

// ---------------------------------------------------------------------------------------------------------
// Kette
// ---------------------------------------------------------------------------------------------------------

export type ProductLookupBegin =
  | { readonly result: 'flag_off' | 'no_consent' | 'unavailable' }
  | { readonly result: 'rate_limited'; readonly scope: 'hour' | 'day' }
  /** Speicher-Zeile frisch (bzw. älter, wenn der globale Deckel voll ist: `stale`). */
  | { readonly result: 'cached'; readonly record: FoodProductRecord; readonly stale: boolean }
  /** OFF darf abgefragt werden (Platz im globalen Deckel ist reserviert); `record` = ältere Zeile oder null. */
  | { readonly result: 'fetch'; readonly record: FoodProductRecord | null };

export type OffFetchResult =
  | { readonly kind: 'answer'; readonly body: unknown }
  /** HTTP 404 (je nach Version „nicht gefunden“). */
  | { readonly kind: 'not_found' }
  /** HTTP 429/503 → Sperre des globalen Deckels. */
  | { readonly kind: 'overloaded' }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'failed' };

export interface ProductLookupDeps {
  begin(code: string): Promise<ProductLookupBegin>;
  fetchOff(code: string): Promise<OffFetchResult>;
  store(record: FoodProductRecord): Promise<void>;
  backoff(): Promise<void>;
  now(): string;
  /** Testmodus (Attrappe) – steht in der Antwort. */
  readonly mock: boolean;
  /** Feste Codes ins Log (nie Nummer, Name, Nutzer-ID). */
  readonly report?: (code: string) => void;
}

export interface ProductLookupResult {
  readonly status: number;
  readonly body: ProductLookupResponse;
}

const fail = (status: number, code: ProductLookupErrorCode): ProductLookupResult => ({
  status,
  body: { code },
});

function foundFrom(
  record: FoodProductRecord,
  product: NormalizedFoodProduct,
  stale: boolean,
  mock: boolean,
): ProductLookupResult {
  return {
    status: 200,
    body: {
      code: 'found',
      product: productViewOf(product, record.retrieved_at),
      check: { level: product.check.level, reasons: [...product.check.reasons] },
      stale,
      mock,
    },
  };
}

export async function runProductLookup(
  input: { readonly code: unknown },
  deps: ProductLookupDeps,
): Promise<ProductLookupResult> {
  const checked = normalizeBarcode(input.code);
  if (!checked.ok)
    return fail(400, checked.reason === 'invalid' ? 'invalid_code' : 'not_food_code');
  const code = checked.code;

  const begin = await deps.begin(code);
  switch (begin.result) {
    case 'flag_off':
      return fail(503, 'not_configured');
    case 'no_consent':
      return fail(403, 'no_consent');
    case 'rate_limited':
      return { status: 429, body: { code: 'rate_limited', scope: begin.scope } };
    case 'unavailable':
      deps.report?.('global_cap');
      return fail(503, 'unavailable');
    case 'cached':
      deps.report?.('cache_hit');
      return fromRecord(begin.record, begin.stale, deps);
    case 'fetch':
      break;
  }

  let fetched: OffFetchResult;
  try {
    fetched = await deps.fetchOff(code);
  } catch {
    fetched = { kind: 'failed' };
  }
  const fallback = async (reason: string): Promise<ProductLookupResult> => {
    deps.report?.(reason);
    // Ältere Zeile vorhanden → „Stand vom …“ statt Fehler (Plan 3.2 Nr. 8).
    return begin.record !== null && begin.record.found
      ? fromRecord(begin.record, true, deps)
      : fail(503, 'unavailable');
  };
  if (fetched.kind === 'overloaded') {
    await deps.backoff().catch(() => deps.report?.('backoff_failed'));
    return fallback('off_429');
  }
  if (fetched.kind === 'timeout') return fallback('off_timeout');
  if (fetched.kind === 'failed') return fallback('off_failed');

  const answer =
    fetched.kind === 'not_found' ? { kind: 'not_found' as const } : parseOffAnswer(fetched.body);
  const now = deps.now();
  if (answer.kind === 'invalid') return fallback('off_invalid');
  if (answer.kind === 'not_found') {
    try {
      await deps.store(notFoundRecord(code, now));
    } catch {
      deps.report?.('store_failed');
    }
    return fail(200, 'not_found');
  }
  const offFields = offFieldsForStorage(answer.product);
  if (JSON.stringify(offFields).length > FOOD_PRODUCT_LOOKUP_LIMITS.offFieldsMaxBytes) {
    return fallback('off_too_large');
  }
  const product = normalizeOffProduct(offFields, code);
  const record = recordFromProduct(product, offFields, now);
  try {
    await deps.store(record);
  } catch {
    // Ohne Speicher-Zeile ließe sich nicht eintragen (der Server rechnet aus dem Speicher) – lieber ehrlich „nicht
    // erreichbar“.
    deps.report?.('store_failed');
    return fail(503, 'unavailable');
  }
  return foundFrom(record, product, false, deps.mock);
}

/** Antwort aus einer Speicher-Zeile: neu aus den unveränderten OFF-Feldern gerechnet (neue Regel-Fassung → speichern). */
async function fromRecord(
  record: FoodProductRecord,
  stale: boolean,
  deps: ProductLookupDeps,
): Promise<ProductLookupResult> {
  if (!record.found || record.off_fields === null) return fail(200, 'not_found');
  const product = normalizeOffProduct(record.off_fields, record.code);
  if (record.normalizer_version !== FOOD_PRODUCT_CHECK.normalizerVersion) {
    try {
      await deps.store(recordFromProduct(product, record.off_fields, record.retrieved_at));
    } catch {
      deps.report?.('store_failed');
      return fail(503, 'unavailable');
    }
  }
  return foundFrom(record, product, stale, deps.mock);
}

// ---------------------------------------------------------------------------------------------------------
// Attrappe (Testmodus und Tests): feste Beispielnummern mit AUSGEDACHTEN TESTWERTEN – keine OFF-Daten, kein Netz
// ---------------------------------------------------------------------------------------------------------

/** Testnummer: 12 feste Ziffern + GS1-Prüfziffer (gültig, kein Ladencode). */
const testCode = (n: number) => {
  const body = `40099990000${n % 10}`;
  return `${body}${gs1CheckDigit(body)}`;
};

/**
 * Testnummern der Attrappe (Plan 3.2 „Testmodus“, 8.5) – im Testmodus in der App angezeigt. Alle Werte sind
 * ausgedachte Testwerte (Name „… (Testwerte)“), keine Daten von Open Food Facts.
 */
export const MOCK_PRODUCT_CASES = [
  { key: 'plausibel', code: testCode(1), label: 'Gefunden, Werte plausibel' },
  { key: 'pruefen', code: testCode(2), label: 'Werte prüfen' },
  { key: 'unbrauchbar', code: testCode(3), label: 'Werte unbrauchbar' },
  { key: 'nicht_gefunden', code: testCode(4), label: 'Nicht gefunden' },
  { key: 'einheit_vertauscht', code: testCode(5), label: 'Energie-Einheiten vertauscht' },
  { key: 'getraenk', code: testCode(6), label: 'Getränk (je 100 ml)' },
  { key: 'nur_kj', code: testCode(7), label: 'Nur kJ angegeben' },
  { key: 'zeitlimit', code: testCode(8), label: 'Zeitlimit' },
  { key: 'ueberlastet', code: testCode(9), label: 'Open Food Facts überlastet (429)' },
] as const;
export type MockProductCaseKey = (typeof MOCK_PRODUCT_CASES)[number]['key'];

const mockProduct = (
  name: string,
  extra: Record<string, unknown>,
  nutriments: Record<string, unknown>,
) => ({
  status: 1,
  product: {
    product_name_de: `${name} (Testwerte)`,
    brands: 'Testmarke, Zweitmarke',
    last_modified_t: 1_760_000_000,
    ...extra,
    nutriments,
  },
});

const MOCK_ANSWERS: Record<MockProductCaseKey, OffFetchResult> = {
  plausibel: {
    kind: 'answer',
    body: mockProduct(
      'Testprodukt Müsli',
      {
        quantity: '500 g',
        product_quantity: 500,
        product_quantity_unit: 'g',
        serving_quantity: 50,
      },
      {
        'energy-kcal_100g': 380,
        'energy-kj_100g': 1590,
        proteins_100g: 10,
        carbohydrates_100g: 60,
        sugars_100g: 15,
        fat_100g: 9,
        'saturated-fat_100g': 1.5,
        fiber_100g: 8,
        salt_100g: 0.1,
      },
    ),
  },
  pruefen: {
    kind: 'answer',
    body: mockProduct(
      'Testprodukt Riegel',
      {
        quantity: '4 x 25 g',
        product_quantity: 100,
        product_quantity_unit: 'g',
        serving_quantity: 25,
      },
      // Makros ergeben ≈ 498 kcal, angegeben 300 → Atwater-Abweichung → „Werte prüfen“.
      {
        'energy-kcal_100g': 300,
        proteins_100g: 8,
        carbohydrates_100g: 60,
        sugars_100g: 30,
        fat_100g: 24,
        fiber_100g: 3,
        salt_100g: 0.2,
      },
    ),
  },
  unbrauchbar: {
    kind: 'answer',
    body: mockProduct(
      'Testprodukt ohne Nährwerte',
      { quantity: '250 g', product_quantity: 250, product_quantity_unit: 'g' },
      { proteins_100g: 5 },
    ),
  },
  nicht_gefunden: { kind: 'answer', body: { status: 0, status_verbose: 'product not found' } },
  einheit_vertauscht: {
    kind: 'answer',
    body: mockProduct(
      'Testprodukt Kekse',
      { quantity: '200 g', product_quantity: 200, product_quantity_unit: 'g' },
      {
        'energy-kcal_100g': 2000,
        'energy-kj_100g': 2000,
        proteins_100g: 6,
        carbohydrates_100g: 70,
        fat_100g: 20,
      },
    ),
  },
  getraenk: {
    kind: 'answer',
    body: mockProduct(
      'Testgetränk Apfelschorle',
      {
        quantity: '1 l',
        product_quantity: 1000,
        product_quantity_unit: 'ml',
        serving_quantity: 250,
      },
      {
        'energy-kcal_100g': 24,
        'energy-kj_100g': 100,
        proteins_100g: 0,
        carbohydrates_100g: 5.5,
        sugars_100g: 5.5,
        fat_100g: 0,
        salt_100g: 0,
      },
    ),
  },
  nur_kj: {
    kind: 'answer',
    body: mockProduct(
      'Testprodukt Joghurt',
      {
        quantity: '150 g',
        product_quantity: 150,
        product_quantity_unit: 'g',
        serving_quantity: 150,
      },
      {
        'energy-kj_100g': 400,
        proteins_100g: 4,
        carbohydrates_100g: 12,
        fat_100g: 3,
        fiber_100g: 0,
      },
    ),
  },
  zeitlimit: { kind: 'timeout' },
  ueberlastet: { kind: 'overloaded' },
};

/** Ersatz für die OFF-Abfrage: Testnummern → feste Antworten, jede andere gültige Nummer → nicht gefunden. */
export function mockOffFetch(code: string): Promise<OffFetchResult> {
  const found = MOCK_PRODUCT_CASES.find((c) => c.code === code);
  return Promise.resolve(found ? MOCK_ANSWERS[found.key] : { kind: 'answer', body: { status: 0 } });
}

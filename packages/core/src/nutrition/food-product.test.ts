import { describe, expect, it, vi } from 'vitest';

import {
  FOOD_PRODUCT_CHECK,
  FOOD_PRODUCT_LOOKUP_LIMITS,
  USER_FOOD_PRODUCT_LIMITS,
} from '../constants';
import { gs1CheckDigit, hasValidCheckDigit, normalizeBarcode } from './barcode';
import {
  foodLogEntrySchema,
  foodLogFavoriteSchema,
  foodLogKey,
  favoriteFromEntry,
  recentEntries,
  USER_PRODUCT_ENTRY_TITLE,
  type FoodLogEntry,
} from './food-log';
import {
  checkProductNutrients,
  checkUserFoodProduct,
  entryFromProduct,
  entryFromUserProduct,
  normalizeOffProduct,
  offFieldsForStorage,
  parseOffAnswer,
  productAmountChoices,
  productDataIsOld,
  productEntryTitle,
  productEntryDisplayTitle,
  PRODUCT_NAME_FALLBACK,
  rebuildProductEntry,
  sanitizeOffBrand,
  sanitizeOffText,
  serverProductEntry,
  userFoodProductSchema,
  userProductForCode,
  type ProductForEntry,
} from './food-product';
import {
  countProductLookup,
  lookupHourStart,
  MOCK_PRODUCT_CASES,
  mockOffFetch,
  productLookupLimit,
  productRecordExpired,
  productRecordFresh,
  notFoundRecord,
  productForEntryOf,
  productLookupResponseSchema,
  recordFromProduct,
  runProductLookup,
  type FoodProductRecord,
  type ProductLookupBegin,
  type ProductLookupDeps,
} from './food-product-lookup';
import { rebuildEntry } from './custom-meal';

/**
 * Etappe E4a (docs/PLAN-E4.md 4.2–4.5, 8.2): ALLE Werte hier sind ausgedachte Testwerte in OFF-Form – keine Daten von
 * Open Food Facts, kein Netz.
 */

const withCheck = (body: string) => `${body}${gs1CheckDigit(body)}`;
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const target = (n = 900) => ({ id: ID(n), date: '2026-10-17', slot: 'other' as const });
const EAN = withCheck('400638133393');

// ---------------------------------------------------------------------------------------------------------
// 4.2 Nummer
// ---------------------------------------------------------------------------------------------------------

describe('normalizeBarcode (Plan 4.2)', () => {
  it('Prüfziffer nach GS1: bekannte Nummern', () => {
    expect(hasValidCheckDigit('4006381333931')).toBe(true);
    expect(hasValidCheckDigit('96385074')).toBe(true);
    expect(hasValidCheckDigit('036000291452')).toBe(true);
    expect(hasValidCheckDigit('4006381333932')).toBe(false);
  });

  it('EAN-13 und EAN-8 bleiben, Leerzeichen/Bindestriche werden entfernt', () => {
    expect(normalizeBarcode('4006381333931')).toEqual({ ok: true, code: '4006381333931' });
    expect(normalizeBarcode(' 4 006381-333931 ')).toEqual({ ok: true, code: '4006381333931' });
    expect(normalizeBarcode('96385074')).toEqual({ ok: true, code: '96385074' });
  });

  it('UPC-A (12) → EAN-13 mit führender 0; GTIN-14 mit Indikator 0 → EAN-13, sonst 14 Ziffern', () => {
    expect(normalizeBarcode('036000291452')).toEqual({ ok: true, code: '0036000291452' });
    expect(normalizeBarcode('04006381333931')).toEqual({ ok: true, code: '4006381333931' });
    const gtin14 = withCheck('1400638133393');
    expect(normalizeBarcode(gtin14)).toEqual({ ok: true, code: gtin14 });
  });

  it.each([
    ['7 Ziffern', '1234567'],
    ['9 Ziffern', withCheck('12345678')],
    ['11 Ziffern', withCheck('1234567890')],
    ['15 Ziffern', withCheck('12345678901234')],
    ['falsche Prüfziffer', '4006381333932'],
    ['nur Nullen (8)', '00000000'],
    ['nur Nullen (13)', '0000000000000'],
    ['Buchstaben', '40063813339A1'],
    ['Emoji', '400638133393🍫'],
    ['leer', ''],
    ['1.000 Zeichen', '4'.repeat(1000)],
    ['Punkt', '4006381.333931'],
  ])('%s → invalid', (_name, input) => {
    expect(normalizeBarcode(input)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('kein Text (Zahl, null, Objekt) → invalid', () => {
    expect(normalizeBarcode(4006381333931)).toEqual({ ok: false, reason: 'invalid' });
    expect(normalizeBarcode(null)).toEqual({ ok: false, reason: 'invalid' });
    expect(normalizeBarcode({ code: EAN })).toEqual({ ok: false, reason: 'invalid' });
  });

  it.each([
    ['Ladencode 02', withCheck('021234567890')],
    ['Waagencode 20', withCheck('201234567890')],
    ['Waagencode 29', withCheck('291234567890')],
    ['RCN 04x', withCheck('041234567890')],
    ['Gutschein 05x', withCheck('051234567890')],
    ['Zeitschrift 977', withCheck('977123456789')],
    ['Buch 978', withCheck('978316148410')],
    ['Buch 979', withCheck('979123456789')],
    ['Gutschein 98', withCheck('981234567890')],
    ['Gutschein 99', withCheck('991234567890')],
    ['EAN-8 Ladencode 2', withCheck('2123456')],
    ['EAN-8 Ladencode 0', withCheck('0123456')],
    ['UPC-A Nummernsystem 2 (Gewicht)', withCheck('21234567890')],
    ['GTIN-14 mit Buch-Präfix', withCheck('1978316148410')],
  ])('%s → not_food (keine Abfrage)', (_name, input) => {
    expect(normalizeBarcode(input)).toEqual({ ok: false, reason: 'not_food' });
  });

  it('führende Nullen: EAN-8 mit 0 = Ladencode, UPC-A mit 0 = Lebensmittel', () => {
    expect(normalizeBarcode(withCheck('0012345')).ok).toBe(false);
    expect(normalizeBarcode(withCheck('01234567890'))).toEqual({
      ok: true,
      code: `0${withCheck('01234567890')}`,
    });
  });
});

// ---------------------------------------------------------------------------------------------------------
// 4.1 Texte
// ---------------------------------------------------------------------------------------------------------

describe('sanitizeOffText (Plan 4.1)', () => {
  it('HTML, Links, Steuer- und Bidi-Zeichen weg, Leerraum zusammengefasst', () => {
    expect(sanitizeOffText('<b>Müsli</b>  <script>alert(1)</script>Crunchy', 80)).toBe(
      'Müsli alert(1) Crunchy',
    );
    expect(sanitizeOffText('Joghurt https://evil.example/x www.evil.example Natur', 80)).toBe(
      'Joghurt Natur',
    );
    expect(sanitizeOffText('Ka\u202efee\u200b\u0007 Bohne\n\tn', 80)).toBe('Ka fee Bohne n');
  });

  it('Emoji bleibt, 500 Zeichen → 80 Code-Points, nur Leerraum → null', () => {
    expect(sanitizeOffText('Schoko 🍫', 80)).toBe('Schoko 🍫');
    const long = sanitizeOffText('🍫'.repeat(500), 80);
    expect([...(long ?? '')].length).toBe(80);
    expect(sanitizeOffText('   \u00a0 ', 80)).toBeNull();
    expect(sanitizeOffText(42, 80)).toBeNull();
  });

  it('Marke = erste Angabe vor dem Komma', () => {
    expect(sanitizeOffBrand('A, B, C')).toBe('A');
    expect(sanitizeOffBrand(' , B')).toBeNull();
    expect(sanitizeOffBrand(['A'])).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------
// 4.3/4.4 Normalisieren und Prüfen – OFF-förmige Testantworten mit AUSGEDACHTEN Werten
// ---------------------------------------------------------------------------------------------------------

const off = (nutriments: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  product_name_de: 'Testprodukt',
  brands: 'Testmarke',
  product_quantity_unit: 'g',
  quantity: '500 g',
  product_quantity: 500,
  ...extra,
  nutriments,
});
const norm = (n: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  normalizeOffProduct(off(n, extra), EAN);

describe('normalizeOffProduct + checkProductNutrients (Plan 4.3–4.5)', () => {
  it('Haferflocken: plausibel, Werte gerundet je 100 g', () => {
    const p = norm({
      'energy-kcal_100g': 370,
      'energy-kj_100g': 1550,
      proteins_100g: 13.54,
      carbohydrates_100g: 58.66,
      sugars_100g: 0.7,
      fat_100g: 7,
      'saturated-fat_100g': 1.3,
      fiber_100g: 10,
      salt_100g: 0.01,
    });
    expect(p.check).toEqual({ level: 'ok', reasons: [] });
    expect(p.per100).toEqual({
      kcal: 370,
      protein_g: 13.5,
      carbs_g: 58.7,
      fat_g: 7,
      sugar_g: 0.7,
      sat_fat_g: 1.3,
      fiber_g: 10,
      salt_g: 0,
    });
    expect(p.base_unit).toBe('g');
    expect(p.name_de).toBe('Testprodukt');
    expect(p.brand_de).toBe('Testmarke');
    expect(p.package_g).toBe(500);
  });

  it('Haferflocken ohne Ballaststoffe: ok (Ballaststoffe erklären die Lücke nach unten)', () => {
    const p = norm({
      'energy-kcal_100g': 370,
      proteins_100g: 13.5,
      carbohydrates_100g: 58.7,
      fat_100g: 7,
    });
    expect(p.check.level).toBe('ok');
  });

  it('Wasser 0/0/0/0 → ok (absolute Mindest-Toleranz); Mineralwasser je 100 ml', () => {
    const zero = {
      'energy-kcal_100g': 0,
      proteins_100g: 0,
      carbohydrates_100g: 0,
      fat_100g: 0,
    };
    expect(norm(zero).check.level).toBe('ok');
    const water = norm(zero, { product_quantity_unit: 'ml', quantity: '1,5 l' });
    expect(water.base_unit).toBe('ml');
    expect(water.check).toEqual({ level: 'ok', reasons: [] });
  });

  it('Rapsöl 900 kcal / 100 g Fett → ok; 906 kcal → gesperrt', () => {
    const oil = {
      'energy-kj_100g': 3700,
      proteins_100g: 0,
      carbohydrates_100g: 0,
      fat_100g: 100,
    };
    expect(norm({ ...oil, 'energy-kcal_100g': 900 }).check.level).toBe('ok');
    const high = norm({ ...oil, 'energy-kcal_100g': 906 });
    expect(high.check.level).toBe('blocked');
    expect(high.check.reasons).toContain('kcal_too_high');
    expect(high.per100.kcal).toBeNull();
  });

  it('Butter 741 kcal, 83 g Fett, 0,7 g Eiweiß → ok', () => {
    expect(
      norm({
        'energy-kcal_100g': 741,
        proteins_100g: 0.7,
        carbohydrates_100g: 0.6,
        fat_100g: 83,
      }).check.level,
    ).toBe('ok');
  });

  it('Cola light 0,3 kcal / 1 kJ: kJ-Abgleich erst ab 10 kcal, gespeichert 0 kcal', () => {
    const p = norm(
      {
        'energy-kcal_100g': 0.3,
        'energy-kj_100g': 1,
        proteins_100g: 0,
        carbohydrates_100g: 0,
        fat_100g: 0,
      },
      { product_quantity_unit: 'ml', quantity: '1 l' },
    );
    expect(p.check).toEqual({ level: 'ok', reasons: [] });
    expect(p.per100.kcal).toBe(0);
  });

  it('Kaugummi mit 60 g Polyolen: mit Polyol-Feld ok, ohne „Werte prüfen“', () => {
    const gum = {
      'energy-kcal_100g': 184,
      proteins_100g: 0,
      carbohydrates_100g: 70,
      fat_100g: 0,
    };
    expect(norm({ ...gum, polyols_100g: 60 }).check.level).toBe('ok');
    const without = norm(gum);
    expect(without.check).toEqual({ level: 'review', reasons: ['atwater_mismatch'] });
  });

  it('Bier 5 % vol: Alkohol erklärt die kcal (mit Ballaststoff-Angabe 0 streng geprüft)', () => {
    const beer = {
      'energy-kcal_100g': 43,
      'energy-kj_100g': 180,
      proteins_100g: 0.5,
      carbohydrates_100g: 3.1,
      fat_100g: 0,
      fiber_100g: 0,
    };
    const extra = { product_quantity_unit: 'ml', quantity: '0,5 l' };
    expect(norm({ ...beer, alcohol_100g: 5 }, extra).check.level).toBe('ok');
    expect(norm(beer, extra).check.reasons).toContain('atwater_mismatch');
  });

  it('Proteinpulver 380 kcal, 80 g Eiweiß → ok', () => {
    expect(
      norm({
        'energy-kcal_100g': 380,
        proteins_100g: 80,
        carbohydrates_100g: 5,
        fat_100g: 5,
      }).check.level,
    ).toBe('ok');
  });

  it('kJ = kcal (kJ als kcal eingetragen) → gesperrt; Verhältnis 3,8 / 4,6 gerade noch ok', () => {
    const base = { proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 9 };
    const p = norm({ ...base, 'energy-kcal_100g': 400, 'energy-kj_100g': 400 });
    expect(p.check.level).toBe('blocked');
    expect(p.check.reasons).toContain('kj_kcal_mismatch');
    expect(
      norm({ ...base, 'energy-kcal_100g': 400, 'energy-kj_100g': 1520 }).check.reasons,
    ).not.toContain('kj_kcal_mismatch');
    expect(
      norm({ ...base, 'energy-kcal_100g': 400, 'energy-kj_100g': 1840 }).check.reasons,
    ).not.toContain('kj_kcal_mismatch');
    expect(
      norm({ ...base, 'energy-kcal_100g': 400, 'energy-kj_100g': 1841 }).check.reasons,
    ).toContain('kj_kcal_mismatch');
  });

  it('nur kJ: kcal = kJ / 4,184 und „Werte prüfen“; `energy` ohne Zusatz gilt als kJ', () => {
    const base = {
      proteins_100g: 10,
      carbohydrates_100g: 60,
      fat_100g: 9,
      fiber_100g: 8,
    };
    const p = norm({ ...base, 'energy-kj_100g': 1590 });
    expect(p.per100.kcal).toBe(380);
    expect(p.check).toEqual({ level: 'review', reasons: ['kcal_from_kj'] });
    expect(norm({ ...base, energy_100g: 1590 }).per100.kcal).toBe(380);
  });

  it('nur Natrium: Salz = Natrium × 2,5', () => {
    const p = norm({
      'energy-kcal_100g': 100,
      proteins_100g: 5,
      carbohydrates_100g: 15,
      fat_100g: 2,
      sodium_100g: 0.4,
    });
    expect(p.per100.salt_g).toBe(1);
  });

  it('nur Portionswerte: mit plausibler Portion umgerechnet („Werte prüfen“), ohne Portion gesperrt', () => {
    const serving = {
      'energy-kcal_serving': 120,
      proteins_serving: 3,
      carbohydrates_serving: 20,
      fat_serving: 3,
    };
    const p = norm(serving, { serving_quantity: 30 });
    expect(p.per100).toMatchObject({ kcal: 400, protein_g: 10, carbs_g: 66.7, fat_g: 10 });
    expect(p.check).toEqual({ level: 'review', reasons: ['from_serving'] });
    expect(p.serving_g).toBe(30);
    const none = norm(serving);
    expect(none.check.level).toBe('blocked');
    expect(none.check.reasons).toContain('energy_missing');
  });

  it('Suppenpulver nur zubereitet → gesperrt (prepared_only)', () => {
    const p = norm({
      'energy-kcal_prepared_100g': 40,
      proteins_prepared_100g: 1,
      carbohydrates_prepared_100g: 6,
      fat_prepared_100g: 1,
    });
    expect(p.check.level).toBe('blocked');
    expect(p.check.reasons).toContain('prepared_only');
  });

  it('Makro-Summe 102 g ok, 103 g gesperrt (g); Sirup je 100 ml mit Summe 105 ok', () => {
    const sum = (fiber: number) => ({
      'energy-kcal_100g': 600 + 2 * fiber,
      proteins_100g: 30,
      carbohydrates_100g: 30,
      fat_100g: 40,
      fiber_100g: fiber,
    });
    expect(norm(sum(2)).check.level).toBe('ok');
    expect(norm(sum(3)).check.reasons).toContain('macro_sum_too_high');
    const syrup = {
      'energy-kcal_100g': 445,
      proteins_100g: 5,
      carbohydrates_100g: 95,
      fat_100g: 5,
    };
    expect(norm(syrup, { product_quantity_unit: 'ml', quantity: '0,7 l' }).check.level).toBe('ok');
    expect(norm(syrup).check.reasons).toContain('macro_sum_too_high');
  });

  it('„< 0,5“ (Modifier) → Wert übernommen, Hinweis upper_bound ohne Stufe', () => {
    const p = norm({
      'energy-kcal_100g': 250,
      proteins_100g: 10,
      carbohydrates_100g: 50,
      fat_100g: 0.5,
      fat_modifier: '<',
    });
    expect(p.check).toEqual({ level: 'ok', reasons: ['upper_bound'] });
    expect(p.per100.fat_g).toBe(0.5);
  });

  it('negative Werte, NaN-Texte → gesperrt (invalid_value); reine Dezimal-Texte gelten als Zahl', () => {
    const base = {
      'energy-kcal_100g': 250,
      proteins_100g: 10,
      carbohydrates_100g: 50,
      fat_100g: 2,
    };
    expect(norm({ ...base, fat_100g: -1 }).check.reasons).toContain('invalid_value');
    expect(norm({ ...base, sugars_100g: 'viel' }).check.reasons).toContain('invalid_value');
    expect(norm({ ...base, fat_100g: Number.POSITIVE_INFINITY }).check.level).toBe('blocked');
    expect(norm({ ...base, proteins_100g: '10' }).check.level).toBe('ok');
  });

  it('fehlende Makros bzw. Energie → gesperrt (keine stille 0, E4-G3)', () => {
    expect(
      norm({ 'energy-kcal_100g': 250, proteins_100g: 10, carbohydrates_100g: 50 }).check.reasons,
    ).toEqual(['macro_missing']);
    expect(norm({ proteins_100g: 10, carbohydrates_100g: 50, fat_100g: 2 }).check.reasons).toEqual([
      'energy_missing',
    ]);
  });

  it('Zucker > Kohlenhydrate + 0,5 bzw. gesättigte > Fett + 0,5 → „Werte prüfen“', () => {
    const base = {
      'energy-kcal_100g': 250,
      proteins_100g: 10,
      carbohydrates_100g: 50,
      fat_100g: 2,
    };
    expect(norm({ ...base, sugars_100g: 50.5 }).check.level).toBe('ok');
    expect(norm({ ...base, sugars_100g: 50.6 }).check.reasons).toEqual(['sugar_over_carbs']);
    expect(norm({ ...base, 'saturated-fat_100g': 2.6 }).check.reasons).toEqual([
      'sat_fat_over_fat',
    ]);
  });

  it('Atwater-Grenze 20 % (mindestens 10 kcal)', () => {
    // 4·10 + 4·50 + 9·10 = 330 → 20 % von kcal
    const at = (kcal: number) =>
      checkProductNutrients({
        baseUnit: 'g',
        kcal,
        protein_g: 10,
        carbs_g: 50,
        fat_g: 10,
        fiber_g: 0,
      }).level;
    expect(at(275)).toBe('ok'); // 330 − 275 = 55 = 20 %
    expect(at(274)).toBe('review');
    expect(at(412)).toBe('ok'); // 82 ≤ 82,4
    expect(at(413)).toBe('review');
  });

  it('Name: de, sonst allgemein, sonst generisch, sonst „Produkt ohne Namen“; Packung 5 kg und Portion 0/2.001 g', () => {
    const n = { 'energy-kcal_100g': 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 };
    expect(norm(n, { product_name_de: '', product_name: 'Allgemein' }).name_de).toBe('Allgemein');
    expect(
      norm(n, { product_name_de: ' ', product_name: '<p></p>', generic_name_de: 'Generisch' })
        .name_de,
    ).toBe('Generisch');
    expect(norm(n, { product_name_de: undefined }).name_de).toBe(PRODUCT_NAME_FALLBACK);
    expect(norm(n, { product_quantity: 5000 }).package_g).toBeNull();
    expect(norm(n, { product_quantity: '400' }).package_g).toBe(400);
    for (const serving of [0, 2001]) {
      const p = norm(n, { serving_quantity: serving });
      expect(p.serving_g).toBeNull();
      expect(p.check.reasons).toEqual(['serving_ignored']);
    }
  });

  it('Einheit: ml/g aus product_quantity_unit oder Packung, sonst g mit „Werte prüfen“', () => {
    const n = { 'energy-kcal_100g': 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 };
    expect(norm(n, { product_quantity_unit: undefined, quantity: '33 cl' }).base_unit).toBe('ml');
    expect(norm(n, { product_quantity_unit: undefined, quantity: '1 kg' }).base_unit).toBe('g');
    const unknown = norm(n, { product_quantity_unit: undefined, quantity: 'eine Dose' });
    expect(unknown.base_unit).toBe('g');
    expect(unknown.check).toEqual({ level: 'review', reasons: ['unit_assumed'] });
  });

  it('OFF-Stand: Zeitpunkt aus last_modified_t, Hinweis ab 3 Jahren', () => {
    const p = norm(
      { 'energy-kcal_100g': 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 },
      { last_modified_t: 1_600_000_000 },
    );
    expect(p.off_last_modified).toBe('2020-09-13T12:26:40.000Z');
    expect(productDataIsOld(p.off_last_modified, '2026-10-17T10:00:00Z')).toBe(true);
    expect(productDataIsOld('2024-10-17T10:00:00Z', '2026-10-17T10:00:00Z')).toBe(false);
    expect(productDataIsOld(null, '2026-10-17T10:00:00Z')).toBe(false);
  });

  it('parseOffAnswer: status 1 + product = gefunden, status 0 = nicht gefunden, sonst unbrauchbar', () => {
    expect(parseOffAnswer({ status: 1, product: { a: 1 } })).toEqual({
      kind: 'found',
      product: { a: 1 },
    });
    expect(parseOffAnswer({ status: 0 })).toEqual({ kind: 'not_found' });
    expect(parseOffAnswer({ status: 1 })).toEqual({ kind: 'not_found' });
    expect(parseOffAnswer('kaputt')).toEqual({ kind: 'invalid' });
    expect(parseOffAnswer({ status: 2 })).toEqual({ kind: 'invalid' });
  });

  it('offFieldsForStorage: nur abgefragte Felder, keine Bilder/Zutaten/Nutri-Score', () => {
    const stored = offFieldsForStorage({
      ...off({ 'energy-kcal_100g': 1, nutrition_grade: 'a', 'nova-group_100g': 4 }),
      image_url: 'https://images.example/x.jpg',
      ingredients_text: 'Zutaten',
      nutriscore_grade: 'e',
      creator: 'person',
    });
    expect(Object.keys(stored).sort()).toEqual(
      [
        'brands',
        'nutriments',
        'product_name_de',
        'product_quantity',
        'product_quantity_unit',
        'quantity',
      ].sort(),
    );
    expect(stored.nutriments).toEqual({ 'energy-kcal_100g': 1 });
  });
});

// ---------------------------------------------------------------------------------------------------------
// Tagebuch: Herkunft product
// ---------------------------------------------------------------------------------------------------------

const muesli: ProductForEntry = {
  code: EAN,
  name_de: 'Testmüsli',
  brand_de: 'Testmarke',
  base_unit: 'g',
  check_level: 'ok',
  kcal: 380,
  protein_g: 10,
  carbs_g: 60,
  fat_g: 9,
};
const entry = (b: ReturnType<typeof entryFromProduct>): FoodLogEntry => {
  if (!b.ok) throw new Error(b.reason);
  return b.entry;
};

describe('entryFromProduct / entryFromUserProduct (Plan 3.5)', () => {
  it('Werte = je 100 × Menge / 100, Titel „Name · Marke“, Herkunft product, Nummer als Verweis', () => {
    const e = entry(entryFromProduct(muesli, 45, target()));
    expect(e).toMatchObject({
      source: 'product',
      product_code: EAN,
      user_product_id: null,
      title_de: 'Testmüsli · Testmarke',
      amount: 45,
      unit: 'g',
      kcal: 171,
      protein_g: 4.5,
      carbs_g: 27,
      fat_g: 4.1,
    });
    expect(foodLogEntrySchema.safeParse(e).success).toBe(true);
    expect(foodLogKey(e)).toBe(`product|${EAN}`);
  });

  it('gesperrtes Produkt, Menge 0/2.001 und Stück → nicht eintragbar; 2.000 g geht', () => {
    expect(entryFromProduct({ ...muesli, check_level: 'blocked' }, 45, target()).ok).toBe(false);
    expect(entryFromProduct({ ...muesli, kcal: null }, 45, target()).ok).toBe(false);
    expect(entryFromProduct(muesli, 0, target())).toEqual({ ok: false, reason: 'amount' });
    expect(entryFromProduct(muesli, 2001, target())).toEqual({ ok: false, reason: 'amount' });
    expect(entryFromProduct({ ...muesli, kcal: 100, carbs_g: 30 }, 2000, target()).ok).toBe(true);
  });

  it('3.000-kcal-Grenze je Eintrag: Öl 333 g = 2.997 kcal ok, 334 g = 3.006 kcal abgelehnt', () => {
    const oil = { ...muesli, kcal: 900, protein_g: 0, carbs_g: 0, fat_g: 100 };
    expect(entry(entryFromProduct(oil, 333, target())).kcal).toBe(2997);
    expect(entryFromProduct(oil, 334, target())).toEqual({ ok: false, reason: 'too_much' });
  });

  it('Titel höchstens 100 Zeichen', () => {
    expect([...productEntryTitle('N'.repeat(80), 'M'.repeat(40))].length).toBe(100);
    expect(productEntryTitle('Name', null)).toBe('Name');
  });

  it('eigenes Produkt: fester Titel „Eigenes Produkt“, Verweis, nie Name/Marke im Eintrag', () => {
    const own = {
      id: ID(5),
      base_unit: 'ml' as const,
      kcal: 64,
      protein_g: 3.3,
      carbs_g: 4.8,
      fat_g: 3.5,
    };
    const e = entry(entryFromUserProduct(own, 250, target()));
    expect(e).toMatchObject({
      title_de: USER_PRODUCT_ENTRY_TITLE,
      user_product_id: ID(5),
      product_code: null,
      unit: 'ml',
      kcal: 160,
      protein_g: 8.3,
      carbs_g: 12,
      fat_g: 8.8,
    });
    expect(foodLogKey(e)).toBe(`own_product|${ID(5)}`);
    expect(productEntryDisplayTitle(e, [{ id: ID(5), name_de: 'Hafermilch' }])).toBe('Hafermilch');
    expect(productEntryDisplayTitle(e, [])).toBe(USER_PRODUCT_ENTRY_TITLE);
  });

  it('Schema: Verweise nur bei product, nie beide, ohne Nummer fester Titel, keine Stück-Einheit', () => {
    const e = entry(entryFromProduct(muesli, 45, target()));
    const bad = (over: Partial<FoodLogEntry>) =>
      foodLogEntrySchema.safeParse({ ...e, ...over }).success;
    expect(bad({ user_product_id: ID(1) })).toBe(false);
    expect(bad({ product_code: null })).toBe(false);
    expect(bad({ product_code: null, title_de: USER_PRODUCT_ENTRY_TITLE })).toBe(true);
    expect(bad({ unit: 'piece', amount: 2 })).toBe(false);
    expect(bad({ product_code: '4006381333932' })).toBe(false);
    expect(bad({ kcal: null })).toBe(false);
    expect(foodLogEntrySchema.safeParse({ ...e, source: 'food', food_id: 'x' }).success).toBe(
      false,
    );
  });

  it('Favorit: nur Verweis + Menge, keine Werte; gelöschtes eigenes Produkt hat keinen Stern', () => {
    const e = entry(entryFromProduct(muesli, 45, target()));
    const fav = favoriteFromEntry(e);
    expect(fav).toMatchObject({
      fav_key: `product|${EAN}`,
      source: 'product',
      product_code: EAN,
      amount: 45,
      unit: 'g',
      kcal: null,
      protein_g: null,
    });
    expect(foodLogFavoriteSchema.safeParse({ ...fav, kcal: 171 }).success).toBe(false);
    expect(
      favoriteFromEntry({ ...e, product_code: null, title_de: USER_PRODUCT_ENTRY_TITLE }),
    ).toBeNull();
  });

  it('„Zuletzt“: Produkte je Nummer, gelöschte eigene Produkte nicht', () => {
    const at = (n: number, e: FoodLogEntry) => ({ ...e, created_at: `2026-10-17T0${n}:00:00Z` });
    const a = at(1, entry(entryFromProduct(muesli, 45, target(1))));
    const b = at(2, entry(entryFromProduct(muesli, 60, target(2))));
    const gone = at(3, {
      ...entry(
        entryFromUserProduct(
          { id: ID(7), base_unit: 'g', kcal: 380, protein_g: 10, carbs_g: 60, fat_g: 9 },
          50,
          target(3),
        ),
      ),
      user_product_id: null,
    });
    expect(recentEntries([a, b, gone]).map((e) => e.id)).toEqual([ID(2)]);
  });

  it('Mengen-Knöpfe: ½/1/2 Portionen, ganze Packung – nur 1–2.000', () => {
    expect(productAmountChoices({ serving_g: 30, package_g: 400 })).toEqual([
      { kind: 'half', amount: 15 },
      { kind: 'serving', amount: 30 },
      { kind: 'double', amount: 60 },
      { kind: 'package', amount: 400 },
    ]);
    expect(productAmountChoices({ serving_g: 1500, package_g: null })).toEqual([
      { kind: 'half', amount: 750 },
      { kind: 'serving', amount: 1500 },
    ]);
    expect(productAmountChoices({ serving_g: null, package_g: null })).toEqual([]);
  });
});

describe('serverProductEntry – Server rechnet nach (Plan 3.5, gleich wie SQL)', () => {
  const device = (over: Partial<FoodLogEntry> = {}): FoodLogEntry => ({
    ...entry(entryFromProduct(muesli, 45, target())),
    kcal: 1,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    title_de: 'Freitext vom Gerät',
    ...over,
  });

  it('neu: Werte und Titel aus dem Speicher, Gerätewerte ersetzt', () => {
    const r = serverProductEntry(device(), null, { product: muesli, userProduct: null });
    expect(r.kind === 'ok' && r.entry).toMatchObject({
      kcal: 171,
      title_de: 'Testmüsli · Testmarke',
    });
  });

  it('neu ohne Speicher-Zeile bzw. gesperrt → unavailable; falsche Einheit → invalid', () => {
    expect(serverProductEntry(device(), null, { product: null, userProduct: null })).toEqual({
      kind: 'unavailable',
    });
    expect(
      serverProductEntry(device(), null, {
        product: { ...muesli, check_level: 'blocked' },
        userProduct: null,
      }),
    ).toEqual({ kind: 'unavailable' });
    expect(
      serverProductEntry(device({ unit: 'ml' }), null, { product: muesli, userProduct: null }),
    ).toEqual({ kind: 'invalid' });
  });

  it('Ändern: gleiche Menge = Schnappschuss; ohne Speicher-Zeile verhältnisgleich aus dem Schnappschuss', () => {
    const old = entry(entryFromProduct(muesli, 45, target()));
    const same = serverProductEntry({ ...old, slot: 'lunch', kcal: 9 }, old, {
      product: null,
      userProduct: null,
    });
    expect(same.kind === 'ok' && same.entry.kcal).toBe(171);
    const more = serverProductEntry({ ...old, amount: 90 }, old, {
      product: null,
      userProduct: null,
    });
    expect(more.kind === 'ok' && more.entry).toMatchObject({
      kcal: 342,
      protein_g: 9,
      title_de: old.title_de,
    });
    const fresh = serverProductEntry({ ...old, amount: 90 }, old, {
      product: { ...muesli, kcal: 400 },
      userProduct: null,
    });
    expect(fresh.kind === 'ok' && fresh.entry.kcal).toBe(360);
  });

  it('eigenes Produkt: vorhanden → aus dem Produkt; fremd/gelöscht neu → Gerätewerte, Verweis leer', () => {
    const own = {
      id: ID(9),
      base_unit: 'g' as const,
      kcal: 200,
      protein_g: 10,
      carbs_g: 20,
      fat_g: 5,
    };
    const e = { ...entry(entryFromUserProduct(own, 50, target())), kcal: 5 };
    const r = serverProductEntry(e, null, { product: null, userProduct: own });
    expect(r.kind === 'ok' && r.entry).toMatchObject({ kcal: 100, user_product_id: ID(9) });
    const missing = serverProductEntry(e, null, { product: null, userProduct: null });
    expect(missing.kind === 'ok' && missing.entry).toMatchObject({
      kcal: 5,
      user_product_id: null,
      title_de: USER_PRODUCT_ENTRY_TITLE,
    });
    const old = entry(entryFromUserProduct(own, 50, target()));
    const edit = serverProductEntry({ ...old, amount: 100 }, old, {
      product: null,
      userProduct: null,
    });
    expect(edit.kind === 'ok' && edit.entry).toMatchObject({ kcal: 200, user_product_id: null });
  });

  it('rebuildProductEntry und rebuildEntry (ohne Quelle verhältnisgleich, nur g/ml)', () => {
    const old = entry(entryFromProduct(muesli, 45, target()));
    const r = rebuildProductEntry(old, 90, { product: muesli, userProduct: null });
    expect(r.ok && r.entry.kcal).toBe(342);
    expect(rebuildProductEntry(old, 2001, { product: muesli, userProduct: null }).ok).toBe(false);
    const plain = rebuildEntry(old, { amount: 90 }, { foods: new Map(), recipes: [], meals: [] });
    expect(plain.ok && plain.entry.kcal).toBe(342);
    expect(rebuildEntry(old, { portion: 1 }, { foods: new Map(), recipes: [], meals: [] }).ok).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------------------------------------
// Eigene Produkte
// ---------------------------------------------------------------------------------------------------------

describe('userFoodProductSchema (Plan 2.3/3.4)', () => {
  const valid = {
    id: ID(1),
    name_de: 'Hafermilch',
    brand_de: 'Eigenmarke',
    code: EAN,
    base_unit: 'ml' as const,
    kcal: 46,
    protein_g: 1,
    carbs_g: 6.7,
    fat_g: 1.5,
    sugar_g: 4,
    salt_g: 0.1,
    serving_g: 250,
    based_on_off: false,
  };
  const ok = (over: Record<string, unknown>) =>
    userFoodProductSchema.safeParse({ ...valid, ...over }).success;

  it('gültig; ohne Marke/Nummer/Zucker/Salz/Portion ebenfalls', () => {
    expect(ok({})).toBe(true);
    expect(ok({ brand_de: null, code: null, sugar_g: null, salt_g: null, serving_g: null })).toBe(
      true,
    );
  });

  it.each([
    ['120 g Fett (unmöglich)', { fat_g: 120 }],
    ['kcal 901', { kcal: 901 }],
    ['kcal mit Nachkommastelle', { kcal: 46.5 }],
    ['Makro mit zwei Nachkommastellen', { protein_g: 1.25 }],
    ['negatives Eiweiß', { protein_g: -1 }],
    ['Summe über 110 bei ml', { protein_g: 40, carbs_g: 40, fat_g: 31, salt_g: 0 }],
    ['Name leer', { name_de: '' }],
    ['Name 61 Zeichen', { name_de: 'x'.repeat(61) }],
    ['Name mit Steuerzeichen', { name_de: 'Hafer\u0007milch' }],
    ['Name mit Bidi', { name_de: 'Hafer\u202emilch' }],
    ['Name Leerzeichen am Rand', { name_de: ' Hafermilch' }],
    ['Marke 41 Zeichen', { brand_de: 'm'.repeat(41) }],
    ['Marke leer', { brand_de: '' }],
    ['Nummer mit falscher Prüfziffer', { code: '4006381333932' }],
    ['Portion 0', { serving_g: 0 }],
    ['Portion 2.001', { serving_g: 2001 }],
    ['Einheit Stück', { base_unit: 'piece' }],
    ['unbekanntes Feld', { user_id: ID(2) }],
  ])('%s → ungültig', (_name, over) => {
    expect(ok(over)).toBe(false);
  });

  it('Name 60 Zeichen und Emoji gehen; Summe 102 bei g geht, 102,1 nicht', () => {
    expect(ok({ name_de: 'x'.repeat(60) })).toBe(true);
    expect(ok({ name_de: 'Müsli 🥣' })).toBe(true);
    const g = { base_unit: 'g', protein_g: 50, carbs_g: 0, fat_g: 52, salt_g: 0, kcal: 668 };
    expect(ok(g)).toBe(true);
    expect(ok({ ...g, salt_g: 0.1 })).toBe(false);
  });

  it('Prüfung wie OFF: Atwater-Abweichung = Rückfrage (keine Sperre)', () => {
    expect(checkUserFoodProduct({ ...valid, kcal: 46 }).level).toBe('ok');
    expect(checkUserFoodProduct({ ...valid, kcal: 300 }).level).toBe('ok'); // ohne Ballaststoffe nur nach oben
    expect(checkUserFoodProduct({ ...valid, kcal: 10 }).level).toBe('review');
  });

  it('eigenes Produkt mit dieser Nummer: das zuletzt geänderte', () => {
    const list = [
      { code: EAN, updated_at: '2026-10-01', id: 'a' },
      { code: EAN, updated_at: '2026-10-05', id: 'b' },
      { code: null, updated_at: '2026-10-09', id: 'c' },
    ];
    expect(userProductForCode(list, EAN)?.id).toBe('b');
    expect(userProductForCode(list, withCheck('400000000001'))).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------
// Kette (Route und Testmodus)
// ---------------------------------------------------------------------------------------------------------

const NOW = '2026-10-17T10:00:00.000Z';

function deps(begin: ProductLookupBegin, over: Partial<ProductLookupDeps> = {}) {
  const stored: FoodProductRecord[] = [];
  const reports: string[] = [];
  const d: ProductLookupDeps = {
    begin: vi.fn(() => Promise.resolve(begin)),
    fetchOff: vi.fn(mockOffFetch),
    store: vi.fn((r: FoodProductRecord) => {
      stored.push(r);
      return Promise.resolve();
    }),
    backoff: vi.fn(() => Promise.resolve()),
    now: () => NOW,
    mock: true,
    report: (c) => reports.push(c),
    ...over,
  };
  return { d, stored, reports };
}
const code = (key: (typeof MOCK_PRODUCT_CASES)[number]['key']) =>
  MOCK_PRODUCT_CASES.find((c) => c.key === key)?.code ?? '';

describe('runProductLookup (Plan 3.2)', () => {
  it('Testnummern: gültig, verschieden, keine Ladencodes', () => {
    const codes = MOCK_PRODUCT_CASES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(normalizeBarcode(c)).toEqual({ ok: true, code: c });
  });

  it('ungültige Nummer und Ladencode: keine Reservierung, keine Abfrage', async () => {
    const { d } = deps({ result: 'fetch', record: null });
    expect((await runProductLookup({ code: '4006381333932' }, d)).body).toEqual({
      code: 'invalid_code',
    });
    expect((await runProductLookup({ code: withCheck('201234567890') }, d)).body).toEqual({
      code: 'not_food_code',
    });
    expect(d.begin).not.toHaveBeenCalled();
    expect(d.fetchOff).not.toHaveBeenCalled();
  });

  it.each([
    [{ result: 'flag_off' } as const, 503, { code: 'not_configured' }],
    [{ result: 'no_consent' } as const, 403, { code: 'no_consent' }],
    [{ result: 'unavailable' } as const, 503, { code: 'unavailable' }],
    [
      { result: 'rate_limited', scope: 'day' } as const,
      429,
      { code: 'rate_limited', scope: 'day' },
    ],
  ])('%j → %s', async (begin, status, body) => {
    const { d } = deps(begin);
    const r = await runProductLookup({ code: code('plausibel') }, d);
    expect(r).toEqual({ status, body });
    expect(d.fetchOff).not.toHaveBeenCalled();
  });

  it('gefunden: normalisiert, gespeichert, Antwort nach Schema (mit Quelle)', async () => {
    const { d, stored } = deps({ result: 'fetch', record: null });
    const r = await runProductLookup({ code: code('plausibel') }, d);
    expect(r.status).toBe(200);
    expect(productLookupResponseSchema.safeParse(r.body).success).toBe(true);
    expect(r.body).toMatchObject({
      code: 'found',
      check: { level: 'ok' },
      stale: false,
      mock: true,
      product: {
        brand_de: 'Testmarke',
        base_unit: 'g',
        serving_g: 50,
        source: { db: 'open_food_facts', license: 'ODbL-1.0', retrieved_at: NOW },
      },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      found: true,
      check_level: 'ok',
      kcal: 380,
      retrieved_at: NOW,
    });
  });

  it.each([
    ['pruefen', 'review'],
    ['unbrauchbar', 'blocked'],
    ['einheit_vertauscht', 'blocked'],
    ['getraenk', 'ok'],
    ['nur_kj', 'review'],
  ] as const)('Attrappe %s → Stufe %s', async (key, level) => {
    const { d } = deps({ result: 'fetch', record: null });
    const r = await runProductLookup({ code: code(key) }, d);
    expect(r.body.code === 'found' && r.body.check.level).toBe(level);
  });

  it('nicht gefunden: negativer Treffer gespeichert', async () => {
    const { d, stored } = deps({ result: 'fetch', record: null });
    const r = await runProductLookup({ code: code('nicht_gefunden') }, d);
    expect(r).toEqual({ status: 200, body: { code: 'not_found' } });
    expect(stored[0]).toMatchObject({ found: false, check_level: null });
    const unknown = await runProductLookup({ code: withCheck('400000000123') }, d);
    expect(unknown.body).toEqual({ code: 'not_found' });
  });

  it('Speicher frisch: keine OFF-Abfrage; negativer Treffer → nicht gefunden', async () => {
    const product = normalizeOffProduct(
      off({ 'energy-kcal_100g': 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 }),
      EAN,
    );
    const record = recordFromProduct(product, off({}), '2026-10-10T00:00:00.000Z');
    const { d, stored, reports } = deps({ result: 'cached', record, stale: false });
    const r = await runProductLookup({ code: EAN }, d);
    expect(r.body.code === 'found' && r.body.product.source.retrieved_at).toBe(
      '2026-10-10T00:00:00.000Z',
    );
    expect(d.fetchOff).not.toHaveBeenCalled();
    expect(stored).toHaveLength(0);
    expect(reports).toEqual(['cache_hit']);
    const neg = deps({ result: 'cached', record: notFoundRecord(EAN, NOW), stale: false });
    expect((await runProductLookup({ code: EAN }, neg.d)).body).toEqual({ code: 'not_found' });
  });

  it('neue Regel-Fassung: aus den unveränderten OFF-Feldern neu gerechnet und gespeichert (Abrufzeit bleibt)', async () => {
    const offFields = off({
      'energy-kcal_100g': 0,
      proteins_100g: 0,
      carbohydrates_100g: 0,
      fat_100g: 0,
    });
    const record = {
      ...recordFromProduct(
        normalizeOffProduct(offFields, EAN),
        offFields,
        '2026-10-01T00:00:00.000Z',
      ),
      normalizer_version: FOOD_PRODUCT_CHECK.normalizerVersion - 1,
      kcal: 999,
    };
    const { d, stored } = deps({ result: 'cached', record, stale: false });
    await runProductLookup({ code: EAN }, d);
    expect(stored[0]).toMatchObject({
      kcal: 0,
      normalizer_version: FOOD_PRODUCT_CHECK.normalizerVersion,
      retrieved_at: '2026-10-01T00:00:00.000Z',
    });
  });

  it('429/503: Sperre des globalen Deckels, ohne alte Zeile „nicht erreichbar“, mit alter Zeile „Stand vom …“', async () => {
    const { d, reports } = deps({ result: 'fetch', record: null });
    const r = await runProductLookup({ code: code('ueberlastet') }, d);
    expect(r).toEqual({ status: 503, body: { code: 'unavailable' } });
    expect(d.backoff).toHaveBeenCalledTimes(1);
    expect(reports).toContain('off_429');
    const offFields = off({
      'energy-kcal_100g': 0,
      proteins_100g: 0,
      carbohydrates_100g: 0,
      fat_100g: 0,
    });
    const old = recordFromProduct(
      normalizeOffProduct(offFields, code('ueberlastet')),
      offFields,
      '2026-08-01T00:00:00.000Z',
    );
    const withOld = deps({ result: 'fetch', record: old });
    const r2 = await runProductLookup({ code: code('ueberlastet') }, withOld.d);
    expect(r2.body).toMatchObject({ code: 'found', stale: true });
  });

  it('Zeitlimit, Fehler, kaputte Antwort → nicht erreichbar, keine Sperre, kein Speichern', async () => {
    for (const fetchOff of [
      () => Promise.resolve({ kind: 'timeout' as const }),
      () => Promise.reject(new Error('x')),
      () => Promise.resolve({ kind: 'answer' as const, body: 'kaputt' }),
    ]) {
      const { d, stored } = deps({ result: 'fetch', record: null }, { fetchOff });
      expect((await runProductLookup({ code: EAN }, d)).body).toEqual({ code: 'unavailable' });
      expect(d.backoff).not.toHaveBeenCalled();
      expect(stored).toHaveLength(0);
    }
  });

  it('Speichern scheitert → nicht erreichbar (ohne Speicher-Zeile ließe sich nicht eintragen)', async () => {
    const { d } = deps(
      { result: 'fetch', record: null },
      { store: () => Promise.reject(new Error('x')) },
    );
    expect((await runProductLookup({ code: code('plausibel') }, d)).body).toEqual({
      code: 'unavailable',
    });
  });

  it('übergroße OFF-Felder (> 16 KB) werden nicht gespeichert', async () => {
    const big = {
      kind: 'answer' as const,
      body: {
        status: 1,
        product: {
          product_name: 'x'.repeat(900),
          brands: 'y'.repeat(900),
          quantity: 'z'.repeat(900),
          product_name_de: 'a'.repeat(900),
          generic_name_de: 'b'.repeat(900),
          serving_size: 'c'.repeat(900),
          nutrition_data_per: 'd'.repeat(900),
          nutriments: Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`fat_${i}`, i])),
        },
      },
    };
    const { d } = deps({ result: 'fetch', record: null }, { fetchOff: () => Promise.resolve(big) });
    const r = await runProductLookup({ code: EAN }, d);
    // Unbekannte nutriments-Schlüssel fallen weg – die Antwort bleibt klein und wird gespeichert.
    expect(r.status).toBe(200);
    expect(JSON.stringify(offFieldsForStorage(big.body.product)).length).toBeLessThan(
      FOOD_PRODUCT_LOOKUP_LIMITS.offFieldsMaxBytes,
    );
  });

  it('productForEntryOf: nicht gefunden → null, sonst die Werte des Speichers', () => {
    expect(productForEntryOf(notFoundRecord(EAN, NOW))).toBeNull();
    const p = normalizeOffProduct(
      off({ 'energy-kcal_100g': 380, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 9 }),
      EAN,
    );
    expect(productForEntryOf(recordFromProduct(p, {}, NOW))).toMatchObject({
      kcal: 380,
      check_level: 'ok',
    });
  });
});

// ---------------------------------------------------------------------------------------------------------
// Eigenschaftstests (Plan 8.2): 3.000 zufällige Werte-Sätze
// ---------------------------------------------------------------------------------------------------------

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('Eigenschaften', () => {
  it('physikalisch mögliche, in sich stimmige Werte werden nie gesperrt und nie „prüfen“', () => {
    const r = rng(17);
    for (let i = 0; i < 3000; i += 1) {
      const total = r() * 100;
      const parts = [r(), r(), r(), r(), r()];
      const sum = parts.reduce((a, b) => a + b, 0) || 1;
      const [p, c, f, fiber, salt] = parts.map((x) => round1((x / sum) * total)) as [
        number,
        number,
        number,
        number,
        number,
      ];
      if (p + c + f + fiber + salt > 102) continue;
      const kcal = 4 * p + 4 * c + 9 * f + 2 * fiber;
      const result = checkProductNutrients({
        baseUnit: r() < 0.5 ? 'g' : 'ml',
        kcal,
        kj: kcal * 4.184,
        protein_g: p,
        carbs_g: c,
        fat_g: f,
        fiber_g: fiber,
        salt_g: salt,
        sugar_g: round1(c * r()),
        sat_fat_g: round1(f * r()),
      });
      expect(result).toEqual({ level: 'ok', reasons: [] });
    }
  });

  it('kein Eintrag über 3.000 kcal und nie mit ungültigem Schema', () => {
    const r = rng(23);
    for (let i = 0; i < 3000; i += 1) {
      const product = {
        ...muesli,
        kcal: Math.round(r() * FOOD_PRODUCT_CHECK.kcalMax),
        protein_g: round1(r() * 30),
        carbs_g: round1(r() * 40),
        fat_g: round1(r() * 30),
      };
      const amount = round1(1 + r() * 2100);
      const built = entryFromProduct(product, amount, target());
      if (built.ok) {
        expect(built.entry.kcal ?? 0).toBeLessThanOrEqual(3000);
        expect(foodLogEntrySchema.safeParse(built.entry).success).toBe(true);
      } else {
        expect(['amount', 'too_much']).toContain(built.reason);
      }
    }
  });

  it('eigene Produkte: Schema-gültig ⇒ nie „blocked“', () => {
    const r = rng(5);
    for (let i = 0; i < 3000; i += 1) {
      const values = {
        id: ID(1),
        name_de: 'P',
        brand_de: null,
        code: null,
        base_unit: r() < 0.5 ? ('g' as const) : ('ml' as const),
        kcal: Math.round(r() * USER_FOOD_PRODUCT_LIMITS.kcal.max),
        protein_g: round1(r() * 40),
        carbs_g: round1(r() * 40),
        fat_g: round1(r() * 40),
        sugar_g: null,
        salt_g: round1(r() * 3),
        serving_g: null,
        based_on_off: false,
      };
      const parsed = userFoodProductSchema.safeParse(values);
      if (parsed.success) expect(checkUserFoodProduct(parsed.data).level).not.toBe('blocked');
    }
  });
});

function round1(x: number) {
  return Math.round(x * 10) / 10;
}

describe('Regeln von food_product_lookup als reine Funktionen (Testmodus)', () => {
  it('Limit: 60 je Stunde, 200 je Kalendertag Europe/Berlin (Tag zuerst)', () => {
    const now = '2026-10-17T10:30:00.000Z';
    expect(productLookupLimit([], now)).toBeNull();
    expect(
      productLookupLimit([{ hour_start: '2026-10-17T10:00:00.000Z', lookups: 59 }], now),
    ).toBeNull();
    expect(productLookupLimit([{ hour_start: '2026-10-17T10:00:00.000Z', lookups: 60 }], now)).toBe(
      'hour',
    );
    const day = [6, 7, 8, 9].map((h) => ({
      hour_start: `2026-10-17T0${h}:00:00.000Z`,
      lookups: 50,
    }));
    expect(productLookupLimit(day, now)).toBe('day');
    // 22:30 UTC am 16.10. = 00:30 Berlin am 17.10. (MESZ) → zählt für den 17.; 21:00 UTC (23:00 Berlin) nicht.
    expect(
      productLookupLimit(
        [
          { hour_start: '2026-10-16T21:00:00.000Z', lookups: 60 },
          { hour_start: '2026-10-16T22:00:00.000Z', lookups: 60 },
          { hour_start: '2026-10-17T06:00:00.000Z', lookups: 60 },
          { hour_start: '2026-10-17T07:00:00.000Z', lookups: 19 },
        ],
        now,
      ),
    ).toBeNull();
  });

  it('Zählen: Stunde +1, Zähler älter als 2 Tage weg', () => {
    const counts = countProductLookup(
      [
        { hour_start: '2026-10-14T10:00:00.000Z', lookups: 3 },
        { hour_start: '2026-10-17T10:00:00.000Z', lookups: 2 },
      ],
      '2026-10-17T10:59:59.000Z',
    );
    expect(counts).toEqual([{ hour_start: '2026-10-17T10:00:00.000Z', lookups: 3 }]);
    expect(lookupHourStart('2026-10-17T10:59:59.999Z')).toBe('2026-10-17T10:00:00.000Z');
  });

  it('Speicher: frisch 30 Tage / „nicht gefunden“ 1 Tag; abgelaufen nach 90 Tagen', () => {
    const now = '2026-10-17T10:00:00.000Z';
    const at = (days: number) => new Date(Date.parse(now) - days * 86_400_000).toISOString();
    expect(productRecordFresh({ found: true, retrieved_at: at(29.9) }, now)).toBe(true);
    expect(productRecordFresh({ found: true, retrieved_at: at(30) }, now)).toBe(false);
    expect(productRecordFresh({ found: false, retrieved_at: at(0.9) }, now)).toBe(true);
    expect(productRecordFresh({ found: false, retrieved_at: at(1) }, now)).toBe(false);
    expect(productRecordExpired({ found: true, retrieved_at: at(90.1) }, now)).toBe(true);
    expect(productRecordExpired({ found: true, retrieved_at: at(89) }, now)).toBe(false);
  });
});

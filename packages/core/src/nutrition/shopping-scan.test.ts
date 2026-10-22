/**
 * Strichcode im Laden (Reiter „Einkaufen“, docs/PLAN-EINKAUFEN-AUSDAUER.md 3): Abgleich gescannter Produkte mit der
 * Einkaufsliste – gelernte Zuordnung vor Name; Grenzfälle: Umlaute/Mehrzahl, Marke und Mengen im Namen, leere Liste,
 * nur abgehakt, Gleichstand, zwei Einheiten, Vorrat, lange/leere Namen, Steuerzeichen, Determinismus.
 */
import { describe, expect, it } from 'vitest';

import { SHOPPING_LIST_ROUNDING, SHOPPING_SCAN } from '../constants';
import { N3_FOODS } from './meal-plan-fixtures';
import { addManualShoppingItem, type ShoppingList, type ShoppingListItem } from './shopping-list';
import { planlessShoppingList, SHOPPING_LIST_NO_PLAN_KEY } from './shopping-list-store';
import {
  manualItemFromProduct,
  matchScannedProduct,
  normalizeProductName,
  scanNutrition,
  type ShoppingProductLink,
  withShoppingProductLink,
} from './shopping-scan';

const CODE = '4009999000011';
const CODE2 = '4009999000028';

function planItem(foodId: string, unit = 'g', extra: Partial<ShoppingListItem> = {}) {
  const food = N3_FOODS.get(foodId);
  if (food === undefined) throw new Error(foodId);
  return {
    itemKey: `${foodId}|${unit}`,
    foodId,
    labelDe: food.name_de,
    amount: 100,
    unit: unit === 'piece' ? 'piece' : 'g',
    category: food.shopping_category,
    isPantry: false,
    isManual: false,
    checked: false,
    substituteFor: [],
    amountChanged: false,
    notInPlan: false,
    ...extra,
  } satisfies ShoppingListItem;
}

const list = (...items: ShoppingListItem[]): ShoppingList => ({
  from: '2026-10-12',
  to: '2026-10-18',
  usesHealthData: false,
  items,
});
const byName = (name: string, brand: string | null = null) => ({
  code: null,
  productName: name,
  brand,
});
const keyOf = (r: ReturnType<typeof matchScannedProduct>) =>
  r.kind === 'match' || r.kind === 'already_checked'
    ? r.itemKey
    : r.kind === 'choose'
      ? r.candidates.map((i) => i.itemKey)
      : null;

describe('normalizeProductName', () => {
  it('klein, Umlaute/ß gefaltet, ohne Klammern, Mengen, Füllwörter, Marke; Mehrzahl gekappt; ohne Doppel', () => {
    expect(normalizeProductName('Bio Zarte Haferflocken 500 g (Testwerte)')).toEqual([
      'haferflock',
    ]);
    expect(normalizeProductName('Tomaten')).toEqual(normalizeProductName('Tomate'));
    expect(normalizeProductName('Müsli & Süßes – Müsli')).toEqual(['muesli', 'suesse']);
    expect(normalizeProductName('Kölln Haferflocken', 'Kölln, Peter Kölln')).toEqual([
      'haferflock',
    ]);
    expect(normalizeProductName('Crème fraîche 1,5 l')).toEqual(['crem', 'fraich']);
    expect(normalizeProductName('Eis')).toEqual(['eis']);
    expect(normalizeProductName('')).toEqual([]);
    expect(normalizeProductName('Hafer\u0000flocken​')).toEqual(['hafer', 'flock']);
  });

  it('deterministisch', () => {
    const a = normalizeProductName('Frische Vollmilch 3,5 % Fett', 'Weihenstephan');
    expect(normalizeProductName('Frische Vollmilch 3,5 % Fett', 'Weihenstephan')).toEqual(a);
  });
});

describe('matchScannedProduct – Name', () => {
  it('eindeutig, Marke und Menge im Namen stören nicht', () => {
    const r = matchScannedProduct(
      byName('Kölln Zarte Haferflocken 500 g', 'Kölln'),
      list(planItem('haferflocken'), planItem('vollmilch', 'ml')),
      N3_FOODS,
    );
    expect(r.kind).toBe('match');
    expect(keyOf(r)).toBe('haferflocken|g');
  });

  it('Mehrzahl: Liste „Banane“ ↔ Produkt „Bananen“', () => {
    expect(keyOf(matchScannedProduct(byName('Bio Bananen'), list(planItem('banane'))))).toBe(
      'banane|g',
    );
  });

  it('Wortteil: eigener Eintrag „Milch“ ↔ „Frische Vollmilch“; kurze Wörter nur ganz', () => {
    const own = addManualShoppingItem(list(), { labelDe: 'Milch' });
    expect(keyOf(matchScannedProduct(byName('Frische Vollmilch 3,5 %'), own))).toBe('manual|milch');
    expect(matchScannedProduct(byName('Freilandeier'), list(planItem('huehnerei'))).kind).toBe(
      'none',
    );
    expect(
      keyOf(
        matchScannedProduct(byName('Hühnereier Größe M'), list(planItem('huehnerei')), N3_FOODS),
      ),
    ).toBe('huehnerei|g');
  });

  it('Synonyme aus dem Katalog: „Nudeln“ ↔ Spaghetti; ohne Katalog kein Treffer', () => {
    const items = list(planItem('spaghetti'));
    expect(keyOf(matchScannedProduct(byName('Vollkorn Nudeln'), items, N3_FOODS))).toBe(
      'spaghetti|g',
    );
    expect(matchScannedProduct(byName('Vollkorn Nudeln'), items).kind).toBe('none');
  });

  it('erstes Wort genügt schwächer; alle Wörter gewinnen', () => {
    const items = list(planItem('reis'), planItem('tofu'));
    expect(keyOf(matchScannedProduct(byName('Basmati Reis'), items, N3_FOODS))).toBe('reis|g');
    const own = addManualShoppingItem(items, { labelDe: 'Räuchertofu' });
    expect(keyOf(matchScannedProduct(byName('Tofu natur'), own, N3_FOODS))).toBe('tofu|g');
  });

  it('Gleichstand → Auswahl in Listen-Reihenfolge; ganzes Wort schlägt Wortteil', () => {
    let items = addManualShoppingItem(list(), { labelDe: 'Müsli' });
    items = addManualShoppingItem(items, { labelDe: 'Bio-Müsli' });
    const r = matchScannedProduct(byName('Testprodukt Müsli (Testwerte)'), items);
    expect(r.kind).toBe('choose');
    expect(keyOf(r)).toEqual(['manual|bio-müsli', 'manual|müsli']);
    let milk = addManualShoppingItem(list(), { labelDe: 'Milch' });
    milk = addManualShoppingItem(milk, { labelDe: 'Vollmilch' });
    expect(keyOf(matchScannedProduct(byName('Weidemilch Vollmilch'), milk))).toBe(
      'manual|vollmilch',
    );
  });

  it('dasselbe Lebensmittel in g und Stück → Auswahl', () => {
    const r = matchScannedProduct(
      byName('Bananen'),
      list(planItem('banane', 'g'), planItem('banane', 'piece')),
      N3_FOODS,
    );
    expect(keyOf(r)).toEqual(['banane|g', 'banane|piece']);
  });

  it('Auswahl höchstens candidatesMax Einträge', () => {
    let items = list();
    for (let i = 0; i < 8; i += 1)
      items = addManualShoppingItem(items, { labelDe: `Müsli ${'abcdefgh'.charAt(i).repeat(2)}` });
    const r = matchScannedProduct(byName('Müsli'), items);
    // „Müsli aa“ …: nur das erste Wort passt ganz → alle gleich (1) → Auswahl, gekappt.
    expect(r.kind === 'choose' && r.candidates.length).toBe(SHOPPING_SCAN.candidatesMax);
  });

  it('Vorrat nach den übrigen offenen Einträgen', () => {
    const items = list(planItem('haferflocken', 'g', { isPantry: true }), {
      ...planItem('haferflocken', 'g'),
      itemKey: 'manual|haferflocken',
      foodId: null,
      isManual: true,
    });
    expect(keyOf(matchScannedProduct(byName('Haferflocken'), items, N3_FOODS))).toBe(
      'manual|haferflocken',
    );
  });

  it('nur abgehakte Treffer → „schon abgehakt“; offene gehen vor', () => {
    const checked = list(planItem('haferflocken', 'g', { checked: true }));
    const r = matchScannedProduct(byName('Haferflocken'), checked, N3_FOODS);
    expect(r.kind).toBe('already_checked');
    const withOpen = addManualShoppingItem(checked, { labelDe: 'Haferflocken extra' });
    expect(keyOf(matchScannedProduct(byName('Haferflocken'), withOpen, N3_FOODS))).toBe(
      'manual|haferflocken extra',
    );
  });

  it('kein Treffer: leere Liste, fremdes Produkt, nur Füllwörter; Abteilung aus schwachem Treffer', () => {
    expect(matchScannedProduct(byName('Haferflocken'), list())).toEqual({
      kind: 'none',
      suggestedCategory: 'other',
    });
    expect(
      matchScannedProduct(byName('Apfelschorle'), list(planItem('haferflocken')), N3_FOODS),
    ).toEqual({ kind: 'none', suggestedCategory: 'other' });
    expect(matchScannedProduct(byName('Produkt ohne Namen'), list(planItem('reis'))).kind).toBe(
      'none',
    );
    expect(
      matchScannedProduct({ code: CODE, productName: null }, list(planItem('reis'))).kind,
    ).toBe('none');
    // „Laktosefreie Milch“: nur das zweite Wort passt → kein Treffer, aber Abteilung Kühlregal.
    expect(
      matchScannedProduct(byName('Milch'), list(planItem('milch-laktosefrei')), N3_FOODS),
    ).toEqual({ kind: 'none', suggestedCategory: 'chilled_dairy_eggs' });
  });

  it('Haferdrink ist nicht Haferflocken', () => {
    expect(
      keyOf(
        matchScannedProduct(
          byName('Haferdrink Barista'),
          list(planItem('haferflocken'), planItem('haferdrink', 'ml')),
          N3_FOODS,
        ),
      ),
    ).toBe('haferdrink|ml');
  });
});

describe('matchScannedProduct – gelernte Zuordnung', () => {
  const links: ShoppingProductLink[] = [{ code: CODE, food_id: 'haferflocken' }];

  it('schlägt den Namen', () => {
    const items = list(planItem('haferflocken'), planItem('haferdrink', 'ml'));
    expect(
      keyOf(matchScannedProduct({ code: CODE, productName: 'Haferdrink' }, items, N3_FOODS, links)),
    ).toBe('haferflocken|g');
  });

  it('Lebensmittel ohne Eintrag → none (Abteilung des Lebensmittels); abgehakt → schon abgehakt', () => {
    expect(
      matchScannedProduct(
        { code: CODE, productName: 'Haferflocken' },
        list(planItem('reis')),
        N3_FOODS,
        links,
      ),
    ).toEqual({ kind: 'none', suggestedCategory: 'cereal_breakfast' });
    expect(
      matchScannedProduct(
        { code: CODE, productName: null },
        list(planItem('haferflocken', 'g', { checked: true })),
        N3_FOODS,
        links,
      ).kind,
    ).toBe('already_checked');
  });

  it('andere Nummer → Name zählt', () => {
    expect(
      keyOf(
        matchScannedProduct(
          { code: CODE2, productName: 'Reis' },
          list(planItem('reis')),
          N3_FOODS,
          links,
        ),
      ),
    ).toBe('reis|g');
  });

  it('withShoppingProductLink: ersetzt gleiche Nummer, höchstens linksMax, ungültig → Fehler', () => {
    let next = withShoppingProductLink(links, { code: CODE, food_id: 'reis' });
    expect(next).toEqual([{ code: CODE, food_id: 'reis' }]);
    expect(() => withShoppingProductLink(next, { code: '123', food_id: 'reis' })).toThrow();
    const many = Array.from({ length: SHOPPING_SCAN.linksMax }, (_, i) => ({
      code: CODE,
      food_id: `f-${i}`,
    }));
    next = withShoppingProductLink(many, { code: CODE2, food_id: 'reis' });
    expect(next).toHaveLength(SHOPPING_SCAN.linksMax);
    expect(next.at(-1)).toEqual({ code: CODE2, food_id: 'reis' });
  });
});

describe('manualItemFromProduct', () => {
  it('nur Name, Steuerzeichen/Leerraum bereinigt, auf 80 Zeichen; leer → null', () => {
    expect(manualItemFromProduct('  Zarte \u0007  Haferflocken ')).toBe('Zarte Haferflocken');
    expect(manualItemFromProduct('x'.repeat(200))).toHaveLength(
      SHOPPING_LIST_ROUNDING.manualLabelMaxChars,
    );
    expect(manualItemFromProduct('   ')).toBeNull();
    expect([...(manualItemFromProduct('😀'.repeat(90)) ?? '')]).toHaveLength(80);
  });
});

describe('planlessShoppingList (EA-2)', () => {
  it('ohne gespeicherte Liste: leere Woche Mo–So; gespeicherte derselben Woche unverändert; andere Woche neu', () => {
    const empty = planlessShoppingList(null, '2026-10-12');
    expect(empty).toMatchObject({
      weekStart: '2026-10-12',
      from: '2026-10-12',
      to: '2026-10-18',
      planKey: SHOPPING_LIST_NO_PLAN_KEY,
      usesHealthData: false,
      items: [],
      recipes: [],
    });
    const stored = addManualShoppingItem(empty, { labelDe: 'Kaffee' });
    expect(planlessShoppingList(stored, '2026-10-12')).toBe(stored);
    expect(planlessShoppingList(stored, '2026-10-19').items).toEqual([]);
    expect(() => planlessShoppingList(null, '2026-10-13')).toThrow();
  });
});

describe('scanNutrition (Nährwerte zum Scan)', () => {
  const per100 = {
    kcal: 380,
    protein_g: 10,
    carbs_g: 60,
    fat_g: 9,
    sugar_g: 15,
    sat_fat_g: 1.5,
    fiber_g: 8,
    salt_g: 0.1,
  };
  const found = (level: 'ok' | 'review' | 'blocked', mock = false) => ({
    product: {
      base_unit: 'ml' as const,
      per100,
      source: { retrieved_at: '2026-10-20T10:00:00.000Z' },
    },
    check: { level, reasons: [] },
    mock,
  });
  const own = {
    base_unit: 'g' as const,
    kcal: 120,
    protein_g: 3.5,
    carbs_g: 20,
    fat_g: 2,
    sugar_g: null,
    salt_g: 0.3,
  };

  it('nichts bekannt → null', () => {
    expect(scanNutrition({ own: null, found: null, linkedFoodId: null }, N3_FOODS)).toBeNull();
  });

  it('Produktabfrage: Werte, Einheit, Prüfstufe, Testmodus und Abrufzeit', () => {
    const result = scanNutrition({ own: null, found: found('ok', true), linkedFoodId: null });
    expect(result).toEqual({
      source: 'product',
      baseUnit: 'ml',
      per100,
      check: { level: 'ok', reasons: [] },
      mock: true,
      retrievedAt: '2026-10-20T10:00:00.000Z',
    });
    expect(
      scanNutrition({ own: null, found: found('review'), linkedFoodId: null })?.per100,
    ).toEqual(per100);
  });

  it('gesperrt: keine Zahlen, auch wenn die Antwort welche enthielte', () => {
    const result = scanNutrition({ own: null, found: found('blocked'), linkedFoodId: null });
    expect(result?.source).toBe('product');
    expect(Object.values(result?.per100 ?? {}).every((v) => v === null)).toBe(true);
  });

  it('eigenes Produkt geht vor Abfrage und Zuordnung; fehlende Werte bleiben null (nie 0)', () => {
    const result = scanNutrition(
      { own, found: found('ok'), linkedFoodId: 'haferflocken' },
      N3_FOODS,
    );
    expect(result).toEqual({
      source: 'own',
      baseUnit: 'g',
      per100: {
        kcal: 120,
        protein_g: 3.5,
        carbs_g: 20,
        fat_g: 2,
        sugar_g: null,
        sat_fat_g: null,
        fiber_g: null,
        salt_g: 0.3,
      },
    });
  });

  it('gelernte Zuordnung: Werte des Katalog-Lebensmittels je 100 g mit Quelle', () => {
    const food = N3_FOODS.get('haferflocken');
    if (food === undefined) throw new Error('haferflocken');
    const result = scanNutrition(
      { own: null, found: null, linkedFoodId: 'haferflocken' },
      N3_FOODS,
    );
    expect(result?.source).toBe('catalog');
    expect(result?.baseUnit).toBe('g');
    expect(result?.per100.kcal).toBe(food.nutrients_per_100g.kcal);
    expect(result?.per100.salt_g).toBe(food.nutrients_per_100g.salt_g);
    expect(result?.source === 'catalog' ? result.foodSource : null).toEqual(food.source);
  });

  it('Zuordnung zu einem Lebensmittel außerhalb des Katalogs bzw. ohne Katalog → null', () => {
    expect(
      scanNutrition({ own: null, found: null, linkedFoodId: 'gibt_es_nicht' }, N3_FOODS),
    ).toBeNull();
    expect(scanNutrition({ own: null, found: null, linkedFoodId: 'haferflocken' })).toBeNull();
  });
});

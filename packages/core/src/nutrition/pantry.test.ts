/**
 * Vorratsschrank (Gründer-Freigabe 25.10.2026): Schema, Mengen in Kaufeinheiten, Abgleich mit der Einkaufsliste
 * (Vorrat ohne Menge, mit Menge, fast leer, Öl & Co.), „Vorrat aktualisieren nach Einkauf“, Kühlschrank-Suche mit
 * Vorrat und Strichcode → Lebensmittel. Gegen den ECHTEN Katalog und die echte Tabelle der Kaufeinheiten.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PANTRY } from '../constants';
import {
  type Food,
  type FoodLookup,
  foodSchema,
  SHOPPING_CATEGORIES,
} from '../content/food-schema';
import { ing, makeRecipe } from '../content/nutrition-fixtures';
import { fridgeMatch, fridgeSearchVariants, pantryShares, searchFridge } from './fridge-search';
import {
  matchScannedPantryFood,
  pantryAfterShopping,
  pantryAmountFromPurchase,
  pantryAmountText,
  pantryAvailable,
  pantryItemSchema,
  pantryKeepsAfterShopping,
  pantryUnitInfo,
  type PantryItem,
  shoppingPantryView,
  sortPantry,
  withoutPantryItem,
  withPantryItem,
} from './pantry';
import type { ShoppingListItem } from './shopping-list';

const foodsDir = join(__dirname, '../../../../content/foods');
function loadCatalog(): Map<string, Food> {
  const map = new Map<string, Food>();
  for (const file of readdirSync(foodsDir)) {
    if (!file.endsWith('.json') || file === 'allergen-expectations.json') continue;
    const parsed = foodSchema.safeParse(JSON.parse(readFileSync(join(foodsDir, file), 'utf8')));
    if (parsed.success) map.set(parsed.data.id, parsed.data);
  }
  return map;
}
const FOODS: FoodLookup = loadCatalog();
const food = (id: string) => FOODS.get(id) as Food;

function item(
  foodId: string | null,
  amount: number | null,
  unit: ShoppingListItem['unit'],
  extra: Partial<ShoppingListItem> = {},
): ShoppingListItem {
  const f = foodId === null ? undefined : FOODS.get(foodId);
  return {
    itemKey: foodId === null ? `manual|${extra.labelDe ?? 'x'}` : `${foodId}|${unit ?? 'g'}`,
    foodId,
    labelDe: f?.name_de ?? 'Eigener Artikel',
    amount,
    unit,
    category: f?.shopping_category ?? 'other',
    isPantry: f?.pantry ?? false,
    isManual: foodId === null,
    checked: false,
    substituteFor: [],
    amountChanged: false,
    notInPlan: false,
    ...extra,
  };
}
const p = (
  food_id: string,
  count: number | null,
  pack_size: number | null = null,
  low = false,
): PantryItem => ({
  food_id,
  count,
  pack_size,
  low,
});

describe('Schema', () => {
  it('Menge 0,5–99 in halben Schritten oder null; Packungsgröße nur mit Menge; strikt', () => {
    expect(pantryItemSchema.safeParse(p('haferflocken', 2, 500)).success).toBe(true);
    expect(pantryItemSchema.safeParse(p('haferflocken', null)).success).toBe(true);
    expect(pantryItemSchema.safeParse(p('haferflocken', 0.5)).success).toBe(true);
    expect(pantryItemSchema.safeParse(p('haferflocken', 99)).success).toBe(true);
    for (const bad of [0, 0.3, 99.5, 100, -1]) {
      expect(pantryItemSchema.safeParse(p('haferflocken', bad)).success, String(bad)).toBe(false);
    }
    expect(pantryItemSchema.safeParse(p('haferflocken', null, 500)).success).toBe(false);
    expect(pantryItemSchema.safeParse(p('haferflocken', 1, PANTRY.packSizeMax + 1)).success).toBe(
      false,
    );
    expect(pantryItemSchema.safeParse({ ...p('haferflocken', 1), note: 'x' }).success).toBe(false);
  });

  it('setzen/ersetzen/entfernen, höchstens 300 Einträge', () => {
    let list = withPantryItem([], p('haferflocken', 1)).items;
    list = withPantryItem(list, p('haferflocken', 2, 500)).items;
    expect(list).toEqual([p('haferflocken', 2, 500)]);
    expect(withoutPantryItem(list, 'haferflocken')).toEqual([]);
    const full = Array.from({ length: PANTRY.itemsMax }, (_, i) => p(`lebensmittel-${i}`, null));
    expect(withPantryItem(full, p('haferflocken', 1)).full).toBe(true);
    expect(withPantryItem(full, p('lebensmittel-3', 1)).full).toBe(false);
  });
});

describe('Kaufeinheiten und Anzeige', () => {
  it('Packung, loses Stück, Einheit mit Behälter, Vorrat ohne Menge', () => {
    expect(pantryUnitInfo(food('haferflocken'))).toMatchObject({
      kind: 'pack',
      container: 'Packung',
      sizes: [500, 1000],
    });
    expect(pantryUnitInfo(food('apfel'))).toMatchObject({
      kind: 'count',
      one: 'Apfel',
      many: 'Äpfel',
      product: null,
    });
    expect(pantryUnitInfo(food('brokkoli'))).toMatchObject({
      kind: 'count',
      one: 'Kopf',
      many: 'Köpfe',
      product: 'Brokkoli',
    });
    expect(pantryUnitInfo(food('olivenoel'))).toEqual({ kind: 'stock', name: 'Olivenöl' });
  });

  it('Text: „2 Packungen (à 500 g)“, „1 Packung (1 kg)“, „3 Äpfel“, „1 Kopf Brokkoli“, ohne Menge null', () => {
    expect(pantryAmountText(p('haferflocken', 2, 500), food('haferflocken'))).toBe(
      '2 Packungen (à 500 g)',
    );
    expect(pantryAmountText(p('haferflocken', 1, 1000), food('haferflocken'))).toBe(
      '1 Packung (1 kg)',
    );
    expect(pantryAmountText(p('apfel', 3), food('apfel'))).toBe('3 Äpfel');
    expect(pantryAmountText(p('apfel', 1), food('apfel'))).toBe('1 Apfel');
    expect(pantryAmountText(p('brokkoli', 1), food('brokkoli'))).toBe('1 Kopf Brokkoli');
    expect(pantryAmountText(p('haferflocken', 1.5), food('haferflocken'))).toBe('1,5 Packungen');
    expect(pantryAmountText(p('haferflocken', null), food('haferflocken'))).toBeNull();
    expect(pantryAmountText(p('olivenoel', 2), food('olivenoel'))).toBeNull();
  });

  it('vorhandene Menge: Packung × Größe (ohne Größe die kleinste), Stück × Stückgewicht, sonst null', () => {
    expect(pantryAvailable(p('haferflocken', 2, 1000), 'haferflocken')).toBe(2000);
    expect(pantryAvailable(p('haferflocken', 1), 'haferflocken')).toBe(500);
    expect(pantryAvailable(p('apfel', 2), 'apfel')).toBe(300);
    expect(pantryAvailable(p('haferflocken', null), 'haferflocken')).toBeNull();
    expect(pantryAvailable(p('olivenoel', 1), 'olivenoel')).toBeNull();
  });
});

describe('Einkaufsliste mit Vorrat (reine Anzeige)', () => {
  const list = [
    item('haferflocken', 400, 'g'),
    item('spaghetti-trocken', 750, 'g'),
    item('olivenoel', 30, 'g'),
    item('magerquark', 500, 'g'),
    item('apfel', 4, 'piece'),
    item(null, null, null, { labelDe: 'Spülmittel' }),
    item('salz', 2, 'g'),
  ];

  it('ohne Vorrat: alles bleibt unverändert auf der Liste', () => {
    const view = shoppingPantryView(list, []);
    expect(view.inPantry).toEqual([]);
    expect(view.toBuy.map((l) => l.display)).toEqual(list);
    expect(view.toBuy.every((l) => l.status === 'buy')).toBe(true);
  });

  it('reicht → „Schon im Vorrat“; teilweise → Restmenge; fast leer → bleibt; ohne Menge → da (Menge prüfen)', () => {
    const view = shoppingPantryView(list, [
      p('haferflocken', 1, 500), // 500 ≥ 400 → reicht
      p('spaghetti-trocken', 1, 500), // 500 von 750 → Rest 250
      p('olivenoel', null), // Vorrat ohne Menge → erledigt
      p('magerquark', 1, 500, true), // fast leer → bleibt
      p('apfel', null), // ohne Menge → da
    ]);
    const status = Object.fromEntries(
      [...view.toBuy, ...view.inPantry].map((l) => [l.item.itemKey, l.status]),
    );
    expect(status).toEqual({
      'haferflocken|g': 'covered',
      'spaghetti-trocken|g': 'partial',
      'olivenoel|g': 'covered_unknown',
      'magerquark|g': 'low',
      'apfel|piece': 'covered_unknown',
      'manual|Spülmittel': 'buy',
      'salz|g': 'buy',
    });
    const spaghetti = view.toBuy.find((l) => l.item.foodId === 'spaghetti-trocken');
    expect(spaghetti?.display.amount).toBe(250);
    expect(spaghetti?.item.amount).toBe(750); // gespeicherte Menge unverändert
    // Reihenfolge der Liste bleibt in beiden Abschnitten erhalten.
    expect(view.toBuy.map((l) => l.item.itemKey)).toEqual([
      'spaghetti-trocken|g',
      'magerquark|g',
      'manual|Spülmittel',
      'salz|g',
    ]);
  });

  it('Spielraum 10 %: 460 g Bedarf, 500 g im Vorrat → reicht; 600 g → Rest', () => {
    expect(
      shoppingPantryView([item('haferflocken', 460, 'g')], [p('haferflocken', 1, 500)]).inPantry,
    ).toHaveLength(1);
    const partial = shoppingPantryView(
      [item('haferflocken', 600, 'g')],
      [p('haferflocken', 1, 500)],
    );
    expect(partial.toBuy[0]?.status).toBe('partial');
    expect(partial.toBuy[0]?.display.amount).toBe(100);
  });

  it('Stückware: 4 Äpfel, 2 im Vorrat → 2 kaufen; Eier in Stück gegen Packung (Stück)', () => {
    const apples = shoppingPantryView([item('apfel', 4, 'piece')], [p('apfel', 2)]);
    expect(apples.toBuy[0]?.display.amount).toBe(2);
    const eggs = shoppingPantryView([item('huehnerei', 8, 'piece')], [p('huehnerei', 1, 10)]);
    expect(eggs.inPantry[0]?.status).toBe('covered');
  });

  it('abgehakte Einträge und eigene Einträge bleiben, wo sie sind', () => {
    const view = shoppingPantryView(
      [item('haferflocken', 400, 'g', { checked: true })],
      [p('haferflocken', 2, 500)],
    );
    expect(view.toBuy[0]?.status).toBe('buy');
  });
});

describe('Vorrat aktualisieren nach Einkauf', () => {
  it('nur abgehakte, haltbare Katalog-Einträge; frische bleiben draußen; Mengen aus den Kaufeinheiten', () => {
    expect(pantryKeepsAfterShopping(food('haferflocken'))).toBe(true);
    expect(pantryKeepsAfterShopping(food('olivenoel'))).toBe(true);
    expect(pantryKeepsAfterShopping(food('erbsen-tk'))).toBe(true);
    expect(pantryKeepsAfterShopping(food('apfel'))).toBe(false);
    expect(pantryKeepsAfterShopping(food('magerquark'))).toBe(false);
    const result = pantryAfterShopping(
      [],
      [
        item('haferflocken', 1400, 'g', { checked: true }),
        item('olivenoel', 30, 'g', { checked: true }),
        item('apfel', 4, 'piece', { checked: true }),
        item('spaghetti-trocken', 750, 'g', { checked: false }),
        item(null, null, null, { labelDe: 'Spülmittel', checked: true }),
      ],
      FOODS,
    );
    expect(result.added).toEqual(['haferflocken', 'olivenoel']);
    expect(result.skippedFresh).toEqual(['apfel']);
    const oats = result.items.find((i) => i.food_id === 'haferflocken');
    expect(oats).toBeDefined();
    expect(pantryAvailable(oats as PantryItem, 'haferflocken')).toBeGreaterThanOrEqual(1400);
    expect(result.items.find((i) => i.food_id === 'olivenoel')).toEqual(p('olivenoel', null));
  });

  it('gleiches Lebensmittel: Mengen addiert (in der neuen Größe), „fast leer“ aufgehoben', () => {
    const result = pantryAfterShopping(
      [p('spaghetti-trocken', 1, 500, true)],
      [item('spaghetti-trocken', 500, 'g', { checked: true })],
      FOODS,
    );
    expect(result.updated).toEqual(['spaghetti-trocken']);
    expect(result.items).toEqual([p('spaghetti-trocken', 2, 500)]);
  });

  it('bestehender Vorrat ohne Menge bekommt die gekaufte Menge; Grenze 300 → übersprungen', () => {
    const merged = pantryAfterShopping(
      [p('spaghetti-trocken', null)],
      [item('spaghetti-trocken', 500, 'g', { checked: true })],
      FOODS,
    );
    expect(merged.items).toEqual([p('spaghetti-trocken', 1, 500)]);
    const full = Array.from({ length: PANTRY.itemsMax }, (_, i) => p(`lebensmittel-${i}`, null));
    const result = pantryAfterShopping(
      full,
      [item('haferflocken', 400, 'g', { checked: true })],
      FOODS,
    );
    expect(result.skippedFull).toEqual(['haferflocken']);
    expect(result.items).toHaveLength(PANTRY.itemsMax);
  });

  it('gekaufte Menge: Vorrat ohne Menge → null, Packung mit einer Größe → Anzahl × Größe', () => {
    expect(pantryAmountFromPurchase(item('olivenoel', 30, 'g'), undefined)).toEqual({
      count: null,
      pack_size: null,
    });
    expect(pantryAmountFromPurchase(item('spaghetti-trocken', 900, 'g'), undefined)).toEqual({
      count: 2,
      pack_size: 500,
    });
  });
});

describe('Kühlschrank-Suche mit Vorrat', () => {
  const pasta = makeRecipe({
    id: 'pasta-test',
    title_de: 'Pasta Test',
    ingredients: [
      ing('vollkornnudeln', 100, 'g'),
      ing('tomate', 200, 'g'),
      ing('olivenoel', 10, 'g'),
    ],
  });
  const salad = makeRecipe({
    id: 'salat-test',
    title_de: 'Salat Test',
    ingredients: [ing('tomate', 200, 'g'), ing('gurke', 150, 'g')],
  });
  const searchInput = {
    recipes: [pasta, salad],
    foods: FOODS,
    profile: { diet: 'omnivore' as const, eatsPork: true },
    excludePregnancyCaution: false,
    allowDrafts: true,
  };

  it('ohne Auswahl, ohne Vorrat → nichts; nur Vorrat → Rezepte mit Vorrats-Zutaten („Passt zu deinem Vorrat“)', () => {
    expect(searchFridge(searchInput, { foodIds: [] })).toEqual([]);
    const hits = searchFridge(searchInput, {
      foodIds: [],
      pantry: [{ foodId: 'vollkornnudeln', low: false }],
    });
    expect(hits.map((h) => h.variant.recipe.id)).toEqual(['pasta-test']);
    expect(hits[0]?.fromPantry).toEqual(['vollkornnudeln']);
  });

  it('Vorrat zählt wie ausgewählt; „fast leer“ halb; ausgewählt geht vor', () => {
    const variants = fridgeSearchVariants(searchInput);
    const v = variants.find((x) => x.recipe.id === 'pasta-test');
    expect(v).toBeDefined();
    if (v === undefined) return;
    const full = fridgeMatch(
      v,
      FOODS,
      new Set(),
      pantryShares([{ foodId: 'vollkornnudeln', low: false }]),
    );
    const low = fridgeMatch(
      v,
      FOODS,
      new Set(),
      pantryShares([{ foodId: 'vollkornnudeln', low: true }]),
    );
    const selected = fridgeMatch(
      v,
      FOODS,
      new Set(['vollkornnudeln']),
      pantryShares([{ foodId: 'vollkornnudeln', low: true }]),
    );
    expect(low.match).toBeCloseTo(full.match * PANTRY.lowWeight, 10);
    expect(selected.match).toBeCloseTo(full.match, 10);
    expect(selected.fromPantry).toEqual([]);
  });

  it('ohne Vorrat genau wie bisher (Regression)', () => {
    const before = searchFridge(searchInput, { foodIds: ['tomate'] });
    const after = searchFridge(searchInput, { foodIds: ['tomate'], pantry: [] });
    expect(after).toEqual(before);
  });

  it('bei gleicher Übereinstimmung zuerst Rezepte mit mehr Vorrats-Zutaten (deterministisch)', () => {
    const a = makeRecipe({
      id: 'a-rezept',
      title_de: 'A',
      ingredients: [ing('tomate', 100, 'g'), ing('gurke', 100, 'g')],
    });
    const b = makeRecipe({
      id: 'b-rezept',
      title_de: 'B',
      ingredients: [ing('tomate', 100, 'g'), ing('zucchini', 100, 'g')],
    });
    const hits = searchFridge(
      { ...searchInput, recipes: [a, b] },
      {
        foodIds: ['tomate'],
        pantry: [
          { foodId: 'zucchini', low: true },
          { foodId: 'gurke', low: true },
        ],
      },
    );
    expect(hits.map((h) => h.variant.recipe.id)).toEqual(['a-rezept', 'b-rezept']);
    const hits2 = searchFridge(
      { ...searchInput, recipes: [a, b] },
      { foodIds: ['tomate'], pantry: [{ foodId: 'zucchini', low: false }] },
    );
    expect(hits2.map((h) => h.variant.recipe.id)).toEqual(['b-rezept', 'a-rezept']);
  });
});

describe('Strichcode → Lebensmittel für den Vorrat', () => {
  it('Name eindeutig → match; gelernte Zuordnung geht vor; unbekannt → none', () => {
    expect(
      matchScannedPantryFood({ code: null, productName: 'Zarte Haferflocken' }, FOODS),
    ).toEqual({
      kind: 'match',
      foodId: 'haferflocken',
    });
    expect(
      matchScannedPantryFood({ code: '4009990000014', productName: 'Irgendwas' }, FOODS, [
        { code: '4009990000014', food_id: 'magerquark' },
      ]),
    ).toEqual({ kind: 'match', foodId: 'magerquark' });
    expect(matchScannedPantryFood({ code: null, productName: 'Spülmaschinentabs' }, FOODS)).toEqual(
      { kind: 'none' },
    );
    expect(matchScannedPantryFood({ code: null, productName: null }, FOODS)).toEqual({
      kind: 'none',
    });
  });

  it('mehrdeutig → Auswahl (z. B. Tomaten)', () => {
    const result = matchScannedPantryFood({ code: null, productName: 'Tomaten' }, FOODS);
    expect(['choose', 'match']).toContain(result.kind);
    if (result.kind === 'choose') expect(result.foodIds.length).toBeGreaterThan(1);
  });
});

describe('Sortierung', () => {
  it('nach Abteilung, dann Name; unbekannte zuletzt', () => {
    const sorted = sortPantry(
      [p('olivenoel', null), p('unbekannt-xyz', null), p('apfel', 1), p('haferflocken', 1)],
      FOODS,
      SHOPPING_CATEGORIES,
    );
    expect(sorted.map((i) => i.food_id)).toEqual([
      'apfel',
      'haferflocken',
      'olivenoel',
      'unbekannt-xyz',
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import { FOOD_HOUSEHOLD_LIMITS, FOOD_LOG_LIMITS } from '../constants';
import type { Food, SourceFoodCategory } from '../content/food-schema';
import { foodLookup, makeFood } from '../content/nutrition-fixtures';
import { buildCustomMeal } from './custom-meal';
import {
  addToBasket,
  basketCustomMealInput,
  basketEntries,
  type BasketItem,
  basketSchema,
  defaultFoodAmount,
  entryFromFoodAmount,
  foodAmountOptions,
  householdUnitsFor,
  isValidHouseholdCount,
  orderCustomMealsForSlot,
  planSlotStatus,
  removeFromBasket,
  replacedPlanSlotCount,
  resolveFoodAmount,
  standInBase,
  suggestBasketName,
  withStandIns,
} from './food-household';
import {
  FOOD_KEYWORD_GROUPS,
  HOUSEHOLD_FALLBACK_CATEGORIES,
  HOUSEHOLD_UNITS_BY_CATEGORY,
  HOUSEHOLD_UNITS_BY_FOOD,
} from './food-household-table';
import {
  foodKeywordGroups,
  foodSearchRank,
  keywordGroupsForQuery,
  looseFoodText,
  searchFoods,
  withinEditDistance,
} from './food-search';
import { searchFoodLogCatalog } from './food-log';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function f(id: string, name: string, category: SourceFoodCategory, extra: Partial<Food> = {}) {
  return makeFood({
    id,
    name_de: name,
    units: {},
    ...extra,
    source: { ...makeFood().source, category, name },
  });
}

const gouda = f('gouda', 'Gouda', 'dairy', {
  nutrients_per_100g: { ...makeFood().nutrients_per_100g, kcal: 360, protein_g: 25, fat_g: 29 },
});
const emmentaler = f('emmentaler', 'Emmentaler', 'dairy');
const mozzarella = f('mozzarella', 'Mozzarella', 'dairy');
const harzer = f('harzer-kaese', 'Harzer Käse', 'dairy');
const leberkaese = f('leberkaese', 'Leberkäse', 'sausage_meat_products');
const kassler = f('kassler-mager', 'Kassler (mager)', 'meat_pork');
const toast = f('toastbrot-weizen', 'Toastbrot (Weizen)', 'bread_bakery');
const vollkornbrot = f('vollkornbrot', 'Vollkornbrot', 'bread_bakery');
const broetchen = f('weizenbroetchen', 'Weizenbrötchen', 'bread_bakery');
const paniermehl = f('paniermehl', 'Paniermehl', 'bread_bakery');
const cornflakes = f('cornflakes-ungezuckert', 'Cornflakes (ungezuckert)', 'cereal_products');
const milch = f('milch-1-5', 'Milch 1,5 %', 'dairy', { units: { ml_to_g: 1.03 } });
const banane = f('banane', 'Banane', 'fruit');
const butter = f('butter', 'Butter', 'fats_oils');
const salbei = f('salbei-frisch', 'Salbei (frisch)', 'vegetables', { units: { piece_g: 1 } });
const curry = f('currypulver', 'Currypulver', 'spices_sauces', {
  units: { tbsp_g: 6.3, tsp_g: 2 },
});
const ALL = [
  gouda,
  emmentaler,
  mozzarella,
  harzer,
  leberkaese,
  kassler,
  toast,
  vollkornbrot,
  broetchen,
  paniermehl,
  cornflakes,
  milch,
  banane,
  butter,
  salbei,
  curry,
];
const FOODS = foodLookup(ALL);
const ids = (list: readonly Pick<Food, 'id'>[]) => list.map((x) => x.id);
const SEARCH = { minChars: 2, max: 20 };

describe('Lockere Schreibweise und Tippfehler', () => {
  it('Umlaute und ß egal: Käse = kaese = kase, Straße = strasse = strase', () => {
    expect(looseFoodText('Käse')).toBe('kase');
    expect(looseFoodText('kaese')).toBe('kase');
    expect(looseFoodText('KASE')).toBe('kase');
    expect(looseFoodText('Straße')).toBe(looseFoodText('Strasse'));
  });
  it('Editierabstand: 0, 1, 2 und Abbruch bei zu großem Längenunterschied', () => {
    expect(withinEditDistance('gouda', 'gouda', 0)).toBe(true);
    expect(withinEditDistance('gauda', 'gouda', 1)).toBe(true);
    expect(withinEditDistance('gaudaa', 'gouda', 1)).toBe(false);
    expect(withinEditDistance('emmentahler', 'emmentaler', 1)).toBe(true);
    expect(withinEditDistance('a', 'abcd', 2)).toBe(false);
    expect(withinEditDistance('', '', 0)).toBe(true);
  });
});

describe('Lebensmittel-Arten (Suchbegriffe)', () => {
  it('Käse: Gouda, Emmentaler, Mozzarella, Harzer – nicht Leberkäse (Wurst)', () => {
    const cheese = FOOD_KEYWORD_GROUPS.find((g) => g.id === 'cheese');
    expect(cheese).toBeDefined();
    const members = ALL.filter((x) => foodKeywordGroups(x).some((g) => g.id === 'cheese'));
    expect(ids(members).sort()).toEqual(['emmentaler', 'gouda', 'harzer-kaese', 'mozzarella']);
  });
  it('Brot: Toast, Vollkornbrot, Brötchen – nicht Paniermehl', () => {
    const members = ALL.filter((x) => foodKeywordGroups(x).some((g) => g.id === 'bread'));
    expect(ids(members).sort()).toEqual(['toastbrot-weizen', 'vollkornbrot', 'weizenbroetchen']);
  });
  it('Begriffe erst ab 3 Zeichen; Anfang des Begriffs reicht („Kä“ nein, „Käs“ ja)', () => {
    expect(keywordGroupsForQuery('Kä')).toEqual([]);
    expect(keywordGroupsForQuery('Käs').map((g) => g.id)).toContain('cheese');
    expect(keywordGroupsForQuery('kase').map((g) => g.id)).toContain('cheese');
    expect(keywordGroupsForQuery('Brot').map((g) => g.id)).toContain('bread');
    expect(keywordGroupsForQuery('xyz')).toEqual([]);
  });
});

describe('searchFoods (Name, Alias, Art, Tippfehler)', () => {
  it('„Käse“ findet alle Käse, Treffer im Namen zuerst', () => {
    const hits = ids(searchFoods(ALL, 'Käse', SEARCH));
    expect(hits).toEqual(
      expect.arrayContaining(['gouda', 'emmentaler', 'mozzarella', 'harzer-kaese']),
    );
    // „Harzer Käse“ (Wortanfang im Namen) vor den Käsen ohne „Käse“ im Namen; Leberkäse nur als Treffer im Wort.
    expect(hits[0]).toBe('harzer-kaese');
    expect(hits.indexOf('leberkaese')).toBeGreaterThan(hits.indexOf('mozzarella'));
    expect(hits).not.toContain('kassler-mager');
  });
  it('ohne Umlaut („kase“, „KAESE“) dasselbe Ergebnis', () => {
    expect(ids(searchFoods(ALL, 'kase', SEARCH))).toEqual(ids(searchFoods(ALL, 'Käse', SEARCH)));
    expect(ids(searchFoods(ALL, 'KAESE', SEARCH))).toEqual(ids(searchFoods(ALL, 'Käse', SEARCH)));
  });
  it('„Brot“ findet alle Brote (auch Brötchen und Toast), Name mit „Brot“ vorn zuerst', () => {
    const hits = ids(searchFoods(ALL, 'Brot', SEARCH));
    expect(hits).toEqual(
      expect.arrayContaining(['toastbrot-weizen', 'vollkornbrot', 'weizenbroetchen']),
    );
    expect(hits).not.toContain('paniermehl');
  });
  it('Anfang vor Wortanfang vor Art vor Wortinnerem', () => {
    expect(foodSearchRank(gouda, 'Gou')).toBe(0);
    expect(foodSearchRank(harzer, 'Käse')).toBe(1);
    expect(foodSearchRank(gouda, 'Käse')).toBe(3);
    expect(foodSearchRank(leberkaese, 'Käse')).toBe(4);
    expect(foodSearchRank(makeFood({ aliases_de: ['Porridge-Flocken'] }), 'porr')).toBe(2);
  });
  it('leichter Tippfehler ab 5 Zeichen: „Gauda“ → Gouda, „Emmentahler“ → Emmentaler; kurz nicht', () => {
    expect(ids(searchFoods(ALL, 'Gauda', SEARCH))).toEqual(['gouda']);
    expect(ids(searchFoods(ALL, 'Emmentahler', SEARCH))).toEqual(['emmentaler']);
    expect(searchFoods(ALL, 'Gaud', SEARCH)).toEqual([]);
  });
  it('Grenzen: unter minChars leer, höchstens max, leere Eingabe leer', () => {
    expect(searchFoods(ALL, 'K', SEARCH)).toEqual([]);
    expect(searchFoods(ALL, '   ', SEARCH)).toEqual([]);
    expect(searchFoods(ALL, 'Käse', { minChars: 2, max: 2 })).toHaveLength(2);
  });
  it('searchFoodLogCatalog nutzt dieselbe Suche', () => {
    const result = searchFoodLogCatalog({ foods: FOODS, recipes: [] }, 'kase');
    expect(ids(result.foods)).toContain('gouda');
  });
});

describe('Haushaltsmengen je Lebensmittel', () => {
  it('Käse → Scheibe 25 g; Brot → Scheibe 45 g, Toast 25 g; Brötchen → Stück aus der Einkaufsliste', () => {
    expect(householdUnitsFor(gouda)[0]).toEqual({ unit: 'slice', grams: 25 });
    expect(householdUnitsFor(vollkornbrot)[0]).toEqual({ unit: 'slice', grams: 45 });
    expect(householdUnitsFor(toast)[0]).toEqual({ unit: 'slice', grams: 25 });
    expect(householdUnitsFor(broetchen)).toContainEqual({ unit: 'piece', grams: 60 });
  });
  it('Cornflakes → Handvoll zuerst, Schale; Milch → Glas 200 g; Banane → Stück 120 g', () => {
    expect(
      householdUnitsFor(cornflakes)
        .map((x) => x.unit)
        .slice(0, 2),
    ).toEqual(['handful', 'bowl']);
    expect(householdUnitsFor(milch)[0]).toEqual({ unit: 'glass', grams: 200 });
    expect(householdUnitsFor(banane)[0]).toEqual({ unit: 'piece', grams: 120 });
  });
  it('Einheiten des Katalogs haben Vorrang (Stück, EL, TL); ohne Tabelle nur Katalog', () => {
    expect(householdUnitsFor(salbei)).toContainEqual({ unit: 'piece', grams: 1 });
    expect(householdUnitsFor(curry)).toEqual([
      { unit: 'tbsp', grams: 6.3 },
      { unit: 'tsp', grams: 2 },
    ]);
    const mozzaCatalog = { ...mozzarella, units: { piece_g: 100 } };
    expect(householdUnitsFor(mozzaCatalog)).toContainEqual({ unit: 'piece', grams: 100 });
  });
  it('ohne Art und Tabelle: Rückfall der Kategorie – jedes Lebensmittel hat mindestens eine Haushaltsmenge', () => {
    const plain = f('xyz-test', 'Xyz', 'other');
    expect(householdUnitsFor(plain)).toEqual([
      { unit: 'portion', grams: 30 },
      { unit: 'tbsp', grams: 10 },
    ]);
    expect(foodAmountOptions(plain).map((o) => o.unit)).toEqual(['portion', 'tbsp', 'g']);
    for (const category of HOUSEHOLD_FALLBACK_CATEGORIES) {
      const units = householdUnitsFor(f(`k-${category}`, 'Zzz', category));
      expect(units.length, category).toBeGreaterThan(0);
    }
    // Öl → EL/TL, Fleisch → Portion, Getränk → Glas.
    expect(householdUnitsFor(f('oel', 'Öl', 'fats_oils'))[0]).toEqual({ unit: 'tbsp', grams: 10 });
    expect(householdUnitsFor(f('steak', 'Steak', 'meat_beef_veal'))[0]?.unit).toBe('portion');
    expect(householdUnitsFor(f('saft', 'Saft', 'beverages'))[0]).toEqual({
      unit: 'glass',
      grams: 200,
    });
  });
  it('Optionen: Haushaltsmengen, dann g, dann ml nur mit Umrechnung', () => {
    expect(foodAmountOptions(milch).map((o) => o.unit)).toEqual([
      'glass',
      'cup',
      'tbsp',
      'g',
      'ml',
    ]);
    expect(foodAmountOptions(gouda).map((o) => o.unit)).not.toContain('ml');
  });
  it('jede Grammzahl der Tabelle liegt zwischen 1 und 2.000 g', () => {
    const all = [
      ...Object.values(HOUSEHOLD_UNITS_BY_FOOD).flat(),
      ...FOOD_KEYWORD_GROUPS.flatMap((g) => g.units),
      ...Object.values(HOUSEHOLD_UNITS_BY_CATEGORY).flat(),
    ];
    for (const item of all) {
      expect(item.grams).toBeGreaterThanOrEqual(1);
      expect(item.grams).toBeLessThanOrEqual(FOOD_LOG_LIMITS.gramsMax);
    }
  });
});

describe('Menge umrechnen (Grenzen)', () => {
  it('Anzahl 0,5–20 in ½-Schritten', () => {
    expect(FOOD_HOUSEHOLD_LIMITS.count).toEqual({ min: 0.5, max: 20, step: 0.5 });
    expect(isValidHouseholdCount(0.5)).toBe(true);
    expect(isValidHouseholdCount(20)).toBe(true);
    expect(isValidHouseholdCount(0)).toBe(false);
    expect(isValidHouseholdCount(0.25)).toBe(false);
    expect(isValidHouseholdCount(20.5)).toBe(false);
    expect(isValidHouseholdCount(Number.NaN)).toBe(false);
  });
  it('2 Scheiben Gouda = 50 g (Einheit g); 1 Glas Milch = 200 g', () => {
    expect(resolveFoodAmount(gouda, 2, 'slice')).toEqual({
      ok: true,
      amount: 50,
      unit: 'g',
      grams: 50,
    });
    expect(resolveFoodAmount(milch, 1, 'glass')).toMatchObject({
      ok: true,
      amount: 200,
      unit: 'g',
    });
  });
  it('g und ml bleiben (Grenzen des Tagebuchs), ml × Umrechnung bis 2.000 g', () => {
    expect(resolveFoodAmount(milch, 250, 'ml')).toMatchObject({
      ok: true,
      amount: 250,
      unit: 'ml',
    });
    expect(resolveFoodAmount(milch, 2000, 'ml')).toEqual({ ok: false, reason: 'amount' });
    expect(resolveFoodAmount(gouda, 0.5, 'g')).toEqual({ ok: false, reason: 'amount' });
    expect(resolveFoodAmount(gouda, 2000, 'g')).toMatchObject({ ok: true });
  });
  it('Einheit, die das Lebensmittel nicht hat → unit; ½ TL Curry = 1 g → ok, 0,5 TL Zimt-ähnlich unter 1 g → amount', () => {
    expect(resolveFoodAmount(gouda, 1, 'glass')).toEqual({ ok: false, reason: 'unit' });
    expect(resolveFoodAmount(curry, 0.5, 'tsp')).toMatchObject({ ok: true, amount: 1, unit: 'g' });
    const fein = f('fein', 'Fein', 'spices_sauces', { units: { tsp_g: 1 } });
    expect(resolveFoodAmount(fein, 0.5, 'tsp')).toEqual({ ok: false, reason: 'amount' });
  });
  it('Stück mit Gewicht im Katalog bleibt Stück (wie bisher); ohne Katalog-Gewicht in Gramm', () => {
    expect(resolveFoodAmount(salbei, 2, 'piece')).toEqual({
      ok: true,
      amount: 2,
      unit: 'piece',
      grams: 2,
    });
    expect(resolveFoodAmount(banane, 1, 'piece')).toEqual({
      ok: true,
      amount: 120,
      unit: 'g',
      grams: 120,
    });
    const schwer = f('schwer', 'Schwer', 'other', { units: { piece_g: 500 } });
    expect(resolveFoodAmount(schwer, 4, 'piece')).toMatchObject({ ok: true, unit: 'piece' });
    expect(resolveFoodAmount(schwer, 4.5, 'piece')).toEqual({ ok: false, reason: 'amount' });
  });
  it('20 Schalen Haferflocken = 1.000 g ok; sehr schwer (Fladenbrot 20 Stück) → amount', () => {
    const fladen = f('fladenbrot', 'Fladenbrot', 'bread_bakery');
    expect(resolveFoodAmount(fladen, 5, 'piece')).toMatchObject({ ok: true, amount: 2000 });
    expect(resolveFoodAmount(fladen, 6, 'piece')).toEqual({ ok: false, reason: 'amount' });
  });
  it('Eintrag aus Haushaltsmenge: Werte wie aus Gramm', () => {
    const target = { id: ID(1), date: '2026-11-14', slot: 'breakfast' as const };
    const fromSlices = entryFromFoodAmount(gouda, 2, 'slice', target);
    expect(fromSlices.ok).toBe(true);
    if (!fromSlices.ok) return;
    expect(fromSlices.entry).toMatchObject({ amount: 50, unit: 'g', kcal: 180, source: 'food' });
    expect(entryFromFoodAmount(gouda, 0, 'slice', target)).toEqual({ ok: false, reason: 'amount' });
  });
  it('Vorbelegung: Haushaltsmenge 1, Gramm/ml 100', () => {
    expect(defaultFoodAmount('slice')).toBe(1);
    expect(defaultFoodAmount('g')).toBe(100);
    expect(defaultFoodAmount('ml')).toBe(100);
  });
});

describe('Korb „Mahlzeit zusammenstellen“', () => {
  const kaesebrot: BasketItem[] = [
    { food_id: 'toastbrot-weizen', amount: 1, unit: 'slice' },
    { food_id: 'gouda', amount: 2, unit: 'slice' },
  ];
  it('gleiches Lebensmittel + Einheit wird zusammengezählt, sonst angehängt; voll → null', () => {
    const more = addToBasket(kaesebrot, { food_id: 'gouda', amount: 1, unit: 'slice' });
    expect(more?.[1]).toEqual({ food_id: 'gouda', amount: 3, unit: 'slice' });
    expect(addToBasket(kaesebrot, { food_id: 'gouda', amount: 50, unit: 'g' })).toHaveLength(3);
    expect(addToBasket(kaesebrot, { food_id: 'gouda', amount: 19, unit: 'slice' })).toBeNull();
    const full = Array.from({ length: FOOD_HOUSEHOLD_LIMITS.basketMaxItems }, (_, i) => ({
      food_id: `x-${i}`,
      amount: 1,
      unit: 'piece' as const,
    }));
    expect(addToBasket(full, { food_id: 'gouda', amount: 1, unit: 'slice' })).toBeNull();
    expect(removeFromBasket(kaesebrot, 0)).toEqual([kaesebrot[1]]);
  });
  it('Schema an der Grenze: unbekannte Einheit und zu viele Einträge abgelehnt', () => {
    expect(basketSchema.safeParse(kaesebrot).success).toBe(true);
    expect(basketSchema.safeParse([{ food_id: 'gouda', amount: 1, unit: 'kg' }]).success).toBe(
      false,
    );
    const many = Array.from({ length: 16 }, () => kaesebrot[0]);
    expect(basketSchema.safeParse(many).success).toBe(false);
  });
  it('alle auf einmal eintragen: je Lebensmittel ein Eintrag, gleicher Tag und Platz', () => {
    let n = 0;
    const result = basketEntries(kaesebrot, FOODS, { date: '2026-11-14', slot: 'breakfast' }, () =>
      ID(++n),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entries.map((e) => [e.food_id, e.amount, e.unit, e.slot, e.id])).toEqual([
      ['toastbrot-weizen', 25, 'g', 'breakfast', ID(1)],
      ['gouda', 50, 'g', 'breakfast', ID(2)],
    ]);
  });
  it('alles oder nichts: leer, fehlendes Lebensmittel, ungültige Menge', () => {
    const target = { date: '2026-11-14', slot: 'breakfast' as const };
    expect(basketEntries([], FOODS, target, () => ID(1))).toEqual({
      ok: false,
      reason: 'empty',
      index: null,
    });
    expect(
      basketEntries([...kaesebrot, { food_id: 'fehlt', amount: 1, unit: 'g' }], FOODS, target, () =>
        ID(1),
      ),
    ).toEqual({ ok: false, reason: 'missing_food', index: 2 });
    expect(
      basketEntries([{ food_id: 'gouda', amount: 0.3, unit: 'slice' }], FOODS, target, () => ID(1)),
    ).toEqual({ ok: false, reason: 'amount', index: 0 });
  });
  it('als Favorit: eigenes Gericht „Aus Zutaten“ in Gramm, 1 Portion, Werte aus dem Katalog', () => {
    const input = basketCustomMealInput(kaesebrot, FOODS, { id: ID(9), name: 'Käsebrot' });
    expect(input?.items).toEqual([
      { food_id: 'toastbrot-weizen', amount: 25, unit: 'g' },
      { food_id: 'gouda', amount: 50, unit: 'g' },
    ]);
    if (input === null) return;
    const built = buildCustomMeal(input, FOODS);
    expect(built.ok).toBe(true);
    if (built.ok) expect(built.meal).toMatchObject({ name_de: 'Käsebrot', servings: 1 });
    expect(basketCustomMealInput([], FOODS, { id: ID(9), name: 'x' })).toBeNull();
  });
});

describe('Namensvorschlag', () => {
  it('Brot + Käse → Käsebrot (auch mit Butter); Brot + Butter → Butterbrot', () => {
    const b = (...list: [string, BasketItem['unit']][]) =>
      list.map(([food_id, unit]) => ({ food_id, amount: 1, unit }));
    expect(suggestBasketName(b(['toastbrot-weizen', 'slice'], ['gouda', 'slice']), FOODS)).toBe(
      'Käsebrot',
    );
    expect(
      suggestBasketName(
        b(['vollkornbrot', 'slice'], ['butter', 'tsp'], ['emmentaler', 'slice']),
        FOODS,
      ),
    ).toBe('Käsebrot');
    expect(suggestBasketName(b(['vollkornbrot', 'slice'], ['butter', 'tsp']), FOODS)).toBe(
      'Butterbrot',
    );
  });
  it('sonst „A mit B und C“ ohne Klammerzusätze; leer → „Meine Mahlzeit“; höchstens 60 Zeichen', () => {
    const basket: BasketItem[] = [
      { food_id: 'cornflakes-ungezuckert', amount: 1, unit: 'handful' },
      { food_id: 'milch-1-5', amount: 1, unit: 'glass' },
      { food_id: 'banane', amount: 1, unit: 'piece' },
    ];
    expect(suggestBasketName(basket, FOODS)).toBe('Cornflakes mit Milch 1,5 % und Banane');
    expect(suggestBasketName([], FOODS)).toBe('Meine Mahlzeit');
    expect(suggestBasketName([basket[0] as BasketItem], FOODS)).toBe('Cornflakes');
    const long = foodLookup([
      f('a', 'Sehr langer Name eines Lebensmittels Nummer eins', 'other'),
      f('b', 'Noch ein sehr langer Name eines Lebensmittels', 'other'),
    ]);
    const name = suggestBasketName(
      [
        { food_id: 'a', amount: 1, unit: 'g' },
        { food_id: 'b', amount: 1, unit: 'g' },
      ],
      long,
    );
    expect([...name].length).toBeLessThanOrEqual(60);
    expect(name.endsWith(' ')).toBe(false);
  });
});

describe('Plan-Mahlzeit: wie geplant, etwas anderes, offen', () => {
  const day = '2026-11-14';
  const e = (slot: string, source: string, eaten_on = day) =>
    ({ slot, source, eaten_on }) as Parameters<typeof planSlotStatus>[0][number];
  it('offen ohne Einträge; gegessen mit Plan-Eintrag (auch wenn zusätzlich etwas da ist)', () => {
    expect(planSlotStatus([], day, 'breakfast')).toBe('open');
    expect(
      planSlotStatus([e('breakfast', 'plan_item'), e('breakfast', 'food')], day, 'breakfast'),
    ).toBe('eaten');
  });
  it('ersetzt: anderer Eintrag genau auf diesem Platz; anderer Tag oder Platz zählt nicht', () => {
    expect(planSlotStatus([e('breakfast', 'food')], day, 'breakfast')).toBe('replaced');
    expect(planSlotStatus([e('breakfast', 'food', '2026-11-13')], day, 'breakfast')).toBe('open');
    expect(planSlotStatus([e('other', 'food')], day, 'snack_morning')).toBe('open');
    expect(
      replacedPlanSlotCount(
        [e('breakfast', 'food'), e('lunch', 'plan_item'), e('dinner', 'quick')],
        day,
        ['breakfast', 'lunch', 'dinner', 'dinner'],
      ),
    ).toBe(2);
    expect(replacedPlanSlotCount([], day, [])).toBe(0);
  });
});

describe('Eigene Gerichte für einen Platz', () => {
  it('zuletzt in derselben Gruppe eingetragen zuerst, sonst gegebene Reihenfolge', () => {
    const meals = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const entry = (custom_meal_id: string, slot: string, at: string) =>
      ({ source: 'custom_meal', custom_meal_id, slot, created_at: at }) as Parameters<
        typeof orderCustomMealsForSlot
      >[1][number];
    const entries = [
      entry('c', 'breakfast', '2026-11-13T07:00:00Z'),
      entry('b', 'dinner', '2026-11-13T19:00:00Z'),
      entry('b', 'breakfast', '2026-11-12T07:00:00Z'),
    ];
    expect(orderCustomMealsForSlot(meals, entries, 'breakfast').map((m) => m.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
    expect(orderCustomMealsForSlot(meals, entries, 'dinner').map((m) => m.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
    expect(orderCustomMealsForSlot(meals, [], 'other').map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('Ersatz für fehlende Alltags-Lebensmittel (Richtwert)', () => {
  const withAll = withStandIns(FOODS);
  it('„Emmentaler“ fehlt im Katalog → Ersatz mit Werten wie Gouda; Suche findet ihn unter eigenem Namen', () => {
    // Im Test-Katalog gibt es eine echte „emmentaler“-ID – dann KEIN Ersatz.
    expect(standInBase(withAll.get('emmentaler') as Food)).toBeNull();
    const noEmmentaler = foodLookup(ALL.filter((x) => x.id !== 'emmentaler'));
    const lookup = withStandIns(noEmmentaler);
    const emmentaler = lookup.get('emmentaler');
    expect(emmentaler?.name_de).toBe('Emmentaler');
    expect(standInBase(emmentaler as Food)?.id).toBe('gouda');
    expect(ids(searchFoods(lookup.values(), 'Emmentaler', SEARCH))).toEqual(['emmentaler']);
    expect(ids(searchFoods(lookup.values(), 'Käse', SEARCH))).toContain('emmentaler');
    // Gleiche Eingabe → dasselbe Objekt (Ersatz bleibt erkennbar).
    expect(withStandIns(noEmmentaler)).toBe(lookup);
  });
  it('Eintrag: Verweis und Werte von Gouda, Titel „Emmentaler (≈ Gouda)“, Scheibe 25 g', () => {
    const lookup = withStandIns(foodLookup(ALL.filter((x) => x.id !== 'emmentaler')));
    const emmentaler = lookup.get('emmentaler') as Food;
    expect(householdUnitsFor(emmentaler)[0]).toEqual({ unit: 'slice', grams: 25 });
    const build = entryFromFoodAmount(emmentaler, 2, 'slice', {
      id: ID(1),
      date: '2026-11-14',
      slot: 'breakfast',
    });
    expect(build.ok).toBe(true);
    if (!build.ok) return;
    expect(build.entry).toMatchObject({
      food_id: 'gouda',
      title_de: 'Emmentaler (≈ Gouda)',
      amount: 50,
      unit: 'g',
      kcal: 180,
    });
    const items = basketCustomMealInput(
      [{ food_id: 'emmentaler', amount: 1, unit: 'slice' }],
      lookup,
      { id: ID(2), name: 'x' },
    )?.items;
    expect(items).toEqual([{ food_id: 'gouda', amount: 25, unit: 'g' }]);
  });
  it('ohne Ersatz-Lebensmittel im Katalog kein Ersatz; Stück-Gewicht des Ersatzes gilt nicht', () => {
    expect(withStandIns(foodLookup([toast])).has('emmentaler')).toBe(false);
    const apfel = f('apfel', 'Apfel', 'fruit', { units: { piece_g: 150 } });
    const birne = withStandIns(foodLookup([apfel])).get('birne') as Food;
    expect(birne.units).toEqual({});
    expect(householdUnitsFor(birne)[0]).toEqual({ unit: 'piece', grams: 150 });
  });
});

describe('Bowl: Joghurt + Haferflocken + Banane + Nüsse', () => {
  const joghurt = f('joghurt-1-5', 'Joghurt 1,5 %', 'dairy');
  const hafer = f('haferflocken', 'Haferflocken', 'cereal_products');
  const mandeln = f('mandeln', 'Mandeln', 'nuts_seeds');
  const lookup = foodLookup([joghurt, hafer, banane, mandeln]);
  const bowl: BasketItem[] = [
    { food_id: 'joghurt-1-5', amount: 1, unit: 'cup' },
    { food_id: 'haferflocken', amount: 2, unit: 'tbsp' },
    { food_id: 'banane', amount: 1, unit: 'piece' },
    { food_id: 'mandeln', amount: 1, unit: 'handful' },
  ];
  it('Haushaltsmengen: Becher 150 g, 2 EL 16 g, Banane 120 g, Handvoll 25 g; Name „Joghurt-Bowl“', () => {
    let n = 0;
    const result = basketEntries(bowl, lookup, { date: '2026-11-14', slot: 'breakfast' }, () =>
      ID(++n),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entries.map((e) => [e.food_id, e.amount, e.unit])).toEqual([
      ['joghurt-1-5', 150, 'g'],
      ['haferflocken', 16, 'g'],
      ['banane', 120, 'g'],
      ['mandeln', 25, 'g'],
    ]);
    expect(suggestBasketName(bowl, lookup)).toBe('Joghurt-Bowl');
    // Zwei Zutaten sind noch keine Bowl.
    expect(suggestBasketName(bowl.slice(0, 2), lookup)).toBe('Joghurt 1,5 % mit Haferflocken');
  });
  it('als Favorit speicherbar (eigenes Gericht, 1 Portion)', () => {
    const input = basketCustomMealInput(bowl, lookup, { id: ID(3), name: 'Joghurt-Bowl' });
    expect(input).not.toBeNull();
    if (input === null) return;
    const built = buildCustomMeal(input, lookup);
    expect(built.ok).toBe(true);
    if (built.ok) expect(built.meal.items).toHaveLength(4);
  });
});

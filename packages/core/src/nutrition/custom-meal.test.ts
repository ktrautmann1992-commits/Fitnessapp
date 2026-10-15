import { describe, expect, it } from 'vitest';

import { CUSTOM_MEAL_LIMITS, CUSTOM_MEAL_PORTION_CHOICES, FOOD_LOG_LIMITS } from '../constants';
import { FIXTURE_FOODS, foodLookup, makeFood } from '../content/nutrition-fixtures';
import {
  buildCustomMeal,
  canAddCustomMeal,
  customMealComputable,
  type CustomMeal,
  type CustomMealItem,
  customMealNutrients,
  customMealPayloadSchema,
  customMealSaveResultSchema,
  customMealSchema,
  customMealValuesNeedConfirmation,
  entryFromCustomMeal,
  foodLogDisplayTitle,
  isValidCustomMealName,
  normalizeCustomMealName,
  orderCustomMeals,
  renameCustomMeal,
} from './custom-meal';
import {
  CUSTOM_MEAL_ENTRY_TITLE,
  favoriteFromEntry,
  foodLogUnitsFor,
  type FoodLogBuild,
  type FoodLogEntry,
  foodLogEntrySchema,
  foodLogKey,
  isFavoriteEntry,
  quickEntry,
  recentEntries,
  rescaleEntry,
} from './food-log';
import { computeRecipeFacts, zeroNutrients } from './recipe-nutrients';
import { seededRandom } from './test-helpers';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const wasser = makeFood({
  id: 'wasser',
  name_de: 'Wasser',
  nutrients_per_100g: { ...zeroNutrients(), sugar_g: 0, sat_fat_g: 0, fiber_g: 0 },
  units: { ml_to_g: 1 },
});
const FOODS = foodLookup([...FIXTURE_FOODS, wasser]);
const target = (n = 1) => ({ id: ID(900 + n), date: '2026-10-15', slot: 'breakfast' as const });

const PORRIDGE_ITEMS: CustomMealItem[] = [
  { food_id: 'haferflocken', amount: 60, unit: 'g' },
  { food_id: 'vollmilch', amount: 200, unit: 'ml' },
  { food_id: 'banane', amount: 1, unit: 'piece' },
];

function meal(build: ReturnType<typeof buildCustomMeal>): CustomMeal {
  if (!build.ok) throw new Error(`Gericht nicht gebaut: ${build.reason}`);
  return build.meal;
}
function entry(build: FoodLogBuild): FoodLogEntry {
  if (!build.ok) throw new Error(`Eintrag nicht gebaut: ${build.reason}`);
  return build.entry;
}

const direct = (overrides: Partial<CustomMeal> = {}): CustomMeal => ({
  id: ID(1),
  name_de: 'Shake nach dem Training',
  mode: 'direct',
  servings: 1,
  kcal: 450,
  protein_g: 30,
  carbs_g: 50,
  fat_g: 12.5,
  items: [],
  ...overrides,
});

describe('Grenzen (Plan 7)', () => {
  it('100 Gerichte, 30 Zutaten, Name 60 Zeichen, Portionen 1–20, Rückfrage ab 20 % Abweichung', () => {
    expect(CUSTOM_MEAL_LIMITS).toMatchObject({
      maxMeals: 100,
      maxItems: 30,
      nameMaxChars: 60,
      servings: { min: 1, max: 20 },
      macroKcalTolerance: 0.2,
    });
    expect(Math.min(...CUSTOM_MEAL_PORTION_CHOICES)).toBe(FOOD_LOG_LIMITS.portion.min);
    expect(Math.max(...CUSTOM_MEAL_PORTION_CHOICES)).toBe(FOOD_LOG_LIMITS.portion.max);
  });
  it('canAddCustomMeal: 99 ja, 100 nein', () => {
    expect(canAddCustomMeal(Array.from({ length: 99 }))).toBe(true);
    expect(canAddCustomMeal(Array.from({ length: 100 }))).toBe(false);
  });
});

describe('Name (Freitext, 1–60 Zeichen)', () => {
  it.each([
    ['A', true],
    ['ä'.repeat(60), true],
    ['😀'.repeat(60), true],
    ['ä'.repeat(61), false],
    ['', false],
    [' Shake', false],
    ['Shake ', false],
    ['Zeile\nzwei', false],
    ['Tab\tTab', false],
    ['Nul\u0000l', false],
  ])('„%s“ → %s', (name, valid) => {
    expect(isValidCustomMealName(name)).toBe(valid);
    expect(customMealSchema.safeParse(direct({ name_de: name })).success).toBe(valid);
  });
  it('normalizeCustomMealName: Rand weg, Leerraum innen zu einem Leerzeichen', () => {
    expect(normalizeCustomMealName('  Mein \n  Porridge\t')).toBe('Mein Porridge');
  });
});

describe('customMealSchema (strikt, wie die CHECKs)', () => {
  it('direkt mit Werten, direkt ohne Werte, aus Zutaten', () => {
    expect(customMealSchema.safeParse(direct()).success).toBe(true);
    expect(
      customMealSchema.safeParse(
        direct({ kcal: null, protein_g: null, carbs_g: null, fat_g: null }),
      ).success,
    ).toBe(true);
    expect(
      customMealSchema.safeParse(
        direct({ mode: 'ingredients', servings: 2, items: PORRIDGE_ITEMS }),
      ).success,
    ).toBe(true);
  });
  it.each([
    ['direkt mit Zutaten', direct({ items: PORRIDGE_ITEMS })],
    ['direkt mit 2 Portionen', direct({ servings: 2 })],
    ['Makros ohne kcal', direct({ kcal: null })],
    ['aus Zutaten ohne Zutat', direct({ mode: 'ingredients', items: [] })],
    ['aus Zutaten ohne Werte', direct({ mode: 'ingredients', items: PORRIDGE_ITEMS, fat_g: null })],
    [
      'aus Zutaten mit 31 Zutaten',
      direct({ mode: 'ingredients', items: Array.from({ length: 31 }, () => PORRIDGE_ITEMS[0]!) }),
    ],
    ['21 Portionen', direct({ mode: 'ingredients', servings: 21, items: PORRIDGE_ITEMS })],
    ['0 Portionen', direct({ mode: 'ingredients', servings: 0, items: PORRIDGE_ITEMS })],
    ['1,5 Portionen', direct({ mode: 'ingredients', servings: 1.5, items: PORRIDGE_ITEMS })],
    ['3.001 kcal', direct({ kcal: 3001 })],
    ['kcal mit Komma', direct({ kcal: 450.5 })],
    ['Makro mit zwei Nachkommastellen', direct({ protein_g: 30.25 })],
    ['Makro über 750 g', direct({ fat_g: 750.1 })],
    [
      'Zutat ½ Stück unter ½',
      direct({ mode: 'ingredients', items: [{ food_id: 'banane', amount: 0.3, unit: 'piece' }] }),
    ],
    [
      'Zutat 2.001 g',
      direct({
        mode: 'ingredients',
        items: [{ food_id: 'haferflocken', amount: 2001, unit: 'g' }],
      }),
    ],
  ])('abgelehnt: %s', (_, value) => {
    expect(customMealSchema.safeParse(value).success).toBe(false);
  });
  it('unbekanntes Feld (user_id) abgelehnt', () => {
    expect(customMealSchema.safeParse({ ...direct(), user_id: ID(5) }).success).toBe(false);
  });
  it('Payload: write_id und base_revision zusätzlich, keine Server-Felder', () => {
    const payload = { ...direct(), write_id: ID(2), base_revision: null };
    expect(customMealPayloadSchema.safeParse(payload).success).toBe(true);
    expect(customMealPayloadSchema.safeParse({ ...payload, revision: 1 }).success).toBe(false);
  });
  it('Antwort des Servers: id null nur bei deleted', () => {
    expect(
      customMealSaveResultSchema.safeParse({ result: 'saved', id: ID(1), revision: 1 }).success,
    ).toBe(true);
    expect(
      customMealSaveResultSchema.safeParse({
        result: 'conflict',
        reason: 'revision',
        id: null,
        revision: null,
      }).success,
    ).toBe(false);
    expect(
      customMealSaveResultSchema.safeParse({ result: 'rejected', code: 'limit' }).success,
    ).toBe(true);
  });
});

describe('customMealNutrients – gleiche Rechnung wie Rezepte', () => {
  it('Mein Porridge (Haferflocken 60 g, Milch 200 ml, Banane 1 Stück) = computeRecipeFacts', () => {
    const result = customMealNutrients({ items: PORRIDGE_ITEMS, servings: 1 }, FOODS);
    const facts = computeRecipeFacts(
      {
        ingredients: PORRIDGE_ITEMS.map((i) => ({ ...i, optional: false, scales: true })),
        servings: 1,
        no_cook: false,
        steps_de: [],
      },
      FOODS,
    );
    expect(result).toEqual({
      ok: true,
      perServing: {
        kcal: Math.round(facts.perServing.kcal),
        protein_g: Math.round(facts.perServing.protein_g * 10) / 10,
        carbs_g: Math.round(facts.perServing.carbs_g * 10) / 10,
        fat_g: Math.round(facts.perServing.fat_g * 10) / 10,
      },
    });
    // 222 + 131,84 (200 ml × 1,03) + 111,6 (120 g) kcal
    expect(result.ok && result.perServing.kcal).toBe(465);
  });
  it('Portionen teilen die Summe', () => {
    const one = customMealNutrients({ items: PORRIDGE_ITEMS, servings: 1 }, FOODS);
    const four = customMealNutrients({ items: PORRIDGE_ITEMS, servings: 4 }, FOODS);
    expect(four.ok && one.ok && four.perServing.kcal).toBe(Math.round(465.44 / 4));
  });
  it('1 Zutat und 30 Zutaten', () => {
    expect(customMealNutrients({ items: [PORRIDGE_ITEMS[0]!], servings: 1 }, FOODS)).toMatchObject({
      ok: true,
      perServing: { kcal: 222 },
    });
    const thirty = Array.from({ length: 30 }, () => ({
      food_id: 'banane',
      amount: 10,
      unit: 'g' as const,
    }));
    expect(customMealNutrients({ items: thirty, servings: 1 }, FOODS)).toMatchObject({
      ok: true,
      perServing: { kcal: 279 },
    });
    expect(
      customMealNutrients({ items: [...thirty, PORRIDGE_ITEMS[0]!], servings: 1 }, FOODS),
    ).toEqual({ ok: false, reason: 'items', index: null });
    expect(customMealNutrients({ items: [], servings: 1 }, FOODS)).toEqual({
      ok: false,
      reason: 'items',
      index: null,
    });
  });
  it('Zutat nicht im Bestand (archiviert) → missing_food mit Position', () => {
    expect(
      customMealNutrients(
        {
          items: [PORRIDGE_ITEMS[0]!, { food_id: 'gibt-es-nicht', amount: 10, unit: 'g' }],
          servings: 1,
        },
        FOODS,
      ),
    ).toEqual({ ok: false, reason: 'missing_food', index: 1 });
  });
  it('Stück ohne Gewicht und ml ohne Umrechnung → unit', () => {
    expect(
      customMealNutrients(
        { items: [{ food_id: 'haferflocken', amount: 1, unit: 'piece' }], servings: 1 },
        FOODS,
      ),
    ).toEqual({ ok: false, reason: 'unit', index: 0 });
    expect(
      customMealNutrients(
        { items: [{ food_id: 'haferflocken', amount: 100, unit: 'ml' }], servings: 1 },
        FOODS,
      ),
    ).toEqual({ ok: false, reason: 'unit', index: 0 });
  });
  it('Mengen: 2.000 g ja, 2.001 g nein, 17 Bananen (2.040 g) nein', () => {
    expect(
      customMealNutrients(
        { items: [{ food_id: 'wasser', amount: 2000, unit: 'g' }], servings: 1 },
        FOODS,
      ).ok,
    ).toBe(true);
    expect(
      customMealNutrients(
        { items: [{ food_id: 'wasser', amount: 2001, unit: 'g' }], servings: 1 },
        FOODS,
      ),
    ).toEqual({ ok: false, reason: 'amount', index: 0 });
    expect(
      customMealNutrients(
        { items: [{ food_id: 'banane', amount: 17, unit: 'piece' }], servings: 1 },
        FOODS,
      ),
    ).toEqual({ ok: false, reason: 'amount', index: 0 });
  });
  it('0-kcal-Gericht (Wasser) ist gültig', () => {
    expect(
      customMealNutrients(
        { items: [{ food_id: 'wasser', amount: 500, unit: 'ml' }], servings: 1 },
        FOODS,
      ),
    ).toEqual({ ok: true, perServing: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } });
  });
  it('über 3.000 kcal je Portion → too_much; auf 6 Portionen verteilt ok', () => {
    const oil = [{ food_id: 'olivenoel', amount: 500, unit: 'g' as const }];
    expect(customMealNutrients({ items: oil, servings: 1 }, FOODS)).toEqual({
      ok: false,
      reason: 'too_much',
      index: null,
    });
    expect(customMealNutrients({ items: oil, servings: 6 }, FOODS).ok).toBe(true);
  });
});

describe('buildCustomMeal / renameCustomMeal', () => {
  it('direkt mit Werten; Makros auf eine Nachkommastelle', () => {
    const m = meal(
      buildCustomMeal(
        {
          id: ID(1),
          name: '  Shake  ',
          mode: 'direct',
          values: { kcal: 450, protein_g: 30.04, carbs_g: 50, fat_g: null },
        },
        FOODS,
      ),
    );
    expect(m).toEqual({
      id: ID(1),
      name_de: 'Shake',
      mode: 'direct',
      servings: 1,
      kcal: 450,
      protein_g: 30,
      carbs_g: 50,
      fat_g: null,
      items: [],
    });
  });
  it('direkt ohne Werte (Kalorienzahlen aus)', () => {
    expect(
      meal(buildCustomMeal({ id: ID(1), name: 'X', mode: 'direct', values: null }, FOODS)),
    ).toMatchObject({ kcal: null, protein_g: null, carbs_g: null, fat_g: null });
  });
  it.each([
    [{ kcal: 3001, protein_g: null, carbs_g: null, fat_g: null }, 'values'],
    [{ kcal: 12.5, protein_g: null, carbs_g: null, fat_g: null }, 'values'],
    [{ kcal: -1, protein_g: null, carbs_g: null, fat_g: null }, 'values'],
    [{ kcal: 100, protein_g: 751, carbs_g: null, fat_g: null }, 'values'],
    [{ kcal: 100, protein_g: Number.NaN, carbs_g: null, fat_g: null }, 'values'],
  ])('direkt ungültig %j → %s', (values, reason) => {
    expect(buildCustomMeal({ id: ID(1), name: 'X', mode: 'direct', values }, FOODS)).toMatchObject({
      ok: false,
      reason,
    });
  });
  it('ungültiger Name → name (ohne Werte, ohne den Namen)', () => {
    const result = buildCustomMeal({ id: ID(1), name: '   ', mode: 'direct', values: null }, FOODS);
    expect(result).toEqual({ ok: false, reason: 'name', index: null });
  });
  it('aus Zutaten: Werte berechnet, Portionen 1 und 20, 0/21/1,5 abgelehnt', () => {
    const m = meal(
      buildCustomMeal(
        {
          id: ID(2),
          name: 'Mein Porridge',
          mode: 'ingredients',
          servings: 1,
          items: PORRIDGE_ITEMS,
        },
        FOODS,
      ),
    );
    expect(m.kcal).toBe(465);
    expect(m.items).toEqual(PORRIDGE_ITEMS);
    expect(
      buildCustomMeal(
        { id: ID(2), name: 'P', mode: 'ingredients', servings: 20, items: PORRIDGE_ITEMS },
        FOODS,
      ).ok,
    ).toBe(true);
    for (const servings of [0, 21, 1.5]) {
      expect(
        buildCustomMeal(
          { id: ID(2), name: 'P', mode: 'ingredients', servings, items: PORRIDGE_ITEMS },
          FOODS,
        ),
      ).toEqual({ ok: false, reason: 'servings', index: null });
    }
  });
  it('Zutat archiviert: Werte bleiben aus dem Schnappschuss, Umbenennen geht, neu rechnen nicht', () => {
    const m = meal(
      buildCustomMeal(
        {
          id: ID(2),
          name: 'Mein Porridge',
          mode: 'ingredients',
          servings: 1,
          items: PORRIDGE_ITEMS,
        },
        FOODS,
      ),
    );
    const withoutBanana = new Map(FOODS);
    withoutBanana.delete('banane');
    expect(customMealComputable(m, withoutBanana)).toBe(false);
    expect(customMealComputable(m, FOODS)).toBe(true);
    const renamed = meal(renameCustomMeal(m, 'Porridge alt'));
    expect(renamed).toEqual({ ...m, name_de: 'Porridge alt' });
    expect(
      buildCustomMeal(
        { id: ID(2), name: 'X', mode: 'ingredients', servings: 1, items: m.items },
        withoutBanana,
      ),
    ).toEqual({ ok: false, reason: 'missing_food', index: 2 });
    expect(renameCustomMeal(m, '')).toEqual({ ok: false, reason: 'name', index: null });
  });
});

describe('Plausibilität direkter Werte (Makros ergeben grob die kcal, 20 %)', () => {
  // 25 g Eiweiß × 4 = 100 kcal aus den Makros; Bezug der 20 % ist die angegebene kcal-Zahl.
  it.each([
    [100, 25, 0, 0, false],
    [125, 25, 0, 0, false], // |100 − 125| = 25 ≤ 25
    [126, 25, 0, 0, true], // 26 > 25,2
    [84, 25, 0, 0, false], // 16 ≤ 16,8
    [83, 25, 0, 0, true], // 17 > 16,6
    [0, 0, 0, 0, false],
    [0, 1, 0, 0, true],
    [450, 30, 50, 12.5, false], // 120 + 200 + 112,5 = 432,5
  ])('kcal %d, Eiweiß %d, KH %d, Fett %d → Rückfrage %s', (kcal, p, c, f, expected) => {
    expect(customMealValuesNeedConfirmation({ kcal, protein_g: p, carbs_g: c, fat_g: f })).toBe(
      expected,
    );
  });
  it('fehlen Makros, zählt nur „zu viel“: Teilsumme über kcal + 20 %', () => {
    expect(
      customMealValuesNeedConfirmation({ kcal: 900, protein_g: 1, carbs_g: null, fat_g: 1 }),
    ).toBe(false);
    // 50 g Eiweiß = 200 kcal > 100 + 20
    expect(
      customMealValuesNeedConfirmation({ kcal: 100, protein_g: 50, carbs_g: null, fat_g: null }),
    ).toBe(true);
    expect(
      customMealValuesNeedConfirmation({ kcal: 100, protein_g: 30, carbs_g: null, fat_g: null }),
    ).toBe(false);
    expect(
      customMealValuesNeedConfirmation({ kcal: 100, protein_g: null, carbs_g: null, fat_g: null }),
    ).toBe(false);
    expect(
      customMealValuesNeedConfirmation({ kcal: null, protein_g: null, carbs_g: null, fat_g: null }),
    ).toBe(false);
  });
});

describe('entryFromCustomMeal – Schnappschuss mit festem Titel', () => {
  const m = direct();
  it('½ Portion: Werte halbiert, Titel fest, Verweis gesetzt, Name nirgends im Eintrag', () => {
    const e = entry(entryFromCustomMeal(m, 0.5, target()));
    expect(e).toEqual({
      id: ID(901),
      eaten_on: '2026-10-15',
      slot: 'breakfast',
      source: 'custom_meal',
      food_id: null,
      recipe_id: null,
      custom_meal_id: ID(1),
      title_de: CUSTOM_MEAL_ENTRY_TITLE,
      amount: null,
      unit: null,
      portion: 0.5,
      kcal: 225,
      protein_g: 15,
      carbs_g: 25,
      fat_g: 6.3,
    });
    expect(JSON.stringify(e)).not.toContain(m.name_de);
  });
  it('Portion 0,25 und 3 erlaubt, 0,2 / 3,25 / 0,3 nicht', () => {
    expect(entryFromCustomMeal(m, 0.25, target()).ok).toBe(true);
    expect(entryFromCustomMeal(m, 3, target()).ok).toBe(true);
    for (const portion of [0.2, 3.25, 0.3, 0, Number.NaN]) {
      expect(entryFromCustomMeal(m, portion, target())).toEqual({ ok: false, reason: 'portion' });
    }
  });
  it('Gericht ohne Werte → Eintrag ohne Werte', () => {
    expect(
      entry(
        entryFromCustomMeal(
          direct({ kcal: null, protein_g: null, carbs_g: null, fat_g: null }),
          2,
          target(),
        ),
      ),
    ).toMatchObject({ kcal: null, protein_g: null, carbs_g: null, fat_g: null, portion: 2 });
  });
  it('kcal ohne Makros bleibt ohne Makros', () => {
    expect(
      entry(
        entryFromCustomMeal(direct({ protein_g: null, carbs_g: null, fat_g: null }), 1, target()),
      ),
    ).toMatchObject({ kcal: 450, protein_g: null });
  });
  it('3.000 kcal × 3 Portionen → too_much (Tagebuch-Grenze je Eintrag)', () => {
    expect(entryFromCustomMeal(direct({ kcal: 3000 }), 3, target())).toEqual({
      ok: false,
      reason: 'too_much',
    });
    expect(entryFromCustomMeal(direct({ kcal: 1000 }), 3, target()).ok).toBe(true);
  });
  it('0-kcal-Gericht ergibt 0 kcal', () => {
    expect(
      entry(
        entryFromCustomMeal(direct({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }), 3, target()),
      ),
    ).toMatchObject({ kcal: 0 });
  });
  it('Ändern des Gerichts ändert eingetragene Tage nicht; Portion ändern rechnet aus dem Schnappschuss', () => {
    const e = entry(entryFromCustomMeal(m, 1, target()));
    const changed = meal(
      buildCustomMeal(
        {
          id: m.id,
          name: m.name_de,
          mode: 'direct',
          values: { kcal: 900, protein_g: 60, carbs_g: 100, fat_g: 25 },
        },
        FOODS,
      ),
    );
    expect(changed.kcal).toBe(900);
    expect(e.kcal).toBe(450);
    expect(entry(rescaleEntry(e, { portion: 2 }))).toMatchObject({ kcal: 900, portion: 2 });
  });
  it('Schema: anderer Titel, Freitext oder Verweis bei anderer Herkunft abgelehnt', () => {
    const e = entry(entryFromCustomMeal(m, 1, target()));
    expect(foodLogEntrySchema.safeParse({ ...e, title_de: m.name_de }).success).toBe(false);
    expect(foodLogEntrySchema.safeParse({ ...e, portion: null }).success).toBe(false);
    expect(foodLogEntrySchema.safeParse({ ...e, custom_meal_id: null }).success).toBe(true);
    const quick = entry(quickEntry({ label: 'Snack', kcal: 100 }, target(2)));
    expect(foodLogEntrySchema.safeParse({ ...quick, custom_meal_id: ID(1) }).success).toBe(false);
  });
  it('kein Stern für eigene Gerichte; Schlüssel je Gericht, nie mit Namen', () => {
    const e = entry(entryFromCustomMeal(m, 1, target()));
    expect(favoriteFromEntry(e)).toBeNull();
    expect(isFavoriteEntry([{ fav_key: foodLogKey(e) }], e)).toBe(false);
    expect(foodLogKey(e)).toBe(`custom|${ID(1)}`);
  });
});

describe('Anzeige und Reihenfolge', () => {
  const e = entry(entryFromCustomMeal(direct(), 1, target()));
  it('foodLogDisplayTitle: Name des Gerichts, nach dem Löschen „Eigenes Gericht“', () => {
    expect(foodLogDisplayTitle(e, [direct()])).toBe('Shake nach dem Training');
    expect(foodLogDisplayTitle(e, [])).toBe(CUSTOM_MEAL_ENTRY_TITLE);
    expect(foodLogDisplayTitle({ ...e, custom_meal_id: null }, [direct()])).toBe(
      CUSTOM_MEAL_ENTRY_TITLE,
    );
    const quick = entry(quickEntry({ label: 'Snack', kcal: 100 }, target(2)));
    expect(foodLogDisplayTitle(quick, [direct()])).toBe('Snack');
  });
  it('orderCustomMeals: zuletzt eingetragen zuerst, sonst alphabetisch', () => {
    const a = direct({ id: ID(1), name_de: 'Zucchini-Pfanne' });
    const b = direct({ id: ID(2), name_de: 'Apfel-Shake' });
    const c = direct({ id: ID(3), name_de: 'Müsli' });
    expect(orderCustomMeals([a, b, c], []).map((x) => x.name_de)).toEqual([
      'Apfel-Shake',
      'Müsli',
      'Zucchini-Pfanne',
    ]);
    const used = { ...e, custom_meal_id: ID(1), created_at: '2026-10-15T08:00:00Z' };
    expect(orderCustomMeals([a, b, c], [used]).map((x) => x.id)).toEqual([ID(1), ID(2), ID(3)]);
  });
  it('recentEntries: eigenes Gericht einmal je Gericht, gelöschtes (Verweis leer) nicht', () => {
    const at = (x: FoodLogEntry, t: string) => ({ ...x, created_at: t, updated_at: t });
    const e2 = entry(entryFromCustomMeal(direct(), 0.5, target(3)));
    const gone = {
      ...entry(entryFromCustomMeal(direct({ id: ID(7) }), 1, target(4))),
      custom_meal_id: null,
    };
    const recent = recentEntries([
      at(e, '2026-10-15T08:00:00Z'),
      at(e2, '2026-10-15T09:00:00Z'),
      at(gone, '2026-10-15T10:00:00Z'),
    ]);
    expect(recent.map((r) => r.id)).toEqual([e2.id]);
  });
});

describe('Eigenschaftstests (Zufall mit festem Startwert)', () => {
  const foodIds = [...FOODS.keys()];
  const units = ['g', 'ml', 'piece'] as const;
  it('aus Zutaten: Ergebnis gültig, gleiche Rechnung wie Rezepte, Eintrag skaliert und ohne Namen', () => {
    const r = seededRandom(2015);
    let built = 0;
    for (let run = 0; run < 1500; run += 1) {
      // Meist wenige Zutaten, manchmal 25–32 (über der Grenze); meist umrechenbare Einheiten, manchmal nicht.
      const count = r() < 0.1 ? 25 + Math.floor(r() * 8) : 1 + Math.floor(r() * 6);
      const items = Array.from({ length: count }, () => {
        const food = FOODS.get(foodIds[Math.floor(r() * foodIds.length)] ?? 'banane')!;
        const available = foodLogUnitsFor(food);
        const pool = r() < 0.9 ? available : units;
        const unit = pool[Math.floor(r() * pool.length)] ?? 'g';
        const amount =
          unit === 'piece'
            ? (1 + Math.floor(r() * (r() < 0.95 ? 8 : 44))) / 2
            : Math.round((0.5 + r() * (r() < 0.95 ? 300 : 2100)) * 10) / 10;
        return { food_id: food.id, amount, unit };
      });
      const servings = r() < 0.1 ? Math.floor(r() * 23) : 1 + Math.floor(r() * 6);
      const name = `Gericht ${run}`;
      const result = buildCustomMeal(
        { id: ID(run), name, mode: 'ingredients', servings, items },
        FOODS,
      );
      if (!result.ok) {
        // Ablehnung nur aus bekannten Gründen; nie mit dem Namen.
        expect(['servings', 'items', 'amount', 'unit', 'missing_food', 'too_much']).toContain(
          result.reason,
        );
        expect(JSON.stringify(result)).not.toContain(name);
        continue;
      }
      built += 1;
      const m = result.meal;
      expect(customMealSchema.safeParse(m).success).toBe(true);
      expect(m.items.length).toBeLessThanOrEqual(CUSTOM_MEAL_LIMITS.maxItems);
      // Gleiche Rechnung: computeRecipeFacts mit denselben Zutaten als Rezept.
      const facts = computeRecipeFacts(
        {
          ingredients: m.items.map((i) => ({ ...i, optional: false, scales: true })),
          servings: m.servings,
          no_cook: false,
          steps_de: [],
        },
        FOODS,
      );
      expect(m.kcal).toBe(Math.round(facts.perServing.kcal));
      const portion =
        CUSTOM_MEAL_PORTION_CHOICES[Math.floor(r() * CUSTOM_MEAL_PORTION_CHOICES.length)] ?? 1;
      const e = entryFromCustomMeal(m, portion, target(run));
      if (!e.ok) {
        expect(e.reason).toBe('too_much');
        expect((m.kcal ?? 0) * portion).toBeGreaterThan(FOOD_LOG_LIMITS.kcal.max - 1);
        continue;
      }
      expect(foodLogEntrySchema.safeParse(e.entry).success).toBe(true);
      expect(e.entry.kcal).toBe(Math.round((m.kcal ?? 0) * portion));
      expect(e.entry.title_de).toBe(CUSTOM_MEAL_ENTRY_TITLE);
      expect(JSON.stringify(e.entry)).not.toContain(name);
    }
    expect(built).toBeGreaterThan(50);
  }, 60_000);

  it('direkt: Werte in den Grenzen ergeben immer ein gültiges Gericht; ohne alle Makros nur „zu viel“', () => {
    const r = seededRandom(2016);
    for (let run = 0; run < 3000; run += 1) {
      const kcal = Math.floor(r() * 3300) - 100;
      const macro = () => (r() < 0.2 ? null : Math.round(r() * 8000) / 10);
      const values = { kcal, protein_g: macro(), carbs_g: macro(), fat_g: macro() };
      const result = buildCustomMeal(
        { id: ID(run), name: 'Direkt', mode: 'direct', values },
        FOODS,
      );
      const inRange =
        kcal >= 0 &&
        kcal <= 3000 &&
        [values.protein_g, values.carbs_g, values.fat_g].every((m) => m === null || m <= 750);
      expect(result.ok).toBe(inRange);
      if (result.ok) {
        expect(customMealSchema.safeParse(result.meal).success).toBe(true);
        const m = result.meal;
        if ([m.protein_g, m.carbs_g, m.fat_g].some((v) => v === null) && m.kcal !== null) {
          const partial = 4 * (m.protein_g ?? 0) + 4 * (m.carbs_g ?? 0) + 9 * (m.fat_g ?? 0);
          if (partial <= m.kcal) expect(customMealValuesNeedConfirmation(m)).toBe(false);
        }
      }
    }
  }, 60_000);

  it('Namen: normalisiert ist immer gültig oder leer bzw. zu lang; Schema = isValidCustomMealName', () => {
    const r = seededRandom(2017);
    const chars = ['a', 'Ä', ' ', '\n', '\t', '😀', '-', 'ß', '\u0007', ' '];
    for (let run = 0; run < 3000; run += 1) {
      const raw = Array.from(
        { length: Math.floor(r() * 70) },
        () => chars[Math.floor(r() * chars.length)] ?? 'a',
      ).join('');
      const name = normalizeCustomMealName(raw);
      expect(normalizeCustomMealName(name)).toBe(name);
      expect(customMealSchema.safeParse(direct({ name_de: raw })).success).toBe(
        isValidCustomMealName(raw),
      );
      const length = [...name].length;
      if (length >= 1 && length <= 60 && !name.includes('\u0007')) {
        expect(isValidCustomMealName(name)).toBe(true);
      }
    }
  }, 60_000);
});

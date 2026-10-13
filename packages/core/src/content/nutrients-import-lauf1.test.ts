/**
 * Import-Lauf 1 (PR #47, docs/PLAN-PHASE-5.md N2b): ergänzende Nährwerte ohne Zahlenwert in der Quelle (`null`,
 * nie geschätzt) und R4 mit organischen Säuren, Alkohol und Polyolen (LMIV Anhang XIV). Alle Werte sind TESTWERTE
 * (gerundet nach dem Bericht zu PR #47), keine Katalogdaten.
 */
import { describe, expect, it } from 'vitest';

import { RECIPE_CHECK_LIMITS } from '../constants';
import { computeRecipeFacts } from '../nutrition/recipe-nutrients';
import { scalePortion, scaleRecipeForServings } from '../nutrition/scale';
import { addOptionalNutrient, type Food, nutrientsPer100gSchema } from './food-schema';
import { proposeIngredientRole } from './import-rules';
import { catalogFor, foodLookup, makeFood, makeRecipe } from './nutrition-fixtures';
import { atwaterKcal, checkFoodAtwater, checkFoodSource } from './recipe-checks';

type Nutrients = Food['nutrients_per_100g'];

const base: Nutrients = {
  kcal: 100,
  protein_g: 1,
  carbs_g: 1,
  sugar_g: 0.5,
  fat_g: 1,
  sat_fat_g: 0.2,
  fiber_g: 1,
  salt_g: 0.1,
};

describe('Schema: Zucker, gesättigte Fettsäuren, Ballaststoffe dürfen „kein Wert“ (null) sein', () => {
  it('null ist gültig, Pflichtwerte bleiben Pflicht', () => {
    const honey = {
      ...base,
      kcal: 310,
      carbs_g: 76,
      sugar_g: 75,
      fat_g: 0,
      sat_fat_g: 0,
      fiber_g: null,
    };
    expect(nutrientsPer100gSchema.safeParse(honey).success).toBe(true);
    expect(
      nutrientsPer100gSchema.safeParse({ ...base, sugar_g: null, sat_fat_g: null }).success,
    ).toBe(true);
    for (const key of ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'salt_g'] as const) {
      expect(nutrientsPer100gSchema.safeParse({ ...base, [key]: null }).success).toBe(false);
    }
    // Feld weglassen ist nicht dasselbe wie „kein Wert“: Pflichtfeld bleibt Pflicht.
    const withoutFiber: Partial<Nutrients> = { ...base };
    delete withoutFiber.fiber_g;
    expect(nutrientsPer100gSchema.safeParse(withoutFiber).success).toBe(false);
  });

  it('Plausibilität gilt weiter, sobald ein Wert da ist', () => {
    expect(nutrientsPer100gSchema.safeParse({ ...base, sugar_g: 2 }).success).toBe(false);
    expect(nutrientsPer100gSchema.safeParse({ ...base, sat_fat_g: 2 }).success).toBe(false);
    expect(
      nutrientsPer100gSchema.safeParse({ ...base, protein_g: 50, carbs_g: 50, fiber_g: null })
        .success,
    ).toBe(true);
  });

  it('Zusatzfelder für R4 sind optional und dürfen null sein', () => {
    expect(
      nutrientsPer100gSchema.safeParse({
        ...base,
        organic_acids_g: 5.5,
        alcohol_g: null,
        polyols_g: 0,
      }).success,
    ).toBe(true);
    expect(nutrientsPer100gSchema.safeParse({ ...base, organic_acids_g: -1 }).success).toBe(false);
  });

  it('addOptionalNutrient: unbekannt bleibt unbekannt', () => {
    expect(addOptionalNutrient(1, 2)).toBe(3);
    expect(addOptionalNutrient(null, 2)).toBeNull();
    expect(addOptionalNutrient(1, null)).toBeNull();
  });
});

describe('Verbraucher in core: Summen ohne Schätzung', () => {
  const honeyNoFiber = makeFood({
    id: 'honig',
    name_de: 'Honig',
    animal: ['honey'],
    groups: ['fructose'],
    units: { tsp_g: 7 },
    nutrients_per_100g: {
      kcal: 310,
      protein_g: 0.4,
      carbs_g: 76,
      sugar_g: 75,
      fat_g: 0,
      sat_fat_g: 0,
      fiber_g: null,
      salt_g: 0.01,
    },
  });
  const foods = foodLookup();
  foods.set('honig', honeyNoFiber);

  it('Rezept mit Zutat ohne Ballaststoff-Wert: Ballaststoffe null, Pflichtwerte gerechnet', () => {
    const facts = computeRecipeFacts(makeRecipe(), foods);
    expect(facts.nutrientsComplete).toBe(true);
    expect(facts.total.fiber_g).toBeNull();
    expect(facts.perServing.fiber_g).toBeNull();
    expect(facts.perServing.sugar_g).not.toBeNull();
    expect(facts.perServing.kcal).toBeGreaterThan(0);
  });

  it('weggelassene (optionale) oder nicht verwendete Zutat ohne Wert stört die Summe nicht', () => {
    const recipe = makeRecipe({
      ingredients: makeRecipe().ingredients.filter((i) => i.food_id !== 'honig'),
    });
    expect(computeRecipeFacts(recipe, foods).perServing.fiber_g).not.toBeNull();
  });

  it('Portionen und Portionswähler: null bleibt null (Teilen, Skalieren)', () => {
    const variant = { recipe: makeRecipe(), omitted: [], substitutions: [] };
    expect(scalePortion(variant, 1, foods).nutrients.fiber_g).toBeNull();
    const four = scaleRecipeForServings(makeRecipe(), 4, foods);
    expect(four.total.fiber_g).toBeNull();
    expect(four.perServing.fiber_g).toBeNull();
    expect(four.perServing.kcal).toBeCloseTo(four.total.kcal / 4, 6);
  });

  it('Rollen-Vorschlag: Zucker ohne Wert ist keine Annahme „süß“', () => {
    const syrup = makeFood({
      shopping_category: 'cereal_breakfast',
      nutrients_per_100g: { ...base, kcal: 260, carbs_g: 65, sugar_g: null, fat_g: 0 },
    });
    expect(proposeIngredientRole(syrup, 'g')).not.toBe('sweet');
    expect(
      proposeIngredientRole(
        { ...syrup, nutrients_per_100g: { ...syrup.nutrients_per_100g, sugar_g: 60 } },
        'g',
      ),
    ).toBe('sweet');
  });

  it('R17: „kein Wert“ muss „kein Wert“ bleiben – 0 statt null ist rot', () => {
    const food = makeFood({
      nutrients_per_100g: { ...makeFood().nutrients_per_100g, fiber_g: null },
    });
    const catalog = catalogFor([food]);
    expect(checkFoodSource(food, catalog)).toEqual([]);
    const guessed = { ...food, nutrients_per_100g: { ...food.nutrients_per_100g, fiber_g: 0 } };
    expect(checkFoodSource(guessed, catalog)).toMatchObject([
      { rule: 'R17', path: 'nutrients_per_100g.fiber_g' },
    ]);
    expect(checkFoodSource(guessed, catalog)[0]?.message).toMatch(/0 statt kein Wert/);
  });

  it('R17 vergleicht auch die R4-Zusatzfelder', () => {
    const vinegar = makeFood({
      nutrients_per_100g: { ...base, kcal: 18, organic_acids_g: 5.48 },
    });
    const catalog = catalogFor([vinegar]);
    expect(checkFoodSource(vinegar, catalog)).toEqual([]);
    const changed = {
      ...vinegar,
      nutrients_per_100g: { ...vinegar.nutrients_per_100g, organic_acids_g: 4 },
    };
    expect(checkFoodSource(changed, catalog)).toMatchObject([
      { rule: 'R17', path: 'nutrients_per_100g.organic_acids_g' },
    ]);
  });
});

describe('R4 mit organischen Säuren, Alkohol und Polyolen (LMIV Anhang XIV)', () => {
  const food = (n: Partial<Nutrients>) => makeFood({ nutrients_per_100g: { ...base, ...n } });

  it('Faktoren stehen zentral in den Konstanten', () => {
    expect(RECIPE_CHECK_LIMITS.atwater).toMatchObject({
      organicAcids: 3,
      alcohol: 7,
      polyols: 2.4,
    });
  });

  it('Apfelessig, Zitronen-/Limettensaft, Sauerkraut: mit Säuren grün, ohne Säure-Wert rot', () => {
    const cases: Partial<Nutrients>[] = [
      // Apfelessig 18 kcal
      {
        kcal: 18,
        protein_g: 0.2,
        carbs_g: 0.15,
        sugar_g: 0.1,
        fat_g: 0,
        sat_fat_g: 0,
        fiber_g: 0,
        organic_acids_g: 5.48,
        alcohol_g: 0.1,
      },
      // Zitronensaft 30 kcal
      {
        kcal: 30,
        protein_g: 0.4,
        carbs_g: 2.4,
        sugar_g: 2,
        fat_g: 0.1,
        sat_fat_g: 0,
        fiber_g: 0.3,
        organic_acids_g: 6.01,
        alcohol_g: 0,
      },
      // Limettensaft 24 kcal
      {
        kcal: 24,
        protein_g: 0.4,
        carbs_g: 1.9,
        sugar_g: 1.5,
        fat_g: 0.1,
        sat_fat_g: 0,
        fiber_g: 0.3,
        organic_acids_g: 4.78,
        alcohol_g: 0.02,
      },
      // Sauerkraut 23 kcal
      {
        kcal: 23,
        protein_g: 1.13,
        carbs_g: 0.99,
        sugar_g: 0.5,
        fat_g: 0.31,
        sat_fat_g: 0.1,
        fiber_g: 2.14,
        organic_acids_g: 2.14,
        alcohol_g: 0.16,
        polyols_g: 0.12,
      },
    ];
    for (const n of cases) {
      expect(checkFoodAtwater(food(n))).toEqual([]);
      expect(checkFoodAtwater(food({ ...n, organic_acids_g: null }))).toMatchObject([
        { rule: 'R4' },
      ]);
    }
  });

  it('Champignon: Polyole (Mannit) zählen 2,4 statt 4 kcal/g – nicht doppelt', () => {
    const champignon = {
      kcal: 28,
      protein_g: 3.66,
      carbs_g: 2.9,
      sugar_g: 0.2,
      fat_g: 0.27,
      sat_fat_g: 0.05,
      fiber_g: 1.9,
      organic_acids_g: 0.13,
      polyols_g: 2.74,
    };
    expect(atwaterKcal({ ...base, ...champignon })).toBeCloseTo(28.5, 1);
    expect(checkFoodAtwater(food(champignon))).toEqual([]);
    expect(checkFoodAtwater(food({ ...champignon, polyols_g: undefined }))).toMatchObject([
      { rule: 'R4' },
    ]);
    // Polyole über den Kohlenhydraten (Datenfehler) werden auf die Kohlenhydrate begrenzt.
    expect(
      atwaterKcal({ ...base, carbs_g: 1, polyols_g: 5, fiber_g: 0, protein_g: 0, fat_g: 0 }),
    ).toBeCloseTo(2.4, 6);
  });

  it('Alkohol 7 kcal/g; echte Fehler bleiben rot (z. B. Energie ohne passende Makros)', () => {
    expect(
      atwaterKcal({ ...base, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, alcohol_g: 10 }),
    ).toBe(70);
    expect(checkFoodAtwater(food({ kcal: 180, organic_acids_g: 1 }))).toMatchObject([
      { rule: 'R4' },
    ]);
    // Ballaststoffe ohne Wert zählen in R4 nicht mit (Plausibilität), es wird nichts gespeichert.
    expect(atwaterKcal({ ...base, fiber_g: null })).toBe(4 + 4 + 9);
  });
});

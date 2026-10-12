import { describe, expect, it } from 'vitest';

import { requiredFoodRules } from '../content/allergen-rules';
import {
  FIXTURE_RECIPES,
  foodLookup,
  ing,
  makeFood,
  makeRecipe,
  recipeLookup,
} from '../content/nutrition-fixtures';
import {
  computeRecipeFacts,
  dietAllows,
  foodContainsPork,
  foodDiet,
  needsHeatedFlag,
} from './recipe-nutrients';

const foods = foodLookup();
const recipes = recipeLookup();
const recipe = (id: string) => {
  const found = recipes.get(id);
  if (found === undefined) {
    throw new Error(id);
  }
  return found;
};

describe('foodDiet / dietAllows (R6)', () => {
  it('vegan ohne tierische Bestandteile, Honig/Milch/Ei vegetarisch, Lab/Gelatine/Fleisch nicht', () => {
    expect(foodDiet({ animal: [] })).toBe('vegan');
    expect(foodDiet({ animal: ['honey'] })).toBe('vegetarian');
    expect(foodDiet({ animal: ['dairy', 'egg'] })).toBe('vegetarian');
    expect(foodDiet({ animal: ['dairy', 'animal_rennet'] })).toBe('omnivore');
    expect(foodDiet({ animal: ['gelatin'] })).toBe('omnivore');
    expect(foodDiet({ animal: ['insect'] })).toBe('omnivore');
    expect(foodDiet({ animal: ['meat'] })).toBe('omnivore');
  });
  it('vegan ⊂ vegetarisch ⊂ omnivor', () => {
    expect(dietAllows('omnivore', 'vegan')).toBe(true);
    expect(dietAllows('vegetarian', 'vegan')).toBe(true);
    expect(dietAllows('vegetarian', 'omnivore')).toBe(false);
    expect(dietAllows('vegan', 'vegetarian')).toBe(false);
    expect(dietAllows('vegan', 'vegan')).toBe(true);
  });
});

describe('foodContainsPork (R8, S5)', () => {
  const base = makeFood({ animal: [], meat_kind: [] });
  it('Schweinefleisch, unbekannte Tierart, Gelatine ohne/unbekannte/Schweine-Herkunft', () => {
    expect(foodContainsPork({ ...base, animal: ['meat'], meat_kind: ['pork'] })).toBe(true);
    expect(foodContainsPork({ ...base, animal: ['meat'], meat_kind: ['unknown'] })).toBe(true);
    expect(foodContainsPork({ ...base, animal: ['gelatin'] })).toBe(true);
    expect(foodContainsPork({ ...base, animal: ['gelatin'], gelatin_origin: 'unknown' })).toBe(
      true,
    );
    expect(foodContainsPork({ ...base, animal: ['gelatin'], gelatin_origin: 'pork' })).toBe(true);
  });
  it('Rind, Fisch-Gelatine, pflanzlich → kein Schwein', () => {
    expect(foodContainsPork({ ...base, animal: ['meat'], meat_kind: ['beef'] })).toBe(false);
    expect(foodContainsPork({ ...base, animal: ['gelatin'], gelatin_origin: 'fish' })).toBe(false);
    expect(foodContainsPork(base)).toBe(false);
  });
});

describe('needsHeatedFlag (R2-S2)', () => {
  it('Ei, Fisch, Krebs-/Weichtiere, Fleisch, Rohmilch – nicht Milch, Gemüse', () => {
    const f = foods;
    expect(needsHeatedFlag(f.get('huehnerei')!)).toBe(true);
    expect(needsHeatedFlag(f.get('lachs')!)).toBe(true);
    expect(needsHeatedFlag(f.get('haehnchenbrust')!)).toBe(true);
    expect(needsHeatedFlag(f.get('bergkaese-rohmilch')!)).toBe(true);
    expect(needsHeatedFlag(f.get('vollmilch')!)).toBe(false);
    expect(needsHeatedFlag(f.get('zwiebel')!)).toBe(false);
    expect(needsHeatedFlag(makeFood({ groups: ['shellfish'] }))).toBe(true);
  });
});

describe('computeRecipeFacts: Nährwerte aus Zutaten', () => {
  it('Porridge: Summe der nicht optionalen Zutaten, je Portion', () => {
    const facts = computeRecipeFacts(recipe('porridge-banane'), foods);
    // 60 g Hafer + 257,5 g Milch + 120 g Banane + 7 g Honig (Erdnüsse optional → nicht in Nährwerten).
    const kcal = 0.6 * 370 + 2.575 * 64 + 1.2 * 93 + 0.07 * 304;
    expect(facts.perServing.kcal).toBeCloseTo(kcal, 6);
    expect(facts.total.kcal).toBeCloseTo(kcal, 6);
    expect(facts.nutrientsComplete).toBe(true);
    expect(facts.gramsPerServing).toEqual([60, 257.5, 120, 7, 15]);
  });
  it('Portionen teilen die Summe (servings 2 bzw. 4)', () => {
    const spaghetti = computeRecipeFacts(recipe('spaghetti-tomatensauce'), foods);
    expect(spaghetti.perServing.kcal).toBeCloseTo(spaghetti.total.kcal / 2, 9);
    const creme = computeRecipeFacts(recipe('mascarponecreme-roh'), foods);
    expect(creme.perServing.fat_g).toBeCloseTo(creme.total.fat_g / 4, 9);
  });
  it('fehlendes Lebensmittel / nicht umrechenbare Einheit: markiert, Nährwerte unvollständig', () => {
    const facts = computeRecipeFacts(
      makeRecipe({ ingredients: [ing('gibt-es-nicht', 10, 'g'), ing('salz', 2, 'piece')] }),
      foods,
    );
    expect(facts.missingFoods).toEqual([0]);
    expect(facts.unconvertible).toEqual([1]);
    expect(facts.nutrientsComplete).toBe(false);
  });
  it('optionale Zutat mit fehlender Umrechnung lässt die Nährwerte vollständig', () => {
    const facts = computeRecipeFacts(
      makeRecipe({
        ingredients: [ing('haferflocken', 50, 'g'), ing('salz', 1, 'piece', { optional: true })],
      }),
      foods,
    );
    expect(facts.unconvertible).toEqual([1]);
    expect(facts.nutrientsComplete).toBe(true);
  });
});

describe('computeRecipeFacts: Enthält – optionale Zutaten zählen (S3)', () => {
  it('optionale Erdnüsse stehen in den Allergenen, weggelassen nicht mehr (W9)', () => {
    const porridge = recipe('porridge-banane');
    expect(computeRecipeFacts(porridge, foods).allergens).toContain('peanuts');
    const omitted = computeRecipeFacts(porridge, foods, { omitted: new Set([4]) });
    expect(omitted.allergens).not.toContain('peanuts');
    // Nährwerte bleiben gleich (optionale Zutaten zählen dort nie).
    expect(omitted.perServing.kcal).toBeCloseTo(
      computeRecipeFacts(porridge, foods).perServing.kcal,
      9,
    );
  });
  it('nicht optionale Zutaten können nicht weggelassen werden', () => {
    expect(() =>
      computeRecipeFacts(recipe('porridge-banane'), foods, { omitted: new Set([0]) }),
    ).toThrow(/nicht optional/);
  });
  it('optionaler Parmesan (tierisches Lab) macht das Rezept nicht vegetarisch (W9)', () => {
    const spaghetti = recipe('spaghetti-tomatensauce');
    expect(computeRecipeFacts(spaghetti, foods).diet).toBe('omnivore');
    expect(computeRecipeFacts(spaghetti, foods, { omitted: new Set([5]) }).diet).toBe('vegan');
  });
  it('Honig ist nicht vegan (W9)', () => {
    const facts = computeRecipeFacts(
      makeRecipe({ ingredients: [ing('haferflocken', 50, 'g'), ing('honig', 1, 'tsp')] }),
      foods,
    );
    expect(facts.diet).toBe('vegetarian');
  });
  it('Gelatine zählt als Schwein (W9: Gelatine bei eats_pork = false)', () => {
    const facts = computeRecipeFacts(
      makeRecipe({ ingredients: [ing('zucker', 50, 'g'), ing('gelatine', 2, 'piece')] }),
      foods,
    );
    expect(facts.containsPork).toBe(true);
    expect(facts.diet).toBe('omnivore');
  });
  it('Haferflocken → gluten (W9, R18)', () => {
    expect([...requiredFoodRules(foods.get('haferflocken')!).keys()]).toContain('gluten');
    expect(computeRecipeFacts(recipe('porridge-banane'), foods).allergens).toContain('gluten');
  });
});

describe('computeRecipeFacts: Ersatz-Zutaten (S4, W9)', () => {
  const porridge = recipe('porridge-banane');
  it('laktosefreie Milch: lactose weg, dairy bleibt (Milcheiweiß-Allergie → weiter raus)', () => {
    const facts = computeRecipeFacts(porridge, foods, {
      substitutions: new Map([[1, 'milch-laktosefrei']]),
    });
    expect(facts.allergens).not.toContain('lactose');
    expect(facts.allergens).toContain('dairy');
  });
  it('Haferdrink: dairy/lactose weg, aber gluten (bei Gluten-Unverträglichkeit → raus)', () => {
    const facts = computeRecipeFacts(porridge, foods, {
      substitutions: new Map([[1, 'haferdrink']]),
    });
    expect(facts.allergens).not.toContain('dairy');
    expect(facts.allergens).not.toContain('lactose');
    expect(facts.allergens).toContain('gluten');
  });
  it('Nährwerte werden mit dem Ersatzprodukt neu berechnet', () => {
    const base = computeRecipeFacts(porridge, foods).perServing.kcal;
    const oat = computeRecipeFacts(porridge, foods, {
      substitutions: new Map([[1, 'haferdrink']]),
    }).perServing.kcal;
    expect(base - oat).toBeCloseTo(2.575 * (64 - 45), 6);
  });
  it('Ersatz für unbekannte Zutat → Fehler', () => {
    expect(() =>
      computeRecipeFacts(porridge, foods, { substitutions: new Map([[99, 'haferdrink']]) }),
    ).toThrow();
  });
});

describe('computeRecipeFacts: Schwangerschafts-Vorsicht aus Zutaten und Zubereitung (W20, R2-S2)', () => {
  it('rohes Ei (heated: false) → pregnancy_caution', () => {
    const facts = computeRecipeFacts(recipe('mascarponecreme-roh'), foods);
    expect(facts.pregnancyCaution).toBe(true);
    expect(facts.pregnancyReasons.map((r) => r.kind)).toContain('no_cook');
  });
  it('rohes Ei in gekochtem Rezept (Mayonnaise-Fall) → not_heated', () => {
    const facts = computeRecipeFacts(
      makeRecipe({
        no_cook: false,
        ingredients: [ing('huehnerei', 1, 'piece', { heated: false }), ing('olivenoel', 3, 'tbsp')],
      }),
      foods,
    );
    expect(facts.pregnancyReasons).toEqual([{ kind: 'not_heated', index: 0, foodId: 'huehnerei' }]);
  });
  it('no_cook mit Räucherlachs → pregnancy_caution (Katalog-Flag und ohne Kochen)', () => {
    const facts = computeRecipeFacts(recipe('brot-raeucherlachs'), foods);
    expect(facts.pregnancyCaution).toBe(true);
    expect(facts.pregnancyReasons.map((r) => r.kind).sort()).toEqual(['food_flag', 'no_cook']);
  });
  it('gebackenes/gebratenes Ei (heated: true) → nicht heikel', () => {
    const facts = computeRecipeFacts(recipe('omelett-champignons'), foods);
    expect(facts.pregnancyCaution).toBe(false);
    expect(facts.missingHeated).toEqual([]);
  });
  it('fehlende Angabe heated zählt als ungegart und wird gemeldet', () => {
    const facts = computeRecipeFacts(
      makeRecipe({ ingredients: [ing('haehnchenbrust', 150, 'g'), ing('reis', 75, 'g')] }),
      foods,
    );
    expect(facts.missingHeated).toEqual([0]);
    expect(facts.pregnancyCaution).toBe(true);
  });
  it('heikles Lebensmittel zählt auch, wenn es optional ist und erhitzt wird', () => {
    const facts = computeRecipeFacts(
      makeRecipe({
        ingredients: [
          ing('haferflocken', 50, 'g'),
          ing('bergkaese-rohmilch', 20, 'g', { optional: true, heated: true }),
        ],
      }),
      foods,
    );
    expect(facts.pregnancyReasons).toEqual([
      { kind: 'food_flag', index: 1, foodId: 'bergkaese-rohmilch' },
    ]);
  });
  it('Rezept ohne tierische Zutaten → nicht heikel', () => {
    expect(computeRecipeFacts(recipe('tofu-paprika'), foods).pregnancyCaution).toBe(false);
  });
});

describe('computeRecipeFacts: Haltbarkeit und Alkohol', () => {
  it('kleinste Haltbarkeit der Zutaten (S12)', () => {
    expect(computeRecipeFacts(recipe('haehnchen-reis'), foods).maxFridgeDays).toBe(1);
    expect(computeRecipeFacts(recipe('spaghetti-tomatensauce'), foods).maxFridgeDays).toBe(3);
  });
  it('Alkohol aus dem Katalog', () => {
    const wine = makeFood({
      id: 'rotwein',
      name_de: 'Rotwein',
      alcohol: true,
      groups: ['sulphites'],
    });
    const lookup = new Map([...foods, [wine.id, wine]]);
    const facts = computeRecipeFacts(
      makeRecipe({
        ingredients: [ing('haferflocken', 50, 'g'), ing('rotwein', 50, 'g', { optional: true })],
      }),
      lookup,
    );
    expect(facts.alcohol).toBe(true);
  });
  it('alle Fixture-Rezepte sind vollständig berechenbar', () => {
    for (const r of FIXTURE_RECIPES) {
      const facts = computeRecipeFacts(r, foods);
      expect(facts.missingFoods, r.id).toEqual([]);
      expect(facts.unconvertible, r.id).toEqual([]);
      expect(facts.missingHeated, r.id).toEqual([]);
    }
  });
});

describe('computeRecipeFacts: unbestätigte Import-Annahme „erhitzt“ (Wächter N2c, B1)', () => {
  const recipe = recipeLookup().get('haehnchen-reis');
  if (recipe === undefined) throw new Error('Fixture fehlt');
  const assumption = {
    ingredient_index: 0,
    food_id: 'haehnchenbrust',
    field: 'heated' as const,
    value: true as const,
    reason_de: 'Schritt 2 gart die Zutat durch.',
  };

  it('ohne Annahme: erhitzt → kein Schwangerschafts-Hinweis', () => {
    expect(computeRecipeFacts(recipe, foodLookup()).pregnancyCaution).toBe(false);
  });

  it('unbestätigt → gilt wie nicht erhitzt', () => {
    const facts = computeRecipeFacts(
      { ...recipe, meta: { ...recipe.meta, import_assumptions: [assumption] } },
      foodLookup(),
    );
    expect(facts.pregnancyCaution).toBe(true);
    expect(facts.pregnancyReasons).toEqual([
      { kind: 'unconfirmed_heated', index: 0, foodId: 'haehnchenbrust' },
    ]);
  });

  it('bestätigt (oder ohne Annahmen) → zählt als erhitzt', () => {
    const facts = computeRecipeFacts(
      {
        ...recipe,
        meta: {
          ...recipe.meta,
          import_assumptions: [assumption],
          import_assumptions_confirmed_by: 'KT',
        },
      },
      foodLookup(),
    );
    expect(facts.pregnancyCaution).toBe(false);
  });
});

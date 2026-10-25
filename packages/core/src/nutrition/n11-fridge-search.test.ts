/**
 * Etappe N11 (docs/PLAN-PHASE-5.md 19.7 N11, KONZEPT 6.11): Kühlschrank-Suche „Was habe ich da?“.
 * DoD: keine Zutat, alle Zutaten, nur Gewürze, Ausschlüsse wirken; dazu Gewichtung nach Menge (Vorrat/Gewürze
 * wenig), stabile Sortierung, Ersatzprodukte, optionale Zutaten, Ernährungsform nicht erweitert und ein
 * Eigenschaftstest „Kühlschrank-Suche liefert nie etwas, das filter.ts ausschließt“.
 */
import { describe, expect, it } from 'vitest';

import { FRIDGE_SEARCH } from '../constants';
import type { Food } from '../content/food-schema';
import { ing, makeRecipe } from '../content/nutrition-fixtures';
import type { Recipe } from '../content/recipe-schema';
import { filterRecipe } from './filter';
import {
  fridgeMatchPercent,
  fridgeSearchFoodOptions,
  fridgeSearchQuerySchema,
  fridgeSearchVariants,
  isMinorFridgeFood,
  searchFridge,
  type FridgeSearchInput,
} from './fridge-search';
import { N3_FOODS, N3_RECIPES, usedFoodViolations } from './meal-plan-fixtures';
import { mealPlanProfileSchema, type MealPlanProfileInput } from './schemas';
import { seededRandom } from './test-helpers';

const omnivore: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };

function input(
  profile: MealPlanProfileInput = omnivore,
  extra: Partial<FridgeSearchInput> = {},
): FridgeSearchInput {
  return {
    recipes: N3_RECIPES,
    foods: N3_FOODS,
    profile,
    excludePregnancyCaution: false,
    allowDrafts: true,
    ...extra,
  };
}

const ids = (hits: ReturnType<typeof searchFridge>) => hits.map((h) => h.variant.recipe.id);
const food = (id: string) => N3_FOODS.get(id) as Food;

/** Unabhängig gerechnetes Gewicht einer Zutat (Gramm, Vorrat/Gewürz × minorWeight). */
function weight(foodId: string, amount: number, gramsPerUnit: number): number {
  const f = food(foodId);
  const minor = f.pantry || f.shopping_category === 'spices_baking';
  return amount * gramsPerUnit * (minor ? FRIDGE_SEARCH.minorWeight : 1);
}

describe('Eingabe und leere Auswahl', () => {
  it('keine Zutat → keine Treffer; Schema strikt, doppelte zählen einmal, höchstens 100', () => {
    expect(searchFridge(input())).toEqual([]);
    expect(searchFridge(input(), { foodIds: [] })).toEqual([]);
    expect(fridgeSearchQuerySchema.parse(undefined)).toEqual({ foodIds: [], pantry: [] });
    expect(() =>
      searchFridge(input(), { foodIds: Array.from({ length: 101 }, (_, i) => `zutat-${i}`) }),
    ).toThrow();
    expect(() =>
      fridgeSearchQuerySchema.parse({ foodIds: ['tofu'], extra: true } as unknown),
    ).toThrow();
    expect(() => fridgeSearchQuerySchema.parse({ foodIds: ['Kein Format!'] })).toThrow();
    expect(searchFridge(input(), { foodIds: ['tofu', 'tofu'] })).toEqual(
      searchFridge(input(), { foodIds: ['tofu'] }),
    );
    // Unbekannte Lebensmittel passen einfach zu nichts.
    expect(searchFridge(input(), { foodIds: ['gibt-es-nicht'] })).toEqual([]);
  });
});

describe('Übereinstimmung: Anteil vorhandener Zutaten, gewichtet nach Menge', () => {
  it('alle Zutaten → 100 % und ganz oben, nichts fehlt', () => {
    const all = ['haehnchenbrust', 'reis', 'paprika', 'olivenoel', 'salz'];
    const hits = searchFridge(input(), { foodIds: all });
    const first = hits[0];
    expect(first?.variant.recipe.id).toBe('haehnchen-reis');
    expect(first?.match).toBe(1);
    expect(fridgeMatchPercent(first?.match ?? 0)).toBe(100);
    expect(first?.missing).toEqual([]);
    expect(first?.missingMinor).toEqual([]);
    expect(first?.have).toEqual(all);
  });

  it('Gewichtung nach Menge: Vorrat/Gewürze zählen nur zu einem Zehntel (unabhängig gerechnet)', () => {
    // Hähnchen mit Reis: Hähnchen 150 g, Reis 75 g (Vorrat), Paprika 1 Stück, Öl 1 EL (Vorrat), Salz 1 Prise.
    const paprikaG = food('paprika').units.piece_g ?? 0;
    const oilG = food('olivenoel').units.tbsp_g ?? 0;
    const total =
      weight('haehnchenbrust', 150, 1) +
      weight('reis', 75, 1) +
      weight('paprika', 1, paprikaG) +
      weight('olivenoel', 1, oilG) +
      weight('salz', 1, 0.5);
    const chicken = searchFridge(input(), { foodIds: ['haehnchenbrust'] }).find(
      (h) => h.variant.recipe.id === 'haehnchen-reis',
    );
    expect(chicken?.match).toBeCloseTo(weight('haehnchenbrust', 150, 1) / total, 6);
    expect(chicken?.missing).toEqual(['paprika']);
    expect(chicken?.missingMinor).toEqual(['reis', 'olivenoel', 'salz']);
    // Reis allein (Vorrat, kein Gewürz) wird gelistet, zählt aber wenig.
    const rice = searchFridge(input(), { foodIds: ['reis'] }).find(
      (h) => h.variant.recipe.id === 'haehnchen-reis',
    );
    expect(rice?.match).toBeCloseTo(weight('reis', 75, 1) / total, 6);
    expect(rice?.match ?? 1).toBeLessThan(chicken?.match ?? 0);
    expect(isMinorFridgeFood(food('reis'))).toBe(true);
    expect(isMinorFridgeFood(food('haehnchenbrust'))).toBe(false);
  });

  it('nur Gewürze → keine Treffer (Salz allein passt nicht zu jedem Rezept); mit Hauptzutat wieder', () => {
    expect(searchFridge(input(), { foodIds: ['salz'] })).toEqual([]);
    expect(searchFridge(input(), { foodIds: ['salz', 'zucker'] })).toEqual([]);
    const withMain = searchFridge(input(), { foodIds: ['salz', 'champignons'] });
    expect(ids(withMain)).toContain('omelett-champignons');
    const omelett = withMain.find((h) => h.variant.recipe.id === 'omelett-champignons');
    expect(omelett?.have).toEqual(['champignons', 'salz']);
  });

  it('keine „0 % passt“-Karten: nur Olivenöl → nichts unter 1 % (Wächter N11 S1)', () => {
    const oil = searchFridge(input(), { foodIds: ['olivenoel'] });
    expect(oil.every((h) => fridgeMatchPercent(h.match) >= FRIDGE_SEARCH.minPercent)).toBe(true);
    // Unabhängig nachgerechnet: Öl (1 EL, Vorrat) im Hähnchen-Reis liegt unter 1 % → nicht gelistet.
    expect(ids(oil)).not.toContain('haehnchen-reis');
    for (const selection of [['olivenoel'], ['honig'], ['reis'], ['olivenoel', 'reis', 'banane']]) {
      for (const hit of searchFridge(input(), { foodIds: selection })) {
        expect(fridgeMatchPercent(hit.match)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('vorberechnete Varianten (Wächter N11 S2) ergeben dieselbe Auswahl und dieselben Treffer', () => {
    const profiles: MealPlanProfileInput[] = [
      omnivore,
      { diet: 'vegan', intolerances: ['peanuts'] },
    ];
    for (const profile of profiles) {
      const ctx = input(profile, { excludePregnancyCaution: true });
      const variants = fridgeSearchVariants(ctx);
      expect(fridgeSearchFoodOptions(ctx, variants)).toEqual(fridgeSearchFoodOptions(ctx));
      for (const foodIds of [['tofu', 'paprika'], ['banane'], ['reis', 'olivenoel', 'salz']]) {
        expect(searchFridge(ctx, { foodIds }, variants)).toEqual(searchFridge(ctx, { foodIds }));
      }
    }
  });

  it('optionale Zutaten zählen nicht (weder vorhanden noch fehlend)', () => {
    // Porridge: Erdnüsse optional.
    const hits = searchFridge(input(), { foodIds: ['erdnuesse'] });
    expect(ids(hits)).not.toContain('porridge-banane');
    const porridge = searchFridge(input(), { foodIds: ['banane'] }).find(
      (h) => h.variant.recipe.id === 'porridge-banane',
    );
    expect(porridge?.missing).not.toContain('erdnuesse');
    expect(porridge?.missingMinor).not.toContain('erdnuesse');
  });

  it('Ersatzprodukt: verglichen wird das tatsächlich verwendete Lebensmittel', () => {
    const lactose: MealPlanProfileInput = { diet: 'vegetarian', intolerances: ['lactose'] };
    const withMilk = searchFridge(input(lactose), { foodIds: ['vollmilch'] });
    expect(ids(withMilk)).toEqual([]);
    const lactoseFree = searchFridge(input(lactose), { foodIds: ['milch-laktosefrei'] });
    expect(ids(lactoseFree)).toContain('porridge-banane');
    const options = fridgeSearchFoodOptions(input(lactose)).map((o) => o.foodId);
    expect(options).toContain('milch-laktosefrei');
    expect(options).not.toContain('vollmilch');
  });

  it('Sortierung stabil: Übereinstimmung, dann weniger fehlende Hauptzutaten, Titel, ID; Reihenfolge der Eingabe egal', () => {
    const query = { foodIds: ['paprika', 'banane', 'reis', 'tofu'] };
    const hits = searchFridge(input(), query);
    for (let i = 1; i < hits.length; i += 1) {
      const a = hits[i - 1];
      const b = hits[i];
      if (a === undefined || b === undefined) continue;
      expect(Math.round(a.match * 1e6)).toBeGreaterThanOrEqual(Math.round(b.match * 1e6));
    }
    const reversed = searchFridge(input(undefined, { recipes: [...N3_RECIPES].reverse() }), {
      foodIds: [...query.foodIds].reverse(),
    });
    expect(ids(reversed)).toEqual(ids(hits));
    // Gleichstand: zwei Rezepte nur aus Banane bzw. Paprika (je 100 %) → Titel entscheidet.
    const top = hits.filter((h) => h.match === 1).map((h) => h.variant.recipe.title_de);
    expect(top).toEqual([...top].sort((a, b) => a.localeCompare(b, 'de')));
    expect(top.length).toBeGreaterThanOrEqual(2);
  });

  it('Prozent nur abgerundet: 100 % nur bei vollständiger Übereinstimmung', () => {
    expect(fridgeMatchPercent(1)).toBe(100);
    expect(fridgeMatchPercent(0.9999)).toBe(99);
    expect(fridgeMatchPercent(0.004)).toBe(0);
    expect(fridgeMatchPercent(-1)).toBe(0);
    expect(fridgeMatchPercent(2)).toBe(100);
  });
});

describe('Ausschlüsse wirken (harte Filter wie die Rezeptsuche, nicht abschaltbar)', () => {
  it('Ernährungsform aus dem Profil, NICHT erweitert: vegan mit Hähnchen im Kühlschrank → kein Fleischrezept', () => {
    const vegan: MealPlanProfileInput = { diet: 'vegan' };
    const hits = searchFridge(input(vegan), { foodIds: ['haehnchenbrust', 'paprika'] });
    expect(ids(hits)).not.toContain('haehnchen-reis');
    expect(ids(hits)).toContain('tofu-paprika');
    expect(fridgeSearchFoodOptions(input(vegan)).map((o) => o.foodId)).not.toContain(
      'haehnchenbrust',
    );
  });

  it('Unverträglichkeit, „mag ich nicht“ (Gruppe und Lebensmittel), Schwein, Schwangerschaft', () => {
    const peanut = searchFridge(input({ diet: 'vegan', intolerances: ['peanuts'] }), {
      foodIds: ['erdnuesse', 'banane', 'tofu'],
    });
    expect(ids(peanut)).not.toContain('erdnuss-banane');
    expect(ids(peanut)).not.toContain('tofu-erdnuss-curry');
    const mushrooms = searchFridge(input({ diet: 'omnivore', dislikes: ['mushrooms'] }), {
      foodIds: ['champignons', 'huehnerei'],
    });
    expect(ids(mushrooms)).not.toContain('omelett-champignons');
    const dislikedFood = searchFridge(input({ diet: 'omnivore', dislikedFoods: ['paprika'] }), {
      foodIds: ['paprika', 'haehnchenbrust', 'tofu'],
    });
    for (const hit of dislikedFood) {
      expect(hit.variant.recipe.ingredients.map((i) => i.food_id)).not.toContain('paprika');
    }
    expect(
      fridgeSearchFoodOptions(input({ diet: 'omnivore', dislikedFoods: ['paprika'] })).map(
        (o) => o.foodId,
      ),
    ).not.toContain('paprika');
    const noPork = searchFridge(input({ diet: 'omnivore', eatsPork: null }), {
      foodIds: ['hackfleisch-gemischt', 'spaghetti'],
    });
    expect(noPork.every((h) => !h.variant.facts.containsPork)).toBe(true);
    const pregnant = searchFridge(input(omnivore, { excludePregnancyCaution: true }), {
      foodIds: ['raeucherlachs', 'vollkornbrot', 'mascarpone', 'huehnerei'],
    });
    expect(ids(pregnant)).not.toContain('brot-raeucherlachs');
    expect(ids(pregnant)).not.toContain('mascarponecreme-roh');
    expect(pregnant.every((h) => !h.variant.facts.pregnancyCaution)).toBe(true);
  });

  it('Eigenschaftstest: nie ein Rezept, das filter.ts ausschließt; nie ein ausgeschlossenes Lebensmittel (120 Profile)', () => {
    const rnd = seededRandom(1107);
    const groups = ['peanuts', 'gluten', 'dairy', 'lactose', 'eggs', 'fish', 'mushrooms', 'soy'];
    const allFoods = [...N3_FOODS.keys()];
    let checked = 0;
    for (let i = 0; i < 120; i += 1) {
      const diet = (['omnivore', 'vegetarian', 'vegan'] as const)[i % 3] ?? 'omnivore';
      const chosen = groups.filter(() => rnd() < 0.3);
      const profile = mealPlanProfileSchema.parse({
        diet,
        eatsPork: diet === 'omnivore' ? ([true, false, null] as const)[i % 3] : null,
        intolerances: chosen.filter((_, j) => j % 2 === 0),
        dislikes: chosen.filter((_, j) => j % 2 === 1),
        dislikedFoods: allFoods.filter(() => rnd() < 0.08),
      });
      const pregnancy = rnd() < 0.4;
      const ctx = input(profile, { excludePregnancyCaution: pregnancy });
      // Auswahl absichtlich auch mit ausgeschlossenen Lebensmitteln.
      const selection = allFoods.filter(() => rnd() < 0.35);
      const hits = searchFridge(ctx, { foodIds: selection });
      const allowedIds = new Set(
        N3_RECIPES.filter(
          (r: Recipe) =>
            filterRecipe(r, N3_FOODS, {
              profile,
              excludePregnancyCaution: pregnancy,
              allowDrafts: true,
            }).ok,
        ).map((r) => r.id),
      );
      const options = new Set(fridgeSearchFoodOptions(ctx).map((o) => o.foodId));
      for (const hit of hits) {
        checked += 1;
        const recipe = hit.variant.recipe;
        expect(allowedIds.has(recipe.id)).toBe(true);
        const omitted = new Set(hit.variant.omitted);
        const subs = new Map(hit.variant.substitutions.map((s) => [s.index, s.substituteFoodId]));
        const used = recipe.ingredients.flatMap((ingredient, index) =>
          omitted.has(index) ? [] : [{ index, foodId: subs.get(index) ?? ingredient.food_id }],
        );
        expect(usedFoodViolations(recipe, used, profile, pregnancy)).toEqual([]);
        for (const u of used) expect(profile.dislikedFoods).not.toContain(u.foodId);
        // Vorhanden nur, was ausgewählt UND im Rezept tatsächlich verwendet wird.
        for (const id of hit.have) {
          expect(selection).toContain(id);
          expect(used.map((u) => u.foodId)).toContain(id);
          expect(options.has(id)).toBe(true);
        }
        expect(hit.match).toBeGreaterThan(0);
        expect(hit.match).toBeLessThanOrEqual(1);
      }
      // Auswahlliste: nur Lebensmittel aus passenden Rezepten.
      for (const id of options) expect(profile.dislikedFoods).not.toContain(id);
    }
    expect(checked).toBeGreaterThan(150);
  });
});

describe('Grenzfälle', () => {
  it('Rezept nur aus Gewürzen wird nie gelistet; Rezept mit einer Zutat ist bei Auswahl 100 %', () => {
    const spiceOnly = makeRecipe({
      id: 'gewuerzmischung',
      title_de: 'Gewürzmischung',
      description_de: 'Salz und Zucker gemischt, nur für den Test.',
      meal_types: ['snack'],
      training_tags: [],
      ingredients: [ing('salz', 5, 'g'), ing('zucker', 20, 'g')],
      steps_de: ['Mischen.'],
      prep_minutes: 1,
      cook_minutes: 0,
      no_cook: true,
      equipment_de: [],
      declared_per_serving: { kcal: 80, protein_g: 0, carbs_g: 20, fat_g: 0 },
      declared_diet: 'vegan',
      declared_allergens: [],
    });
    const recipes = [...N3_RECIPES, spiceOnly];
    expect(
      ids(searchFridge(input(omnivore, { recipes }), { foodIds: ['salz', 'zucker'] })),
    ).toEqual([]);
    const banana = searchFridge(input(), { foodIds: ['banane'] }).find(
      (h) => h.variant.recipe.id === 'banane-pur',
    );
    expect(banana?.match).toBe(1);
  });

  it('kein Rezept im Bestand → keine Treffer, keine Auswahl', () => {
    expect(searchFridge(input(omnivore, { recipes: [] }), { foodIds: ['tofu'] })).toEqual([]);
    expect(fridgeSearchFoodOptions(input(omnivore, { recipes: [] }))).toEqual([]);
  });

  it('Auswahlliste: nach Abteilung (feste Reihenfolge), dann Name; Vorrat/Gewürze gekennzeichnet; keine optionalen', () => {
    const options = fridgeSearchFoodOptions(input());
    expect(options.length).toBeGreaterThan(10);
    const salt = options.find((o) => o.foodId === 'salz');
    expect(salt?.minor).toBe(true);
    expect(options.find((o) => o.foodId === 'tofu')?.minor).toBe(false);
    // Parmesan steht nur optional in den Spaghetti → nicht in der Auswahl.
    expect(options.map((o) => o.foodId)).not.toContain('parmesan');
    expect(fridgeSearchFoodOptions(input())).toEqual(options);
  });
});

import { describe, expect, it } from 'vitest';

import { RECIPE_COVERAGE } from '../constants';
import type { Food } from './food-schema';
import {
  catalogFor,
  FIXTURE_FOODS,
  FIXTURE_RECIPES,
  FOOD_META,
  foodLookup,
  ing,
  makeFood,
  makeRecipe,
  recipeLookup,
} from './nutrition-fixtures';
import {
  checkFood,
  checkFoodAllergens,
  checkFoodAtwater,
  checkFoodFridgeDays,
  checkFoodSource,
  checkRecipe,
  checkRecipeCoverage,
  recipeCoverageReport,
} from './recipe-checks';
import type { Recipe } from './recipe-schema';
import type { ContentRuleId } from './rules';

const foods = foodLookup();
const catalog = catalogFor();
const fixture = (id: string): Recipe => {
  const found = recipeLookup().get(id);
  if (found === undefined) {
    throw new Error(id);
  }
  return found;
};
const rulesOf = (issues: readonly { rule: ContentRuleId }[]) => issues.map((i) => i.rule);

/** Katalog mit einem geänderten bzw. zusätzlichen Lebensmittel (Begleitdaten passend neu abgeleitet). */
function withFood(food: Food): { lookup: Map<string, Food>; ctx: ReturnType<typeof catalogFor> } {
  const list = [...FIXTURE_FOODS.filter((f) => f.id !== food.id), food];
  return { lookup: foodLookup(list), ctx: catalogFor(list) };
}

describe('Gültige Fixtures: keine Befunde', () => {
  it('jedes Fixture-Lebensmittel', () => {
    for (const food of FIXTURE_FOODS) {
      expect(checkFood(food, foods, catalog), food.id).toEqual([]);
    }
  });
  it('jedes Fixture-Rezept', () => {
    for (const recipe of FIXTURE_RECIPES) {
      expect(checkRecipe(recipe, foods), recipe.id).toEqual([]);
    }
  });
});

describe('R1: Pflichtangabe heated (R2-S2)', () => {
  it('Fleisch/Ei/Fisch ohne heated → R1 (blockiert immer)', () => {
    const recipe = makeRecipe({
      ingredients: [ing('haehnchenbrust', 150, 'g'), ing('reis', 75, 'g')],
      declared_pregnancy_caution: true,
    });
    const issues = checkRecipe(recipe, foods).filter((i) => i.rule === 'R1');
    expect(issues).toMatchObject([{ path: 'ingredients.0.heated' }]);
  });
  it('Gemüse/Milch brauchen kein heated', () => {
    const issues = checkRecipe(fixture('porridge-banane'), foods);
    expect(rulesOf(issues)).not.toContain('R1');
  });
});

describe('R2: Lebensmittel existiert, Einheit umrechenbar', () => {
  it('unbekanntes Lebensmittel und nicht umrechenbare Einheit', () => {
    const recipe = makeRecipe({
      ingredients: [ing('haferflocken', 50, 'g'), ing('quinoa', 50, 'g'), ing('banane', 2, 'tbsp')],
    });
    const issues = checkRecipe(recipe, foods).filter((i) => i.rule === 'R2');
    expect(issues.map((i) => i.path)).toEqual(['ingredients.1.food_id', 'ingredients.2.unit']);
  });
  it('Ersatzprodukt existiert nicht → R2 am Lebensmittel', () => {
    const food = makeFood({ substitutes: [{ food_id: 'gibt-es-nicht', for_groups: ['gluten'] }] });
    const { lookup, ctx } = withFood(food);
    expect(rulesOf(checkFood(food, lookup, ctx))).toEqual(['R2']);
  });
});

describe('R3: Makro-Plausibilität', () => {
  const porridge = fixture('porridge-banane');
  it('kcal 11 % daneben → rot; 9 % → in Ordnung', () => {
    const computed = 519.68;
    const off11 = makeRecipe({
      declared_per_serving: { ...porridge.declared_per_serving, kcal: Math.round(computed * 1.11) },
    });
    const off9 = makeRecipe({
      declared_per_serving: { ...porridge.declared_per_serving, kcal: Math.round(computed * 1.09) },
    });
    expect(rulesOf(checkRecipe(off11, foods))).toContain('R3');
    expect(rulesOf(checkRecipe(off9, foods))).not.toContain('R3');
  });
  it('Makros: ±15 %, mindestens ±3 g', () => {
    const fat = makeRecipe({
      declared_per_serving: { ...porridge.declared_per_serving, fat_g: 20 },
    });
    expect(checkRecipe(fat, foods).filter((i) => i.rule === 'R3')).toMatchObject([
      { path: 'declared_per_serving.fat_g' },
    ]);
    // Omelett: 1,9 g Kohlenhydrate berechnet → 4,8 g deklariert liegt in ±3 g.
    const carbs = { ...fixture('omelett-champignons') };
    carbs.declared_per_serving = { ...carbs.declared_per_serving, carbs_g: 4.8 };
    expect(rulesOf(checkRecipe(carbs, foods))).not.toContain('R3');
  });
  it('ohne vollständige Nährwerte kein R3 (dafür R2)', () => {
    const recipe = makeRecipe({ ingredients: [ing('gibt-es-nicht', 50, 'g')] });
    expect(rulesOf(checkRecipe(recipe, foods))).not.toContain('R3');
  });
});

describe('R4: Atwater je Lebensmittel', () => {
  it('passend → keine Befunde; 16 % daneben → rot', () => {
    expect(checkFoodAtwater(makeFood())).toEqual([]);
    const base = makeFood().nutrients_per_100g;
    expect(
      rulesOf(checkFoodAtwater(makeFood({ nutrients_per_100g: { ...base, kcal: 440 } }))),
    ).toEqual(['R4']);
  });
  it('sehr energiearm: ±4 kcal absolut als Untergrenze der Toleranz', () => {
    const cucumber = makeFood({
      nutrients_per_100g: {
        kcal: 12,
        protein_g: 0.6,
        carbs_g: 1.8,
        sugar_g: 1.6,
        fat_g: 0.2,
        sat_fat_g: 0,
        fiber_g: 0.5,
        salt_g: 0,
      },
    });
    expect(checkFoodAtwater(cucumber)).toEqual([]);
  });
});

describe('R5 (gelb): kcal je Portion passend zur Mahlzeit', () => {
  it('Snack mit 30 kcal → Hinweis; mehrere Mahlzeiten: eine Spanne reicht', () => {
    const snack = makeRecipe({
      meal_types: ['snack'],
      ingredients: [ing('banane', 0.25, 'piece')],
      declared_per_serving: { kcal: 28, protein_g: 0.4, carbs_g: 6, fat_g: 0.1 },
      declared_allergens: [],
      declared_diet: 'vegan',
    });
    const r5 = checkRecipe(snack, foods).filter((i) => i.rule === 'R5');
    expect(r5).toHaveLength(1);
    expect(r5[0]?.severity).toBe('warning');
    expect(rulesOf(checkRecipe(fixture('brot-raeucherlachs'), foods))).not.toContain('R5');
  });
});

describe('R6–R8: Ernährungsform, Allergene, Schwein (inkl. optionaler Zutaten)', () => {
  it('vegan mit Honig → R6', () => {
    const recipe = makeRecipe({ declared_diet: 'vegan' });
    expect(rulesOf(checkRecipe(recipe, foods))).toContain('R6');
  });
  it('vegetarisch mit optionalem Parmesan (tierisches Lab) → R6', () => {
    const recipe = { ...fixture('spaghetti-tomatensauce'), declared_diet: 'vegetarian' as const };
    expect(rulesOf(checkRecipe(recipe, foods))).toContain('R6');
  });
  it('fehlendes Allergen der optionalen Erdnüsse → R7', () => {
    const recipe = makeRecipe({ declared_allergens: ['gluten', 'dairy', 'lactose', 'fructose'] });
    const r7 = checkRecipe(recipe, foods).filter((i) => i.rule === 'R7');
    expect(r7).toHaveLength(1);
    expect(r7[0]?.message).toMatch(/peanuts/);
  });
  it('zusätzliche deklarierte Gruppen sind erlaubt', () => {
    const recipe = makeRecipe({
      declared_allergens: ['gluten', 'dairy', 'lactose', 'peanuts', 'fructose', 'tree_nuts'],
    });
    expect(rulesOf(checkRecipe(recipe, foods))).not.toContain('R7');
  });
  it('Gelatine ohne Herkunft → contains_pork true nötig (R8)', () => {
    const recipe = makeRecipe({
      ingredients: [
        ing('zucker', 20, 'g'),
        ing('gelatine', 2, 'piece'),
        ing('mascarpone', 100, 'g'),
      ],
      declared_per_serving: { kcal: 521, protein_g: 7.5, carbs_g: 23.6, fat_g: 44 },
      declared_diet: 'omnivore',
      declared_allergens: ['dairy', 'lactose'],
      meal_types: ['snack', 'main'],
    });
    expect(rulesOf(checkRecipe(recipe, foods))).toEqual(['R8']);
    expect(checkRecipe({ ...recipe, contains_pork: true }, foods)).toEqual([]);
  });
  it('contains_pork true ohne Schwein → R8', () => {
    expect(rulesOf(checkRecipe(makeRecipe({ contains_pork: true }), foods))).toEqual(['R8']);
  });
});

describe('R9: Meal-Prep-Haltbarkeit (S12)', () => {
  const chicken = fixture('haehnchen-reis');
  it('länger als die kürzeste Zutat und nicht einfrierbar → rot', () => {
    const recipe = { ...chicken, meal_prep: { suitable: true, fridge_days: 2, freezable: false } };
    expect(rulesOf(checkRecipe(recipe, foods))).toEqual(['R9']);
  });
  it('auch mit freezable nie länger als die kürzeste Zutat im Kühlschrank (Wächter N2a, S4)', () => {
    expect(
      rulesOf(
        checkRecipe(
          { ...chicken, meal_prep: { suitable: true, fridge_days: 2, freezable: true } },
          foods,
        ),
      ),
    ).toEqual(['R9']);
    expect(
      checkRecipe(
        { ...chicken, meal_prep: { suitable: true, fridge_days: 1, freezable: true } },
        foods,
      ),
    ).toEqual([]);
  });
  it('nicht für Meal-Prep geeignet → keine Prüfung', () => {
    expect(
      checkRecipe(
        { ...chicken, meal_prep: { suitable: false, fridge_days: 0, freezable: false } },
        foods,
      ),
    ).toEqual([]);
  });
  it('je Lebensmittel: Reis, Fisch, Hackfleisch, Geflügel höchstens 1 Tag (W15)', () => {
    for (const id of ['reis', 'lachs', 'hackfleisch-gemischt', 'haehnchenbrust']) {
      const food = foods.get(id);
      expect(food, id).toBeDefined();
      expect(checkFoodFridgeDays({ ...(food as Food), max_fridge_days: 2 }), id).toMatchObject([
        { rule: 'R9' },
      ]);
      expect(checkFoodFridgeDays(food as Food), id).toEqual([]);
    }
    expect(checkFoodFridgeDays(makeFood({ max_fridge_days: 3 }))).toEqual([]);
  });
});

describe('R10: Textregeln, Health Claims, Marken', () => {
  it('Health Claim im Titel, Marke in einem Schritt, Heilversprechen in der Notiz', () => {
    const recipe = makeRecipe({
      title_de: 'Detox-Porridge',
      steps_de: ['Mit Nutella servieren.'],
      ingredients: [
        ing('haferflocken', 60, 'g', { note_de: 'stärkt das Immunsystem' }),
        ing('vollmilch', 250, 'ml'),
        ing('banane', 1, 'piece'),
        ing('honig', 1, 'tsp'),
        ing('erdnuesse', 15, 'g', { optional: true }),
      ],
    });
    const r10 = checkRecipe(recipe, foods).filter((i) => i.rule === 'R10');
    // „stärkt das Immunsystem“ trifft zwei Regeln (Immunsystem, „stärkt …“, Wächter N5c S3) – je Stelle zählt der Fund.
    expect([...new Set(r10.map((i) => i.path))]).toEqual([
      'title_de',
      'steps_de.0',
      'ingredients.0.note_de',
    ]);
  });
  it('Tipp, Schlagworte und Mengen-Anzeige werden mitgeprüft', () => {
    const recipe = makeRecipe({
      tip_de: 'Superfood zum Mitnehmen.',
      tags_de: ['Unter 10 Minuten', 'Detox'],
      ingredients: [
        ing('haferflocken', 60, 'g', { display_de: '60 g Kellogg Flocken' }),
        ...makeRecipe().ingredients.slice(1),
      ],
    });
    const r10 = checkRecipe(recipe, foods).filter((i) => i.rule === 'R10');
    expect(r10.map((i) => i.path)).toEqual(['ingredients.0.display_de', 'tip_de', 'tags_de.1']);
  });
  it('Marke im Lebensmittel-Namen → R10', () => {
    const food = makeFood({ id: 'nuss-nougat', name_de: 'Philadelphia', groups: [] });
    const { lookup, ctx } = withFood(food);
    expect(rulesOf(checkFood(food, lookup, ctx))).toContain('R10');
  });
});

describe('R11 (gelb): Mengen je Portion', () => {
  it('Salz > 2,5 g, Öl > 30 g, Zutat > 600 g', () => {
    const recipe = makeRecipe({
      meal_types: ['main'],
      ingredients: [
        ing('tomaten-passiert', 700, 'ml'),
        ing('olivenoel', 4, 'tbsp'),
        ing('salz', 1, 'tsp'),
      ],
      declared_per_serving: { kcal: 375, protein_g: 10.3, carbs_g: 33, fat_g: 41.5 },
      declared_diet: 'vegan',
      declared_allergens: [],
    });
    const r11 = checkRecipe(recipe, foods).filter((i) => i.rule === 'R11');
    expect(r11).toHaveLength(3);
    expect(r11.every((i) => i.severity === 'warning')).toBe(true);
  });
});

describe('R12: kein Alkohol', () => {
  it('Wein (auch optional) → rot', () => {
    const wine = makeFood({
      id: 'rotwein',
      name_de: 'Rotwein',
      groups: ['sulphites'],
      alcohol: true,
      nutrients_per_100g: {
        kcal: 68,
        protein_g: 0.1,
        carbs_g: 2.6,
        sugar_g: 0.6,
        fat_g: 0,
        sat_fat_g: 0,
        fiber_g: 0,
        salt_g: 0,
      },
      source: { ...makeFood().source, name: 'Rotwein', category: 'alcoholic_beverages' },
    });
    const { lookup } = withFood(wine);
    const recipe = makeRecipe({
      ingredients: [
        ...fixture('porridge-banane').ingredients,
        ing('rotwein', 50, 'ml', { optional: true }),
      ],
      declared_allergens: ['gluten', 'dairy', 'lactose', 'peanuts', 'fructose', 'sulphites'],
    });
    // 50 ml Wein ohne Umrechnung → zusätzlich R2; entscheidend ist R12.
    expect(rulesOf(checkRecipe(recipe, lookup))).toContain('R12');
  });
});

describe('R13: Schwangerschafts-Vorsicht (W20)', () => {
  it('rohes Ei, aber nicht deklariert → rot', () => {
    const recipe = { ...fixture('mascarponecreme-roh'), declared_pregnancy_caution: false };
    const r13 = checkRecipe(recipe, foods).filter((i) => i.rule === 'R13');
    expect(r13).toHaveLength(1);
    expect(r13[0]?.message).toMatch(/huehnerei/);
  });
  it('no_cook mit Räucherlachs, nicht deklariert → rot', () => {
    const recipe = { ...fixture('brot-raeucherlachs'), declared_pregnancy_caution: false };
    expect(rulesOf(checkRecipe(recipe, foods))).toEqual(['R13']);
  });
  it('gebratenes Ei als heikel deklariert → rot (Abweichung in beide Richtungen)', () => {
    const recipe = { ...fixture('omelett-champignons'), declared_pregnancy_caution: true };
    expect(rulesOf(checkRecipe(recipe, foods))).toEqual(['R13']);
  });
  it('Lebensmittel Rohmilchkäse/Salami/Leber ohne Flag → R18 rot', () => {
    for (const [id, name, category] of [
      ['rohmilchkaese', 'Rohmilchkäse', 'dairy'],
      ['salami-test', 'Salami', 'sausage_meat_products'],
      ['kalbsleber', 'Kalbsleber', 'offal'],
    ] as const) {
      const food = makeFood({
        id,
        name_de: name,
        groups: category === 'dairy' ? ['dairy', 'lactose'] : ['beef'],
        animal: category === 'dairy' ? ['dairy'] : ['meat'],
        meat_kind: category === 'dairy' ? [] : ['pork', 'beef'],
        pregnancy_caution: false,
        max_fridge_days: 1,
        source: { ...makeFood().source, name, category },
      });
      const { lookup, ctx } = withFood(food);
      const r18 = checkFood(food, lookup, ctx).filter((i) => i.rule === 'R18');
      expect(r18.map((i) => i.message).join(), name).toMatch(/pregnancy_caution/);
      expect(
        checkFood({ ...food, pregnancy_caution: true }, lookup, ctx).filter(
          (i) => i.rule === 'R18',
        ),
        name,
      ).toEqual([]);
    }
  });
});

describe('R14: ohne Kochen', () => {
  const salmon = fixture('brot-raeucherlachs');
  it('Kochzeit > 0 oder Herd/Ofen → rot', () => {
    expect(rulesOf(checkRecipe({ ...salmon, cook_minutes: 5 }, foods))).toEqual(['R14']);
    expect(rulesOf(checkRecipe({ ...salmon, equipment_de: ['Backofen'] }, foods))).toEqual(['R14']);
    expect(rulesOf(checkRecipe({ ...salmon, equipment_de: ['Pfanne'] }, foods))).toEqual(['R14']);
  });
  it('Schüssel, Messer, Schneebesen sind erlaubt', () => {
    expect(
      checkRecipe({ ...salmon, equipment_de: ['Schüssel', 'Messer', 'Schneebesen'] }, foods),
    ).toEqual([]);
  });
});

describe('R16 (gelb): Abdeckungsbericht', () => {
  it('Zählung je Mahlzeit × Ernährungsform × Unverträglichkeit, optionale Zutaten weglassbar', () => {
    const rows = recipeCoverageReport(FIXTURE_RECIPES, foods);
    expect(rows).toHaveLength(3 * 3 * (1 + RECIPE_COVERAGE.intolerances.length));
    const find = (mealType: string, diet: string, intolerance: string | null) =>
      rows.find((r) => r.mealType === mealType && r.diet === diet && r.intolerance === intolerance)
        ?.count;
    // Hauptgerichte: Spaghetti (Parmesan optional → vegan), Omelett, Hähnchen, Tofu.
    expect(find('main', 'omnivore', null)).toBe(4);
    expect(find('main', 'vegan', null)).toBe(2);
    expect(find('main', 'omnivore', 'gluten')).toBe(3);
    expect(find('breakfast', 'omnivore', 'peanuts')).toBe(3);
  });
  it('unter 7 → gelber Hinweis; ohne Rezepte kein Bericht; archivierte zählen nicht', () => {
    const issues = checkRecipeCoverage(FIXTURE_RECIPES, foods);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.rule === 'R16' && i.severity === 'warning')).toBe(true);
    expect(issues[0]?.kind).toBe('recipe_library');
    expect(checkRecipeCoverage([], foods)).toEqual([]);
    const many = Array.from({ length: 7 }, (_, i) =>
      makeRecipe({ id: `porridge-${i + 1}`, meal_types: ['breakfast', 'main', 'snack'] }),
    );
    const covered = recipeCoverageReport(many, foods).filter(
      (r) => r.diet !== 'vegan' && r.intolerance !== 'gluten' && r.intolerance !== 'dairy',
    );
    expect(covered.filter((r) => r.intolerance !== 'lactose').every((r) => r.count === 7)).toBe(
      true,
    );
    const archived = many.map((r) => ({ ...r, status: 'archived' as const }));
    expect(recipeCoverageReport(archived, foods).every((r) => r.count === 0)).toBe(true);
  });
});

describe('R17: Nährwerte = Quellauszug', () => {
  const food = foods.get('haferflocken') as Food;
  it('passend → keine Befunde', () => {
    expect(checkFoodSource(food, catalog)).toEqual([]);
  });
  it('Quellauszug nicht geladen → rot', () => {
    expect(rulesOf(checkFoodSource(food, {}))).toEqual(['R17']);
  });
  it('Quell-ID fehlt im Auszug → rot', () => {
    expect(
      checkFoodSource({ ...food, source: { ...food.source, ref: 'X999' } }, catalog),
    ).toMatchObject([{ rule: 'R17', path: 'source.ref' }]);
  });
  it('Nährwert ≠ Quelle (auch kleine Abweichung) → rot je Feld', () => {
    const changed = {
      ...food,
      nutrients_per_100g: { ...food.nutrients_per_100g, protein_g: 13.6, salt_g: 0.02 },
    };
    expect(checkFoodSource(changed, catalog).map((i) => i.path)).toEqual([
      'nutrients_per_100g.protein_g',
      'nutrients_per_100g.salt_g',
    ]);
  });
  it('Bezeichnung der Quelle weicht ab → rot', () => {
    expect(
      checkFoodSource({ ...food, source: { ...food.source, name: 'Hafer, Flocken' } }, catalog),
    ).toMatchObject([{ rule: 'R17', path: 'source.name' }]);
  });
});

describe('R18: Pflichtregeln, Erwartungsliste, Ersatzprodukte', () => {
  it('Haferflocken ohne gluten → rot (W9, Testfall 12.1)', () => {
    const food = makeFood({ groups: [] });
    const { lookup, ctx } = withFood(food);
    const r18 = checkFoodAllergens(food, lookup, { ...ctx, expectations: { haferflocken: [] } });
    expect(r18).toHaveLength(1);
    expect(r18[0]?.message).toMatch(/gluten/);
  });
  it('Nudeln ohne gluten → rot (Testfall 12.1)', () => {
    const food = makeFood({ id: 'nudeln', name_de: 'Nudeln', groups: [] });
    const { lookup, ctx } = withFood(food);
    expect(
      checkFoodAllergens(food, lookup, { ...ctx, expectations: { nudeln: [] } })[0]?.message,
    ).toMatch(/gluten/);
  });
  it('Ausnahmeliste hebt eine Pflichtregel auf (mit Begründung und Quelle)', () => {
    const food = makeFood({
      id: 'haferflocken-glutenfrei',
      name_de: 'Haferflocken glutenfrei',
      groups: [],
    });
    const { lookup, ctx } = withFood(food);
    const exceptions = [
      {
        food_id: food.id,
        rule: 'gluten' as const,
        reason: 'Zertifiziert glutenfrei (< 20 mg/kg Gluten).',
        source: 'Herstellerangabe',
      },
    ];
    expect(checkFoodAllergens(food, lookup, { ...ctx, exceptions })).toEqual([]);
  });
  it('Erwartungsliste: nicht geladen, Lebensmittel fehlt, Gruppe fehlt → rot; zusätzliche Gruppen erlaubt', () => {
    const food = foods.get('vollmilch') as Food;
    expect(
      checkFoodAllergens(food, foods, { ...catalog, expectations: undefined })[0]?.message,
    ).toMatch(/nicht geladen/);
    expect(checkFoodAllergens(food, foods, { ...catalog, expectations: {} })[0]?.message).toMatch(
      /fehlt in der Erwartungsliste/,
    );
    expect(
      checkFoodAllergens(food, foods, {
        ...catalog,
        expectations: { ...catalog.expectations, vollmilch: ['dairy', 'lactose', 'histamine'] },
      })[0]?.message,
    ).toMatch(/histamine/);
    expect(
      checkFoodAllergens({ ...food, groups: ['dairy', 'lactose', 'histamine'] }, foods, catalog),
    ).toEqual([]);
  });
  it('laktosefreie Milch als Ersatz „für dairy“ → rot (S4); Haferdrink „für gluten“ → rot', () => {
    const milk = foods.get('vollmilch') as Food;
    const wrong = {
      ...milk,
      groups: [...milk.groups, 'gluten' as const],
      substitutes: [
        { food_id: 'milch-laktosefrei', for_groups: ['dairy' as const, 'lactose' as const] },
        { food_id: 'haferdrink', for_groups: ['gluten' as const] },
      ],
    };
    const r18 = checkFoodAllergens(wrong, foods, {
      ...catalog,
      expectations: { ...catalog.expectations, vollmilch: [] },
    });
    expect(r18.map((i) => i.path)).toEqual([
      'substitutes.0.for_groups',
      'substitutes.1.for_groups',
    ]);
  });
  it('for_groups nennt eine Gruppe, die das Original nicht hat → rot', () => {
    const milk = foods.get('vollmilch') as Food;
    const wrong = {
      ...milk,
      substitutes: [{ food_id: 'milch-laktosefrei', for_groups: ['eggs' as const] }],
    };
    expect(checkFoodAllergens(wrong, foods, catalog)[0]?.message).toMatch(/gar nicht enthält/);
  });
  it('Hackfleisch ohne Angabe: meat_kind nur beef → rot (mixed_mince)', () => {
    const mince = foods.get('hackfleisch-gemischt') as Food;
    const wrong = { ...mince, meat_kind: ['beef' as const] };
    const messages = checkFoodAllergens(wrong, foods, catalog)
      .map((i) => i.message)
      .join();
    expect(messages).toMatch(/Hackfleisch ohne Tierart/);
    expect(messages).toMatch(/Schwein/);
  });
  it('Eierschwammerl ohne eggs, aber mit mushrooms → in Ordnung; ohne mushrooms → rot', () => {
    const food = makeFood({
      id: 'eierschwammerl',
      name_de: 'Eierschwammerl',
      groups: ['mushrooms'],
      source: { ...makeFood().source, name: 'Pfifferling', category: 'mushrooms' },
    });
    const { lookup, ctx } = withFood(food);
    expect(checkFoodAllergens(food, lookup, ctx)).toEqual([]);
    expect(
      rulesOf(
        checkFoodAllergens({ ...food, groups: [] }, lookup, {
          ...ctx,
          expectations: { ...ctx.expectations, eierschwammerl: [] },
        }),
      ),
    ).toEqual(['R18']);
  });
  it('Leberkäse ohne dairy ist richtig, aber Schwein ist Pflicht', () => {
    const food = makeFood({
      id: 'leberkaese',
      name_de: 'Leberkäse',
      groups: [],
      animal: ['meat'],
      meat_kind: ['pork', 'beef'],
      pregnancy_caution: true,
      source: { ...makeFood().source, name: 'Leberkäse', category: 'sausage_meat_products' },
    });
    const withBeef = { ...food, groups: ['beef' as const] };
    const { lookup, ctx } = withFood(withBeef);
    expect(checkFoodAllergens(withBeef, lookup, ctx)).toEqual([]);
    const noPork = { ...withBeef, meat_kind: ['beef' as const] };
    expect(checkFoodAllergens(noPork, lookup, ctx)[0]?.message).toMatch(/Schwein/);
  });
});

describe('R19: Katalog-Prüfung', () => {
  const unreviewed = (food: Food): Food => ({
    ...food,
    meta: { ...FOOD_META, catalog_reviewed_by: null, catalog_reviewed_at: null },
  });
  it('Rezept mit nicht geprüftem Lebensmittel → rot', () => {
    const lookup = new Map(foods);
    lookup.set('banane', unreviewed(foods.get('banane') as Food));
    const r19 = checkRecipe(fixture('porridge-banane'), lookup).filter((i) => i.rule === 'R19');
    expect(r19).toMatchObject([{ path: 'ingredients.2.food_id' }]);
  });
  it('freigegebenes Lebensmittel ohne Katalog-Prüfung → rot', () => {
    const food = unreviewed(foods.get('haferflocken') as Food);
    const published: Food = {
      ...food,
      status: 'published',
      meta: { ...food.meta, reviewed_by: 'KT', reviewed_at: '2026-10-11' },
    };
    expect(rulesOf(checkFood(published, foods, catalog))).toEqual(['R19']);
  });
  it('freigegebenes Rezept mit Entwurf-Lebensmittel → rot', () => {
    const recipe: Recipe = {
      ...fixture('tofu-paprika'),
      status: 'published',
      meta: { ...fixture('tofu-paprika').meta, reviewed_by: 'KT', reviewed_at: '2026-10-11' },
    };
    expect(rulesOf(checkRecipe(recipe, foods)).filter((r) => r === 'R19')).toHaveLength(4);
  });
});

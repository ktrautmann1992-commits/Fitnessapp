/**
 * Test-Fixtures für Lebensmittel und Rezepte (docs/PLAN-PHASE-5.md 13, Etappe N2a; nur in *.test.ts und für N3
 * benutzt). Ein kleiner, in sich stimmiger Katalog und Rezepte, die ALLE Regeln R1–R19 erfüllen – jeder Test
 * verändert genau eine Stelle (absichtlich fehlerhafte Varianten entstehen in den Tests per `makeFood`/
 * `makeRecipe`).
 *
 * ACHTUNG: Die Nährwerte sind gerundete TESTWERTE, keine Quelldaten. Echte Nährwerte kommen ausschließlich
 * maschinell aus der Quelldatenbank (N2b, R17). Der Quellauszug hier (`FIXTURE_SOURCE_ROWS`) wird aus den
 * Fixtures abgeleitet, damit R17 im Test grün ist.
 */
import type { FoodGroupId } from '../food-groups';
import type {
  AllergenExpectations,
  Food,
  FoodMeta,
  SourceFoodCategory,
  SourceNutrientRow,
} from './food-schema';
import { sourceRowKey } from './food-schema';
import type { NutritionCatalogContext } from './recipe-checks';
import type { Recipe, RecipeIngredient } from './recipe-schema';
import type { ContentMeta } from './schemas';

export const FOOD_META: FoodMeta = {
  origin: 'claude_session',
  model: 'claude-opus-5-5',
  batch_id: null,
  created_on: '2026-10-11',
  expert_reviewed: false,
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  catalog_reviewed_by: 'KT',
  catalog_reviewed_at: '2026-10-11',
};

export const RECIPE_META: ContentMeta = {
  origin: 'claude_session',
  model: 'claude-opus-5-5',
  batch_id: null,
  created_on: '2026-10-11',
  expert_reviewed: false,
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
};

type Nutrients = Food['nutrients_per_100g'];

/** [kcal, Eiweiß, Kohlenhydrate, Zucker, Fett, gesättigte Fettsäuren, Ballaststoffe, Salz] je 100 g. */
function n(values: [number, number, number, number, number, number, number, number]): Nutrients {
  const [kcal, protein_g, carbs_g, sugar_g, fat_g, sat_fat_g, fiber_g, salt_g] = values;
  return { kcal, protein_g, carbs_g, sugar_g, fat_g, sat_fat_g, fiber_g, salt_g };
}

let refCounter = 0;

/** Ein gültiges Lebensmittel (Haferflocken), Felder per `overrides` änderbar. */
export function makeFood(overrides: Partial<Food> = {}): Food {
  refCounter += 1;
  const base: Food = {
    id: 'haferflocken',
    version: 1,
    status: 'draft',
    name_de: 'Haferflocken',
    aliases_de: [],
    shopping_category: 'cereal_breakfast',
    pantry: true,
    nutrients_per_100g: n([370, 13.5, 58.7, 0.7, 7, 1.2, 10, 0.01]),
    units: { tbsp_g: 10 },
    groups: ['gluten'],
    animal: [],
    meat_kind: [],
    pregnancy_caution: false,
    alcohol: false,
    max_fridge_days: 3,
    freezable: true,
    substitutes: [],
    source: {
      db: 'bls',
      version: 'test',
      ref: `T${String(refCounter).padStart(5, '0')}`,
      name: overrides.name_de ?? 'Haferflocken',
      category: 'cereal_products',
      license: 'Testdaten (keine Quelldaten)',
      retrieved_at: '2026-10-11',
    },
    meta: { ...FOOD_META },
  };
  return { ...base, ...overrides };
}

interface FoodSpec {
  readonly id: string;
  readonly name: string;
  readonly sourceName?: string;
  readonly aliases?: string[];
  readonly category: SourceFoodCategory;
  readonly shopping: Food['shopping_category'];
  readonly nutrients: Nutrients;
  readonly units?: Food['units'];
  readonly groups?: FoodGroupId[];
  readonly extra?: Partial<Food>;
}

function food(spec: FoodSpec, ref: string): Food {
  return makeFood({
    id: spec.id,
    name_de: spec.name,
    aliases_de: spec.aliases ?? [],
    shopping_category: spec.shopping,
    pantry: false,
    nutrients_per_100g: spec.nutrients,
    units: spec.units ?? {},
    groups: spec.groups ?? [],
    source: {
      db: 'bls',
      version: 'test',
      ref,
      name: spec.sourceName ?? spec.name,
      category: spec.category,
      license: 'Testdaten (keine Quelldaten)',
      retrieved_at: '2026-10-11',
    },
    ...spec.extra,
  });
}

const SPECS: FoodSpec[] = [
  {
    id: 'haferflocken',
    name: 'Haferflocken',
    category: 'cereal_products',
    shopping: 'cereal_breakfast',
    nutrients: n([370, 13.5, 58.7, 0.7, 7, 1.2, 10, 0.01]),
    units: { tbsp_g: 10 },
    groups: ['gluten'],
    extra: { pantry: true },
  },
  {
    id: 'vollmilch',
    name: 'Vollmilch 3,5 %',
    category: 'dairy',
    shopping: 'chilled_dairy_eggs',
    nutrients: n([64, 3.3, 4.8, 4.8, 3.5, 2.2, 0, 0.1]),
    units: { ml_to_g: 1.03, tbsp_g: 15 },
    groups: ['dairy', 'lactose'],
    extra: {
      animal: ['dairy'],
      max_fridge_days: 2,
      freezable: false,
      substitutes: [
        { food_id: 'milch-laktosefrei', for_groups: ['lactose'] },
        { food_id: 'haferdrink', for_groups: ['dairy', 'lactose'] },
      ],
    },
  },
  {
    id: 'milch-laktosefrei',
    name: 'Laktosefreie Milch 1,5 %',
    sourceName: 'Milch laktosefrei 1,5 % Fett',
    category: 'dairy',
    shopping: 'chilled_dairy_eggs',
    nutrients: n([47, 3.4, 4.9, 4.9, 1.5, 1, 0, 0.1]),
    units: { ml_to_g: 1.03 },
    groups: ['dairy'],
    extra: { animal: ['dairy'], max_fridge_days: 2, freezable: false },
  },
  {
    id: 'haferdrink',
    name: 'Haferdrink',
    category: 'beverages',
    shopping: 'drinks',
    nutrients: n([45, 0.5, 7, 4, 1.5, 0.2, 0.8, 0.1]),
    units: { ml_to_g: 1.03 },
    groups: ['gluten'],
    extra: { max_fridge_days: 2, freezable: false },
  },
  {
    id: 'huehnerei',
    name: 'Ei',
    aliases: ['Hühnerei'],
    category: 'eggs',
    shopping: 'chilled_dairy_eggs',
    nutrients: n([137, 12.5, 0.7, 0.7, 9.3, 2.7, 0, 0.35]),
    units: { piece_g: 60 },
    groups: ['eggs'],
    extra: { animal: ['egg'], max_fridge_days: 2, freezable: false },
  },
  {
    id: 'weizenmehl',
    name: 'Weizenmehl Type 405',
    category: 'cereal_products',
    shopping: 'spices_baking',
    nutrients: n([348, 10, 71, 0.4, 1, 0.2, 4, 0]),
    units: { tbsp_g: 10 },
    groups: ['gluten'],
  },
  {
    id: 'spaghetti',
    name: 'Spaghetti',
    aliases: ['Nudeln'],
    sourceName: 'Teigwaren aus Hartweizengrieß trocken',
    category: 'cereal_products',
    shopping: 'pasta_rice_grains',
    nutrients: n([359, 12.5, 70.9, 3, 1.5, 0.3, 3, 0.01]),
    groups: ['gluten'],
  },
  {
    id: 'kokosmilch',
    name: 'Kokosmilch',
    category: 'other',
    shopping: 'legumes_canned',
    nutrients: n([180, 1.9, 3, 2, 18, 16, 0.5, 0.05]),
    units: { ml_to_g: 1 },
    extra: { max_fridge_days: 2 },
  },
  {
    id: 'erdnuesse',
    name: 'Erdnüsse',
    category: 'nuts_seeds',
    shopping: 'nuts_seeds_dried_fruit',
    nutrients: n([585, 25, 12, 4, 49, 7, 9, 0.01]),
    units: { tbsp_g: 10 },
    groups: ['peanuts'],
  },
  {
    id: 'lachs',
    name: 'Lachs',
    aliases: ['Lachsfilet'],
    category: 'fish',
    shopping: 'fish',
    nutrients: n([202, 20, 0, 0, 13.6, 3, 0, 0.1]),
    groups: ['fish'],
    extra: { animal: ['fish'], max_fridge_days: 1 },
  },
  {
    id: 'raeucherlachs',
    name: 'Räucherlachs',
    category: 'fish',
    shopping: 'fish',
    nutrients: n([183, 22, 0, 0, 10.5, 2, 0, 3]),
    groups: ['fish'],
    extra: { animal: ['fish'], pregnancy_caution: true, max_fridge_days: 1, freezable: false },
  },
  {
    id: 'parmesan',
    name: 'Parmesan',
    category: 'dairy',
    shopping: 'chilled_dairy_eggs',
    nutrients: n([392, 35.6, 0, 0, 28, 18, 0, 1.6]),
    groups: ['dairy', 'lactose'],
    extra: { animal: ['dairy', 'animal_rennet'] },
  },
  {
    id: 'gelatine',
    name: 'Gelatine',
    category: 'other',
    shopping: 'spices_baking',
    nutrients: n([338, 84, 0, 0, 0.1, 0, 0, 0.5]),
    units: { piece_g: 1.7 },
    extra: { animal: ['gelatin'], freezable: false },
  },
  {
    id: 'honig',
    name: 'Honig',
    category: 'sugar_sweets',
    shopping: 'cereal_breakfast',
    nutrients: n([304, 0.4, 75, 75, 0, 0, 0, 0.01]),
    units: { tsp_g: 7, tbsp_g: 20 },
    groups: ['fructose'],
    extra: { animal: ['honey'], pantry: true },
  },
  {
    id: 'banane',
    name: 'Banane',
    category: 'fruit',
    shopping: 'fruit_vegetables',
    nutrients: n([93, 1.2, 20, 17, 0.2, 0.1, 2, 0]),
    units: { piece_g: 120 },
    extra: { max_fridge_days: 1 },
  },
  {
    id: 'tomaten-passiert',
    name: 'Tomaten passiert',
    category: 'vegetables',
    shopping: 'legumes_canned',
    nutrients: n([30, 1.4, 4.5, 4, 0.2, 0, 1, 0.05]),
    units: { ml_to_g: 1.05 },
  },
  {
    id: 'reis',
    name: 'Reis parboiled',
    category: 'cereal_products',
    shopping: 'pasta_rice_grains',
    nutrients: n([350, 7.5, 78, 0.2, 0.6, 0.2, 1.5, 0]),
    extra: { max_fridge_days: 1, pantry: true },
  },
  {
    id: 'olivenoel',
    name: 'Olivenöl',
    category: 'fats_oils',
    shopping: 'oils_vinegar_sauces',
    nutrients: n([884, 0, 0, 0, 100, 14, 0, 0]),
    units: { tbsp_g: 10, tsp_g: 4, ml_to_g: 0.91 },
    extra: { pantry: true },
  },
  {
    id: 'salz',
    name: 'Speisesalz',
    aliases: ['Salz'],
    category: 'spices_sauces',
    shopping: 'spices_baking',
    nutrients: n([0, 0, 0, 0, 0, 0, 0, 100]),
    units: { tsp_g: 6 },
    extra: { pantry: true },
  },
  {
    id: 'champignons',
    name: 'Champignons',
    category: 'mushrooms',
    shopping: 'fruit_vegetables',
    nutrients: n([22, 3.1, 0.6, 0.3, 0.3, 0.1, 2, 0.02]),
    groups: ['mushrooms'],
    extra: { max_fridge_days: 1 },
  },
  {
    id: 'zwiebel',
    name: 'Zwiebel',
    category: 'vegetables',
    shopping: 'fruit_vegetables',
    nutrients: n([40, 1.2, 8, 6, 0.3, 0, 1.8, 0]),
    units: { piece_g: 80 },
    groups: ['onion_garlic'],
  },
  {
    id: 'haehnchenbrust',
    name: 'Hähnchenbrust',
    category: 'meat_poultry',
    shopping: 'meat_sausage',
    nutrients: n([110, 23, 0, 0, 1.5, 0.4, 0, 0.15]),
    groups: ['poultry'],
    extra: { animal: ['meat'], meat_kind: ['poultry'], max_fridge_days: 1 },
  },
  {
    id: 'hackfleisch-gemischt',
    name: 'Hackfleisch',
    aliases: ['Gemischtes Hack'],
    sourceName: 'Hackfleisch gemischt Rind und Schwein',
    category: 'sausage_meat_products',
    shopping: 'meat_sausage',
    nutrients: n([235, 18, 0, 0, 18, 7, 0, 0.15]),
    groups: ['beef'],
    extra: { animal: ['meat'], meat_kind: ['beef', 'pork'], max_fridge_days: 1 },
  },
  {
    id: 'salami',
    name: 'Salami',
    category: 'sausage_meat_products',
    shopping: 'meat_sausage',
    nutrients: n([380, 21, 1, 0.5, 33, 13, 0, 4]),
    groups: ['histamine'],
    extra: { animal: ['meat'], meat_kind: ['pork'], pregnancy_caution: true },
  },
  {
    id: 'kalbsleberwurst',
    name: 'Kalbsleberwurst',
    category: 'sausage_meat_products',
    shopping: 'meat_sausage',
    nutrients: n([300, 14, 1, 0.5, 27, 10, 0, 2]),
    groups: ['beef'],
    extra: { animal: ['meat'], meat_kind: ['beef', 'pork'], pregnancy_caution: true },
  },
  {
    id: 'mascarpone',
    name: 'Mascarpone',
    category: 'dairy',
    shopping: 'chilled_dairy_eggs',
    nutrients: n([435, 4.6, 3.6, 3.6, 44, 30, 0, 0.1]),
    groups: ['dairy', 'lactose'],
    extra: { animal: ['dairy'], max_fridge_days: 2, freezable: false },
  },
  {
    id: 'zucker',
    name: 'Zucker',
    category: 'sugar_sweets',
    shopping: 'spices_baking',
    nutrients: n([400, 0, 100, 100, 0, 0, 0, 0]),
    units: { tbsp_g: 12, tsp_g: 4 },
    extra: { pantry: true },
  },
  {
    id: 'bergkaese-rohmilch',
    name: 'Bergkäse aus Rohmilch',
    category: 'dairy',
    shopping: 'chilled_dairy_eggs',
    nutrients: n([400, 28, 0, 0, 32, 20, 0, 1.5]),
    groups: ['dairy', 'lactose'],
    extra: { animal: ['dairy', 'animal_rennet'], pregnancy_caution: true },
  },
  {
    id: 'tofu',
    name: 'Tofu natur',
    category: 'soy_products',
    shopping: 'chilled_plant_based',
    nutrients: n([121, 13, 1.5, 0.5, 7, 1, 1, 0.01]),
    groups: ['soy', 'legumes'],
    extra: { max_fridge_days: 2 },
  },
  {
    id: 'vollkornbrot',
    name: 'Vollkornbrot',
    category: 'bread_bakery',
    shopping: 'bread_bakery',
    nutrients: n([220, 7, 40, 3, 1.5, 0.3, 7.5, 1.1]),
    units: { piece_g: 50 },
    groups: ['gluten'],
  },
  {
    id: 'paprika',
    name: 'Paprika rot',
    category: 'vegetables',
    shopping: 'fruit_vegetables',
    nutrients: n([37, 1.3, 6.4, 6, 0.5, 0.1, 3.6, 0]),
    units: { piece_g: 150 },
  },
];

/** Der kleine Test-Katalog (alle katalog-geprüft, Entwurf). */
export const FIXTURE_FOODS: readonly Food[] = SPECS.map((spec, index) =>
  food(spec, `F${String(index + 1).padStart(4, '0')}`),
);

export function foodLookup(foods: readonly Food[] = FIXTURE_FOODS): Map<string, Food> {
  return new Map(foods.map((f) => [f.id, f]));
}

/** Quellauszug passend zu den Fixtures (R17 grün). */
export function sourceRowsFor(
  foods: readonly Food[] = FIXTURE_FOODS,
): Map<string, SourceNutrientRow> {
  return new Map(
    foods.map((f) => [
      sourceRowKey(f.source),
      {
        db: f.source.db,
        version: f.source.version,
        ref: f.source.ref,
        name: f.source.name,
        nutrients_per_100g: { ...f.nutrients_per_100g },
      },
    ]),
  );
}

/** Erwartungsliste = Gruppen der Fixtures (bei der Katalog-Prüfung bestätigt). */
export function expectationsFor(foods: readonly Food[] = FIXTURE_FOODS): AllergenExpectations {
  return Object.fromEntries(foods.map((f) => [f.id, [...f.groups]]));
}

/** Vollständige Begleitdaten zum Katalog. */
export function catalogFor(foods: readonly Food[] = FIXTURE_FOODS): NutritionCatalogContext {
  return { sourceRows: sourceRowsFor(foods), expectations: expectationsFor(foods), exceptions: [] };
}

export function ing(
  food_id: string,
  amount: number,
  unit: RecipeIngredient['unit'],
  extra: Partial<RecipeIngredient> = {},
): RecipeIngredient {
  return { food_id, amount, unit, optional: false, scales: true, ...extra };
}

/** Ein gültiges Rezept (Porridge), Felder per `overrides` änderbar. */
export function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'porridge-banane',
    version: 1,
    status: 'draft',
    title_de: 'Porridge mit Banane',
    description_de: 'Haferflocken in Milch gekocht, mit Banane und Honig.',
    meal_types: ['breakfast'],
    training_tags: ['vor_training'],
    servings: 1,
    ingredients: [
      ing('haferflocken', 60, 'g'),
      ing('vollmilch', 250, 'ml'),
      ing('banane', 1, 'piece'),
      ing('honig', 1, 'tsp'),
      ing('erdnuesse', 15, 'g', { optional: true }),
    ],
    steps_de: [
      'Haferflocken mit Milch aufkochen und 3 Minuten quellen lassen.',
      'Banane in Scheiben schneiden und mit Honig darauf geben.',
    ],
    prep_minutes: 3,
    cook_minutes: 5,
    no_cook: false,
    meal_prep: { suitable: false, fridge_days: 0, freezable: false },
    equipment_de: ['Topf'],
    declared_per_serving: { kcal: 520, protein_g: 18, carbs_g: 77, fat_g: 13.5 },
    declared_diet: 'vegetarian',
    declared_allergens: ['gluten', 'dairy', 'lactose', 'peanuts', 'fructose'],
    contains_pork: false,
    declared_pregnancy_caution: false,
    meta: { ...RECIPE_META },
    ...overrides,
  };
}

/** Rezepte, die alle Regeln erfüllen (je eins für typische Fälle). */
export const FIXTURE_RECIPES: readonly Recipe[] = [
  makeRecipe(),
  makeRecipe({
    id: 'spaghetti-tomatensauce',
    title_de: 'Spaghetti mit Tomatensauce',
    description_de: 'Klassische Tomatensauce mit Zwiebel, optional mit Parmesan.',
    meal_types: ['main'],
    training_tags: ['nach_training'],
    servings: 2,
    ingredients: [
      ing('spaghetti', 200, 'g'),
      ing('tomaten-passiert', 400, 'ml'),
      ing('zwiebel', 1, 'piece'),
      ing('olivenoel', 1, 'tbsp'),
      ing('salz', 1, 'pinch', { scales: false }),
      ing('parmesan', 20, 'g', { optional: true }),
    ],
    steps_de: [
      'Zwiebel würfeln und im Öl glasig dünsten.',
      'Tomaten zugeben und 10 Minuten köcheln.',
      'Spaghetti nach Packungsangabe kochen und mit der Sauce mischen.',
    ],
    prep_minutes: 10,
    cook_minutes: 15,
    meal_prep: { suitable: true, fridge_days: 3, freezable: true },
    equipment_de: ['Topf', 'Pfanne'],
    declared_per_serving: { kcal: 480, protein_g: 16, carbs_g: 83.5, fat_g: 7 },
    declared_diet: 'omnivore',
    declared_allergens: ['gluten', 'dairy', 'lactose', 'onion_garlic'],
  }),
  makeRecipe({
    id: 'mascarponecreme-roh',
    title_de: 'Mascarponecreme',
    description_de: 'Creme aus Mascarpone, rohem Ei und Zucker.',
    meal_types: ['snack'],
    training_tags: [],
    servings: 4,
    ingredients: [
      ing('huehnerei', 2, 'piece', { heated: false, scales: false }),
      ing('mascarpone', 250, 'g'),
      ing('zucker', 50, 'g'),
    ],
    steps_de: ['Ei mit Zucker schaumig schlagen.', 'Mascarpone unterrühren und kalt stellen.'],
    prep_minutes: 10,
    cook_minutes: 0,
    no_cook: true,
    equipment_de: ['Schüssel', 'Schneebesen'],
    declared_per_serving: { kcal: 363, protein_g: 6.6, carbs_g: 15, fat_g: 30.3 },
    declared_diet: 'vegetarian',
    declared_allergens: ['eggs', 'dairy', 'lactose'],
    declared_pregnancy_caution: true,
  }),
  makeRecipe({
    id: 'brot-raeucherlachs',
    title_de: 'Vollkornbrot mit Räucherlachs',
    description_de: 'Zwei Scheiben Vollkornbrot mit Räucherlachs belegt.',
    meal_types: ['breakfast', 'snack'],
    training_tags: [],
    servings: 1,
    ingredients: [
      ing('vollkornbrot', 2, 'piece'),
      ing('raeucherlachs', 40, 'g', { heated: false }),
    ],
    steps_de: ['Brot mit Räucherlachs belegen.'],
    prep_minutes: 3,
    cook_minutes: 0,
    no_cook: true,
    equipment_de: [],
    declared_per_serving: { kcal: 293, protein_g: 16, carbs_g: 40, fat_g: 5.7 },
    declared_diet: 'omnivore',
    declared_allergens: ['gluten', 'fish'],
    declared_pregnancy_caution: true,
  }),
  makeRecipe({
    id: 'omelett-champignons',
    title_de: 'Omelett mit Champignons',
    description_de: 'Omelett aus drei Eiern mit gebratenen Champignons.',
    meal_types: ['breakfast', 'main'],
    training_tags: ['nach_training'],
    servings: 1,
    ingredients: [
      ing('huehnerei', 3, 'piece', { heated: true }),
      ing('champignons', 100, 'g'),
      ing('olivenoel', 1, 'tbsp'),
      ing('salz', 1, 'pinch', { scales: false }),
    ],
    steps_de: ['Champignons in Öl anbraten.', 'Verquirlte Eier zugeben und stocken lassen.'],
    prep_minutes: 5,
    cook_minutes: 8,
    equipment_de: ['Pfanne'],
    declared_per_serving: { kcal: 359, protein_g: 25.6, carbs_g: 1.9, fat_g: 26.9 },
    declared_diet: 'vegetarian',
    declared_allergens: ['eggs', 'mushrooms'],
  }),
  makeRecipe({
    id: 'haehnchen-reis',
    title_de: 'Hähnchen mit Reis und Paprika',
    description_de: 'Hähnchenbrust mit Reis und Paprika, gut vorzubereiten.',
    meal_types: ['main'],
    training_tags: ['nach_training'],
    servings: 1,
    ingredients: [
      ing('haehnchenbrust', 150, 'g', { heated: true }),
      ing('reis', 75, 'g'),
      ing('paprika', 1, 'piece'),
      ing('olivenoel', 1, 'tbsp'),
      ing('salz', 1, 'pinch', { scales: false }),
    ],
    steps_de: ['Reis kochen.', 'Hähnchen und Paprika in Öl braten, mit Reis servieren.'],
    prep_minutes: 10,
    cook_minutes: 20,
    meal_prep: { suitable: true, fridge_days: 1, freezable: true },
    equipment_de: ['Topf', 'Pfanne'],
    declared_per_serving: { kcal: 570, protein_g: 42, carbs_g: 68, fat_g: 13.5 },
    declared_diet: 'omnivore',
    declared_allergens: ['poultry'],
  }),
  makeRecipe({
    id: 'tofu-paprika',
    title_de: 'Tofu mit Paprika und Reis',
    description_de: 'Gebratener Tofu mit Paprika und Reis, vegan.',
    meal_types: ['main'],
    training_tags: [],
    servings: 1,
    ingredients: [
      ing('tofu', 200, 'g'),
      ing('paprika', 1, 'piece'),
      ing('reis', 75, 'g'),
      ing('olivenoel', 1, 'tbsp'),
    ],
    steps_de: ['Reis kochen.', 'Tofu und Paprika in Öl braten.'],
    prep_minutes: 10,
    cook_minutes: 20,
    meal_prep: { suitable: true, fridge_days: 1, freezable: false },
    equipment_de: ['Topf', 'Pfanne'],
    declared_per_serving: { kcal: 650, protein_g: 33, carbs_g: 71, fat_g: 25 },
    declared_diet: 'vegan',
    declared_allergens: ['soy', 'legumes'],
  }),
];

export function recipeLookup(recipes: readonly Recipe[] = FIXTURE_RECIPES): Map<string, Recipe> {
  return new Map(recipes.map((r) => [r.id, r]));
}

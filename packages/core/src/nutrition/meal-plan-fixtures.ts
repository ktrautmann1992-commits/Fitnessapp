/**
 * Test-Fixtures für den Essensplan (docs/PLAN-PHASE-5.md 13, Etappe N3; NUR in *.test.ts benutzt). Baut auf dem
 * kleinen Test-Katalog aus N2a auf (`content/nutrition-fixtures.ts`) und ergänzt Rezepte für die Grenzfälle:
 * Ergänzungs-Snacks (`no_cook`), Erdnuss als Pflichtzutat, Schwein (Hack, Salami, Gelatine), Fisch erhitzt bzw.
 * nur als unbestätigte Import-Annahme erhitzt, Pilze, vegane Gerichte, Meal-Prep mit und ohne Einfrieren – dazu
 * vier Meal-Prep-Wochenpläne wie in der Gründer-Datei (je Frühstück, Mittag, Snack).
 *
 * ACHTUNG: Nährwerte sind TESTWERTE aus den N2a-Fixtures, keine Quelldaten.
 */
import type { Food } from '../content/food-schema';
import type { MealPrepPlan } from '../content/meal-prep-plan-schema';
import {
  FIXTURE_FOODS,
  FIXTURE_RECIPES,
  foodLookup,
  ing,
  makeRecipe,
  RECIPE_META,
} from '../content/nutrition-fixtures';
import type { Recipe } from '../content/recipe-schema';
import type { MealPlanProfile } from './schemas';
import type { NutritionDayTargets } from './targets';

const noPrep = { suitable: false, fridge_days: 0, freezable: false } as const;

/** Zusätzliche Rezepte für N3 (alle Entwurf, Testwerte). */
export const N3_EXTRA_RECIPES: readonly Recipe[] = [
  makeRecipe({
    id: 'banane-pur',
    title_de: 'Banane',
    description_de: 'Eine Banane als kleiner Snack für zwischendurch.',
    meal_types: ['snack'],
    training_tags: ['vor_training'],
    ingredients: [ing('banane', 1, 'piece')],
    steps_de: ['Banane schälen.'],
    prep_minutes: 1,
    cook_minutes: 0,
    no_cook: true,
    meal_prep: noPrep,
    equipment_de: [],
    declared_per_serving: { kcal: 112, protein_g: 1.4, carbs_g: 24, fat_g: 0.2 },
    declared_diet: 'vegan',
    declared_allergens: [],
  }),
  makeRecipe({
    id: 'paprika-sticks',
    title_de: 'Paprika-Sticks',
    description_de: 'Rohe Paprika in Streifen geschnitten, gut vorzubereiten.',
    meal_types: ['snack'],
    training_tags: [],
    ingredients: [ing('paprika', 1, 'piece')],
    steps_de: ['Paprika waschen und in Streifen schneiden.'],
    prep_minutes: 3,
    cook_minutes: 0,
    no_cook: true,
    meal_prep: { suitable: true, fridge_days: 3, freezable: false },
    equipment_de: ['Messer'],
    declared_per_serving: { kcal: 56, protein_g: 2, carbs_g: 9.6, fat_g: 0.8 },
    declared_diet: 'vegan',
    declared_allergens: [],
  }),
  makeRecipe({
    id: 'erdnuss-banane',
    title_de: 'Banane mit Erdnüssen',
    description_de: 'Banane mit einer Handvoll Erdnüsse.',
    meal_types: ['snack'],
    training_tags: [],
    ingredients: [ing('banane', 1, 'piece'), ing('erdnuesse', 30, 'g')],
    steps_de: ['Banane schälen und mit den Erdnüssen essen.'],
    prep_minutes: 1,
    cook_minutes: 0,
    no_cook: true,
    meal_prep: noPrep,
    equipment_de: [],
    declared_per_serving: { kcal: 288, protein_g: 8.9, carbs_g: 27.6, fat_g: 14.9 },
    declared_diet: 'vegan',
    declared_allergens: ['peanuts'],
  }),
  makeRecipe({
    id: 'overnight-oats',
    title_de: 'Overnight Oats',
    description_de: 'Haferflocken über Nacht in Milch eingeweicht.',
    meal_types: ['breakfast', 'snack'],
    training_tags: ['vor_training'],
    ingredients: [ing('haferflocken', 60, 'g'), ing('vollmilch', 200, 'ml')],
    steps_de: ['Haferflocken mit Milch mischen und über Nacht kalt stellen.'],
    prep_minutes: 3,
    cook_minutes: 0,
    no_cook: true,
    meal_prep: noPrep,
    equipment_de: ['Glas'],
    declared_per_serving: { kcal: 354, protein_g: 14.9, carbs_g: 45, fat_g: 11.4 },
    declared_diet: 'vegetarian',
    declared_allergens: ['gluten', 'dairy', 'lactose'],
  }),
  makeRecipe({
    id: 'haferdrink-oats',
    title_de: 'Hafer-Frühstück vegan',
    description_de: 'Haferflocken mit Haferdrink und Banane, ohne Kochen.',
    meal_types: ['breakfast'],
    training_tags: [],
    ingredients: [
      ing('haferflocken', 60, 'g'),
      ing('haferdrink', 250, 'ml'),
      ing('banane', 1, 'piece'),
    ],
    steps_de: ['Alles in einer Schüssel mischen.'],
    prep_minutes: 3,
    cook_minutes: 0,
    no_cook: true,
    meal_prep: { suitable: true, fridge_days: 1, freezable: false },
    equipment_de: ['Schüssel'],
    declared_per_serving: { kcal: 450, protein_g: 10.7, carbs_g: 77, fat_g: 8.3 },
    declared_diet: 'vegan',
    declared_allergens: ['gluten'],
  }),
  makeRecipe({
    id: 'tofu-erdnuss-curry',
    title_de: 'Tofu-Erdnuss-Curry mit Reis',
    description_de: 'Curry mit Tofu, Kokosmilch und Erdnüssen, gut vorzubereiten.',
    meal_types: ['main'],
    training_tags: ['nach_training'],
    ingredients: [
      ing('tofu', 150, 'g'),
      ing('reis', 75, 'g'),
      ing('kokosmilch', 100, 'ml'),
      ing('erdnuesse', 20, 'g'),
      ing('paprika', 1, 'piece'),
    ],
    steps_de: ['Reis kochen.', 'Tofu und Paprika anbraten, mit Kokosmilch und Erdnüssen köcheln.'],
    prep_minutes: 10,
    cook_minutes: 20,
    meal_prep: { suitable: true, fridge_days: 1, freezable: true },
    equipment_de: ['Topf', 'Pfanne'],
    declared_per_serving: { kcal: 800, protein_g: 33, carbs_g: 75, fat_g: 40 },
    declared_diet: 'vegan',
    declared_allergens: ['soy', 'legumes', 'peanuts'],
  }),
  makeRecipe({
    id: 'hack-spaghetti',
    title_de: 'Spaghetti mit Hackfleischsauce',
    description_de: 'Spaghetti mit Tomaten-Hackfleisch-Sauce.',
    meal_types: ['main'],
    training_tags: ['nach_training'],
    ingredients: [
      ing('spaghetti', 100, 'g'),
      ing('hackfleisch-gemischt', 125, 'g', { heated: true }),
      ing('tomaten-passiert', 200, 'ml'),
      ing('zwiebel', 0.5, 'piece'),
    ],
    steps_de: [
      'Hackfleisch mit Zwiebel durchbraten.',
      'Tomaten zugeben, köcheln, mit Nudeln mischen.',
    ],
    prep_minutes: 10,
    cook_minutes: 20,
    meal_prep: { suitable: true, fridge_days: 1, freezable: true },
    equipment_de: ['Topf', 'Pfanne'],
    declared_per_serving: { kcal: 735, protein_g: 38, carbs_g: 81, fat_g: 24.5 },
    declared_diet: 'omnivore',
    declared_allergens: ['gluten', 'beef', 'onion_garlic'],
    contains_pork: true,
  }),
  makeRecipe({
    id: 'lachs-reis',
    title_de: 'Lachs mit Reis',
    description_de: 'Gebratener Lachs mit Reis.',
    meal_types: ['main'],
    training_tags: ['nach_training'],
    ingredients: [
      ing('lachs', 150, 'g', { heated: true }),
      ing('reis', 75, 'g'),
      ing('olivenoel', 1, 'tbsp'),
    ],
    steps_de: ['Reis kochen.', 'Lachs in Öl durchbraten.'],
    prep_minutes: 5,
    cook_minutes: 20,
    meal_prep: { suitable: true, fridge_days: 1, freezable: false },
    equipment_de: ['Topf', 'Pfanne'],
    declared_per_serving: { kcal: 660, protein_g: 35.6, carbs_g: 58.5, fat_g: 30.8 },
    declared_diet: 'omnivore',
    declared_allergens: ['fish'],
  }),
  makeRecipe({
    id: 'lachs-reis-annahme',
    title_de: 'Lachs mit Reis (importiert)',
    description_de: 'Wie Lachs mit Reis, aber „erhitzt“ ist nur eine unbestätigte Import-Annahme.',
    meal_types: ['main'],
    training_tags: [],
    ingredients: [
      ing('lachs', 150, 'g', { heated: true }),
      ing('reis', 75, 'g'),
      ing('olivenoel', 1, 'tbsp'),
    ],
    steps_de: ['Reis kochen.', 'Lachs in Öl braten.'],
    prep_minutes: 5,
    cook_minutes: 20,
    meal_prep: { suitable: true, fridge_days: 1, freezable: false },
    equipment_de: ['Topf', 'Pfanne'],
    declared_per_serving: { kcal: 660, protein_g: 35.6, carbs_g: 58.5, fat_g: 30.8 },
    declared_diet: 'omnivore',
    declared_allergens: ['fish'],
    declared_pregnancy_caution: true,
    meta: {
      ...RECIPE_META,
      import_assumptions: [
        {
          ingredient_index: 0,
          food_id: 'lachs',
          field: 'heated',
          value: true,
          reason_de: 'Schritt 2 brät den Lachs.',
        },
      ],
      import_assumptions_confirmed_by: null,
    },
  }),
  makeRecipe({
    id: 'salami-brot',
    title_de: 'Salamibrot',
    description_de: 'Vollkornbrot mit Salami belegt.',
    meal_types: ['breakfast', 'snack'],
    training_tags: [],
    ingredients: [ing('vollkornbrot', 2, 'piece'), ing('salami', 30, 'g', { heated: false })],
    steps_de: ['Brot mit Salami belegen.'],
    prep_minutes: 2,
    cook_minutes: 0,
    no_cook: true,
    meal_prep: noPrep,
    equipment_de: [],
    declared_per_serving: { kcal: 334, protein_g: 13.3, carbs_g: 40.3, fat_g: 11.4 },
    declared_diet: 'omnivore',
    declared_allergens: ['gluten', 'histamine'],
    contains_pork: true,
    declared_pregnancy_caution: true,
  }),
  makeRecipe({
    id: 'milch-gelee',
    title_de: 'Milchgelee',
    description_de: 'Süßes Gelee aus Milch mit Gelatine.',
    meal_types: ['snack'],
    training_tags: [],
    ingredients: [ing('vollmilch', 200, 'ml'), ing('zucker', 20, 'g'), ing('gelatine', 3, 'piece')],
    steps_de: ['Milch mit Zucker erwärmen, Gelatine auflösen und kalt stellen.'],
    prep_minutes: 5,
    cook_minutes: 5,
    meal_prep: noPrep,
    equipment_de: ['Topf'],
    declared_per_serving: { kcal: 229, protein_g: 11.1, carbs_g: 29.9, fat_g: 7.2 },
    declared_diet: 'omnivore',
    declared_allergens: ['dairy', 'lactose'],
    contains_pork: true,
  }),
  makeRecipe({
    id: 'champignon-reis',
    title_de: 'Champignon-Reis-Pfanne',
    description_de: 'Reis mit gebratenen Champignons und Zwiebel, vegan.',
    meal_types: ['main'],
    training_tags: [],
    ingredients: [
      ing('champignons', 200, 'g'),
      ing('reis', 75, 'g'),
      ing('olivenoel', 1, 'tbsp'),
      ing('zwiebel', 1, 'piece'),
    ],
    steps_de: ['Reis kochen.', 'Champignons und Zwiebel in Öl braten, mit Reis mischen.'],
    prep_minutes: 10,
    cook_minutes: 20,
    meal_prep: { suitable: true, fridge_days: 1, freezable: false },
    equipment_de: ['Topf', 'Pfanne'],
    declared_per_serving: { kcal: 470, protein_g: 12.6, carbs_g: 66.8, fat_g: 11.5 },
    declared_diet: 'vegan',
    declared_allergens: ['mushrooms', 'onion_garlic'],
  }),
];

/** Rezepte aus N2a + N3. */
export const N3_RECIPES: readonly Recipe[] = [...FIXTURE_RECIPES, ...N3_EXTRA_RECIPES];
export const N3_FOODS = foodLookup(FIXTURE_FOODS);

function mealPrepPlan(id: string, title: string, recipeIds: string[]): MealPrepPlan {
  return {
    id,
    version: 1,
    status: 'draft',
    title_de: title,
    description_de: 'Testplan für den Essensplan (Etappe N3), keine echten Inhalte.',
    recipe_ids: recipeIds,
    cook_steps: [
      { start_min: 0, text_de: 'Reis aufsetzen.' },
      { start_min: 20, text_de: 'Hauptgericht kochen.' },
      { start_min: 10, text_de: 'Gemüse schneiden.' },
    ],
    storage_plan: recipeIds.flatMap((recipe_id) =>
      (['mon', 'tue', 'wed', 'thu', 'fri'] as const).map((weekday) => ({
        recipe_id,
        weekday,
        method: 'fridge' as const,
      })),
    ),
    storage_de: [],
    meta: { ...RECIPE_META },
  };
}

/**
 * Meal-Prep-Wochenpläne für die Eigenschaftstests (19.6 DoD): vegane Woche mit Erdnuss-Curry, Fisch-/Ei-Woche mit
 * nur angenommener Erhitzung, Schweine-Woche (Hack), Pilz-Woche („mag ich nicht“). Der `storage_plan` sagt
 * absichtlich überall „Kühlschrank“ – die Engine muss R9 trotzdem einhalten.
 */
export const N3_MEAL_PREP_PLANS: readonly MealPrepPlan[] = [
  mealPrepPlan('a-vegan-woche', 'Vegane Woche', [
    'haferdrink-oats',
    'tofu-erdnuss-curry',
    'paprika-sticks',
  ]),
  mealPrepPlan('b-fisch-woche', 'Fisch-Woche', ['lachs-reis-annahme', 'paprika-sticks']),
  mealPrepPlan('c-fleisch-woche', 'Fleisch-Woche', ['hack-spaghetti', 'paprika-sticks']),
  mealPrepPlan('d-pilz-woche', 'Pilz-Woche', ['champignon-reis', 'paprika-sticks']),
];

/**
 * Planband UNABHÄNGIG aus Ziel, Untergrenze und Obergrenze der Tagesziele (Plan 4.6.1): [max(Untergrenze, 0,9 × Ziel);
 * min(1,1 × Ziel, Obergrenze)], mindestens 20 kcal breit (nur nach oben, Wächter N3 S1) – Zahlen hier ausgeschrieben.
 */
export function independentBand(t: NutritionDayTargets): [number, number] {
  const target = t.targetKcal as number;
  const min = Math.max(t.floorKcal as number, 0.9 * target);
  const max = Math.max(min + 20, Math.min(1.1 * target, t.ceilingKcal as number));
  return [min, max];
}

// ---------------------------------------------------------------------------------------------------------
// Eigene Erwartungsregeln für die Tests (Wächter N3 S5c) – bewusst NICHT `foodContainsPork`/`needsHeatedFlag`/
// `computeRecipeFacts` aus der Implementierung, sondern direkt aus dem Plan (5.1, 5.2, 6.1, S5, R2-S2) geschrieben.
// ---------------------------------------------------------------------------------------------------------

/** Schwein laut Plan S5: Tierart Schwein oder unbekannt; Gelatine ohne bzw. mit Herkunft Schwein/unbekannt. */
export function expectPork(food: Food): boolean {
  if (food.meat_kind.some((k) => k === 'pork' || k === 'unknown')) return true;
  return (
    food.animal.includes('gelatin') &&
    (food.gelatin_origin === undefined ||
      food.gelatin_origin === 'pork' ||
      food.gelatin_origin === 'unknown')
  );
}

/** Braucht laut R2-S2 eine Angabe „erhitzt“: Ei, Fisch, Krebs-/Weichtiere, Fleisch, Rohmilch. */
export function expectNeedsHeating(food: Food): boolean {
  return (
    food.groups.some((g) => g === 'eggs' || g === 'fish' || g === 'shellfish') ||
    food.animal.some((a) => a === 'egg' || a === 'fish' || a === 'shellfish' || a === 'meat') ||
    (food.animal.includes('dairy') && food.pregnancy_caution)
  );
}

const NOT_VEGETARIAN_KINDS = ['meat', 'fish', 'shellfish', 'gelatin', 'animal_rennet', 'insect'];

/**
 * Verstöße der TATSÄCHLICH verwendeten Zutaten eines Rezepts gegen die harten Regeln (6.1), unabhängig gerechnet.
 * `used` = Index der Zutat im Rezept + verwendetes Lebensmittel (Ersatzprodukt, falls ersetzt).
 */
export function usedFoodViolations(
  recipe: Recipe,
  used: readonly { readonly index: number; readonly foodId: string }[],
  profile: MealPlanProfile,
  pregnancy: boolean,
  foods: ReadonlyMap<string, Food> = N3_FOODS,
): string[] {
  const excluded = new Set<string>([...profile.intolerances, ...profile.dislikes]);
  const unconfirmed =
    (recipe.meta.import_assumptions?.length ?? 0) > 0 &&
    (recipe.meta.import_assumptions_confirmed_by ?? null) === null;
  const problems: string[] = [];
  for (const { index, foodId } of used) {
    const food = foods.get(foodId) as Food;
    const original = recipe.ingredients[index];
    if (food.groups.some((g) => excluded.has(g))) problems.push(`Gruppe ${food.id}`);
    if (expectPork(food) && profile.eatsPork !== true) problems.push(`Schwein ${food.id}`);
    if (profile.diet === 'vegan' && food.animal.length > 0) problems.push(`vegan ${food.id}`);
    if (
      profile.diet === 'vegetarian' &&
      food.animal.some((a) => NOT_VEGETARIAN_KINDS.includes(a))
    ) {
      problems.push(`vegetarisch ${food.id}`);
    }
    if (food.alcohol) problems.push(`Alkohol ${food.id}`);
    if (pregnancy) {
      if (food.pregnancy_caution) problems.push(`Schwangerschaft (Flag) ${food.id}`);
      if (
        expectNeedsHeating(food) &&
        (recipe.no_cook || original?.heated !== true || unconfirmed)
      ) {
        problems.push(`Schwangerschaft (ungegart) ${food.id}`);
      }
    }
  }
  return problems;
}

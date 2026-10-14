/**
 * Beispiel-Rezepte mit TESTWERTEN für den Testmodus der App (docs/PLAN-PHASE-5.md 13, Etappe N4), solange der echte
 * Lebensmittel-Katalog (Workflow `foods-import`) und die Rezepte (`alpha5-import`) noch nicht im Repository sind.
 *
 * Eigener Paket-Einstieg `@fitnessapp/core/demo-nutrition` – NICHT Teil von `@fitnessapp/core`, damit die Fixtures
 * nie versehentlich im normalen Bestand landen. Die App lädt das Modul nur im Testmodus, nur bei leerem Bündel und
 * nur nach aktiver Wahl („Beispiel-Rezepte mit Testwerten verwenden“, auch in den E2E-Tests), und kennzeichnet alles
 * zusätzlich als „Testwerte – keine echten Nährwerte“.
 *
 * Inhalt: der kleine Test-Katalog aus N2a (`content/nutrition-fixtures.ts`), die Rezepte aus N2a/N3
 * (`nutrition/meal-plan-fixtures.ts`) und drei Meal-Prep-Wochenpläne für den Kochtag (Etappe N5b, Aufbewahrung nach
 * R9 hergeleitet), zwei Beispiel-Ratgeber mit Testtexten (Etappe N5c) und eine kleine Austausch-Tabelle mit Rollen an
 * einigen Rezepten (Etappe N9, Zutaten-Austausch), alle Status `draft`. Geprüft und ausgewählt wird wie beim echten Bestand über
 * `validateContent` und `selectNutritionContent` – dieselben Regeln (R1–R22).
 * ACHTUNG: Die Nährwerte sind gerundete Testwerte, keine Quelldaten (R17 ist nur mit dem aus den Fixtures
 * abgeleiteten Auszug grün).
 */
import { CARB_LOADING_NOTICE_DE, type Guide } from './content/guide-schema';
import { deriveStoragePlan } from './content/meal-prep-checks';
import type { MealPrepPlan } from './content/meal-prep-plan-schema';
import { catalogFor, FIXTURE_FOODS, RECIPE_META } from './content/nutrition-fixtures';
import type { NutritionCatalogContext } from './content/recipe-checks';
import type { IngredientRole, Recipe } from './content/recipe-schema';
import type { IngredientSubstitution } from './content/substitution-schema';
import { substitutionContentId } from './content/substitution-schema';
import type { NutritionContentFile } from './content/validate';
import { N3_RECIPES } from './nutrition/meal-plan-fixtures';

export interface DemoNutritionContent {
  readonly files: readonly NutritionContentFile[];
  readonly catalog: NutritionCatalogContext;
}

function demoPlan(
  id: string,
  title: string,
  recipeIds: readonly string[],
  steps: readonly [number, string][],
): MealPrepPlan {
  const recipes = N3_RECIPES.filter((r) => recipeIds.includes(r.id));
  return {
    id,
    version: 1,
    status: 'draft',
    title_de: title,
    description_de:
      'Beispiel-Wochenplan mit Testwerten: Kochtag am Sonntag, Montag bis Freitag vorgekocht.',
    recipe_ids: [...recipeIds],
    cook_steps: steps.map(([start_min, text_de]) => ({ start_min, text_de })),
    storage_plan: deriveStoragePlan(recipes),
    storage_de: ['Vorgekochtes im Kühlschrank aufbewahren, Eingefrorenes am Vorabend auftauen.'],
    dinner_hint_de: 'Das Abendessen bleibt frei für ein frisches Rezept.',
    meta: { ...RECIPE_META },
  };
}

/** Meal-Prep-Wochenpläne mit Testwerten (Etappe N5b): Kochtag mit Timern, Auftau-Hinweise, ausgegraut. */
export const DEMO_MEAL_PREP_PLANS: readonly MealPrepPlan[] = [
  demoPlan(
    'demo-pasta-woche',
    'Pasta-Woche',
    ['haferdrink-oats', 'spaghetti-tomatensauce', 'paprika-sticks'],
    [
      [0, 'Wasser für die Nudeln aufsetzen.'],
      [5, 'Zwiebel schneiden und die Tomatensauce ansetzen.'],
      [10, 'Nudeln nach Packungsangabe kochen.'],
      [20, 'Paprika waschen und in Streifen schneiden.'],
      [30, 'Portionen abfüllen und für später einfrieren, was nicht in den Kühlschrank kommt.'],
    ],
  ),
  demoPlan(
    'demo-vegane-woche',
    'Vegane Curry-Woche',
    ['haferdrink-oats', 'tofu-erdnuss-curry', 'paprika-sticks'],
    [
      [0, 'Reis aufsetzen.'],
      [5, 'Tofu würfeln und anbraten.'],
      [15, 'Paprika schneiden, mit Kokosmilch und Erdnüssen zum Curry geben.'],
      [30, 'Portionen abfüllen und einfrieren, was nicht in den Kühlschrank kommt.'],
    ],
  ),
  demoPlan(
    'demo-fisch-woche',
    'Fisch-Woche',
    ['lachs-reis-annahme', 'paprika-sticks'],
    [
      [0, 'Reis aufsetzen.'],
      [10, 'Lachs garen.'],
      [25, 'Portionen abfüllen.'],
    ],
  ),
];

/**
 * Rollen der Zutaten (19.4 S6) für die Beispiel-Rezepte (Etappe N9) – nur hier, damit die Test-Fixtures aus N2a/N3
 * unverändert bleiben. Rezepte mit Import-Annahmen (`lachs-reis-annahme`) bekommen bewusst keine Rollen: Rollen
 * gehören zur Zubereitung und würden den Fingerabdruck der bestätigten Annahmen ändern (N2d).
 */
export const DEMO_INGREDIENT_ROLES: Readonly<
  Record<string, Readonly<Record<string, IngredientRole>>>
> = {
  'tofu-paprika': { tofu: 'protein', paprika: 'vegetable', reis: 'carb', olivenoel: 'fat' },
  'haehnchen-reis': {
    haehnchenbrust: 'protein',
    reis: 'carb',
    paprika: 'vegetable',
    olivenoel: 'fat',
    salz: 'seasoning',
  },
  'tofu-erdnuss-curry': {
    tofu: 'protein',
    reis: 'carb',
    kokosmilch: 'fat',
    erdnuesse: 'fat',
    paprika: 'vegetable',
  },
  'hack-spaghetti': {
    spaghetti: 'carb',
    'hackfleisch-gemischt': 'protein',
    'tomaten-passiert': 'vegetable',
    zwiebel: 'vegetable',
  },
  'lachs-reis': { lachs: 'protein', reis: 'carb', olivenoel: 'fat' },
  'champignon-reis': {
    champignons: 'vegetable',
    reis: 'carb',
    olivenoel: 'fat',
    zwiebel: 'vegetable',
  },
  'spaghetti-tomatensauce': {
    spaghetti: 'carb',
    'tomaten-passiert': 'vegetable',
    zwiebel: 'vegetable',
    olivenoel: 'fat',
    salz: 'seasoning',
  },
  'porridge-banane': { haferflocken: 'carb', honig: 'sweet' },
};

/**
 * Pflanzliche Zutaten, die laut Zubereitung tatsächlich gegart werden (Wächter N9 B1): Nur an ihnen darf ein Ersatz
 * stehen, der erhitzt werden muss (Ei, Fleisch, Fisch). Geprüft an den Schritten: „Tofu und Paprika in Öl braten.“
 * bzw. „Tofu und Paprika anbraten, …“.
 */
export const DEMO_HEATED_PLANT_FOODS: Readonly<Record<string, readonly string[]>> = {
  'tofu-paprika': ['tofu'],
  'tofu-erdnuss-curry': ['tofu'],
};

/** Rezept mit den Beispiel-Rollen (und `heated` gegarter pflanzlicher Zutaten); sonst unverändert. */
export function withDemoRoles(recipe: Recipe): Recipe {
  const roles = DEMO_INGREDIENT_ROLES[recipe.id];
  if (roles === undefined || (recipe.meta.import_assumptions?.length ?? 0) > 0) return recipe;
  const heated = DEMO_HEATED_PLANT_FOODS[recipe.id] ?? [];
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((ingredient) => {
      const role = roles[ingredient.food_id];
      const withHeat = heated.includes(ingredient.food_id)
        ? { ...ingredient, heated: true }
        : ingredient;
      return role === undefined ? withHeat : { ...withHeat, role };
    }),
  };
}

function demoSubstitution(
  food: string,
  substitute: string,
  role: IngredientRole,
  factor: number,
  note: string,
): IngredientSubstitution {
  return {
    id: substitutionContentId(food, substitute),
    version: 1,
    status: 'draft',
    food_id: food,
    substitute_food_id: substitute,
    factor,
    role,
    note_de: note,
    meta: { ...RECIPE_META },
  };
}

/**
 * Austausch-Tabelle mit TESTWERTEN (Etappe N9): Faktor hält die Messgröße der Rolle (R23 grün, Süße gelb). Enthält
 * absichtlich Paare, die für manche Personen nie angeboten werden (Hack mit Schwein, Ei ungegart in der
 * Schwangerschaft, Hähnchen für Vegetarier) – das prüft der Core, nicht die Tabelle.
 */
export const DEMO_SUBSTITUTIONS: readonly IngredientSubstitution[] = [
  demoSubstitution('tofu', 'haehnchenbrust', 'protein', 0.57, 'Hähnchen gut durchgaren.'),
  demoSubstitution('tofu', 'huehnerei', 'protein', 1.04, 'Eier verquirlen und mitbraten.'),
  demoSubstitution('haehnchenbrust', 'tofu', 'protein', 1.77, 'Tofu in Würfeln anbraten.'),
  demoSubstitution('haehnchenbrust', 'lachs', 'protein', 1.15, 'Lachs kürzer garen.'),
  demoSubstitution(
    'haehnchenbrust',
    'hackfleisch-gemischt',
    'protein',
    1.28,
    'Hack krümelig durchbraten.',
  ),
  demoSubstitution('lachs', 'haehnchenbrust', 'protein', 0.87, 'Hähnchen gut durchgaren.'),
  demoSubstitution('hackfleisch-gemischt', 'tofu', 'protein', 1.38, 'Tofu fein zerbröseln.'),
  demoSubstitution(
    'hackfleisch-gemischt',
    'haehnchenbrust',
    'protein',
    0.78,
    'Hähnchen klein schneiden und durchgaren.',
  ),
  demoSubstitution('reis', 'spaghetti', 'carb', 1.1, 'Nudeln nach Packungsangabe kochen.'),
  demoSubstitution('spaghetti', 'reis', 'carb', 0.91, 'Reis nach Packungsangabe kochen.'),
  demoSubstitution('paprika', 'champignons', 'vegetable', 1, 'Pilze in Scheiben schneiden.'),
  demoSubstitution('champignons', 'paprika', 'vegetable', 1, 'Paprika in Streifen schneiden.'),
  demoSubstitution('honig', 'zucker', 'sweet', 0.8, 'Etwas weniger Zucker als Honig nehmen.'),
];

const GUIDE_META: Guide['meta'] = {
  origin: 'manual',
  model: null,
  batch_id: null,
  created_on: '2026-10-14',
  expert_reviewed: false,
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
};

/**
 * Beispiel-Ratgeber mit TESTTEXTEN (Etappe N5c): ersetzen nicht die Ratgeber aus `alpha5-rezepte.json`. Enthalten je
 * einen Absatz mit Zahlen (kcal bzw. g je kg) für den Test „Kalorienzahlen aus“ und beim Carb-Loading den festen
 * Hinweis (R21). Ohne roten Befund (Test in guides.test.ts).
 */
export const DEMO_GUIDES: readonly Guide[] = [
  {
    id: 'demo-unterwegs',
    version: 1,
    status: 'draft',
    title_de: 'Unterwegs essen (Beispiel)',
    intro_de: 'Beispiel-Ratgeber mit Testtexten für den Testmodus – noch nicht fachlich geprüft.',
    sections: [
      {
        heading_de: 'Grundregeln',
        body_de: [
          'Plane zu jeder Mahlzeit Gemüse oder Obst ein.',
          'Nimm Wasser mit, wenn du lange unterwegs bist.',
          'Eine Hauptmahlzeit hat oft etwa 500 bis 700 kcal.',
        ],
      },
    ],
    places: [
      {
        name_de: 'Beim Bäcker',
        good_de: ['Vollkornbrötchen mit Käse und Salat', 'Laugenbrezel mit einem Stück Obst'],
        less_often_de: ['Süße Teilchen'],
        tip_de: 'Frag nach belegten Brötchen mit Gemüse.',
      },
    ],
    meta: { ...GUIDE_META },
  },
  {
    id: 'demo-wettkampf',
    version: 1,
    status: 'draft',
    title_de: 'Wettkampf-Ernährung (Beispiel)',
    sections: [
      {
        heading_de: 'Am Abend vorher',
        body_de: ['Iss, was du kennst und gut verträgst.', 'Probiere nichts Neues aus.'],
      },
      {
        heading_de: 'Carb-Loading',
        body_de: [
          'Beim Carb-Loading isst du in den Tagen vor einem langen Wettkampf mehr Kohlenhydrate.',
          'Fachleute nennen oft 8–10 g Kohlenhydrate pro kg Körpergewicht und Tag.',
        ],
        notice_de: CARB_LOADING_NOTICE_DE,
      },
    ],
    meta: { ...GUIDE_META },
  },
];

export function demoNutritionContent(): DemoNutritionContent {
  return {
    files: [
      ...FIXTURE_FOODS.map((food): NutritionContentFile => ({
        kind: 'food',
        fileName: `${food.id}.json`,
        data: structuredClone(food),
      })),
      ...N3_RECIPES.map((recipe): NutritionContentFile => ({
        kind: 'recipe',
        fileName: `${recipe.id}.json`,
        data: structuredClone(withDemoRoles(recipe)),
      })),
      ...DEMO_MEAL_PREP_PLANS.map((plan): NutritionContentFile => ({
        kind: 'meal_prep_plan',
        fileName: `${plan.id}.json`,
        data: structuredClone(plan),
      })),
      ...DEMO_GUIDES.map((guide): NutritionContentFile => ({
        kind: 'guide',
        fileName: `${guide.id}.json`,
        data: structuredClone(guide),
      })),
      ...DEMO_SUBSTITUTIONS.map((sub): NutritionContentFile => ({
        kind: 'ingredient_substitution',
        fileName: `${sub.id}.json`,
        data: structuredClone(sub),
      })),
    ],
    catalog: catalogFor(FIXTURE_FOODS),
  };
}

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
 * R9 hergeleitet), alle Status `draft`. Geprüft und ausgewählt wird wie beim echten Bestand über
 * `validateContent` und `selectNutritionContent` – dieselben Regeln (R1–R22).
 * ACHTUNG: Die Nährwerte sind gerundete Testwerte, keine Quelldaten (R17 ist nur mit dem aus den Fixtures
 * abgeleiteten Auszug grün).
 */
import { deriveStoragePlan } from './content/meal-prep-checks';
import type { MealPrepPlan } from './content/meal-prep-plan-schema';
import { catalogFor, FIXTURE_FOODS, RECIPE_META } from './content/nutrition-fixtures';
import type { NutritionCatalogContext } from './content/recipe-checks';
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
        data: structuredClone(recipe),
      })),
      ...DEMO_MEAL_PREP_PLANS.map((plan): NutritionContentFile => ({
        kind: 'meal_prep_plan',
        fileName: `${plan.id}.json`,
        data: structuredClone(plan),
      })),
    ],
    catalog: catalogFor(FIXTURE_FOODS),
  };
}

/**
 * Beispiel-Rezepte mit TESTWERTEN für den Testmodus der App (docs/PLAN-PHASE-5.md 13, Etappe N4), solange der echte
 * Lebensmittel-Katalog (Workflow `foods-import`) und die Rezepte (`alpha5-import`) noch nicht im Repository sind.
 *
 * Eigener Paket-Einstieg `@fitnessapp/core/demo-nutrition` – NICHT Teil von `@fitnessapp/core`, damit die Fixtures
 * nie versehentlich im normalen Bestand landen. Die App lädt das Modul nur im Testmodus, nur bei leerem Bündel und
 * nur nach aktiver Wahl („Beispiel-Rezepte mit Testwerten verwenden“, auch in den E2E-Tests), und kennzeichnet alles
 * zusätzlich als „Testwerte – keine echten Nährwerte“.
 *
 * Inhalt: der kleine Test-Katalog aus N2a (`content/nutrition-fixtures.ts`) und die Rezepte aus N2a/N3
 * (`nutrition/meal-plan-fixtures.ts`), alle Status `draft`. Geprüft und ausgewählt wird wie beim echten Bestand über
 * `validateContent` und `selectNutritionContent` – dieselben Regeln (R1–R22).
 * ACHTUNG: Die Nährwerte sind gerundete Testwerte, keine Quelldaten (R17 ist nur mit dem aus den Fixtures
 * abgeleiteten Auszug grün).
 */
import { catalogFor, FIXTURE_FOODS } from './content/nutrition-fixtures';
import type { NutritionCatalogContext } from './content/recipe-checks';
import type { NutritionContentFile } from './content/validate';
import { N3_RECIPES } from './nutrition/meal-plan-fixtures';

export interface DemoNutritionContent {
  readonly files: readonly NutritionContentFile[];
  readonly catalog: NutritionCatalogContext;
}

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
    ],
    catalog: catalogFor(FIXTURE_FOODS),
  };
}

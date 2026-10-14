/**
 * Beispiel-Dokumente für PDF P5 (docs/PLAN-PHASE-5.md 11, Etappe N6): Essensplan und Einkaufsliste für AUSGEDACHTE
 * Test-Personen mit den Beispiel-Rezepten (Testwerte, `@fitnessapp/core/demo-nutrition`). Genutzt vom CI-Skript
 * scripts/pdf-preview.ts (Artefakt „pdf-vorschau“), von print-pages.spec.ts (A4-Prüfung) und den App-Tests.
 * Keine echten Nutzerdaten.
 */
import {
  addManualShoppingItem,
  buildMealPlanWeek,
  buildNutritionPlanDocument,
  buildShoppingList,
  buildShoppingListDocument,
  type MealPlanProfileInput,
  type MealPlanWeek,
  type NutritionInputsInput,
  nutritionTargetsForWeek,
  type PrintDocument,
  type Recipe,
  selectNutritionContent,
  setShoppingItemChecked,
  type ShoppingList,
  type ShoppingListItem,
  validateContent,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';

/** Sonntag vor der Beispielwoche (Stand) und Montag der Woche. */
export const NUTRITION_EXAMPLE_DAY = '2026-10-11';
export const NUTRITION_EXAMPLE_WEEK = '2026-10-12';

export const DEMO_LIBRARY = (() => {
  const demo = demoNutritionContent();
  return selectNutritionContent(validateContent(demo.files, { nutritionCatalog: demo.catalog }), {
    allowDrafts: true,
  });
})();

function person(overrides: Partial<NutritionInputsInput> = {}): NutritionInputsInput {
  return {
    today: NUTRITION_EXAMPLE_DAY,
    birthDate: '1992-03-14',
    sex: 'female',
    goalType: 'fat_loss',
    experienceLevel: 'beginner',
    healthDataConsent: true,
    bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 168, weightKg: 68 }],
    healthFlags: { flags: [] },
    activityLevel: 'light',
    mealsPerDay: 4,
    sessions: [],
    ...overrides,
  };
}

export interface NutritionWeekExample {
  readonly plan: MealPlanWeek;
  readonly targets: ReturnType<typeof nutritionTargetsForWeek>;
}

export function exampleWeek(
  overrides: Partial<NutritionInputsInput> = {},
  profile: MealPlanProfileInput = { diet: 'vegetarian' },
): NutritionWeekExample {
  const targets = nutritionTargetsForWeek(person(overrides), NUTRITION_EXAMPLE_WEEK);
  const plan = buildMealPlanWeek({
    targets,
    profile,
    recipes: DEMO_LIBRARY.recipes,
    foods: DEMO_LIBRARY.foods,
    allowDrafts: true,
    today: NUTRITION_EXAMPLE_DAY,
  });
  return { plan, targets };
}

function planDocument(
  week: NutritionWeekExample,
  options: { showEnergyNumbers: boolean; name?: string },
  recipes: readonly Recipe[] = DEMO_LIBRARY.recipes,
): PrintDocument {
  const result = buildNutritionPlanDocument(
    { plan: week.plan, targets: week.targets, recipes, foods: DEMO_LIBRARY.foods },
    {
      onDate: NUTRITION_EXAMPLE_DAY,
      showEnergyNumbers: options.showEnergyNumbers,
      includeName: options.name !== undefined,
      name: options.name ?? null,
      testValues: true,
    },
  );
  if (!result.ok) throw new Error(`Beispiel-Essensplan: ${result.error}`);
  return result.document;
}

function listDocument(list: ShoppingList): PrintDocument {
  const result = buildShoppingListDocument(
    { list, recipes: DEMO_LIBRARY.recipes },
    { onDate: NUTRITION_EXAMPLE_DAY },
  );
  if (!result.ok) throw new Error(`Beispiel-Einkaufsliste: ${result.error}`);
  return result.document;
}

function weekList(week: NutritionWeekExample): ShoppingList {
  return buildShoppingList(week.plan, DEMO_LIBRARY.foods, {
    from: NUTRITION_EXAMPLE_WEEK,
    to: '2026-10-18',
  });
}

/** Belastungstest Essensplan: 8 Mahlzeiten mit langen Titeln, ein Rezept mit 20 Zutaten und 15 langen Schritten. */
function extremePlanDocument(): PrintDocument {
  const week = exampleWeek({ mealsPerDay: 8 }, { diet: 'omnivore', eatsPork: true });
  const first = week.plan.days[0]?.meals[0];
  const recipe = DEMO_LIBRARY.recipes.find((r) => r.id === first?.recipeId);
  if (!first || !recipe) throw new Error('Belastungstest: kein Rezept');
  const longTitle = 'Ofengemüse mit Kichererbsen, Feta-Ersatz, Kräuterquark und gerösteten Kernen';
  const long: Recipe = {
    ...recipe,
    title_de: longTitle,
    steps_de: Array.from({ length: 15 }, (_, i) =>
      `Schritt ${i + 1}: Alles in eine Schüssel geben, gründlich verrühren und kurz ruhen lassen. Danach die Masse gleichmäßig verteilen, im vorgeheizten Ofen garen und zwischendurch einmal wenden, damit alles gleichmäßig bräunt und nichts anbrennt.`.slice(
        0,
        300,
      ),
    ),
  };
  const ingredients = Array.from({ length: 20 }, (_, i) => ({
    ...(first.ingredients[i % first.ingredients.length] as (typeof first.ingredients)[number]),
    index: i,
  }));
  const plan: MealPlanWeek = {
    ...week.plan,
    days: week.plan.days.map((day, d) => ({
      ...day,
      meals: day.meals.map((meal, m) =>
        meal.recipeId === first.recipeId
          ? {
              ...meal,
              titleDe: longTitle,
              ingredients,
              factor: [0.5, 1, 1.5, 2, 2.5][(d + m) % 5] ?? 1,
            }
          : meal,
      ),
    })),
  };
  const recipes = DEMO_LIBRARY.recipes.map((r) =>
    r.id === long.id
      ? {
          ...long,
          ingredients: Array.from(
            { length: 20 },
            (_, i) =>
              recipe.ingredients[i % recipe.ingredients.length] as Recipe['ingredients'][number],
          ),
        }
      : r,
  );
  return planDocument({ plan, targets: week.targets }, { showEnergyNumbers: true }, recipes);
}

/** Belastungstest Einkaufsliste: 200 Einträge, teils sehr lang, verteilt auf Abteilungen und Vorrat. */
function extremeListDocument(): PrintDocument {
  const base = weekList(exampleWeek());
  const categories = ['fruit_vegetables', 'chilled_dairy_eggs', 'other', 'spices_baking'] as const;
  const items: ShoppingListItem[] = Array.from({ length: 200 }, (_, n) => ({
    itemKey: `manual|beispiel-${n}`,
    foodId: null,
    labelDe:
      n % 5 === 0
        ? `Eintrag ${n + 1}: sehr langer eigener Eintrag mit vielen Wörtern, der sicher umbricht`
        : `Eintrag ${n + 1}`,
    amount: n % 3 === 0 ? null : 50 * ((n % 7) + 1),
    unit: n % 3 === 0 ? null : 'g',
    category: categories[n % categories.length] as ShoppingListItem['category'],
    isPantry: n % 9 === 0,
    isManual: n % 3 === 0,
    checked: n % 4 === 0,
    substituteFor: [],
    amountChanged: false,
    notInPlan: false,
  }));
  return listDocument({ ...base, items });
}

export interface NutritionPrintExample {
  /** Dateiname-Zusatz (nur a–z, 0–9, -). */
  readonly slug: string;
  readonly description: string;
  readonly document: () => PrintDocument;
}

export const NUTRITION_PRINT_EXAMPLES: readonly NutritionPrintExample[] = [
  {
    slug: 'vegetarisch-zahlen-an',
    description: 'Essensplan: Frau, vegetarisch, 4 Mahlzeiten, „Kalorienzahlen anzeigen“ an',
    document: () => planDocument(exampleWeek(), { showEnergyNumbers: true }),
  },
  {
    slug: 'zahlen-aus-name',
    description: 'Essensplan: mit Fleisch, „Kalorienzahlen anzeigen“ aus, Name auf dem Deckblatt',
    document: () =>
      planDocument(exampleWeek({}, { diet: 'omnivore', eatsPork: true }), {
        showEnergyNumbers: false,
        name: 'Kim Beispiel',
      }),
  },
  {
    slug: 'laktose-mealprep',
    description:
      'Essensplan: Unverträglichkeit Laktose (Ersatz-Hinweise, K4) und Meal-Prep mit 2 Kochtagen',
    document: () =>
      planDocument(
        exampleWeek(
          {},
          {
            diet: 'vegetarian',
            intolerances: ['lactose'],
            cookingMode: 'meal_prep',
            mealprepDays: 2,
            mealprepSlots: 'lunch_dinner',
          },
        ),
        { showEnergyNumbers: true },
      ),
  },
  {
    slug: 'schwangerschaft',
    description:
      'Essensplan: Schwangerschaft – keine Zahlen, auch wenn „Kalorienzahlen anzeigen“ an ist',
    document: () =>
      planDocument(exampleWeek({ healthFlags: { flags: ['pregnancy', 'conservative_plan'] } }), {
        showEnergyNumbers: true,
      }),
  },
  {
    slug: 'einkaufsliste',
    description:
      'Einkaufsliste der Woche: jeder dritte Eintrag abgehakt, eigener Eintrag, Vorrat am Ende',
    document: () => {
      const list = weekList(exampleWeek());
      const ticked = list.items
        .filter((_, i) => i % 3 === 0)
        .reduce((acc, item) => setShoppingItemChecked(acc, item.itemKey, true), list);
      return listDocument(addManualShoppingItem(ticked, { labelDe: 'Kaffee', category: 'drinks' }));
    },
  },
  {
    slug: 'belastungstest-essensplan',
    description:
      'Belastungstest: 8 Mahlzeiten, lange Titel, Rezept mit 20 Zutaten, 5 Mengen und 15 langen Schritten',
    document: extremePlanDocument,
  },
  {
    slug: 'belastungstest-einkaufsliste',
    description: 'Belastungstest: Einkaufsliste mit 200 Einträgen (teils lang), Vorrat, Häkchen',
    document: extremeListDocument,
  },
];

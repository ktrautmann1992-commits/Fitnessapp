import { expect, test, type Page } from '@playwright/test';

import { db, onboardNutrition, openNutrition, patchDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Etappe N9 im TESTMODUS (docs/PLAN-PHASE-5.md 19.7 N9, KONZEPT 6.9): Zutat antippen → „Austauschen“ → nur sichere
 * Alternativen (vegetarisch: nie Fleisch/Fisch; Pilze „mag ich nicht“) → Plan gespeichert, Zutat „(ausgetauscht)“,
 * Einkaufsliste angepasst, bedienbar ohne Netz, bleibt nach dem Neuladen; zurücknehmen; „Zahlen aus“ → keine kcal im
 * Dialog; vorgekochte Portionen (Kochtag vorbei) ohne Knopf. Beispiel-Rezepte und Austausch-Tabelle mit TESTWERTEN.
 * Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

interface StoredIngredient {
  index: number;
  foodId: string;
  swapped?: true;
}
interface StoredMeal {
  slot: string;
  recipeId: string;
  isFill: boolean;
  prepKind: 'cook' | 'leftover' | 'fresh';
  cookDate: string;
  ingredients: StoredIngredient[];
  ingredientSwaps?: { index: number; foodId: string; substituteFoodId: string }[];
}
interface StoredPlanRow {
  week_start: string;
  plan: { days: { date: string; meals: StoredMeal[] }[] };
}

const MONDAY = '2026-10-12';
/** Zutaten mit Einträgen in der Beispiel-Austausch-Tabelle (und Rolle in den Beispiel-Rezepten). */
const SWAP_SOURCES = ['tofu', 'reis', 'spaghetti', 'honig'];
const MEAT_OR_FISH = ['haehnchenbrust', 'lachs', 'hackfleisch-gemischt'];
/** Ersatz-Lebensmittel, die nicht als Vorrat eingeklappt sind. */
const NOT_PANTRY = ['huehnerei', 'spaghetti'];

async function planOf(page: Page): Promise<StoredPlanRow> {
  await expect
    .poll(async () =>
      (((await db(page)).rows.mealPlans ?? []) as StoredPlanRow[]).some(
        (p) => p.week_start === MONDAY,
      ),
    )
    .toBe(true);
  const rows = ((await db(page)).rows.mealPlans ?? []) as StoredPlanRow[];
  return rows.find((p) => p.week_start === MONDAY) as StoredPlanRow;
}

async function start(page: Page) {
  await onboardNutrition(page); // vegetarisch, Pilze „mag ich nicht“, Meal-Prep 2×
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await openNutrition(page);
  return planOf(page);
}

function recipeUrl(date: string, meal: StoredMeal): string {
  return `/rezept/${meal.recipeId}?tag=${date}&platz=${meal.slot}`;
}

/** Mahlzeiten ab heute mit einer Zutat aus der Austausch-Tabelle, die nicht schon vorgekocht ist. */
function candidates(row: StoredPlanRow) {
  return row.plan.days.flatMap((day) =>
    day.meals
      .filter(
        (m) =>
          !m.isFill && day.date >= MONDAY && !(m.prepKind === 'leftover' && m.cookDate < MONDAY),
      )
      .flatMap((meal) =>
        meal.ingredients
          .filter((i) => SWAP_SOURCES.includes(i.foodId))
          .map((ingredient) => ({ date: day.date, meal, ingredient })),
      ),
  );
}

test('Zutat austauschen: sichere Alternativen, ohne Netz, Plan + Einkaufsliste angepasst, Neuladen, zurücknehmen, Zahlen aus', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const stored = await start(page);
  const list = candidates(stored);
  expect(list.length).toBeGreaterThan(0);

  let chosen: { date: string; meal: StoredMeal; index: number; substitute: string } | null = null;
  for (const candidate of list.slice(0, 8)) {
    await page.goto(recipeUrl(candidate.date, candidate.meal));
    await expect(page.getByTestId('recipe-ingredients')).toBeVisible();
    const button = page.getByTestId(`recipe-swap-${candidate.ingredient.index}`);
    if ((await button.count()) === 0) continue;
    await button.click();
    await expect(page.getByTestId('ingredient-swap')).toBeVisible();
    await expect(page.getByTestId('ingredient-swap-current')).toBeVisible();
    if ((await page.getByTestId('ingredient-swap-empty').count()) > 0) continue;
    const options = await page
      .getByTestId('ingredient-swap-options')
      .locator('[data-testid^="ingredient-swap-option-"]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid') ?? ''));
    const ids = options.map((id) => id.replace('ingredient-swap-option-', ''));
    // Vegetarisch: nie Fleisch oder Fisch; Pilze „mag ich nicht“ ist nicht abschaltbar.
    for (const id of MEAT_OR_FISH) expect(ids).not.toContain(id);
    expect(ids).not.toContain('champignons');
    expect(ids.length).toBeGreaterThan(0);
    await expect(page.getByTestId('ingredient-swap')).toContainText('kcal');
    chosen = {
      date: candidate.date,
      meal: candidate.meal,
      index: candidate.ingredient.index,
      substitute: ids[0] as string,
    };
    break;
  }
  if (chosen === null) throw new Error('Austauschbare Zutat erwartet');

  // Ohne Netz bedienbar (Testmodus: Gerätespeicher).
  await page.context().setOffline(true);
  await page.getByTestId(`ingredient-swap-choose-${chosen.substitute}`).click();
  await expect(page.getByTestId('recipe')).toBeVisible();
  await expect(page.getByTestId('recipe-ingredients')).toContainText('(ausgetauscht)');
  await expect
    .poll(async () => {
      const row = await planOf(page);
      return row.plan.days
        .find((d) => d.date === chosen.date)
        ?.meals.find((m) => m.slot === chosen.meal.slot && !m.isFill)?.ingredientSwaps;
    })
    .toEqual([
      { index: chosen.index, foodId: expect.any(String), substituteFoodId: chosen.substitute },
    ]);
  await page.context().setOffline(false);

  // Nach dem Neuladen: Tausch bleibt (keine automatische Neuplanung).
  await page.goto(recipeUrl(chosen.date, chosen.meal));
  await expect(page.getByTestId('recipe-ingredients')).toContainText('(ausgetauscht)');
  const after = await planOf(page);
  const swappedMeal = after.plan.days
    .find((d) => d.date === chosen.date)
    ?.meals.find((m) => m.slot === chosen.meal.slot && !m.isFill);
  expect(swappedMeal?.ingredients.find((i) => i.index === chosen.index)).toMatchObject({
    foodId: chosen.substitute,
    swapped: true,
  });

  // Einkaufsliste aus dem geänderten Plan (W22).
  await page.goto(`/einkaufsliste?woche=${MONDAY}`);
  await expect(page.getByTestId('shopping-items')).toBeVisible();
  if (NOT_PANTRY.includes(chosen.substitute)) {
    // Vorrat (z. B. Reis, Zucker) ist eingeklappt – geprüft wird nur Frisches.
    await expect(
      page.locator(`[data-testid^="shopping-item-${chosen.substitute}|"]`).first(),
    ).toBeVisible();
  }

  // Zurücknehmen: Original wird angeboten.
  await page.goto(recipeUrl(chosen.date, chosen.meal));
  await page.getByTestId(`recipe-swap-${chosen.index}`).click();
  await expect(page.getByTestId('ingredient-swap')).toContainText('Original aus dem Rezept');

  // Zahlen aus → keine kcal im Austausch-Dialog (S12).
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: { ...(value.rows.nutritionSetup as object), show_energy_numbers: false },
    },
  }));
  await page.goto(
    `/rezept/austauschen?id=${chosen.meal.recipeId}&tag=${chosen.date}&platz=${chosen.meal.slot}&zutat=${chosen.index}`,
  );
  await expect(page.getByTestId('ingredient-swap-options')).toBeVisible();
  await expect(page.getByTestId('ingredient-swap')).not.toContainText('kcal');

  await page
    .getByTestId(`ingredient-swap-choose-${swappedMeal?.ingredientSwaps?.[0]?.foodId ?? ''}`)
    .click();
  await expect(page.getByTestId('recipe-ingredients')).not.toContainText('(ausgetauscht)');
  await expect
    .poll(async () => {
      const row = await planOf(page);
      return (
        row.plan.days
          .find((d) => d.date === chosen.date)
          ?.meals.find((m) => m.slot === chosen.meal.slot && !m.isFill)?.ingredientSwaps ?? []
      ).length;
    })
    .toBe(0);
});

test('Vorgekochte Portionen (Kochtag vorbei): kein „Austauschen“, auch nicht per direktem Aufruf', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const stored = await start(page);
  // Ein Rest, dessen Kochtag in dieser Woche liegt (z. B. Kochtag Mittwoch → Donnerstag aus dem Kühlschrank).
  const found = stored.plan.days
    .flatMap((day) => day.meals.map((meal) => ({ date: day.date, meal })))
    .find(
      ({ date, meal }) =>
        !meal.isFill &&
        meal.prepKind === 'leftover' &&
        meal.cookDate >= MONDAY &&
        date > meal.cookDate,
    );
  test.skip(found === undefined, 'Kein vorgekochtes Gericht im Beispiel-Plan.');
  if (found === undefined) return;
  // Vor dem Kochtag (heute Montag) ist die Rezeptansicht normal erreichbar.
  await page.goto(recipeUrl(found.date, found.meal));
  await expect(page.getByTestId('recipe-ingredients')).toBeVisible();
  // Am Tag des Rests (Kochtag vorbei): kein Knopf, direkter Aufruf meldet „schon vorgekocht“.
  await page.clock.setFixedTime(new Date(`${found.date}T09:00:00+02:00`));
  await page.goto(recipeUrl(found.date, found.meal));
  await expect(page.getByTestId('recipe-ingredients')).toBeVisible();
  await expect(page.locator('[data-testid^="recipe-swap-"]')).toHaveCount(0);
  await page.goto(
    `/rezept/austauschen?id=${found.meal.recipeId}&tag=${found.date}&platz=${found.meal.slot}&zutat=0`,
  );
  await expect(page.getByTestId('ingredient-swap-unavailable')).toContainText('vorgekocht');
});

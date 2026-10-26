import { expect, test, type Page } from '@playwright/test';

import { db, onboardNutrition, openNutrition } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Etappe N10 im TESTMODUS (docs/PLAN-PHASE-5.md 19.7 N10, KONZEPT 6.10): Nach dem Essen Daumen runter (mit Grund) →
 * die laufende Woche bleibt, „Andere Vorschläge“ plant ab heute ohne das Rezept; „Unverträglich“ → Dialog ohne
 * Vorauswahl, gespeichert nur „Daumen runter“ ohne Grund und die gewählte Zutat als „mag ich nicht“ (nie der Grund – nicht
 * im Gerätespeicher, nicht in der Adresse); Einstellungen → „Wieder zulassen“ und „Alle Bewertungen löschen“. Keine kcal
 * in der Bewertung. Beispiel-Rezepte mit TESTWERTEN. Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

interface StoredMeal {
  slot: string;
  recipeId: string;
  titleDe: string;
  isFill: boolean;
  prepKind: 'cook' | 'leftover' | 'fresh';
  cookDate: string;
  ingredients: { index: number; foodId: string }[];
}
interface StoredPlanRow {
  week_start: string;
  plan: { variant: number; days: { date: string; meals: StoredMeal[] }[] };
}
interface StoredRating {
  recipe_id: string;
  value: string;
  reason: string | null;
  rated_on: string;
}

const MONDAY = '2026-10-12';

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

/** Mahlzeiten von heute, die nicht schon vor heute gekocht wurden (die bleiben bei jeder Neuplanung fest). */
function todaysMeals(row: StoredPlanRow): StoredMeal[] {
  return (row.plan.days.find((d) => d.date === MONDAY)?.meals ?? []).filter(
    (m) => !m.isFill && !(m.prepKind === 'leftover' && m.cookDate < MONDAY),
  );
}

/** Vorkommen ab heute, ohne Reste, die schon vor heute gekocht wurden. */
function occurrences(row: StoredPlanRow, recipeId: string): string[] {
  return row.plan.days.flatMap((day) =>
    day.date < MONDAY
      ? []
      : day.meals
          .filter(
            (m) => m.recipeId === recipeId && !(m.prepKind === 'leftover' && m.cookDate < MONDAY),
          )
          .map((m) => `${day.date}|${m.slot}`),
  );
}

async function ratings(page: Page): Promise<StoredRating[]> {
  return ((await db(page)).rows.recipeRatings ?? []) as StoredRating[];
}

test('Daumen runter → Plan bleibt, „Andere Vorschläge“ ohne das Rezept; erst ab dem Tag der Mahlzeit; keine kcal', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const stored = await start(page);
  const meal = todaysMeals(stored)[0];
  if (meal === undefined) throw new Error('Mahlzeit von heute erwartet');

  // Ein Tag in der Zukunft: noch nicht bewertbar.
  const later = stored.plan.days.find((d) => d.date > MONDAY)?.meals.find((m) => !m.isFill);
  const laterDay = stored.plan.days.find((d) => d.date > MONDAY)?.date;
  if (later && laterDay) {
    await page.goto(`/rezept/${later.recipeId}?tag=${laterDay}&platz=${later.slot}`);
    await expect(page.getByTestId('rating-not-yet')).toBeVisible();
    await expect(page.getByTestId('rating-down')).toHaveCount(0);
  }

  await page.goto(`/rezept/${meal.recipeId}?tag=${MONDAY}&platz=${meal.slot}`);
  await expect(page.getByTestId('recipe-ingredients')).toBeVisible();
  await page.getByTestId('rating-down').click();
  await expect(page.getByTestId('rating')).toBeVisible();
  await expect(page.getByTestId('rating-recipe')).toContainText(meal.titleDe);
  // Keine Zahlen zu Energie in der Bewertung (auch mit „Kalorienzahlen anzeigen“ an).
  await expect(page.getByTestId('rating')).not.toContainText('kcal');
  await page.getByRole('radio', { name: 'Zu aufwendig' }).click();
  await expect(page.getByTestId('rating-reason-effect')).toContainText('15 Minuten');
  await page.getByTestId('rating-save').click();
  await expect(page.getByTestId('rating-done')).toBeVisible();
  await expect
    .poll(async () => ratings(page))
    .toEqual([
      expect.objectContaining({
        recipe_id: meal.recipeId,
        value: 'down',
        reason: 'effort',
        rated_on: MONDAY,
      }),
    ]);

  // Die laufende Woche bleibt (keine automatische Neuplanung durch eine Bewertung).
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('nutrition-meals')).toBeVisible();
  const after = await planOf(page);
  expect(after.plan.variant).toBe(stored.plan.variant);
  expect(occurrences(after, meal.recipeId)).toEqual(occurrences(stored, meal.recipeId));

  // Rezeptansicht zeigt die eigene Bewertung (bis wann) – „Andere Vorschläge“ plant ohne das Rezept.
  await page.goto(`/rezept/${meal.recipeId}?tag=${MONDAY}&platz=${meal.slot}`);
  await expect(page.getByTestId('rating-current')).toContainText('06.12.2026');
  await page.goto('/ernaehrung/woche');
  await page.getByTestId('nutrition-other').click();
  await page
    .getByTestId('dialog-other-suggestions')
    .getByRole('button', { name: 'Andere Vorschläge' })
    .click();
  await expect(page.getByTestId('nutrition-week-message')).toBeVisible();
  await expect.poll(async () => (await planOf(page)).plan.variant).toBe(stored.plan.variant + 1);
  expect(occurrences(await planOf(page), meal.recipeId)).toEqual([]);

  // Zurücknehmen.
  await page.goto(`/rezept/${meal.recipeId}?tag=${MONDAY}&platz=${meal.slot}`);
  // (Mahlzeit steht nach „Andere Vorschläge“ evtl. nicht mehr im Plan – dann über einen anderen Platz von heute.)
  if ((await page.getByTestId('rating-undo').count()) > 0) {
    await page.getByTestId('rating-undo').click();
    await expect(page.getByTestId('rating-message')).toContainText('zurückgenommen');
    await expect.poll(async () => ratings(page)).toEqual([]);
  }
});

test('„Unverträglich“: Dialog ohne Vorauswahl, Grund nie gespeichert; wieder zulassen und Bewertungen löschen', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const stored = await start(page);
  const meal = todaysMeals(stored)[0];
  if (meal === undefined) throw new Error('Mahlzeit von heute erwartet');

  await page.goto(`/rezept/${meal.recipeId}?tag=${MONDAY}&platz=${meal.slot}`);
  await page.getByTestId('rating-down').click();
  await page.getByRole('radio', { name: 'Unverträglich' }).click();
  await expect(page.getByTestId('rating-reason-effect')).toContainText('nicht gespeichert');
  // Der Grund steht nie in der Adresse.
  expect(page.url()).not.toMatch(/intoler|unvertr/i);
  await page.getByTestId('rating-save').click();

  // Dialog: alle Zutaten einzeln, NICHTS vorausgewählt, „Übernehmen“ erst nach einer Auswahl.
  await expect(
    page.getByRole('heading', { name: /Zutaten als „mag ich nicht“/ }).first(),
  ).toBeVisible();
  const boxes = page.locator('[data-testid^="rating-dislike-"]');
  const count = await boxes.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    await expect(boxes.nth(i)).toHaveAttribute('aria-checked', 'false');
  }
  await expect(page.getByTestId('rating-dislikes-apply')).toBeDisabled();
  // S4: klar, dass nur genau diese Lebensmittel ausgeschlossen werden – mit Weg ins Profil.
  await expect(page.getByTestId('rating-dislikes-health-hint')).toContainText('keine Spuren');
  await expect(page.getByTestId('rating-dislikes-profile')).toBeVisible();
  const firstId = ((await boxes.first().getAttribute('data-testid')) ?? '').replace(
    'rating-dislike-',
    '',
  );
  await boxes.first().click();
  await expect(boxes.first()).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('rating-dislikes-apply').click();
  await expect(page.getByTestId('rating-done')).toContainText('1 Zutat');
  expect(page.url()).not.toMatch(/intoler|unvertr/i);

  // Gerätespeicher: Daumen runter OHNE Grund, die eine Zutat als „mag ich nicht“ – nirgends „Unverträglich“.
  await expect
    .poll(async () => ratings(page))
    .toEqual([expect.objectContaining({ recipe_id: meal.recipeId, value: 'down', reason: null })]);
  const value = await db(page);
  expect(value.rows.foodDislikes).toEqual([expect.objectContaining({ food_id: firstId })]);
  expect(JSON.stringify(value.rows.recipeRatings)).not.toMatch(/intoler|unvertr/i);
  expect(JSON.stringify(value.rows.foodDislikes)).not.toMatch(/intoler|unvertr/i);
  // Abneigung wirkt: ab heute kein Rezept mit dieser Zutat (außer schon Gekochtem).
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('nutrition-meals')).toBeVisible();
  await expect
    .poll(async () =>
      (await planOf(page)).plan.days
        .filter((d) => d.date >= MONDAY)
        .flatMap((d) => d.meals)
        .filter((m) => !(m.prepKind === 'leftover' && m.cookDate < MONDAY))
        .some((m) => m.ingredients.some((i) => i.foodId === firstId)),
    )
    .toBe(false);

  // Einstellungen → Abgelehnte Lebensmittel: wieder zulassen; alle Bewertungen löschen.
  await page.goto('/settings');
  await page.getByTestId('settings-food-dislikes').click();
  await expect(page.getByTestId('food-dislikes')).toBeVisible();
  await expect(page.getByTestId(`food-dislike-${firstId}`)).toBeVisible();
  await page.getByTestId(`food-dislike-allow-${firstId}`).click();
  await expect(page.getByTestId('food-dislikes-empty')).toBeVisible();
  await expect.poll(async () => (await db(page)).rows.foodDislikes).toEqual([]);
  await page.getByTestId('food-dislikes-delete-ratings').click();
  await page
    .getByTestId('food-dislikes-confirm')
    .getByRole('button', { name: 'Alle Bewertungen löschen' })
    .click();
  await expect(page.getByTestId('food-dislikes-no-ratings')).toBeVisible();
  await expect.poll(async () => ratings(page)).toEqual([]);
});

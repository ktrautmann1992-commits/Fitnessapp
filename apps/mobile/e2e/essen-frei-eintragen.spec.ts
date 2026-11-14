import { mkdirSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { db, onboardNutrition } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Freies Eintragen (Gründer-Rückmeldung Testphase 14.11.2026, docs/PLAN-ESSEN-FREI-EINTRAGEN.md) im TESTMODUS mit dem
 * echten Katalog: Frühstück → „Etwas anderes gegessen“ → Suche „Käse“ → Gouda 2 Scheiben + Vollkornbrot 1 Scheibe in
 * „Deine Mahlzeit“ → alle eintragen → Frühstück gilt als ersetzt → „Als Favorit speichern“ („Käsebrot“) → am nächsten
 * Tag mit einem Tipp eintragen. Fester Start: Montag, 12.10.2026, 9 Uhr.
 *
 * Bildschirmfotos (390 × 844, Faktor 2) nur, wenn SCREENSHOT_DIR gesetzt ist – nicht eingecheckt.
 */

interface StoredEntry {
  eaten_on: string;
  slot: string;
  source: string;
  food_id: string | null;
  custom_meal_id: string | null;
  amount: number | null;
  unit: string | null;
}

interface StoredMeal {
  id: string;
  name_de: string;
  mode: string;
  servings: number;
}

interface StoredMealItem {
  custom_meal_id: string;
  food_id: string;
  amount: number;
  unit: string;
}

async function entries(page: Page): Promise<StoredEntry[]> {
  return ((await db(page)).rows.foodLogEntries ?? []) as StoredEntry[];
}

async function customMeals(page: Page): Promise<StoredMeal[]> {
  return ((await db(page)).rows.customMeals ?? []) as StoredMeal[];
}

async function customMealItems(page: Page): Promise<StoredMealItem[]> {
  return ((await db(page)).rows.customMealItems ?? []) as StoredMealItem[];
}

const SHOTS = process.env.SCREENSHOT_DIR;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('Etwas anderes gegessen: Käse + Brot zusammenstellen, eintragen, als Favorit, nächster Tag ein Tipp', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await onboardNutrition(page, { forceDemo: false });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('nutrition-meals')).toBeVisible();

  // 1. Frühstück: zwei klare Möglichkeiten.
  const planned = page.getByTestId('eaten-breakfast');
  const other = page.getByTestId('eaten-other-breakfast');
  await expect(planned).toHaveText('Wie geplant gegessen');
  await expect(other).toHaveText('Etwas anderes gegessen');
  await other.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -260));
  await shot(page, 'slot');
  await other.click();

  // 2. „Eintragen“ für genau dieses Frühstück, Suche vorausgewählt.
  await expect(page.getByTestId('food-log-entry')).toBeVisible();
  await expect(page.getByTestId('food-log-other-notice')).toContainText('Frühstück');
  await page.getByTestId('food-log-search-input').fill('Käse');
  await expect(page.getByTestId('food-log-food-gouda')).toBeVisible();
  for (const id of ['gouda-light-scheiben', 'feta', 'parmesan', 'harzer-kaese', 'halloumi']) {
    await expect(page.getByTestId(`food-log-food-${id}`)).toBeVisible();
  }
  // Ohne Umlaut dasselbe.
  await page.getByTestId('food-log-search-input').fill('kase');
  await expect(page.getByTestId('food-log-food-gouda')).toBeVisible();
  // Fehlt im Katalog (Emmentaler): unter eigenem Namen auffindbar, gerechnet wie Gouda (Richtwert).
  await page.getByTestId('food-log-search-input').fill('Emmentaler');
  await page.getByTestId('food-log-food-emmentaler').click();
  await expect(page.getByTestId('food-log-stand-in')).toContainText('Werten von Gouda');
  await expect(page.getByTestId('food-log-amount-grams')).toHaveText('≈ 25 g · Richtwert');
  await page.getByTestId('food-log-search-input').fill('Käse');
  await page
    .getByTestId('food-log-search-input')
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -120));
  await shot(page, 'suche');

  // 3. Gouda: Scheibe ist vorausgewählt, „2“ → ≈ 50 g → zur Mahlzeit.
  await page.getByTestId('food-log-food-gouda').click();
  const picker = page.getByTestId('food-log-amount-picker');
  await expect(picker.getByTestId('food-log-unit-slice')).toBeChecked();
  await picker.getByTestId('food-log-count-2').click();
  await expect(page.getByTestId('food-log-amount')).toHaveValue('2');
  await expect(page.getByTestId('food-log-amount-grams')).toHaveText('≈ 50 g · Richtwert');
  await page.getByTestId('food-log-food-basket').click();
  await expect(page.getByTestId('food-log-basket-item-0')).toHaveText('2 Scheiben Gouda');

  // 4. Brot: 1 Scheibe Vollkornbrot (Vorauswahl) → zur Mahlzeit.
  await expect(page.getByTestId('food-log-search-input')).toHaveValue('');
  await page.getByTestId('food-log-search-input').fill('Brot');
  await page.getByTestId('food-log-food-vollkornbrot').click();
  await expect(page.getByTestId('food-log-amount')).toHaveValue('1');
  await page.getByTestId('food-log-food-basket').click();
  await expect(page.getByTestId('food-log-basket-item-1')).toHaveText('1 Scheibe Vollkornbrot');
  await expect(page.getByTestId('food-log-basket-name')).toHaveValue('Käsebrot');
  await page.getByTestId('food-log-basket').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -80));
  await shot(page, 'korb');

  // 5. Alle auf einmal eintragen: je Lebensmittel ein Eintrag, Platz Frühstück, in Gramm.
  await page.getByTestId('food-log-basket-submit').click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText(
    '2 Lebensmittel eingetragen.',
  );
  await expect
    .poll(async () =>
      (await entries(page)).map((e) => [e.eaten_on, e.slot, e.source, e.food_id, e.amount, e.unit]),
    )
    .toEqual([
      ['2026-10-12', 'breakfast', 'food', 'gouda', 50, 'g'],
      ['2026-10-12', 'breakfast', 'food', 'vollkornbrot', 45, 'g'],
    ]);

  // 6. Als Favorit speichern (Name vorgeschlagen) → eigenes Gericht „Aus Zutaten“.
  await page.getByTestId('food-log-basket-favorite').click();
  await expect(page.getByTestId('food-log-entry-message')).toContainText(
    'Als Favorit gespeichert: Käsebrot',
  );
  await expect
    .poll(async () => (await customMeals(page)).map((m) => [m.name_de, m.mode, m.servings]))
    .toEqual([['Käsebrot', 'ingredients', 1]]);
  expect((await customMealItems(page)).map((i) => [i.food_id, i.amount, i.unit]).sort()).toEqual([
    ['gouda', 50, 'g'],
    ['vollkornbrot', 45, 'g'],
  ]);

  // 7. Tagesübersicht: Frühstück ist ersetzt – nicht offen, nicht „wie geplant“.
  await page.goto('/ernaehrung');
  const replaced = page.getByTestId('eaten-replaced-breakfast');
  await expect(replaced).toContainText('Etwas anderes gegessen:');
  await expect(replaced).toContainText('Gouda');
  await expect(replaced).toContainText('Vollkornbrot');
  await expect(page.getByTestId('eaten-breakfast')).toHaveCount(0);

  // 8. Nächster Tag: „Käsebrot“ steht oben unter „Deine Favoriten“ – ein Tipp trägt es ein.
  await page.clock.setFixedTime(new Date('2026-10-13T08:00:00+02:00'));
  await page.goto('/ernaehrung/eintragen?tag=2026-10-13&platz=breakfast&anders=1');
  const favorites = page.getByTestId('food-log-quick-favorites');
  await expect(favorites).toContainText('Käsebrot');
  await favorites.getByRole('button', { name: 'Käsebrot eintragen' }).click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText('Eingetragen: Käsebrot');
  await expect
    .poll(async () =>
      (await entries(page))
        .filter((e) => e.eaten_on === '2026-10-13')
        .map((e) => [e.slot, e.source, e.custom_meal_id !== null]),
    )
    .toEqual([['breakfast', 'custom_meal', true]]);
  // „Zuletzt gegessen“ bietet die Lebensmittel vom Vortag ebenfalls mit einem Tipp an.
  await expect(page.getByTestId('food-log-quick-recent')).toContainText('Gouda');
});

test('Bowl: Joghurt 1 Becher + Haferflocken 2 EL + Banane 1 Stück + Mandeln 1 Handvoll, Favorit, ein Tipp', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await onboardNutrition(page, { forceDemo: false });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await page.goto('/ernaehrung/eintragen?tag=2026-10-12&platz=breakfast&anders=1');
  await expect(page.getByTestId('food-log-entry')).toBeVisible();

  // Je Zutat: suchen → antippen → (Anzahl) → „Zur Mahlzeit“. Einheit ist passend vorausgewählt.
  const add = async (query: string, id: string, unit: string, count?: string) => {
    await page.getByTestId('food-log-search-input').fill(query);
    await page.getByTestId(`food-log-food-${id}`).click();
    await expect(page.getByTestId(`food-log-unit-${unit}`)).toBeChecked();
    if (count) await page.getByTestId(`food-log-count-${count}`).click();
    await expect(page.getByTestId('food-log-amount-grams')).toContainText('Richtwert');
    await page.getByTestId('food-log-food-basket').click();
  };
  await add('Joghurt', 'joghurt-1-5', 'cup');
  await add('Haferflocken', 'haferflocken', 'tbsp', '2');
  await add('Banane', 'banane', 'piece');
  await add('Mandeln', 'mandeln', 'handful');
  const basket = page.getByTestId('food-log-basket');
  await expect(basket).toContainText('1 Becher Joghurt 1,5 %');
  await expect(basket).toContainText('2 EL Haferflocken');
  await expect(basket).toContainText('1 Stück Banane');
  await expect(basket).toContainText('1 Handvoll Mandeln');
  await expect(page.getByTestId('food-log-basket-name')).toHaveValue('Joghurt-Bowl');

  await page.getByTestId('food-log-basket-submit').click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText(
    '4 Lebensmittel eingetragen.',
  );
  await expect
    .poll(async () => (await entries(page)).map((e) => [e.food_id, e.amount, e.unit]))
    .toEqual([
      ['joghurt-1-5', 150, 'g'],
      ['haferflocken', 16, 'g'],
      ['banane', 120, 'g'],
      ['mandeln', 25, 'g'],
    ]);
  await page.getByTestId('food-log-basket-favorite').click();
  await expect(page.getByTestId('food-log-entry-message')).toContainText(
    'Als Favorit gespeichert: Joghurt-Bowl',
  );

  // Später am Tag (Snack) mit einem Tipp nochmal.
  await page.goto('/ernaehrung/eintragen?tag=2026-10-12&platz=other');
  await page
    .getByTestId('food-log-quick-favorites')
    .getByRole('button', { name: 'Joghurt-Bowl eintragen' })
    .click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText('Eingetragen: Joghurt-Bowl');
  await expect.poll(async () => (await entries(page)).length).toBe(5);
});

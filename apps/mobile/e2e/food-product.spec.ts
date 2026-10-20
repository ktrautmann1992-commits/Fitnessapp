import { expect, test, type Page } from '@playwright/test';

import { db, onboardNutrition, openNutrition, patchDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Etappe E4a im TESTMODUS mit Attrappe (docs/PLAN-E4.md 8.5, „So testest du es am Handy“): Ernährung → Eintragen →
 * „Produkt (Barcode)“ → Testnummer → Produktansicht mit Quelle → 1 Portion → Eintragen (Herkunft product) →
 * Tagessumme; „Werte prüfen“ nur mit Haken; unbrauchbar/nicht gefunden → eigenes Produkt (vorausgefüllt) →
 * eintragen; Ladencode; offline; „Kalorienzahlen aus“ ohne kcal; testIDs ohne Nummer/Name/Marke; Seite „Lizenzen und
 * Quellen“. Keine echten Netzaufrufe (die Attrappe läuft im Gerät). Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

interface StoredEntry {
  source: string;
  product_code: string | null;
  user_product_id: string | null;
  title_de: string;
  amount: number | null;
  unit: string | null;
  kcal: number | null;
}

const entries = async (page: Page) => ((await db(page)).rows.foodLogEntries ?? []) as StoredEntry[];
const ownProducts = async (page: Page) =>
  ((await db(page)).rows.userFoodProducts ?? []) as { id: string; name_de: string }[];

async function start(page: Page) {
  await onboardNutrition(page);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await openNutrition(page);
}

async function openProduct(page: Page) {
  await page.getByTestId('food-log').getByTestId('food-log-add').click();
  await expect(page.getByTestId('food-log-entry')).toBeVisible();
  await page.getByTestId('food-log-product').click();
  await expect(page.getByTestId('food-product')).toBeVisible();
}

async function testCode(page: Page, key: string) {
  await page.getByTestId(`food-product-testcode-${key}`).click();
  await page.getByTestId('food-product-search').click();
}

/**
 * Kein testID enthält eine der benutzten Nummern (alle Testnummern beginnen mit 400999900), einen Produktnamen oder eine
 * Marke. (Nicht pauschal „8 Ziffern“: testIDs anderer Bildschirme enthalten zufällige UUIDs.)
 */
async function testIdsClean(page: Page) {
  const ids = await page.$$eval('[data-testid]', (nodes) =>
    nodes.map((n) => n.getAttribute('data-testid') ?? ''),
  );
  expect(ids.length).toBeGreaterThan(10);
  for (const id of ids) {
    expect(id).not.toMatch(/400999900|4000000000010|2012345678903/);
    expect(id).not.toMatch(/Testprodukt|Testmarke|Müsli|Hofjoghurt/i);
  }
}

test('Produkt per Nummer: gefunden, Quelle, 1 Portion eintragen, Tagessumme; Werte prüfen nur mit Haken', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await start(page);
  await openProduct(page);

  // Falsche Prüfziffer → Hinweis, keine Abfrage.
  await page.getByTestId('food-product-code').fill('4000000000010');
  await page.getByTestId('food-product-search').click();
  await expect(page.getByTestId('food-product-state')).toHaveText(
    'Die Nummer stimmt nicht – bitte noch einmal abtippen.',
  );
  // Ladencode (Waage/Frischetheke) → Suche statt Produkt.
  await page.getByTestId('food-product-code').fill('2012345678903');
  await page.getByTestId('food-product-search').click();
  await expect(page.getByTestId('food-product-state')).toContainText('gilt nur im Laden');

  // Plausibles Testprodukt.
  await testCode(page, 'plausibel');
  await expect(page.getByTestId('food-product-card')).toContainText(
    'Testprodukt Müsli (Testwerte)',
  );
  await expect(page.getByTestId('food-product-mock')).toContainText('Attrappe');
  await expect(page.getByTestId('food-product-nutrients')).toContainText('380 kcal');
  await expect(page.getByTestId('food-product-source')).toContainText(
    'Produktdaten: Open Food Facts (openfoodfacts.org), Lizenz ODbL 1.0',
  );
  await expect(page.getByTestId('food-product-card')).not.toContainText(/Nutri-Score/i);
  await expect(page.locator('img')).toHaveCount(0);
  await testIdsClean(page);

  // Attrappe: kein Link zu Open Food Facts (ausgedachte Testnummern); der Lizenz-Link führt zu „Lizenzen und Quellen“.
  await expect(page.getByTestId('food-product-off-link')).toHaveCount(0);
  await expect(page.getByTestId('food-product-license')).toBeVisible();

  await page.getByTestId('food-product-amount-serving').click();
  await expect(page.getByTestId('food-product-amount')).toHaveValue('50');
  await page.getByTestId('food-product-add').click();
  await expect(page.getByTestId('food-product-message')).toHaveText('Eingetragen.');
  const saved = await entries(page);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ source: 'product', amount: 50, unit: 'g', kcal: 190 });
  expect(saved[0]?.product_code).toMatch(/^\d{13}$/);

  // Die Nummer steht nie in der Adresse.
  expect(page.url()).not.toMatch(/400999900/);

  // „Werte prüfen“: Eintragen erst mit Haken.
  await testCode(page, 'pruefen');
  await expect(page.getByTestId('food-product-review')).toBeVisible();
  await expect(page.getByTestId('food-product-add')).toBeDisabled();
  await page.getByTestId('food-product-review-confirm').click();
  await page.getByTestId('food-product-amount-serving').click();
  await page.getByTestId('food-product-add').click();
  await expect(page.getByTestId('food-product-message')).toHaveText('Eingetragen.');
  expect(await entries(page)).toHaveLength(2);

  // Zeitlimit der Attrappe → „nicht erreichbar“, eigenes Produkt als Ausweg.
  await testCode(page, 'zeitlimit');
  await expect(page.getByTestId('food-product-state')).toContainText('nicht erreichbar');
  await expect(page.getByTestId('food-product-create-own')).toBeVisible();

  // Tagessumme: 190 + 75 kcal.
  await page.getByTestId('food-product-done').click();
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('food-log-summary')).toContainText('2 Einträge');
  await expect(page.getByTestId('food-log-summary')).toContainText('265 kcal');
});

test('Unbekannt und unbrauchbar: eigenes Produkt anlegen und eintragen; offline geht nur das eigene', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  await start(page);
  await openProduct(page);

  // Unbrauchbar → kein Eintragen, eigenes Produkt mit Name/Marke/Nummer vorausgefüllt.
  await testCode(page, 'unbrauchbar');
  await expect(page.getByTestId('food-product-blocked')).toBeVisible();
  await expect(page.getByTestId('food-product-add')).toHaveCount(0);
  await page.getByTestId('food-product-create-own').click();
  await expect(page.getByTestId('user-product-name')).toHaveValue(
    'Testprodukt ohne Nährwerte (Testwerte)',
  );
  await expect(page.getByTestId('user-product-code')).not.toHaveValue('');
  await page.getByTestId('user-product-cancel').click();

  // Nicht gefunden → eigenes Produkt anlegen.
  await testCode(page, 'nicht_gefunden');
  await expect(page.getByTestId('food-product-state')).toHaveText(
    'Dieses Produkt kennen wir noch nicht.',
  );
  await page.getByTestId('food-product-create-own').click();
  await expect(page.getByTestId('user-product-code')).not.toHaveValue('');
  await page.getByTestId('user-product-name').fill('Hofjoghurt');
  await page.getByTestId('user-product-kcal').fill('70');
  await page.getByTestId('user-product-protein_g').fill('4');
  await page.getByTestId('user-product-carbs_g').fill('5');
  await page.getByTestId('user-product-fat_g').fill('3.5');
  await page.getByTestId('user-product-serving_g').fill('150');
  await page.getByTestId('user-product-save').click();
  await expect(page.getByTestId('food-product-message')).toHaveText('Produkt gespeichert.');
  await expect.poll(async () => (await ownProducts(page)).length).toBe(1);
  await expect(page.getByTestId('food-product-amount')).toHaveValue('150');
  await page.getByTestId('food-product-add').click();
  await expect(page.getByTestId('food-product-message')).toHaveText('Eingetragen.');
  const saved = await entries(page);
  expect(saved[0]).toMatchObject({ source: 'product', amount: 150, kcal: 105, product_code: null });
  expect(saved[0]?.user_product_id).toBe((await ownProducts(page))[0]?.id);
  await testIdsClean(page);

  // Offline: Abfrage geht nicht, das eigene Produkt mit derselben Nummer schon (ohne Server).
  await context.setOffline(true);
  await testCode(page, 'plausibel');
  await expect(page.getByTestId('food-product-message')).toContainText('brauchst du Internet');
  await testCode(page, 'nicht_gefunden');
  await expect(page.getByText('Dein eigenes Produkt mit dieser Nummer:')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hofjoghurt' })).toBeVisible();
  await context.setOffline(false);

  // Verwaltung: Ernährung → Eigene Gerichte → „Eigene Produkte“.
  await page.goto('/ernaehrung/produkte');
  await expect(page.getByTestId('user-products-count')).toHaveText('1 von 200 Produkten');
  await expect(page.getByTestId('user-products-list')).toContainText('Hofjoghurt');
});

test('Kalorienzahlen aus: keine kcal im DOM, kein eigenes Produkt; Lizenzen und Quellen', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await start(page);
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: { ...(value.rows.nutritionSetup as object), show_energy_numbers: false },
    },
  }));
  await page.goto('/ernaehrung/produkt');
  await expect(page.getByTestId('food-product')).toBeVisible();
  await testCode(page, 'plausibel');
  await expect(page.getByTestId('food-product-card')).toContainText('Nährwerte ausgeblendet');
  await expect(page.getByTestId('food-product-nutrients')).toHaveCount(0);
  await expect(page.getByTestId('food-product-edit-values')).toHaveCount(0);
  expect(await page.content()).not.toMatch(/kcal/);
  await page.getByTestId('food-product-amount-serving').click();
  await page.getByTestId('food-product-add').click();
  await expect(page.getByTestId('food-product-message')).toHaveText('Eingetragen.');
  expect(await page.content()).not.toMatch(/kcal/);

  // Unbekannt → eigenes Produkt geht bei „Zahlen aus“ nicht (E4-G8).
  await testCode(page, 'nicht_gefunden');
  await page.getByTestId('food-product-create-own').click();
  await expect(page.getByTestId('user-product-numbers-off')).toBeVisible();
  await expect(page.getByTestId('user-product-form')).toHaveCount(0);
  expect(await page.content()).not.toMatch(/kcal/);

  // Lizenzen und Quellen (Einstellungen).
  await page.goto('/settings');
  await page.getByTestId('settings-licenses').click();
  await expect(page.getByTestId('licenses-off')).toContainText('Open Database License (ODbL 1.0');
  await expect(page.getByTestId('licenses-off')).toContainText('DbCL 1.0');
  await expect(page.getByTestId('licenses-bls')).toContainText('Bundeslebensmittelschlüssel');
  await expect(page.getByTestId('licenses-software')).toContainText('zxing-cpp');
  await expect(page.getByTestId('licenses-software')).toContainText('Apache 2.0');
  await expect(page.getByTestId('licenses-fonts')).toContainText('Plus Jakarta Sans');
  await expect(page.getByTestId('licenses-fonts')).toContainText('Open Font License');
});

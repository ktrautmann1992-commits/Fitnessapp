import { MOCK_PRODUCT_CASES } from '@fitnessapp/core';
import { expect, test, type Page } from '@playwright/test';

import { fakeCamera } from './camera-helpers';
import { db, onboardNutrition, openNutrition, patchDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Einkaufen · Etappe E1 im TESTMODUS (docs/PLAN-EINKAUFEN-AUSDAUER.md 3, EA-1 bis EA-3): Menüknopf „Einkaufen“
 * (Adresse /einkaufsliste), Abhaken bleibt nach dem Neuladen, „Alle Haken zurücksetzen“, eigener Artikel mit Menge,
 * Scannen im Laden (Kamera-Ersatz wie food-product-scan.spec.ts): eindeutiger Treffer sofort abgehakt mit „Rückgängig“,
 * mehrere → Auswahl, nicht auf der Liste → „Zusätzlich hinzufügen?“, nicht erkannt → Auswahl aus den offenen Einträgen,
 * Einkaufen ohne Essensplan. Beispiel-Rezepte mit TESTWERTEN. Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

const NOT_FOUND = MOCK_PRODUCT_CASES.find((c) => c.key === 'nicht_gefunden')?.code ?? '';
const TIMEOUT = MOCK_PRODUCT_CASES.find((c) => c.key === 'zeitlimit')?.code ?? '';

const tabBar = (page: Page) => page.getByRole('tablist', { name: 'Hauptmenü' });
const tab = (page: Page, name: string) => tabBar(page).getByRole('tab', { name, exact: true });

interface StoredItem {
  itemKey: string;
  labelDe: string;
  checked: boolean;
  isManual: boolean;
  amount: number | null;
  unit: string | null;
}

async function items(page: Page): Promise<StoredItem[]> {
  const lists = ((await db(page)).rows.shoppingLists ?? []) as { list: { items: StoredItem[] } }[];
  return lists.flatMap((l) => l.list.items);
}

async function startWithPlan(page: Page) {
  await onboardNutrition(page);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await openNutrition(page);
}

async function openShoppingTab(page: Page) {
  await tab(page, 'Einkaufen').click();
  await expect(page).toHaveURL(/\/einkaufsliste$/);
  await expect(page.getByTestId('shopping-list')).toBeVisible();
  await heading(page, 'Einkaufen');
}

async function addOwn(page: Page, label: string, quantity = '') {
  await page.getByTestId('shopping-add-label').fill(label);
  await page.getByTestId('shopping-add-quantity').fill(quantity);
  await page.getByTestId('shopping-add').click();
}

const item = (page: Page, key: string) => page.getByTestId(`shopping-check-${key}`);

test('Menüleiste mit „Einkaufen“, Abhaken bleibt nach dem Neuladen, alle Haken zurücksetzen, eigener Artikel mit Menge', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await startWithPlan(page);
  // EA-1 + Workouts: Übersicht · Training · Workouts · Ernährung · Einkaufen · Mehr – „Fortschritt“ unter „Mehr“.
  for (const name of ['Übersicht', 'Training', 'Workouts', 'Ernährung', 'Einkaufen', 'Mehr']) {
    await expect(tab(page, name)).toBeVisible();
  }
  await expect(tab(page, 'Fortschritt')).toHaveCount(0);
  await expect(tabBar(page).getByRole('tab')).toHaveCount(6);
  await openShoppingTab(page);
  await expect(tab(page, 'Einkaufen')).toHaveAttribute('aria-selected', 'true');
  // Reiter: keine „Zurück“-Leiste.
  await expect(page.getByRole('button', { name: 'Zurück', exact: true })).toHaveCount(0);

  // Abhaken, neu laden → Häkchen bleibt.
  const box = page.getByTestId('shopping-items').getByRole('checkbox').first();
  await box.click();
  await expect(box).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await items(page)).filter((i) => i.checked).length).toBe(1);
  await page.reload();
  await expect(page.getByTestId('shopping-items').getByRole('checkbox').first()).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // Alle Haken zurücksetzen (mit Rückfrage).
  await page.getByTestId('shopping-uncheck-all').click();
  await page.getByRole('button', { name: 'Zurücksetzen', exact: true }).click();
  await expect(page.getByTestId('shopping-message')).toContainText('zurückgesetzt');
  await expect.poll(async () => (await items(page)).filter((i) => i.checked).length).toBe(0);
  await expect(page.getByTestId('shopping-uncheck-all')).toHaveCount(0);

  // Eigener Artikel mit Menge; unverständliche Menge → Hinweis.
  await addOwn(page, 'Spülmittel', 'viel');
  await expect(page.getByText('Diese Menge verstehen wir nicht')).toBeVisible();
  await addOwn(page, 'Kaffee', '500 g');
  await expect(item(page, 'manual|kaffee')).toContainText('500 g Kaffee');
  expect((await items(page)).find((i) => i.itemKey === 'manual|kaffee')).toMatchObject({
    amount: 500,
    unit: 'g',
    isManual: true,
  });
  await page.getByTestId('shopping-remove-manual|kaffee').click();
  await expect(item(page, 'manual|kaffee')).toHaveCount(0);

  // „Fortschritt“ über „Mehr“.
  await tab(page, 'Mehr').click();
  await page.getByTestId('more-area-fortschritt').click();
  await heading(page, 'Fortschritt');
  // Kein Knopf markiert (Bereich ohne Knopf).
  await expect(tabBar(page).locator('[aria-selected="true"]')).toHaveCount(0);
});

test('Scannen im Laden: nicht auf der Liste → hinzufügen; Treffer → abgehakt mit „Rückgängig“; mehrere → Auswahl', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await fakeCamera(page, { camera: 'canvas', builtInDetector: true });
  await startWithPlan(page);
  await openShoppingTab(page);

  // 1. „Testprodukt Müsli“ steht nicht auf der Liste → „Zusätzlich hinzufügen?“ (Name vorbefüllt, abgehakt).
  await page.getByTestId('shopping-scan').click();
  await expect(page.getByTestId('shopping-scan-not-on-list')).toContainText(
    'steht nicht auf deiner Liste',
  );
  await expect(page.getByTestId('shopping-scan-name')).toHaveValue('Testprodukt Müsli (Testwerte)');
  await page.getByTestId('shopping-scan-add-yes').click();
  await expect(page.getByTestId('shopping-scan-feedback')).toContainText(
    'hinzugefügt und abgehakt',
  );
  await expect
    .poll(async () => (await items(page)).find((i) => i.labelDe.startsWith('Testprodukt'))?.checked)
    .toBe(true);

  // 2. Eigener Eintrag „Müsli“ (offen) → Scan hakt ihn sofort ab, „Rückgängig“ macht ihn wieder offen.
  await addOwn(page, 'Müsli');
  await page.getByTestId('shopping-scan').click();
  await expect(page.getByTestId('shopping-scan-feedback')).toContainText('✓ Müsli abgehakt');
  await expect(item(page, 'manual|müsli')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('shopping-scan-undo').click();
  await expect(page.getByTestId('shopping-scan-feedback')).toContainText('Müsli ist wieder offen.');
  await expect(item(page, 'manual|müsli')).toHaveAttribute('aria-checked', 'false');

  // 3. Zwei gleich gute Einträge → Auswahl; die Wahl wird abgehakt.
  await addOwn(page, 'Bio-Müsli');
  await page.getByTestId('shopping-scan').click();
  const choose = page.getByTestId('shopping-scan-choose');
  await expect(choose).toContainText('Welcher Eintrag ist es?');
  await expect(choose.getByRole('button', { name: /^Abhaken:/ })).toHaveCount(2);
  await page.getByTestId('shopping-scan-pick-manual|bio-müsli').click();
  await expect(page.getByTestId('shopping-scan-feedback')).toContainText('✓ Bio-Müsli abgehakt');
  await expect(item(page, 'manual|bio-müsli')).toHaveAttribute('aria-checked', 'true');
  await expect(item(page, 'manual|müsli')).toHaveAttribute('aria-checked', 'false');
});

test('Nicht erkannt: Nummer eintippen → Auswahl aus den offenen Einträgen oder eigener Artikel; Kamera verweigert → Nummer', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await fakeCamera(page, { camera: 'denied', builtInDetector: true });
  await startWithPlan(page);
  await openShoppingTab(page);
  await page.getByTestId('shopping-scan').click();
  await expect(page.getByTestId('shopping-scan-denied')).toContainText('Kamera-Erlaubnis');
  await page.getByTestId('shopping-scan-code').fill(NOT_FOUND);
  await page.getByTestId('shopping-scan-search').click();
  const unknown = page.getByTestId('shopping-scan-unknown');
  await expect(unknown).toContainText('Produkt nicht erkannt');
  await expect(unknown).toContainText('Dieses Produkt kennen wir noch nicht.');
  const pick = unknown.getByRole('button', { name: /^Abhaken:/ }).first();
  const label = ((await pick.getAttribute('aria-label')) ?? '').replace('Abhaken: ', '');
  await pick.click();
  await expect(page.getByTestId('shopping-scan-feedback')).toContainText(`✓ ${label} abgehakt`);

  // Die Wahl wurde gelernt (Einwilligung vorhanden): derselbe Strichcode erkennt den Eintrag jetzt ohne Abfrage.
  await page.getByTestId('shopping-scan-type').click();
  await page.getByTestId('shopping-scan-testcode-nicht_gefunden').click();
  await expect(page.getByTestId('shopping-scan-feedback')).toContainText(
    `${label} ist schon abgehakt.`,
  );
  expect(
    ((await db(page)).rows.shoppingProductLinks as { code: string }[]).map((l) => l.code),
  ).toEqual([NOT_FOUND]);

  // Abfrage klappt nicht (Zeitlimit) → eigener Artikel.
  await page.getByTestId('shopping-scan-type').click();
  await page.getByTestId('shopping-scan-code').fill(TIMEOUT);
  await page.getByTestId('shopping-scan-search').click();
  await expect(page.getByTestId('shopping-scan-unknown')).toContainText('klappt gerade nicht');
  await page.getByTestId('shopping-scan-own').click();
  await page.getByTestId('shopping-scan-name').fill('Tee');
  await page.getByTestId('shopping-scan-add-yes').click();
  await expect(page.getByTestId('shopping-scan-feedback')).toContainText('Tee hinzugefügt');
  await expect(item(page, 'manual|tee')).toHaveAttribute('aria-checked', 'true');
});

test('Einkaufen ohne Essensplan (EA-2): eigene Artikel, Abhaken und Scanner gehen trotzdem', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await startWithPlan(page);
  // Ernährung nicht eingerichtet → kein Plan.
  // Zweimal: Ein automatisches Speichern kurz vor dem Neuladen könnte die erste Änderung überschreiben.
  for (let i = 0; i < 2; i += 1) {
    await patchDb(page, (value) => ({
      ...value,
      rows: { ...value.rows, nutritionSetup: null, shoppingLists: [], mealPlans: [] },
    }));
    await heading(page, 'Heute');
  }
  expect((await db(page)).rows.nutritionSetup).toBeNull();
  await openShoppingTab(page);
  await expect(page.getByTestId('shopping-planless')).toContainText('keinen Essensplan');
  await expect(page.getByTestId('shopping-range-toggle')).toHaveCount(0);
  await addOwn(page, 'Brot', '1');
  await expect(item(page, 'manual|brot')).toContainText('1 Stück Brot');
  await item(page, 'manual|brot').click();
  await expect(item(page, 'manual|brot')).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(item(page, 'manual|brot')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('shopping-scan-type')).toBeVisible();
});

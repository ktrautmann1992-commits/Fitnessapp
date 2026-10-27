import { expect, test, type Page } from '@playwright/test';

import {
  onboardNutrition,
  openNutrition,
  openShoppingMenu,
  patchDb,
  showCheckedShoppingItems,
} from './nutrition-helpers';
import { heading } from './plan-helpers';
import { expectA4, pageHeights } from './print-helpers';

/**
 * Etappe N6 – PDF P5 im TESTMODUS (docs/PLAN-PHASE-5.md 11, 8.2 Nr. 6, 15 Schritt 9): „Als PDF speichern“ in Woche
 * und Einkaufsliste → Hinweis-Dialog bei Gesundheitsbezug (erwähnt Ersatzprodukte, K4; Abbrechen = nichts erzeugt)
 * → Druckansicht mit Vorschau → Druckdialog. Prüft: keine Gründe/Unverträglichkeiten/Gewicht im Dokument, Kästchen
 * in der Liste, „Zahlen aus“ und Schwangerschaft ohne kcal, jede Druckseite passt auf A4. Beispiel-Rezepte mit
 * TESTWERTEN. Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

const MONDAY = '2026-10-12';

async function stubPrint(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __prints: number };
    w.__prints = 0;
    window.print = () => {
      w.__prints += 1;
    };
  });
}

const prints = (page: Page) =>
  page.evaluate(() => (window as unknown as { __prints: number }).__prints);

async function start(page: Page, person: Parameters<typeof onboardNutrition>[1] = {}) {
  await onboardNutrition(page, person);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await openNutrition(page);
}

async function expectPrintPagesA4(page: Page) {
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#alpha5-print-root')).toBeVisible();
  expectA4(await pageHeights(page, '#alpha5-print-root section.page'));
  await page.emulateMedia({ media: 'screen' });
}

test('Essensplan als PDF: Hinweis-Dialog (K4), Vorschau ohne Gründe, Name, Druckdialog, A4', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await start(page, { peanutIntolerance: true });
  await page.goto('/ernaehrung/woche');
  await expect(page.getByTestId('nutrition-week')).toBeVisible();
  await stubPrint(page);

  // Hinweis vor dem Erzeugen – Abbrechen führt zurück, es entsteht nichts.
  await page.getByTestId('nutrition-week-print').click();
  await heading(page, 'Bevor du speicherst');
  await expect(page.getByText(/Laktosefreie Milch statt Vollmilch/)).toBeVisible();
  await expect(page.getByTestId('print-preview')).toHaveCount(0);
  await expect(page.locator('#alpha5-print-root')).toHaveCount(0);
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByTestId('nutrition-week')).toBeVisible();

  await page.getByTestId('nutrition-week-print').click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await heading(page, 'Essensplan als PDF');
  const preview = page.getByTestId('print-preview');
  await expect(preview).toContainText('Dein Essensplan');
  await expect(preview).toContainText('Wochenübersicht');
  await expect(preview).toContainText('Zubereitung');
  await expect(preview).toContainText('12.10.2026 – 18.10.2026');
  await expect(preview).toContainText('kcal');
  await expect(preview).toContainText('ersetzt keine ärztliche oder ernährungsfachliche Beratung');
  await expect(preview).toContainText('Testwerte');
  // Nichts Verräterisches (11): keine Unverträglichkeit, kein Gewicht, kein Ziel, keine Flags.
  for (const word of [/Unverträglich/i, /70 kg/, /Abnehmen/, /Gesundheits/]) {
    await expect(preview).not.toContainText(word);
  }
  await expect(page.getByTestId('print-numbers')).toContainText('nur Tagessummen');

  // Name nur auf Wunsch, nur im PDF.
  await page.getByRole('checkbox', { name: 'Meinen Namen auf das Deckblatt drucken' }).click();
  await page.getByTestId('print-name').fill('Anna Test');
  await expect(preview).toContainText('Anna Test');
  await expect(page).toHaveTitle('Essensplan');

  await page.getByTestId('print-button').click();
  expect(await prints(page)).toBe(1);
  await expectPrintPagesA4(page);

  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect(page.getByTestId('nutrition-week')).toBeVisible();
  await expect(page.locator('#alpha5-print-root')).toHaveCount(0);
  await expect(page.locator('#alpha5-print-style')).toHaveCount(0);
});

test('Einkaufsliste als PDF: Kästchen nach Abteilungen, abgehakte mit Haken, Vorrat am Ende, keine kcal', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await start(page);
  await page.getByTestId('nutrition-shopping').click();
  await expect(page.getByTestId('shopping-items')).toBeVisible();
  await showCheckedShoppingItems(page);
  // Einen Eintrag abhaken – erscheint im PDF mit Haken.
  const firstId = (await page
    .locator('[data-testid^="shopping-check-"]')
    .first()
    .getAttribute('data-testid')) as string;
  const firstCheck = page.getByTestId(firstId);
  await firstCheck.click();
  await expect(firstCheck).toHaveAttribute('aria-checked', 'true');
  await stubPrint(page);

  await openShoppingMenu(page);
  await page.getByTestId('shopping-print').click();
  await heading(page, 'Bevor du speicherst');
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await heading(page, 'Einkaufsliste als PDF');
  const preview = page.getByTestId('print-preview');
  await expect(preview).toContainText('Deine Einkaufsliste');
  // Drucken nimmt den angezeigten Zeitraum (Standard seit 23.10.2026: heute + 2 Tage).
  await expect(preview).toContainText('12.10.2026 – 14.10.2026');
  await expect(preview).toContainText('Hast du wahrscheinlich da');
  await expect(preview).not.toContainText('kcal');
  await expect(preview.locator('ul.checklist li').first()).toBeVisible();
  await expect(preview.locator('ul.checklist li.checked')).toHaveCount(1);
  await expect(preview.locator('.sr-only')).toHaveText(['erledigt']);
  // Kein Namensfeld bei der Einkaufsliste.
  await expect(page.getByTestId('print-name')).toHaveCount(0);

  await page.getByTestId('print-button').click();
  expect(await prints(page)).toBe(1);
  await expectPrintPagesA4(page);
});

test('„Zahlen aus“ und Schwangerschaft: keine kcal im PDF', async ({ page }) => {
  test.setTimeout(150_000);
  await start(page);
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: { ...(value.rows.nutritionSetup as object), show_energy_numbers: false },
    },
  }));
  await page.goto(`/ernaehrung/drucken?woche=${MONDAY}`);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  const preview = page.getByTestId('print-preview');
  await expect(preview).toContainText('Wochenübersicht');
  await expect(preview).not.toContainText('kcal');
  await expect(preview).not.toContainText('Tagessumme');
  await expect(page.getByTestId('print-numbers')).toContainText('keine kcal');

  // Schwangerschaft: auch mit „Zahlen an“ keine kcal (B5).
  await start(page, { pregnancy: true });
  await page.goto(`/ernaehrung/drucken?woche=${MONDAY}`);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.getByTestId('print-preview')).toContainText('Wochenübersicht');
  await expect(page.getByTestId('print-preview')).not.toContainText('kcal');
  await expect(page.getByTestId('print-preview')).not.toContainText(/schwanger/i);
});

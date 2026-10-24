import { expect, test, type Page } from '@playwright/test';

import { onboardNutrition } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Einkaufen wie im Laden (docs/PLAN-EINKAUFEN-AUSDAUER.md 3, Gründer-Rückmeldung 24.10.2026): Mit dem ECHTEN Katalog
 * (kein Beispiel-Katalog) steht jedes Lebensmittel in Kaufeinheiten auf der Liste – „1 Stück Ingwer“, „1 Beutel
 * Karotten (500 g)“ –, Karotte/Karotten/Möhre stehen EINMAL da, keine Zeile beginnt mit „<Zahl> g …“. Weitergeben und
 * PDF sagen dasselbe. Mit SHOPPING_SHOTS=<Ordner> entstehen Bildschirmfotos (hell und dunkel).
 */

/** Vegetarische Rezepte mit Karotte, Möhre, Karotten und Ingwer (content/recipes). */
const RECIPES = [
  'hummus-mit-gemuesesticks-und-reiswaffeln',
  'teriyaki-tofu-bowl-mit-edamame-vegetarisch',
  'gekochte-eier-mit-gemuesesticks',
];

async function rowTexts(page: Page): Promise<{ key: string; text: string }[]> {
  return page.locator('[data-testid^="shopping-text-"]').evaluateAll((nodes) =>
    nodes.map((node) => ({
      key: (node.getAttribute('data-testid') ?? '').slice('shopping-text-'.length),
      text: (node.textContent ?? '').trim(),
    })),
  );
}

async function shot(page: Page, name: string) {
  const dir = process.env.SHOPPING_SHOTS;
  if (dir === undefined || dir === '') return;
  await page.screenshot({ path: `${dir}/${name}.png` });
}

test('Einkaufsliste wie im Laden: Kaufeinheiten, Karotten einmal, keine Gramm vorn', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await onboardNutrition(page, { forceDemo: false });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  for (const id of RECIPES) {
    await page.goto(`/rezept/${id}`);
    await expect(page.getByTestId('recipe')).toBeVisible();
    await page.getByTestId('recipe-shopping-add').click();
    await expect(page.getByTestId('recipe-shopping-message')).toContainText(
      'Steht auf deiner Einkaufsliste',
    );
  }
  await page.goto('/einkaufsliste');
  await expect(page.getByTestId('shopping-items')).toBeVisible();
  await page.getByTestId('shopping-range-week').click();
  await expect(page.getByTestId('shopping-range')).toContainText('12.10.2026 bis 18.10.2026');
  await page.getByTestId('shopping-pantry-toggle').click();
  await expect(page.getByTestId('shopping-pantry')).toBeVisible();

  const rows = await rowTexts(page);
  expect(rows.length).toBeGreaterThan(5);
  // Keine Zeile beginnt mit einer Grammzahl („70 g Ingwer“) – alles in Kaufeinheiten.
  for (const row of rows) {
    if (row.key.startsWith('manual|')) continue;
    expect(row.text, row.key).not.toMatch(/^\d[\d.,]* ?(g|kg|ml|l) /u);
    expect(row.text, row.key).not.toMatch(/^1 Packung .*insgesamt/u);
  }
  // Karotte, Karotten und Möhre: genau EINE Zeile.
  expect(rows.filter((r) => /Karotte|Möhre/u.test(r.text))).toHaveLength(1);
  await expect(page.getByTestId('shopping-text-karotten|g')).toHaveText(/^\d+ Beutel Karotten$/u);
  await expect(page.getByTestId('shopping-second-karotten|g')).toContainText(/\d+ k?g/u);
  await expect(page.getByTestId('shopping-second-karotten|g')).toContainText('für ');
  await expect(page.getByTestId('shopping-text-ingwer|g')).toHaveText('1 Stück Ingwer');
  // Vorrat ohne Menge.
  await expect(page.getByTestId('shopping-pantry')).toContainText('Sojasauce');
  await expect(page.getByTestId('shopping-pantry')).toContainText('Vorrat prüfen');

  // Abhaken: durchgestrichen und ans Ende der Abteilung.
  await page.getByTestId('shopping-hide-checked').click();
  await expect(page.getByTestId('shopping-hide-checked')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('shopping-check-ingwer|g').click();
  await expect(page.getByTestId('shopping-check-ingwer|g')).toHaveAttribute('aria-checked', 'true');
  const veg = await page
    .getByTestId('shopping-dept-items-fruit_vegetables')
    .locator('[data-testid^="shopping-text-"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid')));
  expect(veg.at(-1)).toBe('shopping-text-ingwer|g');

  // Bildschirmfotos (hell, dann dunkel): Anfang, Mitte, Vorrat.
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.getByTestId('shopping-dept-toggle-fruit_vegetables').scrollIntoViewIfNeeded();
    await page.getByTestId('shopping-range').scrollIntoViewIfNeeded();
    await shot(page, `${scheme}-1`);
    await page
      .getByTestId('shopping-dept-toggle-chilled_dairy_eggs')
      .evaluate((n) => n.scrollIntoView({ block: 'start' }));
    await shot(page, `${scheme}-2`);
    await page.getByTestId('shopping-pantry').evaluate((n) => n.scrollIntoView({ block: 'start' }));
    await shot(page, `${scheme}-3`);
  }
  await page.emulateMedia({ colorScheme: 'light' });

  // Weitergeben: dieselben Worte.
  await page.getByTestId('shopping-share').click();
  const preview = page.getByTestId('share-preview');
  await expect(preview).toContainText(/- \d+ Beutel Karotten \(/u);
  // Ingwer ist abgehakt – Standard „nur Offenes“.
  await expect(preview).not.toContainText('Ingwer');
  const shared = (await preview.textContent()) ?? '';
  expect(shared.match(/Karotte|Möhre/gu) ?? []).toHaveLength(1);
  expect(shared).not.toMatch(/^- \d[\d.,]* ?(g|ml) /mu);
});

import { expect, test, type Page } from '@playwright/test';

import { onboardNutrition, openNutrition } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Tagesansicht Ernährung mit Kalorien-Ring (Gründer-Wunsch 20.10.2026, docs/HANDY-ANLEITUNG.md Teil 7r) im TESTMODUS:
 * „Heute“ + KW, Ring „übrig“ mit Ansage in Worten, Gegessen/Verbrannt, Makro-Balken, vier Mahlzeiten-Karten mit „+“
 * (vorgewählte Mahlzeit im Eintrage-Dialog), Überschreitung (Ring rot + „über dem Ziel“, Gründer-Wunsch 23.10.2026), künftiger Tag, offline. Fester Start: Montag,
 * 12.10.2026, 9 Uhr (Trainingstag).
 */

const num = (text: string) => Number(text.replace(/\./g, ''));

async function target(page: Page): Promise<number> {
  const text = await page.getByTestId('nutrition-target').innerText();
  return num(/Tagesziel: ([\d.]+) kcal/.exec(text)?.[1] ?? 'NaN');
}

async function quickEntry(page: Page, label: string, kcal: string) {
  await page.getByRole('radio', { name: 'Schnell' }).click();
  await page.getByRole('radio', { name: label, exact: true }).click();
  await page.getByTestId('food-log-quick-kcal').fill(kcal);
  await page.getByTestId('food-log-quick-add').click();
}

test('Ring, Makros, Mahlzeiten-Karten mit „+“, Überschreitung rot mit Worten, künftiger Tag, offline', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  await onboardNutrition(page);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await openNutrition(page);

  // Kopf: „Heute“ + Datum mit Kalenderwoche.
  const header = page.getByTestId('nutrition-day-header');
  await expect(header.getByRole('heading', { name: 'Heute' })).toBeVisible();
  await expect(page.getByTestId('nutrition-day-date')).toHaveText('Montag, 12.10. · KW 42');

  // Übersicht: nichts gegessen → alles übrig; Ansage in Worten.
  const goal = await target(page);
  expect(goal).toBeGreaterThan(1000);
  // Überschreitung weiter unten: 400 + 3.000 kcal liegen über dem Ziel dieser Testperson.
  expect(goal).toBeLessThan(3400);
  const ring = page.getByTestId('nutrition-ring');
  await expect(ring).toContainText('übrig');
  await expect(ring).toHaveAttribute(
    'aria-label',
    `${goal.toLocaleString('de-DE')} kcal übrig von ${goal.toLocaleString('de-DE')} kcal Tagesziel. Gegessen: 0 kcal.`,
  );
  await expect(page.getByTestId('nutrition-ring-eaten')).toContainText('Gegessen');
  await expect(page.getByTestId('nutrition-ring-hint')).toHaveText('Noch nichts eingetragen.');
  await expect(page.getByTestId('nutrition-ring-over')).toHaveCount(0);
  // Montag = Trainingstag: „Verbrannt“, im Ziel enthalten.
  await expect(page.getByTestId('nutrition-ring-burned')).toContainText('im Ziel enthalten');
  for (const macro of ['carbs', 'protein', 'fat']) {
    await expect(page.getByTestId(`nutrition-macro-${macro}`)).toContainText(/^.+0 \/ \d+ g$/s);
  }
  await expect(page.getByTestId('nutrition-macro-protein')).toHaveAttribute(
    'aria-label',
    /^Eiweiß: 0 von \d+ Gramm gegessen$/,
  );

  // Vier Karten mit Ziel-Anteil; Summe der Ziele = Tagesziel.
  let sum = 0;
  for (const group of ['breakfast', 'lunch', 'dinner', 'snacks']) {
    const kcal = await page.getByTestId(`meal-card-kcal-${group}`).innerText();
    const match = /^0 \/ ([\d.]+) kcal$/.exec(kcal);
    expect(match).not.toBeNull();
    sum += num(match?.[1] ?? '0');
  }
  expect(sum).toBe(goal);
  await expect(page.getByTestId('meal-card-breakfast')).toContainText('Frühstück');
  await expect(page.getByTestId('meal-card-snacks')).toContainText('Snacks');
  // Plan-Gerichte stehen in ihrer Karte.
  await expect(page.getByTestId('meal-card-dinner').getByTestId('meal-dinner')).toBeVisible();

  // „+“ beim Frühstück → Eintrage-Dialog mit vorgewählter Mahlzeit.
  const add = page.getByTestId('meal-card-add-breakfast');
  await expect(add).toHaveAttribute('aria-label', 'Frühstück für heute eintragen');
  await add.click();
  await expect(page.getByTestId('food-log-entry')).toBeVisible();
  await expect(
    page.getByRole('radiogroup', { name: 'Mahlzeit' }).getByRole('radio', { name: 'Frühstück' }),
  ).toHaveAttribute('aria-checked', 'true');
  await quickEntry(page, 'Mahlzeit', '400');
  await expect(page.getByTestId('food-log-entry-message')).toHaveText('Eingetragen: Mahlzeit');
  await page.getByTestId('food-log-done').click();
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
  await expect(page.getByTestId('meal-card-kcal-breakfast')).toHaveText(/^400 \/ [\d.]+ kcal$/);
  await expect(page.getByTestId('meal-card-preview-breakfast')).toHaveText('Mahlzeit');
  await expect(page.getByTestId('nutrition-ring-eaten')).toContainText('400');
  await expect(ring).toContainText((goal - 400).toLocaleString('de-DE'));
  await expect(page.getByTestId('nutrition-ring-hint')).toHaveCount(0);

  // Snacks „+“ → 3.000 kcal → „zu viel“, Ring voll in Rot und Plakette „über dem Ziel“ (Worte, nicht nur Farbe).
  await page.getByTestId('meal-card-add-snacks').click();
  await expect(
    page.getByRole('radiogroup', { name: 'Mahlzeit' }).getByRole('radio', { name: 'Snack' }),
  ).toHaveAttribute('aria-checked', 'true');
  await quickEntry(page, 'Auswärts gegessen', '3000');
  await page.getByRole('button', { name: 'Ja, eintragen' }).click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText(
    'Eingetragen: Auswärts gegessen',
  );
  await page.getByTestId('food-log-done').click();
  await expect(ring).toContainText('zu viel');
  await expect(ring).toContainText((3400 - goal).toLocaleString('de-DE'));
  await expect(ring).toHaveAttribute('aria-label', /kcal mehr als dein Tagesziel von/);
  await expect(page.getByTestId('nutrition-ring-over')).toHaveText('über dem Ziel');
  await expect(page.getByTestId('meal-card-kcal-snacks')).toHaveText(/^3\.000 \/ [\d.]+ kcal$/);

  // Offline: Hinweis, Eintragen bleibt möglich.
  await context.setOffline(true);
  await expect(page.getByTestId('nutrition-offline')).toBeVisible();
  await expect(page.getByTestId('meal-card-add-lunch')).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByTestId('nutrition-offline')).toHaveCount(0);

  // Künftiger Tag: nur Tagesziel, kein „+“.
  await page.getByTestId('nutrition-next').click();
  await expect(header.getByRole('heading')).toHaveText('Dienstag, 13.10.');
  await expect(page.getByTestId('nutrition-day-date')).toHaveText('KW 42');
  await expect(ring).toContainText('Tagesziel');
  await expect(ring).toHaveAttribute('aria-label', /Noch nichts eingetragen\.$/);
  await expect(page.getByTestId('meal-card-add-breakfast')).toHaveCount(0);
});

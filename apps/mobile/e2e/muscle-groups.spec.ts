import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Muskelgruppen-Kacheln (Gründer-Wunsch 22.10.2026): Glossar → „Nach Muskelgruppe wählen“ → Kachel → gefilterte
 * Übungsliste mit Hinweis und „Muskelgruppe entfernen“.
 */

const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');
const HOME_3_DAYS = {
  consent: true,
  yesQuestion: null,
  level: /^Einsteiger/,
  goal: 'Muskelaufbau',
  days: [
    ['Montag', 'Kraft zu Hause', 45],
    ['Mittwoch', 'Kraft zu Hause', 45],
    ['Freitag', 'Kraft zu Hause', 45],
  ] as [string, string, number][],
};

// Kacheln → Liste legt eine zweite Glossar-Seite auf den Stapel (Zurück führt wieder zu den Kacheln); nur die
// sichtbare zählt.
const visible = (page: Page, id: string) => page.getByTestId(id).filter({ visible: true });

async function toGlossary(page: Page) {
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await page.getByTestId('today-glossary').click();
  await heading(page, 'Übungen');
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('Muskelgruppen: Kachel öffnet gefilterte Übungsliste', async ({ page }) => {
  await onboard(page, HOME_3_DAYS);
  await toGlossary(page);
  const total = Number((await visible(page, 'glossary-count').innerText()).split(' ')[0]);

  await page.getByTestId('glossary-by-muscle').click();
  await heading(page, 'Muskelgruppen');
  await expect(page.getByTestId(/^muscle-tile-/)).toHaveCount(15);
  if (process.env.SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.SCREENSHOT_DIR}/muskelgruppen.png`,
      fullPage: true,
    });
  }

  await page.getByRole('link', { name: 'Trizeps: Übungen anzeigen' }).click();
  await heading(page, 'Übungen');
  await expect(visible(page, 'glossary-muscle-filter')).toContainText('Muskelgruppe: Trizeps');
  const filtered = Number((await visible(page, 'glossary-count').innerText()).split(' ')[0]);
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThan(total);
  if (process.env.SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.SCREENSHOT_DIR}/trizeps-liste.png`,
      fullPage: true,
    });
  }

  await visible(page, 'glossary-muscle-clear').click();
  await expect(visible(page, 'glossary-muscle-filter')).toHaveCount(0);
  await expect(visible(page, 'glossary-count')).toHaveText(`${total} Übungen`);

  // Zurück führt zu den Kacheln.
  await page.goBack();
  await heading(page, 'Muskelgruppen');
});

test('Muskelgruppen: unbekannte Muskelgruppe im Link wird ignoriert', async ({ page }) => {
  await onboard(page, HOME_3_DAYS);
  await toGlossary(page);
  const total = await visible(page, 'glossary-count').innerText();
  await page.goto('/uebungen?muskel=gibtsnicht');
  await heading(page, 'Übungen');
  await expect(visible(page, 'glossary-muscle-filter')).toHaveCount(0);
  await expect(visible(page, 'glossary-count')).toHaveText(total);
});

test('Übungsseite: Kacheln der trainierten Muskelgruppen führen zur gefilterten Liste', async ({
  page,
}) => {
  await onboard(page, HOME_3_DAYS);
  await toGlossary(page);
  // Bankdrücken (Langhantel): Brust Hauptmuskel; Trizeps und Schultern unterstützend.
  await page.goto('/uebungen/bankdruecken-langhantel');
  await heading(page, 'Trainierte Muskelgruppen');
  const tiles = page.getByTestId(/^exercise-muscle-tile-/);
  await expect(tiles).toHaveCount(3);
  await expect(tiles.first()).toHaveAttribute('data-testid', 'exercise-muscle-tile-brust');
  await expect(tiles.first()).toContainText('Hauptmuskel');
  await expect(page.getByTestId('exercise-muscle-tile-trizeps')).toContainText(
    'unterstützend beteiligt',
  );
  if (process.env.SCREENSHOT_DIR) {
    await page.getByTestId('exercise-muscle-tiles').screenshot({
      path: `${process.env.SCREENSHOT_DIR}/uebung-muskelgruppen.png`,
    });
  }

  await page.getByTestId('exercise-muscle-tile-trizeps').click();
  await heading(page, 'Übungen');
  await expect(visible(page, 'glossary-muscle-filter')).toContainText('Muskelgruppe: Trizeps');
});

import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * „Training starten“ (Gründer-Wunsch 06.11.2026) im TESTMODUS, Web-Export, Handy-Ansicht: „+ Training starten“ auf
 * „Heute“ öffnet das Start-Blatt (geplante Einheit zuerst, dann Krafttraining, GPS, andere Sportart, Nachtragen);
 * „Krafttraining“ startet eine freie Einheit heute im Trainingsmodus. Der Tag „heute“ zeigt „Training starten“ für
 * die geplante Einheit, vergangene Tage „Einheit nachtragen“. Fester Start: Donnerstag, 22.10.2026, 9 Uhr.
 */

const THURSDAY = new Date('2026-10-22T09:00:00+02:00');
const THU = '2026-10-22';
const TUE = '2026-10-20';

async function setup(page: Page) {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  await page.clock.setFixedTime(THURSDAY);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent: false,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Donnerstag', 'Kraft im Studio', 60],
      ['Samstag', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
}

test('„+“ auf Heute → Start-Blatt → Krafttraining startet eine freie Einheit heute', async ({
  page,
}) => {
  await setup(page);
  const plus = page.getByTestId('today-start-plus');
  await expect(plus).toBeVisible();
  await expect(plus).toHaveAccessibleName(/^Training starten/);
  await plus.click();

  const sheet = page.getByTestId('start-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Training starten' })).toBeVisible();
  // Geplante Einheit von heute steht zuerst, danach die freien Wege in fester Reihenfolge.
  const rows = sheet.getByRole('button', { name: /\. / });
  await expect(rows.first()).toHaveAccessibleName(/^Geplantes Training starten: /);
  for (const id of ['free_strength', 'gps', 'other_sport', 'backfill']) {
    await expect(sheet.getByTestId(`start-sheet-${id}`)).toBeVisible();
  }
  await expect(sheet.getByTestId('start-sheet-free_strength')).toHaveAccessibleName(
    /^Krafttraining \(z\. B\. Fitnessstudio\)/,
  );

  await sheet.getByTestId('start-sheet-free_strength').click();
  await heading(page, 'Krafttraining starten');
  // Ohne Übung kein leerer Start (verständlicher Grund, nie still).
  await page.getByTestId('strength-start').click();
  await expect(page.getByTestId('strength-start-error')).toContainText('Übung');
  await page.getByTestId('backfill-search').fill('kniebeuge');
  await page.getByRole('checkbox').first().click();
  await expect(page.getByTestId('strength-start')).toHaveText('Training starten (1 Übung)');
  await page.getByTestId('strength-start').click();

  // Trainingsmodus der freien Einheit HEUTE (kein Nachtragen, keine Datumswahl).
  await expect(page).toHaveURL(/\/workout\/frei-/);
  await expect(page.getByTestId('workout-free')).toBeVisible();
  await expect(page.getByTestId('workout-date')).toHaveCount(0);
});

test('Start-Blatt: geplante Einheit mit einem Tipp starten; „Schließen“ schließt', async ({
  page,
}) => {
  await setup(page);
  await page.getByTestId('today-start-plus').click();
  await expect(page.getByTestId('start-sheet')).toBeVisible();
  await page.getByTestId('start-sheet-close').click();
  await expect(page.getByTestId('start-sheet')).toHaveCount(0);

  await page.getByTestId('today-start-plus').click();
  await page
    .getByTestId('start-sheet')
    .getByRole('button', { name: /^Geplantes Training starten: / })
    .click();
  await expect(page).toHaveURL(/\/workout\/(?!frei-)[^/?]+$/);
});

test('Tag „heute“: „Training starten“ für die geplante Einheit und freies Training; früher: Nachtragen', async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/tag/${THU}`);
  await heading(page, 'Dein Tag');
  const start = page.getByTestId('day-start').getByRole('button', { name: /^Training starten: / });
  await expect(start).toHaveCount(1);
  await expect(page.getByTestId('day-backfill')).toHaveCount(0);

  await page.getByTestId('day-start-free').click();
  await expect(page.getByTestId('start-sheet')).toBeVisible();
  await page.getByTestId('start-sheet-close').click();

  await start.click();
  await expect(page).toHaveURL(/\/workout\/(?!frei-)[^/?]+$/);

  // Vergangener Tag: kein Start, aber „Einheit nachtragen“.
  await page.goto(`/tag/${TUE}`);
  await heading(page, 'Dein Tag');
  await expect(page.getByTestId('day-start')).toHaveCount(0);
  await page.getByTestId('day-backfill').click();
  await heading(page, 'Einheit eintragen');
  await expect(page.getByTestId('backfill-day')).toHaveText('Für Dienstag, 20.10.');
});

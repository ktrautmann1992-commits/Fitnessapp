import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Rudern nachtragen (Sportarten Stufe 1 · Restpunkte 27.10.2026) im TESTMODUS: „Eintragen ohne GPS“ → Ausdauer →
 * Rudern → dieselben Felder wie beim Eintragen (Ø Watt, Schlagzahl, Intervall-Ergebnis); gespeichert stehen sie im
 * Tagebuch.
 */

const THURSDAY = new Date('2026-10-22T09:00:00+02:00');

async function setup(page: Page) {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  await page.clock.setFixedTime(THURSDAY);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent: false,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [['Montag', 'Kraft im Studio', 60]],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
}

test('Rudern ohne GPS: Watt, Schlagzahl und Intervalle wie beim Eintragen', async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page);
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await page.getByTestId('endurance-manual').click();
  await heading(page, 'Einheit eintragen');
  await page.getByRole('radio', { name: 'Ausdauer' }).click();
  await page.getByRole('radio', { name: 'Rudern', exact: true }).click();
  await page.getByTestId('backfill-start').click();
  await expect(page.getByTestId('row-entry')).toBeVisible();
  await page.getByTestId('workout-cardio-hours').fill('0');
  await page.getByTestId('workout-cardio-minutes').fill('20');
  await page.getByTestId('workout-cardio-distance').fill('4,8');
  await expect(page.getByTestId('row-entry-watts')).toContainText('Watt');
  await page.getByTestId('row-entry-power').fill('180');
  await page.getByTestId('row-entry-stroke-rate').fill('22');
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout')).toHaveCount(0);
});

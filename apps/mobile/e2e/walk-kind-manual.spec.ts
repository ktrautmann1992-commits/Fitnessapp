import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Wandern ohne GPS (Sportarten Stufe 1 · Restpunkt 27.10.2026) im TESTMODUS: „Eintragen ohne GPS“ → Ausdauer → Gehen →
 * „Wie bist du unterwegs?“ Wandern/Bergwandern → Eintrag heißt „Wanderung“ bzw. „Bergwanderung“, die Aktivitätenliste
 * zeigt die Art statt „Gehen“.
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

async function manualWalk(page: Page, kind: 'Wandern' | 'Bergwandern') {
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await page.getByTestId('endurance-manual').click();
  await heading(page, 'Einheit eintragen');
  await page.getByRole('radio', { name: 'Ausdauer' }).click();
  await page.getByRole('radio', { name: 'Gehen', exact: true }).click();
  await page.getByTestId('backfill-start').click();
  const choice = page.getByTestId('workout-cardio-walk-kind');
  await expect(choice).toBeVisible();
  await choice.getByRole('radio', { name: kind, exact: true }).click();
  await page.getByTestId('workout-cardio-hours').fill('2');
  await page.getByTestId('workout-cardio-minutes').fill('30');
  await page.getByTestId('workout-cardio-distance').fill('9');
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout')).toHaveCount(0);
}

test('Eintragen ohne GPS: Wander-Art wählbar, Liste zeigt „Wanderung“/„Bergwanderung“', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await setup(page);
  await manualWalk(page, 'Bergwandern');
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  const item = page.getByRole('button', { name: /^Bergwanderung.*Bergwanderung$/ });
  await expect(item).toBeVisible();
  await expect(item).toContainText('Bergwanderung · ');
  await expect(item).not.toContainText('Gehen · ');
});

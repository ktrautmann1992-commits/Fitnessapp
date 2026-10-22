/// <reference types="node" />
import { mkdirSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Bildschirmfotos der Auswertung je Lauf (Demo-Lauf über gut 5 km, hell und dunkel) zur Sichtprüfung der Abschnitte:
 * Kopf-Karte, Bestwerte, Strecke (ohne Kacheln → farbige Skizze), Kilometerzeiten, Tempo-Verlauf, Höhenprofil.
 * Läuft nur mit gesetztem SCREENSHOT_DIR, nicht in CI. Karte/Kacheln werden blockiert (keine externen Anfragen).
 */
const dir = process.env.SCREENSHOT_DIR;
test.skip(!dir, 'Nur mit SCREENSHOT_DIR');

test('Auswertung je Lauf – Bildschirmfotos', async ({ page }) => {
  test.setTimeout(240_000);
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  await page.clock.setFixedTime(new Date('2026-10-22T09:00:00+02:00'));
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent: false,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [['Montag', 'Kraft im Studio', 60]],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await page.getByTestId('endurance-demo').click();
  const km = async () =>
    Number(
      ((await page.getByTestId('record-distance').textContent()) ?? '0')
        .replace(' km', '')
        .replace(',', '.'),
    );
  await expect.poll(km, { timeout: 120_000, intervals: [1_000] }).toBeGreaterThan(5.3);
  await page.getByTestId('record-stop').click();
  await page.getByTestId('record-stop-dialog').getByRole('button', { name: 'Ja, beenden' }).click();
  await page.getByTestId('record-name').fill('Rheinrunde');
  await page.getByTestId('record-submit').click();
  await expect(page.getByTestId('route-detail')).toBeVisible();
  await expect(page.getByTestId('route-map-failed')).toBeVisible();

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    mkdirSync(`${dir}/${scheme}`, { recursive: true });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/${scheme}/00-ganze-seite.png`, fullPage: true });
    const parts: [string, string][] = [
      ['01-kopf', 'route-hero'],
      ['02-bestwerte', 'route-highlights'],
      ['03-strecke', 'route-map'],
      ['04-kilometer', 'split-bars'],
      ['05-tempo', 'pace-chart'],
      ['06-hoehe', 'elevation-chart'],
    ];
    for (const [name, id] of parts) {
      const el = page.getByTestId(id);
      await el.scrollIntoViewIfNeeded();
      await el.screenshot({ path: `${dir}/${scheme}/${name}.png` });
    }
  }
});

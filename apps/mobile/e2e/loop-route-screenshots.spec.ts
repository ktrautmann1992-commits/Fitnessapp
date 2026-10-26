/// <reference types="node" />
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Bildschirmfotos „Rundkurs-Vorschlag“ (390 px, hell und dunkel) zur Sichtprüfung. Läuft nur mit SCREENSHOT_DIR, nicht
 * in CI. Routing = Attrappe (Testmodus). Kartenkacheln gibt es ohne Netz nicht: Mit MAPLIBRE_DIR (entpacktes npm-Paket
 * maplibre-gl@5.6.0, gleiche SRI-Prüfsumme wie vom CDN) zeichnet die ECHTE Karten-Bibliothek die Runden auf einem
 * leeren Kartenstil (ohne Straßen); ohne MAPLIBRE_DIR erscheint die Ersatz-Skizze.
 */
const dir = process.env.SCREENSHOT_DIR;
const maplibreDir = process.env.MAPLIBRE_DIR;
test.skip(!dir, 'Nur mit SCREENSHOT_DIR');

const BLANK_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'hintergrund', type: 'background', paint: { 'background-color': '#EEF1E6' } }],
};

async function mapRoutes(context: BrowserContext) {
  const dist = maplibreDir ? join(maplibreDir, 'dist') : null;
  if (dist && existsSync(join(dist, 'maplibre-gl.js'))) {
    await context.route(
      /cdn\.jsdelivr\.net\/npm\/maplibre-gl@5\.6\.0\/dist\/maplibre-gl\.(js|css)$/,
      (route) => {
        const file = route.request().url().endsWith('.css') ? 'maplibre-gl.css' : 'maplibre-gl.js';
        return route.fulfill({
          body: readFileSync(join(dist, file)),
          contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript',
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      },
    );
    await context.route(/tiles\.openfreemap\.org\/styles\/liberty/, (route) =>
      route.fulfill({
        body: JSON.stringify(BLANK_STYLE),
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
      }),
    );
  } else {
    await context.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  }
}

async function shoot(page: Page, name: string) {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    mkdirSync(`${dir}/${scheme}`, { recursive: true });
    await page.waitForTimeout(1_200);
    await page.screenshot({ path: `${dir}/${scheme}/${name}.png`, fullPage: true });
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

test('Rundkurs-Vorschlag – Bildschirmfotos', async ({ page, context }) => {
  test.setTimeout(240_000);
  // Ganze Seite auf einen Blick (die App scrollt in einem eigenen Bereich – fullPage reicht nicht), Breite 390 px.
  await page.setViewportSize({ width: 390, height: 2200 });
  await mapRoutes(context);
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
  await heading(page, 'Training');
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await page.getByTestId('endurance-loop').scrollIntoViewIfNeeded();
  await shoot(page, '00-ausdauer-einstieg');

  await page.getByTestId('endurance-loop').click();
  await heading(page, 'Rundkurs-Vorschlag');
  await shoot(page, '01-formular');

  await page.getByTestId('loop-distance-10').click();
  await page.getByRole('radio', { name: 'Wald- und Feldwege' }).click();
  await page.getByTestId('loop-demo-start').click();
  await page.getByTestId('loop-suggest').click();
  await expect(page.getByTestId('loop-results')).toBeVisible();
  await page.waitForTimeout(2_500);
  await shoot(page, '02-vorschlaege');

  await page.getByTestId('loop-option-1').click();
  await page.getByTestId('loop-save').click();
  await page.getByTestId('loop-save-name').fill('Waldrunde Rheinpark');
  await page.getByTestId('loop-save-confirm').click();
  await expect(page.getByTestId('loop-saved')).toBeVisible();
  await page.waitForTimeout(1_500);
  await shoot(page, '03-runde-b-gemerkt');

  await page.getByTestId('loop-run').click();
  await expect(page.getByTestId('record-loop-guide')).toBeVisible();
  await page.waitForTimeout(4_000);
  await shoot(page, '04-laufen-mit-leitlinie');
});

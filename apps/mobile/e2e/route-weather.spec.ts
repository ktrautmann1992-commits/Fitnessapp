/// <reference types="node" />
import { mkdirSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { DEMO_IDS, seedDemoRoutes, storedRoutes } from './my-routes-helpers';
import { heading, onboard } from './plan-helpers';

/**
 * Wetter je Lauf (25.10.2026) im TESTMODUS: einmaliger Hinweis → Zustimmung → Abruf bei Open-Meteo (im Test
 * abgefangen) NUR mit gerundeter Startposition, Tag und Stunde → Wetter-Zeile auf der Lauf-Seite und in der Liste
 * der Strecke; „Nein danke“ ruft nichts ab; Schalter in den Einstellungen. Mit SCREENSHOT_DIR Bildschirmfotos.
 */

const dir = process.env.SCREENSHOT_DIR;

const FORECAST = {
  hourly: {
    time: ['2026-10-24T15:00', '2026-10-24T16:00', '2026-10-24T17:00'],
    temperature_2m: [12.9, 12.4, 11.8],
    apparent_temperature: [10.1, 9.4, 9],
    relative_humidity_2m: [80, 84, 88],
    precipitation: [0, 0.3, 0.1],
    weather_code: [3, 61, 61],
    wind_speed_10m: [15, 18.2, 20],
  },
};

async function setup(page: Page, requests: string[]) {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  await page.route(/open-meteo\.com/, async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ json: FORECAST });
  });
  await page.clock.setFixedTime(new Date('2026-10-25T10:00:00+01:00'));
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
  await seedDemoRoutes(page);
}

test('Wetter: Hinweis, Abruf mit gerundeter Position, Anzeige, Einstellungen', async ({ page }) => {
  test.setTimeout(120_000);
  const requests: string[] = [];
  await setup(page, requests);

  // Vor der Zustimmung: kein Abruf, Hinweis auf der Seite des Laufs.
  await page.goto(`/ausdauer/${DEMO_IDS.watchRun}`);
  await expect(page.getByTestId('weather-ask')).toBeVisible();
  expect(requests).toEqual([]);
  if (dir) {
    mkdirSync(dir, { recursive: true });
    await page.getByTestId('weather-ask').screenshot({ path: `${dir}/6-wetter-hinweis.png` });
  }
  await page.getByTestId('weather-ask-yes').click();
  const line = page.getByTestId('route-detail').getByTestId('route-weather');
  await expect(line).toContainText('12 °C · Wind 18 km/h · leichter Regen');
  await expect(line).toContainText('gefühlt 9 °C · Luftfeuchte 84 %');
  // Nur gerundete Position, Tag und Stunde – nie die genaue Strecke.
  expect(requests.length).toBeGreaterThan(0);
  for (const url of requests) {
    expect(url).toMatch(/latitude=-?\d+(\.\d)?&longitude=-?\d+(\.\d)?&/);
    expect(url).not.toMatch(/latitude=-?\d+\.\d\d/);
  }
  const stored = (await storedRoutes(page)).find((r) => r.id === DEMO_IDS.watchRun);
  expect(stored?.weather).toMatchObject({ temp_c: 12.4, code: 61, source: 'forecast' });
  if (dir) {
    await line.scrollIntoViewIfNeeded();
    await line.screenshot({ path: `${dir}/6-wetter-zeile.png` });
  }

  // Liste der Strecke: Wetter-Zeile je Lauf.
  await page.goto(`/ausdauer/strecke/${DEMO_IDS.park}`);
  await expect(page.getByTestId(`route-run-weather-${DEMO_IDS.previous}`)).toHaveText(
    '11 °C · Wind 8 km/h · teilweise bewölkt',
  );
  if (dir) {
    await page.getByTestId('route-runs').scrollIntoViewIfNeeded();
    await page.getByTestId('route-runs').screenshot({ path: `${dir}/6-wetter-liste.png` });
  }

  // Einstellungen: abschalten.
  await page.goto('/settings?thema=geraete');
  const toggle = page.getByTestId('settings-weather');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('Wetter: „Nein danke“ → kein Abruf', async ({ page }) => {
  const requests: string[] = [];
  await setup(page, requests);
  await page.goto(`/ausdauer/${DEMO_IDS.watchRun}`);
  await page.getByTestId('weather-ask-no').click();
  await expect(page.getByTestId('weather-ask')).toHaveCount(0);
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await page.waitForTimeout(500);
  expect(requests).toEqual([]);
});

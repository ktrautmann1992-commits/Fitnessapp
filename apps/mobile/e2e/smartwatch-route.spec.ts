/// <reference types="node" />
import { mkdirSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Routen der Uhr (Gründer-Entscheidung 23.10.2026) im TESTMODUS mit der Beispiel-Uhr, Handy-Ansicht: verbinden →
 * Läufe mit Route erscheinen in „Meine Läufe“ als Strecke → Auswertung wie eine eigene Aufzeichnung (Distanz aus der
 * Route, „⌚ laut Uhr“, Ø Puls und kcal in der Kopf-Karte, Karte mit Hinweis „nur für dich sichtbar“, Pulszonen-Balken)
 * → ältester Lauf ohne Route: „Strecke laut Uhr (ohne Route)“ und „Route freigeben“ → danach mit Karte → Trennen
 * löscht die Routen der Uhr. Bildschirmfotos nur mit SCREENSHOT_DIR. Fester Start: Donnerstag, 22.10.2026, 9 Uhr.
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const dir = process.env.SCREENSHOT_DIR;

interface StoredRoute {
  id: string;
  source: string;
  sport: string;
  distance_m: number;
  session_log_id: string | null;
}

async function stored(page: Page) {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  return JSON.parse(raw ?? '{}') as {
    rows: {
      sessionLogs: { id: string; source: string; name_de: string; performed_on: string }[];
      cardioLogs: { session_log_id: string; distance_m: number | null }[];
    };
    trackedRoutes?: StoredRoute[];
  };
}

async function shot(page: Page, name: string) {
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test('Beispiel-Uhr: Läufe mit Route → Auswertung mit Karte, Puls, kcal; ohne Route → „Route freigeben“', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  await page.clock.setFixedTime(new Date('2026-10-22T09:00:00+02:00'));
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent: true,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [['Montag', 'Kraft im Studio', 60]],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');

  // Verbinden: Erklärung nennt die Routen, Einwilligung (Fassung 2), Beispiel-Uhr.
  await page.goto('/settings?thema=geraete');
  await page.getByTestId('settings-smartwatch').click();
  await expect(page.getByText(/Routen deiner Läufe/)).toBeVisible();
  await page.getByTestId('smartwatch-consent-accept').click();
  await page.getByTestId('smartwatch-connect').click();
  await expect(page.getByTestId('smartwatch-message')).toContainText('Abgleich fertig – 6 neu');
  await expect(page.getByTestId('smartwatch-message')).toContainText(
    'Für 1 Lauf fragt Health Connect nach der Route',
  );
  await expect(page.getByTestId('smartwatch-route-access')).toBeVisible();

  // Zwei Läufe mit Route als Strecke „watch“; Distanz des Eintrags = Route (nicht die 5,5 bzw. 5,8 km laut HC).
  const db = await stored(page);
  // Läufe (die Beispiel-Uhr hat seit Etappe W zusätzlich eine Wanderung mit Route).
  const routes = (db.trackedRoutes ?? []).filter((r) => r.source === 'watch' && r.sport === 'run');
  expect(routes).toHaveLength(2);
  for (const route of routes) {
    const cardio = db.rows.cardioLogs.find((c) => c.session_log_id === route.session_log_id);
    expect(cardio?.distance_m).toBe(route.distance_m);
    expect(route.distance_m).toBeGreaterThan(5400);
  }

  // „Meine Läufe“ → neuester Lauf (20.10.) mit Karte.
  await page.goto('/ausdauer');
  await expect(page.getByText('⌚ aus Samsung Health').first()).toBeVisible();
  const newest = routes.reduce((a, b) => (a.id > b.id ? a : b));
  const target = routes.find((r) => r.distance_m === Math.max(...routes.map((x) => x.distance_m)));
  await page.goto(`/ausdauer/${(target ?? newest).id}`);
  await expect(page.getByTestId('route-detail')).toBeVisible();
  await expect(page.getByTestId('route-detail-meta')).toContainText('laut Uhr');
  const km = ((target ?? newest).distance_m / 1000).toFixed(2).replace('.', ',');
  await expect(page.getByTestId('route-distance')).toHaveText(`${km} km`);
  await expect(page.getByTestId('route-avg-hr')).toHaveText(/^\d{3}$/);
  await expect(page.getByTestId('route-watch-kcal')).toHaveText(/^\d{3}$/);
  await expect(page.getByTestId('route-map-note')).toHaveText(
    'Route von der Uhr, nur für dich sichtbar',
  );
  await expect(page.getByTestId('pace-legend')).toBeVisible();
  await expect(page.getByTestId('hr-zone-bar')).toBeVisible();
  await expect(page.getByTestId('hr-zone-text')).toContainText(/Zone \d: \d+ min/);
  await shot(page, 'uhr-lauf-hell');
  await page.getByTestId('hr-zone-bar').scrollIntoViewIfNeeded();
  await shot(page, 'uhr-lauf-zonen');
  await page.emulateMedia({ colorScheme: 'dark' });
  await shot(page, 'uhr-lauf-dunkel');
  await page.emulateMedia({ colorScheme: 'light' });

  // Story-Bild: nie Puls oder kcal.
  await page.getByTestId('route-share').click();
  await expect(page.getByTestId('story')).toBeVisible();
  await expect(page.getByTestId('story')).not.toContainText('/min');
  await expect(page.getByTestId('story')).not.toContainText('kcal');

  // Ältester Lauf (16.10.) ohne Route: Hinweis und „Route freigeben“.
  const logWithout = db.rows.sessionLogs.find(
    (l) =>
      l.source === 'health_connect' &&
      l.name_de === 'Lauf' &&
      !routes.some((r) => r.session_log_id === l.id),
  );
  expect(logWithout).toBeDefined();
  await page.goto(`/log/${logWithout?.id ?? ''}`);
  await expect(page.getByTestId('watch-route-missing')).toContainText(
    'Strecke laut Uhr (ohne Route)',
  );
  await expect(page.getByTestId('watch-route-missing')).toContainText('Trainingsrouten');
  await shot(page, 'uhr-lauf-ohne-route');
  await page.getByTestId('watch-route-release').click();
  // Nach der Freigabe direkt zur Auswertung mit Karte.
  await expect(page.getByTestId('route-detail-meta')).toContainText('laut Uhr');
  await expect(page.getByTestId('route-map-note')).toBeVisible();
  expect(
    ((await stored(page)).trackedRoutes ?? []).filter(
      (r) => r.source === 'watch' && r.sport === 'run',
    ),
  ).toHaveLength(3);
  // Zurück zum Eintrag: Link „Strecke mit Karte ansehen“ statt Hinweis.
  await page.goto(`/log/${logWithout?.id ?? ''}`);
  await expect(page.getByTestId('watch-route-open')).toBeVisible();
  await expect(page.getByTestId('watch-route-missing')).toHaveCount(0);

  // Trennen („behalten“): Routen der Uhr weg, Einträge bleiben.
  await page.goto('/settings?thema=geraete');
  await page.getByTestId('settings-smartwatch').click();
  await page.getByTestId('smartwatch-disconnect').click();
  await page
    .getByTestId('smartwatch-disconnect-dialog')
    .getByRole('button', { name: 'Einheiten behalten' })
    .click();
  await expect(page.getByTestId('smartwatch-message')).toContainText('Getrennt.');
  const after = await stored(page);
  expect((after.trackedRoutes ?? []).filter((r) => r.source === 'watch')).toHaveLength(0);
  expect(after.rows.sessionLogs.filter((l) => l.source === 'health_connect')).toHaveLength(6);
});

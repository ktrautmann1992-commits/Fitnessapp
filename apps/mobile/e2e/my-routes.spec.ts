/// <reference types="node" />
import { mkdirSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { DEMO_IDS, seedDemoRoutes, storedRoutes } from './my-routes-helpers';
import { heading, onboard } from './plan-helpers';

/**
 * „Meine Strecken“ im TESTMODUS (25.10.2026, Mockups 2–4), Web-Export, Handy-Ansicht, Demo-Läufe:
 * - Ausdauer: Hinweis „Lauf von der Uhr … passt vermutlich zu …“, Kacheln (zuletzt gelaufen zuerst),
 * - Erkennung auf dem Gerät ordnet eine neue Aufzeichnung ohne „Erneut laufen“ automatisch zu,
 * - Lauf-Detail: „Gleiche Strecke wie …“ mit Ja / Nein / Rückgängig / Andere Strecke wählen,
 * - Strecken-Seite: Zum letzten Mal, Verlauf (Zeit/Pace), Kilometer im Vergleich, Liste (anders lang grau), Verwalten,
 * - Lauf ohne Strecke: „Als neue Strecke merken“.
 * Mit SCREENSHOT_DIR entstehen zusätzlich Bildschirmfotos (390 px). Karte/Kacheln im Test blockiert.
 */

const dir = process.env.SCREENSHOT_DIR;

async function setup(page: Page) {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
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
  await heading(page, 'Heute');
  await seedDemoRoutes(page);
}

async function shot(page: Page, name: string, testId?: string) {
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(300);
  if (testId) {
    const el = page.getByTestId(testId);
    await el.scrollIntoViewIfNeeded();
    await el.screenshot({ path: `${dir}/${name}.png` });
  } else {
    // Die App scrollt in einem eigenen Bereich – für das ganze Bild kurz eine hohe Ansicht (Breite bleibt 390 px).
    await page.setViewportSize({ width: 390, height: 3600 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/${name}.png` });
    await page.setViewportSize({ width: 390, height: 844 });
  }
}

test('Meine Strecken: Kacheln, Erkennung, Vorschlag Ja/Nein/Rückgängig, Strecken-Seite, merken', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await setup(page);

  // Ausdauer: Hinweis und Kacheln.
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await expect(page.getByTestId('my-routes-notice')).toContainText(
    'Lauf von der Uhr (Sa 24.10.) passt vermutlich zu Hausrunde Stadtpark.',
  );
  const tiles = page.getByTestId('my-routes').getByRole('button');
  await expect(tiles).toHaveCount(3);
  // Reihenfolge: zuletzt gelaufen zuerst (nie nach Tempo).
  await expect(tiles.nth(0)).toContainText('Hausrunde Stadtpark');
  await expect(tiles.nth(1)).toContainText('Arbeitsweg');
  await expect(tiles.nth(2)).toContainText('Mainufer hin und zurück');
  await expect(tiles.nth(0)).toContainText('8 Läufe');
  await expect(tiles.nth(0)).toContainText('Zuletzt Sa 24.10. · 28:05 · 1:12 min schneller');
  await expect(tiles.nth(1)).toContainText('Rad · 7,8 km · 1 Fahrt');

  // Erkennung auf dem Gerät: neue App-Aufzeichnung ohne „Erneut laufen“ ist jetzt vorläufig zugeordnet, der Lauf
  // woanders nicht.
  await expect
    .poll(
      async () => (await storedRoutes(page)).find((r) => r.id === DEMO_IDS.openRun)?.route_match,
    )
    .toBe('auto');
  const other = (await storedRoutes(page)).find((r) => r.id === DEMO_IDS.otherRun);
  expect(other?.route_match).toBeNull();
  expect(other?.base_route_id).toBeNull();
  await shot(page, '2-ausdauer-meine-strecken');

  // „Dein Fortschritt“ (auch ohne gleiche Strecke): neueste Einheit gegen eigene Läufe ähnlicher Länge.
  const progress = page.getByTestId('endurance-progress');
  await expect(progress).toContainText('Dein Fortschritt');
  await expect(page.getByTestId('endurance-progress-value')).toHaveText('Ø 5:24 /km');
  await expect(page.getByTestId('endurance-progress-last')).toContainText(
    '14 s/km schneller als am 17.10. (5:38 /km)',
  );
  await expect(page.getByTestId('endurance-progress-average')).toContainText(
    'als dein Schnitt der letzten 4 Wochen',
  );
  await expect(page.getByTestId('endurance-progress-average')).toContainText('3 Einheiten');
  await expect(progress).not.toContainText(/Bestzeit|Rekord|Platz/);
  await shot(page, '5-dein-fortschritt', 'endurance-progress');

  // Lauf-Detail des Uhr-Laufs: Vorschlag.
  await page.getByTestId('my-routes-notice-check').click();
  await expect(page.getByTestId('route-match-suggestion')).toBeVisible();
  await expect(page.getByTestId('route-match-title')).toHaveText(
    'Gleiche Strecke wie „Hausrunde Stadtpark“',
  );
  await expect(page.getByTestId('route-match-summary')).toHaveText(
    '8. Lauf auf dieser Strecke · 1:12 min schneller als am 17.10.',
  );
  await expect(
    page.getByText(/Ø Pace 5:38 → 5:24 \/km · Start, Ziel und Linie passen/),
  ).toBeVisible();
  await shot(page, '4-lauf-detail-vorschlag', 'route-match-suggestion');

  // Nein → Rückgängig → Ja.
  await page.getByTestId('route-match-no').click();
  await expect(page.getByTestId('route-match-message')).toContainText(
    'Nicht zugeordnet. Die App fragt bei diesem Lauf nicht wieder.',
  );
  await expect(page.getByTestId('route-match-none')).toBeVisible();
  let watchRun = (await storedRoutes(page)).find((r) => r.id === DEMO_IDS.watchRun);
  expect(watchRun?.route_match).toBe('rejected');
  expect(watchRun?.match_rejected_ids).toEqual([DEMO_IDS.park]);
  await shot(page, '4-lauf-detail-nein');
  await page.getByTestId('route-match-undo').click();
  await expect(page.getByTestId('route-match-suggestion')).toBeVisible();
  await page.getByTestId('route-match-yes').click();
  await expect(page.getByTestId('route-match-belongs')).toContainText(
    'Gehört zu: Hausrunde Stadtpark',
  );
  await expect(page.getByTestId('route-last-time-text')).toHaveText(
    'Heute 1:12 min schneller als beim letzten Mal.',
  );
  watchRun = (await storedRoutes(page)).find((r) => r.id === DEMO_IDS.watchRun);
  expect(watchRun?.route_match).toBe('confirmed');
  expect(watchRun?.match_rejected_ids).toEqual([]);
  await shot(page, '4-lauf-detail-ja', 'route-last-time');

  // Strecken-Seite.
  await page.getByTestId('route-detail').getByTestId('route-open-my-route').click();
  await expect(page.getByTestId('my-route')).toBeVisible();
  await heading(page, 'Hausrunde Stadtpark');
  const mr = page.getByTestId('my-route');
  await expect(mr.getByTestId('my-route-runs')).toHaveText('8');
  await expect(mr.getByTestId('my-route-last')).toHaveText('24.10.');
  await expect(mr.getByTestId('route-last-time')).toContainText('ZUM LETZTEN MAL (17.10.)');
  await expect(mr.getByTestId('route-last-time')).toContainText('29:17 → 28:05');
  await expect(mr.getByTestId('route-history-chart')).toBeVisible();
  await expect(mr.getByTestId('route-history-since')).toContainText(
    'Seit dem ersten Lauf: 2:37 min kürzer.',
  );
  await mr.getByRole('radio', { name: 'Pace' }).click();
  await expect(mr.getByText('Ø Pace · weiter unten = schneller')).toBeVisible();
  await expect(mr.getByTestId('route-split-3')).toContainText('+4 s');
  await expect(mr.getByTestId('route-split-1')).toContainText('−12 s');
  // Liste: neueste oben, anders lang grau mit Hinweis, kein „Bestzeit“.
  const runs = mr.getByTestId('route-runs').getByRole('button');
  await expect(runs).toHaveCount(8);
  await expect(runs.nth(0)).toContainText('Sa 24.10.');
  await expect(mr.getByTestId('route-runs')).toContainText(
    '3,9 km · anders lang, kein Zeitvergleich',
  );
  await expect(mr).not.toContainText(/Bestzeit|Rekord|Platz/);
  await shot(page, '3-strecken-seite');

  // Verwalten: automatisch zuordnen aus, umbenennen.
  await mr.getByTestId('my-route-auto').click();
  await expect(mr.getByTestId('my-route-auto')).toHaveAttribute('aria-checked', 'false');
  expect((await storedRoutes(page)).find((r) => r.id === DEMO_IDS.park)?.auto_match).toBe(false);
  await mr.getByTestId('my-route-rename').click();
  await mr.getByTestId('my-route-name').fill('Stadtpark-Runde');
  await mr.getByTestId('my-route-name-save').click();
  await heading(page, 'Stadtpark-Runde');

  // Lauf ohne Strecke: „Als neue Strecke merken“.
  await page.goto(`/ausdauer/${DEMO_IDS.otherRun}`);
  await expect(page.getByTestId('route-match-none')).toContainText(
    'Dieser Lauf gehört zu keiner deiner Strecken.',
  );
  await page.getByTestId('route-remember').click();
  await page.getByTestId('route-remember-name').fill('Große Runde Ostpark');
  await shot(page, '2-als-strecke-merken', 'route-remember-form');
  await page.getByTestId('route-remember-save').click();
  await expect(page.getByTestId('route-match-message')).toContainText(
    '„Große Runde Ostpark“ gemerkt.',
  );
  expect((await storedRoutes(page)).find((r) => r.id === DEMO_IDS.otherRun)?.is_favorite).toBe(
    true,
  );

  // Strecke nicht mehr merken → Läufe bleiben.
  await page.goto(`/ausdauer/strecke/${DEMO_IDS.park}`);
  await page.getByTestId('my-route-forget').click();
  await page
    .getByTestId('my-route-forget-dialog')
    .getByRole('button', { name: 'Ja, nicht mehr merken' })
    .click();
  await heading(page, 'Ausdauer');
  const after = await storedRoutes(page);
  expect(after.find((r) => r.id === DEMO_IDS.park)?.is_favorite).toBe(false);
  expect(after.filter((r) => r.base_route_id === DEMO_IDS.park).length).toBeGreaterThan(5);
});

test('Strecken-Seite: unbekannte Strecke → Hinweis', async ({ page }) => {
  await setup(page);
  await page.goto('/ausdauer/strecke/00000000-0000-4000-8000-00000000ffff');
  await expect(page.getByTestId('my-route-not-found')).toBeVisible();
});

test('Ausdauer ohne Meine Strecken: Leerzustand', async ({ page }) => {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
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
  await heading(page, 'Heute');
  await page.goto('/ausdauer');
  await expect(page.getByTestId('my-routes-empty')).toContainText('Noch keine Strecke gemerkt.');
});

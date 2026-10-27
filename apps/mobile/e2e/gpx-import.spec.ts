import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * GPX-Import im TESTMODUS (Sportarten Stufe 1 · Wandern, 27.10.2026), Web-Export, Handy-Ansicht: eigene GPX-Datei über
 * die Dateiauswahl (Playwright setzt die Datei direkt), Zusammenfassung mit Höhen und Gehzeit, Wofür-Auswahl, merken →
 * „Gemerkte Strecken“ mit Abstieg und Gehzeit. Fehlerfall: keine GPX-Datei. Beispiel-Tour ohne Datei. Nichts wird
 * hochgeladen (keine Anfrage nach außen).
 */

const THURSDAY = new Date('2026-10-22T09:00:00+02:00');

function gpxFile(): string {
  const points = Array.from({ length: 41 }, (_, i) => {
    const k = i <= 20 ? i : 40 - i;
    return `<trkpt lat="${(47.5 + k * 0.0008).toFixed(6)}" lon="${(11.2 + i * 0.0002).toFixed(6)}"><ele>${800 + k * 15}</ele></trkpt>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Hüttentour</name><trkseg>${points.join('')}</trkseg></trk></gpx>`;
}

async function setup(page: Page) {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org|openrouteservice\.org/, (route) =>
    route.abort(),
  );
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
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await page.getByTestId('endurance-loop').click();
  await heading(page, 'Rundkurs-Vorschlag');
}

test('GPX-Datei einlesen: Höhen, Gehzeit, merken als Wanderung', async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page);
  const external: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith('http://127.0.0.1') && !url.startsWith('data:') && !url.startsWith('blob:'))
      external.push(url);
  });
  await expect(page.getByTestId('gpx-import')).toContainText('nur auf diesem Gerät');

  // Keine GPX-Datei → verständlicher Fehler.
  let chooser = page.waitForEvent('filechooser');
  await page.getByTestId('gpx-open').click();
  await (
    await chooser
  ).setFiles({ name: 'notiz.txt', mimeType: 'text/plain', buffer: Buffer.from('Hallo') });
  await expect(page.getByTestId('gpx-error')).toContainText('keine GPX-Datei');

  chooser = page.waitForEvent('filechooser');
  await page.getByTestId('gpx-open').click();
  await (
    await chooser
  ).setFiles({
    name: 'huettentour.gpx',
    mimeType: 'application/gpx+xml',
    buffer: Buffer.from(gpxFile()),
  });
  const summary = page.getByTestId('gpx-summary');
  await expect(summary).toContainText('Anstieg: ca. 267 m');
  await expect(summary).toContainText('Abstieg: ca. 267 m');
  await expect(summary).toContainText('Höchster Punkt: ca. 1.082 m');
  await expect(page.getByTestId('gpx-time')).toContainText('Gehzeit (Schätzung): ca. 1 h 55 min');
  await expect(page.getByTestId('gpx-name')).toHaveValue('Hüttentour');

  await page.getByTestId('gpx-purpose-mountain_hike').click();
  await page.getByTestId('gpx-save').click();
  await expect(page.getByTestId('gpx-saved')).toContainText('Gemerkte Strecken');
  const saved = page.getByTestId('loop-saved');
  await expect(saved).toContainText('Hüttentour · GPX');
  await expect(saved).toContainText('↓ ');
  await expect(saved).toContainText('Gehzeit ca.');
  await expect(
    saved.getByRole('button', { name: 'Hüttentour: Bergwandern und aufzeichnen' }),
  ).toBeVisible();
  expect(external).toEqual([]);
});

test('GPX: Beispiel-Tour ohne Datei (Testmodus), als Laufstrecke ohne Gehzeit', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await setup(page);
  await page.getByTestId('gpx-demo').click();
  await expect(page.getByTestId('gpx-name')).toHaveValue('Beispiel-Tour zur Alm');
  await page.getByTestId('gpx-purpose-run').click();
  await expect(page.getByTestId('gpx-time')).toHaveCount(0);
  await page.getByTestId('gpx-save').click();
  const saved = page.getByTestId('loop-saved');
  await expect(saved).toContainText('Beispiel-Tour zur Alm · GPX');
  await expect(saved).not.toContainText('Gehzeit');
});

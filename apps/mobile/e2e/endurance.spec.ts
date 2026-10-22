import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Ausdauer im TESTMODUS (Etappen E4–E6, docs/PLAN-EINKAUFEN-AUSDAUER.md 6–8), Web-Export, Handy-Ansicht:
 * Hinweis „Aufzeichnen geht in der App“, Demo-Aufzeichnung (Zeitraffer) mit Pause/Fortsetzen/Stopp → speichern →
 * Auswertung (Zahlen, Kilometer-Balken, Höhenprofil, Karte mit Attribution) → Liste und Wochensummen → Story-Bild
 * (Schalter, Web Share mit Ersatz-Objekt, Download-Rückfall, keine Netzanfrage beim Erzeugen) → löschen; manueller
 * Eintrag ohne GPS erscheint in der Liste. Karte und Kacheln werden im Test blockiert (keine externen Anfragen).
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const THURSDAY = new Date('2026-10-22T09:00:00+02:00');

async function setup(page: Page) {
  // Externe Karte (CDN/Kacheln) im Test nie laden.
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  await page.clock.setFixedTime(THURSDAY);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent: false,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
}

async function storedRoutes(page: Page): Promise<{ id: string; session_log_id: string | null }[]> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  return (
    (JSON.parse(raw ?? '{}') as { trackedRoutes?: { id: string; session_log_id: string | null }[] })
      .trackedRoutes ?? []
  );
}

/** Distanz der Live-Anzeige in km. */
async function liveKm(page: Page): Promise<number> {
  const text = (await page.getByTestId('record-distance').textContent()) ?? '0';
  return Number(text.replace(' km', '').replace(',', '.'));
}

async function recordDemo(page: Page) {
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await expect(page.getByTestId('endurance-web-hint')).toContainText(
    'Aufzeichnen mit GPS geht in der App',
  );
  await expect(page.getByTestId('endurance-start')).toHaveCount(0);
  await page.getByTestId('endurance-demo').click();
  await expect(page.getByTestId('record-live')).toBeVisible();
  await expect(page.getByTestId('record-status')).toHaveText('Aufzeichnung läuft');
  await expect.poll(() => liveKm(page), { timeout: 30_000 }).toBeGreaterThan(0.7);
  await page.getByTestId('record-pause').click();
  await expect(page.getByTestId('record-status')).toHaveText('Pausiert');
  const paused = await liveKm(page);
  await page.waitForTimeout(800);
  expect(await liveKm(page)).toBe(paused);
  await page.getByTestId('record-resume').click();
  // Mehr als 1 km insgesamt (Kilometerzeiten).
  await expect.poll(() => liveKm(page), { timeout: 30_000 }).toBeGreaterThan(paused + 0.5);
  await page.getByTestId('record-stop').click();
  await page.getByTestId('record-stop-dialog').getByRole('button', { name: 'Ja, beenden' }).click();
  await expect(page.getByTestId('record-save')).toBeVisible();
}

test('Demo-Aufzeichnung → speichern → Auswertung → Liste/Summen → Story-Bild → löschen', async ({
  page,
}) => {
  await setup(page);
  await recordDemo(page);
  await expect(page.getByTestId('record-diary-free')).toContainText('freie Einheit');
  await page.getByTestId('record-name').fill('Rheinrunde');
  await page.getByTestId('record-favorite').click();
  await page.getByTestId('record-submit').click();

  // Auswertung je Lauf.
  await expect(page.getByTestId('route-detail')).toBeVisible();
  await heading(page, 'Rheinrunde');
  await expect(page.getByTestId('route-distance')).toHaveText(/^\d+,\d\d km$/);
  await expect(page.getByTestId('route-pace')).toHaveText(/min\/km$/);
  await expect(page.getByText('Höhenmeter per GPS sind ungenau.')).toBeVisible();
  await expect(page.getByTestId('split-bars')).toBeVisible();
  await expect(page.getByTestId('elevation-chart')).toBeVisible();
  await expect(page.getByTestId('route-map-attribution')).toContainText(
    '© OpenStreetMap-Mitwirkende',
  );
  await expect(page.getByTestId('route-map-failed')).toBeVisible();
  // Anschauliche Auswertung: Kopf-Karte, farbige Skizze statt Karte, Legende, Tempo-Verlauf.
  await expect(page.getByTestId('route-hero')).toBeVisible();
  await expect(page.getByTestId('route-silhouette')).toBeVisible();
  await expect(page.getByTestId('pace-legend')).toBeVisible();
  await expect(page.getByTestId('pace-chart')).toBeVisible();
  await expect(page.getByTestId('route-compare')).toContainText(
    'Das erste Mal auf dieser Strecke.',
  );

  // Gespeichert mit Tagebuch-Eintrag (Herkunft gps).
  const routes = await storedRoutes(page);
  expect(routes).toHaveLength(1);
  expect(routes[0]?.session_log_id).not.toBeNull();

  // Liste und Wochensummen: einmal gezählt (Strecke + verknüpfter Eintrag).
  await page.getByTestId('route-back').click();
  await heading(page, 'Ausdauer');
  await expect(page.getByRole('button', { name: /^Rheinrunde, 22\.10\.2026/ })).toBeVisible();
  await expect(page.getByTestId('totals-count')).toHaveText('1');
  await page.getByTestId('endurance-totals-previous').click();
  await expect(page.getByTestId('endurance-totals-empty')).toBeVisible();
  await page.getByRole('radio', { name: 'Monat' }).click();
  await expect(page.getByTestId('totals-count')).toHaveText('1');

  // Story-Bild: Schalter, Web Share mit Ersatz-Objekt, keine Netzanfrage beim Erzeugen.
  await page.getByRole('button', { name: /^Rheinrunde, 22\.10\.2026/ }).click();
  await page.getByTestId('route-share').click();
  await heading(page, 'Als Bild teilen');
  await expect(page.getByTestId('story-card')).toBeVisible();
  await expect(page.getByTestId('story-card')).toContainText('22.10.2026');
  await page.getByTestId('story-date').click();
  await expect(page.getByTestId('story-card')).not.toContainText('22.10.2026');
  await page.getByTestId('story-line').click();
  await page.evaluate(() => {
    const w = window as unknown as { __shared: { name: string; type: string; size: number }[] };
    w.__shared = [];
    Object.assign(navigator, {
      canShare: () => true,
      share: async (data: { files: File[] }) => {
        w.__shared.push(...data.files.map((f) => ({ name: f.name, type: f.type, size: f.size })));
      },
    });
  });
  const requests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('blob:') && !request.url().startsWith('data:'))
      requests.push(request.url());
  });
  await page.getByTestId('story-share').click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length))
    .toBe(1);
  const shared = await page.evaluate(
    () =>
      (window as unknown as { __shared: { name: string; type: string; size: number }[] })
        .__shared[0],
  );
  expect(shared).toMatchObject({ name: 'alpha5-einheit.png', type: 'image/png' });
  expect(shared?.size).toBeGreaterThan(10_000);
  expect(requests).toEqual([]);

  // Download-Rückfall.
  const download = page.waitForEvent('download');
  await page.getByTestId('story-download').click();
  expect((await download).suggestedFilename()).toBe('alpha5-einheit.png');

  // Löschen: Strecke weg, der Tagebuch-Eintrag bleibt (als Eintrag ohne GPS).
  await page.goBack();
  await expect(page.getByTestId('route-detail')).toBeVisible();
  await page.getByTestId('route-delete').click();
  await page
    .getByTestId('route-delete-dialog')
    .getByRole('button', { name: 'Ja, löschen' })
    .click();
  await heading(page, 'Ausdauer');
  expect(await storedRoutes(page)).toEqual([]);
  await expect(page.getByRole('button', { name: /^Lauf, 22\.10\.2026/ })).toBeVisible();
});

test('Eintrag ohne GPS erscheint in „Meine Läufe“; Kachel auf der Übersicht; Mehr', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/mehr');
  await page.getByTestId('more-endurance').click();
  await heading(page, 'Ausdauer');
  await expect(page.getByTestId('endurance-empty')).toHaveText(
    'Noch keine Läufe – starte deine erste Aufzeichnung.',
  );
  await page.getByTestId('endurance-manual').click();
  await heading(page, 'Einheit eintragen');
  await page.getByRole('radio', { name: 'Ausdauer' }).click();
  await page.getByRole('radio', { name: 'Rad' }).click();
  await page.getByTestId('backfill-start').click();
  await page.getByTestId('workout-cardio-minutes').fill('45');
  await page.getByTestId('workout-cardio-distance').fill('18');
  await page.getByTestId('workout-save').click();
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await expect(
    page.getByRole('button', { name: /^Radfahrt, 22\.10\.2026, 18,00 km/ }),
  ).toBeVisible();
  await expect(page.getByTestId('totals-distance')).toHaveText('18,00 km');
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-endurance-week')).toHaveAttribute(
    'aria-label',
    'Diese Woche: 18 km · 1 Aktivität',
  );
  // Story-Bild auch aus dem Tagebuch-Eintrag (ohne Linie).
  await page.goto('/ausdauer');
  await page.getByRole('button', { name: /^Radfahrt, 22\.10\.2026/ }).click();
  await page.getByTestId('log-share').click();
  await expect(page.getByTestId('story-card')).toContainText('18,00 km');
  await expect(page.getByTestId('story-line')).toHaveCount(0);
});

test('Abgebrochene Aufzeichnung wird nach Neuladen angeboten; zu kurz → Hinweis und Verwerfen', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/ausdauer');
  await page.getByTestId('endurance-demo').click();
  await expect(page.getByTestId('record-live')).toBeVisible();
  // Sofort pausieren (unter 1 Minute), dann neu laden (wie ein Absturz) – die Sicherung wird angeboten.
  await page.getByTestId('record-pause').click();
  await expect(page.getByTestId('record-status')).toHaveText('Pausiert');
  await page.reload();
  await page.goto('/ausdauer');
  await expect(page.getByTestId('endurance-recover')).toBeVisible();
  await page.getByTestId('endurance-recover-save').click();
  await expect(page.getByTestId('record-save')).toBeVisible();
  // Unter 1 Minute: nicht speicherbar, nur verwerfen.
  await expect(page.getByTestId('record-too-short')).toBeVisible();
  await expect(page.getByTestId('record-submit')).toHaveCount(0);
  await page.getByTestId('record-discard').click();
  await heading(page, 'Ausdauer');
  await page.reload();
  await expect(page.getByTestId('endurance-recover')).toHaveCount(0);
  await expect(page.getByTestId('endurance-demo')).toBeVisible();
});

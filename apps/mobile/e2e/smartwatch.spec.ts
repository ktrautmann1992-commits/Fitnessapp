import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Smartwatch über Health Connect im TESTMODUS (Phase 8, docs/PLAN-PHASE-8.md 7.2/9), Web-Export, Handy-Ansicht:
 * Einstellungen → „Smartwatch verbinden“ → Erklärung → eigene Einwilligung → Beispiel-Uhr verbinden (im Browser gibt es
 * kein Health Connect) → Abgleich → Stand, freigegebene Daten, Tageswerte → Uhr-Einträge im Verlauf und in „Meine
 * Läufe“ → Eintrag mit „⌚ aus Samsung Health“ und Puls/Zonen → Story-Bild ohne Puls → Trennen („löschen“).
 * Ohne Einwilligung Gesundheitsdaten: klarer Hinweis statt Verbinden. Fester Start: Donnerstag, 22.10.2026, 9 Uhr.
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const THURSDAY = new Date('2026-10-22T09:00:00+02:00');

async function setup(page: Page, consent: boolean) {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  await page.clock.setFixedTime(THURSDAY);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
}

async function openSmartwatch(page: Page) {
  await page.goto('/settings');
  await page.getByTestId('settings-smartwatch').click();
  await expect(page.getByTestId('smartwatch')).toBeVisible();
}

async function stored(page: Page) {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  return JSON.parse(raw ?? '{}') as {
    rows: { sessionLogs: { id: string; source: string; name_de: string }[] };
    wearables?: { sessions: unknown[]; heartRates: unknown[]; dailyMetrics: unknown[] };
  };
}

test('ohne Einwilligung Gesundheitsdaten: Hinweis statt Verbinden', async ({ page }) => {
  await setup(page, false);
  await openSmartwatch(page);
  await expect(page.getByTestId('smartwatch-needs-health')).toContainText('Gesundheitsdaten');
  await expect(page.getByTestId('smartwatch-connect')).toHaveCount(0);
});

test('verbinden (Beispiel-Uhr) → Abgleich → Tagebuch/Puls → Story-Bild ohne Puls → trennen', async ({
  page,
}) => {
  await setup(page, true);
  await openSmartwatch(page);
  await expect(page.getByRole('heading', { name: 'Was übernommen wird' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Was nicht passiert' })).toBeVisible();
  // Erst Einwilligung, dann der „Systemdialog“ (hier: Beispiel-Uhr).
  await expect(page.getByTestId('smartwatch-connect')).toHaveCount(0);
  await expect(page.getByTestId('smartwatch-consent')).toBeVisible();
  await page.getByTestId('smartwatch-consent-accept').click();
  await page.getByTestId('smartwatch-connect').click();
  await expect(page.getByTestId('smartwatch-message')).toContainText('Abgleich fertig – 5 neu');
  await expect(page.getByTestId('smartwatch-connected')).toContainText('Verbunden seit 22.10.2026');
  await expect(page.getByTestId('smartwatch-last-sync')).toContainText(
    'Letzter Abgleich: 22.10.2026',
  );
  await expect(page.getByText('✓ Puls')).toBeVisible();
  await expect(page.getByTestId('wearable-daily-line').first()).toContainText('Schritte');

  const db = await stored(page);
  expect(db.rows.sessionLogs.filter((l) => l.source === 'health_connect')).toHaveLength(5);
  expect(db.wearables?.heartRates.length).toBe(4);

  // Erneut abgleichen: nichts doppelt.
  await page.getByTestId('smartwatch-sync').click();
  await expect(page.getByTestId('smartwatch-message')).toContainText('keine neuen Einheiten');
  expect((await stored(page)).rows.sessionLogs).toHaveLength(5);

  // Verlauf: Uhr-Kennzeichen; Eintrag mit Herkunft und Puls.
  await page.goto('/history');
  await expect(page.getByTestId('history-entry-markers').first()).toContainText('⌚ Smartwatch');
  const run = db.rows.sessionLogs.find((l) => l.name_de === 'Lauf');
  await page.goto(`/log/${run?.id ?? ''}`);
  await expect(page.getByTestId('wearable-badge')).toContainText('⌚ aus Samsung Health');
  // kcal der Uhr an der Einheit: „ca. … kcal“ mit „laut Uhr“ (nicht mehr im Herkunfts-Hinweis).
  await expect(page.getByTestId('session-kcal-value')).toHaveText(/^ca\. \d+ kcal$/);
  await expect(page.getByTestId('session-kcal-source')).toHaveText('laut Uhr');
  await expect(page.getByTestId('hr-avg')).toContainText('/min');
  await expect(page.getByTestId('hr-zones')).toBeVisible();
  await expect(page.getByText(/Pulszonen sind Schätzwerte/)).toBeVisible();
  await expect(page.getByTestId('log-backfilled')).toHaveCount(0);
  // Story-Bild dieser Einheit: nie Puls, Zonen oder kcal (Positivliste).
  await page.getByTestId('log-share').click();
  await expect(page.getByTestId('story')).toBeVisible();
  await expect(page.getByTestId('story')).not.toContainText('/min');
  await expect(page.getByTestId('story')).not.toContainText('Zone');
  await expect(page.getByTestId('story')).not.toContainText('kcal');

  // „Meine Läufe“: Uhr-Einheiten mit Kennzeichen.
  await page.goto('/ausdauer');
  await expect(page.getByText('⌚ aus Samsung Health').first()).toBeVisible();

  // Trennen: „Einheiten löschen“ – Uhr-Einträge, Puls und Tageswerte weg.
  await openSmartwatch(page);
  await page.getByTestId('smartwatch-disconnect').click();
  await page
    .getByTestId('smartwatch-disconnect-dialog')
    .getByRole('button', { name: 'Einheiten löschen' })
    .click();
  await expect(page.getByTestId('smartwatch-message')).toContainText(
    'Getrennt. 5 übernommene Einheiten wurden gelöscht.',
  );
  const after = await stored(page);
  expect(after.rows.sessionLogs).toHaveLength(0);
  expect(after.wearables?.heartRates ?? []).toHaveLength(0);
  expect(after.wearables?.dailyMetrics ?? []).toHaveLength(0);
  await expect(page.getByTestId('smartwatch-consent-accept')).toHaveCount(0);
  await expect(page.getByTestId('smartwatch-connect')).toBeVisible();
});

test('Widerruf „Smartwatch-Daten“ in den Einwilligungen löscht Puls und Tageswerte, Einträge bleiben', async ({
  page,
}) => {
  await setup(page, true);
  await openSmartwatch(page);
  await page.getByTestId('smartwatch-consent-accept').click();
  await page.getByTestId('smartwatch-connect').click();
  await expect(page.getByTestId('smartwatch-message')).toContainText('Abgleich fertig');
  await page.goto('/settings');
  await page.getByTestId('settings-wearable-revoke').click();
  await page.getByRole('button', { name: 'Widerrufen und löschen' }).click();
  await expect(
    page.getByText(/Einwilligung widerrufen. Puls, Tageswerte und Routen der Uhr sind gelöscht/),
  ).toBeVisible();
  const db = await stored(page);
  expect(db.wearables?.heartRates ?? []).toHaveLength(0);
  expect(db.wearables?.dailyMetrics ?? []).toHaveLength(0);
  expect(db.rows.sessionLogs.filter((l) => l.source === 'health_connect')).toHaveLength(5);
});

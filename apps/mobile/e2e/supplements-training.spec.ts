import { mkdirSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Supplemente rund ums Training (Gründer-Entscheidung 06.11.2026, docs/PLAN-SUPPLEMENTE-TRAINING.md) im TESTMODUS:
 * Schalter „Nahrungsergänzungsmittel anzeigen“ (Standard aus → keine Karte auf „Heute“, keine Kachel unter
 * „Ernährung“, Supplement-Seite mit Erklärung und Schalter), nach dem Einschalten „Supplemente heute“ mit Zeitpunkten
 * rund um die Einheit (Kreatin, Koffein-Fenster vor 16 Uhr). Bildschirmfotos optional über SUPP_SHOTS (Ordner).
 */

const LOCAL_DB = 'fitnessapp.local.v1';
// Mittwoch, 21.10.2026 – Einheit heute um 7 Uhr.
const NOW = new Date('2026-10-21T06:00:00+02:00');
const TODAY = '2026-10-21';
const SHOTS = process.env.SUPP_SHOTS;

type Stored = { rows: Record<string, unknown> };

async function patchDb(page: Page, change: (db: Stored) => void) {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  const db = JSON.parse(raw ?? '{}') as Stored;
  change(db);
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
    LOCAL_DB,
    JSON.stringify(db),
  ] as const);
}

async function shot(page: Page, name: string, testId: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const target = page.getByTestId(testId);
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test.use({ deviceScaleFactor: 2, viewport: { width: 390, height: 844 } });

test('Schalter aus → nichts sichtbar; an → „Supplemente heute“ mit Zeitpunkten zur Einheit um 7 Uhr', async ({
  page,
}) => {
  await page.clock.install({ time: NOW });
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent: true,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Mittwoch', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await patchDb(page, (db) => {
    const sessions = db.rows.plannedSessions as {
      scheduled_on: string;
      start_time: string | null;
    }[];
    for (const s of sessions) if (s.scheduled_on === TODAY) s.start_time = '07:00';
  });

  // Standard AUS: keine Karte auf „Heute“, keine Kachel unter „Ernährung“.
  await page.goto('/today');
  await heading(page, 'Training');
  await expect(page.getByTestId('supplement-timing-card')).toHaveCount(0);
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('nutrition-supplements')).toHaveCount(0);

  // Supplement-Seite: Erklärung und Schalter (aus).
  await page.goto('/supplemente');
  await heading(page, 'Supplemente');
  await expect(page.getByTestId('supplements-hidden')).toBeVisible();
  const toggle = page.getByTestId('supplements-visibility');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(toggle).toHaveAttribute('role', 'switch');
  await shot(page, 'schalter-aus', 'supplements-visibility');

  // Einschalten → Inhalte, dann Supplement-Check (Kreatin passt bei Muskelaufbau).
  await toggle.click();
  await expect(page.getByTestId('supplements-disclaimer')).toBeVisible();
  await page.getByTestId('supplements-check-start').click();
  await heading(page, 'Supplement-Check');
  for (const id of ['kidney', 'heart_rhythm', 'caffeine_sensitive']) {
    await page.getByTestId(`supplement-check-${id}-no`).click();
  }
  await page.getByTestId('supplement-check-protein-no').click();
  await page.getByTestId('supplement-check-save').click();
  await heading(page, 'Supplemente');

  // Einstellungen: Schalter an, Links sichtbar.
  await page.goto('/settings?thema=ernaehrung');
  const settingsToggle = page.getByTestId('settings-supplements-visibility');
  await expect(settingsToggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('settings-supplements')).toBeVisible();
  await shot(page, 'schalter-an', 'settings-supplements-visibility');

  // „Heute“: Zeitpunkte rund um die Einheit um 7 Uhr.
  await page.goto('/today');
  await heading(page, 'Training');
  const card = page.getByTestId('supplement-timing-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Passend zu deiner Einheit um 07:00 Uhr');
  await expect(page.getByTestId('supplement-timing-line-creatine')).toContainText(
    'Uhrzeit ist egal',
  );
  await expect(page.getByTestId('supplement-timing-line-caffeine')).toContainText(
    'etwa 06:00 Uhr bis 06:30 Uhr',
  );
  await expect(card).not.toContainText('Anzeige');
  await shot(page, 'timing', 'supplement-timing-card');

  // Wieder ausschalten → Karte weg.
  await page.goto('/settings?thema=ernaehrung');
  await page.getByTestId('settings-supplements-visibility').click();
  await expect(page.getByTestId('settings-supplements')).toHaveCount(0);
  await page.goto('/today');
  await heading(page, 'Training');
  await expect(page.getByTestId('supplement-timing-card')).toHaveCount(0);
});

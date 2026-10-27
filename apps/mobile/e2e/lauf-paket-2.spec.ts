/// <reference types="node" />
import { mkdirSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { DEMO_IDS, seedDemoRoutes } from './my-routes-helpers';
import { heading, onboard } from './plan-helpers';

/**
 * Lauf-Paket 2 im TESTMODUS (docs/PLAN-LAUF-PAKET-2.md), Web-Export, Handy-Ansicht 390 px:
 * - Ausdauer: Belastungs-Ampel (Tagebuch über 4 Wochen, letzte Woche mehr), Zeitprognose aus den Demo-Läufen
 *   (Marathon: „Dafür fehlt ein Lauf ab …“), Hinweis „Es wird dunkel“ (Startort des letzten Laufs, Köln),
 * - Lauf mit Höhenprofil: bergbereinigtes Tempo (GAP),
 * - Beispiel-Uhr: Pulszonen-Tabelle mit Bereichen, Kadenz, Pulszonen-Einstellung (eigener Maximalpuls).
 * Mit SCREENSHOT_DIR entstehen Bildschirmfotos. Karte/Kacheln im Test blockiert.
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const dir = process.env.SCREENSHOT_DIR;

async function shot(page: Page, name: string, testId?: string) {
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(300);
  if (testId) {
    const el = page.getByTestId(testId);
    await el.scrollIntoViewIfNeeded();
    await el.screenshot({ path: `${dir}/${name}.png` });
  } else {
    await page.setViewportSize({ width: 390, height: 3600 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/${name}.png` });
    await page.setViewportSize({ width: 390, height: 844 });
  }
}

async function start(page: Page, time: string, consent: boolean) {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  await page.clock.setFixedTime(new Date(time));
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [['Montag', 'Kraft im Studio', 60]],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
}

/**
 * Tagebuch über 4 Wochen (Ausdauer-Einträge mit Beginn/Ende, ohne Strecke): drei Wochen je 3 × 40 min, die letzte
 * Woche 4 × 45 min → Ampel gelb (1,33). Dazu ein Höhenprofil am vorletzten Demo-Lauf (für GAP).
 */
async function seedDiary(page: Page, userId: string) {
  await page.evaluate(
    ({ key, userId, previous }) => {
      const db = JSON.parse(window.localStorage.getItem(key) ?? '{}') as {
        rows?: { sessionLogs?: unknown[] };
        trackedRoutes?: { id: string; elevation_profile: unknown }[];
      };
      const day = (back: number) => {
        const d = new Date(Date.UTC(2026, 9, 25 - back));
        return d.toISOString().slice(0, 10);
      };
      const log = (back: number, minutes: number, n: number) => {
        const performed = day(back);
        const started = `${performed}T16:00:00.000Z`;
        const finished = new Date(Date.parse(started) + minutes * 60_000).toISOString();
        return {
          id: `00000000-0000-4000-8000-00000000c${String(n).padStart(3, '0')}`,
          user_id: userId,
          planned_session_id: null,
          performed_on: performed,
          kind: 'endurance',
          name_de: 'Lauf',
          status: 'completed',
          is_free: true,
          is_deload: false,
          is_intro_week: false,
          from_health_plan: false,
          notes: null,
          session_rpe: 5,
          source: 'manual',
          sport: null,
          sport_distance_m: null,
          sport_duration_s: null,
          started_at: started,
          finished_at: finished,
          revision: 1,
          last_write_id: `00000000-0000-4000-8000-00000000d${String(n).padStart(3, '0')}`,
          client_updated_at: started,
          created_at: started,
          updated_at: started,
        };
      };
      const backs = [8, 10, 12, 15, 17, 19, 22, 24, 26];
      const logs = [
        ...backs.map((b, i) => log(b, 40, i)),
        ...[0, 2, 4, 6].map((b, i) => log(b, 45, 20 + i)),
      ];
      db.rows = { ...(db.rows ?? {}), sessionLogs: [...(db.rows?.sessionLogs ?? []), ...logs] };
      // Höhenprofil (Hausrunde mit Hügel): 0 → +28 m bei 2,6 km → zurück.
      const profile: [number, number][] = [];
      for (let m = 0; m <= 5200; m += 100) {
        const h = m <= 2600 ? (m / 2600) * 280 : ((5200 - m) / 2600) * 280;
        profile.push([m, Math.round(450 + h)]);
      }
      for (const r of db.trackedRoutes ?? []) if (r.id === previous) r.elevation_profile = profile;
      window.localStorage.setItem(key, JSON.stringify(db));
    },
    { key: LOCAL_DB, userId, previous: DEMO_IDS.previous },
  );
}

test('Ausdauer: Belastungs-Ampel, Zeitprognose, Dunkelheit; Lauf mit Höhenprofil: GAP', async ({
  page,
}) => {
  test.setTimeout(120_000);
  // Sonntag, 25.10.2026, 16:30 Uhr (MEZ) – Sonnenuntergang in Köln ca. 17:10.
  await start(page, '2026-10-25T16:30:00+01:00', false);
  const userId = await seedDemoRoutes(page);
  await seedDiary(page, userId);

  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await expect(page.getByTestId('darkness-hint')).toBeVisible();
  await expect(page.getByTestId('darkness-hint')).toContainText('Sonnenuntergang heute um');
  await expect(page.getByTestId('load-ampel-yellow')).toHaveText('Etwas viel');
  await expect(page.getByTestId('race-5k')).toContainText('ca.');
  await expect(page.getByTestId('race-10k')).toContainText('ca.');
  await expect(page.getByTestId('race-half')).toContainText('ca.');
  await expect(page.getByTestId('race-marathon')).toContainText('Dafür fehlt ein Lauf ab 10,6 km');
  await shot(page, '01-ausdauer-dunkel-hinweis', 'darkness-hint');
  await shot(page, '02-belastung', 'load-ampel');
  await shot(page, '03-zeitprognose', 'race-prediction');
  await shot(page, '00-ausdauer-ganz');

  await page.goto(`/ausdauer/${DEMO_IDS.previous}`);
  await expect(page.getByTestId('route-detail')).toBeVisible();
  await expect(page.getByTestId('route-gap')).toHaveText(/^\d:\d{2} min\/km$/);
  await shot(page, '04-lauf-gap', 'route-stats');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await shot(page, '05-belastung-dunkel', 'load-ampel');
  await shot(page, '06-zeitprognose-dunkel', 'race-prediction');
});

test('Beispiel-Uhr: Pulszonen mit Bereichen, Kadenz, Pulszonen-Einstellung', async ({ page }) => {
  test.setTimeout(180_000);
  await start(page, '2026-10-22T09:00:00+02:00', true);
  // Pulszonen-Einstellung dieses Geräts vor dem ersten Abgleich: eigener Maximalpuls 190, Ruhepuls einbeziehen.
  await page.evaluate((key) => {
    const db = JSON.parse(window.localStorage.getItem(key) ?? '{}') as {
      session?: { userId: string };
    };
    const userId = db.session?.userId ?? '';
    window.localStorage.setItem(
      'fitnessapp.pulse-zones.v1',
      JSON.stringify({ [userId]: { hfMaxOverride: 190, useRestingHr: true } }),
    );
  }, LOCAL_DB);
  await page.goto('/settings?thema=geraete');
  await page.getByTestId('settings-smartwatch').click();
  await page.getByTestId('smartwatch-consent-accept').click();
  await page.getByTestId('smartwatch-connect').click();
  await expect(page.getByTestId('smartwatch-message')).toContainText('Abgleich fertig – 6 neu');

  // Einstellung: vorbelegt, ungültige Eingabe → Hinweis, gültige → gespeichert.
  await expect(page.getByTestId('pulse-zone-settings')).toBeVisible();
  await expect(page.getByTestId('pulse-zone-own-max')).toHaveValue('190');
  await expect(page.getByTestId('pulse-zone-resting')).toContainText(/Dein Ruhepuls: \d+\/min/);
  await page.getByTestId('pulse-zone-own-max').fill('250');
  await page.getByTestId('pulse-zone-save').click();
  await expect(page.getByText('Bitte eine ganze Zahl zwischen 120 und 230')).toBeVisible();
  await page.getByTestId('pulse-zone-own-max').fill('190');
  await expect(page.getByTestId('pulse-zone-preview')).toContainText('Herzfrequenz-Reserve');
  await page.getByTestId('pulse-zone-save').click();
  await expect(page.getByTestId('pulse-zone-saved')).toBeVisible();
  await shot(page, '07-pulszonen-einstellung', 'pulse-zone-settings');

  const routes = await page.evaluate((key) => {
    const db = JSON.parse(window.localStorage.getItem(key) ?? '{}') as {
      trackedRoutes?: { id: string; source: string; sport: string; distance_m: number }[];
    };
    // Nur Läufe (die Beispiel-Uhr hat seit Etappe W zusätzlich eine Wanderung mit Route).
    return (db.trackedRoutes ?? []).filter((r) => r.source === 'watch' && r.sport === 'run');
  }, LOCAL_DB);
  expect(routes.length).toBeGreaterThan(0);
  await page.goto(`/ausdauer/${routes[0]?.id ?? ''}`);
  await expect(page.getByTestId('route-detail')).toBeVisible();
  await expect(page.getByTestId('pulse-zone-table')).toBeVisible();
  await expect(page.getByTestId('pulse-zone-note')).toContainText(
    'Maximalpuls 190/min, eigener Wert',
  );
  await expect(page.getByTestId('pulse-zone-5')).toContainText('ab ');
  await expect(page.getByTestId('route-cadence')).toHaveText(/^1[67]\d$/);
  await expect(page.getByTestId('route-cadence-hint')).toContainText('üblichen Bereich');
  await shot(page, '08-uhr-lauf-pulszonen', 'hr-zone-bar');
  await shot(page, '09-uhr-lauf-kadenz', 'route-stats');
  await page.emulateMedia({ colorScheme: 'dark' });
  await shot(page, '10-uhr-lauf-pulszonen-dunkel', 'hr-zone-bar');
  await page.emulateMedia({ colorScheme: 'light' });

  // Story-Bild: nie Puls, Zonen oder Kadenz.
  await page.getByTestId('route-share').click();
  await expect(page.getByTestId('story')).toBeVisible();
  await expect(page.getByTestId('story')).not.toContainText('/min');
  await expect(page.getByTestId('story')).not.toContainText('Zone');
});

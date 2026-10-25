import { expect, test, type Page } from '@playwright/test';

import { onboardNutrition, patchDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Schuh-Kilometerzähler und Renn-Pace-Plan (Gründer-Freigabe 25.10.2026, docs/PLAN-PHASE-10.md Abschnitt 22) im
 * TESTMODUS, Web-Export, Handy-Ansicht (390 px):
 * - Schuhe: anlegen (400 km vorher, Standard) → Lauf eintragen (12 km) bekommt ihn automatisch → Kachel 412 km, Chip
 *   „Schuh: Pegasus 41 (412 km)“ am Lauf; Wahl „Ohne Schuh“ und zurück; Hinweis „Bald wechseln“ ab 600 km;
 *   ausmustern → kein Standard mehr; Export enthält die Tabellen.
 * - Pace-Plan: Halbmarathon mit Zielzeit 1:50:00 (Wettkampf direkt im Gerätespeicher, Mindestvorlauf) → Tabelle je
 *   km, Verpflegung bei km 5,8 / 11,5 / 17,3, „Negativ“, Strecke mit Höhenprofil, unplausible Zielzeit → Hinweis und
 *   Vorhersage, Druckansicht.
 * Element-Bildschirmfotos nach $SCREENSHOT_DIR, wenn gesetzt.
 */

const shots = process.env.SCREENSHOT_DIR;
const SUNDAY = '2026-10-18';

/** Hohe Karte ganz aufnehmen: Ansicht kurz verlängern (sonst überdeckt die feste Fußleiste den Rest). */
async function tallShot(page: Page, target: ReturnType<Page['getByTestId']>, name: string) {
  await page.setViewportSize({ width: 390, height: 4200 });
  await target.screenshot({ path: `${shots}/${name}.png` });
  await page.setViewportSize({ width: 390, height: 844 });
}

async function noMaps(page: Page) {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
}

/** Lauf ohne GPS eintragen: 60 min, `km` km. */
async function manualRun(page: Page, km: string) {
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await page.getByTestId('endurance-manual').click();
  await heading(page, 'Einheit eintragen');
  await page.getByRole('radio', { name: 'Ausdauer' }).click();
  await page.getByRole('radio', { name: 'Laufen', exact: true }).click();
  await page.getByTestId('backfill-start').click();
  await page.getByTestId('workout-cardio-hours').fill('1');
  await page.getByTestId('workout-cardio-minutes').fill('0');
  await page.getByTestId('workout-cardio-distance').fill(km);
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout')).toHaveCount(0);
}

test('Schuhe: anlegen, Lauf zählt automatisch, Chip am Lauf, Wahl ändern, 600-km-Hinweis, ausmustern, Export', async ({
  page,
}) => {
  await noMaps(page);
  await onboardNutrition(page);

  // Ausdauer: noch keine Schuhe.
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  const overview = page.getByTestId('shoe-overview');
  await expect(overview.getByTestId('shoe-empty')).toBeVisible();
  await overview.getByTestId('shoe-open').click();
  await heading(page, 'Meine Schuhe');
  await expect(page.getByTestId('shoes-rule')).toContainText('500–800 km');
  await expect(page.getByTestId('shoes-rule')).toContainText('keine Gesundheitsaussage');

  // Anlegen: Pegasus 41, Nike, 400 km vorher, Standard (vorbelegt, da noch keiner).
  await page.getByTestId('shoes-add').click();
  const form = page.getByTestId('shoe-form');
  await page.getByTestId('shoe-form-save').click();
  await expect(form).toContainText('Bitte gib einen Namen ein');
  await page.getByTestId('shoe-form-name').fill('Pegasus 41');
  await page.getByTestId('shoe-form-brand').fill('Nike');
  await page.getByTestId('shoe-form-start-km').fill('400');
  await expect(page.getByTestId('shoe-form-default')).toHaveAttribute('aria-checked', 'true');
  await expect(form).not.toContainText('Bitte gib einen Namen ein');
  if (shots) await tallShot(page, form, 'schuh-formular');
  await page.getByTestId('shoe-form-save').click();
  await expect(page.getByTestId('shoes-message')).toHaveText('Gespeichert.');

  // Lauf 12 km → automatisch dem Standard-Schuh zugeordnet.
  await manualRun(page, '12');
  await page.goto('/ausdauer');
  const tile = overview.locator('[data-testid^="shoe-tile-"]').first();
  await expect(tile).toContainText('Pegasus 41');
  await expect(tile).toContainText('412 km');
  await expect(tile).toContainText('✓ Gut in Schuss');
  await expect(tile).toContainText('Standard');
  await expect(tile).toContainText('1 Lauf · inkl. 400 km vorher');
  if (shots) await overview.screenshot({ path: `${shots}/schuh-kacheln.png` });

  // Am Lauf: Chip, Wahl „Ohne Schuh“ → Summe ohne den Lauf, zurück auf automatisch.
  await page.getByRole('button', { name: /^Lauf, 12\.10\.2026, 12,00 km/ }).click();
  const chip = page.getByTestId('shoe-chip');
  await expect(chip).toContainText(/Schuh: Pegasus 41 \(412\s?km\)/);
  await expect(chip).toContainText('automatisch');
  if (shots) await page.getByTestId('log-cardio').screenshot({ path: `${shots}/schuh-chip.png` });
  await chip.click();
  const dialog = page.getByTestId('shoe-chip-dialog');
  await expect(dialog).toContainText('Automatisch (Standard: Pegasus 41)');
  await dialog.getByRole('radio', { name: 'Ohne Schuh' }).click();
  if (shots) await dialog.screenshot({ path: `${shots}/schuh-auswahl.png` });
  await dialog.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(chip).toHaveText('Schuh: keiner');
  await page.goto('/ausdauer');
  await expect(tile).toContainText('400 km');
  await page.getByRole('button', { name: /^Lauf, 12\.10\.2026, 12,00 km/ }).click();
  await chip.click();
  await dialog.getByRole('radio', { name: /^Automatisch/ }).click();
  await dialog.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(chip).toContainText(/Schuh: Pegasus 41 \(412\s?km\)/);

  // 600-km-Hinweis: Start-km auf 590 → 602 km „Bald wechseln“.
  await page.goto('/ausdauer/schuhe');
  await page.locator('[data-testid$="-edit"]').first().click();
  await page.getByTestId('shoe-form-start-km').fill('590');
  await page.getByTestId('shoe-form-save').click();
  const manageTile = page.locator('[data-testid^="shoe-"][data-testid$="-status"]').first();
  await expect(manageTile).toHaveText('! Bald wechseln');
  await expect(page.getByTestId('shoes')).toContainText('602 von 800 km');
  if (shots) await page.screenshot({ path: `${shots}/schuhe-verwalten.png`, fullPage: true });

  // Export enthält die Schuh-Tabellen (Testmodus).
  const exported = await page.evaluate(async () => {
    const raw = window.localStorage.getItem('fitnessapp.shoes.v1');
    return raw ? (JSON.parse(raw) as { data: { shoes: unknown[] } }).data.shoes.length : 0;
  });
  expect(exported).toBe(1);

  // Ausmustern → kein Standard mehr; neuer Lauf bekommt keinen Schuh.
  await page.locator('[data-testid$="-retire"]').first().click();
  await expect(page.getByTestId('shoes-message')).toHaveText('Pegasus 41 ist ausgemustert.');
  await expect(page.getByTestId('shoes')).toContainText('Ausgemustert');
});

function competitionRow(patch: Record<string, unknown> = {}) {
  return {
    id: 'pace-comp',
    user_id: 'local',
    name: 'Stadtlauf',
    discipline: 'half_marathon',
    distance_m: 21097.5,
    race_date: SUNDAY,
    goal_kind: 'time',
    target_time_s: 6600,
    reference_discipline: '10k',
    reference_time_s: 3000,
    reference_date: '2026-09-20',
    long_run_weekday: null,
    status: 'planned',
    result_session_log_id: null,
    own_start_weekly_minutes: null,
    start_reference_volume: null,
    start_reference_session_cap: null,
    start_reference_start_group: null,
    effective_goal: null,
    uses_health_data: false,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
    ...patch,
  };
}

/** GPX-Strecke mit Höhenprofil (21,3 km, Hügel in der Mitte) im Gerätespeicher. */
function courseRow(userId: string) {
  const profile: [number, number][] = [];
  for (let d = 0; d <= 21300; d += 300) {
    const hill = d > 8000 && d < 13000 ? Math.round(((d - 8000) / 5000) * 600) : 0;
    profile.push([d, 1500 + (d >= 13000 ? 600 - Math.min(600, ((d - 13000) / 3000) * 600) : hill)]);
  }
  return {
    id: '55555555-5555-4555-8555-555555555555',
    user_id: userId,
    name: 'Stadtlauf-Strecke (GPX)',
    sport: 'run',
    started_at: '2026-10-05T08:00:00.000Z',
    duration_s: 7800,
    moving_s: 7800,
    distance_m: 21300,
    elevation_gain_m: 60,
    polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
    point_count: 3,
    bbox: [38.5, -126.453, 43.252, -120.2],
    km_splits: [],
    difficulty: null,
    is_favorite: false,
    base_route_id: null,
    note: null,
    session_log_id: null,
    source: 'gpx_import',
    elevation_profile: profile,
    wearable_session_log_id: null,
    e_bike: false,
    created_at: '2026-10-05T10:00:00.000Z',
    updated_at: '2026-10-05T10:00:00.000Z',
  };
}

test('Pace-Plan: Tabelle je km, Verpflegung, negativ, Höhenprofil, unplausible Zielzeit, Druckansicht', async ({
  page,
}) => {
  await noMaps(page);
  await onboardNutrition(page);
  await patchDb(page, (value) => {
    const userId = (value.session as { userId: string }).userId;
    return {
      ...value,
      rows: { ...value.rows, competitions: [competitionRow()] },
      trackedRoutes: [courseRow(userId)],
    } as typeof value;
  });

  await page.goto('/wettkampf');
  const card = page.getByTestId('race-pace');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('race-pace-intro')).toHaveText('Zielzeit 1:50:00 · Ø 5:13 pro km');
  await expect(page.getByTestId('race-pace-row-1')).toContainText('km 0–1');
  await expect(page.getByTestId('race-pace-row-1')).toContainText('5:13');
  await expect(page.getByTestId('race-pace-row-22')).toContainText('km 21–21,1');
  await expect(page.getByTestId('race-pace-row-22')).toContainText('1:50:00');
  // Verpflegung wie die Wettkampf-Ernährung (unter 120 min: bis 30 g/h → je 30 min bis 15 g).
  const fuel = card.getByTestId('race-pace-fuel');
  await expect(fuel).toHaveCount(3);
  await expect(fuel.first()).toHaveText(
    '◆ Verpflegung bei km 5,8 (nach 30 min): bis 15 g Kohlenhydrate',
  );
  await expect(page.getByTestId('race-pace-effort')).toContainText('Die Anstrengung hat Vorrang');
  await expect(page.getByTestId('race-pace-not-plausible')).toHaveCount(0);
  if (shots) await tallShot(page, card, 'pace-plan');

  // Negativ: erste Kilometer langsamer als die letzten, Ziel bleibt 1:50:00.
  await card.getByRole('radio', { name: 'Negativ' }).click();
  await expect(page.getByTestId('race-pace-row-1')).toContainText('5:16');
  await expect(page.getByTestId('race-pace-row-21')).toContainText('5:10');
  await expect(page.getByTestId('race-pace-row-22')).toContainText('1:50:00');

  // Strecke mit Höhenprofil: Bergauf-Kilometer langsamer, Höhenmeter je Abschnitt.
  await card.getByRole('radio', { name: 'Gleichmäßig' }).click();
  await card.getByRole('radio', { name: 'Stadtlauf-Strecke (GPX)' }).click();
  await expect(page.getByTestId('race-pace-row-10')).toContainText('+12 / −0 m');
  await expect(page.getByTestId('race-pace-row-22')).toContainText('1:50:00');
  if (shots) await tallShot(page, card, 'pace-plan-hoehenprofil');

  // Druckansicht (PDF) mit derselben Wahl.
  await card.getByTestId('race-pace-print').click();
  await expect(page.getByTestId('pace-print')).toBeVisible();
  await expect(page.getByTestId('pace-print')).toContainText('Pace-Plan: Stadtlauf');
  await expect(page.getByTestId('pace-print')).toContainText('Stadtlauf-Strecke (GPX)');
  await expect(page.getByTestId('pace-print-button')).toBeEnabled();
  if (shots) await page.screenshot({ path: `${shots}/pace-plan-druck.png` });

  // Unplausible Zielzeit (1:30:00 bei 50 min auf 10 km) → Hinweis wie die Ampel, Plan mit Vorhersage.
  await patchDb(page, (value) => ({
    ...value,
    rows: { ...value.rows, competitions: [competitionRow({ target_time_s: 5400 })] },
  }));
  await page.goto('/wettkampf');
  const warn = page.getByTestId('race-pace-not-plausible');
  await expect(warn).toContainText('Die Zielzeit passt nicht zu deiner Referenzzeit');
  if (shots) await warn.screenshot({ path: `${shots}/pace-plan-unplausibel.png` });
  await page.getByTestId('race-pace-use-predicted').click();
  await expect(page.getByTestId('race-pace-intro')).toContainText(
    'Vorhersage aus deiner Referenzzeit 1:50:',
  );
  await expect(page.getByTestId('race-pace-not-plausible')).toHaveCount(0);
});

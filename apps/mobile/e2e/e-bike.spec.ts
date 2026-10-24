import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * E-Bike beim Radfahren (Gründer-Wunsch 23.10.2026) im TESTMODUS, Web-Export, Handy-Ansicht:
 * - Eintragen ohne GPS: beim Rad „Fahrrad | E-Bike“, gleiche Fahrt als E-Bike → Abzeichen „E-Bike“ im Tagebuch, kcal
 *   niedriger als als Fahrrad (TRAINING_MET.eBike), Liste „E-Bike · …“, Summen „davon E-Bike“, gemerkte Wahl;
 * - Demo-Aufzeichnung als E-Bike → Speichern zeigt die Wahl → Auswertung mit Abzeichen, Story-Bild „E-Bike-Fahrt“ ohne
 *   kcal; Umstellen auf Fahrrad an der Strecke.
 * Element-Bildschirmfotos nach $SCREENSHOT_DIR, wenn gesetzt.
 */

const THURSDAY = new Date('2026-10-22T09:00:00+02:00');
const shots = process.env.SCREENSHOT_DIR;

async function setup(page: Page) {
  // Externe Karte (CDN/Kacheln) im Test nie laden.
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  await page.clock.setFixedTime(THURSDAY);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  // Mit Einwilligung Gesundheitsdaten (Gewicht 80 kg) – sonst gäbe es keine kcal-Schätzung.
  await onboard(page, {
    consent: true,
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

/** Radfahrt ohne GPS eintragen: 60 min, 20 km; `eBike` = Wahl im Formular (null = Vorbelegung lassen). */
async function manualRide(page: Page, eBike: boolean | null) {
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await page.getByTestId('endurance-manual').click();
  await heading(page, 'Einheit eintragen');
  await page.getByRole('radio', { name: 'Ausdauer' }).click();
  await page.getByRole('radio', { name: 'Rad', exact: true }).click();
  await page.getByTestId('backfill-start').click();
  const choice = page.getByTestId('workout-cardio-bike-type');
  await expect(choice).toBeVisible();
  if (eBike !== null) {
    await choice.getByTestId(`workout-cardio-bike-type-${eBike ? 'ebike' : 'bike'}`).click();
  }
  await page.getByTestId('workout-cardio-hours').fill('1');
  await page.getByTestId('workout-cardio-minutes').fill('0');
  await page.getByTestId('workout-cardio-distance').fill('20');
  // Geschwindigkeit bleibt km/h (wie beim Fahrrad).
  await expect(page.getByTestId('workout-cardio-speed')).toContainText('Geschwindigkeit: 20 km/h');
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout')).toHaveCount(0);
}

async function kcalOf(page: Page, name: RegExp): Promise<number> {
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await page.getByRole('button', { name }).click();
  const entry = page.getByTestId('log-entry');
  const value = entry.getByTestId('session-kcal-value');
  await expect(value).toHaveText(/^ca\. [\d.]+ kcal$/);
  return Number(((await value.textContent()) ?? '').replace(/[^\d]/g, ''));
}

async function liveKm(page: Page): Promise<number> {
  const text = (await page.getByTestId('record-distance').textContent()) ?? '0';
  return Number(text.replace(' km', '').replace(',', '.'));
}

test('ohne GPS: gleiche Fahrt als E-Bike → Abzeichen, weniger kcal als Fahrrad, Summen „davon E-Bike“', async ({
  page,
}) => {
  await setup(page);

  // 1. E-Bike gewählt.
  await manualRide(page, true);
  // 2. Neuer Eintrag: Vorbelegung = zuletzt gewählt (E-Bike), umstellen auf Fahrrad.
  await page.goto('/ausdauer');
  await page.getByTestId('endurance-manual').click();
  await page.getByRole('radio', { name: 'Ausdauer' }).click();
  await page.getByRole('radio', { name: 'Rad', exact: true }).click();
  await page.getByTestId('backfill-start').click();
  await expect(page.getByTestId('workout-cardio-bike-type-ebike')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  if (shots) {
    await page.getByTestId('workout-cardio').screenshot({ path: `${shots}/e-bike-eintragen.png` });
  }
  await page.getByTestId('workout-cardio-bike-type-bike').click();
  await expect(page.getByTestId('workout-cardio-bike-type-bike')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByTestId('workout-cardio-hours').fill('1');
  await page.getByTestId('workout-cardio-minutes').fill('0');
  await page.getByTestId('workout-cardio-distance').fill('20');
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout')).toHaveCount(0);

  // Liste und Summen: beide zählen bei „Rad“, E-Bike getrennt ausgewiesen.
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await expect(page.getByTestId('totals-distance')).toHaveText('40,00 km');
  await expect(page.getByTestId('totals-e-bike')).toHaveText('davon E-Bike: 20 km · 1 Fahrt');
  const eBikeItem = page.getByRole('button', {
    name: /^Radfahrt, 22\.10\.2026, 20,00 km, E-Bike$/,
  });
  await expect(eBikeItem).toBeVisible();
  await expect(eBikeItem).toContainText('E-Bike · 22.10.2026');
  if (shots) await eBikeItem.screenshot({ path: `${shots}/e-bike-liste.png` });

  // kcal: E-Bike (MET 6,0 × 80 kg) < Fahrrad (MET 6,8 × 80 kg) bei gleicher Dauer.
  const eBikeKcal = await kcalOf(page, /^Radfahrt, 22\.10\.2026, 20,00 km, E-Bike$/);
  await expect(page.getByTestId('log-e-bike')).toBeVisible();
  await expect(page.getByTestId('log-cardio')).toContainText('E-Bike');
  if (shots)
    await page.getByTestId('log-cardio').screenshot({ path: `${shots}/e-bike-tagebuch.png` });
  const bikeKcal = await kcalOf(page, /^Radfahrt, 22\.10\.2026, 20,00 km$/);
  await expect(page.getByTestId('log-e-bike')).toHaveCount(0);
  expect(eBikeKcal).toBe(480);
  expect(bikeKcal).toBe(545);
  expect(eBikeKcal).toBeLessThan(bikeKcal);
});

test('Demo-Aufzeichnung als E-Bike → Abzeichen, Umstellen auf Fahrrad, Story „E-Bike-Fahrt“ ohne kcal', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await page.getByRole('radio', { name: 'Rad', exact: true }).click();
  const start = page.getByTestId('endurance-bike-type');
  await expect(start).toBeVisible();
  await start.getByTestId('endurance-bike-type-ebike').click();
  if (shots) await start.screenshot({ path: `${shots}/e-bike-start.png` });
  await page.getByTestId('endurance-demo').click();
  await expect(page.getByTestId('record-live')).toBeVisible();
  await expect(page.getByRole('heading', { name: /E-Bike – Aufzeichnung/ })).toBeVisible();
  await expect.poll(() => liveKm(page), { timeout: 30_000 }).toBeGreaterThan(1.1);
  // Geschwindigkeit in km/h (Rad).
  await expect(page.getByTestId('record-pace')).toContainText('km/h');
  await page.getByTestId('record-stop').click();
  await page.getByTestId('record-stop-dialog').getByRole('button', { name: 'Ja, beenden' }).click();
  await expect(page.getByTestId('record-save')).toBeVisible();
  await expect(page.getByTestId('record-bike-type-ebike')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('record-save-e-bike')).toBeVisible();
  await page.getByTestId('record-name').fill('Feierabend mit Rückenwind');
  await page.getByTestId('record-submit').click();

  await expect(page.getByTestId('route-detail')).toBeVisible();
  await expect(page.getByTestId('route-e-bike')).toBeVisible();
  const stat = page.getByTestId('session-kcal-stat').getByTestId('session-kcal-value');
  await expect(stat).toHaveText(/^ca\. [\d.]+$/);
  const eBikeKcal = Number(((await stat.textContent()) ?? '').replace(/[^\d]/g, ''));
  if (shots) {
    await page.screenshot({ path: `${shots}/e-bike-auswertung.png` });
  }

  // Story-Bild: „E-Bike-Fahrt“, nie kcal.
  await page.getByTestId('route-share').click();
  await expect(page.getByTestId('story')).toBeVisible();
  await expect(page.getByTestId('story-card')).toContainText('E-Bike-Fahrt');
  await expect(page.getByTestId('story')).not.toContainText('kcal');
  if (shots) await page.getByTestId('story-card').screenshot({ path: `${shots}/e-bike-story.png` });
  await page.goBack();

  // An der Strecke auf Fahrrad umstellen → Abzeichen weg, kcal nie niedriger (kurze Demo: auf 5 kcal gerundet ggf. gleich;
  // der Unterschied bei gleicher Fahrt steht im ersten Test).
  await expect(page.getByTestId('route-detail')).toBeVisible();
  await page.getByTestId('route-edit').click();
  const edit = page.getByTestId('route-edit-form');
  await expect(edit.getByTestId('route-edit-bike-type-ebike')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await edit.getByTestId('route-edit-bike-type-bike').click();
  await page.getByTestId('route-edit-save').click();
  await expect(page.getByTestId('route-message')).toBeVisible();
  await expect(page.getByTestId('route-e-bike')).toHaveCount(0);
  await expect
    .poll(async () => Number(((await stat.textContent()) ?? '').replace(/[^\d]/g, '')))
    .toBeGreaterThanOrEqual(eBikeKcal);
});

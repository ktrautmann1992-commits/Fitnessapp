import { expect, test, type Page } from '@playwright/test';

import { patchDb } from './nutrition-helpers';
import { heading, onboard } from './plan-helpers';

/**
 * kcal je Einheit im TESTMODUS (docs/KONZEPT.md Abschnitt 5, „kcal je Einheit“), Web-Export, Handy-Ansicht:
 * - mit Einwilligung Gesundheitsdaten (Gewicht 80 kg): Workout im Timer → „ca. … kcal“ mit „geschätzt aus Dauer,
 *   Intensität und Gewicht“ am Ende, am Tag und im Tagebuch-Eintrag; Demo-Lauf → kcal im Zahlen-Raster, aber nie auf
 *   dem Story-Bild;
 * - ohne Einwilligung: keine Zahl, nur der Hinweis mit Weg zur Einwilligung;
 * - „Kalorienzahlen anzeigen“ aus: nirgends kcal an Einheiten.
 * Element-Bildschirmfotos nach $SCREENSHOT_DIR, wenn gesetzt.
 */

const MONDAY = new Date('2026-10-05T09:00:00+02:00');
const THURSDAY = new Date('2026-10-22T09:00:00+02:00');
const shots = process.env.SCREENSHOT_DIR;

async function onboardPerson(page: Page, consent: boolean) {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Dienstag', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
}

/** Workout „Bauch-Blitz“ starten, gut 2,5 Minuten laufen lassen, vorzeitig beenden. */
async function finishWorkout(page: Page) {
  await page.goto('/workouts/bauch-blitz');
  await heading(page, 'Bauch-Blitz');
  await page.getByTestId('workout-start').click();
  await page.clock.fastForward(6000);
  await expect(page.getByTestId('workout-timer-step')).toHaveText('Dead Bug');
  await page.clock.fastForward(31_000);
  await page.clock.fastForward(120_000);
  await page.getByTestId('workout-timer-end').click();
  await page.getByTestId('workout-end-dialog').getByRole('button', { name: 'Beenden' }).click();
  await heading(page, 'Workout beendet');
}

async function liveKm(page: Page): Promise<number> {
  const text = (await page.getByTestId('record-distance').textContent()) ?? '0';
  return Number(text.replace(' km', '').replace(',', '.'));
}

test('mit Gewicht: Workout-Ende, Tag und Tagebuch zeigen „ca. … kcal“ (geschätzt)', async ({
  page,
}) => {
  await page.clock.install({ time: MONDAY });
  await onboardPerson(page, true);
  await finishWorkout(page);

  const finish = page.getByTestId('session-kcal');
  await expect(finish.getByTestId('session-kcal-value')).toHaveText(/^ca\. \d+ kcal$/);
  await expect(finish.getByTestId('session-kcal-source')).toHaveText(
    'geschätzt aus Dauer, Intensität und Gewicht',
  );
  await expect(page.getByTestId('session-kcal-hint')).toHaveCount(0);
  if (shots) await finish.screenshot({ path: `${shots}/kcal-workout-ende.png` });

  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout-saved')).toContainText('Gespeichert');

  // Tag: kcal an der Einheit.
  await page.getByTestId('workout-finish-today').click();
  const item = page.getByTestId('day-training-item').first();
  await expect(item.getByTestId('session-kcal-value')).toHaveText(/^ca\. \d+ kcal$/);
  if (shots) await item.screenshot({ path: `${shots}/kcal-tag.png` });

  // Tagebuch-Eintrag.
  await item.getByRole('link', { name: /Eintrag ansehen/ }).click();
  const entry = page.getByTestId('log-entry');
  await expect(entry.getByTestId('session-kcal-value')).toHaveText(/^ca\. \d+ kcal$/);
  if (shots) {
    await entry.getByTestId('session-kcal').screenshot({ path: `${shots}/kcal-tagebuch.png` });
  }

  // Story-Bild der Einheit: nie kcal (Gesundheitsdaten-Regel).
  await entry.getByTestId('log-share').click();
  await expect(page.getByTestId('story')).toBeVisible();
  await expect(page.getByTestId('story')).not.toContainText('kcal');
});

test('Demo-Lauf: kcal im Zahlen-Raster, nie auf dem Story-Bild', async ({ page }) => {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  await page.clock.setFixedTime(THURSDAY);
  await onboardPerson(page, true);
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await page.getByTestId('endurance-demo').click();
  await expect.poll(() => liveKm(page), { timeout: 30_000 }).toBeGreaterThan(1.1);
  await page.getByTestId('record-stop').click();
  await page.getByTestId('record-stop-dialog').getByRole('button', { name: 'Ja, beenden' }).click();
  await page.getByTestId('record-name').fill('Rheinrunde');
  await page.getByTestId('record-submit').click();

  await expect(page.getByTestId('route-detail')).toBeVisible();
  const stat = page.getByTestId('session-kcal-stat');
  await expect(stat.getByTestId('session-kcal-value')).toHaveText(/^ca\. \d+$/);
  await expect(stat).toContainText('kcal geschätzt');
  if (shots) await page.getByTestId('route-stats').screenshot({ path: `${shots}/kcal-lauf.png` });

  await page.getByTestId('route-share').click();
  await expect(page.getByTestId('story')).toBeVisible();
  await expect(page.getByTestId('story')).not.toContainText('kcal');
});

test('ohne Einwilligung: keine Zahl, nur Hinweis mit Weg zur Einwilligung', async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await onboardPerson(page, false);
  await finishWorkout(page);
  await expect(page.getByTestId('session-kcal')).toHaveCount(0);
  const hint = page.getByTestId('session-kcal-hint');
  await expect(hint).toContainText('Für kcal:');
  if (shots) await hint.screenshot({ path: `${shots}/kcal-hinweis.png` });
  await hint.getByTestId('session-kcal-hint-open').click();
  await expect(page).toHaveURL(/health-consent/);
});

test('„Kalorienzahlen anzeigen“ aus: keine kcal an der Einheit', async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await onboardPerson(page, true);
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: { ...(value.rows.nutritionSetup as object), show_energy_numbers: false },
    },
  }));
  await finishWorkout(page);
  await expect(page.getByTestId('session-kcal')).toHaveCount(0);
  await expect(page.getByTestId('session-kcal-hint')).toHaveCount(0);
  await expect(page.getByTestId('workout-finish')).not.toContainText('kcal');
});

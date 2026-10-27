import { expect, test, type Page } from '@playwright/test';

import { onboardNutrition, patchDb } from './nutrition-helpers';

/**
 * Nährstoff-Timing 2 – Essen rund ums Training im TESTMODUS (docs/PLAN-NAEHRSTOFF-TIMING.md, Etappe T2; ohne Konto im
 * Vorschau-Link). Fester Tag Montag, 12.10.2026; Person trainiert Mo/Mi/Fr (Kraft, geschätzte Dauer aus dem Plan), Trainingszeit „Abends“,
 * 4 Mahlzeiten, Beispiel-Rezepte. Geprüft: Zeitleiste ohne eigene Uhrzeit („ca.“), Uhrzeit im Tages-Blatt einstellen,
 * Zeitleiste mit Mahlzeit vorher/Snack/Training/nachher und echten Gerichten, Rückmeldung „Mahlzeiten an dein Training
 * angepasst“ mit „Rückgängig“, Ruhetag ohne Zeitleiste, „Kalorienzahlen anzeigen“ aus → keine Gramm, Erinnerung im
 * Browser nur als Hinweis.
 */

const WEDNESDAY = '2026-10-14';
const TUESDAY = '2026-10-13';

async function openDay(page: Page, date: string) {
  await page.goto(`/ernaehrung?tag=${date}`);
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
}

test('Essen rund ums Training: Zeitleiste, Uhrzeit an der Einheit, Anpassung mit Rückgängig, Zahlen aus', async ({
  page,
}) => {
  // Onboarding + mehrere Seiten: mehr Zeit als der Standard (60 s), auch bei voller Last.
  test.setTimeout(180_000);
  await onboardNutrition(page);

  // Ohne eigene Uhrzeit: Standard aus „Abends“ (17:30) mit „ca.“.
  await openDay(page, WEDNESDAY);
  const timeline = page.getByTestId('training-timeline');
  await expect(timeline).toBeVisible();
  await expect(timeline).toContainText('Essen rund ums Training');
  await expect(page.getByTestId('training-timeline-approx')).toBeVisible();
  await expect(page.getByTestId('training-timeline-session-time')).toHaveText(
    /^ca\. 17:30–1[89]:\d\d$/,
  );
  await expect(page.getByTestId('training-timeline-post_meal-meal')).toContainText('Portion');

  // Ruhetag: keine Zeitleiste.
  await openDay(page, TUESDAY);
  await expect(page.getByTestId('nutrition-day-header')).toBeVisible();
  await expect(page.getByTestId('training-timeline')).toHaveCount(0);

  // Uhrzeit im Tages-Blatt (Reiter Training) einstellen: 17:30 → 16:00.
  await page.goto('/today');
  await page.getByTestId(`plan-week-day-${WEDNESDAY}`).click();
  const sheet = page.getByTestId('day-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('session-time')).toContainText('ca. 17:30 (Standard)');
  await sheet.getByTestId('session-time').click();
  await sheet.getByTestId('session-time-minus-hour').click();
  await sheet.getByTestId('session-time-minus').click();
  await sheet.getByTestId('session-time-minus').click();
  await expect(sheet.getByTestId('session-time-value')).toHaveText('16:00');
  await sheet.getByTestId('session-time-save').click();
  await expect(sheet.getByTestId('session-time-message')).toContainText(
    'Uhrzeit 16:00 gespeichert',
  );
  await expect(sheet.getByTestId('session-time')).toContainText('Uhrzeit: 16:00');

  // Zeitleiste mit eigener Uhrzeit: Mahlzeit vorher (Mittag), Snack, Training, Mahlzeit danach (Abend).
  await openDay(page, WEDNESDAY);
  await expect(page.getByTestId('training-timeline-approx')).toHaveCount(0);
  await expect(page.getByTestId('training-timeline-pre_meal-time')).toHaveText('12:00–14:00');
  await expect(page.getByTestId('training-timeline-pre_meal-meal')).toContainText('Portion');
  await expect(page.getByTestId('training-timeline-session-time')).toHaveText(/^16:00–1[67]:\d\d$/);
  await expect(page.getByTestId('training-timeline-post_meal-time')).toHaveText(/^bis 1[89]:\d\d$/);
  await expect(page.getByTestId('training-timeline-post_meal')).toContainText('g Eiweiß');
  await page.getByTestId('training-timeline-pre_meal-why').click();
  await expect(page.getByTestId('training-timeline-pre_meal-reason')).toContainText(
    '2–4 Stunden vorher',
  );
  // Mahlzeiten an das Training angepasst – mit „Rückgängig“.
  const adjusted = page.getByTestId('training-adjusted');
  await expect(adjusted).toContainText('Mahlzeiten an dein Training angepasst.');
  await page.getByTestId('training-adjusted-undo').click();
  await expect(page.getByTestId('training-adjusted-message')).toBeVisible();
  await expect(page.getByTestId('training-adjusted')).toHaveCount(0);

  // Im Browser gibt es keine Benachrichtigungen – nur am heutigen Tag und nur als Hinweis.
  await expect(page.getByTestId('training-timeline-reminder')).toHaveCount(0);

  // „Kalorienzahlen anzeigen“ aus → keine Gramm in der Zeitleiste, Gerichte bleiben.
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: { ...(value.rows.nutritionSetup as object), show_energy_numbers: false },
    },
  }));
  await openDay(page, WEDNESDAY);
  await expect(page.getByTestId('training-timeline-post_meal-meal')).toContainText('Portion');
  await expect(page.getByTestId('training-timeline')).not.toContainText('g KH');
  await expect(page.getByTestId('training-timeline')).not.toContainText('g Eiweiß');
});

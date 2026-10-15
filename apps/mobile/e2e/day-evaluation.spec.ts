import { expect, test, type Page } from '@playwright/test';

import { onboardNutrition, patchDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Etappe A2 „Dein Tag“ im TESTMODUS (docs/PLAN-AUSWERTUNG.md Abschnitt 6, „So testet ihr es am Handy“), Web-Export,
 * Handy-Ansicht. Fester Start: Montag, 12.10.2026, 9 Uhr (Onboarding mit Ernährung, Abnehmen, Kraft Mo/Mi/Fr,
 * Beispiel-Rezepte mit TESTWERTEN). Geprüft: Erreichbarkeit aus „Heute“, Kalender und Woche, ← / →, heute neutral
 * „Noch offen“ → grün, gestern rot unten mit „fehlt etwas?“, gelb/rot oben ruhig, „Zahlen aus“ ohne Balken und ohne
 * „kcal“ irgendwo im DOM (auch testIDs/aria), Schwangerschaft, Training mit Erfüllungsgrad, ungültiges Datum.
 */

const MONDAY = '2026-10-12';
const SUNDAY = '2026-10-11';

async function start(page: Page, person: Parameters<typeof onboardNutrition>[1] = {}) {
  await onboardNutrition(page, person);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
}

/** Schnelleintrag für einen Tag (Testwert, Bezeichnung „Mahlzeit“). */
async function quickEntry(page: Page, date: string, kcal: number | null) {
  await page.goto(`/ernaehrung/eintragen?tag=${date}`);
  await expect(page.getByTestId('food-log-entry')).toBeVisible();
  await page.getByRole('radio', { name: 'Schnell' }).click();
  await page.getByRole('radio', { name: 'Mahlzeit', exact: true }).click();
  // Ohne Zahlen (Schwangerschaft) gibt es kein kcal-Feld – der Eintrag zählt nur als „gegessen“.
  if (kcal !== null) await page.getByTestId('food-log-quick-kcal').fill(String(kcal));
  await page.getByTestId('food-log-quick-add').click();
  if (kcal !== null && kcal >= 1500)
    await page.getByRole('button', { name: 'Ja, eintragen' }).click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText('Eingetragen: Mahlzeit');
}

async function openDay(page: Page, date: string) {
  await page.goto(`/tag/${date}`);
  await expect(page.getByTestId('day')).toBeVisible();
  await heading(page, 'Dein Tag');
}

test('Heute neutral bis zum Zielbereich, gestern rot mit „fehlt etwas?“, oben ruhig; Blättern und Einstiege', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await start(page);

  // Einstieg aus „Heute“.
  await page.getByTestId('today-day').click();
  await heading(page, 'Dein Tag');
  await expect(page.getByRole('heading', { name: 'Heute, Montag, 12.10.' })).toBeVisible();
  await expect(page.getByTestId('day-bar')).toHaveCount(0);
  await expect(page.getByTestId('day-intake-text')).toContainText('Nichts eingetragen. Tagesziel:');
  await expect(page.getByTestId('day-meals')).toHaveText(/^Mahlzeiten: 0 von \d abgehakt$/);

  // Erste Mahlzeit „Gegessen“ direkt hier → neutral „Noch offen“ (nie rot am Morgen).
  const eaten = page.getByTestId('day-food').getByTestId(/^eaten-(?!done|undo)/);
  const mealCount = await eaten.count();
  expect(mealCount).toBeGreaterThan(1);
  await eaten.first().click();
  await expect(page.getByTestId('day-zone')).toHaveText('○ Noch offen');
  await expect(page.getByTestId('day-intake')).toHaveText(/^[\d.]+ von [\d.]+ kcal$/);
  await expect(page.getByTestId('day-bar')).toHaveAttribute(
    'aria-label',
    /^[\d.]+ von [\d.]+ Kilokalorien, noch offen$/,
  );
  await expect(page.getByTestId('day-check-entries')).toHaveCount(0);

  // Alle Mahlzeiten nach Plan → grün „Im Zielbereich“.
  while ((await eaten.count()) > 0) await eaten.first().click();
  await expect(page.getByTestId('day-meals')).toHaveText(
    `Mahlzeiten: ${mealCount} von ${mealCount} abgehakt`,
  );
  await expect(page.getByTestId('day-zone')).toHaveText('✓ Im Zielbereich');

  // Training heute: Montag ist geplant.
  await expect(page.getByTestId('day-training-item')).toContainText('○ Geplant');

  // ← Vortag (Sonntag, nichts eingetragen) → grau, nie 0 kcal und nie rot.
  await page.getByTestId('day-prev').click();
  await expect(page.getByRole('heading', { name: 'Sonntag, 11.10.' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/tag/${SUNDAY}$`));
  await expect(page.getByTestId('day-bar')).toHaveCount(0);
  await expect(page.getByTestId('day-intake-text')).toContainText('Nichts eingetragen.');
  await expect(page.getByTestId('day-training-empty')).toHaveText('Keine Einheit an diesem Tag.');
  // Wächter A2 S1: Sonntag liegt in der Vorwoche, für die nie ein Essensplan gespeichert wurde – keine erfundene
  // Mahlzeitenliste, keine „Gegessen“-Knöpfe, keine Abhak-Zahl.
  await expect(page.getByTestId('day-no-meal-plan')).toHaveText(
    /^Für diesen Tag ist kein Essensplan gespeichert/,
  );
  await expect(page.getByTestId('day-meals')).toHaveCount(0);
  await expect(page.getByTestId('day-meal-list')).toHaveCount(0);
  await expect(page.getByTestId('day-food').getByTestId(/^eaten-/)).toHaveCount(0);
  // Gleiches in „Ernährung“ (E1) für diesen Tag: Plan sichtbar, aber ohne „Gegessen“.
  await page.goto(`/ernaehrung?tag=${SUNDAY}`);
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
  await expect(page.getByTestId('nutrition-plan-not-stored')).toBeVisible();
  await expect(page.getByTestId(/^eaten-/)).toHaveCount(0);
  await openDay(page, SUNDAY);
  await page.getByTestId('day-next').click();
  await expect(page.getByRole('heading', { name: 'Heute, Montag, 12.10.' })).toBeVisible();

  // Gestern nur 300 kcal → rot unten, Fürsorge-Text, „Laut deinen Einträgen …“.
  await quickEntry(page, SUNDAY, 300);
  await openDay(page, SUNDAY);
  await expect(page.getByTestId('day-zone')).toHaveText('↓ Unter deinem Mindestbedarf');
  await expect(page.getByTestId('day')).toContainText('Dein Körper braucht an solchen Tagen mehr');
  await expect(page.getByTestId('day-check-entries')).toHaveText(
    'Laut deinen Einträgen. Fehlt etwas? Du kannst es nachtragen.',
  );

  // Dazu viel mehr → oben gelb bzw. rot, ruhiger Text, kein Ausrufezeichen.
  await quickEntry(page, SUNDAY, 1500);
  await openDay(page, SUNDAY);
  await expect(page.getByTestId('day-zone')).toHaveText(
    /^(↘ Etwas unter deinem Tagesziel|✓ Im Zielbereich|↗ Etwas über deinem Ziel)$/,
  );
  await quickEntry(page, SUNDAY, 3000);
  await openDay(page, SUNDAY);
  await expect(page.getByTestId('day-zone')).toHaveText('↑ Deutlich über deinem Ziel');
  await expect(page.getByTestId('day')).toContainText('Ein einzelner Tag ändert wenig.');
  await expect(page.getByTestId('day-check-entries')).toHaveCount(0);
  expect(await page.getByTestId('day').innerText()).not.toContain('!');

  // Künftiger Tag: Vorschau mit Tagesziel, kein Balken.
  await openDay(page, '2026-10-14');
  await expect(page.getByTestId('day-future')).toBeVisible();
  await expect(page.getByTestId('day-bar')).toHaveCount(0);
  await expect(page.getByTestId('day-intake-text')).toContainText('Tagesziel:');
  await expect(page.getByTestId('day-training-item')).toContainText('○ Geplant');
  // Wächter A2 H5: nur Tagesziel und Plan – keine Abhak-Zahl, keine „Gegessen“-Knöpfe.
  await expect(page.getByTestId('day-meals')).toHaveCount(0);
  await expect(page.getByTestId('day-planned-meals')).toHaveText('Geplante Mahlzeiten:');
  await expect(page.getByTestId('day-meal-list')).toBeVisible();
  await expect(page.getByTestId('day-food').getByTestId(/^eaten-/)).toHaveCount(0);

  // Einstieg aus dem Kalender (Tippen auf den Tag) und aus der Woche.
  await page.goto('/kalender');
  await heading(page, 'Kalender');
  await expect(page.getByTestId(`calendar-open-day-${MONDAY}`)).toHaveAccessibleName(
    'Dein Tag: Montag, 12.10. ansehen',
  );
  await page.getByTestId(`calendar-open-day-${MONDAY}`).click();
  await expect(page).toHaveURL(new RegExp(`/tag/${MONDAY}$`));
  await heading(page, 'Dein Tag');
  await page.goto('/week');
  await heading(page, 'Woche');
  await page.getByTestId(`week-open-day-${MONDAY}`).click();
  await expect(page).toHaveURL(new RegExp(`/tag/${MONDAY}$`));
  await expect(page.getByTestId('day-zone')).toHaveText('✓ Im Zielbereich');

  // Offline: alles kommt aus dem Gerätespeicher – neu laden zeigt dasselbe.
  await page.reload();
  await expect(page.getByTestId('day-zone')).toHaveText('✓ Im Zielbereich');
});

test('„Kalorienzahlen aus“: kein Balken, keine Farben, nur „x von y Mahlzeiten“ – nirgends „kcal“ im DOM', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await start(page);
  await quickEntry(page, SUNDAY, 300);
  await page.goto(`/tag/${MONDAY}`);
  const eaten = page.getByTestId('day-food').getByTestId(/^eaten-(?!done|undo)/);
  await eaten.first().click();
  await expect(page.getByTestId('day-zone')).toBeVisible();

  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: { ...(value.rows.nutritionSetup as object), show_energy_numbers: false },
    },
  }));
  for (const date of [MONDAY, SUNDAY, '2026-10-14']) {
    await openDay(page, date);
    await expect(page.getByTestId('day-food')).toBeVisible();
    await expect(page.getByTestId('day-bar')).toHaveCount(0);
    await expect(page.getByTestId('day-zone')).toHaveCount(0);
    await expect(page.getByTestId('day-check-entries')).toHaveCount(0);
    if (date === MONDAY) {
      await expect(page.getByTestId('day-meals')).toHaveText(/^Mahlzeiten: \d von \d abgehakt$/);
    }
    // Keine kcal-artigen Zahlen ohne Einheit im Essensteil (Wächter A2 H9): außer der Mahlzeiten-Anzahl kein
    // „x von y“ bzw. „x/y“ und nirgends eine Zahl ab 100.
    const food = await page.getByTestId('day-food').innerText();
    const meals =
      (await page.getByTestId('day-meals').count()) > 0
        ? await page.getByTestId('day-meals').innerText()
        : '';
    expect(food.replace(meals, '')).not.toMatch(/\d[\d.]*\s*(von|\/)\s*\d/);
    expect(food).not.toMatch(/\d{3}|\d\.\d{3}/);
    // Nirgends „kcal“ – auch nicht in data-testid, aria-label oder anderen Attributen.
    expect(await page.content()).not.toMatch(/kcal|Kilokalorien/i);
  }
  await openDay(page, MONDAY);
  await expect(page.getByTestId('day-meals')).toHaveText(/^Mahlzeiten: 1 von \d abgehakt$/);
  await expect(page.getByTestId('day-entries')).toHaveText('Eingetragen: 1 Eintrag');
  // Training bleibt sichtbar.
  await expect(page.getByTestId('day-training-item')).toBeVisible();
});

test('Schwangerschaft: kein Balken, keine Zahl, Hinweis Ärztin/Arzt/Hebamme', async ({ page }) => {
  test.setTimeout(180_000);
  await start(page, { pregnancy: true });
  await quickEntry(page, MONDAY, null);
  await openDay(page, MONDAY);
  await expect(page.getByTestId('day-bar')).toHaveCount(0);
  await expect(page.getByTestId('day-target-notice')).toContainText('Hebamme');
  await expect(page.getByTestId('day-entries')).toHaveText('Eingetragen: 1 Eintrag');
  expect(await page.content()).not.toMatch(/kcal|Kilokalorien/i);
});

test('Training mit Erfüllungsgrad, ungültiges Datum, ohne Einwilligung', async ({ page }) => {
  test.setTimeout(180_000);
  await start(page);
  // Heutige Kraft-Einheit: ein Satz abgehakt.
  await page.goto('/today');
  await page.getByTestId('workout-start').first().click();
  await page.getByTestId('workout-done-0-0').click();
  await page.getByTestId('workout-save').click();
  await openDay(page, MONDAY);
  const item = page.getByTestId('day-training-item');
  await expect(item.getByTestId('day-achievement')).toHaveText(/^◐ Teilweise gemacht · \d+ %$/);
  await expect(item).toContainText(': 1/3 Sätze');
  await expect(item).toContainText('Einstiegswoche – leichter ist hier richtig.');
  await item.getByRole('link', { name: /Eintrag ansehen/ }).click();
  await expect(page.getByTestId('log-entry')).toBeVisible();

  // Ungültiges Datum → Fehlerzustand mit Weg zum Kalender.
  await page.goto('/tag/2026-02-30');
  await expect(page.getByTestId('day-invalid')).toContainText('Diesen Tag gibt es nicht.');
  await page.getByRole('button', { name: 'Zum Kalender' }).click();
  await heading(page, 'Kalender');

  // Ohne Einwilligung: Erklärung statt Balken.
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Gesundheitsdaten: Widerrufen' }).click();
  await page.getByRole('button', { name: 'Tagebuch behalten (empfohlen)' }).click();
  await expect(
    page.getByText('Einwilligung widerrufen. Deine Gesundheitsdaten wurden gelöscht.'),
  ).toBeVisible();
  await openDay(page, MONDAY);
  await expect(page.getByTestId('day-consent')).toBeVisible();
  await expect(page.getByTestId('day-bar')).toHaveCount(0);
  await expect(page.getByTestId('day-training-item')).toBeVisible();
});

test('Außerhalb des Nachtrage-Fensters: nur „Laut deinen Einträgen.“ (Wächter A2 H3)', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await start(page);
  // Genau 14 Tage zurück (28.09.) geht das Eintragen noch.
  await quickEntry(page, '2026-09-28', 300);
  await openDay(page, '2026-09-28');
  await expect(page.getByTestId('day-check-entries')).toHaveText(
    'Laut deinen Einträgen. Fehlt etwas? Du kannst es nachtragen.',
  );
  // Zwei Tage später liegt der Tag außerhalb des Fensters – kein Versprechen „nachtragen“.
  await page.clock.setFixedTime(new Date('2026-10-14T09:00:00+02:00'));
  await openDay(page, '2026-09-28');
  await expect(page.getByTestId('day-zone')).toHaveText('↓ Unter deinem Mindestbedarf');
  await expect(page.getByTestId('day-check-entries')).toHaveCount(0);
  await expect(page.getByTestId('day-entries-basis')).toHaveText('Laut deinen Einträgen.');
});

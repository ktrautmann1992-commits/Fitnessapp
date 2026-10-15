import { expect, test, type Page } from '@playwright/test';

import { onboardNutrition, patchDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Etappe A3 „Wochenauswertung“ im TESTMODUS (docs/PLAN-AUSWERTUNG.md Abschnitt 8, „So testet ihr es am Handy“),
 * Web-Export, Handy-Ansicht. Start: Montag, 12.10.2026, 9 Uhr (Onboarding mit Ernährung, Abnehmen, Kraft Mo/Mi/Fr,
 * Beispiel-Rezepte mit TESTWERTEN); danach Donnerstag, 15.10. Geprüft: Einstiege aus „Woche“ und Kalender, kleine
 * Tagesbalken mit Kurztext, Tippen öffnet „Dein Tag“ mit derselben Zone, Zahlen = Tagesansichten, Durchschnitt nur
 * über eingetragene Tage, heute „offen“, Muster-Hinweis ab 3 Tagen unter der Untergrenze (genau einmal), Blättern,
 * Training mit Summen und Erfüllungsgrad, „Zahlen aus“ ohne kcal im ganzen DOM, Schwangerschaft, noch nicht begonnene
 * Woche, ungültige Woche.
 */

const MONDAY = '2026-10-12';
const TUESDAY = '2026-10-13';
const WEDNESDAY = '2026-10-14';
const THURSDAY = '2026-10-15';

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
  if (kcal !== null) await page.getByTestId('food-log-quick-kcal').fill(String(kcal));
  await page.getByTestId('food-log-quick-add').click();
  if (kcal !== null && kcal >= 1500)
    await page.getByRole('button', { name: 'Ja, eintragen' }).click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText('Eingetragen: Mahlzeit');
}

async function openWeek(page: Page, week = MONDAY) {
  await page.goto(`/wochenauswertung?woche=${week}`);
  await expect(page.getByTestId('week-eval')).toBeVisible();
  await heading(page, 'Wochenauswertung');
}

const dayText = (page: Page, date: string) =>
  page.getByTestId(`week-eval-day-${date}`).getByTestId('week-eval-day-text');

/** Tagesziel aus „Dein Tag“ („300 von 1.912 kcal“ → 1912). */
async function dayTarget(page: Page, date: string): Promise<number> {
  await page.goto(`/tag/${date}`);
  const text = await page.getByTestId('day-intake').innerText();
  const match = /von ([\d.]+) kcal/.exec(text);
  if (!match?.[1]) throw new Error('Tagesziel fehlt');
  return Number(match[1].replace(/\./g, ''));
}

const de = (value: number) => value.toLocaleString('de-DE');

test('Einstiege, Tagesbalken = „Dein Tag“, Ø nur eingetragene Tage, Muster-Hinweis ab 3 Tagen, Training, Blättern', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await start(page);
  // Montag: Kraft-Einheit mit einem abgehakten Satz.
  await page.getByTestId('workout-start').first().click();
  await page.getByTestId('workout-done-0-0').click();
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout-save')).toHaveCount(0);

  // Donnerstag. Montag und Dienstag sehr wenig eingetragen.
  await page.clock.setFixedTime(new Date(`${THURSDAY}T09:00:00+02:00`));
  await quickEntry(page, MONDAY, 300);
  await quickEntry(page, TUESDAY, 300);

  // Einstieg aus „Woche“.
  await page.goto('/week');
  await heading(page, 'Woche');
  await expect(page.getByTestId('week-evaluation')).toHaveAccessibleName(
    'Wochenauswertung für 12.10.2026 bis 18.10.2026 öffnen',
  );
  await page.getByTestId('week-evaluation').click();
  await expect(page).toHaveURL(new RegExp(`/wochenauswertung\\?woche=${MONDAY}$`));
  await heading(page, 'Wochenauswertung');
  await expect(page.getByTestId('week-eval-range')).toHaveText('12.10.2026 bis 18.10.2026');

  // Kleine Tagesbalken: Farbe immer mit Zeichen und Kurztext.
  await expect(page.getByTestId('week-eval-days').getByTestId(/^week-eval-day-\d/)).toHaveCount(7);
  await expect(dayText(page, MONDAY)).toHaveText('↓ Unter Mindestbedarf ›');
  await expect(dayText(page, TUESDAY)).toHaveText('↓ Unter Mindestbedarf ›');
  await expect(dayText(page, WEDNESDAY)).toHaveText('– Nichts eingetragen ›');
  await expect(dayText(page, THURSDAY)).toHaveText('– Nichts eingetragen ›');
  await expect(dayText(page, '2026-10-16')).toHaveText('Geplant ›');
  await expect(page.getByTestId('week-eval-days').getByTestId('week-eval-bar')).toHaveCount(2);
  await expect(page.getByTestId(`week-eval-day-${MONDAY}`)).toHaveAccessibleName(
    'Montag, 12.10.: Unter Mindestbedarf. Dein Tag öffnen',
  );
  await expect(page.getByTestId('week-eval-entry-days')).toHaveText('An 2 Tagen eingetragen.');
  await expect(page.getByTestId('week-eval-zones')).toHaveText(
    'Davon 2 unter deinem Mindestbedarf.',
  );
  await expect(page.getByTestId('week-eval-food-summary')).toContainText(
    'Heute läuft noch und zählt erst danach mit.',
  );
  // Zwei Tage unter der Untergrenze: noch kein Muster-Hinweis.
  await expect(page.getByTestId('week-eval-pattern')).toHaveCount(0);

  // Tippen öffnet „Dein Tag“ mit derselben Zone.
  await page.getByTestId(`week-eval-day-${MONDAY}`).click();
  await expect(page).toHaveURL(new RegExp(`/tag/${MONDAY}$`));
  await expect(page.getByTestId('day-zone')).toHaveText('↓ Unter deinem Mindestbedarf');

  // Ø je eingetragenem Tag = Ø der Tagesziele genau dieser Tage (aus den Tagesansichten).
  const targetMonday = await dayTarget(page, MONDAY);
  const targetTuesday = await dayTarget(page, TUESDAY);
  await openWeek(page);
  await expect(page.getByTestId('week-eval-average')).toHaveText(
    `Ø 300 von Ø ${de(Math.round((targetMonday + targetTuesday) / 2))} kcal je eingetragenem Tag`,
  );

  // Dritter Tag unter der Untergrenze → genau einmal der ruhige Hinweis mit Hilfe-Stellen.
  await quickEntry(page, WEDNESDAY, 300);
  await openWeek(page);
  await expect(page.getByTestId('week-eval-zones')).toHaveText(
    'Davon 3 unter deinem Mindestbedarf.',
  );
  const pattern = page.getByTestId('week-eval-pattern');
  await expect(pattern).toHaveCount(1);
  await expect(pattern).toContainText('Dein Körper braucht an solchen Tagen mehr.');
  await expect(pattern.getByTestId('nutrition-help')).toContainText(
    'Wenn Essen oder Gewicht dich belasten',
  );
  await expect(pattern).toContainText('Im Notfall: 112');
  // Ruhig: kein Ausrufezeichen im Essensteil („! Verpasst“ ist der bestehende Trainings-Status).
  expect(await page.getByTestId('week-eval-food').innerText()).not.toContain('!');
  // Heute zählt nicht: auch nicht mit einem Eintrag.
  await quickEntry(page, THURSDAY, 200);
  await openWeek(page);
  await expect(dayText(page, THURSDAY)).toHaveText('○ Noch offen ›');
  await expect(page.getByTestId('week-eval-entry-days')).toHaveText('An 3 Tagen eingetragen.');
  // Keine Wochen-Bilanz, keine Prognose.
  expect(await page.getByTestId('week-eval').innerText()).not.toMatch(
    /Bilanz|eingespart|Prognose|Defizit|perfekt/i,
  );

  // Training: Montag 1 Satz von der Vorgabe, Mittwoch verpasst, Freitag geplant.
  const training = page.getByTestId('week-eval-training');
  await expect(training.getByTestId('week-eval-training-sums')).toContainText(
    'Einheiten: 1 von 3 erledigt',
  );
  await expect(training.getByTestId('week-eval-training-sums')).toContainText(
    /Kraft-Sätze: 1 von \d+ erfüllt/,
  );
  const items = training.getByTestId('week-eval-item');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText('Montag, 12.10.');
  await expect(items.nth(0).getByTestId('week-eval-achievement')).toHaveText(
    /^◐ Teilweise gemacht · \d+ %$/,
  );
  await expect(items.nth(1)).toContainText('! Verpasst');
  await expect(items.nth(2)).toContainText('○ Geplant');
  await expect(page.getByTestId('week-eval-easy')).toContainText('Einstiegswoche');

  // Blättern wie „Woche“: vor der ersten Plan-Woche gibt es nichts, Folgewoche und zurück.
  await expect(page.getByTestId('week-eval-prev')).toBeDisabled();
  await page.getByTestId('week-eval-next').click();
  await expect(page).toHaveURL(/woche=2026-10-19$/);
  await expect(page.getByTestId('week-eval-range')).toHaveText('19.10.2026 bis 25.10.2026');
  await expect(page.getByTestId('week-eval-not-started')).toBeVisible();
  await page.getByTestId('week-eval-prev').click();
  await expect(page.getByTestId('week-eval-range')).toHaveText('12.10.2026 bis 18.10.2026');

  // Einstieg aus dem Kalender.
  await page.goto('/kalender');
  await heading(page, 'Kalender');
  await page.getByTestId('calendar-week-evaluation').click();
  await expect(page).toHaveURL(new RegExp(`/wochenauswertung\\?woche=${MONDAY}$`));

  // Offline (Wächter A3 H6): wirklich ohne Netz – blättern und zurück, alles kommt aus dem Gerätespeicher.
  await page.reload();
  await expect(page.getByTestId('week-eval-pattern')).toHaveCount(1);
  await page.context().setOffline(true);
  await page.getByTestId('week-eval-next').click();
  await expect(page.getByTestId('week-eval-range')).toHaveText('19.10.2026 bis 25.10.2026');
  await page.getByTestId('week-eval-prev').click();
  await expect(page.getByTestId('week-eval-range')).toHaveText('12.10.2026 bis 18.10.2026');
  await expect(page.getByTestId('week-eval-pattern')).toHaveCount(1);
  await expect(dayText(page, MONDAY)).toHaveText('↓ Unter Mindestbedarf ›');
  await page.context().setOffline(false);
});

test('„Kalorienzahlen aus“: nur Anzahlen und Training – nirgends kcal, kein Balken; ab 3 Tagen nur der feste Hilfe-Hinweis', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await start(page);
  await page.clock.setFixedTime(new Date(`${THURSDAY}T09:00:00+02:00`));
  for (const date of [MONDAY, TUESDAY, WEDNESDAY]) await quickEntry(page, date, 300);
  await openWeek(page);
  await expect(page.getByTestId('week-eval-pattern')).toHaveCount(1);

  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: { ...(value.rows.nutritionSetup as object), show_energy_numbers: false },
    },
  }));
  await openWeek(page);
  await expect(page.getByTestId('week-eval-food')).toBeVisible();
  await expect(page.getByTestId('week-eval-bar')).toHaveCount(0);
  await expect(page.getByTestId('week-eval-average')).toHaveCount(0);
  await expect(page.getByTestId('week-eval-zones')).toHaveCount(0);
  await expect(page.getByTestId('week-eval-pattern')).toHaveCount(0);
  // Wächter A3 G1: nur der feste Hilfe-Hinweis – ohne Einleitung, ohne „Mindestbedarf“, ohne Wertung.
  const help = page.getByTestId('week-eval-help');
  await expect(help).toHaveCount(1);
  await expect(help.getByTestId('nutrition-help')).toContainText(
    'Wenn Essen oder Gewicht dich belasten',
  );
  expect(await page.getByTestId('week-eval').innerText()).not.toMatch(
    /Mindestbedarf|unter deinem|Laut deinen Einträgen lagen/,
  );
  await expect(page.getByTestId('week-eval-food-summary')).toContainText('An 3 Tagen eingetragen.');
  await expect(dayText(page, MONDAY)).toHaveText(/^(• Eingetragen|\d von \d Mahlzeiten) ›$/);
  // Keine kcal-artigen Zahlen im Essensteil: außer „x von y Mahlzeiten“ keine Zahl ab 100, kein „x von y“.
  // (Der feste Hilfe-Text enthält „Im Notfall: 112“ – den nehmen wir aus.)
  const helpText = await help.innerText();
  const foodText = (await page.getByTestId('week-eval-food').innerText()).replace(helpText, '');
  const withoutDates = foodText.replace(/\d{2}\.\d{2}\.(\d{4})?/g, '');
  expect(withoutDates).not.toMatch(/\d{3}|\d\.\d{3}/);
  expect(withoutDates.replace(/\d+ von \d+ (Mahlzeiten|abgehakt)/g, '')).not.toMatch(
    /\d[\d.]*\s*(von|\/)\s*\d/,
  );
  // Nirgends „kcal“ – auch nicht in data-testid, aria-label oder anderen Attributen.
  expect(await page.content()).not.toMatch(/kcal|Kilokalorien/i);
  // Training bleibt.
  await expect(page.getByTestId('week-eval-training-sums')).toContainText('Einheiten:');
});

test('Schwangerschaft: keine Zahl, kein Balken, Hinweis Ärztin/Arzt/Hebamme', async ({ page }) => {
  test.setTimeout(180_000);
  await start(page, { pregnancy: true });
  await quickEntry(page, MONDAY, null);
  await openWeek(page);
  await expect(page.getByTestId('week-eval-bar')).toHaveCount(0);
  await expect(page.getByTestId('week-eval-target-notice')).toContainText('Hebamme');
  await expect(dayText(page, MONDAY)).toBeVisible();
  expect(await page.content()).not.toMatch(/kcal|Kilokalorien/i);
});

test('Noch nicht begonnene Woche, ungültige Woche', async ({ page }) => {
  test.setTimeout(180_000);
  await start(page);
  await openWeek(page, '2026-10-21');
  await expect(page).toHaveURL(/woche=2026-10-21$/);
  await expect(page.getByTestId('week-eval-range')).toHaveText('19.10.2026 bis 25.10.2026');
  await expect(page.getByTestId('week-eval-not-started')).toHaveText(
    'Diese Woche hat noch nicht begonnen. Hier siehst du, was geplant ist.',
  );
  await expect(page.getByTestId('week-eval-food')).toHaveCount(0);
  await expect(page.getByTestId('week-eval-item').first()).toContainText('○ Geplant');

  await page.goto('/wochenauswertung?woche=2026-02-30');
  await expect(page.getByTestId('week-eval-invalid')).toContainText('Diese Woche gibt es nicht.');
  await page.getByRole('button', { name: 'Zur Woche' }).click();
  await heading(page, 'Woche');
});

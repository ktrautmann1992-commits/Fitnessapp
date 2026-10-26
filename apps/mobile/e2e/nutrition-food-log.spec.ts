import { expect, test, type Page } from '@playwright/test';

import { db, onboardNutrition, openNutrition, patchDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Etappe E1 im TESTMODUS (docs/PLAN-AUSWERTUNG.md Abschnitt 5, „So testet ihr es am Handy“): „Gegessen“ per Tipp mit
 * Portion, Suche „Banane“ → 1 Stück unter Snack, Schnelleintrag „Auswärts gegessen, 700 kcal“ mit Stern → Favoriten,
 * neu laden → alles da (Gerätespeicher, offline), Ändern und Löschen, Nachtragen bis 14 Tage (nicht 15), „Kalorienzahlen
 * aus“ (keine kcal, kein kcal-Feld), Widerruf löscht die Einträge (Favoriten bleiben, Hinweis vorher). Beispiel-Rezepte
 * mit TESTWERTEN. Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

interface StoredEntry {
  id: string;
  eaten_on: string;
  slot: string;
  source: string;
  title_de: string;
  amount: number | null;
  unit: string | null;
  portion: number | null;
  kcal: number | null;
}

async function entries(page: Page): Promise<StoredEntry[]> {
  return ((await db(page)).rows.foodLogEntries ?? []) as StoredEntry[];
}

async function favorites(page: Page): Promise<{ fav_key: string }[]> {
  return ((await db(page)).rows.foodLogFavorites ?? []) as { fav_key: string }[];
}

async function start(page: Page) {
  await onboardNutrition(page);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await openNutrition(page);
}

test('Gegessen per Tipp, Suche, Schnelleintrag mit Favorit, neu laden, ändern und löschen', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await start(page);
  const log = page.getByTestId('food-log');
  await expect(log.getByTestId('food-log-empty')).toBeVisible();

  // 1. Erste Mahlzeit „Gegessen“ (1 Portion), zweite mit ¾ Portion.
  const eaten = page.getByTestId(
    /^eaten-(main|breakfast|snack_morning|lunch|snack_afternoon|snack_pre_dinner|dinner|snack_late|snack_night|extra_1|extra_2)$/,
  );
  await eaten.first().click();
  await expect(page.getByTestId(/^eaten-done-/).first()).toBeVisible();
  await expect.poll(async () => (await entries(page)).length).toBe(1);
  const first = (await entries(page))[0];
  expect(first).toMatchObject({ source: 'plan_item', portion: 1, eaten_on: '2026-10-12' });
  await eaten.first().click();
  await expect(page.getByTestId(/^eaten-done-/)).toHaveCount(2);
  const second = page.getByTestId(/^eaten-done-/).nth(1);
  await second.getByRole('radio', { name: '¾' }).click();
  await expect
    .poll(async () => (await entries(page)).map((e) => e.portion).sort())
    .toEqual([0.75, 1]);
  // Doppelt tippen ändert nichts (idempotent): gleiche Portion erneut.
  await second.getByRole('radio', { name: '¾' }).click();
  await expect.poll(async () => (await entries(page)).length).toBe(2);
  await expect(log.getByTestId('food-log-summary')).toContainText('2 Einträge');
  await expect(log.getByTestId('food-log-summary')).toContainText('kcal');

  // 2. „Eintragen“ → Suche „Banane“ → 1 Stück → unter Snack.
  await log.getByTestId('food-log-add').click();
  await expect(page.getByTestId('food-log-entry')).toBeVisible();
  await expect(page.getByTestId('food-log-date')).toHaveText('Heute');
  await page
    .getByRole('radiogroup', { name: 'Mahlzeit' })
    .getByRole('radio', { name: 'Snack' })
    .click();
  await page.getByRole('radio', { name: 'Suche' }).click();
  await page.getByTestId('food-log-search-input').fill('Banane');
  await page.getByTestId('food-log-food-banane').click();
  await expect(page.getByTestId('food-log-amount')).toHaveValue('1');
  await page.getByTestId('food-log-food-add').click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText('Eingetragen: Banane');

  // Suche ohne Treffer bietet den Schnelleintrag an.
  await page.getByTestId('food-log-search-input').fill('xyzxyz');
  await expect(page.getByTestId('food-log-search-none')).toBeVisible();
  await page.getByRole('button', { name: 'Schnelleintrag stattdessen' }).click();

  // 3. Schnelleintrag „Auswärts gegessen, 700 kcal“ → Stern.
  await expect(page.getByTestId('food-log-quick')).toBeVisible();
  await page.getByRole('radio', { name: 'Auswärts gegessen' }).click();
  await page.getByTestId('food-log-quick-kcal').fill('700');
  await page.getByTestId('food-log-quick-add').click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText(
    'Eingetragen: Auswärts gegessen',
  );
  await page.getByTestId('food-log-saved-favorite').click();
  await expect
    .poll(async () => (await favorites(page)).map((f) => f.fav_key))
    .toEqual(['quick|Auswärts gegessen|700']);
  await page.getByRole('radio', { name: 'Favoriten' }).click();
  await expect(page.getByTestId('food-log-favorites')).toContainText('Auswärts gegessen');
  await page.getByRole('radio', { name: 'Zuletzt' }).click();
  await expect(page.getByTestId('food-log-recent')).toContainText('Banane');

  // Plausibilitäts-Rückfrage ab 1.500 kcal (keine Sperre).
  await page.getByRole('radio', { name: 'Schnell' }).click();
  await page.getByRole('radio', { name: 'Mahlzeit', exact: true }).click();
  await page.getByTestId('food-log-quick-kcal').fill('1600');
  await page.getByTestId('food-log-quick-add').click();
  await expect(page.getByTestId('food-log-confirm')).toContainText(
    'Stimmen Menge und Einheit: 1.600 kcal?',
  );
  await page.getByRole('button', { name: 'Ja, eintragen' }).click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText('Eingetragen: Mahlzeit');

  await page.getByTestId('food-log-done').click();
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
  const snack = page.getByTestId('food-log-group-snack');
  await expect(snack).toContainText('Banane');
  await expect(snack).toContainText('1 Stück');
  await expect(snack).toContainText('Auswärts gegessen');
  await expect(page.getByTestId('food-log-summary')).toContainText('5 Einträge');

  // 4. Neu laden (wie nach dem Flugmodus) → alles da.
  await page.reload();
  await expect(page.getByTestId('food-log-group-snack')).toContainText('Banane');
  expect(await entries(page)).toHaveLength(5);

  // Ändern: Banane auf 2 Stück; Löschen: „Mahlzeit“.
  const banana = (await entries(page)).find((e) => e.title_de === 'Banane') as StoredEntry;
  await page.getByTestId(`food-log-edit-${banana.id}`).click();
  await expect(page.getByTestId('food-log-edit')).toBeVisible();
  await page.getByTestId('food-log-edit-amount').fill('2');
  await page.getByTestId('food-log-edit-save').click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText('Gespeichert.');
  await expect
    .poll(async () => (await entries(page)).find((e) => e.id === banana.id)?.amount)
    .toBe(2);
  await page.getByTestId('food-log-done').click();
  const meal = (await entries(page)).find((e) => e.title_de === 'Mahlzeit') as StoredEntry;
  await page.getByTestId(`food-log-delete-${meal.id}`).click();
  await page.getByTestId('food-log-delete-dialog').getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByTestId('food-log-message')).toHaveText('Eintrag gelöscht.');
  expect(await entries(page)).toHaveLength(4);

  // „Heute“: Kachel „Ernährung heute“ zeigt die Einträge.
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-food-log')).toContainText('4 Einträge heute.');
});

test('Nachtragen bis 14 Tage, Kalorienzahlen aus, Widerruf löscht das Tagebuch (Favoriten bleiben)', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await start(page);

  // Nachtragen: 14 Tage zurück geht, weiter nicht (Grund steht da).
  await page.getByTestId('food-log-add').click();
  const prev = page.getByTestId('food-log-date-prev');
  for (let i = 0; i < 14; i += 1) await prev.click();
  await expect(page.getByTestId('food-log-date')).toContainText('28.09.');
  await expect(prev).toBeDisabled();
  await expect(page.getByText('Nachtragen geht bis 14 Tage zurück.')).toBeVisible();
  await page.getByRole('radio', { name: 'Schnell' }).click();
  await page.getByRole('radio', { name: 'Snack', exact: true }).first().click();
  await page.getByTestId('food-log-quick-kcal').fill('200');
  await page.getByTestId('food-log-quick-add').click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText('Eingetragen: Snack');
  expect((await entries(page))[0]?.eaten_on).toBe('2026-09-28');
  // Ein Link mit einem Tag vor 15 Tagen fällt auf heute zurück.
  await page.goto('/ernaehrung/eintragen?tag=2026-09-27');
  await expect(page.getByTestId('food-log-date')).toHaveText('Heute');

  // „Kalorienzahlen aus“: kein kcal-Feld, keine kcal im Tagesverlauf – Eintragen geht weiter.
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: { ...(value.rows.nutritionSetup as object), show_energy_numbers: false },
    },
  }));
  await page.goto('/ernaehrung/eintragen');
  await page.getByRole('radio', { name: 'Schnell' }).click();
  await expect(page.getByTestId('food-log-quick-kcal')).toHaveCount(0);
  await expect(
    page.getByText('Ohne Kalorienzahlen zählt der Eintrag nur als „gegessen“.'),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Getränk' }).click();
  await page.getByTestId('food-log-quick-add').click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText('Eingetragen: Getränk');
  await page.getByTestId('food-log-saved-favorite').click();
  await expect.poll(async () => (await favorites(page)).length).toBe(1);
  // Katalog-Favorit (speichert keine Werte, Wächter E1 S1) – bleibt beim Widerruf.
  await page.getByRole('radio', { name: 'Suche' }).click();
  await page.getByTestId('food-log-search-input').fill('Banane');
  await page.getByTestId('food-log-food-banane').click();
  await page.getByTestId('food-log-food-add').click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText('Eingetragen: Banane');
  await page.getByTestId('food-log-saved-favorite').click();
  await expect.poll(async () => (await favorites(page)).length).toBe(2);
  // Zahlen aus: nirgends „kcal“ im DOM – auch nicht in Attributen wie data-testid (Wächter E1 S3/H7).
  await page.getByRole('radio', { name: 'Favoriten' }).click();
  await expect(page.getByTestId('food-log-favorites')).toContainText('Banane');
  expect(await page.content()).not.toMatch(/kcal/);
  expect((await entries(page)).find((e) => e.title_de === 'Getränk')?.kcal).toBeNull();
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('food-log-summary')).toHaveText('2 Einträge');
  await expect(page.getByTestId('food-log')).not.toContainText('kcal');
  expect(await page.content()).not.toMatch(/kcal/);

  // Widerruf: Hinweis vorher, Einträge weg, Favoriten bleiben.
  await page.goto('/settings?thema=konto');
  await page.getByRole('button', { name: 'Gesundheitsdaten: Widerrufen' }).click();
  await expect(
    page.getByText(
      /dein Ernährungstagebuch samt Schnelleintrag-Favoriten, eigenen Gerichten, eigenen Produkten und Produkt-Favoriten \(Favoriten aus Lebensmitteln und Rezepten bleiben\)/,
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Tagebuch behalten (empfohlen)' }).click();
  await expect(
    page.getByText('Einwilligung widerrufen. Deine Gesundheitsdaten wurden gelöscht.'),
  ).toBeVisible();
  await expect.poll(async () => (await entries(page)).length).toBe(0);
  // Schnell-Favorit (Bezeichnung + kcal) weg, Katalog-Favorit bleibt (Wächter E1 G1, A-G14).
  expect((await favorites(page)).map((f) => f.fav_key)).toEqual(['food|banane']);

  // Ohne Einwilligung: Erklärung + Knopf statt Eintragen.
  await page.goto('/ernaehrung/eintragen');
  await expect(page.getByTestId('food-log-consent')).toBeVisible();
  await expect(page.getByTestId('food-log-consent-button')).toBeVisible();
});

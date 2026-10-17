import { expect, test, type Page } from '@playwright/test';

import { db, onboardNutrition, openNutrition, patchDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Etappe E2 im TESTMODUS (docs/PLAN-AUSWERTUNG.md Abschnitt 7, „So testet ihr es am Handy“): Ernährung → „Eigene
 * Gerichte“ → „Mein Porridge“ aus Haferflocken 60 g, Milch 200 ml, Banane 1 Stück → Werte erscheinen → im Tagesverlauf
 * mit einem Tipp ½ Portion eintragen → Tagessumme stimmt; Gericht direkt mit 450 kcal anlegen → unter „Favoriten“
 * eintragen; Ändern lässt eingetragene Tage unverändert (Schnappschuss); Löschen lässt den Eintrag als „Eigenes
 * Gericht“ stehen; neu laden → alles da (offline). Zweiter Test: „Kalorienzahlen aus“ (nirgends kcal), 100 Gerichte,
 * Widerruf löscht die Gerichte. Der Name steht nie in einer testID und nie im Tagebuch-Eintrag. Beispiel-Bestand mit
 * TESTWERTEN. Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

interface StoredEntry {
  id: string;
  source: string;
  title_de: string;
  custom_meal_id: string | null;
  portion: number | null;
  kcal: number | null;
}
interface StoredMeal {
  id: string;
  name_de: string;
  mode: string;
  servings: number;
  kcal: number | null;
}

async function entries(page: Page): Promise<StoredEntry[]> {
  return ((await db(page)).rows.foodLogEntries ?? []) as StoredEntry[];
}
async function meals(page: Page): Promise<StoredMeal[]> {
  return ((await db(page)).rows.customMeals ?? []) as StoredMeal[];
}

async function start(page: Page) {
  await onboardNutrition(page);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await openNutrition(page);
}

async function addIngredient(
  page: Page,
  query: string,
  foodId: string,
  amount: string,
  unit?: string,
) {
  await page.getByTestId('custom-meal-search-input').fill(query);
  await page.getByTestId(`custom-meal-food-${foodId}`).click();
  if (unit) {
    await page
      .getByRole('radiogroup', { name: 'Einheit' })
      .getByRole('radio', { name: unit, exact: true })
      .click();
  }
  await page.getByTestId('custom-meal-amount').fill(amount);
  await page.getByTestId('custom-meal-add-item').click();
}

/** Kein testID enthält den Namen eines Gerichts (Datenschutz: Freitext nie in testIDs). */
async function expectNoNameInTestIds(page: Page, ...names: string[]) {
  const ids = await page
    .locator('[data-testid]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid') ?? ''));
  for (const name of names) {
    expect(ids.filter((id) => id.toLowerCase().includes(name.toLowerCase()))).toEqual([]);
  }
}

test('Mein Porridge aus Zutaten, ½ Portion im Tagesverlauf, direkt 450 kcal, ändern, löschen, neu laden', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await start(page);

  // Noch kein Gericht: im Tagesverlauf „Eigenes Gericht anlegen“.
  const day = page.getByTestId('custom-meal-day');
  await expect(day).toBeVisible();
  await day.getByTestId('custom-meal-day-create').click();
  await expect(page.getByTestId('custom-meal-form')).toBeVisible();

  // „Mein Porridge“ aus Haferflocken 60 g, Milch 200 ml, Banane 1 Stück → Werte erscheinen.
  await page.getByTestId('custom-meal-name').fill('Mein Porridge');
  await expect(page.getByTestId('custom-meal-items-empty')).toBeVisible();
  await addIngredient(page, 'Hafer', 'haferflocken', '60');
  await addIngredient(page, 'Milch', 'vollmilch', '200', 'ml');
  await addIngredient(page, 'Banane', 'banane', '1');
  await expect(page.getByTestId('custom-meal-ingredients')).toContainText('1 Stück');
  await expect(page.getByTestId('custom-meal-values')).toContainText('465 kcal');
  // Suche ohne Treffer.
  await page.getByTestId('custom-meal-search-input').fill('xyzxyz');
  await expect(page.getByTestId('custom-meal-search-none')).toBeVisible();
  await expectNoNameInTestIds(page, 'Porridge');
  await page.getByTestId('custom-meal-save').click();
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
  await expect
    .poll(async () => (await meals(page)).map((m) => m.name_de))
    .toEqual(['Mein Porridge']);
  expect((await meals(page))[0]).toMatchObject({ mode: 'ingredients', servings: 1, kcal: 465 });

  // Im Tagesverlauf mit einem Tipp eintragen, ½ Portion → Tagessumme stimmt.
  const list = page.getByTestId('custom-meal-day-list');
  await expect(list).toContainText('Mein Porridge');
  await list
    .getByRole('radiogroup', { name: 'Portion' })
    .getByRole('radio', { name: '½', exact: true })
    .click();
  await list.getByTestId('custom-meal-day-list-add-0').click();
  await expect(page.getByTestId('custom-meal-day-message')).toHaveText(
    'Eingetragen: Mein Porridge · ½ Portion',
  );
  await expect.poll(async () => (await entries(page)).length).toBe(1);
  const porridgeEntry = (await entries(page))[0] as StoredEntry;
  expect(porridgeEntry).toMatchObject({
    source: 'custom_meal',
    title_de: 'Eigenes Gericht',
    portion: 0.5,
    kcal: 233,
  });
  expect(porridgeEntry.custom_meal_id).toBe((await meals(page))[0]?.id);
  await expect(page.getByTestId('food-log-summary')).toContainText('1 Eintrag · 233 kcal');
  await expect(page.getByTestId(`food-log-entry-${porridgeEntry.id}`)).toContainText(
    'Mein Porridge',
  );
  // Eigene Gerichte haben keinen Stern.
  await expect(page.getByTestId(`food-log-favorite-${porridgeEntry.id}`)).toHaveCount(0);
  await expectNoNameInTestIds(page, 'Porridge');

  // Direkt mit 450 kcal anlegen (Makros passen, keine Rückfrage).
  await page.getByTestId('custom-meal-day-manage').click();
  await expect(page.getByTestId('custom-meals')).toBeVisible();
  await expect(page.getByTestId('custom-meals-count')).toHaveText('1 von 100 Gerichten');
  await page.getByTestId('custom-meals-create').click();
  await page.getByTestId('custom-meal-name').fill('Shake nach dem Training');
  await page.getByRole('radio', { name: 'Werte direkt' }).click();
  await page.getByTestId('custom-meal-kcal').fill('450');
  await page.getByTestId('custom-meal-protein').fill('30');
  await page.getByTestId('custom-meal-carbs').fill('50');
  await page.getByTestId('custom-meal-fat').fill('12,5');
  await page.getByTestId('custom-meal-save').click();
  await expect(page.getByTestId('custom-meals-list')).toContainText('Shake nach dem Training');
  await expect(page.getByTestId('custom-meals-list')).toContainText(
    'Werte direkt eingegeben · je Portion 450 kcal',
  );

  // Rückfrage, wenn die Makros mehr als 20 % von den kcal abweichen – keine Sperre; ungültiger Name.
  await page.getByTestId('custom-meals-create').click();
  await page.getByRole('radio', { name: 'Werte direkt' }).click();
  await page.getByTestId('custom-meal-kcal').fill('100');
  // Feldfehler hängt am betroffenen Feld (Wächter E2 H5).
  await page.getByTestId('custom-meal-protein').fill('800');
  await page.getByTestId('custom-meal-name').fill('Eiweißriegel');
  await page.getByTestId('custom-meal-save').click();
  await expect(
    page.getByText('Bitte Gramm von 0 bis 750 eingeben (eine Nachkommastelle).'),
  ).toHaveCount(1);
  await page.getByTestId('custom-meal-name').fill('');
  await page.getByTestId('custom-meal-protein').fill('50');
  await page.getByTestId('custom-meal-save').click();
  await expect(page.getByText('Bitte einen Namen mit 1 bis 60 Zeichen eingeben.')).toBeVisible();
  await page.getByTestId('custom-meal-name').fill('Eiweißriegel');
  await page.getByTestId('custom-meal-save').click();
  await expect(page.getByTestId('custom-meal-confirm')).toContainText(
    'Eiweiß, Kohlenhydrate und Fett passen nicht ganz zu den angegebenen Kalorien.',
  );
  await page.getByTestId('custom-meal-confirm').getByRole('button', { name: 'Abbrechen' }).click();
  await page.getByTestId('custom-meal-cancel').click();
  expect(await meals(page)).toHaveLength(2);

  // „Eintragen“ → Favoriten: eigene Gerichte mit Portion; Zuletzt: auch eigene Gerichte.
  await page.goto('/ernaehrung/eintragen');
  await page.getByRole('radio', { name: 'Favoriten' }).click();
  const picker = page.getByTestId('food-log-custom-meals');
  await expect(picker).toContainText('Shake nach dem Training');
  await picker.getByRole('button', { name: 'Shake nach dem Training eintragen' }).click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText(
    'Eingetragen: Shake nach dem Training',
  );
  await expect.poll(async () => (await entries(page)).length).toBe(2);
  expect((await entries(page)).find((e) => e.kcal === 450)).toMatchObject({
    title_de: 'Eigenes Gericht',
    portion: 1,
  });
  await page.getByRole('radio', { name: 'Zuletzt' }).click();
  await expect(page.getByTestId('food-log-recent')).toContainText('Mein Porridge');
  await expect(page.getByTestId('food-log-recent')).toContainText('½ Portion');
  await expectNoNameInTestIds(page, 'Porridge', 'Shake');

  // Ändern: 2 Portionen → neue Werte; der eingetragene Tag behält 233 kcal (Schnappschuss).
  await page.goto('/ernaehrung/gerichte');
  // Knöpfe mit Bedienhilfe-Namen (testIDs nur mit Position).
  await page.getByRole('button', { name: 'Mein Porridge ändern' }).click();
  await expect(page.getByTestId('custom-meal-name')).toHaveValue('Mein Porridge');
  await page.getByTestId('custom-meal-name').fill('Porridge groß');
  const servings = page.getByRole('radiogroup', { name: 'Ergibt Portionen' });
  await expect(servings.getByRole('radio')).toHaveCount(20); // 1–20 wie Core und Datenbank (Wächter E2 H3)
  await servings.getByRole('radio', { name: '2', exact: true }).click();
  await expect(page.getByTestId('custom-meal-values')).toContainText('233 kcal');
  await page.getByTestId('custom-meal-save').click();
  await expect(page.getByTestId('custom-meals-list')).toContainText('Porridge groß');
  await expect
    .poll(async () => (await meals(page)).find((m) => m.name_de === 'Porridge groß')?.kcal)
    .toBe(233);
  expect((await entries(page)).find((e) => e.id === porridgeEntry.id)?.kcal).toBe(233);

  // Löschen (mit Rückfrage): der Eintrag bleibt mit seinen Werten als „Eigenes Gericht“.
  await page.getByRole('button', { name: 'Shake nach dem Training löschen' }).click();
  await expect(page.getByTestId('custom-meals-delete-dialog')).toContainText(
    'Bereits eingetragene Tage behalten ihre Werte',
  );
  await page
    .getByTestId('custom-meals-delete-dialog')
    .getByRole('button', { name: 'Löschen' })
    .click();
  await expect(page.getByTestId('custom-meals-message')).toHaveText('Gericht gelöscht.');
  await expect.poll(async () => (await meals(page)).length).toBe(1);
  const shakeEntry = (await entries(page)).find((e) => e.kcal === 450) as StoredEntry;
  expect(shakeEntry.custom_meal_id).toBeNull();

  // Neu laden (wie nach dem Flugmodus) → alles da; Tagesverlauf zeigt neuen Namen bzw. „Eigenes Gericht“.
  await page.goto('/ernaehrung');
  await page.reload();
  await expect(page.getByTestId(`food-log-entry-${porridgeEntry.id}`)).toContainText(
    'Porridge groß',
  );
  await expect(page.getByTestId(`food-log-entry-${shakeEntry.id}`)).toContainText(
    'Eigenes Gericht',
  );
  await expect(page.getByTestId('food-log-summary')).toContainText('2 Einträge · 683 kcal');
  expect(await meals(page)).toHaveLength(1);
});

test('Kalorienzahlen aus (nirgends kcal), ohne Werte, 100 Gerichte, Widerruf löscht die Gerichte', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await start(page);
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: { ...(value.rows.nutritionSetup as object), show_energy_numbers: false },
    },
  }));

  // „Ohne Werte“ statt „Werte direkt“, kein kcal-Feld.
  await page.goto('/ernaehrung/gericht');
  await expect(page.getByRole('radio', { name: 'Werte direkt' })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Ohne Werte' }).click();
  await expect(page.getByTestId('custom-meal-kcal')).toHaveCount(0);
  await expect(page.getByTestId('custom-meal-direct')).toContainText('ohne Werte angelegt');
  await page.getByTestId('custom-meal-name').fill('Snackteller');
  await page.getByTestId('custom-meal-save').click();
  await expect.poll(async () => (await meals(page)).length).toBe(1);
  expect((await meals(page))[0]).toMatchObject({ mode: 'direct', kcal: null });

  // Aus Zutaten: Werte im Hintergrund berechnet, nicht gezeigt.
  await page.goto('/ernaehrung/gericht');
  await page.getByTestId('custom-meal-name').fill('Bananen-Porridge');
  await addIngredient(page, 'Banane', 'banane', '2');
  await expect(page.getByTestId('custom-meal-values')).toHaveCount(0);
  await expect(page.getByTestId('custom-meal-ingredients')).toContainText(
    'Die Werte rechnen wir im Hintergrund',
  );
  expect(await page.content()).not.toMatch(/kcal/);
  await page.getByTestId('custom-meal-save').click();
  await expect.poll(async () => (await meals(page)).length).toBe(2);
  expect((await meals(page)).find((m) => m.name_de === 'Bananen-Porridge')?.kcal).toBe(223);

  // Tagesverlauf: eintragen, nirgends kcal (auch nicht in data-testid).
  await page.goto('/ernaehrung');
  const list = page.getByTestId('custom-meal-day-list');
  await expect(list).toContainText('Snackteller');
  await list.getByRole('button', { name: 'Snackteller eintragen' }).click();
  await expect(page.getByTestId('custom-meal-day-message')).toHaveText(
    'Eingetragen: Snackteller · 1 Portion',
  );
  await expect(page.getByTestId('food-log-summary')).toHaveText('1 Eintrag');
  expect(await page.content()).not.toMatch(/kcal/);
  expect((await entries(page))[0]).toMatchObject({ kcal: null, title_de: 'Eigenes Gericht' });
  await page.goto('/ernaehrung/gerichte');
  await expect(page.getByTestId('custom-meals-list')).toContainText('ohne Werte');
  expect(await page.content()).not.toMatch(/kcal/);
  await page.goto('/ernaehrung/eintragen');
  await page.getByRole('radio', { name: 'Favoriten' }).click();
  await expect(page.getByTestId('food-log-custom-meals')).toContainText('Bananen-Porridge');
  expect(await page.content()).not.toMatch(/kcal/);

  // Einwilligung fehlt (z. B. neue Textfassung noch nicht bestätigt, Wächter E2 S2): Liste nur mit „Löschen“.
  const consents = (await db(page)).rows.consents;
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      consents: (value.rows.consents as { consent_type: string }[]).filter(
        (c) => c.consent_type !== 'health_data',
      ),
    },
  }));
  await page.goto('/ernaehrung/gerichte');
  await expect(page.getByTestId('custom-meals-consent')).toContainText('nur löschen');
  await expect(page.getByTestId('custom-meals-list')).toContainText('Snackteller');
  await expect(page.getByTestId('custom-meals-create')).toHaveCount(0);
  await expect(page.getByTestId(/^custom-meals-edit-/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Snackteller löschen' }).click();
  await page
    .getByTestId('custom-meals-delete-dialog')
    .getByRole('button', { name: 'Löschen' })
    .click();
  await expect(page.getByTestId('custom-meals-message')).toHaveText('Gericht gelöscht.');
  await expect
    .poll(async () => (await meals(page)).map((m) => m.name_de))
    .toEqual(['Bananen-Porridge']);
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('custom-meal-day')).toHaveCount(0);
  await patchDb(page, (value) => ({ ...value, rows: { ...value.rows, consents } }));

  // 100 Gerichte: „Neues Gericht anlegen“ gesperrt, Hinweis.
  await patchDb(page, (value) => {
    const userId = (value.rows.profile as { user_id: string }).user_id;
    const filler = Array.from({ length: 99 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      user_id: userId,
      name_de: `Gericht ${i + 1}`,
      mode: 'direct',
      servings: 1,
      kcal: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      revision: 1,
      last_write_id: 'w',
      created_at: '2026-10-12T07:00:00.000Z',
      updated_at: '2026-10-12T07:00:00.000Z',
    }));
    return {
      ...value,
      rows: { ...value.rows, customMeals: [...(value.rows.customMeals as object[]), ...filler] },
    };
  });
  await page.goto('/ernaehrung/gerichte');
  await expect(page.getByTestId('custom-meals-count')).toHaveText('100 von 100 Gerichten');
  await expect(page.getByTestId('custom-meals-create')).toBeDisabled();
  await expect(page.getByTestId('custom-meals-limit')).toBeVisible();
  await page.goto('/ernaehrung/gericht');
  await expect(page.getByText('Du hast schon 100 eigene Gerichte.')).toBeVisible();

  // Widerruf: Hinweis vorher, Gerichte und Tagebuch weg.
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Gesundheitsdaten: Widerrufen' }).click();
  await expect(page.getByText(/samt Schnelleintrag-Favoriten, eigenen Gerichten/)).toBeVisible();
  await page.getByRole('button', { name: 'Tagebuch behalten (empfohlen)' }).click();
  await expect(
    page.getByText('Einwilligung widerrufen. Deine Gesundheitsdaten wurden gelöscht.'),
  ).toBeVisible();
  await expect.poll(async () => (await meals(page)).length).toBe(0);
  expect(await entries(page)).toHaveLength(0);

  // Ohne Einwilligung: Erklärung + Knopf statt Liste.
  await page.goto('/ernaehrung/gerichte');
  await expect(page.getByTestId('custom-meals-consent')).toBeVisible();
  await expect(page.getByTestId('custom-meals-consent-button')).toBeVisible();
});

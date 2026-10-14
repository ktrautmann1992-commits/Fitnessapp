import { expect, test, type Page } from '@playwright/test';

import { LOCAL_DB, onboardNutrition, openNutrition, patchDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Etappe N11 im TESTMODUS (docs/PLAN-PHASE-5.md 19.7 N11, KONZEPT 6.11): Kühlschrank-Suche „Was habe ich da?“.
 * Auswahl → Rezepte nach Übereinstimmung; harte Ausschlüsse (Ernährungsform, „mag ich nicht“, Erdnuss-
 * Unverträglichkeit, Schwangerschaft) wirken und sind nicht abschaltbar; nur Gewürze → Hinweis; Entwürfe mit
 * Allergen-Warnung; die Auswahl landet weder in der Adresse noch im Gerätespeicher; „Zahlen aus“ → keine kcal.
 * Beispiel-Rezepte mit TESTWERTEN. Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

async function hitIds(page: Page): Promise<string[]> {
  const ids = await page
    .getByTestId('fridge-results')
    .locator('[data-testid^="fridge-hit-"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid') ?? ''));
  return ids
    .filter((id) => !id.endsWith('-match') && !id.endsWith('-missing'))
    .map((id) => id.replace('fridge-hit-', ''));
}

async function start(page: Page, person: Parameters<typeof onboardNutrition>[1] = {}) {
  await onboardNutrition(page, person);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
}

const option = (page: Page, name: string) =>
  page.getByTestId('fridge-search').getByRole('checkbox', { name, exact: true });

test('Was habe ich da?: Auswahl, Übereinstimmung, nur Gewürze, Entwurf-Warnung, nichts gespeichert, Zahlen aus', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await start(page); // vegetarisch, Pilze „mag ich nicht“
  await openNutrition(page);
  await page.getByTestId('nutrition-fridge-search').click();
  await expect(page.getByTestId('fridge-search')).toBeVisible();
  await expect(page.getByTestId('fridge-privacy')).toContainText('nicht gespeichert');
  await expect(page.getByTestId('fridge-empty-selection')).toBeVisible();
  await expect(page.getByTestId('fridge-selected')).toHaveText('Noch nichts ausgewählt');
  // Gerätespeicher (localStorage und sessionStorage, Wächter N11 H3) vor der Auswahl.
  const storageBefore = await page.evaluate(() =>
    JSON.stringify({ local: { ...window.localStorage }, session: { ...window.sessionStorage } }),
  );

  // Auswahl nur aus passenden Rezepten: kein Fleisch (vegetarisch), keine Pilze („mag ich nicht“).
  await expect(option(page, 'Banane')).toBeVisible();
  await expect(option(page, 'Hähnchenbrust')).toHaveCount(0);
  await expect(option(page, 'Champignons')).toHaveCount(0);

  // Nur Gewürze → Hinweis statt Treffer.
  await option(page, 'Speisesalz').click();
  await expect(page.getByTestId('fridge-selected')).toHaveText('1 Zutat ausgewählt');
  await expect(page.getByTestId('fridge-empty')).toContainText('Gewürze und Backzutaten allein');

  // Banane dazu → Treffer nach Übereinstimmung, Banane pur ganz oben mit 100 %.
  await option(page, 'Banane').click();
  await expect(page.getByTestId('fridge-results')).toBeVisible();
  const ids = await hitIds(page);
  expect(ids[0]).toBe('banane-pur');
  expect(ids).not.toContain('omelett-champignons');
  for (const id of ['haehnchen-reis', 'hack-spaghetti', 'salami-brot']) {
    expect(ids).not.toContain(id);
  }
  await expect(page.getByTestId('fridge-hit-banane-pur-match')).toHaveText('100 % passt');
  await expect(page.getByTestId('fridge-hit-banane-pur-missing')).toHaveText(
    'Alle Hauptzutaten hast du da.',
  );
  await expect(page.getByTestId('fridge-draft-warning')).toContainText(
    'Allergene noch nicht fachlich geprüft',
  );
  await expect(page.getByTestId('fridge-results')).toContainText('kcal je Portion');

  // Suchfeld grenzt die Auswahl ein.
  await page.getByLabel('Zutat suchen').fill('hafer');
  await expect(option(page, 'Haferflocken')).toBeVisible();
  await expect(option(page, 'Speisesalz')).toHaveCount(0);
  await page.getByLabel('Zutat suchen').fill('gibtesnicht');
  await expect(page.getByTestId('fridge-no-option-match')).toBeVisible();
  await page.getByLabel('Zutat suchen').fill('');

  // Die Auswahl steht nirgends: nicht in der Adresse, nicht im Gerätespeicher.
  expect(page.url()).not.toContain('banane');
  const storage = await page.evaluate(() =>
    JSON.stringify({ local: { ...window.localStorage }, session: { ...window.sessionStorage } }),
  );
  expect(storage).toBe(storageBefore);

  // Rezept öffnen (Profil-Ernährungsform, keine Erweiterung).
  await page.getByTestId('fridge-hit-banane-pur').click();
  await expect(page.getByTestId('recipe')).toBeVisible();
  await expect(page.getByTestId('recipe-outside-diet')).toHaveCount(0);

  // Neu geöffnet: Auswahl ist weg.
  await page.goto('/rezepte/kuehlschrank');
  await expect(page.getByTestId('fridge-empty-selection')).toBeVisible();
  await expect(option(page, 'Banane')).toHaveAttribute('aria-checked', 'false');

  // Auswahl leeren.
  await option(page, 'Banane').click();
  await page.getByTestId('fridge-clear').click();
  await expect(page.getByTestId('fridge-empty-selection')).toBeVisible();

  // Zahlen aus → keine kcal.
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: { ...(value.rows.nutritionSetup as object), show_energy_numbers: false },
    },
  }));
  await page.goto('/rezepte');
  await page.getByTestId('recipe-search-fridge').click();
  await expect(page.getByTestId('fridge-search')).toBeVisible();
  await option(page, 'Banane').click();
  await expect(page.getByTestId('fridge-results')).toBeVisible();
  await expect(page.getByTestId('fridge-search')).not.toContainText('kcal');
  // Gerätespeicher-Schlüssel der App unverändert in Gebrauch (Plausibilität des Tests oben).
  expect(await page.evaluate((key) => window.localStorage.getItem(key) !== null, LOCAL_DB)).toBe(
    true,
  );
});

test('Was habe ich da?: vegan, Erdnuss-Unverträglichkeit und Schwangerschaft wirken hart', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await start(page, { diet: 'Vegan', peanutIntolerance: true, pregnancy: true });
  await page.goto('/rezepte/kuehlschrank');
  await expect(page.getByTestId('fridge-search')).toBeVisible();
  for (const name of ['Erdnüsse', 'Räucherlachs', 'Hähnchenbrust', 'Ei', 'Vollmilch 3,5 %']) {
    await expect(option(page, name)).toHaveCount(0);
  }
  await option(page, 'Banane').click();
  await option(page, 'Tofu natur').click();
  await expect(page.getByTestId('fridge-results')).toBeVisible();
  const ids = await hitIds(page);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of [
    'tofu-erdnuss-curry',
    'erdnuss-banane',
    'brot-raeucherlachs',
    'mascarponecreme-roh',
    'omelett-champignons',
    'porridge-banane',
  ]) {
    expect(ids).not.toContain(id);
  }
  // Schwangerschaft: keine kcal (wie überall in der Ernährung).
  await expect(page.getByTestId('fridge-search')).not.toContainText('kcal');
});

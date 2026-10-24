import { expect, test, type Page } from '@playwright/test';

import { db, onboardNutrition, openNutrition, patchDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Etappe N5c im TESTMODUS (docs/PLAN-PHASE-5.md 19.6, DoD-Ergänzungen 19.7, Auflagen des Wächters N5a): Rezeptsuche
 * mit vorbelegter Ernährungsform (erweiterbar, Treffer gekennzeichnet), harte Ausschlüsse (Erdnuss-Unverträglichkeit,
 * Schwangerschaft, Schwein unbekannt), Portionswähler, „Zur Einkaufsliste“ mit Kennzeichnung, Ratgeber im Flugmodus,
 * „Zahlen aus“ → keine kcal in Suche, Portionswähler und Ratgeber. Beispiel-Rezepte und Beispiel-Ratgeber mit
 * TESTWERTEN. Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

const MEAT_OR_PORK = ['hack-spaghetti', 'salami-brot', 'haehnchen-reis', 'lachs-reis'];

async function hitIds(page: Page): Promise<string[]> {
  const ids = await page
    .getByTestId('recipe-search-results')
    .locator('[data-testid^="recipe-search-hit-"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid') ?? ''));
  return ids
    .filter((id) => !id.endsWith('-outside'))
    .map((id) => id.replace('recipe-search-hit-', ''));
}

async function start(page: Page, person: Parameters<typeof onboardNutrition>[1] = {}) {
  await onboardNutrition(page, person);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
}

async function numbersOff(page: Page) {
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: { ...(value.rows.nutritionSetup as object), show_energy_numbers: false },
    },
  }));
}

test('Rezeptsuche: vorbelegte Ernährungsform, erweitern gekennzeichnet, Portionswähler, Zur Einkaufsliste, Zahlen aus', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await start(page); // vegetarisch, Pilze „mag ich nicht“
  await openNutrition(page);
  await page.getByTestId('nutrition-recipe-search').click();
  await expect(page.getByTestId('recipe-search')).toBeVisible();
  await expect(page.getByTestId('recipe-search-diet')).toHaveText(
    'Deine Ernährungsform: vegetarisch',
  );
  // „28 Min. · 482 kcal · 31 g Eiweiß · 40 g KH“ (Gründer-Wunsch 24.10.2026).
  await expect(page.getByTestId('recipe-search-results')).toContainText(
    /\d+\skcal\s·\s\d+\sg\sEiweiß\s·\s\d+\sg\sKH/,
  );
  const own = await hitIds(page);
  expect(own.length).toBeGreaterThan(3);
  for (const id of MEAT_OR_PORK) expect(own).not.toContain(id);
  // „mag ich nicht“ ist nicht abschaltbar.
  expect(own).not.toContain('omelett-champignons');
  expect(own).not.toContain('champignon-reis');
  await expect(page.locator('[data-testid$="-outside"]')).toHaveCount(0);

  // Erweitern auf „mit Fleisch“: Hähnchen gekennzeichnet, Schwein bleibt draußen (Angabe unbekannt, G2).
  await page.getByRole('checkbox', { name: 'Auch mit Fleisch' }).click();
  await expect(page.getByTestId('recipe-search-hit-haehnchen-reis-outside')).toHaveText(
    'Passt nicht zu deiner Ernährungsform: mit Fleisch',
  );
  const wider = await hitIds(page);
  expect(wider).not.toContain('hack-spaghetti');
  expect(wider).not.toContain('salami-brot');
  expect(wider).not.toContain('omelett-champignons');

  // Unter 10 Minuten (Gesamtzeit des Rezepts).
  await page.getByRole('checkbox', { name: 'Unter 10 Minuten' }).click();
  const quick = await hitIds(page);
  expect(quick.length).toBeGreaterThan(0);
  expect(quick).not.toContain('haehnchen-reis');
  await page.getByRole('checkbox', { name: 'Unter 10 Minuten' }).click();

  // Text: kein Treffer → Leer-Zustand.
  await page.getByLabel('Im Titel suchen').fill('gibtesnicht');
  await expect(page.getByTestId('recipe-search-empty')).toBeVisible();
  await page.getByLabel('Im Titel suchen').fill('');

  // Treffer der erweiterten Suche öffnen: gekennzeichnet, Portionswähler, Zur Einkaufsliste.
  await page.getByTestId('recipe-search-hit-haehnchen-reis').click();
  await expect(page.getByTestId('recipe')).toBeVisible();
  await expect(page.getByTestId('recipe-outside-diet')).toContainText(
    'Passt nicht zu deiner Ernährungsform: mit Fleisch',
  );
  await expect(page.getByTestId('recipe-servings')).toContainText('1 Portion');
  await expect(page.getByTestId('recipe-ingredients')).toContainText('150 g');
  await page.getByTestId('recipe-servings-more').click();
  await page.getByTestId('recipe-servings-more').click();
  await expect(page.getByTestId('recipe-servings')).toContainText('3 Portionen');
  await expect(page.getByTestId('recipe-ingredients')).toContainText('450 g');
  await expect(page.getByTestId('recipe-nutrients')).toContainText('kcal');
  await page.getByTestId('recipe-shopping-add').click();
  await expect(page.getByTestId('recipe-shopping-message')).toContainText('3 Portionen');
  await page.getByTestId('recipe-shopping-open').click();
  await expect(page.getByTestId('shopping-list')).toBeVisible();
  await expect(page.getByTestId('shopping-recipe-outside-haehnchen-reis')).toBeVisible();
  await expect(page.getByTestId('shopping-item-haehnchenbrust|g')).toContainText(
    'passt nicht zu deiner Ernährungsform',
  );
  const lists = ((await db(page)).rows.shoppingLists ?? []) as {
    list: { recipes: { recipeId: string; servings: number; diet?: string }[] };
  }[];
  expect(lists[0]?.list.recipes).toEqual([
    { recipeId: 'haehnchen-reis', servings: 3, diet: 'omnivore' },
  ]);

  // Ohne den Such-Parameter bleibt das Rezept für die Person gesperrt (G4: nie automatisch).
  await page.goto('/rezept/haehnchen-reis');
  await expect(page.getByTestId('recipe-not-for-you')).toBeVisible();

  // Zahlen aus → keine kcal in Suche und Portionswähler.
  await numbersOff(page);
  await page.goto('/rezepte');
  await expect(page.getByTestId('recipe-search-results')).toBeVisible();
  await expect(page.getByTestId('recipe-search')).not.toContainText('kcal');
  await page.goto('/rezept/porridge-banane');
  await expect(page.getByTestId('recipe-servings')).toBeVisible();
  await page.getByTestId('recipe-servings-more').click();
  await expect(page.getByTestId('recipe-servings')).toContainText('2 Portionen');
  await expect(page.getByTestId('recipe-nutrients')).toHaveCount(0);
  await expect(page.getByTestId('recipe')).not.toContainText('kcal');
});

test('Rezeptsuche: Erdnuss-Unverträglichkeit und Schwangerschaft wirken auch erweitert', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await start(page, { diet: 'Vegan', peanutIntolerance: true, pregnancy: true });
  await page.goto('/rezepte');
  await expect(page.getByTestId('recipe-search-diet')).toHaveText('Deine Ernährungsform: vegan');
  await page.getByRole('checkbox', { name: 'Auch vegetarisch' }).click();
  await page.getByRole('checkbox', { name: 'Auch mit Fleisch' }).click();
  await expect(page.locator('[data-testid$="-outside"]').first()).toBeVisible();
  const ids = await hitIds(page);
  for (const id of [
    'tofu-erdnuss-curry',
    'erdnuss-banane',
    'brot-raeucherlachs',
    'mascarponecreme-roh',
    'salami-brot',
    'hack-spaghetti',
  ]) {
    expect(ids).not.toContain(id);
  }
  // Schwangerschaft: keine kcal (wie überall in der Ernährung).
  await expect(page.getByTestId('recipe-search')).not.toContainText('kcal');
  // Direkt geöffnet mit erweiterter Form: weiterhin gesperrt.
  await page.goto('/rezept/brot-raeucherlachs?form=omnivore');
  await expect(page.getByTestId('recipe-not-for-you')).toBeVisible();
});

test('Ratgeber im Flugmodus; Zahlen aus blendet Mengen aus, fester Carb-Loading-Hinweis bleibt', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await start(page);
  await openNutrition(page);
  await page.getByTestId('nutrition-guides').click();
  await expect(page.getByTestId('guide-list')).toBeVisible();

  // Flugmodus: Ratgeber kommen aus der App, nicht aus dem Netz.
  await page.context().setOffline(true);
  await page.getByTestId('guide-open-demo-wettkampf').click();
  await expect(page.getByTestId('guide')).toBeVisible();
  await expect(page.getByTestId('guide-draft')).toBeVisible();
  await expect(page.getByTestId('guide-sections')).toContainText('Carb-Loading');
  await expect(page.getByTestId('guide-sections')).toContainText('8–10 g Kohlenhydrate');
  await expect(page.getByTestId('guide-notice')).toHaveText(
    'Im Kaloriendefizit, unter 18 Jahren oder in der Schwangerschaft nicht ohne fachliche Absprache.',
  );
  await page.goBack();
  await page.getByTestId('guide-open-demo-unterwegs').click();
  await expect(page.getByTestId('guide-places')).toContainText('Beim Bäcker');
  await expect(page.getByTestId('guide-sections')).toContainText('kcal');
  await page.context().setOffline(false);

  // Zahlen aus → Absätze mit kcal bzw. g je kg ausgeblendet, Hinweis bleibt.
  await numbersOff(page);
  await page.goto('/ratgeber/demo-wettkampf');
  await expect(page.getByTestId('guide-numbers-hidden')).toBeVisible();
  await expect(page.getByTestId('guide-notice')).toBeVisible();
  await expect(page.getByTestId('guide')).not.toContainText('8–10 g');
  await page.goto('/ratgeber/demo-unterwegs');
  await expect(page.getByTestId('guide-places')).toBeVisible();
  await expect(page.getByTestId('guide')).not.toContainText('kcal');
  await page.goto('/ratgeber/gibt-es-nicht');
  await expect(page.getByTestId('guide-not-found')).toBeVisible();
});

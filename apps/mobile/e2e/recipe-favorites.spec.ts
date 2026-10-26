import { expect, test, type Page } from '@playwright/test';

import { db, onboardNutrition, openNutrition } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Rezept-Favoriten im TESTMODUS (Gründer-Freigabe 25.10.2026, KONZEPT 6.10a) mit Beispiel-Rezepten: Herz an einer
 * Mahlzeit des Plans („⋯“), Kennzeichen „Lieblingsgericht“, Rezeptsuche mit Herz je Treffer und „Nur
 * Lieblingsgerichte“, „Nie wieder“ in der Rezeptansicht → in der Suche ausgeblendet (mit Hinweis), Einstellungen →
 * „Ausgeblendete Gerichte“ → „Wieder zulassen“. Alles offline im Gerätespeicher. Fester Tag: Montag, 12.10.2026.
 * Mit SCREENSHOT_DIR entstehen Bilder (390 px, hell) – in CI nicht.
 */

async function shot(page: Page, name: string) {
  const dir = process.env.SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
}

interface Prefs {
  rows: { recipePreferences?: { recipe_id: string; kind: string }[] };
}

test('Herz an der Mahlzeit, Suche mit Nur Lieblingsgerichte, Nie wieder ausblenden und zurückholen', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await onboardNutrition(page);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await openNutrition(page);

  // Mahlzeit: „⋯“ klappt Lieblingsgericht / Nie wieder auf.
  const more = page.locator('[data-testid$="-pref-more"]').first();
  const prefix = ((await more.getAttribute('data-testid')) ?? '').replace(/-more$/, '');
  const slot = prefix.replace(/^meal-/, '').replace(/-pref$/, '');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await page.getByTestId(`${prefix}-favorite`).click();
  await expect(page.getByTestId(`${prefix}-message`)).toHaveText('Als Lieblingsgericht gemerkt.');
  await expect(page.getByTestId(`meal-${slot}-favorite`)).toHaveText('Lieblingsgericht');
  const favorite = ((await db(page)) as unknown as Prefs).rows.recipePreferences?.[0];
  expect(favorite?.kind).toBe('favorite');
  const favId = favorite?.recipe_id ?? '';
  await page.getByTestId(`meal-${slot}`).scrollIntoViewIfNeeded();
  await shot(page, '01-mahlzeit-lieblingsgericht');

  // Rezeptsuche: Herz je Treffer, Filter „Nur Lieblingsgerichte“.
  await page.goto('/rezepte');
  await expect(page.getByTestId('recipe-search')).toBeVisible();
  const heart = page.getByTestId(`recipe-search-hit-${favId}-favorite`);
  await expect(heart).toHaveAttribute('aria-checked', 'true');
  const all = await page
    .locator('[data-testid^="recipe-search-hit-"][data-testid$="-favorite"]')
    .count();
  expect(all).toBeGreaterThan(2);
  await page.getByTestId('recipe-search-favorites').click();
  await expect(page.getByTestId('recipe-search-count')).toHaveText('1 Rezept gefunden');
  await shot(page, '02-rezeptsuche-nur-lieblingsgerichte');
  await page.getByTestId('recipe-search-favorites').click();
  // Zweites Herz direkt in der Liste setzen.
  const second = page
    .locator('[data-testid^="recipe-search-hit-"][data-testid$="-favorite"][aria-checked="false"]')
    .first();
  await second.click();
  await expect(page.locator('[data-testid$="-favorite"][aria-checked="true"]')).toHaveCount(2);
  await page.getByTestId('recipe-search-results').scrollIntoViewIfNeeded();
  await shot(page, '03-rezeptliste-herzen');

  // Rezeptansicht: „Nie wieder“ → in der Suche ausgeblendet, mit Hinweis und Weg zur Liste.
  await page.getByTestId(`recipe-search-hit-${favId}`).click();
  await expect(page.getByTestId('recipe')).toBeVisible();
  const favButton = page.getByTestId('recipe-preference-favorite');
  await favButton.scrollIntoViewIfNeeded();
  await shot(page, '04-rezept-dein-geschmack');
  await page.getByTestId('recipe-preference-hide').click();
  await expect(page.getByTestId('recipe-preference-hidden')).toHaveText(
    'Ausgeblendet – wird dir nicht mehr vorgeschlagen.',
  );
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page.getByTestId('recipe-search')).toBeVisible();
  await expect(page.getByTestId(`recipe-search-hit-${favId}`)).toHaveCount(0);
  await expect(page.getByTestId('recipe-search-hidden')).toContainText(
    '1 Gericht ist ausgeblendet.',
  );

  // Einstellungen → Ausgeblendete Gerichte → Wieder zulassen.
  await page.getByTestId('recipe-search-hidden-open').click();
  await expect(page.getByTestId('hidden-recipes')).toBeVisible();
  await expect(page.getByTestId(`hidden-recipe-${favId}`)).toContainText(
    'Ausgeblendet am 12.10.2026',
  );
  await shot(page, '05-ausgeblendete-gerichte');
  await page.getByTestId(`hidden-recipe-allow-${favId}`).click();
  await expect(page.getByTestId('hidden-recipes-message')).toContainText('ist wieder erlaubt.');
  await expect(page.getByTestId('hidden-recipes-empty')).toBeVisible();
  const after = ((await db(page)) as unknown as Prefs).rows.recipePreferences ?? [];
  expect(after.some((p) => p.recipe_id === favId)).toBe(false);

  // Der Weg über die Einstellungen.
  await page.goto('/settings');
  await expect(page.getByTestId('settings-hidden-recipes')).toBeVisible();
});

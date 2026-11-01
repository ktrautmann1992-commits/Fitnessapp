import { expect, test, type Page } from '@playwright/test';

import { db, onboardNutrition, openNutrition } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Gerichte entdecken – Wochenauswahl per Wischen (Gründer-Wunsch 01.11.2026, docs/PLAN-REZEPT-SWIPE.md) im
 * TESTMODUS mit Beispiel-Rezepten: Kartenstapel mit Karten dahinter, Knöpfe ✕ / – / ♥, Wischen mit der Maus,
 * Rückgängig, „Wochenplan aktualisieren“. Fester Tag: Montag, 12.10.2026 → Auswahl für die Woche ab 19.10.2026.
 * Mit SCREENSHOT_DIR entstehen Bilder (390 px, hell) – in CI nicht.
 */

async function shot(page: Page, name: string) {
  const dir = process.env.SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
}

interface Prefs {
  rows: { recipePreferences?: { recipe_id: string; kind: string }[] };
}

async function frontRecipe(page: Page): Promise<string> {
  const bar = page.getByTestId('recipe-swipe-card').locator('[data-testid^="recipe-swipe-bar-"]');
  return ((await bar.getAttribute('data-testid')) ?? '').replace('recipe-swipe-bar-', '');
}

test('Kartenstapel: Knöpfe, Wischen mit der Maus, Rückgängig, Wochenplan aktualisieren', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await onboardNutrition(page);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await openNutrition(page);
  await page.goto('/ernaehrung/woche');
  await page.getByTestId('nutrition-week-swipe').click();
  await expect(page.getByTestId('recipe-swipe')).toBeVisible();
  const card = page.getByTestId('recipe-swipe-card');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('recipe-swipe-back-1')).toBeVisible();
  // Stapel samt Knöpfen ins Bild (Karte oben am Rand, Knöpfe darunter).
  await page
    .getByTestId('recipe-swipe-remaining')
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(600);
  await shot(page, 'swipe');

  // ♥-Knopf: Herz gespeichert, nächste Karte vorne.
  const first = await frontRecipe(page);
  await page.getByTestId('recipe-swipe-like').click();
  await expect(page.getByTestId('recipe-swipe-liked')).toHaveText('1 gemerkt');
  await expect.poll(() => frontRecipe(page)).not.toBe(first);
  const prefs = ((await db(page)) as unknown as Prefs).rows.recipePreferences ?? [];
  expect(prefs).toContainEqual(expect.objectContaining({ recipe_id: first, kind: 'favorite' }));

  // Wischen nach links mit der Maus → „Nie wieder“.
  const second = await frontRecipe(page);
  const box = await card.boundingBox();
  if (box === null) throw new Error('Karte ohne Größe');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) await page.mouse.move(cx - i * 20, cy + i * 2);
  await page.mouse.up();
  await expect.poll(() => frontRecipe(page)).not.toBe(second);
  await expect
    .poll(
      async () =>
        (((await db(page)) as unknown as Prefs).rows.recipePreferences ?? []).find(
          (p) => p.recipe_id === second,
        )?.kind,
    )
    .toBe('hidden');

  // Rückgängig: Karte zurück, Vorliebe wieder weg.
  await page.getByTestId('recipe-swipe-undo').click();
  await expect.poll(() => frontRecipe(page)).toBe(second);
  await expect
    .poll(async () =>
      (((await db(page)) as unknown as Prefs).rows.recipePreferences ?? []).some(
        (p) => p.recipe_id === second,
      ),
    )
    .toBe(false);

  // Neutral-Knopf: keine Vorliebe.
  await page.getByTestId('recipe-swipe-neutral').click();
  await expect.poll(() => frontRecipe(page)).not.toBe(second);

  // Fertig → Wochenplan aktualisieren.
  await page.getByTestId('recipe-swipe-apply').click();
  await expect(page.getByTestId('recipe-swipe-message')).toContainText('eingeplant');
  await page.getByTestId('recipe-swipe-to-week').click();
  await expect(page.getByTestId('nutrition-week-swipe')).toBeVisible();
});

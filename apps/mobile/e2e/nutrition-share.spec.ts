import { expect, test, type Page } from '@playwright/test';

import { db, onboardNutrition, openNutrition, showCheckedShoppingItems } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Etappe N12 im TESTMODUS (docs/PLAN-PHASE-5.md 19.7 N12, 19.8 Nr. 8, KONZEPT 6.13): Einkaufsliste → „Weitergeben“ →
 * Vorschau des Texts (nur Produkte und Mengen, keine kcal/Gründe/Gewicht) → Hinweis VOR dem Weitergeben (Plan mit
 * Gesundheitsbezug; nach einem Zutaten-Austausch mit Nennung der Einträge, Vormerkung N9 S5) → Web Share API bzw.
 * Rückfall „Text kopieren“ bzw. „manuell“. Ohne Netz bedienbar, nichts geht an einen Server, der Gerätespeicher
 * bleibt unverändert. Feature-Flag `retail_integration` aus → kein Händler-Knopf. Beispiel-Rezepte mit TESTWERTEN.
 * Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

const MONDAY = '2026-10-12';

interface Captured {
  shares: { title?: string; text?: string }[];
  copies: string[];
}

/** Web Share API und Zwischenablage für jede Seite der Sitzung ersetzen (Chromium unter Linux hat kein share). */
async function stubShare(page: Page, mode: { share: boolean; clipboard: boolean }) {
  await page.addInitScript((m) => {
    const w = window as unknown as { __captured: Captured };
    w.__captured = { shares: [], copies: [] };
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: m.share
        ? (data: { title?: string; text?: string }) => {
            w.__captured.shares.push(data);
            return Promise.resolve();
          }
        : undefined,
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: m.share ? () => true : undefined,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: m.clipboard
        ? {
            writeText: (text: string) => {
              w.__captured.copies.push(text);
              return Promise.resolve();
            },
          }
        : undefined,
    });
  }, mode);
}

const captured = (page: Page) =>
  page.evaluate(() => (window as unknown as { __captured: Captured }).__captured);

async function start(page: Page) {
  await onboardNutrition(page); // vegetarisch, Pilze „mag ich nicht“, Meal-Prep 2× – Plan mit Gesundheitsbezug
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await openNutrition(page);
}

async function openShare(page: Page) {
  await page.getByTestId('nutrition-shopping').click();
  await expect(page.getByTestId('shopping-items')).toBeVisible();
  await page.getByTestId('shopping-share').click();
  await heading(page, 'Einkaufsliste weitergeben');
  await expect(page.getByTestId('share-preview')).toBeVisible();
}

const previewText = (page: Page) =>
  page.getByTestId('share-preview').evaluate((node) => node.textContent ?? '');

async function storage(page: Page) {
  return page.evaluate(() => ({
    local: JSON.stringify(Object.entries(window.localStorage).sort()),
    session: JSON.stringify(Object.entries(window.sessionStorage).sort()),
  }));
}

test('Weitergeben: Vorschau ohne Gesundheitsdaten, Hinweis vorher, Teilen-Dialog, Auswahl, ohne Netz, kein Händler-Knopf', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await stubShare(page, { share: true, clipboard: true });
  await start(page);
  const requests: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1')) requests.push(r.url());
  });
  await openShare(page);

  const text = await previewText(page);
  // Standard seit 23.10.2026: die nächsten 3 Tage (heute Montag + 2) – Weitergeben nimmt den angezeigten Zeitraum.
  expect(text.startsWith('Einkaufsliste 12.10.2026 – 14.10.2026\n\n')).toBe(true);
  expect(text).toMatch(/^- \d/m);
  expect(text).toContain('Vorrat (hast du wahrscheinlich da)');
  for (const word of [
    /kcal/i,
    /Unverträglich|Allergie/i,
    /70 kg|Gewicht/,
    /Abnehmen|Ziel/,
    /schwanger/i,
    /statt/,
    /https?:|www\./,
  ]) {
    expect(text).not.toMatch(word);
  }
  await expect(page.getByTestId('share-content-note')).toContainText('keine Kalorien');
  // Feature-Flag `retail_integration` ist aus → kein Händler-Knopf.
  await expect(page.getByTestId('share-retail')).toHaveCount(0);
  await expect(page.getByTestId('share-screen').getByText(/Anzeige/)).toHaveCount(0);

  // Ohne Netz bedienbar; der Gerätespeicher ändert sich durch das Weitergeben nicht.
  await page.context().setOffline(true);
  const before = await storage(page);

  // Hinweis vor dem Weitergeben – Abbrechen gibt nichts weiter.
  await page.getByTestId('share-button').click();
  await heading(page, 'Bevor du weitergibst');
  await expect(page.getByText(/deine Gesundheitsangaben berücksichtigt/)).toBeVisible();
  await expect(page.getByText(/Betrifft:/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByTestId('share-message')).toContainText('nichts weitergegeben');
  expect((await captured(page)).shares).toHaveLength(0);

  await page.getByTestId('share-button').click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.getByTestId('share-message')).toHaveText('Weitergegeben.');
  let got = await captured(page);
  expect(got.shares).toEqual([{ title: 'Einkaufsliste', text }]);
  // Gleicher Stand → Hinweis schon bestätigt.
  await page.getByTestId('share-button').click();
  await expect.poll(async () => (await captured(page)).shares.length).toBe(2);
  await expect(page.getByTestId('share-notice')).toHaveCount(0);

  // Auswahl: ohne Vorrat; mit Erledigten.
  await page.getByRole('checkbox', { name: /Vorrat mitnehmen/ }).click();
  await expect(page.getByTestId('share-preview')).not.toContainText('Vorrat');
  await page.getByRole('checkbox', { name: /Vorrat mitnehmen/ }).click();
  await expect(page.getByTestId('share-preview')).toContainText('Vorrat');

  // Bestätigung gilt nur für genau diesen Stand (Wächter N12 S3): anderer Text → Hinweis erneut.
  await page.getByRole('checkbox', { name: /Vorrat mitnehmen/ }).click();
  await page.getByTestId('share-button').click();
  await heading(page, 'Bevor du weitergibst');
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  expect((await captured(page)).shares).toHaveLength(2);
  await page.getByRole('checkbox', { name: /Vorrat mitnehmen/ }).click();
  await expect(page.getByTestId('share-preview')).toContainText('Vorrat');

  expect(await storage(page)).toEqual(before);
  await page.context().setOffline(false);
  expect(requests).toEqual([]);

  // Abhaken auf der Liste → Standard nur Offenes; „Erledigte mitnehmen“ → „(erledigt)“.
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect(page.getByTestId('shopping-items')).toBeVisible();
  await showCheckedShoppingItems(page);
  const firstId = (await page
    .locator('[data-testid^="shopping-check-"]')
    .first()
    .getAttribute('data-testid')) as string;
  const firstCheck = page.getByTestId(firstId);
  await firstCheck.click();
  await expect(firstCheck).toHaveAttribute('aria-checked', 'true');
  // „Ganze Woche“ auf der Liste → Weitergeben nimmt diesen Zeitraum.
  await page.getByTestId('shopping-range-week').click();
  await expect(page.getByTestId('shopping-range')).toContainText('12.10.2026 bis 18.10.2026');
  await expect(firstCheck).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('shopping-share').click();
  await heading(page, 'Einkaufsliste weitergeben');
  await expect(page.getByTestId('share-preview')).not.toContainText('(erledigt)');
  await page.getByRole('checkbox', { name: /Erledigte Einträge mitnehmen/ }).click();
  await expect(page.getByTestId('share-preview')).toContainText('(erledigt)');
  got = await captured(page);
  expect(got.copies).toEqual([]);
});

test('Rückfall ohne Web Share API: Text kopieren; ohne Zwischenablage manuell', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await stubShare(page, { share: false, clipboard: true });
  await start(page);
  await openShare(page);
  const text = await previewText(page);

  await page.getByTestId('share-copy').click();
  await heading(page, 'Bevor du weitergibst');
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.getByTestId('share-message')).toContainText('Text kopiert');
  expect((await captured(page)).copies).toEqual([text]);
  // „Weitergeben“ ohne Web Share API kopiert ebenfalls.
  await page.getByTestId('share-button').click();
  await expect.poll(async () => (await captured(page)).copies.length).toBe(2);

  // Ohne Zwischenablage (z. B. unsicherer Kontext) → Text zum Markieren.
  await stubShare(page, { share: false, clipboard: false });
  await page.reload();
  await heading(page, 'Einkaufsliste weitergeben');
  await page.getByTestId('share-copy').click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.getByTestId('share-message')).toContainText('Markiere den Text');
  await expect(page.getByTestId('share-preview')).toBeVisible();
});

test('Nach einem Zutaten-Austausch nennt der Hinweis die betroffenen Einträge (N9 S5)', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await stubShare(page, { share: true, clipboard: true });
  await start(page);
  interface Meal {
    slot: string;
    recipeId: string;
    isFill: boolean;
    prepKind: string;
    cookDate: string;
    ingredients: { index: number; foodId: string }[];
  }
  const row = (
    ((await db(page)).rows.mealPlans ?? []) as {
      week_start: string;
      plan: { days: { date: string; meals: Meal[] }[] };
    }[]
  ).find((p) => p.week_start === MONDAY);
  if (!row) throw new Error('Plan erwartet');
  const candidates = row.plan.days.flatMap((day) =>
    day.meals
      .filter((m) => !m.isFill && !(m.prepKind === 'leftover' && m.cookDate < MONDAY))
      .flatMap((meal) =>
        meal.ingredients
          .filter((i) => ['tofu', 'reis', 'spaghetti', 'honig'].includes(i.foodId))
          .map((ingredient) => ({ date: day.date, meal, ingredient })),
      ),
  );
  let swapped = false;
  for (const c of candidates.slice(0, 8)) {
    await page.goto(`/rezept/${c.meal.recipeId}?tag=${c.date}&platz=${c.meal.slot}`);
    await expect(page.getByTestId('recipe-ingredients')).toBeVisible();
    const button = page.getByTestId(`recipe-swap-${c.ingredient.index}`);
    if ((await button.count()) === 0) continue;
    await button.click();
    await expect(page.getByTestId('ingredient-swap')).toBeVisible();
    const option = page
      .getByTestId('ingredient-swap-options')
      .locator('[data-testid^="ingredient-swap-choose-"]')
      .first();
    if ((await option.count()) === 0) continue;
    await option.click();
    await expect(page.getByTestId('recipe-ingredients')).toContainText('(ausgetauscht)');
    swapped = true;
    break;
  }
  expect(swapped).toBe(true);

  await page.goto(`/einkaufsliste/weitergeben?woche=${MONDAY}`);
  await heading(page, 'Einkaufsliste weitergeben');
  const text = await previewText(page);
  await page.getByTestId('share-button').click();
  await heading(page, 'Bevor du weitergibst');
  const notice = page.getByTestId('share-notice');
  await expect(notice).toContainText('ausgetauschte Zutaten');
  const affected = ((await notice.getByText(/^Betrifft:/).textContent()) ?? '')
    .replace(/^Betrifft: /, '')
    .replace(/\.$/, '')
    .split(', ');
  expect(affected.length).toBeGreaterThan(0);
  for (const label of affected) expect(text).toContain(label);
  // Im Text selbst steht kein Grund und kein „statt“.
  expect(text).not.toMatch(/statt|ausgetauscht|Unverträglich/);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.getByTestId('share-message')).toHaveText('Weitergegeben.');
  expect((await captured(page)).shares.map((s) => s.text)).toEqual([text]);
});

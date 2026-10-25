import { expect, test, type Page } from '@playwright/test';

import { db, onboardNutrition, patchDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Auswärts essen (Reiter „Unterwegs“) und Vorratsschrank im TESTMODUS (Gründer-Freigabe 25.10.2026) – mit dem echten
 * Inhalts-Bündel (Lebensmittel-Katalog, Entwürfe sichtbar). Fester Start: Montag, 12.10.2026, 9 Uhr.
 * Mit SCREENSHOT_DIR entstehen Bildschirmfotos (390 px) für die Durchsicht.
 */

const shots = process.env.SCREENSHOT_DIR;
/** Bildschirmfoto mit dem Element `testId` im Blick (die Seiten scrollen intern, fullPage hilft nicht). */
async function shot(page: Page, name: string, testId?: string) {
  if (!shots) return;
  if (testId) await page.getByTestId(testId).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/${name}.png` });
}

interface StoredEntry {
  source: string;
  title_de: string;
  kcal: number | null;
  protein_g: number | null;
}
interface StoredPantry {
  food_id: string;
  count: number | null;
  pack_size: number | null;
  low: boolean;
}
interface StoredItem {
  itemKey: string;
  foodId: string | null;
  isPantry: boolean;
  isManual: boolean;
  checked: boolean;
}

const entries = async (page: Page) => ((await db(page)).rows.foodLogEntries ?? []) as StoredEntry[];
const pantry = async (page: Page) => ((await db(page)).rows.pantryItems ?? []) as StoredPantry[];

async function start(page: Page, forceDemo = false) {
  await onboardNutrition(page, { forceDemo });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
}

test('Unterwegs: Kategorie, Portion, Eintragen als Schätzwert, Zuletzt, Suche, Favorit', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await start(page);
  await page.goto('/ernaehrung/eintragen');
  await expect(page.getByTestId('food-log-entry')).toBeVisible();
  await page.getByRole('radio', { name: 'Unterwegs' }).click();
  const out = page.getByTestId('eating-out');
  await expect(out).toBeVisible();
  // Testmodus: Entwürfe sichtbar, immer mit „Schätzwert“.
  await expect(page.getByTestId('eating-out-draft-note')).toBeVisible();
  await shot(page, '01-unterwegs-start', 'eating-out');

  // Kantine → Tagesgericht mit Fleisch → groß → Eintragen.
  await page.getByTestId('eating-out-cat-kantine').click();
  const dish = page.getByTestId('eating-out-dish-auswaerts-haehnchen-reis-gemuese');
  await expect(dish).toBeVisible();
  await expect(
    page.getByTestId('eating-out-estimate-auswaerts-haehnchen-reis-gemuese'),
  ).toBeVisible();
  await expect(dish).toContainText('ca.');
  await page.getByTestId('eating-out-open-auswaerts-haehnchen-reis-gemuese').click();
  await page.getByTestId('eating-out-portion-large').click();
  await expect(page.getByTestId('eating-out-values')).toContainText('ca.');
  await shot(page, '02-unterwegs-portion', 'eating-out-form-auswaerts-haehnchen-reis-gemuese');
  await page.getByTestId('eating-out-add').click();
  await expect(page.getByTestId('food-log-entry-message')).toContainText(
    'Eingetragen: Hähnchenbrust mit Reis und Gemüse (Schätzwert).',
  );
  await expect.poll(async () => (await entries(page)).length).toBe(1);
  const [first] = await entries(page);
  expect(first).toMatchObject({ source: 'quick', title_de: 'Auswärts gegessen' });
  expect((first?.kcal ?? 0) % 10).toBe(0);
  expect(first?.kcal ?? 0).toBeGreaterThan(600);

  // „Zuletzt unterwegs“: ein Tipp trägt dieselbe Portion erneut ein.
  await page.getByTestId('eating-out-cat-all').click();
  const recent = page.getByTestId('eating-out-recent-auswaerts-haehnchen-reis-gemuese');
  await expect(recent).toContainText('groß');
  await recent.click();
  await expect.poll(async () => (await entries(page)).length).toBe(2);
  expect((await entries(page))[1]?.kcal).toBe(first?.kcal);

  // Suche mit Umlauten, Favorit merken.
  await page.getByTestId('eating-out-search').fill('käsespätzle');
  await expect(page.getByTestId('eating-out-count')).toHaveText('1 Gericht');
  await page.getByTestId('eating-out-open-auswaerts-kaesespaetzle').click();
  await page.getByTestId('eating-out-favorite').click();
  await expect(page.getByTestId('eating-out-fav-auswaerts-kaesespaetzle')).toBeVisible();
  await shot(page, '03-unterwegs-zuletzt-favorit', 'eating-out-recent');
  await page.getByTestId('eating-out-search').fill('gibt es nicht');
  await expect(page.getByTestId('eating-out-empty')).toBeVisible();
  // Gerichte ohne Werte (fehlende Zutaten im Katalog) erscheinen nicht.
  await page.getByTestId('eating-out-search').fill('Butterbrezel');
  await expect(page.getByTestId('eating-out-empty')).toBeVisible();

  // Tagesübersicht: „Auswärts gegessen“ mit „ca.“.
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('food-log')).toContainText('Auswärts gegessen');
  await expect(page.getByTestId('food-log')).toContainText('ca.');
  await shot(page, '04-tagebuch-ca', 'food-log');
});

test('Vorratsschrank: Suche, Menge in Kaufeinheiten, fast leer, Strichcode, Einkaufsliste und Kühlschrank-Suche', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await start(page);
  await page.goto('/ernaehrung/vorrat');
  await expect(page.getByTestId('pantry')).toBeVisible();
  await expect(page.getByTestId('pantry-empty')).toBeVisible();

  // Suchen und hinzufügen.
  await page.getByTestId('pantry-search').fill('Haferfl');
  await page.getByTestId('pantry-add-haferflocken').click();
  await expect(page.getByTestId('pantry-message')).toContainText('ist jetzt im Vorrat');
  await expect(page.getByTestId('pantry-amount-haferflocken')).toHaveText('da');
  await page.getByTestId('pantry-search').fill('Olivenöl');
  await page.getByTestId('pantry-add-olivenoel').click();
  await expect(page.getByTestId('pantry-count')).toHaveText('2 Lebensmittel im Vorrat');

  // Menge: 2 Packungen à 1 kg; Olivenöl hat keine Menge (Vorrat prüfen), nur „fast leer“.
  await page.getByTestId('pantry-edit-haferflocken').click();
  await page.getByTestId('pantry-more-haferflocken').click();
  await page.getByTestId('pantry-more-haferflocken').click();
  await page.getByTestId('pantry-size-1000').click();
  await expect(page.getByTestId('pantry-amount-haferflocken')).toHaveText('2 Packungen (à 1 kg)');
  await expect(page.getByTestId('pantry-edit-olivenoel')).toHaveCount(0);
  await page.getByTestId('pantry-low-olivenoel').click();
  await expect(page.getByTestId('pantry-low-badge-olivenoel')).toBeVisible();
  await expect
    .poll(async () => (await pantry(page)).find((p) => p.food_id === 'haferflocken'))
    .toMatchObject({ count: 2, pack_size: 1000, low: false });
  await expect
    .poll(async () => (await pantry(page)).find((p) => p.food_id === 'olivenoel'))
    .toMatchObject({ count: null, low: true });

  // Strichcode (Testnummer „nicht gefunden“) → Hinweis, nichts hinzugefügt.
  await page.getByTestId('pantry-scan-type').click();
  await page.getByTestId('pantry-scan-testcode-nicht_gefunden').click();
  await expect(page.getByTestId('pantry-scan-none')).toBeVisible();
  await expect.poll(async () => (await pantry(page)).length).toBe(2);
  await page.getByTestId('pantry-scan-cancel').click();
  await shot(page, '05-vorrat-liste', 'pantry-count');
  await shot(page, '06-vorrat-menge', 'pantry-amount-form-haferflocken');

  // Neu laden: alles da (Gerätespeicher, offline).
  await page.reload();
  await expect(page.getByTestId('pantry-amount-haferflocken')).toHaveText('2 Packungen (à 1 kg)');
});

test('Vorrat in Einkaufsliste („Schon im Vorrat“, fast leer, nach Einkauf aktualisieren) und Kühlschrank-Suche', async ({
  page,
}) => {
  test.setTimeout(240_000);
  // Beispiel-Inhalte (Testwerte) – mit Essensplan und Einkaufsliste.
  await start(page, true);
  // Einkaufsliste: zwei Lebensmittel der Liste in den Vorrat legen (ohne Menge = „da“).
  await page.goto('/einkaufsliste');
  await expect(page.getByTestId('shopping-items')).toBeVisible();
  // Sichtbare Einträge (Schlüssel `food_id|einheit`) – die Liste wird erst beim ersten Abhaken gespeichert.
  const keys = await page
    .locator('[data-testid^="shopping-check-"]')
    .evaluateAll((nodes) =>
      nodes.map((n) => (n.getAttribute('data-testid') ?? '').slice('shopping-check-'.length)),
    );
  const items: StoredItem[] = keys
    .filter((k) => !k.startsWith('manual|'))
    .map((itemKey) => ({
      itemKey,
      foodId: itemKey.split('|')[0] ?? null,
      isPantry: false,
      isManual: false,
      checked: false,
    }));
  expect(items.length).toBeGreaterThan(2);
  const [a, b] = items;
  expect(a && b).toBeTruthy();
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      pantryItems: [
        ...((value.rows.pantryItems ?? []) as StoredPantry[]),
        {
          food_id: a?.foodId,
          count: null,
          pack_size: null,
          low: false,
          user_id: 'x',
          updated_at: '2026-10-12T07:00:00.000Z',
        },
        {
          food_id: b?.foodId,
          count: null,
          pack_size: null,
          low: true,
          user_id: 'x',
          updated_at: '2026-10-12T07:00:00.000Z',
        },
      ],
    },
  }));
  await page.goto('/einkaufsliste');
  await expect(page.getByTestId('shopping-in-pantry')).toBeVisible();
  await page.getByTestId('shopping-in-pantry-toggle').click();
  await expect(page.getByTestId(`shopping-in-pantry-${a?.itemKey ?? ''}`)).toContainText(
    'Menge prüfen',
  );
  // „fast leer“ bleibt auf der Liste mit Hinweis.
  await expect(page.getByTestId(`shopping-second-${b?.itemKey ?? ''}`)).toContainText(
    'Vorrat fast leer',
  );
  await shot(page, '07-einkaufsliste-fast-leer', `shopping-item-${b?.itemKey ?? ''}`);
  await shot(page, '08-einkaufsliste-schon-im-vorrat', 'shopping-in-pantry');

  // Abhaken → „Vorrat nach Einkauf aktualisieren“: haltbare kommen in den Vorrat, frische bleiben draußen.
  await page.getByTestId(`shopping-check-${b?.itemKey ?? ''}`).click();
  await page.getByTestId('shopping-pantry-update').click();
  await expect(page.getByTestId('shopping-message')).toBeVisible();
  await shot(page, '09-einkaufsliste-nach-einkauf', 'shopping-message');
  await expect
    .poll(async () => (await pantry(page)).find((p) => p.food_id === b?.foodId)?.low)
    .toBeDefined();

  // Kühlschrank-Suche: Vorrat zählt mit („Passt zu deinem Vorrat“), abschaltbar.
  await page.goto('/rezepte/kuehlschrank');
  await expect(page.getByTestId('fridge-pantry')).toBeVisible();
  await expect(page.getByTestId('fridge-use-pantry')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('fridge-results')).toBeVisible();
  await expect(page.getByTestId('fridge-pantry-only')).toBeVisible();
  await expect(
    page.locator('[data-testid$="-pantry"][data-testid^="fridge-hit-"]').first(),
  ).toContainText('Aus deinem Vorratsschrank');
  await shot(page, '10-kuehlschrank-vorrat', 'fridge-pantry');
  await page.getByTestId('fridge-use-pantry').click();
  await expect(page.getByTestId('fridge-empty-selection')).toBeVisible();

  // Widerruf der Einwilligung Gesundheitsdaten löscht den Vorrat (wie in der Datenbank).
  expect((await pantry(page)).length).toBeGreaterThan(0);
});

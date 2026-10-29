import { expect, test, type Page } from '@playwright/test';

import { onboardNutrition, openNutrition, patchDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Etappe N14 im TESTMODUS (docs/PLAN-PHASE-5.md 19.7 N14, Umsetzungsstand N14): Der Wochenplan nutzt den
 * Reste-Score (Packungsgrößen aus dem Beispiel-Bestand, Testwerte), die Mahlzeit zeigt „Nutzt deinen Rest“ – ohne
 * Mengen und ohne Packungszahlen (G-N13-4/N11-G3 offen). Plan deterministisch (Neuladen = gleiche Hinweise), nichts
 * davon im Gerätespeicher oder in der Adresse, „Zahlen aus“ → weiter keine kcal. Fester Start: Montag, 12.10.2026.
 */

const MONDAY = '2026-10-12';

/** Alle Hinweise der Woche über die Tagesansicht (Mo–So): `datum|platz` → Text. */
async function collectHints(page: Page): Promise<Map<string, string>> {
  const hints = new Map<string, string>();
  for (let i = 0; i < 7; i += 1) {
    const header = (await page.getByTestId('nutrition-day-header').innerText()).trim();
    const rows = page.locator('[data-testid^="leftover-"]:not([data-testid^="leftover-short-"])');
    const count = await rows.count();
    for (let j = 0; j < count; j += 1) {
      const row = rows.nth(j);
      const id = (await row.getAttribute('data-testid')) ?? '';
      const text = (await row.innerText()).trim();
      hints.set(`${header}|${id}`, text);
      // Wächter N14 S2: Screenreader lesen den Hinweis mit (aria-label der antippbaren Mahlzeit).
      const slot = id.replace(/^leftover-/, '');
      const label = (await page.getByTestId(`meal-${slot}`).getAttribute('aria-label')) ?? '';
      expect(label).toContain(text.split('\n')[0] ?? '');
      expect(label).not.toMatch(/Entwurf|freigegeben/);
    }
    if (count > 0) await expect(page.getByTestId('nutrition-leftover-explain')).toBeVisible();
    else await expect(page.getByTestId('nutrition-leftover-explain')).toHaveCount(0);
    if (i < 6) await page.getByTestId('nutrition-next').click();
  }
  return hints;
}

async function storageText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const dump = (s: Storage) =>
      Array.from({ length: s.length }, (_, i) => {
        const key = s.key(i) ?? '';
        return `${key}=${s.getItem(key) ?? ''}`;
      }).join('\n');
    return `${dump(window.localStorage)}\n${dump(window.sessionStorage)}`;
  });
}

test('„Nutzt deinen Rest“: ohne Mengen, deterministisch, nicht gespeichert; Wochenansicht; Zahlen aus', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await onboardNutrition(page);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await openNutrition(page);

  const first = await collectHints(page);
  // Der Beispiel-Bestand erzeugt in dieser Woche Hinweise (sonst prüfte der Test nichts).
  expect(first.size).toBeGreaterThan(0);
  for (const text of first.values()) {
    expect(text).toMatch(/^Nutzt deinen Rest: /);
    // Keine Mengen und keine Packungszahlen – nur Lebensmittel und Anbruchstag.
    expect(text.split('\n')[0]).not.toMatch(/\d/);
    expect(text).not.toMatch(/Packungen|\bg\b|kcal/);
    // Keine Freigabe-Kennzeichnung der Packungsgröße (Gründer-Entscheidung 27.10.2026).
    expect(text).not.toMatch(/Entwurf|freigegeben/);
  }
  // Vegetarische Person ohne empfindliche Lebensmittel mit Packungsgröße: kein Lagerhinweis „nur bis zum Folgetag“.
  // (Ein Fleisch-Fall ist mit den Beispiel-Daten nicht erreichbar – Wächter N14 H8, abgedeckt in core/App-Vitest.)
  await expect(page.locator('[data-testid^="leftover-short-"]')).toHaveCount(0);

  // Nichts davon im Gerätespeicher oder in der Adresse.
  const stored = await storageText(page);
  expect(stored).not.toMatch(/Nutzt deinen Rest|leftoverHints|packageReviewed|openedOn/);
  expect(page.url()).not.toMatch(/rest|leftover|packung/i);

  // Deterministisch: nach dem Neuladen dieselben Hinweise.
  await page.goto(`/ernaehrung?tag=${MONDAY}`);
  await expect(page.getByTestId('nutrition-meals')).toBeVisible();
  const second = await collectHints(page);
  expect([...second.entries()]).toEqual([...first.entries()]);

  // Wochenansicht: kurzer Vermerk an denselben Mahlzeiten.
  await page.goto(`/ernaehrung/woche?woche=${MONDAY}`);
  await expect(page.getByTestId('nutrition-week')).toBeVisible();
  await expect(page.getByText(/nutzt einen Rest/)).toHaveCount(first.size);
  // Vorlesetext in der Wochenansicht enthält den vollständigen Hinweis (S2).
  await expect(page.locator('[aria-label*="Nutzt deinen Rest: "]')).toHaveCount(first.size);

  // „Kalorienzahlen anzeigen“ aus → Hinweise bleiben, nirgends kcal.
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: {
        ...(value.rows.nutritionSetup as Record<string, unknown>),
        show_energy_numbers: false,
      },
    },
  }));
  await page.goto(`/ernaehrung?tag=${MONDAY}`);
  await expect(page.getByTestId('nutrition-meals')).toBeVisible();
  const hidden = await collectHints(page);
  expect([...hidden.entries()]).toEqual([...first.entries()]);
  await expect(page.getByText(/kcal/)).toHaveCount(0);
});

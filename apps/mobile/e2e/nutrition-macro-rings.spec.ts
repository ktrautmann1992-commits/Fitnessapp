import { expect, test, type Page } from '@playwright/test';

import { onboardNutrition, openNutrition, patchDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Makro-Ringe in der Tagesübersicht Ernährung (Gründer-Wunsch 23.10.2026): drei Ringe füllen sich bis zum Tagesziel;
 * über dem Ziel wird der Ring voll und rot, dazu dunkelrote Plakette „über dem Ziel“ und Ansage in Worten. Gleiche
 * Regel auf der Übersicht (kleine Ringe in der Kachel „Ernährung heute“). Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

async function quickEntry(page: Page, kcal: string) {
  await page.getByRole('radio', { name: 'Schnell' }).click();
  await page.getByRole('radio', { name: 'Mahlzeit', exact: true }).click();
  await page.getByTestId('food-log-quick-kcal').fill(kcal);
  await page.getByTestId('food-log-quick-add').click();
  await expect(page.getByTestId('food-log-entry-message')).toHaveText('Eingetragen: Mahlzeit');
  await page.getByTestId('food-log-done').click();
}

test('Makro-Ringe: normal in Makro-Farbe, Eiweiß über dem Ziel dunkelrot mit Worten', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await onboardNutrition(page);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await openNutrition(page);

  // Ausgangslage: Hero-Karte, drei Ringe bei 0 %, nichts „über dem Ziel“.
  await expect(page.getByTestId('nutrition-overview')).toBeVisible();
  for (const macro of ['carbs', 'protein', 'fat']) {
    await expect(page.getByTestId(`nutrition-macro-${macro}`)).toContainText('0 %');
    await expect(page.getByTestId(`nutrition-macro-${macro}-over`)).toHaveCount(0);
  }
  await expect(page.getByTestId('nutrition-ring-over')).toHaveCount(0);

  // Ein Eintrag; danach Nährwerte so setzen, dass nur Eiweiß über dem Ziel liegt.
  await page.getByTestId('meal-card-add-breakfast').click();
  await quickEntry(page, '400');
  await patchDb(page, (value) => {
    const entries = (value.rows.foodLogEntries as Record<string, unknown>[]).map((entry) => ({
      ...entry,
      protein_g: 400,
      carbs_g: 20,
      fat_g: 5,
    }));
    return { ...value, rows: { ...value.rows, foodLogEntries: entries } };
  });
  await openNutrition(page);

  const protein = page.getByTestId('nutrition-macro-protein');
  await expect(protein).toHaveAttribute(
    'aria-label',
    /^Eiweiß: 400 von \d+ Gramm gegessen, über dem Ziel$/,
  );
  await expect(page.getByTestId('nutrition-macro-protein-over')).toHaveText('über dem Ziel');
  // Dunkelrote Plakette (#991B1B) mit weißer Schrift; Wert in hellem Rot (#FCA5A5) – auf der dunklen Karte lesbar.
  await expect(page.getByTestId('nutrition-macro-protein-over')).toHaveCSS(
    'background-color',
    'rgb(153, 27, 27)',
  );
  await expect(page.getByTestId('nutrition-macro-protein-value')).toHaveCSS(
    'color',
    'rgb(252, 165, 165)',
  );
  // Kohlenhydrate und Fett bleiben unter dem Ziel: keine Plakette, Ansage ohne „über dem Ziel“.
  for (const macro of ['carbs', 'fat']) {
    await expect(page.getByTestId(`nutrition-macro-${macro}-over`)).toHaveCount(0);
    await expect(page.getByTestId(`nutrition-macro-${macro}`)).toHaveAttribute(
      'aria-label',
      /Gramm gegessen$/,
    );
  }
  // kcal: 400 liegt unter dem Tagesziel → kein Rot am großen Ring.
  await expect(page.getByTestId('nutrition-ring-over')).toHaveCount(0);

  // Übersicht: kleine Makro-Ringe mit derselben Regel.
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-nutrition-macro-protein')).toHaveAttribute(
    'aria-label',
    /über dem Ziel$/,
  );
  await expect(page.getByTestId('overview-nutrition-macro-carbs')).toHaveAttribute(
    'aria-label',
    /Gramm gegessen$/,
  );
});

import { expect, test } from '@playwright/test';

import { onboardNutrition, openNutrition } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Testphase (Gründer-Entscheidung 19.10.2026, docs/PLAN-PHASE-5.md „Nachtrag Testphase“) im TESTMODUS: Beispiel-
 * Inhalte als „freigegeben, nicht fachlich geprüft“ – so, wie sie aus der Datenbank kommen. Seit der Gründer-
 * Entscheidung 27.10.2026 (privater Nutzerkreis, höchstens 5 Personen) zeigt die App dazu KEIN Kennzeichen mehr:
 * Rezeptsuche, Rezeptansicht, Kühlschrank-Suche und Ratgeber ohne „Testphase“, ohne „Entwurf“, ohne Allergen-Hinweis
 * „nicht fachlich geprüft“. Ratgeber mit Dosierungs-Befund (R21H) bleiben ohne Fachprüfung Entwurf (Freigabe-Regel).
 * Gegenprobe: Entwürfe (normaler Testmodus) behalten „Entwurf“ und den Allergen-Hinweis für Entwürfe.
 * Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

test('Testphase: Suche, Rezeptansicht, Kühlschrank und Ratgeber ohne Prüf-Kennzeichen', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await onboardNutrition(page, { testphase: true });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await openNutrition(page);

  // Suche: kein Kennzeichen an den Treffern.
  await page.getByTestId('nutrition-recipe-search').click();
  await expect(page.getByTestId('recipe-search')).toBeVisible();
  const hit = page.getByTestId('recipe-search-hit-overnight-oats');
  await expect(hit).toBeVisible();
  await expect(page.getByTestId('recipe-search-hit-overnight-oats-testphase')).toHaveCount(0);
  await expect(hit).not.toHaveAttribute('aria-label', /Testphase|fachlich geprüft/);
  await expect(hit).not.toContainText('Entwurf');

  // Rezeptansicht: kein Hinweis, keine Entwurfs-Kennzeichen, keine Allergen-Warnung für Entwürfe.
  await hit.click();
  await expect(page.getByTestId('recipe')).toBeVisible();
  await expect(page.getByTestId('recipe-ingredients')).toBeVisible();
  await expect(page.getByTestId('recipe-testphase')).toHaveCount(0);
  await expect(page.getByTestId('recipe-ai-draft')).toHaveCount(0);
  await expect(page.getByTestId('recipe-allergen-warning')).toHaveCount(0);
  await expect(page.getByTestId('recipe')).not.toContainText(/fachlich geprüft|Testphase|Entwurf/);

  // Kühlschrank-Suche: keine Warnung.
  await page.goto('/rezepte/kuehlschrank');
  await expect(page.getByTestId('fridge-search')).toBeVisible();
  await page
    .getByTestId('fridge-search')
    .getByRole('checkbox', { name: 'Banane', exact: true })
    .click();
  await expect(page.getByTestId('fridge-results')).toBeVisible();
  await expect(page.getByTestId('fridge-testphase-warning')).toHaveCount(0);
  await expect(page.getByTestId('fridge-draft-warning')).toHaveCount(0);

  // Ratgeber-Liste: kein Kennzeichen; demo-wettkampf bleibt Entwurf (R21H, s. u.).
  await page.goto('/ratgeber');
  await expect(page.getByTestId('guide-list')).toBeVisible();
  await expect(page.getByTestId('guide-testphase-demo-unterwegs')).toHaveCount(0);

  // Ratgeber ohne Dosierungs-Befund: weder „Testphase“ noch „Entwurf“.
  await page.goto('/ratgeber/demo-unterwegs');
  await expect(page.getByTestId('guide')).toBeVisible();
  await expect(page.getByTestId('guide-testphase')).toHaveCount(0);
  await expect(page.getByTestId('guide-draft')).toHaveCount(0);

  // Ratgeber mit Dosierungs-Befund (R21H) wird ohne Fachprüfung NICHT freigegeben (Wächter H1): bleibt Entwurf.
  await page.goto('/ratgeber/demo-wettkampf');
  await expect(page.getByTestId('guide')).toBeVisible();
  await expect(page.getByTestId('guide-draft')).toHaveText('Entwurf');
  await expect(page.getByTestId('guide-testphase')).toHaveCount(0);
});

test('Gegenprobe: normaler Testmodus (Entwürfe) behält „Entwurf“ und Allergen-Hinweis', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await onboardNutrition(page);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await openNutrition(page);
  await page.goto('/rezept/overnight-oats');
  await expect(page.getByTestId('recipe')).toBeVisible();
  await expect(page.getByTestId('recipe-allergen-warning')).toBeVisible();
  await expect(page.getByTestId('recipe-testphase')).toHaveCount(0);
  await page.goto('/ratgeber/demo-wettkampf');
  await expect(page.getByTestId('guide-draft')).toBeVisible();
  await expect(page.getByTestId('guide-testphase')).toHaveCount(0);
});

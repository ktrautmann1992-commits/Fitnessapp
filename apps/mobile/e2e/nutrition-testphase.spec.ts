import { expect, test } from '@playwright/test';

import { onboardNutrition, openNutrition } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Testphase (Gründer-Entscheidung 19.10.2026, docs/PLAN-PHASE-5.md „Nachtrag Testphase“) im TESTMODUS: Beispiel-
 * Inhalte als „freigegeben, nicht fachlich geprüft“ – so, wie sie in der Testphase aus der Datenbank kommen. Rezept-
 * suche mit kleinem Kennzeichen, Rezeptansicht und Ratgeber mit dezentem Hinweis „Testphase – noch nicht fachlich
 * geprüft“; kein „KI-Entwurf“/„Entwurf“. Ratgeber mit Dosierungs-Befund (R21H) bleiben ohne Fachprüfung Entwurf. Gegenprobe: Entwürfe (normaler Testmodus) ohne Testphase-Hinweis.
 * Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

test('Testphase: Suche gekennzeichnet, Rezeptansicht und Ratgeber mit Hinweis', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await onboardNutrition(page, { testphase: true });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await openNutrition(page);

  // Suche: kleines Kennzeichen an den Treffern.
  await page.getByTestId('nutrition-recipe-search').click();
  await expect(page.getByTestId('recipe-search')).toBeVisible();
  const hit = page.getByTestId('recipe-search-hit-overnight-oats');
  // Kleines Kennzeichen „Testphase“ (24.10.2026); ausgeschrieben im Namen für Bildschirmleser.
  await expect(page.getByTestId('recipe-search-hit-overnight-oats-testphase')).toHaveText(
    'Testphase',
  );
  await expect(hit).toHaveAttribute('aria-label', /Testphase – nicht fachlich geprüft/);
  await expect(hit).not.toContainText('Entwurf');

  // Rezeptansicht: dezenter Hinweis, keine Entwurfs-Kennzeichen.
  await hit.click();
  await expect(page.getByTestId('recipe')).toBeVisible();
  await expect(page.getByTestId('recipe-testphase')).toHaveText(
    'Testphase – noch nicht fachlich geprüft',
  );
  await expect(page.getByTestId('recipe-ai-draft')).toHaveCount(0);
  await expect(page.getByTestId('recipe')).not.toContainText(
    'Entwurf – fachlich noch nicht geprüft',
  );
  await expect(page.getByTestId('recipe-ingredients')).toBeVisible();
  // Wächter M2 (sichere Variante): Allergen-Warnung auch ohne Fachprüfung in der Testphase.
  await expect(page.getByTestId('recipe-allergen-warning')).toHaveText(
    'Allergene noch nicht fachlich geprüft – bei Allergien bitte nicht verwenden.',
  );

  // Kühlschrank-Suche: Treffer ohne Fachprüfung → Allergen-Warnung (Wächter M2, sichere Variante).
  await page.goto('/rezepte/kuehlschrank');
  await expect(page.getByTestId('fridge-search')).toBeVisible();
  await page
    .getByTestId('fridge-search')
    .getByRole('checkbox', { name: 'Banane', exact: true })
    .click();
  await expect(page.getByTestId('fridge-results')).toBeVisible();
  await expect(page.getByTestId('fridge-testphase-warning')).toHaveText(
    'Testphase: Allergene noch nicht fachlich geprüft – bei Allergien bitte nicht verwenden.',
  );
  await expect(page.getByTestId('fridge-draft-warning')).toHaveCount(0);

  // Ratgeber-Liste: Kennzeichen „Testphase“ (Wächter N1); demo-wettkampf bleibt Entwurf (R21H, s. u.).
  await page.goto('/ratgeber');
  await expect(page.getByTestId('guide-list')).toBeVisible();
  await expect(page.getByTestId('guide-testphase-demo-unterwegs')).toHaveText(
    'Testphase – noch nicht fachlich geprüft',
  );
  await expect(page.getByTestId('guide-testphase-demo-wettkampf')).toHaveCount(0);

  // Ratgeber ohne Dosierungs-Befund: Hinweis „Testphase“ statt „Entwurf“.
  await page.goto('/ratgeber/demo-unterwegs');
  await expect(page.getByTestId('guide')).toBeVisible();
  await expect(page.getByTestId('guide-testphase')).toHaveText(
    'Testphase – noch nicht fachlich geprüft',
  );
  await expect(page.getByTestId('guide-draft')).toHaveCount(0);

  // Ratgeber mit Dosierungs-Befund (R21H) wird in der Testphase NICHT ohne Fachprüfung freigegeben (Wächter H1):
  // im Testmodus bleibt er Entwurf.
  await page.goto('/ratgeber/demo-wettkampf');
  await expect(page.getByTestId('guide')).toBeVisible();
  await expect(page.getByTestId('guide-draft')).toBeVisible();
  await expect(page.getByTestId('guide-testphase')).toHaveCount(0);
});

test('Gegenprobe: normaler Testmodus (Entwürfe) zeigt keinen Testphase-Hinweis', async ({
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

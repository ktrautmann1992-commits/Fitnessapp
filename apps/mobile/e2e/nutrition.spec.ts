import { expect, test } from '@playwright/test';

import { DEMO_KEY, db, onboardNutrition, openNutrition, patchDb } from './nutrition-helpers';
import { completeNutritionSetup, expandNotices, heading } from './plan-helpers';

/**
 * Ernährung im TESTMODUS (docs/PLAN-PHASE-5.md 8, 13 N4, 15): Onboarding mit Schritt „Alltag und Training“ → Ziel
 * sichtbar → Rezept öffnen → Kalorienzahlen ausblenden; Widerruf mit Angebot „mag ich nicht“ (7.4, W12) und ohne
 * Zustimmung (R2-K4: nichts behalten); kein Gesundheits-Check → Hinweis; Zustände (keine Rezepte, Beispiel-Rezepte,
 * Einrichtung fehlt, Schwangerschaft ohne Zahlen, ohne Einwilligung).
 *
 * Solange der echte Lebensmittel-Katalog fehlt (Workflow foods-import läuft), nutzen die Tests die Beispiel-Rezepte
 * mit TESTWERTEN aus `@fitnessapp/core/demo-nutrition` (gekennzeichnet). Fester Tag: Montag, 12.10.2026, 9 Uhr.
 */

test('Onboarding → Ziel sichtbar → Rezept öffnen → Kalorienzahlen ausblenden (N4-DoD)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await onboardNutrition(page);
  // „Fertig“: kurze Ernährungs-Zusammenfassung (8.1) – Trainingstag höher als Ruhetag.
  const range = /Trainingstag ca\. [\d.]+(–[\d.]+)? kcal/;
  await expect(page.getByTestId('done-nutrition')).toContainText(range);
  await expect(page.getByTestId('done-nutrition')).toContainText(
    /Ruhetag ca\. [\d.]+(–[\d.]+)? kcal/,
  );
  const doneText = (await page.getByTestId('done-nutrition').innerText()).replace(/\./g, '');
  const training = Number(/Trainingstag ca (\d+)/.exec(doneText)?.[1]);
  const trainingMax = Number(/Trainingstag ca \d+(?:–(\d+))?/.exec(doneText)?.[1] ?? training);
  const rest = Number(/Ruhetag ca (\d+)/.exec(doneText)?.[1]);
  expect(training).toBeGreaterThan(rest);

  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  // Kachel „Ernährung heute“ auf „Heute“ (bis 26.10.2026 Karte „Essen heute“ im Training): Tagesziel (Montag =
  // Trainingstag), Kennzeichnung der Testwerte (K2).
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-nutrition')).toBeVisible();
  await expect(page.getByTestId('overview-nutrition-demo')).toBeVisible();
  const todayText = (await page.getByTestId('overview-nutrition-target').innerText()).replace(
    /\./g,
    '',
  );
  const todayTarget = Number(/Tagesziel: (\d+) kcal/.exec(todayText)?.[1]);
  expect(todayTarget).toBeGreaterThanOrEqual(training);
  expect(todayTarget).toBeLessThanOrEqual(trainingMax);

  await openNutrition(page);
  await expect(page.getByTestId('nutrition-target')).toContainText('Tagesziel');
  await expect(page.getByTestId('nutrition-macros')).toBeVisible();
  await expect(page.getByText('Schätzung – ±10 % sind normal.').first()).toBeVisible();
  // Abends trainieren → Abendessen „nach dem Training“ (4.8); Entwürfe gekennzeichnet (K6).
  await expect(page.getByTestId('meal-dinner')).toContainText('nach dem Training');
  await expandNotices(page, 'nutrition-notice-line');
  await expect(page.getByTestId('nutrition-plan-notice-drafts_allergens_unreviewed')).toBeVisible();
  await expect(page.getByTestId('nutrition-day')).not.toContainText(/Champignon|Pilz-/);

  // Zurück zu „Heute“: nächste Mahlzeit um 9 Uhr ist das Mittagessen.
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-nutrition-next')).toContainText('Mittagessen');

  // Rezept öffnen (aus dem Plan): Portion, „Enthält“, Allergen-Warnung, Nährwerte.
  await page.getByTestId('overview-nutrition-open').click();
  await page.getByTestId('meal-lunch').click();
  await expect(page.getByTestId('recipe')).toBeVisible();
  await expect(page.getByTestId('recipe-allergen-warning')).toHaveText(
    'Entwurf: Allergen-Angaben noch nicht freigegeben – bei Allergien bitte nicht verwenden.',
  );
  await expect(page.getByTestId('recipe-portion')).toContainText('Deine Portion');
  await expect(page.getByTestId('recipe-contains')).toContainText('Enthält');
  await expect(page.getByTestId('recipe-nutrients')).toContainText('kcal');
  await expect(page.getByTestId('recipe-ingredients')).not.toContainText(
    /Champignon|Hackfleisch|Lachs/,
  );
  await expect(page.getByText(/Prüfe die Zutatenliste der gekauften Produkte/)).toBeVisible();

  // Einstellungen → „Kalorienzahlen anzeigen“ aus → nirgends mehr kcal (Gründer-Entscheidung 3, 16 B (h)).
  await page.goto('/settings?thema=ernaehrung');
  await expect(page.getByRole('heading', { level: 1, name: 'Ernährung' })).toBeVisible();
  const numbers = page.getByTestId('settings-show-numbers');
  await expect(numbers).toHaveAttribute('aria-checked', 'true');
  await numbers.click();
  await expect(numbers).toHaveAttribute('aria-checked', 'false');
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('nutrition-numbers-hidden')).toBeVisible();
  await expect(page.getByTestId('nutrition-meals')).toBeVisible();
  await expect(page.getByTestId('nutrition-day')).not.toContainText('kcal');
  await expect(page.getByTestId('nutrition-macros')).toHaveCount(0);
  await page.getByTestId('meal-lunch').click();
  await expect(page.getByTestId('recipe')).toBeVisible();
  await expect(page.getByTestId('recipe')).not.toContainText('kcal');
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-nutrition')).toBeVisible();
  await expect(page.getByTestId('overview-nutrition')).not.toContainText('kcal');
  await expect((await db(page)).rows.nutritionSetup).toMatchObject({ show_energy_numbers: false });
});

test('Widerruf mit Angebot: Unverträglichkeit → „mag ich nicht“, „mag ich“ ersetzt, Plan ohne Ziel (7.4, W12)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await onboardNutrition(page, { peanutIntolerance: true });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await page.goto('/settings?thema=konto');
  await page.getByRole('button', { name: 'Gesundheitsdaten: Widerrufen' }).click();
  const dialog = page.getByTestId('dialog-revoke');
  await expect(dialog).toContainText('Deine Unverträglichkeiten werden gelöscht');
  await expect(dialog).toContainText('auch deine eigenen Einträge darin');
  const convert = page.getByTestId('revoke-convert');
  // Aktive Wahl – nicht vorausgewählt.
  await expect(convert).toHaveAttribute('aria-checked', 'false');
  await convert.click();
  await page.getByRole('button', { name: 'Tagebuch behalten (empfohlen)' }).click();
  await expect(page.getByText(/stehen jetzt unter „mag ich nicht“/)).toBeVisible();

  const prefs = (await db(page)).rows.foodPreferences.map((p) => `${p.food_group}:${p.kind}`);
  expect(prefs.sort()).toEqual(['mushrooms:dislike', 'peanuts:dislike']);

  // Ernährung danach ohne Kalorienziel, mit Einladung zur Einwilligung.
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
  await expandNotices(page, 'nutrition-notice-line');
  await expect(page.getByTestId('nutrition-notice-no_health_data_consent')).toBeVisible();
  await expect(page.getByTestId('nutrition-action-consent')).toBeVisible();
  await expect(page.getByTestId('nutrition-target')).toHaveCount(0);
});

test('Widerruf ohne Zustimmung zur Umwandlung: keine Unverträglichkeit bleibt gespeichert (R2-K4)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await onboardNutrition(page, { peanutIntolerance: true });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await page.goto('/settings?thema=konto');
  await page.getByRole('button', { name: 'Gesundheitsdaten: Widerrufen' }).click();
  await expect(page.getByTestId('revoke-convert')).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Tagebuch behalten (empfohlen)' }).click();
  await expect(
    page.getByText('Einwilligung widerrufen. Deine Gesundheitsdaten wurden gelöscht.'),
  ).toBeVisible();
  const prefs = (await db(page)).rows.foodPreferences.map((p) => `${p.food_group}:${p.kind}`);
  // „mag ich“ Erdnüsse bleibt (Geschmack), die Unverträglichkeit ist weg und wurde nirgends zwischengespeichert.
  expect(prefs.sort()).toEqual(['mushrooms:dislike', 'peanuts:like']);
  const everything = await page.evaluate(() => JSON.stringify(window.localStorage));
  expect(everything).not.toContain('intolerance');
  const session = await page.evaluate(() => JSON.stringify(window.sessionStorage));
  expect(session).not.toContain('intolerance');
});

test('kein Gesundheits-Check → Hinweis + Knopf, ohne Defizit (B4); Schwangerschaft → ohne Zahlen (B5)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await onboardNutrition(page);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  // Check entfernen (z. B. neue Fassung, Abbruch) → vorsichtig, Hinweis „Gesundheits-Check machen“.
  await patchDb(page, (value) => ({ ...value, rows: { ...value.rows, healthScreenings: [] } }));
  await page.goto('/ernaehrung');
  await expandNotices(page, 'nutrition-notice-line');
  await expect(page.getByTestId('nutrition-notice-health_check_missing')).toBeVisible();
  await expect(page.getByTestId('nutrition-action-check')).toBeVisible();
  await expect(page.getByTestId('nutrition-target')).toBeVisible();

  // Schwangerschaft (Flag aus dem Check) → keine Kalorienzahl, Hinweis Ärztin/Arzt/Hebamme, Check aktualisieren.
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      healthScreenings: [
        {
          id: 'hs-test',
          user_id: (value.rows.profile as { user_id: string }).user_id,
          answers: {},
          flags: ['pregnancy'],
          medical_notice_acknowledged_at: '2026-10-12T07:00:00.000Z',
          created_at: '2026-10-12T07:00:00.000Z',
        },
      ],
    },
  }));
  await page.goto('/ernaehrung');
  await expandNotices(page, 'nutrition-notice-line');
  await expect(page.getByTestId('nutrition-notice-pregnancy_no_targets')).toBeVisible();
  await expect(page.getByTestId('nutrition-notice-pregnancy_caffeine')).toBeVisible();
  await expect(page.getByTestId('nutrition-action-check-update')).toBeVisible();
  await expect(page.getByTestId('nutrition-target')).toHaveCount(0);
  await expect(page.getByText('Vorschlag ohne Zahlen')).toBeVisible();
  // K1: auch per Deep-Link keine kcal im Rezept.
  await page.goto('/rezept/porridge-banane');
  await expect(page.getByTestId('recipe-ingredients')).toBeVisible();
  await expect(page.getByTestId('recipe')).not.toContainText('kcal');
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-nutrition')).toBeVisible();
  await expect(page.getByTestId('overview-nutrition-target')).toHaveCount(0);
});

test('Zustände: Einrichtung fehlt (bestehende Testerinnen), keine Rezepte, Beispiel-Rezepte ein/aus, Rezept passt nicht', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await onboardNutrition(page, { forceDemo: false });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  // Vor N4 eingerichtete Konten haben noch keine Antworten → einmalig beim Öffnen der Ernährung.
  await patchDb(page, (value) => ({ ...value, rows: { ...value.rows, nutritionSetup: null } }));
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-nutrition')).toContainText('Richte deine Ernährung ein');
  await page.getByTestId('overview-nutrition').click();
  await completeNutritionSetup(page, {
    activity: /^Körperlich schwere Arbeit/,
    time: 'Früh (vor 8 Uhr)',
  });
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
  // Frühtraining: Hinweis zum Frühstück (Montag ist Trainingstag).
  await expandNotices(page, 'nutrition-notice-line');
  await expect(page.getByTestId('nutrition-notice-early_training')).toBeVisible();
  // Noch keine Rezepte im Bündel → Angebot; mit Beispiel-Rezepten → gekennzeichnet; wieder aus → leer. Hat das Bündel
  // schon echte Rezepte (nach foods-import/alpha5-import), gibt es das Angebot nicht – dann erzwingen (K7).
  const emptyBundle = (await page.getByTestId('nutrition-demo-use').count()) > 0;
  if (emptyBundle) {
    await page.getByTestId('nutrition-demo-use').click();
  } else {
    await page.evaluate(
      (key) => window.localStorage.setItem(key, JSON.stringify('force')),
      DEMO_KEY,
    );
    await page.goto('/ernaehrung');
  }
  await expect(page.getByTestId('nutrition-demo-banner')).toBeVisible();
  // Tag blättern.
  await expect(page.getByTestId('nutrition-prev')).toBeDisabled();
  await page.getByTestId('nutrition-next').click();
  await expect(page.getByTestId('nutrition-day-header')).toContainText('Dienstag');
  // Rezept, das nicht passt (Fleisch bei vegetarisch), wird nie angezeigt – ohne Grund.
  await page.goto('/rezept/hack-spaghetti');
  await expect(page.getByTestId('recipe-not-for-you')).toBeVisible();
  await expect(page.getByTestId('recipe')).not.toContainText('Hackfleisch');
  await page.goto('/ernaehrung');
  await expandNotices(page, 'nutrition-notice-line');
  await page.getByTestId('nutrition-demo-off').click();
  await expect(page.getByTestId('nutrition-demo-banner')).toHaveCount(0);
  if (emptyBundle) await expect(page.getByTestId('nutrition-demo-use')).toBeVisible();
});

test('B1: veraltete Einwilligung + gespeicherte Unverträglichkeit → kein Plan, kein Rezept (auch per Deep-Link)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await onboardNutrition(page, { peanutIntolerance: true });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  // Neue Fassung der Einwilligung: die gespeicherte gilt als veraltet, die Unverträglichkeit bleibt gespeichert.
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      consents: (value.rows.consents as { consent_type: string; version: number }[]).map((c) =>
        c.consent_type === 'health_data' ? { ...c, version: 0 } : c,
      ),
    },
  }));
  expect((await db(page)).rows.foodPreferences).toContainEqual(
    expect.objectContaining({ food_group: 'peanuts', kind: 'intolerance' }),
  );
  await page.goto('/rezept/erdnuss-banane');
  await expect(page.getByTestId('nutrition-consent-blocked')).toBeVisible();
  await expect(page.getByTestId('recipe')).not.toContainText('Erdnüsse');
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('nutrition-consent-blocked')).toBeVisible();
  await expect(page.getByTestId('nutrition-meals')).toHaveCount(0);
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-nutrition')).toContainText(
    'Für deinen Essensplan fehlt gerade etwas',
  );
  await page.goto('/ernaehrung');
  // NK1: veraltet → „Neue Fassung bestätigen“; seit N7 Teil 2 (Wächter N7 H3) zusätzlich „Unverträglichkeiten
  // löschen“ – klarer Zustand „Einwilligung erneuern oder Unverträglichkeiten löschen“.
  await expect(page.getByTestId('nutrition-consent-blocked-button')).toHaveText(
    'Neue Fassung bestätigen',
  );
  await expect(page.getByTestId('nutrition-delete-intolerances')).toBeVisible();
  await page.getByTestId('nutrition-consent-blocked-button').click();
  await expect(page).toHaveURL(/health-consent/);
});

test('NK1/NK2: Einwilligung fehlt, Unverträglichkeit noch gespeichert → erteilen oder löschen (mit Bestätigung)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await onboardNutrition(page, { peanutIntolerance: true });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  // Alt-Stand: Einwilligung widerrufen, Unverträglichkeit aber noch gespeichert.
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      consents: (value.rows.consents as { consent_type: string; revoked_at: string | null }[]).map(
        (c) =>
          c.consent_type === 'health_data' ? { ...c, revoked_at: '2026-10-12T07:00:00.000Z' } : c,
      ),
    },
  }));
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('nutrition-consent-blocked')).toContainText(
    'Erteile die Einwilligung oder lösche die gespeicherten Unverträglichkeiten',
  );
  await expect(page.getByTestId('nutrition-consent-blocked-button')).toHaveText(
    'Einwilligung erteilen',
  );
  await page.getByTestId('nutrition-delete-intolerances').click();
  const dialog = page.getByTestId('dialog-delete-intolerances');
  await expect(dialog).toContainText('endgültig gelöscht');
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  expect(JSON.stringify((await db(page)).rows.foodPreferences)).toContain('intolerance');
  await page.getByTestId('nutrition-delete-intolerances').click();
  await page
    .getByTestId('dialog-delete-intolerances')
    .getByRole('button', { name: 'Löschen' })
    .click();
  await expect(page.getByTestId('nutrition-consent-blocked')).toHaveCount(0);
  await expect(page.getByTestId('nutrition-meals')).toBeVisible();
  const everything = await page.evaluate(() => JSON.stringify(window.localStorage));
  expect(everything).not.toContain('intolerance');
});

import { expect, test, type Page } from '@playwright/test';

import { onboardNutrition, patchDb } from './nutrition-helpers';
import { heading, next } from './plan-helpers';

/**
 * Ziele · Etappe Z4 (docs/PLAN-ZIELE.md 6 und 7 Z4): Haupt- und Nebenziel, konkretes Abnehmziel mit
 * Planbarkeits-Ampel. Testmodus, Web-Export, Handy-Ansicht. Fester Tag: Montag, 12.10.2026 – Geburtsdatum
 * 01.09.1991 (35 J.), damit die Person genau Beispiel A aus Plan 3.3 ist (Mann, 180 cm, 90 kg, Alltag 1,45).
 */

const MONDAY = new Date('2026-10-12T09:00:00+02:00');

async function onboardToGoal(page: Page, options: { consent: boolean }) {
  await page.clock.setFixedTime(MONDAY);
  await page.goto('/');
  await page.getByRole('button', { name: "Los geht's" }).click();
  await page.getByLabel('Geburtsdatum: Tag').fill('01');
  await page.getByLabel('Geburtsdatum: Monat').fill('09');
  await page.getByLabel('Geburtsdatum: Jahr').fill('1991');
  await next(page);
  await page.getByRole('button', { name: 'Testmodus starten' }).click();
  await page.getByRole('checkbox', { name: 'Ich akzeptiere die Nutzungsbedingungen.' }).click();
  await page.getByRole('checkbox', { name: 'Ich habe die Datenschutzerklärung gelesen.' }).click();
  await page.getByRole('button', { name: 'Zustimmen und weiter' }).click();
  await heading(page, 'Dein Geschlecht');
  await page.getByRole('radio', { name: 'männlich' }).click();
  await next(page);
  if (options.consent) {
    await page.getByRole('checkbox', { name: /Ich willige/ }).click();
    await page.getByRole('button', { name: 'Einwilligen und weiter' }).click();
    await heading(page, 'Körperdaten');
    await page.getByLabel('Größe in cm').fill('180');
    await page.getByLabel('Gewicht in kg').fill('90');
    await next(page);
    await page.getByRole('button', { name: 'Überspringen' }).click();
    await heading(page, 'Gesundheits-Check');
    const groups = page.getByRole('radiogroup');
    const count = await groups.count();
    for (let i = 0; i < count; i += 1) {
      await groups.nth(i).getByRole('radio', { name: 'Nein' }).click();
    }
    await next(page);
  } else {
    await page.getByRole('button', { name: 'Ohne Einwilligung fortfahren' }).click();
  }
  await heading(page, 'Deine Trainingserfahrung');
  await page.getByRole('radio', { name: /^Einsteiger/ }).click();
  await next(page);
  await heading(page, 'Dein Ziel');
}

const primary = (page: Page, name: string) =>
  page
    .getByRole('radiogroup', { name: 'Was ist dir am wichtigsten?' })
    .getByRole('radio', { name, exact: true });
const secondary = (page: Page, name: RegExp) =>
  page.getByRole('radiogroup', { name: 'Zweites Ziel (optional)' }).getByRole('radio', { name });

test('Haupt- und Nebenziel: verbotene Paare nicht wählbar, Kombinationssatz, Ausdauer-Block', async ({
  page,
}) => {
  await onboardToGoal(page, { consent: true });
  // Nebenziel erst nach dem Hauptziel.
  await expect(page.getByTestId('goal-secondary')).toHaveCount(0);
  await primary(page, 'Muskelaufbau').click();
  await expect(page.getByTestId('goal-secondary')).toBeVisible();
  await expect(secondary(page, /^Zweites Ziel: Muskelaufbau/)).toHaveCount(0);
  await expect(secondary(page, /^Kein zweites Ziel/)).toHaveAttribute('aria-checked', 'true');

  // Verboten (Tabelle 4.2): Definition (doppelt) und Fitness als Nebenziel – ausgegraut, mit Grund.
  const definition = secondary(page, /^Zweites Ziel: Definition – nicht wählbar/);
  await expect(definition).toHaveAttribute('aria-disabled', 'true');
  await expect(definition).toHaveAccessibleName(
    'Zweites Ziel: Definition – nicht wählbar. Definition verbindet schon Fettverlust und Muskelerhalt.',
  );
  await definition.click({ force: true });
  await expect(definition).toHaveAttribute('aria-checked', 'false');
  await expect(
    secondary(page, /^Zweites Ziel: Fitness & Gesundheit – nicht wählbar/),
  ).toHaveAttribute('aria-disabled', 'true');

  // Nebenziel Ausdauer: Disziplin und Datum auch beim Nebenziel (F15).
  await secondary(page, /^Zweites Ziel: Ausdauer$/).click();
  await expect(
    page.getByText('Dein zweites Ziel ist Ausdauer – Disziplin und Datum sind optional.'),
  ).toBeVisible();
  await page.getByRole('radio', { name: '10 km', exact: true }).click();
  await expect(page.getByTestId('goal-combination')).toContainText('Muskelaufbau steht vorn');

  // Recomposition: gleichwertig zu Definition (Wächter K3).
  await secondary(page, /^Zweites Ziel: Abnehmen$/).click();
  await expect(page.getByTestId('goal-combination')).toContainText(
    'Entspricht „Definition“ – zusätzlich kannst du ein Wunschgewicht festlegen.',
  );
  await expect(page.getByText('Disziplin (optional)')).toHaveCount(0);

  // Hauptziel wechseln: unpassendes Nebenziel entfällt (Abnehmen → Abnehmen wäre doppelt).
  await primary(page, 'Abnehmen').click();
  await expect(secondary(page, /^Kein zweites Ziel/)).toHaveAttribute('aria-checked', 'true');
  await expect(
    secondary(page, /^Zweites Ziel: Fitness & Gesundheit – nicht wählbar/),
  ).toHaveAttribute('aria-disabled', 'true');
  await primary(page, 'Muskelaufbau').click();
  await secondary(page, /^Zweites Ziel: Abnehmen$/).click();
  await next(page);

  // Abnehmen als Nebenziel → Schritt „Wunschgewicht“; „ohne festes Ziel“ ist vorausgewählt.
  await heading(page, 'Wie möchtest du abnehmen?');
  await expect(
    page.getByRole('radio', { name: 'In gesundem Tempo, ohne festes Ziel' }),
  ).toHaveAttribute('aria-checked', 'true');
  await next(page);
  await heading(page, 'Deine Trainingstage');

  // Gespeichert: zurück zum Ziel zeigt Haupt- und Nebenziel.
  await page.getByRole('button', { name: 'Zurück' }).click();
  await heading(page, 'Wie möchtest du abnehmen?');
  await page.getByRole('button', { name: 'Zurück' }).click();
  await heading(page, 'Dein Ziel');
  await expect(primary(page, 'Muskelaufbau')).toHaveAttribute('aria-checked', 'true');
  await expect(secondary(page, /^Zweites Ziel: Abnehmen$/)).toHaveAttribute('aria-checked', 'true');
});

test('Abnehmziel „10 kg in 12 Wochen“: Ampel Orange (etwa 22 Wochen) → Zeitraum übernehmen → Gelb; Ziel-BMI zu niedrig → Fehler', async ({
  page,
}) => {
  await onboardToGoal(page, { consent: true });
  await primary(page, 'Abnehmen').click();
  await next(page);
  await heading(page, 'Wie möchtest du abnehmen?');
  await expect(page.getByTestId('feasibility-scale')).toHaveCount(0);
  await page.getByRole('radio', { name: 'Mit konkretem Ziel' }).click();

  // Teil-Eingabe → noch keine Bewertung; Hinweise Stillzeit und Essstörungen stehen fest auf dem Bildschirm.
  const meter = page.getByRole('meter', { name: 'Planbarkeit' });
  await expect(meter).toBeVisible();
  await expect(meter).toHaveAttribute('aria-valuemin', '0');
  await expect(meter).toHaveAttribute('aria-valuemax', '100');
  await expect(meter).not.toHaveAttribute('aria-valuenow', /.*/);
  await expect(page.getByTestId('feasibility-pending')).toHaveText(
    'Noch keine Bewertung – gib Menge und Zeitraum ein.',
  );
  // Stillzeit-Hinweis nur, wenn nicht männlich (Wächter Z4 N13); Hilfe-Hinweis genau einmal (N7).
  await expect(page.getByTestId('weight-goal-breastfeeding')).toHaveCount(0);
  await expect(page.getByTestId('weight-goal-eating-help')).toHaveCount(1);
  await expect(page.getByText('Wenn Essen oder Gewicht dich belasten')).toHaveCount(1);

  // Standard laut F9: „kg abnehmen“ + „Wochen“.
  await expect(page.getByRole('radio', { name: 'kg abnehmen' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('radio', { name: 'in Wochen' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByLabel('kg abnehmen ab heute').fill('10');
  await page.getByLabel('Wochen', { exact: true }).fill('12');

  // Beispiel A: r ≈ 0,98 % > C ≈ 0,544 % → Orange „langsamer“, sichere Dauer 22 Wochen.
  await expect(page.getByTestId('feasibility-level-orange_slower')).toHaveText(
    'Sehr ehrgeizig – wir planen etwas langsamer',
  );
  await expect(page.getByTestId('feasibility-text')).toHaveText(
    'Sicher planbar sind für dich etwa 22 Wochen.',
  );
  await expect(page.getByTestId('feasibility-detail')).toHaveText(
    'Benötigt etwa 1 % deines Gewichts pro Woche.',
  );
  await expect(page.getByTestId('feasibility-symbol-orange')).toBeAttached();
  // Screenreader: role="meter" mit Wert in der Orange-Zone [20; 40) und ganzem Satz (Wächter K8).
  const now = Number(await meter.getAttribute('aria-valuenow'));
  expect(now).toBeGreaterThanOrEqual(20);
  expect(now).toBeLessThan(40);
  await expect(meter).toHaveAttribute(
    'aria-valuetext',
    'Planbarkeit: sehr ehrgeizig. Benötigt etwa 1 % deines Gewichts pro Woche. Sicher planbar sind etwa 22 Wochen.',
  );
  // Ansage bei Stufenwechsel über die dauerhafte Live-Region.
  await expect(page.getByTestId('feasibility-announcer')).toHaveText(/sehr ehrgeizig/);

  // Knopf übernehmen → 22 Wochen → Gelb.
  await page.getByRole('button', { name: 'Zeitraum auf 22 Wochen setzen' }).click();
  await expect(page.getByLabel('Wochen', { exact: true })).toHaveValue('22');
  await expect(page.getByTestId('feasibility-level-yellow')).toHaveText('Ehrgeizig, aber machbar');
  await expect(page.getByRole('button', { name: /Zeitraum auf/ })).toHaveCount(0);
  const yellow = Number(await meter.getAttribute('aria-valuenow'));
  expect(yellow).toBeGreaterThanOrEqual(40);
  expect(yellow).toBeLessThan(60);
  await expect(page.getByTestId('feasibility-announcer')).toHaveText(/Planbarkeit: ehrgeizig/);

  // Ziel-BMI unter der Grenze (F8: 20 → bei 180 cm unter 64,8 kg) → Fehler, Speichern unmöglich.
  await page.getByRole('radio', { name: 'Zielgewicht' }).click();
  await expect(page.getByText('Dein aktuelles Gewicht: 90 kg')).toBeVisible();
  await page.getByLabel('Zielgewicht in kg').fill('60');
  // Sofort, nicht erst nach „Weiter“ (Wächter Z4 M4): in der Ampel und am Feld.
  await expect(page.getByTestId('feasibility-pending')).toContainText(
    'Dieses Zielgewicht liegt unter dem Bereich, den wir planen.',
  );
  await expect(
    page.getByText('Dieses Zielgewicht liegt unter dem Bereich, den wir planen.', { exact: false }),
  ).toHaveCount(2);
  await next(page);
  await heading(page, 'Wie möchtest du abnehmen?');

  // Gültiges Zielgewicht → speichern → weiter.
  await page.getByLabel('Zielgewicht in kg').fill('80');
  await expect(page.getByTestId('feasibility-level-yellow')).toBeVisible();
  await next(page);
  await heading(page, 'Deine Trainingstage');

  // Zurück: gespeichertes Ziel steht wieder im Formular (Zeitraum ab heute).
  await page.getByRole('button', { name: 'Zurück' }).click();
  await heading(page, 'Wie möchtest du abnehmen?');
  await expect(page.getByRole('radio', { name: 'Mit konkretem Ziel' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByLabel('Zielgewicht in kg')).toHaveValue('80');
  await expect(page.getByLabel('Wochen', { exact: true })).toHaveValue('22');
  await expect(page.getByTestId('feasibility-level-yellow')).toBeVisible();
});

test('ohne Einwilligung: Wunschgewicht gesperrt mit Erklärung, Schritt entfällt', async ({
  page,
}) => {
  await onboardToGoal(page, { consent: false });
  await primary(page, 'Abnehmen').click();
  const locked = page.getByTestId('goal-weight-goal-locked');
  await expect(locked).toContainText('Wunschgewicht nur mit Einwilligung');
  await expect(locked.getByRole('button', { name: 'Einwilligung erteilen' })).toBeVisible();
  await next(page);
  await heading(page, 'Deine Trainingstage');
  // Direkter Aufruf des Schritts → zurück zum aktuellen Schritt, kein Formular.
  await page.goto('/onboarding/weight_goal');
  await heading(page, 'Deine Trainingstage');
  await expect(page.getByRole('heading', { name: 'Wie möchtest du abnehmen?' })).toHaveCount(0);
});

test('„Angaben ändern“ führt über das Wunschgewicht; Rückfrage bei ausgeblendeten Kalorienzahlen (K6)', async ({
  page,
}) => {
  // Frau, 170 cm, 70 kg, Abnehmen, Onboarding fertig; dann „Kalorienzahlen anzeigen“ aus.
  await onboardNutrition(page);
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: { ...(value.rows.nutritionSetup as object), show_energy_numbers: false },
    },
  }));
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('link', { name: 'Angaben ändern' }).click();
  await heading(page, 'Deine Trainingserfahrung');
  await next(page);
  await heading(page, 'Dein Ziel');
  await next(page);
  await heading(page, 'Wie möchtest du abnehmen?');

  // K6: ruhige Rückfrage, Abbrechen lässt „ohne festes Ziel“.
  const concrete = page.getByRole('radio', { name: 'Mit konkretem Ziel' });
  await concrete.click();
  const dialog = page.getByTestId('weight-goal-hidden-numbers');
  await expect(dialog).toContainText('Du hast Kalorienzahlen ausgeblendet.');
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(concrete).toHaveAttribute('aria-checked', 'false');
  await concrete.click();
  await page
    .getByTestId('weight-goal-hidden-numbers')
    .getByRole('button', { name: 'Ja, festes Ziel' })
    .click();
  await expect(concrete).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('weight-goal-breastfeeding')).toBeVisible();

  // „bis Datum“: Feld bleibt leer (kein vorgeschlagenes Datum, N3); 31.02. gibt es nicht (N8).
  await page.getByLabel('kg abnehmen ab heute').fill('3');
  await page.getByRole('radio', { name: 'bis Datum' }).click();
  await expect(page.getByLabel('Bis zum: Tag')).toHaveValue('');
  await page.getByLabel('Bis zum: Tag').fill('31');
  await page.getByLabel('Bis zum: Monat').fill('02');
  await page.getByLabel('Bis zum: Jahr').fill('2027');
  await next(page);
  await expect(page.getByText('Dieses Datum gibt es nicht.')).toBeVisible();
  await page.getByRole('radio', { name: 'in Wochen' }).click();
  await page.getByLabel('Wochen', { exact: true }).fill('12');
  await expect(page.getByTestId('feasibility-scale')).toContainText(/Gut planbar|Ehrgeizig/);
  await next(page);

  // Kette geht weiter zu den Trainingstagen und zurück zu „Heute“.
  await heading(page, 'Deine Trainingstage');
  await next(page);
  await heading(page, 'Training');

  // Gespeichert: erneut „Angaben ändern“ → konkretes Ziel steht im Formular (ohne Rückfrage).
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('link', { name: 'Angaben ändern' }).click();
  await heading(page, 'Deine Trainingserfahrung');
  await next(page);
  await heading(page, 'Dein Ziel');
  await next(page);
  await heading(page, 'Wie möchtest du abnehmen?');
  await expect(concrete).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('kg abnehmen ab heute')).toHaveValue('3');
});

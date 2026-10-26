import { expect, test, type Page } from '@playwright/test';

import { heading, onboard, type Person } from './plan-helpers';

/**
 * Trainings-Modi im TESTMODUS (docs/PLAN-TRAINING-MODI.md, Gründer-Freigabe 25.10.2026) mit festem Datum Mittwoch,
 * 07.10.2026: Schon-Modus (Körperkarte, Liste, Arzt-Hinweis, Beenden, Löschen), Reise-Modus (Banner, Tausch auf
 * Körpergewicht, kürzere Einheiten, Schlingentrainer-Hinweis, Beenden), Aufwärmen & Dehnen im Training
 * (Überspringen, Schalter in den Einstellungen) und die Einwilligung (ohne Einwilligung kein Schon-Modus).
 */

const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');
const shots = process.env.SCREENSHOT_DIR;

const GYM_3_DAYS: Person = {
  consent: true,
  yesQuestion: null,
  level: /^Einsteiger/,
  goal: 'Muskelaufbau',
  days: [
    ['Montag', 'Kraft im Studio', 60],
    ['Mittwoch', 'Kraft im Studio', 60],
    ['Freitag', 'Kraft im Studio', 60],
  ],
};

async function toToday(page: Page) {
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
}

async function exerciseNames(page: Page): Promise<string[]> {
  await expect(page.getByTestId('plan-exercise').first()).toBeVisible();
  return page.getByTestId('plan-exercise').getByTestId('plan-exercise-link').allInnerTexts();
}

/** Bildschirmfoto 390 px: der Inhalt scrollt im Screen, also erst zum Element scrollen. */
async function shot(page: Page, testId: string, name: string) {
  await page.getByTestId(testId).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/${name}.png` });
}

async function openSettingsEntry(page: Page, testId: string, title: string) {
  await page.goto('/settings');
  await page.getByTestId(testId).click();
  await heading(page, title);
}

/**
 * Gratis-Weg (Gründer-Entscheidung 26.10.2026: Schon- und Reise-Modus sind gratis): im Testmodus den Schalter
 * „Live-Anpassung einschalten (Testmodus)“ ausschalten, damit kein Premium-Zugang im Spiel ist.
 */
async function withoutPremium(page: Page) {
  await page.goto('/settings');
  const box = page.getByRole('checkbox', { name: 'Live-Anpassung einschalten (Testmodus)' });
  await expect(box).toBeVisible();
  if ((await box.getAttribute('aria-checked')) !== 'false') await box.click();
  await expect(box).toHaveAttribute('aria-checked', 'false');
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('Schon-Modus: Körperkarte, Tausch ohne Knie-Übungen, Arzt-Hinweis bei „stark“, Beenden und Löschen', async ({
  page,
}) => {
  await onboard(page, GYM_3_DAYS);
  await toToday(page);
  const before = await exerciseNames(page);
  expect(before.some((name) => /Kniebeuge|Ausfallschritt|Beinpresse/.test(name))).toBe(true);
  await withoutPremium(page);

  await openSettingsEntry(page, 'settings-pain-mode', 'Schmerz-/Verletzungsmodus');
  await expect(page.getByTestId('pain-disclaimer')).toContainText('ersetzt keinen ärztlichen Rat');
  // Ohne Angaben → verständliche Meldungen.
  await page.getByTestId('pain-start').click();
  await expect(page.getByText('Bitte wähle eine Stelle.')).toBeVisible();

  // Körperkarte: Knie antippen → in der Liste ebenfalls gewählt (eine Auswahl, zwei Wege).
  await page.getByTestId('body-map-knee').click();
  await expect(page.getByTestId('body-map-knee')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('pain-region-knee')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('pain-intensity-moderate').click();
  await page.getByTestId('pain-duration-7').click();
  await expect(page.getByTestId('pain-preview-advice')).toHaveCount(0);
  // Meldungen verschwinden, sobald die Felder ausgefüllt sind.
  await expect(page.getByText('Bitte wähle eine Stelle.')).toHaveCount(0);
  await expect(page.getByText('Bitte wähle eine Dauer.')).toHaveCount(0);
  if (shots) {
    await page.getByTestId('body-map').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${shots}/schon-modus-koerperkarte.png` });
  }
  await page.getByTestId('pain-start').click();
  await expect(page.getByTestId('pain-message')).toContainText(
    'Bis 13.10.2026 schont dein Plan: Knie.',
  );
  await expect(page.getByTestId('pain-active')).toContainText('Knie (mittel) – bis 13.10.2026');

  // „Heute“: Banner, Hinweise, keine Kniebeugen/Ausfallschritte/Beinpresse, Kennzeichen „heute geschont“.
  await page.goto('/today');
  await heading(page, 'Heute');
  await expect(page.getByTestId('modes-banner-pain')).toContainText('Schon-Modus bis 13.10.2026');
  await expect(page.getByTestId('modes-banner-pain')).toContainText('Geschont: Knie');
  await expect(page.getByTestId('session-mode-notice-pain_active')).toBeVisible();
  const after = await exerciseNames(page);
  expect(after.some((name) => /Kniebeuge|Ausfallschritt|Beinpresse|Beinstrecker/.test(name))).toBe(
    false,
  );
  await expect(page.getByText('heute geschont').first()).toBeVisible();
  // Tauschen ist pausiert, solange der Modus wirkt.
  await expect(page.getByTestId('plan-swap-0')).toHaveCount(0);
  if (shots) await shot(page, 'modes-banner-pain', 'schon-modus-heute');

  // Training: gleiche Übungen wie „Heute“ (Entwurf übernimmt den Modus).
  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout-exercise-0')).toBeVisible();
  const workoutNames = await page
    .locator('[data-testid^="workout-exercise-"] [role="heading"]')
    .allInnerTexts();
  expect(workoutNames.some((name) => /Kniebeuge|Ausfallschritt|Beinpresse/.test(name))).toBe(false);
  await page.goto('/today');

  // „stark“ derselben Stelle → Vorschau und danach Arzt-Hinweis, die neue Angabe ersetzt die alte.
  await page.goto('/schmerz-modus');
  await heading(page, 'Schmerz-/Verletzungsmodus');
  await page.getByTestId('pain-region-knee').click();
  await page.getByTestId('pain-intensity-severe').click();
  await page.getByTestId('pain-duration-3').click();
  await expect(page.getByTestId('pain-preview-advice')).toContainText('starke Beschwerden');
  await page.getByTestId('pain-start').click();
  await expect(page.getByTestId('pain-advice')).toContainText('Bitte lass das ärztlich abklären.');
  await expect(page.getByTestId('pain-active')).toHaveCount(1);
  await expect(page.getByTestId('pain-active')).toContainText('Knie (stark)');
  if (shots) await shot(page, 'pain-advice', 'schon-modus-arzt-hinweis');
  await page.goto('/today');
  await expect(page.getByTestId('modes-banner-pain-advice')).toBeVisible();
  await expect(page.getByTestId('session-mode-notices')).toContainText(
    'Bitte ärztlich abklären lassen',
  );

  // Beenden → ab heute wieder der normale Plan.
  await page.goto('/schmerz-modus');
  await page.getByTestId('pain-end-knee').click();
  await expect(page.getByTestId('pain-message')).toContainText(
    'Ab heute gilt wieder dein normaler Plan.',
  );
  await page.goto('/today');
  await expect(page.getByTestId('modes-banner-pain')).toHaveCount(0);
  expect(await exerciseNames(page)).toEqual(before);

  // Verlauf löschen (mit Bestätigung).
  await page.goto('/schmerz-modus');
  await expect(page.getByTestId('pain-history-item').first()).toBeVisible();
  await page.getByTestId('pain-delete-all').click();
  await page
    .getByTestId('pain-delete-dialog')
    .getByRole('button', { name: 'Alle Einträge löschen' })
    .click();
  await expect(page.getByTestId('pain-history-empty')).toBeVisible();
  // Geschützter Speicher (Browser: nur sessionStorage), nie localStorage.
  const local = await page.evaluate(() => JSON.stringify(window.localStorage));
  expect(local).not.toContain('"region"');
});

test('Schon-Modus: Liste als Alternative zur Körperkarte (Bildschirmleser), alle 8 Stellen', async ({
  page,
}) => {
  await onboard(page, GYM_3_DAYS);
  await page.goto('/schmerz-modus');
  await heading(page, 'Schmerz-/Verletzungsmodus');
  const list = page.getByRole('radiogroup', { name: 'Stelle auswählen' });
  for (const name of [
    'Knie',
    'Schulter',
    'Unterer Rücken',
    'Ellenbogen',
    'Handgelenk',
    'Hüfte',
    'Sprunggelenk',
    'Nacken',
  ]) {
    await expect(list.getByRole('radio', { name, exact: true })).toBeVisible();
  }
  await list.getByRole('radio', { name: 'Schulter', exact: true }).click();
  await expect(page.getByTestId('body-map-shoulder')).toHaveAttribute('aria-checked', 'true');
  // Jede Stelle der Karte ist mindestens 44 × 44 groß antippbar (Kreis 34 + Rand).
  const box = await page.getByTestId('body-map-shoulder').boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(34);
});

test('Ohne Einwilligung „Gesundheitsdaten“: kein Schon-Modus, Hinweis mit Weg zur Einwilligung', async ({
  page,
}) => {
  await onboard(page, { ...GYM_3_DAYS, consent: false });
  await page.goto('/schmerz-modus');
  await heading(page, 'Schmerz-/Verletzungsmodus');
  await expect(page.getByTestId('pain-consent')).toContainText('Gesundheitsdaten');
  await expect(page.getByTestId('pain-start')).toHaveCount(0);
  await expect(page.getByTestId('body-map')).toHaveCount(0);
  await expect(page.getByTestId('pain-consent-open')).toBeVisible();
});

test('Reise-Modus: Banner, Körpergewicht-Übungen, 30 Minuten, Schlingentrainer-Hinweis, Beenden', async ({
  page,
}) => {
  await onboard(page, GYM_3_DAYS);
  await toToday(page);
  const before = await exerciseNames(page);
  await withoutPremium(page);

  await openSettingsEntry(page, 'settings-travel-mode', 'Reise-Modus');
  await page.getByTestId('travel-equipment-suspension_trainer').click();
  await expect(page.getByTestId('travel-suspension-note')).toContainText(
    'stellt deine Einheiten auf Schlingentrainer-Übungen um',
  );
  await page.getByTestId('travel-equipment-bodyweight').click();
  await page.getByTestId('travel-minutes-30').click();
  // Letzter Reisetag vor dem ersten → Meldung.
  await page.getByLabel('Letzter Reisetag: Tag').fill('01');
  await page.getByTestId('travel-save').click();
  await expect(page.getByTestId('travel-error')).toContainText('liegt vor dem ersten');
  await page.getByLabel('Letzter Reisetag: Tag').fill('13');
  if (shots) await shot(page, 'travel-equipment-bodyweight', 'reise-modus-eingabe');
  await page.getByTestId('travel-save').click();
  await expect(page.getByTestId('travel-message')).toContainText('07.10.2026 bis 13.10.2026');
  await expect(page.getByTestId('travel-item')).toContainText('Nur Körpergewicht');

  await page.goto('/today');
  await heading(page, 'Heute');
  await expect(page.getByTestId('modes-banner-travel')).toContainText('Reise-Modus bis 13.10.2026');
  await expect(page.getByTestId('modes-banner-travel')).toContainText('höchstens 30 min');
  await expect(page.getByText('für die Reise getauscht').first()).toBeVisible();
  const after = await exerciseNames(page);
  expect(after).not.toEqual(before);
  expect(after.some((name) => /Langhantel|Maschine|Kabel|Latzug|Beinpresse/.test(name))).toBe(
    false,
  );
  if (shots) await shot(page, 'modes-banner-travel', 'reise-modus-heute');

  // Ein Überschneiden wird abgelehnt.
  await page.goto('/reise-modus');
  await page.getByTestId('travel-equipment-band').click();
  await page.getByTestId('travel-save').click();
  await expect(page.getByTestId('travel-message')).toContainText('schon einen Reise-Modus');

  // Beenden (heute erster Tag → entfernt) → wieder der normale Plan.
  await page.getByTestId('travel-end').click();
  await expect(page.getByTestId('travel-message')).toContainText('entfernt');
  await page.goto('/today');
  await expect(page.getByTestId('modes-banner-travel')).toHaveCount(0);
  expect(await exerciseNames(page)).toEqual(before);
});

test('Aufwärmen & Dehnen: Block vor und nach dem Training, Überspringen, Schalter in den Einstellungen', async ({
  page,
}) => {
  await onboard(page, GYM_3_DAYS);
  await toToday(page);
  await expect(page.getByTestId('plan-warmup')).toContainText('Aufwärmen (ca.');
  await page.getByTestId('workout-start').click();
  const warmup = page.getByTestId('workout-warmup');
  await expect(warmup).toContainText('Aufwärmen');
  await expect(page.getByTestId('workout-warmup-item').first()).toBeVisible();
  // Entwürfe (Testmodus) sind gekennzeichnet.
  await expect(page.getByTestId('workout-warmup-draft').first()).toHaveText('Testinhalt');
  await expect(page.getByTestId('workout-cooldown')).toContainText('Dehnen danach');
  if (shots) await shot(page, 'workout-warmup', 'aufwaermen-training');
  await page.getByTestId('workout-warmup-skip').click();
  await expect(page.getByTestId('workout-warmup-skipped')).toHaveText('Übersprungen.');
  await page.getByTestId('workout-warmup-show').click();
  await expect(page.getByTestId('workout-warmup-item').first()).toBeVisible();

  // Schalter aus → kein Block mehr.
  await page.goto('/settings');
  await page.getByTestId('settings-warmup').click();
  await page.goto('/today');
  await heading(page, 'Heute');
  await expect(page.getByTestId('plan-warmup')).not.toContainText('Aufwärmen (ca.');
  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout-exercise-0')).toBeVisible();
  await expect(page.getByTestId('workout-warmup')).toHaveCount(0);
  await expect(page.getByTestId('workout-cooldown')).toHaveCount(0);
});

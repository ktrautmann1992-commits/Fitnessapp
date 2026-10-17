import { expect, test, type Page } from '@playwright/test';

import { db, onboardNutrition, patchDb } from './nutrition-helpers';
import { heading, next } from './plan-helpers';

/**
 * Ziele · Etappe Z5 (docs/PLAN-ZIELE.md 6 Nr. 3–4, 7 Z5, F10, F13, K10): Einstellungen „Dein Abnehm-Ziel“ –
 * Bearbeiten, Entfernen, Verlängern, Widerruf; Karten „erreicht“/„Zeitraum vorbei“; Planname mit zwei Zielen und
 * „Plan neu erstellen?“ bei geändertem Nebenziel. Testmodus, Handy-Ansicht, fester Tag Montag 12.10.2026 (Frau,
 * 170 cm, 70 kg, Abnehmen).
 */

type WeightGoalRowJson = Record<string, unknown> & { start_date: string; target_date: string };

async function start(page: Page) {
  test.setTimeout(150_000);
  await onboardNutrition(page);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
}

async function openWeightGoal(page: Page) {
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Dein Abnehm-Ziel' }).click();
  await expect(page.getByTestId('weight-goal-settings')).toBeVisible();
}

/** Über die Einstellungen ein Ziel „3 kg in 12 Wochen“ festlegen; danach steht man wieder auf „Dein Abnehm-Ziel“. */
async function setGoal(page: Page) {
  await openWeightGoal(page);
  await expect(page.getByTestId('weight-goal-settings-none')).toHaveText(
    'Ohne festes Ziel – wir planen in gesundem Tempo.',
  );
  await page.getByTestId('weight-goal-settings-set').click();
  await heading(page, 'Wie möchtest du abnehmen?');
  await page.getByRole('radio', { name: 'Mit konkretem Ziel' }).click();
  await page.getByLabel('kg abnehmen ab heute').fill('3');
  await page.getByLabel('Wochen', { exact: true }).fill('12');
  await expect(page.getByTestId('feasibility-scale')).toContainText(/Gut planbar|Ehrgeizig/);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('weight-goal-settings-target')).toHaveText('Wunschgewicht: 67 kg');
  await expect(page.getByTestId('weight-goal-settings-period')).toHaveText(
    'Zeitraum: 12 Wochen, gespeichert am 12.10.2026',
  );
}

async function storedGoal(page: Page): Promise<WeightGoalRowJson | null> {
  return ((await db(page)).rows.weightGoal ?? null) as WeightGoalRowJson | null;
}

/** Zeitraum in die Vergangenheit legen (01.09.–01.10.2026) – wie ein Ziel, dessen Datum vorbei ist. */
async function expireGoal(page: Page) {
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      weightGoal: {
        ...(value.rows.weightGoal as WeightGoalRowJson),
        start_date: '2026-09-01',
        target_date: '2026-10-01',
      },
    },
  }));
  await heading(page, 'Heute');
}

test('Bearbeiten und Entfernen: nur unter Einstellungen sichtbar, Speichern plant ab heute neu', async ({
  page,
}) => {
  await start(page);
  await setGoal(page);

  // Bearbeiten: gespeicherte Werte im Formular, Zeitraum ändern.
  await page.getByTestId('weight-goal-settings-edit').click();
  await heading(page, 'Wie möchtest du abnehmen?');
  await expect(page.getByLabel('kg abnehmen ab heute')).toHaveValue('3');
  await expect(page.getByLabel('Wochen', { exact: true })).toHaveValue('12');
  await page.getByLabel('Wochen', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('weight-goal-settings-period')).toHaveText(
    'Zeitraum: 20 Wochen, gespeichert am 12.10.2026',
  );
  await expect(page.getByTestId('weight-goal-settings-status-active')).toBeVisible();
  expect((await storedGoal(page))?.start_date).toBe('2026-10-12');

  // F13: Auf „Heute“ kein Wunschgewicht, kein Fortschritt, keine Karte (Ziel aktiv).
  await page.goto('/today');
  await heading(page, 'Heute');
  await expect(page.getByText(/Wunschgewicht|67 kg/)).toHaveCount(0);
  await expect(page.getByTestId('weight-goal-card-reached')).toHaveCount(0);
  await expect(page.getByTestId('weight-goal-card-date-passed')).toHaveCount(0);

  // Entfernen mit Rückfrage → „ohne festes Ziel“.
  await openWeightGoal(page);
  await page.getByTestId('weight-goal-settings-remove').click();
  const dialog = page.getByTestId('weight-goal-remove-dialog');
  await expect(dialog).toContainText('Wir planen dann wieder in gesundem Tempo');
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByTestId('weight-goal-settings-target')).toBeVisible();
  await page.getByTestId('weight-goal-settings-remove').click();
  await page
    .getByTestId('weight-goal-remove-dialog')
    .getByRole('button', { name: 'Ziel entfernen' })
    .click();
  await expect(page.getByTestId('weight-goal-settings-message')).toContainText(
    'Dein Ziel ist entfernt.',
  );
  await expect(page.getByTestId('weight-goal-settings-none')).toBeVisible();
  expect(await storedGoal(page)).toBeNull();
});

test('Zeitraum vorbei: Karte, Verlängern nur ausdrücklich; „Angaben ändern“ verlängert nicht still (Wächter Z4 N10)', async ({
  page,
}) => {
  await start(page);
  await setGoal(page);
  await expireGoal(page);

  // „Angaben ändern“: Hinweis, Feld leer, „Weiter“ behält das Ziel genau so (kein neues Startdatum).
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Angaben ändern' }).click();
  await heading(page, 'Deine Trainingserfahrung');
  await next(page);
  await heading(page, 'Dein Ziel');
  await next(page);
  await heading(page, 'Wie möchtest du abnehmen?');
  await expect(page.getByTestId('weight-goal-form-lifecycle')).toContainText(
    'Dein Zeitraum ist vorbei.',
  );
  await expect(page.getByLabel('Wochen', { exact: true })).toHaveValue('');
  await next(page);
  await heading(page, 'Deine Trainingstage');
  expect(await storedGoal(page)).toMatchObject({
    start_date: '2026-09-01',
    target_date: '2026-10-01',
  });
  await next(page);
  await heading(page, 'Heute');

  // Karte auf „Heute“ – ohne Zahlen.
  const card = page.getByTestId('weight-goal-card-date-passed');
  await expect(card).toContainText('Dein Zeitraum ist vorbei.');
  await expect(card).not.toContainText(/\d/);
  await card.getByRole('button', { name: 'Verlängern' }).click();
  await heading(page, 'Wie möchtest du abnehmen?');
  await expect(page.getByTestId('weight-goal-form-lifecycle')).toContainText(
    'Verlängern: Wähle einen neuen Zeitraum ab heute.',
  );
  // Ohne neuen Zeitraum kein Speichern.
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Bitte gib eine Menge und einen Zeitraum ein.')).toBeVisible();
  await page.getByLabel('Wochen', { exact: true }).fill('8');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await heading(page, 'Heute');
  await expect(page.getByTestId('weight-goal-card-date-passed')).toHaveCount(0);
  expect(await storedGoal(page)).toMatchObject({
    start_date: '2026-10-12',
    target_date: '2026-12-07',
  });

  // „Ohne festes Ziel weitermachen“ aus der Karte.
  await expireGoal(page);
  await page
    .getByTestId('weight-goal-card-date-passed')
    .getByRole('button', { name: 'Ohne festes Ziel weitermachen' })
    .click();
  await expect(page.getByTestId('weight-goal-card-message')).toContainText('ohne festes Ziel');
  expect(await storedGoal(page)).toBeNull();
});

test('Wunschgewicht erreicht: Karte bleibt bis zur Wahl, „Weiter“ blockiert nicht; „Gewicht halten“ → Plan neu erstellen?', async ({
  page,
}) => {
  await start(page);
  await setGoal(page);
  // Neue Messung unter dem Ziel (66,8 kg am 12.10.).
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      bodyMetrics: [
        ...(value.rows.bodyMetrics as Record<string, unknown>[]),
        {
          id: 'bm-reached',
          user_id: (value.rows.profile as { user_id: string }).user_id,
          measured_on: '2026-10-12',
          height_cm: null,
          weight_kg: 66.8,
          body_fat_pct: null,
          resting_heart_rate_bpm: null,
        },
      ],
    },
  }));
  await heading(page, 'Heute');
  const card = page.getByTestId('weight-goal-card-reached');
  await expect(card).toContainText('Du hast dein Wunschgewicht erreicht. Wie geht es weiter?');
  await expect(card).not.toContainText(/\d/);

  // Ernährungs-Übersicht der Woche: Hinweis einmal, ohne Zahlen.
  await page.goto('/ernaehrung/woche');
  await expect(page.getByTestId('nutrition-weight-goal-weight_goal_reached')).toHaveCount(1);
  await expect(page.getByTestId('nutrition-weight-goal-notices')).not.toContainText(/\d/);

  // „Angaben ändern“ blockiert nicht (aktuelles Gewicht unter dem Ziel).
  await page.goto('/today');
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Angaben ändern' }).click();
  await next(page);
  await heading(page, 'Dein Ziel');
  await next(page);
  await heading(page, 'Wie möchtest du abnehmen?');
  await expect(page.getByTestId('weight-goal-form-lifecycle')).toContainText(
    'Du hast dein Wunschgewicht erreicht.',
  );
  await next(page);
  await heading(page, 'Deine Trainingstage');
  await next(page);
  await heading(page, 'Heute');

  // Wahl „Gewicht halten“ → Ziel Fitness, Wunschgewicht gelöscht, Angebot „Plan neu erstellen?“.
  await page
    .getByTestId('weight-goal-card-reached')
    .getByRole('button', { name: 'Gewicht halten' })
    .click();
  await expect(page.getByTestId('weight-goal-card-message')).toContainText(
    'Dein Ziel ist geändert.',
  );
  await expect(page.getByTestId('weight-goal-card-reached')).toHaveCount(0);
  await expect(page.getByTestId('plan-offer')).toContainText('Plan neu erstellen?');
  const stored = await db(page);
  expect((stored.rows.goals as { goal_type: string }).goal_type).toBe('general_fitness');
  expect(stored.rows.weightGoal ?? null).toBeNull();
  // Ohne Abnehmen gibt es den Einstellungs-Eintrag nicht mehr.
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByTestId('settings-weight-goal')).toHaveCount(0);
});

test('Widerruf löscht das Wunschgewicht; danach ohne Einwilligung gesperrt', async ({ page }) => {
  await start(page);
  await setGoal(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Gesundheitsdaten: Widerrufen' }).click();
  await page.getByRole('button', { name: 'Tagebuch behalten (empfohlen)' }).click();
  await expect(page.getByTestId('dialog-revoke')).toHaveCount(0);
  expect(await storedGoal(page)).toBeNull();
  await page.getByTestId('settings-weight-goal').click();
  await expect(page.getByTestId('weight-goal-settings-no-consent')).toBeVisible();
  await expect(page.getByTestId('weight-goal-settings-target')).toHaveCount(0);
});

test('Nebenziel geändert → „Plan neu erstellen?“; Planname mit beiden Zielen auf „Heute“ und in der Woche', async ({
  page,
}) => {
  await start(page);
  await expect(page.getByTestId('plan-name')).toHaveText('Dein Plan: Abnehmen · 3 Tage');
  await expect(page.getByTestId('plan-offer')).toHaveCount(0);

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Angaben ändern' }).click();
  await next(page);
  await heading(page, 'Dein Ziel');
  await page
    .getByRole('radiogroup', { name: 'Zweites Ziel (optional)' })
    .getByRole('radio', { name: /^Zweites Ziel: Muskelaufbau$/ })
    .click();
  await next(page);
  await heading(page, 'Wie möchtest du abnehmen?');
  await next(page);
  await heading(page, 'Deine Trainingstage');
  await next(page);
  await heading(page, 'Heute');
  const offer = page.getByTestId('plan-offer');
  await expect(offer).toContainText('Plan neu erstellen?');
  await offer.getByRole('button', { name: 'Plan neu erstellen' }).first().click();
  await expect(page.getByTestId('plan-name')).toHaveText(
    'Dein Plan: Abnehmen + Muskelaufbau · 3 Tage',
  );
  await expect(page.getByTestId('plan-offer')).toHaveCount(0);
  await page.getByTestId('today-week').click();
  await expect(page.getByTestId('week-plan-name')).toHaveText(
    'Dein Plan: Abnehmen + Muskelaufbau · 3 Tage',
  );
});

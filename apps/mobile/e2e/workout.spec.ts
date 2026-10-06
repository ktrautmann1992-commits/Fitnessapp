import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Trainingsmodus im TESTMODUS (docs/PLAN-PHASE-4.md Etappe C1 – Kraft) mit festem Datum Mittwoch, 07.10.2026
 * (Europe/Berlin): Einheit starten, Sätze eintragen, Alternative, „nicht gemacht“, Abschluss; Entwurf nach Neu laden;
 * beforeunload-Warnung; offline eintragen; Progression nach zwei Einheiten; Widerruf behält das Tagebuch ohne
 * Vorgaben.
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const DRAFT_KEY = 'fitnessapp.workout-draft.v1';
const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');

interface StoredRows {
  plans: { id: string; uses_health_data: boolean }[];
  plannedSessions: { id: string; scheduled_on: string; status: string; kind: string }[];
  sessionLogs: {
    id: string;
    planned_session_id: string | null;
    performed_on: string;
    status: string;
    session_rpe: number | null;
    notes: string | null;
    name_de: string;
    from_health_plan: boolean;
    revision: number;
  }[];
  exerciseLogs: Record<string, unknown>[];
  setLogs: {
    exercise_log_id: string;
    done: boolean;
    reps: number | null;
    weight_kg: number | null;
  }[];
}

async function storedRows(page: Page): Promise<StoredRows> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  return (JSON.parse(raw ?? '{}') as { rows: StoredRows }).rows;
}

const STUDIO_3_DAYS = {
  consent: true,
  yesQuestion: null,
  level: /^Einsteiger/,
  goal: 'Muskelaufbau',
  days: [
    ['Montag', 'Kraft im Studio', 60],
    ['Mittwoch', 'Kraft im Studio', 60],
    ['Freitag', 'Kraft im Studio', 60],
  ] as [string, string, number][],
};

async function toToday(page: Page) {
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
}

/** Gewicht des ersten Satzes per „+“ auf `clicks` × 2,5 kg (Studio ohne eigene Stufen), gilt für alle Sätze. */
async function setWeight(page: Page, exercise: number, clicks: number) {
  const plus = page.getByTestId(`workout-weight-${exercise}-0-plus`);
  if ((await plus.count()) === 0) return;
  for (let i = 0; i < clicks; i += 1) await plus.click();
}

/** Alle Sätze einer Übung abhaken. */
async function tickAll(page: Page, exercise: number) {
  const card = page.getByTestId(`workout-exercise-${exercise}`);
  const sets = card.getByRole('checkbox', { name: /^Satz \d+ geschafft$/ });
  const count = await sets.count();
  for (let i = 0; i < count; i += 1) {
    await page.getByTestId(`workout-done-${exercise}-${i}`).click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('Kraft-Einheit komplett: Sätze, Alternative, „nicht gemacht“, Abschluss – Progression sichtbar', async ({
  page,
}) => {
  await onboard(page, STUDIO_3_DAYS);
  await toToday(page);
  await expect(page.getByTestId('workout-start')).toHaveText('Training starten');
  await page.getByTestId('workout-start').click();

  await expect(page.getByTestId('workout')).toBeVisible();
  await expect(page.getByText('Übung 1 von', { exact: false })).toBeVisible();
  await expect(page.getByTestId('workout-tab-hint')).toHaveText(
    'Lass diesen Tab offen, bis dein Training übertragen ist.',
  );
  const exercises = page.locator('[data-testid^="workout-exercise-"]');
  const count = await exercises.count();
  expect(count).toBeGreaterThanOrEqual(3);

  // Übung 1: erstes Training → „Startgewicht finden“, 20 kg einstellen (gilt für alle Sätze), alle abhaken.
  await expect(page.getByTestId('workout-exercise-0')).toContainText('Startgewicht finden');
  await setWeight(page, 0, 8);
  await tickAll(page, 0);
  await expect(page.getByText('Übung 2 von', { exact: false })).toBeVisible();

  // Übung 2: Alternative durchgeführt.
  await page.getByTestId('workout-alternative-1').click();
  const options = page.getByTestId('workout-exercise-1').getByRole('radio');
  await expect(options.first()).toBeVisible();
  const altName = (await options.first().innerText()).trim();
  await options.first().click();
  await expect(page.getByTestId('workout-exercise-1')).toContainText('statt ');
  await expect(page.getByTestId('workout-exercise-1').getByRole('heading')).toContainText(altName);
  await setWeight(page, 1, 4);
  await tickAll(page, 1);

  // Übung 3: nicht gemacht (ein Tipp, ohne Grund).
  await page.getByTestId('workout-skip-2').click();
  await expect(page.getByTestId('workout-skipped-2')).toBeVisible();

  // Rest abhaken.
  for (let i = 3; i < count; i += 1) {
    await setWeight(page, i, 4);
    await tickAll(page, i);
  }

  // Abschluss: Belastung 7, Notiz.
  await page.getByTestId('workout-effort-7').click();
  await expect(page.getByText('7 – schwer')).toBeVisible();
  await page.getByTestId('workout-notes').fill('Griff etwas enger');
  await page.getByTestId('workout-save').click();

  await heading(page, 'Heute');
  await expect(page.getByTestId('workout-message')).toContainText('Training gespeichert');
  await expect(page.getByTestId('plan-completed')).toContainText('Erledigt (teilweise)');

  const rows = await storedRows(page);
  expect(rows.sessionLogs).toHaveLength(1);
  const log = rows.sessionLogs[0];
  expect(log).toMatchObject({
    performed_on: '2026-10-07',
    status: 'partial',
    session_rpe: 7,
    notes: 'Griff etwas enger',
    from_health_plan: true,
    revision: 1,
  });
  expect(rows.plannedSessions.find((s) => s.id === log?.planned_session_id)?.status).toBe(
    'completed',
  );
  const statuses = rows.exerciseLogs.map((e) => e.status);
  expect(statuses[1]).toBe('alternative');
  expect(statuses[2]).toBe('skipped');
  // „Nicht gemacht“ ohne Grund-Feld (S3) und ohne Sätze.
  for (const e of rows.exerciseLogs) {
    expect(Object.keys(e).some((key) => /reason|grund/i.test(key))).toBe(false);
  }
  expect(rows.setLogs.filter((s) => s.exercise_log_id === rows.exerciseLogs[2]?.id)).toHaveLength(
    0,
  );
  // Entwurf nach dem Speichern geleert.
  expect(await page.evaluate((key) => window.sessionStorage.getItem(key), DRAFT_KEY)).toBeNull();

  // Ansehen/Ändern: gespeicherte Werte, Übungen nicht tauschbar.
  await page.getByTestId('workout-view').click();
  await expect(
    page.getByText('Du änderst ein gespeichertes Training.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByTestId('workout-alternative-0')).toHaveCount(0);
  await expect(page.getByTestId('workout-notes')).toHaveValue('Griff etwas enger');
  await page.getByRole('button', { name: 'Zurück zu Heute' }).first().click();
  await heading(page, 'Heute');
});

test('Progression nach zwei Einheiten sichtbar: kalibriert, dann eine Wiederholung mehr', async ({
  page,
}) => {
  await onboard(page, STUDIO_3_DAYS);
  await toToday(page);
  // Woche 1 (Einstiegswoche): Kniebeuge mit 20 kg × 8 → Arbeitsgewicht wird geschätzt.
  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout-exercise-0')).toContainText('Kniebeuge');
  await setWeight(page, 0, 8);
  await tickAll(page, 0);
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout-message')).toContainText('Training gespeichert');

  // Eine Woche später (gleiche Einheit A): Vorschlag aus dem ersten Eintrag.
  await page.clock.setFixedTime(new Date('2026-10-14T09:00:00+02:00'));
  await page.goto('/');
  await heading(page, 'Heute');
  await expect(page.getByTestId('plan-exercise').first()).toContainText(
    '3 × 8 Wiederholungen mit 18,5 kg',
  );
  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout-target-0')).toHaveText('3 × 8 Wiederholungen mit 18,5 kg');
  await expect(page.getByTestId('workout-weight-0-0-value')).toHaveText('18,5 kg');
  await tickAll(page, 0);
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout-message')).toContainText('Training gespeichert');

  // Noch eine Woche später: alle Wiederholungen geschafft → eine Wiederholung mehr.
  await page.clock.setFixedTime(new Date('2026-10-21T09:00:00+02:00'));
  await page.goto('/');
  await heading(page, 'Heute');
  await expect(page.getByTestId('plan-exercise').first()).toContainText(
    '3 × 9 Wiederholungen mit 18,5 kg',
  );
});

test('Entwurf nach Neu laden, beforeunload-Warnung und Abmelden mit Nachfrage', async ({
  page,
}) => {
  await onboard(page, STUDIO_3_DAYS);
  await toToday(page);
  await page.getByTestId('workout-start').click();
  await setWeight(page, 0, 8);
  await page.getByTestId('workout-done-0-0').click();
  await expect(page.getByTestId('workout-done-0-0')).toHaveAttribute('aria-checked', 'true');
  // Entwurf nur im sessionStorage (Browser), nie im localStorage.
  expect(await page.evaluate((key) => window.sessionStorage.getItem(key), DRAFT_KEY)).toContain(
    'kniebeuge-langhantel',
  );
  expect(await page.evaluate((key) => window.localStorage.getItem(key), DRAFT_KEY)).toBeNull();

  // Neu laden (nicht Tab schließen): Die beforeunload-Warnung erscheint – bestätigen; danach „Fortsetzen?“.
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.type());
    void dialog.accept();
  });
  await page.reload();
  expect(dialogs).toContain('beforeunload');
  // Der Trainingsmodus ist nach dem Neuladen gleich wieder da (Entwurf aus dem geschützten Speicher) …
  await expect(page.getByTestId('workout-done-0-0')).toHaveAttribute('aria-checked', 'true');
  // … und beim Öffnen der App fragt „Heute“: fortsetzen, speichern oder verwerfen?
  await page.goto('/');
  await heading(page, 'Heute');
  await expect(page.getByTestId('workout-draft')).toContainText(
    'Du hast ein Training vom 07.10.2026 nicht beendet',
  );
  await expect(page.getByTestId('workout-start')).toHaveCount(0);
  await page.getByTestId('workout-draft-continue').click();
  await expect(page.getByTestId('workout-done-0-0')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('workout-weight-0-1-value')).toHaveText('20 kg');
  await page.getByRole('button', { name: 'Zurück zu Heute' }).first().click();
  await heading(page, 'Heute');

  // Abmelden mit offenem Entwurf → Nachfrage; „Jetzt senden“ hilft im Testmodus nicht → erneut fragen.
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page.getByTestId('dialog-signout')).toContainText(
    '1 Training ist noch nicht übertragen.',
  );
  await page.getByRole('button', { name: 'Jetzt senden' }).click();
  await expect(page.getByTestId('dialog-signout')).toContainText('immer noch nicht alles');
  await page.getByRole('button', { name: 'Abbrechen' }).click();

  // Tab schließen mit Entwurf → beforeunload-Warnung.
  dialogs.length = 0;
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => dialogs).toContain('beforeunload');
});

test('Offline eintragen und später neu laden: Training bleibt gespeichert', async ({
  page,
  context,
}) => {
  await onboard(page, STUDIO_3_DAYS);
  await toToday(page);
  await context.setOffline(true);
  await page.getByTestId('workout-start').click();
  // Gewicht direkt eingeben (statt vieler „+“, K6) – gilt für alle offenen Sätze.
  await page.getByTestId('workout-weight-input-0').click();
  await page.getByTestId('workout-weight-field-0').fill('20');
  await page.getByTestId('workout-weight-apply-0').click();
  await expect(page.getByTestId('workout-weight-0-2-value')).toHaveText('20 kg');
  await tickAll(page, 0);
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout-message')).toContainText('Training gespeichert');
  await context.setOffline(false);
  await page.goto('/');
  await heading(page, 'Heute');
  await expect(page.getByTestId('plan-completed')).toBeVisible();
  expect((await storedRows(page)).sessionLogs).toHaveLength(1);
});

test('Widerruf „Tagebuch behalten“: Einträge bleiben ohne Vorgaben aus dem Gesundheits-Check', async ({
  page,
}) => {
  await onboard(page, STUDIO_3_DAYS);
  await toToday(page);
  await page.getByTestId('workout-start').click();
  await setWeight(page, 0, 8);
  await tickAll(page, 0);
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout-message')).toContainText('Training gespeichert');
  let rows = await storedRows(page);
  expect(rows.sessionLogs[0]?.from_health_plan).toBe(true);
  expect(rows.exerciseLogs[0]?.target_sets).not.toBeNull();

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Gesundheitsdaten: Widerrufen' }).click();
  const dialog = page.getByTestId('dialog-revoke');
  await expect(dialog).toContainText('Dein Tagebuch bleibt');
  await expect(dialog).toContainText('Öffne die App auf deinen anderen Geräten');
  await expect(dialog).toContainText('Einträge aus früheren Widerrufen');
  await dialog.getByRole('button', { name: 'Tagebuch behalten (empfohlen)' }).click();
  await expect(page.getByText('Einwilligung widerrufen.', { exact: false })).toBeVisible();

  rows = await storedRows(page);
  expect(rows.plans).toHaveLength(0);
  expect(rows.sessionLogs).toHaveLength(1);
  expect(rows.sessionLogs[0]).toMatchObject({
    name_de: 'Kraft-Einheit',
    from_health_plan: false,
    planned_session_id: null,
    session_rpe: null,
  });
  for (const e of rows.exerciseLogs) {
    expect(e.target_sets).toBeNull();
    expect(e.target_weight_kg).toBeNull();
    expect(e.state_weight_kg).toBeNull();
    expect(e.planned_exercise_id).toBeNull();
  }
  // Ist-Werte bleiben.
  expect(rows.setLogs.filter((s) => s.done && s.weight_kg === 20).length).toBeGreaterThan(0);
});

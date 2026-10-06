import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Woche, Verlauf, Eintrag und Datenexport im TESTMODUS (docs/PLAN-PHASE-4.md Etappe D) mit festem Datum Mittwoch,
 * 07.10.2026 (Europe/Berlin): Woche mit Status (Zeichen + Wort), Summen, Blättern, „nachgeholt“ am tatsächlichen
 * Datum (H2) und „entfallen“ (H1); Verlauf → Eintrag ansehen, ändern, löschen; Verlauf je Übung; Export mit Hinweis
 * vor dem Herunterladen, Datei enthält Tagebuch, Konto und Einwilligungs-Verlauf.
 * „Löschen/Export nur online“ betrifft nur den Supabase-Modus (Testmodus speichert lokal) – geprüft in
 * supabase-backend.test.ts und im Live-Test (docs/HANDY-ANLEITUNG.md, W13).
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');

const STUDIO_3_DAYS = {
  consent: false,
  level: /^Einsteiger/,
  goal: 'Muskelaufbau',
  days: [
    ['Montag', 'Kraft im Studio', 60],
    ['Mittwoch', 'Kraft im Studio', 60],
    ['Freitag', 'Kraft im Studio', 60],
  ] as [string, string, number][],
};

interface Db {
  rows: {
    plans: Record<string, unknown>[];
    plannedSessions: Record<string, unknown>[];
    sessionLogs: { id: string; planned_session_id: string | null; revision: number }[];
  };
}

async function readDb(page: Page): Promise<Db> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  return JSON.parse(raw ?? '{}') as Db;
}

async function writeDb(page: Page, db: Db) {
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
    LOCAL_DB,
    JSON.stringify(db),
  ] as const);
}

/** Heutiges Kraft-Training: erste Übung mit 20 kg × Vorgabe abhaken, Belastung und Notiz, speichern. */
async function trainToday(page: Page, notes = 'Griff eng') {
  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout')).toBeVisible();
  await page.getByTestId('workout-weight-input-0').click();
  await page.getByTestId('workout-weight-field-0').fill('20');
  await page.getByTestId('workout-weight-apply-0').click();
  const sets = page
    .getByTestId('workout-exercise-0')
    .getByRole('checkbox', { name: /^Satz \d+ geschafft$/ });
  const count = await sets.count();
  for (let i = 0; i < count; i += 1) await page.getByTestId(`workout-done-0-${i}`).click();
  await page.getByTestId('workout-effort-7').click();
  await page.getByTestId('workout-notes').fill(notes);
  await page.getByTestId('workout-save').click();
  await heading(page, 'Heute');
  await expect(page.getByTestId('workout-message')).toContainText('Training gespeichert');
  return count;
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('Woche: Status mit Zeichen und Wort, Summen, Blättern, nachgeholt am tatsächlichen Datum, entfallen', async ({
  page,
}) => {
  await onboard(page, STUDIO_3_DAYS);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  const sets = await trainToday(page);

  // Testdaten: Die erledigte Einheit war ursprünglich für Dienstag geplant (nachgeholt am Mittwoch, H2), und ein
  // ersetzter Plan hat am Donnerstag noch eine offene Einheit (Altlast → „entfallen“, H1).
  const db = await readDb(page);
  const log = db.rows.sessionLogs[0];
  if (!log) throw new Error('Eintrag fehlt');
  const done = db.rows.plannedSessions.find((s) => s.id === log.planned_session_id);
  if (!done) throw new Error('Einheit fehlt');
  done.original_date = '2026-10-06';
  db.rows.plans.push({ ...db.rows.plans[0], id: 'alter-plan', status: 'replaced' });
  db.rows.plannedSessions.push({
    ...done,
    id: 'alte-einheit',
    plan_id: 'alter-plan',
    scheduled_on: '2026-10-08',
    original_date: null,
    status: 'planned',
    name_de: 'Alte Einheit',
  });
  await writeDb(page, db);
  await page.goto('/');
  await heading(page, 'Heute');

  await page.getByTestId('today-week').click();
  await heading(page, 'Woche');
  await expect(page.getByTestId('week-range')).toHaveText('05.10.2026 bis 11.10.2026');
  const wednesday = page.getByTestId('week-day-2026-10-07');
  await expect(wednesday).toContainText('◐ Teilweise erledigt');
  await expect(wednesday).toContainText('nachgeholt vom 06.10.2026');
  await expect(page.getByTestId('week-day-2026-10-08')).toContainText('× Entfallen: Alte Einheit');
  await expect(page.getByTestId('week-day-2026-10-08')).toContainText('früheren Plan');
  await expect(page.getByTestId('week-day-2026-10-09')).toContainText('○ Geplant');
  await expect(page.getByTestId('week-day-2026-10-10')).toContainText('Ruhetag');
  const summary = page.getByTestId('week-summary');
  await expect(summary).toContainText('Einheiten: 1 geschafft');
  await expect(summary).toContainText(`Kraft: ${sets} Sätze`);
  await expect(summary).toContainText('Ausdauer: 0 min, 0,0 km');

  // Blättern: nächste Woche (nur geplant), zurück; ganz am Anfang ist „Vorwoche“ gesperrt.
  await page.getByTestId('week-next').click();
  await expect(page.getByTestId('week-range')).toHaveText('12.10.2026 bis 18.10.2026');
  await expect(page.getByTestId('week-day-2026-10-12')).toContainText('○ Geplant');
  await expect(page.getByTestId('week-summary')).toContainText('Einheiten: 0 geschafft');
  await page.getByTestId('week-prev').click();
  await expect(page.getByTestId('week-range')).toHaveText('05.10.2026 bis 11.10.2026');
  // Der Plan beginnt in dieser Woche – davor gibt es nichts.
  await expect(page.getByTestId('week-prev')).toBeDisabled();

  // Eintrag aus der Woche öffnen.
  await wednesday.getByRole('link', { name: /Ansehen/ }).click();
  const entry = page.getByTestId('log-entry');
  await expect(entry).toBeVisible();
  await expect(entry.getByText('Trainiert am 07.10.2026')).toBeVisible();
  await expect(entry.getByText('Nachgeholt vom 06.10.2026')).toBeVisible();
});

test('Verlauf: Eintrag ansehen, ändern und löschen; Verlauf je Übung; leerer Zustand', async ({
  page,
}) => {
  await onboard(page, STUDIO_3_DAYS);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');

  // Leer: noch keine Einträge.
  await page.getByTestId('today-history').click();
  await heading(page, 'Verlauf');
  await expect(page.getByTestId('history-empty')).toHaveText(
    'Noch keine Einträge – dein erstes Training erscheint hier.',
  );
  await page.getByRole('button', { name: 'Zurück' }).click();
  await heading(page, 'Heute');

  await trainToday(page, 'Griff eng');
  await page.getByTestId('today-history').click();
  await heading(page, 'Verlauf');
  await expect(page.getByTestId('history-week-2026-10-05')).toContainText('Woche ab 05.10.2026');
  const entry = page.getByTestId('history-entry');
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText('Mittwoch, 07.10.');
  await expect(entry).toContainText('teilweise');

  // Ansehen: Sätze, Belastung, Notiz.
  await entry.click();
  await expect(page.getByTestId('log-entry')).toBeVisible();
  await expect(page.getByTestId('log-status')).toHaveText('Teilweise erledigt');
  await expect(page.getByText('Belastung: 7 – schwer')).toBeVisible();
  await expect(page.getByTestId('log-notes')).toHaveText('Griff eng');
  const first = page.getByTestId('log-exercise').first();
  await expect(first).toContainText('Satz 1: 20 kg ×');

  // Verlauf je Übung: bester Satz „Gewicht × Wiederholungen“.
  await first.getByRole('link', { name: /^Verlauf: / }).click();
  await expect(page.getByTestId('exercise-history')).toBeVisible();
  await expect(page.getByTestId('exercise-history-entry').first()).toContainText('20 kg ×');
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page.getByTestId('log-entry')).toBeVisible();

  // Ändern: Trainingsmodus im Änderungs-Modus, Belastung 5 → zurück im Eintrag sichtbar.
  await page.getByTestId('log-edit').click();
  await expect(
    page.getByText('Du änderst ein gespeichertes Training.', { exact: false }),
  ).toBeVisible();
  await page.getByTestId('workout-effort-5').click();
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('log-entry')).toBeVisible();
  await expect(page.getByText('Belastung: 5 – mittel')).toBeVisible();
  expect((await readDb(page)).rows.sessionLogs[0]?.revision).toBe(2);

  // Löschen mit Nachfrage → Eintrag weg, Einheit wieder offen.
  await page.getByTestId('log-delete').click();
  await expect(page.getByTestId('dialog-delete-log')).toContainText('Eintrag löschen?');
  await page.getByRole('button', { name: 'Endgültig löschen' }).click();
  await expect(page.getByTestId('log-message')).toHaveText('Eintrag gelöscht.');
  expect((await readDb(page)).rows.sessionLogs).toHaveLength(0);
  await page.getByRole('button', { name: 'Zurück zum Verlauf' }).click();
  await heading(page, 'Verlauf');
  await expect(page.getByTestId('history-empty')).toBeVisible();
  await page.getByRole('button', { name: 'Zurück' }).click();
  await heading(page, 'Heute');
  await expect(page.getByTestId('workout-start')).toHaveText('Training starten');
});

test('Export: Hinweis vor dem Herunterladen, Datei mit Tagebuch, Konto und Einwilligungs-Verlauf', async ({
  page,
}) => {
  await onboard(page, STUDIO_3_DAYS);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await trainToday(page, 'Griff eng');

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await heading(page, 'Einstellungen');
  await page.getByTestId('settings-export').click();
  const dialog = page.getByTestId('dialog-export');
  await expect(dialog).toContainText(
    'Diese Datei enthält Gesundheitsdaten – gib sie nur weiter, wenn du das willst.',
  );
  await expect(dialog).toContainText('Download-Ordner');
  // Abbrechen speichert nichts.
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByTestId('settings-export').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Datei herunterladen' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('alpha5-meine-daten-2026-10-07.json');
  await expect(page.getByTestId('settings-export-message')).toHaveText(
    'Die Datei wurde heruntergeladen.',
  );
  const path = await download.path();
  const file = JSON.parse(readFileSync(path, 'utf8')) as {
    format_version: number;
    account: { email: string | null };
    data: Record<string, { [key: string]: unknown }[]>;
  };
  expect(file.format_version).toBe(1);
  expect(file.account).toEqual({ email: null });
  expect(file.data.session_logs).toHaveLength(1);
  expect(file.data.session_logs?.[0]?.notes).toBe('Griff eng');
  expect(file.data.set_logs?.length).toBeGreaterThan(0);
  expect(file.data.consents?.map((c) => c.consent_type).sort()).toEqual(['privacy', 'terms']);
  expect(Object.keys(file.data)).toHaveLength(20);
  // Nichts vom Export im Gerätespeicher (außer dem ohnehin vorhandenen Testmodus-Speicher).
  const keys = await page.evaluate(() => Object.keys(window.localStorage));
  expect(keys.some((key) => /export/i.test(key))).toBe(false);
});

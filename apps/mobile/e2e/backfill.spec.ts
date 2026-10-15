import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Nachtragen und freie Einheit (docs/PLAN-AUSWERTUNG.md 4, Etappe A1b) im TESTMODUS, Web-Export, Handy-Ansicht.
 * Plan am Montag, 05.10.2026 erstellt (Kraft im Studio Di + Fr). Danach ist „heute“ Donnerstag, 08.10.2026: die
 * Di-Einheit (06.10.) ist verpasst und kann nachgetragen werden; „+ Einheit“ geht bis 24.09. (14 Tage zurück).
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const MONDAY = new Date('2026-10-05T09:00:00+02:00');
const THURSDAY = new Date('2026-10-08T09:00:00+02:00');
const DI = '2026-10-06';
const MI = '2026-10-07';
const DO = '2026-10-08';

interface StoredLog {
  id: string;
  planned_session_id: string | null;
  performed_on: string;
  name_de: string;
  is_free: boolean;
  kind: string;
}

async function storedLogs(page: Page): Promise<StoredLog[]> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  const rows = (JSON.parse(raw ?? '{}') as { rows: { sessionLogs?: StoredLog[] } }).rows;
  return [...(rows.sessionLogs ?? [])].sort((a, b) => a.performed_on.localeCompare(b.performed_on));
}

async function setup(page: Page) {
  await page.clock.setFixedTime(MONDAY);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent: false,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Dienstag', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  // Drei Tage später: Dienstag ist verpasst.
  await page.clock.setFixedTime(THURSDAY);
  await page.reload();
  await heading(page, 'Heute');
  await page.getByTestId('today-calendar').click();
  await heading(page, 'Kalender');
}

test('Geplante Einheit von vorgestern nachtragen: Datum, „nachgetragen“ in Kalender und Woche', async ({
  page,
}) => {
  await setup(page);
  // Zukunft: kein „+ Einheit“; heute und Vergangenheit: ja.
  await expect(page.getByTestId(`calendar-add-${DO}`)).toBeVisible();
  await expect(page.getByTestId('calendar-add-2026-10-09')).toHaveCount(0);
  await expect(page.getByTestId(`calendar-add-${DI}`)).toHaveAccessibleName(
    'Einheit für Dienstag, 06.10. eintragen',
  );
  await page.getByTestId(`calendar-add-${DI}`).click();

  await heading(page, 'Einheit eintragen');
  await expect(page.getByTestId('backfill-day')).toHaveText('Für Dienstag, 06.10.');
  const planned = page.getByTestId('backfill-planned').getByRole('button', { name: /nachtragen$/ });
  await expect(planned).toHaveCount(1);
  await planned.click();

  // Trainingsmodus mit Datum (nur beim Nachtragen).
  await expect(page.getByTestId('workout-date-text')).toHaveText('Trainiert am Dienstag, 06.10.');
  await page.getByTestId('workout-date-change').click();
  await expect(page.getByRole('radio', { name: 'Donnerstag, 08.10.' })).toBeVisible();
  // Sonntag davor (± 1 Tag) ist erlaubt, Samstag nicht.
  await expect(page.getByRole('radio', { name: 'Sonntag, 04.10.' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Samstag, 03.10.' })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Mittwoch, 07.10.' }).click();
  await expect(page.getByTestId('workout-date-text')).toHaveText('Trainiert am Mittwoch, 07.10.');
  await page.getByTestId('workout-done-0-0').click();
  await page.getByTestId('workout-save').click();

  await heading(page, 'Kalender');
  const logs = await storedLogs(page);
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({ performed_on: MI, is_free: false });
  expect(logs[0]?.planned_session_id).not.toBeNull();
  // Kalender: Eintrag am Mittwoch mit „nachgetragen“, die Einheit am Dienstag ist erledigt.
  await expect(page.getByTestId(`calendar-log-${MI}`)).toContainText('nachgetragen');
  await expect(page.getByTestId(`calendar-fixed-${DI}`)).toContainText('✓ erledigt');
  // Mittwoch ist jetzt mit einer geplanten Einheit belegt (nie stapeln) – Dienstag bietet nichts mehr an.
  await page.getByTestId(`calendar-add-${DI}`).click();
  await expect(page.getByTestId('backfill-planned-blocked')).toHaveText([
    'Ganzkörper A: schon eingetragen',
    /^Ganzkörper B: liegt noch vor dir/,
  ]);
  await page.getByRole('button', { name: 'Zurück zum Kalender' }).click();
  await heading(page, 'Kalender');

  // Woche zeigt „nachgetragen“.
  await page.goto('/week');
  await heading(page, 'Woche');
  await expect(page.getByTestId(`week-day-${MI}`)).toContainText('nachgetragen');
});

test('Freie Einheit: Lauf 30 min heute und Kraft aus der Bibliothek – im Kalender, als „frei“', async ({
  page,
}) => {
  await setup(page);
  await page.getByTestId(`calendar-add-${DO}`).click();
  await heading(page, 'Einheit eintragen');
  await page.getByRole('radio', { name: 'Ausdauer' }).click();
  await page.getByRole('radio', { name: 'Laufen' }).click();
  await page.getByTestId('backfill-start').click();

  await expect(page.getByTestId('workout-free')).toContainText('Freie Einheit');
  // Ohne Dauer: verständlicher Fehler, nichts gespeichert.
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout-error')).toHaveText('Bitte prüfe die markierten Angaben.');
  await page.getByTestId('workout-cardio-minutes').fill('30');
  await page.getByTestId('workout-cardio-distance').fill('5,2');
  await page.getByTestId('workout-save').click();
  await heading(page, 'Kalender');
  await expect(page.getByTestId(`calendar-log-${DO}`)).toHaveText('✓ Lauf · frei');

  // Kraft am Mittwoch: Übung suchen und wählen (Ansage über die Live-Region).
  await page.getByTestId(`calendar-add-${MI}`).click();
  await heading(page, 'Einheit eintragen');
  await page.getByRole('radio', { name: /^Kraft/ }).click();
  await page.getByTestId('backfill-start').click();
  await expect(page.getByTestId('backfill-error')).toHaveText('Bitte wähle mindestens eine Übung.');
  await page.getByTestId('backfill-search').fill('kniebeuge');
  const first = page.getByRole('checkbox').first();
  const name = (await first.getAttribute('aria-label'))?.replace(/ wählen$/, '') ?? '';
  expect(name.toLowerCase()).toContain('kniebeuge');
  await first.click();
  await expect(page.getByTestId('backfill').getByTestId('calendar-live')).toContainText(
    '1 Übung gewählt',
  );
  await expect(page.getByTestId('backfill-selected')).toHaveText('1 Übung gewählt');
  await page.getByTestId('backfill-start').click();

  await expect(page.getByTestId('workout-free')).toBeVisible();
  // Kein Satz abgehakt → Grund statt stiller Fehlfunktion.
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout-error')).toContainText('mindestens einen Satz ab');
  await page.getByTestId('workout-reps-0-0-plus').click();
  await page.getByTestId('workout-done-0-0').click();
  await page.getByTestId('workout-save').click();
  await heading(page, 'Kalender');
  await expect(page.getByTestId(`calendar-log-${MI}`)).toContainText('Freie Kraft-Einheit · frei');

  const logs = await storedLogs(page);
  expect(logs.map((l) => [l.performed_on, l.name_de, l.is_free, l.planned_session_id])).toEqual([
    [MI, 'Freie Kraft-Einheit', true, null],
    [DO, 'Lauf', true, null],
  ]);

  // Verlauf markiert beide als frei; die geplante Einheit am Dienstag bleibt verpasst/offen.
  await page.goto('/history');
  await heading(page, 'Verlauf');
  await expect(page.getByTestId('history-entry-markers').first()).toContainText('freie Einheit');
});

test('Vor 15 Tagen: „+ Einheit“ nicht möglich, Grund steht da', async ({ page }) => {
  await setup(page);
  await page.getByTestId('calendar-prev').click();
  await page.getByTestId('calendar-prev').click();
  await expect(page.getByTestId('calendar-range')).toContainText('21.09.');
  await expect(page.getByTestId('calendar-prev')).toBeDisabled();
  // 24.09. = genau 14 Tage zurück → möglich; 23.09. = 15 Tage → gesperrt mit Grund.
  await expect(page.getByTestId('calendar-add-2026-09-24')).toBeVisible();
  await expect(page.getByTestId('calendar-add-2026-09-23')).toHaveCount(0);
  await expect(page.getByTestId('calendar-add-blocked-2026-09-23')).toHaveText(
    'Nachtragen nur bis 14 Tage zurück',
  );
  // Direkt aufgerufen (z. B. alter Link): ebenfalls gesperrt mit Grund.
  await page.goto('/nachtragen?date=2026-09-23');
  await heading(page, 'Einheit eintragen');
  await expect(page.getByTestId('backfill-blocked')).toHaveText(
    'Nachtragen geht nur bis 14 Tage zurück.',
  );
  await expect(page.getByTestId('backfill-start')).toHaveCount(0);
  await page.goto('/nachtragen?date=2026-10-09');
  await expect(page.getByTestId('backfill-blocked')).toHaveText(
    'Eintragen geht nur für heute und vergangene Tage.',
  );
});

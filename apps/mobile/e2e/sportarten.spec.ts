import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Sportarten Stufe 2 (docs/PLAN-SPORTARTEN.md) im TESTMODUS, Web-Export, Handy-Ansicht (390 px):
 * - Padel 60 min nachtragen (Gewicht 80 kg, Anstrengung 6) → „ca. 545 kcal“ (6,8 MET × 80 kg × 1 h), am Tag, in der
 *   Woche (Tages-Blatt, „Sportarten diese Woche“) und im Tagebuch-Eintrag; zählt für keine geplante Einheit,
 * - Suche, Gruppen und „Zuletzt genutzt“; mit GPS nur die fünf GPS-Sportarten; Demo-Aufzeichnung SUP → Eintrag mit
 *   Distanz,
 * - Fußball am Vortag einer Kraft-Einheit → sanfter Hinweis im Tages-Blatt (nur Vorschlag).
 * Element-Bildschirmfotos nach $SCREENSHOT_DIR, wenn gesetzt.
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const THURSDAY = new Date('2026-10-22T09:00:00+02:00');
const FRIDAY = new Date('2026-10-23T09:00:00+02:00');
const WEDNESDAY = '2026-10-21';
const shots = process.env.SCREENSHOT_DIR;

interface StoredLog {
  id: string;
  name_de: string;
  kind: string;
  is_free: boolean;
  sport?: string | null;
  sport_duration_s?: number | null;
  sport_distance_m?: number | null;
  session_rpe: number | null;
  planned_session_id: string | null;
}

async function storedLogs(page: Page): Promise<StoredLog[]> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  return (
    (JSON.parse(raw ?? '{}') as { rows: { sessionLogs?: StoredLog[] } }).rows.sessionLogs ?? []
  );
}

async function setup(page: Page, today: Date, days: Parameters<typeof onboard>[1]['days']) {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  await page.clock.setFixedTime(today);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, { consent: true, level: /^Einsteiger/, goal: 'Muskelaufbau', days });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
}

async function enterSport(
  page: Page,
  options: {
    date: string;
    search: string;
    sport: string;
    hours: string;
    minutes: string;
    effort: number;
  },
) {
  await page.goto(`/nachtragen?date=${options.date}`);
  await heading(page, 'Einheit eintragen');
  await page.getByTestId('backfill-sport').click();
  await heading(page, 'Sportart eintragen');
  await page.getByTestId('sport-picker-search').fill(options.search);
  await page.getByTestId(`sport-picker-${options.sport}`).click();
  await page.getByTestId('sport-entry-hours').fill(options.hours);
  await page.getByTestId('sport-entry-minutes').fill(options.minutes);
  await page.getByTestId(`sport-entry-effort-${options.effort}`).click();
}

test('Padel 60 min nachtragen → kcal am Tag, in der Woche und im Tagebuch', async ({ page }) => {
  await setup(page, THURSDAY, [
    ['Dienstag', 'Kraft im Studio', 60],
    ['Freitag', 'Kraft im Studio', 60],
  ]);
  await page.goto(`/nachtragen?date=${WEDNESDAY}`);
  await heading(page, 'Einheit eintragen');
  await expect(page.getByTestId('backfill-sport')).toHaveText(/Andere Sportart/);
  await page.getByTestId('backfill-sport').click();
  await heading(page, 'Sportart eintragen');
  await expect(page.getByTestId('sport-entry-day')).toHaveText('Für Mittwoch, 21.10.');
  // Gruppen und Suche (ß/Umlaute egal).
  await expect(page.getByTestId('sport-picker')).toContainText('Rückschlag');
  await expect(page.getByTestId('sport-picker')).toContainText('Wintersport');
  if (shots) await page.screenshot({ path: `${shots}/sportart-auswahl.png`, fullPage: false });
  await page.getByTestId('sport-picker-search').fill('fussball');
  await expect(page.getByTestId('sport-picker-football')).toBeVisible();
  await expect(page.getByTestId('sport-picker-padel')).toHaveCount(0);
  await page.getByTestId('sport-picker-search').fill('pad');
  await page.getByTestId('sport-picker-padel').click();
  await expect(page.getByTestId('sport-picker-chosen')).toHaveText('Gewählt: Padel');
  // Keine Distanz bei Padel.
  await expect(page.getByTestId('sport-entry-distance')).toHaveCount(0);
  // Ohne Dauer: klare Meldung.
  await page.getByTestId('sport-entry-save').click();
  await expect(page.getByTestId('sport-entry-duration-error')).toHaveText(
    'Bitte die Dauer angeben.',
  );
  await page.getByTestId('sport-entry-hours').fill('1');
  await page.getByTestId('sport-entry-minutes').fill('0');
  await page.getByTestId('sport-entry-effort-6').click();
  await expect(page.getByTestId('sport-entry-kcal')).toHaveText('ca. 545 kcal');
  await expect(page.getByTestId('sport-entry-load')).toHaveText('Belastung: 360 Punkte');
  if (shots)
    await page
      .getByTestId('sport-entry-form')
      .screenshot({ path: `${shots}/sportart-formular.png` });
  await page.getByTestId('sport-entry-save').click();

  // Tag: Padel mit kcal.
  await expect(page).toHaveURL(new RegExp(`/tag/${WEDNESDAY}`));
  const item = page.getByTestId('day-training-item').filter({ hasText: 'Padel' });
  await expect(item.getByTestId('session-kcal-value')).toHaveText('ca. 545 kcal');
  if (shots) await item.screenshot({ path: `${shots}/sportart-tag.png` });

  // Gespeichert als freie Einheit mit Sportart, ohne Planbezug.
  const logs = await storedLogs(page);
  expect(logs.find((l) => l.name_de === 'Padel')).toMatchObject({
    kind: 'strength',
    is_free: true,
    sport: 'padel',
    sport_duration_s: 3600,
    sport_distance_m: null,
    session_rpe: 6,
    planned_session_id: null,
  });

  // Woche: Mittwoch zeigt Padel; Tages-Blatt mit Dauer und kcal; Summen je Sportart.
  await page.goto('/week');
  await heading(page, 'Deine Woche');
  await expect(page.getByTestId(`week-day-${WEDNESDAY}`)).toContainText('Padel');
  const sum = page.getByTestId('sport-week-padel');
  await expect(sum).toContainText('Padel');
  await expect(sum).toContainText('1 Einheit · 1 h · ca. 545 kcal · 360 Punkte');
  await expect(page.getByTestId('sport-week-load')).toContainText('Trainingsbelastung der Woche');
  if (shots)
    await page.getByTestId('sport-week').screenshot({ path: `${shots}/sportart-woche-summen.png` });
  await page.getByTestId(`week-day-${WEDNESDAY}`).click();
  const sheet = page.getByTestId('day-sheet');
  await expect(sheet.getByTestId('day-sheet-entry')).toContainText('Padel');
  await expect(sheet.getByTestId('day-sheet-entry')).toContainText('1:00:00');
  await expect(sheet.getByTestId('day-sheet-entry')).toContainText('545 kcal');
  await expect(sheet.getByTestId('day-sheet-counts')).toContainText('Zusätzliche Einheit');
  await expect(sheet.getByTestId('day-sheet-change')).toHaveCount(0);
  if (shots) await sheet.screenshot({ path: `${shots}/sportart-tagesblatt.png` });

  // Tagebuch-Eintrag: Sportart, Dauer, Belastung, kcal.
  await sheet.getByTestId('day-sheet-view').click();
  const entry = page.getByTestId('log-entry');
  await expect(entry.getByTestId('log-sport')).toContainText('Sportart: Padel');
  await expect(entry.getByTestId('log-sport-load')).toContainText('360 Punkte');
  await expect(entry.getByTestId('session-kcal-value')).toHaveText('ca. 545 kcal');

  // „Zuletzt genutzt“ beim nächsten Eintrag.
  await page.goto(`/sportart?date=${WEDNESDAY}`);
  await expect(page.getByTestId('sport-picker-recent')).toContainText('Padel');
});

test('mit GPS: nur GPS-Sportarten; Demo-Aufzeichnung SUP → Eintrag mit Distanz', async ({
  page,
}) => {
  await setup(page, THURSDAY, [
    ['Dienstag', 'Kraft im Studio', 60],
    ['Freitag', 'Kraft im Studio', 60],
  ]);
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await page.getByTestId('endurance-gps-sport').click();
  await heading(page, 'Sportart mit GPS');
  const picker = page.getByTestId('sport-picker');
  for (const id of ['cross_country_skiing', 'ski_touring', 'inline_skating', 'sup', 'kayaking']) {
    await expect(page.getByTestId(`sport-picker-${id}`)).toBeVisible();
  }
  await expect(page.getByTestId('sport-picker-padel')).toHaveCount(0);
  await expect(picker.getByRole('radio')).toHaveCount(5);
  if (shots) await page.screenshot({ path: `${shots}/sportart-gps-auswahl.png` });
  await page.getByTestId('sport-picker-sup').click();
  await page.getByTestId('sport-entry-demo').click();
  await expect(page.getByTestId('record-live')).toBeVisible();
  await expect(page.getByRole('heading', { name: /SUP – Aufzeichnung/ })).toBeVisible();
  await expect
    .poll(
      async () =>
        Number(
          ((await page.getByTestId('record-distance').textContent()) ?? '0')
            .replace(' km', '')
            .replace(',', '.'),
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0.3);
  await page.getByTestId('record-stop').click();
  await page.getByTestId('record-stop-dialog').getByRole('button', { name: 'Ja, beenden' }).click();
  const save = page.getByTestId('sport-record-save');
  await expect(save).toContainText('SUP speichern');
  await expect(save).toContainText(
    'Die Karte der Strecke wird für diese Sportart noch nicht gespeichert',
  );
  if (shots) await save.screenshot({ path: `${shots}/sportart-gps-speichern.png` });
  await page.getByTestId('sport-record-save-button').click();
  await expect(page).toHaveURL(/\/tag\/2026-10-22/);
  const logs = await storedLogs(page);
  const sup = logs.find((l) => l.sport === 'sup');
  expect(sup).toMatchObject({ name_de: 'SUP', is_free: true });
  expect(sup?.sport_distance_m ?? 0).toBeGreaterThan(300);
});

test('Fußball heute → Hinweis für die harte Bein-Einheit morgen (nur Vorschlag)', async ({
  page,
}) => {
  await setup(page, FRIDAY, [
    ['Samstag', 'Kraft im Studio', 60],
    ['Dienstag', 'Kraft im Studio', 60],
  ]);
  await enterSport(page, {
    date: '2026-10-23',
    search: 'fuß',
    sport: 'football',
    hours: '1',
    minutes: '30',
    effort: 7,
  });
  await page.getByTestId('sport-entry-save').click();
  await expect(page).toHaveURL(/\/tag\/2026-10-23/);
  await page.goto('/week');
  await heading(page, 'Deine Woche');
  await page.getByTestId('week-day-2026-10-24').click();
  const hint = page.getByTestId('day-sheet').getByTestId('day-sheet-leg-hint');
  await expect(hint).toContainText('Nach Fußball (Fr)');
  await expect(hint).toContainText('Nur ein Vorschlag');
  if (shots)
    await page.getByTestId('day-sheet').screenshot({ path: `${shots}/sportart-bein-hinweis.png` });
});

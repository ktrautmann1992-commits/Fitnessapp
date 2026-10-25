import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Kraft-Entwicklung im TESTMODUS (Gründer-Freigabe 25.10.2026, KONZEPT 11.4): ein echtes Training über den
 * Trainingsmodus, dazu vier ältere Einträge derselben Übung im Gerätespeicher (eine Erholungswoche). Kachel unter
 * Fortschritt mit Mini-Kurve → Verlauf der Übung mit Kurve, Umschaltern Gewicht/Volumen/Wiederholungen und 4 W/3 M/
 * Alles → Eintrag mit „+7,5 kg gegenüber vor 4 Wochen“. Neutral: kein „Rekord“, keine „Bestleistung“.
 * Fester Tag: Mittwoch, 07.10.2026. Mit SCREENSHOT_DIR entstehen Bilder (390 px, hell) – in CI nicht.
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');

async function shot(page: Page, name: string) {
  const dir = process.env.SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
}

type Row = Record<string, unknown>;
interface Db {
  rows: { sessionLogs: Row[]; exerciseLogs: Row[]; setLogs: Row[] };
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

test('Kraft-Entwicklung: Kachel, Kurve mit Umschaltern, Vergleich im Eintrag', async ({ page }) => {
  test.setTimeout(180_000);
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await onboard(page, {
    consent: false,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft im Studio', 60],
      ['Mittwoch', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');

  // Fortschritt ohne Einträge: Hinweis, wann die Kachel etwas zeigt.
  await page.goto('/fortschritt');
  await expect(page.getByTestId('strength-tile-empty')).toContainText('zweimal');
  await page.goto('/today');
  await heading(page, 'Heute');

  // Heute: erste Übung mit 20 kg abhaken.
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
  await page.getByTestId('workout-save').click();
  await heading(page, 'Heute');

  // Vier ältere Einträge derselben Übung (12,5 → 15 → Erholungswoche 10 → 17,5 kg).
  const db = await readDb(page);
  const log = db.rows.sessionLogs[0] as Row;
  const exercise = db.rows.exerciseLogs.find(
    (e) => e.session_log_id === log.id && e.order_no === 1,
  ) as Row;
  const name = String(exercise.exercise_name_de);
  const done = db.rows.setLogs.filter((s) => s.exercise_log_id === exercise.id && s.done);
  const past: [string, number, boolean][] = [
    ['2026-09-09', 12.5, false],
    ['2026-09-16', 15, false],
    ['2026-09-23', 10, true],
    ['2026-09-30', 17.5, false],
  ];
  past.forEach(([date, kg, deload], i) => {
    const logId = `alt-log-${i}`;
    const exId = `alt-ex-${i}`;
    db.rows.sessionLogs.push({
      ...log,
      id: logId,
      planned_session_id: null,
      is_free: true,
      performed_on: date,
      is_deload: deload,
      finished_at: `${date}T18:00:00.000Z`,
      client_updated_at: `${date}T18:00:00.000Z`,
      notes: null,
    });
    db.rows.exerciseLogs.push({ ...exercise, id: exId, session_log_id: logId });
    for (const s of done) db.rows.setLogs.push({ ...s, exercise_log_id: exId, weight_kg: kg });
  });
  await writeDb(page, db);

  // Kachel unter Fortschritt.
  await page.goto('/fortschritt');
  const tile = page.getByTestId('progress-strength');
  await expect(tile).toContainText('Kraft-Entwicklung');
  const row = tile.getByTestId(`strength-tile-${String(exercise.exercise_id)}`);
  await expect(row).toContainText(name);
  await expect(row).toContainText('20 kg');
  await expect(row).toContainText('+7,5 kg gegenüber vor 4 Wochen');
  await expect(
    row.getByTestId(`strength-tile-${String(exercise.exercise_id)}-spark`),
  ).toHaveAttribute('aria-label', /von 12,5 Kilogramm auf 20 Kilogramm/);
  await tile.scrollIntoViewIfNeeded();
  await shot(page, '06-fortschritt-kraft-entwicklung');

  // Verlauf der Übung: Kurve, Umschalter.
  await row.click();
  await expect(page.getByTestId('exercise-history')).toBeVisible();
  const section = page.getByTestId('strength-section');
  await expect(section.getByTestId('strength-compare')).toHaveText(
    '+7,5 kg gegenüber vor 4 Wochen',
  );
  await expect(section.getByRole('radio', { name: /Gewicht/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(section.getByTestId('strength-chart')).toHaveAttribute(
    'aria-label',
    /Gewicht: 5 Trainings vom 09\.09\.2026 bis 07\.10\.2026/,
  );
  await expect(section).toContainText('Hohler Punkt = Erholungswoche');
  await shot(page, '07-uebung-kurve-gewicht');
  await section.getByTestId('strength-range-4w').click();
  await expect(section.getByTestId('strength-chart')).toHaveAttribute('aria-label', /4 Trainings/);
  await section.getByTestId('strength-metric-volume').click();
  await expect(section.getByTestId('strength-compare')).toContainText('kg gegenüber vor 4 Wochen');
  await section.getByTestId('strength-metric-reps').click();
  await expect(section.getByTestId('strength-compare')).toHaveText('gleich wie vor 4 Wochen');
  await section.getByTestId('strength-range-all').click();
  await section.getByTestId('strength-metric-volume').click();
  await shot(page, '08-uebung-kurve-volumen');
  await expect(page.getByTestId('exercise-history')).not.toContainText(/Rekord|Bestleistung|1RM/);

  // Eintrag von heute: Vergleich je Übung.
  await page.goto(`/log/${String(log.id)}`);
  await expect(page.getByTestId('log-entry')).toBeVisible();
  await expect(page.getByTestId('log-exercise-compare').first()).toHaveText(
    `${name}: +7,5 kg gegenüber vor 4 Wochen`,
  );
  // Erholungswoche: bewusst leichter.
  await page.goto('/log/alt-log-2');
  await expect(page.getByTestId('log-exercise-compare').first()).toHaveText(
    `${name}: Erholungswoche – bewusst leichter.`,
  );
});

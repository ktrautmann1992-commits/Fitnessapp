import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Bereiche im Reiter „Workouts“ (Gründer-Wunsch 29.10.2026, docs/PLAN-WORKOUTS.md Abschnitt 6) im TESTMODUS:
 * Entspannung, Yoga & Pilates, Hyrox, Calisthenics, CrossFit-Stil und „Neues ausprobieren“ sind für JEDEN sichtbar –
 * hier für eine Person mit Muskelaufbau-Plan im Studio. Fehlende Geräte: Hinweis statt Ausblenden. Ein AMRAP läuft bis
 * zum Zeitlimit, landet als freie Einheit im Tagebuch, der Plan bleibt unverändert.
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const MONDAY = new Date('2026-10-05T09:00:00+02:00');

interface StoredRows {
  sessionLogs?: { is_free: boolean; source: string; notes: string | null }[];
  plans?: unknown[];
  plannedSessions?: unknown[];
  plannedExercises?: unknown[];
}

async function storedRows(page: Page): Promise<StoredRows> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  return (JSON.parse(raw ?? '{}') as { rows?: StoredRows }).rows ?? {};
}

async function setup(page: Page) {
  await page.clock.install({ time: MONDAY });
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
  await heading(page, 'Training');
  await page.getByTestId('today-switch-workouts').click();
  await expect(page.getByTestId('workouts-list')).toBeVisible();
}

const count = (page: Page) => page.getByTestId('workouts-count');
const card = (page: Page, id: string) => page.getByTestId(`workout-card-${id}`);
const chip = (page: Page, theme: string) => page.getByTestId(`workouts-theme-${theme}`);

test('Bereiche für jeden sichtbar: Entspannung, Yoga & Pilates, Hyrox, Calisthenics, CrossFit-Stil, Neues ausprobieren', async ({
  page,
}) => {
  await setup(page);
  // Chips stehen immer über der Liste (nicht im zugeklappten Filter), mit Anzahl.
  await expect(page.getByTestId('workouts-themes')).toBeVisible();
  await expect(chip(page, 'hyrox')).toHaveText('Hyrox (3)');
  await expect(chip(page, 'calisthenics')).toHaveText('Calisthenics (3)');
  await expect(chip(page, 'functional')).toHaveText('CrossFit-Stil / Functional Fitness (6)');

  await chip(page, 'relax').click();
  await expect(page.getByTestId('workouts-theme-intro')).toContainText('Body-Scan');
  await expect(card(page, 'entspannung-atmen-loslassen')).toBeVisible();
  await expect(card(page, 'entspannung-fuenf-minuten')).toBeVisible();
  await expect(card(page, 'bauch-blitz')).toHaveCount(0);

  await chip(page, 'yoga_pilates').click();
  await expect(card(page, 'yoga-stuhl')).toBeVisible();
  await expect(card(page, 'pilates-im-stehen')).toBeVisible();

  // Hyrox: Studio ohne „Hyrox-Geräte“ → Hinweis auf der Karte, aber sichtbar und startbar.
  await chip(page, 'hyrox').click();
  await expect(count(page)).toHaveText('3 Workouts');
  await expect(card(page, 'hyrox-stationen-studio')).toContainText('Hyrox');
  await expect(page.getByTestId('workout-card-hyrox-stationen-studio-missing')).toContainText(
    'Dir fehlt laut deinen Angaben',
  );
  await expect(page.getByTestId('workout-card-hyrox-einsteiger-ohne-geraete-missing')).toHaveCount(
    0,
  );
  await card(page, 'hyrox-stationen-studio').click();
  await heading(page, 'Hyrox-Stationen im Studio');
  await expect(page.getByTestId('workout-equipment-missing')).toBeVisible();
  await expect(page.getByTestId('workout-start')).toBeEnabled();
  await page.getByTestId('workout-detail-back').click();

  await chip(page, 'calisthenics').click();
  await expect(card(page, 'calisthenics-grundlagen')).toBeVisible();
  await expect(card(page, 'calisthenics-park')).toBeVisible();

  await chip(page, 'functional').click();
  await expect(count(page)).toHaveText('6 Workouts');
  await expect(card(page, 'wod-emom-zuhause')).toBeVisible();

  // Neues ausprobieren: je Sportart der leichteste Einstieg.
  await chip(page, 'try_new').click();
  await expect(card(page, 'hyrox-einsteiger-ohne-geraete')).toBeVisible();
  await expect(card(page, 'calisthenics-grundlagen')).toBeVisible();
  await expect(card(page, 'rudern-einstieg')).toBeVisible();
  await expect(card(page, 'hyrox-stationen-studio')).toHaveCount(0);

  // Leer-Zustand: Bereich + Filter ohne Treffer → klarer Hinweis, zurück zu allen Bereichen.
  await chip(page, 'hyrox').click();
  await page.getByTestId('workouts-filter-toggle').click();
  await page.getByTestId('workouts-filter-stars-5').click();
  await expect(page.getByTestId('workouts-no-match')).toContainText('In diesem Bereich');
  await page.getByTestId('workouts-theme-reset').click();
  await expect(count(page)).toHaveText('4 Workouts');
});

test('AMRAP im CrossFit-Stil: Zeitlimit beendet den Timer, freie Einheit im Tagebuch, Plan unverändert', async ({
  page,
}) => {
  await setup(page);
  const before = await storedRows(page);
  expect(before.plans?.length ?? 0).toBeGreaterThan(0);
  await chip(page, 'functional').click();
  await card(page, 'wod-amrap-zuhause').click();
  await heading(page, 'AMRAP 12 – Körpergewicht');
  await expect(page.getByTestId('workout-detail-how')).toContainText('AMRAP');
  await expect(page.getByTestId('workout-detail-scaling')).toContainText('Einsteiger');

  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout-timer-cap')).toHaveText(/^Zeitlimit: noch 1[12]:\d\d$/);
  await page.clock.fastForward(6000); // Vorbereitung
  // Runde 1: Burpees (30 s) laufen ab, dann Wiederholungen abhaken.
  await page.clock.fastForward(31_000);
  await page.getByTestId('workout-timer-done').click();
  await page.getByTestId('workout-timer-done').click();
  await page.getByTestId('workout-timer-done').click();
  // Bis zum Zeitlimit vorspulen.
  await page.clock.fastForward(12 * 60 * 1000);
  await heading(page, 'Geschafft!');
  await expect(page.getByTestId('workout-finish-cap')).toHaveText('Zeitlimit erreicht');
  await expect(page.getByTestId('workout-finish-wod')).toHaveText(
    /^Ergebnis: 1 Runde \+ \d+ Übung/,
  );
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout-saved')).toContainText('Gespeichert');

  const after = await storedRows(page);
  const log = after.sessionLogs?.[0];
  expect(log?.is_free).toBe(true);
  expect(log?.source).toBe('workout');
  expect(log?.notes).toMatch(
    /^Workout „AMRAP 12 – Körpergewicht“ .*AMRAP: 1 Runden \+ \d+ Übungen/,
  );
  expect(log?.notes).toContain('Zeitlimit erreicht');
  // Plan unverändert (Pläne, Einheiten, Übungen).
  expect(after.plans).toEqual(before.plans);
  expect(after.plannedSessions).toEqual(before.plannedSessions);
  expect(after.plannedExercises).toEqual(before.plannedExercises);
});

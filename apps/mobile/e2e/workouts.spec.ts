import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Workout-Bibliothek (docs/PLAN-WORKOUTS.md) im TESTMODUS, Web-Export, Handy-Ansicht: eigener Reiter „Workouts“,
 * Liste filtern, Workout starten, Timer (Vorbereitung, Pause/Fortsetzen, Überspringen, Pause beenden, Beenden),
 * „Für heute speichern“ → freie Einheit mit Herkunft „workout“ am heutigen Tag, Karte „Heute erledigt“.
 * Die Uhr der Seite ist eine Test-Uhr (page.clock) – vorspulen statt warten.
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const MONDAY = new Date('2026-10-05T09:00:00+02:00');
const TODAY = '2026-10-05';

interface StoredLog {
  id: string;
  performed_on: string;
  is_free: boolean;
  source: string;
  notes: string | null;
  session_rpe: number | null;
}

async function storedLogs(page: Page): Promise<StoredLog[]> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  return (
    (JSON.parse(raw ?? '{}') as { rows?: { sessionLogs?: StoredLog[] } }).rows?.sessionLogs ?? []
  );
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
  // Seit „App verschlanken“ (26.10.2026): Umschalter „Workouts“ im Reiter „Training“.
  await page.getByTestId('today-switch-workouts').click();
  await expect(page.getByTestId('workouts-list')).toBeVisible();
}

const count = (page: Page) => page.getByTestId('workouts-count');
const card = (page: Page, id: string) => page.getByTestId(`workout-card-${id}`);

test('Liste filtern: Sterne, Ziel, ohne Geräte, Dauer, zurücksetzen', async ({ page }) => {
  await setup(page);
  // 27 freigegebene + 14 Yoga-/Pilates-/Mobility-Entwürfe (Testmodus, Sportarten Stufe 1); ohne Gesundheits-Check ist
  // „Sanft in den Morgen“ ausgeblendet (zu viele Umkehrhaltungen für den vorsichtigen Plan).
  await expect(count(page)).toHaveText('41 Workouts');
  // Karte: Sterne mit Wort, barrierefrei als ein Text.
  await expect(card(page, 'bauch-blitz')).toHaveAttribute(
    'aria-label',
    /Bauch-Blitz, Schwierigkeit 2 von 5 Sternen: eher leicht, 12 Min\./,
  );

  // Filter sind zugeklappt („Filter“ antippen).
  await page.getByTestId('workouts-filter-toggle').click();
  await page.getByTestId('workouts-filter-stars-5').click();
  await expect(count(page)).toHaveText('2 Workouts');
  await expect(card(page, 'koerpergewicht-extrem')).toBeVisible();
  await expect(card(page, 'bauch-blitz')).toHaveCount(0);

  await page.getByTestId('workouts-filter-stars-5').click();
  await page.getByTestId('workouts-filter-stars-1').click();
  await page.getByTestId('workouts-filter-category-core').click();
  await expect(count(page)).toHaveText('1 Workout');
  await expect(card(page, 'rumpf-basis')).toBeVisible();

  await page.getByTestId('workouts-filter-reset').click();
  await page.getByTestId('workouts-filter-no-equipment').click();
  await page.getByTestId('workouts-filter-duration-long').click();
  await expect(card(page, 'koerpergewicht-extrem')).toBeVisible();
  await expect(card(page, 'beine-intensiv-kurzhantel')).toHaveCount(0);

  // Kein Treffer: klarer Leer-Zustand.
  await page.getByTestId('workouts-filter-stars-1').click();
  await expect(page.getByTestId('workouts-no-match')).toBeVisible();
  await page.getByTestId('workouts-filter-reset').click();
  await expect(count(page)).toHaveText('41 Workouts');

  // „Workouts“ steht im Training – unter „Mehr“ nicht noch einmal (kein Doppel).
  await page.getByRole('tab', { name: 'Mehr' }).click();
  await expect(page.getByTestId('more-account')).toBeVisible();
  await expect(page.getByTestId('more-workouts')).toHaveCount(0);
  await expect(page.getByTestId('more-area-workouts')).toHaveCount(0);
});

test('Workout starten, Timer bedienen, abschließen → Eintrag am heutigen Tag, keine Doppel-Einträge', async ({
  page,
}) => {
  await setup(page);
  await card(page, 'bauch-blitz').click();
  await heading(page, 'Bauch-Blitz');
  await expect(page.getByTestId('workout-detail-stars')).toHaveAttribute(
    'aria-label',
    'Schwierigkeit 2 von 5 Sternen: eher leicht',
  );
  await expect(page.getByTestId('workout-testphase')).toHaveText(
    'Testphase – noch nicht fachlich geprüft',
  );
  await expect(page.getByTestId('workout-safety-warmup')).toBeVisible();
  await expect(page.getByTestId('workout-exercises')).toContainText('1. Dead Bug');

  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout-timer-kind')).toHaveText('Gleich geht’s los');
  await expect(page.getByTestId('workout-timer-remaining')).toHaveText('0:05');
  await expect(page.getByTestId('workout-timer-next')).toHaveText('Dead Bug · 30 s');

  // Vorbereitung läuft ab → erste Übung.
  await page.clock.fastForward(6000);
  await expect(page.getByTestId('workout-timer-step')).toHaveText('Dead Bug');
  await expect(page.getByTestId('workout-timer-progress')).toHaveText(
    'Runde 1 von 3 · 0 von 15 erledigt',
  );
  await expect(page.getByTestId('workout-timer-next')).toHaveText('Unterarmstütz · 30 s');

  // Pausieren hält die Zeit an.
  await page.getByTestId('workout-timer-pause').click();
  const frozen = await page.getByTestId('workout-timer-remaining').textContent();
  await expect(page.getByTestId('workout-timer-paused')).toBeVisible();
  await page.clock.fastForward(20_000);
  await expect(page.getByTestId('workout-timer-remaining')).toHaveText(frozen ?? '');
  await page.getByTestId('workout-timer-resume').click();
  await expect(page.getByTestId('workout-timer-paused')).toHaveCount(0);

  // Übung läuft ab → Pause; „Pause beenden“ → nächste Übung; diese überspringen.
  await page.clock.fastForward(31_000);
  await expect(page.getByTestId('workout-timer-step')).toHaveText('Pause');
  await expect(page.getByTestId('workout-timer-progress')).toContainText('1 von 15 erledigt');
  await page.getByTestId('workout-timer-skip').click();
  await expect(page.getByTestId('workout-timer-step')).toHaveText('Unterarmstütz');
  await page.getByTestId('workout-timer-skip').click();
  await expect(page.getByTestId('workout-timer-step')).toHaveText('Pause');

  // Vorzeitig beenden (mit Nachfrage).
  await page.getByTestId('workout-timer-end').click();
  await page.getByTestId('workout-end-dialog').getByRole('button', { name: 'Beenden' }).click();
  await heading(page, 'Workout beendet');
  await expect(page.getByTestId('workout-finish-summary')).toHaveText(/^1 von 15 erledigt/);
  await page.getByTestId('workout-rpe-6').click();
  await page.getByTestId('workout-note').fill('Kurz, aber gut');
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout-saved')).toContainText('Gespeichert');
  // Kein zweites Speichern desselben Laufs.
  await expect(page.getByTestId('workout-save')).toHaveCount(0);

  const logs = await storedLogs(page);
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({
    performed_on: TODAY,
    is_free: true,
    source: 'workout',
    session_rpe: 6,
  });
  expect(logs[0]?.notes).toMatch(
    /^Workout „Bauch-Blitz“ \(★★☆☆☆\) · 0\/3 Runden · \d+ Min\. · vorzeitig beendet\nKurz, aber gut$/,
  );

  // Am heutigen Tag sichtbar.
  await page.getByTestId('workout-finish-today').click();
  // (Die Hero-Karte von „Heute“ bleibt im Hintergrund geladen und zeigt denselben Namen – hier der Eintrag im Tag.)
  await expect(
    page.getByRole('link', { name: 'Freie Kraft-Einheit: Eintrag ansehen' }),
  ).toBeVisible();

  // Liste (auch nach dem Neuladen): Karte zeigt „Heute erledigt“.
  await page.goto('/workouts');
  await expect(page.getByTestId('workouts-list')).toBeVisible();
  await expect(card(page, 'bauch-blitz')).toContainText('Heute erledigt ✓');
});

test('Sätze × Wdh.: Satz abhaken, Satzpause, nächster Satz', async ({ page }) => {
  await setup(page);
  await card(page, 'kurzhantel-basis').click();
  await heading(page, 'Kurzhantel-Basis');
  await page.getByTestId('workout-start').click();
  await page.clock.fastForward(6000);
  await expect(page.getByTestId('workout-timer-step')).toHaveText('Goblet-Kniebeuge');
  await expect(page.getByTestId('workout-timer-reps')).toHaveText('10 Wiederholungen');
  await expect(page.getByTestId('workout-timer-progress')).toHaveText(
    'Satz 1 von 3 · 0 von 14 erledigt',
  );
  // Nach Wiederholungen läuft keine Zeit ab – wartet auf „Satz erledigt“.
  await page.clock.fastForward(120_000);
  await expect(page.getByTestId('workout-timer-step')).toHaveText('Goblet-Kniebeuge');
  await page.getByRole('button', { name: 'Satz erledigt ✓' }).click();
  await expect(page.getByTestId('workout-timer-step')).toHaveText('Satzpause');
  await expect(page.getByTestId('workout-timer-remaining')).toHaveText('1:00');
  await page.clock.fastForward(61_000);
  await expect(page.getByTestId('workout-timer-progress')).toHaveText(
    'Satz 2 von 3 · 1 von 14 erledigt',
  );
});

test('Yoga (Flow): Stuhl-Yoga mit Seitenwechsel, Pose überspringen; Kategorie Yoga; Heute-Karte und Schalter', async ({
  page,
}) => {
  await setup(page);
  // Kategorie „Yoga“ ist wählbar (Sportarten Stufe 1 · Etappe Y).
  await page.getByTestId('workouts-filter-toggle').click();
  await page.getByTestId('workouts-filter-category-yoga').click();
  await expect(count(page)).toHaveText('5 Workouts');
  await expect(card(page, 'yoga-sanft-in-den-morgen')).toHaveCount(0);
  await card(page, 'yoga-stuhl').click();
  await heading(page, 'Stuhl-Yoga');
  await expect(page.getByTestId('workout-test-content')).toBeVisible();
  await expect(page.getByTestId('workout-exercises')).toContainText('je Seite (rechts / links)');

  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('flow-player')).toBeVisible();
  await expect(page.getByTestId('flow-name')).toHaveText('Entspannung im Sitzen');
  await page.clock.fastForward(6000);
  await expect(page.getByTestId('flow-progress')).toHaveText('Pose 1 von 19');
  await expect(page.getByTestId('flow-remaining')).toHaveText(/^[01]:\d\d$/);
  await expect(page.getByTestId('flow-next')).toHaveText('Rumpfspannung im Sitzen');
  // Pose läuft ab → nächste Pose ohne Pausen-Bildschirm.
  await page.clock.fastForward(61_000);
  await expect(page.getByTestId('flow-name')).toHaveText('Rumpfspannung im Sitzen');
  await page.getByRole('button', { name: 'Pose überspringen' }).click();
  await expect(page.getByTestId('flow-name')).toHaveText('Seitneige im Sitzen');
  await expect(page.getByTestId('flow-side')).toHaveText('Rechte Seite');
  await expect(page.getByTestId('flow-next')).toHaveText('Seitneige im Sitzen · Linke Seite');
  await page.getByRole('button', { name: 'Pose überspringen' }).click();
  await expect(page.getByTestId('flow-side')).toHaveText('Linke Seite');
  await page.getByTestId('workout-timer-pause').click();
  await expect(page.getByTestId('flow-paused')).toBeVisible();
  await page.getByTestId('workout-timer-resume').click();

  await page.getByTestId('workout-timer-end').click();
  await page.getByTestId('workout-end-dialog').getByRole('button', { name: 'Beenden' }).click();
  await heading(page, 'Workout beendet');
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout-saved')).toContainText('Gespeichert');
  const logs = await storedLogs(page);
  expect(logs[0]?.notes).toMatch(/^Workout „Stuhl-Yoga“ \(★☆☆☆☆\) · 1\/19 Posen · /);

  // Heute (Montag, trainingsfrei): nach dem Workout kein Vorschlag mehr …
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-training')).toBeVisible();
  await expect(page.getByTestId('overview-recovery')).toHaveCount(0);
});

test('Heute: „Erholungstag: Mobility 15 min?“ an freien Tagen, abschaltbar in den Einstellungen', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-recovery')).toContainText(
    'Erholungstag: Mobility 15 min?',
  );
  await page.getByTestId('overview-recovery-open').click();
  await heading(page, 'Erholungstag 15 Minuten');

  await page.goto('/settings?thema=training');
  await page.getByTestId('settings-recovery-routine').click();
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-training')).toBeVisible();
  await expect(page.getByTestId('overview-recovery')).toHaveCount(0);
});

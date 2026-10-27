import { mkdirSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * „Erholung aus der Uhr“ (Gründer-Freigabe 25.10.2026, docs/PLAN-PHASE-8.md 15) im TESTMODUS, Handy-Ansicht 390 px,
 * mit der Beispiel-Uhr (21 Tage Schlaf/Ruhepuls/HRV; heute kurze Nacht, Ruhepuls höher, HRV niedriger → „niedrig“):
 * ohne Uhr Leerzustand mit „Uhr verbinden“ (eine Zeile, wie der Knopf der Kachel „Schritte“) → Beispiel-Uhr verbinden →
 * Kachel „Erholung“ mit Status, Gründen und 7-Tage-Verlauf → Smartwatch-Seite mit Werten und Regeln → „Heute“: Angebot
 * „Leichter trainieren“ / „Wie geplant“ (nie automatisch) → Trainingsmodus mit leichterer Vorgabe; das Angebot ist
 * gratis, auch ohne Live-Anpassung (Gründer-Entscheidung 26.10.2026). Fester Tag: Mittwoch, 28.10.2026 (Training Mo/Mi/Fr).
 */

const WEDNESDAY = new Date('2026-10-28T09:00:00+01:00');
const LOCAL_DB = 'fitnessapp.local.v1';
const shots = process.env.SCREENSHOT_DIR;

async function setup(page: Page) {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  await page.clock.setFixedTime(WEDNESDAY);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await onboard(page, {
    consent: true,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft im Studio', 60],
      ['Mittwoch', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
}

async function connectDemoWatch(page: Page) {
  await page.goto('/smartwatch');
  await expect(page.getByTestId('smartwatch')).toBeVisible();
  await page.getByTestId('smartwatch-consent-accept').click();
  await page.getByTestId('smartwatch-connect').click();
  await expect(page.getByTestId('smartwatch-message')).toContainText('Abgleich fertig');
}

/**
 * Die Beispiel-Uhr bringt gestern Abend eine Yoga-Einheit mit – „Heute“ fragt dann einmal, ob sie die heutige Einheit
 * ersetzt (Frage „Schon erledigt?“). Für diesen Test: „Nein“.
 */
async function answerCrossDay(page: Page) {
  const dialog = page.getByTestId('cross-day-dialog');
  try {
    await dialog.waitFor({ state: 'visible', timeout: 8000 });
  } catch {
    return;
  }
  await page.getByTestId('cross-day-no').click();
  await expect(dialog).toHaveCount(0);
}

async function shot(page: Page, name: string, target?: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    if (target) {
      const el = page.getByTestId(target).first();
      await el.scrollIntoViewIfNeeded();
      await el.screenshot({ path: `${shots}/${name}-${scheme}.png` });
    } else {
      await page.screenshot({ path: `${shots}/${name}-${scheme}.png`, fullPage: true });
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

/** Sätze der ersten Übung der heutigen Einheit laut Plan (Gerätespeicher). */
async function plannedSetsOfFirstExercise(page: Page): Promise<number> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  const db = JSON.parse(raw ?? '{}') as {
    rows: {
      plannedSessions: { id: string; scheduled_on: string; status: string }[];
      plannedExercises: { session_id: string; order_no: number; sets: number }[];
    };
  };
  const session = db.rows.plannedSessions.find((s) => s.scheduled_on === '2026-10-28');
  const first = db.rows.plannedExercises.find(
    (e) => e.session_id === session?.id && e.order_no === 1,
  );
  if (!first) throw new Error('Keine Übung');
  return first.sets;
}

test('Erholung: Leerzustand → Beispiel-Uhr → Kachel „niedrig“ mit 7-Tage-Verlauf → Smartwatch-Seite', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await setup(page);

  // Ohne Uhr: Hinweis und „Uhr verbinden“ – in der Kachel „Schritte“ (halbe Breite) und „Erholung“ je EINE Zeile.
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-recovery-empty')).toContainText('Smartwatch', {
    timeout: 30_000,
  });
  for (const id of ['overview-steps-connect', 'overview-recovery-connect']) {
    const button = page.getByTestId(id);
    await expect(button).toHaveText('Uhr verbinden');
    const box = await button.boundingBox();
    // Eine Zeile: Knopf-Höhe wie ein einzeiliger Knopf (56 px), nicht zweizeilig (≥ 70 px).
    expect(box && box.height < 64, `${id} einzeilig`).toBe(true);
  }
  await shot(page, 'leer-schritte-erholung', 'overview-steps');
  await shot(page, 'leer-erholung-kachel', 'overview-recovery');

  await page.getByTestId('overview-recovery-connect').click();
  await expect(page.getByTestId('smartwatch')).toBeVisible();
  await connectDemoWatch(page);

  // Übersicht: Status heute, Gründe, Satz, 7 Tage (vorgestern mittel, heute niedrig).
  await page.goto('/uebersicht');
  const tile = page.getByTestId('overview-recovery');
  await expect(page.getByTestId('overview-recovery-status')).toHaveText('niedrig');
  await expect(page.getByTestId('overview-recovery-reasons')).toHaveText(
    'Schlaf kurz · Ruhepuls erhöht · HRV niedriger',
  );
  await expect(page.getByTestId('overview-recovery-summary')).toHaveText(
    'Deine Werte sprechen für einen leichteren Tag.',
  );
  const trend = page.getByTestId('overview-recovery-trend');
  await expect(trend).toHaveAttribute(
    'aria-label',
    'Erholung der letzten 7 Tage: Donnerstag gut, Freitag gut, Samstag gut, Sonntag gut, Montag mittel, Dienstag gut, heute niedrig',
  );
  await expect(page.getByTestId('overview-recovery-trend-low')).toHaveCount(1);
  await expect(page.getByTestId('overview-recovery-trend-medium')).toHaveCount(1);
  await expect(page.getByTestId('overview-recovery-open')).toHaveAttribute(
    'aria-label',
    /^Erholung heute: niedrig\. Schlaf kurz, Ruhepuls erhöht, HRV niedriger\./,
  );
  // Schritte-Kachel daneben unverändert (nicht gestört).
  await expect(page.getByTestId('overview-steps-value')).toHaveText('6.240');
  await shot(page, 'erholung-kachel', 'overview-recovery');
  await tile.scrollIntoViewIfNeeded();
  await shot(page, 'uebersicht');

  // Antippen → Smartwatch-Seite: Werte heute, Regeln, Hinweis „keine Bewertung deiner Gesundheit“.
  await page.getByTestId('overview-recovery-open').click();
  await expect(page.getByTestId('recovery-details')).toBeVisible();
  await expect(page.getByTestId('recovery-details-status')).toHaveText('niedrig');
  await expect(page.getByTestId('recovery-signal-sleep')).toHaveText(
    '• Schlaf: 5 Std. 10 Min. – kürzer als 6 Std.',
  );
  await expect(page.getByTestId('recovery-signal-resting_hr')).toContainText('Ruhepuls: 62 /min');
  await expect(page.getByTestId('recovery-signal-hrv')).toContainText('HRV: 46 ms');
  await expect(page.getByTestId('recovery-disclaimer')).toContainText(
    'keine Bewertung deiner Gesundheit',
  );
  // Tageswerte zeigen HRV, freigegebene Daten nennen sie.
  await expect(page.getByTestId('wearable-daily-line').first()).toContainText('HRV 46 ms');
  await shot(page, 'smartwatch-erholung', 'recovery-details');
});

test('Heute: Angebot „Leichter trainieren“ → leichtere Vorgabe im Training; „Wie geplant“', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await setup(page);
  await connectDemoWatch(page);

  // Angebot mit zwei Knöpfen, nichts automatisch.
  await page.goto('/today');
  await answerCrossDay(page);
  const offer = page.getByTestId('recovery-today-offer');
  await expect(offer).toBeVisible();
  await expect(offer).toContainText('Heute leichter trainieren?');
  await expect(offer).toContainText('Deine Werte sprechen für einen leichteren Tag.');
  await expect(page.getByTestId('recovery-today-reasons')).toHaveText(
    'Schlaf kurz · Ruhepuls erhöht · HRV niedriger',
  );
  await shot(page, 'heute-angebot', 'recovery-today-offer');

  // „Wie geplant“ → kurzer Hinweis, zurücknehmbar.
  await page.getByTestId('recovery-today-planned').click();
  await expect(page.getByTestId('recovery-today-as-planned')).toContainText('wie geplant');
  await page.getByTestId('recovery-today-reopen').click();
  await expect(offer).toBeVisible();

  // „Leichter trainieren“ → Bestätigung; Training startet mit einem Satz weniger je Übung.
  await page.getByTestId('recovery-today-lighter').click();
  await expect(page.getByTestId('recovery-today-chosen-text')).toHaveText(
    'Heute leichter: je Übung ein Satz weniger, etwas weniger Anstrengung, gleiche Gewichte.',
  );
  await shot(page, 'heute-gewaehlt', 'recovery-today-chosen');
  const planned = await plannedSetsOfFirstExercise(page);
  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout')).toBeVisible();
  await expect(page.getByTestId('workout-lighter')).toContainText('Heute leichter');
  const sets = page
    .getByTestId('workout-exercise-0')
    .getByRole('checkbox', { name: /^Satz \d+ geschafft$/ });
  await expect(sets).toHaveCount(Math.max(1, planned - 1));
  await shot(page, 'training-leichter');

  // Training begonnen (Entwurf) → Wahl fest, kein „Doch wie geplant“ mehr. (In der App zurück – die Wahl liegt nur im
  // Arbeitsspeicher; nach einem Neuladen fragt die Karte nicht erneut, der Entwurf behält die leichtere Vorgabe.)
  await page.getByTestId('workout-done-0-0').click();
  await page.getByRole('button', { name: 'Zurück zum Training' }).click();
  await heading(page, 'Training');
  await expect(page.getByTestId('recovery-today-chosen')).toBeVisible();
  await expect(page.getByTestId('recovery-today-undo')).toHaveCount(0);

  // Plan selbst unverändert.
  expect(await plannedSetsOfFirstExercise(page)).toBe(planned);
});

test('Ohne Live-Anpassung (Gratis): Angebot „Leichter trainieren“ trotzdem da (Gründer-Entscheidung 26.10.2026)', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await setup(page);
  await connectDemoWatch(page);
  await page.goto('/settings?thema=training');
  const box = page.getByRole('checkbox', { name: 'Live-Anpassung einschalten (Testmodus)' });
  await expect(box).toBeVisible();
  if ((await box.getAttribute('aria-checked')) !== 'false') await box.click();
  await expect(box).toHaveAttribute('aria-checked', 'false');

  await page.goto('/today');
  await answerCrossDay(page);
  await expect(page.getByTestId('recovery-today-offer')).toContainText(
    'Heute leichter trainieren?',
  );
  await expect(page.getByTestId('recovery-today-lighter')).toBeVisible();
  await expect(page.getByTestId('recovery-today-planned')).toBeVisible();
  await shot(page, 'heute-gratis-angebot', 'recovery-today-offer');
  // Status auf der Übersicht bleibt gratis.
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-recovery-status')).toHaveText('niedrig');
});

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Workout-Player (Gründer-Feedback 14.11.2026, docs/PLAN-WORKOUTS.md Abschnitt 4): Power-Workout starten → 10-s-
 * Countdown zeigt schon die erste Übung (Bild + „So geht's“) → Übung, Pause, Übung laufen OHNE ein einziges Tippen
 * weiter → „Als Nächstes“ mit kleinem Bild → Übungsbild wechselt Start ↔ Ende → Bildschirm-Sperre (Wake Lock) gehalten
 * und am Ende freigegeben. Test-Uhr (page.clock) statt Warten. Bildschirmfotos nur mit PLAYER_SHOTS=<Ordner>.
 */

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

const MONDAY = new Date('2026-10-05T09:00:00+02:00');
const SHOTS = process.env.PLAYER_SHOTS;

interface WakeStats {
  requested: number;
  active: number;
}

/** Wake-Lock-Schnittstelle des Browsers nachbauen (Headless-Chromium lehnt echte Anfragen ab) und mitzählen. */
async function stubWakeLock(page: Page) {
  await page.addInitScript(() => {
    const stats = { requested: 0, active: 0 };
    (window as unknown as { __wake: typeof stats }).__wake = stats;
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: () => {
          stats.requested += 1;
          stats.active += 1;
          const listeners: (() => void)[] = [];
          const lock = {
            released: false,
            addEventListener: (_type: string, fn: () => void) => listeners.push(fn),
            release: () => {
              if (!lock.released) {
                lock.released = true;
                stats.active -= 1;
                listeners.forEach((fn) => fn());
              }
              return Promise.resolve();
            },
          };
          return Promise.resolve(lock);
        },
      },
    });
  });
}

const wake = (page: Page) =>
  page.evaluate(() => (window as unknown as { __wake: WakeStats }).__wake);

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, name) });
}

test('Power-Workout läuft ohne Tippen: Countdown mit erster Übung, Übung → Pause → Übung, „Als Nächstes“, Bewegungsbild, Bildschirm bleibt an', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await stubWakeLock(page);
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
  await page.goto('/workouts/ganzkoerper-zirkel');
  await heading(page, 'Ganzkörper-Zirkel');
  await page.getByTestId('workout-start').click();

  const kind = page.getByTestId('workout-timer-kind');
  const step = page.getByTestId('workout-timer-step');
  const remaining = page.getByTestId('workout-timer-remaining');

  // 1) Countdown 10 s: erste Übung schon mit Bild und Ausführung.
  await expect(kind).toHaveText('Gleich geht’s los');
  await expect(remaining).toHaveText('0:10');
  await expect(step).toHaveText('Kniebeuge mit Pause');
  await expect(page.getByTestId('power-player-upcoming')).toHaveText('Als Nächstes');
  await expect(page.getByTestId('power-player-image')).toBeVisible();
  await expect(page.getByTestId('power-player-howto')).toContainText('So geht’s');
  await expect(page.getByTestId('workout-timer-dose')).toHaveText('12 Wiederholungen · 40 s Zeit');
  // Bildschirm-Sperre ist schon im Countdown aktiv.
  await expect.poll(async () => (await wake(page)).active).toBe(1);
  await shot(page, 'countdown.png');

  // 2) Ohne Tippen: Countdown → Übung (Zeitfenster 40 s).
  await page.clock.fastForward(10_500);
  await expect(kind).toHaveText('Los!');
  await expect(step).toHaveText('Kniebeuge mit Pause');
  await expect(remaining).toHaveText(/^0:(40|39)$/);
  await expect(page.getByTestId('workout-timer-next')).toHaveText('Als Nächstes: Liegestütz');
  await expect(page.getByTestId('workout-timer-next-thumb')).toBeVisible();

  // Bewegungsbild: Start ↔ Ende im Sekundentakt.
  const image = page.getByTestId('power-player-image');
  await expect(image).toHaveAttribute('data-motion', 'on');
  const before = await image.getAttribute('data-frame');
  await page.clock.fastForward(1000);
  await expect(image).not.toHaveAttribute('data-frame', before ?? '');
  await page.clock.fastForward(4000);
  await shot(page, 'uebung.png');

  // 3) Zeitfenster läuft ab → Pause mit der nächsten Übung, ohne Tippen.
  await page.clock.fastForward(36_000);
  await expect(kind).toHaveText('Pause');
  await expect(step).toHaveText('Liegestütz');
  await expect(page.getByTestId('power-player-upcoming')).toHaveText('Als Nächstes');
  // 8 Stationen × 3 Runden, die einseitige Split-Kniebeuge je Seite (+1 je Runde) = 27 Schritte.
  await expect(page.getByTestId('workout-timer-progress')).toContainText('1 von 27 erledigt');
  await shot(page, 'pause.png');

  // 4) Pause läuft ab → nächste Übung, wieder ohne Tippen.
  await page.clock.fastForward(20_500);
  await expect(kind).toHaveText('Los!');
  await expect(step).toHaveText('Liegestütz');

  // 5) Bis zum Ende vorspulen: alles erledigt, kein einziges „Erledigt“ getippt; Sperre freigegeben.
  await page.clock.fastForward(30 * 60 * 1000);
  await heading(page, 'Geschafft!');
  await expect(page.getByTestId('workout-finish-summary')).toHaveText(/^27 von 27 erledigt/);
  await expect.poll(async () => (await wake(page)).active).toBe(0);
  expect((await wake(page)).requested).toBeGreaterThanOrEqual(1);
});

test.describe('einseitige Übung je Seite', () => {
  // Bildschirmfoto in Handy-Auflösung 1:1 (SIDE_SHOTS=<Ordner>).
  test.use({ deviceScaleFactor: 1 });

  test('Gründer-Feedback 18.11.2026: „Linke Seite“ volle Zeit → „Seite wechseln“ (5 s) → „Rechte Seite“ volle Zeit → Pause', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await stubWakeLock(page);
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
    await page.goto('/workouts/ganzkoerper-zirkel');
    await heading(page, 'Ganzkörper-Zirkel');
    // Liste: Zeit gilt je Seite.
    await expect(page.getByTestId('workout-exercises')).toContainText('40 s je Seite');
    await page.getByTestId('workout-start').click();

    const kind = page.getByTestId('workout-timer-kind');
    const step = page.getByTestId('workout-timer-step');
    const remaining = page.getByTestId('workout-timer-remaining');
    const side = page.getByTestId('workout-timer-side');
    const name = 'Split-Kniebeuge mit Körpergewicht';

    // Countdown 10 s, Kniebeuge 40 s, Pause 20 s, Liegestütz 30 s (Zeitfenster), Pause 20 s.
    await page.clock.fastForward(10_500);
    await expect(kind).toHaveText('Los!');
    await expect(side).toHaveCount(0);
    await page.clock.fastForward(40_000 + 20_000 + 30_000);
    // In der Pause davor: kommende Übung mit Seite.
    await expect(kind).toHaveText('Pause');
    await expect(step).toHaveText(name);
    await expect(page.getByTestId('power-player-upcoming')).toHaveText(
      'Als Nächstes · Linke Seite',
    );

    // 1) Linke Seite, volle 40 s; „Als Nächstes“ ist die rechte Seite derselben Übung.
    await page.clock.fastForward(20_000);
    await expect(kind).toHaveText('Los!');
    await expect(step).toHaveText(name);
    await expect(side).toHaveText('Linke Seite');
    await expect(remaining).toHaveText(/^0:(40|39)$/);
    await expect(page.getByTestId('workout-timer-next')).toHaveText('Als Nächstes: Rechte Seite');
    await expect(page.getByTestId('workout-timer-progress')).toContainText('2 von 27 erledigt');

    // 2) Seitenwechsel 5 s: dieselbe Übung im Bild, Restsekunden.
    await page.clock.fastForward(40_000);
    await expect(kind).toHaveText('Seite wechseln');
    await expect(remaining).toHaveText(/^0:0[45]$/);
    await expect(step).toHaveText(name);
    await expect(page.getByTestId('power-player-image')).toBeVisible();
    await expect(page.getByTestId('power-player-upcoming')).toHaveText('Gleich: Rechte Seite');
    await expect(page.getByTestId('workout-timer-progress')).toContainText('3 von 27 erledigt');

    // 3) Rechte Seite, wieder volle 40 s.
    await page.clock.fastForward(5_000);
    await expect(kind).toHaveText('Los!');
    await expect(step).toHaveText(name);
    await expect(side).toHaveText('Rechte Seite');
    await expect(remaining).toHaveText(/^0:(40|39)$/);
    await expect(page.getByTestId('workout-timer-next')).toHaveText('Als Nächstes: Tisch-Rudern');
    await page.clock.fastForward(2_000);
    if (process.env.SIDE_SHOTS) {
      mkdirSync(process.env.SIDE_SHOTS, { recursive: true });
      await page.screenshot({ path: join(process.env.SIDE_SHOTS, 'rechte-seite.png') });
    }

    // 4) Danach die normale Pause, dann die nächste Übung.
    await page.clock.fastForward(38_500);
    await expect(kind).toHaveText('Pause');
    await expect(step).toHaveText('Tisch-Rudern');
    await expect(side).toHaveCount(0);
  });
});

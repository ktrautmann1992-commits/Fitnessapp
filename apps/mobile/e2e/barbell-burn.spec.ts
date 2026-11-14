import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Barbell Burn 60/30 (Gründer-Auftrag 14.11.2026, docs/PLAN-BARBELL-BURN.md): Langhantel-Gruppenworkouts in der
 * Workout-Liste mit eigenem Bild (Kachel), Ansicht mit Banner, Start im Workout-Player (10-s-Countdown mit der ersten
 * Übung). Bildschirmfotos in Handy-Größe (deviceScaleFactor 1) nur mit BARBELL_SHOTS=<Ordner>.
 */

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

const MONDAY = new Date('2026-10-05T09:00:00+02:00');
const SHOTS = process.env.BARBELL_SHOTS;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, name) });
}

/** Bild ist geladen (nicht nur das Element vorhanden). */
async function expectLoaded(image: Locator) {
  await expect
    .poll(() =>
      image.evaluate(
        (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth,
      ),
    )
    .toBeGreaterThan(0);
}

/** Headless-Chromium lehnt echte Wake-Lock-Anfragen ab – Schnittstelle nachbauen (wie workout-player.spec.ts). */
async function stubWakeLock(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: () =>
          Promise.resolve({
            released: false,
            addEventListener: () => undefined,
            release: () => Promise.resolve(),
          }),
      },
    });
  });
}

async function openWorkoutList(page: Page) {
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
  // Reiter „Training“ → Umschalter „Workouts“ → Liste „Alle“.
  await page.getByTestId('today-switch-workouts').click();
  await expect(page.getByTestId('workouts-list')).toBeVisible();
}

test('Barbell Burn: Kachel mit Bild in der Liste, Ansicht mit Banner, Start mit Countdown', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openWorkoutList(page);

  // Liste: beide Workouts mit eigenem Bild; ein Workout ohne Bild behält das Symbol.
  for (const id of ['barbell-burn-30', 'barbell-burn-60']) {
    const card = page.getByTestId(`workout-card-${id}`);
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();
    const thumb = card.getByTestId(`workout-card-${id}-thumb`).locator('img');
    await expectLoaded(thumb);
    await expect(thumb).toHaveAttribute('src', new RegExp(`${id}-thumb`));
    await page.evaluate(() => window.scrollBy(0, -120));
    await shot(page, `liste-${id}.png`);
  }
  await expect(page.getByTestId('workout-card-barbell-burn-60')).toHaveAttribute(
    'aria-label',
    /^Barbell Burn 60, Schwierigkeit 3 von 5 Sternen.*60 Min\./,
  );
  await expect(page.getByTestId('workout-card-barbell-burn-30')).toHaveAttribute(
    'aria-label',
    /^Barbell Burn 30, Schwierigkeit 2 von 5 Sternen.*30 Min\./,
  );
  await expect(page.getByTestId('workout-card-bauch-blitz-thumb')).toHaveCount(0);

  // Barbell Burn 60 öffnen: Banner (eigenes Bild, KI-Hinweis), Übungen mit Tempo-Hinweisen.
  await page.getByTestId('workout-card-barbell-burn-60').click();
  await heading(page, 'Barbell Burn 60');
  const banner = page.getByTestId('workout-banner');
  await expect(banner).toBeVisible();
  const bannerImage = banner.locator('img');
  await expectLoaded(bannerImage);
  await expect(bannerImage).toHaveAttribute('src', /barbell-burn-60-banner/);
  await expect(page.getByTestId('workout-banner-ai')).toHaveText('KI-Bild, Higgsfield');
  await expect(page.getByTestId('workout-exercises')).toContainText(
    '1. Aufwärm-Kombi mit leichter Langhantel',
  );
  await expect(page.getByTestId('workout-exercises')).toContainText('Track 10 – Dehnen');
  await shot(page, 'detail-barbell-burn-60.png');

  // Starten: 10-s-Countdown zeigt schon die erste Übung mit Bewegungsbild.
  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout-timer-kind')).toHaveText('Gleich geht’s los');
  await expect(page.getByTestId('workout-timer-remaining')).toHaveText('0:10');
  await expect(page.getByTestId('workout-timer-step')).toHaveText(
    'Aufwärm-Kombi mit leichter Langhantel',
  );
  await expect(page.getByTestId('power-player-image')).toBeVisible();
  await shot(page, 'player-countdown-barbell-burn-60.png');

  // Ohne Tippen weiter: nach dem Countdown läuft die erste Übung im Zeitfenster (16 Wdh. → 50 s).
  await page.clock.fastForward(10_500);
  await expect(page.getByTestId('workout-timer-kind')).toHaveText('Los!');
  await expect(page.getByTestId('workout-timer-remaining')).toHaveText(/^0:(50|49)$/);
});

test('Barbell Burn 30: eigenes Banner', async ({ page }) => {
  await openWorkoutList(page);
  await page.goto('/workouts/barbell-burn-30');
  await heading(page, 'Barbell Burn 30');
  const bannerImage = page.getByTestId('workout-banner').locator('img');
  await expectLoaded(bannerImage);
  await expect(bannerImage).toHaveAttribute('src', /barbell-burn-30-banner/);
  await shot(page, 'detail-barbell-burn-30.png');
});

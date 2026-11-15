import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Kraft-Ausdauer auf Zeit (Gründer-Auftrag 15.11.2026, docs/PLAN-WORKOUTS.md Abschnitt 10): erster Bereich im Reiter
 * Workouts, in „Alle“ oben; neue Workouts mit Übungen für die tiefen Bauchmuskeln laufen im Player nach Zeit.
 * Bildschirmfotos in Handy-Größe (deviceScaleFactor 1) nur mit KA_SHOTS=<Ordner>.
 */

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

const MONDAY = new Date('2026-10-05T09:00:00+02:00');
const SHOTS = process.env.KA_SHOTS;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, name) });
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
  await page.getByTestId('today-switch-workouts').click();
  await expect(page.getByTestId('workouts-list')).toBeVisible();
}

const card = (page: Page, id: string) => page.getByTestId(`workout-card-${id}`);

test('Kraft-Ausdauer auf Zeit: erster Bereich, oben in „Alle“, Tiefe Bauchmuskeln im Player', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openWorkoutList(page);

  // Erster Bereich mit Anzahl; in „Alle“ steht ein Kraft-Ausdauer-Workout ganz oben (leichtestes zuerst).
  const chip = page.getByTestId('workouts-theme-strength_endurance');
  await expect(chip).toHaveText(/^Kraft-Ausdauer \(auf Zeit\) \(\d+\)$/);
  await expect(page.getByTestId('workouts-themes').getByRole('radio').nth(1)).toHaveText(
    /^Kraft-Ausdauer/,
  );
  const first = page.getByTestId('workouts-list').locator('[data-testid^="workout-card-"]').first();
  await expect(first).toHaveAttribute('aria-label', /(2[0-9]|30) Min\./);

  await chip.click();
  await expect(page.getByTestId('workouts-theme-intro')).toContainText('tiefen Bauchmuskeln');
  await expect(card(page, 'tiefe-bauchmuskeln-20')).toBeVisible();
  await expect(card(page, 'core-stabilitaet-25')).toBeVisible();
  await expect(card(page, 'bauch-blitz')).toBeVisible();
  // Mobilität, Technik und WOD-Stil gehören nicht dazu.
  await expect(card(page, 'huefte-und-ruecken-mobil')).toHaveCount(0);
  await expect(card(page, 'rudern-technik')).toHaveCount(0);
  await expect(card(page, 'wod-amrap-zuhause')).toHaveCount(0);
  await shot(page, 'liste-kraft-ausdauer.png');
  await page.getByTestId('workouts-count').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  await shot(page, 'liste-kraft-ausdauer-karten.png');

  // Ansicht eines neuen Workouts.
  await card(page, 'tiefe-bauchmuskeln-20').click();
  await heading(page, 'Tiefe Bauchmuskeln 20');
  await expect(page.getByTestId('workout-exercises')).toContainText(
    '1. Tiefe Bauchatmung in Rückenlage',
  );
  await expect(page.getByTestId('workout-exercises')).toContainText(
    'Bauchnabel einziehen im Vierfüßlerstand',
  );
  await shot(page, 'detail-tiefe-bauchmuskeln-20.png');

  // Player: Countdown, dann die erste Übung nach Zeit (35 s) mit Bewegungsbild – ohne Tippen weiter.
  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout-timer-step')).toHaveText(
    'Tiefe Bauchatmung in Rückenlage',
  );
  await expect(page.getByTestId('workout-timer-dose')).toHaveText('35 s');
  await page.clock.fastForward(10_500);
  await expect(page.getByTestId('workout-timer-kind')).toHaveText('Los!');
  await expect(page.getByTestId('power-player-image')).toBeVisible();
  // Weiter bis zur dritten Übung (Bauchnabel einziehen): 35 s + 20 s Pause je Übung.
  await page.clock.fastForward(2 * 55_000);
  await expect(page.getByTestId('workout-timer-step')).toHaveText(
    'Bauchnabel einziehen im Vierfüßlerstand',
  );
  await expect(page.getByTestId('workout-timer-kind')).toHaveText('Los!');
  await page.clock.fastForward(3_000);
  await shot(page, 'player-bauchnabel-einziehen.png');
});

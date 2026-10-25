/// <reference types="node" />
import { mkdirSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Sprachansagen und Trinken (25.10.2026) im TESTMODUS, Web-Export, Handy-Ansicht:
 * - Sprachansagen: Einstellungen (an, Abstand, Inhalte, Probe-Ansage), Demo-Aufzeichnung sagt „Kilometer 1“ an.
 *   Die Sprachausgabe des Browsers wird im Test ersetzt (sammelt nur die Texte).
 * - Trinken: Ring mit Richtwert (80 kg → 1,7 l), +250/+500 ml, Zurücknehmen, 7 Tage; Herz-Angabe → kein Ziel.
 * Mit SCREENSHOT_DIR entstehen Bildschirmfotos (390 px).
 */

const dir = process.env.SCREENSHOT_DIR;

async function fakeSpeech(page: Page) {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    const voice = {
      voiceURI: 'de-test',
      lang: 'de-DE',
      localService: true,
      name: 'Test',
      default: true,
    };
    class Utterance {
      text: string;
      voice: unknown = null;
      lang = '';
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: Utterance,
      configurable: true,
    });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [voice],
        speak: (u: Utterance) => {
          spoken.push(u.text);
          setTimeout(() => u.onend?.(), 10);
        },
        cancel: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
  });
}

const spoken = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);

async function start(page: Page, yesQuestion: number | null = null) {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org|open-meteo\.com/, (route) => route.abort());
  await page.clock.setFixedTime(new Date('2026-10-25T10:00:00+01:00'));
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent: true,
    yesQuestion,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [['Montag', 'Kraft im Studio', 60]],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
}

test('Trinken: Richtwert, +250/+500, zurücknehmen, 7 Tage', async ({ page }) => {
  await start(page);
  const card = page.getByTestId('today-hydration');
  await card.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('today-hydration-total')).toHaveText('0,0 l von 1,7 l');
  await expect(card).toContainText('Richtwert 1.700 ml für Getränke');
  await page.getByTestId('today-hydration-add-250').click();
  await page.getByTestId('today-hydration-add-500').click();
  await expect(page.getByTestId('today-hydration-total')).toHaveText('0,75 l von 1,7 l');
  await expect(page.getByTestId('today-hydration-ring')).toHaveAttribute(
    'aria-label',
    'Heute getrunken: 750 ml von etwa 1.700 ml Richtwert',
  );
  if (dir) {
    mkdirSync(dir, { recursive: true });
    await card.screenshot({ path: `${dir}/trinken-heute.png` });
  }
  await page.getByTestId('today-hydration-undo').click();
  await expect(page.getByTestId('today-hydration-total')).toHaveText('0,25 l von 1,7 l');
  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('fitnessapp.hydration-local.v1') ?? '[]'),
  );
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ amount_ml: 250, day: '2026-10-25' });
  await expect(card).not.toContainText(/zu wenig|zu viel|Bestwert/);
});

test('Trinken: Herz-Angabe im Gesundheits-Check → kein Ziel, nur notieren', async ({ page }) => {
  await start(page, 0);
  await expect(page.getByTestId('today-hydration-no-goal')).toContainText(
    'geben wir kein Trinkziel vor',
  );
  await page.getByTestId('today-hydration-add-250').click();
  await expect(page.getByTestId('today-hydration-total')).toHaveText('Heute 0,25 l');
  if (dir) {
    await page.getByTestId('today-hydration').screenshot({ path: `${dir}/trinken-ohne-ziel.png` });
  }
});

test('Sprachansagen: Einstellungen und Ansage „Kilometer 1“ bei der Demo-Aufzeichnung', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await fakeSpeech(page);
  await start(page);
  await page.goto('/settings');
  const settings = page.getByTestId('voice-settings');
  await settings.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('voice-enabled')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('voice-enabled').click();
  await expect(page.getByTestId('voice-enabled')).toHaveAttribute('aria-checked', 'true');
  await expect(settings).toContainText('Je km (Rad: je 5 km)');
  await expect(page.getByTestId('voice-heart-rate')).toBeVisible();
  await page.getByTestId('voice-test').click();
  await expect
    .poll(() => spoken(page))
    .toContain('Kilometer 1. Pace 5 Minuten 24. Zeit 5 Minuten 24.');
  if (dir) {
    await page.setViewportSize({ width: 390, height: 3200 });
    await settings.screenshot({ path: `${dir}/sprachansagen-einstellungen.png` });
    await page.setViewportSize({ width: 390, height: 844 });
  }

  // Ausdauer: Schalter sichtbar und an; Demo-Aufzeichnung sagt den ersten Kilometer an.
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await expect(page.getByTestId('voice-enabled')).toHaveAttribute('aria-checked', 'true');
  if (dir)
    await page
      .getByTestId('voice-settings')
      .screenshot({ path: `${dir}/sprachansagen-ausdauer.png` });
  await page.getByTestId('endurance-demo').click();
  await expect(page.getByTestId('record-live')).toBeVisible();
  await expect
    .poll(async () => (await spoken(page)).some((s) => s.startsWith('Kilometer 1.')), {
      timeout: 60_000,
    })
    .toBe(true);
  const cue = (await spoken(page)).find((s) => s.startsWith('Kilometer 1.')) ?? '';
  expect(cue).toMatch(/^Kilometer 1\. Pace \d+ Minuten? \d+\. Zeit /);
});

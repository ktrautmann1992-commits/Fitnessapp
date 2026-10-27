/// <reference types="node" />
import { mkdirSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Live-Begleitung / Notfallkontakte im Testmodus (docs/PLAN-PHASE-10.md 21, Handy-Ansicht 390 × 844): Kontakt nur auf
 * dem Gerät anlegen, Demo-Aufzeichnung, Live-Begleitung per Tipp starten (Teilen-Text mit Demo-Link), Banner, SOS-Blatt
 * (nur System-Apps, 112), „Angekommen“ mit einem Tipp.
 */

/** Teilen-Dialog des Browsers nachstellen: Text mitschreiben statt teilen. */
async function fakeShare(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: string[] };
    w.__shared = [];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: { text?: string }) => {
        w.__shared.push(data.text ?? '');
      },
    });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  });
}

/** Optional: Bildschirmfotos (SCREENSHOT_DIR gesetzt, z. B. für den PR). */
const dir = process.env.SCREENSHOT_DIR ? `${process.env.SCREENSHOT_DIR}/live-begleitung` : null;
const shot = async (page: Page, name: string) => {
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
};

const shared = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shared: string[] }).__shared);

test('Notfallkontakt anlegen, Live-Begleitung in der Demo starten, SOS, Angekommen', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org|open-meteo\.com/, (route) => route.abort());
  await fakeShare(page);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent: true,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [['Montag', 'Kraft im Studio', 60]],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');

  // Einstellungen → Geräte → Notfallkontakte (nur dieses Gerät).
  await page.goto('/settings?thema=geraete');
  await page.getByTestId('settings-emergency-contacts').click();
  await expect(page.getByTestId('emergency-contacts')).toBeVisible();
  await expect(page.getByTestId('emergency-hint')).toContainText('Im Notfall immer 112');
  await page.getByTestId('emergency-add').click();
  await page.getByTestId('emergency-name').fill('Anna');
  await page.getByTestId('emergency-phone').fill('0171');
  await page.getByTestId('emergency-save').click();
  await expect(page.getByText('Bitte eine gültige Telefonnummer eingeben.')).toBeVisible();
  await page.getByTestId('emergency-phone').fill('0171 1234567');
  await page.getByTestId('emergency-save').click();
  await expect(page.getByTestId('emergency-contact-0')).toContainText('+491711234567');
  await expect(page.getByTestId('emergency-contact-0')).toContainText('Standard');
  await page.getByTestId('emergency-display-name').fill('Karsten');
  await page.getByTestId('emergency-save-texts').click();
  await expect(page.getByTestId('emergency-message')).toContainText('nur auf diesem Handy');
  await shot(page, '1-notfallkontakte');

  // Demo-Aufzeichnung → Live-Begleitung per Tipp.
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await page.getByTestId('endurance-demo').click();
  await expect(page.getByTestId('record-live')).toBeVisible();
  await expect(page.getByTestId('live-banner')).toHaveCount(0);
  await page.getByTestId('live-start-open').click();
  const sheet = page.getByTestId('live-start-sheet');
  await expect(sheet).toBeVisible();
  await expect(page.getByTestId('live-display-name')).toHaveValue('Karsten');
  await shot(page, '2-blatt-start');
  await page.getByTestId('live-start').click();
  await expect(page.getByTestId('live-started')).toBeVisible();
  await expect.poll(() => shared(page)).toHaveLength(1);
  const text = (await shared(page))[0] ?? '';
  expect(text).toMatch(
    /^Ich bin laufen\. Hier siehst du live, wo ich gerade bin \(bis ca\. \d\d:\d\d\): https:\/\/.+\/begleitung#t=demo/,
  );
  expect(text).toContain('Bitte nicht weiterleiten.');
  await expect(page.getByTestId('live-link')).toContainText('/begleitung#t=demo');
  await page.getByTestId('live-sheet-close').click();

  // Banner immer sichtbar.
  await expect(page.getByTestId('live-banner-status')).toHaveText('Live-Begleitung aktiv');
  await expect(page.getByTestId('live-banner')).toContainText('Sichtbar für Anna');
  await shot(page, '3-banner');

  // SOS: nur System-Apps (SMS/WhatsApp/Telefon) und 112 – nichts wird automatisch gesendet.
  await page.getByTestId('live-sos-open').click();
  const sos = page.getByTestId('live-sos-sheet');
  await expect(sos).toBeVisible();
  await expect(page.getByTestId('live-sos-112')).toBeVisible();
  await expect(sos).toContainText('SMS an Anna');
  await expect(sos).toContainText('WhatsApp an Anna');
  await expect(sos).toContainText('Anna anrufen');
  await shot(page, '4-sos');
  await page.getByTestId('live-sos-close').click();

  // „Angekommen“ mit EINEM Tipp.
  await page.getByTestId('live-arrived').click();
  await expect(page.getByTestId('live-notice')).toContainText('Angekommen gemeldet');
  await expect(page.getByTestId('live-banner')).toHaveCount(0);
  await expect(page.getByTestId('live-start-open')).toBeVisible();
});

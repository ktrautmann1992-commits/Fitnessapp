/// <reference types="node" />
import { mkdirSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { E2E_ADMIN_PASSWORD, LOCKED_URL } from './test-env';

/**
 * Bildschirmfotos des Redaktionsbereichs (390 × 844, hell und dunkel) zur Sichtprüfung.
 * Läuft nur mit gesetztem SCREENSHOT_DIR (pnpm --filter @fitnessapp/web screenshots), nicht in CI.
 */
const dir = process.env.SCREENSHOT_DIR;
test.skip(!dir, 'Nur mit SCREENSHOT_DIR');

for (const scheme of ['light', 'dark'] as const) {
  test(`Redaktionsbereich ${scheme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: scheme });
    mkdirSync(`${dir}/${scheme}`, { recursive: true });
    let n = 0;
    const shot = async (name: string, fullPage = false) => {
      n += 1;
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `${dir}/${scheme}/${String(n).padStart(2, '0')}-${name}.png`,
        fullPage,
      });
    };

    await page.goto(`${LOCKED_URL}/admin`);
    await shot('nicht-eingerichtet');

    await page.goto('/admin/login');
    await shot('login');
    await page.getByLabel('Passwort').fill('falsches-passwort-123456789');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByText('Zugang verweigert – das Passwort stimmt nicht.')).toBeVisible();
    await shot('login-fehler');
    await page.getByLabel('Passwort').fill(E2E_ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByRole('heading', { name: 'Inhalte prüfen' })).toBeVisible();
    await shot('uebersicht-uebungen');
    await page.getByText('Suche und Filter').click();
    await shot('filter-offen');
    await page.goto('/admin?tab=uebungen&muster=squat');
    await shot('filter-kniebeuge', true);
    await page.goto('/admin?q=gibtsnicht');
    await shot('keine-treffer');
    await page.goto('/admin?tab=vorlagen');
    await shot('uebersicht-vorlagen');
    await page.goto('/admin/uebungen/kniebeuge-langhantel');
    await shot('detail-uebung');
    await page.screenshot({
      path: `${dir}/${scheme}/${String(++n).padStart(2, '0')}-detail-uebung-ganz.png`,
      fullPage: true,
    });
    await page.goto('/admin/vorlagen/muskelaufbau-fortgeschritten-3t-studio');
    await shot('detail-vorlage');
    await page.screenshot({
      path: `${dir}/${scheme}/${String(++n).padStart(2, '0')}-detail-vorlage-ganz.png`,
      fullPage: true,
    });
    for (const section of ['woche', 'volumen']) {
      await page.locator(`section[aria-labelledby="${section}"]`).screenshot({
        path: `${dir}/${scheme}/${String(++n).padStart(2, '0')}-vorlage-${section}.png`,
      });
    }
    await page.goto('/admin/uebungen/gibt-es-nicht');
    await shot('nicht-gefunden');
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page.getByText('Du bist abgemeldet.')).toBeVisible();
    await shot('abgemeldet');
  });
}

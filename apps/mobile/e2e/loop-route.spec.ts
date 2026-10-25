import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Rundkurs-Vorschlag im TESTMODUS (docs/PLAN-RUNDKURS.md), Web-Export, Handy-Ansicht: Routing ist die Attrappe
 * (ausgedachte Runden, kein Netz), Karte/Kacheln werden blockiert (→ Skizze). Ablauf: Einstieg auf „Ausdauer“ →
 * Distanz/Untergrund → Start (Beispiel-Start, eigener Standort, verweigert) → 2–3 Vorschläge → wählen → merken →
 * „Andere Runden“ → „Diese Runde laufen“ (Demo-Aufzeichnung mit Leitlinie) → Speichern mit Name und als Favorit
 * vorgeschlagen.
 */

const THURSDAY = new Date('2026-10-22T09:00:00+02:00');

async function setup(page: Page) {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org|openrouteservice\.org/, (route) =>
    route.abort(),
  );
  await page.clock.setFixedTime(THURSDAY);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent: false,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [['Montag', 'Kraft im Studio', 60]],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
}

async function openLoop(page: Page) {
  await page.goto('/ausdauer');
  await heading(page, 'Ausdauer');
  await page.getByTestId('endurance-loop').click();
  await heading(page, 'Rundkurs-Vorschlag');
}

test('Rundkurs: Vorschläge, wählen, merken, andere Runden, laufen mit Leitlinie', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await setup(page);
  const external: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith('http://127.0.0.1') && !url.startsWith('data:') && !url.startsWith('blob:'))
      external.push(url);
  });
  await openLoop(page);
  await expect(page.getByTestId('loop-mock-hint')).toContainText('ausgedachte Runden');
  await expect(page.getByTestId('loop-privacy')).toContainText('auf ca. 50 m gerundet');
  await expect(page.getByTestId('loop-saved-empty')).toBeVisible();

  // Ohne Start: Hinweis statt Anfrage.
  await page.getByTestId('loop-suggest').click();
  await expect(page.getByTestId('loop-start-notice')).toHaveText('Wähle zuerst einen Startpunkt.');

  await page.getByTestId('loop-distance-10').click();
  await page.getByRole('radio', { name: 'Wald- und Feldwege' }).click();
  await page.getByTestId('loop-demo-start').click();
  await expect(page.getByTestId('loop-map')).toBeVisible();
  await page.getByTestId('loop-suggest').click();

  await expect(page.getByTestId('loop-results')).toBeVisible();
  const options = page.getByTestId('loop-results').getByRole('radio');
  const count = await options.count();
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(3);
  await expect(page.getByTestId('loop-option-0')).toContainText('Runde A');
  await expect(page.getByTestId('loop-option-0')).toContainText(/\d+,\d km · ↑ \d+ Hm/);
  await expect(page.getByTestId('loop-option-0')).toContainText('% Wald-/Feldweg');
  await expect(page.getByTestId('loop-option-0')).toHaveAttribute(
    'aria-label',
    /Höhenmeter bergauf/,
  );

  // Karte lädt im Test nicht → Skizze mit allen Runden; Attribution immer sichtbar.
  await expect(page.getByTestId('loop-map-sketch')).toBeVisible();
  await expect(page.getByTestId('loop-map-attribution')).toContainText(
    '© OpenStreetMap-Mitwirkende',
  );
  await expect(page.getByTestId('loop-map-attribution')).toContainText('openrouteservice.org');

  // Runde B wählen und merken.
  await page.getByTestId('loop-option-1').click();
  await expect(page.getByTestId('loop-option-1')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('loop-save').click();
  await expect(page.getByTestId('loop-save-name')).toHaveValue('Rundkurs 10 km');
  await page.getByTestId('loop-save-name').fill('Waldrunde Rheinpark');
  await page.getByTestId('loop-save-confirm').click();
  await expect(page.getByTestId('loop-message')).toContainText('Gemerkt');
  await expect(page.getByTestId('loop-saved')).toContainText('Waldrunde Rheinpark');
  // Gemerkt nur im Tab-Speicher (sessionStorage), nie in localStorage.
  expect(
    await page.evaluate(() => Object.keys(window.localStorage).some((k) => k.includes('loop'))),
  ).toBe(false);

  // Andere Runden: neue Vorschläge (andere Zufallswerte).
  const before = await page.getByTestId('loop-option-0').textContent();
  await page.getByTestId('loop-more').click();
  await expect(page.getByTestId('loop-results')).toBeVisible();
  await expect.poll(() => page.getByTestId('loop-option-0').textContent()).not.toBe(before);

  // Diese Runde laufen → Demo-Aufzeichnung mit Leitlinie.
  await page.getByTestId('loop-run').click();
  await expect(page.getByTestId('record-live')).toBeVisible();
  await expect(page.getByTestId('record-loop-guide')).toContainText('Leitlinie: Rundkurs 10 km');
  await expect(page.getByTestId('record-loop-remaining')).toContainText(
    /Noch ca\. \d+,\d km bis zum Start/,
  );
  await expect(page.getByTestId('record-loop-map-sketch')).toBeVisible();
  await expect
    .poll(
      async () =>
        Number(
          ((await page.getByTestId('record-distance').textContent()) ?? '0')
            .replace(' km', '')
            .replace(',', '.'),
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0.3);
  await page.getByTestId('record-stop').click();
  await page.getByTestId('record-stop-dialog').getByRole('button', { name: 'Ja, beenden' }).click();
  await expect(page.getByTestId('record-save')).toBeVisible();
  await expect(page.getByTestId('record-name')).toHaveValue('Rundkurs 10 km');
  await expect(page.getByTestId('record-favorite')).toHaveAttribute('aria-checked', 'true');

  // Keine einzige Anfrage nach außen außer der (blockierten) Karte.
  expect(external.filter((u) => !/cdn\.jsdelivr\.net|openfreemap\.org/.test(u))).toEqual([]);
});

test('Rundkurs: Start über den eigenen Standort, verweigert → Hinweis; gemerkte Runde laufen/entfernen', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 48.1374, longitude: 11.5755 });
  await setup(page);
  await openLoop(page);
  await page.getByTestId('loop-locate').click();
  await expect(page.getByTestId('loop-map')).toBeVisible();
  await page.getByTestId('loop-distance-3').click();
  await page.getByRole('radio', { name: 'Asphalt' }).click();
  await page.getByTestId('loop-suggest').click();
  await expect(page.getByTestId('loop-results')).toBeVisible();
  await page.getByTestId('loop-save').click();
  await page.getByTestId('loop-save-confirm').click();
  await expect(page.getByTestId('loop-saved')).toContainText('Rundkurs 3 km');
  // Entfernen.
  await page.getByRole('button', { name: 'Rundkurs 3 km entfernen' }).click();
  await expect(page.getByTestId('loop-saved-empty')).toBeVisible();

  // Standort verweigert (Ersatz für den Systemdialog).
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (
          _ok: unknown,
          fail: (e: { code: number; PERMISSION_DENIED: number }) => void,
        ) => fail({ code: 1, PERMISSION_DENIED: 1 }),
      },
    });
  });
  await page.getByTestId('loop-locate').click();
  await expect(page.getByTestId('loop-start-notice')).toContainText('Ohne Standort-Freigabe');
});

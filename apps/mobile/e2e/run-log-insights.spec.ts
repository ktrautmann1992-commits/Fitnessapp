import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Volle Lauf-Auswertung auch im Tagebuch-Eintrag (Gründer-Wunsch 28.10.2026): Ein aufgezeichneter Lauf, der zur
 * geplanten Einheit zählt, zeigt nach dem Speichern UND über Heute/Verlauf (`/log/[id]`) die farbige Auswertung
 * (Kopf-Karte, Kilometer-Balken, Tempo-Verlauf, Höhenprofil) – darunter Erledigt-Status, Ändern, Löschen. Ohne Strecke
 * (manuell eingetragen) bleibt die schlichte Seite, mit Werte-Kacheln. Rad gilt genauso. Testmodus, Web-Export,
 * Demo-Aufzeichnung (Zeitraffer); Karte/Kacheln werden blockiert (keine externen Anfragen).
 */

const THURSDAY = new Date('2026-10-22T09:00:00+02:00');

async function setup(page: Page) {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  await page.clock.setFixedTime(THURSDAY);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent: false,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft im Studio', 60],
      ['Donnerstag', 'Ausdauer', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
}

async function liveKm(page: Page): Promise<number> {
  const text = (await page.getByTestId('record-distance').textContent()) ?? '0';
  return Number(text.replace(' km', '').replace(',', '.'));
}

/** Demo-Aufzeichnung (> 1 km, damit es Kilometer-Balken gibt) bis zum Speichern-Bildschirm. */
async function recordDemo(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByTestId('record-live')).toBeVisible();
  await expect.poll(() => liveKm(page), { timeout: 40_000 }).toBeGreaterThan(1.3);
  await page.getByTestId('record-stop').click();
  await page.getByTestId('record-stop-dialog').getByRole('button', { name: 'Ja, beenden' }).click();
  await expect(page.getByTestId('record-save')).toBeVisible();
}

/** Die volle Auswertung (gleiche Bausteine wie /ausdauer/[id]). */
async function expectFullInsights(page: Page) {
  const insights = page.getByTestId('log-route-insights');
  await expect(insights).toBeVisible();
  await expect(insights.getByTestId('route-hero')).toBeVisible();
  await expect(insights.getByTestId('route-distance')).toHaveText(/^\d+,\d\d km$/);
  await expect(insights.getByTestId('split-bars')).toBeVisible();
  await expect(insights.getByTestId('pace-chart')).toBeVisible();
  await expect(insights.getByTestId('elevation-chart')).toBeVisible();
  await expect(insights.getByTestId('pace-legend')).toBeVisible();
  await expect(insights.getByTestId('route-highlights')).toBeVisible();
  // Keine doppelten Werte: die schlichte Ausdauer-Karte fehlt.
  await expect(page.getByTestId('log-cardio')).toHaveCount(0);
}

test('geplante Lauf-Einheit → Aufzeichnung → Speichern → volle Auswertung; Eintrag mit Auswertung und Aktionen', async ({
  page,
}) => {
  await setup(page);
  await recordDemo(page, '/ausdauer/aufzeichnen?sport=run&demo=1');
  // Zählt zur heute geplanten Einheit (Standard „Ja“).
  await expect(page.getByRole('radiogroup', { name: /^Zu „.+“ zählen\?$/ })).toBeVisible();
  await page.getByTestId('record-name').fill('Morgenrunde');
  await page.getByTestId('record-submit').click();

  // Nach dem Speichern: volle Auswertung.
  await expect(page.getByTestId('route-detail')).toBeVisible();
  await expect(page.getByTestId('route-hero')).toBeVisible();
  await expect(page.getByTestId('split-bars')).toBeVisible();
  await expect(page.getByTestId('pace-chart')).toBeVisible();

  // „Im Tagebuch ansehen“: Eintrag der geplanten Einheit zeigt dieselbe Auswertung + Planbezug.
  await page.getByTestId('route-open-log').click();
  await expect(page.getByTestId('log-entry')).toBeVisible();
  await expectFullInsights(page);
  await expect(page.getByTestId('log-status')).toHaveText('Vollständig erledigt');
  await expect(page.getByTestId('log-edit')).toBeVisible();
  await expect(page.getByTestId('log-delete')).toBeVisible();
  await expect(page.getByTestId('log-share')).toBeVisible();
  // kcal nur einmal (im Eintrag, nicht zusätzlich als Zelle der Auswertung).
  await expect(page.getByTestId('log-entry').getByTestId('session-kcal-stat')).toHaveCount(0);
  // Strecke selbst (GPX, Name) weiter unter /ausdauer/[id].
  await page.getByTestId('log-open-route').click();
  await expect(page.getByTestId('route-detail').last()).toBeVisible();
  await expect(page.getByTestId('route-gpx').last()).toBeVisible();

  // Heute: erledigte Einheit „Ansehen“ → volle Auswertung.
  await page.goto('/today');
  await page.getByTestId('today-hero-view').click();
  await expect(page.getByTestId('log-entry')).toBeVisible();
  await expectFullInsights(page);
});

test('Verlauf → Lauf-Eintrag → volle Auswertung; Rad genauso; manueller Eintrag schlicht mit Kacheln', async ({
  page,
}) => {
  await setup(page);
  await recordDemo(page, '/ausdauer/aufzeichnen?sport=run&demo=1');
  await page.getByTestId('record-name').fill('Abendrunde');
  await page.getByTestId('record-submit').click();
  await expect(page.getByTestId('route-detail')).toBeVisible();

  // Verlauf → Eintrag.
  await page.goto('/history');
  await page.getByTestId('history-entry').first().click();
  await expect(page.getByTestId('log-entry')).toBeVisible();
  await expectFullInsights(page);
  await expect(page.getByTestId('log-status')).toHaveText('Vollständig erledigt');

  // Rad (freie Einheit): gleiche Auswertung im Eintrag, Ø-Tempo in km/h.
  await recordDemo(page, '/ausdauer/aufzeichnen?sport=bike&demo=1');
  await expect(page.getByTestId('record-diary-free')).toBeVisible();
  await page.getByTestId('record-name').fill('Radrunde');
  await page.getByTestId('record-submit').click();
  await expect(page.getByTestId('route-detail')).toBeVisible();
  await page.getByTestId('route-open-log').click();
  await expectFullInsights(page);
  await expect(page.getByTestId('log-route-insights').getByTestId('route-pace')).toHaveText(
    /km\/h$/,
  );

  // Strecke löschen → Eintrag bleibt, jetzt ohne GPS: schlichte Seite mit Werte-Kacheln.
  await page.getByTestId('log-open-route').click();
  await page.getByTestId('route-delete').last().click();
  await page
    .getByTestId('route-delete-dialog')
    .last()
    .getByRole('button', { name: 'Ja, löschen' })
    .click();
  // Gespeichert: nur noch die Lauf-Strecke.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            JSON.parse(window.localStorage.getItem('fitnessapp.local.v1') ?? '{}') as {
              trackedRoutes?: unknown[];
            }
          ).trackedRoutes?.length ?? 0,
      ),
    )
    .toBe(1);
  await page.goto('/history');
  await page.getByTestId('history-entry').first().click();
  await expect(page.getByTestId('log-entry')).toBeVisible();
  await expect(page.getByTestId('log-route-insights')).toHaveCount(0);
  await expect(page.getByTestId('log-cardio-tiles')).toBeVisible();
  await expect(page.getByTestId('log-cardio-duration')).toHaveText(/^\d+:\d\d$/);
  await expect(page.getByTestId('log-cardio-distance')).toHaveText(/^\d+,\d km$/);
  await expect(page.getByTestId('log-cardio-speed')).toHaveText(/km\/h$/);
});

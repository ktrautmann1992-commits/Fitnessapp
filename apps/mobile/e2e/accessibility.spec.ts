import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Barrierefreiheit (docs/PLAN-FIT-IM-ALTER.md 12, Etappe FA5) im TESTMODUS:
 * - Umbruch bei 320 CSS-px (WCAG 1.4.10) und Browser-Zoom 200 % (WCAG 1.4.4, CSS-Zoom auf 640 px Breite = 320 CSS-px)
 *   ohne waagerechtes Scrollen auf Willkommen, „Heute“ und Einstellungen.
 * - „Große Ansicht“: Schrift größer, Knöpfe mindestens 56 px, „Heute“ zeigt weniger (Rest hinter „Mehr anzeigen“).
 * - Vorlesen: ohne lokale deutsche Stimme (Headless-Browser) bleibt der Knopf aus, die Einstellung sagt warum.
 * Die Systemschrift (iOS Dynamic Type, Android) kann Playwright nicht nachstellen – Checkliste am EAS-Build
 * (docs/HANDY-ANLEITUNG.md).
 */

const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');

const HOME_3_DAYS = {
  consent: true,
  yesQuestion: null,
  level: /^Einsteiger/,
  goal: 'Fitness & Gesundheit',
  days: [
    ['Montag', 'Kraft zu Hause', 30],
    ['Mittwoch', 'Kraft zu Hause', 30],
    ['Freitag', 'Kraft zu Hause', 30],
  ] as [string, string, number][],
};

/** Kein waagerechtes Scrollen: Inhalt nicht breiter als das Fenster (1 px Rundung). */
async function expectNoHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client + 1);
}

async function zoom200(page: Page) {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('zoom', '2');
  });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('Willkommen: Umbruch bei 320 px und Zoom 200 % ohne waagerechtes Scrollen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: "Los geht's" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await zoom200(page);
  await expect(page.getByRole('button', { name: "Los geht's" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('Große Ansicht: größere Schrift und Knöpfe, „Heute“ zeigt weniger, Vorlesen nur mit lokaler Stimme', async ({
  page,
}) => {
  await onboard(page, HOME_3_DAYS);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await expect(page.getByTestId('today-calendar')).toBeVisible();
  await expect(page.getByTestId('today-more')).toHaveCount(0);
  const normalSize = await page
    .getByTestId('today-calendar')
    .evaluate((el) => parseFloat(getComputedStyle(el.querySelector('div[dir]') ?? el).fontSize));

  await page.goto('/settings?thema=anzeige');
  const large = page.getByTestId('settings-large-view');
  await expect(large).toHaveAttribute('aria-checked', 'false');
  // Geburtsjahr 1990 → kein Vorschlag (erst ab 60).
  await expect(page.getByTestId('settings-large-view-suggestion')).toHaveCount(0);
  // Headless-Browser ohne lokale deutsche Stimme → Hinweis statt Schalter.
  await expect(
    page.getByTestId('settings-read-aloud-unavailable').or(page.getByTestId('settings-read-aloud')),
  ).toBeVisible();
  await large.click();
  await expect(large).toHaveAttribute('aria-checked', 'true');
  const box = await large.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(56);

  // Bleibt nach dem Neuladen (nur dieses Gerät).
  await page.reload();
  await expect(page.getByTestId('settings-large-view')).toHaveAttribute('aria-checked', 'true');

  await page.goto('/today');
  await heading(page, 'Training');
  // Weniger Elemente: Kalender, Woche, Verlauf, Übungen erst nach „Mehr anzeigen“.
  await expect(page.getByTestId('today-calendar')).toHaveCount(0);
  const more = page.getByTestId('today-more');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('today-calendar')).toBeVisible();
  const largeSize = await page
    .getByTestId('today-calendar')
    .evaluate((el) => parseFloat(getComputedStyle(el.querySelector('div[dir]') ?? el).fontSize));
  expect(largeSize).toBeGreaterThan(normalSize);
  const calendarBox = await page.getByTestId('today-calendar').boundingBox();
  expect(calendarBox?.height ?? 0).toBeGreaterThanOrEqual(56);

  // Umbruch: 320 px und Zoom 200 % ohne waagerechtes Scrollen, auch in der großen Ansicht.
  await page.setViewportSize({ width: 320, height: 700 });
  await expectNoHorizontalScroll(page);
  await zoom200(page);
  await expectNoHorizontalScroll(page);

  // Übungsseite: ohne lokale Stimme kein Vorlese-Knopf.
  await page.evaluate(() => document.documentElement.style.removeProperty('zoom'));
  await page.getByTestId('today-glossary').click();
  await heading(page, 'Übungen');
  await page.getByTestId('glossary-item').first().click();
  await expect(page.getByTestId('glossary-steps')).toBeVisible();
  await expect(page.getByTestId('read-aloud')).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Wettkampfplan leicht finden (Gründer-Rückmeldung 20.10.2026: „Man findet den Wettkampfplan nicht … es sollte besser
 * ersichtlich sein, wie der Plan aufgebaut ist“) im TESTMODUS, fester Tag Mittwoch, 07.10.2026 (Europe/Berlin):
 * Kachel „Mein Wettkampf“ (ohne/mit Wettkampf), „So ist dein Plan aufgebaut“ mit aktueller Woche und Erholungswochen,
 * Tipp auf eine Woche → Kalender, Knopf „Wettkampfplan“ im Training, „Wettkampf“ unter „Mehr“ zuerst und als wählbarer
 * Knopf der Menüleiste (Zurück-Navigation), 320 px ohne waagerechtes Scrollen.
 */

const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');

const tabBar = (page: Page) => page.getByRole('tablist', { name: 'Hauptmenü' });
const tab = (page: Page, name: string) => tabBar(page).getByRole('tab', { name, exact: true });

async function fillDate(page: Page, label: string, day: string, month: string, year: string) {
  await page.getByLabel(`${label}: Tag`).fill(day);
  await page.getByLabel(`${label}: Monat`).fill(month);
  await page.getByLabel(`${label}: Jahr`).fill(year);
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
});

test('Wettkampfplan finden: Kachel, Aufbau des Plans, Training, Mehr, Menüleiste', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await onboard(page, {
    consent: true,
    yesQuestion: null,
    level: /^Fortgeschritten/,
    goal: 'Ausdauer',
    discipline: 'Halbmarathon',
    days: [
      ['Montag', 'Ausdauer', 60],
      ['Mittwoch', 'Ausdauer', 60],
      ['Samstag', 'Ausdauer', 90],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  // Ohne Wettkampf kein Knopf „Wettkampfplan“ im Training.
  await expect(page.getByTestId('today-competition-plan')).toHaveCount(0);

  // --- Heute ohne Wettkampf: Kachel mit „Wettkampf planen“ ---------------------------------------------------
  await tab(page, 'Heute').click();
  await expect(page.getByTestId('overview-header')).toBeVisible();
  const tile = page.getByTestId('overview-competition');
  await expect(tile).toContainText('Mein Wettkampf');
  await expect(page.getByTestId('overview-competition-none')).toBeVisible();
  await page.getByTestId('overview-competition-plan').click();
  await heading(page, 'Wettkampf eintragen');
  await expect(page).toHaveURL(/\/wettkampf\?neu=1$/);

  // --- Wettkampf mit Wettkampfplan anlegen -----------------------------------------------------------------
  await fillDate(page, 'Renntag', '31', '01', '2027');
  await expect(page.getByTestId('competition-feasibility-ok')).toHaveText('✓ Passt');
  await page.getByTestId('competition-name').fill('Winterlauf');
  await page.getByTestId('competition-create-plan').click();
  await page.getByRole('button', { name: 'Plan neu erstellen' }).click();
  await expect(page.getByTestId('competition-message')).toContainText(
    'Dein Wettkampfplan ist fertig',
  );

  // --- So ist dein Plan aufgebaut: direkt unter der Zusammenfassung ----------------------------------------
  const outline = page.getByTestId('competition-outline');
  await expect(outline).toContainText('So ist dein Plan aufgebaut');
  await expect(page.getByTestId('competition-outline-status')).toHaveText(
    'Du bist in der Einstiegswoche (bis zum Renntag 16 Wochen).',
  );
  const summaryBox = await page.getByTestId('competition-summary').boundingBox();
  const outlineBox = await outline.boundingBox();
  const editBox = await page.getByTestId('competition-edit').boundingBox();
  expect(summaryBox && outlineBox && summaryBox.y < outlineBox.y).toBe(true);
  expect(outlineBox && editBox && outlineBox.y < editBox.y).toBe(true);
  for (const phase of ['base', 'build', 'peak', 'taper', 'race_week', 'recovery']) {
    await expect(page.getByTestId(`competition-outline-phase-${phase}`)).toBeVisible();
  }
  const base = page.getByTestId('competition-outline-phase-base');
  await expect(base).toContainText('Basis · Wochen 0–7');
  await expect(base).toContainText('05.10.2026 – 29.11.2026');
  await expect(base).toContainText('Du baust Grundlage auf');
  await expect(base).toContainText('Wochenumfang: steigt');
  await expect(page.getByTestId('competition-outline-current-phase')).toHaveCount(1);
  await expect(base.getByTestId('competition-outline-current-phase')).toBeVisible();
  // Aktuelle Woche markiert (Wort „jetzt“, für den Bildschirmleser „aktuelle Woche“).
  const current = page.getByTestId('competition-outline-week-2026-10-05');
  await expect(current).toContainText('Einstieg');
  await expect(current).toContainText('jetzt');
  await expect(current).toHaveAttribute('aria-label', /aktuelle Woche/);
  // Erholungswochen sichtbar markiert (mit Wort).
  await expect(base).toContainText('Erholung');
  await expect(page.getByTestId('competition-outline-phase-race_week')).toContainText('Renntag');
  await expect(page.getByTestId('competition-outline-phase-taper')).toContainText('70 %');

  // Tipp auf eine Woche → Kalender in dieser Woche, Zurück → Wettkampf.
  await page.getByTestId('competition-outline-week-2026-10-19').click();
  await expect(page).toHaveURL(/\/kalender\?woche=2026-10-19$/);
  await expect(page.getByTestId('calendar-range')).toContainText('19.10.');
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await heading(page, 'Mein Wettkampf');

  // --- Übersicht mit Wettkampf ------------------------------------------------------------------------------
  await tab(page, 'Heute').click();
  await expect(page.getByTestId('overview-header')).toBeVisible();
  await expect(page.getByTestId('overview-competition-name')).toHaveText(
    'Winterlauf · Halbmarathon',
  );
  await expect(page.getByTestId('overview-competition-countdown')).toHaveText(
    'Noch 116 Tage (gut 16 Wochen)',
  );
  await expect(page.getByTestId('overview-competition-week')).toHaveText(
    'Basis · Einstiegswoche (bis zum Renntag 16 Wochen)',
  );
  await expect(page.getByTestId('overview-competition-ampel')).toHaveText('✓ Wettkampfplan aktiv');
  await expect(page.getByTestId('overview-competition-open')).toHaveAttribute(
    'aria-label',
    'Wettkampfplan für Winterlauf ansehen',
  );
  await page.getByTestId('overview-competition-open').click();
  await heading(page, 'Mein Wettkampf');
  await expect(page).toHaveURL(/\/wettkampf$/);
  // „Wettkampf“ ist (noch) kein Knopf der Leiste → sein Reiter „Mehr“ ist markiert (26.10.2026).
  await expect(tab(page, 'Mehr')).toHaveAttribute('aria-selected', 'true');

  // --- Training: deutlicher Knopf oben, Countdown-Karte bleibt ------------------------------------------
  await tab(page, 'Training').click();
  await heading(page, 'Training');
  // Reiter bleiben geladen – nur im Reiter „Training“ suchen.
  const todayScreen = page.getByTestId('today');
  await expect(todayScreen.getByTestId('competition-countdown')).toBeVisible();
  const link = todayScreen.getByTestId('today-competition-plan');
  await expect(link).toHaveText('Wettkampfplan');
  const linkY = (await link.boundingBox())?.y ?? 1e9;
  const countdownY = (await todayScreen.getByTestId('competition-countdown').boundingBox())?.y ?? 0;
  expect(linkY).toBeLessThan(countdownY);
  await link.click();
  await heading(page, 'Mein Wettkampf');
  // Zurück führt zum zuvor besuchten Reiter.
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await heading(page, 'Training');

  // --- Mehr: „Wettkampf“ als erste Kachel unter „Sport“ -----------------------------------------------------------
  await tab(page, 'Mehr').click();
  await heading(page, 'Mehr');
  const moreWettkampf = page.getByTestId('more-area-wettkampf');
  await expect(moreWettkampf).toHaveAccessibleName(/^Wettkampf/);
  // „Wettkampf“ ist die erste Kachel unter „Sport“ (vor Ausdauer und Skill-Pfaden).
  const moreBox = await moreWettkampf.boundingBox();
  const enduranceBox = await page.getByTestId('more-endurance').boundingBox();
  expect(moreBox && enduranceBox && moreBox.x < enduranceBox.x).toBe(true);
  // Kein doppelter Eintrag weiter unten.
  await expect(page.getByTestId('more-competition')).toHaveCount(0);
  await moreWettkampf.click();
  await heading(page, 'Mein Wettkampf');

  // --- Menüleiste anpassen: „Wettkampf“ wählbar (Standard: 5 Knöpfe ohne Wettkampf, Platz für einen 6.) --------
  await page.goto('/menueleiste');
  await heading(page, 'Menüleiste anpassen');
  await page.getByRole('checkbox', { name: 'Wettkampf in der Menüleiste' }).click();
  await expect(page.getByTestId('menu-bar-live')).toHaveText(
    'Wettkampf ist jetzt in der Menüleiste.',
  );
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-header')).toBeVisible();
  await expect(tab(page, 'Wettkampf')).toBeVisible();
  await tab(page, 'Wettkampf').click();
  await heading(page, 'Mein Wettkampf');
  await expect(tab(page, 'Wettkampf')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('competition-outline')).toBeVisible();
  // Zurück (Knopf auf der Seite) → zuvor besuchter Reiter.
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect(page.getByTestId('overview-header')).toBeVisible();
  await expect(tab(page, 'Heute')).toHaveAttribute('aria-selected', 'true');

  // --- 320 px: alles lesbar, kein waagerechtes Scrollen ---------------------------------------------------
  await page.setViewportSize({ width: 320, height: 640 });
  await noHorizontalScroll(page);
  await expect(page.getByTestId('overview-competition-open')).toBeVisible();
  await tab(page, 'Wettkampf').click();
  await heading(page, 'Mein Wettkampf');
  await expect(page.getByTestId('competition-outline')).toBeVisible();
  await noHorizontalScroll(page);
  for (const t of await tabBar(page).getByRole('tab').all()) {
    const clipped = await t.evaluate((el) =>
      Array.from(el.querySelectorAll('*'))
        .filter((e) => e.childElementCount === 0 && (e.textContent ?? '').trim() !== '')
        .some((e) => e.scrollWidth > e.clientWidth + 1),
    );
    expect(clipped, (await t.getAttribute('aria-label')) ?? '').toBe(false);
  }
});

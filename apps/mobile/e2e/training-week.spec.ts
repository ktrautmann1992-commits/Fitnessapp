import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Training-Übersicht (docs/PLAN-AUSWERTUNG.md „Training-Übersicht“, Gründer-Freigabe 23.10.2026), Web-Export im Testmodus, Handy-Ansicht:
 * Wochen-Leiste mit Zuständen und Legende, Tages-Blatt (auf anderen Tag legen, auslassen, Ruhetag), Woche mit einer
 * Zeile je Tag – und der Fehler aus dem Gründer-Screenshot: eine Uhr-Einheit an einem Tag ohne Plan zählt nie still für
 * die geplante Einheit eines anderen Tages, sondern fragt einmal („Ja, Samstag ist erledigt“). Fester Start:
 * Donnerstag, 22.10.2026, 9 Uhr (Beispiel-Uhr: Läufe Fr 16., So 18., Di 20.; Kraft Mo 19.; Yoga Mi 21.).
 */

const THURSDAY = new Date('2026-10-22T09:00:00+02:00');
const TUE = '2026-10-20';
const THU = '2026-10-22';
const FRI = '2026-10-23';
const SAT = '2026-10-24';

const cell = (page: Page, date: string) => page.getByTestId(`plan-week-day-${date}`);

async function setup(page: Page, days: Parameters<typeof onboard>[1]['days'], consent = true) {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  await page.clock.setFixedTime(THURSDAY);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, { consent, level: /^Einsteiger/, goal: 'Muskelaufbau', days });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
}

test('Leiste: 7 Tage mit Zustand, Legende, Werkzeugleiste; Blatt legt eine Einheit auf einen anderen Tag', async ({
  page,
}) => {
  await setup(page, [
    ['Donnerstag', 'Kraft im Studio', 60],
    ['Samstag', 'Kraft im Studio', 60],
  ]);
  // Hero: heutige Einheit mit Start.
  await expect(page.getByTestId('today-hero')).toContainText('Training heute');
  await expect(page.getByTestId('workout-start')).toHaveText('Training starten');
  const week = page.getByTestId('plan-week');
  await expect(week.getByRole('button')).toHaveCount(7);
  await expect(cell(page, THU)).toHaveAccessibleName(/^Donnerstag, 22\.10\.: .*\(heute\)/);
  await expect(cell(page, TUE)).toHaveAccessibleName(/^Dienstag, 20\.10\.: Ruhetag$/);
  await expect(cell(page, SAT)).toHaveAccessibleName(/^Samstag, 24\.10\.: /);
  await expect(page.getByTestId('plan-week-count')).toHaveText('· 0 von 2 Einheiten');
  await expect(page.getByTestId('plan-week-legend')).toContainText('erledigt');
  await expect(page.getByTestId('plan-week-legend')).toContainText('verpasst');
  for (const id of ['today-calendar', 'today-history', 'today-swap', 'today-glossary']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }

  // Samstag antippen → Blatt mit Tag-Chips; Do = tauschen, Freitag liegt neben Do/Sa (48 h) → gesperrt, So frei.
  await cell(page, SAT).click();
  const sheet = page.getByTestId('day-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('day-sheet-title')).toContainText('Sa ·');
  await expect(sheet.getByTestId(`day-sheet-chip-${SAT}`)).toHaveAccessibleName(
    /Hier liegt die Einheit gerade/,
  );
  await expect(sheet.getByTestId(`day-sheet-chip-${THU}`)).toContainText('Tausch');
  await expect(sheet.getByTestId(`day-sheet-chip-${FRI}`)).toContainText('–');
  await expect(sheet.getByTestId(`day-sheet-chip-${TUE}`)).toHaveAccessibleName(/Vergangenheit/);
  await sheet.getByTestId(`day-sheet-chip-${FRI}`).click();
  await expect(sheet.getByTestId('day-sheet-move-info')).toContainText('Freitag');
  await sheet.getByTestId('day-sheet-chip-2026-10-25').click();
  await expect(page.getByTestId('day-sheet')).toHaveCount(0);
  await expect(page.getByTestId('plan-message')).toHaveText('Auf Sonntag verschoben.');
  await expect(cell(page, '2026-10-25')).toHaveAccessibleName(/verschoben von Sa/);
  await expect(cell(page, SAT)).toHaveAccessibleName(/Ruhetag \(verschoben auf So\)/);

  // „Tauschen“ öffnet das Blatt der heutigen Einheit; „Diese Woche auslassen“ streicht nach Rückfrage.
  await page.getByTestId('today-swap').click();
  await expect(page.getByTestId('day-sheet').getByTestId('day-sheet-title')).toContainText('Do ·');
  await page.getByTestId('day-sheet-skip').click();
  await expect(page.getByRole('heading', { name: 'Einheit auslassen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Einheit auslassen' }).click();
  await expect(page.getByTestId('plan-message')).toHaveText('Die Einheit entfällt diese Woche.');
  await expect(cell(page, THU)).toHaveAccessibleName(/– entfällt/);
  await expect(page.getByTestId('plan-week-count')).toHaveText('· 0 von 1 Einheit');

  // Ruhetag-Blatt: Einheit hierher legen bzw. freie Einheit eintragen.
  await cell(page, FRI).click();
  await expect(page.getByTestId('day-sheet-bring')).toBeVisible();
  await expect(page.getByTestId('day-sheet-free')).toHaveCount(0);
  await page.getByTestId('day-sheet-close').click();
  await cell(page, TUE).click();
  await expect(page.getByTestId('day-sheet-free')).toBeVisible();
  await page.getByTestId('day-sheet-close').click();

  // Woche: eine Zeile je Tag, ganze Zeile öffnet dasselbe Blatt; keine wiederholten „Dein Tag“-Links mehr.
  await page.getByTestId('today-week').click();
  await heading(page, 'Deine Woche');
  await expect(page.getByTestId(`week-day-${THU}`)).toContainText('entfällt');
  await expect(page.getByTestId('week-day-2026-10-25')).toContainText('geplant');
  await expect(page.getByTestId('week-day-2026-10-25')).toContainText('verschoben von Sa');
  await expect(page.getByTestId('week-summary')).toContainText('0/1');
  await expect(page.getByTestId(`week-open-day-${THU}`)).toHaveCount(0);
  await page.getByTestId('week-day-2026-10-25').click();
  await expect(page.getByTestId('day-sheet-day')).toBeVisible();
  await page.getByTestId('day-sheet-day').click();
  await expect(page).toHaveURL(/\/tag\/2026-10-25$/);
});

test('Uhr-Lauf an einem Tag ohne Plan: einmalige Frage → „Ja“ → Sa vorgezogen, Di ✓ statt Sa', async ({
  page,
}) => {
  await setup(page, [
    ['Montag', 'Kraft im Studio', 45],
    ['Samstag', 'Ausdauer', 30],
  ]);
  // Ohne Uhr: Samstag geplant, keine Frage.
  await expect(cell(page, SAT)).toHaveAccessibleName(/^Samstag, 24\.10\.: .+$/);
  await expect(page.getByTestId('cross-day-dialog')).toHaveCount(0);

  // Beispiel-Uhr verbinden (Testmodus): Läufe u. a. am Dienstag 20.10. – dort ist nichts geplant.
  await page.goto('/settings');
  await page.getByTestId('settings-smartwatch').click();
  await page.getByTestId('smartwatch-consent-accept').click();
  await page.getByTestId('smartwatch-connect').click();
  await expect(page.getByTestId('smartwatch-message')).toContainText('Abgleich fertig');
  await page.goto('/today');
  await heading(page, 'Training');

  // Frage statt stiller Zuordnung.
  const dialog = page.getByTestId('cross-day-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Neuer Lauf von deiner Uhr');
  await expect(page.getByTestId('cross-day-meta')).toContainText('Di 07:00');
  await expect(page.getByTestId('cross-day-text')).toContainText('Am Samstag ist „');
  await expect(page.getByTestId('cross-day-text')).toContainText('Soll dieser Lauf dafür zählen?');
  // Bis zur Antwort: Dienstag erledigt (freie Einheit), Samstag geplant.
  await page.getByTestId('cross-day-yes').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('plan-message')).toContainText('Zählt für Sa');
  await expect(cell(page, TUE)).toHaveAccessibleName(/erledigt, statt Sa/);
  await expect(cell(page, TUE)).toContainText('statt Sa');
  await expect(cell(page, SAT)).toHaveAccessibleName(/vorgezogen, erledigt am Di/);
  await expect(page.getByTestId('plan-week-count')).toHaveText('· 1 von 1 Einheit');

  // Bleibt nach dem Neuladen – keine zweite Frage.
  await page.reload();
  await heading(page, 'Training');
  await expect(cell(page, SAT)).toHaveAccessibleName(/vorgezogen/);
  await expect(page.getByTestId('cross-day-dialog')).toHaveCount(0);

  // Woche: Sa „vorgezogen“, Di erledigt „statt Sa“.
  await page.getByTestId('today-week').click();
  await heading(page, 'Deine Woche');
  await expect(page.getByTestId(`week-day-${SAT}`)).toContainText('vorgezogen');
  await expect(page.getByTestId(`week-day-${SAT}`)).toContainText('Sa · frei');
  await expect(page.getByTestId(`week-day-${TUE}`)).toContainText('✓ erledigt');
  await expect(page.getByTestId(`week-day-${TUE}`)).toContainText('statt Sa');
  await expect(page.getByTestId(`week-day-${TUE}`)).toContainText('laut Uhr');

  // Später im Tag ändern: „Nicht für … zählen“ → Samstag wieder geplant, keine neue Frage.
  await page.getByTestId(`week-day-${TUE}`).click();
  const sheet = page.getByTestId('day-sheet');
  await expect(sheet.getByTestId('day-sheet-counts')).toContainText('Zählt für Sa');
  await sheet.getByTestId('day-sheet-change').click();
  await sheet.getByTestId('day-sheet-unassign').click();
  await expect(sheet.getByTestId('day-sheet-counts')).toHaveText('Zusätzliche Einheit');
  await sheet.getByTestId(`day-sheet-assign-${SAT}`).waitFor();
  await page.getByTestId('day-sheet-close').click();
  await expect(page.getByTestId(`week-day-${SAT}`)).toContainText('geplant');
  await page.goto('/today');
  await heading(page, 'Training');
  await expect(page.getByTestId('cross-day-dialog')).toHaveCount(0);
});

test('„Nein, zusätzliche Einheit“: Samstag bleibt geplant, Dienstag erledigt ohne „statt“', async ({
  page,
}) => {
  await setup(page, [
    ['Montag', 'Kraft im Studio', 45],
    ['Samstag', 'Ausdauer', 30],
  ]);
  await page.goto('/settings');
  await page.getByTestId('settings-smartwatch').click();
  await page.getByTestId('smartwatch-consent-accept').click();
  await page.getByTestId('smartwatch-connect').click();
  await expect(page.getByTestId('smartwatch-message')).toContainText('Abgleich fertig');
  await page.goto('/today');
  await page.getByTestId('cross-day-no').click();
  await expect(page.getByTestId('cross-day-dialog')).toHaveCount(0);
  await expect(cell(page, TUE)).toHaveAccessibleName(/erledigt/);
  await expect(cell(page, TUE)).not.toHaveAccessibleName(/statt Sa/);
  await expect(cell(page, SAT)).not.toHaveAccessibleName(/vorgezogen/);
  await expect(page.getByTestId('plan-week-count')).toHaveText('· 0 von 1 Einheit');
});

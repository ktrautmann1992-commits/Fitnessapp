import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Muskelkarte (Nachtrag „Muskelkarte“ in docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md) im TESTMODUS: Übungsdetail zeigt die
 * Karte mit Legende in Worten und Screenreader-Text; im Trainingsmodus kleine Karte neben dem Namen, antippbar für groß.
 * Ohne Bild mit Lizenz gibt es keinen Bereich „Ausgangsposition“.
 */

const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');

const HOME_3_DAYS = {
  consent: true,
  yesQuestion: null,
  level: /^Einsteiger/,
  goal: 'Muskelaufbau',
  days: [
    ['Montag', 'Kraft zu Hause', 45],
    ['Mittwoch', 'Kraft zu Hause', 45],
    ['Freitag', 'Kraft zu Hause', 45],
  ] as [string, string, number][],
};

async function toToday(page: Page) {
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('Übungsdetail zeigt Muskelkarte mit Legende; Training: kleine Karte öffnet große', async ({
  page,
}) => {
  await onboard(page, HOME_3_DAYS);
  await toToday(page);

  // Trainingsmodus: kleine Karte neben dem Namen, antippbar → Dialog mit großer Karte und Legende.
  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout')).toBeVisible();
  const thumb = page.getByTestId('workout-muscles-0');
  await expect(thumb).toBeVisible();
  await expect(thumb).toHaveAttribute('role', 'button');
  await expect(thumb).toHaveAttribute(
    'aria-label',
    /^Muskelkarte groß anzeigen\. Trainiert vor allem: /,
  );
  await thumb.click();
  const dialog = page.getByTestId('workout-muscles-0-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('workout-muscles-0-large-legend')).toContainText(
    'Hauptmuskeln: ',
  );
  await page.getByTestId('workout-muscles-0-close').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('workout')).toBeVisible();

  // Übungsdetail Bankdrücken (Langhantel): Brust primär, Trizeps und vordere Schulter mitbeteiligt.
  await page.goto('/uebungen/bankdruecken-langhantel');
  await heading(page, 'Bankdrücken mit Langhantel');
  await heading(page, 'Beanspruchte Muskeln');
  const map = page.getByTestId('glossary-muscle-map');
  await expect(map).toBeVisible();
  await expect(page.getByTestId('glossary-muscle-map-image')).toHaveAttribute(
    'aria-label',
    'Trainiert vor allem: Brust. Mitbeteiligt: Trizeps, vordere Schulter.',
  );
  const legend = page.getByTestId('glossary-muscle-map-legend');
  await expect(legend).toContainText('Hauptmuskeln: Brust');
  await expect(legend).toContainText('Mitbeteiligt: Trizeps, vordere Schulter');
  // Vorder- und Rückansicht, Regionen in der passenden Stufe.
  await expect(page.getByTestId('muscle-map-figure-front')).toBeVisible();
  await expect(page.getByTestId('muscle-map-figure-back')).toBeVisible();
  await expect(page.getByTestId('muscle-region-front-chest-primary')).toHaveCount(1);
  await expect(page.getByTestId('muscle-region-back-triceps-secondary')).toHaveCount(1);
  await expect(page.getByTestId('muscle-region-back-glutes-none')).toHaveCount(1);
  // Kein Bild mit Lizenz → kein Bereich „Ausgangsposition“.
  await expect(page.getByTestId('exercise-start-position')).toHaveCount(0);
});

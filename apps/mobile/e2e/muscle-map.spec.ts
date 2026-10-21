import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Muskelkarte (Nachtrag „Muskelkarte“ in docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md) im TESTMODUS: Übungsdetail zeigt die
 * Karte mit Legende in Worten und Screenreader-Text; im Trainingsmodus kleine Karte neben dem Namen, antippbar für groß.
 * Darüber das Bild „Ausgangsposition“ (eigene Illustration, Gründer-Entscheidung B) mit deutschem Alt-Text.
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
  // Ausgangsposition: eigene Illustration (Entscheidung B) über der Muskelkarte, mit deutschem Alt-Text.
  const start = page.getByTestId('exercise-start-position');
  await expect(start).toBeVisible();
  await expect(start.getByRole('heading', { name: 'Ausgangsposition' })).toBeVisible();
  const image = page.getByRole('img', { name: /^Ausgangsposition: auf der Flachbank liegen/ });
  await expect(image).toBeVisible();
  await expect(image.locator('svg')).toHaveCount(1);
  await expect(start).toContainText('Eigene Illustration von Alpha5');
  const startBox = await start.boundingBox();
  const mapBox = await map.boundingBox();
  expect(startBox!.y).toBeLessThan(mapBox!.y);
});

test('Ausgangsposition: Bild im Dunkelmodus in Theme-Farben, ohne Netzaufruf für Bilder', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const external: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith('http://127.0.0.1') && !url.startsWith('data:')) external.push(url);
  });
  await onboard(page, HOME_3_DAYS);
  await toToday(page);
  await page.goto('/uebungen/liegestuetz');
  await heading(page, 'Liegestütz');
  const image = page.getByRole('img', {
    name: 'Ausgangsposition: hoher Liegestütz von der Seite, Arme gestreckt, Hände unter den Schultern, Körper vom Kopf bis zu den Fersen gerade.',
  });
  await expect(image).toBeVisible();
  // Figur in Eisblau (dunkle Palette), nicht im hellen Graphit.
  const html = await image.innerHTML();
  expect(html.toLowerCase()).toContain('#e3ebff');
  expect(html.toLowerCase()).not.toContain('#262c3a');
  expect(external).toEqual([]);
});

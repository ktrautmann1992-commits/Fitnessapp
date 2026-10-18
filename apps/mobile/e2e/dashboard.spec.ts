import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Startbildschirm, Übersicht (Kacheln), untere Menüleiste und „Mein Konto“ im TESTMODUS (docs/PLAN-DASHBOARD.md).
 * Fester Tag: Mittwoch, 07.10.2026 (Europe/Berlin) – Studio-Plan Mo/Mi/Fr, heute steht also eine Einheit an.
 */

const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
});

const tabBar = (page: Page) => page.getByRole('tablist', { name: 'Hauptmenü' });
const tab = (page: Page, name: string) => tabBar(page).getByRole('tab', { name, exact: true });

async function onboardStudio(page: Page, consent: boolean) {
  await onboard(page, {
    consent,
    yesQuestion: null,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft im Studio', 60],
      ['Mittwoch', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
}

test('Startbildschirm: zwei Wege, im Testmodus erklärt statt „Anmelden“', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('welcome')).toBeVisible();
  await expect(page.getByRole('button', { name: "Neu hier – Los geht's" })).toBeVisible();
  // Testmodus: kein Anmelde-Knopf, sondern ein verständlicher Hinweis.
  await expect(page.getByTestId('welcome-login')).toHaveCount(0);
  await expect(page.getByTestId('welcome-test-login-note')).toContainText(
    'Anmelden gibt es erst, wenn die App mit der Datenbank verbunden ist',
  );
  // Ohne Sitzung keine Menüleiste, auch nicht über eine direkte Adresse.
  await expect(tabBar(page)).toHaveCount(0);
  await page.goto('/uebersicht');
  await expect(page.getByTestId('welcome')).toBeVisible();
  await expect(tabBar(page)).toHaveCount(0);
  // „Neu hier“ führt wie bisher zuerst zur Altersprüfung.
  await page.getByRole('button', { name: "Neu hier – Los geht's" }).click();
  await heading(page, 'Wann bist du geboren?');
  await expect(tabBar(page)).toHaveCount(0);
});

test('Übersicht: Kacheln führen in die Bereiche, Menüleiste auf allen Hauptbereichen', async ({
  page,
}) => {
  await onboardStudio(page, true);
  await expect(tabBar(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Zum Plan' }).click();

  // „Zum Plan“ öffnet wie bisher „Heute“ – jetzt der Reiter „Training“.
  await heading(page, 'Heute');
  await expect(tab(page, 'Training')).toHaveAttribute('aria-selected', 'true');

  // Neu laden → Startseite ist die Übersicht.
  await page.goto('/');
  await expect(page).toHaveURL(/\/uebersicht$/);
  await heading(page, 'Übersicht');
  await expect(tab(page, 'Übersicht')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Training')).toHaveAttribute('aria-selected', 'false');
  for (const name of ['Übersicht', 'Training', 'Ernährung', 'Fortschritt', 'Mehr']) {
    await expect(tab(page, name)).toBeVisible();
  }

  // Training heute: Einheit am Mittwoch mit „Training starten“.
  const training = page.getByTestId('overview-training');
  await expect(training).toContainText('Training heute');
  await expect(training).toContainText('Heute:');
  await expect(page.getByTestId('overview-training-start')).toBeVisible();
  // Körperdaten: mit Einwilligung das zuletzt eingetragene Gewicht (Onboarding: 80 kg) – nie ein Wunschgewicht.
  await expect(page.getByTestId('overview-body-weight')).toContainText('80 kg');
  await expect(page.getByTestId('overview-body')).not.toContainText('Wunschgewicht');
  // Fortschritt: Woche Mo–So (Mo liegt vor dem Planstart → Mi + Fr).
  await expect(page.getByTestId('overview-progress-week')).toHaveText(
    'Diese Woche: 0 von 2 Einheiten erledigt',
  );
  // Ernährung: Kalorienzahlen sind an → Ziel in kcal sichtbar.
  await expect(page.getByTestId('overview-nutrition')).toContainText('Ernährung heute');
  await expect(page.getByTestId('overview-nutrition-target')).toContainText('kcal');

  // Training starten → Trainingsmodus ohne Menüleiste.
  await page.getByTestId('overview-training-start').click();
  await expect(page).toHaveURL(/\/workout\//);
  await expect(tabBar(page)).toHaveCount(0);
  await page.goBack();
  await heading(page, 'Übersicht');

  // Reiter wechseln.
  await tab(page, 'Training').click();
  await heading(page, 'Heute');
  await expect(page).toHaveURL(/\/today$/);
  await tab(page, 'Ernährung').click();
  await expect(page).toHaveURL(/\/ernaehrung$/);
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
  await tab(page, 'Fortschritt').click();
  await heading(page, 'Fortschritt');
  await expect(page.getByTestId('progress-week')).toContainText('0 von 2 Einheiten');
  await page.getByTestId('progress-history').click();
  // Unterseiten liegen über den Reitern – ohne Leiste, mit „Zurück“.
  await expect(page).toHaveURL(/\/history$/);
  await expect(tabBar(page)).toHaveCount(0);
  await page.goBack();
  await heading(page, 'Fortschritt');
  await tab(page, 'Mehr').click();
  await heading(page, 'Mehr');
  await page.getByTestId('more-exercises').click();
  await expect(page).toHaveURL(/\/uebungen$/);
  await page.goBack();
  await tab(page, 'Übersicht').click();

  // Schnellzugriffe.
  await page.getByTestId('overview-recipes').click();
  await expect(page).toHaveURL(/\/rezepte$/);
  await page.goBack();
  await page.getByTestId('overview-calendar').click();
  await expect(page).toHaveURL(/\/kalender$/);
  await page.goBack();

  // Kalorienzahlen aus → keine kcal auf der Übersicht.
  await page.goto('/settings');
  await page.getByTestId('settings-show-numbers').click();
  await expect(page.getByText('Gespeichert.')).toBeVisible();
  await page.goto('/uebersicht');
  await heading(page, 'Übersicht');
  await expect(page.getByTestId('overview-nutrition')).toBeVisible();
  await expect(page.getByTestId('overview-nutrition-target')).toHaveCount(0);
  await expect(page.getByTestId('overview-nutrition')).not.toContainText('kcal');

  // Deep-Links bleiben gleich und zeigen die Leiste.
  await page.goto('/today');
  await heading(page, 'Heute');
  await expect(tab(page, 'Training')).toHaveAttribute('aria-selected', 'true');
});

test('ohne Einwilligung: Körperdaten-Kachel mit Hinweis, kein Gewicht', async ({ page }) => {
  await onboardStudio(page, false);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await tab(page, 'Übersicht').click();
  await heading(page, 'Übersicht');
  await expect(page.getByTestId('overview-body-no-consent')).toContainText(
    'nur mit deiner Einwilligung',
  );
  await expect(page.getByTestId('overview-body-weight')).toHaveCount(0);
  await expect(page.getByTestId('overview-body')).not.toContainText('kg');
});

test('Hinweis „Im Training wartet etwas“ bei einem angefangenen Training', async ({ page }) => {
  await onboardStudio(page, true);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await tab(page, 'Übersicht').click();
  await expect(page.getByTestId('overview-attention')).toHaveCount(0);
  await page.getByTestId('overview-training-start').click();
  await expect(page).toHaveURL(/\/workout\//);
  // Einen Satz abhaken → Entwurf entsteht (im Browser nur im sessionStorage; Neuladen fragt per beforeunload).
  const plus = page.getByTestId('workout-weight-0-0-plus');
  for (let i = 0; i < 8; i += 1) await plus.click();
  await page.getByTestId('workout-done-0-0').click();
  await expect(page.getByTestId('workout-done-0-0')).toHaveAttribute('aria-checked', 'true');
  page.on('dialog', (dialog) => void dialog.accept());
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-attention')).toContainText(
    'Im Training wartet etwas auf dich',
  );
  await expect(page.getByTestId('overview-training-continue')).toBeVisible();
  await page
    .getByTestId('overview-attention')
    .getByRole('button', { name: 'Zum Training' })
    .click();
  await heading(page, 'Heute');
  await expect(page.getByTestId('workout-draft')).toBeVisible();
});

test('Mein Konto: Testmodus, Einwilligungen, Export, Abmelden mit Rückfrage', async ({ page }) => {
  await onboardStudio(page, true);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await tab(page, 'Mehr').click();
  await page.getByTestId('more-account').click();
  await heading(page, 'Mein Konto');
  await expect(tabBar(page)).toHaveCount(0);
  await expect(page.getByTestId('konto-test-mode')).toContainText('Testmodus – kein Konto');
  await expect(page.getByTestId('settings-export')).toBeVisible();
  await expect(page.getByTestId('konto-delete')).toBeVisible();

  // Einwilligungen: derselbe Block wie in den Einstellungen.
  await page.getByTestId('konto-consents').click();
  await heading(page, 'Einwilligungen');
  await expect(page.getByRole('button', { name: 'Gesundheitsdaten: Widerrufen' })).toBeVisible();
  await page.getByRole('button', { name: 'Zurück' }).click();
  await heading(page, 'Mein Konto');

  // Lizenzen.
  await page.getByTestId('konto-licenses').click();
  await expect(page).toHaveURL(/\/lizenzen$/);
  await page.goBack();
  await heading(page, 'Mein Konto');

  // Einstellungen verweisen auf „Mein Konto“.
  await page.goto('/settings');
  await page.getByTestId('settings-account').click();
  await heading(page, 'Mein Konto');

  // Abmelden mit Rückfrage – „Abbrechen“ lässt alles, wie es ist.
  await page.getByTestId('konto-signout').click();
  const dialog = page.getByTestId('dialog-signout_confirm');
  await expect(dialog).toContainText('Wirklich abmelden?');
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByTestId('dialog-signout_confirm')).toHaveCount(0);
  await heading(page, 'Mein Konto');
  await page.getByTestId('konto-signout').click();
  await page
    .getByTestId('dialog-signout_confirm')
    .getByRole('button', { name: 'Abmelden' })
    .click();
  await expect(page.getByTestId('welcome')).toBeVisible();
  await expect(tabBar(page)).toHaveCount(0);
});

import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Etappe E2 im TESTMODUS (docs/PLAN-EINKAUFEN-AUSDAUER.md 4): Übersicht bearbeiten (ausblenden, verschieben nur per
 * Knopf mit Ansage, zurücksetzen, bleibt nach dem Neuladen) und Menüleiste anpassen (aufnehmen bis 6 Knöpfe, Regeln
 * mit Grund, verschieben, ausgeblendete Bereiche unter „Mehr“, Lesbarkeit bei 320 px Breite).
 * Fester Tag: Mittwoch, 07.10.2026 (Europe/Berlin).
 */

const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
});

const tabBar = (page: Page) => page.getByRole('tablist', { name: 'Hauptmenü' });
const tabNames = async (page: Page) =>
  (await tabBar(page).getByRole('tab').all()).map(async (t) => t.getAttribute('aria-label'));

async function tabs(page: Page): Promise<string[]> {
  return (await Promise.all(await tabNames(page))).map((n) => n ?? '');
}

/** Vorschau auf „Menüleiste anpassen“ (dort liegt keine Menüleiste – Unterseite im Stapel). */
async function preview(page: Page): Promise<string[]> {
  const text = (await page.getByTestId('menu-bar-preview').textContent()) ?? '';
  return text.replace('So sieht deine Menüleiste aus:', '').trim().split(' · ');
}

async function onboardStudio(page: Page) {
  await onboard(page, {
    consent: true,
    yesQuestion: null,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft im Studio', 60],
      ['Mittwoch', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-header')).toBeVisible();
}

/** Reihenfolge der Kacheln auf der Seite (nach Lage von oben nach unten). */
async function tileOrder(page: Page): Promise<string[]> {
  const ids = [
    'overview-training',
    'overview-competition',
    'overview-nutrition',
    'overview-body',
    'overview-progress',
  ];
  const found: { id: string; y: number }[] = [];
  for (const id of ids) {
    if ((await page.getByTestId(id).count()) === 0) continue;
    const box = await page.getByTestId(id).boundingBox();
    if (box) found.push({ id, y: box.y });
  }
  return found.sort((a, b) => a.y - b.y).map((f) => f.id);
}

test('Übersicht bearbeiten: ausblenden, verschieben mit Ansage, bleibt nach dem Neuladen, zurücksetzen', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await onboardStudio(page);
  // „Mein Wettkampf“ steht im Standard direkt unter „Training heute“ (Gründer-Rückmeldung 20.10.2026).
  expect(await tileOrder(page)).toEqual([
    'overview-training',
    'overview-competition',
    'overview-nutrition',
    'overview-body',
    'overview-progress',
  ]);
  // Workouts-Kachel (Workout-Bibliothek) ist eine Kachel wie die anderen.
  await expect(page.getByTestId('tile-workouts')).toBeVisible();
  await page.getByTestId('overview-edit-open').click();
  await expect(page.getByTestId('overview-edit')).toBeVisible();
  // Erste Kachel: „Nach oben“ geht nicht; letzte: „Nach unten“ geht nicht.
  await expect(page.getByTestId('overview-edit-up-training')).toBeDisabled();
  await expect(page.getByTestId('overview-edit-down-shortcuts')).toBeDisabled();

  // Körperdaten ausblenden.
  await page.getByRole('checkbox', { name: 'Körperdaten anzeigen' }).click();
  await expect(page.getByTestId('overview-body')).toHaveCount(0);
  await expect(page.getByTestId('overview-edit-live')).toHaveText('Körperdaten ist ausgeblendet.');

  // „Mein Wettkampf“ ausblenden (ein-/ausblendbar wie alle Kacheln).
  await page.getByRole('checkbox', { name: 'Mein Wettkampf anzeigen' }).click();
  await expect(page.getByTestId('overview-competition')).toHaveCount(0);

  // Ernährung dreimal nach oben (Knopf mit Namen für den Bildschirmleser), Ansage der neuen Stelle.
  await page.getByRole('button', { name: 'Ernährung heute nach oben' }).click();
  await expect(page.getByTestId('overview-edit-live')).toHaveText(
    'Ernährung heute ist jetzt an Stelle 3 von 8.',
  );
  await page.getByRole('button', { name: 'Ernährung heute nach oben' }).click();
  await expect(page.getByTestId('overview-edit-live')).toHaveText(
    'Ernährung heute ist jetzt an Stelle 2 von 8.',
  );
  await page.getByRole('button', { name: 'Ernährung heute nach oben' }).click();
  await expect(page.getByTestId('overview-edit-live')).toHaveText(
    'Ernährung heute ist jetzt an Stelle 1 von 8.',
  );
  await page.getByTestId('overview-edit-done').click();
  await expect(page.getByTestId('overview-edit')).toHaveCount(0);
  expect(await tileOrder(page)).toEqual([
    'overview-nutrition',
    'overview-training',
    'overview-progress',
  ]);

  // Neu laden → bleibt.
  await page.reload();
  await expect(page.getByTestId('overview-header')).toBeVisible();
  expect(await tileOrder(page)).toEqual([
    'overview-nutrition',
    'overview-training',
    'overview-progress',
  ]);

  // Alle aus → Hinweis; zurücksetzen holt den Standard.
  await page.getByTestId('overview-edit-open').click();
  for (const name of [
    'Training heute',
    'Workouts',
    'Ernährung heute',
    'Fortschritt',
    'Ausdauer',
    'Schnell zu',
  ]) {
    await page.getByRole('checkbox', { name: `${name} anzeigen` }).click();
  }
  await expect(page.getByTestId('overview-recipes')).toHaveCount(0);
  await expect(page.getByTestId('tile-workouts')).toHaveCount(0);
  await page.getByTestId('overview-edit-done').click();
  await expect(page.getByTestId('overview-all-hidden')).toContainText(
    'Alle Kacheln sind ausgeblendet.',
  );
  // Hinweise oben sind keine Kacheln – „Bearbeiten“ bleibt.
  await page.getByTestId('overview-edit-open').click();
  await page.getByTestId('overview-edit-reset').click();
  await expect(page.getByTestId('overview-edit-live')).toHaveText(
    'Übersicht und Menüleiste sind wieder wie am Anfang.',
  );
  await page.getByTestId('overview-edit-done').click();
  expect(await tileOrder(page)).toEqual([
    'overview-training',
    'overview-competition',
    'overview-nutrition',
    'overview-body',
    'overview-progress',
  ]);
});

test('Menüleiste anpassen: 6. Knopf, Regeln mit Grund, verschieben, ausgeblendete Bereiche unter „Mehr“, 320 px', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await onboardStudio(page);
  expect(await tabs(page)).toEqual([
    'Übersicht',
    'Training',
    'Workouts',
    'Ernährung',
    'Einkaufen',
    'Mehr',
  ]);

  // Aus „Mehr“ öffnen.
  await tabBar(page).getByRole('tab', { name: 'Mehr', exact: true }).click();
  await page.getByTestId('more-area-fortschritt').click();
  await heading(page, 'Fortschritt');
  await expect(tabBar(page).locator('[aria-selected="true"]')).toHaveCount(0);
  await page.goto('/mehr');
  await page.getByTestId('more-menu-bar').click();
  await heading(page, 'Menüleiste anpassen');
  await expect(page.getByTestId('menu-bar-area-uebersicht')).toContainText('Immer dabei');
  await expect(page.getByTestId('menu-bar-area-mehr')).toContainText('Immer dabei');

  // Schon 6 Knöpfe → Fortschritt geht nicht dazu, mit Grund.
  await page.getByRole('checkbox', { name: 'Fortschritt in der Menüleiste' }).click();
  await expect(page.getByTestId('menu-bar-message')).toContainText(
    'Höchstens 6 Knöpfe – nimm erst einen heraus.',
  );
  // Workouts heraus (steht dann unter „Mehr“), Fortschritt dazu → wieder 6 Knöpfe (vor „Mehr“).
  await page.getByRole('checkbox', { name: 'Workouts in der Menüleiste' }).click();
  await expect(page.getByTestId('menu-bar-live')).toHaveText('Workouts ist jetzt unter „Mehr“.');
  await page.getByRole('checkbox', { name: 'Fortschritt in der Menüleiste' }).click();
  await expect(page.getByTestId('menu-bar-live')).toHaveText(
    'Fortschritt ist jetzt in der Menüleiste.',
  );
  expect(await preview(page)).toEqual([
    'Übersicht',
    'Training',
    'Ernährung',
    'Einkaufen',
    'Fortschritt',
    'Mehr',
  ]);

  // Einkaufen nach links → Ansage, neue Reihenfolge.
  await page.getByRole('button', { name: 'Einkaufen nach links' }).click();
  await expect(page.getByTestId('menu-bar-live')).toHaveText('Einkaufen ist jetzt Knopf 3 von 6.');
  expect(await preview(page)).toEqual([
    'Übersicht',
    'Training',
    'Einkaufen',
    'Ernährung',
    'Fortschritt',
    'Mehr',
  ]);
  await expect(page.getByTestId('menu-bar-up-today')).toBeDisabled();

  // 320 px: alle 6 Beschriftungen ganz lesbar (nicht abgeschnitten).
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-header')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await tabs(page)).toHaveLength(6);
  for (const tab of await tabBar(page).getByRole('tab').all()) {
    const clipped = await tab.evaluate((el) =>
      Array.from(el.querySelectorAll('*'))
        .filter((e) => e.childElementCount === 0 && (e.textContent ?? '').trim() !== '')
        .some((e) => e.scrollWidth > e.clientWidth + 1),
    );
    expect(clipped, (await tab.getAttribute('aria-label')) ?? '').toBe(false);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/menueleiste');
  await heading(page, 'Menüleiste anpassen');

  // Bis auf 3 Knöpfe herausnehmen; der 4. verweigert mit Grund.
  for (const name of ['Einkaufen', 'Ernährung', 'Fortschritt']) {
    await page.getByRole('checkbox', { name: `${name} in der Menüleiste` }).click();
  }
  expect(await preview(page)).toEqual(['Übersicht', 'Training', 'Mehr']);
  await page.getByRole('checkbox', { name: 'Training in der Menüleiste' }).click();
  await expect(page.getByTestId('menu-bar-message')).toContainText('Mindestens 3 Knöpfe');
  expect(await preview(page)).toEqual(['Übersicht', 'Training', 'Mehr']);

  // Ausgeblendete Bereiche stehen unter „Mehr“ und funktionieren (auch nach dem Neuladen).
  await page.goto('/mehr');
  await heading(page, 'Mehr');
  expect(await tabs(page)).toEqual(['Übersicht', 'Training', 'Mehr']);
  for (const area of ['workouts', 'ernaehrung', 'einkaufsliste', 'wettkampf', 'fortschritt']) {
    await expect(page.getByTestId(`more-area-${area}`)).toBeVisible();
  }
  await page.getByTestId('more-area-einkaufsliste').click();
  await expect(page.getByTestId('shopping-list')).toBeVisible();
  await expect(page).toHaveURL(/\/einkaufsliste$/);

  // Zurücksetzen.
  await page.goto('/menueleiste');
  await page.getByTestId('menu-bar-reset').click();
  await expect(page.getByTestId('menu-bar-live')).toHaveText(
    'Die Menüleiste ist wieder wie am Anfang.',
  );
  const standard = ['Übersicht', 'Training', 'Workouts', 'Ernährung', 'Einkaufen', 'Mehr'];
  expect(await preview(page)).toEqual(standard);
  await page.getByTestId('menu-bar-done').click();
  expect(await tabs(page)).toEqual(standard);
});

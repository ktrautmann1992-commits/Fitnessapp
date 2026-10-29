import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Kachel „Schritte“ mit Tagesziel auf der Übersicht (Gründer-Wunsch 22.10.2026, docs/PLAN-PHASE-8.md 13.4) im
 * TESTMODUS, Handy-Ansicht: ohne Uhr Hinweis „Uhr verbinden“ → Beispiel-Uhr verbinden (Einwilligung, Abgleich) →
 * Ring mit 6.240 von 8.000 (78 %) und 7 Mini-Balken → Schrittziel auf der Smartwatch-Seite ändern (Mehr, Schnellauswahl)
 * → Ring „Ziel erreicht“ → bleibt nach dem Neuladen und beim Bearbeiten der Übersicht. Fester Tag: Donnerstag, 22.10.2026.
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const THURSDAY = new Date('2026-10-22T09:00:00+02:00');
const shots = process.env.SCREENSHOT_DIR;

async function setup(page: Page) {
  await page.route(/cdn\.jsdelivr\.net|openfreemap\.org/, (route) => route.abort());
  await page.clock.setFixedTime(THURSDAY);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent: true,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
}

async function storedGoal(page: Page): Promise<unknown> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  const db = JSON.parse(raw ?? '{}') as { rows?: { appLayout?: { step_goal?: unknown } | null } };
  return db.rows?.appLayout?.step_goal;
}

test('Schritte: ohne Uhr Hinweis → Beispiel-Uhr → Ring 6.240 von 8.000 → Ziel ändern → erreicht', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await setup(page);

  // Ohne Uhr: freundlicher Hinweis mit „Uhr verbinden“.
  await page.goto('/uebersicht');
  const tile = page.getByTestId('overview-steps');
  await expect(tile).toBeVisible();
  await expect(page.getByTestId('overview-steps-empty')).toContainText('Smartwatch');
  await page.getByTestId('overview-steps-connect').click();

  // Smartwatch-Seite: eigene Einwilligung, dann Beispiel-Uhr verbinden (gleicht sofort ab).
  await expect(page.getByTestId('smartwatch')).toBeVisible();
  await page.getByTestId('smartwatch-consent-accept').click();
  await page.getByTestId('smartwatch-connect').click();
  await expect(page.getByTestId('smartwatch-message')).toContainText('Abgleich fertig');
  await expect(page.getByTestId('step-goal-value')).toHaveText('8.000 Schritte');

  // Übersicht: Ring mit heutigen Schritten, Ziel darunter, 7 Mini-Balken.
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-steps-value')).toHaveText('6.240');
  await expect(page.getByTestId('overview-steps-goal')).toHaveText('von 8.000');
  await expect(page.getByTestId('overview-steps-remaining')).toHaveText('Noch 1.760 bis zum Ziel');
  await expect(page.getByTestId('overview-steps-ring')).toHaveAttribute(
    'aria-label',
    '6.240 von 8.000 Schritten, 78 Prozent',
  );
  await expect(page.getByTestId('overview-steps-ring').locator('svg circle')).toHaveCount(2);
  await expect(page.getByTestId('overview-steps-bars')).toHaveAttribute(
    'aria-label',
    /^Schritte der letzten 7 Tage: Freitag 7\.400, .*heute 6\.240$/,
  );
  // Neben „Ausdauer“ (kleine Kacheln zu zweit).
  const steps = await tile.boundingBox();
  const endurance = await page.getByTestId('overview-endurance').boundingBox();
  expect(steps && endurance && Math.abs(steps.y - endurance.y) < 2).toBe(true);
  if (shots) {
    await tile.screenshot({ path: `${shots}/schritte-kachel.png` });
  }

  // Antippen → Smartwatch-Seite mit Schrittziel; „Mehr“ erhöht um 500, Schnellauswahl setzt direkt.
  await page.getByTestId('overview-steps-open').click();
  await expect(page.getByTestId('step-goal')).toBeVisible();
  await page.getByTestId('step-goal-more').click();
  await expect(page.getByTestId('step-goal-value')).toHaveText('8.500 Schritte');
  await expect(page.getByTestId('step-goal-live')).toHaveText(
    'Schrittziel: 8.500 Schritte gespeichert.',
  );
  expect(await storedGoal(page)).toBe(8500);
  await page.getByTestId('step-goal-preset-6000').click();
  await expect(page.getByTestId('step-goal-value')).toHaveText('6.000 Schritte');
  expect(await storedGoal(page)).toBe(6000);

  // Ziel erreicht: Ring voll, „✓ Ziel erreicht“.
  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-steps-goal')).toHaveText('von 6.000');
  await expect(page.getByTestId('overview-steps-reached')).toHaveText('✓ Ziel erreicht');
  await expect(page.getByTestId('overview-steps-ring')).toHaveAttribute(
    'aria-label',
    '6.240 von 6.000 Schritten, 104 Prozent, Ziel erreicht',
  );
  if (shots) {
    await tile.screenshot({ path: `${shots}/schritte-kachel-erreicht.png` });
  }

  // Bleibt nach dem Neuladen; Übersicht bearbeiten (Kachel ausblenden) behält das Ziel.
  await page.reload();
  await expect(page.getByTestId('overview-steps-goal')).toHaveText('von 6.000');
  await page.getByTestId('overview-edit-open').click();
  await page.getByRole('checkbox', { name: 'Schritte anzeigen' }).click();
  await expect(page.getByTestId('overview-steps')).toHaveCount(0);
  expect(await storedGoal(page)).toBe(6000);
  await page.getByRole('checkbox', { name: 'Schritte anzeigen' }).click();
  await page.getByTestId('overview-edit-done').click();
  await expect(page.getByTestId('overview-steps-goal')).toHaveText('von 6.000');
});

/**
 * Schritte vom Handy (Gründer-Wunsch 29.10.2026, docs/PLAN-PHASE-8.md 13.5): ohne Uhr „Handy nutzen“ → Smartwatch-Seite
 * mit „Schritte vom Handy“ vorn → Einwilligung → nur Schritte verbinden (Testmodus: Beispiel-Schritte) → Ring füllt
 * sich; die Seite zeigt „Schritte kommen vom Handy“ und bietet „Uhr zusätzlich verbinden“, keine Einheiten übernommen.
 */
test('Schritte vom Handy ohne Uhr: „Handy nutzen“ → nur Schritte verbinden → Ring', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await setup(page);

  await page.goto('/uebersicht');
  // Noch ohne Einwilligung „Smartwatch-Daten“ (gilt auch für Schritte vom Handy).
  await expect(page.getByTestId('overview-steps-empty')).toHaveText(
    'Für Schritte vom Handy oder von der Smartwatch brauchst du die Einwilligung „Smartwatch-Daten“.',
  );
  const phone = page.getByTestId('overview-steps-phone');
  await expect(phone).toHaveText('Handy nutzen');
  await expect(phone).toHaveAccessibleName('Schritte vom Handy nutzen');
  // Beide Knöpfe einzeilig in der halben Kachel.
  for (const id of ['overview-steps-phone', 'overview-steps-connect']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box && box.height < 64, `${id} einzeilig`).toBe(true);
  }
  await phone.click();

  await expect(page).toHaveURL(/\/smartwatch\?quelle=handy/);
  await expect(page.getByTestId('smartwatch-phone-intro')).toContainText('keine Uhr');
  await page.getByTestId('smartwatch-consent-accept').click();
  const card = page.getByTestId('smartwatch-phone');
  await expect(card).toContainText('Health Connect zählt keinen Schritt doppelt.');
  await expect(card).toContainText('Einwilligung „Smartwatch-Daten“');
  // Mit ?quelle=handy steht „Schritte vom Handy“ vor „Uhr verbinden“.
  const phoneBox = await card.boundingBox();
  const watchBox = await page.getByTestId('smartwatch-connect').boundingBox();
  expect(phoneBox && watchBox && phoneBox.y < watchBox.y).toBe(true);
  await page.getByTestId('smartwatch-phone-connect').click();
  await expect(page.getByTestId('smartwatch-message')).toContainText('Abgleich fertig');
  await expect(page.getByTestId('smartwatch-phone-mode')).toContainText(
    'Deine Schritte kommen vom Handy',
  );
  await expect(page.getByTestId('smartwatch-add-watch')).toBeVisible();
  if (shots) {
    await page.screenshot({ path: `${shots}/schritte-vom-handy.png`, fullPage: true });
  }

  await page.goto('/uebersicht');
  await expect(page.getByTestId('overview-steps-value')).toHaveText('6.240');
  await expect(page.getByTestId('overview-steps-goal')).toHaveText('von 8.000');
});

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Übungen in Workouts tauschen und eigene Workouts erstellen (Gründer-Wunsch 18.11.2026,
 * docs/PLAN-EIGENE-WORKOUTS.md) im Testmodus:
 * (a) Bibliotheks-Workout öffnen, erste Übung tauschen („angepasst“), starten – der Player zeigt die neue Übung;
 *     „Original wiederherstellen“.
 * (b) Eigenes Workout: 30 Min., Beine + Bauch/Core, eine Übung „mag ich nicht“ → Vorschau → tauschen, entfernen,
 *     hinzufügen → speichern → „Meine Workouts“ → starten mit Countdown.
 * Bildschirmfotos in Handy-Größe (deviceScaleFactor 1) nur mit EIGENE_SHOTS=<Ordner>.
 */

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

const MONDAY = new Date('2026-10-05T09:00:00+02:00');
const SHOTS = process.env.EIGENE_SHOTS;

async function shot(page: Page, name: string, locator?: Locator) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  if (locator) await locator.screenshot({ path: join(SHOTS, name) });
  else await page.screenshot({ path: join(SHOTS, name) });
}

/** Headless-Chromium lehnt echte Wake-Lock-Anfragen ab – Schnittstelle nachbauen (wie workout-player.spec.ts). */
async function stubWakeLock(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: () =>
          Promise.resolve({
            released: false,
            addEventListener: () => undefined,
            release: () => Promise.resolve(),
          }),
      },
    });
  });
}

async function openWorkouts(page: Page) {
  await stubWakeLock(page);
  await page.clock.install({ time: MONDAY });
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent: false,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Dienstag', 'Kraft zu Hause', 45],
      ['Freitag', 'Kraft zu Hause', 45],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  // Reiter „Training“ → Umschalter „Workouts“.
  await page.getByTestId('today-switch-workouts').click();
  await expect(page.getByTestId('custom-create')).toBeVisible();
}

/** Name einer Übung aus dem Kandidaten-Knopf („<Name> wählen“). */
async function candidateName(candidate: Locator): Promise<string> {
  const label = (await candidate.getAttribute('aria-label')) ?? '';
  return label.replace(/ wählen$/, '');
}

test('Bibliotheks-Workout: Übung tauschen, „angepasst“, Player zeigt die neue Übung, Original wiederherstellen', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openWorkouts(page);
  await page.goto('/workouts/bauch-blitz');
  await expect(page.getByTestId('workout-detail')).toBeVisible();
  const firstBefore =
    (await page.getByTestId('workout-exercises').innerText()).split('\n')[0] ?? '';

  await page.getByTestId('workout-swap-0').click();
  const sheet = page.getByTestId('swap-sheet');
  await expect(sheet).toBeVisible();
  const candidate = sheet.locator('[data-testid^="swap-candidate-"]').first();
  await expect(candidate).toBeVisible();
  const name = await candidateName(candidate);
  expect(name.length).toBeGreaterThan(2);
  await shot(page, '06-tausch-bibliothek.png');
  await candidate.click();
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId('workout-swap-message')).toContainText('Getauscht');
  await expect(page.getByTestId('workout-adjusted')).toBeVisible();
  await expect(page.getByTestId('workout-exercises')).toContainText(`1. ${name}`);
  await expect(page.getByTestId('workout-exercises')).toContainText('getauscht, statt');
  expect(firstBefore).not.toContain(name);

  // Liste: Kennzeichen „angepasst“ auf der Karte.
  await page.goto('/workouts');
  await expect(page.getByTestId('workout-card-bauch-blitz-badge')).toHaveText('angepasst');
  await page.goto('/workouts/bauch-blitz');

  // Starten: Countdown zeigt schon die getauschte erste Übung.
  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout-timer-kind')).toHaveText('Gleich geht’s los');
  await expect(page.getByTestId('workout-timer-step')).toHaveText(name);

  // Original wiederherstellen.
  await page.goto('/workouts/bauch-blitz');
  await page.getByTestId('workout-restore').click();
  await expect(page.getByTestId('workout-swap-message')).toContainText(
    'Original wiederhergestellt',
  );
  await expect(page.getByTestId('workout-adjusted')).toHaveCount(0);
  await expect(page.getByTestId('workout-exercises')).not.toContainText(`1. ${name}`);
});

test('Eigenes Workout: 30 Min. Beine + Bauch, „mag ich nicht“, tauschen/entfernen/hinzufügen, speichern, starten', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await openWorkouts(page);
  await expect(page.getByTestId('my-workouts-empty')).toBeVisible();
  await shot(page, '00-workouts-start.png');
  await page.getByTestId('custom-create').click();

  // 1 Dauer
  await expect(page.getByTestId('custom-step-duration')).toBeVisible();
  await page.getByTestId('custom-minutes-30').click();
  await shot(page, '01-dauer.png');
  await page.getByTestId('custom-next').click();
  // 2 Muskelgruppen (ohne Wahl kein Weiter)
  await page.getByTestId('custom-next').click();
  await expect(page.getByText('Bitte mindestens eine Muskelgruppe wählen.')).toBeVisible();
  await page.getByTestId('custom-area-legs').click();
  await page.getByTestId('custom-area-core').click();
  await shot(page, '02-muskelgruppen.png');
  await page.getByTestId('custom-next').click();
  // 3 Geräte
  await expect(page.getByTestId('custom-step-equipment')).toBeVisible();
  await shot(page, '03-geraete.png');
  await page.getByTestId('custom-next').click();
  // 4 Lieblingsübungen
  await page.getByTestId('custom-favorites-search').click();
  await page.getByTestId('custom-search-query').fill('Glute');
  await page.getByTestId('custom-search-pick-glute-bridge').click();
  await page.getByTestId('custom-search-close').click();
  await expect(page.getByTestId('custom-favorites-chosen-glute-bridge')).toBeVisible();
  await shot(page, '04-lieblingsuebungen.png');
  await page.getByTestId('custom-next').click();
  // 5 „Mag ich nicht“
  await page.getByTestId('custom-dislikes-search').click();
  await page.getByTestId('custom-search-query').fill('Unterarmst');
  await page.getByTestId('custom-search-pick-unterarmstuetz').click();
  await shot(page, '05a-suche-mag-ich-nicht.png');
  await page.getByTestId('custom-search-close').click();
  await expect(page.getByTestId('custom-dislikes-chosen-unterarmstuetz')).toBeVisible();
  await shot(page, '05-mag-ich-nicht.png');
  await page.getByTestId('custom-next').click();

  // Vorschau: Tracks Aufwärmen → Beine → Bauch/Core → Dehnen, ohne die abgelehnte Übung.
  await expect(page.getByTestId('custom-preview')).toBeVisible();
  const tracks = page.getByTestId('custom-tracks');
  await expect(page.getByTestId('custom-track-0')).toContainText('Track 1 – Aufwärmen');
  await expect(tracks).toContainText('Beine');
  await expect(tracks).toContainText('Bauch/Core');
  await expect(tracks).toContainText('Dehnen');
  await expect(page.getByTestId('custom-item-unterarmstuetz')).toHaveCount(0);
  // glute-bridge passt zu keiner gewählten Gruppe (Po) → Hinweis.
  await expect(page.getByTestId('custom-issues')).toContainText('Glute Bridge');
  const total = page.getByTestId('custom-total');
  await expect(total).toHaveText(/^Gesamt etwa (2[7-9]|3[0-3]) Min\.$/);
  await shot(page, '07-vorschau.png');

  // Tauschen (erste Übung im Track Beine).
  const legs = page.getByTestId('custom-track-1');
  const firstLegSwap = legs.locator('[data-testid^="custom-swap-"]').first();
  const swappedId = ((await firstLegSwap.getAttribute('data-testid')) ?? '').replace(
    'custom-swap-',
    '',
  );
  await firstLegSwap.click();
  const sheet = page.getByTestId('swap-sheet');
  await expect(sheet).toBeVisible();
  const candidate = sheet.locator('[data-testid^="swap-candidate-"]').first();
  const candidateId = ((await candidate.getAttribute('data-testid')) ?? '').replace(
    'swap-candidate-',
    '',
  );
  await shot(page, '08-vorschau-tauschen.png');
  await candidate.click();
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId(`custom-item-${candidateId}`)).toBeVisible();
  await expect(page.getByTestId(`custom-item-${swappedId}`)).toHaveCount(0);

  // Entfernen (letzte Übung im Track Bauch/Core) – Gesamtdauer sinkt.
  const before = await total.innerText();
  const core = page.getByTestId('custom-track-2');
  const removeButton = core.locator('[data-testid^="custom-remove-"]').last();
  const removedId = ((await removeButton.getAttribute('data-testid')) ?? '').replace(
    'custom-remove-',
    '',
  );
  await removeButton.click();
  await expect(page.getByTestId(`custom-item-${removedId}`)).toHaveCount(0);
  await expect(total).not.toHaveText(before);

  // Hinzufügen (Track Beine).
  await page.getByTestId('custom-add-1').click();
  const addSheet = page.getByTestId('custom-add-sheet');
  await expect(addSheet).toBeVisible();
  const addPick = addSheet.locator('[data-testid^="custom-add-sheet-pick-"]').first();
  const addedId = ((await addPick.getAttribute('data-testid')) ?? '').replace(
    'custom-add-sheet-pick-',
    '',
  );
  await addPick.click();
  await expect(page.getByTestId(`custom-item-${addedId}`)).toBeVisible();

  // Speichern unter dem vorgeschlagenen Namen.
  await expect(page.getByTestId('custom-name')).toHaveValue('Mein Beine & Bauch/Core 30');
  await page.getByTestId('custom-save').click();
  await expect(page.getByTestId('custom-saved')).toContainText('Gespeichert');
  await shot(page, '09-gespeichert.png');

  // „Meine Workouts“
  await page.getByTestId('custom-back').click();
  const list = page.getByTestId('my-workouts-list');
  await expect(list).toBeVisible();
  const card = list.locator('[data-testid^="workout-card-eigen-"]').first();
  await expect(card).toContainText('Mein Beine & Bauch/Core 30');
  await shot(page, '10-meine-workouts.png');

  // Öffnen und starten: Countdown mit der ersten Aufwärm-Übung.
  await card.click();
  await expect(page.getByTestId('custom-detail')).toBeVisible();
  await expect(page.getByTestId(`custom-item-${addedId}`)).toBeVisible();
  await expect(page.getByTestId(`custom-item-${candidateId}`)).toBeVisible();
  await page.getByTestId('custom-start').click();
  await expect(page.getByTestId('workout-timer-kind')).toHaveText('Gleich geht’s los');
  await expect(page.getByTestId('workout-timer-remaining')).toHaveText('0:10');
  await expect(page.getByTestId('power-player-image')).toBeVisible();
  await shot(page, '11-player-countdown.png');
  await page.clock.fastForward(10_500);
  await expect(page.getByTestId('workout-timer-kind')).toHaveText('Los!');
});

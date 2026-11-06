import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { expect, test } from '@playwright/test';

import { onboardNutrition } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Essen nach dem Training (Gründer-Wunsch 06.11.2026, docs/PLAN-NAEHRSTOFF-TIMING.md 6a) im TESTMODUS: freies Workout
 * am Montag, 12.10.2026, um 11:55 beenden → Karte „Nach dem Training: Das solltest du jetzt essen“ mit dem Mittagessen
 * aus dem Essensplan und Eiweiß/Kohlenhydraten dieses Platzes – auf dem Fertig-Bildschirm, in „Ernährung“ (heute) und
 * auf „Heute“. Ohne eigene Uhrzeit der geplanten Einheit (Altbestand) gab es vorher keine Rolle „nach dem Training“ fürs
 * Mittagessen.
 */

test.use({ deviceScaleFactor: 2 });

const SCREENSHOT = process.env.POST_WORKOUT_SCREENSHOT;

test('Freies Workout beendet → „Nach dem Training“-Karte mit Mittagessen und Zielen', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await onboardNutrition(page);
  // Vormittags trainiert: Ende kurz vor dem Mittagessen (12:30).
  await page.clock.setFixedTime(new Date('2026-10-12T11:55:00+02:00'));
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
  // Vor dem Training: keine Karte.
  await expect(page.getByTestId('post-workout-meal')).toHaveCount(0);

  await page.goto('/workouts');
  await expect(page.getByTestId('workouts-list')).toBeVisible();
  await page.getByTestId('workout-card-kurzhantel-basis').click();
  await heading(page, 'Kurzhantel-Basis');
  await page.getByTestId('workout-start').click();
  // Vorbereitung überspringen, einen Satz abhaken, vorzeitig beenden und speichern.
  await page.getByTestId('workout-timer-skip').click();
  await expect(page.getByTestId('workout-timer-step')).toHaveText('Goblet-Kniebeuge');
  await page.getByRole('button', { name: 'Satz erledigt ✓' }).click();
  await page.getByTestId('workout-timer-end').click();
  await page.getByTestId('workout-end-dialog').getByRole('button', { name: 'Beenden' }).click();
  await heading(page, 'Workout beendet');
  await page.getByTestId('workout-save').click();
  await expect(page.getByTestId('workout-saved')).toContainText('Gespeichert');

  const card = page.getByTestId('post-workout-meal');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Nach dem Training: Das solltest du jetzt essen');
  await expect(card).toContainText('Aus deinem Essensplan – Mittagessen:');
  await expect(page.getByTestId('post-workout-meal-when')).toContainText(
    /[Aa]m besten bis 1[34]:\d\d essen/,
  );
  await expect(page.getByTestId('post-workout-meal-dish')).toContainText('nach dem Training');
  await expect(page.getByTestId('post-workout-meal-targets')).toHaveText(
    /^Richtwert für diese Mahlzeit: ca\. \d+ g Eiweiß · \d+ g Kohlenhydrate$/,
  );
  if (SCREENSHOT) {
    mkdirSync(dirname(SCREENSHOT), { recursive: true });
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({ path: SCREENSHOT });
  }

  // Ernährung (heute): dieselbe Karte, der Plan ist ans Training angepasst (Mittag „nach dem Training“).
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
  await expect(page.getByTestId('post-workout-meal')).toBeVisible();
  await expect(page.getByTestId('training-timeline-post_meal-time').first()).toHaveText(
    /^bis 1[34]:\d\d$/,
  );

  // Heute: ebenfalls sichtbar.
  await page.goto('/today');
  await expect(page.getByTestId('post-workout-meal')).toBeVisible();

  // Mehr als 3 Stunden später: keine Karte mehr.
  await page.clock.setFixedTime(new Date('2026-10-12T15:30:00+02:00'));
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
  await expect(page.getByTestId('post-workout-meal')).toHaveCount(0);
});

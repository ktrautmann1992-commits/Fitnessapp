import { expect, test } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Etappe E (docs/PLAN-PHASE-4B.md 7 und 10 E): Im Browser gibt es keine Benachrichtigungen – nur einen Hinweis in den
 * Einstellungen. Keine Schalter, kein Test-Knopf, kein Angebot auf „Heute“, keine Frage im Trainingsmodus; die
 * bisherige Mess-Erinnerung (Hinweis auf „Heute“) bleibt unverändert einstellbar.
 */

test('Browser: Hinweis statt Benachrichtigungen, Einstellungen-Zustand', async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page, {
    consent: true,
    level: /Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft im Studio', 60],
      ['Donnerstag', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await expect(page.getByTestId('notification-offer-yes')).toHaveCount(0);

  await page.goto('/settings?thema=erinnerungen');
  await heading(page, 'Benachrichtigungen');
  await expect(page.getByTestId('notifications-web')).toHaveText(
    'Im Browser gibt es keine Benachrichtigungen. Die fällige Messung siehst du auf „Heute“, die Pause in der Pausen-Leiste. In der App (Android/iPhone) kannst du Benachrichtigungen hier einschalten.',
  );
  await expect(page.getByTestId('settings-notify-measurement')).toHaveCount(0);
  await expect(page.getByTestId('settings-notify-rest-end')).toHaveCount(0);
  await expect(page.getByTestId('settings-notify-test')).toHaveCount(0);
  // Der Hinweis auf „Heute“ (measurement_reminders) bleibt wie bisher einstellbar.
  await expect(page.getByRole('checkbox', { name: 'Erinnerung an Körperumfänge' })).toBeVisible();

  // Keine Geräte-Einstellung angelegt (nichts zu stornieren, nichts gefragt).
  const prefs = await page.evaluate(() =>
    window.localStorage.getItem('fitnessapp.notification-prefs.v1'),
  );
  expect(prefs).toBeNull();
});

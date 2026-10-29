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

/**
 * Erinnerungen an Training, Essen und Trinken (docs/PLAN-ERINNERUNGEN.md): im Browser kommen keine Benachrichtigungen –
 * im Testmodus lassen sich die drei Schalter aber ausprobieren (Hinweis „nur in der App“); Wahl bleibt nach dem Neuladen.
 */
test('Browser-Testmodus: Erinnerungen Training/Essen/Trinken einstellen, Hinweis „nur in der App“', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await onboard(page, {
    consent: true,
    level: /Einsteiger/,
    goal: 'Muskelaufbau',
    days: [['Montag', 'Kraft im Studio', 60]],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');

  await page.goto('/settings?thema=erinnerungen');
  const card = page.getByTestId('reminder-settings');
  await expect(card).toContainText('Erinnerungen an Training, Essen und Trinken');
  await expect(page.getByTestId('reminder-settings-web')).toContainText(
    'Benachrichtigungen kommen aber nur in der App',
  );
  for (const id of ['reminder-training', 'reminder-meals', 'reminder-drink']) {
    await expect(page.getByTestId(id)).toHaveAttribute('aria-checked', 'false');
  }

  // Training: 30 Minuten vorher.
  await page.getByTestId('reminder-training').click();
  await expect(page.getByTestId('reminder-training')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('reminder-training-lead-30').click();
  await expect(page.getByTestId('reminder-training-lead-30')).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // Essen: Frühstück 07:30 → 08:00; frühestens 07:00.
  await page.getByTestId('reminder-meals').click();
  await expect(page.getByTestId('reminder-meals-breakfast-value')).toHaveText(
    'Frühstück: 07:30 Uhr',
  );
  await page.getByTestId('reminder-meals-breakfast-later').click();
  await expect(page.getByTestId('reminder-meals-breakfast-value')).toHaveText(
    'Frühstück: 08:00 Uhr',
  );
  await page.getByTestId('reminder-meals-breakfast-earlier').click();
  await page.getByTestId('reminder-meals-breakfast-earlier').click();
  await expect(page.getByTestId('reminder-meals-breakfast-value')).toHaveText(
    'Frühstück: 07:00 Uhr',
  );
  await expect(page.getByTestId('reminder-meals-breakfast-earlier')).toBeDisabled();
  await page.getByTestId('reminder-meals-breakfast-later').click();

  // Trinken: 8–20 Uhr alle 2 Std. → stündlich, Ende 21:00 (spätestens 22:00, Nachtruhe).
  await page.getByTestId('reminder-drink').click();
  await expect(page.getByTestId('reminder-drink-window')).toHaveText('08:00–20:00 Uhr');
  await page.getByTestId('reminder-drink-every-60').click();
  await page.getByTestId('reminder-drink-to-later').click();
  await page.getByTestId('reminder-drink-to-later').click();
  await page.getByTestId('reminder-drink-to-later').click();
  await page.getByTestId('reminder-drink-to-later').click();
  await expect(page.getByTestId('reminder-drink-window')).toHaveText('08:00–22:00 Uhr');
  await expect(page.getByTestId('reminder-drink-to-later')).toBeDisabled();

  // Gespeichert auf dem Gerät, ohne Nutzerdaten – bleibt nach dem Neuladen.
  const stored = await page.evaluate(() =>
    window.localStorage.getItem('fitnessapp.reminder-prefs.v1'),
  );
  expect(JSON.parse(stored ?? 'null')).toEqual({
    training: { enabled: true, leadMinutes: 30 },
    meals: { enabled: true, breakfast: 450, lunch: 750, dinner: 1110 },
    drink: { enabled: true, fromMinutes: 480, toMinutes: 1320, everyMinutes: 60 },
  });
  await page.reload();
  await expect(page.getByTestId('reminder-training-lead-30')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByTestId('reminder-drink-window')).toHaveText('08:00–22:00 Uhr');
  // Im Browser wird nichts geplant.
  expect(
    await page.evaluate(() => window.localStorage.getItem('fitnessapp.reminder-scheduled.v1')),
  ).toBeNull();

  // Ausschalten blendet die Optionen aus.
  await page.getByTestId('reminder-drink').click();
  await expect(page.getByTestId('reminder-drink-window')).toHaveCount(0);
});

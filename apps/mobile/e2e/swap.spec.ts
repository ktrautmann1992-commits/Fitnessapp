import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Übungen tauschen im TESTMODUS (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md Etappe T2) mit festem Datum Mittwoch,
 * 07.10.2026: „Nur heute“ (Day-Swap) samt Rückgängig und Übernahme ins Training, „Ab jetzt immer“ mit Grund,
 * Rückgängig, Wirkung in allen Einheiten und im PDF, Einstellungen „Ausgeschlossene Übungen“ (Wieder zulassen, K8),
 * Datenexport, Tauschen im Trainingsmodus und der neutrale Hinweis bei Präferenz-Ausblendung (B1b).
 *
 * Körpergewicht-Plan zu Hause (3 Tage): Mittwoch = Kniebeuge mit Körpergewicht (→ Kniebeuge zum Stuhl), Good Morning,
 * Liegestütz mit erhöhten Händen (→ Liegestütz), Türrahmen-Rudern (keine gleichwertige Alternative), …
 */

const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');
const LOCAL_DB = 'fitnessapp.local.v1';
const DAY_SWAPS = 'fitnessapp.day-swaps.v1';

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

const SQUAT = 'Kniebeuge mit Körpergewicht';
const SQUAT_CHAIR = 'Kniebeuge zum Stuhl';
const PUSHUP_RAISED = 'Liegestütz mit erhöhten Händen';
const PUSHUP = 'Liegestütz';

interface StoredDb {
  rows: {
    exercisePreferences: { exercise_id: string; location: string; kind: string }[];
    exerciseLogs: { exercise_id: string; status: string }[];
  };
}

async function storedDb(page: Page): Promise<StoredDb> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  return JSON.parse(raw ?? '{}') as StoredDb;
}

async function toToday(page: Page) {
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
}

const exerciseName = (page: Page, index: number) =>
  page.getByTestId('plan-exercise').nth(index).getByTestId('plan-exercise-link');
const dialog = (page: Page) => page.getByTestId('swap-dialog');

/** Tausch-Dialog an Position `index` öffnen und eine Alternative wählen. */
async function chooseIn(page: Page, index: number, candidate: string) {
  await page.getByTestId(`plan-swap-${index}`).click();
  await expect(dialog(page)).toBeVisible();
  const option = dialog(page)
    .getByTestId('swap-candidates')
    .getByRole('radio', { name: candidate, exact: true });
  await option.click();
  await expect(option).toHaveAttribute('aria-checked', 'true');
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('„Nur heute“: Tausch mit Kennzeichen, Rückgängig, Training übernimmt ihn, andere Tage unverändert', async ({
  page,
}) => {
  await onboard(page, HOME_3_DAYS);
  await toToday(page);
  await expect(exerciseName(page, 0)).toContainText(SQUAT);

  // Escape schließt den Dialog, Fokus zurück auf „Tauschen“ (8.3).
  await page.getByTestId('plan-swap-0').click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText(`Statt ${SQUAT}:`);
  await expect(dialog(page).getByTestId('swap-health-hint')).toContainText('Gesundheits-Check');
  // Fokus beim Öffnen auf dem Titel.
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id))
    .toBe('swap-dialog-title');
  // Escape wirkt, sobald das Modal fertig eingeblendet ist (react-native-web: dann role="dialog" am Rahmen).
  await expect(page.locator('[aria-modal="true"][role="dialog"]')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid')))
    .toBe('plan-swap-0');

  // Ohne Auswahl → verständliche Meldung; „Nur heute“ ist vorausgewählt.
  await page.getByTestId('plan-swap-0').click();
  await expect(
    dialog(page).getByTestId('swap-duration').getByRole('radio', { name: 'Nur heute' }),
  ).toHaveAttribute('aria-checked', 'true');
  await dialog(page).getByTestId('swap-confirm').click();
  await expect(dialog(page).getByTestId('swap-error')).toHaveText('Bitte wähle eine Übung.');
  await dialog(page).getByTestId('swap-cancel').click();

  await chooseIn(page, 0, SQUAT_CHAIR);
  await dialog(page).getByTestId('swap-confirm').click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByTestId('swap-feedback')).toContainText(
    `${SQUAT} durch ${SQUAT_CHAIR} ersetzt.`,
  );
  await expect(page.getByTestId('swap-feedback')).toHaveAttribute('aria-live', 'polite');
  await expect(exerciseName(page, 0)).toContainText(SQUAT_CHAIR);
  await expect(page.getByTestId('plan-exercise-mark-0')).toHaveText('heute getauscht');
  // Nur im Gerätespeicher der Day-Swaps (nicht im Plan, nicht in der Datenbank-Abbildung).
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), DAY_SWAPS);
  expect(JSON.parse(stored ?? '[]')).toHaveLength(1);
  expect((await storedDb(page)).rows.exercisePreferences).toEqual([]);

  // Rückgängig (ohne Zeitlimit) → wieder die geplante Übung.
  await page.getByTestId('swap-undo').click();
  await expect(page.getByTestId('swap-feedback')).toContainText('Tausch rückgängig gemacht.');
  await expect(exerciseName(page, 0)).toContainText(SQUAT);
  await expect(page.getByTestId('plan-exercise-mark-0')).toHaveCount(0);

  // Erneut tauschen; „Tausch zurücknehmen“ an der Übung selbst.
  await chooseIn(page, 0, SQUAT_CHAIR);
  await dialog(page).getByTestId('swap-confirm').click();
  await expect(page.getByTestId('plan-swap-undo-0')).toBeVisible();
  await page.getByTestId('plan-swap-undo-0').click();
  await expect(exerciseName(page, 0)).toContainText(SQUAT);
  await chooseIn(page, 0, SQUAT_CHAIR);
  await dialog(page).getByTestId('swap-confirm').click();
  await expect(exerciseName(page, 0)).toContainText(SQUAT_CHAIR);

  // Freitag: unverändert, dort heißt es „Nur bei diesem Training“.
  await page.getByRole('button', { name: /^Freitag/ }).click();
  await expect(exerciseName(page, 0)).toContainText(SQUAT);
  await page.getByTestId('plan-swap-0').click();
  await expect(
    dialog(page)
      .getByTestId('swap-duration')
      .getByRole('radio', { name: 'Nur bei diesem Training' }),
  ).toBeVisible();
  await dialog(page).getByTestId('swap-cancel').click();

  // Heute: Training starten → die getauschte Übung steht schon da (Status „alternative“ beim Speichern).
  await page.getByRole('button', { name: /^Mittwoch/ }).click();
  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout-exercise-0').getByRole('heading')).toContainText(
    SQUAT_CHAIR,
  );
  await page.getByTestId('workout-save').click();
  await heading(page, 'Heute');
  const db = await storedDb(page);
  expect(db.rows.exerciseLogs[0]).toMatchObject({ status: 'alternative' });
  // Erledigt → der Day-Swap ist aufgeräumt.
  await page.reload();
  await heading(page, 'Heute');
  expect(
    JSON.parse((await page.evaluate((key) => window.localStorage.getItem(key), DAY_SWAPS)) ?? '[]'),
  ).toHaveLength(0);
});

test('„Ab jetzt immer“: Grund Pflicht, Rückgängig, alle Einheiten, PDF, Einstellungen, Export, Wieder zulassen', async ({
  page,
}) => {
  await onboard(page, HOME_3_DAYS);
  await toToday(page);
  await expect(exerciseName(page, 2)).toContainText(PUSHUP_RAISED);

  await chooseIn(page, 2, PUSHUP);
  const always = dialog(page)
    .getByTestId('swap-duration')
    .getByRole('radio', { name: 'Ab jetzt immer – zu Hause' });
  await always.click();
  await expect(always).toHaveAttribute('aria-checked', 'true');
  // Grund ist Pflicht, nur zwei Gründe ohne Gesundheitsbezug, kein Freitext.
  const reasons = dialog(page).getByTestId('swap-reason').getByRole('radio');
  await expect(reasons).toHaveCount(2);
  await expect(reasons.nth(0)).toHaveAccessibleName('Mag ich nicht');
  await expect(dialog(page).getByRole('textbox')).toHaveCount(0);
  await dialog(page).getByTestId('swap-confirm').click();
  await expect(dialog(page).getByTestId('swap-error')).toHaveText('Bitte wähle einen Grund.');
  await reasons.nth(0).click();
  await dialog(page).getByTestId('swap-confirm').click();
  await expect(page.getByTestId('swap-feedback')).toContainText(
    `${PUSHUP_RAISED} durch ${PUSHUP} ersetzt. Rückgängig machen kannst du das auch unter Einstellungen, Ausgeschlossene Übungen.`,
  );
  await expect(exerciseName(page, 2)).toHaveText(`3. ${PUSHUP}`);
  await expect(page.getByTestId('plan-exercise-mark-2')).toHaveText('getauscht (deine Wahl)');
  expect((await storedDb(page)).rows.exercisePreferences).toMatchObject([
    { location: 'home', kind: 'dislike' },
  ]);

  // Rückgängig → Präferenz weg, Übung zurück.
  await page.getByTestId('swap-undo').click();
  await expect(exerciseName(page, 2)).toHaveText(`3. ${PUSHUP_RAISED}`);
  expect((await storedDb(page)).rows.exercisePreferences).toEqual([]);

  // Erneut „immer“; „Rückgängig“ verschwindet bei der nächsten Aktion (anderer Tag).
  await chooseIn(page, 2, PUSHUP);
  await dialog(page)
    .getByTestId('swap-duration')
    .getByRole('radio', { name: 'Ab jetzt immer – zu Hause' })
    .click();
  await dialog(page)
    .getByTestId('swap-reason')
    .getByRole('radio', { name: 'Mag ich nicht' })
    .click();
  await dialog(page).getByTestId('swap-confirm').click();
  await expect(page.getByTestId('swap-undo')).toBeVisible();
  for (const day of ['Montag', 'Freitag']) {
    await page.getByRole('button', { name: new RegExp(`^${day}`) }).click();
    await expect(page.getByTestId('swap-undo')).toHaveCount(0);
    const names = await page.getByTestId('plan-exercise-link').allInnerTexts();
    expect(names.some((n) => n.includes(PUSHUP_RAISED))).toBe(false);
  }
  await page.getByRole('button', { name: /^Mittwoch/ }).click();

  // Druckansicht/PDF: Kennzeichen „getauscht (deine Wahl)“.
  await page.getByTestId('plan-print').click();
  const proceed = page.getByRole('button', { name: 'Weiter', exact: true });
  if ((await proceed.count()) > 0) await proceed.click();
  await heading(page, 'Plan als PDF');
  await expect(page.getByTestId('print-preview')).toContainText('getauscht (deine Wahl)');
  await page.goBack();
  await heading(page, 'Heute');

  // Glossar zeigt den Ausschluss mit Weg zu den Einstellungen.
  await page.getByTestId('today-glossary').click();
  await heading(page, 'Übungen');
  await page.getByLabel('Übungen suchen').fill('erhöhten');
  await page.getByTestId('glossary-item').filter({ hasText: PUSHUP_RAISED }).first().click();
  await expect(page.getByTestId('glossary-excluded')).toContainText(
    'Ausgeschlossen zu Hause: Mag ich nicht',
  );
  await page
    .getByTestId('glossary-excluded')
    .getByRole('link', { name: 'Ausschlüsse ansehen' })
    .click();
  await heading(page, 'Ausgeschlossene Übungen');
  const row = page.getByTestId('exclusion-row');
  await expect(row).toHaveCount(1);
  await expect(page.getByTestId('exclusions-home')).toContainText('Zu Hause');
  await expect(row).toContainText(PUSHUP_RAISED);
  await expect(row).toContainText('Mag ich nicht');
  await expect(row).toContainText(`Ersatz: ${PUSHUP}`);

  // Export enthält die Präferenzen (Testmodus).
  await page.goto('/settings');
  await heading(page, 'Einstellungen');
  await expect(page.getByTestId('settings-exclusions')).toBeVisible();
  await page.getByTestId('settings-export').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Datei herunterladen' }).click();
  const file = JSON.parse(readFileSync(await (await downloadPromise).path(), 'utf8')) as {
    data: Record<string, { exercise_id?: string; kind?: string }[]>;
  };
  expect(file.data.exercise_preferences).toHaveLength(1);
  expect(file.data.exercise_preferences?.[0]?.kind).toBe('dislike');

  // Wieder zulassen (mit Bestätigung) → Liste leer, Übung sofort zurück.
  await page.getByTestId('settings-exclusions').click();
  await heading(page, 'Ausgeschlossene Übungen');
  await page.getByRole('button', { name: `${PUSHUP_RAISED} zu Hause wieder zulassen` }).click();
  await expect(page.getByTestId('dialog-exclusion')).toContainText(
    'Die Übung erscheint wieder in deinem Plan – ab sofort.',
  );
  await page
    .getByTestId('dialog-exclusion')
    .getByRole('button', { name: 'Wieder zulassen' })
    .click();
  await expect(page.getByTestId('swap-feedback')).toContainText(
    `${PUSHUP_RAISED} ist wieder zugelassen.`,
  );
  await expect(page.getByTestId('exclusions-empty')).toHaveText(
    'Du hast keine Übungen ausgeschlossen.',
  );
  await page.goto('/today');
  await heading(page, 'Heute');
  await expect(exerciseName(page, 2)).toHaveText(`3. ${PUSHUP_RAISED}`);
});

test('Trainingsmodus: „Tauschen“ statt „Alternative durchgeführt“ – nur heute, Rückgängig, ab jetzt immer', async ({
  page,
}) => {
  await onboard(page, HOME_3_DAYS);
  await toToday(page);
  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout')).toBeVisible();
  await expect(page.getByTestId('workout-exercise-0').getByRole('heading')).toContainText(SQUAT);

  // Nur heute.
  await page.getByTestId('workout-swap-0').click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page)
    .getByTestId('swap-candidates')
    .getByRole('radio', { name: SQUAT_CHAIR, exact: true })
    .click();
  await dialog(page).getByTestId('swap-confirm').click();
  await expect(page.getByTestId('workout-exercise-0').getByRole('heading')).toContainText(
    SQUAT_CHAIR,
  );
  await expect(page.getByTestId('workout-exercise-0')).toContainText(`statt ${SQUAT}`);
  await page.getByTestId('swap-undo').click();
  await expect(page.getByTestId('workout-exercise-0').getByRole('heading')).toContainText(SQUAT);

  // „Zurück zu …“ im Dialog, wenn eine Alternative gewählt ist.
  await page.getByTestId('workout-swap-0').click();
  await dialog(page).getByRole('radio', { name: SQUAT_CHAIR, exact: true }).click();
  await dialog(page).getByTestId('swap-confirm').click();
  await page.getByTestId('workout-swap-0').click();
  await dialog(page)
    .getByRole('button', { name: `Zurück zu ${SQUAT}` })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByTestId('workout-exercise-0').getByRole('heading')).toContainText(SQUAT);

  // Ab jetzt immer (Hier nicht machbar) für Liegestütz mit erhöhten Händen.
  await page.getByTestId('workout-swap-2').click();
  await dialog(page).getByRole('radio', { name: PUSHUP, exact: true }).click();
  await dialog(page).getByRole('radio', { name: 'Ab jetzt immer – zu Hause' }).click();
  await dialog(page)
    .getByRole('radio', { name: /^Hier nicht machbar/ })
    .click();
  await dialog(page).getByTestId('swap-confirm').click();
  await expect(page.getByTestId('swap-feedback')).toContainText('Ausgeschlossene Übungen');
  await expect(page.getByTestId('workout-exercise-2').getByRole('heading')).toContainText(
    `3. ${PUSHUP}`,
  );
  expect((await storedDb(page)).rows.exercisePreferences).toMatchObject([
    { location: 'home', kind: 'not_feasible' },
  ]);

  // Keine gleichwertige Alternative → ehrlicher Hinweis + „Nicht gemacht“-Weg.
  await page.getByTestId('workout-swap-3').click();
  await expect(dialog(page).getByTestId('swap-no-candidates')).toContainText(
    'Für diese Übung gibt es hier gerade keine gleichwertige Alternative.',
  );
  await expect(dialog(page).getByTestId('swap-no-candidates')).toContainText('Nicht gemacht');
  await dialog(page).getByTestId('swap-cancel').click();

  // Speichern: Eintrag als Alternative.
  await page.getByTestId('workout-save').click();
  await heading(page, 'Heute');
  const db = await storedDb(page);
  expect(db.rows.exerciseLogs[2]).toMatchObject({ status: 'alternative' });
});

test('Präferenz-Ausblendung: neutraler Hinweis ohne „Plan neu erstellen“ (B1b), K8 „nicht mehr verfügbar“', async ({
  page,
}) => {
  await onboard(page, HOME_3_DAYS);
  await toToday(page);
  // Gerätespeicher wie nach früheren Tauschen: Türrahmen-Rudern „hier nicht machbar“ (keine Alternative) und eine
  // inzwischen archivierte Übung.
  await page.evaluate((key) => {
    const db = JSON.parse(window.localStorage.getItem(key) ?? '{}') as {
      rows: { profile: { user_id: string }; exercisePreferences: unknown[] };
    };
    const at = '2026-10-06T08:00:00.000Z';
    db.rows.exercisePreferences = [
      {
        user_id: db.rows.profile.user_id,
        exercise_id: 'tuerrahmen-rudern',
        location: 'home',
        kind: 'not_feasible',
        replacement_exercise_id: null,
        created_at: at,
        updated_at: at,
      },
      {
        user_id: db.rows.profile.user_id,
        exercise_id: 'alte-uebung-archiviert',
        location: 'home',
        kind: 'dislike',
        replacement_exercise_id: null,
        created_at: at,
        updated_at: at,
      },
    ];
    window.localStorage.setItem(key, JSON.stringify(db));
  }, LOCAL_DB);
  await page.reload();
  await heading(page, 'Heute');
  const names = await page.getByTestId('plan-exercise-link').allInnerTexts();
  expect(names.some((n) => n.includes('Türrahmen-Rudern'))).toBe(false);
  await expect(page.getByTestId('plan-hidden-by-preference')).toContainText(
    '1 Übung entfällt hier – du hast sie als hier nicht machbar markiert',
  );
  await expect(page.getByTestId('plan-hidden-by-preference')).toContainText(
    'Dieser Einheit fehlt jetzt eine Rücken-Übung (Ziehen).',
  );
  await expect(page.getByTestId('plan-hidden-exercises')).toHaveCount(0);
  await expect(page.getByText('Bitte erstelle den Plan neu', { exact: false })).toHaveCount(0);

  await page.getByTestId('plan-view-exclusions').click();
  await heading(page, 'Ausgeschlossene Übungen');
  await expect(page.getByTestId('exclusion-row')).toHaveCount(2);
  await expect(page.getByTestId('exclusion-unavailable')).toHaveText('nicht mehr verfügbar');
  await page.getByTestId('exclusion-remove-alte-uebung-archiviert').click();
  await expect(page.getByTestId('dialog-exclusion')).toContainText('Eintrag entfernen?');
  await page.getByTestId('dialog-exclusion').getByRole('button', { name: 'Entfernen' }).click();
  await expect(page.getByTestId('exclusion-row')).toHaveCount(1);
  await expect(page.getByTestId('exclusion-row')).toContainText('Hier nicht machbar');
  await expect(page.getByTestId('exclusion-row')).toContainText('Ersatz: wählt die App');
});

test('Abmelden entfernt die „Nur heute“-Tausche des Kontos vom Gerät (Wächter T2-K5)', async ({
  page,
}) => {
  await onboard(page, HOME_3_DAYS);
  await toToday(page);
  await chooseIn(page, 0, SQUAT_CHAIR);
  await dialog(page).getByTestId('swap-confirm').click();
  await expect(page.getByTestId('plan-exercise-mark-0')).toHaveText('heute getauscht');
  // Fokus nach dem Tausch auf der Rückmeldung (K6).
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid')))
    .toBe('swap-feedback');
  const before = await page.evaluate((key) => window.localStorage.getItem(key), DAY_SWAPS);
  expect(JSON.parse(before ?? '[]')).toHaveLength(1);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await heading(page, 'Einstellungen');
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page.getByRole('button', { name: "Los geht's" })).toBeVisible();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), DAY_SWAPS)).toBeNull();
});

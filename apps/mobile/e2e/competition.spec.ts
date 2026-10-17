import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Wettkampf im TESTMODUS (docs/PLAN-PHASE-10.md Abschnitt 8, Etappe WP4) mit festem Startdatum Mittwoch, 07.10.2026
 * (Europe/Berlin): Wettkampf anlegen → Ampel (rot/gelb/grün immer mit Wort, Vorschläge) → Wettkampfplan mit
 * Phasen-Band → Einheit mit Art, Pace und Distanz-Richtwert → Intervall-Timer (Schritte wechseln, Pause/Weiter,
 * Abbrechen und eintragen) → Countdown auf „Heute“ und im Kalender (Renntag markiert) → Ergebnis eintragen → neuer
 * Wettkampf als Countdown → absagen und löschen.
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');

interface StoredRows {
  competitions: {
    id: string;
    status: string;
    race_date: string;
    effective_goal: string | null;
    uses_health_data: boolean;
    result_session_log_id: string | null;
  }[];
  plannedSessions: {
    plan_id: string;
    scheduled_on: string;
    workout_type: string | null;
    training_phase: string | null;
  }[];
  plans: { id: string; status: string; inputs: { discipline: string | null } }[];
  sessionLogs: { id: string; performed_on: string; is_free: boolean; notes: string | null }[];
  goals: { target_date: string | null; discipline: string | null };
}

async function storedRows(page: Page): Promise<StoredRows> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  return (JSON.parse(raw ?? '{}') as { rows: StoredRows }).rows;
}

async function fillDate(page: Page, label: string, day: string, month: string, year: string) {
  await page.getByLabel(`${label}: Tag`).fill(day);
  await page.getByLabel(`${label}: Monat`).fill(month);
  await page.getByLabel(`${label}: Jahr`).fill(year);
}

test.beforeEach(async ({ page }) => {
  // Uhr läuft ab dem festen Datum weiter (für den Timer), springt nur, wenn der Test vorspult.
  await page.clock.install({ time: WEDNESDAY });
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
});

test('Wettkampf: Ampel, Plan mit Phasen, Pace, Intervall-Timer, Countdown, Ergebnis, Absagen', async ({
  page,
}) => {
  await onboard(page, {
    consent: true,
    yesQuestion: null,
    level: /^Fortgeschritten/,
    goal: 'Ausdauer',
    discipline: 'Halbmarathon',
    days: [
      ['Montag', 'Ausdauer', 60],
      ['Mittwoch', 'Ausdauer', 60],
      ['Samstag', 'Ausdauer', 90],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  // Grundlagen-Plan: Hinweis auf „Mein Wettkampf“ statt „kommt später“.
  await expect(page.getByTestId('plan-notes')).toContainText('Einstellungen → Mein Wettkampf');
  await expect(page.getByTestId('competition-phase-band')).toHaveCount(0);

  // --- Wettkampf anlegen ----------------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByTestId('settings-competition').click();
  await heading(page, 'Mein Wettkampf');
  await expect(page.getByText('Noch kein Wettkampf')).toBeVisible();
  await page.getByTestId('competition-add').click();
  await heading(page, 'Wettkampf eintragen');
  // Distanz aus dem Ziel vorbelegt.
  await expect(
    page.getByRole('radiogroup', { name: 'Distanz' }).getByRole('radio', { name: 'Halbmarathon' }),
  ).toHaveAttribute('aria-checked', 'true');

  // Rot: 15.11.2026 ist zu knapp – nie gestaucht, Vorschläge mit Wort und Zeichen.
  await fillDate(page, 'Renntag', '15', '11', '2026');
  const ampel = page.getByTestId('competition-feasibility');
  await expect(page.getByTestId('competition-feasibility-too_short')).toHaveText('✕ Zu kurz');
  await expect(page.getByTestId('competition-reason-lead_time_below_minimum')).toBeVisible();
  await expect(page.getByTestId('competition-suggestion-later_date')).toHaveText(
    'Späterer Renntag: ab 30.12.2026',
  );
  await expect(page.getByTestId('competition-suggestion-without_competition')).toBeVisible();
  await expect(page.getByTestId('competition-create-plan')).toHaveCount(0);
  await expect(page.getByTestId('competition-without')).toBeVisible();
  // Vorschlag übernehmen → frühester Renntag → grün.
  await page.getByTestId('competition-apply-later_date').click();
  await expect(page.getByLabel('Renntag: Tag')).toHaveValue('30');
  await expect(page.getByTestId('competition-feasibility-ok')).toHaveText('✓ Passt');

  // Gelb: Zielzeit, die nicht zur Referenzzeit passt → „Knapp“, Ziel im Plan „Ankommen“.
  await fillDate(page, 'Renntag', '31', '01', '2027');
  await page
    .getByRole('radiogroup', { name: 'Dein Ziel' })
    .getByRole('radio', { name: 'Zielzeit' })
    .click();
  await page.getByTestId('competition-target-hours').fill('1');
  await page.getByTestId('competition-target-minutes').fill('30');
  await page
    .getByRole('radiogroup', { name: 'Distanz der Referenz' })
    .getByRole('radio', { name: '10 km' })
    .click();
  await page.getByTestId('competition-reference-minutes').fill('50');
  await fillDate(page, 'Datum des Laufs', '20', '09', '2026');
  await expect(page.getByTestId('competition-feasibility-tight')).toHaveText('! Knapp');
  await expect(page.getByTestId('competition-reason-goal_time_not_reachable')).toBeVisible();
  await expect(ampel).toContainText('Ziel im Plan: Ankommen');

  // Grün: Ankommen (Referenzzeit bleibt für die Pace).
  await page
    .getByRole('radiogroup', { name: 'Dein Ziel' })
    .getByRole('radio', { name: 'Ankommen' })
    .click();
  await expect(page.getByTestId('competition-feasibility-ok')).toHaveText('✓ Passt');
  await page.getByTestId('competition-name').fill('Winterlauf');

  // Wettkampfplan erstellen: Bestätigung (ersetzt den aktiven Plan), dann save_competition → save_training_plan.
  await page.getByTestId('competition-create-plan').click();
  await page.getByRole('button', { name: 'Plan neu erstellen' }).click();
  await expect(page.getByTestId('competition-message')).toContainText(
    'Dein Wettkampfplan ist fertig',
  );
  await expect(page.getByTestId('competition-plan-state')).toHaveText(
    'Dein Plan ist der Wettkampfplan für diesen Wettkampf.',
  );
  let rows = await storedRows(page);
  expect(rows.competitions).toHaveLength(1);
  expect(rows.competitions[0]).toMatchObject({
    status: 'planned',
    race_date: '2027-01-31',
    effective_goal: 'finish',
    uses_health_data: true,
  });
  expect(rows.goals.target_date).toBe('2027-01-31');
  const activeId = rows.plans.find((p) => p.status === 'active')?.id;
  const sessions = rows.plannedSessions.filter((s) => s.plan_id === activeId);
  expect(sessions.length).toBeGreaterThan(0);
  expect(sessions.every((s) => s.workout_type !== null && s.training_phase !== null)).toBe(true);

  // --- Datum vorverlegen bei laufendem Wettkampfplan (Wächter WP4 H1): kein „nur Countdown“ -----------------
  await page.getByTestId('competition-edit').click();
  await heading(page, 'Wettkampf ändern');
  await expect(page.getByTestId('competition-save-countdown')).toBeVisible();
  await fillDate(page, 'Renntag', '17', '01', '2027');
  await expect(page.getByTestId('competition-plan-change')).toContainText(
    'wird der Plan beim Speichern neu erstellt',
  );
  await expect(page.getByTestId('competition-save-countdown')).toHaveCount(0);
  await expect(page.getByTestId('competition-create-plan')).toHaveText(
    'Speichern und Plan neu erstellen',
  );
  await expect(page.getByTestId('competition-recreate-basic')).toHaveText(
    'Speichern und Plan ohne Wettkampf neu erstellen',
  );
  // Nur der Name: normal speichern (Plan-Bezug bleibt).
  await fillDate(page, 'Renntag', '31', '01', '2027');
  await expect(page.getByTestId('competition-plan-change')).toHaveCount(0);
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(page.getByTestId('competition-plan-state')).toHaveText(
    'Dein Plan ist der Wettkampfplan für diesen Wettkampf.',
  );

  // --- Plan auf „Heute“: Phasen-Band, Countdown, Art, Pace, Distanz-Richtwert -----------------------------
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.getByRole('button', { name: 'Zurück zu Heute' }).click();
  await heading(page, 'Heute');
  await expect(page.getByTestId('competition-phase-band')).toContainText(
    'Basis · Einstiegswoche (bis zum Renntag 16 Wochen)',
  );
  await expect(page.getByTestId('competition-countdown')).toContainText(
    'Noch 116 Tage bis zum Halbmarathon',
  );
  const details = page.getByTestId('plan-endurance');
  await expect(details).toContainText('Art: Locker');
  await expect(details).toContainText('Pace-Richtwert: 6:00–6:30 min/km');
  await expect(details).toContainText(
    'Die Anstrengung hat Vorrang – bei Hitze, Wind und Steigungen langsamer.',
  );
  await expect(details).toContainText('Distanz-Richtwert: etwa 6 km');
  await expect(page.getByTestId('plan-workout-steps')).toContainText('Aufwärmen: 5 min locker');

  // --- Intervall-Timer ------------------------------------------------------------------------------------
  await page.getByTestId('workout-start').click();
  const timer = page.getByTestId('interval-timer');
  await expect(timer).toContainText('Intervall-Timer');
  await expect(timer).toContainText('Im Browser vibriert das Handy nicht');
  await page.getByTestId('interval-start').click();
  await expect(page.getByTestId('interval-step')).toHaveText('Aufwärmen: 5 min locker');
  await expect(page.getByTestId('interval-step-no')).toHaveText('Schritt 1 von 3');
  await expect(page.getByTestId('interval-live')).toHaveText(
    'Jetzt: Schritt 1 von 3: Aufwärmen: 5 min locker',
  );
  // Schrittwechsel nach 5 Minuten (Ansage über die Live-Region).
  await page.clock.fastForward('05:01');
  await expect(page.getByTestId('interval-step')).toHaveText('Hauptteil: 32 min locker');
  await expect(page.getByTestId('interval-step-no')).toHaveText('Schritt 2 von 3');
  await expect(page.getByTestId('interval-live')).toHaveText(
    'Jetzt: Schritt 2 von 3: Hauptteil: 32 min locker',
  );
  // Pause: Zeit läuft nicht weiter.
  await page.getByTestId('interval-pause').click();
  await expect(page.getByTestId('interval-step-no')).toHaveText('Schritt 2 von 3 · Pausiert');
  const pausedAt = await page.getByTestId('interval-step-remaining').textContent();
  await page.clock.fastForward('10:00');
  await expect(page.getByTestId('interval-step-remaining')).toHaveText(pausedAt ?? '');
  await page.getByTestId('interval-resume').click();
  await page.clock.fastForward('02:00');
  await expect(page.getByTestId('interval-step-remaining')).not.toHaveText(pausedAt ?? '');
  // Abbrechen und eintragen: gelaufene Zeit (ca. 7 min) als Dauer.
  await page.getByTestId('interval-stop').click();
  await page.getByRole('button', { name: 'Abbrechen und eintragen' }).last().click();
  await expect(page.getByTestId('interval-logged')).toContainText('7 Minuten eingetragen');
  await expect(page.getByTestId('workout-cardio-minutes')).toHaveValue('7');
  await page.getByTestId('workout-save').click();
  await heading(page, 'Heute');
  await expect(page.getByTestId('plan-completed')).toBeVisible();

  // --- Countdown im Kalender, Renntag markiert ------------------------------------------------------------
  await page.getByTestId('today-calendar').click();
  await expect(page.getByTestId('calendar-countdown')).toContainText(
    'Noch 116 Tage bis zum Halbmarathon',
  );
  for (let i = 0; i < 20; i += 1) {
    if ((await page.getByTestId('calendar-race-day-2027-01-31').count()) > 0) break;
    await page.getByTestId('calendar-next').click();
  }
  await expect(page.getByTestId('calendar-race-day-2027-01-31')).toHaveText(
    '◆ Renntag: Halbmarathon',
  );

  // --- Renntag: Ergebnis eintragen (freie Einheit A1b mit Verweis) ----------------------------------------
  await page.clock.setSystemTime(new Date('2027-01-31T15:00:00+01:00'));
  await page.goto('/today');
  await heading(page, 'Heute');
  await expect(page.getByTestId('competition-countdown')).toContainText(
    'Heute ist Renntag: Halbmarathon',
  );
  await page.getByTestId('competition-countdown-open').click();
  await heading(page, 'Mein Wettkampf');
  await page.getByTestId('competition-open-result').click();
  await heading(page, 'Ergebnis eintragen');
  await page.getByTestId('competition-result-hours').fill('1');
  await page.getByTestId('competition-result-minutes').fill('58');
  await page.getByTestId('competition-result-seconds').fill('20');
  await page.getByTestId('competition-result-effort-7').click();
  await page.getByTestId('competition-result-notes').fill('Gut eingeteilt');
  await page.getByTestId('competition-result-save').click();
  await expect(page.getByTestId('competition-message')).toContainText('Ergebnis gespeichert');
  rows = await storedRows(page);
  const done = rows.competitions[0];
  expect(done?.status).toBe('done');
  const resultLog = rows.sessionLogs.find((l) => l.id === done?.result_session_log_id);
  expect(resultLog).toMatchObject({ performed_on: '2027-01-31', is_free: true });
  expect(resultLog?.notes).toBe('Ergebnis: 1:58:20 · Gut eingeteilt');
  // Danach: Erholung und Frage nach dem nächsten Ziel.
  const overview = page.getByTestId('competition');
  await expect(overview.getByTestId('competition-countdown')).toContainText(
    'Erholung nach dem Rennen',
  );

  // --- Neuer Wettkampf nur als Countdown, dann absagen und löschen ----------------------------------------
  await page.getByTestId('competition-add').click();
  await heading(page, 'Wettkampf eintragen');
  await page
    .getByRole('radiogroup', { name: 'Distanz' })
    .getByRole('radio', { name: '10 km' })
    .click();
  await fillDate(page, 'Renntag', '18', '04', '2027');
  await page.getByTestId('competition-save-countdown').click();
  await expect(page.getByTestId('competition-message')).toContainText('Wettkampf gespeichert');
  await expect(overview.getByTestId('competition-countdown')).toContainText(
    'Noch 77 Tage bis zum 10 km',
  );
  await page.getByTestId('competition-cancel').click();
  await page.getByRole('button', { name: 'Absagen', exact: true }).click();
  await expect(page.getByTestId('competition-message')).toContainText('Wettkampf abgesagt');
  // Wettkampfplan aktiv → Angebot, ohne Wettkampf neu zu erstellen (mit Bestätigung).
  const recreate = page.getByRole('alert').filter({ hasText: 'Plan neu erstellen?' });
  await expect(
    recreate.getByRole('button', { name: 'Plan ohne Wettkampf neu erstellen' }),
  ).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Wettkampf absagen?' })).toHaveCount(0);
  await recreate.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  rows = await storedRows(page);
  expect(rows.competitions.map((c) => c.status).sort()).toEqual(['cancelled', 'done']);
  const cancelled = rows.competitions.find((c) => c.status === 'cancelled');
  await page.getByTestId(`competition-delete-${cancelled?.id ?? ''}`).click();
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect(page.getByTestId('competition-message')).toContainText('Wettkampf gelöscht');
  rows = await storedRows(page);
  expect(rows.competitions).toHaveLength(1);
});

test('Ohne Gesundheits-Check: Einladung aus dem Onboarding-Datum, Ampel „Nicht möglich“, Countdown geht trotzdem', async ({
  page,
}) => {
  await onboard(page, {
    consent: false,
    level: /^Einsteiger/,
    goal: 'Ausdauer',
    discipline: '10 km',
    targetDate: ['17', '01', '2027'],
    days: [
      ['Dienstag', 'Ausdauer', 45],
      ['Donnerstag', 'Ausdauer', 45],
      ['Sonntag', 'Ausdauer', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  // Datum aus dem Onboarding → Einladung „Wettkampf eintragen“ (vorbelegt).
  const invite = page.getByTestId('competition-invite');
  await expect(invite).toContainText('Sonntag, 17.01.');
  await page.getByTestId('competition-invite-open').click();
  await heading(page, 'Wettkampf eintragen');
  await expect(page.getByLabel('Renntag: Tag')).toHaveValue('17');
  await expect(
    page.getByRole('radiogroup', { name: 'Distanz' }).getByRole('radio', { name: '10 km' }),
  ).toHaveAttribute('aria-checked', 'true');
  // Ohne Gesundheits-Check kein Wettkampfplan (Tabelle 3.3) – eigener Zustand, kein „zu kurz“.
  await expect(page.getByTestId('competition-feasibility-not_available')).toHaveText(
    '✕ Nicht möglich',
  );
  await expect(page.getByTestId('competition-reason-health_check_required')).toBeVisible();
  await expect(page.getByTestId('competition-suggestion-health_check')).toBeVisible();
  await expect(page.getByTestId('competition-create-plan')).toHaveCount(0);
  // Countdown ohne Plan-Bezug (kein Gesundheitsdatum).
  await page.getByTestId('competition-save-countdown').click();
  const overview = page.getByTestId('competition');
  await expect(overview.getByTestId('competition-countdown')).toContainText(
    'Noch 102 Tage bis zum 10 km',
  );
  await expect(page.getByTestId('competition-plan-state')).toContainText('Grundlagen-Plan');
  const rows = await storedRows(page);
  expect(rows.competitions[0]).toMatchObject({
    status: 'planned',
    effective_goal: null,
    uses_health_data: false,
  });
  // „Heute“: Countdown statt Einladung, kein Phasen-Band (kein Wettkampfplan).
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await heading(page, 'Heute');
  await expect(page.getByTestId('competition-invite')).toHaveCount(0);
  await expect(page.getByTestId('today').getByTestId('competition-countdown')).toContainText(
    'Noch 102 Tage bis zum 10 km',
  );
  await expect(page.getByTestId('competition-phase-band')).toHaveCount(0);
});

test('Gesundheits-Flag: Ampel höchstens „Knapp“ mit Hinweis „nur Gehen“, Wettkampfplan ohne harte Einheiten und ohne Pace', async ({
  page,
}) => {
  await onboard(page, {
    consent: true,
    yesQuestion: 0,
    level: /^Fortgeschritten/,
    goal: 'Ausdauer',
    discipline: '10 km',
    days: [
      ['Montag', 'Ausdauer', 60],
      ['Mittwoch', 'Ausdauer', 60],
      ['Samstag', 'Ausdauer', 90],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByTestId('settings-competition').click();
  await page.getByTestId('competition-add').click();
  await fillDate(page, 'Renntag', '28', '03', '2027');
  await page.getByTestId('competition-reference-add').click();
  await page
    .getByRole('radiogroup', { name: 'Distanz der Referenz' })
    .getByRole('radio', { name: '10 km' })
    .click();
  await page.getByTestId('competition-reference-minutes').fill('55');
  await fillDate(page, 'Datum des Laufs', '20', '09', '2026');
  await expect(page.getByTestId('competition-feasibility-tight')).toHaveText('! Knapp');
  await expect(page.getByTestId('competition-notice-walk_only_plan')).toHaveText(
    'Dein Plan besteht aus zügigem Gehen – geeignet, um den Wettkampf zu gehen bzw. zu walken.',
  );
  await expect(page.getByTestId('competition-notice-medical_clearance')).toBeVisible();
  await page.getByTestId('competition-create-plan').click();
  await page.getByRole('button', { name: 'Plan neu erstellen' }).click();
  await expect(page.getByTestId('competition-message')).toContainText(
    'Dein Wettkampfplan ist fertig',
  );
  const rows = await storedRows(page);
  const activeId = rows.plans.find((p) => p.status === 'active')?.id;
  const types = rows.plannedSessions
    .filter((s) => s.plan_id === activeId)
    .map((s) => s.workout_type);
  // Nur lockere Arten (Tabelle 3.3: mit Flag nur locker).
  expect(types.every((type) => type === 'easy' || type === 'long' || type === 'recovery')).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.getByRole('button', { name: 'Zurück zu Heute' }).click();
  await heading(page, 'Heute');
  await expect(page.getByTestId('plan-medical-notice')).toBeVisible();
  const details = page.getByTestId('plan-endurance');
  await expect(details).toContainText('Art: Locker');
  // Gehen statt Laufen → keine Lauf-Pace, kein Distanz-Richtwert.
  await expect(details).not.toContainText('Pace-Richtwert');
  await expect(details).not.toContainText('Distanz-Richtwert');
});

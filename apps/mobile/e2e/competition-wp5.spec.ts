import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Rad und Triathlon im TESTMODUS (docs/PLAN-PHASE-10.md Abschnitt 9, Etappe WP5) mit festem Startdatum Mittwoch,
 * 07.10.2026 (Europe/Berlin): Ziel Triathlon-Langdistanz → Hinweis Trainer/Verein, Triathlon Sprint eintragen (nur
 * „Ankommen“, Freiwasser-Hinweis) → Wettkampfplan mit Schwimmtechnik → Folgeblock mit Koppeltraining (zwei Teile, Timer
 * „Rad“/„Laufen“) → Freiwasser-Hinweis bei der Schwimm-Einheit. Rad: Distanz in km, Vorschlag kürzere Distanzklasse,
 * Countdown „Radrennen 120 km“, Plan nur Rad.
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');

interface StoredRows {
  competitions: { discipline: string; distance_m: number; uses_health_data: boolean }[];
  plannedSessions: {
    plan_id: string;
    scheduled_on: string;
    workout_type: string | null;
    endurance_modality: string | null;
  }[];
  plans: { id: string; status: string }[];
  goals: { discipline: string | null };
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

async function openCompetitionForm(page: Page) {
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByTestId('settings-competition').click();
  await heading(page, 'Mein Wettkampf');
  await page.getByTestId('competition-add').click();
  await heading(page, 'Wettkampf eintragen');
}

const distance = (page: Page) => page.getByRole('radiogroup', { name: 'Distanz' });

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: WEDNESDAY });
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
});

test('Triathlon: Hinweis Langdistanz, Sprint mit Schwimmtechnik, Koppeltraining in zwei Teilen, Freiwasser', async ({
  page,
}) => {
  await onboard(page, {
    consent: true,
    yesQuestion: null,
    level: /^Fortgeschritten/,
    goal: 'Ausdauer',
    discipline: 'Triathlon Langdistanz',
    days: [
      ['Dienstag', 'Ausdauer', 60],
      ['Donnerstag', 'Ausdauer', 60],
      ['Samstag', 'Ausdauer', 60],
      ['Sonntag', 'Ausdauer', 90],
    ],
  });
  await openCompetitionForm(page);
  // Langdistanz: kein Wettkampfplan – Hinweis Trainer/Verein, vorbelegt ist Triathlon olympisch.
  await expect(page.getByTestId('competition-coach-hint')).toContainText(
    'Dein Ziel ist Triathlon Langdistanz. Dafür erstellen wir keinen Wettkampfplan',
  );
  await expect(page.getByTestId('competition-coach-hint')).toContainText('Trainer oder Verein');
  await expect(distance(page).getByRole('radio', { name: 'Triathlon olympisch' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(distance(page).getByRole('radio', { name: 'Triathlon Langdistanz' })).toHaveCount(0);

  await distance(page).getByRole('radio', { name: 'Triathlon Sprint' }).click();
  // Nur „Ankommen“: kein Zielzeit-/Referenz-Formular, Tag der langen Ausfahrt.
  await expect(page.getByTestId('competition-multisport-finish')).toContainText(
    'Bei Rad und Triathlon planen wir auf „Ankommen“',
  );
  await expect(page.getByTestId('competition-reference-add')).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: 'Tag für die lange Ausfahrt' })).toBeVisible();
  await fillDate(page, 'Renntag', '27', '12', '2026');
  await expect(page.getByTestId('competition-feasibility-ok')).toHaveText('✓ Passt');
  await expect(page.getByTestId('competition-notice-open_water_safety')).toContainText(
    'nie allein schwimmen',
  );
  await expect(page.getByTestId('competition-feasibility')).toContainText(
    'Längste Ausfahrt im Plan',
  );
  await expect(
    page.getByText('Dein Ziel wird dabei auf Ausdauer – Triathlon Sprint gestellt'),
  ).toBeVisible();

  await page.getByTestId('competition-create-plan').click();
  await page.getByRole('button', { name: 'Plan neu erstellen' }).click();
  await expect(page.getByTestId('competition-message')).toContainText(
    'Dein Wettkampfplan ist fertig',
  );
  let rows = await storedRows(page);
  expect(rows.competitions[0]).toMatchObject({
    discipline: 'triathlon_sprint',
    distance_m: 25750,
    uses_health_data: true,
  });
  expect(rows.goals.discipline).toBe('triathlon_sprint');
  const activeId = () => rows.plans.find((p) => p.status === 'active')?.id;
  let sessions = rows.plannedSessions.filter((s) => s.plan_id === activeId());
  expect(new Set(sessions.map((s) => s.endurance_modality))).toEqual(
    new Set(['swim', 'run', 'bike']),
  );
  expect(sessions.some((s) => s.workout_type === 'technique')).toBe(true);

  // Letzte Woche des ersten Blocks: der Folgeblock (Aufbau) wird angehängt – mit Koppeltraining.
  await page.clock.setSystemTime(new Date('2026-11-12T09:00:00+01:00'));
  await page.goto('/today');
  await heading(page, 'Heute');
  await expect
    .poll(async () => {
      rows = await storedRows(page);
      return rows.plannedSessions.filter(
        (s) => s.plan_id === activeId() && s.workout_type === 'brick',
      ).length;
    })
    .toBeGreaterThan(0);
  sessions = rows.plannedSessions.filter((s) => s.plan_id === activeId());
  const brick = sessions.find((s) => s.workout_type === 'brick');
  expect(brick?.endurance_modality).toBe('bike');

  // Schwimm-Einheit (Folgeblock): Schwimmtechnik und Sicherheitshinweis Freiwasser.
  const swim = sessions.find(
    (s) => s.workout_type === 'technique' && s.scheduled_on > '2026-11-12',
  );
  await page.clock.setSystemTime(new Date(`${swim?.scheduled_on}T09:00:00+01:00`));
  await page.goto('/today');
  await heading(page, 'Heute');
  await expect(page.getByTestId('plan-endurance')).toContainText('Art: Schwimmtechnik');
  await expect(page.getByTestId('plan-open-water')).toContainText('Neoprenanzug');
  await expect(page.getByTestId('plan-open-water')).toContainText('Begleitung');

  // Tag mit Koppeltraining: zwei Teile, Ablauf mit Sportart, Timer zeigt „Rad“ und danach „Laufen“.
  await page.clock.setSystemTime(new Date(`${brick?.scheduled_on}T09:00:00+01:00`));
  await page.goto('/today');
  await heading(page, 'Heute');
  const details = page.getByTestId('plan-endurance');
  await expect(details).toContainText('Art: Koppeltraining (Rad → Lauf)');
  await expect(details).toContainText('Zwei Teile in einer Einheit: Teil 1 Rad');
  await expect(page.getByTestId('plan-workout-steps')).toContainText('Hauptteil (Laufen)');
  await page.getByTestId('workout-start').click();
  await page.getByTestId('interval-start').click();
  await expect(page.getByTestId('interval-step')).toHaveText('Aufwärmen (Rad): 5 min locker');
  await expect(page.getByTestId('interval-step-no')).toContainText('Schritt 1 von');
  // Wechsel aufs Laufen: nach dem Rad-Teil zeigt und sagt der Timer „Laufen“ an.
  await page.clock.fastForward('05:01');
  await expect(page.getByTestId('interval-step')).toContainText('Hauptteil (Rad)');
  await expect(page.getByTestId('interval-live')).toContainText('Hauptteil (Rad)');
  await page.clock.fastForward('11:00');
  await expect(page.getByTestId('interval-step')).toContainText('Hauptteil (Laufen)');
  await expect(page.getByTestId('interval-live')).toContainText('Hauptteil (Laufen)');
});

test('Rad: Distanz in km, kürzere Distanzklasse als Vorschlag, Countdown und Plan nur Rad', async ({
  page,
}) => {
  await onboard(page, {
    consent: true,
    yesQuestion: null,
    level: /^Fortgeschritten/,
    goal: 'Ausdauer',
    discipline: 'Radfahren',
    days: [
      ['Dienstag', 'Ausdauer', 60],
      ['Donnerstag', 'Ausdauer', 60],
      ['Samstag', 'Ausdauer', 60],
      ['Sonntag', 'Ausdauer', 90],
    ],
  });
  await openCompetitionForm(page);
  await expect(distance(page).getByRole('radio', { name: 'Radrennen' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await fillDate(page, 'Renntag', '31', '01', '2027');
  // Ohne Distanz keine Ampel; ungültige Distanz mit Fehlertext.
  await expect(page.getByTestId('competition-feasibility')).toHaveCount(0);
  await page.getByTestId('competition-distance-km').fill('400');
  await page.getByTestId('competition-save-countdown').click();
  await expect(page.getByText('Bitte ganze Kilometer zwischen 20 und 300 eingeben.')).toBeVisible();
  // 250 km in knapp 17 Wochen: zu kurz – Vorschlag kürzere Distanzklasse.
  await page.getByTestId('competition-distance-km').fill('250');
  await expect(page.getByTestId('competition-feasibility-too_short')).toHaveText('✕ Zu kurz');
  await expect(page.getByTestId('competition-suggestion-shorter_distance')).toHaveText(
    'Kürzere Distanz: Radrennen 120 km',
  );
  await page.getByTestId('competition-apply-shorter_distance').click();
  await expect(page.getByTestId('competition-distance-km')).toHaveValue('120');
  await expect(page.getByTestId('competition-feasibility-ok')).toHaveText('✓ Passt');
  await expect(page.getByTestId('competition-feasibility')).toContainText(
    'Längste Ausfahrt im Plan',
  );

  await page.getByTestId('competition-create-plan').click();
  await page.getByRole('button', { name: 'Plan neu erstellen' }).click();
  await expect(page.getByTestId('competition-message')).toContainText(
    'Dein Wettkampfplan ist fertig',
  );
  await expect(page.getByTestId('competition-summary')).toContainText('Distanz: Radrennen 120 km');
  await expect(page.getByTestId('competition').getByTestId('competition-countdown')).toContainText(
    'Noch 116 Tage bis zum Radrennen 120 km',
  );
  const rows = await storedRows(page);
  expect(rows.competitions[0]).toMatchObject({ discipline: 'cycling', distance_m: 120000 });
  const activeId = rows.plans.find((p) => p.status === 'active')?.id;
  const endurance = rows.plannedSessions.filter(
    (s) => s.plan_id === activeId && s.endurance_modality !== null,
  );
  expect(endurance.length).toBeGreaterThan(5);
  expect(endurance.every((s) => s.endurance_modality === 'bike')).toBe(true);
});

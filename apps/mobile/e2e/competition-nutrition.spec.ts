import { expect, test, type Page } from '@playwright/test';

import { onboardNutrition, patchDb } from './nutrition-helpers';

/**
 * Wettkampf-Ernährung im TESTMODUS (docs/PLAN-PHASE-10.md Abschnitt 10, Etappe W1). Fester Tag Montag, 12.10.2026; die
 * Person (Abnehmen, 70 kg, Beispiel-Rezepte) bekommt einen Halbmarathon am Sonntag, 18.10.2026 – direkt im
 * Gerätespeicher, weil die App einen so kurzfristigen Wettkampf nicht anlegen lässt (Mindestvorlauf). Geprüft: Carb-
 * Loading-Tag, Vorabend, Renntag mit Zeitleiste (Gel-/Trinkplan), Markierung in der Woche, Tagesauswertung,
 * „Kalorienzahlen anzeigen“ aus, Wettkampf unter 90 min (kein Carb-Loading), abgesagt (Tage normal).
 */

const FRIDAY = '2026-10-16';
const SUNDAY = '2026-10-18';

function competitionRow(patch: Record<string, unknown> = {}) {
  return {
    id: 'w1-comp',
    user_id: 'local',
    name: 'Stadtlauf',
    discipline: 'half_marathon',
    distance_m: 21097.5,
    race_date: SUNDAY,
    goal_kind: 'finish',
    target_time_s: null,
    reference_discipline: null,
    reference_time_s: null,
    reference_date: null,
    long_run_weekday: null,
    status: 'planned',
    result_session_log_id: null,
    own_start_weekly_minutes: null,
    start_reference_volume: null,
    start_reference_session_cap: null,
    start_reference_start_group: null,
    effective_goal: null,
    uses_health_data: false,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
    ...patch,
  };
}

async function setCompetition(page: Page, patch: Record<string, unknown> = {}) {
  await patchDb(page, (value) => ({
    ...value,
    rows: { ...value.rows, competitions: [competitionRow(patch)] },
  }));
}

async function openDay(page: Page, date: string) {
  await page.goto(`/ernaehrung?tag=${date}`);
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
}

test('Wettkampf-Ernährung: Carb-Loading, Vorabend, Renntag mit Zeitleiste, Woche, Zahlen aus, 5 km, abgesagt', async ({
  page,
}) => {
  await onboardNutrition(page);
  await setCompetition(page);

  // „Mein Wettkampf“ führt zur Ernährung am Renntag.
  await page.goto('/wettkampf');
  await page.getByTestId('competition-open-nutrition').click();
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
  const card = page.getByTestId('competition-nutrition');
  await expect(card).toContainText('◆ Renntag: Halbmarathon');

  // Renntag: Zeitleiste mit Frühstück (Gramm aus 70 kg), Portionen alle 30 min, Trinken, feste Hinweise.
  const timeline = page.getByTestId('competition-timeline');
  await expect(timeline).toContainText('Dein Renntag – Zeitleiste');
  await expect(timeline).toContainText('2 Std. bis 4 Std. vor dem Start');
  await expect(timeline).toContainText('etwa 140–280 g Kohlenhydrate');
  await expect(timeline).toContainText('Nach 30 min');
  await expect(timeline).toContainText('etwa 15–30 g Kohlenhydrate');
  await expect(timeline).toContainText('Trinken: Richtwert 400–800 ml pro Stunde.');
  await expect(timeline).toContainText('Nichts Neues am Renntag');
  await expect(card).toContainText('Dein Wettkampf ist in deinem Tagesziel schon eingerechnet');
  await expect(card).toContainText('ärztlich ab');
  // Ratgeber „Wettkampf-Ernährung“ (Beispiel) ist verlinkt.
  await expect(page.getByTestId('competition-nutrition-guide')).toBeVisible();

  // Vorabend und Carb-Loading-Tag (Einsteigerin, geschätzt 2 Std. 45 min → 2 Tage).
  await page.getByTestId('nutrition-prev').click();
  await expect(card).toContainText('◇ Vorabend: Halbmarathon');
  await expect(card).toContainText('nichts Neues ausprobieren');
  await page.getByTestId('nutrition-prev').click();
  await expect(card).toContainText('▲ Carb-Loading-Tag: Halbmarathon');
  await expect(card).toContainText('Heute mehr Kohlenhydrate – so geplant');
  await expect(card).toContainText('Dein Tagesziel bleibt gleich');
  await expect(card).toContainText('ohne Defizit');
  await expect(page.getByTestId('nutrition-target')).toBeVisible();
  await expect(page.getByTestId('competition-timeline')).toHaveCount(0);

  // Woche: Tage mit Wort und Zeichen markiert.
  await page.getByTestId('nutrition-week-view').click();
  await expect(page.getByTestId('nutrition-week')).toBeVisible();
  await expect(page.getByTestId(`week-competition-${FRIDAY}`)).toHaveText(
    '▲ Carb-Loading-Tag: Halbmarathon',
  );
  await expect(page.getByTestId(`week-competition-${SUNDAY}`)).toHaveText(
    '◆ Renntag: Halbmarathon',
  );
  await expect(page.getByTestId('week-competition-2026-10-14')).toHaveCount(0);

  // Tagesauswertung „Dein Tag“: Satz zum Carb-Loading.
  await page.goto(`/tag/${FRIDAY}`);
  await expect(page.getByTestId('day-carb-loading')).toHaveText(
    'Heute mehr Kohlenhydrate – so geplant.',
  );

  // „Kalorienzahlen anzeigen“ aus → nirgends kcal oder Gramm.
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: { ...(value.rows.nutritionSetup as object), show_energy_numbers: false },
    },
  }));
  await openDay(page, SUNDAY);
  await expect(card).toContainText('◆ Renntag: Halbmarathon');
  await expect(timeline).toContainText('Mengen in Gramm sind ausgeblendet');
  await expect(timeline).toContainText('400–800 ml');
  await expect(card).not.toContainText(/\d\s*g\b/);
  await expect(page.getByTestId('nutrition-day')).not.toContainText('kcal');
  await openDay(page, FRIDAY);
  await expect(card).toContainText('▲ Carb-Loading-Tag');
  await expect(card).not.toContainText('Tagesziel');
  await page.goto(`/tag/${FRIDAY}`);
  await expect(page.getByTestId('day-carb-loading')).toHaveCount(0);

  // Wettkampf 5 km → kein Carb-Loading (Freitag ist nur „Wettkampfwoche“).
  await setCompetition(page, { discipline: '5k', distance_m: 5000 });
  await openDay(page, FRIDAY);
  await expect(card).toContainText('Wettkampfwoche: 5 km');
  await expect(card).not.toContainText('Carb-Loading');
  await openDay(page, SUNDAY);
  await expect(card).toContainText('◆ Renntag: 5 km');
  await expect(timeline).toContainText('weniger als einer Stunde');

  // Abgesagt → Tage normal.
  await setCompetition(page, { status: 'cancelled' });
  await openDay(page, FRIDAY);
  await expect(page.getByTestId('competition-nutrition')).toHaveCount(0);
});

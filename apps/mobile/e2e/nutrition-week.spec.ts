import { expect, test, type Page } from '@playwright/test';

import { db, onboardNutrition, openNutrition, patchDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Etappe N5a im TESTMODUS (docs/PLAN-PHASE-5.md 6.3 Nr. 7, 6.6, 8.2 Nr. 2–3, 13 N5): gespeicherter Essensplan,
 * Wochenansicht, „Andere Vorschläge“, „Rezept tauschen“ (ohne Netz bedienbar – der echte Offline-Test mit
 * Warteschlange gehört zu N7), „Plan aktualisieren“ und die automatische
 * Neuplanung nach „schwanger“ bzw. neuer Unverträglichkeit (W11 App) – vergangene Tage bleiben unverändert.
 * Beispiel-Rezepte mit TESTWERTEN (`@fitnessapp/core/demo-nutrition`). Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

interface StoredMeal {
  slot: string;
  recipeId: string;
  titleDe: string;
  isFill: boolean;
}
interface StoredDay {
  date: string;
  status: string;
  meals: StoredMeal[];
}
interface StoredPlanRow {
  week_start: string;
  auto_adjusted: boolean;
  plan: { variant: number; days: StoredDay[] };
}

const MONDAY = '2026-10-12';
/** Beispiel-Rezepte mit Schwangerschafts-Hinweis (roh, Räucherfisch, Rohwurst …). */
const PREGNANCY_CAUTION = [
  'mascarponecreme-roh',
  'brot-raeucherlachs',
  'salami-brot',
  'lachs-reis-annahme',
];
const PEANUT_RECIPES = ['erdnuss-banane', 'tofu-erdnuss-curry'];

async function mealPlans(page: Page): Promise<StoredPlanRow[]> {
  return ((await db(page)).rows.mealPlans ?? []) as StoredPlanRow[];
}

async function planOf(page: Page, weekStart = MONDAY): Promise<StoredPlanRow> {
  await expect
    .poll(async () => (await mealPlans(page)).some((p) => p.week_start === weekStart))
    .toBe(true);
  const row = (await mealPlans(page)).find((p) => p.week_start === weekStart);
  if (!row) throw new Error('Plan erwartet');
  return row;
}

const recipeIds = (days: StoredDay[]) => days.flatMap((d) => d.meals.map((m) => m.recipeId));

async function startWithPlan(page: Page, person: Parameters<typeof onboardNutrition>[1] = {}) {
  await onboardNutrition(page, person);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await openNutrition(page);
  return planOf(page);
}

test('Plan wird gespeichert; Wochenansicht; „Andere Vorschläge“ bleibt nach dem Neuladen; nächste Woche', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const stored = await startWithPlan(page);
  expect(stored.auto_adjusted).toBe(false);
  expect(stored.plan.variant).toBe(0);
  expect(stored.plan.days).toHaveLength(7);

  await page.getByTestId('nutrition-week-view').click();
  await expect(page.getByTestId('nutrition-week')).toBeVisible();
  for (const day of stored.plan.days) {
    await expect(page.getByTestId(`week-day-${day.date}`)).toBeVisible();
  }
  // Angezeigt wird genau der gespeicherte Plan.
  const tuesday = stored.plan.days[1] as StoredDay;
  const firstMeal = tuesday.meals[0] as StoredMeal;
  await expect(page.getByTestId(`week-meal-${tuesday.date}-${firstMeal.slot}`)).toContainText(
    firstMeal.titleDe,
  );
  await expect(page.getByTestId(`week-day-total-${MONDAY}`)).toContainText('kcal');

  // „Andere Vorschläge“ mit Nachfrage → Variante 1 gespeichert, auch nach dem Neuladen.
  await page.getByTestId('nutrition-other').click();
  const dialog = page.getByTestId('dialog-other-suggestions');
  await expect(dialog).toContainText('vergangene Tage bleiben unverändert');
  await dialog.getByRole('button', { name: 'Andere Vorschläge' }).click();
  await expect(page.getByTestId('nutrition-week-message')).toBeVisible();
  await expect.poll(async () => (await planOf(page)).plan.variant).toBe(1);
  const other = await planOf(page);
  await page.goto('/ernaehrung/woche');
  await expect(page.getByTestId('nutrition-week')).toBeVisible();
  const otherTuesday = other.plan.days[1] as StoredDay;
  const otherMeal = otherTuesday.meals[0] as StoredMeal;
  await expect(page.getByTestId(`week-meal-${otherTuesday.date}-${otherMeal.slot}`)).toContainText(
    otherMeal.titleDe,
  );
  expect((await planOf(page)).plan.variant).toBe(1);

  // Nächste Woche: eigener gespeicherter Plan.
  await page.getByTestId('nutrition-week-next').click();
  await expect(page.getByTestId('week-day-2026-10-19')).toBeVisible();
  await planOf(page, '2026-10-19');

  // Zahlen aus → keine kcal in der Wochenansicht (S12).
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: { ...(value.rows.nutritionSetup as object), show_energy_numbers: false },
    },
  }));
  await page.goto('/ernaehrung/woche');
  await expect(page.getByTestId(`week-day-${MONDAY}`)).toBeVisible();
  await expect(page.getByTestId('nutrition-week')).not.toContainText('kcal');
});

test('Rezept tauschen ohne Netz bedienbar (Testmodus, kein Server); nach dem Neuladen bleibt der Tausch', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const stored = await startWithPlan(page);
  const monday = stored.plan.days[0] as StoredDay;
  const snack = monday.meals.find((m) => m.slot === 'snack_afternoon' && !m.isFill);
  if (!snack) throw new Error('Nachmittags-Snack erwartet');

  await page.context().setOffline(true);
  // „Rezept tauschen“ steht seit 26.10.2026 im ⋯-Menü der Mahlzeit.
  await page.getByTestId('meal-snack_afternoon-pref-more').click();
  await page.getByTestId('swap-snack_afternoon').click();
  await expect(page.getByTestId('nutrition-swap-message')).toContainText('Getauscht');
  await expect(page.getByTestId('meal-snack_afternoon')).not.toContainText(snack.titleDe);
  await expect
    .poll(
      async () =>
        (await planOf(page)).plan.days[0]?.meals.find((m) => m.slot === 'snack_afternoon')
          ?.recipeId,
    )
    .not.toBe(snack.recipeId);
  const swapped = (await planOf(page)).plan.days[0]?.meals.find(
    (m) => m.slot === 'snack_afternoon',
  ) as StoredMeal;
  await page.context().setOffline(false);

  await page.goto('/ernaehrung');
  await expect(page.getByTestId('meal-snack_afternoon')).toContainText(swapped.titleDe);
  // Ergänzungs-Snacks und vergangene Tage haben keinen Tausch-Knopf; heute ja.
  await expect(page.getByTestId('swap-extra_1')).toHaveCount(0);
});

test('W11: „schwanger“ am Mittwoch → Plan ab heute automatisch angepasst, Mo/Di unverändert, Hinweis bis „Verstanden“', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const before = await startWithPlan(page);
  // Ausgangslage: ab Mittwoch steht ein Rezept mit Schwangerschafts-Hinweis im Plan.
  expect(recipeIds(before.plan.days.slice(2)).some((id) => PREGNANCY_CAUTION.includes(id))).toBe(
    true,
  );

  await page.clock.setFixedTime(new Date('2026-10-14T09:00:00+02:00'));
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      healthScreenings: [
        {
          id: 'hs-test',
          user_id: (value.rows.profile as { user_id: string }).user_id,
          answers: {},
          flags: ['pregnancy'],
          medical_notice_acknowledged_at: '2026-10-14T07:00:00.000Z',
          created_at: '2026-10-14T07:00:00.000Z',
        },
      ],
    },
  }));
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('nutrition-plan-adjusted')).toContainText(
    'Dein Plan wurde an deine neuen Angaben angepasst.',
  );
  await expect.poll(async () => (await planOf(page)).auto_adjusted).toBe(true);
  const after = await planOf(page);
  expect(after.plan.days.slice(0, 2)).toEqual(before.plan.days.slice(0, 2));
  for (const day of after.plan.days.slice(2)) {
    expect(day.status).toBe('no_targets');
  }
  expect(
    recipeIds(after.plan.days.slice(2)).filter((id) => PREGNANCY_CAUTION.includes(id)),
  ).toEqual([]);
  await expect(page.getByTestId('nutrition-target')).toHaveCount(0);

  // Wochenansicht: gleicher Hinweis; „Verstanden“ blendet ihn dauerhaft aus.
  await page.getByTestId('nutrition-week-view').click();
  const weekView = page.getByTestId('nutrition-week');
  await expect(weekView.getByTestId('nutrition-plan-adjusted')).toBeVisible();
  await expect(weekView).not.toContainText('kcal');
  await weekView.getByTestId('nutrition-plan-adjusted-ok').click();
  await expect(page.getByTestId('nutrition-plan-adjusted')).toHaveCount(0);
  await expect.poll(async () => (await planOf(page)).auto_adjusted).toBe(false);
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('nutrition-meals')).toBeVisible();
  await expect(page.getByTestId('nutrition-plan-adjusted')).toHaveCount(0);
});

test('vegan + neue Unverträglichkeit Erdnüsse → automatisch ohne Erdnuss-Rezepte geplant', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const before = await startWithPlan(page, { diet: 'Vegan' });
  expect(recipeIds(before.plan.days).some((id) => PEANUT_RECIPES.includes(id))).toBe(true);
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      foodPreferences: [
        ...value.rows.foodPreferences,
        {
          user_id: (value.rows.profile as { user_id: string }).user_id,
          food_group: 'peanuts',
          kind: 'intolerance',
        },
      ],
    },
  }));
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('nutrition-plan-adjusted')).toBeVisible();
  await expect.poll(async () => (await planOf(page)).auto_adjusted).toBe(true);
  expect(
    recipeIds((await planOf(page)).plan.days).filter((id) => PEANUT_RECIPES.includes(id)),
  ).toEqual([]);
  await expect(page.getByTestId('nutrition-day')).not.toContainText('Erdnuss');
});

test('Plan aktualisieren: Gewicht deutlich geändert (≥ 5 %, ohne Sicherheitsbezug) → Knopf, danach neue Portionen', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const before = await startWithPlan(page);
  await expect(page.getByTestId('nutrition-plan-update')).toHaveCount(0);
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      bodyMetrics: (value.rows.bodyMetrics as { weight_kg: number | null }[]).map((row) => ({
        ...row,
        weight_kg: row.weight_kg === null ? null : 80,
      })),
    },
  }));
  await page.goto('/ernaehrung');
  await expect(page.getByTestId('nutrition-plan-update')).toBeVisible();
  // Kein Sicherheitsbezug → keine automatische Neuplanung, der gespeicherte Plan bleibt bis zum Knopf.
  await expect(page.getByTestId('nutrition-plan-adjusted')).toHaveCount(0);
  expect((await planOf(page)).plan).toEqual(before.plan);
  await page.getByTestId('nutrition-plan-update-button').click();
  await expect(page.getByTestId('nutrition-plan-message')).toContainText('aktualisiert');
  await expect(page.getByTestId('nutrition-plan-update')).toHaveCount(0);
  await expect
    .poll(async () => JSON.stringify((await planOf(page)).plan))
    .not.toBe(JSON.stringify(before.plan));
});

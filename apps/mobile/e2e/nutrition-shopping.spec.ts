import { expect, test, type Page } from '@playwright/test';

import {
  db,
  onboardNutrition,
  openNutrition,
  patchDb,
  showCheckedShoppingItems,
} from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Etappe N5b im TESTMODUS (docs/PLAN-PHASE-5.md 6.5, 6.6, 8.2 Nr. 5, 19.6, 13 N5): Einkaufsliste (Abhaken ohne Netz,
 * Häkchen nach dem Neuladen, eigene Einträge, Zeitraum, „Erledigte ausblenden“), W22 App (Schwangerschaft gesetzt →
 * Plan UND Einkaufsliste automatisch angepasst), „Zur Einkaufsliste“ aus Rezept und Meal-Prep-Plan, Meal-Prep-Woche
 * mit Kochtag und Timer (läuft nach Neuladen und ohne Netz weiter), „Zahlen aus“ im Meal-Prep. Beispiel-Rezepte mit
 * TESTWERTEN. Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

const MONDAY = '2026-10-12';
const WEDNESDAY = '2026-10-14';
/** Lebensmittel mit Schwangerschafts-Hinweis im Beispiel-Katalog. */
const CAUTION_FOODS = ['raeucherlachs', 'salami', 'kalbsleberwurst', 'bergkaese-rohmilch'];

interface StoredItem {
  itemKey: string;
  foodId: string | null;
  labelDe: string;
  checked: boolean;
  isManual: boolean;
  notInPlan: boolean;
}
interface StoredList {
  weekStart: string;
  from: string;
  to: string;
  planKey: string;
  recipes: { recipeId: string; servings: number }[];
  items: StoredItem[];
}
interface StoredPlanRow {
  week_start: string;
  cook_day_started_at: string | null;
  plan: {
    mealPrepPlanId: string | null;
    days: { date: string; meals: { recipeId: string; cookDate: string }[] }[];
  };
}

async function lists(page: Page): Promise<{ week_start: string; list: StoredList }[]> {
  return ((await db(page)).rows.shoppingLists ?? []) as { week_start: string; list: StoredList }[];
}

async function listOf(page: Page, weekStart = MONDAY): Promise<StoredList> {
  await expect
    .poll(async () => (await lists(page)).some((l) => l.week_start === weekStart))
    .toBe(true);
  const row = (await lists(page)).find((l) => l.week_start === weekStart);
  if (!row) throw new Error('Liste erwartet');
  return row.list;
}

async function planRow(page: Page): Promise<StoredPlanRow | undefined> {
  return ((await db(page)).rows.mealPlans as StoredPlanRow[] | undefined)?.find(
    (p) => p.week_start === MONDAY,
  );
}

async function startWithPlan(page: Page, person: Parameters<typeof onboardNutrition>[1] = {}) {
  await onboardNutrition(page, person);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
  await openNutrition(page);
  await expect.poll(async () => (await planRow(page)) !== undefined).toBe(true);
}

async function openShopping(page: Page) {
  await page.getByTestId('nutrition-shopping').click();
  await expect(page.getByTestId('shopping-list')).toBeVisible();
  await expect(page.getByTestId('shopping-items')).toBeVisible();
}

test('Einkaufsliste: abhaken und eigener Eintrag ohne Netz, Häkchen nach dem Neuladen, Erledigte ausblenden, Zeitraum', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await startWithPlan(page);
  await openShopping(page);
  // Standard seit 23.10.2026: nur die nächsten 3 Tage, „Erledigte ausblenden“ an.
  await expect(page.getByTestId('shopping-range')).toContainText('12.10.2026 bis 14.10.2026');
  await expect(page.getByTestId('shopping-list')).not.toContainText('kcal');
  await showCheckedShoppingItems(page);
  const boxes = page.getByTestId('shopping-items').getByRole('checkbox');
  expect(await boxes.count()).toBeGreaterThan(2);
  const firstLabel = (await boxes.nth(0).getAttribute('aria-label')) as string;
  const secondLabel = (await boxes.nth(1).getAttribute('aria-label')) as string;

  await page.getByRole('checkbox', { name: firstLabel }).click();
  await expect(page.getByRole('checkbox', { name: firstLabel })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect.poll(async () => (await listOf(page)).items.filter((i) => i.checked).length).toBe(1);

  // Ohne Netz: Abhaken und eigener Eintrag gehen (Testmodus: Gerätespeicher).
  await page.context().setOffline(true);
  await expect(page.getByTestId('shopping-offline')).toBeVisible();
  await page.getByRole('checkbox', { name: secondLabel }).click();
  await expect(page.getByRole('checkbox', { name: secondLabel })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByTestId('shopping-add-label').fill('Kaffee');
  await page.getByTestId('shopping-add').click();
  await expect(page.getByTestId('shopping-item-manual|kaffee')).toContainText('Kaffee');
  await expect.poll(async () => (await listOf(page)).items.filter((i) => i.checked).length).toBe(2);
  await page.context().setOffline(false);

  // Neu laden: Häkchen und eigener Eintrag bleiben.
  await page.reload();
  await expect(page.getByTestId('shopping-items')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: firstLabel })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('checkbox', { name: secondLabel })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByTestId('shopping-item-manual|kaffee')).toBeVisible();

  // Erledigte ausblenden (Wahl bleibt nach dem Neuladen).
  await page.getByTestId('shopping-hide-checked').click();
  await expect(page.getByRole('checkbox', { name: firstLabel })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('shopping-hide-checked')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('checkbox', { name: firstLabel })).toHaveCount(0);
  await page.getByTestId('shopping-hide-checked').click();
  await expect(page.getByRole('checkbox', { name: firstLabel })).toHaveCount(1);

  // Eigenen Eintrag löschen.
  await page.getByTestId('shopping-remove-manual|kaffee').click();
  await expect(page.getByTestId('shopping-item-manual|kaffee')).toHaveCount(0);

  // Eigener Zeitraum: Donnerstag bis Sonntag – bleibt nach dem Neuladen (nicht vom Standard überschrieben).
  await page.getByTestId('shopping-range-toggle').click();
  const picker = page.getByTestId('shopping-range-picker');
  await picker
    .getByRole('radiogroup', { name: 'Von' })
    .getByRole('radio', { name: /15\.10\./ })
    .click();
  await picker
    .getByRole('radiogroup', { name: 'Bis' })
    .getByRole('radio', { name: /18\.10\./ })
    .click();
  await page.getByTestId('shopping-range-apply').click();
  await expect(page.getByTestId('shopping-range')).toContainText('15.10.2026 bis 18.10.2026');
  await expect.poll(async () => (await listOf(page)).from).toBe('2026-10-15');
  await expect(page.getByTestId('shopping-range-toggle')).toContainText(
    'Eigener Zeitraum (gewählt)',
  );
  await expect(page.getByTestId('shopping-range-days')).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await expect(page.getByTestId('shopping-range')).toContainText('15.10.2026 bis 18.10.2026');
  // Zurück zu „3 Tage“.
  await page.getByTestId('shopping-range-days').click();
  await expect(page.getByTestId('shopping-range')).toContainText('12.10.2026 bis 14.10.2026');
  await expect.poll(async () => (await listOf(page)).to).toBe('2026-10-14');
});

test('Einkaufsliste: Standard 3 Tage, „Ganze Woche“ zeigt mehr und bleibt gemerkt; Häkchen bleiben', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await startWithPlan(page);
  await openShopping(page);
  await expect(page.getByTestId('shopping-range')).toContainText('12.10.2026 bis 14.10.2026');
  await expect(page.getByTestId('shopping-range-days')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('shopping-range-week')).toHaveAttribute('aria-checked', 'false');
  const boxes = page.getByTestId('shopping-items').getByRole('checkbox');
  const threeDays = await boxes.count();
  expect(threeDays).toBeGreaterThan(0);
  // Einen Eintrag abhaken (verschwindet, weil „Erledigte ausblenden“ an ist).
  const label = (await boxes.nth(0).getAttribute('aria-label')) as string;
  await boxes.nth(0).click();
  await expect(page.getByRole('checkbox', { name: label })).toHaveCount(0);
  await expect.poll(async () => (await listOf(page)).items.filter((i) => i.checked).length).toBe(1);

  await page.getByTestId('shopping-range-week').click();
  await expect(page.getByTestId('shopping-range')).toContainText('12.10.2026 bis 18.10.2026');
  await expect(page.getByTestId('shopping-range-week')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => boxes.count()).toBeGreaterThan(threeDays);
  await expect.poll(async () => (await listOf(page)).to).toBe('2026-10-18');
  // Häkchen bleibt über den Wechsel (gleicher item_key).
  const week = await listOf(page);
  expect(week.items.filter((i) => i.checked).length).toBe(1);
  expect(week.items.length).toBeGreaterThan(threeDays);

  // Wahl bleibt nach dem Neuladen.
  await page.reload();
  await expect(page.getByTestId('shopping-items')).toBeVisible();
  await expect(page.getByTestId('shopping-range')).toContainText('12.10.2026 bis 18.10.2026');
  await expect(page.getByTestId('shopping-range-week')).toHaveAttribute('aria-checked', 'true');
});

test('Einkaufsliste: Abteilungen auf- und zuklappen (gemerkt), ganz erledigt → zu mit „✓ erledigt“', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await startWithPlan(page);
  await openShopping(page);
  const first = page.locator('[data-testid^="shopping-dept-toggle-"]').first();
  const category = ((await first.getAttribute('data-testid')) as string).replace(
    'shopping-dept-toggle-',
    '',
  );
  const toggle = page.getByTestId(`shopping-dept-toggle-${category}`);
  const items = page.getByTestId(`shopping-dept-items-${category}`);
  const status = page.getByTestId(`shopping-dept-status-${category}`);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(status).toContainText('offen');
  const open = await items.getByRole('checkbox').count();
  expect(open).toBeGreaterThan(0);
  await expect(status).toHaveText(`${open} offen`);

  // Zuklappen → Einträge weg; bleibt nach dem Neuladen zu; aufklappen.
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(items).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('shopping-items')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(items.getByRole('checkbox')).toHaveCount(open);

  // Alles abhaken → klappt von selbst zu, „✓ erledigt“.
  for (let i = 0; i < open; i += 1) {
    await items.getByRole('checkbox').first().click();
  }
  await expect(status).toHaveText('✓ erledigt');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(items).toHaveCount(0);
  // Aufklappen: Erledigte ausgeblendet, „x erledigt – anzeigen“ zeigt sie.
  await toggle.click();
  await expect(items.getByRole('checkbox')).toHaveCount(0);
  await page.getByTestId(`shopping-dept-show-done-${category}`).click();
  await expect(items.getByRole('checkbox')).toHaveCount(open);
  await expect(items.getByRole('checkbox').first()).toHaveAttribute('aria-checked', 'true');
  // Einen wieder öffnen → nicht mehr erledigt.
  await items.getByRole('checkbox').first().click();
  await expect(status).toHaveText('1 offen');
});

test('W22 App: „schwanger“ am Mittwoch → Plan UND Einkaufsliste angepasst, Häkchen und eigene Einträge bleiben', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await startWithPlan(page);
  await openShopping(page);
  // Hier geht es um die Neuplanung der ganzen Woche (Standard seit 23.10.2026: 3 Tage).
  await page.getByTestId('shopping-range-week').click();
  await expect(page.getByTestId('shopping-range')).toContainText('12.10.2026 bis 18.10.2026');
  await showCheckedShoppingItems(page);
  // Immer den ersten OFFENEN Eintrag abhaken (abgehakte wandern ans Ende ihrer Abteilung, 24.10.2026).
  const open = page
    .getByTestId('shopping-items')
    .locator('[role="checkbox"][aria-checked="false"]');
  for (let i = 0; i < 3; i += 1) {
    const id = (await open.first().getAttribute('data-testid')) as string;
    await page.getByTestId(id).click();
    // Ganz erledigte Abteilungen klappen zu – deshalb über den Speicher prüfen.
    await expect
      .poll(async () => (await listOf(page)).items.filter((x) => x.checked).length)
      .toBe(i + 1);
  }
  await page.getByTestId('shopping-add-label').fill('Spülmittel');
  await page.getByTestId('shopping-add').click();
  await expect(page.getByTestId('shopping-item-manual|spülmittel')).toBeVisible();
  await expect.poll(async () => (await listOf(page)).items.filter((i) => i.checked).length).toBe(3);
  const before = await listOf(page);
  // Ausgangslage: ab Mittwoch steht die rohe Mascarpone-Creme (Schwangerschafts-Hinweis, einzige Mascarpone-Quelle)
  // im Plan – ihre Mascarpone steht offen auf der Liste.
  const planBefore = (await planRow(page))?.plan;
  expect(
    planBefore?.days
      .filter((d) => d.date >= WEDNESDAY)
      .some((d) => d.meals.some((m) => m.recipeId === 'mascarponecreme-roh')),
  ).toBe(true);
  expect(before.items.some((i) => i.itemKey === 'mascarpone|g')).toBe(true);

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
  await page.goto('/einkaufsliste');
  await expect(page.getByTestId('shopping-adjusted')).toBeVisible();
  await expect(page.getByTestId('shopping-range')).toContainText('14.10.2026 bis 18.10.2026');
  await expect(page.getByTestId('shopping-list')).not.toContainText('kcal');
  // Plan und Liste wurden im selben Schritt gespeichert.
  await expect.poll(async () => (await listOf(page)).planKey).not.toBe(before.planKey);
  const after = await listOf(page);
  expect(after.from).toBe(WEDNESDAY);
  expect(after.items.filter((i) => !i.checked && CAUTION_FOODS.includes(i.foodId ?? ''))).toEqual(
    [],
  );
  expect(after.items.filter((i) => !i.checked && i.itemKey === 'mascarpone|g')).toEqual([]);
  expect(after.items.find((i) => i.isManual)?.labelDe).toBe('Spülmittel');
  for (const item of before.items.filter((i) => i.checked)) {
    const now = after.items.find((i) => i.itemKey === item.itemKey);
    // Abgehakte bleiben abgehakt (im Plan oder „nicht mehr im Plan“) – außer ein Lebensmittel mit
    // Schwangerschafts-Hinweis, das nur noch als „nicht mehr im Plan“ stand (Wächter N5b K1).
    if (CAUTION_FOODS.includes(item.foodId ?? '')) continue;
    expect(now?.checked).toBe(true);
  }
  expect(after.items.every((i) => !i.notInPlan || i.checked)).toBe(true);

  // Neu laden: angepasste Liste bleibt (keine Schleife).
  await page.reload();
  await expect(page.getByTestId('shopping-items')).toBeVisible();
  expect((await listOf(page)).planKey).toBe(after.planKey);
});

test('„Zur Einkaufsliste“ aus der Rezeptansicht mit Portionen; aus dem Plan geöffnet steht es schon drauf', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await startWithPlan(page);
  await page.goto('/rezept/porridge-banane');
  await expect(page.getByTestId('recipe')).toBeVisible();
  await page.getByTestId('recipe-servings-more').click();
  await page.getByTestId('recipe-shopping-add').click();
  await expect(page.getByTestId('recipe-shopping-message')).toContainText(
    'Steht auf deiner Einkaufsliste',
  );
  await expect
    .poll(async () => (await listOf(page)).recipes)
    .toEqual([{ recipeId: 'porridge-banane', servings: 2 }]);
  await page.getByTestId('recipe-shopping-open').click();
  await expect(page.getByTestId('shopping-recipes')).toContainText('2 Portionen');
  await page.getByTestId('shopping-recipe-remove-porridge-banane').click();
  await expect(page.getByTestId('shopping-recipes')).toHaveCount(0);
  await expect.poll(async () => (await listOf(page)).recipes).toEqual([]);

  // Aus dem Plan geöffnet: steht über den Plan schon auf der Liste.
  await page.goto('/ernaehrung');
  // Erstes Plan-Gericht (nicht das „+“ der Mahlzeiten-Karte).
  await page
    .getByTestId('nutrition-meals')
    .locator('[data-testid^="meal-"]:not([data-testid^="meal-card"])')
    .first()
    .click();
  await expect(page.getByTestId('recipe-shopping-in-plan')).toBeVisible();
  await expect(page.getByTestId('recipe-shopping-add')).toHaveCount(0);
});

test('Meal-Prep-Woche: Plan wählen → Einkaufsliste → Kochtag mit Timer (Neuladen, ohne Netz); ausgegraut ohne Grund; Zahlen aus', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await startWithPlan(page);
  await page.getByTestId('nutrition-meal-prep').click();
  await expect(page.getByTestId('meal-prep-list')).toBeVisible();
  // Vegetarisch: Fisch-Woche ausgegraut – ohne Grund und ohne Rezeptnamen.
  await expect(page.getByTestId('meal-prep-plan-demo-fisch-woche-not-offered')).toHaveText(
    'Passt nicht zu deinen Angaben',
  );
  await expect(page.getByTestId('meal-prep-plan-demo-fisch-woche')).not.toContainText('Lachs');
  await expect(page.getByTestId('meal-prep-list')).not.toContainText('kcal');

  await page.getByTestId('meal-prep-plan-demo-pasta-woche').click();
  await expect(page.getByTestId('meal-prep-plan')).toBeVisible();
  await expect(page.getByTestId('meal-prep-cook-date')).toContainText('Kochtag');
  await page.getByTestId('meal-prep-choose').click();
  await page
    .getByTestId('dialog-meal-prep-choose')
    .getByRole('button', { name: 'Plan wählen' })
    .click();
  await expect(page.getByTestId('meal-prep-plan-chosen')).toBeVisible();
  await expect
    .poll(async () => (await planRow(page))?.plan.mealPrepPlanId)
    .toBe('demo-pasta-woche');
  await expect(page.getByTestId('meal-prep-plan')).not.toContainText('kcal');

  // Plan wählen → Einkaufsliste (wird angelegt). Seit EA-G1 ist sie der Reiter „Einkaufen“ – der Weg dorthin schließt
  // die Unterseiten; zurück zum Meal-Prep-Plan über seine Adresse.
  const mealPrepUrl = page.url();
  await page.getByTestId('meal-prep-to-shopping').click();
  await expect(page.getByTestId('shopping-list')).toBeVisible();
  const list = await listOf(page);
  expect(list.items.some((i) => i.foodId === 'spaghetti')).toBe(true);
  await page.goto(mealPrepUrl);

  // Kochtag mit Timer.
  await page.getByTestId('meal-prep-to-cook-day').click();
  await expect(page.getByTestId('cook-day')).toBeVisible();
  await page.getByTestId('cook-day-start').click();
  await expect(page.getByTestId('cook-day-countdown')).toContainText('Nächster Schritt in 5:00');
  await expect.poll(async () => (await planRow(page))?.cook_day_started_at).not.toBeNull();
  await expect(page.getByTestId('cook-day-step-0')).toHaveAttribute('aria-label', /Jetzt/);

  // 6 Minuten später, nach dem Neuladen: zweiter Schritt läuft.
  await page.clock.setFixedTime(new Date('2026-10-12T09:06:00+02:00'));
  await page.reload();
  await expect(page.getByTestId('cook-day-step-1')).toHaveAttribute('aria-label', /Jetzt/);
  await expect(page.getByTestId('cook-day-countdown')).toContainText('Nächster Schritt in 4:00');

  // Ohne Netz läuft er weiter.
  await page.context().setOffline(true);
  await page.clock.setFixedTime(new Date('2026-10-12T09:11:00+02:00'));
  await expect(page.getByTestId('cook-day-step-2')).toHaveAttribute('aria-label', /Jetzt/);
  await page.context().setOffline(false);
  await expect(page.getByTestId('cook-day-storage')).toBeVisible();
  await expect(page.getByTestId('cook-day')).not.toContainText('kcal');

  // Zahlen aus → keine kcal im Meal-Prep.
  await patchDb(page, (value) => ({
    ...value,
    rows: {
      ...value.rows,
      nutritionSetup: { ...(value.rows.nutritionSetup as object), show_energy_numbers: false },
    },
  }));
  await page.goto('/meal-prep');
  await expect(page.getByTestId('meal-prep-plan-demo-pasta-woche-chosen')).toBeVisible();
  await expect(page.getByTestId('meal-prep-list')).not.toContainText('kcal');
  await page.goto('/meal-prep/demo-pasta-woche');
  await expect(page.getByTestId('meal-prep-plan-chosen')).toBeVisible();
  await expect(page.getByTestId('meal-prep-plan')).not.toContainText('kcal');

  // Kochtag beenden.
  await page.goto('/meal-prep/kochtag');
  await page.getByTestId('cook-day-stop').click();
  await expect(page.getByTestId('cook-day-start')).toBeVisible();
  await expect.poll(async () => (await planRow(page))?.cook_day_started_at).toBeNull();
});

test('Erdnuss-Unverträglichkeit → vegane Curry-Woche ausgegraut', async ({ page }) => {
  test.setTimeout(150_000);
  await startWithPlan(page, { diet: 'Vegan', peanutIntolerance: true });
  await page.goto('/meal-prep');
  await expect(page.getByTestId('meal-prep-plan-demo-vegane-woche-not-offered')).toBeVisible();
  await expect(page.getByTestId('meal-prep-plan-demo-vegane-woche')).not.toContainText('Erdnuss');
  await expect(page.getByTestId('meal-prep-plan-demo-pasta-woche')).toHaveAttribute(
    'aria-label',
    /Plan ansehen/,
  );
});

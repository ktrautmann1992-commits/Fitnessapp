/**
 * Etappe N5b (docs/PLAN-PHASE-5.md 6.5, 6.6, 7.2–7.5, 19.6): Einkaufsliste und Meal-Prep-Kochtag im Testmodus –
 * Speicher-Regeln (Zod, Datumsrahmen, Einwilligung), eine Liste je Woche, Häkchen nach Neustart erhalten, Plan und
 * Liste im selben Schritt (W22 App-Logik: Schwangerschaft → Plan UND Liste angepasst), Widerruf/„Unverträglichkeiten
 * löschen“ löschen Listen mit Gesundheitsbezug samt eigener Einträge (K10), Export, Gerätespeicher älterer Versionen,
 * Kochtag-Start, Meal-Prep-Pläne (ausgegraut ohne Grund), K-b-Hinweis.
 */
import {
  addManualShoppingItem,
  addRecipeToShoppingList,
  type MealPlanWeek,
  selectNutritionContent,
  setShoppingItemChecked,
  type StoredShoppingList,
  validateContent,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import { describe, expect, it } from 'vitest';

import {
  localBackendOn,
  planPersonRows,
  seededBackend,
  TODAY,
  USER_ID,
  VERSIONS,
} from '../test/fixtures';
import { BackendError } from './backend';
import { localDataExport } from './data-export';
import { upgradeStoredRows } from './legacy-rows';
import {
  applyCookDayStart,
  applyMealPlanSave,
  applyShoppingListSave,
  checkShoppingListSave,
  storedMealPlanRow,
  storedShoppingListRow,
} from './meal-plan-rows';
import {
  computeNutritionWeek,
  mealPrepOffers,
  nutritionWeekStart,
  type NutritionWeekResult,
} from './nutrition-plan';
import type { UserRows } from './types';
import { applyHealthDataRevocation } from './write-ops';

const WEEK = nutritionWeekStart(TODAY); // Montag 28.09.2026; TODAY = Samstag 03.10.2026
const WEDNESDAY = '2026-09-30';
const MONDAY = '2026-09-28';

const LIBRARY = (() => {
  const demo = demoNutritionContent();
  return selectNutritionContent(validateContent(demo.files, { nutritionCatalog: demo.catalog }), {
    allowDrafts: true,
  });
})();
const FOODS = LIBRARY.foods;

function rows(
  options: {
    consent?: 'valid' | 'none';
    flags?: string[];
    diet?: 'vegetarian' | 'vegan' | 'omnivore';
    intolerances?: string[];
  } = {},
): UserRows {
  const consent = options.consent ?? 'valid';
  const base = planPersonRows({ consent, goal: 'fat_loss', flags: options.flags ?? [] });
  return {
    ...base,
    profile: base.profile ? { ...base.profile, sex: 'female' } : null,
    nutritionPrefs: {
      user_id: USER_ID,
      diet_type: options.diet ?? 'vegetarian',
      eats_pork: options.diet === 'omnivore' ? true : null,
      meals_per_day: 4,
      cooking_mode: 'daily',
      mealprep_days: null,
    },
    nutritionSetup: {
      user_id: USER_ID,
      activity_level: 'light',
      training_time: 'evening',
      mealprep_slots: 'lunch',
      show_energy_numbers: true,
    },
    foodPreferences: (options.intolerances ?? []).map((group, i) => ({
      id: `fp-${i}`,
      user_id: USER_ID,
      food_group: group,
      kind: 'intolerance',
    })) as UserRows['foodPreferences'],
    bodyMetrics:
      consent === 'valid'
        ? [
            {
              id: 'bm-1',
              user_id: USER_ID,
              measured_on: '2026-09-20',
              height_cm: 170,
              weight_kg: 70,
              body_fat_pct: null,
              resting_heart_rate_bpm: null,
            },
          ]
        : [],
  };
}

type Ready = Extract<NutritionWeekResult, { kind: 'ready' }> & {
  plan: MealPlanWeek;
  planState: NonNullable<Extract<NutritionWeekResult, { kind: 'ready' }>['planState']>;
  shopping: NonNullable<Extract<NutritionWeekResult, { kind: 'ready' }>['shopping']>;
};

function week(data: UserRows, today = TODAY, weekStart = WEEK): Ready {
  const result = computeNutritionWeek({
    rows: data,
    versions: VERSIONS,
    today,
    weekStart,
    library: LIBRARY,
    allowDrafts: true,
  });
  if (result.kind !== 'ready' || result.plan === null || result.shopping === null) {
    throw new Error('Plan erwartet');
  }
  return result as Ready;
}

const caution = (foodId: string | null) =>
  foodId !== null && FOODS.get(foodId)?.pregnancy_caution === true;

function tickHalf(list: StoredShoppingList): StoredShoppingList {
  return list.items
    .filter((_, i) => i % 2 === 0)
    .reduce((acc, item) => setShoppingItemChecked(acc, item.itemKey, true), list);
}

describe('checkShoppingListSave / applyShoppingListSave (Testmodus, wie replace_shopping_list)', () => {
  it('gültig → ok; eine Liste je Woche, created_at bleibt', () => {
    const data = rows();
    const list = week(data).shopping.list;
    expect(checkShoppingListSave(list, { today: TODAY, rows: data, versions: VERSIONS })).toEqual({
      ok: true,
      list,
    });
    const once = applyShoppingListSave(data, list, { id: 'sl-1', userId: USER_ID, now: 'A' });
    const twice = applyShoppingListSave(once, tickHalf(list), {
      id: 'sl-2',
      userId: USER_ID,
      now: 'B',
    });
    expect(twice.shoppingLists).toHaveLength(1);
    expect(twice.shoppingLists[0]).toMatchObject({ id: 'sl-1', created_at: 'A', updated_at: 'B' });
    expect(storedShoppingListRow(twice, WEEK)?.list.items.some((i) => i.checked)).toBe(true);
  });

  it('ungültig, vergangene Woche, Gesundheitsbezug ohne Einwilligung → abgelehnt', () => {
    const data = rows();
    const list = week(data).shopping.list;
    const check = (value: unknown, r: UserRows = data, today = TODAY) =>
      checkShoppingListSave(value, { today, rows: r, versions: VERSIONS });
    expect(check({ ...list, items: 'x' })).toEqual({ ok: false, reason: 'invalid' });
    expect(check(list, data, '2026-10-12')).toEqual({ ok: false, reason: 'out_of_range' });
    expect(list.usesHealthData).toBe(true);
    expect(check(list, rows({ consent: 'none' }))).toEqual({
      ok: false,
      reason: 'consent_required',
    });
    const plain = week(rows({ consent: 'none' })).shopping.list;
    expect(plain.usesHealthData).toBe(false);
    expect(check(plain, rows({ consent: 'none' })).ok).toBe(true);
  });
});

describe('Gerätespeicher, Widerruf, Löschen, Export', () => {
  const data = rows();
  const plan = week(data).plan;
  const stored = applyShoppingListSave(
    applyMealPlanSave(data, plan, { id: 'mp-1', userId: USER_ID, now: 'A', autoAdjusted: false }),
    addManualShoppingItem(week(data).shopping.list, { labelDe: 'Kaffee' }),
    { id: 'sl-1', userId: USER_ID, now: '2026-10-03T10:00:00.000Z' },
  );

  it('ältere Gerätestände: nur gültige Listen des eigenen Kontos, je Woche eine; neue Plan-Felder ergänzt', () => {
    const raw = JSON.parse(JSON.stringify(stored)) as Record<string, unknown>;
    const lists = raw.shoppingLists as Record<string, unknown>[];
    const good = lists[0] as Record<string, unknown>;
    raw.shoppingLists = [
      good,
      { ...good, id: 'doppelt' },
      { ...good, id: 'fremd', user_id: 'jemand' },
      { ...good, id: 'kaputt', list: { ...(good.list as object), weekStart: 'x' } },
    ];
    const mealPlans = raw.mealPlans as Record<string, unknown>[];
    delete (mealPlans[0] as Record<string, unknown>).recipes_changed;
    delete (mealPlans[0] as Record<string, unknown>).cook_day_started_at;
    const upgraded = upgradeStoredRows(raw as unknown as UserRows);
    expect(upgraded.shoppingLists.map((l) => l.id)).toEqual(['sl-1']);
    expect(upgraded.mealPlans[0]).toMatchObject({
      recipes_changed: false,
      cook_day_started_at: null,
    });
    expect(
      upgradeStoredRows({ ...(raw as object), shoppingLists: undefined } as unknown as UserRows)
        .shoppingLists,
    ).toEqual([]);
  });

  it('Widerruf health_data löscht Listen mit Gesundheitsbezug samt eigener Einträge (K10)', () => {
    expect(applyHealthDataRevocation(stored).shoppingLists).toEqual([]);
  });

  it('„Gespeicherte Unverträglichkeiten löschen“ löscht Listen mit Gesundheitsbezug mit', async () => {
    const { backend } = seededBackend(stored);
    await backend.deleteStoredIntolerances();
    expect((await backend.loadRows()).rows.shoppingLists).toEqual([]);
  });

  it('Export: shopping_lists und shopping_list_items (Spalten wie 7.2, plus Zeitraum und Markierungen)', () => {
    const file = localDataExport(stored, USER_ID, '2026-10-03T10:00:00.000Z');
    const lists = file.data.shopping_lists as Record<string, unknown>[];
    const items = file.data.shopping_list_items as Record<string, unknown>[];
    expect(lists).toHaveLength(1);
    expect(lists[0]).toMatchObject({
      id: 'sl-1',
      meal_plan_id: 'mp-1',
      from_date: WEEK,
      uses_health_data: true,
    });
    expect(items.some((i) => i.is_manual === true && i.label_de === 'Kaffee')).toBe(true);
    expect(items.every((i) => i.list_id === 'sl-1' && 'checked' in i && 'item_key' in i)).toBe(
      true,
    );
    const meal = (file.data.meal_plans as Record<string, unknown>[])[0];
    expect(meal).toMatchObject({ recipes_changed: false, cook_day_started_at: null });
  });
});

describe('Ablauf im Testmodus: Liste abhaken → App neu → Schwangerschaft → Plan UND Liste angepasst (W22)', () => {
  it('Häkchen bleiben nach Neustart; nach „schwanger“ kein offener Eintrag mit Risiko, eigene Einträge bleiben', async () => {
    const omnivore = rows({ diet: 'omnivore' });
    const { store, backend } = seededBackend(omnivore, MONDAY);
    const first = week((await backend.loadRows()).rows, MONDAY);
    await backend.saveMealPlan(first.plan, { autoAdjusted: false }, omnivore);
    let list = tickHalf(first.shopping.list);
    list = addManualShoppingItem(list, { labelDe: 'Spülmittel' });
    const added = addRecipeToShoppingList(
      list,
      { recipeId: 'brot-raeucherlachs', servings: 2 },
      first.plan,
      first.planState.input,
    );
    if (!added.ok) throw new Error('erwartet');
    await backend.saveShoppingList(added.list, omnivore);

    // App neu (anderes Backend auf demselben Speicher, Mittwoch).
    const restarted = localBackendOn(store, WEDNESDAY, '2026-09-30T08:00:00.000Z');
    const loaded = (await restarted.loadRows()).rows;
    const again = week(loaded, WEDNESDAY);
    expect(again.shopping.action).toBe('stored');
    expect(again.shopping.list).toEqual(added.list);
    expect(again.shopping.list.items.filter((i) => i.checked).length).toBeGreaterThan(0);

    const pregnant: UserRows = {
      ...loaded,
      healthScreenings: rows({ flags: ['pregnancy', 'conservative_plan'] }).healthScreenings,
    };
    const replanned = week(pregnant, WEDNESDAY);
    expect(replanned.planState.action).toBe('replanned');
    expect(replanned.shopping.action).toBe('rebuilt');
    const next = replanned.shopping.list;
    expect(next.from).toBe(WEDNESDAY);
    expect(next.items.filter((i) => !i.checked && caution(i.foodId))).toEqual([]);
    expect(next.recipes).toEqual([]);
    expect(next.items.find((i) => i.isManual)?.labelDe).toBe('Spülmittel');
    for (const item of again.shopping.list.items) {
      const now = next.items.find((i) => i.itemKey === item.itemKey);
      if (item.checked && now !== undefined) expect(now.checked).toBe(true);
    }
    // Plan und Liste im selben Schritt gespeichert → beim nächsten Öffnen beides „gespeichert“.
    const saved = await restarted.saveMealPlan(
      replanned.plan,
      { autoAdjusted: true, shoppingList: next },
      pregnant,
    );
    const after = week({ ...saved, healthScreenings: pregnant.healthScreenings }, WEDNESDAY);
    expect(after.planState.action).toBe('stored');
    // Wächter N5b K1: abgehakte „nicht mehr im Plan“-Einträge mit jetzt ausgeschlossenem Lebensmittel fallen beim
    // nächsten Öffnen weg (einmal), danach bleibt die Liste.
    const settled =
      after.shopping.action === 'stored'
        ? saved
        : await restarted.saveShoppingList(after.shopping.list, saved);
    expect(after.shopping.list.items.filter((i) => i.notInPlan && caution(i.foodId))).toEqual([]);
    const final = week({ ...settled, healthScreenings: pregnant.healthScreenings }, WEDNESDAY);
    expect(final.planState.action).toBe('stored');
    expect(final.shopping.action).toBe('stored');
  });

  it('Speichern abgelehnt (Liste ungültig) → auch der Plan bleibt unverändert (ein Schritt)', async () => {
    const data = rows();
    const { backend } = seededBackend(data);
    const current = week(data);
    await expect(
      backend.saveMealPlan(
        current.plan,
        { autoAdjusted: false, shoppingList: { ...current.shopping.list, from: '1999-01-01' } },
        data,
      ),
    ).rejects.toBeInstanceOf(BackendError);
    expect((await backend.loadRows()).rows.mealPlans).toEqual([]);
  });

  it('Liste und Essensplan gleichzeitig gespeichert → beide bleiben (Schreibvorgänge nacheinander)', async () => {
    const data = rows();
    const { backend } = seededBackend(data);
    const current = week(data);
    await Promise.all([
      backend.saveMealPlan(current.plan, { autoAdjusted: false }, data),
      backend.saveShoppingList(tickHalf(current.shopping.list), data),
    ]);
    const loaded = (await backend.loadRows()).rows;
    expect(loaded.mealPlans).toHaveLength(1);
    expect(loaded.shoppingLists).toHaveLength(1);
  });
});

describe('Meal-Prep im Testmodus: Pläne, Wahl, Kochtag-Start, K-b', () => {
  it('Erdnuss-Unverträglichkeit → vegane Curry-Woche ausgegraut (ohne Grund); Pasta-Woche angeboten', () => {
    const vegan = week(rows({ diet: 'vegan', intolerances: ['peanuts'] }), MONDAY);
    const offers = mealPrepOffers(vegan, LIBRARY.mealPrepPlans);
    expect(offers.map((o) => o.plan.id)).toEqual([
      'demo-fisch-woche',
      'demo-pasta-woche',
      'demo-vegane-woche',
    ]);
    expect(offers.find((o) => o.plan.id === 'demo-vegane-woche')).toMatchObject({
      offered: false,
      preview: null,
    });
    expect(offers.find((o) => o.plan.id === 'demo-fisch-woche')?.offered).toBe(false);
    const without = mealPrepOffers(week(rows({ diet: 'vegan' }), MONDAY), LIBRARY.mealPrepPlans);
    expect(without.find((o) => o.plan.id === 'demo-vegane-woche')?.offered).toBe(true);
  });

  it('gewählter Plan bleibt gespeichert; Kochtag-Start bleibt nur bei gleichem Meal-Prep-Plan', async () => {
    const data = rows();
    const current = week(data, MONDAY);
    const offer = mealPrepOffers(current, LIBRARY.mealPrepPlans).find(
      (o) => o.plan.id === 'demo-pasta-woche',
    );
    if (!offer?.preview) throw new Error('Angebot erwartet');
    const { store, backend } = seededBackend(data, MONDAY);
    let saved = await backend.saveMealPlan(offer.preview, { autoAdjusted: false }, data);
    expect(storedMealPlanRow(saved, WEEK)?.plan.mealPrepPlanId).toBe('demo-pasta-woche');
    saved = await backend.saveCookDayStart(WEEK, '2026-09-28T09:00:00.000Z', saved);
    expect(storedMealPlanRow(saved, WEEK)?.cook_day_started_at).toBe('2026-09-28T09:00:00.000Z');
    const reopened = (await localBackendOn(store, MONDAY, 'x').loadRows()).rows;
    expect(storedMealPlanRow(reopened, WEEK)?.cook_day_started_at).toBe('2026-09-28T09:00:00.000Z');
    const again = week(reopened, MONDAY);
    expect(again.planState.action).toBe('stored');
    expect(mealPrepOffers(again, LIBRARY.mealPrepPlans).find((o) => o.chosen)?.plan.id).toBe(
      'demo-pasta-woche',
    );
    // Gleicher Plan erneut gespeichert → Start bleibt; anderer Plan (ohne Meal-Prep) → weg.
    const same = applyMealPlanSave(reopened, offer.preview, {
      id: 'x',
      userId: USER_ID,
      now: 'n',
      autoAdjusted: false,
    });
    expect(storedMealPlanRow(same, WEEK)?.cook_day_started_at).toBe('2026-09-28T09:00:00.000Z');
    const other = applyMealPlanSave(reopened, current.plan, {
      id: 'y',
      userId: USER_ID,
      now: 'n',
      autoAdjusted: false,
    });
    expect(storedMealPlanRow(other, WEEK)?.cook_day_started_at).toBeNull();
    expect(applyCookDayStart(other, WEEK, 'z')).toBeNull();
    await expect(backend.saveCookDayStart(WEEK, 'kein Datum', saved)).rejects.toBeInstanceOf(
      BackendError,
    );
  });

  it('K-b: neue Rezept-Version → Plan neu erstellt mit Hinweis; „Verstanden“ blendet ihn aus', () => {
    const data = rows();
    const current = week(data);
    const stored = applyMealPlanSave(data, current.plan, {
      id: 'mp-1',
      userId: USER_ID,
      now: 'n',
      autoAdjusted: false,
    });
    const usedId = current.plan.days[0]?.meals[0]?.recipeId as string;
    const library = {
      ...LIBRARY,
      recipes: LIBRARY.recipes.map((r) => (r.id === usedId ? { ...r, version: r.version + 1 } : r)),
    };
    const result = computeNutritionWeek({
      rows: stored,
      versions: VERSIONS,
      today: TODAY,
      weekStart: WEEK,
      library,
      allowDrafts: true,
    });
    if (result.kind !== 'ready' || result.planState === null || result.plan === null) {
      throw new Error('erwartet');
    }
    expect(result.planState.action).toBe('rebuilt');
    expect(result.planState.recipesChanged).toBe(true);
    const saved = applyMealPlanSave(stored, result.plan, {
      id: 'mp-2',
      userId: USER_ID,
      now: 'n',
      autoAdjusted: false,
      recipesChanged: true,
    });
    const reopened = computeNutritionWeek({
      rows: saved,
      versions: VERSIONS,
      today: TODAY,
      weekStart: WEEK,
      library,
      allowDrafts: true,
    });
    expect(reopened.kind === 'ready' && reopened.planState?.recipesChanged).toBe(true);
    const dismissed = applyMealPlanSave(saved, result.plan, {
      id: 'mp-3',
      userId: USER_ID,
      now: 'n',
      autoAdjusted: false,
      recipesChanged: false,
    });
    const after = computeNutritionWeek({
      rows: dismissed,
      versions: VERSIONS,
      today: TODAY,
      weekStart: WEEK,
      library,
      allowDrafts: true,
    });
    expect(after.kind === 'ready' && after.planState?.recipesChanged).toBe(false);
  });
});

/**
 * Etappe N7 Teil 2 (docs/PLAN-PHASE-5.md „Umsetzungsstand N7 Teil 2“): Ernährung im Supabase-Modus – Zeilen der
 * Datenbank → App (Zod an der Grenze, H5), vollständiger Plan aus dem geschützten Speicher bzw. Rekonstruktion im Core
 * (G-N7-1), H9 „Rezept nicht mehr verfügbar“, Speichern über save_meal_plan/replace_shopping_list (H3, Abhaken
 * offline), Ernährungstagebuch und eigene Gerichte über die verschlüsselte Ernährungs-Warteschlange (offline,
 * abgelehnte Fassungen lokal mit Hinweis, G3 aus E1), nie Gesundheitsdaten im normalen Zwischenspeicher, Löschfrist
 * (G-N7-2) im Testmodus.
 */
import {
  type MealPlanRecord,
  type MealPlanWeek,
  selectNutritionContent,
  toMealPlanPayload,
  toShoppingListPayload,
  validateContent,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import type { AppSupabaseClient } from '@fitnessapp/db';
import { describe, expect, it } from 'vitest';

import { planPersonRows, testBackend, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { createMemoryStore, STORAGE_KEYS, type KeyValueStore } from './kv';
import { pruneExpiredNutritionWeeks, storedMealPlanRow } from './meal-plan-rows';
import { computeNutritionWeek, nutritionWeekStart } from './nutrition-plan';
import {
  applyNutritionQueue,
  checkedOnlyChanges,
  customMealRowsFromDb,
  type DbMealPlan,
  type DbMealPlanItem,
  enqueueNutritionOp,
  foodLogRowsFromDb,
  mealPlanPayloadInputs,
  mealPlanRowsFromDb,
  NUTRITION_QUEUE_MAX_ATTEMPTS,
  NutritionQueue,
  type NutritionQueueEntry,
  nutritionLibraryFromDb,
  shoppingListRowsFromDb,
  withPreservedPastItems,
} from './nutrition-sync';
import { createMemoryProtectedStore } from './protected-store';
import {
  createSupabaseBackend,
  nutritionSendErrorResult,
  toMealPlanSaveError,
} from './supabase-backend';
import type { FoodLogEntryRow, MealPlanRow, UserRows } from './types';

const WEEK = nutritionWeekStart(TODAY); // Montag 28.09.2026; TODAY = Samstag 03.10.2026
const NOW = '2026-10-03T10:00:00.000Z';

function demoLibrary() {
  const demo = demoNutritionContent();
  return selectNutritionContent(validateContent(demo.files, { nutritionCatalog: demo.catalog }), {
    allowDrafts: true,
  });
}
const LIBRARY = demoLibrary();

function personRows(consent: 'valid' | 'none' = 'valid'): UserRows {
  const base = planPersonRows({ consent, goal: 'fat_loss', flags: [] });
  return {
    ...base,
    profile: base.profile ? { ...base.profile, sex: 'female' } : null,
    nutritionPrefs: {
      user_id: USER_ID,
      diet_type: 'vegetarian',
      eats_pork: null,
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

function week(data: UserRows) {
  const result = computeNutritionWeek({
    rows: data,
    versions: VERSIONS,
    today: TODAY,
    weekStart: WEEK,
    library: LIBRARY,
    allowDrafts: true,
  });
  if (result.kind !== 'ready' || result.plan === null || result.planState === null) {
    throw new Error('Plan erwartet');
  }
  return result;
}

function recordOf(plan: MealPlanWeek, rows: UserRows, uses = plan.usesHealthData): MealPlanRecord {
  const inputs = mealPlanPayloadInputs(rows);
  if (inputs === null) throw new Error('Angaben erwartet');
  return { usesHealthData: uses, payload: toMealPlanPayload(plan, inputs) };
}

function dbRows(
  record: MealPlanRecord,
  id = 'plan-1',
): { plan: DbMealPlan; items: DbMealPlanItem[] } {
  const { payload } = record;
  return {
    plan: {
      id,
      user_id: USER_ID,
      week_start: payload.week_start,
      engine_version: payload.engine_version,
      variant: payload.variant,
      meal_prep_plan_id: payload.meal_prep_plan_id,
      inputs: payload.inputs,
      uses_health_data: record.usesHealthData,
      auto_adjusted: false,
      recipes_changed: false,
      cook_day_started_at: null,
      created_at: NOW,
    },
    items: payload.items.map((item) => ({ ...item, plan_id: id })),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Datenbank → App
// ---------------------------------------------------------------------------------------------------------

describe('Essenspläne aus der Datenbank (G-N7-1, H5)', () => {
  const data = personRows();
  const plan = week(data).plan as MealPlanWeek;
  const record = recordOf(plan, data);

  it('vollständiger Plan nur, wenn der geschützte Speicher GENAU diese Zeilen hat; sonst nur die Zeilen', () => {
    const { plan: row, items } = dbRows(record);
    const withCache = mealPlanRowsFromDb([row], items, new Map([[WEEK, plan]]), TODAY);
    expect(withCache[0]?.plan).toEqual(plan);
    expect(withCache[0]?.record).toEqual(record);
    const without = mealPlanRowsFromDb([row], items, new Map(), TODAY);
    expect(without[0]?.plan).toBeNull();
    // Anderer Stand (z. B. auf einem anderen Gerät getauscht): Zeilen gewinnen.
    const changed = items.map((item, i) =>
      i === 0 ? { ...item, factor: item.factor === 1 ? 1.25 : 1 } : item,
    );
    expect(mealPlanRowsFromDb([row], changed, new Map([[WEEK, plan]]), TODAY)[0]?.plan).toBeNull();
  });

  it('ungültige Zeilen (Zod) gelten als nicht vorhanden; Wochen außerhalb der Löschfrist werden nicht übernommen', () => {
    const { plan: row, items } = dbRows(record);
    expect(
      mealPlanRowsFromDb(
        [row],
        items.map((item) => ({ ...item, kcal: -5 })),
        new Map(),
        TODAY,
      ),
    ).toEqual([]);
    expect(
      mealPlanRowsFromDb([{ ...row, inputs: { diet: 'vegetarian' } }], items, new Map(), TODAY),
    ).toEqual([]);
    const old = { ...row, week_start: '2026-08-24' };
    expect(mealPlanRowsFromDb([old], [], new Map(), TODAY)).toEqual([]);
    const kept = { ...row, week_start: '2026-08-31' };
    expect(mealPlanRowsFromDb([kept], [], new Map(), TODAY).map((r) => r.week_start)).toEqual([
      '2026-08-31',
    ]);
  });

  it('Rekonstruktion: ohne vollständigen Plan baut computeNutritionWeek ihn aus den Zeilen – gespeichert, kein Neuplanen', () => {
    const { plan: row, items } = dbRows(record);
    const rows = { ...data, mealPlans: mealPlanRowsFromDb([row], items, new Map(), TODAY) };
    const result = week(rows);
    expect(result.planState?.action).toBe('stored');
    expect(result.plan?.days.map((d) => d.meals)).toEqual(plan.days.map((d) => d.meals));
    expect(result.unavailableMeals).toEqual([]);
  });

  it('H9: Rezept eines vergangenen Tages nicht mehr verfügbar → „Rezept nicht mehr verfügbar“, beim Speichern behalten', () => {
    const { plan: row, items } = dbRows(record);
    const pastItem = items.find((item) => item.date < TODAY);
    if (!pastItem) throw new Error('vergangene Mahlzeit erwartet');
    const library = {
      ...LIBRARY,
      recipes: LIBRARY.recipes.filter((r) => r.id !== pastItem.recipe_id),
    };
    const rows = { ...data, mealPlans: mealPlanRowsFromDb([row], items, new Map(), TODAY) };
    const result = computeNutritionWeek({
      rows,
      versions: VERSIONS,
      today: TODAY,
      weekStart: WEEK,
      library,
      allowDrafts: true,
    });
    if (result.kind !== 'ready' || result.plan === null) throw new Error('Plan erwartet');
    expect(result.unavailableMeals).toContainEqual(
      expect.objectContaining({
        date: pastItem.date,
        slot: pastItem.slot,
        titleDe: pastItem.title_de,
      }),
    );
    // Beim Speichern kommen die vergangenen Zeilen unverändert wieder mit.
    const payload = toMealPlanPayload(result.plan, mealPlanPayloadInputs(rows)!);
    const merged = withPreservedPastItems(payload, rows.mealPlans[0]?.record, TODAY);
    expect(merged.items).toContainEqual(
      expect.objectContaining({ date: pastItem.date, slot: pastItem.slot }),
    );
    expect(merged.items.filter((i) => i.date >= TODAY)).toEqual(
      payload.items.filter((i) => i.date >= TODAY),
    );
    // Ohne Zeilen bzw. andere Woche: unverändert.
    expect(withPreservedPastItems(payload, undefined, TODAY)).toBe(payload);
  });
});

describe('Einkaufsliste, Tagebuch, eigene Gerichte, Bestand aus der Datenbank', () => {
  it('Einkaufsliste: Rundweg über die Zeilen; ungültig → nicht vorhanden', () => {
    const data = personRows();
    const result = week(data);
    const list = result.shopping?.list;
    if (!list) throw new Error('Liste erwartet');
    const payload = toShoppingListPayload(list);
    const rows = shoppingListRowsFromDb(
      [
        {
          id: 'l-1',
          user_id: USER_ID,
          week_start: payload.week_start,
          from_date: payload.from_date,
          to_date: payload.to_date,
          plan_key: payload.plan_key,
          added_recipes: payload.recipes,
          uses_health_data: true,
          created_at: NOW,
          updated_at: NOW,
        },
      ],
      payload.items.map((item) => ({ ...item, list_id: 'l-1' })),
      TODAY,
    );
    expect(rows[0]?.list.items).toEqual(list.items);
    // Gesundheitsbezug = Wert des Servers.
    expect(rows[0]?.uses_health_data).toBe(true);
    expect(rows[0]?.list.usesHealthData).toBe(true);
    expect(
      shoppingListRowsFromDb(
        [
          {
            id: 'l-2',
            user_id: USER_ID,
            week_start: payload.week_start,
            from_date: payload.week_start,
            to_date: '2030-01-01',
            plan_key: 'k',
            added_recipes: [],
            uses_health_data: false,
            created_at: NOW,
            updated_at: NOW,
          },
        ],
        [],
        TODAY,
      ),
    ).toEqual([]);
  });

  it('Tagebuch und eigene Gerichte: Zeilen erneut geprüft (Zod), Unbekanntes bleibt weg', () => {
    const entry = {
      id: '00000000-0000-4000-8000-0000000000e1',
      eaten_on: TODAY,
      slot: 'other',
      source: 'quick',
      food_id: null,
      recipe_id: null,
      custom_meal_id: null,
      product_code: null,
      user_product_id: null,
      title_de: 'Snack',
      amount: null,
      unit: null,
      portion: null,
      kcal: 200,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      user_id: USER_ID,
      revision: 2,
      last_write_id: '00000000-0000-4000-8000-0000000000f1',
      created_at: NOW,
      updated_at: NOW,
    };
    expect(foodLogRowsFromDb([entry])).toEqual([entry]);
    expect(foodLogRowsFromDb([{ ...entry, title_de: 'Freitext' }])).toEqual([]);
    expect(foodLogRowsFromDb([{ ...entry, extra: 1 }])).toEqual([]);
    const meal = {
      id: '00000000-0000-4000-8000-0000000000c1',
      name_de: 'Mein Müsli',
      mode: 'direct',
      servings: 1,
      kcal: 400,
      protein_g: 10,
      carbs_g: 60,
      fat_g: 8,
      user_id: USER_ID,
      revision: 1,
      last_write_id: '00000000-0000-4000-8000-0000000000f2',
      created_at: NOW,
      updated_at: NOW,
    };
    const result = customMealRowsFromDb([meal], []);
    expect(result.customMeals.map((m) => m.id)).toEqual([meal.id]);
    expect(customMealRowsFromDb([{ ...meal, name_de: ' Rand' }], []).customMeals).toEqual([]);
  });

  it('Bestand: data → validateContent → selectNutritionContent (nur freigegeben), R17/R18 beim Einspielen geprüft', () => {
    const demo = demoNutritionContent();
    const release = (data: unknown) => ({
      ...(data as Record<string, unknown>),
      status: 'published',
      meta: {
        ...(data as { meta: object }).meta,
        expert_reviewed: true,
        reviewed_by: 'redaktion',
        reviewed_at: '2026-10-15',
        ...('catalog_reviewed_by' in (data as { meta: object }).meta
          ? { catalog_reviewed_by: 'redaktion', catalog_reviewed_at: '2026-10-15' }
          : {}),
      },
    });
    const of = (kind: string) =>
      demo.files
        .filter((f) => f.kind === kind)
        .map((f) => ({ id: f.fileName.replace('.json', ''), data: release(f.data) }));
    const library = nutritionLibraryFromDb({
      foods: of('food'),
      recipes: of('recipe'),
      ingredient_substitutions: of('ingredient_substitution'),
      food_package_sizes: of('package_size'),
      meal_prep_plans: of('meal_prep_plan'),
      guides: of('guide'),
    });
    expect(library.recipes.length).toBeGreaterThan(0);
    expect(library.recipes.every((r) => r.status === 'published')).toBe(true);
    // Entwürfe (falls die Datenbank je einen lieferte) nie.
    const drafts = nutritionLibraryFromDb({
      foods: of('food'),
      recipes: demo.files
        .filter((f) => f.kind === 'recipe')
        .map((f) => ({ id: f.fileName.replace('.json', ''), data: f.data })),
      ingredient_substitutions: [],
      food_package_sizes: [],
      meal_prep_plans: [],
      guides: [],
    });
    expect(drafts.recipes).toEqual([]);
  });

  it('nur Häkchen geändert? (dann Abhaken statt ganze Liste)', () => {
    const list = week(personRows()).shopping?.list;
    if (!list || list.items.length === 0) throw new Error('Liste erwartet');
    const first = list.items[0]!;
    const checked = {
      ...list,
      items: list.items.map((i) => (i === first ? { ...i, checked: !i.checked } : i)),
    };
    expect(checkedOnlyChanges(list, checked)).toEqual([
      { itemKey: first.itemKey, checked: !first.checked },
    ]);
    expect(checkedOnlyChanges(list, list)).toEqual([]);
    expect(checkedOnlyChanges(list, { ...checked, from: list.to })).toBeNull();
    expect(
      checkedOnlyChanges(list, {
        ...list,
        items: list.items.map((i) => (i === first ? { ...i, labelDe: 'x' } : i)),
      }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------
// Ernährungs-Warteschlange
// ---------------------------------------------------------------------------------------------------------

const ENTRY = {
  id: '00000000-0000-4000-8000-0000000000e1',
  eaten_on: TODAY,
  slot: 'other' as const,
  source: 'quick' as const,
  food_id: null,
  recipe_id: null,
  custom_meal_id: null,
  product_code: null,
  user_product_id: null,
  title_de: 'Snack',
  amount: null,
  unit: null,
  portion: null,
  kcal: 200,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
};

describe('Ernährungs-Warteschlange (Tagebuch und eigene Gerichte offline)', () => {
  it('neuere Fassung ersetzt die ältere und behält die bestätigte Basis; Löschen eines nie gesendeten Eintrags entfernt beide', () => {
    let entries: NutritionQueueEntry[] = [];
    entries = enqueueNutritionOp(entries, {
      kind: 'food_log_save',
      entry: ENTRY,
      writeId: 'w1',
      baseRevision: 3,
    });
    entries = enqueueNutritionOp(entries, {
      kind: 'food_log_save',
      entry: { ...ENTRY, kcal: 250 },
      writeId: 'w2',
      baseRevision: 9,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.op).toMatchObject({ writeId: 'w2', baseRevision: 3 });
    entries = enqueueNutritionOp(entries, {
      kind: 'food_log_delete',
      id: ENTRY.id,
      baseRevision: 9,
    });
    expect(entries).toEqual([
      {
        key: `food_log:${ENTRY.id}`,
        op: { kind: 'food_log_delete', id: ENTRY.id, baseRevision: 3 },
      },
    ]);
    let fresh: NutritionQueueEntry[] = enqueueNutritionOp([], {
      kind: 'food_log_save',
      entry: ENTRY,
      writeId: 'w1',
      baseRevision: null,
    });
    fresh = enqueueNutritionOp(fresh, { kind: 'food_log_delete', id: ENTRY.id, baseRevision: 1 });
    expect(fresh).toEqual([]);
  });

  it('Anzeige: wartende Fassungen über dem Server-Stand (Revision = Basis), Löschen entfernt', () => {
    const rows = personRows();
    const entries = enqueueNutritionOp([], {
      kind: 'food_log_save',
      entry: ENTRY,
      writeId: 'w1',
      baseRevision: null,
    });
    const shown = applyNutritionQueue(rows, entries, { userId: USER_ID, now: NOW });
    expect(shown.foodLogEntries).toEqual([
      expect.objectContaining({ id: ENTRY.id, revision: 0, last_write_id: 'w1', kcal: 200 }),
    ]);
    const removed = applyNutritionQueue(
      shown,
      [{ key: 'x', op: { kind: 'food_log_delete', id: ENTRY.id, baseRevision: 1 } }],
      { userId: USER_ID, now: NOW },
    );
    expect(removed.foodLogEntries).toEqual([]);
  });

  it('Senden: erledigt, später erneut (Netz), vorübergehend bis zur Höchstzahl, abgelehnt → lokal behalten; fremdes Konto', async () => {
    const store = createMemoryProtectedStore();
    let next: 'done' | 'retry' | 'transient' | 'rejected' = 'retry';
    const queue = new NutritionQueue({
      store,
      currentUserId: () => USER_ID,
      send: async () =>
        next === 'rejected' ? { kind: 'rejected', reason: 'conflict' } : { kind: next },
    });
    await queue.add(
      { kind: 'food_log_save', entry: ENTRY, writeId: 'w1', baseRevision: null },
      USER_ID,
    );
    // Verschlüsselter Speicher – nicht der normale Zwischenspeicher.
    expect(store.peek()).toContain('Snack');
    expect(await queue.flush()).toBe('later');
    expect(queue.size()).toBe(1);
    next = 'transient';
    for (let i = 1; i < NUTRITION_QUEUE_MAX_ATTEMPTS; i += 1) await queue.flush();
    expect(queue.size()).toBe(1);
    await queue.flush();
    expect(queue.size()).toBe(0);
    expect(queue.rejected()).toEqual([
      expect.objectContaining({ key: `food_log:${ENTRY.id}`, reason: 'not_transferred' }),
    ]);
    next = 'rejected';
    await queue.add({ kind: 'custom_meal_delete', id: 'm1' }, USER_ID);
    await queue.flush();
    expect(queue.rejected()).toHaveLength(2);
    await queue.discardRejected();
    expect(queue.rejected()).toEqual([]);
    next = 'done';
    await queue.add({ kind: 'custom_meal_delete', id: 'm2' }, USER_ID);
    expect(await queue.flush()).toBe('done');
    // Anderes Konto: nichts senden, nichts dazulegen (R5).
    next = 'retry';
    await queue.add({ kind: 'custom_meal_delete', id: 'm3' }, USER_ID);
    const foreign = new NutritionQueue({
      store,
      currentUserId: () => 'anderes-konto',
      send: async () => ({ kind: 'done' }),
    });
    expect(await foreign.flush()).toBe('later');
    expect(await foreign.hasForeign('anderes-konto')).toBe(true);
    await expect(
      foreign.add({ kind: 'custom_meal_delete', id: 'm4' }, 'anderes-konto'),
    ).rejects.toThrow();
  });

  it('Fehler ohne Werte: Einwilligung fehlt → abgelehnt; Netz → später; Rest → abgelehnt bzw. vorübergehend', () => {
    expect(
      nutritionSendErrorResult({ code: '42501', message: 'Einwilligung Gesundheitsdaten fehlt.' }),
    ).toEqual({
      kind: 'rejected',
      reason: 'consent_required',
    });
    expect(nutritionSendErrorResult({ message: 'TypeError: Failed to fetch' })).toEqual({
      kind: 'retry',
    });
    expect(nutritionSendErrorResult({ code: '57014', message: 'timeout' })).toEqual({
      kind: 'transient',
    });
    expect(nutritionSendErrorResult({ code: '22023', message: 'Ungültige Werte' })).toEqual({
      kind: 'rejected',
      reason: 'invalid',
    });
    expect(
      toMealPlanSaveError({
        code: '42501',
        message: 'Für diesen Essensplan fehlt die Einwilligung.',
      }).code,
    ).toBe('consent_required');
    expect(
      toMealPlanSaveError({
        code: '22023',
        message:
          'Der Essensplan liegt an einem Tag unter deinem Grundumsatz – bitte neu erstellen.',
      }).code,
    ).toBe('plan_rejected');
    expect(toMealPlanSaveError({ message: 'Failed to fetch' }).code).toBe('network');
    expect(
      toMealPlanSaveError({
        code: '57014',
        message: 'canceling statement due to statement timeout',
      }).code,
    ).toBe('temporary');
  });
});

// ---------------------------------------------------------------------------------------------------------
// Supabase-Backend (Ersatz-Client)
// ---------------------------------------------------------------------------------------------------------

interface Call {
  table: string;
  chain: string[];
  args: unknown[][];
}

function fakeClient(
  respond: (call: Call) => {
    data?: unknown;
    error?: unknown;
    status?: number;
    /** Antwort erst, wenn dieses Versprechen erfüllt ist (hängendes Senden nachstellen). */
    wait?: Promise<void>;
  } = () => ({}),
) {
  const calls: Call[] = [];
  const builder = (call: Call): unknown =>
    new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === 'then') {
            const { wait, ...answer } = respond(call);
            const result = { data: null, error: null, ...answer };
            return (resolve: (value: unknown) => void) =>
              wait === undefined ? resolve(result) : void wait.then(() => resolve(result));
          }
          return (...args: unknown[]) => {
            call.chain.push(prop);
            call.args.push(args);
            return builder(call);
          };
        },
      },
    );
  const client = {
    from: (table: string) => {
      const call: Call = { table, chain: [], args: [] };
      calls.push(call);
      return builder(call);
    },
    rpc: (name: string, args: unknown) => {
      const call: Call = { table: `rpc:${name}`, chain: [], args: [[args]] };
      calls.push(call);
      return builder(call);
    },
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: USER_ID, email: 'a@b.de' } } },
        error: null,
      }),
      signOut: async () => ({ error: null }),
    },
  };
  return { client: client as unknown as AppSupabaseClient, calls };
}

const networkError = { message: 'TypeError: Failed to fetch', code: '', details: '', hint: '' };

function seededStore(): KeyValueStore & { dump(): Record<string, string> } {
  return createMemoryStore({
    [STORAGE_KEYS.documentsCache]: JSON.stringify(
      (['terms', 'privacy', 'health_data'] as const).map((type) => ({
        type,
        version: VERSIONS[type],
        title: type,
        body: '…',
      })),
    ),
  });
}

function backendWith(respond: Parameters<typeof fakeClient>[0], store = seededStore()) {
  const { client, calls } = fakeClient(respond);
  const nutritionCacheStore = createMemoryProtectedStore();
  const nutritionQueueStore = createMemoryProtectedStore();
  const backend = createSupabaseBackend({
    client,
    store,
    platform: 'web',
    now: () => NOW,
    newId: () => '00000000-0000-4000-8000-0000000000aa',
    nutritionCacheStore,
    nutritionQueueStore,
  });
  return { backend, calls, store, nutritionCacheStore, nutritionQueueStore };
}

describe('Supabase-Backend: Essensplan und Einkaufsliste (N7 Teil 2)', () => {
  const data = personRows();
  const result = week(data);
  const plan = result.plan as MealPlanWeek;

  it('save_meal_plan mit der Payload (Angaben ohne Gesundheitsdaten), Gesundheitsbezug vom Server, Liste im selben Schritt', async () => {
    const { backend, calls, store, nutritionCacheStore } = backendWith((call) => {
      if (call.table === 'rpc:save_meal_plan') return { data: 'plan-1' };
      if (call.table === 'rpc:replace_shopping_list') return { data: 'list-1' };
      if (call.chain.includes('maybeSingle')) return { data: { uses_health_data: true } };
      return {};
    });
    const list = result.shopping?.list;
    const next = await backend.saveMealPlan(plan, { autoAdjusted: true, shoppingList: list }, data);
    const save = calls.find((c) => c.table === 'rpc:save_meal_plan');
    const args = save?.args[0]?.[0] as {
      p_plan: { inputs: unknown; items: unknown[] };
      p_auto_adjusted: boolean;
    };
    expect(args.p_auto_adjusted).toBe(true);
    expect(args.p_plan.inputs).toEqual({
      diet: 'vegetarian',
      meals_per_day: 4,
      cooking_mode: 'daily',
      mealprep_days: null,
      mealprep_slots: 'lunch',
    });
    expect(JSON.stringify(args.p_plan)).not.toMatch(/weight|intoler|band|safetyKey/);
    expect(calls.some((c) => c.table === 'rpc:replace_shopping_list')).toBe(true);
    const row = storedMealPlanRow(next, WEEK);
    expect(row).toMatchObject({ id: 'plan-1', uses_health_data: true });
    expect(row?.plan).toEqual(plan);
    expect(row?.record?.payload.week_start).toBe(WEEK);
    // Datenschutz: Plan nur im geschützten Speicher, nie im normalen Zwischenspeicher.
    expect(store.dump()[STORAGE_KEYS.rowsCache] ?? '').not.toContain(
      plan.days[0]?.meals[0]?.titleDe ?? 'xx',
    );
    expect((nutritionCacheStore as { peek(): string | null }).peek()).toContain('plan-1');
  });

  it('Fehler: Einwilligung fehlt → consent_required (H3), G-W3/Filter → plan_rejected, offline → network', async () => {
    for (const [error, code] of [
      [
        { code: '42501', message: 'Für diesen Essensplan fehlt die Einwilligung.' },
        'consent_required',
      ],
      [
        {
          code: '22023',
          message:
            'Der Essensplan liegt an einem Tag unter deinem Grundumsatz – bitte neu erstellen.',
        },
        'plan_rejected',
      ],
      [networkError, 'network'],
    ] as const) {
      const { backend } = backendWith((call) =>
        call.table === 'rpc:save_meal_plan' ? { error } : {},
      );
      await expect(backend.saveMealPlan(plan, { autoAdjusted: false }, data)).rejects.toMatchObject(
        {
          code,
          sensitive: true,
        },
      );
    }
  });

  it('H3/K-c: Einwilligung ungültig und gespeicherter Plan mit Gesundheitsbezug → erst löschen, dann ohne Gesundheitsdaten speichern', async () => {
    const without = personRows('none');
    const plain = week(without).plan as MealPlanWeek;
    const stored: MealPlanRow = {
      id: 'old-plan',
      user_id: USER_ID,
      week_start: WEEK,
      uses_health_data: true,
      created_at: NOW,
      auto_adjusted: false,
      recipes_changed: false,
      cook_day_started_at: null,
      plan: null,
      record: recordOf(plan, data, true),
    };
    const { backend, calls } = backendWith((call) =>
      call.table === 'rpc:save_meal_plan' ? { data: 'plan-2' } : {},
    );
    await backend.saveMealPlan(plain, { autoAdjusted: false }, { ...without, mealPlans: [stored] });
    const tables = calls.map((c) => `${c.table}:${c.chain[0] ?? ''}`);
    expect(tables.indexOf('meal_plans:delete')).toBeGreaterThanOrEqual(0);
    expect(tables.indexOf('meal_plans:delete')).toBeLessThan(tables.indexOf('rpc:save_meal_plan:'));
    // Mit gültiger Einwilligung nie.
    const ok = backendWith((call) => (call.table === 'rpc:save_meal_plan' ? { data: 'p' } : {}));
    await ok.backend.saveMealPlan(plan, { autoAdjusted: false }, { ...data, mealPlans: [stored] });
    expect(ok.calls.some((c) => c.table === 'meal_plans' && c.chain[0] === 'delete')).toBe(false);
  });

  it('Abhaken: nur die Spalte checked – ohne Gesundheitsbezug offline über die Warteschlange, mit Gesundheitsbezug sofort', async () => {
    const list = result.shopping?.list;
    if (!list || list.items.length === 0) throw new Error('Liste erwartet');
    const first = list.items[0]!;
    const toggled = {
      ...list,
      items: list.items.map((i) => (i === first ? { ...i, checked: true } : i)),
    };
    const listRow = (uses: boolean) => ({
      id: 'list-1',
      user_id: USER_ID,
      week_start: WEEK,
      uses_health_data: uses,
      created_at: NOW,
      updated_at: NOW,
      list: {
        ...list,
        usesHealthData: uses,
        items: list.items.map((i) => ({ ...i, checked: false })),
      },
    });
    const plainRows: UserRows = { ...personRows('none'), shoppingLists: [listRow(false)] };
    const offline = backendWith(() => ({ error: networkError }));
    const plainToggled = { ...toggled, usesHealthData: false };
    const next = await offline.backend.saveShoppingList(plainToggled, plainRows);
    expect(
      next.shoppingLists[0]?.list.items.find((i) => i.itemKey === first.itemKey)?.checked,
    ).toBe(true);
    expect(offline.backend.pendingChanges()).toBe(1);
    expect(offline.calls.some((c) => c.table === 'rpc:replace_shopping_list')).toBe(false);
    // Mit Gesundheitsbezug (Lücke „online_only“ geschlossen, PLAN-EINKAUFEN-AUSDAUER 3): offline in die
    // VERSCHLÜSSELTE Ernährungs-Warteschlange – nie in den normalen Speicher.
    const healthRows: UserRows = { ...data, shoppingLists: [listRow(true)] };
    const queued = backendWith(() => ({ error: networkError }));
    const queuedNext = await queued.backend.saveShoppingList(
      { ...toggled, usesHealthData: true },
      healthRows,
    );
    expect(
      queuedNext.shoppingLists[0]?.list.items.find((i) => i.itemKey === first.itemKey)?.checked,
    ).toBe(true);
    expect(queued.backend.pendingChanges()).toBe(1);
    expect(JSON.stringify(queued.store.dump())).not.toContain(first.itemKey);
    expect(queued.calls.some((c) => c.table === 'rpc:replace_shopping_list')).toBe(false);
    // Online: Liste der Woche suchen, dann Update genau dieser Zeile (vorhandener Schreibweg).
    const online = backendWith((call) =>
      call.table === 'shopping_lists'
        ? { data: { id: 'list-1' } }
        : call.table === 'shopping_list_items'
          ? { data: [{ item_key: first.itemKey }] }
          : {},
    );
    await online.backend.saveShoppingList({ ...toggled, usesHealthData: true }, healthRows);
    await expect.poll(() => online.calls.some((c) => c.table === 'shopping_list_items')).toBe(true);
    const update = online.calls.find((c) => c.table === 'shopping_list_items');
    expect(update?.chain).toEqual(['update', 'eq', 'eq', 'select']);
    expect(update?.args[0]).toEqual([{ checked: true }]);
    await expect.poll(() => online.backend.pendingChanges()).toBe(0);
  });

  it('Häkchen-Warteschlange: letzter Stand je Eintrag gewinnt, nur Woche/Schlüssel/Häkchen/Zeit, Anzeige im Speicher-Stand', () => {
    const op = (checked: boolean, at: string) => ({
      kind: 'shopping_check' as const,
      weekStart: WEEK,
      itemKey: 'reis|g',
      checked,
      at,
    });
    let entries: NutritionQueueEntry[] = [];
    entries = enqueueNutritionOp(entries, op(true, NOW));
    entries = enqueueNutritionOp(entries, op(false, NOW));
    entries = enqueueNutritionOp(entries, { ...op(true, NOW), itemKey: 'tofu|g' });
    expect(entries.map((e) => e.key)).toEqual([
      `shopping_check:${WEEK}|reis|g`,
      `shopping_check:${WEEK}|tofu|g`,
    ]);
    expect(entries[0]?.op).toEqual(op(false, NOW));
    const list = result.shopping?.list;
    if (!list) throw new Error('Liste erwartet');
    const key = list.items[0]?.itemKey ?? '';
    const rows: UserRows = {
      ...data,
      shoppingLists: [
        {
          id: 'list-1',
          user_id: USER_ID,
          week_start: WEEK,
          uses_health_data: true,
          created_at: NOW,
          updated_at: NOW,
          list,
        },
      ],
    };
    const shown = applyNutritionQueue(
      rows,
      [
        { key: 'x', op: { ...op(true, NOW), itemKey: key } },
        { key: 'y', op: { ...op(true, NOW), itemKey: 'fehlt|g' } },
      ],
      { userId: USER_ID, now: NOW },
    );
    expect(shown.shoppingLists[0]?.list.items.find((i) => i.itemKey === key)?.checked).toBe(true);
    // Verschwundener Eintrag: nichts passiert (kein neuer Eintrag).
    expect(shown.shoppingLists[0]?.list.items).toHaveLength(list.items.length);
  });
});

describe('Supabase-Backend: Ernährungstagebuch über die Warteschlange (E1 mit N7 Teil 2)', () => {
  const data = personRows();

  it('online: save_food_log_entries mit write_id und Basis; Ergebnis „gespeichert“ → neu geladen', async () => {
    const saved: FoodLogEntryRow = {
      ...ENTRY,
      user_id: USER_ID,
      revision: 1,
      last_write_id: '00000000-0000-4000-8000-0000000000aa',
      created_at: NOW,
      updated_at: NOW,
    };
    const { backend, calls, store } = backendWith((call) => {
      if (call.table === 'rpc:save_food_log_entries') {
        return { data: [{ result: 'saved', id: ENTRY.id, revision: 1 }] };
      }
      if (call.table === 'food_log_entries') return { data: [saved] };
      return { data: [] };
    });
    const next = await backend.saveFoodLogEntries([ENTRY], data);
    const call = calls.find((c) => c.table === 'rpc:save_food_log_entries');
    expect(call?.args[0]?.[0]).toEqual({
      p_entries: [
        { ...ENTRY, write_id: '00000000-0000-4000-8000-0000000000aa', base_revision: null },
      ],
    });
    expect(next.foodLogEntries).toEqual([saved]);
    expect(await backend.nutritionSync()).toMatchObject({ queued: 0, rejected: 0 });
    // Tagebuch nie im normalen Zwischenspeicher.
    expect(JSON.stringify(store.dump())).not.toContain('Snack');
  });

  it('offline: verschlüsselt eingereiht, angezeigt, später gesendet; abgelehnt im Hintergrund → bleibt lokal mit Hinweis', async () => {
    let online = false;
    let answer: unknown = [{ result: 'conflict', reason: 'revision', id: ENTRY.id, revision: 4 }];
    const { backend, store, nutritionQueueStore } = backendWith((call) => {
      if (!online) return { error: networkError };
      if (call.table === 'rpc:save_food_log_entries') return { data: answer };
      return { data: [] };
    });
    const next = await backend.saveFoodLogEntries([ENTRY], data);
    expect(next.foodLogEntries.map((e) => e.id)).toEqual([ENTRY.id]);
    expect(backend.pendingChanges()).toBe(1);
    expect(await backend.nutritionSync()).toMatchObject({ queued: 1, rejected: 0 });
    expect((nutritionQueueStore as { peek(): string | null }).peek()).toContain('Snack');
    expect(JSON.stringify(store.dump())).not.toContain('Snack');
    online = true;
    await backend.flush();
    expect(await backend.nutritionSync()).toMatchObject({ queued: 0, rejected: 1 });
    await backend.discardRejectedNutrition();
    expect(await backend.nutritionSync()).toMatchObject({ queued: 0, rejected: 0 });
    // Sofort abgelehnt (online): Meldung ohne Werte, nicht zusätzlich als Hinweis.
    answer = [{ result: 'rejected', code: 'day_full' }];
    await expect(backend.saveFoodLogEntries([ENTRY], data)).rejects.toMatchObject({
      code: 'food_log_day_full',
      sensitive: true,
    });
    expect(await backend.nutritionSync()).toMatchObject({ queued: 0, rejected: 0 });
  });

  it('ohne Einwilligung (Prüfung wie im Testmodus) → consent_required, nichts eingereiht', async () => {
    const { backend } = backendWith(() => ({}));
    await expect(backend.saveFoodLogEntries([ENTRY], personRows('none'))).rejects.toMatchObject({
      code: 'consent_required',
    });
    expect(backend.pendingChanges()).toBe(0);
  });

  it('Laden: Tagebuch, Favoriten, eigene Gerichte, Pläne und Listen aus der Datenbank (Löschfrist als Filter); Körperdaten je Feld', async () => {
    const { backend, calls } = backendWith((call) => ({
      data: call.chain.includes('maybeSingle') ? null : [],
    }));
    await backend.loadRows();
    const plans = calls.find((c) => c.table === 'meal_plans');
    expect(plans?.args).toContainEqual(['week_start', '2026-08-31']);
    const lists = calls.find((c) => c.table === 'shopping_lists');
    expect(lists?.args).toContainEqual(['week_start', '2026-08-31']);
    expect(calls.some((c) => c.table === 'food_log_entries')).toBe(true);
    expect(calls.some((c) => c.table === 'food_log_favorites')).toBe(true);
    expect(calls.some((c) => c.table === 'custom_meals')).toBe(true);
    const metrics = calls.filter((c) => c.table === 'body_metrics');
    expect(metrics.map((c) => c.args.find((a) => a[1] === 'is')?.[0] ?? 'neueste')).toEqual([
      'neueste',
      'height_cm',
      'weight_kg',
      'body_fat_pct',
    ]);
  });

  it('M2: Widerruf während ein Tagebuch-Eintrag gesendet wird → danach liegt nichts mehr auf dem Gerät', async () => {
    let release: () => void = () => undefined;
    const hanging = new Promise<void>((resolve) => {
      release = resolve;
    });
    const consentError = {
      code: '42501',
      message: 'Für das Ernährungstagebuch fehlt die Einwilligung.',
      details: '',
      hint: '',
    };
    const { backend, nutritionQueueStore } = backendWith((call) =>
      call.table.startsWith('rpc:save_food_log')
        ? { error: consentError, wait: hanging }
        : { data: [] },
    );
    const saving = backend.saveFoodLogEntries([ENTRY], data).catch(() => 'abgelehnt');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const revoking = backend.revokeHealthData(false, null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Während der Widerruf läuft, nimmt die Warteschlange nichts Neues an.
    await expect(backend.saveFoodLogEntries([{ ...ENTRY, id: 'x' }], data)).rejects.toThrow();
    release();
    await Promise.all([saving, revoking]);
    expect((nutritionQueueStore as { peek(): string | null }).peek()).toBeNull();
    expect(await backend.nutritionSync()).toMatchObject({ queued: 0, rejected: 0 });
  });

  it('M2: clear() während eines hängenden Sendens → späte Ablehnung wird verworfen, Speicher bleibt leer', async () => {
    const store = createMemoryProtectedStore();
    let release: () => void = () => undefined;
    const queue = new NutritionQueue({
      store,
      currentUserId: () => USER_ID,
      send: () =>
        new Promise((resolve) => {
          release = () => resolve({ kind: 'rejected', reason: 'consent_required' });
        }),
    });
    await queue.add(
      { kind: 'food_log_save', entry: ENTRY, writeId: 'w1', baseRevision: null },
      USER_ID,
    );
    const flushing = queue.flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await queue.clear();
    release();
    await flushing;
    expect(queue.rejected()).toEqual([]);
    expect(queue.size()).toBe(0);
    expect(store.peek()).toBeNull();
    expect(queue.lastResults.size).toBe(0);
  });

  it('Widerruf: Ernährungs-Warteschlange und -Zwischenspeicher gelöscht', async () => {
    const { backend, nutritionQueueStore, nutritionCacheStore } = backendWith((call) =>
      call.table.startsWith('rpc:save_food_log') ? { error: networkError } : { data: [] },
    );
    await backend.saveFoodLogEntries([ENTRY], data);
    expect((nutritionQueueStore as { peek(): string | null }).peek()).toContain('Snack');
    await backend.revokeHealthData(false, null);
    expect((nutritionQueueStore as { peek(): string | null }).peek()).toBeNull();
    expect((nutritionCacheStore as { peek(): string | null }).peek()).toBeNull();
  });
});

describe('Löschfrist im Testmodus (G-N7-2)', () => {
  it('Pläne und Listen älter als 4 Wochen werden beim Laden entfernt; jüngere bleiben', async () => {
    const data = personRows();
    // Je Woche ein echter, zu weekStart passender Plan (der Gerätespeicher prüft Daten und Tage streng).
    const planFor = (weekStart: string): MealPlanWeek => {
      const result = computeNutritionWeek({
        rows: data,
        versions: VERSIONS,
        today: TODAY,
        weekStart,
        library: LIBRARY,
        allowDrafts: true,
      });
      if (result.kind !== 'ready' || result.plan === null) throw new Error('Plan erwartet');
      return result.plan;
    };
    const row = (weekStart: string): MealPlanRow => ({
      id: `p-${weekStart}`,
      user_id: USER_ID,
      week_start: weekStart,
      uses_health_data: false,
      created_at: NOW,
      auto_adjusted: false,
      recipes_changed: false,
      cook_day_started_at: null,
      plan: planFor(weekStart),
    });
    const rows = { ...data, mealPlans: [row('2026-08-24'), row('2026-08-31'), row(WEEK)] };
    const pruned = pruneExpiredNutritionWeeks(rows, TODAY);
    expect(pruned.mealPlans.map((p) => p.week_start)).toEqual(['2026-08-31', WEEK]);
    expect(pruneExpiredNutritionWeeks(pruned, TODAY)).toBe(pruned);
    const { backend, store } = testBackend();
    await store.setItem(
      STORAGE_KEYS.localDb,
      JSON.stringify({ session: { userId: USER_ID, email: null }, rows }),
    );
    const loaded = await backend.loadRows();
    expect(loaded.rows.mealPlans.map((p) => p.week_start)).toEqual(['2026-08-31', WEEK]);
  });
});

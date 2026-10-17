import { readFileSync } from 'node:fs';

import type { SavePlanPayload, SessionLogPayload } from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';
import { describe, expect, it } from 'vitest';

import { consent, NOW, rowsWith, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { createMemoryStore, STORAGE_KEYS } from './kv';
import { answersFromRows } from './mapping';
import { createMemoryProtectedStore, createSessionProtectedStore } from './protected-store';
import {
  classifyLogError,
  classifySupabaseError,
  isTransientError,
  createSupabaseBackend,
  executeWriteOp,
  isMissingFunction,
  isMissingRelation,
  nutritionPrefsFromDb,
  toMoveError,
} from './supabase-backend';
import type { StepSave, UserRows } from './types';
import type { WorkoutDraft } from './workout-draft';

interface Call {
  table: string;
  chain: string[];
  args: unknown[][];
}

/**
 * Minimaler Ersatz für den Supabase-Client: zeichnet alle Aufrufe auf (Tabelle + Methodenkette) und
 * liefert das Ergebnis von `respond` (Standard: kein Fehler).
 */
function fakeClient(
  respond: (call: Call) => { data?: unknown; error?: unknown; status?: number } = () => ({}),
) {
  const calls: Call[] = [];
  const builder = (call: Call): unknown =>
    new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === 'then') {
            const result = { data: null, error: null, ...respond(call) };
            return (resolve: (value: unknown) => void) => resolve(result);
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

describe('classifySupabaseError', () => {
  it('erkennt Netzwerk, Mindestalter, RLS, Code-Fehler und Drosselung', () => {
    expect(classifySupabaseError(networkError)).toBe('network');
    expect(classifySupabaseError({ name: 'AuthRetryableFetchError', message: '' })).toBe('network');
    expect(
      classifySupabaseError({
        code: '23514',
        hint: 'min_age',
        message: 'Die App ist ab 16 Jahren nutzbar.',
      }),
    ).toBe('min_age');
    expect(
      classifySupabaseError(
        { code: '42501', message: 'new row violates row-level security' },
        true,
      ),
    ).toBe('consent_required');
    expect(classifySupabaseError({ code: '42501', message: 'rls' })).toBe('profile_missing');
    expect(
      classifySupabaseError({
        code: 'otp_expired',
        status: 403,
        message: 'Token has expired or is invalid',
      }),
    ).toBe('invalid_code');
    expect(classifySupabaseError({ status: 429, message: 'rate limit' })).toBe('rate_limited');
    expect(classifySupabaseError({ code: '23514', message: 'check' })).toBe('unknown');
  });
});

describe('executeWriteOp', () => {
  it('Upsert mit passendem Konflikt-Schlüssel', async () => {
    const { client, calls } = fakeClient();
    await executeWriteOp(client, USER_ID, {
      kind: 'upsert_body_metrics',
      row: {
        user_id: USER_ID,
        measured_on: TODAY,
        height_cm: 170,
        weight_kg: 70,
        body_fat_pct: null,
        resting_heart_rate_bpm: null,
      },
    });
    expect(calls[0]).toMatchObject({ table: 'body_metrics', chain: ['upsert'] });
    expect(calls[0]?.args[0]?.[1]).toEqual({ onConflict: 'user_id,measured_on' });
  });

  it('Ersetzen von Vorlieben und Geräten: atomar über Datenbank-Funktionen (RPC)', async () => {
    const { client, calls } = fakeClient();
    await executeWriteOp(client, USER_ID, {
      kind: 'replace_food_preferences',
      scope: 'taste',
      rows: [{ user_id: USER_ID, food_group: 'fish', kind: 'like' }],
    });
    await executeWriteOp(client, USER_ID, {
      kind: 'replace_user_equipment',
      location: 'home',
      rows: [
        {
          user_id: USER_ID,
          equipment_id: 'dumbbells',
          location: 'home',
          weights_kg: [2],
          note: null,
          bar_kg: null,
        },
        {
          user_id: USER_ID,
          equipment_id: 'barbell',
          location: 'home',
          weights_kg: [1.25, 2.5],
          note: null,
          bar_kg: 15,
        },
      ],
    });
    await executeWriteOp(client, USER_ID, {
      kind: 'replace_training_slots',
      rows: [
        { user_id: USER_ID, slot_no: 1, weekday: 1, kind: 'endurance', minutes: 30 },
        { user_id: USER_ID, slot_no: 2, weekday: 6, kind: 'strength_home', minutes: 90 },
      ],
    });
    expect(calls.map((c) => c.table)).toEqual([
      'rpc:replace_food_preferences',
      'rpc:replace_user_equipment',
      'rpc:replace_training_slots',
    ]);
    expect(calls[0]?.args[0]?.[0]).toEqual({
      p_scope: 'taste',
      p_items: [{ food_group: 'fish', kind: 'like' }],
    });
    expect(calls[1]?.args[0]?.[0]).toEqual({
      p_location: 'home',
      p_items: [
        { equipment_id: 'dumbbells', weights_kg: [2], note: null, bar_kg: null },
        { equipment_id: 'barbell', weights_kg: [1.25, 2.5], note: null, bar_kg: 15 },
      ],
    });
    // Ohne user_id: die Datenbank-Funktion nimmt immer den angemeldeten Nutzer.
    expect(calls[2]?.args[0]?.[0]).toEqual({
      p_items: [
        { slot_no: 1, weekday: 1, kind: 'endurance', minutes: 30 },
        { slot_no: 2, weekday: 6, kind: 'strength_home', minutes: 90 },
      ],
    });
  });

  it('doppelte Einwilligung (unique index) ist kein Fehler, andere Fehler schon', async () => {
    const duplicate = fakeClient(() => ({ error: { code: '23505', message: 'duplicate' } }));
    await expect(
      executeWriteOp(duplicate.client, USER_ID, {
        kind: 'grant_consent',
        consentType: 'terms',
        version: 1,
        platform: 'ios',
      }),
    ).resolves.toBeUndefined();
    const failing = fakeClient(() => ({ error: networkError }));
    await expect(
      executeWriteOp(failing.client, USER_ID, { kind: 'update_profile', patch: { sex: 'male' } }),
    ).rejects.toBe(networkError);
  });
});

describe('Supabase-Modus: Speichern', () => {
  const rows = rowsWith({
    consents: [consent('terms'), consent('privacy'), consent('health_data')],
  });
  const context = { answers: answersFromRows(rows), rows, versions: VERSIONS };
  const options = (client: AppSupabaseClient, store = createMemoryStore()) => ({
    client,
    store,
    platform: 'web' as const,
    now: () => NOW,
    newId: () => 'id',
  });

  it('Gesundheitsdaten offline → Fehler „Erneut versuchen“, nichts auf dem Gerät', async () => {
    const { client } = fakeClient(() => ({ error: networkError }));
    const store = createMemoryStore();
    const backend = createSupabaseBackend(options(client, store));
    const save: StepSave = {
      step: 'body_metrics',
      value: { heightCm: 170, weightKg: 70 },
      measuredOn: TODAY,
    };
    await expect(backend.saveStep(save, context)).rejects.toMatchObject({
      code: 'network',
      sensitive: true,
    });
    expect(store.dump()[STORAGE_KEYS.syncQueue]).toBeUndefined();
    expect(JSON.stringify(store.dump())).not.toContain('170');
  });

  it('Nicht-Gesundheitsdaten offline → Warteschlange + Zwischenspeicher, kein Fehler', async () => {
    const { client } = fakeClient(() => ({ error: networkError }));
    const store = createMemoryStore();
    const backend = createSupabaseBackend(options(client, store));
    const next = await backend.saveStep(
      { step: 'experience', experienceLevel: 'competitive' },
      context,
    );
    expect(next.profile?.experience_level).toBe('competitive');
    await backend.flush();
    expect(backend.pendingChanges()).toBe(1);
    expect(store.dump()[STORAGE_KEYS.syncQueue]).toContain('competitive');
    expect(store.dump()[STORAGE_KEYS.rowsCache]).toContain('competitive');
  });

  it('Gesundheitsdaten online: sofort gesendet, nie in Warteschlange oder Zwischenspeicher', async () => {
    const { client, calls } = fakeClient();
    const store = createMemoryStore();
    const backend = createSupabaseBackend(options(client, store));
    const next = await backend.saveStep(
      { step: 'body_metrics', value: { heightCm: 170, weightKg: 70 }, measuredOn: TODAY },
      context,
    );
    expect(next.bodyMetrics).toHaveLength(1);
    expect(calls[0]?.table).toBe('body_metrics');
    await backend.flush();
    // Reihenfolge W8: normale Warteschlange → (leere) Tagebuch-Warteschlange → close_missed_sessions().
    expect(calls.map((c) => c.table)).toEqual([
      'body_metrics',
      'profiles',
      'rpc:close_missed_sessions',
    ]);
    expect(JSON.stringify(store.dump())).not.toContain('"height_cm":170');
  });

  it('Widerruf health_data: über revoke_health_data (eine Transaktion, R3) statt update consents', async () => {
    const { client, calls } = fakeClient();
    const backend = createSupabaseBackend(options(client));
    await backend.revokeConsent('health_data');
    expect(calls.some((c) => c.table === 'consents')).toBe(false);
    expect(calls.find((c) => c.table === 'rpc:revoke_health_data')?.args).toEqual([
      [{ p_delete_logs: false }],
    ]);
    await backend.revokeHealthData(true, null);
    expect(calls.filter((c) => c.table === 'rpc:revoke_health_data').at(-1)?.args).toEqual([
      [{ p_delete_logs: true }],
    ]);
  });

  it('Widerruf mit Umwandlung (7.4, R2-K4): erst revoke_health_data, dann „mag ich nicht“ über die Warteschlange', async () => {
    const { client, calls } = fakeClient();
    const store = createMemoryStore();
    const backend = createSupabaseBackend(options(client, store));
    const withIntolerance: UserRows = {
      ...rows,
      foodPreferences: [
        { user_id: USER_ID, food_group: 'peanuts', kind: 'intolerance' },
        { user_id: USER_ID, food_group: 'peanuts', kind: 'like' },
        { user_id: USER_ID, food_group: 'fish', kind: 'like' },
      ],
    };
    await backend.revokeHealthData(false, { rows: withIntolerance });
    await backend.flush();
    const tables = calls.map((c) => c.table);
    const revokeAt = tables.indexOf('rpc:revoke_health_data');
    const convertAt = tables.indexOf('rpc:replace_food_preferences');
    expect(revokeAt).toBeGreaterThanOrEqual(0);
    expect(convertAt).toBeGreaterThan(revokeAt);
    const payload = JSON.stringify(calls[convertAt]?.args);
    expect(payload).toContain('taste');
    expect(payload).toContain('peanuts');
    expect(payload).toContain('dislike');
    expect(payload).not.toContain('intolerance');
    // Nie Unverträglichkeiten auf dem Gerät (Zwischenspeicher, Warteschlange).
    expect(JSON.stringify(store.dump())).not.toContain('intolerance');
  });

  it('Widerruf mit Umwandlung, danach offline (W12, Wächter N4 S1): Vorgang wartet, Anzeige mit Ausschluss und widerrufen', async () => {
    let offline = false;
    const { client, calls } = fakeClient((call) =>
      offline && call.table === 'rpc:replace_food_preferences' ? { error: networkError } : {},
    );
    const store = createMemoryStore();
    const backend = createSupabaseBackend(options(client, store));
    const withIntolerance: UserRows = {
      ...rows,
      foodPreferences: [{ user_id: USER_ID, food_group: 'peanuts', kind: 'intolerance' }],
    };
    offline = true;
    await backend.revokeHealthData(false, { rows: withIntolerance });
    await backend.flush();
    expect(calls.some((c) => c.table === 'rpc:revoke_health_data')).toBe(true);
    expect(backend.pendingChanges()).toBe(1);
    const queued = store.dump()[STORAGE_KEYS.syncQueue] ?? '';
    expect(queued).toContain('peanuts');
    expect(queued).toContain('dislike');
    const cache = JSON.parse(store.dump()[STORAGE_KEYS.rowsCache] ?? '{}') as {
      rows: UserRows;
    };
    expect(cache.rows.foodPreferences).toEqual([
      { user_id: USER_ID, food_group: 'peanuts', kind: 'dislike' },
    ]);
    expect(
      cache.rows.consents.find((c) => c.consent_type === 'health_data')?.revoked_at,
    ).not.toBeNull();
    expect(JSON.stringify(store.dump())).not.toContain('intolerance');
    // Wieder online → die Umwandlung wird gesendet.
    offline = false;
    await backend.flush();
    expect(backend.pendingChanges()).toBe(0);
  });

  it('Widerruf ohne Zustimmung: nichts eingelesen, keine Umwandlung (R2-K4)', async () => {
    const { client, calls } = fakeClient();
    const store = createMemoryStore();
    const backend = createSupabaseBackend(options(client, store));
    await backend.revokeHealthData(false, null);
    await backend.flush();
    expect(calls.some((c) => c.table === 'rpc:replace_food_preferences')).toBe(false);
    expect(backend.pendingChanges()).toBe(0);
  });

  it('Unverträglichkeiten löschen (NK2, N7): eine Datenbank-Funktion samt Plänen mit Gesundheitsbezug, nie Warteschlange; offline → Fehler', async () => {
    const { client, calls } = fakeClient();
    const store = createMemoryStore();
    const backend = createSupabaseBackend(options(client, store));
    await backend.deleteStoredIntolerances();
    expect(calls.map((c) => c.table)).toContain('rpc:delete_stored_intolerances');
    expect(calls.some((c) => c.table === 'food_preferences')).toBe(false);
    expect(backend.pendingChanges()).toBe(0);
    const failing = fakeClient(() => ({ error: networkError }));
    const offline = createSupabaseBackend(options(failing.client, createMemoryStore()));
    await expect(offline.deleteStoredIntolerances()).rejects.toMatchObject({ code: 'online_only' });
    expect(offline.pendingChanges()).toBe(0);
  });

  it('Ernährung im Supabase-Modus seit N7 Teil 2: Schritt nutrition_setup, Bestand aus der Datenbank (R2-S3)', async () => {
    const { client, calls } = fakeClient(() => ({ data: [] }));
    const backend = createSupabaseBackend(options(client));
    expect(backend.supportsNutrition).toBe(true);
    const result = await backend.loadNutritionLibrary({ demo: true });
    // Ohne freigegebene Inhalte (Fachprüfung offen, G-N7-3): leerer Bestand mit klarem Leer-Zustand, nie Beispiele.
    expect(result).toMatchObject({ demo: false, demoAvailable: false, awaitingReview: true });
    expect(result?.library.recipes).toEqual([]);
    for (const table of [
      'foods',
      'recipes',
      'ingredient_substitutions',
      'food_package_sizes',
      'meal_prep_plans',
      'guides',
    ]) {
      const call = calls.find((c) => c.table === table);
      expect(call?.chain, table).toEqual(['select', 'eq']);
      expect(call?.args[1], table).toEqual(['status', 'published']);
    }
  });

  it('N7: Bewertung speichern (Upsert je Rezept), zurücknehmen (Löschen), alle löschen – nur eigene Zeilen', async () => {
    const { client, calls } = fakeClient();
    const store = createMemoryStore();
    const backend = createSupabaseBackend(options(client, store));
    const rows = rowsWith();
    const rated = await backend.saveRecipeRating(
      {
        recipeId: 'overnight-oats',
        rating: { recipeId: 'overnight-oats', value: 'down', reason: 'effort', ratedOn: TODAY },
      },
      rows,
    );
    const upsert = calls.find((c) => c.table === 'recipe_ratings' && c.chain[0] === 'upsert');
    expect(upsert?.args[0]).toEqual([
      {
        user_id: USER_ID,
        recipe_id: 'overnight-oats',
        value: 'down',
        reason: 'effort',
        rated_on: TODAY,
      },
      { onConflict: 'user_id,recipe_id' },
    ]);
    expect(rated.recipeRatings).toHaveLength(1);
    const removed = await backend.saveRecipeRating(
      { recipeId: 'overnight-oats', rating: null },
      rated,
    );
    const del = calls.filter((c) => c.table === 'recipe_ratings' && c.chain[0] === 'delete');
    expect(del.at(-1)?.args).toEqual([[], ['user_id', USER_ID], ['recipe_id', 'overnight-oats']]);
    expect(removed.recipeRatings).toEqual([]);
    await backend.deleteRecipeRatings(rated);
    expect(calls.filter((c) => c.table === 'recipe_ratings').at(-1)?.args).toEqual([
      [],
      ['user_id', USER_ID],
    ]);
    // Nicht vom heutigen Tag bzw. mit Grund bei Daumen hoch: abgelehnt, nichts gesendet.
    const before = calls.length;
    await expect(
      backend.saveRecipeRating(
        {
          recipeId: 'overnight-oats',
          rating: { recipeId: 'overnight-oats', value: 'up', reason: null, ratedOn: '2026-01-01' },
        },
        rows,
      ),
    ).rejects.toMatchObject({ code: 'unknown' });
    expect(calls.length).toBe(before);
  });

  it('N7: „mag ich nicht“ je Lebensmittel atomar ersetzen (replace_food_dislikes); offline → online_only', async () => {
    const { client, calls } = fakeClient();
    const backend = createSupabaseBackend(options(client));
    const next = await backend.saveFoodDislikes(['tofu', 'hafer'], rowsWith());
    const call = calls.find((c) => c.table === 'rpc:replace_food_dislikes');
    expect(call?.args[0]).toEqual([{ p_food_ids: ['hafer', 'tofu'] }]);
    expect(next.foodDislikes).toEqual([
      { user_id: USER_ID, food_id: 'hafer' },
      { user_id: USER_ID, food_id: 'tofu' },
    ]);
    await expect(backend.saveFoodDislikes(['tofu', 'tofu'], rowsWith())).rejects.toMatchObject({
      code: 'unknown',
    });
    const failing = fakeClient(() => ({ error: networkError }));
    const offline = createSupabaseBackend(options(failing.client));
    await expect(offline.saveFoodDislikes(['tofu'], rowsWith())).rejects.toMatchObject({
      code: 'online_only',
    });
  });

  it('N7: nutrition_prefs aus der Datenbank → Ernährungsangaben und Schritt nutrition_setup getrennt (Zod)', () => {
    const base = {
      user_id: USER_ID,
      diet_type: 'vegan' as const,
      eats_pork: null,
      meals_per_day: 3,
      cooking_mode: 'meal_prep' as const,
      mealprep_days: 2,
      created_at: NOW,
      updated_at: NOW,
      activity_level: null,
      training_time: null,
      mealprep_slots: 'lunch' as const,
      show_energy_numbers: true,
      max_prep_minutes_weekday: null,
    };
    expect(nutritionPrefsFromDb(null)).toEqual({ nutritionPrefs: null, nutritionSetup: null });
    const open = nutritionPrefsFromDb(base);
    expect(open.nutritionSetup).toBeNull();
    expect(open.nutritionPrefs).toEqual({
      user_id: USER_ID,
      diet_type: 'vegan',
      eats_pork: null,
      meals_per_day: 3,
      cooking_mode: 'meal_prep',
      mealprep_days: 2,
    });
    const done = nutritionPrefsFromDb({
      ...base,
      activity_level: 'active',
      training_time: 'evening',
      mealprep_slots: 'lunch_dinner',
      show_energy_numbers: false,
    });
    expect(done.nutritionSetup).toEqual({
      user_id: USER_ID,
      activity_level: 'active',
      training_time: 'evening',
      mealprep_slots: 'lunch_dinner',
      show_energy_numbers: false,
    });
  });

  it('N7: Schritt nutrition_setup schreibt die Spalten an nutrition_prefs; ohne Zeile abgelehnt', async () => {
    const { client, calls } = fakeClient((call) =>
      call.table === 'nutrition_prefs' ? { data: [{ user_id: USER_ID }] } : {},
    );
    const row = {
      user_id: USER_ID,
      activity_level: 'light' as const,
      training_time: 'varies' as const,
      mealprep_slots: 'lunch' as const,
      show_energy_numbers: true,
    };
    await executeWriteOp(client, USER_ID, { kind: 'upsert_nutrition_setup', row });
    const call = calls.find((c) => c.table === 'nutrition_prefs');
    expect(call?.chain).toEqual(['update', 'eq', 'select']);
    expect(call?.args[0]).toEqual([
      {
        activity_level: 'light',
        training_time: 'varies',
        mealprep_slots: 'lunch',
        show_energy_numbers: true,
      },
    ]);
    const missing = fakeClient((c) => (c.table === 'nutrition_prefs' ? { data: [] } : {}));
    await expect(
      executeWriteOp(missing.client, USER_ID, { kind: 'upsert_nutrition_setup', row }),
    ).rejects.toMatchObject({ code: 'nutrition_prefs_missing' });
  });

  it('Widerruf anderer Einwilligungen: setzt revoked_at nur bei aktiven Einwilligungen dieser Art', async () => {
    const { client, calls } = fakeClient();
    const backend = createSupabaseBackend(options(client));
    await backend.revokeConsent('privacy');
    const call = calls.find((c) => c.table === 'consents');
    expect(call?.chain).toEqual(['update', 'eq', 'eq', 'is']);
    expect(call?.args).toEqual([
      [{ revoked_at: NOW }],
      ['user_id', USER_ID],
      ['consent_type', 'privacy'],
      ['revoked_at', null],
    ]);
  });

  it('Konto löschen ruft delete_my_account und leert die lokalen Zwischenspeicher', async () => {
    const { client, calls } = fakeClient();
    const store = createMemoryStore({ [STORAGE_KEYS.rowsCache]: '{}' });
    const backend = createSupabaseBackend(options(client, store));
    await backend.deleteAccount();
    expect(calls.some((c) => c.table === 'rpc:delete_my_account')).toBe(true);
    expect(store.dump()).toEqual({});
  });

  it('Einwilligungstexte: online zwischengespeichert, offline der letzte Stand', async () => {
    let online = true;
    const { client, calls } = fakeClient(() => {
      if (!online) {
        return { error: networkError };
      }
      return { data: { consent_type: 'terms', version: 1, title_de: 'Titel', body_de: 'Text' } };
    });
    const store = createMemoryStore();
    const backend = createSupabaseBackend(options(client, store));
    const docs = await backend.loadConsentDocuments();
    // terms, privacy, health_data und (Etappe E3) ai_food_photo.
    expect(docs).toHaveLength(4);
    // N7: ohne current_consent_version (für anon gesperrt) – höchste veröffentlichte Version direkt aus der Tabelle.
    expect(calls.some((c) => c.table.startsWith('rpc:'))).toBe(false);
    const query = calls.find((c) => c.table === 'consent_documents');
    expect(query?.chain).toEqual(['select', 'eq', 'order', 'limit', 'maybeSingle']);
    expect(query?.args[2]).toEqual(['version', { ascending: false }]);
    online = false;
    expect(await backend.loadConsentDocuments()).toEqual(docs);
    // Ohne gespeicherten Stand bleibt es beim Fehler (Bildschirm zeigt „Erneut versuchen“).
    const empty = createSupabaseBackend(options(client, createMemoryStore()));
    await expect(empty.loadConsentDocuments()).rejects.toMatchObject({ code: 'network' });
  });

  it('Wächter N7 S1: Tabellen/Funktion vor db-migrate fehlen → Anmeldung läuft weiter, Löschen meldet „gerade nicht möglich“', async () => {
    expect(isMissingRelation({ code: 'PGRST205' })).toBe(true);
    expect(isMissingRelation({ code: '42P01' })).toBe(true);
    expect(isMissingRelation({ code: '42501' })).toBe(false);
    expect(isMissingFunction({ code: 'PGRST202' })).toBe(true);
    expect(isMissingFunction({ code: '42883' })).toBe(true);
    expect(isMissingFunction(null)).toBe(false);
    const missing = { code: 'PGRST205', message: 'Could not find the table' };
    const { client, calls } = fakeClient((call) => {
      if (call.table === 'recipe_ratings' || call.table === 'food_dislikes')
        return { error: missing };
      if (call.table === 'rpc:delete_stored_intolerances') {
        return { error: { code: 'PGRST202', message: 'Could not find the function' } };
      }
      if (call.table === 'profiles') return { data: rowsWith().profile };
      return { data: call.chain.includes('maybeSingle') ? null : [] };
    });
    const backend = createSupabaseBackend(options(client));
    const result = await backend.loadRows();
    expect(result.offline).toBe(false);
    expect(result.rows.recipeRatings).toEqual([]);
    expect(result.rows.foodDislikes).toEqual([]);
    // N7 Teil 2 Nr. 7: kein Rückfall mehr auf das direkte Löschen (dabei blieben Pläne mit Gesundheitsbezug stehen) –
    // klarer Fehler „Löschen gerade nicht möglich“, nichts halb gelöscht.
    await expect(backend.deleteStoredIntolerances()).rejects.toMatchObject({
      code: 'delete_unavailable',
      sensitive: true,
    });
    expect(calls.some((c) => c.table === 'food_preferences' && c.chain[0] === 'delete')).toBe(
      false,
    );
    // Andere Fehler bleiben Fehler (kein stilles Verschlucken).
    const broken = fakeClient((call) =>
      call.table === 'recipe_ratings' ? { error: { code: '42501', message: 'denied' } } : {},
    );
    await expect(createSupabaseBackend(options(broken.client)).loadRows()).rejects.toBeInstanceOf(
      Error,
    );
  });

  it('Laden offline → zwischengespeicherter Stand ohne Gesundheitsdaten', async () => {
    const { client } = fakeClient(() => ({ error: networkError }));
    const store = createMemoryStore({
      [STORAGE_KEYS.rowsCache]: JSON.stringify({ userId: USER_ID, rows }),
    });
    const backend = createSupabaseBackend(options(client, store));
    const result = await backend.loadRows();
    expect(result.offline).toBe(true);
    expect(result.rows.consents).toHaveLength(3);
  });

  it('Laden offline: Zwischenspeicher älterer App-Versionen wird umgewandelt (upgradeStoredRows)', async () => {
    const { client } = fakeClient(() => ({ error: networkError }));
    const legacy = {
      ...rows,
      trainingSlots: undefined,
      goals: {
        user_id: USER_ID,
        goal_type: 'fat_loss',
        discipline: null,
        target_date: null,
        sessions_per_week: 2,
        minutes_per_session: 30,
        preferred_days: [],
        training_location: 'gym',
      },
      userEquipment: [
        {
          user_id: USER_ID,
          equipment_id: 'barbell',
          location: 'home',
          weights_kg: [5, 50],
          note: null,
        },
      ],
    };
    const store = createMemoryStore({
      [STORAGE_KEYS.rowsCache]: JSON.stringify({ userId: USER_ID, rows: legacy }),
    });
    const backend = createSupabaseBackend(options(client, store));
    const result = await backend.loadRows();
    expect(result.offline).toBe(true);
    expect(result.rows.goals).not.toHaveProperty('sessions_per_week');
    expect(result.rows.trainingSlots.map((slot) => [slot.weekday, slot.kind])).toEqual([
      [null, 'strength_gym'],
      [null, 'strength_gym'],
    ]);
    expect(result.rows.userEquipment[0]).toMatchObject({ weights_kg: [5], bar_kg: null });
  });
});

describe('Supabase-Modus: Trainingsplan', () => {
  const planRow = (uses: boolean) => ({
    id: 'plan-1',
    user_id: USER_ID,
    status: 'active',
    template_id: 't',
    template_title_de: 'Vorlage',
    template_version: 1,
    engine_version: 2,
    match_quality: 'exact',
    notes: [],
    uses_health_data: uses,
    medical_notice: false,
    inputs: { experienceLevel: 'beginner' },
    start_date: TODAY,
    created_at: NOW,
    replaced_at: null,
  });
  const sessionRow = {
    id: 'sess-1',
    plan_id: 'plan-1',
    user_id: USER_ID,
    block_no: 1,
    week_no: 1,
    is_intro_week: true,
    is_deload: false,
    kind: 'strength',
    template_day_index: 1,
    scheduled_on: TODAY,
    original_date: null,
    status: 'planned',
    name_de: 'Ganzkörper A',
    focus: 'full_body',
    endurance_modality: null,
    effort_target: null,
    estimated_minutes: 50,
    warmup_de: 'Aufwärmen',
    cooldown_de: 'Cool-down',
    created_at: NOW,
    updated_at: NOW,
  };
  const exerciseRow = {
    id: 'ex-1',
    session_id: 'sess-1',
    user_id: USER_ID,
    order_no: 1,
    exercise_id: 'goblet-kniebeuge',
    source_exercise_id: 'goblet-kniebeuge',
    exercise_name_de: 'Goblet-Kniebeuge',
    sets: 3,
    reps_min: 8,
    reps_max: 12,
    duration_s: null,
    rest_s: 90,
    rpe_target: 7,
    superset_group: null,
    notes_de: null,
    target_weight_kg: null,
  };

  /** Server mit Einwilligung, Gesundheits-Check und aktivem Plan. */
  function server(options: { uses: boolean; online: () => boolean; withPlan?: () => boolean }) {
    return fakeClient((call) => {
      if (!options.online()) return { error: networkError };
      const single = call.chain.includes('maybeSingle') || call.chain.includes('single');
      switch (call.table) {
        case 'consent_documents':
          return { data: { consent_type: 'terms', version: 1, title_de: 'T', body_de: 'B' } };
        case 'profiles':
          return { data: { ...rowsWith().profile, experience_level: 'beginner' } };
        case 'consents':
          return { data: [consent('terms'), consent('privacy'), consent('health_data')] };
        case 'health_screening':
          return {
            data: [
              {
                id: 'h',
                user_id: USER_ID,
                answers: {},
                flags: [],
                medical_notice_acknowledged_at: null,
                created_at: NOW,
              },
            ],
          };
        case 'user_plans':
          return { data: (options.withPlan?.() ?? true) ? planRow(options.uses) : null };
        case 'planned_sessions':
          return call.chain.includes('update') ? { data: [] } : { data: [sessionRow] };
        case 'planned_exercises':
          return { data: [exerciseRow] };
        default:
          return { data: single ? null : [] };
      }
    });
  }

  const options = (client: AppSupabaseClient, store = createMemoryStore()) => ({
    client,
    store,
    platform: 'web' as const,
    now: () => NOW,
    newId: () => 'id',
  });

  it('Plan mit Gesundheitsbezug: nur im geschützten Zwischenspeicher; offline wieder da (mit Regeln)', async () => {
    let online = true;
    const { client } = server({ uses: true, online: () => online });
    const store = createMemoryStore();
    const protectedStore = createMemoryProtectedStore();
    const backend = createSupabaseBackend({ ...options(client, store), protectedStore });
    await backend.loadConsentDocuments();
    const loaded = await backend.loadRows();
    expect(loaded.rows.plans).toHaveLength(1);
    expect(loaded.rows.plannedExercises).toHaveLength(1);
    // Normaler Zwischenspeicher ohne den Plan mit Gesundheitsbezug.
    expect(store.dump()[STORAGE_KEYS.rowsCache]).not.toContain('plan-1');
    expect(store.dump()[STORAGE_KEYS.rowsCache]).not.toContain('Goblet');
    const cached = JSON.parse(protectedStore.peek() ?? '{}');
    expect(cached.plans.plans[0].id).toBe('plan-1');
    expect(cached.safetyRules.usesHealthData).toBe(true);
    // Offline: Plan + wirksame Regeln aus dem geschützten Zwischenspeicher, nie Gesundheits-Checks.
    online = false;
    const offline = await backend.loadRows();
    expect(offline.offline).toBe(true);
    expect(offline.rows.plans[0]?.id).toBe('plan-1');
    expect(offline.rows.plannedExercises).toHaveLength(1);
    expect(offline.rows.healthScreenings).toEqual([]);
    expect(offline.cachedSafetyRules?.rpeMax).toBeLessThanOrEqual(8);
  });

  it('geschützter Zwischenspeicher: nach 14 Tagen ohne Server-Kontakt verworfen', async () => {
    let online = true;
    let now = NOW;
    const { client } = server({ uses: true, online: () => online });
    const protectedStore = createMemoryProtectedStore();
    const backend = createSupabaseBackend({ ...options(client), now: () => now, protectedStore });
    await backend.loadConsentDocuments();
    await backend.loadRows();
    online = false;
    now = '2026-10-17T10:00:00.000Z'; // 14 Tage: noch da
    expect((await backend.loadRows()).rows.plans).toHaveLength(1);
    now = '2026-10-17T10:00:01.000Z'; // länger: verworfen
    const stale = await backend.loadRows();
    expect(stale.rows.plans).toHaveLength(0);
    expect(stale.cachedSafetyRules).toBeNull();
    expect(protectedStore.peek()).toBeNull();
  });

  it('geschützter Zwischenspeicher wird gelöscht: Plan fehlt/ersetzt, Widerruf, Abmelden, Konto löschen', async () => {
    let withPlan = true;
    const { client } = server({ uses: true, online: () => true, withPlan: () => withPlan });
    const protectedStore = createMemoryProtectedStore();
    const backend = createSupabaseBackend({ ...options(client), protectedStore });
    await backend.loadConsentDocuments();
    await backend.loadRows();
    expect(protectedStore.peek()).toContain('plan-1');
    // Server meldet keinen aktiven Plan mehr (ersetzt/fehlt) → Plan aus dem Zwischenspeicher weg.
    withPlan = false;
    await backend.loadRows();
    expect(protectedStore.peek() ?? '').not.toContain('plan-1');
    withPlan = true;
    for (const action of [
      () => backend.revokeConsent('health_data'),
      () => backend.signOut(),
      () => backend.deleteAccount(),
    ]) {
      await backend.loadRows();
      expect(protectedStore.peek()).not.toBeNull();
      await action();
      expect(protectedStore.peek()).toBeNull();
    }
  });

  it('Plan ohne Gesundheitsbezug bleibt im normalen Zwischenspeicher', async () => {
    const { client } = server({ uses: false, online: () => true });
    const store = createMemoryStore();
    const protectedStore = createMemoryProtectedStore();
    const backend = createSupabaseBackend({ ...options(client, store), protectedStore });
    await backend.loadRows();
    expect(store.dump()[STORAGE_KEYS.rowsCache]).toContain('plan-1');
  });

  it('Speichern über save_training_plan; neuer Plan entfernt wartende Verschiebungen', async () => {
    let online = false;
    const { client, calls } = server({ uses: false, online: () => online });
    const store = createMemoryStore();
    const backend = createSupabaseBackend(options(client, store));
    const rows = rowsWith();
    await backend.updatePlannedSession(
      {
        sessionId: 'sess-1',
        planId: 'plan-1',
        usesHealthData: false,
        scheduledOn: TODAY,
        status: 'skipped',
      },
      rows,
    );
    await backend.flush();
    expect(backend.pendingChanges()).toBe(1);
    expect(store.dump()[STORAGE_KEYS.syncQueue]).toContain('update_planned_session:sess-1');
    online = true;
    const before = calls.length;
    const payload = { uses_health_data: false } as unknown as SavePlanPayload;
    await backend.savePlan(payload, rows);
    await backend.flush();
    expect(calls.find((c) => c.table === 'rpc:save_training_plan')?.args[0]?.[0]).toEqual({
      p_plan: payload,
    });
    expect(backend.pendingChanges()).toBe(0);
    expect(
      calls.slice(before).some((c) => c.table === 'planned_sessions' && c.chain.includes('update')),
    ).toBe(false);
  });

  it('Verschieben (Plan mit Gesundheitsbezug) offline → Fehler, nie Warteschlange', async () => {
    const { client } = server({ uses: true, online: () => false });
    const store = createMemoryStore();
    const backend = createSupabaseBackend(options(client, store));
    await expect(
      backend.updatePlannedSession(
        {
          sessionId: 'sess-1',
          planId: 'plan-1',
          usesHealthData: true,
          scheduledOn: TODAY,
          status: 'skipped',
        },
        rowsWith(),
      ),
    ).rejects.toMatchObject({ code: 'network', sensitive: true });
    expect(store.dump()[STORAGE_KEYS.syncQueue]).toBeUndefined();
  });

  it('vom Server abgelehnte Verschiebung → verworfen + Ereignis „Plan neu laden“', async () => {
    const { client } = server({ uses: false, online: () => true });
    const backend = createSupabaseBackend(options(client));
    const events: string[] = [];
    backend.subscribe((event) => events.push(event.kind));
    await backend.updatePlannedSession(
      {
        sessionId: 'weg',
        planId: 'plan-1',
        usesHealthData: false,
        scheduledOn: TODAY,
        status: 'skipped',
      },
      rowsWith(),
    );
    await backend.flush();
    // Update ohne betroffene Zeile (Einheit ersetzt) gilt als abgelehnt.
    expect(events).toEqual(['plan_change_dropped']);
    expect(backend.pendingChanges()).toBe(0);
  });

  it('Tauschen (A1a): wartende Verschiebungen zuerst, dann swap_planned_sessions; offline → „online_only“, nie Warteschlange', async () => {
    let online = false;
    const { client, calls } = server({ uses: false, online: () => online });
    const store = createMemoryStore();
    const backend = createSupabaseBackend(options(client, store));
    const rows = rowsWith();
    const swap = {
      sessionId: 'sess-1',
      otherSessionId: 'sess-2',
      sessionOn: TODAY,
      otherSessionOn: '2026-10-09',
      planId: 'plan-1',
      usesHealthData: false,
    };
    // Eine Verschiebung wartet (offline).
    await backend.updatePlannedSession(
      {
        sessionId: 'sess-1',
        planId: 'plan-1',
        usesHealthData: false,
        scheduledOn: TODAY,
        status: 'planned',
      },
      rows,
    );
    await expect(backend.swapPlannedSessions(swap, rows)).rejects.toMatchObject({
      code: 'online_only',
    });
    expect(store.dump()[STORAGE_KEYS.syncQueue]).not.toContain('swap_planned_sessions');
    expect(calls.some((c) => c.table === 'rpc:swap_planned_sessions')).toBe(false);

    online = true;
    await backend.swapPlannedSessions(swap, rows);
    const update = calls.findIndex(
      (c) => c.table === 'planned_sessions' && c.chain.includes('update'),
    );
    const rpc = calls.findIndex((c) => c.table === 'rpc:swap_planned_sessions');
    expect(update).toBeGreaterThanOrEqual(0);
    expect(rpc).toBeGreaterThan(update);
    expect(calls[rpc]?.args[0]?.[0]).toEqual({
      p_a: 'sess-1',
      p_b: 'sess-2',
      p_a_on: TODAY,
      p_b_on: '2026-10-09',
    });
    expect(backend.pendingChanges()).toBe(0);
  });

  it('Tauschen: Ablehnung der Datenbank → „plan_rejected“ (Plan mit Gesundheitsbezug: sensibel), Netz → „online_only“', async () => {
    let failure: unknown = {
      code: '23514',
      message: 'Verschieben nur ab heute und innerhalb derselben Woche.',
    };
    const { client } = fakeClient((call) =>
      call.table === 'rpc:swap_planned_sessions' ? { error: failure } : { data: [] },
    );
    const backend = createSupabaseBackend(options(client));
    const swap = {
      sessionId: 'a',
      otherSessionId: 'b',
      sessionOn: TODAY,
      otherSessionOn: '2026-10-09',
      planId: 'plan-1',
      usesHealthData: true,
    };
    await expect(backend.swapPlannedSessions(swap, rowsWith())).rejects.toMatchObject({
      code: 'plan_rejected',
      sensitive: true,
      moveReason: 'move_rules',
    });
    failure = {
      code: '23514',
      message: 'Der Plan hat sich inzwischen geändert.',
      hint: 'plan_changed',
    };
    await expect(backend.swapPlannedSessions(swap, rowsWith())).rejects.toMatchObject({
      code: 'plan_rejected',
      moveReason: 'plan_changed',
    });
    failure = networkError;
    await expect(backend.swapPlannedSessions(swap, rowsWith())).rejects.toMatchObject({
      code: 'online_only',
    });
  });

  it('toMoveError (Wächter A1a S2): Regel, geänderter Stand, vorübergehend und Netz getrennt', () => {
    const reason = (error: unknown) => {
      const e = toMoveError(error, false);
      return e.code === 'plan_rejected' ? `plan_rejected:${e.moveReason ?? ''}` : e.code;
    };
    // swap_planned_sessions mit hint
    expect(reason({ code: '23514', message: 'x', hint: 'move_rules' })).toBe(
      'plan_rejected:move_rules',
    );
    expect(reason({ code: '23514', message: 'x', hint: 'plan_changed' })).toBe(
      'plan_rejected:plan_changed',
    );
    expect(reason({ code: '23514', message: 'Einheit nicht gefunden.', hint: 'not_found' })).toBe(
      'plan_rejected:plan_changed',
    );
    // Trigger ohne hint: Regel-Meldungen vs. Stand
    expect(reason({ code: '23514', message: 'Diese Woche ist vorbei.' })).toBe(
      'plan_rejected:move_rules',
    );
    expect(
      reason({ code: '23514', message: 'Einheiten der Erholungswoche lassen sich nur streichen.' }),
    ).toBe('plan_rejected:move_rules');
    expect(
      reason({ code: '23514', message: 'Gestrichene Einheiten lassen sich nicht mehr ändern.' }),
    ).toBe('plan_rejected:plan_changed');
    expect(
      reason({ code: '23514', message: 'Nur Einheiten des aktiven Plans sind änderbar.' }),
    ).toBe('plan_rejected:plan_changed');
    expect(reason({ code: '23505', message: 'duplicate key' })).toBe('plan_rejected:plan_changed');
    expect(reason({ code: 'plan_row_missing', message: 'Einheit nicht gefunden.' })).toBe(
      'plan_rejected:plan_changed',
    );
    // vorübergehend
    expect(reason({ code: '40P01', message: 'deadlock detected' })).toBe('temporary');
    expect(reason({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe(
      'temporary',
    );
    expect(reason({ code: '40001', message: 'could not serialize' })).toBe('temporary');
    expect(reason({ message: 'Bad Gateway', status: 502 })).toBe('temporary');
    expect(reason({ message: 'Too Many Requests', status: 429 })).toBe('temporary');
    // Netz und Anmeldung
    expect(reason(networkError)).toBe('network');
    expect(reason({ code: '42501', message: 'Nicht angemeldet.' })).toBe('not_signed_in');
  });

  it('Bibliothek: nur freigegebene Inhalte (allowDrafts nie true), offline aus dem Zwischenspeicher', async () => {
    let online = true;
    const exercise = JSON.parse(
      readFileSync(
        new URL('../../../../content/exercises/goblet-kniebeuge.json', import.meta.url),
        'utf8',
      ),
    );
    const { alternatives, ...exerciseRowData } = exercise;
    const { client, calls } = fakeClient((call) => {
      if (!online) return { error: networkError };
      if (call.table === 'exercises') {
        return {
          data: [
            { ...exerciseRowData, status: 'draft' },
            {
              ...exerciseRowData,
              id: 'goblet-kniebeuge-frei',
              status: 'published',
              meta: {
                ...exercise.meta,
                expert_reviewed: true,
                reviewed_by: 'X',
                reviewed_at: TODAY,
              },
            },
            { ...exerciseRowData, id: 'goblet-kniebeuge-alt', status: 'archived' },
          ],
        };
      }
      return {
        data:
          call.table === 'exercise_alternatives'
            ? alternatives.map(() => null).filter(Boolean)
            : [],
      };
    });
    const store = createMemoryStore();
    const backend = createSupabaseBackend(options(client, store));
    const library = await backend.loadPlanLibrary({ allowCached: false });
    expect([...(library?.exercises.keys() ?? [])]).toEqual(['goblet-kniebeuge-frei']);
    // Engine (Erzeugen, Ersatz, Folgeblock): nur freigegeben; archivierte nur zur Anzeige laufender Pläne.
    expect([...(library?.displayExercises?.keys() ?? [])].sort()).toEqual([
      'goblet-kniebeuge-alt',
      'goblet-kniebeuge-frei',
    ]);
    expect(library?.containsDrafts).toBe(false);
    expect(calls.find((c) => c.table === 'exercises')?.args).toContainEqual([
      'status',
      ['published', 'archived'],
    ]);
    online = false;
    const cached = await backend.loadPlanLibrary({ allowCached: true });
    expect([...(cached?.exercises.keys() ?? [])]).toEqual(['goblet-kniebeuge-frei']);
    expect(cached?.displayExercises?.has('goblet-kniebeuge-alt')).toBe(true);
    await expect(backend.loadPlanLibrary({ allowCached: false })).rejects.toMatchObject({
      code: 'network',
    });
  });
});

// ---------------------------------------------------------------------------------------------------------
// Trainingstagebuch (docs/PLAN-PHASE-4.md 4.1–4.5, DoD Etappe C)
// ---------------------------------------------------------------------------------------------------------

describe('Supabase-Modus: Tagebuch-Warteschlange', () => {
  const LOG_ID = '11111111-1111-4111-8111-111111111111';
  const SESSION = '33333333-3333-4333-8333-333333333333';

  function logPayload(overrides: Partial<SessionLogPayload> = {}): SessionLogPayload {
    return {
      id: LOG_ID,
      write_id: '22222222-2222-4222-8222-222222222222',
      base_revision: null,
      planned_session_id: SESSION,
      planned_date: TODAY,
      kind: 'strength',
      performed_on: TODAY,
      started_at: null,
      finished_at: null,
      status: 'completed',
      session_rpe: 7,
      notes: 'Griff eng',
      name_de: 'Zügiges Gehen',
      is_intro_week: false,
      is_deload: false,
      source: 'manual',
      client_updated_at: NOW,
      exercises: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          order_no: 1,
          planned_exercise_id: null,
          exercise_id: 'goblet-kniebeuge',
          exercise_name_de: 'Goblet-Kniebeuge',
          load_type: 'weight',
          status: 'done',
          target_sets: 1,
          reps_min: 8,
          reps_max: 12,
          target_reps: 8,
          target_extra_set: false,
          target_weight_kg: 20,
          target_duration_s: null,
          target_rpe: 7,
          state_weight_kg: 20,
          state_target_reps: 8,
          state_extra_set: false,
          state_duration_s: null,
          weight_confirmed: false,
          is_return: false,
          sets: [{ set_no: 1, reps: 8, weight_kg: 20, duration_s: null, rpe: null, done: true }],
        },
      ],
      cardio: null,
      ...overrides,
    };
  }

  function draftOf(health: boolean): WorkoutDraft {
    return {
      format: 1,
      ownerUserId: USER_ID,
      key: SESSION,
      state: 'open',
      rejectReason: null,
      fromHealthPlan: health,
      editing: false,
      logId: LOG_ID,
      baseRevision: null,
      serverRevision: null,
      plannedSessionId: SESSION,
      plannedDate: TODAY,
      kind: 'strength',
      nameDe: 'Zügiges Gehen',
      isIntroWeek: false,
      isDeload: false,
      performedOn: TODAY,
      startedAt: null,
      sessionRpe: 7,
      notes: '',
      exercises: [],
      updatedAt: NOW,
    };
  }

  function stores() {
    return {
      protectedStore: createMemoryProtectedStore(),
      workoutDraftStore: createMemoryProtectedStore(),
      logQueueStore: createMemoryProtectedStore(),
      logCacheStore: createMemoryProtectedStore(),
    };
  }

  function make(
    respond: (call: Call) => { data?: unknown; error?: unknown; status?: number },
    store = createMemoryStore(),
    s = stores(),
  ) {
    const { client, calls } = fakeClient(respond);
    const backend = createSupabaseBackend({
      client,
      store,
      platform: 'web',
      now: () => NOW,
      newId: () => 'id',
      ...s,
    });
    const events: string[] = [];
    backend.subscribe((event) => events.push(event.kind));
    return { backend, calls, store, s, events };
  }

  const ok = (call: Call) =>
    call.table === 'rpc:save_session_log'
      ? { data: { result: 'ok', id: LOG_ID, revision: 1 } }
      : call.table === 'rpc:has_valid_consent'
        ? { data: true }
        : {};

  it('offline: verschlüsselt in der Warteschlange, Entwurf erst danach weg; nie im rowsCache/localStorage', async () => {
    let online = false;
    const { backend, s, store } = make((call) => (online ? ok(call) : { error: networkError }));
    await backend.saveDraft(draftOf(false));
    expect(s.workoutDraftStore.peek()).not.toBeNull();
    expect(await backend.submitWorkout(draftOf(false), logPayload())).toEqual({ kind: 'queued' });
    expect(s.workoutDraftStore.peek()).toBeNull();
    expect(s.logQueueStore.peek()).toContain('save_session_log:');
    expect(backend.pendingChanges()).toBe(1);
    expect(backend.pendingLogSessionIds()).toEqual([SESSION]);
    expect(await backend.pendingWorkouts()).toEqual({ queued: 1, drafts: 0 });
    // Kein Tagebuch-Inhalt im normalen Speicher (AsyncStorage/localStorage).
    expect(JSON.stringify(store.dump())).not.toContain('Griff eng');
    online = true;
    expect(await backend.flush()).toBe(true);
    expect(backend.pendingChanges()).toBe(0);
    expect(s.logQueueStore.peek()).toBeNull();
  });

  it('Freie Einheit (A1b): offline in die Warteschlange (Schlüssel = id), gesendet mit is_free; Ablehnung → Entwurf', async () => {
    const FREE_KEY = `frei-${LOG_ID}`;
    const freePayload = logPayload({
      planned_session_id: null,
      name_de: 'Lauf',
      kind: 'endurance',
      exercises: [],
      cardio: { modality: 'run', duration_s: 1800, distance_m: 5000, elevation_m: null },
      is_free: true,
    });
    const freeDraft: WorkoutDraft = {
      ...draftOf(false),
      key: FREE_KEY,
      plannedSessionId: null,
      kind: 'endurance',
      nameDe: 'Lauf',
      isFree: true,
      backfill: true,
    };
    let mode: 'offline' | 'reject' | 'ok' = 'offline';
    const { backend, s, calls } = make((call) =>
      mode === 'offline'
        ? { error: networkError }
        : mode === 'reject' && call.table === 'rpc:save_session_log'
          ? {
              error: {
                code: '22023',
                message: 'Das Datum liegt außerhalb des erlaubten Zeitraums.',
                details: null,
                hint: null,
              },
              status: 400,
            }
          : ok(call),
    );
    await backend.saveDraft(freeDraft);
    expect(await backend.submitWorkout(freeDraft, freePayload)).toEqual({ kind: 'queued' });
    expect(s.logQueueStore.peek()).toContain(`save_session_log:${LOG_ID}`);
    // Keine geplante Einheit „wird übertragen“.
    expect(backend.pendingLogSessionIds()).toEqual([]);
    expect(await backend.loadDrafts()).toEqual([]);
    mode = 'reject';
    await backend.flush();
    const sent = calls.filter((c) => c.table === 'rpc:save_session_log').at(-1);
    expect((sent?.args[0]?.[0] as { p_log: SessionLogPayload }).p_log).toMatchObject({
      is_free: true,
      planned_session_id: null,
    });
    // Nie stilles Verwerfen: als abgelehnter Entwurf mit Grund zurück (Schlüssel frei-<id>).
    expect(await backend.loadDrafts()).toEqual([
      expect.objectContaining({ key: FREE_KEY, state: 'rejected', rejectReason: 'date_window' }),
    ]);
    expect(s.logQueueStore.peek()).toBeNull();
  });

  it('Reihenfolge (W8): normale Warteschlange → Tagebuch → close_missed_sessions', async () => {
    let online = false;
    const { backend, calls } = make((call) => (online ? ok(call) : { error: networkError }));
    await backend.saveReminder({ enabled: true, intervalDays: 28 }, null, rowsWith());
    await backend.submitWorkout(draftOf(false), logPayload());
    online = true;
    const before = calls.length;
    await backend.flush();
    expect(calls.slice(before).map((c) => c.table)).toEqual([
      'measurement_reminders',
      'rpc:save_session_log',
      'rpc:close_missed_sessions',
    ]);
  });

  it('H-b: vor save_training_plan wird die Tagebuch-Warteschlange gesendet', async () => {
    let online = false;
    const { backend, calls } = make((call) => (online ? ok(call) : { error: networkError }));
    await backend.submitWorkout(draftOf(false), logPayload());
    online = true;
    await backend
      .savePlan({ uses_health_data: false } as unknown as SavePlanPayload, rowsWith())
      .catch(() => undefined);
    const tables = calls.map((c) => c.table);
    expect(tables.indexOf('rpc:save_session_log')).toBeLessThan(
      tables.indexOf('rpc:save_training_plan'),
    );
  });

  it('Konflikt und Ablehnung → als Entwurf gesichert (nie stilles Verwerfen); orphaned → Meldung', async () => {
    let answer: { data?: unknown; error?: unknown } = {
      data: { result: 'conflict', id: LOG_ID, revision: 4 },
    };
    const { backend, s, events } = make((call) =>
      call.table === 'rpc:save_session_log' ? answer : {},
    );
    expect(await backend.submitWorkout(draftOf(false), logPayload())).toEqual({
      kind: 'conflict',
    });
    expect((await backend.loadDrafts())[0]).toMatchObject({
      state: 'conflict',
      serverRevision: 4,
    });
    answer = {
      error: { code: '23505', message: 'An diesem Tag ist schon eine Einheit eingetragen.' },
    };
    expect(await backend.submitWorkout(draftOf(false), logPayload())).toEqual({
      kind: 'rejected',
      reason: 'day_taken',
    });
    expect((await backend.loadDrafts())[0]).toMatchObject({
      state: 'rejected',
      rejectReason: 'day_taken',
    });
    answer = { data: { result: 'orphaned', id: LOG_ID, revision: 1 } };
    expect(await backend.submitWorkout(draftOf(false), logPayload())).toEqual({
      kind: 'saved',
      orphaned: true,
    });
    expect(events).toEqual(['log_conflict', 'log_rejected', 'log_saved']);
    expect(s.logQueueStore.peek()).toBeNull();
  });

  it('401 (abgelaufene Sitzung) = später, Meldung „erneut anmelden“, nichts geleert', async () => {
    const { backend, s, events } = make((call) =>
      call.table === 'rpc:save_session_log' ? { error: { code: 'PGRST301', status: 401 } } : {},
    );
    expect(await backend.submitWorkout(draftOf(false), logPayload())).toEqual({ kind: 'queued' });
    expect(events).toContain('session_expired');
    expect(s.logQueueStore.peek()).not.toBeNull();
  });

  it('Widerruf (R3): Senden gesperrt, Gesundheits-Einträge VOR revoke_health_data neutralisiert', async () => {
    let online = false;
    let queueAtRevoke: string | null = null;
    const s = stores();
    const { backend, calls } = make(
      (call) => {
        if (call.table === 'rpc:revoke_health_data') queueAtRevoke = s.logQueueStore.peek();
        return online ? ok(call) : { error: networkError };
      },
      createMemoryStore(),
      s,
    );
    await backend.submitWorkout(draftOf(true), logPayload());
    online = true;
    await backend.revokeHealthData(false, null);
    // Während des Widerrufs wird nichts gesendet (offline vorher: gar nicht).
    expect(calls.filter((c) => c.table === 'rpc:save_session_log')).toHaveLength(0);
    expect(queueAtRevoke).toContain('Kraft-Einheit');
    expect(queueAtRevoke).not.toContain('Zügiges Gehen');
    expect(queueAtRevoke).not.toContain('"target_weight_kg":20');
    // Tagebuch-Speicher werden beim Widerruf NICHT geleert (nur bereinigt).
    expect(s.logQueueStore.peek()).not.toBeNull();
    // Danach wird (neutral) gesendet.
    await backend.flush();
    const sent = calls.filter((c) => c.table === 'rpc:save_session_log').at(-1)?.args[0]?.[0] as {
      p_log: SessionLogPayload;
    };
    expect(sent.p_log.name_de).toBe('Kraft-Einheit');
    expect(sent.p_log.exercises[0]?.target_weight_kg).toBeNull();
  });

  it('Widerruf „auch löschen“: Gesundheits-Einträge aus der Warteschlange entfernt', async () => {
    const s = stores();
    const { backend } = make(() => ({ error: networkError }), createMemoryStore(), s);
    await backend.submitWorkout(draftOf(true), logPayload());
    await backend.revokeHealthData(true, null).catch(() => undefined);
    expect(s.logQueueStore.peek()).toBeNull();
  });

  it('anderes Gerät nach Widerruf: Einwilligung ungültig → vor dem Senden neutralisiert', async () => {
    let online = false;
    const { backend, calls } = make((call) => {
      if (!online) return { error: networkError };
      if (call.table === 'rpc:has_valid_consent') return { data: false };
      return ok(call);
    });
    await backend.submitWorkout(draftOf(true), logPayload());
    online = true;
    await backend.flush();
    const sent = calls.filter((c) => c.table === 'rpc:save_session_log').at(-1)?.args[0]?.[0] as {
      p_log: SessionLogPayload;
    };
    expect(sent.p_log.name_de).toBe('Kraft-Einheit');
    expect(sent.p_log.exercises[0]?.state_weight_kg).toBeNull();
  });

  it('R5: Einträge eines anderen Kontos werden nie gesendet; Nachfrage und Löschen', async () => {
    const s = stores();
    const first = make(() => ({ error: networkError }), createMemoryStore(), s);
    await first.backend.submitWorkout(draftOf(false), logPayload());
    // Gleiches Gerät, jetzt meldet sich Konto B an (Sitzung von A abgelaufen).
    const { client, calls } = fakeClient(ok);
    (client.auth as unknown as { getSession: () => Promise<unknown> }).getSession = async () => ({
      data: { session: { user: { id: '99999999-9999-4999-8999-999999999999', email: 'b@b.de' } } },
      error: null,
    });
    const other = createSupabaseBackend({
      client,
      store: createMemoryStore(),
      platform: 'web',
      now: () => NOW,
      newId: () => 'id',
      ...s,
    });
    await other.getSession();
    await other.flush();
    expect(calls.some((c) => c.table === 'rpc:save_session_log')).toBe(false);
    expect(await other.hasForeignDeviceData()).toBe(true);
    expect(await other.pendingWorkouts()).toEqual({ queued: 0, drafts: 0 });
    await other.discardForeignDeviceData();
    expect(await other.hasForeignDeviceData()).toBe(false);
    expect(s.logQueueStore.peek()).toBeNull();
  });

  it('Abmelden und Konto löschen leeren alle Tagebuch-Speicher samt Schlüsseln', async () => {
    const s = stores();
    const { backend } = make(() => ({ error: networkError }), createMemoryStore(), s);
    await backend.submitWorkout(draftOf(false), logPayload());
    await backend.saveDraft({ ...draftOf(false), key: 'anderer' });
    await s.logCacheStore.write('{}');
    await backend.signOut();
    expect(s.logQueueStore.peek()).toBeNull();
    expect(s.workoutDraftStore.peek()).toBeNull();
    expect(s.logCacheStore.peek()).toBeNull();
  });

  it('Löschen nur online (R4, 4.5): ohne Verbindung „Dafür brauchst du kurz Verbindung“', async () => {
    const { backend } = make(() => ({ error: networkError }));
    await expect(backend.deleteSessionLog(LOG_ID, 1)).rejects.toMatchObject({
      code: 'online_only',
    });
    const { backend: online, calls } = make((call) =>
      call.table === 'rpc:delete_session_log'
        ? { data: { result: 'conflict', id: LOG_ID, revision: 3 } }
        : {},
    );
    expect(await online.deleteSessionLog(LOG_ID, 1)).toBe('conflict');
    expect(calls.find((c) => c.table === 'rpc:delete_session_log')?.args).toEqual([
      [{ p_id: LOG_ID, p_base_revision: 1 }],
    ]);
  });

  it('Laden: Tagebuch (12 Wochen + recent_exercise_logs) nur im geschützten logCache, offline wieder da', async () => {
    let online = true;
    const s = stores();
    const logRow = {
      id: LOG_ID,
      user_id: USER_ID,
      planned_session_id: null,
      kind: 'strength',
      performed_on: TODAY,
      status: 'completed',
      name_de: 'Kraft-Einheit',
      notes: 'Griff eng',
      revision: 1,
    };
    const { backend, store, calls } = make(
      (call) => {
        if (!online) return { error: networkError };
        if (call.table === 'session_logs') return { data: [logRow] };
        if (call.table === 'rpc:recent_exercise_logs') {
          return { data: { session_logs: [logRow], exercise_logs: [], set_logs: [] } };
        }
        if (call.table === 'profiles') return { data: rowsWith().profile };
        return { data: call.chain.includes('maybeSingle') ? null : [] };
      },
      createMemoryStore(),
      s,
    );
    const loaded = await backend.loadRows();
    expect(loaded.rows.sessionLogs).toHaveLength(1);
    expect(calls.some((c) => c.table === 'rpc:recent_exercise_logs')).toBe(true);
    expect(s.logCacheStore.peek()).toContain('Griff eng');
    expect(JSON.stringify(store.dump())).not.toContain('Griff eng');
    online = false;
    const offline = await backend.loadRows();
    expect(offline.offline).toBe(true);
    expect(offline.rows.sessionLogs.map((l) => l.id)).toEqual([LOG_ID]);
  });

  it('Etappe D: Export = export_my_data() + Konto-E-Mail; nur online; ungültige Antwort → Fehler ohne Inhalte', async () => {
    const tables = [
      'profiles',
      'consents',
      'body_metrics',
      'body_measurements',
      'measurement_reminders',
      'health_screening',
      'goals',
      'user_equipment',
      'training_slots',
      'nutrition_prefs',
      'food_preferences',
      'admin_users',
      'user_plans',
      'planned_sessions',
      'planned_exercises',
      'session_logs',
      'exercise_logs',
      'set_logs',
      'cardio_logs',
      'exercise_start_weights',
      'meal_plans',
      'meal_plan_items',
      'shopping_lists',
      'shopping_list_items',
      'recipe_ratings',
      'food_dislikes',
      // Etappe E1
      'food_log_entries',
      'food_log_favorites',
      // Etappe E2
      'custom_meals',
      'custom_meal_items',
      // Phase 10 WP3
      'competitions',
      // Etappe E3
      'ai_usage',
      'beta_entitlements',
      'admin_actions',
      // Phase 10 S1
      'tracked_routes',
      // Ziele Z3
      'weight_goals',
    ];
    const exported = {
      format_version: 1,
      exported_at: NOW,
      user_id: USER_ID,
      data: {
        ...Object.fromEntries(tables.map((table) => [table, []])),
        session_logs: [{ id: LOG_ID, notes: 'Griff eng' }],
        consents: [{ consent_type: 'health_data', revoked_at: NOW }],
      },
    };
    const { backend, calls, store } = make((call) =>
      call.table === 'rpc:export_my_data' ? { data: exported } : {},
    );
    const file = await backend.exportMyData();
    expect(file.account.email).toBe('a@b.de');
    expect(file.data.session_logs).toEqual([{ id: LOG_ID, notes: 'Griff eng' }]);
    expect(file.data.consents).toHaveLength(1);
    expect(calls.filter((c) => c.table === 'rpc:export_my_data')).toHaveLength(1);
    // Nie im Gerätespeicher.
    expect(JSON.stringify(store.dump())).not.toContain('Griff eng');

    const { backend: offline } = make(() => ({ error: networkError }));
    await expect(offline.exportMyData()).rejects.toMatchObject({ code: 'online_only' });
    const { backend: broken } = make((call) =>
      call.table === 'rpc:export_my_data' ? { data: { format_version: 1, notes: 'Knie' } } : {},
    );
    const error = await broken.exportMyData().catch((e: unknown) => e as Error);
    expect(error).toMatchObject({ code: 'unknown' });
    expect((error as Error).message).not.toContain('Knie');
  });

  it('Etappe D: Verlauf vollständig ab heute − 12 Wochen; ältere Einträge seitenweise nur online', async () => {
    const older = Array.from({ length: 20 }, (_, i) => ({
      id: `log-${i}`,
      user_id: USER_ID,
      performed_on:
        i < 19 ? `2026-07-${String(10 - Math.floor(i / 3)).padStart(2, '0')}` : '2026-07-01',
      kind: 'strength',
    }));
    const { backend, calls, store } = make((call) => {
      if (call.table === 'session_logs' && call.chain.includes('lt')) return { data: older };
      if (
        call.table === 'session_logs' &&
        call.chain.includes('eq') &&
        call.args.some((a) => a[0] === 'performed_on')
      ) {
        return { data: [older[19], { ...older[19], id: 'same-day' }] };
      }
      if (call.table === 'exercise_logs') return { data: [{ id: 'e1', session_log_id: 'log-0' }] };
      if (call.table === 'set_logs') return { data: [{ exercise_log_id: 'e1', set_no: 1 }] };
      return { data: [] };
    });
    // TODAY = 2026-10-03 → vollständig ab 2026-07-11 (12 Wochen).
    expect(backend.logHistoryStart()).toBe('2026-07-11');
    const page = await backend.loadOlderLogs('2026-07-11');
    const query = calls.find((c) => c.table === 'session_logs' && c.chain.includes('lt'));
    expect(query?.args).toContainEqual(['performed_on', '2026-07-11']);
    expect(query?.args).toContainEqual([20]);
    // Volle Seite → alle Einträge des ältesten Tages dazu, nächste Seite davor.
    expect(page.logs.sessionLogs.map((l) => l.id)).toContain('same-day');
    expect(page.logs.sessionLogs).toHaveLength(21);
    expect(page.nextBefore).toBe('2026-07-01');
    expect(page.logs.setLogs).toHaveLength(1);
    expect(store.dump()[STORAGE_KEYS.rowsCache]).toBeUndefined();

    const { backend: last } = make((call) =>
      call.table === 'session_logs' ? { data: older.slice(0, 3) } : { data: [] },
    );
    expect((await last.loadOlderLogs('2026-07-11')).nextBefore).toBeNull();
    const { backend: offline } = make(() => ({ error: networkError }));
    await expect(offline.loadOlderLogs('2026-07-11')).rejects.toMatchObject({
      code: 'online_only',
    });
  });

  it('S1: vorübergehende Fehler (abgelaufenes JWT, 429, 5xx, DB nicht erreichbar, Serialisierung) = später erneut', () => {
    // Betrifft alle Einträge (Netz, Sitzung, Server allgemein): Senden anhalten, nichts zählen.
    const retry = [
      { code: 'PGRST303', message: 'JWT expired', details: null, hint: null },
      { code: 'PGRST301', message: 'JWSError JWSInvalidSignature', details: null, hint: null },
      {
        code: 'PGRST002',
        message: 'Could not query the database for the schema cache',
        details: null,
        hint: null,
      },
      { code: '08006', message: 'connection failure', details: null, hint: null },
      { code: '', message: 'Too Many Requests', details: null, hint: null, status: 429 },
      { code: '', message: 'Bad Gateway', details: null, hint: null, status: 502 },
      // N1: 42501 „Nicht angemeldet.“ aus den RPCs = Sitzung weg → „Bitte erneut anmelden“.
      { code: '42501', message: 'Nicht angemeldet.', details: null, hint: null, status: 403 },
      networkError,
    ];
    for (const error of retry) expect(classifyLogError(error)).toBe('retry');
    // Womöglich nur dieser Eintrag (N1): zählen, mit dem nächsten weitermachen.
    const transient = [
      { code: '40001', message: 'could not serialize access', details: null, hint: null },
      { code: '40P01', message: 'deadlock detected', details: null, hint: null },
      {
        code: '57014',
        message: 'canceling statement due to statement timeout',
        details: null,
        hint: null,
      },
      { code: '42501', message: 'Profil fehlt.', details: null, hint: null, status: 403 },
      { code: '', message: 'Internal Server Error', details: null, hint: null, status: 500 },
      { code: 'invalid_response', message: 'Ungültige Antwort.' },
    ];
    for (const error of transient) expect(classifyLogError(error)).toBe('transient');
    for (const error of [...retry, ...transient]) expect(isTransientError(error)).toBe(true);
    expect(classifySupabaseError({ code: '42501', message: 'Nicht angemeldet.' })).toBe(
      'not_signed_in',
    );
    // N4: „jwt“ im Fehlertext allein ist kein vorübergehender Fehler (nur feste Codes bzw. „JWT expired“).
    expect(
      classifyLogError({ code: '22023', message: 'Ungültige Werte (jwt im Text).', status: 400 }),
    ).toBe('invalid');
    expect(isTransientError({ code: 'P0001', message: 'jwt claim fehlt' })).toBe(false);
    expect(classifySupabaseError({ code: 'PGRST303', message: 'JWT expired' })).toBe(
      'not_signed_in',
    );
    expect(
      classifyLogError({
        code: '23505',
        message: 'An diesem Tag ist schon eine Einheit eingetragen.',
      }),
    ).toBe('day_taken');
    expect(classifyLogError({ code: '54000', message: 'Heute wurden schon zu viele …' })).toBe(
      'daily_limit',
    );
    expect(
      classifyLogError({
        code: '22023',
        message: 'Das Datum liegt außerhalb des erlaubten Zeitraums.',
      }),
    ).toBe('date_window');
    expect(classifyLogError({ code: '23514', message: 'Ungültige Werte im Tagebuch.' })).toBe(
      'invalid',
    );
  });

  it('S1: abgelaufenes JWT (PGRST303) beim Senden → bleibt in der Warteschlange, Meldung „erneut anmelden“', async () => {
    const { backend, s, events } = make((call) =>
      call.table === 'rpc:save_session_log'
        ? { error: { code: 'PGRST303', message: 'JWT expired', details: null, hint: null } }
        : {},
    );
    expect(await backend.submitWorkout(draftOf(false), logPayload())).toEqual({ kind: 'queued' });
    expect(events).toContain('session_expired');
    expect(s.logQueueStore.peek()).not.toBeNull();
    expect(await backend.loadDrafts()).toEqual([]);
  });

  it('S2: wartendes Training landet nie im Zwischenspeicher (kein „erledigt“ offline ohne Bestätigung)', async () => {
    let online = true;
    const s = stores();
    const store = createMemoryStore();
    const planned = {
      id: SESSION,
      plan_id: 'plan-1',
      user_id: USER_ID,
      scheduled_on: TODAY,
      original_date: null,
      status: 'planned',
      kind: 'strength',
    };
    const { backend } = make(
      (call) => {
        if (!online || call.table === 'rpc:save_session_log') return { error: networkError };
        if (call.table === 'user_plans')
          return { data: { id: 'plan-1', status: 'active', uses_health_data: false } };
        if (call.table === 'planned_sessions') return { data: [planned] };
        if (call.table === 'profiles') return { data: rowsWith().profile };
        return { data: call.chain.includes('maybeSingle') ? null : [] };
      },
      store,
      s,
    );
    await backend.submitWorkout(draftOf(false), logPayload());
    const loaded = await backend.loadRows();
    // Anzeige: erledigt (wird übertragen).
    expect(loaded.rows.plannedSessions[0]?.status).toBe('completed');
    expect(loaded.rows.sessionLogs).toHaveLength(1);
    // Ein späterer Schreibvorgang mit den Anzeige-Zeilen (z. B. Mess-Erinnerung) cacht trotzdem nur Bestätigtes.
    await backend.saveReminder({ enabled: true, intervalDays: 28 }, null, loaded.rows);
    const cache = JSON.parse(store.dump()[STORAGE_KEYS.rowsCache] ?? '{}') as {
      rows: { plannedSessions: { status: string }[] };
    };
    expect(cache.rows.plannedSessions[0]?.status).toBe('planned');
    expect(s.logCacheStore.peek()).not.toContain(LOG_ID);
    online = false;
    const offline = await backend.loadRows();
    // Offline weiter als wartend überlagert – aus der Warteschlange, nicht aus dem Zwischenspeicher.
    expect(offline.rows.plannedSessions[0]?.status).toBe('completed');
  });

  it('S3: Entwurf aus einem Gesundheits-Plan wird beim Laden neutralisiert, wenn die Einwilligung fehlt (R3)', async () => {
    const s = stores();
    const { backend, calls } = make(
      (call) => (call.table === 'rpc:has_valid_consent' ? { data: false } : {}),
      createMemoryStore(),
      s,
    );
    await backend.saveDraft({ ...draftOf(true), nameDe: 'Zügiges Gehen' });
    await backend.loadRows().catch(() => undefined);
    expect(calls.some((c) => c.table === 'rpc:has_valid_consent')).toBe(true);
    const [draft] = await backend.loadDrafts();
    expect(draft).toMatchObject({ fromHealthPlan: false, nameDe: 'Kraft-Einheit' });
    expect(s.workoutDraftStore.peek()).not.toContain('Zügiges Gehen');
  });

  it('S4: Ergebnis gehört zur eigenen Fassung, nicht zu einer anderen wartenden Einheit', async () => {
    let online = false;
    const OTHER_SESSION = '55555555-5555-4555-8555-555555555555';
    const { backend } = make((call) => {
      if (!online) return { error: networkError };
      if (call.table !== 'rpc:save_session_log') return {};
      const p = (call.args[0]?.[0] as { p_log: SessionLogPayload }).p_log;
      return p.planned_session_id === OTHER_SESSION
        ? { data: { result: 'ok', id: p.id, revision: 1 } }
        : { data: { result: 'conflict', id: LOG_ID, revision: 7 } };
    });
    const other = logPayload({
      id: '66666666-6666-4666-8666-666666666666',
      write_id: '77777777-7777-4777-8777-777777777777',
      planned_session_id: OTHER_SESSION,
    });
    await backend.submitWorkout({ ...draftOf(false), key: OTHER_SESSION }, other);
    online = true;
    // Die eigene Fassung kommt als Konflikt zurück – das „ok“ der anderen Einheit (zuerst gesendet) zählt nicht.
    expect(await backend.submitWorkout(draftOf(false), logPayload())).toEqual({ kind: 'conflict' });
  });

  it('N1: Serverfehler nur eines Eintrags → nächster Eintrag und close_missed_sessions laufen weiter', async () => {
    let online = false;
    const OTHER_SESSION = '55555555-5555-4555-8555-555555555555';
    const { backend, calls } = make((call) => {
      if (!online) return { error: networkError };
      if (call.table !== 'rpc:save_session_log') return ok(call);
      const p = (call.args[0]?.[0] as { p_log: SessionLogPayload }).p_log;
      return p.planned_session_id === SESSION
        ? {
            error: { code: '', message: 'Internal Server Error', details: null, hint: null },
            status: 500,
          }
        : { data: { result: 'ok', id: p.id, revision: 1 } };
    });
    await backend.submitWorkout(draftOf(false), logPayload());
    await backend.submitWorkout(
      { ...draftOf(false), key: OTHER_SESSION },
      logPayload({
        id: '66666666-6666-4666-8666-666666666666',
        write_id: '77777777-7777-4777-8777-777777777777',
        planned_session_id: OTHER_SESSION,
      }),
    );
    online = true;
    const before = calls.length;
    // Nicht alles übertragen (ein Eintrag wartet) – aber der andere ist gesendet und die Statuspflege lief.
    expect(await backend.flush()).toBe(false);
    expect(calls.slice(before).map((c) => c.table)).toEqual([
      'rpc:save_session_log',
      'rpc:save_session_log',
      'rpc:close_missed_sessions',
    ]);
    expect(backend.pendingLogSessionIds()).toEqual([SESSION]);
  });

  it('N1: 42501 „Nicht angemeldet.“ beim Senden → bleibt wartend, Meldung „erneut anmelden“', async () => {
    const { backend, s, events } = make((call) =>
      call.table === 'rpc:save_session_log'
        ? { error: { code: '42501', message: 'Nicht angemeldet.', details: null, hint: null } }
        : {},
    );
    expect(await backend.submitWorkout(draftOf(false), logPayload())).toEqual({ kind: 'queued' });
    expect(events).toContain('session_expired');
    expect(s.logQueueStore.peek()).not.toBeNull();
  });

  it('N3/N2 (K9): sessionStorage wirft beim Schreiben – online sofort gesendet; offline Meldung, Entwurf bleibt und verschwindet nach der Übertragung', async () => {
    const throwing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
    };
    const brokenStores = () => ({
      ...stores(),
      workoutDraftStore: {
        ...createSessionProtectedStore(throwing, 'draft', { strict: true }),
        peek: () => null,
      },
      logQueueStore: {
        ...createSessionProtectedStore(throwing, 'queue', { strict: true }),
        peek: () => null,
      },
    });
    // Online: Fassung aus dem Arbeitsspeicher sofort gesendet, Entwurf weg.
    const online = make(ok, createMemoryStore(), brokenStores());
    await expect(online.backend.saveDraft(draftOf(false))).rejects.toThrow();
    expect(await online.backend.submitWorkout(draftOf(false), logPayload())).toEqual({
      kind: 'saved',
      orphaned: false,
    });
    expect(await online.backend.loadDrafts()).toEqual([]);

    // Offline: „Offline-Speicher nicht verfügbar“, der Entwurf bleibt (Arbeitsspeicher) …
    let reachable = false;
    const offline = make(
      (call) => (reachable ? ok(call) : { error: networkError }),
      createMemoryStore(),
      brokenStores(),
    );
    await offline.backend.saveDraft(draftOf(false)).catch(() => undefined);
    await expect(offline.backend.submitWorkout(draftOf(false), logPayload())).rejects.toMatchObject(
      { code: 'storage_unavailable' },
    );
    expect(await offline.backend.loadDrafts()).toHaveLength(1);
    // … und wird nach der späteren Übertragung entfernt (N2: kein „Entwurf gefunden“ für ein gespeichertes Training).
    reachable = true;
    expect(await offline.backend.flush()).toBe(true);
    expect(await offline.backend.loadDrafts()).toEqual([]);
  });

  it('N2: ein nach dem Einreihen weiter geänderter Entwurf bleibt nach der Übertragung stehen', async () => {
    let online = false;
    const { backend } = make((call) => (online ? ok(call) : { error: networkError }));
    await backend.submitWorkout(draftOf(false), logPayload());
    // Erneut geöffnet und geändert (neuer Stand), noch nicht gespeichert.
    await backend.saveDraft({
      ...draftOf(false),
      sessionRpe: 9,
      updatedAt: '2026-10-05T19:00:00.000Z',
    });
    online = true;
    await backend.flush();
    expect(await backend.loadDrafts()).toHaveLength(1);
  });
});

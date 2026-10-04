import { readFileSync } from 'node:fs';

import type { SavePlanPayload } from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';
import { describe, expect, it } from 'vitest';

import { consent, NOW, rowsWith, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { createMemoryStore, STORAGE_KEYS } from './kv';
import { answersFromRows } from './mapping';
import { createMemoryProtectedStore } from './protected-store';
import { classifySupabaseError, createSupabaseBackend, executeWriteOp } from './supabase-backend';
import type { StepSave } from './types';

interface Call {
  table: string;
  chain: string[];
  args: unknown[][];
}

/**
 * Minimaler Ersatz für den Supabase-Client: zeichnet alle Aufrufe auf (Tabelle + Methodenkette) und
 * liefert das Ergebnis von `respond` (Standard: kein Fehler).
 */
function fakeClient(respond: (call: Call) => { data?: unknown; error?: unknown } = () => ({})) {
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
    expect(calls.map((c) => c.table)).toEqual(['body_metrics', 'profiles']);
    expect(JSON.stringify(store.dump())).not.toContain('"height_cm":170');
  });

  it('Widerruf: setzt revoked_at nur bei aktiven Einwilligungen dieser Art', async () => {
    const { client, calls } = fakeClient();
    const backend = createSupabaseBackend(options(client));
    await backend.revokeConsent('health_data');
    const call = calls.find((c) => c.table === 'consents');
    expect(call?.chain).toEqual(['update', 'eq', 'eq', 'is']);
    expect(call?.args).toEqual([
      [{ revoked_at: NOW }],
      ['user_id', USER_ID],
      ['consent_type', 'health_data'],
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
    const { client } = fakeClient((call) => {
      if (!online) {
        return { error: networkError };
      }
      return call.table.startsWith('rpc:')
        ? { data: 1 }
        : { data: { consent_type: 'terms', version: 1, title_de: 'Titel', body_de: 'Text' } };
    });
    const store = createMemoryStore();
    const backend = createSupabaseBackend(options(client, store));
    const docs = await backend.loadConsentDocuments();
    expect(docs).toHaveLength(3);
    online = false;
    expect(await backend.loadConsentDocuments()).toEqual(docs);
    // Ohne gespeicherten Stand bleibt es beim Fehler (Bildschirm zeigt „Erneut versuchen“).
    const empty = createSupabaseBackend(options(client, createMemoryStore()));
    await expect(empty.loadConsentDocuments()).rejects.toMatchObject({ code: 'network' });
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
        case 'rpc:current_consent_version':
          return { data: 1 };
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

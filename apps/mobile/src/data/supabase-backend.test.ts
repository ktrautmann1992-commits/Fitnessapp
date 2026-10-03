import type { AppSupabaseClient } from '@fitnessapp/db';
import { describe, expect, it } from 'vitest';

import { consent, NOW, rowsWith, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { createMemoryStore, STORAGE_KEYS } from './kv';
import { answersFromRows } from './mapping';
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
        },
      ],
    });
    expect(calls.map((c) => c.table)).toEqual([
      'rpc:replace_food_preferences',
      'rpc:replace_user_equipment',
    ]);
    expect(calls[0]?.args[0]?.[0]).toEqual({
      p_scope: 'taste',
      p_items: [{ food_group: 'fish', kind: 'like' }],
    });
    expect(calls[1]?.args[0]?.[0]).toEqual({
      p_location: 'home',
      p_items: [{ equipment_id: 'dumbbells', weights_kg: [2], note: null }],
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
});

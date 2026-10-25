import { EMPTY_SHOE_DATA, saveShoe, type ShoeData } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { testBackend, VERSIONS } from '../test/fixtures';
import { createMemoryStore } from './kv';
import { shoeActivities } from './shoe-rows';
import {
  attachShoes,
  createLocalShoes,
  createRemoteShoes,
  isNetworkError,
  SHOE_STORAGE_KEY,
  shoeBackendFor,
} from './shoes';

const USER = '11111111-1111-4111-8111-111111111111';
const SHOE = '22222222-2222-4222-8222-222222222222';

function data(): ShoeData {
  const result = saveShoe(EMPTY_SHOE_DATA, {
    id: SHOE,
    sport: 'run',
    name: 'Pegasus 41',
    brand: null,
    startKm: 10,
    replaceKm: null,
    inUseSince: '2026-09-01',
    makeDefault: true,
  });
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

const session = { getSession: async () => ({ userId: USER, email: null }) };

describe('Schuhe im Testmodus (Gerätespeicher)', () => {
  it('leer → speichern → laden, je Konto; Löschen und Gerät leeren', async () => {
    const store = createMemoryStore();
    const shoes = createLocalShoes(store, session);
    expect((await shoes.load(null)).data).toEqual(EMPTY_SHOE_DATA);
    expect(await shoes.save(data())).toBe('saved');
    expect((await shoes.load(null)).data.shoes[0]?.name).toBe('Pegasus 41');
    // Anderes Konto sieht nichts.
    const other = createLocalShoes(store, {
      getSession: async () => ({ userId: '33333333-3333-4333-8333-333333333333', email: null }),
    });
    expect((await other.load(null)).data).toEqual(EMPTY_SHOE_DATA);
    await shoes.deleteAll();
    expect((await shoes.load(null)).data).toEqual(EMPTY_SHOE_DATA);
    await shoes.clearDevice();
    expect(await store.getItem(SHOE_STORAGE_KEY)).toBeNull();
  });

  it('ungültiger Stand wird nicht gespeichert', async () => {
    const shoes = createLocalShoes(createMemoryStore(), session);
    await expect(
      shoes.save({ ...data(), assignments: [{ activity_key: 'x', shoe_id: null }] }),
    ).rejects.toThrow();
  });

  it('Export (Testmodus) und Verbindung mit dem Backend', async () => {
    const { backend } = testBackend();
    if (backend.signIn.kind !== 'test_mode') throw new Error();
    await backend.signIn.start();
    await backend.createProfile('1990-05-15');
    await backend.grantConsents(['terms', 'privacy'], VERSIONS);
    const store = createMemoryStore();
    attachShoes(backend, createLocalShoes(store, backend));
    const shoes = shoeBackendFor(backend);
    expect(shoes).not.toBeNull();
    await shoes?.save(data());
    const file = await backend.exportMyData();
    expect(file.data.shoes).toHaveLength(1);
    expect(file.data.shoes?.[0]).toMatchObject({ id: SHOE, start_km: 10 });
    expect(file.data.shoe_defaults).toHaveLength(1);
    expect(file.data.shoe_assignments).toEqual([]);
    await backend.signOut();
    expect(await store.getItem(SHOE_STORAGE_KEY)).toBeNull();
  });
});

/** Kleiner Ersatz für supabase-js: rpc und from(...).select().eq()… mit festen Antworten. */
function fakeClient(options: { offline?: boolean; rejected?: boolean }) {
  const calls: { rpc: string; args: unknown }[] = [];
  const networkError = { message: 'Failed to fetch', name: 'TypeError' };
  const query = (rows: unknown[]) => {
    const result = options.offline
      ? { data: null, error: networkError }
      : { data: rows, error: null };
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'order', 'gte', 'lt', 'limit']) {
      chain[name] = () => chain;
    }
    chain.then = (resolve: (value: unknown) => void) => resolve(result);
    return chain;
  };
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ rpc: name, args });
      if (options.offline) return { data: null, error: networkError };
      if (options.rejected)
        return { data: null, error: { code: '22023', message: 'Ungültige Schuhe.' } };
      return { data: null, error: null };
    },
    from: (table: string) =>
      query(
        table === 'shoes'
          ? data().shoes
          : table === 'shoe_defaults'
            ? data().defaults
            : table === 'session_logs'
              ? [
                  {
                    id: '44444444-4444-4444-8444-444444444444',
                    name_de: 'Lauf',
                    performed_on: '2026-06-01',
                    started_at: null,
                    cardio_logs: [
                      { modality: 'run', duration_s: 1800, distance_m: 6000, elevation_m: null },
                    ],
                  },
                ]
              : [],
      ),
  };
  return { client: client as never, calls };
}

describe('Schuhe mit Supabase (offline-first)', () => {
  it('online: speichern über save_shoe_data, laden mit älteren Einträgen', async () => {
    const { client, calls } = fakeClient({});
    const shoes = createRemoteShoes({
      client,
      store: createMemoryStore(),
      backend: session,
      logWindowStart: () => '2026-08-01',
    });
    expect(await shoes.save(data())).toBe('saved');
    expect(calls.map((c) => c.rpc)).toEqual(['save_shoe_data']);
    const loaded = await shoes.load('2026-05-01');
    expect(loaded.data.shoes[0]?.id).toBe(SHOE);
    expect(loaded.olderLogs).toHaveLength(1);
    expect(loaded.olderLogs[0]).toMatchObject({ distance_m: 6000, modality: 'run' });
    expect(loaded.offline).toBe(false);
  });

  it('offline: wird gemerkt und beim nächsten Laden gesendet', async () => {
    const store = createMemoryStore();
    const offline = fakeClient({ offline: true });
    const shoes = createRemoteShoes({
      client: offline.client,
      store,
      backend: session,
      logWindowStart: () => '2026-08-01',
    });
    expect(await shoes.save(data())).toBe('queued');
    const offlineLoad = await shoes.load(null);
    expect(offlineLoad).toMatchObject({ offline: true, pending: true });
    expect(offlineLoad.data.shoes).toHaveLength(1);

    const online = fakeClient({});
    const again = createRemoteShoes({
      client: online.client,
      store,
      backend: session,
      logWindowStart: () => '2026-08-01',
    });
    const loaded = await again.load(null);
    expect(online.calls.map((c) => c.rpc)).toEqual(['save_shoe_data']);
    expect(loaded).toMatchObject({ offline: false, pending: false });
  });

  it('abgelehnt: Fehler, nicht endlos neu senden', async () => {
    const store = createMemoryStore();
    const { client } = fakeClient({ rejected: true });
    const shoes = createRemoteShoes({
      client,
      store,
      backend: session,
      logWindowStart: () => '2026-08-01',
    });
    await expect(shoes.save(data())).rejects.toMatchObject({ code: 'unknown' });
    expect(JSON.parse((await store.getItem(SHOE_STORAGE_KEY)) ?? '{}').pending).toBe(false);
  });

  it('Netzfehler erkennen', () => {
    expect(isNetworkError({ message: 'Network request failed' })).toBe(true);
    expect(isNetworkError({ code: '22023', message: 'Ungültige Schuhe.' })).toBe(false);
  });
});

describe('Aktivitäten für Schuhe', () => {
  it('ältere Einträge ergänzen, ohne Doppelzählung', () => {
    const older = {
      id: '44444444-4444-4444-8444-444444444444',
      name_de: 'Lauf',
      performed_on: '2026-06-01',
      started_at: null,
      modality: 'run' as const,
      duration_s: 1800,
      distance_m: 6000,
      elevation_m: null,
    };
    expect(shoeActivities(null, [], [], [older, older])).toHaveLength(1);
    expect(shoeActivities(null, [], [], [])[0]).toBeUndefined();
  });
});

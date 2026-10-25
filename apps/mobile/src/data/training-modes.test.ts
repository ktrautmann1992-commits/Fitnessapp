import { addDays } from '@fitnessapp/core';
import { describe, expect, it, vi } from 'vitest';

import type { Backend, SnapshotResult } from './backend';
import { createMemoryProtectedStore } from './protected-store';
import {
  attachTrainingModes,
  createLocalTrainingModes,
  createRemoteTrainingModes,
  hasPainConsent,
  onTrainingModesCleared,
  TrainingModesError,
  trainingModesErrorCode,
  trainingModesFor,
} from './training-modes';
import type { ConsentRow } from './types';

const TODAY = '2026-10-25';
const USER = 'u1';
let ids = 0;
const newId = () => `00000000-0000-4000-8000-${String((ids += 1)).padStart(12, '0')}`;
const now = () => `${TODAY}T09:00:00Z`;

function local(store = createMemoryProtectedStore()) {
  return { store, modes: createLocalTrainingModes({ store, now, newId }) };
}

const knee = {
  region: 'knee',
  intensity: 'moderate',
  duration_days: 7,
  started_on: TODAY,
} as const;
const trip = {
  starts_on: TODAY,
  ends_on: addDays(TODAY, 4),
  equipment: 'bodyweight',
  max_minutes: 30,
} as const;

function consent(version: number, overrides: Partial<ConsentRow> = {}): ConsentRow {
  return {
    id: `c${version}`,
    user_id: USER,
    consent_type: 'health_data',
    version,
    granted_at: '2026-10-01T08:00:00Z',
    revoked_at: null,
    platform: 'web',
    ...overrides,
  } as ConsentRow;
}

describe('Einwilligung für den Schon-Modus (Fassung ≥ 2)', () => {
  it('gültig nur mit aktiver Einwilligung health_data in der aktuellen Fassung ≥ 2', () => {
    expect(hasPainConsent([consent(2)], 2)).toBe(true);
    expect(hasPainConsent([consent(1)], 2)).toBe(false);
    expect(hasPainConsent([consent(2, { revoked_at: now() })], 2)).toBe(false);
    // Supabase heute: Fassung 1 veröffentlicht → niemand darf (Fassung 2 noch in Prüfung).
    expect(hasPainConsent([consent(1)], 1)).toBe(false);
    expect(hasPainConsent([], 2)).toBe(false);
    expect(hasPainConsent([consent(2)], null)).toBe(false);
  });
});

describe('Testmodus: Speicher der Trainings-Modi', () => {
  it('ohne Einwilligung kein Schmerz-Eintrag; mit Einwilligung gespeichert, je Konto getrennt', async () => {
    const { modes, store } = local();
    await expect(modes.addPain(USER, knee, TODAY, false)).rejects.toMatchObject({
      code: 'consent_missing',
    });
    await modes.addPain(USER, knee, TODAY, true);
    expect((await modes.load(USER, TODAY)).state.pain).toHaveLength(1);
    expect((await modes.load('u2', TODAY)).state.pain).toEqual([]);
    // Nur im geschützten Speicher (kein Klartext außerhalb).
    expect(store.peek()).toContain('"knee"');
  });

  it('ungültige Eingaben werden abgelehnt (Beginn nicht heute, Dauer, Reise zu lang)', async () => {
    const { modes } = local();
    await expect(
      modes.addPain(USER, { ...knee, started_on: addDays(TODAY, -3) }, TODAY, true),
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      modes.addPain(USER, { ...knee, duration_days: 5 as 7 }, TODAY, true),
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      modes.addTravel(USER, { ...trip, ends_on: addDays(TODAY, 42) }, TODAY),
    ).rejects.toMatchObject({ code: 'invalid' });
  });

  it('neue Angabe derselben Region beendet die laufende; Beenden und alles löschen', async () => {
    const { modes } = local();
    await modes.addPain(USER, knee, TODAY, true);
    await modes.addPain(USER, { ...knee, intensity: 'severe', duration_days: 3 }, TODAY, true);
    const state = (await modes.load(USER, TODAY)).state;
    expect(state.pain).toHaveLength(2);
    expect(state.pain[0]?.ended_early_on).toBe(TODAY);
    await modes.endPain(USER, state.pain[1]!.id, TODAY);
    expect((await modes.load(USER, TODAY)).state.pain[1]?.ended_early_on).toBe(TODAY);
    await modes.deleteAllPain(USER);
    expect((await modes.load(USER, TODAY)).state.pain).toEqual([]);
  });

  it('Reise: Überschneidung abgelehnt; künftige entfernen, laufende auf gestern beenden', async () => {
    const { modes } = local();
    await modes.addTravel(USER, trip, TODAY);
    await expect(
      modes.addTravel(
        USER,
        { ...trip, starts_on: addDays(TODAY, 4), ends_on: addDays(TODAY, 6) },
        TODAY,
      ),
    ).rejects.toMatchObject({ code: 'overlap' });
    const [first] = (await modes.load(USER, TODAY)).state.travel;
    // Am ersten Tag beenden = entfernen.
    await modes.endTravel(USER, first!.id, TODAY);
    expect((await modes.load(USER, TODAY)).state.travel).toEqual([]);
    // Laufend (gestern begonnen, gespeichert vor einem Tag) → Ende gestern.
    await modes.addTravel(USER, trip, TODAY);
    const [second] = (await modes.load(USER, TODAY)).state.travel;
    const tomorrow = addDays(TODAY, 1);
    await modes.endTravel(USER, second!.id, tomorrow);
    expect((await modes.load(USER, tomorrow)).state.travel[0]?.ends_on).toBe(TODAY);
  });

  it('Export (Testmodus): beide Tabellen mit user_id', async () => {
    const { modes } = local();
    await modes.addPain(USER, knee, TODAY, true);
    await modes.addTravel(USER, trip, TODAY);
    const tables = await modes.exportTables(USER);
    expect(tables.pain_episodes).toEqual([
      expect.objectContaining({ region: 'knee', user_id: USER }),
    ]);
    expect(tables.travel_modes).toEqual([
      expect.objectContaining({ equipment: 'bodyweight', user_id: USER }),
    ]);
  });

  it('kaputter Speicher → leer statt Absturz', async () => {
    const store = createMemoryProtectedStore();
    await store.write('{kaputt');
    const { modes } = local(store);
    expect((await modes.load(USER, TODAY)).state).toEqual({ pain: [], travel: [] });
  });
});

describe('attachTrainingModes: Widerruf, Abmelden, Konto löschen, Export', () => {
  function fakeBackend(mode: 'local' | 'supabase' = 'local') {
    const backend = {
      mode,
      revokeConsent: vi.fn(async () => undefined),
      signOut: vi.fn(async () => undefined),
      deleteAccount: vi.fn(async () => undefined),
      clearDeviceData: vi.fn(async () => undefined),
      loadRows: vi.fn(
        async (): Promise<SnapshotResult> =>
          ({
            rows: { consents: [], profile: { user_id: USER } },
            offline: false,
          }) as unknown as SnapshotResult,
      ),
      exportMyData: vi.fn(async () => ({
        format_version: 1,
        exported_at: 'x',
        user_id: USER,
        account: { email: null },
        data: { profiles: [], pain_episodes: [], travel_modes: [] },
      })),
    };
    return backend as unknown as Backend;
  }

  it('Widerruf health_data löscht nur die Schmerz-Einträge auf dem Gerät, Reisen bleiben', async () => {
    const { modes } = local();
    const backend = attachTrainingModes(fakeBackend(), modes);
    expect(trainingModesFor(backend)).toBe(modes);
    await backend.loadRows();
    await modes.addPain(USER, knee, TODAY, true);
    await modes.addTravel(USER, trip, TODAY);
    const cleared = vi.fn();
    const off = onTrainingModesCleared(cleared);
    await backend.revokeConsent('wearable_data');
    expect((await modes.load(USER, TODAY)).state.pain).toHaveLength(1);
    await backend.revokeConsent('health_data');
    const state = (await modes.load(USER, TODAY)).state;
    expect(state.pain).toEqual([]);
    expect(state.travel).toHaveLength(1);
    expect(cleared).toHaveBeenCalled();
    off();
  });

  it('Abmelden, Konto löschen und Gerätedaten löschen leeren alles', async () => {
    for (const action of ['signOut', 'deleteAccount', 'clearDeviceData'] as const) {
      const { modes } = local();
      const backend = attachTrainingModes(fakeBackend(), modes);
      await backend.loadRows();
      await modes.addTravel(USER, trip, TODAY);
      await backend[action]();
      expect((await modes.load(USER, TODAY)).state.travel, action).toEqual([]);
    }
  });

  it('Export: Testmodus setzt die Zeilen ein, Supabase lässt export_my_data unverändert', async () => {
    const { modes } = local();
    const backend = attachTrainingModes(fakeBackend(), modes);
    await backend.loadRows();
    await modes.addPain(USER, knee, TODAY, true);
    expect((await backend.exportMyData()).data.pain_episodes).toHaveLength(1);

    const remote = createRemoteTrainingModes({
      client: {} as never,
      store: createMemoryProtectedStore(),
      newId,
    });
    const supa = attachTrainingModes(fakeBackend('supabase'), remote);
    await supa.loadRows();
    expect((await supa.exportMyData()).data.pain_episodes).toEqual([]);
  });
});

describe('Supabase: Fehler als feste Codes, offline aus dem Zwischenspeicher', () => {
  it('Fehlercodes ohne Inhalte', () => {
    expect(trainingModesErrorCode({ message: 'pain_consent_missing', code: '42501' })).toBe(
      'consent_missing',
    );
    expect(trainingModesErrorCode({ message: 'new row violates row-level security policy' })).toBe(
      'consent_missing',
    );
    expect(trainingModesErrorCode({ message: 'travel_overlap', code: '23514' })).toBe('overlap');
    expect(trainingModesErrorCode({ message: 'pain_start_invalid', code: '23514' })).toBe(
      'invalid',
    );
    expect(trainingModesErrorCode({ message: 'Failed to fetch' })).toBe('network');
    expect(trainingModesErrorCode(null)).toBe('unknown');
    expect(new TrainingModesError('network').message).toBe('TrainingModesError: network');
  });

  /** Minimaler Supabase-Ersatz: from(t).select().gte() und insert/update/delete. */
  function fakeClient(rows: { pain: unknown[]; travel: unknown[] }, failing = false) {
    const calls: string[] = [];
    const result = (data: unknown) =>
      failing
        ? Promise.reject(new Error('Failed to fetch'))
        : Promise.resolve({ data, error: null });
    const client = {
      from: (table: string) => ({
        select: () => ({
          gte: () => result(table === 'pain_episodes' ? rows.pain : rows.travel),
        }),
        insert: (row: unknown) => {
          calls.push(`insert ${table}`);
          if (table === 'pain_episodes')
            rows.pain.push({ ...(row as object), ended_early_on: null, created_at: now() });
          return result(null);
        },
        update: () => ({ eq: () => (calls.push(`update ${table}`), result(null)) }),
        delete: () => ({
          eq: () => (calls.push(`delete ${table}`), result(null)),
          gte: () => (calls.push(`delete-all ${table}`), result(null)),
        }),
      }),
    };
    return { client: client as never, calls };
  }

  it('Laden füllt den Zwischenspeicher; offline wird er angezeigt (Markierung „offline“)', async () => {
    const store = createMemoryProtectedStore();
    const { client } = fakeClient({ pain: [], travel: [] });
    const remote = createRemoteTrainingModes({ client, store, newId });
    await remote.addPain(USER, knee, TODAY, true);
    expect((await remote.load(USER, TODAY)).state.pain).toHaveLength(1);
    const offline = createRemoteTrainingModes({
      client: fakeClient({ pain: [], travel: [] }, true).client,
      store,
      newId,
    });
    const snapshot = await offline.load(USER, TODAY);
    expect(snapshot.offline).toBe(true);
    expect(snapshot.state.pain).toHaveLength(1);
    // Schreiben offline → klarer Fehler „network“ (keine stille Warteschlange für Gesundheitsdaten).
    await expect(offline.addTravel(USER, trip, TODAY)).rejects.toMatchObject({ code: 'network' });
  });

  it('ohne Einwilligung wird gar nicht erst gesendet', async () => {
    const { client, calls } = fakeClient({ pain: [], travel: [] });
    const remote = createRemoteTrainingModes({
      client,
      store: createMemoryProtectedStore(),
      newId,
    });
    await expect(remote.addPain(USER, knee, TODAY, false)).rejects.toMatchObject({
      code: 'consent_missing',
    });
    expect(calls).toEqual([]);
  });
});

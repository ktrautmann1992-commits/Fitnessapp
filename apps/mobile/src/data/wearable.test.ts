import {
  CURRENT_CONSENT_VERSIONS,
  type WearableImportBatch,
  type WearableSessionImport,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { createDemoHealthConnectDriver, demoRead } from '../lib/health-connect-demo';
import type { HealthConnectDriver } from '../lib/health-connect-driver.types';
import { BackendError } from './backend';
import { createMemoryStore } from './kv';
import { createLocalBackend } from './local-backend';
import { createMemoryProtectedStore } from './protected-store';
import { emptyUserRows, type UserRows } from './types';
import {
  applyWearableDisconnect,
  applyWearableImport,
  applyWearableResolve,
  EMPTY_LOCAL_WEARABLES,
  wearableRowsFor,
} from './wearable-rows';
import { WearableQueue, type WearableSendResult } from './wearable-queue';
import { runWearableSync } from './wearable-sync';

/**
 * Smartwatch (Phase 8) im Testmodus: dieselben Regeln wie die Datenbank (import_wearable_batch, resolve/disconnect,
 * Widerruf), Abgleich mit der Beispiel-Uhr, verschlüsselte Warteschlange des Supabase-Modus.
 */

const TODAY = '2026-10-21';
const NOW = '2026-10-21T12:00:00.000Z';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function setup() {
  let counter = 0;
  const backend = createLocalBackend(createMemoryStore(), {
    platform: 'android',
    today: () => TODAY,
    now: () => NOW,
    newId: () => uuid(++counter),
  });
  return backend;
}

async function signedIn(
  consents: ('health_data' | 'wearable_data')[] = ['health_data', 'wearable_data'],
) {
  const backend = setup();
  if (backend.signIn.kind !== 'test_mode') throw new Error('Testmodus erwartet');
  await backend.signIn.start();
  await backend.createProfile('1990-05-15');
  await backend.grantConsents(['terms', 'privacy', ...consents], CURRENT_CONSENT_VERSIONS);
  return backend;
}

function session(
  externalId: string,
  over: Partial<WearableSessionImport> = {},
): WearableSessionImport {
  return {
    external_id: externalId,
    origin: 'samsung_health',
    group: 'run',
    name_de: 'Lauf',
    started_at: '2026-10-20T05:00:00.000Z',
    finished_at: '2026-10-20T05:40:00.000Z',
    performed_on: '2026-10-20',
    duration_s: 2400,
    distance_m: 6000,
    kcal: 400,
    heart_rate: { avg_bpm: 150, max_bpm: 175, zone_s: [0, 300, 1500, 500, 100], hf_max_used: 186 },
    merge_into: null,
    possible_duplicate_of: null,
    ...over,
  };
}

const batch = (
  sessions: WearableSessionImport[],
  days: WearableImportBatch['days'] = [],
): WearableImportBatch => ({
  provider: 'health_connect',
  granted_types: ['exercise', 'heart_rate', 'steps'],
  sessions,
  days,
});

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(BackendError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('Smartwatch im Testmodus: Einwilligung', () => {
  it('ohne wearable_data bzw. ohne health_data: consent_required', async () => {
    const onlyHealth = await signedIn(['health_data']);
    await expectCode(onlyHealth.wearables.importBatches([batch([])]), 'consent_required');
    await expectCode(onlyHealth.wearables.connect(['steps']), 'consent_required');
    const onlyWearable = await signedIn(['wearable_data']);
    await expectCode(onlyWearable.wearables.importBatches([batch([])]), 'consent_required');
  });
});

describe('Smartwatch im Testmodus: Import wie import_wearable_batch', () => {
  it('neue Einheit → freier Eintrag mit Herkunft health_connect, Puls, Tageswerte, Verbindung', async () => {
    const backend = await signedIn();
    const outcome = await backend.wearables.importBatches([
      batch(
        [
          session('hc-1'),
          session('hc-yoga', {
            group: 'other',
            name_de: 'Yoga',
            distance_m: null,
            heart_rate: null,
          }),
        ],
        [
          {
            day: '2026-10-20',
            resting_hr_bpm: 52,
            sleep_min: 430,
            steps: 9000,
            hrv_rmssd_ms: null,
          },
        ],
      ),
    ]);
    expect(outcome).toEqual({
      kind: 'imported',
      result: { created: 2, updated: 0, merged: 0, skipped: 0, days: 1 },
    });
    const { rows } = await backend.loadRows();
    const logs = rows.sessionLogs.filter((l) => l.source === 'health_connect');
    expect(logs.map((l) => [l.kind, l.name_de, l.is_free])).toEqual([
      ['endurance', 'Lauf', true],
      ['strength', 'Yoga', true],
    ]);
    expect(rows.cardioLogs.find((c) => c.session_log_id === logs[0]?.id)).toMatchObject({
      modality: 'run',
      duration_s: 2400,
      distance_m: 6000,
    });
    const w = (await backend.wearables.load()).rows;
    expect(w.connection).toMatchObject({
      status: 'connected',
      granted_types: ['exercise', 'heart_rate', 'steps'],
      last_sync_at: NOW,
      last_sync_count: 2,
    });
    expect(w.heartRates).toHaveLength(1);
    expect(w.dailyMetrics).toMatchObject([{ day: '2026-10-20', steps: 9000, sleep_min: 430 }]);
  });

  it('erneuter Abgleich ändert, legt nie neu an; fehlende Tageswerte bleiben', async () => {
    const backend = await signedIn();
    await backend.wearables.importBatches([
      batch(
        [session('hc-1')],
        [
          {
            day: '2026-10-20',
            resting_hr_bpm: 52,
            sleep_min: null,
            steps: 9000,
            hrv_rmssd_ms: null,
          },
        ],
      ),
    ]);
    const again = await backend.wearables.importBatches([
      batch(
        [session('hc-1', { distance_m: 6100, heart_rate: null })],
        [
          {
            day: '2026-10-20',
            resting_hr_bpm: null,
            sleep_min: 400,
            steps: null,
            hrv_rmssd_ms: null,
          },
        ],
      ),
    ]);
    expect(again).toMatchObject({ result: { created: 0, updated: 1 } });
    const { rows } = await backend.loadRows();
    expect(rows.sessionLogs.filter((l) => l.source === 'health_connect')).toHaveLength(1);
    expect(rows.cardioLogs[0]?.distance_m).toBe(6100);
    const w = (await backend.wearables.load()).rows;
    expect(w.heartRates).toHaveLength(1);
    expect(w.dailyMetrics[0]).toMatchObject({ resting_hr_bpm: 52, sleep_min: 400, steps: 9000 });
  });

  it('Grenzen: falscher Name, zu alt, in der Zukunft, Tag außerhalb → übersprungen', async () => {
    const backend = await signedIn();
    const outcome = await backend.wearables.importBatches([
      batch(
        [
          session('a', { name_de: 'Mein Lauf' }),
          session('b', {
            started_at: '2026-08-01T05:00:00.000Z',
            finished_at: '2026-08-01T05:40:00.000Z',
            performed_on: '2026-08-01',
          }),
          session('c', {
            started_at: '2026-10-21T13:00:00.000Z',
            finished_at: '2026-10-21T13:40:00.000Z',
            performed_on: '2026-10-21',
          }),
        ],
        [
          {
            day: '2026-07-01',
            resting_hr_bpm: 50,
            sleep_min: null,
            steps: null,
            hrv_rmssd_ms: null,
          },
        ],
      ),
    ]);
    expect(outcome).toMatchObject({ result: { created: 0, skipped: 4, days: 0 } });
  });
});

describe('Smartwatch im Testmodus: Zusammenführen, Doppel, Trennen, Widerruf', () => {
  /** Eigener manueller Lauf (App) mit Uhrzeit – direkt als Zeilen (reine Funktionen wie die Datenbank). */
  function rowsWithOwnRun(userId = 'me'): UserRows {
    const rows = emptyUserRows();
    rows.sessionLogs.push({
      id: uuid(100),
      user_id: userId,
      planned_session_id: null,
      kind: 'endurance',
      performed_on: '2026-10-20',
      started_at: '2026-10-20T05:00:30.000Z',
      finished_at: '2026-10-20T05:40:00.000Z',
      status: 'completed',
      session_rpe: null,
      notes: null,
      name_de: 'Lauf',
      is_intro_week: false,
      is_deload: false,
      from_health_plan: false,
      is_free: true,
      revision: 1,
      last_write_id: uuid(101),
      source: 'gps',
      client_updated_at: NOW,
      created_at: NOW,
      updated_at: NOW,
      sport: null,
      sport_duration_s: null,
      sport_distance_m: null,
    });
    rows.cardioLogs.push({
      session_log_id: uuid(100),
      user_id: userId,
      modality: 'run',
      duration_s: 2370,
      distance_m: 6200,
      elevation_m: 40,
      e_bike: false,
    });
    return rows;
  }
  const ctx = {
    userId: 'me',
    now: NOW,
    today: TODAY,
    newId: () => uuid(Math.floor(Math.random() * 1e9)),
  };

  it('merge_into: eigener Eintrag bleibt führend (Herkunft, Distanz), Uhr ergänzt Puls und kcal', () => {
    const applied = applyWearableImport(
      EMPTY_LOCAL_WEARABLES,
      rowsWithOwnRun(),
      batch([session('watch', { merge_into: uuid(100) })]),
      ctx,
    );
    expect(applied.result).toMatchObject({ created: 0, merged: 1 });
    expect(applied.rows.sessionLogs).toHaveLength(1);
    expect(applied.rows.sessionLogs[0]?.source).toBe('gps');
    expect(applied.rows.cardioLogs[0]?.distance_m).toBe(6200);
    const w = wearableRowsFor(applied.store, applied.rows, 'me');
    expect(w.sessions[0]).toMatchObject({ session_log_id: uuid(100), merged: true, kcal: 400 });
    expect(w.heartRates[0]?.session_log_id).toBe(uuid(100));
    // Trennen „löschen“: der eigene Eintrag bleibt, nur die Verknüpfung und der Puls gehen.
    const gone = applyWearableDisconnect(applied.store, applied.rows, true, 'me');
    expect(gone.deleted).toBe(0);
    expect(gone.rows.sessionLogs).toHaveLength(1);
    expect(wearableRowsFor(gone.store, gone.rows, 'me')).toMatchObject({
      sessions: [],
      heartRates: [],
    });
  });

  it('merge_into auf fremden Eintrag bzw. andere Sportart → neue Einheit', () => {
    const foreign = applyWearableImport(
      EMPTY_LOCAL_WEARABLES,
      rowsWithOwnRun('jemand-anderes'),
      batch([session('watch', { merge_into: uuid(100) })]),
      ctx,
    );
    expect(foreign.result).toMatchObject({ created: 1, merged: 0 });
    const bike = applyWearableImport(
      EMPTY_LOCAL_WEARABLES,
      rowsWithOwnRun(),
      batch([session('watch', { group: 'bike', name_de: 'Radfahrt', merge_into: uuid(100) })]),
      ctx,
    );
    expect(bike.result).toMatchObject({ created: 1, merged: 0 });
  });

  it('Doppel-Hinweis zusammenführen: übernommener Eintrag weg, Puls beim eigenen Eintrag', () => {
    const applied = applyWearableImport(
      EMPTY_LOCAL_WEARABLES,
      rowsWithOwnRun(),
      batch([session('watch', { possible_duplicate_of: uuid(100) })]),
      ctx,
    );
    const imported = applied.store.sessions[0];
    expect(imported?.duplicate_of).toBe(uuid(100));
    const merged = applyWearableResolve(
      applied.store,
      applied.rows,
      imported?.session_log_id ?? '',
      true,
      ctx,
    );
    if (merged === 'not_found' || merged === 'invalid') throw new Error(merged);
    expect(merged.rows.sessionLogs.map((l) => l.id)).toEqual([uuid(100)]);
    const w = wearableRowsFor(merged.store, merged.rows, 'me');
    expect(w.sessions[0]).toMatchObject({
      session_log_id: uuid(100),
      merged: true,
      duplicate_of: null,
    });
    expect(w.heartRates[0]?.session_log_id).toBe(uuid(100));
    expect(applyWearableResolve(merged.store, merged.rows, uuid(100), false, ctx)).toBe(
      'not_found',
    );
  });

  it('möglicher Doppel-Eintrag: behalten bzw. zusammenführen', async () => {
    const backend = await signedIn();
    await backend.wearables.importBatches([batch([session('first')])]);
    await backend.wearables.disconnect(false);
    // „first“ ist jetzt ein normaler Eintrag; seine Verknüpfung bleibt (behalten) – für den Doppel-Test brauchen wir
    // einen Eintrag OHNE Verknüpfung: frisches Konto mit Löschen.
    const { rows } = await backend.loadRows();
    const target = rows.sessionLogs[0]?.id ?? '';
    await backend.wearables.importBatches([
      batch([
        session('dup', {
          started_at: '2026-10-20T05:30:00.000Z',
          finished_at: '2026-10-20T06:10:00.000Z',
          possible_duplicate_of: target,
        }),
      ]),
    ]);
    let w = (await backend.wearables.load()).rows;
    const dup = w.sessions.find((s) => s.external_id === 'dup');
    expect(dup?.duplicate_of).toBe(target);
    // Zusammenführen scheitert: Ziel hat schon eine Uhr-Einheit (behalten).
    await expectCode(
      backend.wearables.resolveDuplicate(dup?.session_log_id ?? '', true),
      'wearable_rejected',
    );
    await backend.wearables.resolveDuplicate(dup?.session_log_id ?? '', false);
    w = (await backend.wearables.load()).rows;
    expect(w.sessions.find((s) => s.external_id === 'dup')?.duplicate_of).toBeNull();
    await expectCode(
      backend.wearables.resolveDuplicate(dup?.session_log_id ?? '', false),
      'wearable_rejected',
    );
  });

  it('Trennen „löschen“: Uhr-Einträge weg, Puls und Tageswerte immer weg', async () => {
    const backend = await signedIn();
    await backend.wearables.importBatches([
      batch(
        [
          session('x1'),
          session('x2', {
            started_at: '2026-10-19T05:00:00.000Z',
            finished_at: '2026-10-19T05:40:00.000Z',
            performed_on: '2026-10-19',
          }),
        ],
        [
          {
            day: '2026-10-20',
            resting_hr_bpm: 52,
            sleep_min: null,
            steps: null,
            hrv_rmssd_ms: null,
          },
        ],
      ),
    ]);
    expect(await backend.wearables.disconnect(true)).toBe(2);
    const { rows } = await backend.loadRows();
    expect(rows.sessionLogs).toHaveLength(0);
    expect((await backend.wearables.load()).rows).toEqual({
      connection: null,
      sessions: [],
      heartRates: [],
      dailyMetrics: [],
    });
  });

  it('Widerruf wearable_data: Puls, Tageswerte, Verbindung weg – Einträge bleiben; Export enthält die Tabellen', async () => {
    const backend = await signedIn();
    await backend.wearables.importBatches([
      batch(
        [session('r1')],
        [
          {
            day: '2026-10-20',
            resting_hr_bpm: 52,
            sleep_min: null,
            steps: null,
            hrv_rmssd_ms: null,
          },
        ],
      ),
    ]);
    const file = await backend.exportMyData();
    expect(file.data.heart_rate_summaries).toHaveLength(1);
    expect(file.data.daily_metrics).toHaveLength(1);
    expect(file.data.wearable_sessions).toHaveLength(1);
    expect(file.data.wearable_connections).toHaveLength(1);
    await backend.revokeConsent('wearable_data');
    const w = (await backend.wearables.load()).rows;
    expect(w.heartRates).toEqual([]);
    expect(w.dailyMetrics).toEqual([]);
    expect(w.connection).toBeNull();
    expect(w.sessions).toHaveLength(1);
    expect((await backend.loadRows()).rows.sessionLogs).toHaveLength(1);
    await expectCode(backend.wearables.importBatches([batch([])]), 'consent_required');
  });

  it('Widerruf health_data löscht ebenfalls Puls und Tageswerte', async () => {
    const backend = await signedIn();
    await backend.wearables.importBatches([
      batch(
        [session('h1')],
        [
          {
            day: '2026-10-20',
            resting_hr_bpm: 52,
            sleep_min: null,
            steps: null,
            hrv_rmssd_ms: null,
          },
        ],
      ),
    ]);
    await backend.revokeConsent('health_data');
    const w = (await backend.wearables.load()).rows;
    expect(w.heartRates).toEqual([]);
    expect(w.dailyMetrics).toEqual([]);
  });

  it('gelöschter Eintrag: Uhr-Verknüpfung und Puls fallen mit (Kaskade)', async () => {
    const backend = await signedIn();
    await backend.wearables.importBatches([batch([session('c1')])]);
    const log = (await backend.loadRows()).rows.sessionLogs[0];
    await backend.deleteSessionLog(log?.id ?? '', log?.revision ?? 1);
    const w = (await backend.wearables.load()).rows;
    expect(w.sessions).toEqual([]);
    expect(w.heartRates).toEqual([]);
  });
});

describe('Abgleich mit der Beispiel-Uhr (runWearableSync)', () => {
  it('erster Abgleich übernimmt die Woche (Puls mit HFmax aus dem Alter); zweiter ändert nur', async () => {
    const backend = await signedIn();
    const driver = createDemoHealthConnectDriver(() => TODAY);
    await backend.wearables.connect(await driver.requestPermissions());
    const first = await runWearableSync({
      driver,
      backend: backend.wearables,
      rows: (await backend.loadRows()).rows,
      wearable: (await backend.wearables.load()).rows,
      now: NOW,
      today: TODAY,
    });
    expect(first).toMatchObject({
      kind: 'imported',
      result: { created: 5, merged: 0, skipped: 0 },
    });
    const rows = (await backend.loadRows()).rows;
    expect(rows.sessionLogs.filter((l) => l.source === 'health_connect')).toHaveLength(5);
    const w = (await backend.wearables.load()).rows;
    expect(w.heartRates.length).toBe(4);
    expect(w.heartRates.every((h) => h.hf_max_used === 183)).toBe(true); // 36 Jahre → 208 − 25,2 = 182,8
    expect(w.dailyMetrics.length).toBeGreaterThan(0);
    const second = await runWearableSync({
      driver,
      backend: backend.wearables,
      rows,
      wearable: w,
      now: NOW,
      today: TODAY,
    });
    expect(second).toMatchObject({ kind: 'imported', result: { created: 0, merged: 0 } });
  });

  it('ohne Rechte in Health Connect → „Zugriff fehlt“', async () => {
    const backend = await signedIn();
    await backend.wearables.connect(['steps']);
    const driver: HealthConnectDriver = {
      ...createDemoHealthConnectDriver(() => TODAY),
      grantedTypes: async () => [],
    };
    const outcome = await runWearableSync({
      driver,
      backend: backend.wearables,
      rows: (await backend.loadRows()).rows,
      wearable: (await backend.wearables.load()).rows,
      now: NOW,
      today: TODAY,
    });
    expect(outcome).toEqual({ kind: 'permission_missing' });
    expect((await backend.wearables.load()).rows.connection?.status).toBe('permission_missing');
  });

  it('Browser/iPhone ohne Health Connect → nicht verfügbar', async () => {
    const backend = await signedIn();
    const driver: HealthConnectDriver = {
      ...createDemoHealthConnectDriver(() => TODAY),
      availability: async () => 'unsupported',
    };
    const outcome = await runWearableSync({
      driver,
      backend: backend.wearables,
      rows: (await backend.loadRows()).rows,
      wearable: (await backend.wearables.load()).rows,
      now: NOW,
      today: TODAY,
    });
    expect(outcome).toEqual({ kind: 'unavailable', availability: 'unsupported' });
  });

  it('Beispieldaten: feste IDs, nur im Zeitraum', () => {
    const all = demoRead(TODAY, '2026-01-01T00:00:00.000Z', NOW);
    expect(all.sessions.map((s) => s.record.id)).toContain('demo-run-2026-10-15');
    expect(new Set(all.sessions.map((s) => s.record.id)).size).toBe(all.sessions.length);
    expect(demoRead(TODAY, NOW, NOW).sessions).toEqual([]);
  });
});

describe('Warteschlange (Supabase-Modus, offline-first)', () => {
  const owner = 'user-1';
  function queue(
    send: (b: WearableImportBatch) => Promise<WearableSendResult>,
    pending: string[] = [],
  ) {
    const store = createMemoryProtectedStore();
    return {
      store,
      q: new WearableQueue({
        store,
        send,
        isLogPending: (id) => pending.includes(id),
        currentUserId: () => owner,
      }),
    };
  }
  const ok: WearableSendResult = {
    kind: 'ok',
    result: { created: 1, updated: 0, merged: 0, skipped: 0, days: 0 },
  };

  it('senden, Teilerfolge bleiben stehen, Rest wartet bei Netzfehler', async () => {
    let calls = 0;
    const { q } = queue(async () => (++calls === 1 ? ok : { kind: 'retry' }));
    await q.add([batch([session('a')]), batch([session('b')])], owner);
    const first = await q.flush();
    expect(first).toMatchObject({ state: 'later', result: { created: 1 } });
    expect(await q.size()).toBe(1);
  });

  it('Einwilligung fehlt → alles verwerfen (keine Gesundheitsdaten ohne Einwilligung aufbewahren)', async () => {
    const { q } = queue(async () => ({ kind: 'consent' }));
    await q.add([batch([session('a')]), batch([session('b')])], owner);
    expect((await q.flush()).state).toBe('consent');
    expect(await q.size()).toBe(0);
  });

  it('wartet, solange ein Ziel-Eintrag noch in der Tagebuch-Warteschlange liegt', async () => {
    const { q } = queue(async () => ok, [uuid(9)]);
    await q.add([batch([session('a', { merge_into: uuid(9) })])], owner);
    expect((await q.flush()).state).toBe('later');
    expect(await q.size()).toBe(1);
  });

  it('verschlüsselter Speicher: anderes Konto sieht nichts; Trennen leert', async () => {
    const { q, store } = queue(async () => ok);
    await q.add([batch([session('a')])], 'anderes-konto');
    expect(await q.size()).toBe(0);
    expect(store.peek()).not.toBeNull();
    await q.discardAll();
    await q.clear();
    expect(store.peek()).toBeNull();
  });
});

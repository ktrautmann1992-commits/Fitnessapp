import {
  CURRENT_CONSENT_VERSIONS,
  releasedWatchRoute,
  type WearableImportBatch,
  type WearableRoutePayload,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { createDemoHealthConnectDriver, demoRead, demoRoute } from '../lib/health-connect-demo';
import { BackendError } from './backend';
import { createMemoryStore } from './kv';
import { createLocalBackend } from './local-backend';
import { createMemoryProtectedStore } from './protected-store';
import { WearableQueue, type WearableSendResult } from './wearable-queue';
import { runWearableSync } from './wearable-sync';

/**
 * Routen der Uhr (23.10.2026) im Testmodus: dieselben Regeln wie save_wearable_route und die Trigger der Migration
 * 20261023120100_wearable_routes.sql; Abgleich mit der Beispiel-Uhr; Warteschlange des Supabase-Modus.
 */

const TODAY = '2026-10-21';
const NOW = '2026-10-21T12:00:00.000Z';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function signedIn() {
  let counter = 0;
  const backend = createLocalBackend(createMemoryStore(), {
    platform: 'android',
    today: () => TODAY,
    now: () => NOW,
    newId: () => uuid(++counter),
  });
  if (backend.signIn.kind !== 'test_mode') throw new Error('Testmodus erwartet');
  await backend.signIn.start();
  await backend.createProfile('1990-05-15');
  await backend.grantConsents(
    ['terms', 'privacy', 'health_data', 'wearable_data'],
    CURRENT_CONSENT_VERSIONS,
  );
  return backend;
}

async function synced() {
  const backend = await signedIn();
  const driver = createDemoHealthConnectDriver(() => TODAY);
  await backend.wearables.connect(await driver.requestPermissions());
  const sync = async (routeBackfill = false) =>
    runWearableSync({
      driver,
      backend: backend.wearables,
      rows: (await backend.loadRows()).rows,
      wearable: (await backend.wearables.load()).rows,
      now: NOW,
      today: TODAY,
      trackedRoutes: (await backend.loadTrackedRoutes()).routes,
      routeBackfill,
    });
  const first = await sync();
  return { backend, driver, sync, first };
}

const watchRoutes = async (backend: Awaited<ReturnType<typeof signedIn>>) =>
  (await backend.loadTrackedRoutes()).routes.filter((r) => r.source === 'watch');

describe('Abgleich mit Routen (Beispiel-Uhr)', () => {
  it('zwei Läufe mit Route: Strecke „watch“ am Eintrag, Distanz aus der Route; ältester fragt nach Freigabe', async () => {
    const { backend, first } = await synced();
    expect(first).toMatchObject({ kind: 'imported', routeConsentRequired: 1 });
    const routes = await watchRoutes(backend);
    expect(routes).toHaveLength(2);
    const rows = (await backend.loadRows()).rows;
    for (const route of routes) {
      expect(route.wearable_session_log_id).toBe(route.session_log_id);
      expect(route.name).toBe('Lauf');
      expect(route.km_splits).toHaveLength(Math.floor(route.distance_m / 1000));
      const cardio = rows.cardioLogs.find((c) => c.session_log_id === route.session_log_id);
      // Route ca. 5,55 km statt 5,5/5,8 km laut Health Connect.
      expect(cardio?.distance_m).toBe(route.distance_m);
      expect(route.distance_m).toBeGreaterThan(5400);
      expect(route.distance_m).toBeLessThan(5700);
      expect(cardio?.elevation_m).toBe(route.elevation_gain_m);
    }
    // Ältester Lauf ohne Route: Distanz laut Health Connect.
    const oldest = rows.cardioLogs.find((c) => c.distance_m === 5200);
    expect(oldest).toBeDefined();
  });

  it('erneuter Abgleich: keine zweite Route, Distanz bleibt aus der Route', async () => {
    const { backend, sync } = await synced();
    const before = await watchRoutes(backend);
    const second = await sync();
    expect(second).toMatchObject({ kind: 'imported', result: { created: 0 } });
    const after = await watchRoutes(backend);
    expect(after.map((r) => [r.id, r.distance_m])).toEqual(before.map((r) => [r.id, r.distance_m]));
  });

  it('„Route freigeben“: Freigabe je Einheit legt die Route an, Distanz folgt', async () => {
    const { backend, driver } = await synced();
    const wearable = (await backend.wearables.load()).rows;
    const oldest = wearable.sessions.find((s) => s.external_id.startsWith('demo-run-2026-10-15'));
    expect(oldest).toBeDefined();
    if (!oldest) return;
    const cardio = (await backend.loadRows()).rows.cardioLogs.find(
      (c) => c.session_log_id === oldest.session_log_id,
    );
    const released = releasedWatchRoute(await driver.requestRoute(oldest.external_id), {
      externalId: oldest.external_id,
      group: 'run',
      startedAt: oldest.started_at,
      finishedAt: oldest.finished_at,
      currentDistanceM: cardio?.distance_m ?? null,
    });
    expect(released.kind).toBe('ok');
    if (released.kind !== 'ok') return;
    await backend.wearables.saveRoute(released.payload);
    expect(await watchRoutes(backend)).toHaveLength(3);
    const after = (await backend.loadRows()).rows.cardioLogs.find(
      (c) => c.session_log_id === oldest.session_log_id,
    );
    expect(after?.distance_m).toBe(released.payload.distance_m);
  });

  it('gelöschte Route kommt beim Abgleich nicht wieder; „Route freigeben“ legt sie wieder an', async () => {
    const { backend, sync } = await synced();
    const [route] = await watchRoutes(backend);
    if (!route) throw new Error('Route erwartet');
    await backend.deleteTrackedRoute(route.id);
    await sync();
    expect(await watchRoutes(backend)).toHaveLength(1);
    const ext = (await backend.wearables.load()).rows.sessions.find(
      (s) => s.session_log_id === route.wearable_session_log_id,
    )?.external_id;
    const day = /^demo-run-(.+)$/.exec(ext ?? '')?.[1] ?? '';
    const points = demoRoute(new Date(`${day}T07:00:00`).toISOString(), 35);
    const payload = releasedWatchRoute(
      { kind: 'points', points },
      {
        externalId: ext ?? '',
        group: 'run',
        startedAt: points[0]?.time ?? '',
        finishedAt: points.at(-1)?.time ?? '',
        currentDistanceM: null,
      },
    );
    if (payload.kind !== 'ok') throw new Error('Route erwartet');
    await backend.wearables.saveRoute(payload.payload);
    expect(await watchRoutes(backend)).toHaveLength(2);
  });

  it('Eintrag gelöscht → seine Route geht mit; Trennen „behalten“ und Widerruf löschen alle Routen der Uhr', async () => {
    const { backend } = await synced();
    const [route] = await watchRoutes(backend);
    if (!route?.session_log_id) throw new Error('Route erwartet');
    const log = (await backend.loadRows()).rows.sessionLogs.find(
      (l) => l.id === route.session_log_id,
    );
    await backend.deleteSessionLog(route.session_log_id, log?.revision ?? 1);
    expect(await watchRoutes(backend)).toHaveLength(1);
    await backend.wearables.disconnect(false);
    expect(await watchRoutes(backend)).toHaveLength(0);

    const again = await synced();
    expect(await watchRoutes(again.backend)).toHaveLength(2);
    await again.backend.revokeConsent('wearable_data');
    expect(await watchRoutes(again.backend)).toHaveLength(0);
  });

  it('ohne Einwilligung: Route speichern abgelehnt', async () => {
    const { backend } = await synced();
    await backend.revokeConsent('wearable_data');
    const promise = backend.wearables.saveRoute({
      external_id: 'demo-run-2026-10-17',
      distance_m: 2100,
      moving_s: 700,
      elevation_gain_m: null,
      polyline: '_p~iF~ps|U_ulLnnqC',
      km_splits: [330, 340],
      elevation_profile: null,
    });
    await expect(promise).rejects.toBeInstanceOf(BackendError);
    await expect(promise).rejects.toMatchObject({ code: 'consent_required' });
  });

  it('Nachladen (einmalig 30 Tage): nur schon übernommene Einheiten, gelöschte kommen nicht zurück', async () => {
    const { backend, sync } = await synced();
    const rows = (await backend.loadRows()).rows;
    // Kraft-Einheit vom 18.10. (vor dem normalen Zeitraum von 48 h).
    const strength = rows.sessionLogs.find((l) => l.name_de === 'Freie Kraft-Einheit');
    if (!strength) throw new Error('Kraft-Einheit erwartet');
    await backend.deleteSessionLog(strength.id, strength.revision);
    // Letzter Abgleich gerade eben → normaler Zeitraum nur 48 h; Nachladen liest 30 Tage.
    const outcome = await sync(true);
    expect(outcome.kind).toBe('imported');
    const after = (await backend.loadRows()).rows;
    expect(after.sessionLogs.some((l) => l.name_de === 'Freie Kraft-Einheit')).toBe(false);
    expect(after.sessionLogs.filter((l) => l.source === 'health_connect')).toHaveLength(4);
  });

  it('Beispiel-Route: feste Runde (Tempelhofer Feld), ein Punkt je Sekunde, deterministisch', () => {
    const a = demoRoute('2026-10-17T05:00:00.000Z', 35);
    expect(a).toHaveLength(35 * 60 + 1);
    expect(demoRoute('2026-10-17T05:00:00.000Z', 35)).toEqual(a);
    const read = demoRead(TODAY, '2026-01-01T00:00:00.000Z', NOW);
    const kinds = read.sessions
      .filter((s) => s.record.id.startsWith('demo-run'))
      .map((s) => s.extras.route?.kind);
    expect(kinds).toEqual(['consent_required', 'points', 'points']);
  });
});

describe('Warteschlange: Routen nach den Abgleichen', () => {
  const owner = 'user-1';
  const route: WearableRoutePayload = {
    external_id: 'a',
    distance_m: 2100,
    moving_s: 700,
    elevation_gain_m: null,
    polyline: '_p~iF~ps|U_ulLnnqC',
    km_splits: [330, 340],
    elevation_profile: null,
  };
  const batch: WearableImportBatch = {
    provider: 'health_connect',
    granted_types: ['exercise'],
    sessions: [],
    days: [],
  };
  const ok: WearableSendResult = {
    kind: 'ok',
    result: { created: 0, updated: 0, merged: 0, skipped: 0, days: 0 },
  };

  it('Routen erst nach allen Abgleichen; bei Netzfehler warten beide', async () => {
    const calls: string[] = [];
    let batchResult: WearableSendResult = { kind: 'retry' };
    const q = new WearableQueue({
      store: createMemoryProtectedStore(),
      send: async () => {
        calls.push('batch');
        return batchResult;
      },
      sendRoute: async (r) => {
        calls.push(`route:${r.external_id}`);
        return { kind: 'ok' };
      },
      isLogPending: () => false,
      currentUserId: () => owner,
    });
    await q.add([batch], owner, [route]);
    expect((await q.flush()).state).toBe('later');
    expect(calls).toEqual(['batch']);
    batchResult = ok;
    expect((await q.flush()).state).toBe('done');
    expect(calls).toEqual(['batch', 'batch', 'route:a']);
  });

  it('je Einheit nur die neueste Route; Einwilligung fehlt → alles verworfen', async () => {
    const sent: number[] = [];
    let answer: 'ok' | 'consent' = 'consent';
    const q = new WearableQueue({
      store: createMemoryProtectedStore(),
      send: async () => ok,
      sendRoute: async (r) => {
        sent.push(r.distance_m);
        return { kind: answer };
      },
      isLogPending: () => false,
      currentUserId: () => owner,
    });
    await q.add([], owner, [route]);
    await q.add([], owner, [{ ...route, distance_m: 2200, km_splits: [330, 340] }]);
    expect((await q.flush()).state).toBe('consent');
    expect(sent).toEqual([2200]);
    answer = 'ok';
    expect((await q.flush()).state).toBe('done');
    expect(sent).toEqual([2200]);
  });
});

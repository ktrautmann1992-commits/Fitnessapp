import { encodePolyline, type TrackedRoutePayload, type TrackedRouteRow } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { createMemoryProtectedStore } from './protected-store';
import { RouteQueue, type RouteSendResult } from './route-queue';
import { classifyRouteError } from './supabase-backend';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function payload(n: number, sessionLogId: string | null = null): TrackedRoutePayload {
  return {
    id: id(n),
    name: `Runde ${n}`,
    sport: 'run',
    started_at: '2026-10-03T08:00:00.000Z',
    duration_s: 1800,
    moving_s: 1750,
    distance_m: 5200,
    elevation_gain_m: 12,
    polyline: encodePolyline([
      { lat: 50.9, lng: 6.9 },
      { lat: 50.95, lng: 6.9 },
    ]),
    km_splits: [340, 335, 338, 341, 330],
    difficulty: null,
    is_favorite: false,
    base_route_id: null,
    note: null,
    session_log_id: sessionLogId,
    source: 'recorded',
  };
}

function setup(results: RouteSendResult[], pendingLogs: Set<string> = new Set()) {
  const store = createMemoryProtectedStore();
  const sent: TrackedRoutePayload[] = [];
  let user: string | null = 'user-a';
  const queue = new RouteQueue({
    store,
    send: async (p) => {
      sent.push(p);
      return results.shift() ?? 'ok';
    },
    isLogPending: (logId) => pendingLogs.has(logId),
    currentUserId: () => user,
  });
  return { store, sent, queue, setUser: (u: string | null) => (user = u) };
}

describe('Strecken-Warteschlange (Etappe E4)', () => {
  it('sendet nacheinander; ok → entfernt; verschlüsselter Speicher hält den Stand', async () => {
    const { queue, sent, store } = setup(['ok', 'ok']);
    await queue.add(payload(1), 'user-a');
    await queue.add(payload(2), 'user-a');
    expect(await queue.size()).toBe(2);
    expect(store.peek()).toContain('Runde 1');
    await expect(queue.flush()).resolves.toBe('done');
    expect(sent.map((p) => p.id)).toEqual([id(1), id(2)]);
    expect(await queue.entries()).toEqual([]);
  });

  it('wartet auf den verknüpften Tagebuch-Eintrag (erst save_session_log, dann save_tracked_route)', async () => {
    const pending = new Set([id(99)]);
    const { queue, sent } = setup([], pending);
    await queue.add(payload(1, id(99)), 'user-a');
    await expect(queue.flush()).resolves.toBe('later');
    expect(sent).toEqual([]);
    pending.clear();
    await expect(queue.flush()).resolves.toBe('done');
    expect(sent).toHaveLength(1);
  });

  it('offline → später erneut (Reihenfolge bleibt), Verknüpfung passt nicht → ohne Verweise erneut', async () => {
    const { queue, sent } = setup(['retry']);
    await queue.add(payload(1), 'user-a');
    await expect(queue.flush()).resolves.toBe('later');
    expect(await queue.size()).toBe(1);
    const second = setup(['unlink', 'ok']);
    await second.queue.add({ ...payload(2, id(77)), base_route_id: id(55) }, 'user-a');
    await second.queue.flush();
    expect(second.sent[1]).toMatchObject({ session_log_id: null, base_route_id: null });
    expect(await second.queue.entries()).toEqual([]);
    expect(sent).toHaveLength(1);
  });

  it('abgelehnt → bleibt sichtbar (nie still weg); erneut versuchen bzw. verwerfen', async () => {
    const { queue } = setup(['reject', 'ok']);
    await queue.add(payload(1), 'user-a');
    await queue.flush();
    expect((await queue.entries())[0]?.state).toBe('rejected');
    expect(await queue.size()).toBe(0);
    await queue.retry(id(1));
    await queue.flush();
    expect(await queue.entries()).toEqual([]);
    await queue.add(payload(2), 'user-a');
    await queue.discard(id(2));
    expect(await queue.entries()).toEqual([]);
  });

  it('gehört einem Konto: anderes Konto sieht nichts und sendet nichts; Zwischenstand der Liste', async () => {
    const { queue, sent, setUser } = setup([]);
    await queue.add(payload(1), 'user-a');
    await queue.writeCache([{ id: id(5) } as TrackedRouteRow], 'user-a');
    setUser('user-b');
    expect(await queue.entries()).toEqual([]);
    expect(await queue.readCache()).toBeNull();
    await queue.flush();
    expect(sent).toEqual([]);
    setUser('user-a');
    expect((await queue.readCache())?.[0]?.id).toBe(id(5));
    await queue.clear();
    expect(await queue.entries()).toEqual([]);
  });

  it('kaputter Speicher bzw. ungültige Einträge werden nie gesendet', async () => {
    const store = createMemoryProtectedStore();
    await store.write(
      JSON.stringify({
        format: 1,
        owner: 'user-a',
        entries: [{ payload: { id: 'x' }, state: 'waiting' }],
        cache: null,
      }),
    );
    const sent: unknown[] = [];
    const queue = new RouteQueue({
      store,
      send: async (p) => {
        sent.push(p);
        return 'ok';
      },
      isLogPending: () => false,
      currentUserId: () => 'user-a',
    });
    expect(await queue.entries()).toEqual([]);
    await queue.flush();
    expect(sent).toEqual([]);
  });
});

describe('classifyRouteError', () => {
  it.each([
    [{ message: 'Failed to fetch' }, 'retry'],
    [{ code: '57014', message: 'canceling statement due to statement timeout' }, 'retry'],
    [{ code: '40P01', message: 'deadlock' }, 'retry'],
    [{ code: 'P0001', message: 'x', status: 503 }, 'retry'],
    [{ code: '22023', message: 'Dieser Eintrag passt nicht zur Strecke.' }, 'unlink'],
    [{ code: '22023', message: 'Die Favoriten-Strecke wurde nicht gefunden.' }, 'unlink'],
    [{ code: '54000', message: 'Heute wurden schon zu viele Strecken gespeichert.' }, 'reject'],
    [{ code: '22023', message: 'Ungültige Angaben zur Strecke.' }, 'reject'],
  ])('%j → %s', (error, expected) => {
    expect(classifyRouteError(error)).toBe(expected);
  });
});

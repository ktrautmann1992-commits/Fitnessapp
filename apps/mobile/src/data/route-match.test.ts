import type { TrackedRouteRow } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { applyAutoMatches, resetAutoMatchFailures } from './route-match';
import {
  applyRouteAutoMatch,
  applyRouteMatch,
  applyTrackedRouteDelete,
} from './tracked-route-rows';
import { normalizeRouteRow } from './wearable-route-rows';

/**
 * „Meine Strecken“ im Testmodus (25.10.2026): dieselben Regeln wie set_route_match / set_route_auto_match und der
 * Trigger tracked_routes_route_match (supabase/tests/68_route_match.test.sql), plus der Erkennungs-Durchgang.
 */

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-10-25T09:00:00.000Z';
const ctx = { userId: ME, now: NOW };

// Gerade Linie ~5 km (Polyline aus dem Core-Format; Inhalt egal für die Regeln hier).
const LINE = '_p~iF~ps|U_ulLnnqC';

function row(id: string, changes: Partial<TrackedRouteRow> = {}): TrackedRouteRow {
  return {
    id,
    user_id: ME,
    name: id,
    sport: 'run',
    started_at: '2026-10-20T07:00:00Z',
    duration_s: 1900,
    moving_s: 1800,
    distance_m: 5000,
    elevation_gain_m: null,
    polyline: LINE,
    point_count: 2,
    bbox: [38.5, -120.95, 40.7, -120.2],
    km_splits: [360, 360, 360, 360, 360],
    difficulty: null,
    is_favorite: false,
    base_route_id: null,
    note: null,
    session_log_id: null,
    source: 'recorded',
    elevation_profile: null,
    wearable_session_log_id: null,
    e_bike: false,
    route_match: null,
    match_rejected_ids: [],
    auto_match: true,
    created_at: NOW,
    updated_at: NOW,
    ...changes,
  };
}

const fav = row('fav', { is_favorite: true });
const fav2 = row('fav2', { is_favorite: true, distance_m: 5200 });
const run = row('run', { distance_m: 5100 });

const stateOf = (routes: TrackedRouteRow[], id: string) => {
  const r = routes.find((x) => x.id === id) as TrackedRouteRow;
  return [r.route_match, r.base_route_id, r.match_rejected_ids.length];
};

describe('applyRouteMatch (wie set_route_match)', () => {
  it('auto → Nein → auto unverändert → Rückgängig → Ja', () => {
    let routes = [fav, fav2, run];
    let r = applyRouteMatch(routes, { routeId: 'run', favoriteId: 'fav', state: 'auto' }, ctx);
    expect(r.kind === 'ok' && r.outcome).toBe('auto');
    routes = r.kind === 'ok' ? r.routes : routes;
    expect(stateOf(routes, 'run')).toEqual(['auto', 'fav', 0]);
    r = applyRouteMatch(routes, { routeId: 'run', favoriteId: 'fav2', state: 'auto' }, ctx);
    expect(r.kind === 'ok' && r.outcome).toBe('unchanged');
    r = applyRouteMatch(routes, { routeId: 'run', favoriteId: 'fav', state: 'rejected' }, ctx);
    routes = r.kind === 'ok' ? r.routes : routes;
    expect(stateOf(routes, 'run')).toEqual(['rejected', null, 1]);
    r = applyRouteMatch(routes, { routeId: 'run', favoriteId: 'fav', state: 'auto' }, ctx);
    expect(r.kind === 'ok' && r.outcome).toBe('unchanged');
    r = applyRouteMatch(routes, { routeId: 'run', favoriteId: 'fav', state: 'clear' }, ctx);
    routes = r.kind === 'ok' ? r.routes : routes;
    expect(stateOf(routes, 'run')).toEqual([null, null, 0]);
    r = applyRouteMatch(routes, { routeId: 'run', favoriteId: 'fav', state: 'confirmed' }, ctx);
    routes = r.kind === 'ok' ? r.routes : routes;
    expect(stateOf(routes, 'run')).toEqual(['confirmed', 'fav', 0]);
  });

  it('abgelehnt: fremd, andere Sportart, +12 %, kein Favorit, sie selbst, Lauf ist selbst Favorit', () => {
    const routes = [
      fav,
      run,
      row('bike', { sport: 'bike', is_favorite: true }),
      row('long', { distance_m: 5600 }),
    ];
    const reason = (routeId: string, favoriteId: string, userId = ME) => {
      const r = applyRouteMatch(
        routes,
        { routeId, favoriteId, state: 'confirmed' },
        { userId, now: NOW },
      );
      return r.kind === 'reject' ? r.reason : 'ok';
    };
    expect(reason('run', 'fav', OTHER)).toBe('not_found');
    expect(reason('run', 'bike')).toBe('no_match');
    expect(reason('long', 'fav')).toBe('no_match');
    expect(reason('long', 'run')).toBe('no_match');
    expect(reason('run', 'run')).toBe('invalid');
    expect(reason('fav', 'bike')).toBe('no_match');
  });

  it('Ablehnungsliste höchstens 20, neueste hinten', () => {
    const many = Array.from({ length: 20 }, (_, i) => `x${i}`);
    const r = applyRouteMatch(
      [fav, { ...run, match_rejected_ids: many }],
      { routeId: 'run', favoriteId: 'fav', state: 'rejected' },
      ctx,
    );
    const list = r.kind === 'ok' ? r.routes.find((x) => x.id === 'run')?.match_rejected_ids : [];
    expect(list).toHaveLength(20);
    expect(list?.at(-1)).toBe('fav');
    expect(list?.[0]).toBe('x1');
  });

  it('automatisch zuordnen aus → auto unverändert; Schalter nur eigene', () => {
    const off = applyRouteAutoMatch([fav, run], 'fav', false, ctx);
    expect(off).not.toBe('not_found');
    const r = applyRouteMatch(
      off as TrackedRouteRow[],
      { routeId: 'run', favoriteId: 'fav', state: 'auto' },
      ctx,
    );
    expect(r.kind === 'ok' && r.outcome).toBe('unchanged');
    expect(applyRouteAutoMatch([fav], 'fav', false, { userId: OTHER, now: NOW })).toBe('not_found');
  });

  it('Favorit gelöscht → Lauf wieder offen (wie der Trigger)', () => {
    const linked = { ...run, base_route_id: 'fav', route_match: 'auto' as const };
    const next = applyTrackedRouteDelete([fav, linked], 'fav', ME);
    expect(next !== 'not_found' && stateOf(next, 'run')).toEqual([null, null, 0]);
  });
});

describe('normalizeRouteRow (ältere Zeilen)', () => {
  it('Verweis → repeat, sonst offen; Ablehnungen leer; automatisch an', () => {
    const old = { ...run, base_route_id: 'fav' } as Partial<TrackedRouteRow>;
    delete old.route_match;
    delete old.match_rejected_ids;
    delete old.auto_match;
    expect(normalizeRouteRow(old as TrackedRouteRow)).toMatchObject({
      route_match: 'repeat',
      match_rejected_ids: [],
      auto_match: true,
    });
  });
});

describe('applyAutoMatches', () => {
  it('sendet nur Treffer; Fehler werden still gemerkt und nicht wiederholt', async () => {
    resetAutoMatchFailures();
    const calls: string[] = [];
    const backend = {
      setRouteMatch: async (routeId: string, favoriteId: string | null) => {
        calls.push(`${routeId}>${favoriteId}`);
        throw new Error('offline');
      },
    };
    const routes = [fav, row('same')];
    expect(await applyAutoMatches(backend, ME, routes)).toBe(0);
    expect(await applyAutoMatches(backend, ME, routes)).toBe(0);
    expect(calls).toEqual(['same>fav']);
    const ok = { setRouteMatch: async () => 'auto' as const };
    resetAutoMatchFailures();
    expect(await applyAutoMatches(ok, ME, routes)).toBe(1);
    expect(await applyAutoMatches(ok, OTHER, routes)).toBe(0);
  });
});

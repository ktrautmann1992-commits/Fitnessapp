import { describe, expect, it } from 'vitest';

import { latestAutoMatch, myRouteTiles, routeMatchInfo } from './my-routes';
import type { TrackedRouteRow } from './schema';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

type Row = Parameters<typeof myRouteTiles>[1][number];

function row(id: string, changes: Partial<TrackedRouteRow> = {}): Row {
  return {
    id,
    user_id: ME,
    name: id,
    sport: 'run',
    started_at: '2026-10-01T07:00:00Z',
    moving_s: 1800,
    distance_m: 5000,
    km_splits: [360, 360, 360, 360, 360],
    base_route_id: null,
    is_favorite: false,
    route_match: null,
    source: 'recorded',
    ...changes,
  };
}

const park = row('Hausrunde', { is_favorite: true, started_at: '2026-08-30T07:00:00Z' });
const river = row('Mainufer', {
  is_favorite: true,
  started_at: '2026-09-01T07:00:00Z',
  moving_s: 3600,
  distance_m: 10_400,
  km_splits: Array.from({ length: 10 }, () => 340),
});

describe('myRouteTiles', () => {
  it('zuletzt gelaufen zuerst (nie nach Tempo); zählt alle Läufe außer abgelehnten', () => {
    const routes = [
      park,
      river,
      row('p1', {
        base_route_id: park.id,
        route_match: 'auto',
        started_at: '2026-10-24T07:00:00Z',
        moving_s: 1685,
      }),
      row('p2', {
        base_route_id: park.id,
        route_match: 'repeat',
        started_at: '2026-10-17T07:00:00Z',
        moving_s: 1757,
      }),
      row('p3', { route_match: 'rejected', started_at: '2026-10-25T07:00:00Z' }),
      row('r1', {
        base_route_id: river.id,
        route_match: 'confirmed',
        started_at: '2026-10-11T07:00:00Z',
        distance_m: 10_400,
        km_splits: river.km_splits,
        moving_s: 3520,
      }),
      row('foreign', { user_id: OTHER, is_favorite: true, started_at: '2026-10-26T07:00:00Z' }),
    ];
    const tiles = myRouteTiles(ME, routes);
    expect(tiles.map((t) => [t.favorite.id, t.runs, t.last.routeId, t.last.code])).toEqual([
      ['Hausrunde', 3, 'p1', 'faster'],
      ['Mainufer', 2, 'r1', 'faster'],
    ]);
    expect(tiles[0]?.last.diffS).toBe(72);
  });

  it('ohne Favoriten: leer; nur Favorit: ein Lauf, „first“', () => {
    expect(myRouteTiles(ME, [row('x')])).toEqual([]);
    const [tile] = myRouteTiles(ME, [park]);
    expect(tile?.runs).toBe(1);
    expect(tile?.last.code).toBe('first');
  });
});

describe('routeMatchInfo', () => {
  const p1 = row('p1', {
    base_route_id: park.id,
    route_match: 'repeat',
    started_at: '2026-10-17T07:00:00Z',
    moving_s: 1757,
  });
  const p2 = row('p2', {
    base_route_id: park.id,
    route_match: 'auto',
    started_at: '2026-10-24T07:00:00Z',
    moving_s: 1685,
  });
  const all = [park, p1, p2];

  it('n. Lauf, vorheriger vergleichbarer Lauf', () => {
    const info = routeMatchInfo(p2, all);
    expect(info?.favorite.id).toBe(park.id);
    expect(info?.nth).toBe(3);
    expect(info?.previous?.id).toBe('p1');
    expect(info?.entry).toMatchObject({ code: 'faster', diffS: 72, matchKind: 'auto' });
  });

  it('die Strecke selbst: 1. Lauf ohne vorherigen', () => {
    expect(routeMatchInfo(park, all)).toMatchObject({ nth: 1, previous: null });
  });

  it('abgelehnt, ohne Verweis, Favorit zurückgenommen oder fremd → null', () => {
    expect(routeMatchInfo(row('x'), all)).toBeNull();
    expect(routeMatchInfo({ ...p2, route_match: 'rejected' }, all)).toBeNull();
    expect(routeMatchInfo(p2, [{ ...park, is_favorite: false }, p1, p2])).toBeNull();
    expect(routeMatchInfo(p2, [{ ...park, user_id: OTHER }, p1, p2])).toBeNull();
  });
});

describe('latestAutoMatch', () => {
  it('neueste automatische Zuordnung zu einer noch gemerkten Strecke', () => {
    const a = row('a', {
      base_route_id: park.id,
      route_match: 'auto',
      started_at: '2026-10-20T07:00:00Z',
    });
    const b = row('b', {
      base_route_id: park.id,
      route_match: 'auto',
      started_at: '2026-10-24T07:00:00Z',
    });
    const c = row('c', {
      base_route_id: park.id,
      route_match: 'confirmed',
      started_at: '2026-10-25T07:00:00Z',
    });
    expect(latestAutoMatch(ME, [park, a, b, c])?.route.id).toBe('b');
    expect(latestAutoMatch(ME, [{ ...park, is_favorite: false }, a])).toBeNull();
    expect(latestAutoMatch(ME, [park, c])).toBeNull();
    expect(latestAutoMatch(OTHER, [park, a])).toBeNull();
  });
});

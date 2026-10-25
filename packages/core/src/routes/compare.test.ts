import { describe, expect, it } from 'vitest';

import { ROUTE_COMPARE } from '../constants';
import {
  attemptCompareText,
  attemptPaceText,
  compareAttempts,
  formatCompareDuration,
  routeHistory,
} from './compare';
import type { TrackedRouteRow } from './schema';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

type Row = Parameters<typeof compareAttempts>[0];

function row(id: string, changes: Partial<TrackedRouteRow> = {}): Row {
  return {
    id,
    user_id: ME,
    sport: 'run',
    started_at: '2026-10-01T07:00:00Z',
    moving_s: 1800,
    distance_m: 5000,
    km_splits: [360, 360, 360, 360, 360],
    base_route_id: 'fav',
    is_favorite: false,
    ...changes,
  };
}

const fav = row('fav', { base_route_id: null, is_favorite: true });

describe('compareAttempts (W-G16)', () => {
  it('nur die Favoriten-Strecke: erster Lauf', () => {
    expect(compareAttempts(fav, [])).toEqual([
      {
        routeId: 'fav',
        startedAt: fav.started_at,
        movingS: 1800,
        distanceM: 5000,
        code: 'first',
        diffS: 0,
        splitDiffsS: [],
        matchKind: 'favorite',
        previousRouteId: null,
      },
    ]);
    // Die Favoriten-Strecke darf auch in der Liste stehen (kein Doppel).
    expect(compareAttempts(fav, [fav])).toHaveLength(1);
  });

  it('kein Favorit → kein Vergleich', () => {
    expect(compareAttempts({ ...fav, is_favorite: false }, [row('a')])).toEqual([]);
  });

  it('nur eigene Läufe derselben Favoriten-Strecke und Sportart – fremde und andere Strecken nie', () => {
    const result = compareAttempts(fav, [
      row('mine', { started_at: '2026-10-08T07:00:00Z', moving_s: 1720 }),
      row('foreign', { user_id: OTHER, started_at: '2026-10-09T07:00:00Z', moving_s: 1500 }),
      row('other-base', { base_route_id: 'xyz', started_at: '2026-10-10T07:00:00Z' }),
      row('no-base', { base_route_id: null, started_at: '2026-10-11T07:00:00Z' }),
      row('bike', { sport: 'bike', started_at: '2026-10-12T07:00:00Z' }),
    ]);
    expect(result.map((r) => r.routeId)).toEqual(['fav', 'mine']);
    expect(result[1]).toMatchObject({ code: 'faster', diffS: 80 });
  });

  it('zeitliche Reihenfolge (nie nach Zeit sortiert – keine Rangliste), Vergleich nur mit dem vorherigen Lauf', () => {
    const result = compareAttempts(fav, [
      row('c', { started_at: '2026-10-15T07:00:00Z', moving_s: 1900 }),
      row('a', { started_at: '2026-10-05T07:00:00Z', moving_s: 1700 }),
      row('b', { started_at: '2026-10-10T07:00:00Z', moving_s: 1703 }),
    ]);
    expect(result.map((r) => [r.routeId, r.code, r.diffS])).toEqual([
      ['fav', 'first', 0],
      ['a', 'faster', 100],
      ['b', 'same', 3],
      ['c', 'slower', 197],
    ]);
  });

  it(`gleich schnell bis ${ROUTE_COMPARE.sameWithinS} s, danach schneller/langsamer`, () => {
    const at = (s: number) =>
      compareAttempts(fav, [
        row('x', { started_at: '2026-10-02T07:00:00Z', moving_s: 1800 + s }),
      ])[1]?.code;
    expect(at(ROUTE_COMPARE.sameWithinS)).toBe('same');
    expect(at(-ROUTE_COMPARE.sameWithinS)).toBe('same');
    expect(at(ROUTE_COMPARE.sameWithinS + 1)).toBe('slower');
    expect(at(-ROUTE_COMPARE.sameWithinS - 1)).toBe('faster');
  });

  it('abgekürzte/abgebrochene Läufe (Distanz über 10 % daneben) → nicht vergleichbar, zählen nicht als „vorheriger“', () => {
    const result = compareAttempts(fav, [
      row('short', { started_at: '2026-10-02T07:00:00Z', distance_m: 4400, moving_s: 1500 }),
      row('ok', { started_at: '2026-10-03T07:00:00Z', distance_m: 4500, moving_s: 1790 }),
      row('long', { started_at: '2026-10-04T07:00:00Z', distance_m: 5501, moving_s: 2000 }),
    ]);
    expect(result.map((r) => r.code)).toEqual([
      'first',
      'not_comparable',
      'faster',
      'not_comparable',
    ]);
    expect(result[2]?.diffS).toBe(10);
  });

  it('Kilometerzeiten-Unterschied je km (negativ = schneller), nur gemeinsame km', () => {
    const result = compareAttempts(fav, [
      row('x', {
        started_at: '2026-10-02T07:00:00Z',
        moving_s: 1790,
        km_splits: [350, 362, 360, 358],
        distance_m: 4999,
      }),
    ]);
    expect(result[1]?.splitDiffsS).toEqual([-10, 2, 0, -2]);
  });
});

describe('neutrale Texte', () => {
  it('Dauer-Format', () => {
    expect(formatCompareDuration(80)).toBe('1:20 min');
    expect(formatCompareDuration(5)).toBe('0:05 min');
    expect(formatCompareDuration(3725)).toBe('1:02:05 h');
  });

  it('Texte ohne Druck, ohne Bestzeit/Rekord/Rang/Serie', () => {
    const texts = (['first', 'faster', 'slower', 'same', 'not_comparable'] as const).map((code) =>
      attemptCompareText({ code, diffS: 80 }),
    );
    expect(texts[1]).toBe('Heute 1:20 min schneller als beim letzten Mal.');
    expect(texts[2]).toBe('Heute 1:20 min langsamer als beim letzten Mal.');
    for (const t of texts) {
      expect(t).not.toMatch(/best|rekord|rang|platz|serie|streak|!|sieg|verlier/i);
    }
  });
});

describe('Meine Strecken: automatisch erkannte und bestätigte Läufe (25.10.2026)', () => {
  it('auto zählt vorläufig mit, confirmed und repeat auch; rejected nie', () => {
    const result = compareAttempts(fav, [
      row('auto', { started_at: '2026-10-02T07:00:00Z', moving_s: 1790, route_match: 'auto' }),
      row('conf', { started_at: '2026-10-03T07:00:00Z', moving_s: 1780, route_match: 'confirmed' }),
      row('rep', { started_at: '2026-10-04T07:00:00Z', moving_s: 1770, route_match: 'repeat' }),
      row('rej', { started_at: '2026-10-05T07:00:00Z', moving_s: 1500, route_match: 'rejected' }),
      row('old', { started_at: '2026-10-06T07:00:00Z', moving_s: 1760, route_match: null }),
    ]);
    expect(result.map((r) => [r.routeId, r.matchKind, r.previousRouteId])).toEqual(
      [
        ['fav', 'favorite', null],
        ['auto', 'auto', null],
        ['conf', 'confirmed', null],
        ['rep', 'repeat', null],
        ['old', 'repeat', null],
      ].map(([id, kind], i, all) => [id, kind, i === 0 ? null : (all[i - 1]?.[0] ?? null)]),
    );
  });
});

describe('routeHistory', () => {
  it('zeitliche Reihenfolge (nie nach Tempo), nicht vergleichbare markiert, Pace und km/h', () => {
    const h = routeHistory(fav, [
      row('b', { started_at: '2026-10-09T07:00:00Z', moving_s: 1700 }),
      row('a', { started_at: '2026-10-05T07:00:00Z', moving_s: 1900 }),
      row('short', { started_at: '2026-10-07T07:00:00Z', moving_s: 1300, distance_m: 3900 }),
    ]);
    expect(h.map((p) => p.routeId)).toEqual(['fav', 'a', 'short', 'b']);
    expect(h.map((p) => p.comparable)).toEqual([true, true, false, true]);
    expect(h[0]?.paceS).toBe(360);
    expect(h[0]?.speedKmh).toBe(10);
    expect(h[0]).not.toHaveProperty('best');
  });

  it('kein Favorit → leer; Lauf ohne Distanz → Pace null', () => {
    expect(routeHistory({ ...fav, is_favorite: false }, [])).toEqual([]);
    const zero = { ...fav, distance_m: 0, km_splits: [] };
    expect(routeHistory(zero, [])[0]?.paceS).toBeNull();
  });
});

describe('attemptPaceText', () => {
  it('Laufen: „Ø Pace 5:38 → 5:24 /km“', () => {
    expect(
      attemptPaceText(
        'run',
        { moving_s: 1757, distance_m: 5200 },
        { moving_s: 1685, distance_m: 5200 },
      ),
    ).toBe('Ø Pace 5:38 → 5:24 /km');
  });

  it('Rad: km/h', () => {
    expect(
      attemptPaceText(
        'bike',
        { moving_s: 3600, distance_m: 24_100 },
        { moving_s: 3600, distance_m: 25_300 },
      ),
    ).toBe('Ø 24,1 → 25,3 km/h');
  });

  it('ohne Distanz oder Zeit: null', () => {
    expect(
      attemptPaceText('run', { moving_s: 0, distance_m: 5000 }, { moving_s: 1, distance_m: 5000 }),
    ).toBeNull();
    expect(
      attemptPaceText('bike', { moving_s: 100, distance_m: 0 }, { moving_s: 1, distance_m: 5 }),
    ).toBeNull();
  });
});

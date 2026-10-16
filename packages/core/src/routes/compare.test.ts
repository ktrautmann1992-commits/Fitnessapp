import { describe, expect, it } from 'vitest';

import { ROUTE_COMPARE } from '../constants';
import { attemptCompareText, compareAttempts, formatCompareDuration } from './compare';
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

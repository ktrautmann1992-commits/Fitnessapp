import { describe, expect, it } from 'vitest';

import { LOOP_ROUTE } from '../constants';
import {
  type LoopCandidate,
  loopDistanceDeviation,
  loopDistanceFit,
  loopOverlapShare,
  loopRemainingM,
  loopRequestLengthM,
  loopRequestSchema,
  loopResponseSchema,
  loopRoutePoints,
  loopScore,
  loopSeeds,
  loopSimilarity,
  loopSurfaceFit,
  rankLoops,
  roundStartPoint,
} from './loop';
import { mockLoopCandidates } from './loop-mock';
import type { LatLng } from './polyline';
import { offset, START } from './test-helpers';
import { haversineM, trackDistance } from './track';

/** Quadratische Runde mit Kantenlänge `sideM` (im Uhrzeigersinn, Start = Ziel). */
function square(sideM: number, from: LatLng = START, step = 50): LatLng[] {
  const corners: [number, number][] = [
    [0, 0],
    [sideM, 0],
    [sideM, sideM],
    [0, sideM],
    [0, 0],
  ];
  const points: LatLng[] = [];
  for (let c = 1; c < corners.length; c += 1) {
    const [n0, e0] = corners[c - 1] as [number, number];
    const [n1, e1] = corners[c] as [number, number];
    const n = Math.max(1, Math.round(sideM / step));
    for (let i = 0; i < n; i += 1) {
      points.push(offset(from, n0 + ((n1 - n0) * i) / n, e0 + ((e1 - e0) * i) / n));
    }
  }
  points.push(from);
  return points;
}

/** Hin und zurück auf derselben Linie (Länge gesamt `lengthM`). */
function outAndBack(lengthM: number): LatLng[] {
  const out: LatLng[] = [];
  for (let d = 0; d <= lengthM / 2; d += 50) out.push(offset(START, d, 0));
  return [...out, ...out.slice(0, -1).reverse()];
}

/** Runde mit einer Stichstraße (hin und zurück) von `spurM` Metern am Eck. */
function squareWithSpur(sideM: number, spurM: number): LatLng[] {
  const base = square(sideM);
  const corner = offset(START, sideM, 0);
  const idx = base.findIndex((p) => haversineM(p, corner) < 1);
  const spur: LatLng[] = [];
  for (let d = 50; d <= spurM; d += 50) spur.push(offset(START, sideM + d, 0));
  return [...base.slice(0, idx + 1), ...spur, ...spur.slice(0, -1).reverse(), ...base.slice(idx)];
}

const candidate = (id: string, points: LatLng[], extra: Partial<LoopCandidate> = {}) => ({
  id,
  points,
  distanceM: null,
  ascentM: null,
  surface: null,
  ...extra,
});

describe('roundStartPoint', () => {
  it('rundet auf ein 50-m-Raster: höchstens ca. 36 m daneben, idempotent', () => {
    for (const p of [
      START,
      { lat: 47.3769, lng: 8.5417 },
      { lat: 48.2082, lng: 16.3738 },
      { lat: 54.7837, lng: 9.4321 },
      { lat: -33.86, lng: 151.2 },
    ]) {
      const r = roundStartPoint(p);
      expect(haversineM(p, r)).toBeLessThanOrEqual(36);
      expect(roundStartPoint(r)).toEqual(r);
    }
  });

  it('Punkte bis ca. 10 m um einen Rasterpunkt landen auf demselben Rasterpunkt', () => {
    const center = roundStartPoint(START);
    for (const [n, e] of [
      [8, 8],
      [-10, 4],
      [3, -9],
    ] as const) {
      expect(roundStartPoint(offset(center, n, e))).toEqual(center);
    }
  });

  it('höchstens 6 Nachkommastellen; Datumsgrenze und Pole bleiben gültig', () => {
    const r = roundStartPoint({ lat: 50.123456789, lng: 6.987654321 });
    expect(String(r.lat).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6);
    const east = roundStartPoint({ lat: 0, lng: 179.99999 });
    expect(Math.abs(east.lng)).toBeLessThanOrEqual(180);
    const pole = roundStartPoint({ lat: 89.9999, lng: 10 });
    expect(pole.lat).toBeLessThanOrEqual(89);
  });
});

describe('Anfrage und Antwort (Zod)', () => {
  const ok = { lat: 50.94, lng: 6.96, distance_km: 10, surface: 'unpaved', variant: 0 };

  it('nimmt gültige Anfragen an, Grenzen 3 und 30 km', () => {
    expect(loopRequestSchema.safeParse(ok).success).toBe(true);
    expect(loopRequestSchema.safeParse({ ...ok, distance_km: 3 }).success).toBe(true);
    expect(loopRequestSchema.safeParse({ ...ok, distance_km: 30 }).success).toBe(true);
  });

  it('lehnt Unsinn ab: zu kurz/lang, Kommazahl, fremde Felder, ungültige Koordinaten', () => {
    for (const bad of [
      { ...ok, distance_km: 2 },
      { ...ok, distance_km: 31 },
      { ...ok, distance_km: 10.5 },
      { ...ok, lat: 91 },
      { ...ok, lng: Number.NaN },
      { ...ok, surface: 'gravel' },
      { ...ok, variant: LOOP_ROUTE.variantMax + 1 },
      { ...ok, name: 'Haustür' },
    ]) {
      expect(loopRequestSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('Antwort: ok mit 1–3 Runden, feste Codes ohne Inhalte', () => {
    expect(loopResponseSchema.safeParse({ code: 'no_routes' }).success).toBe(true);
    expect(loopResponseSchema.safeParse({ code: 'ok', routes: [] }).success).toBe(false);
    expect(loopResponseSchema.safeParse({ code: 'rate_limited', detail: 'x' }).success).toBe(false);
  });
});

describe('loopSeeds / loopRequestLengthM', () => {
  it('jede Variante bekommt neue, nie doppelte Zufallswerte', () => {
    const all = [0, 1, 2, 3].flatMap((v) => loopSeeds(v));
    expect(new Set(all).size).toBe(all.length);
    expect(loopSeeds(0)).toHaveLength(LOOP_ROUTE.providerCandidates);
  });

  it('bestellt etwas kürzer als gewünscht', () => {
    expect(loopRequestLengthM(10)).toBe(9200);
    expect(loopRequestLengthM(3)).toBeLessThan(3000);
  });
});

describe('loopOverlapShare', () => {
  it('saubere Runde: kein „hin und zurück“ (Start = Ziel zählt nicht)', () => {
    expect(loopOverlapShare(square(1250))).toBeLessThan(0.02);
  });

  it('reines Hin und Zurück: fast alles doppelt', () => {
    expect(loopOverlapShare(outAndBack(5000))).toBeGreaterThan(0.9);
  });

  it('Stichstraße: Anteil etwa so groß wie die doppelt gelaufene Strecke', () => {
    // 5 km Runde + 2 × 500 m Stich → ca. 1 km von 6 km doppelt.
    const share = loopOverlapShare(squareWithSpur(1250, 500));
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.25);
  });

  it('Grenzfälle: leer, ein Punkt, ungültige Punkte', () => {
    expect(loopOverlapShare([])).toBe(0);
    expect(loopOverlapShare([START])).toBe(0);
    expect(loopOverlapShare([{ lat: Number.NaN, lng: 0 }, START])).toBe(0);
  });

  it('sehr lange Runde (30 km) bleibt schnell (Abtastung gedeckelt)', () => {
    const t0 = performance.now();
    expect(loopOverlapShare(square(7500, START, 10))).toBeLessThan(0.02);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});

describe('loopSimilarity', () => {
  it('gleiche Runde = 1, andere Richtung/Stelle ≈ 0', () => {
    const a = square(1000);
    expect(loopSimilarity(a, a)).toBe(1);
    const b = square(1000, offset(START, -3000, -3000));
    expect(loopSimilarity(a, b)).toBe(0);
  });
});

describe('Distanz und Untergrund', () => {
  it('Abweichung und Toleranz (15 %)', () => {
    expect(loopDistanceDeviation(10_000, 10)).toBe(0);
    expect(loopDistanceDeviation(11_000, 10)).toBeCloseTo(0.1);
    expect(loopDistanceFit(11_400, 10)).toBe('ok');
    expect(loopDistanceFit(11_600, 10)).toBe('longer');
    expect(loopDistanceFit(8_000, 10)).toBe('shorter');
    expect(loopDistanceDeviation(5000, 0)).toBe(Infinity);
  });

  it('Untergrund: egal = 1, Wunsch-Anteil, Unbekanntes halb, ohne Angabe 0,5', () => {
    const s = { paved: 0.7, unpaved: 0.2, unknown: 0.1 };
    expect(loopSurfaceFit(s, 'any')).toBe(1);
    expect(loopSurfaceFit(s, 'paved')).toBeCloseTo(0.75);
    expect(loopSurfaceFit(s, 'unpaved')).toBeCloseTo(0.25);
    expect(loopSurfaceFit(null, 'unpaved')).toBe(0.5);
  });
});

describe('loopScore / rankLoops', () => {
  const wish = { distanceKm: 5, surface: 'any' as const };

  it('genau passende, saubere Runde bekommt 100', () => {
    const s = loopScore(candidate('a', square(1250), { distanceM: 5000 }), wish);
    expect(s.score).toBe(100);
    expect(s.rejected).toBe(false);
  });

  it('zu lang (> 35 %) und reines Hin und Zurück fallen weg', () => {
    expect(loopScore(candidate('a', square(2000)), wish).rejected).toBe(true);
    expect(loopScore(candidate('b', outAndBack(5000)), wish).rejected).toBe(true);
  });

  it('Untergrund-Wunsch zählt: Waldwege gewünscht → Runde mit mehr Waldweg vorn', () => {
    const forest = candidate('wald', square(1250), {
      distanceM: 5000,
      surface: { paved: 0.1, unpaved: 0.9, unknown: 0 },
    });
    const road = candidate('asphalt', square(1250, offset(START, 3000, 0)), {
      distanceM: 5000,
      surface: { paved: 0.9, unpaved: 0.1, unknown: 0 },
    });
    expect(
      rankLoops([road, forest], { distanceKm: 5, surface: 'unpaved' }).map((r) => r.id),
    ).toEqual(['wald', 'asphalt']);
    expect(rankLoops([road, forest], { distanceKm: 5, surface: 'paved' }).map((r) => r.id)).toEqual(
      ['asphalt', 'wald'],
    );
  });

  it('fast gleiche Runden nur einmal, höchstens 3, deterministisch', () => {
    const many = [0, 1, 2, 3, 4].map((i) =>
      candidate(`r${i}`, square(1250, offset(START, i * 3000, 0)), { distanceM: 5000 }),
    );
    const dup = candidate('r0-kopie', square(1250), { distanceM: 5050 });
    const ranked = rankLoops([dup, ...many], wish);
    expect(ranked).toHaveLength(3);
    expect(ranked.map((r) => r.id)).toEqual(['r0', 'r1', 'r2']);
    expect(rankLoops([...many].reverse(), wish)).toEqual(ranked);
  });

  it('Ergebnis passt zum Antwort-Schema, Linie lässt sich lesen', () => {
    const ranked = rankLoops([candidate('a', square(1250), { ascentM: 42.4 })], wish);
    expect(loopResponseSchema.safeParse({ code: 'ok', routes: ranked }).success).toBe(true);
    const first = ranked[0];
    expect(first?.ascent_m).toBe(42);
    const points = first ? loopRoutePoints(first) : null;
    expect(points?.length).toBeGreaterThan(3);
    expect(trackDistance(points ?? [])).toBeGreaterThan(4900);
  });

  it('nichts Passendes → leere Liste', () => {
    expect(rankLoops([], wish)).toEqual([]);
    expect(rankLoops([candidate('x', [START])], wish)).toEqual([]);
  });
});

describe('mockLoopCandidates (Attrappe)', () => {
  for (const km of [3, 10, 30]) {
    it(`${km} km: Runden schließen am Start, Längen um die Wunschdistanz, 2–3 Vorschläge`, () => {
      const cands = mockLoopCandidates({
        start: START,
        distanceKm: km,
        surface: 'any',
        variant: 0,
      });
      expect(cands).toHaveLength(LOOP_ROUTE.providerCandidates);
      for (const c of cands) {
        expect(haversineM(c.points[0] as LatLng, START)).toBeLessThan(1);
        expect(haversineM(c.points.at(-1) as LatLng, START)).toBeLessThan(1);
      }
      const ranked = rankLoops(cands, { distanceKm: km, surface: 'any' });
      expect(ranked.length).toBeGreaterThanOrEqual(2);
      expect(ranked.length).toBeLessThanOrEqual(3);
      // Die „hin und zurück“-Attrappe (seed 3) wird aussortiert.
      expect(ranked.map((r) => r.id)).not.toContain('mock-3');
      for (const r of ranked) expect(loopDistanceDeviation(r.distance_m, km)).toBeLessThan(0.15);
    });
  }

  it('gleiche Eingabe → gleiche Runden; andere Variante → andere', () => {
    const a = mockLoopCandidates({ start: START, distanceKm: 8, surface: 'paved', variant: 0 });
    const b = mockLoopCandidates({ start: START, distanceKm: 8, surface: 'paved', variant: 0 });
    const c = mockLoopCandidates({ start: START, distanceKm: 8, surface: 'paved', variant: 1 });
    expect(a).toEqual(b);
    expect(c.map((x) => x.id)).not.toEqual(a.map((x) => x.id));
  });
});

describe('loopRemainingM', () => {
  it('Rest nie negativ, ungültig → 0', () => {
    expect(loopRemainingM(10_000, 2_500)).toBe(7_500);
    expect(loopRemainingM(10_000, 12_000)).toBe(0);
    expect(loopRemainingM(10_000, -5)).toBe(10_000);
    expect(loopRemainingM(Number.NaN, 5)).toBe(0);
  });
});

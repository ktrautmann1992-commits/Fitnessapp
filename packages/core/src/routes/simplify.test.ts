import { describe, expect, it } from 'vitest';

import { ROUTE_SIMPLIFY, TRACKED_ROUTE_LIMITS } from '../constants';
import { seededRandom } from '../nutrition/test-helpers';
import { simplifyTrack } from './simplify';
import { line, offset, START } from './test-helpers';
import { haversineM, trackDistance } from './track';

describe('simplifyTrack', () => {
  it('0, 1, 2 Punkte bleiben unverändert', () => {
    expect(simplifyTrack([])).toEqual([]);
    expect(simplifyTrack([START])).toEqual([START]);
    const two = [START, offset(START, 10, 0)];
    expect(simplifyTrack(two)).toEqual(two);
  });

  it('gerade Linie → Anfang und Ende', () => {
    const pts = line({ speedMps: 3, count: 1000 });
    expect(simplifyTrack(pts)).toEqual([pts[0], pts[999]]);
  });

  it('Rechteck: Ecken bleiben, Distanz praktisch gleich', () => {
    const a = line({ speedMps: 5, count: 101 });
    const b = line({ speedMps: 5, count: 101, start: a[100], direction: 'east' });
    const pts = [...a, ...b.slice(1)];
    const simple = simplifyTrack(pts);
    expect(simple).toEqual([pts[0], pts[100], pts[200]]);
    expect(trackDistance(simple)).toBeCloseTo(trackDistance(pts), 3);
  });

  it(`Abweichung höchstens die Toleranz (${ROUTE_SIMPLIFY.toleranceM} m) bei einer Zickzack-Linie`, () => {
    const rand = seededRandom(5);
    const pts = Array.from({ length: 2000 }, (_, i) => offset(START, i * 3, (rand() - 0.5) * 6));
    const simple = simplifyTrack(pts);
    expect(simple.length).toBeLessThan(pts.length);
    expect(simple[0]).toBe(pts[0]);
    expect(simple.at(-1)).toBe(pts.at(-1));
    // Jeder weggelassene Punkt liegt höchstens die Toleranz neben dem Abschnitt der vereinfachten Linie, der ihn
    // überspannt (Abstand Punkt–Strecke in Metern, flach um START gerechnet).
    const kept = simple.map((p) => pts.indexOf(p));
    const mPerDeg = haversineM(START, offset(START, 1000, 0)) / 1000;
    const xy = (p: { lat: number; lng: number }) => [
      (p.lng - START.lng) * Math.cos((START.lat * Math.PI) / 180),
      p.lat - START.lat,
    ];
    for (let k = 1; k < kept.length; k += 1) {
      const [ax, ay] = xy(pts[kept[k - 1] as number] as { lat: number; lng: number }) as [
        number,
        number,
      ];
      const [bx, by] = xy(pts[kept[k] as number] as { lat: number; lng: number }) as [
        number,
        number,
      ];
      for (let i = (kept[k - 1] as number) + 1; i < (kept[k] as number); i += 1) {
        const [px, py] = xy(pts[i] as { lat: number; lng: number }) as [number, number];
        const dx = bx - ax;
        const dy = by - ay;
        const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
        const dist = Math.hypot(px - ax - u * dx, py - ay - u * dy) / (1 / mPerDeg);
        expect(dist).toBeLessThanOrEqual(ROUTE_SIMPLIFY.toleranceM + 0.01);
      }
    }
  });

  it(`höchstens ${TRACKED_ROUTE_LIMITS.maxPoints} Punkte, auch bei 100.000 verrauschten Punkten; deterministisch; Teilmenge in Reihenfolge`, () => {
    const rand = seededRandom(42);
    const pts = Array.from({ length: 100_000 }, (_, i) =>
      offset(START, Math.sin(i / 500) * 2000 + (rand() - 0.5) * 30, i * 2 + (rand() - 0.5) * 30),
    );
    const simple = simplifyTrack(pts);
    expect(simple.length).toBeLessThanOrEqual(TRACKED_ROUTE_LIMITS.maxPoints);
    expect(simple.length).toBeGreaterThanOrEqual(2);
    expect(simplifyTrack(pts)).toEqual(simple);
    let j = 0;
    for (const p of simple) {
      while (j < pts.length && pts[j] !== p) j += 1;
      expect(j).toBeLessThan(pts.length);
    }
  });

  it('kleinere Obergrenze: gleichmäßig ausgedünnt, Anfang und Ende bleiben', () => {
    const rand = seededRandom(9);
    const pts = Array.from({ length: 5000 }, () =>
      offset(START, (rand() - 0.5) * 5000, (rand() - 0.5) * 5000),
    );
    const simple = simplifyTrack(pts, 10);
    expect(simple).toHaveLength(10);
    expect(simple[0]).toBe(pts[0]);
    expect(simple.at(-1)).toBe(pts.at(-1));
  });
});

describe('Wächter S1 M2/N6: Laufzeit und Datumsgrenze', () => {
  // Exakter Zickzack (Amplitude 20 m, alle Punkte gleich weit von der Sehne): früher quadratisch (ca. 58 s).
  it.each([50_000, 100_000])('exakter Zickzack mit %i Punkten unter 3 s, deterministisch', (n) => {
    const pts = Array.from({ length: n }, (_, i) => offset(START, i * 10, i % 2 === 0 ? 0 : 20));
    const started = performance.now();
    const simple = simplifyTrack(pts);
    expect(performance.now() - started).toBeLessThan(3000);
    expect(simple.length).toBeLessThanOrEqual(TRACKED_ROUTE_LIMITS.maxPoints);
    expect(simplifyTrack(pts)).toEqual(simple);
    expect(simple[0]).toBe(pts[0]);
    expect(simple.at(-1)).toBe(pts.at(-1));
  });

  it('gerade Strecke über die Datumsgrenze (±180°) → Anfang und Ende', () => {
    const pts = Array.from({ length: 200 }, (_, i) => {
      const lng = 179.99 + i * 0.0001;
      return { lat: -16.5, lng: lng > 180 ? lng - 360 : lng };
    });
    expect(simplifyTrack(pts)).toEqual([pts[0], pts[199]]);
  });
});

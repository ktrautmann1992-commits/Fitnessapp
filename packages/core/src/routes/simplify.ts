import { ROUTE_SIMPLIFY, TRACKED_ROUTE_LIMITS } from '../constants';
import type { LatLng } from './polyline';
import { EARTH_RADIUS_M } from './track';

/**
 * Strecke vereinfachen (Plan 11.2/S1): Douglas-Peucker mit ROUTE_SIMPLIFY.toleranceM Metern in einer lokalen,
 * flachen Projektion (Abstandstreue um den mittleren Breitengrad – für Strecken bis 500 km genau genug). Hat das
 * Ergebnis mehr als `maxPoints` Punkte, wird die Toleranz verdoppelt (bis ROUTE_SIMPLIFY.maxToleranceM); reicht auch
 * das nicht, wird gleichmäßig ausgedünnt. Erster und letzter Punkt bleiben immer. Ohne Rekursion (Stapel), mit
 * O(n)-Vorab-Ausdünnung (radial) und ausgewogener Teilung bei Gleichstand (Wächter S1 M2) – auch ein exakter Zickzack
 * mit 100.000 Punkten bleibt schnell; Abweichung höchstens 2 × Toleranz; deterministisch.
 */
export function simplifyTrack<T extends LatLng>(
  points: readonly T[],
  maxPoints: number = TRACKED_ROUTE_LIMITS.maxPoints,
): T[] {
  if (points.length <= 2) return [...points];
  for (
    let tolerance: number = ROUTE_SIMPLIFY.toleranceM;
    tolerance <= ROUTE_SIMPLIFY.maxToleranceM;
    tolerance *= 2
  ) {
    // Wächter S1 M2: zuerst in O(n) radial ausdünnen (Punkte näher als die Toleranz am letzten behaltenen fallen
    // weg – sie können die Linie höchstens um die Toleranz verschieben), dann Douglas-Peucker.
    const thinned = radialThin(points, tolerance);
    const xy = project(thinned);
    const keep = douglasPeucker(xy, tolerance);
    const result = thinned.filter((_, i) => keep[i] === 1);
    if (result.length <= maxPoints) return result;
  }
  return thinEvenly(points, maxPoints);
}

/** Radial ausdünnen in O(n): Punkte näher als `tolerance` Meter am zuletzt behaltenen fallen weg; das Ende bleibt. */
function radialThin<T extends LatLng>(points: readonly T[], tolerance: number): T[] {
  const xy = project(points);
  const tolSq = tolerance * tolerance;
  const result: T[] = [points[0] as T];
  let lx = xy[0] as number;
  let ly = xy[1] as number;
  for (let i = 1; i < points.length - 1; i += 1) {
    const dx = (xy[2 * i] as number) - lx;
    const dy = (xy[2 * i + 1] as number) - ly;
    if (dx * dx + dy * dy >= tolSq) {
      result.push(points[i] as T);
      lx = xy[2 * i] as number;
      ly = xy[2 * i + 1] as number;
    }
  }
  result.push(points[points.length - 1] as T);
  return result;
}

/**
 * Flache Projektion in Metern um den mittleren Breitengrad. Längengrade fortlaufend (über ±180° hinweg ohne Sprung,
 * Wächter S1 N6).
 */
function project(points: readonly LatLng[]): Float64Array {
  let latSum = 0;
  for (const p of points) latSum += p.lat;
  const cosLat = Math.cos(((latSum / points.length) * Math.PI) / 180);
  const xy = new Float64Array(points.length * 2);
  const k = (Math.PI / 180) * EARTH_RADIUS_M;
  let lng = 0;
  points.forEach((p, i) => {
    if (i === 0) {
      lng = p.lng;
    } else {
      let d = p.lng - (points[i - 1] as LatLng).lng;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      lng += d;
    }
    xy[2 * i] = lng * k * cosLat;
    xy[2 * i + 1] = p.lat * k;
  });
  return xy;
}

/** Quadrat des Abstands von Punkt p zur Strecke a–b (in der Ebene). */
function segmentDistanceSq(xy: Float64Array, p: number, a: number, b: number): number {
  const ax = xy[2 * a] as number;
  const ay = xy[2 * a + 1] as number;
  const dx = (xy[2 * b] as number) - ax;
  const dy = (xy[2 * b + 1] as number) - ay;
  const px = (xy[2 * p] as number) - ax;
  const py = (xy[2 * p + 1] as number) - ay;
  const lenSq = dx * dx + dy * dy;
  const u = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
  const ex = px - u * dx;
  const ey = py - u * dy;
  return ex * ex + ey * ey;
}

function douglasPeucker(xy: Float64Array, tolerance: number): Uint8Array {
  const n = xy.length / 2;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const tolSq = tolerance * tolerance;
  const stack: number[] = [0, n - 1];
  while (stack.length > 0) {
    const last = stack.pop() as number;
    const first = stack.pop() as number;
    let maxSq = -1;
    let index = -1;
    const mid = (first + last) / 2;
    for (let i = first + 1; i < last; i += 1) {
      const d = segmentDistanceSq(xy, i, first, last);
      // Bei Gleichstand der Punkt näher an der Mitte (Wächter S1 M2: ausgewogene Teilung statt quadratischer
      // Laufzeit, z. B. bei einem exakten Zickzack), bei gleicher Nähe der vordere – deterministisch.
      if (d > maxSq || (d === maxSq && Math.abs(i - mid) < Math.abs(index - mid))) {
        maxSq = d;
        index = i;
      }
    }
    if (index > 0 && maxSq > tolSq) {
      keep[index] = 1;
      stack.push(first, index, index, last);
    }
  }
  return keep;
}

/** Gleichmäßig ausdünnen auf höchstens maxPoints (erster und letzter Punkt bleiben). */
function thinEvenly<T>(points: readonly T[], maxPoints: number): T[] {
  const count = Math.max(2, maxPoints);
  const result: T[] = [];
  for (let i = 0; i < count; i += 1) {
    result.push(points[Math.round((i * (points.length - 1)) / (count - 1))] as T);
  }
  return result;
}

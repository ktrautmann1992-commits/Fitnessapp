import { ROUTE_SIMPLIFY, TRACKED_ROUTE_LIMITS } from '../constants';
import type { LatLng } from './polyline';
import { EARTH_RADIUS_M } from './track';

/**
 * Strecke vereinfachen (Plan 11.2/S1): Douglas-Peucker mit ROUTE_SIMPLIFY.toleranceM Metern in einer lokalen,
 * flachen Projektion (Abstandstreue um den mittleren Breitengrad – für Strecken bis 500 km genau genug). Hat das
 * Ergebnis mehr als `maxPoints` Punkte, wird die Toleranz verdoppelt (bis ROUTE_SIMPLIFY.maxToleranceM); reicht auch
 * das nicht, wird gleichmäßig ausgedünnt. Erster und letzter Punkt bleiben immer. Ohne Rekursion (Stapel), damit auch
 * 100.000 Punkte gehen; deterministisch (gleiche Eingabe → gleiche Ausgabe).
 */
export function simplifyTrack<T extends LatLng>(
  points: readonly T[],
  maxPoints: number = TRACKED_ROUTE_LIMITS.maxPoints,
): T[] {
  if (points.length <= 2) return [...points];
  const xy = project(points);
  for (
    let tolerance: number = ROUTE_SIMPLIFY.toleranceM;
    tolerance <= ROUTE_SIMPLIFY.maxToleranceM;
    tolerance *= 2
  ) {
    const keep = douglasPeucker(xy, tolerance);
    const result = points.filter((_, i) => keep[i] === 1);
    if (result.length <= maxPoints) return result;
  }
  return thinEvenly(points, maxPoints);
}

function project(points: readonly LatLng[]): Float64Array {
  let latSum = 0;
  for (const p of points) latSum += p.lat;
  const cosLat = Math.cos(((latSum / points.length) * Math.PI) / 180);
  const xy = new Float64Array(points.length * 2);
  const k = (Math.PI / 180) * EARTH_RADIUS_M;
  points.forEach((p, i) => {
    xy[2 * i] = p.lng * k * cosLat;
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
    for (let i = first + 1; i < last; i += 1) {
      const d = segmentDistanceSq(xy, i, first, last);
      // Bei Gleichstand der erste Punkt – deterministisch.
      if (d > maxSq) {
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

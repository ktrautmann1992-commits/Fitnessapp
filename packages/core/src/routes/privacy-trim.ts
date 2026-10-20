import { ROUTE_PRIVACY_TRIM } from '../constants';
import type { LatLng } from './polyline';
import { haversineM } from './track';

/**
 * Privatzone für das Story-Bild (Etappe E6, EA-G4, docs/PLAN-EINKAUFEN-AUSDAUER.md 8): Entlang der Strecke werden die
 * ersten und letzten `trimM` Meter abgeschnitten (Schnittpunkte im Abschnitt interpoliert), damit Start und Ziel – oft
 * die eigene Haustür – nicht ablesbar sind. Bleibt weniger als ROUTE_PRIVACY_TRIM.minRemainingM übrig → null (Bild
 * ohne Linie, Hinweis „Strecke zu kurz für die Linie“). Rundkurse verlieren so beide Enden. Längengrade über ±180°
 * werden fortlaufend interpoliert. Rein, deterministisch, ohne Logs.
 */

function normalizeLng(lng: number): number {
  let v = lng;
  while (v > 180) v -= 360;
  while (v < -180) v += 360;
  return v;
}

function interpolate(a: LatLng, b: LatLng, f: number): LatLng {
  let dLng = b.lng - a.lng;
  if (dLng > 180) dLng -= 360;
  if (dLng < -180) dLng += 360;
  return { lat: a.lat + (b.lat - a.lat) * f, lng: normalizeLng(a.lng + dLng * f) };
}

const valid = (p: LatLng) =>
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  p.lat >= -90 &&
  p.lat <= 90 &&
  p.lng >= -180 &&
  p.lng <= 180;

/** Strecke ohne die ersten und letzten `trimM` Meter; null, wenn danach zu wenig übrig bleibt. */
export function privacyTrim(
  input: readonly LatLng[],
  trimM: number = ROUTE_PRIVACY_TRIM.trimM,
): LatLng[] | null {
  const points = input.filter(valid);
  if (points.length < 2 || !Number.isFinite(trimM) || trimM < 0) return null;
  const cumulative = [0];
  for (let i = 1; i < points.length; i += 1) {
    cumulative.push(
      (cumulative[i - 1] as number) + haversineM(points[i - 1] as LatLng, points[i] as LatLng),
    );
  }
  const total = cumulative.at(-1) as number;
  const from = trimM;
  const to = total - trimM;
  if (to - from < ROUTE_PRIVACY_TRIM.minRemainingM) return null;

  /** Punkt bei Distanz `d` entlang der Strecke (0 < d < total). */
  const at = (d: number): { point: LatLng; index: number } => {
    // Erster Index mit cumulative[index] >= d (binäre Suche).
    let lo = 1;
    let hi = points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((cumulative[mid] as number) >= d) hi = mid;
      else lo = mid + 1;
    }
    const a = cumulative[lo - 1] as number;
    const b = cumulative[lo] as number;
    const f = b > a ? (d - a) / (b - a) : 0;
    return {
      point: interpolate(points[lo - 1] as LatLng, points[lo] as LatLng, f),
      index: lo,
    };
  };

  const start = at(from);
  const end = at(to);
  const middle: LatLng[] = [];
  for (let i = start.index; i < end.index; i += 1) {
    // Nur Punkte echt innerhalb des Fensters (kein Punkt aus den abgeschnittenen Bögen).
    const d = cumulative[i] as number;
    if (d > from && d < to)
      middle.push({ lat: (points[i] as LatLng).lat, lng: (points[i] as LatLng).lng });
  }
  // Gleiche Punkte hintereinander (Schnitt genau auf einem Punkt) nur einmal.
  return [start.point, ...middle, end.point].filter(
    (p, i, all) => i === 0 || haversineM(all[i - 1] as LatLng, p) > 1e-6,
  );
}

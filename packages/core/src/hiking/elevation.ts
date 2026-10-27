import { ROUTE_ELEVATION, TRACKED_ROUTE_LIMITS } from '../constants';
import type { TrackedRouteSport } from '../enums';
import { elevationGain, type TrackPoint } from '../routes/track';

/**
 * Abstieg und höchster Punkt einer Spur (Sportarten Stufe 1 · Etappe W, docs/PLAN-SPORTARTEN-STUFE-1.md 2.2): dieselbe
 * Glättung wie elevationGain/elevationProfile (gleitender Mittelwert über ROUTE_ELEVATION.smoothingWindow Punkte mit
 * Höhe, Schwelle ROUTE_ELEVATION.thresholdM, Pausen zählen nicht). GPS-Höhe ist ungenau – die App zeigt „ca.“. Werte
 * außerhalb von TRACKED_ROUTE_LIMITS werden null (statt die Strecke abzulehnen). Rein, deterministisch.
 */

/** Abstieg in ganzen Metern (= Anstieg der gespiegelten Höhen); null = zu wenige Punkte mit Höhe. */
export function elevationLoss(
  points: readonly TrackPoint[],
  sport?: TrackedRouteSport,
): number | null {
  const mirrored = points.map((p) =>
    p.altitudeM != null && Number.isFinite(p.altitudeM) ? { ...p, altitudeM: -p.altitudeM } : p,
  );
  return elevationGain(mirrored, sport).gainM;
}

/** Höchster Punkt (geglättet) in ganzen Metern; null = zu wenige Punkte mit Höhe. */
export function maxAltitude(points: readonly TrackPoint[]): number | null {
  const alts: number[] = [];
  for (const p of points) {
    if (p.altitudeM != null && Number.isFinite(p.altitudeM)) alts.push(p.altitudeM);
  }
  if (alts.length < 2) return null;
  const half = Math.floor(ROUTE_ELEVATION.smoothingWindow / 2);
  let max = -Infinity;
  for (let k = 0; k < alts.length; k += 1) {
    const from = Math.max(0, k - half);
    const to = Math.min(alts.length - 1, k + half);
    let sum = 0;
    for (let j = from; j <= to; j += 1) sum += alts[j] as number;
    max = Math.max(max, sum / (to - from + 1));
  }
  return Math.round(max);
}

/** Über mehrere Teilstücke (Pause/Fortsetzen): Abstieg summiert, höchster Punkt über alle; Grenzen wie die Tabelle. */
export function hikingElevationOfSegments(
  segments: readonly (readonly TrackPoint[])[],
  sport: TrackedRouteSport,
): { readonly elevationLossM: number | null; readonly maxAltitudeM: number | null } {
  let loss: number | null = null;
  let max: number | null = null;
  for (const part of segments) {
    const l = elevationLoss(part, sport);
    if (l !== null) loss = (loss ?? 0) + l;
    const m = maxAltitude(part);
    if (m !== null) max = max === null ? m : Math.max(max, m);
  }
  const L = TRACKED_ROUTE_LIMITS;
  return {
    elevationLossM:
      loss !== null && loss >= L.elevationLossM.min && loss <= L.elevationLossM.max ? loss : null,
    maxAltitudeM:
      max !== null && max >= L.maxAltitudeM.min && max <= L.maxAltitudeM.max ? max : null,
  };
}

/** Anstieg einer Höhenfolge mit derselben Schwelle wie elevationGain (Hysterese). */
function climbOf(heights: readonly number[]): number {
  const threshold = ROUTE_ELEVATION.thresholdM;
  let total = 0;
  let low = heights[0] as number;
  let high = low;
  let climbing = false;
  for (let k = 1; k < heights.length; k += 1) {
    const h = heights[k] as number;
    if (climbing) {
      if (h > high) {
        total += h - high;
        high = h;
      } else if (high - h >= threshold) {
        climbing = false;
        low = h;
      }
    } else if (h < low) {
      low = h;
    } else if (h - low >= threshold) {
      climbing = true;
      total += h - low;
      high = h;
    }
  }
  return Math.round(total);
}

/**
 * Für Strecken ohne gespeicherten Abstieg/höchsten Punkt (ältere Strecken, Uhr-Routen älterer App-Fassungen):
 * Anstieg, Abstieg und höchster Punkt aus dem schon geglätteten Höhenprofil [Distanz m, Höhe dm]. null ohne Profil.
 */
export function elevationFromProfile(
  profile: readonly (readonly number[])[] | null,
): { readonly gainM: number; readonly lossM: number; readonly maxM: number } | null {
  if (!profile || profile.length < 2) return null;
  const heights = profile.map((p) => (p[1] ?? 0) / 10);
  return {
    gainM: climbOf(heights),
    lossM: climbOf(heights.map((h) => -h)),
    maxM: Math.round(Math.max(...heights)),
  };
}

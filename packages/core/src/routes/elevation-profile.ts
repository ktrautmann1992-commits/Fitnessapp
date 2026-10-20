import { z } from 'zod';

import { ROUTE_ELEVATION, ROUTE_ELEVATION_PROFILE, TRACKED_ROUTE_LIMITS } from '../constants';
import type { TrackedRouteSport } from '../enums';
import { motionSegments, type TrackPoint } from './track';

/**
 * Höhenprofil einer Strecke (Etappe E4, docs/PLAN-EINKAUFEN-AUSDAUER.md 6): Stützpunkte [Distanz in m, Höhe in dm]
 * entlang der Bewegungsdistanz (Pausen zählen nicht, wie die Distanz der Strecke). Höhe mit derselben Glättung wie
 * elevationGain (gleitender Mittelwert über ROUTE_ELEVATION.smoothingWindow Punkte mit Höhe), höchstens
 * ROUTE_ELEVATION_PROFILE.maxPoints Stützpunkte (gleichmäßig ausgedünnt, Anfang und Ende bleiben). Rein, deterministisch.
 * Gespeichert in tracked_routes.elevation_profile (CHECK = elevationProfileSchema, db-sync.test.ts).
 */

/** Ein Stützpunkt: [Bewegungsdistanz ab Start in ganzen Metern, Höhe in ganzen Dezimetern]. */
export type ElevationProfilePoint = [distanceM: number, heightDm: number];

const P = ROUTE_ELEVATION_PROFILE;

/** Eingabe-Prüfung (save_tracked_route, Feld `elevation_profile`): 2–300 Stützpunkte, Distanz nie fallend. */
export const elevationProfileSchema = z
  .array(
    z.tuple([
      z
        .number()
        .int()
        .min(TRACKED_ROUTE_LIMITS.distanceM.min)
        .max(TRACKED_ROUTE_LIMITS.distanceM.max),
      z.number().int().min(P.heightDm.min).max(P.heightDm.max),
    ]),
  )
  .min(2)
  .max(P.maxPoints)
  .refine((points) => points.every((p, i) => i === 0 || p[0] >= (points[i - 1]?.[0] ?? 0)), {
    message: 'distance_decreasing',
  });

/** Höhenprofil einer Aufzeichnung; [] = zu wenige Punkte mit Höhe (die App zeigt dann kein Profil). */
export function elevationProfile(
  points: readonly TrackPoint[],
  sport: TrackedRouteSport,
): ElevationProfilePoint[] {
  return elevationProfileOfSegments([points], sport);
}

/**
 * Höhenprofil über mehrere Teilstücke einer Aufzeichnung (Pause/Fortsetzen): Die Distanz läuft über die Teilstücke
 * weiter, die Glättung beginnt in jedem Teilstück neu.
 */
export function elevationProfileOfSegments(
  segments: readonly (readonly TrackPoint[])[],
  sport: TrackedRouteSport,
): ElevationProfilePoint[] {
  const raw: [number, number][] = [];
  let offset = 0;
  const half = Math.floor(ROUTE_ELEVATION.smoothingWindow / 2);
  for (const points of segments) {
    const { moving, distanceM } = motionSegments(points, sport);
    const cumulative = [0];
    moving.forEach((m, i) => {
      cumulative.push((cumulative[i] as number) + (m ? (distanceM[i] as number) : 0));
    });
    const alts: { h: number; i: number }[] = [];
    points.forEach((p, i) => {
      if (p.altitudeM != null && Number.isFinite(p.altitudeM)) alts.push({ h: p.altitudeM, i });
    });
    alts.forEach((a, k) => {
      const from = Math.max(0, k - half);
      const to = Math.min(alts.length - 1, k + half);
      let sum = 0;
      for (let j = from; j <= to; j += 1) sum += (alts[j] as { h: number }).h;
      const dm = Math.round((sum / (to - from + 1)) * 10);
      if (dm >= P.heightDm.min && dm <= P.heightDm.max) {
        raw.push([offset + (cumulative[a.i] as number), dm]);
      }
    });
    offset += cumulative.at(-1) as number;
  }
  if (raw.length < 2) return [];
  const picked =
    raw.length <= P.maxPoints
      ? raw
      : Array.from(
          { length: P.maxPoints },
          (_, k) => raw[Math.round((k * (raw.length - 1)) / (P.maxPoints - 1))] as [number, number],
        );
  return picked.map(([d, h]) => [
    Math.min(TRACKED_ROUTE_LIMITS.distanceM.max, Math.max(0, Math.round(d))),
    h,
  ]);
}

/** Tiefster und höchster Punkt des Profils in Metern (für die Achse); null ohne Profil. */
export function elevationRange(
  profile: readonly (readonly [number, number])[] | null,
): { minM: number; maxM: number } | null {
  if (!profile || profile.length < 2) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const [, h] of profile) {
    min = Math.min(min, h);
    max = Math.max(max, h);
  }
  return { minM: min / 10, maxM: max / 10 };
}

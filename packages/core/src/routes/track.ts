import {
  CARDIO_PLAUSIBILITY_KMH,
  ROUTE_AUTO_PAUSE_KMH,
  ROUTE_ELEVATION,
  ROUTE_FILTER,
  ROUTE_SPEED_WARNING,
} from '../constants';
import type { TrackedRouteSport } from '../enums';

/**
 * Strecken aufzeichnen (Phase 10 S1, docs/PLAN-PHASE-10.md 11.2 und 12): Rohpunkte filtern, Distanz, Höhenmeter,
 * automatische Pause und Kilometerzeiten. Reine Funktionen ohne Seiteneffekte; die Rohpunkte bleiben nur auf dem Gerät
 * (Plan 11.2) – nichts davon wird geloggt.
 */

/** Ein Rohpunkt vom Gerät (oder aus einer GPX-Datei). */
export interface TrackPoint {
  /** Breitengrad in Grad (−90 … 90). */
  readonly lat: number;
  /** Längengrad in Grad (−180 … 180). */
  readonly lng: number;
  /** Zeitpunkt in Millisekunden seit 1970 (UTC). */
  readonly t: number;
  /** Gemeldete Genauigkeit in Metern (null/fehlt = unbekannt, z. B. GPX). */
  readonly accuracyM?: number | null;
  /** Höhe in Metern (null/fehlt = unbekannt). */
  readonly altitudeM?: number | null;
}

/** Mittlerer Erdradius in Metern (IUGG, Moritz H. (2000), „Geodetic Reference System 1980“, J Geodesy 74:128–133). */
export const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Abstand zweier Punkte in Metern (Haversine-Formel auf der Kugel). */
export function haversineM(
  a: { readonly lat: number; readonly lng: number },
  b: { readonly lat: number; readonly lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function isValidPoint(p: TrackPoint): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Number.isFinite(p.t) &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lng >= -180 &&
    p.lng <= 180
  );
}

/** Höchste Geschwindigkeit in m/s, ab der ein Punkt als GPS-Sprung gilt (ROUTE_FILTER.jumpFactor). */
export function jumpLimitMps(sport: TrackedRouteSport): number {
  return (CARDIO_PLAUSIBILITY_KMH[sport] * ROUTE_FILTER.jumpFactor) / 3.6;
}

export interface FilterResult {
  readonly points: TrackPoint[];
  /** Wie viele Rohpunkte aus welchem Grund herausgefallen sind (nur Anzahl, keine Koordinaten). */
  readonly dropped: {
    readonly invalid: number;
    readonly inaccurate: number;
    readonly timeNotIncreasing: number;
    readonly stationary: number;
    readonly jump: number;
  };
}

/**
 * Rohpunkte filtern (Plan S1): ungültige Koordinaten raus, Genauigkeit über ROUTE_FILTER.maxAccuracyM raus, Zeit nicht
 * nach dem zuletzt behaltenen Punkt (doppelte Zeitstempel, Zeit rückwärts) raus, Stillstand unter
 * ROUTE_FILTER.minMoveM raus, GPS-Sprung (schneller als jumpLimitMps seit dem zuletzt behaltenen Punkt) raus. Der
 * erste gültige, genaue Punkt bleibt immer. Reihenfolge der Eingabe bleibt; deterministisch, O(n).
 */
export function filterTrackPoints(
  raw: readonly TrackPoint[],
  sport: TrackedRouteSport,
): FilterResult {
  const limit = jumpLimitMps(sport);
  const points: TrackPoint[] = [];
  let invalid = 0;
  let inaccurate = 0;
  let timeNotIncreasing = 0;
  let stationary = 0;
  let jump = 0;
  for (const p of raw) {
    if (!isValidPoint(p)) {
      invalid += 1;
      continue;
    }
    if (p.accuracyM != null && !(p.accuracyM <= ROUTE_FILTER.maxAccuracyM)) {
      inaccurate += 1;
      continue;
    }
    const last = points.at(-1);
    if (last === undefined) {
      points.push(p);
      continue;
    }
    const dt = (p.t - last.t) / 1000;
    if (!(dt > 0)) {
      timeNotIncreasing += 1;
      continue;
    }
    const d = haversineM(last, p);
    if (d < ROUTE_FILTER.minMoveM) {
      stationary += 1;
      continue;
    }
    if (d / dt > limit) {
      jump += 1;
      continue;
    }
    points.push(p);
  }
  return { points, dropped: { invalid, inaccurate, timeNotIncreasing, stationary, jump } };
}

/** Summe der Abstände in Metern (Haversine) über die gegebenen Punkte; 0 bei 0 oder 1 Punkt. */
export function trackDistance(points: readonly { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineM(points[i - 1] as TrackPoint, points[i] as TrackPoint);
  }
  return total;
}

export interface ElevationResult {
  /** Höhenmeter bergauf (gerundet), null = zu wenige Punkte mit Höhe. */
  readonly gainM: number | null;
  /** Hinweis-Code für die App: Höhenmeter per GPS sind ungenau (immer gesetzt, Plan S1). */
  readonly note: 'gps_elevation_inaccurate';
}

/**
 * Höhenmeter bergauf (Plan S1): nur Punkte mit Höhe; gleitender Mittelwert über ROUTE_ELEVATION.smoothingWindow
 * Punkte (zentriert, am Rand kürzer), dann Hysterese: Ein Anstieg zählt erst, wenn er ROUTE_ELEVATION.thresholdM über
 * dem letzten Tiefpunkt liegt; danach zählt jeder weitere Meter bis zum nächsten Abstieg um die Schwelle.
 */
export function elevationGain(points: readonly TrackPoint[]): ElevationResult {
  const alts: number[] = [];
  for (const p of points) {
    if (p.altitudeM != null && Number.isFinite(p.altitudeM)) alts.push(p.altitudeM);
  }
  if (alts.length < 2) return { gainM: null, note: 'gps_elevation_inaccurate' };
  const half = Math.floor(ROUTE_ELEVATION.smoothingWindow / 2);
  // Präfixsummen für den gleitenden Mittelwert in O(n).
  const prefix = [0];
  for (const a of alts) prefix.push((prefix.at(-1) as number) + a);
  const smooth = alts.map((_, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(alts.length - 1, i + half);
    return ((prefix[to + 1] as number) - (prefix[from] as number)) / (to - from + 1);
  });
  const threshold = ROUTE_ELEVATION.thresholdM;
  let gain = 0;
  let low = smooth[0] as number;
  let high = low;
  let climbing = false;
  for (const h of smooth) {
    if (climbing) {
      if (h > high) {
        gain += h - high;
        high = h;
      } else if (high - h >= threshold) {
        climbing = false;
        low = h;
      }
    } else if (h < low) {
      low = h;
    } else if (h - low >= threshold) {
      climbing = true;
      gain += h - low;
      high = h;
    }
  }
  return { gainM: Math.round(gain), note: 'gps_elevation_inaccurate' };
}

export interface AutoPauseResult {
  /** Je Abschnitt (zwischen Punkt i und i+1): in Bewegung? Länge = Punkte − 1 (0 bei weniger als 2 Punkten). */
  readonly moving: boolean[];
  /** Bewegungszeit in Sekunden (ungerundet). */
  readonly movingS: number;
  /** Pausenzeit in Sekunden (ungerundet). */
  readonly pausedS: number;
}

/**
 * Automatische Pause (Plan S1, „unter Gehtempo = Pause“): Ein Abschnitt zwischen zwei gefilterten Punkten, dessen
 * Geschwindigkeit unter ROUTE_AUTO_PAUSE_KMH der Sportart liegt, ist Pause. Ein Funkloch (lange Lücke) zählt als
 * Bewegung, wenn die gerade Linie schnell genug war – sonst als Pause.
 */
export function autoPause(
  points: readonly TrackPoint[],
  sport: TrackedRouteSport,
): AutoPauseResult {
  const minMps = ROUTE_AUTO_PAUSE_KMH[sport] / 3.6;
  const moving: boolean[] = [];
  let movingS = 0;
  let pausedS = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1] as TrackPoint;
    const b = points[i] as TrackPoint;
    const dt = Math.max(0, (b.t - a.t) / 1000);
    const isMoving = dt > 0 && haversineM(a, b) / dt >= minMps;
    moving.push(isMoving);
    if (isMoving) movingS += dt;
    else pausedS += dt;
  }
  return { moving, movingS, pausedS };
}

/**
 * Kilometerzeiten (Plan S1) aus der Bewegung: je VOLLEM Kilometer die Bewegungszeit in ganzen Sekunden. Zeitpunkt
 * einer Kilometer-Grenze linear im Abschnitt interpoliert; Pausen-Abschnitte zählen weder Distanz noch Zeit. Damit die
 * Summe nie über der gerundeten Bewegungszeit liegt, ist jede Zeit die Differenz der GERUNDETEN Zeitpunkte. Ein Rest
 * unter 1 km ergibt keine Kilometerzeit (0,99 km → []; 1,01 km → [Zeit des ersten km]).
 */
export function kmSplits(points: readonly TrackPoint[], sport: TrackedRouteSport): number[] {
  const { moving } = autoPause(points, sport);
  const splits: number[] = [];
  let dist = 0;
  let time = 0;
  let nextKm = 1000;
  let lastRounded = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (!moving[i - 1]) continue;
    const a = points[i - 1] as TrackPoint;
    const b = points[i] as TrackPoint;
    const d = haversineM(a, b);
    const dt = (b.t - a.t) / 1000;
    while (dist + d >= nextKm) {
      const at = time + (dt * (nextKm - dist)) / d;
      const rounded = Math.round(at);
      splits.push(rounded - lastRounded);
      lastRounded = rounded;
      nextKm += 1000;
    }
    dist += d;
    time += dt;
  }
  return splits;
}

/** Bewegungs-Distanz in Metern (nur Abschnitte in Bewegung, ungerundet). */
export function movingDistance(points: readonly TrackPoint[], sport: TrackedRouteSport): number {
  const { moving } = autoPause(points, sport);
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (moving[i - 1]) total += haversineM(points[i - 1] as TrackPoint, points[i] as TrackPoint);
  }
  return total;
}

/**
 * Warnung „Bitte prüfen“ (nicht verwerfen): über mindestens ROUTE_SPEED_WARNING.windowS Sekunden schneller als
 * CARDIO_PLAUSIBILITY_KMH der Sportart (z. B. Bergab-Rad mit 70 km/h, Aufzeichnung im Auto). Zwei Zeiger, O(n).
 */
export function hasSpeedWarning(points: readonly TrackPoint[], sport: TrackedRouteSport): boolean {
  const limit = CARDIO_PLAUSIBILITY_KMH[sport] / 3.6;
  const windowMs = ROUTE_SPEED_WARNING.windowS * 1000;
  // Kumulierte Distanz, damit die Strecke zwischen i und j in O(1) bekannt ist.
  const cum = [0];
  for (let i = 1; i < points.length; i += 1) {
    cum.push(
      (cum.at(-1) as number) + haversineM(points[i - 1] as TrackPoint, points[i] as TrackPoint),
    );
  }
  let j = 0;
  for (let i = 0; i < points.length; i += 1) {
    const start = points[i] as TrackPoint;
    if (j < i) j = i;
    while (j < points.length && (points[j] as TrackPoint).t - start.t < windowMs) j += 1;
    if (j >= points.length) break;
    const dt = ((points[j] as TrackPoint).t - start.t) / 1000;
    // Kleiner Spielraum gegen Rundungsfehler der Gleitkomma-Rechnung (genau 70 km/h → Warnung).
    if (((cum[j] as number) - (cum[i] as number)) / dt >= limit * (1 - 1e-9)) return true;
  }
  return false;
}

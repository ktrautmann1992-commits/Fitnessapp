import {
  CARDIO_PLAUSIBILITY_KMH,
  ROUTE_AUTO_PAUSE_KMH,
  ROUTE_ELEVATION,
  ROUTE_FILTER,
  ROUTE_MOTION,
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
 * nach dem zuletzt behaltenen Punkt (doppelte Zeitstempel, Zeit rückwärts) raus, Stillstand raus (näher als
 * max(ROUTE_FILTER.minMoveM, accuracyMoveFactor × Genauigkeit) am zuletzt behaltenen Punkt, Wächter S1 H1), GPS-Sprung
 * (schneller als jumpLimitMps seit dem zuletzt behaltenen Punkt) raus. Ausreißer am Anfang (Wächter S1 M1): Passen
 * ROUTE_FILTER.reanchorPoints verworfene Sprung-Punkte untereinander zusammen und wurden bis dahin weniger Punkte
 * behalten, wird der Anfang verworfen und dort neu verankert. Reihenfolge der Eingabe bleibt; deterministisch, O(n).
 */
export function filterTrackPoints(
  raw: readonly TrackPoint[],
  sport: TrackedRouteSport,
): FilterResult {
  const limit = jumpLimitMps(sport);
  let points: TrackPoint[] = [];
  let invalid = 0;
  let inaccurate = 0;
  let timeNotIncreasing = 0;
  let stationary = 0;
  let jump = 0;
  // Zusammenhängende, als Sprung verworfene Punkte (Kandidaten für eine Neuverankerung).
  let rejected: TrackPoint[] = [];
  const minMove = (p: TrackPoint) =>
    Math.max(ROUTE_FILTER.minMoveM, ROUTE_FILTER.accuracyMoveFactor * (p.accuracyM ?? 0));
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
    if (d / dt > limit && d >= minMove(p)) {
      jump += 1;
      const prev = rejected.at(-1);
      const consistent =
        prev !== undefined &&
        p.t > prev.t &&
        haversineM(prev, p) / ((p.t - prev.t) / 1000) <= limit;
      rejected = consistent || prev === undefined ? [...rejected, p] : [p];
      if (rejected.length >= ROUTE_FILTER.reanchorPoints && points.length < rejected.length) {
        // Der bisherige Anfang war ein Ausreißer: verwerfen, an den zusammenpassenden Punkten neu verankern.
        jump += points.length - rejected.length;
        points = rejected;
        rejected = [];
      }
      continue;
    }
    rejected = [];
    if (d < minMove(p)) {
      stationary += 1;
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
 * Mit `sport` zählen nur Abschnitte in Bewegung (motionSegments, Wächter S1 H1): In einer Pause wird die Hysterese neu
 * angesetzt, Höhenrauschen im Stehen ergibt keine Höhenmeter.
 */
export function elevationGain(
  points: readonly TrackPoint[],
  sport?: TrackedRouteSport,
): ElevationResult {
  const moving = sport === undefined ? null : motionSegments(points, sport).moving;
  const alts: { h: number; i: number }[] = [];
  points.forEach((p, i) => {
    if (p.altitudeM != null && Number.isFinite(p.altitudeM)) alts.push({ h: p.altitudeM, i });
  });
  if (alts.length < 2) return { gainM: null, note: 'gps_elevation_inaccurate' };
  const half = Math.floor(ROUTE_ELEVATION.smoothingWindow / 2);
  // Präfixsummen für den gleitenden Mittelwert in O(n).
  const prefix = [0];
  for (const a of alts) prefix.push((prefix.at(-1) as number) + a.h);
  const smooth = alts.map((_, k) => {
    const from = Math.max(0, k - half);
    const to = Math.min(alts.length - 1, k + half);
    return ((prefix[to + 1] as number) - (prefix[from] as number)) / (to - from + 1);
  });
  // Alle Abschnitte zwischen zwei Punkten mit Höhe in Bewegung? (ohne Sportart: immer)
  const prefixMoving = [0];
  if (moving)
    for (const m of moving) prefixMoving.push((prefixMoving.at(-1) as number) + (m ? 1 : 0));
  const allMoving = (from: number, to: number) =>
    moving === null || (prefixMoving[to] as number) - (prefixMoving[from] as number) === to - from;
  const threshold = ROUTE_ELEVATION.thresholdM;
  let gain = 0;
  let low = smooth[0] as number;
  let high = low;
  let climbing = false;
  for (let k = 1; k < smooth.length; k += 1) {
    const h = smooth[k] as number;
    if (!allMoving((alts[k - 1] as { i: number }).i, (alts[k] as { i: number }).i)) {
      // Pause: Bezug neu ansetzen, nichts zählen.
      low = h;
      high = h;
      climbing = false;
      continue;
    }
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

export interface MotionResult {
  /** Je Abschnitt (zwischen Punkt i und i+1): in Bewegung? Länge = Punkte − 1 (0 bei weniger als 2 Punkten). */
  readonly moving: boolean[];
  /** Je Abschnitt: Distanz der geglätteten Positionen in Metern (zählt nur in Bewegung). */
  readonly distanceM: number[];
  /** Je Abschnitt: Dauer in Sekunden. */
  readonly dtS: number[];
}

/**
 * Geglättete Positionen (Wächter S1 H1): Mittelwert über höchstens ROUTE_MOTION.smoothingPoints Punkte je Seite,
 * symmetrisch und an Anfang/Ende kürzer (erster und letzter Punkt bleiben). Gerade Strecken bleiben exakt, Rauschen im
 * Stehen mittelt sich heraus. Längengrade über ±180° hinweg fortlaufend gerechnet.
 */
export function smoothPositions(points: readonly TrackPoint[]): { lat: number; lng: number }[] {
  const n = points.length;
  const lat: number[] = [];
  const lng: number[] = [];
  points.forEach((p, i) => {
    lat.push(p.lat);
    if (i === 0) {
      lng.push(p.lng);
    } else {
      const prev = lng[i - 1] as number;
      let d = p.lng - (points[i - 1] as TrackPoint).lng;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      lng.push(prev + d);
    }
  });
  const pLat = [0];
  const pLng = [0];
  for (let i = 0; i < n; i += 1) {
    pLat.push((pLat[i] as number) + (lat[i] as number));
    pLng.push((pLng[i] as number) + (lng[i] as number));
  }
  return points.map((_, i) => {
    const k = Math.min(ROUTE_MOTION.smoothingPoints, i, n - 1 - i);
    const count = 2 * k + 1;
    return {
      lat: ((pLat[i + k + 1] as number) - (pLat[i - k] as number)) / count,
      lng: ((pLng[i + k + 1] as number) - (pLng[i - k] as number)) / count,
    };
  });
}

/**
 * Bewegung je Abschnitt (Plan S1 „unter Gehtempo = Pause“, Wächter S1 H1): Ein Abschnitt ist in Bewegung, wenn die
 * geglättete Position über das Zeitfenster ROUTE_MOTION.windowS um den Abschnitt (halbes Fenster davor und danach)
 * mindestens ROUTE_AUTO_PAUSE_KMH der Sportart vorankommt. Ein Funkloch zählt als Bewegung, wenn die Linie über die
 * Lücke schnell genug war. O(n) mit zwei Zeigern.
 */
export function motionSegments(
  points: readonly TrackPoint[],
  sport: TrackedRouteSport,
): MotionResult {
  const minMps = ROUTE_AUTO_PAUSE_KMH[sport] / 3.6;
  const halfMs = (ROUTE_MOTION.windowS * 1000) / 2;
  const smooth = smoothPositions(points);
  const moving: boolean[] = [];
  const distanceM: number[] = [];
  const dtS: number[] = [];
  let a = 0;
  let b = 0;
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1] as TrackPoint;
    const to = points[i] as TrackPoint;
    while ((points[a] as TrackPoint).t < from.t - halfMs) a += 1;
    if (b < i) b = i;
    while (b + 1 < points.length && (points[b + 1] as TrackPoint).t <= to.t + halfMs) b += 1;
    const span = ((points[b] as TrackPoint).t - (points[a] as TrackPoint).t) / 1000;
    const dt = Math.max(0, (to.t - from.t) / 1000);
    const isMoving =
      dt > 0 &&
      span > 0 &&
      haversineM(smooth[a] as LatLngPoint, smooth[b] as LatLngPoint) / span >= minMps;
    moving.push(isMoving);
    distanceM.push(haversineM(smooth[i - 1] as LatLngPoint, smooth[i] as LatLngPoint));
    dtS.push(dt);
  }
  return { moving, distanceM, dtS };
}

type LatLngPoint = { lat: number; lng: number };

export interface AutoPauseResult {
  /** Je Abschnitt (zwischen Punkt i und i+1): in Bewegung? Länge = Punkte − 1 (0 bei weniger als 2 Punkten). */
  readonly moving: boolean[];
  /** Bewegungszeit in Sekunden (ungerundet). */
  readonly movingS: number;
  /** Pausenzeit in Sekunden (ungerundet). */
  readonly pausedS: number;
}

/** Automatische Pause (Plan S1): Bewegungs- und Pausenzeit aus motionSegments. */
export function autoPause(
  points: readonly TrackPoint[],
  sport: TrackedRouteSport,
): AutoPauseResult {
  const { moving, dtS } = motionSegments(points, sport);
  let movingS = 0;
  let pausedS = 0;
  moving.forEach((m, i) => {
    if (m) movingS += dtS[i] as number;
    else pausedS += dtS[i] as number;
  });
  return { moving, movingS, pausedS };
}

/**
 * Kilometerzeiten (Plan S1) aus der Bewegung: je VOLLEM Kilometer die Bewegungszeit in ganzen Sekunden. Zeitpunkt
 * einer Kilometer-Grenze linear im Abschnitt interpoliert; Pausen-Abschnitte zählen weder Distanz noch Zeit. Damit die
 * Summe nie über der gerundeten Bewegungszeit liegt, ist jede Zeit die Differenz der GERUNDETEN Zeitpunkte. Ein Rest
 * unter 1 km ergibt keine Kilometerzeit (0,99 km → []; 1,01 km → [Zeit des ersten km]).
 */
export function kmSplits(points: readonly TrackPoint[], sport: TrackedRouteSport): number[] {
  const { moving, distanceM, dtS } = motionSegments(points, sport);
  const splits: number[] = [];
  let dist = 0;
  let time = 0;
  let nextKm = 1000;
  let lastRounded = 0;
  moving.forEach((m, i) => {
    if (!m) return;
    const d = distanceM[i] as number;
    const dt = dtS[i] as number;
    while (dist + d >= nextKm) {
      const at = time + (dt * (nextKm - dist)) / d;
      const rounded = Math.round(at);
      splits.push(rounded - lastRounded);
      lastRounded = rounded;
      nextKm += 1000;
    }
    dist += d;
    time += dt;
  });
  return splits;
}

/** Bewegungs-Distanz in Metern (nur Abschnitte in Bewegung, geglättete Positionen, ungerundet). */
export function movingDistance(points: readonly TrackPoint[], sport: TrackedRouteSport): number {
  const { moving, distanceM } = motionSegments(points, sport);
  let total = 0;
  moving.forEach((m, i) => {
    if (m) total += distanceM[i] as number;
  });
  return total;
}

/**
 * Warnung „Bitte prüfen“ (nicht verwerfen): Die geglättete Position kommt über mindestens ROUTE_SPEED_WARNING.windowS
 * Sekunden schneller voran als CARDIO_PLAUSIBILITY_KMH der Sportart (z. B. Bergab-Rad mit 70 km/h, Aufzeichnung im
 * Auto). Rauschen im Stehen löst sie nicht aus. Zwei Zeiger, O(n).
 */
export function hasSpeedWarning(points: readonly TrackPoint[], sport: TrackedRouteSport): boolean {
  const limit = CARDIO_PLAUSIBILITY_KMH[sport] / 3.6;
  const windowMs = ROUTE_SPEED_WARNING.windowS * 1000;
  const smooth = smoothPositions(points);
  let j = 0;
  for (let i = 0; i < points.length; i += 1) {
    const start = points[i] as TrackPoint;
    if (j < i) j = i;
    while (j < points.length && (points[j] as TrackPoint).t - start.t < windowMs) j += 1;
    if (j >= points.length) break;
    const dt = ((points[j] as TrackPoint).t - start.t) / 1000;
    // Kleiner Spielraum gegen Rundungsfehler der Gleitkomma-Rechnung (genau 70 km/h → Warnung).
    if (haversineM(smooth[i] as LatLngPoint, smooth[j] as LatLngPoint) / dt >= limit * (1 - 1e-9)) {
      return true;
    }
  }
  return false;
}

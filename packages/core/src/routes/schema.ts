import { z } from 'zod';

import {
  CARDIO_PLAUSIBILITY_KMH,
  ROUTE_FILTER,
  TRACKED_ROUTE_LIMITS,
  TRACKED_ROUTE_LOG_MATCH,
} from '../constants';
import { addDays, isoDateInTimeZone } from '../dates';
import {
  APP_ROUTE_SOURCES,
  ROUTE_DIFFICULTIES,
  TRACKED_ROUTE_SPORTS,
  type RouteDifficulty,
  type TrackedRouteSource,
  type TrackedRouteSport,
} from '../enums';
import { COMPETITION_NAME_TRIM_CLASS } from '../plan/competition-record';
import {
  type ElevationProfilePoint,
  elevationProfileOfSegments,
  elevationProfileSchema,
} from './elevation-profile';
import { boundingBox, decodePolyline, encodePolyline } from './polyline';
import { simplifyTrack } from './simplify';
import {
  elevationGain,
  filterTrackPoints,
  hasSpeedWarning,
  kmSplitsFromMotion,
  type MotionResult,
  motionSegments,
  type TrackPoint,
} from './track';

/**
 * Gespeicherte Strecke (Phase 10 S1, Tabelle `tracked_routes`): Zod-Schema der Eingabe von `save_tracked_route`
 * (Feldliste = route_keys in der Migration, db-sync.test.ts) und die Zusammenfassung einer Aufzeichnung.
 * Strecken sind privat (RLS nur eigene Zeilen, kein Teilen, keine Ranglisten) und KEIN Gesundheitsdatum (W-G15).
 */

/** Leerraum am Rand des Namens: dieselben Zeichen wie String.prototype.trim() (wie beim Wettkampf, Wächter WP3 N4). */
export const TRACKED_ROUTE_NAME_TRIM_CLASS = COMPETITION_NAME_TRIM_CLASS;

const codePoints = (s: string) => [...s].length;

/** Polyline: nur ASCII 63–126, Länge 1 … polylineMaxChars (wie der CHECK der Tabelle). */
export const POLYLINE_PATTERN = /^[?-~]+$/;

/** Höchste Durchschnittsgeschwindigkeit über die ganze Dauer in km/h (= Sprung-Schwelle des Filters). */
export function trackedRouteMaxAverageKmh(sport: TrackedRouteSport): number {
  return CARDIO_PLAUSIBILITY_KMH[sport] * ROUTE_FILTER.jumpFactor;
}

/** Distanz plausibel zur Dauer? Gleiche Rechnung wie der CHECK `tracked_routes_distance_plausible`. */
export function trackedRouteDistancePlausible(
  sport: TrackedRouteSport,
  distanceM: number,
  durationS: number,
): boolean {
  // In ganzen Zahlen gerechnet wie in SQL: distance_m × 36 ≤ km/h × 10 × duration_s.
  return distanceM * 36 <= trackedRouteMaxAverageKmh(sport) * 10 * durationS;
}

const isoDateTime = z.iso.datetime({ offset: true });
const uuid = z.uuid();
const int = (min: number, max: number) => z.number().int().min(min).max(max);

/**
 * Eingabe von save_tracked_route (strikt, alle Felder Pflicht). `id` erzeugt das Gerät (Warteschlange: gleiche id
 * erneut gesendet → keine zweite Strecke). Anzahl der Punkte und Begrenzungsrahmen rechnet der Server selbst aus der
 * Polyline.
 */
export const trackedRouteSchema = z
  .strictObject({
    id: uuid,
    name: z.string().trim().min(1).max(TRACKED_ROUTE_LIMITS.nameMaxLength),
    sport: z.enum(TRACKED_ROUTE_SPORTS),
    started_at: isoDateTime,
    duration_s: int(TRACKED_ROUTE_LIMITS.durationS.min, TRACKED_ROUTE_LIMITS.durationS.max),
    moving_s: int(0, TRACKED_ROUTE_LIMITS.durationS.max),
    distance_m: int(TRACKED_ROUTE_LIMITS.distanceM.min, TRACKED_ROUTE_LIMITS.distanceM.max),
    elevation_gain_m: int(
      TRACKED_ROUTE_LIMITS.elevationGainM.min,
      TRACKED_ROUTE_LIMITS.elevationGainM.max,
    ).nullable(),
    polyline: z.string().min(1).max(TRACKED_ROUTE_LIMITS.polylineMaxChars).regex(POLYLINE_PATTERN),
    km_splits: z.array(int(1, TRACKED_ROUTE_LIMITS.durationS.max)),
    difficulty: z.enum(ROUTE_DIFFICULTIES).nullable(),
    is_favorite: z.boolean(),
    base_route_id: uuid.nullable(),
    note: z
      .string()
      .refine((s) => {
        const n = codePoints(s);
        return n >= 1 && n <= TRACKED_ROUTE_LIMITS.noteMaxChars;
      })
      .nullable(),
    session_log_id: uuid.nullable(),
    source: z.enum(APP_ROUTE_SOURCES),
    /**
     * Höhenprofil (Etappe E4, additiv): OPTIONAL – ältere App-Fassungen senden das Feld nicht (save_tracked_route nimmt
     * es nur an, verlangt es nie). null bzw. fehlend = kein Profil.
     */
    elevation_profile: elevationProfileSchema.nullable().optional(),
  })
  .superRefine((r, ctx) => {
    if (r.moving_s > r.duration_s) {
      ctx.addIssue({ code: 'custom', path: ['moving_s'], message: 'moving_after_duration' });
    }
    if (!trackedRouteDistancePlausible(r.sport, r.distance_m, r.duration_s)) {
      ctx.addIssue({ code: 'custom', path: ['distance_m'], message: 'distance_implausible' });
    }
    if (r.km_splits.length !== Math.floor(r.distance_m / 1000)) {
      ctx.addIssue({ code: 'custom', path: ['km_splits'], message: 'splits_count' });
    }
    if (r.km_splits.reduce((a, b) => a + b, 0) > r.moving_s) {
      ctx.addIssue({ code: 'custom', path: ['km_splits'], message: 'splits_sum' });
    }
    const points = decodePolyline(r.polyline);
    if (
      points === null ||
      points.length < TRACKED_ROUTE_LIMITS.minPoints ||
      points.length > TRACKED_ROUTE_LIMITS.maxPoints
    ) {
      ctx.addIssue({ code: 'custom', path: ['polyline'], message: 'polyline_points' });
    }
    const started = Date.parse(r.started_at);
    if (started < Date.parse(TRACKED_ROUTE_LIMITS.startedAtMin)) {
      ctx.addIssue({ code: 'custom', path: ['started_at'], message: 'started_too_early' });
    }
    if (r.base_route_id !== null && r.base_route_id === r.id) {
      ctx.addIssue({ code: 'custom', path: ['base_route_id'], message: 'base_is_self' });
    }
  });

export type TrackedRoutePayload = z.infer<typeof trackedRouteSchema>;

/** Zeile von `tracked_routes` (Spalten wie die Datenbank; Abgleich in apps/mobile row-types.test.ts). */
export interface TrackedRouteRow {
  id: string;
  user_id: string;
  name: string;
  sport: TrackedRouteSport;
  started_at: string;
  duration_s: number;
  moving_s: number;
  distance_m: number;
  elevation_gain_m: number | null;
  polyline: string;
  point_count: number;
  /** [Süd, West, Nord, Ost] in Grad (aus der Polyline, setzt der Server). */
  bbox: number[];
  km_splits: number[];
  difficulty: RouteDifficulty | null;
  is_favorite: boolean;
  base_route_id: string | null;
  note: string | null;
  session_log_id: string | null;
  source: TrackedRouteSource;
  /** Höhenprofil [Distanz m, Höhe dm] (Etappe E4); null = keines (ältere Strecken, keine Höhen). */
  elevation_profile: number[][] | null;
  /**
   * Route einer Uhr-Einheit (source `watch`, 23.10.2026): Verknüpfung zu wearable_sessions (geht mit ihr); sonst null.
   * Im Testmodus können ältere gespeicherte Zeilen das Feld nicht haben – dort beim Lesen mit null ergänzt.
   */
  wearable_session_log_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Felder von save_tracked_route, die fehlen dürfen (additiv nach S1 Teil 1). */
export const TRACKED_ROUTE_OPTIONAL_KEYS = ['elevation_profile'] as const;

/** Eingabe von update_tracked_route: nur Name, Schwierigkeit, Favorit und Notiz sind änderbar. */
export const updateTrackedRouteSchema = z.strictObject({
  id: uuid,
  name: trackedRouteSchema.shape.name,
  difficulty: trackedRouteSchema.shape.difficulty,
  is_favorite: z.boolean(),
  note: trackedRouteSchema.shape.note,
});

export type UpdateTrackedRoutePayload = z.infer<typeof updateTrackedRouteSchema>;

/** Zusammenfassung einer Aufzeichnung (vor dem Speichern; Rohpunkte bleiben auf dem Gerät). */
export interface TrackSummary {
  readonly sport: TrackedRouteSport;
  /** Gefilterte Punkte (für Anzeige/GPX vor dem Speichern). */
  readonly points: TrackPoint[];
  /** Beginn (ISO, UTC) = erster gefilterter Punkt; null ohne Punkte. */
  readonly startedAt: string | null;
  /** Dauer in ganzen Sekunden (aufgerundet) vom ersten bis zum letzten gefilterten Punkt. */
  readonly durationS: number;
  /** Bewegungszeit in ganzen Sekunden (≤ durationS). */
  readonly movingS: number;
  /** Bewegungs-Distanz in ganzen Metern (abgerundet, ohne Pausen). */
  readonly distanceM: number;
  readonly elevationGainM: number | null;
  /** Hinweis „Höhenmeter per GPS sind ungenau“. */
  readonly elevationNote: 'gps_elevation_inaccurate';
  readonly kmSplits: number[];
  /** Warnung „Bitte prüfen“ (zu schnell, z. B. 70 km/h bergab) – nicht verworfen. */
  readonly speedWarning: boolean;
  /** Höhenprofil (höchstens ROUTE_ELEVATION_PROFILE.maxPoints Stützpunkte); [] = keine Höhen. */
  readonly elevationProfile: ElevationProfilePoint[];
  /** Vereinfachte Linie (höchstens TRACKED_ROUTE_LIMITS.maxPoints Punkte). */
  readonly polyline: string;
  readonly pointCount: number;
  readonly bbox: readonly [number, number, number, number] | null;
  /** Zu kurz zum Speichern (unter 1 min Dauer, unter 2 Punkten) – die App fragt nach (Plan S1 „Zustände“). */
  readonly tooShort: boolean;
}

/** Rohpunkte einer Aufzeichnung zusammenfassen: filtern, rechnen, vereinfachen, kodieren. */
export function summarizeTrack(raw: readonly TrackPoint[], sport: TrackedRouteSport): TrackSummary {
  return summarizeRecording([raw], sport);
}

/**
 * Aufzeichnung aus mehreren Teilstücken zusammenfassen (Etappe E4: „Pause“ und „Fortsetzen“ beginnen ein neues
 * Teilstück). Jedes Teilstück wird für sich gefiltert und ausgewertet – was zwischen „Pause“ und „Fortsetzen“
 * geschah (z. B. ein Weg im Auto), zählt weder Zeit noch Distanz. Dauer = Summe der Teilstücke; Kilometerzeiten laufen
 * über die Teilstücke weiter; die Linie verbindet die Teilstücke (nur Anzeige). Mit EINEM Teilstück gleich wie bisher
 * (summarizeTrack).
 */
export function summarizeRecording(
  segments: readonly (readonly TrackPoint[])[],
  sport: TrackedRouteSport,
): TrackSummary {
  const filtered = segments.map((raw) => filterTrackPoints(raw, sport).points);
  const points = filtered.flat();
  let spanS = 0;
  let movingRaw = 0;
  let distanceRaw = 0;
  let gain: number | null = null;
  let speedWarning = false;
  const motion: { moving: boolean[]; distanceM: number[]; dtS: number[] } = {
    moving: [],
    distanceM: [],
    dtS: [],
  };
  for (const part of filtered) {
    const first = part[0];
    const last = part.at(-1);
    if (first && last) spanS += (last.t - first.t) / 1000;
    const m: MotionResult = motionSegments(part, sport);
    m.moving.forEach((isMoving, i) => {
      if (isMoving) {
        movingRaw += m.dtS[i] as number;
        distanceRaw += m.distanceM[i] as number;
      }
    });
    motion.moving.push(...m.moving);
    motion.distanceM.push(...m.distanceM);
    motion.dtS.push(...m.dtS);
    const g = elevationGain(part, sport).gainM;
    if (g !== null) gain = (gain ?? 0) + g;
    speedWarning ||= hasSpeedWarning(part, sport);
  }
  const durationS = Math.ceil(spanS);
  const movingS = Math.min(Math.round(movingRaw), durationS);
  const simplified = simplifyTrack(points);
  const polyline = encodePolyline(simplified);
  const first = points[0];
  return {
    sport,
    points,
    startedAt: first ? new Date(first.t).toISOString() : null,
    durationS,
    movingS,
    distanceM: Math.floor(distanceRaw),
    elevationGainM: gain,
    elevationNote: 'gps_elevation_inaccurate',
    kmSplits: kmSplitsFromMotion(motion),
    speedWarning,
    elevationProfile: elevationProfileOfSegments(filtered, sport),
    polyline,
    pointCount: simplified.length,
    bbox: boundingBox(decodePolyline(polyline) ?? []),
    tooShort:
      points.length < TRACKED_ROUTE_LIMITS.minPoints ||
      durationS < TRACKED_ROUTE_LIMITS.durationS.min,
  };
}

/** Angaben der Person beim Speichern (Plan S1: Name, Favorit, Schwierigkeit, Notiz). */
export interface TrackedRouteDetails {
  readonly id: string;
  readonly name: string;
  readonly difficulty: RouteDifficulty | null;
  readonly isFavorite: boolean;
  readonly note: string | null;
  readonly baseRouteId: string | null;
  readonly sessionLogId: string | null;
  readonly source: (typeof APP_ROUTE_SOURCES)[number];
}

/**
 * Zusammenfassung + Angaben → geprüfte Eingabe für save_tracked_route; null, wenn sie nicht gespeichert werden kann
 * (zu kurz, zu lang, unplausibel – die App zeigt dann einen klaren Zustand und behält die Aufzeichnung lokal).
 * Höhenmeter über der Grenze werden weggelassen (null) statt die Strecke abzulehnen.
 */
export function toTrackedRoutePayload(
  summary: TrackSummary,
  details: TrackedRouteDetails,
): TrackedRoutePayload | null {
  if (summary.tooShort || summary.startedAt === null) return null;
  const gain = summary.elevationGainM;
  const parsed = trackedRouteSchema.safeParse({
    id: details.id,
    name: details.name,
    sport: summary.sport,
    started_at: summary.startedAt,
    duration_s: summary.durationS,
    moving_s: summary.movingS,
    distance_m: summary.distanceM,
    elevation_gain_m:
      gain !== null && gain <= TRACKED_ROUTE_LIMITS.elevationGainM.max ? gain : null,
    polyline: summary.polyline,
    km_splits: summary.kmSplits,
    difficulty: details.difficulty,
    is_favorite: details.isFavorite,
    base_route_id: details.baseRouteId,
    note: details.note === null || details.note.trim() === '' ? null : details.note,
    session_log_id: details.sessionLogId,
    source: details.source,
    elevation_profile: summary.elevationProfile.length >= 2 ? summary.elevationProfile : null,
  });
  return parsed.success ? parsed.data : null;
}

/** Was vom Tagebuch-Eintrag für den Abgleich mit der Strecke zählt. */
export interface RouteLinkedLog {
  readonly kind: 'strength' | 'endurance';
  /** Ausdauer-Art des cardio-Teils (null ohne cardio-Teil). */
  readonly modality: string | null;
  readonly performedOn: string;
  readonly durationS: number | null;
  readonly distanceM: number | null;
}

/**
 * Passt ein Tagebuch-Eintrag (noch) zur verknüpften Strecke? (Wächter S1 M3, sichere Variante a – gleiche Regel wie
 * save_tracked_route beim Verknüpfen und save_session_log bei jeder Änderung): Ausdauer derselben Art, Tag = Tag des
 * Beginns (Europe/Berlin) bis TRACKED_ROUTE_LIMITS.sessionLogDayTolerance Tage danach, Distanz höchstens
 * TRACKED_ROUTE_LOG_MATCH.distanceShare bzw. distanceMinM daneben, Dauer zwischen Bewegungszeit − Toleranz und
 * Gesamtdauer + Toleranz.
 */
export function sessionLogFitsRoute(
  log: RouteLinkedLog,
  route: Pick<TrackedRouteRow, 'sport' | 'started_at' | 'duration_s' | 'moving_s' | 'distance_m'>,
): boolean {
  const M = TRACKED_ROUTE_LOG_MATCH;
  const startDay = isoDateInTimeZone(route.started_at);
  const lastDay = addDays(startDay, TRACKED_ROUTE_LIMITS.sessionLogDayTolerance);
  const distanceTolerance = Math.max(M.distanceMinM, route.distance_m * M.distanceShare);
  return (
    log.kind === 'endurance' &&
    log.modality === route.sport &&
    log.performedOn >= startDay &&
    log.performedOn <= lastDay &&
    log.distanceM !== null &&
    Math.abs(log.distanceM - route.distance_m) <= distanceTolerance &&
    log.durationS !== null &&
    log.durationS >= route.moving_s - M.durationToleranceS &&
    log.durationS <= route.duration_s + M.durationToleranceS
  );
}

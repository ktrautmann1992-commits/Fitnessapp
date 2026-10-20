import { z } from 'zod';

import { CARDIO_LOG_LIMITS, ROUTE_RECORDING } from '../constants';
import { TRACKED_ROUTE_SPORTS, type EnduranceModality, type TrackedRouteSport } from '../enums';
import { summarizeRecording, type TrackSummary } from './schema';
import { filterTrackPoints, motionSegments, type TrackPoint } from './track';

/**
 * Laufende Aufzeichnung in der App (Etappe E4, Plan S1 „App“): Start, Pause, Fortsetzen, Stopp als reine Zustands-
 * Übergänge. „Pause“ schließt ein Teilstück, „Fortsetzen“ beginnt ein neues (was dazwischen geschah, zählt nicht –
 * summarizeRecording). Der Zustand wird verschlüsselt auf dem Gerät gesichert (protected-store, alle
 * ROUTE_RECORDING.checkpointIntervalS Sekunden) und nach einem Absturz mit recordingStateSchema geprüft wieder geladen.
 * Keine Koordinaten in Logs oder Fehlern.
 */

export const RECORDING_FORMAT = 1;

export interface RecordingSegment {
  /** Beginn des Teilstücks (Start bzw. „Fortsetzen“), ms seit 1970. */
  readonly startT: number;
  /** Ende („Pause“/„Stopp“); null = läuft. */
  readonly endT: number | null;
  readonly points: readonly TrackPoint[];
}

export type RecordingStatus = 'recording' | 'paused' | 'stopped';

export interface RecordingState {
  readonly format: typeof RECORDING_FORMAT;
  /** id der späteren Strecke (vom Gerät erzeugt, Warteschlange ohne Doppel). */
  readonly id: string;
  /** Konto, dem die Aufzeichnung gehört (nach Kontowechsel nie anbieten). */
  readonly ownerUserId: string;
  readonly sport: TrackedRouteSport;
  /** „Erneut laufen“ einer Favoriten-Strecke (Vergleich) oder null. */
  readonly baseRouteId: string | null;
  readonly status: RecordingStatus;
  readonly segments: readonly RecordingSegment[];
}

const pointSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  t: z.number().int().nonnegative(),
  accuracyM: z.number().nonnegative().nullable().optional(),
  altitudeM: z.number().nullable().optional(),
});

/** Prüfung eines gesicherten Zustands (Wiederaufnahme nach Absturz) – kaputt → verwerfen, nie raten. */
export const recordingStateSchema = z.strictObject({
  format: z.literal(RECORDING_FORMAT),
  id: z.uuid(),
  ownerUserId: z.string().min(1).max(100),
  sport: z.enum(TRACKED_ROUTE_SPORTS),
  baseRouteId: z.uuid().nullable(),
  status: z.enum(['recording', 'paused', 'stopped']),
  segments: z
    .array(
      z.strictObject({
        startT: z.number().int().nonnegative(),
        endT: z.number().int().nonnegative().nullable(),
        points: z.array(pointSchema).max(ROUTE_RECORDING.maxRawPoints),
      }),
    )
    .min(1)
    .max(1_000),
});

export function startRecording(input: {
  id: string;
  ownerUserId: string;
  sport: TrackedRouteSport;
  baseRouteId?: string | null;
  now: number;
}): RecordingState {
  return {
    format: RECORDING_FORMAT,
    id: input.id,
    ownerUserId: input.ownerUserId,
    sport: input.sport,
    baseRouteId: input.baseRouteId ?? null,
    status: 'recording',
    segments: [{ startT: input.now, endT: null, points: [] }],
  };
}

export function recordingPointCount(state: RecordingState): number {
  return state.segments.reduce((n, s) => n + s.points.length, 0);
}

/**
 * Neue Rohpunkte anhängen – nur während „Aufzeichnen“, nur Punkte ab Beginn des Teilstücks und nach dem letzten
 * Punkt (Zeit vorwärts), höchstens ROUTE_RECORDING.maxRawPoints insgesamt. Unveränderter Zustand, wenn nichts passt.
 */
export function addRecordingPoints(
  state: RecordingState,
  points: readonly TrackPoint[],
): RecordingState {
  if (state.status !== 'recording' || points.length === 0) return state;
  const current = state.segments.at(-1);
  if (!current) return state;
  let room = ROUTE_RECORDING.maxRawPoints - recordingPointCount(state);
  let lastT = current.points.at(-1)?.t ?? current.startT - 1;
  const added: TrackPoint[] = [];
  for (const p of [...points].sort((a, b) => a.t - b.t)) {
    if (room <= 0) break;
    if (!Number.isFinite(p.t) || p.t < current.startT || p.t <= lastT) continue;
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    added.push({
      lat: p.lat,
      lng: p.lng,
      t: Math.round(p.t),
      accuracyM: p.accuracyM ?? null,
      altitudeM: p.altitudeM ?? null,
    });
    lastT = p.t;
    room -= 1;
  }
  if (added.length === 0) return state;
  return {
    ...state,
    segments: [
      ...state.segments.slice(0, -1),
      { ...current, points: [...current.points, ...added] },
    ],
  };
}

function closeCurrent(state: RecordingState, now: number): RecordingSegment[] {
  return state.segments.map((s, i) =>
    i === state.segments.length - 1 && s.endT === null
      ? { ...s, endT: Math.max(now, s.startT) }
      : s,
  );
}

export function pauseRecording(state: RecordingState, now: number): RecordingState {
  if (state.status !== 'recording') return state;
  return { ...state, status: 'paused', segments: closeCurrent(state, now) };
}

export function resumeRecording(state: RecordingState, now: number): RecordingState {
  if (state.status !== 'paused') return state;
  return {
    ...state,
    status: 'recording',
    segments: [...state.segments, { startT: now, endT: null, points: [] }],
  };
}

export function stopRecording(state: RecordingState, now: number): RecordingState {
  if (state.status === 'stopped') return state;
  return { ...state, status: 'stopped', segments: closeCurrent(state, now) };
}

/** Aktive Zeit in Sekunden (ohne Pausen): Summe der Teilstücke, das laufende bis `now`. */
export function recordingElapsedS(state: RecordingState, now: number): number {
  const ms = state.segments.reduce(
    (sum, s) => sum + Math.max(0, (s.endT ?? Math.max(now, s.startT)) - s.startT),
    0,
  );
  return Math.floor(ms / 1000);
}

export interface RecordingLiveStats {
  readonly elapsedS: number;
  readonly movingS: number;
  readonly distanceM: number;
}

/** Große Zahlen während der Aufzeichnung (gleiche Filter- und Bewegungsregeln wie beim Speichern). */
export function recordingLiveStats(state: RecordingState, now: number): RecordingLiveStats {
  let movingS = 0;
  let distanceM = 0;
  for (const segment of state.segments) {
    const { points } = filterTrackPoints(segment.points, state.sport);
    const m = motionSegments(points, state.sport);
    m.moving.forEach((isMoving, i) => {
      if (isMoving) {
        movingS += m.dtS[i] as number;
        distanceM += m.distanceM[i] as number;
      }
    });
  }
  return {
    elapsedS: recordingElapsedS(state, now),
    movingS: Math.round(movingS),
    distanceM: Math.floor(distanceM),
  };
}

export type GpsSignal = 'searching' | 'weak' | 'ok';

/**
 * GPS-Zustand: kein Punkt seit ROUTE_RECORDING.gpsSearchingAfterS Sekunden (bzw. noch keiner) → „Suche GPS …“;
 * letzter Punkt ungenauer als gpsWeakAccuracyM → „GPS schwach“; sonst ok. In der Pause immer ok (keine Abfrage).
 */
export function gpsSignal(state: RecordingState, now: number): GpsSignal {
  if (state.status !== 'recording') return 'ok';
  const current = state.segments.at(-1);
  const last = current?.points.at(-1);
  const since = last ? last.t : (current?.startT ?? now);
  if (!last || now - since > ROUTE_RECORDING.gpsSearchingAfterS * 1000) return 'searching';
  if (last.accuracyM != null && last.accuracyM > ROUTE_RECORDING.gpsWeakAccuracyM) return 'weak';
  return 'ok';
}

/** Länger als erlaubt (12 h) oder zu viele Punkte → die App beendet die Aufzeichnung selbst. */
export function recordingLimitReached(state: RecordingState, now: number): boolean {
  return (
    recordingElapsedS(state, now) >= ROUTE_RECORDING.maxDurationS ||
    recordingPointCount(state) >= ROUTE_RECORDING.maxRawPoints
  );
}

export function recordingSummary(state: RecordingState): TrackSummary {
  return summarizeRecording(
    state.segments.map((s) => s.points),
    state.sport,
  );
}

/**
 * Kann gespeichert werden? `too_short` = unter 1 min bzw. unter 2 Punkten (kein Speichern möglich, Schema);
 * `short_distance` = unter ROUTE_RECORDING.minSaveDistanceM (nachfragen, Plan S1); sonst `ok`.
 */
export function recordingSaveCheck(summary: TrackSummary): 'too_short' | 'short_distance' | 'ok' {
  if (summary.tooShort || summary.startedAt === null) return 'too_short';
  if (summary.distanceM < ROUTE_RECORDING.minSaveDistanceM) return 'short_distance';
  return 'ok';
}

/**
 * Werte für den automatischen Tagebuch-Eintrag (Plan S1: „Die App muss den Eintrag beim Speichern aus der Strecke
 * befüllen“, Wächter S1 M3): Dauer in GANZEN Minuten aus der Bewegungszeit (ohne Bewegung: Gesamtdauer), mindestens
 * 1 min; Distanz in Metern; Höhenmeter bis CARDIO_LOG_LIMITS. Passt immer zu sessionLogFitsRoute (± 30 s Rundung,
 * Spielraum 300 s). null bei Distanz unter ROUTE_RECORDING.minSaveDistanceM (dann ohne Eintrag).
 */
export function diaryValuesFromSummary(summary: TrackSummary): {
  modality: EnduranceModality;
  hours: number;
  minutes: number;
  distanceM: number;
  elevationM: number | null;
} | null {
  if (summary.distanceM < ROUTE_RECORDING.minSaveDistanceM || summary.durationS <= 0) return null;
  const base = summary.movingS >= 60 ? summary.movingS : summary.durationS;
  const totalMinutes = Math.max(1, Math.round(base / 60));
  const gain = summary.elevationGainM;
  return {
    modality: summary.sport,
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
    distanceM: Math.min(summary.distanceM, CARDIO_LOG_LIMITS.distanceM.max),
    elevationM: gain !== null && gain <= CARDIO_LOG_LIMITS.elevationM.max ? gain : null,
  };
}

/** Geplante Einheit, zu der eine Aufzeichnung zählen kann (Frage „Zu ‚Lockerer Dauerlauf‘ zählen?“). */
export interface PlannedEnduranceCandidate {
  readonly id: string;
  readonly kind: 'strength' | 'endurance';
  readonly endurance_modality: EnduranceModality | null;
  readonly scheduled_on: string;
  readonly status: string;
}

/**
 * Heute geplante Ausdauer-Einheit GLEICHER Art ohne Eintrag (Plan S1 „Automatischer Tagebuch-Eintrag“); sonst null
 * (freie Einheit A1b). Bei mehreren: die erste in der gegebenen Reihenfolge.
 */
export function plannedEnduranceForRecording<T extends PlannedEnduranceCandidate>(
  sessions: readonly T[],
  loggedSessionIds: ReadonlySet<string>,
  today: string,
  sport: TrackedRouteSport,
): T | null {
  return (
    sessions.find(
      (s) =>
        s.kind === 'endurance' &&
        s.endurance_modality === sport &&
        s.scheduled_on === today &&
        s.status === 'planned' &&
        !loggedSessionIds.has(s.id),
    ) ?? null
  );
}

import { z } from 'zod';

import { TRACKED_ROUTE_LIMITS, WEARABLE_ROUTE, WEARABLE_SYNC } from '../constants';
import type { TrackedRouteSport } from '../enums';
import { elevationProfileSchema } from '../routes/elevation-profile';
import { decodePolyline } from '../routes/polyline';
import {
  POLYLINE_PATTERN,
  summarizeTrack,
  trackedRouteDistancePlausible,
  type TrackSummary,
} from '../routes/schema';
import { filterTrackPoints, type TrackPoint } from '../routes/track';
import type { WearableSessionGroup } from './schema';

/**
 * Route (GPS) einer Uhr-Einheit aus Health Connect (Gründer-Entscheidung 23.10.2026 „Routen lesen“,
 * docs/PLAN-PHASE-8.md 14): Rohpunkte → dieselbe Auswertung wie eine eigene Aufzeichnung (summarizeTrack: Filter,
 * Glättung, Bewegungszeit, Höhenmeter, Kilometerzeiten, vereinfachte Linie) → Eingabe für save_wearable_route. Die
 * Distanz der Einheit kommt aus der Route, wenn sie plausibel ist (WEARABLE_ROUTE), sonst aus den Distance-Datensätzen
 * von Health Connect. Rein; Koordinaten nie in Logs oder Fehlern.
 */

/** Punkt einer Trainingsroute, wie die App ihn aus Health Connect liest (ExerciseRoute.Location). */
export interface HcRouteLocation {
  /** ISO-Zeitpunkt. */
  readonly time: string;
  readonly latitude: number;
  readonly longitude: number;
  /** Höhe in Metern (fehlt oft). */
  readonly altitudeM?: number | null;
  /** Horizontale Genauigkeit in Metern (fehlt oft). */
  readonly accuracyM?: number | null;
}

/**
 * Ergebnis des Lesens einer Route:
 * - `points`: Route da,
 * - `none`: die Uhr hat keine Route geschrieben (z. B. Laufband, GPS aus),
 * - `consent_required`: Health Connect will eine Freigabe für GENAU diese Einheit (Knopf „Route freigeben“),
 * - `not_granted`: Trainingsrouten in Health Connect nicht erlaubt bzw. nicht gelesen,
 * - `error`: Lesen fehlgeschlagen (ohne Inhalt).
 */
export type HcRouteRead =
  | { readonly kind: 'points'; readonly points: readonly HcRouteLocation[] }
  | { readonly kind: 'none' }
  | { readonly kind: 'consent_required' }
  | { readonly kind: 'not_granted' }
  | { readonly kind: 'error' };

/** Höchstens so viele Punkte je Route werden gelesen (12 h × 1 Punkt/s, Schutz vor übergroßen Antworten). */
export const HC_ROUTE_MAX_POINTS = 43_200;

const lengthSchema = z.object({ inMeters: z.number().finite() }).nullish();
const nativeLocationSchema = z.object({
  time: z.string().min(1).max(40),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: lengthSchema,
  horizontalAccuracy: lengthSchema,
});

/**
 * Punkte, wie react-native-health-connect sie liefert (ExerciseRoute.Location: time, latitude, longitude, altitude
 * und horizontalAccuracy als { inMeters }) → HcRouteLocation. Ungültige Punkte fallen weg (Zod), nie mehr als
 * HC_ROUTE_MAX_POINTS.
 */
export function hcLocationsFromNative(value: unknown): HcRouteLocation[] {
  if (!Array.isArray(value)) return [];
  const out: HcRouteLocation[] = [];
  for (const raw of value.slice(0, HC_ROUTE_MAX_POINTS)) {
    const p = nativeLocationSchema.safeParse(raw);
    if (!p.success) continue;
    out.push({
      time: p.data.time,
      latitude: p.data.latitude,
      longitude: p.data.longitude,
      altitudeM: p.data.altitude?.inMeters ?? null,
      accuracyM: p.data.horizontalAccuracy?.inMeters ?? null,
    });
  }
  return out;
}

/**
 * Feld `exerciseRoute` eines gelesenen ExerciseSessionRecord → HcRouteRead. Der Typ kommt als Text ('DATA',
 * 'NO_DATA', 'CONSENT_REQUIRED'; Android-Modul) oder als Zahl (0/1/2; Typen der Bibliothek). Fehlt das Feld → keine
 * Route.
 */
export function hcRouteFromRecord(exerciseRoute: unknown): HcRouteRead {
  if (exerciseRoute === null || typeof exerciseRoute !== 'object') return { kind: 'none' };
  const { type, route } = exerciseRoute as { type?: unknown; route?: unknown };
  if (type === 'CONSENT_REQUIRED' || type === 2) return { kind: 'consent_required' };
  if (type === 'DATA' || type === 0 || (type === undefined && Array.isArray(route))) {
    const points = hcLocationsFromNative(route);
    return points.length > 0 ? { kind: 'points', points } : { kind: 'none' };
  }
  return { kind: 'none' };
}

/** Sportart einer Strecke für die Gruppe der Uhr-Einheit (Schwimmen, Kraft, Sonstige: keine Route). */
export function watchRouteSport(group: WearableSessionGroup): TrackedRouteSport | null {
  return group === 'run' || group === 'walk' || group === 'bike' ? group : null;
}

/** Health-Connect-Punkte → TrackPoints (ungültige Zeitpunkte fallen weg, zeitlich sortiert). */
export function trackPointsFromHc(points: readonly HcRouteLocation[]): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (const p of points) {
    const t = Date.parse(p.time);
    if (!Number.isFinite(t)) continue;
    out.push({
      lat: p.latitude,
      lng: p.longitude,
      t,
      accuracyM: p.accuracyM ?? null,
      altitudeM: p.altitudeM ?? null,
    });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Ausgewertete Route einer Uhr-Einheit (gerundet, wie tracked_routes sie speichert). */
export interface WatchRouteSummary {
  readonly sport: TrackedRouteSport;
  readonly distanceM: number;
  readonly movingS: number;
  readonly elevationGainM: number | null;
  readonly kmSplits: number[];
  readonly polyline: string;
  readonly elevationProfile: TrackSummary['elevationProfile'];
  readonly pointCount: number;
}

export type WatchRouteUnusable =
  /** Schwimmen, Kraft, Sonstige. */
  | 'no_sport'
  /** Weniger als WEARABLE_ROUTE.minPoints gefilterte Punkte. */
  | 'too_few_points'
  /** Route deckt weniger als WEARABLE_ROUTE.minCoverage der Dauer ab. */
  | 'coverage'
  /** Zu schnell für die Sportart (Sprünge, im Auto) bzw. Distanz 0. */
  | 'implausible'
  /** Weicht zu stark von der Distanz laut Health Connect ab (WEARABLE_ROUTE.hcRatio). */
  | 'mismatch';

export type WatchRouteOutcome =
  | { readonly kind: 'ok'; readonly summary: WatchRouteSummary }
  | { readonly kind: 'unusable'; readonly reason: WatchRouteUnusable };

/**
 * Route einer Uhr-Einheit auswerten. Nur Punkte im Zeitraum der Einheit zählen; Dauer der Einheit = Ende − Beginn
 * (wie die Einheit im Tagebuch). `hcDistanceM` = Summe Distance laut Health Connect (null = unbekannt, dann kein
 * Abgleich).
 */
export function summarizeWatchRoute(
  locations: readonly HcRouteLocation[],
  group: WearableSessionGroup,
  window: { readonly startedAt: string; readonly finishedAt: string },
  hcDistanceM: number | null = null,
): WatchRouteOutcome {
  const sport = watchRouteSport(group);
  if (sport === null) return { kind: 'unusable', reason: 'no_sport' };
  const from = Date.parse(window.startedAt);
  const to = Date.parse(window.finishedAt);
  const durationS = Math.round((to - from) / 1000);
  if (!Number.isFinite(from) || !Number.isFinite(to) || durationS <= 0) {
    return { kind: 'unusable', reason: 'implausible' };
  }
  const points = trackPointsFromHc(locations).filter((p) => p.t >= from && p.t <= to);
  // Viele Sprünge = keine Laufstrecke (z. B. im Auto aufgezeichnet) – nicht „gerettet“ durch den Filter.
  const { dropped } = filterTrackPoints(points, sport);
  if (points.length > 0 && dropped.jump > WEARABLE_ROUTE.maxJumpShare * points.length) {
    return { kind: 'unusable', reason: 'implausible' };
  }
  const summary = summarizeTrack(points, sport);
  const first = summary.points[0];
  const last = summary.points.at(-1);
  if (summary.points.length < WEARABLE_ROUTE.minPoints || !first || !last) {
    return { kind: 'unusable', reason: 'too_few_points' };
  }
  if ((last.t - first.t) / 1000 < WEARABLE_ROUTE.minCoverage * durationS) {
    return { kind: 'unusable', reason: 'coverage' };
  }
  if (
    summary.distanceM <= 0 ||
    summary.speedWarning ||
    !trackedRouteDistancePlausible(sport, summary.distanceM, durationS)
  ) {
    return { kind: 'unusable', reason: 'implausible' };
  }
  if (hcDistanceM !== null && Number.isFinite(hcDistanceM) && hcDistanceM > 0) {
    const ratio = summary.distanceM / hcDistanceM;
    if (ratio < WEARABLE_ROUTE.hcRatio.min || ratio > WEARABLE_ROUTE.hcRatio.max) {
      return { kind: 'unusable', reason: 'mismatch' };
    }
  }
  const gain = summary.elevationGainM;
  return {
    kind: 'ok',
    summary: {
      sport,
      distanceM: summary.distanceM,
      movingS: Math.min(summary.movingS, durationS),
      elevationGainM:
        gain !== null && gain <= TRACKED_ROUTE_LIMITS.elevationGainM.max ? gain : null,
      kmSplits: summary.kmSplits,
      polyline: summary.polyline,
      elevationProfile: summary.elevationProfile,
      pointCount: summary.pointCount,
    },
  };
}

/** Woher die Distanz einer Uhr-Einheit stammt (Anzeige „aus der Route“ bzw. „laut Health Connect“). */
export type WatchDistanceSource =
  /** Aus der gerade gelesenen Route. */
  | 'route'
  /** Aus der früher gespeicherten Route (Route gerade nicht lesbar, z. B. Freigabe je Einheit). */
  | 'stored_route'
  /** Summe der Distance-Datensätze laut Health Connect. */
  | 'health_connect';

/**
 * Distanz einer Uhr-Einheit wählen: Route (plausibel) → gespeicherte Route → Health Connect → keine.
 */
export function chooseWatchDistance(input: {
  readonly route: WatchRouteOutcome | null;
  readonly storedRouteDistanceM: number | null;
  readonly hcDistanceM: number | null;
}): { readonly distanceM: number | null; readonly source: WatchDistanceSource | null } {
  if (input.route?.kind === 'ok')
    return { distanceM: input.route.summary.distanceM, source: 'route' };
  if (input.storedRouteDistanceM !== null && input.storedRouteDistanceM > 0) {
    return { distanceM: input.storedRouteDistanceM, source: 'stored_route' };
  }
  if (input.hcDistanceM !== null && Number.isFinite(input.hcDistanceM)) {
    return { distanceM: input.hcDistanceM, source: 'health_connect' };
  }
  return { distanceM: null, source: null };
}

const int = (min: number, max: number) => z.number().int().min(min).max(max);
const L = TRACKED_ROUTE_LIMITS;

/**
 * Eingabe von save_wearable_route (strikt; Feldliste = route_keys der Migration 20261023120100_wearable_routes.sql,
 * db-sync.test.ts). Sportart, Beginn, Dauer und Name nimmt der Server aus der übernommenen Einheit (external_id) –
 * das Gerät sendet nur, was es aus der Route gerechnet hat.
 */
export const wearableRoutePayloadSchema = z
  .strictObject({
    external_id: z.string().min(1).max(WEARABLE_SYNC.externalIdMaxLength),
    distance_m: int(L.distanceM.min, L.distanceM.max),
    moving_s: int(0, L.durationS.max),
    elevation_gain_m: int(L.elevationGainM.min, L.elevationGainM.max).nullable(),
    polyline: z.string().min(1).max(L.polylineMaxChars).regex(POLYLINE_PATTERN),
    km_splits: z.array(int(1, L.durationS.max)),
    elevation_profile: elevationProfileSchema.nullable(),
    /**
     * Sportarten Stufe 1 (Wandern/Bergwandern): Abstieg und höchster Punkt (TRACKED_ROUTE_LIMITS). Optional – fehlt =
     * null (ältere App-Fassungen). Die Art der Geh-Einheit übernimmt der Server aus dem Eintrag.
     */
    elevation_loss_m: int(L.elevationLossM.min, L.elevationLossM.max).nullable().optional(),
    max_altitude_m: int(L.maxAltitudeM.min, L.maxAltitudeM.max).nullable().optional(),
  })
  .superRefine((r, ctx) => {
    if (r.km_splits.length !== Math.floor(r.distance_m / 1000)) {
      ctx.addIssue({ code: 'custom', path: ['km_splits'], message: 'splits_count' });
    }
    if (r.km_splits.reduce((a, b) => a + b, 0) > r.moving_s) {
      ctx.addIssue({ code: 'custom', path: ['km_splits'], message: 'splits_sum' });
    }
    const points = decodePolyline(r.polyline);
    if (points === null || points.length < L.minPoints || points.length > L.maxPoints) {
      ctx.addIssue({ code: 'custom', path: ['polyline'], message: 'polyline_points' });
    }
  });
export type WearableRoutePayload = z.infer<typeof wearableRoutePayloadSchema>;

/** Ausgewertete Route → geprüfte Eingabe für save_wearable_route (null = nicht speicherbar). */
export function wearableRoutePayload(
  externalId: string,
  summary: WatchRouteSummary,
): WearableRoutePayload | null {
  const parsed = wearableRoutePayloadSchema.safeParse({
    external_id: externalId,
    distance_m: summary.distanceM,
    moving_s: summary.movingS,
    elevation_gain_m: summary.elevationGainM,
    polyline: summary.polyline,
    km_splits: summary.kmSplits,
    elevation_profile: summary.elevationProfile.length >= 2 ? summary.elevationProfile : null,
  });
  return parsed.success ? parsed.data : null;
}

export type ReleasedWatchRoute =
  | { readonly kind: 'ok'; readonly payload: WearableRoutePayload }
  /** Die Uhr hat für diese Einheit keine Route gespeichert. */
  | { readonly kind: 'none' }
  /** Freigabe abgelehnt oder Lesen fehlgeschlagen. */
  | { readonly kind: 'denied' }
  /** Route zu lückenhaft/unplausibel (Distanz bleibt laut Health Connect). */
  | { readonly kind: 'unusable' };

/**
 * „Route freigeben“ (Freigabe je Einheit in Health Connect): gelesene Route einer schon übernommenen Einheit →
 * Eingabe für save_wearable_route. `currentDistanceM` = Distanz des Eintrags (laut Health Connect) für den Abgleich.
 */
export function releasedWatchRoute(
  read: HcRouteRead,
  session: {
    readonly externalId: string;
    readonly group: WearableSessionGroup;
    readonly startedAt: string;
    readonly finishedAt: string;
    readonly currentDistanceM: number | null;
  },
): ReleasedWatchRoute {
  if (read.kind === 'none') return { kind: 'none' };
  if (read.kind !== 'points') return { kind: 'denied' };
  const outcome = summarizeWatchRoute(
    read.points,
    session.group,
    { startedAt: session.startedAt, finishedAt: session.finishedAt },
    session.currentDistanceM,
  );
  const payload =
    outcome.kind === 'ok' ? wearableRoutePayload(session.externalId, outcome.summary) : null;
  return payload ? { kind: 'ok', payload } : { kind: 'unusable' };
}

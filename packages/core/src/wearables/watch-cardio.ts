import { CARDIO_LOG_LIMITS } from '../constants';
import {
  type EnduranceModality,
  type LogSource,
  TRACKED_ROUTE_SPORTS,
  type TrackedRouteSport,
} from '../enums';
import { trackedRouteDistancePlausible } from '../routes/schema';

/**
 * Uhr gewinnt bei Distanz und Zeit (Gründer-Entscheidung 06.11.2026, docs/PLAN-PHASE-8.md 5.2): Wird eine in der App
 * mit GPS aufgezeichnete Einheit (Herkunft `gps`) mit derselben Einheit der Uhr zusammengeführt (automatisch oder nach
 * „Möglicher Doppel-Eintrag“ → „Zusammenführen“), übernimmt der Eintrag Distanz UND Dauer der Uhr. Linie,
 * Kilometerzeiten, Name und Höhenmeter der App-Aufzeichnung bleiben (tracked_routes).
 *
 * Nur als PAAR: Fehlt der Uhr eine brauchbare Distanz (null, 0, außerhalb CARDIO_LOG_LIMITS) oder ist sie zur Dauer
 * der Uhr unplausibel (trackedRouteDistancePlausible, gleiche Rechnung wie der CHECK der Strecken), bleiben Distanz
 * und Dauer der App – so passt das Tempo immer zu Distanz und Zeit derselben Quelle. Andere Herkunft (manuell,
 * GPX-Import, Workout) bzw. Art ohne GPS-Aufzeichnung (Schwimmen, Rudern): Eintrag bleibt führend wie bisher.
 * Gleiche Regel in import_wearable_batch und resolve_wearable_duplicate (20261106120000_uhr_distanz.sql). Rein.
 */

export interface CardioValues {
  readonly durationS: number;
  readonly distanceM: number | null;
}

export interface WatchCardioInput {
  /** Herkunft des vorhandenen Eintrags (session_logs.source). */
  readonly logSource: LogSource;
  readonly modality: EnduranceModality;
  /** Werte des Eintrags (cardio_logs). */
  readonly app: CardioValues;
  /** Werte der Uhr-Einheit; null = unbekannt. */
  readonly watch: { readonly durationS: number | null; readonly distanceM: number | null };
}

export interface WatchCardioResult extends CardioValues {
  /** true = Distanz und Dauer stammen von der Uhr. */
  readonly fromWatch: boolean;
}

const isTrackedSport = (m: EnduranceModality): m is TrackedRouteSport =>
  (TRACKED_ROUTE_SPORTS as readonly string[]).includes(m);

const inRange = (v: number, r: { readonly min: number; readonly max: number }) =>
  Number.isInteger(v) && v >= r.min && v <= r.max;

/** Welche Distanz und Dauer gilt nach dem Zusammenführen mit der Uhr? */
export function mergedCardioValues(input: WatchCardioInput): WatchCardioResult {
  const keep: WatchCardioResult = { ...input.app, fromWatch: false };
  const { durationS, distanceM } = input.watch;
  if (input.logSource !== 'gps' || !isTrackedSport(input.modality)) return keep;
  if (durationS === null || !inRange(durationS, CARDIO_LOG_LIMITS.durationS)) return keep;
  if (distanceM === null || distanceM <= 0 || !inRange(distanceM, CARDIO_LOG_LIMITS.distanceM)) {
    return keep;
  }
  if (!trackedRouteDistancePlausible(input.modality, distanceM, durationS)) return keep;
  return { durationS, distanceM, fromWatch: true };
}

/**
 * Anzeige einer aufgezeichneten Strecke (Kopf-Karte): Distanz und Zeit laut Uhr, wenn der verknüpfte GPS-Eintrag mit
 * einer Uhr-Einheit zusammengeführt ist und seine Werte von der Strecke abweichen (= von der Uhr übernommen). Sonst
 * null → Werte der Strecke. Ältere Zusammenführungen (vor 06.11.2026) behalten so die App-Werte.
 */
export function watchCardioForRoute(input: {
  readonly logSource: LogSource | null;
  readonly merged: boolean;
  readonly cardio: { readonly duration_s: number; readonly distance_m: number | null } | null;
  readonly route: { readonly distance_m: number; readonly moving_s: number };
}): { readonly distanceM: number; readonly durationS: number } | null {
  const { cardio, route } = input;
  if (input.logSource !== 'gps' || !input.merged || !cardio || cardio.distance_m === null) {
    return null;
  }
  if (cardio.distance_m <= 0 || cardio.duration_s <= 0) return null;
  if (cardio.distance_m === route.distance_m && cardio.duration_s === route.moving_s) return null;
  return { distanceM: cardio.distance_m, durationS: cardio.duration_s };
}

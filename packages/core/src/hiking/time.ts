import { HIKING_TIME } from '../constants';

/**
 * Gehzeit-Schätzung nach DIN 33466 / DAV (HIKING_TIME): horizontal Distanz ÷ 4 km/h, vertikal Aufstieg ÷ 300 Hm/h +
 * Abstieg ÷ 500 Hm/h; Gehzeit = größerer Wert + halber kleinerer. Ohne Pausen, nur Anzeige („ca.“) für gespeicherte
 * Strecken. Rein.
 */

export interface HikingTimeInput {
  readonly distanceM: number;
  /** Anstieg in m; null = unbekannt (zählt wie 0, die App sagt „ohne Höhenmeter“). */
  readonly gainM: number | null;
  /** Abstieg in m; null = unbekannt. */
  readonly lossM: number | null;
}

export interface HikingTimeEstimate {
  /** Gerundet auf HIKING_TIME.roundToMin, mindestens ein Schritt. */
  readonly minutes: number;
  readonly horizontalMin: number;
  readonly verticalMin: number;
  /** Ohne Höhenangaben gerechnet (nur horizontal). */
  readonly withoutElevation: boolean;
}

const finiteNonNegative = (v: number | null): number =>
  v !== null && Number.isFinite(v) && v > 0 ? v : 0;

/** null bei zu kurzer bzw. ungültiger Distanz (unter HIKING_TIME.minDistanceM). */
export function hikingTimeEstimate(input: HikingTimeInput): HikingTimeEstimate | null {
  const T = HIKING_TIME;
  if (!Number.isFinite(input.distanceM) || input.distanceM < T.minDistanceM) return null;
  const horizontalMin = (input.distanceM / 1000 / T.horizontalKmh) * 60;
  const verticalMin =
    (finiteNonNegative(input.gainM) / T.ascentMPerH +
      finiteNonNegative(input.lossM) / T.descentMPerH) *
    60;
  const total = Math.max(horizontalMin, verticalMin) + Math.min(horizontalMin, verticalMin) / 2;
  const minutes = Math.max(T.roundToMin, Math.round(total / T.roundToMin) * T.roundToMin);
  return {
    minutes,
    horizontalMin: Math.round(horizontalMin),
    verticalMin: Math.round(verticalMin),
    withoutElevation: input.gainM === null && input.lossM === null,
  };
}

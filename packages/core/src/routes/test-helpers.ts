import { EARTH_RADIUS_M, type TrackPoint } from './track';

/** Startpunkt der Test-Strecken (Kölner Dom, öffentlicher Ort – keine echten Nutzerdaten). */
export const START: { readonly lat: number; readonly lng: number } = { lat: 50.9413, lng: 6.9583 };
export const T0 = Date.parse('2026-10-16T07:00:00Z');

const M_PER_DEG_LAT = (Math.PI / 180) * EARTH_RADIUS_M;

/** Punkt `north` Meter nördlich und `east` Meter östlich von `from`. */
export function offset(
  from: { lat: number; lng: number },
  north: number,
  east: number,
): { lat: number; lng: number } {
  const lat = from.lat + north / M_PER_DEG_LAT;
  const lng = from.lng + east / (M_PER_DEG_LAT * Math.cos((from.lat * Math.PI) / 180));
  return { lat, lng };
}

export interface LineOptions {
  /** Geschwindigkeit in m/s. */
  readonly speedMps: number;
  /** Anzahl Punkte. */
  readonly count: number;
  /** Abstand der Punkte in Sekunden (Standard 1). */
  readonly stepS?: number;
  readonly start?: { lat: number; lng: number };
  readonly t0?: number;
  /** Richtung: Norden (Standard) oder Osten. */
  readonly direction?: 'north' | 'east';
  readonly accuracyM?: number | null;
  /** Höhe je Punkt (Index → Meter). */
  readonly altitude?: (i: number) => number | null;
}

/** Gerade Strecke mit gleichmäßiger Geschwindigkeit. */
export function line(o: LineOptions): TrackPoint[] {
  const step = o.stepS ?? 1;
  const start = o.start ?? START;
  const t0 = o.t0 ?? T0;
  const points: TrackPoint[] = [];
  for (let i = 0; i < o.count; i += 1) {
    const m = o.speedMps * step * i;
    const p = o.direction === 'east' ? offset(start, 0, m) : offset(start, m, 0);
    points.push({
      ...p,
      t: t0 + i * step * 1000,
      accuracyM: o.accuracyM === undefined ? 5 : o.accuracyM,
      altitudeM: o.altitude ? o.altitude(i) : null,
    });
  }
  return points;
}

/** Punkte zeitlich und räumlich hintereinander hängen (zweite Strecke beginnt am Ende der ersten). */
export function last(points: readonly TrackPoint[]): TrackPoint {
  const p = points.at(-1);
  if (!p) throw new Error('leere Strecke');
  return p;
}

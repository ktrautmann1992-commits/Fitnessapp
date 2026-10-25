import { z } from 'zod';

import { LOOP_ROUTE, TRACKED_ROUTE_LIMITS } from '../constants';
import { decodePolyline, encodePolyline, type LatLng } from './polyline';
import { POLYLINE_PATTERN } from './schema';
import { simplifyTrack } from './simplify';
import { EARTH_RADIUS_M, trackDistance } from './track';

/**
 * Rundkurs-Vorschlag (Gründer-Freigabe 25.10.2026, docs/PLAN-RUNDKURS.md): reine Regeln für Anfrage, Datenminimierung
 * (Startpunkt auf 50 m gerundet) und Bewertung der Runden, die der Routing-Dienst liefert – Distanz-Toleranz,
 * „hin und zurück“-Anteil (doppelt gelaufene Wege), Untergrund-Wunsch, keine fast gleichen Runden. Der Dienst selbst
 * wird nur im Server angesprochen (apps/web, Schlüssel nie in der App). Rein, deterministisch, ohne Logs.
 */

/** Untergrund-Wunsch: Asphalt, Wald- und Feldwege oder egal. */
export const LOOP_SURFACES = ['paved', 'unpaved', 'any'] as const;
export type LoopSurface = (typeof LOOP_SURFACES)[number];

const M_PER_DEG_LAT = (Math.PI / 180) * EARTH_RADIUS_M;
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

const coordinate = (max: number) => z.number().finite().min(-max).max(max);

/** Anfrage der App an den Server (POST /api/strecken/rundkurs) – nur Startpunkt, Distanz, Untergrund, Variante. */
export const loopRequestSchema = z.strictObject({
  lat: coordinate(90),
  lng: coordinate(180),
  distance_km: z.number().int().min(LOOP_ROUTE.distanceKm.min).max(LOOP_ROUTE.distanceKm.max),
  surface: z.enum(LOOP_SURFACES),
  /** 0 = erste Vorschläge, 1, 2, … = „Andere Runden“ (andere Zufallswerte beim Dienst). */
  variant: z.number().int().min(0).max(LOOP_ROUTE.variantMax),
});
export type LoopRequest = z.infer<typeof loopRequestSchema>;

const share = z.number().min(0).max(1);

/** Anteile des Untergrunds (Summe ≈ 1); null = Dienst kennt den Untergrund nicht. */
export const loopSurfaceSharesSchema = z.strictObject({
  paved: share,
  unpaved: share,
  unknown: share,
});
export type LoopSurfaceShares = z.infer<typeof loopSurfaceSharesSchema>;

/** Eine vorgeschlagene Runde (an der Grenze Server → App). */
export const loopRouteSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  polyline: z.string().min(1).max(TRACKED_ROUTE_LIMITS.polylineMaxChars).regex(POLYLINE_PATTERN),
  distance_m: z
    .number()
    .int()
    .min(1)
    .max(LOOP_ROUTE.distanceKm.max * 1000 * 3),
  /** Höhenmeter bergauf; null = nicht verfügbar. */
  ascent_m: z.number().int().min(0).max(10_000).nullable(),
  surface: loopSurfaceSharesSchema.nullable(),
  /** Anteil doppelt gelaufener Wege (0–1). */
  overlap: share,
  /** Bewertung 0–100 (höher = besser). */
  score: z.number().int().min(0).max(100),
});
export type LoopRoute = z.infer<typeof loopRouteSchema>;

/** Antwort des Servers. `ok` hat 1–3 Runden; die übrigen Codes sind feste Zustände ohne Inhalte. */
export const loopResponseSchema = z.discriminatedUnion('code', [
  z.strictObject({
    code: z.literal('ok'),
    routes: z.array(loopRouteSchema).min(1).max(LOOP_ROUTE.maxSuggestions),
  }),
  z.strictObject({ code: z.literal('no_routes') }),
  z.strictObject({ code: z.literal('not_configured') }),
  z.strictObject({ code: z.literal('rate_limited') }),
  z.strictObject({ code: z.literal('unavailable') }),
  z.strictObject({ code: z.literal('invalid_request') }),
  z.strictObject({ code: z.literal('unauthorized') }),
  z.strictObject({ code: z.literal('forbidden_origin') }),
]);
export type LoopResponse = z.infer<typeof loopResponseSchema>;
export type LoopResponseCode = LoopResponse['code'];

/** Runde, wie sie vom Dienst (bzw. der Attrappe) kommt – vor Bewertung und Auswahl. */
export interface LoopCandidate {
  readonly id: string;
  readonly points: readonly LatLng[];
  /** Distanz laut Dienst (Meter); fehlt → aus den Punkten gerechnet. */
  readonly distanceM?: number | null;
  readonly ascentM: number | null;
  readonly surface: LoopSurfaceShares | null;
}

/**
 * Startpunkt auf ein Raster von `gridM` Metern runden (Datenminimierung, bevor er die App verlässt; der Server rundet
 * noch einmal). Abweichung höchstens ca. 0,71 × gridM. Idempotent.
 */
export function roundStartPoint(point: LatLng, gridM: number = LOOP_ROUTE.startRoundingM): LatLng {
  const latStep = gridM / M_PER_DEG_LAT;
  const lat = Math.max(-89, Math.min(89, Math.round(point.lat / latStep) * latStep));
  const lngStep = gridM / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  let lng = Math.round(point.lng / lngStep) * lngStep;
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;
  return { lat: round6(lat), lng: round6(lng) };
}

/** Zufallswerte („seed“) für den Dienst: je Variante `providerCandidates` neue, nie doppelt. */
export function loopSeeds(
  variant: number,
  count: number = LOOP_ROUTE.providerCandidates,
): number[] {
  const v = Math.max(0, Math.floor(variant));
  return Array.from({ length: count }, (_, i) => v * count + i);
}

/** Bestellte Länge beim Dienst in Metern (etwas kürzer, weil der Dienst eher zu lang liefert). */
export function loopRequestLengthM(distanceKm: number): number {
  return Math.round(distanceKm * 1000 * LOOP_ROUTE.requestLengthFactor);
}

interface Sample {
  readonly x: number;
  readonly y: number;
  /** Strecke ab Start in Metern. */
  readonly d: number;
}

/** Punkte flach projizieren (Meter um den ersten Punkt) – für kurze Abstände genau genug. */
function projector(origin: LatLng) {
  const cos = Math.cos((origin.lat * Math.PI) / 180);
  return (p: LatLng) => ({
    x: (p.lng - origin.lng) * M_PER_DEG_LAT * cos,
    y: (p.lat - origin.lat) * M_PER_DEG_LAT,
  });
}

const validPoint = (p: LatLng) =>
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lng) <= 180;

/** Gleichmäßig alle `stepM` Meter abtasten (höchstens `maxSamples` Punkte); dazu die Gesamtlänge. */
function resample(
  points: readonly LatLng[],
  origin: LatLng,
  stepM: number = LOOP_ROUTE.overlap.sampleM,
  maxSamples: number = LOOP_ROUTE.overlap.maxSamples,
): { samples: Sample[]; total: number } {
  const valid = points.filter(validPoint);
  if (valid.length < 2) return { samples: [], total: 0 };
  const project = projector(origin);
  const xy = valid.map(project);
  const cumulative = [0];
  for (let i = 1; i < xy.length; i += 1) {
    const a = xy[i - 1] as { x: number; y: number };
    const b = xy[i] as { x: number; y: number };
    cumulative.push((cumulative[i - 1] as number) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = cumulative.at(-1) as number;
  if (total <= 0) return { samples: [], total: 0 };
  const step = Math.max(stepM, total / maxSamples);
  const samples: Sample[] = [];
  let seg = 1;
  for (let d = 0; d <= total; d += step) {
    while (seg < xy.length - 1 && (cumulative[seg] as number) < d) seg += 1;
    const a0 = cumulative[seg - 1] as number;
    const a1 = cumulative[seg] as number;
    const f = a1 > a0 ? Math.min(1, Math.max(0, (d - a0) / (a1 - a0))) : 0;
    const a = xy[seg - 1] as { x: number; y: number };
    const b = xy[seg] as { x: number; y: number };
    samples.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, d });
  }
  return { samples, total };
}

/** Raster-Index über Abtastpunkte (Zellgröße = Suchradius) für schnelle Nachbarsuche. */
function grid(samples: readonly Sample[], cell: number) {
  const map = new Map<string, Sample[]>();
  for (const s of samples) {
    const key = `${Math.floor(s.x / cell)}:${Math.floor(s.y / cell)}`;
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }
  return (s: { x: number; y: number }, visit: (other: Sample) => boolean): boolean => {
    const cx = Math.floor(s.x / cell);
    const cy = Math.floor(s.y / cell);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (const other of map.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (visit(other)) return true;
        }
      }
    }
    return false;
  };
}

/**
 * Anteil der Runde (0–1), der über schon gelaufene Wege führt („hin und zurück“, Stichstraßen, doppelte Abschnitte):
 * Ein Abtastpunkt zählt, wenn ein anderer Punkt der Runde näher als `overlap.nearM` liegt, der auf der Runde (im
 * Kreis gemessen) mindestens `overlap.minGapM` entfernt ist. Start = Ziel zählt deshalb nicht. 0 bei < 2 Punkten.
 */
export function loopOverlapShare(points: readonly LatLng[]): number {
  const first = points.find(validPoint);
  if (!first) return 0;
  const { samples, total } = resample(points, first);
  if (samples.length < 2) return 0;
  const { nearM, minGapM } = LOOP_ROUTE.overlap;
  const near = grid(samples, nearM);
  let overlapped = 0;
  for (const s of samples) {
    const hit = near(s, (o) => {
      const gap = Math.abs(o.d - s.d);
      const cyclic = Math.min(gap, total - gap);
      return cyclic >= minGapM && Math.hypot(o.x - s.x, o.y - s.y) < nearM;
    });
    if (hit) overlapped += 1;
  }
  return overlapped / samples.length;
}

/** Anteil (0–1) der Runde `a`, der höchstens `overlap.nearM` neben der Runde `b` verläuft. */
export function loopSimilarity(a: readonly LatLng[], b: readonly LatLng[]): number {
  const origin = a.find(validPoint) ?? b.find(validPoint);
  if (!origin) return 0;
  const sa = resample(a, origin).samples;
  const sb = resample(b, origin).samples;
  if (sa.length === 0 || sb.length === 0) return 0;
  const { nearM } = LOOP_ROUTE.overlap;
  const near = grid(sb, nearM);
  let same = 0;
  for (const s of sa) {
    if (near(s, (o) => Math.hypot(o.x - s.x, o.y - s.y) < nearM)) same += 1;
  }
  return same / sa.length;
}

/** Relative Abweichung von der Wunschdistanz (0 = genau, 0,1 = 10 % daneben). */
export function loopDistanceDeviation(distanceM: number, targetKm: number): number {
  const target = targetKm * 1000;
  if (!(target > 0) || !Number.isFinite(distanceM)) return Infinity;
  return Math.abs(distanceM - target) / target;
}

/** Passt die Distanz? `ok` innerhalb der Toleranz, sonst `longer`/`shorter`. */
export function loopDistanceFit(distanceM: number, targetKm: number): 'ok' | 'longer' | 'shorter' {
  if (loopDistanceDeviation(distanceM, targetKm) <= LOOP_ROUTE.distanceTolerance) return 'ok';
  return distanceM > targetKm * 1000 ? 'longer' : 'shorter';
}

/**
 * Wie gut passt der Untergrund (0–1)? `any` immer 1; sonst Anteil des gewünschten Untergrunds, Unbekanntes zur Hälfte;
 * ohne Angaben 0,5.
 */
export function loopSurfaceFit(surface: LoopSurfaceShares | null, wish: LoopSurface): number {
  if (wish === 'any') return 1;
  if (!surface) return 0.5;
  const wanted = wish === 'paved' ? surface.paved : surface.unpaved;
  return Math.max(0, Math.min(1, wanted + surface.unknown / 2));
}

export interface LoopScore {
  readonly score: number;
  readonly deviation: number;
  readonly overlap: number;
  readonly surfaceFit: number;
  /** Runde taugt nicht (zu lang/kurz, zu viel „hin und zurück“, kaputt). */
  readonly rejected: boolean;
}

/** Bewertung einer Runde: 100 minus Abzüge für Distanz, „hin und zurück“ und Untergrund (Gewichte in LOOP_ROUTE). */
export function loopScore(
  candidate: LoopCandidate,
  wish: { readonly distanceKm: number; readonly surface: LoopSurface },
): LoopScore {
  const points = candidate.points.filter(validPoint);
  const distanceM =
    candidate.distanceM != null && Number.isFinite(candidate.distanceM) && candidate.distanceM > 0
      ? candidate.distanceM
      : trackDistance(points);
  const deviation = loopDistanceDeviation(distanceM, wish.distanceKm);
  const overlap = loopOverlapShare(points);
  const surfaceFit = loopSurfaceFit(candidate.surface, wish.surface);
  const { weights } = LOOP_ROUTE;
  const raw =
    100 -
    weights.distance * Math.min(1, deviation) -
    weights.overlap * overlap -
    weights.surface * (1 - surfaceFit);
  const rejected =
    points.length < 2 ||
    !(distanceM > 0) ||
    deviation > LOOP_ROUTE.distanceMaxDeviation ||
    overlap > LOOP_ROUTE.overlap.maxShare;
  return {
    score: Math.max(0, Math.min(100, Math.round(raw))),
    deviation,
    overlap,
    surfaceFit,
    rejected,
  };
}

/**
 * Aus den Runden des Dienstes die besten auswählen: untaugliche weg, nach Bewertung sortieren (Gleichstand: id), fast
 * gleiche Runden (über `similarMaxShare` gleicher Verlauf) nur einmal, höchstens `maxSuggestions`. Linie vereinfacht
 * und komprimiert. Leere Liste = keine passende Runde.
 */
export function rankLoops(
  candidates: readonly LoopCandidate[],
  wish: { readonly distanceKm: number; readonly surface: LoopSurface },
  max: number = LOOP_ROUTE.maxSuggestions,
): LoopRoute[] {
  const scored = candidates
    .map((c) => ({ c, points: c.points.filter(validPoint), s: loopScore(c, wish) }))
    .filter((x) => !x.s.rejected)
    .sort((a, b) => b.s.score - a.s.score || a.c.id.localeCompare(b.c.id));
  const chosen: typeof scored = [];
  for (const x of scored) {
    if (chosen.length >= max) break;
    const duplicate = chosen.some(
      (y) =>
        loopSimilarity(x.points, y.points) > LOOP_ROUTE.similarMaxShare &&
        loopSimilarity(y.points, x.points) > LOOP_ROUTE.similarMaxShare,
    );
    if (!duplicate) chosen.push(x);
  }
  return chosen.map(({ c, points, s }) => {
    const simple = simplifyTrack(points, LOOP_ROUTE.maxPoints);
    const distanceM =
      c.distanceM != null && Number.isFinite(c.distanceM) && c.distanceM > 0
        ? c.distanceM
        : trackDistance(points);
    return {
      id: c.id,
      polyline: encodePolyline(simple),
      distance_m: Math.max(1, Math.round(distanceM)),
      ascent_m:
        c.ascentM != null && Number.isFinite(c.ascentM)
          ? Math.max(0, Math.min(10_000, Math.round(c.ascentM)))
          : null,
      surface: c.surface,
      overlap: Math.round(s.overlap * 100) / 100,
      score: s.score,
    };
  });
}

/** Linie einer vorgeschlagenen Runde (null bei kaputter Polyline). */
export function loopRoutePoints(route: Pick<LoopRoute, 'polyline'>): LatLng[] | null {
  return decodePolyline(route.polyline);
}

/** Restliche Distanz der Runde in Metern (nie negativ) – für die Anzeige beim Laufen mit Leitlinie. */
export function loopRemainingM(loopDistanceM: number, runDistanceM: number): number {
  if (!Number.isFinite(loopDistanceM) || !Number.isFinite(runDistanceM)) return 0;
  return Math.max(0, Math.round(loopDistanceM - Math.max(0, runDistanceM)));
}

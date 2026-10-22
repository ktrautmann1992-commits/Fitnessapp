import { RUN_INSIGHTS } from '../constants';
import { formatDuration } from '../log/cardio';
import type { LatLng } from './polyline';
import { haversineM } from './track';

/**
 * Anschauliche Auswertung je Lauf (Gründer-Wunsch 22.10.2026, Auswertung `/ausdauer/[id]`): Tempo je Abschnitt
 * (volle Kilometer + Rest), Farbstufen „schneller ↔ langsamer“ für Linie und Balken, Abweichung je Kilometer zum
 * Durchschnitt, Höhen-Kennzahlen und „Bestwerte“ des Laufs. Grundlage sind NUR die gespeicherten Werte der Strecke
 * (km_splits, distance_m, moving_s, elevation_profile, vereinfachte Linie) – keine Rohpunkte, keine Gesundheitsdaten.
 * Rein und deterministisch; Grenzwerte in RUN_INSIGHTS (constants.ts).
 */

const R = RUN_INSIGHTS;
const ok = (s: number) => Number.isFinite(s) && s > 0;

/** Ein Abschnitt mit gleichmäßigem Tempo: voller Kilometer oder Rest am Ende. */
export interface PaceSegment {
  /** Laufende Nummer (1, 2, …); der Rest bekommt die nächste Nummer. */
  readonly km: number;
  /** Beginn und Ende in Metern Bewegungsdistanz. */
  readonly fromM: number;
  readonly toM: number;
  /** Sekunden je Kilometer. */
  readonly secondsPerKm: number;
  /** true = Rest unter 1 km (Pace hochgerechnet). */
  readonly partial: boolean;
}

/**
 * Abschnitte aus den Kilometerzeiten. Ungültige Zeiten (≤ 0, nicht endlich) fallen weg, die Position der übrigen
 * bleibt. Der Rest nach dem letzten vollen Kilometer zählt ab RUN_INSIGHTS.minPartialM Metern, wenn alle
 * Kilometerzeiten gültig sind und Bewegungszeit übrig bleibt. Unter 1 km: ein Abschnitt mit der Ø-Pace.
 */
export function paceSegments(
  kmSplits: readonly number[],
  distanceM: number,
  movingS: number,
): PaceSegment[] {
  const distance = Number.isFinite(distanceM) && distanceM > 0 ? distanceM : 0;
  const full = Math.min(kmSplits.length, Math.floor(distance / 1000));
  const segments: PaceSegment[] = [];
  let usedS = 0;
  let allValid = true;
  for (let i = 0; i < full; i += 1) {
    const s = kmSplits[i] as number;
    if (!ok(s)) {
      allValid = false;
      continue;
    }
    usedS += s;
    segments.push({
      km: i + 1,
      fromM: i * 1000,
      toM: (i + 1) * 1000,
      secondsPerKm: s,
      partial: false,
    });
  }
  const restM = distance - full * 1000;
  const restS = (Number.isFinite(movingS) ? movingS : 0) - usedS;
  if (allValid && restM >= R.minPartialM && restS > 0) {
    segments.push({
      km: full + 1,
      fromM: full * 1000,
      toM: distance,
      secondsPerKm: (restS / restM) * 1000,
      partial: true,
    });
  }
  return segments;
}

/** Ø-Pace in s/km über die Bewegungszeit; null ohne Distanz oder Zeit. */
export function averagePaceS(distanceM: number, movingS: number): number | null {
  return ok(distanceM) && ok(movingS) ? (movingS / distanceM) * 1000 : null;
}

/** Schnellste und langsamste Pace der Abschnitte; null ohne Abschnitte. */
export function paceRange(
  segments: readonly PaceSegment[],
): { fastest: number; slowest: number } | null {
  if (segments.length === 0) return null;
  const paces = segments.map((s) => s.secondsPerKm);
  return { fastest: Math.min(...paces), slowest: Math.max(...paces) };
}

/**
 * Farbstufe einer Pace: 0 = am schnellsten … RUN_INSIGHTS.paceBuckets − 1 = am langsamsten (linear zwischen
 * schnellstem und langsamstem Abschnitt). Gleiches Tempo (Spanne unter RUN_INSIGHTS.constantPaceS) → mittlere Stufe.
 */
export function paceBucket(
  secondsPerKm: number,
  range: { fastest: number; slowest: number },
  buckets: number = R.paceBuckets,
): number {
  const n = Math.max(1, Math.floor(buckets));
  const mid = Math.floor((n - 1) / 2);
  const span = range.slowest - range.fastest;
  if (!Number.isFinite(secondsPerKm) || span < R.constantPaceS) return mid;
  const f = (secondsPerKm - range.fastest) / span;
  return Math.min(n - 1, Math.max(0, Math.round(f * (n - 1))));
}

/** Ein Kilometer mit Abweichung zum Durchschnitt (Balken „Kilometerzeiten“). */
export interface SplitInsight {
  readonly km: number;
  /** Zeit des Kilometers in Sekunden (0 = ungültig). */
  readonly seconds: number;
  /** Balkenlänge 0–1: langsamster Kilometer = 1. */
  readonly share: number;
  /** Abweichung zur Ø-Pace in ganzen Sekunden (negativ = schneller); null ohne Ø oder Zeit. */
  readonly deltaS: number | null;
  /** Farbstufe (0 = schnell); null bei ungültiger Zeit. */
  readonly bucket: number | null;
  /** Schnellster Kilometer (genau einer, der erste bei Gleichstand; keiner bei gleichem Tempo). */
  readonly fastest: boolean;
}

/** Kilometerzeiten mit Abweichung zur Ø-Pace des ganzen Laufs, Farbstufe und „schnellster km“. */
export function splitInsights(
  kmSplits: readonly number[],
  distanceM: number,
  movingS: number,
): SplitInsight[] {
  const valid = kmSplits.filter(ok);
  if (kmSplits.length === 0) return [];
  const avg =
    averagePaceS(distanceM, movingS) ??
    (valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null);
  const range = paceRange(paceSegments(kmSplits, distanceM, movingS));
  const max = Math.max(0, ...valid);
  const min = valid.length > 0 ? Math.min(...valid) : 0;
  const distinct = valid.length >= 2 && max - min >= R.constantPaceS;
  const fastestIndex = distinct ? kmSplits.findIndex((s) => ok(s) && s === min) : -1;
  return kmSplits.map((s, i) => ({
    km: i + 1,
    seconds: ok(s) ? s : 0,
    share: ok(s) && max > 0 ? s / max : 0,
    deltaS: ok(s) && avg !== null ? Math.round(s - avg) : null,
    bucket: ok(s) && range ? paceBucket(s, range) : null,
    fastest: i === fastestIndex,
  }));
}

/** Abweichung als Text: „−0:12“ (schneller), „+0:08“ (langsamer), „±0:00“. */
export function paceDeltaText(deltaS: number): string {
  const s = Math.round(deltaS);
  if (s === 0) return '±0:00';
  return `${s < 0 ? '−' : '+'}${formatDuration(Math.abs(s))}`;
}

/** Ein Stück der Linie in einer Farbstufe (Nachbarstücke teilen sich den Grenzpunkt). */
export interface ColoredRun {
  /** Farbstufe (0 = schnell); null = ohne Tempo (keine Kilometerzeiten). */
  readonly bucket: number | null;
  readonly points: LatLng[];
  /** Erster und letzter Index in der Liste der gültigen Punkte (für eine eigene Projektion, z. B. Skizze). */
  readonly from: number;
  readonly to: number;
}

/**
 * Linie nach Tempo einfärben: Jede Teilstrecke der (vereinfachten) Linie bekommt die Farbstufe des Abschnitts, in dem
 * ihre Mitte liegt. Die Länge der Linie wird auf die Bewegungsdistanz gestreckt (die vereinfachte Linie ist etwas
 * kürzer, Pausen-Lücken zählen mit). Weniger als 2 Punkte → []; ohne Abschnitte → ein Stück ohne Stufe.
 */
export function paceColoredRuns(
  points: readonly LatLng[],
  segments: readonly PaceSegment[],
): ColoredRun[] {
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (valid.length < 2) return [];
  const range = paceRange(segments);
  const last = segments.at(-1);
  if (!range || !last) return [{ bucket: null, points: [...valid], from: 0, to: valid.length - 1 }];
  const cumulative = [0];
  for (let i = 1; i < valid.length; i += 1) {
    cumulative.push(
      (cumulative[i - 1] as number) + haversineM(valid[i - 1] as LatLng, valid[i] as LatLng),
    );
  }
  const lineM = cumulative.at(-1) as number;
  const scale = lineM > 0 ? last.toM / lineM : 0;
  const bucketAt = (m: number): number | null => {
    const seg =
      segments.find((s) => m >= s.fromM && m < s.toM) ??
      (m >= last.toM ? last : segments.find((s) => m < s.toM));
    return seg ? paceBucket(seg.secondsPerKm, range) : null;
  };
  const runs: { bucket: number | null; points: LatLng[]; from: number; to: number }[] = [];
  for (let i = 1; i < valid.length; i += 1) {
    const mid = (((cumulative[i - 1] as number) + (cumulative[i] as number)) / 2) * scale;
    const bucket = bucketAt(mid);
    const current = runs.at(-1);
    if (current && current.bucket === bucket) {
      current.points.push(valid[i] as LatLng);
      current.to = i;
    } else {
      runs.push({
        bucket,
        points: [valid[i - 1] as LatLng, valid[i] as LatLng],
        from: i - 1,
        to: i,
      });
    }
  }
  return runs;
}

/**
 * Achsen-Marken in Metern für Diagramme über die Distanz: ganze Kilometer, bei langen Strecken in größeren Schritten
 * (höchstens `maxTicks` Marken, ohne die 0). Unter 1 km → [].
 */
export function distanceTicks(distanceM: number, maxTicks = 6): number[] {
  if (!Number.isFinite(distanceM) || distanceM < 1000) return [];
  const km = Math.floor(distanceM / 1000);
  const step =
    [1, 2, 5, 10, 20, 25, 50, 100].find((s) => km / s <= maxTicks) ?? Math.ceil(km / maxTicks);
  const ticks: number[] = [];
  for (let k = step; k <= km; k += step) ticks.push(k * 1000);
  return ticks;
}

/** Zeit in Sekunden zwischen zwei Distanzen (linear innerhalb der Abschnitte); null ohne Abschnitte darüber. */
export function timeBetween(
  segments: readonly PaceSegment[],
  fromM: number,
  toM: number,
): number | null {
  let covered = 0;
  let seconds = 0;
  for (const s of segments) {
    const a = Math.max(fromM, s.fromM);
    const b = Math.min(toM, s.toM);
    if (b > a) {
      covered += b - a;
      seconds += ((b - a) / 1000) * s.secondsPerKm;
    }
  }
  return toM > fromM && covered >= (toM - fromM) * 0.999 ? seconds : null;
}

/** Höhen-Kennzahlen aus dem gespeicherten Profil [Distanz m, Höhe dm]. */
export interface ElevationStats {
  readonly minM: number;
  readonly maxM: number;
  /** Distanz (m) des höchsten Punkts (der erste bei Gleichstand). */
  readonly highestAtM: number;
  /** Größter zusammenhängender Anstieg (Hysterese RUN_INSIGHTS.climbHysteresisM); null ohne Anstieg. */
  readonly biggestClimb: {
    readonly fromM: number;
    readonly toM: number;
    readonly gainM: number;
  } | null;
}

/** Tiefster/höchster Punkt und größter Anstieg; null ohne Profil (unter 2 gültigen Stützpunkten). */
export function elevationStats(
  profile: readonly (readonly number[])[] | null | undefined,
): ElevationStats | null {
  const pts = (profile ?? []).filter(
    (p): p is [number, number] => p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),
  );
  if (pts.length < 2) return null;
  const d = pts.map((p) => p[0]);
  const h = pts.map((p) => p[1] / 10);
  let maxI = 0;
  let minI = 0;
  h.forEach((v, i) => {
    if (v > (h[maxI] as number)) maxI = i;
    if (v < (h[minI] as number)) minI = i;
  });
  let best: { fromM: number; toM: number; gainM: number } | null = null;
  let lowI = 0;
  let highI = 0;
  const finish = () => {
    const gain = (h[highI] as number) - (h[lowI] as number);
    if (gain > 0 && (!best || gain > best.gainM)) {
      best = { fromM: d[lowI] as number, toM: d[highI] as number, gainM: gain };
    }
  };
  for (let i = 1; i < h.length; i += 1) {
    const v = h[i] as number;
    if (v > (h[highI] as number)) highI = i;
    else if ((h[highI] as number) - v >= R.climbHysteresisM) {
      finish();
      lowI = i;
      highI = i;
    } else if (v < (h[lowI] as number)) {
      lowI = i;
      highI = i;
    }
  }
  finish();
  const climb = best as { fromM: number; toM: number; gainM: number } | null;
  return {
    minM: h[minI] as number,
    maxM: h[maxI] as number,
    highestAtM: d[maxI] as number,
    biggestClimb: climb ? { ...climb, gainM: Math.round(climb.gainM) } : null,
  };
}

/** Ein „Bestwert“ des Laufs (nur positive, neutrale Beobachtungen – kein Vergleich mit anderen). */
export type RunHighlight =
  | { readonly kind: 'fastest_km'; readonly km: number; readonly seconds: number }
  | { readonly kind: 'negative_split'; readonly diffS: number }
  | { readonly kind: 'even_pace'; readonly spreadS: number }
  | {
      readonly kind: 'biggest_climb';
      readonly gainM: number;
      readonly fromM: number;
      readonly toM: number;
    }
  | { readonly kind: 'highest_point'; readonly heightM: number; readonly atM: number };

export interface RunHighlightInput {
  readonly kmSplits: readonly number[];
  readonly distanceM: number;
  readonly movingS: number;
  readonly elevationProfile: readonly (readonly number[])[] | null | undefined;
}

/**
 * Bestwerte in fester Reihenfolge: schnellster Kilometer, zweite Hälfte schneller, gleichmäßiges Tempo, größter
 * Anstieg, höchster Punkt. Nur, was sich aus den Daten sicher ablesen lässt (Schwellen in RUN_INSIGHTS).
 */
export function runHighlights(input: RunHighlightInput): RunHighlight[] {
  const out: RunHighlight[] = [];
  const splits = splitInsights(input.kmSplits, input.distanceM, input.movingS);
  const fastest = splits.find((s) => s.fastest);
  if (fastest) out.push({ kind: 'fastest_km', km: fastest.km, seconds: fastest.seconds });

  if (input.distanceM >= R.halvesMinM) {
    const segments = paceSegments(input.kmSplits, input.distanceM, input.movingS);
    const half = input.distanceM / 2;
    const first = timeBetween(segments, 0, half);
    const second = timeBetween(segments, half, input.distanceM);
    if (first !== null && second !== null) {
      const diff = first - second;
      if (diff >= Math.max(R.negativeSplitMinS, first * R.negativeSplitMinShare)) {
        out.push({ kind: 'negative_split', diffS: Math.round(diff) });
      }
    }
  }

  const valid = input.kmSplits.filter(ok);
  if (valid.length >= R.evenPaceMinSplits && valid.length === input.kmSplits.length) {
    const spread = Math.max(...valid) - Math.min(...valid);
    if (spread <= R.evenPaceSpreadS) out.push({ kind: 'even_pace', spreadS: Math.round(spread) });
  }

  const elevation = elevationStats(input.elevationProfile);
  if (elevation?.biggestClimb && elevation.biggestClimb.gainM >= R.climbMinGainM) {
    out.push({ kind: 'biggest_climb', ...elevation.biggestClimb });
  }
  if (elevation && elevation.maxM - elevation.minM >= R.climbMinGainM) {
    out.push({
      kind: 'highest_point',
      heightM: Math.round(elevation.maxM),
      atM: elevation.highestAtM,
    });
  }
  return out;
}

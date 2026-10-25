import { ROUTE_PROGRESS } from '../constants';
import { addDays, startOfIsoWeek } from '../dates';
import type { EnduranceModality } from '../enums';
import type { EnduranceActivity } from './activities';
import { periodRange } from './activities';
import { usesSpeed } from './format';

/**
 * „Dein Fortschritt“ – auch OHNE gleiche Strecke (Gründer-Wunsch 25.10.2026): ein Lauf wird mit den eigenen
 * Einheiten derselben Sportart und ähnlicher Länge (±ROUTE_PROGRESS.similarShare) verglichen – Ø-Pace gegen den
 * Durchschnitt der letzten 4 Wochen davor und gegen die letzte vergleichbare Einheit; dazu Trend der Wochen-Pace
 * (zeitliche Reihenfolge) und Umfang je Woche/Monat. Neutral (W-G16): nur mit sich selbst, keine Bestzeit, keine
 * Rangliste. Einheiten ohne Distanz oder Bewegungszeit zählen nicht.
 */

type Activity = Pick<
  EnduranceActivity,
  'key' | 'sport' | 'day' | 'startedAt' | 'movingS' | 'distanceM' | 'elevationM'
>;

export type ProgressCode = 'faster' | 'slower' | 'same';

export interface ProgressDelta {
  readonly code: ProgressCode;
  /** Laufen/Gehen: Unterschied in s/km (Betrag); Rad: in km/h (Betrag). */
  readonly amount: number;
}

export interface RunProgress {
  readonly sport: EnduranceModality;
  /** Ø-Pace dieses Laufs in s/km (Laufen, Gehen) bzw. Ø km/h (Rad). */
  readonly value: number;
  /** Vergleichbare frühere Einheiten im 4-Wochen-Fenster (zeitlich, älteste zuerst). */
  readonly similarCount: number;
  /** Durchschnitt (Pace bzw. km/h) der vergleichbaren Einheiten der letzten 4 Wochen; null unter minForAverage. */
  readonly average: number | null;
  readonly vsAverage: ProgressDelta | null;
  /** Letzte vergleichbare Einheit (auch älter als 4 Wochen). */
  readonly last: { key: string; day: string; value: number } | null;
  readonly vsLast: ProgressDelta | null;
  /** Höhenmeter mehr als der Durchschnitt der vergleichbaren Einheiten (fairer Vergleich) – sonst null. */
  readonly elevationExtraM: number | null;
}

/** Ø-Pace (s/km) bzw. Ø km/h; null ohne Distanz/Zeit. */
export function progressValue(
  sport: EnduranceModality,
  movingS: number,
  distanceM: number | null,
): number | null {
  if (!distanceM || distanceM <= 0 || movingS <= 0) return null;
  return usesSpeed(sport) ? distanceM / 1000 / (movingS / 3600) : movingS / (distanceM / 1000);
}

/** Ähnlich lang: höchstens ±similarShare vom aktuellen Lauf. */
export function similarDistance(distanceM: number, otherM: number): boolean {
  return distanceM > 0 && Math.abs(otherM - distanceM) <= ROUTE_PROGRESS.similarShare * distanceM;
}

function delta(sport: EnduranceModality, now: number, before: number): ProgressDelta {
  const speed = usesSpeed(sport);
  const d = now - before;
  const same = speed ? ROUTE_PROGRESS.sameWithinKmh : ROUTE_PROGRESS.sameWithinSPerKm;
  if (Math.abs(d) <= same) return { code: 'same', amount: Math.abs(d) };
  // Pace: kleiner = schneller; km/h: größer = schneller.
  const faster = speed ? d > 0 : d < 0;
  return { code: faster ? 'faster' : 'slower', amount: Math.abs(d) };
}

const timeOf = (a: Activity) =>
  a.startedAt ? Date.parse(a.startedAt) : Date.parse(`${a.day}T12:00:00Z`);

/**
 * Fortschritt eines Laufs gegen die eigenen früheren Einheiten ähnlicher Länge. null, wenn der Lauf selbst keine
 * Ø-Pace hat (ohne Distanz) – die App zeigt dann nichts.
 */
export function runProgress(run: Activity, activities: readonly Activity[]): RunProgress | null {
  const value = progressValue(run.sport, run.movingS, run.distanceM);
  if (value === null || run.distanceM === null) return null;
  const t = timeOf(run);
  const from = addDays(run.day, -ROUTE_PROGRESS.lookbackDays);
  const earlier = activities
    .filter(
      (a) =>
        a.key !== run.key &&
        a.sport === run.sport &&
        timeOf(a) < t &&
        a.distanceM !== null &&
        similarDistance(run.distanceM as number, a.distanceM) &&
        progressValue(a.sport, a.movingS, a.distanceM) !== null,
    )
    .sort((a, b) => timeOf(a) - timeOf(b));
  const window = earlier.filter((a) => a.day >= from);
  const values = window.map((a) => progressValue(a.sport, a.movingS, a.distanceM) as number);
  const average =
    values.length >= ROUTE_PROGRESS.minForAverage
      ? values.reduce((x, y) => x + y, 0) / values.length
      : null;
  const lastA = earlier.at(-1) ?? null;
  const last = lastA
    ? {
        key: lastA.key,
        day: lastA.day,
        value: progressValue(lastA.sport, lastA.movingS, lastA.distanceM) as number,
      }
    : null;
  const gains = window.map((a) => a.elevationM).filter((g): g is number => g !== null);
  let elevationExtraM: number | null = null;
  if (run.elevationM !== null && gains.length > 0) {
    const avgGain = gains.reduce((x, y) => x + y, 0) / gains.length;
    const extra = run.elevationM - avgGain;
    if (
      extra >= ROUTE_PROGRESS.elevationExtraMinM &&
      extra >= ROUTE_PROGRESS.elevationExtraShare * Math.max(avgGain, 1)
    ) {
      elevationExtraM = Math.round(extra / 10) * 10;
    }
  }
  return {
    sport: run.sport,
    value,
    similarCount: window.length,
    average,
    vsAverage: average !== null ? delta(run.sport, value, average) : null,
    last,
    vsLast: last ? delta(run.sport, value, last.value) : null,
    elevationExtraM,
  };
}

export interface ProgressWeek {
  /** Montag der Woche (JJJJ-MM-TT). */
  readonly weekStart: string;
  /** Ø-Pace (s/km) bzw. Ø km/h der Woche, gewichtet nach Distanz; null ohne Einheit. */
  readonly value: number | null;
  readonly distanceM: number;
  readonly count: number;
}

/**
 * Trend über die letzten ROUTE_PROGRESS.trendWeeks Kalenderwochen bis `today` (zeitliche Reihenfolge, älteste
 * zuerst): Ø-Pace (distanzgewichtet = Gesamtzeit / Gesamtdistanz) und Umfang je Woche, nur eine Sportart. Optional
 * nur ähnlich lange Einheiten (`similarToM`).
 */
export function progressTrend(
  activities: readonly Activity[],
  options: { sport: EnduranceModality; today: string; similarToM?: number | null; weeks?: number },
): ProgressWeek[] {
  const weeks = options.weeks ?? ROUTE_PROGRESS.trendWeeks;
  const lastWeek = startOfIsoWeek(options.today);
  const out: ProgressWeek[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = addDays(lastWeek, -7 * i);
    const end = addDays(start, 6);
    const inWeek = activities.filter(
      (a) =>
        a.sport === options.sport &&
        a.day >= start &&
        a.day <= end &&
        a.distanceM !== null &&
        a.distanceM > 0 &&
        a.movingS > 0 &&
        (options.similarToM == null || similarDistance(options.similarToM, a.distanceM)),
    );
    const dist = inWeek.reduce((x, a) => x + (a.distanceM ?? 0), 0);
    const time = inWeek.reduce((x, a) => x + a.movingS, 0);
    out.push({
      weekStart: start,
      value: inWeek.length > 0 ? progressValue(options.sport, time, dist) : null,
      distanceM: dist,
      count: inWeek.length,
    });
  }
  return out;
}

/** Umfang (Distanz) dieser Woche und dieses Monats einer Sportart (für „Dein Fortschritt“). */
export function progressVolume(
  activities: readonly Activity[],
  options: { sport: EnduranceModality; today: string },
): { weekM: number; monthM: number } {
  const sum = (from: string, to: string) =>
    activities
      .filter((a) => a.sport === options.sport && a.day >= from && a.day <= to)
      .reduce((x, a) => x + (a.distanceM ?? 0), 0);
  const w = periodRange('week', options.today);
  const m = periodRange('month', options.today);
  return { weekM: sum(w.from, w.to), monthM: sum(m.from, m.to) };
}

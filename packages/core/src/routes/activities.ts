import { addDays, isoDateInTimeZone, startOfIsoWeek } from '../dates';
import { ENDURANCE_MODALITIES, type EnduranceModality, type TrackedRouteSport } from '../enums';

/**
 * Ausdauer-Aktivitäten (Etappe E4 „Meine Läufe“, E5 Woche/Monat; docs/PLAN-EINKAUFEN-AUSDAUER.md 6–7):
 * Aufzeichnungen (tracked_routes) und Ausdauer-Einträge ohne GPS (Tagebuch) zusammengeführt – ein mit einer Strecke
 * verknüpfter Eintrag zählt nur einmal (als Strecke). Summen je Woche (Mo–So) bzw. Kalendermonat; Tag = lokales Datum
 * des Starts (Europe/Berlin). Vergleich nur neutral zur Vorperiode – keine Serien, keine Bestzeiten (W-G16). Rein.
 */

export interface EnduranceRouteInput {
  readonly id: string;
  readonly name: string;
  readonly sport: TrackedRouteSport;
  readonly started_at: string;
  readonly duration_s: number;
  readonly moving_s: number;
  readonly distance_m: number;
  readonly elevation_gain_m: number | null;
  readonly session_log_id: string | null;
  readonly is_favorite?: boolean;
}

export interface EnduranceLogInput {
  readonly id: string;
  readonly name_de: string;
  readonly performed_on: string;
  readonly started_at: string | null;
  readonly modality: EnduranceModality;
  readonly duration_s: number;
  readonly distance_m: number | null;
  readonly elevation_m: number | null;
}

export interface EnduranceActivity {
  /** Eindeutig: `route:<id>` bzw. `log:<id>`. */
  readonly key: string;
  readonly source: 'route' | 'log';
  readonly routeId: string | null;
  /** Tagebuch-Eintrag (bei einer Strecke: der verknüpfte, falls vorhanden). */
  readonly logId: string | null;
  readonly name: string;
  readonly sport: EnduranceModality;
  /** Tag (JJJJ-MM-TT, Europe/Berlin). */
  readonly day: string;
  readonly startedAt: string | null;
  readonly durationS: number;
  /** Bewegungszeit (Eintrag ohne GPS: = Dauer). */
  readonly movingS: number;
  readonly distanceM: number | null;
  readonly elevationM: number | null;
  readonly isFavorite: boolean;
}

/** Strecken und Einträge zusammenführen, neueste zuerst; verknüpfte Einträge nur einmal (als Strecke). */
export function enduranceActivities(
  routes: readonly EnduranceRouteInput[],
  logs: readonly EnduranceLogInput[],
): EnduranceActivity[] {
  const linked = new Set(
    routes.map((r) => r.session_log_id).filter((id): id is string => id !== null),
  );
  const fromRoutes = routes.map((r): EnduranceActivity => ({
    key: `route:${r.id}`,
    source: 'route',
    routeId: r.id,
    logId: r.session_log_id,
    name: r.name,
    sport: r.sport,
    day: isoDateInTimeZone(r.started_at),
    startedAt: r.started_at,
    durationS: r.duration_s,
    movingS: r.moving_s,
    distanceM: r.distance_m,
    elevationM: r.elevation_gain_m,
    isFavorite: r.is_favorite === true,
  }));
  const fromLogs = logs
    .filter((l) => !linked.has(l.id))
    .map((l): EnduranceActivity => ({
      key: `log:${l.id}`,
      source: 'log',
      routeId: null,
      logId: l.id,
      name: l.name_de,
      sport: l.modality,
      day: l.performed_on,
      startedAt: l.started_at,
      durationS: l.duration_s,
      movingS: l.duration_s,
      distanceM: l.distance_m,
      elevationM: l.elevation_m,
      isFavorite: false,
    }));
  return [...fromRoutes, ...fromLogs].sort(
    (a, b) =>
      b.day.localeCompare(a.day) ||
      (b.startedAt ?? '').localeCompare(a.startedAt ?? '') ||
      a.key.localeCompare(b.key),
  );
}

export type EndurancePeriod = 'week' | 'month';

export interface EnduranceTotals {
  readonly count: number;
  readonly distanceM: number;
  readonly movingS: number;
  readonly elevationM: number;
}

export interface EnduranceWeekBar {
  readonly from: string;
  readonly to: string;
  readonly distanceM: number;
  readonly count: number;
}

export interface EndurancePeriodSummary {
  readonly period: EndurancePeriod;
  readonly from: string;
  readonly to: string;
  readonly total: EnduranceTotals;
  /** Je Sportart mit mindestens einer Aktivität (Reihenfolge = ENDURANCE_MODALITIES). */
  readonly bySport: readonly { sport: EnduranceModality; totals: EnduranceTotals }[];
  /** Nur Monat: Wochen (Mo–So) mit den Tagen des Monats. */
  readonly weeks: readonly EnduranceWeekBar[];
  /** Vorperiode (vorige Woche bzw. voriger Monat) – nur für den neutralen Vergleich. */
  readonly previous: {
    readonly from: string;
    readonly to: string;
    readonly total: EnduranceTotals;
  };
  /** Distanz minus Vorperiode in Metern (positiv = mehr). */
  readonly distanceDiffM: number;
}

const EMPTY: EnduranceTotals = { count: 0, distanceM: 0, movingS: 0, elevationM: 0 };

function sum(activities: readonly EnduranceActivity[]): EnduranceTotals {
  return activities.reduce(
    (t, a) => ({
      count: t.count + 1,
      distanceM: t.distanceM + (a.distanceM ?? 0),
      movingS: t.movingS + a.movingS,
      elevationM: t.elevationM + (a.elevationM ?? 0),
    }),
    EMPTY,
  );
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function shiftMonth(date: string, delta: number): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1 + delta;
  const d = new Date(Date.UTC(year, month, 1));
  return d.toISOString().slice(0, 10);
}

/** Erster und letzter Tag der Periode, in der `anchor` liegt. */
export function periodRange(period: EndurancePeriod, anchor: string): { from: string; to: string } {
  if (period === 'week') {
    const from = startOfIsoWeek(anchor);
    return { from, to: addDays(from, 6) };
  }
  const from = monthStart(anchor);
  return { from, to: addDays(shiftMonth(from, 1), -1) };
}

/** Anker der Periode `delta` Schritte vor (negativ) bzw. nach (positiv) der Periode von `anchor` (Blättern). */
export function shiftPeriod(period: EndurancePeriod, anchor: string, delta: number): string {
  return period === 'week'
    ? addDays(startOfIsoWeek(anchor), 7 * delta)
    : shiftMonth(monthStart(anchor), delta);
}

/** Summen der Periode um `anchor` (Woche Mo–So bzw. Kalendermonat) und Vergleich mit der Vorperiode. */
export function enduranceTotals(
  activities: readonly EnduranceActivity[],
  options: { period: EndurancePeriod; anchor: string },
): EndurancePeriodSummary {
  const { period, anchor } = options;
  const { from, to } = periodRange(period, anchor);
  const inRange = (a: EnduranceActivity, f: string, t: string) => a.day >= f && a.day <= t;
  const current = activities.filter((a) => inRange(a, from, to));
  const prev = periodRange(period, shiftPeriod(period, anchor, -1));
  const previousTotal = sum(activities.filter((a) => inRange(a, prev.from, prev.to)));
  const total = sum(current);
  const bySport = ENDURANCE_MODALITIES.map((sport) => ({
    sport,
    totals: sum(current.filter((a) => a.sport === sport)),
  })).filter((entry) => entry.totals.count > 0);
  const weeks: EnduranceWeekBar[] = [];
  if (period === 'month') {
    for (let start = startOfIsoWeek(from); start <= to; start = addDays(start, 7)) {
      const wFrom = start < from ? from : start;
      const wEnd = addDays(start, 6);
      const wTo = wEnd > to ? to : wEnd;
      const inWeek = sum(current.filter((a) => inRange(a, wFrom, wTo)));
      weeks.push({ from: wFrom, to: wTo, distanceM: inWeek.distanceM, count: inWeek.count });
    }
  }
  return {
    period,
    from,
    to,
    total,
    bySport,
    weeks,
    previous: { ...prev, total: previousTotal },
    distanceDiffM: total.distanceM - previousTotal.distanceM,
  };
}

/** Aktivitäten dieser Woche (Kachel „Ausdauer“ auf der Übersicht): km dieser Woche und die letzte Aktivität. */
export function enduranceTileSummary(
  activities: readonly EnduranceActivity[],
  today: string,
): { weekDistanceM: number; weekCount: number; latest: EnduranceActivity | null } {
  const week = enduranceTotals(activities, { period: 'week', anchor: today });
  const latest = activities.find((a) => a.day <= today) ?? null;
  return { weekDistanceM: week.total.distanceM, weekCount: week.total.count, latest };
}

/** Ein Balken je Wochentag (Mo–So) der Woche um `today`: Strecke und Anteil am stärksten Tag (0–1). */
export interface EnduranceDayBar {
  readonly day: string;
  readonly distanceM: number;
  /** Anteil am stärksten Tag der Woche (0–1); 0 an Tagen ohne Strecke. */
  readonly share: number;
}

/**
 * Mini-Balken der Kachel „Ausdauer“ (Übersicht, Design 20.10.2026): sieben Tage Mo–So der Woche um `today`, Anteil
 * je Tag am stärksten Tag, dazu die Stelle von heute (zum Hervorheben). Aktivitäten ohne Strecke zählen nicht.
 */
export function enduranceWeekBars(
  activities: readonly EnduranceActivity[],
  today: string,
): { days: EnduranceDayBar[]; todayIndex: number } {
  const from = startOfIsoWeek(today);
  const totals = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(from, i);
    const distanceM = activities
      .filter((a) => a.day === day)
      .reduce((acc, a) => acc + Math.max(0, a.distanceM ?? 0), 0);
    return { day, distanceM };
  });
  const max = Math.max(0, ...totals.map((d) => d.distanceM));
  return {
    days: totals.map((d) => ({ ...d, share: max > 0 ? d.distanceM / max : 0 })),
    todayIndex: totals.findIndex((d) => d.day === today),
  };
}

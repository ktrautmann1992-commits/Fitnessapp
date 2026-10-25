import { STRENGTH_PROGRESS } from '../constants';
import { addDays, daysBetween } from '../dates';
import type { LoadType } from '../enums';
import type { ExerciseLogEntry } from './types';

/**
 * Kraft-Entwicklung je Übung (Gründer-Freigabe 25.10.2026, KONZEPT 10.2a) – rein aus dem eigenen Tagebuch, ohne KI.
 *
 * Je Einheit (ein `exercise_logs`-Eintrag mit mindestens einem abgehakten Satz) ein Punkt, IMMER chronologisch
 * (Datum, dann Uhrzeit) – nie nach Wert sortiert, keine „Bestleistung“, keine Abzeichen (wie W-G16 bei Läufen): nur
 * eigene frühere Werte in neutralen Worten.
 *
 * Kennzahlen (`StrengthMetric`):
 * - `weight`: schwerster abgehakter Satz in kg (je Hantel bzw. Langhantel gesamt, wie eingetragen). Bewusst KEINE
 *   geschätzte Maximalkraft (1RM, KONZEPT 10.2 und Regel V4).
 * - `volume`: Summe Gewicht × Wiederholungen aller abgehakten Sätze mit Gewicht (kg).
 * - `reps`: Wiederholungen gesamt (alle abgehakten Sätze) – bei Übungen mit dem eigenen Körpergewicht die Hauptkurve.
 * - `time`: längste Haltezeit in Sekunden (Halteübungen).
 *
 * Erholungswochen (Deload) bleiben in der Kurve (gekennzeichnet), zählen aber nie als Bezug eines Vergleichs.
 * Wechselt die Belastungsart (z. B. vorher mit Band, jetzt mit Gewicht), beginnt die Kurve neu (Lücke) und verglichen
 * wird nur mit Einheiten derselben Art.
 */

export const STRENGTH_METRICS = ['weight', 'volume', 'reps', 'time'] as const;
export type StrengthMetric = (typeof STRENGTH_METRICS)[number];

export const STRENGTH_RANGES = ['4w', '3m', 'all'] as const;
export type StrengthRange = (typeof STRENGTH_RANGES)[number];

export type StrengthLogEntry = Pick<
  ExerciseLogEntry,
  'exerciseId' | 'performedOn' | 'loggedAt' | 'status' | 'loadType' | 'isDeload' | 'sets'
>;

/** Eine Einheit einer Übung mit allen Kennzahlen (null = in dieser Einheit nicht vorhanden). */
export interface StrengthSession {
  readonly performedOn: string;
  readonly loggedAt: string;
  readonly loadType: LoadType;
  readonly isDeload: boolean;
  /** Abgehakte Sätze. */
  readonly sets: number;
  /** Schwerster abgehakter Satz (kg) und seine Wiederholungen. */
  readonly topWeightKg: number | null;
  readonly topReps: number | null;
  readonly volumeKg: number | null;
  readonly totalReps: number | null;
  readonly longestHoldS: number | null;
}

function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * Alle Einheiten einer Übung, älteste zuerst (Datum, dann `loggedAt`). Übersprungene Einträge und Einträge ohne
 * abgehakten Satz fallen weg; ungültige Werte (≤ 0, nicht endlich) zählen nicht.
 */
export function strengthSessions(
  exerciseId: string,
  entries: readonly StrengthLogEntry[],
): StrengthSession[] {
  const sessions: StrengthSession[] = [];
  for (const e of entries) {
    if (e.exerciseId !== exerciseId || e.status === 'skipped') continue;
    const done = e.sets.filter((s) => s.done);
    if (done.length === 0) continue;
    let topWeight: number | null = null;
    let topReps: number | null = null;
    let volume = 0;
    let weighted = false;
    let reps = 0;
    let anyReps = false;
    let hold: number | null = null;
    for (const s of done) {
      const r = s.reps !== null && Number.isFinite(s.reps) && s.reps > 0 ? s.reps : null;
      const w =
        s.weightKg !== null && Number.isFinite(s.weightKg) && s.weightKg > 0 ? s.weightKg : null;
      if (r !== null) {
        reps += r;
        anyReps = true;
      }
      if (w !== null && r !== null) {
        weighted = true;
        volume += w * r;
        if (topWeight === null || w > topWeight || (w === topWeight && r > (topReps ?? 0))) {
          topWeight = w;
          topReps = r;
        }
      }
      if (s.durationS !== null && Number.isFinite(s.durationS) && s.durationS > 0) {
        hold = hold === null ? s.durationS : Math.max(hold, s.durationS);
      }
    }
    sessions.push({
      performedOn: e.performedOn,
      loggedAt: e.loggedAt,
      loadType: e.loadType,
      isDeload: e.isDeload,
      sets: done.length,
      topWeightKg: topWeight,
      topReps,
      volumeKg: weighted ? round(volume) : null,
      totalReps: anyReps ? reps : null,
      longestHoldS: hold,
    });
  }
  return sessions.sort((a, b) =>
    a.performedOn !== b.performedOn
      ? a.performedOn < b.performedOn
        ? -1
        : 1
      : a.loggedAt < b.loggedAt
        ? -1
        : a.loggedAt > b.loggedAt
          ? 1
          : 0,
  );
}

/** Wert einer Kennzahl in einer Einheit (null = nicht vorhanden). */
export function strengthValue(session: StrengthSession, metric: StrengthMetric): number | null {
  switch (metric) {
    case 'weight':
      return session.topWeightKg;
    case 'volume':
      return session.volumeKg;
    case 'reps':
      return session.totalReps;
    case 'time':
      return session.longestHoldS;
  }
}

/** Kennzahlen, für die es mindestens einen Wert gibt – in fester Reihenfolge (Gewicht, Volumen, Wdh., Zeit). */
export function strengthMetricsAvailable(sessions: readonly StrengthSession[]): StrengthMetric[] {
  return STRENGTH_METRICS.filter((m) => sessions.some((s) => strengthValue(s, m) !== null));
}

/**
 * Hauptkurve: Gewicht, wenn die LETZTE Einheit mit Gewicht war; sonst Wiederholungen (eigenes Körpergewicht, Band),
 * sonst Haltezeit. null = keine Werte.
 */
export function defaultStrengthMetric(sessions: readonly StrengthSession[]): StrengthMetric | null {
  const available = strengthMetricsAvailable(sessions);
  if (available.length === 0) return null;
  const last = sessions.at(-1);
  for (const m of ['weight', 'reps', 'time'] as const) {
    if (last !== undefined && strengthValue(last, m) !== null) return m;
  }
  return available[0] ?? null;
}

/** Erster Tag eines Zeitraums (einschließlich) bis heute; null bei „Alles“. */
export function strengthRangeStart(range: StrengthRange, today: string): string | null {
  return range === 'all' ? null : addDays(today, -(STRENGTH_PROGRESS.rangeDays[range] - 1));
}

export interface StrengthPoint {
  readonly performedOn: string;
  readonly value: number;
  readonly isDeload: boolean;
  /** Erster Punkt nach einem Wechsel der Belastungsart – die Linie wird davor unterbrochen. */
  readonly startsSegment: boolean;
}

export interface StrengthSeries {
  readonly metric: StrengthMetric;
  readonly points: readonly StrengthPoint[];
  /** Kleinster/größter Wert (für die Achse); null ohne Punkte. */
  readonly min: number | null;
  readonly max: number | null;
}

/** Punkte einer Kennzahl im Zeitraum (chronologisch, nie umsortiert). Einheiten ohne Wert fallen weg. */
export function strengthSeries(
  sessions: readonly StrengthSession[],
  metric: StrengthMetric,
  range: StrengthRange,
  today: string,
): StrengthSeries {
  const from = strengthRangeStart(range, today);
  const points: StrengthPoint[] = [];
  let previousLoad: LoadType | null = null;
  for (const s of sessions) {
    if (s.performedOn > today || (from !== null && s.performedOn < from)) continue;
    const value = strengthValue(s, metric);
    if (value === null) continue;
    points.push({
      performedOn: s.performedOn,
      value,
      isDeload: s.isDeload,
      startsSegment: previousLoad !== null && previousLoad !== s.loadType,
    });
    previousLoad = s.loadType;
  }
  const values = points.map((p) => p.value);
  return {
    metric,
    points,
    min: values.length === 0 ? null : Math.min(...values),
    max: values.length === 0 ? null : Math.max(...values),
  };
}

export type StrengthComparison =
  | {
      readonly kind: 'change';
      readonly metric: StrengthMetric;
      readonly current: number;
      readonly reference: number;
      readonly referenceOn: string;
      /** current − reference (gerundet auf 2 Stellen). */
      readonly delta: number;
      /** Abstand zum Bezug in ganzen Wochen (gerundet, mindestens 1). */
      readonly weeksAgo: number;
    }
  /** Die Einheit war in einer Erholungswoche – bewusst leichter, kein Vergleich. */
  | { readonly kind: 'deload' }
  /** Noch kein passender Bezug (zu kurz dabei, andere Belastungsart, nur Erholungswochen davor). */
  | { readonly kind: 'none' };

/**
 * Vergleich einer Einheit (Index in `sessions`) mit ihrer eigenen Vergangenheit, z. B. „+5 kg gegenüber vor 4
 * Wochen“: Bezug = letzte Einheit derselben Belastungsart (keine Erholungswoche) mit Wert, die mindestens
 * `compareWeeks` Wochen zurückliegt; sonst die früheste solche Einheit, wenn sie mindestens `compareMinDays` Tage
 * zurückliegt. Kennzahl Standard: `defaultStrengthMetric`.
 */
export function strengthComparison(
  sessions: readonly StrengthSession[],
  index: number,
  metric: StrengthMetric | null = defaultStrengthMetric(sessions),
): StrengthComparison {
  const current = sessions[index];
  if (current === undefined || metric === null) return { kind: 'none' };
  if (current.isDeload) return { kind: 'deload' };
  const value = strengthValue(current, metric);
  if (value === null) return { kind: 'none' };
  const candidates = sessions
    .slice(0, index)
    .filter(
      (s) =>
        !s.isDeload &&
        s.loadType === current.loadType &&
        strengthValue(s, metric) !== null &&
        s.performedOn < current.performedOn,
    );
  const cutoff = addDays(current.performedOn, -STRENGTH_PROGRESS.compareWeeks * 7);
  const older = candidates.filter((s) => s.performedOn <= cutoff);
  const earliest = candidates[0];
  const reference =
    older.at(-1) ??
    (earliest !== undefined &&
    daysBetween(earliest.performedOn, current.performedOn) >= STRENGTH_PROGRESS.compareMinDays
      ? earliest
      : undefined);
  if (reference === undefined) return { kind: 'none' };
  const ref = strengthValue(reference, metric) as number;
  return {
    kind: 'change',
    metric,
    current: value,
    reference: ref,
    referenceOn: reference.performedOn,
    delta: round(value - ref),
    weeksAgo: Math.max(1, Math.round(daysBetween(reference.performedOn, current.performedOn) / 7)),
  };
}

/** Index der Einheit eines bestimmten Tagebuch-Eintrags (Datum + Uhrzeit); -1 = nicht gefunden. */
export function strengthSessionIndex(
  sessions: readonly StrengthSession[],
  at: { readonly performedOn: string; readonly loggedAt: string },
): number {
  return sessions.findIndex((s) => s.performedOn === at.performedOn && s.loggedAt === at.loggedAt);
}

export interface StrengthOverviewItem {
  readonly exerciseId: string;
  readonly metric: StrengthMetric;
  readonly series: StrengthSeries;
  /** Einheiten im Zeitraum. */
  readonly sessions: number;
  /** Vergleich der letzten Einheit (wie im Eintrag), `none` ohne Bezug. */
  readonly comparison: StrengthComparison;
}

/**
 * Kachel „Kraft-Entwicklung“ unter Fortschritt: die am häufigsten trainierten Übungen der letzten 3 Monate (mindestens
 * `overviewMinSessions` Einheiten mit Wert), je mit Kurve der Hauptkennzahl und Vergleich der letzten Einheit.
 * Reihenfolge: Anzahl Einheiten (absteigend), dann letzte Einheit (neueste zuerst), dann ID – deterministisch.
 */
export function strengthOverview(
  entries: readonly StrengthLogEntry[],
  today: string,
  options: { readonly limit?: number; readonly range?: StrengthRange } = {},
): StrengthOverviewItem[] {
  const range = options.range ?? '3m';
  const limit = options.limit ?? STRENGTH_PROGRESS.overviewLimit;
  const ids = [...new Set(entries.map((e) => e.exerciseId))];
  const items: (StrengthOverviewItem & { readonly lastOn: string })[] = [];
  for (const exerciseId of ids) {
    const sessions = strengthSessions(exerciseId, entries).filter((s) => s.performedOn <= today);
    const metric = defaultStrengthMetric(sessions);
    if (metric === null) continue;
    const series = strengthSeries(sessions, metric, range, today);
    if (series.points.length < STRENGTH_PROGRESS.overviewMinSessions) continue;
    items.push({
      exerciseId,
      metric,
      series,
      sessions: series.points.length,
      comparison: strengthComparison(sessions, sessions.length - 1, metric),
      lastOn: series.points.at(-1)?.performedOn ?? '',
    });
  }
  return items
    .sort(
      (a, b) =>
        b.sessions - a.sessions ||
        (a.lastOn < b.lastOn ? 1 : a.lastOn > b.lastOn ? -1 : 0) ||
        (a.exerciseId < b.exerciseId ? -1 : 1),
    )
    .slice(0, Math.max(0, limit))
    .map(({ lastOn: _lastOn, ...item }) => item);
}

/** Werte einer Kurve auf 0–1 (für Mini-Kurven); gleicher Wert überall → 0,5. */
export function strengthSparkline(
  series: Pick<StrengthSeries, 'points' | 'min' | 'max'>,
): number[] {
  const { min, max } = series;
  if (min === null || max === null) return [];
  const span = max - min;
  return series.points.map((p) => (span === 0 ? 0.5 : (p.value - min) / span));
}

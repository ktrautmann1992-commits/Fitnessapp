import { DAILY_METRIC_LIMITS, RECOVERY } from '../constants';
import { addDays } from '../dates';
import type { DayOffer } from '../plan/day-variant';

/**
 * „Erholung aus der Uhr“ (Gründer-Freigabe 25.10.2026, docs/PLAN-PHASE-8.md 15): täglicher Status gut / mittel /
 * niedrig aus den Tageswerten der Uhr (`daily_metrics`: Schlaf der letzten Nacht, Ruhepuls, HRV). Jede Person wird nur
 * mit sich selbst verglichen (persönliche Basis = Median der 14 Tage davor). Rein und deterministisch, ohne KI.
 *
 * Grundsätze (Regeln und Quellen: `RECOVERY` in constants.ts):
 * - Keine Diagnose und keine Bewertung der Gesundheit – nur eine Trainingshilfe. Ergebnis ist höchstens ein ANGEBOT
 *   „leichter trainieren“ (nie Pflicht, nie automatisch, macht nie härter).
 * - Ein einzelner auffälliger Wert ergibt höchstens „mittel“; „niedrig“ braucht mindestens zwei.
 * - Fehlende Daten sind kein schlechtes Zeichen: ohne Wert „keine Daten“, ohne Basis „Wir lernen deine Werte noch“.
 * - Liest nie Zyklusdaten (Strukturtest wie Phase 9, `wearables/` importiert nichts aus `cycle/`).
 */

/** Tageswerte, die die Erholung liest (Spalten wie `daily_metrics`, mehrere Zeilen je Tag erlaubt). */
export interface RecoveryDayInput {
  readonly day: string;
  readonly resting_hr_bpm: number | null;
  readonly sleep_min: number | null;
  readonly hrv_rmssd_ms: number | null;
}

export const RECOVERY_STATUSES = ['good', 'medium', 'low', 'unknown'] as const;
export type RecoveryStatus = (typeof RECOVERY_STATUSES)[number];

export const RECOVERY_SIGNAL_KINDS = ['sleep', 'resting_hr', 'hrv'] as const;
export type RecoverySignalKind = (typeof RECOVERY_SIGNAL_KINDS)[number];

export type RecoverySignalState =
  /** Im üblichen Bereich. */
  | 'ok'
  /** Auffällig (zählt für „mittel“/„niedrig“). */
  | 'flag'
  /** An diesem Tag kein (plausibler) Wert. */
  | 'no_data'
  /** Wert da, aber noch keine persönliche Basis (weniger als 7 Werte in den 14 Tagen davor). */
  | 'no_baseline'
  /** Bewusst nicht gewertet (Medikamente verändern Puls und HRV). */
  | 'ignored';

export interface RecoverySignal {
  readonly kind: RecoverySignalKind;
  readonly state: RecoverySignalState;
  /** Wert des Tages (Schlaf in min, Ruhepuls in /min, HRV in ms) bzw. null. */
  readonly value: number | null;
  /** Persönliche Basis (Median) bzw. beim Schlaf die Schwelle in min; null = keine. */
  readonly baseline: number | null;
  /** Anzahl Tageswerte in der Basis (Schlaf: 0). */
  readonly baselineValues: number;
}

export interface RecoveryResult {
  readonly day: string;
  readonly status: RecoveryStatus;
  /** Immer in der Reihenfolge Schlaf, Ruhepuls, HRV. */
  readonly signals: readonly RecoverySignal[];
  /** Anzahl auffälliger Werte. */
  readonly flags: number;
  /** Anzahl bewerteter Werte (ok + auffällig). */
  readonly evaluated: number;
  /** Ruhepuls oder HRV vorhanden, aber noch ohne Basis („Wir lernen deine Werte noch“). */
  readonly learning: boolean;
}

export interface RecoveryOptions {
  /** Alter in Jahren (unter 18: Schlaf-Schwelle 7 h); null = Erwachsene. */
  readonly age: number | null;
  /**
   * Gesundheits-Check-Flag `medication` (z. B. Betablocker): Ruhepuls und HRV zählen dann nicht, nur der Schlaf.
   */
  readonly ignoreHeartValues?: boolean;
}

type Metric = 'resting_hr_bpm' | 'sleep_min' | 'hrv_rmssd_ms';

const LIMITS: Record<Metric, { min: number; max: number }> = {
  resting_hr_bpm: DAILY_METRIC_LIMITS.restingHrBpm,
  sleep_min: { min: RECOVERY.sleepCountedMinMin, max: DAILY_METRIC_LIMITS.sleepMin.max },
  hrv_rmssd_ms: DAILY_METRIC_LIMITS.hrvRmssdMs,
};

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

const plausible = (value: number | null, metric: Metric): value is number =>
  value !== null &&
  Number.isFinite(value) &&
  value >= LIMITS[metric].min &&
  value <= LIMITS[metric].max;

/** Wert je Tag (mehrere Zeilen je Tag → Median der plausiblen Werte; unplausible zählen als fehlend). */
function byDay(rows: readonly RecoveryDayInput[], metric: Metric): Map<string, number> {
  const collected = new Map<string, number[]>();
  for (const row of rows) {
    const value = row[metric];
    if (!plausible(value, metric)) continue;
    const list = collected.get(row.day) ?? [];
    list.push(value);
    collected.set(row.day, list);
  }
  return new Map([...collected].map(([day, values]) => [day, median(values)]));
}

/** Persönliche Basis: Median der Werte der `baselineDays` Tage VOR `day`; null bei weniger als `baselineMinValues`. */
export function recoveryBaseline(
  values: ReadonlyMap<string, number>,
  day: string,
): { value: number | null; count: number } {
  const from = addDays(day, -RECOVERY.baselineDays);
  const window: number[] = [];
  for (const [d, v] of values) if (d >= from && d < day) window.push(v);
  return {
    value: window.length >= RECOVERY.baselineMinValues ? median(window) : null,
    count: window.length,
  };
}

function sleepSignal(values: ReadonlyMap<string, number>, day: string, age: number | null) {
  const threshold =
    age !== null && age < RECOVERY.adultFromAge
      ? RECOVERY.sleepShortMin.under18
      : RECOVERY.sleepShortMin.adult;
  const value = values.get(day) ?? null;
  return {
    kind: 'sleep',
    state: value === null ? 'no_data' : value < threshold ? 'flag' : 'ok',
    value,
    baseline: threshold,
    baselineValues: 0,
  } satisfies RecoverySignal;
}

function baselineSignal(
  kind: 'resting_hr' | 'hrv',
  values: ReadonlyMap<string, number>,
  day: string,
  ignored: boolean,
): RecoverySignal {
  const value = values.get(day) ?? null;
  const base = recoveryBaseline(values, day);
  if (ignored) {
    return { kind, state: 'ignored', value, baseline: base.value, baselineValues: base.count };
  }
  if (value === null) {
    return { kind, state: 'no_data', value, baseline: base.value, baselineValues: base.count };
  }
  if (base.value === null) {
    return { kind, state: 'no_baseline', value, baseline: null, baselineValues: base.count };
  }
  const flag =
    kind === 'resting_hr'
      ? value >= base.value + RECOVERY.restingHrAboveBpm
      : value <= base.value * RECOVERY.hrvBelowShare;
  return {
    kind,
    state: flag ? 'flag' : 'ok',
    value,
    baseline: base.value,
    baselineValues: base.count,
  };
}

interface PreparedRows {
  readonly sleep: ReadonlyMap<string, number>;
  readonly restingHr: ReadonlyMap<string, number>;
  readonly hrv: ReadonlyMap<string, number>;
}

function prepare(rows: readonly RecoveryDayInput[]): PreparedRows {
  return {
    sleep: byDay(rows, 'sleep_min'),
    restingHr: byDay(rows, 'resting_hr_bpm'),
    hrv: byDay(rows, 'hrv_rmssd_ms'),
  };
}

function statusFor(prepared: PreparedRows, day: string, options: RecoveryOptions): RecoveryResult {
  const ignored = options.ignoreHeartValues ?? false;
  const signals: RecoverySignal[] = [
    sleepSignal(prepared.sleep, day, options.age),
    baselineSignal('resting_hr', prepared.restingHr, day, ignored),
    baselineSignal('hrv', prepared.hrv, day, ignored),
  ];
  const flags = signals.filter((s) => s.state === 'flag').length;
  const evaluated = signals.filter((s) => s.state === 'flag' || s.state === 'ok').length;
  const status: RecoveryStatus =
    evaluated === 0
      ? 'unknown'
      : flags >= RECOVERY.lowMinFlags
        ? 'low'
        : flags === 1
          ? 'medium'
          : 'good';
  return {
    day,
    status,
    signals,
    flags,
    evaluated,
    learning: signals.some((s) => s.state === 'no_baseline'),
  };
}

/**
 * Erholung für `day` (JJJJ-MM-TT, Europe/Berlin wie die Tageswerte). Werte NACH `day` werden nie gelesen; der Tag
 * selbst zählt nie zu seiner Basis.
 */
export function recoveryStatus(
  rows: readonly RecoveryDayInput[],
  day: string,
  options: RecoveryOptions,
): RecoveryResult {
  return statusFor(prepare(rows), day, options);
}

/** Verlauf der letzten `RECOVERY.trendDays` Tage bis `today` (älteste zuerst, heute = letzter Eintrag). */
export function recoveryTrend(
  rows: readonly RecoveryDayInput[],
  today: string,
  options: RecoveryOptions,
): RecoveryResult[] {
  const prepared = prepare(rows);
  return Array.from({ length: RECOVERY.trendDays }, (_, i) =>
    statusFor(prepared, addDays(today, -(RECOVERY.trendDays - 1) + i), options),
  );
}

/** Gibt es überhaupt einen Erholungs-Wert (Schlaf, Ruhepuls, HRV) in den Zeilen? Sonst Leerzustand. */
export function hasRecoveryData(rows: readonly RecoveryDayInput[]): boolean {
  return rows.some(
    (r) =>
      plausible(r.sleep_min, 'sleep_min') ||
      plausible(r.resting_hr_bpm, 'resting_hr_bpm') ||
      plausible(r.hrv_rmssd_ms, 'hrv_rmssd_ms'),
  );
}

/**
 * Angebot für heute (KONZEPT 4.1 „Schlechte Tagesform aus Wearable → leichtere Einheit für heute vorschlagen“): nur
 * bei Status `low` und nur an einem Tag mit noch offener, heute geplanter Einheit. Gratis für alle
 * (Gründer-Entscheidung 26.10.2026: feste Regel ohne KI, eine Sicherheitsfunktion wie „Heute leichter“ im
 * Zyklus-Modul); die übrige Live-Anpassung (KONZEPT 4.1) bleibt Premium. Sonst `as_planned` – nie automatisch, nie
 * „Ruhetag“ oder „Verschieben“ (die Erholung macht höchstens eine Stufe leichter; mit weiteren Angeboten, z. B. später
 * aus dem Zyklus-Modul, kombiniert `combineDayOffers` zu EINER Stufe).
 */
export function recoveryOffer(input: {
  readonly status: RecoveryStatus;
  readonly plannedSessionOpenToday: boolean;
}): Extract<DayOffer, 'lighter' | 'as_planned'> {
  return input.plannedSessionOpenToday && input.status === 'low' ? 'lighter' : 'as_planned';
}

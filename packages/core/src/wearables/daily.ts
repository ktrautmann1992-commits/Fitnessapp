import { DAILY_METRIC_LIMITS } from '../constants';
import { isoDateInTimeZone } from '../dates';
import type { DailyMetricImport } from './schema';

/**
 * Tageswerte aus Health Connect (W8-2, W8-6, docs/PLAN-PHASE-8.md 3): Ruhepuls, Schlafdauer und Schritte je Tag
 * (Europe/Berlin). Nur Tageswerte werden gespeichert – nie Schlafphasen oder einzelne Messungen. Rein.
 */

/** RestingHeartRateRecord (Zeitpunkt, Wert). */
export interface RestingHeartRateInput {
  readonly time: string;
  readonly beatsPerMinute: number;
}

/** Schlafphase (SleepStageType von Health Connect: 1 = wach, 3 = aufgestanden; alles andere zählt als Schlaf). */
export interface SleepStageInput {
  readonly startTime: string;
  readonly endTime: string;
  readonly stage: number;
}

export interface SleepSessionInput {
  readonly startTime: string;
  readonly endTime: string;
  readonly stages?: readonly SleepStageInput[];
}

/** Schritte je Tag (Aggregat-Abfrage von Health Connect – entdoppelt Handy und Uhr selbst, nie Einzelwerte addieren). */
export interface DailyStepsInput {
  readonly day: string;
  readonly count: number;
}

/** Wach-Phasen, die nicht zur Schlafdauer zählen (SleepStageType AWAKE = 1, OUT_OF_BED = 3). */
export const SLEEP_AWAKE_STAGES = [1, 3] as const;

type Interval = [number, number];

function union(intervals: Interval[]): number {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current: Interval | null = null;
  for (const [s, e] of sorted) {
    if (!current || s > current[1]) {
      if (current) total += current[1] - current[0];
      current = [s, e];
    } else if (e > current[1]) {
      current = [current[0], e];
    }
  }
  if (current) total += current[1] - current[0];
  return total;
}

/** Schlaf-Intervalle einer Sitzung (ohne Wachphasen, auf die Sitzung begrenzt). */
function asleepIntervals(session: SleepSessionInput): Interval[] {
  const s0 = Date.parse(session.startTime);
  const s1 = Date.parse(session.endTime);
  if (!Number.isFinite(s0) || !Number.isFinite(s1) || s1 <= s0) return [];
  const stages = session.stages ?? [];
  if (stages.length === 0) return [[s0, s1]];
  const out: Interval[] = [];
  for (const stage of stages) {
    if ((SLEEP_AWAKE_STAGES as readonly number[]).includes(stage.stage)) continue;
    const a = Math.max(s0, Date.parse(stage.startTime));
    const b = Math.min(s1, Date.parse(stage.endTime));
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) out.push([a, b]);
  }
  return out;
}

const inRange = (value: number, limits: { min: number; max: number }) =>
  Number.isFinite(value) && value >= limits.min && value <= limits.max;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Tageswerte je Tag (aufsteigend), nur Tage mit mindestens einem Wert:
 * - Ruhepuls: Median der Messungen des Tages (gerundet), nur 30–120 /min,
 * - Schlaf: Minuten ohne Wachphasen, dem AUFWACHTAG (Ende der Sitzung) zugeordnet; überlappende Sitzungen (z. B.
 *   Handy und Uhr) zählen nur einmal; höchstens 1.440 min,
 * - Schritte: Wert der Aggregat-Abfrage, gerundet; außerhalb 0–100.000 verworfen (Messfehler).
 * `from`/`to` (JJJJ-MM-TT, optional) begrenzen die Tage.
 */
export function aggregateDailyMetrics(input: {
  restingHeartRates?: readonly RestingHeartRateInput[];
  sleepSessions?: readonly SleepSessionInput[];
  steps?: readonly DailyStepsInput[];
  from?: string;
  to?: string;
}): DailyMetricImport[] {
  const days = new Map<string, { hr: number[]; sleep: Interval[]; steps: number | null }>();
  const entry = (day: string) => {
    let value = days.get(day);
    if (!value) {
      value = { hr: [], sleep: [], steps: null };
      days.set(day, value);
    }
    return value;
  };
  for (const r of input.restingHeartRates ?? []) {
    if (!Number.isFinite(Date.parse(r.time))) continue;
    if (!inRange(r.beatsPerMinute, DAILY_METRIC_LIMITS.restingHrBpm)) continue;
    entry(isoDateInTimeZone(r.time)).hr.push(r.beatsPerMinute);
  }
  for (const s of input.sleepSessions ?? []) {
    const intervals = asleepIntervals(s);
    if (intervals.length === 0) continue;
    entry(isoDateInTimeZone(s.endTime)).sleep.push(...intervals);
  }
  for (const s of input.steps ?? []) {
    const count = Math.round(s.count);
    if (!inRange(count, DAILY_METRIC_LIMITS.steps)) continue;
    const e = entry(s.day);
    e.steps = (e.steps ?? 0) + count;
  }
  const result: DailyMetricImport[] = [];
  for (const [day, value] of [...days].sort(([a], [b]) => a.localeCompare(b))) {
    if (input.from !== undefined && day < input.from) continue;
    if (input.to !== undefined && day > input.to) continue;
    const resting = value.hr.length > 0 ? Math.round(median(value.hr)) : null;
    const sleepMs = value.sleep.length > 0 ? union(value.sleep) : null;
    const sleepMin =
      sleepMs === null
        ? null
        : Math.min(DAILY_METRIC_LIMITS.sleepMin.max, Math.floor(sleepMs / 60_000));
    const steps =
      value.steps !== null && inRange(value.steps, DAILY_METRIC_LIMITS.steps) ? value.steps : null;
    if (resting === null && sleepMin === null && steps === null) continue;
    result.push({ day, resting_hr_bpm: resting, sleep_min: sleepMin, steps });
  }
  return result;
}

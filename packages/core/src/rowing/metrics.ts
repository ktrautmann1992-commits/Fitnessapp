import {
  CARDIO_LOG_LIMITS,
  ENDURANCE_MODALITY_ROW,
  SPORT_INTENSITY,
  TRAINING_MET,
} from '../constants';
import { type CardioInterval, cardioIntervalSchema } from '../log/schemas';

/**
 * Indoor-Rudern (Sportarten Stufe 1 · Etappe R, docs/PLAN-SPORTARTEN-STUFE-1.md 2.3): Split je 500 m, Watt (nur
 * Anzeige, Concept2-Formel), Plausibilität und Intervall-Ergebnis. Reine Funktionen, alle Grenzen in
 * ENDURANCE_MODALITY_ROW (constants.ts).
 */

const R = ENDURANCE_MODALITY_ROW;

function validPositive(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0;
}

/** Split: Sekunden je 500 m (auf 0,1 s gerundet); null ohne gültige Distanz bzw. Zeit. */
export function rowSplitSeconds(
  durationS: number | null | undefined,
  distanceM: number | null | undefined,
): number | null {
  if (!validPositive(durationS) || !validPositive(distanceM)) return null;
  return Math.round((durationS / distanceM) * R.splitDistanceM * 10) / 10;
}

/** Split als Text „m:ss,d“ (z. B. „1:58,3“), Zehntel nur wenn ≠ 0. */
export function formatRowSplit(splitS: number): string {
  const tenths = Math.round(Math.max(0, splitS) * 10);
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  const d = tenths % 10;
  return `${m}:${String(s).padStart(2, '0')}${d > 0 ? `,${d}` : ''}`;
}

/**
 * Watt aus dem Split (Concept2: P = 2,80 / (s/m)³, Pace in Sekunden je Meter), ganzzahlig gerundet. NUR zur Anzeige –
 * die kcal rechnen in v1 nach MET (rowMet). null bei ungültigem Split.
 */
export function rowWattsFromSplit(splitS: number | null | undefined): number | null {
  if (!validPositive(splitS)) return null;
  const pace = splitS / R.splitDistanceM;
  return Math.round(R.wattFactor / pace ** 3);
}

/** Umkehrung: Split (s/500 m, auf 0,1 s) zu einer Leistung in Watt. null bei ungültiger Leistung. */
export function rowSplitFromWatts(watts: number | null | undefined): number | null {
  if (!validPositive(watts)) return null;
  const pace = (R.wattFactor / watts) ** (1 / 3);
  return Math.round(pace * R.splitDistanceM * 10) / 10;
}

/** Hinweise der Plausibilität (nur Warnungen „Bitte prüfen“, kein Fehler – gespeichert wird trotzdem). */
export type RowCheck =
  'split_too_fast' | 'split_too_slow' | 'stroke_rate_range' | 'power_range' | 'too_many_intervals';

export interface RowValues {
  readonly durationS: number | null;
  readonly distanceM: number | null;
  readonly strokeRate?: number | null;
  readonly avgPowerW?: number | null;
  readonly intervals?: readonly CardioInterval[] | null;
}

function splitCheck(splitS: number | null): RowCheck | null {
  if (splitS === null) return null;
  if (splitS < R.splitS.min) return 'split_too_fast';
  if (splitS > R.splitS.max) return 'split_too_slow';
  return null;
}

/**
 * Plausibilität eines Ruder-Eintrags (ENDURANCE_MODALITY_ROW): Split je 500 m 1:10–4:00 (gesamt und je Wiederholung),
 * Schlagzahl 10–60, Watt 1–1000 (CARDIO_LOG_LIMITS), höchstens 30 Wiederholungen. Jeder Hinweis höchstens einmal.
 */
export function rowPlausibility(values: RowValues): RowCheck[] {
  const out = new Set<RowCheck>();
  const total = splitCheck(rowSplitSeconds(values.durationS, values.distanceM));
  if (total) out.add(total);
  for (const rep of values.intervals ?? []) {
    const check = splitCheck(rowSplitSeconds(rep.duration_s, rep.distance_m));
    if (check) out.add(check);
  }
  const rate = values.strokeRate;
  if (rate !== null && rate !== undefined && (rate < R.strokeRate.min || rate > R.strokeRate.max)) {
    out.add('stroke_rate_range');
  }
  const power = values.avgPowerW;
  const P = CARDIO_LOG_LIMITS.avgPowerW;
  if (power !== null && power !== undefined && (power < P.min || power > P.max)) {
    out.add('power_range');
  }
  if ((values.intervals?.length ?? 0) > R.intervalsMax) out.add('too_many_intervals');
  const order: readonly RowCheck[] = [
    'split_too_fast',
    'split_too_slow',
    'stroke_rate_range',
    'power_range',
    'too_many_intervals',
  ];
  return order.filter((c) => out.has(c));
}

/** Eine Zeile des Intervall-Ergebnisses: Nummer, Distanz, Zeit, Split je 500 m (null ohne gültige Werte). */
export interface RowIntervalRow {
  readonly no: number;
  readonly distanceM: number;
  readonly durationS: number;
  readonly splitS: number | null;
  readonly wattsShown: number | null;
}

export interface RowIntervalSummary {
  readonly rows: readonly RowIntervalRow[];
  readonly totalDistanceM: number;
  readonly totalDurationS: number;
  /** Split über alle Wiederholungen (Summe Zeit ÷ Summe Distanz). */
  readonly averageSplitS: number | null;
  /** Schnellste Wiederholung (Nummer) – bei Gleichstand die frühere; null ohne Split. */
  readonly bestNo: number | null;
}

/** Intervall-Ergebnis zusammenfassen (je Wiederholung Distanz, Zeit, Split; Summe und Durchschnitt). */
export function rowIntervalSummary(intervals: readonly CardioInterval[]): RowIntervalSummary {
  const rows = intervals.map((rep, i) => {
    const splitS = rowSplitSeconds(rep.duration_s, rep.distance_m);
    return {
      no: i + 1,
      distanceM: rep.distance_m,
      durationS: rep.duration_s,
      splitS,
      wattsShown: rowWattsFromSplit(splitS),
    };
  });
  const totalDistanceM = intervals.reduce((sum, r) => sum + r.distance_m, 0);
  const totalDurationS = intervals.reduce((sum, r) => sum + r.duration_s, 0);
  let bestNo: number | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (row.splitS !== null && row.splitS < best) {
      best = row.splitS;
      bestNo = row.no;
    }
  }
  return {
    rows,
    totalDistanceM,
    totalDurationS,
    averageSplitS: rowSplitSeconds(totalDurationS, totalDistanceM),
    bestNo,
  };
}

/**
 * MET beim Rudern nach Anstrengung (Entscheidung 8, v1 ohne Watt-Formel): bis SPORT_INTENSITY.lowEffortMax
 * TRAINING_MET.endurance.row.low, ab highEffortMin `high`, dazwischen linear (auf 0,1). Ohne Angabe `fallback`.
 */
export function rowMet(effort: number | null): number {
  const { low, high, fallback } = TRAINING_MET.endurance.row;
  if (effort === null || !Number.isFinite(effort)) return fallback;
  const { lowEffortMax, highEffortMin } = SPORT_INTENSITY;
  if (effort <= lowEffortMax) return low;
  if (effort >= highEffortMin) return high;
  const share = (effort - lowEffortMax) / (highEffortMin - lowEffortMax);
  return Math.round((low + (high - low) * share) * 10) / 10;
}

/**
 * Gespeichertes Intervall-Ergebnis (cardio_logs.intervals, jsonb) an der Grenze prüfen: Liste mit 1–30 gültigen
 * Wiederholungen, sonst null (nie eine halbe Liste).
 */
export function parseRowIntervals(value: unknown): CardioInterval[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > R.intervalsMax) return null;
  const out: CardioInterval[] = [];
  for (const item of value) {
    const parsed = cardioIntervalSchema.safeParse(item);
    if (!parsed.success) return null;
    out.push(parsed.data);
  }
  return out;
}

/** Ein Gerät zu Hause (wie PlanInputs.homeEquipment). */
export interface RowingEquipmentItem {
  readonly equipmentId: string;
}

/** Steht ein Rudergerät in den Geräten zu Hause (ENDURANCE_MODALITY_ROW.equipmentId)? */
export function hasRowingMachine(homeEquipment: readonly RowingEquipmentItem[]): boolean {
  return homeEquipment.some((item) => item.equipmentId === R.equipmentId);
}

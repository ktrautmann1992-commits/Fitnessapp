import { CARDIO_LOG_LIMITS } from '../constants';
import type { CardioInterval } from '../log/schemas';

/**
 * Eingabe der Ruder-Werte beim Eintragen (Sportarten Stufe 1 · Etappe R): Watt und Schlagzahl optional, Intervall-
 * Ergebnis je Wiederholung Distanz und Zeit. Zahlen schon gelesen (leer = null, unlesbar = NaN), Zeit als Sekunden
 * (parseRowClock). Grenzen = CARDIO_LOG_LIMITS (gleiche CHECKs an cardio_logs).
 */
export interface RowIntervalInput {
  readonly distanceM: number | null;
  readonly durationS: number | null;
}

export interface RowCardioInput {
  readonly avgPowerW: number | null;
  readonly strokeRate: number | null;
  readonly intervals: readonly RowIntervalInput[];
}

export type RowInputField = 'power' | 'strokeRate' | 'intervals';
export type RowInputError =
  'power_invalid' | 'stroke_rate_invalid' | 'intervals_invalid' | 'intervals_too_many';

export type RowInputResult =
  | {
      readonly ok: true;
      readonly avgPowerW: number | null;
      readonly strokeRate: number | null;
      readonly intervals: CardioInterval[] | null;
    }
  | { readonly ok: false; readonly errors: Partial<Record<RowInputField, RowInputError>> };

const wholeIn = (value: number, limits: { readonly min: number; readonly max: number }) =>
  Number.isInteger(value) && value >= limits.min && value <= limits.max;

/**
 * Zeit „m:ss“ bzw. „h:mm:ss“ oder nur Sekunden („95“) → Sekunden; leer → null; unlesbar → NaN. Sekunden-Teile höchstens
 * 59 (außer bei reiner Sekunden-Angabe).
 */
export function parseRowClock(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(trimmed)) return Number.NaN;
  const parts = trimmed.split(':').map((p) => Number(p));
  if (parts.length === 1) return parts[0] as number;
  if (parts.slice(1).some((p) => p > 59)) return Number.NaN;
  return parts.reduce((sum, p) => sum * 60 + p, 0);
}

/**
 * Ruder-Werte prüfen: Watt 1–1000, Schlagzahl 10–60 (ganze Zahlen), Intervalle höchstens 30, je Distanz 1–10 000 m und
 * Zeit 1 s–1 h. Ganz leere Zeilen zählen nicht; eine halb ausgefüllte Zeile ist ein Fehler. Keine Zeile → null.
 */
export function rowValuesFromInput(input: RowCardioInput): RowInputResult {
  const L = CARDIO_LOG_LIMITS;
  const errors: Partial<Record<RowInputField, RowInputError>> = {};
  if (input.avgPowerW !== null && !wholeIn(input.avgPowerW, L.avgPowerW)) {
    errors.power = 'power_invalid';
  }
  if (input.strokeRate !== null && !wholeIn(input.strokeRate, L.strokeRate)) {
    errors.strokeRate = 'stroke_rate_invalid';
  }
  const filled = input.intervals.filter((r) => r.distanceM !== null || r.durationS !== null);
  const intervals: CardioInterval[] = [];
  for (const rep of filled) {
    if (
      rep.distanceM === null ||
      rep.durationS === null ||
      !wholeIn(rep.distanceM, L.intervalDistanceM) ||
      !wholeIn(rep.durationS, L.intervalDurationS)
    ) {
      errors.intervals = 'intervals_invalid';
      break;
    }
    intervals.push({ distance_m: rep.distanceM, duration_s: rep.durationS });
  }
  if (!errors.intervals && filled.length > L.intervalsMax) errors.intervals = 'intervals_too_many';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    avgPowerW: input.avgPowerW,
    strokeRate: input.strokeRate,
    intervals: intervals.length > 0 ? intervals : null,
  };
}

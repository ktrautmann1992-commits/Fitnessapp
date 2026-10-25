import { z } from 'zod';

import { isoDateSchema } from '../age';
import {
  ACTIVE_AGING_NUTRITION,
  BODY_METRIC_LIMITS,
  MAX_WEEKLY_WEIGHT_LOSS_FRACTION,
  WEIGHT_TREND,
} from '../constants';
import { addDays, daysBetween } from '../dates';
import type { GoalType } from '../enums';

/**
 * Gewichtstrend (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 2, Gründer-Freigabe 25.10.2026): geglättete Linie über die
 * täglichen Werte (EMA, WEIGHT_TREND mit Quelle), Tempo je Woche und eine VORSICHTIGE Prognose zum Wunschgewicht.
 *
 * Schutzregeln (CLAUDE.md, nicht abschaltbar):
 * - Prognose nur bei Wunschgewicht, passender Richtung (sinkt) und Tempo innerhalb MAX_WEEKLY_WEIGHT_LOSS_FRACTION.
 *   Schneller → `tooFast` (Hinweis), nie eine Prognose, die das Tempo belohnt.
 * - Schwangerschaft/Stillzeit: kein Tempo, keine Prognose, kein „zu schnell“.
 * - Reine Rechnung: keine Texte, keine Logs. Gewicht ist ein Gesundheitsdatum – die App zeigt das Ergebnis nur mit
 *   Einwilligung und wenn es nicht ausgeblendet ist.
 */

/**
 * Höchstes Abnehm-Tempo je Woche für den Hinweis „zu schnell“ – dieselbe Grenze wie die Ernährungs-Engine
 * (`eligibility.ts`): Fit im Alter 0,5 % (ACTIVE_AGING_NUTRITION), sonst MAX_WEEKLY_WEIGHT_LOSS_FRACTION. Nur gelesen,
 * keine eigene Grenze.
 */
export function weightTrendLossLimit(goalType: GoalType | null | undefined): number {
  return goalType === 'active_aging'
    ? ACTIVE_AGING_NUTRITION.weeklyLossMaxFraction
    : MAX_WEEKLY_WEIGHT_LOSS_FRACTION;
}

export interface WeightEntry {
  readonly date: string;
  readonly weightKg: number;
}

const entrySchema = z.object({
  date: isoDateSchema,
  weightKg: z
    .number()
    .finite()
    .min(BODY_METRIC_LIMITS.weightKg.min)
    .max(BODY_METRIC_LIMITS.weightKg.max),
});

export interface WeightTrendPoint {
  readonly date: string;
  /** Gemessener Wert dieses Tages. */
  readonly weightKg: number;
  /** Geglätteter Trend an diesem Tag (nach Einrechnen des Werts). */
  readonly trendKg: number;
  /** Nummer des Abschnitts: steigt nach einer Lücke > resetAfterGapDays (Trend beginnt neu). */
  readonly segment: number;
}

/**
 * Alle Werte bis einschließlich `today` (spätere zählen nicht), aufsteigend, je Tag einer (der letzte gewinnt), mit
 * Trend. α je Wert = 1 − (1 − smoothingPerDay)^Tage seit dem letzten Wert; nach einer zu langen Lücke Neustart.
 * Wirft bei ungültigen Werten (Zod).
 */
export function weightTrendSeries(
  entries: readonly WeightEntry[],
  today: string,
): WeightTrendPoint[] {
  const limit = isoDateSchema.parse(today);
  const byDate = new Map<string, number>();
  for (const entry of z.array(entrySchema).parse(entries)) {
    if (entry.date <= limit) byDate.set(entry.date, entry.weightKg);
  }
  const dates = [...byDate.keys()].sort();
  const points: WeightTrendPoint[] = [];
  let previous: WeightTrendPoint | null = null;
  for (const date of dates) {
    const weightKg = byDate.get(date) as number;
    let point: WeightTrendPoint;
    if (previous === null) {
      point = { date, weightKg, trendKg: weightKg, segment: 0 };
    } else {
      const gap = daysBetween(previous.date, date);
      if (gap > WEIGHT_TREND.resetAfterGapDays) {
        point = { date, weightKg, trendKg: weightKg, segment: previous.segment + 1 };
      } else {
        const alpha = 1 - (1 - WEIGHT_TREND.smoothingPerDay) ** gap;
        point = {
          date,
          weightKg,
          trendKg: previous.trendKg + alpha * (weightKg - previous.trendKg),
          segment: previous.segment,
        };
      }
    }
    points.push(point);
    previous = point;
  }
  return points;
}

export type WeightTrendDirection = 'down' | 'up' | 'stable';

export interface WeightTrendRate {
  /** Veränderung des Trends je Woche in kg (negativ = sinkt). */
  readonly kgPerWeek: number;
  /** Anteil am aktuellen Trendgewicht je Woche (negativ = sinkt). */
  readonly fractionPerWeek: number;
  readonly direction: WeightTrendDirection;
}

export type WeightForecastBlocker =
  | 'no_goal'
  | 'pregnancy'
  | 'too_few_values'
  | 'stale'
  | 'reached'
  | 'direction_mismatch'
  | 'too_fast'
  | 'too_slow'
  | 'too_far';

export type WeightForecast =
  | {
      readonly kind: 'date';
      /** Frühester Tag, an dem der Trend bei gleichem Tempo das Wunschgewicht erreicht. */
      readonly date: string;
      readonly weeks: number;
    }
  | { readonly kind: 'none'; readonly reason: WeightForecastBlocker };

export interface WeightTrendInput {
  readonly entries: readonly WeightEntry[];
  readonly today: string;
  /** Wunschgewicht (weight_goals, nur beim Abnehmen); null = keins. */
  readonly goal: { readonly targetWeightKg: number } | null;
  /** Schwangerschaft/Stillzeit (Gesundheits-Check bzw. Zyklus-Status) → kein Tempo, keine Prognose. */
  readonly pregnancy: boolean;
  /** Höchstes Abnehm-Tempo je Woche (Standard MAX_WEEKLY_WEIGHT_LOSS_FRACTION; Fit im Alter 0,5 %). */
  readonly maxWeeklyLossFraction?: number;
}

export interface WeightTrend {
  /** `empty` = kein Wert, `single` = genau ein Wert im Fenster (noch keine Linie), sonst `ready`. */
  readonly status: 'empty' | 'single' | 'ready';
  /** Werte der letzten WEIGHT_TREND.windowDays Tage bis heute (Trend mit allen älteren Werten eingeschwungen). */
  readonly points: readonly WeightTrendPoint[];
  readonly latest: WeightTrendPoint | null;
  /** Letzter Wert älter als `rateWindowDays` Tage. */
  readonly stale: boolean;
  /** Im Fenster beginnt der Trend nach einer langen Lücke neu. */
  readonly restarted: boolean;
  /** null = zu wenige Werte, veraltet oder Schwangerschaft. */
  readonly rate: WeightTrendRate | null;
  /** Sinkt schneller als erlaubt (nur ohne Schwangerschaft). */
  readonly tooFast: boolean;
  readonly forecast: WeightForecast;
}

/** Steigung (kg je Tag) der Trendwerte über die Tage – kleinste Quadrate. */
function slopePerDay(points: readonly WeightTrendPoint[], origin: string): number {
  const xs = points.map((p) => daysBetween(origin, p.date));
  const ys = points.map((p) => p.trendKg);
  const n = points.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += ((xs[i] as number) - meanX) * ((ys[i] as number) - meanY);
    den += ((xs[i] as number) - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Tempo aus den Trendwerten der letzten `rateWindowDays` Tage bis zum letzten Wert – nur im laufenden Abschnitt, mit
 * mindestens `rateMinValues` Werten über `rateMinSpanDays` Tage, und erst wenn der Abschnitt so lang wie das Fenster
 * ist (am Anfang hinkt die Glättung hinterher und würde das Tempo unterschätzen).
 */
function rateOf(series: readonly WeightTrendPoint[]): WeightTrendRate | null {
  const latest = series.at(-1);
  if (!latest) return null;
  const segment = series.filter((p) => p.segment === latest.segment);
  const segmentStart = segment[0] as WeightTrendPoint;
  if (daysBetween(segmentStart.date, latest.date) < WEIGHT_TREND.rateWindowDays) return null;
  const from = addDays(latest.date, -WEIGHT_TREND.rateWindowDays);
  const window = segment.filter((p) => p.date >= from);
  const first = window[0] as WeightTrendPoint;
  if (
    window.length < WEIGHT_TREND.rateMinValues ||
    daysBetween(first.date, latest.date) < WEIGHT_TREND.rateMinSpanDays
  ) {
    return null;
  }
  const kgPerWeek = slopePerDay(window, from) * 7;
  const fractionPerWeek = kgPerWeek / latest.trendKg;
  const direction: WeightTrendDirection =
    Math.abs(fractionPerWeek) < WEIGHT_TREND.stableBandFraction
      ? 'stable'
      : fractionPerWeek < 0
        ? 'down'
        : 'up';
  return { kgPerWeek, fractionPerWeek, direction };
}

const maxLossSchema = z.number().gt(0).max(MAX_WEEKLY_WEIGHT_LOSS_FRACTION);
const goalSchema = z
  .object({
    targetWeightKg: z
      .number()
      .finite()
      .min(BODY_METRIC_LIMITS.weightKg.min)
      .max(BODY_METRIC_LIMITS.weightKg.max),
  })
  .nullable();

export function weightTrend(input: WeightTrendInput): WeightTrend {
  const today = isoDateSchema.parse(input.today);
  const goal = goalSchema.parse(input.goal);
  // Nie lockerer als CLAUDE.md erlaubt (Zod wirft bei > 1 %).
  const maxLoss = maxLossSchema.parse(
    input.maxWeeklyLossFraction ?? MAX_WEEKLY_WEIGHT_LOSS_FRACTION,
  );
  const series = weightTrendSeries(input.entries, today);
  const windowStart = addDays(today, -WEIGHT_TREND.windowDays);
  const points = series.filter((p) => p.date >= windowStart);
  const latest = points.at(-1) ?? null;
  const none = (reason: WeightForecastBlocker): WeightForecast => ({ kind: 'none', reason });
  if (latest === null) {
    return {
      status: 'empty',
      points,
      latest: null,
      stale: false,
      restarted: false,
      rate: null,
      tooFast: false,
      forecast: none(goal === null ? 'no_goal' : 'too_few_values'),
    };
  }
  const stale = daysBetween(latest.date, today) > WEIGHT_TREND.rateWindowDays;
  const restarted = points.some((p) => p.segment !== (points[0] as WeightTrendPoint).segment);
  const rate = input.pregnancy || stale ? null : rateOf(series);
  const tooFast = rate !== null && rate.direction === 'down' && -rate.fractionPerWeek > maxLoss;

  let forecast: WeightForecast;
  if (input.pregnancy) forecast = none('pregnancy');
  else if (goal === null) forecast = none('no_goal');
  else if (stale) forecast = none('stale');
  else if (latest.trendKg <= goal.targetWeightKg) forecast = none('reached');
  else if (rate === null) forecast = none('too_few_values');
  else if (tooFast) forecast = none('too_fast');
  else if (rate.direction === 'up') forecast = none('direction_mismatch');
  else if (
    rate.direction === 'stable' ||
    -rate.fractionPerWeek < WEIGHT_TREND.forecastMinFractionPerWeek
  ) {
    forecast = none('too_slow');
  } else {
    const weeks = (latest.trendKg - goal.targetWeightKg) / -rate.kgPerWeek;
    forecast =
      weeks > WEIGHT_TREND.forecastMaxWeeks
        ? none('too_far')
        : { kind: 'date', date: addDays(latest.date, Math.ceil(weeks * 7)), weeks };
  }

  return {
    status: points.length === 1 ? 'single' : 'ready',
    points,
    latest,
    stale,
    restarted,
    rate,
    tooFast,
    forecast,
  };
}

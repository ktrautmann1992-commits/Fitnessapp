import { z } from 'zod';

import { isoDateSchema } from '../age';
import { E1RM_ESTIMATE, MONTH_REVIEW } from '../constants';
import { addDays, startOfIsoWeek } from '../dates';
import { ENDURANCE_MODALITIES, type EnduranceModality } from '../enums';
import { dayEvaluation, type DayEvaluationInput } from '../evaluation/day-evaluation';
import { type SummaryLog, type SummarySession, weekLogSummary } from '../log/summary';
import { type WeightEntry, weightTrendSeries } from './weight-trend';

/**
 * Monatsrückblick (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 3, Gründer-Freigabe 25.10.2026): private Zusammenfassung
 * eines Kalendermonats. Neutral, ohne Serien („Streaks“), ohne Vergleich mit anderen, ohne Bewertung.
 *
 * - Training aus `weekLogSummary` (gleiche Zählung wie Woche und Wochenauswertung, je Tag am angezeigten Datum):
 *   gemacht (Einträge zu Plan-Einheiten), geplant (Einheiten des aktiven Plans ohne gestrichene), verpasst, noch offen,
 *   freie Einheiten extra.
 * - Kilometer je Sportart aus den Ausdauer-Einträgen (cardio_logs, auch freie und von der Uhr übernommene).
 * - Kraft: bis zu MONTH_REVIEW.strengthTop Übungen mit der größten Steigerung des geschätzten Maximums (Epley,
 *   E1RM_ESTIMATE) gegenüber allen früheren Einträgen.
 * - Essen nur als Anzahlen (Tage mit Einträgen, abgehakte Mahlzeiten aus dem Essensplan) – nie kcal, nie Zonen.
 * - Gewicht nur, wenn die App es übergibt (Einwilligung, nicht ausgeblendet): Trend am Anfang und Ende des Monats.
 *
 * Reine Rechnung, keine Texte, nie loggen (Gesundheitsdaten).
 */

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Monat als JJJJ-MM.');

export function monthOf(date: string): string {
  return isoDateSchema.parse(date).slice(0, 7);
}

export function monthBounds(month: string): { readonly first: string; readonly last: string } {
  const first = `${monthSchema.parse(month)}-01`;
  const nextFirst = `${monthOf(addDays(first, 31))}-01`;
  return { first, last: addDays(nextFirst, -1) };
}

/** Monat davor bzw. danach (`delta` Monate). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = monthSchema.parse(month).split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/**
 * Angebot „Dein Rückblick auf <Vormonat>“: vom 1. bis zum MONTH_REVIEW.offerDays. Tag, solange der Vormonat noch nicht
 * geöffnet wurde (`lastOpened` = zuletzt geöffneter Rückblick-Monat, nur auf dem Gerät). null = kein Angebot.
 */
export function monthReviewOffer(today: string, lastOpened: string | null): string | null {
  const day = Number(isoDateSchema.parse(today).slice(8, 10));
  if (day > MONTH_REVIEW.offerDays) return null;
  const previous = shiftMonth(monthOf(today), -1);
  if (lastOpened !== null && monthSchema.parse(lastOpened) >= previous) return null;
  return previous;
}

export interface MonthReviewSet {
  readonly date: string;
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly weightKg: number | null;
  readonly reps: number | null;
  readonly done: boolean;
}

export interface MonthReviewCardio {
  readonly date: string;
  readonly modality: EnduranceModality;
  readonly distanceM: number | null;
}

export interface MonthReviewInput {
  readonly month: string;
  readonly today: string;
  /** Eingaben von `weekLogSummary` (alle Einheiten und Einträge). */
  readonly sessions: readonly SummarySession[];
  readonly logs: readonly SummaryLog[];
  readonly cardio: readonly MonthReviewCardio[];
  /** Sätze (auch frühere Monate als Vergleich). */
  readonly sets: readonly MonthReviewSet[];
  /** Ernährungstagebuch; null = nicht verfügbar (Betriebsart oder keine Einwilligung). */
  readonly food: {
    readonly entries: readonly (DayEvaluationInput['foodLog']['entries'][number] & {
      readonly date: string;
    })[];
    /** Gespeicherte Essenspläne: Plätze der Mahlzeiten je Tag. */
    readonly planDays: readonly { readonly date: string; readonly slots: readonly string[] }[];
  } | null;
  /** Gewichtswerte; null = nicht zeigen (keine Einwilligung oder ausgeblendet). */
  readonly weight: readonly WeightEntry[] | null;
}

export interface StrengthGain {
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly before: { readonly weightKg: number; readonly reps: number };
  readonly best: { readonly weightKg: number; readonly reps: number };
  /** Steigerung des geschätzten Maximums (0,05 = 5 %). */
  readonly gainFraction: number;
}

export type MonthReviewWeight =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'too_few' }
  | {
      readonly kind: 'trend';
      readonly startKg: number;
      readonly endKg: number;
      readonly changeKg: number;
      readonly values: number;
    };

export interface MonthReview {
  readonly month: string;
  readonly first: string;
  readonly last: string;
  /** `past` = Monat vorbei, `current` = läuft (bis heute), `future` = noch nicht begonnen. */
  readonly timing: 'past' | 'current' | 'future';
  readonly training: {
    readonly done: number;
    readonly planned: number;
    readonly missed: number;
    readonly open: number;
    readonly free: number;
  };
  readonly distances: readonly { readonly modality: EnduranceModality; readonly km: number }[];
  readonly strength: readonly StrengthGain[];
  readonly food:
    | { readonly kind: 'unavailable' }
    | {
        readonly kind: 'counts';
        /** Vergangene Tage des Monats (heute läuft noch). */
        readonly days: number;
        readonly entryDays: number;
        readonly meals: { readonly eaten: number; readonly planned: number } | null;
      };
  readonly weight: MonthReviewWeight;
  /** Nichts zu berichten (kein Training, keine Kilometer, keine Einträge). */
  readonly empty: boolean;
}

function trainingOf(input: MonthReviewInput, first: string, last: string, today: string) {
  const counts = { done: 0, planned: 0, missed: 0, open: 0, free: 0 };
  for (let week = startOfIsoWeek(first); week <= last; week = addDays(week, 7)) {
    const summary = weekLogSummary(input.sessions, input.logs, week, today);
    for (const day of summary.days) {
      if (day.date < first || day.date > last) continue;
      for (const item of day.items) {
        if (item.free) {
          counts.free += 1;
          continue;
        }
        if (item.logId !== null) {
          counts.done += 1;
          counts.planned += 1;
        } else if (item.status === 'missed') {
          counts.missed += 1;
          counts.planned += 1;
        } else if (item.status === 'planned') {
          counts.open += 1;
          counts.planned += 1;
        } else if (item.status === 'done') {
          // Als erledigt markiert, Eintrag nicht (mehr) auf dem Gerät.
          counts.done += 1;
          counts.planned += 1;
        }
      }
    }
  }
  return counts;
}

function distancesOf(cardio: readonly MonthReviewCardio[], first: string, last: string) {
  const meters = new Map<EnduranceModality, number>();
  for (const entry of cardio) {
    if (entry.date < first || entry.date > last || !entry.distanceM || entry.distanceM <= 0) {
      continue;
    }
    meters.set(entry.modality, (meters.get(entry.modality) ?? 0) + entry.distanceM);
  }
  return ENDURANCE_MODALITIES.flatMap((modality) => {
    const m = meters.get(modality);
    return m === undefined ? [] : [{ modality, km: Math.round(m / 100) / 10 }];
  })
    .filter((d) => d.km > 0)
    .sort((a, b) => b.km - a.km);
}

interface BestSet {
  readonly weightKg: number;
  readonly reps: number;
  readonly e1rm: number;
}

/** Geschätztes Maximum (Epley ohne Reserve) – nur Sätze mit Gewicht und Wdh. 1 … maxRepsPlusReserve. */
function bestSetOf(sets: readonly MonthReviewSet[]): BestSet | null {
  let best: BestSet | null = null;
  for (const set of sets) {
    if (!set.done || set.weightKg === null || set.reps === null) continue;
    if (set.weightKg <= 0 || set.reps < 1 || set.reps > E1RM_ESTIMATE.maxRepsPlusReserve) continue;
    const e1rm = set.weightKg * (1 + set.reps / E1RM_ESTIMATE.epleyDivisor);
    if (best === null || e1rm > best.e1rm) best = { weightKg: set.weightKg, reps: set.reps, e1rm };
  }
  return best;
}

function strengthOf(sets: readonly MonthReviewSet[], first: string, last: string): StrengthGain[] {
  const byExercise = new Map<string, MonthReviewSet[]>();
  for (const set of sets) {
    if (set.date > last) continue;
    byExercise.set(set.exerciseId, [...(byExercise.get(set.exerciseId) ?? []), set]);
  }
  const gains: StrengthGain[] = [];
  for (const [exerciseId, all] of byExercise) {
    const inMonth = all.filter((s) => s.date >= first);
    const before = bestSetOf(all.filter((s) => s.date < first));
    const best = bestSetOf(inMonth);
    if (before === null || best === null) continue;
    const gainFraction = best.e1rm / before.e1rm - 1;
    if (gainFraction < MONTH_REVIEW.strengthMinGainFraction) continue;
    const name = inMonth.at(-1)?.exerciseName ?? exerciseId;
    gains.push({
      exerciseId,
      exerciseName: name,
      before: { weightKg: before.weightKg, reps: before.reps },
      best: { weightKg: best.weightKg, reps: best.reps },
      gainFraction,
    });
  }
  return gains
    .sort((a, b) => b.gainFraction - a.gainFraction || a.exerciseName.localeCompare(b.exerciseName))
    .slice(0, MONTH_REVIEW.strengthTop);
}

function foodOf(
  food: NonNullable<MonthReviewInput['food']>,
  first: string,
  last: string,
  today: string,
): MonthReview['food'] {
  let days = 0;
  let entryDays = 0;
  let eaten = 0;
  let planned = 0;
  let withPlan = 0;
  for (let date = first; date <= last && date < today; date = addDays(date, 1)) {
    days += 1;
    const slots = food.planDays.find((d) => d.date === date)?.slots ?? null;
    // Gleiche Regel wie „Dein Tag“ (abgehakt = Eintrag aus dem Plan mit diesem Platz) – ohne Zahlen.
    const evaluation = dayEvaluation({
      date,
      today,
      showNumbers: false,
      targets: null,
      foodLog: { available: true, entries: food.entries.filter((e) => e.date === date) },
      mealPlan: slots === null ? null : { slots, belowFloor: false },
      trainingItems: [],
      achievements: new Map(),
    });
    if (evaluation.food.entryCount > 0) entryDays += 1;
    if (evaluation.food.meals !== null) {
      withPlan += 1;
      eaten += evaluation.food.meals.eaten;
      planned += evaluation.food.meals.planned;
    }
  }
  return { kind: 'counts', days, entryDays, meals: withPlan === 0 ? null : { eaten, planned } };
}

function weightOf(
  entries: readonly WeightEntry[] | null,
  first: string,
  last: string,
  today: string,
): MonthReviewWeight {
  if (entries === null) return { kind: 'hidden' };
  const end = last < today ? last : today;
  const series = weightTrendSeries(entries, end);
  const inMonth = series.filter((p) => p.date >= first);
  const start = inMonth[0];
  const final = inMonth.at(-1);
  // Mindestens zwei Werte im selben Abschnitt (nach einer langen Lücke beginnt der Trend neu).
  if (!start || !final || start === final || start.segment !== final.segment) {
    return { kind: 'too_few' };
  }
  return {
    kind: 'trend',
    startKg: start.trendKg,
    endKg: final.trendKg,
    changeKg: final.trendKg - start.trendKg,
    values: inMonth.length,
  };
}

export function monthReview(input: MonthReviewInput): MonthReview {
  const today = isoDateSchema.parse(input.today);
  const { first, last } = monthBounds(input.month);
  const timing = today > last ? 'past' : today < first ? 'future' : 'current';
  const training =
    timing === 'future'
      ? { done: 0, planned: 0, missed: 0, open: 0, free: 0 }
      : trainingOf(input, first, last, today);
  const distances = distancesOf(input.cardio, first, last);
  const strength = strengthOf(input.sets, first, last);
  const food =
    input.food === null ? { kind: 'unavailable' as const } : foodOf(input.food, first, last, today);
  const weight = weightOf(input.weight, first, last, today);
  const empty =
    training.done === 0 &&
    training.free === 0 &&
    training.planned === 0 &&
    distances.length === 0 &&
    (food.kind === 'unavailable' || food.entryDays === 0) &&
    weight.kind !== 'trend';
  return {
    month: input.month,
    first,
    last,
    timing,
    training,
    distances,
    strength,
    food,
    weight,
    empty,
  };
}

import { z } from 'zod';

import { isoDateSchema } from '../age';
import { BODY_METRIC_LIMITS } from '../constants';
import { ENDURANCE_MODALITIES, type EnduranceModality } from '../enums';

/**
 * Text-Codes des Monatsrückblicks als PDF (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 3.4). Wie Trainings- und
 * Ernährungs-Dokumente nur Codes und Daten (B11); die App übersetzt.
 *
 * Datenschutz (docs/PLAN-PDF-EXPORT.md §4): Gesundheitsbezogenes (Essen, Gewicht) steht in eigenen Codes
 * `review.health.*`, `review.food.*` und `review.weight.*`. Sie dürfen nur im Rückblick vorkommen und nur, wenn die
 * Person sie ausdrücklich eingeschlossen hat (Standard aus) – das prüft `buildMonthReviewDocument` und zusätzlich das
 * Dokument-Schema (`printDocumentSchema`). Nie: Ziele, Wunschgewicht, Prognose, Tempo, Zyklus, Schwangerschaft.
 */

type Empty = Record<string, never>;

export interface MonthReviewPrintTextParams {
  'review.doc.title': { month: string };
  'review.doc.footer': Empty;
  'review.cover.heading': Empty;
  'review.label.month': Empty;
  'review.label.period': Empty;
  'review.value.month': { month: string };
  /** „01.10.–25.10.2026 (Monat läuft noch)“. */
  'review.value.period': { from: string; to: string; running: boolean };
  'review.training.heading': Empty;
  'review.training.done': { done: number; planned: number };
  'review.training.missed': { count: number };
  'review.training.open': { count: number };
  'review.training.free': { count: number };
  'review.training.none': Empty;
  'review.distance.heading': Empty;
  'review.col.sport': Empty;
  'review.col.km': Empty;
  'review.sport': { modality: EnduranceModality };
  'review.value.km': { km: number };
  'review.strength.heading': Empty;
  'review.col.exercise': Empty;
  'review.col.before': Empty;
  'review.col.best': Empty;
  'review.value.set': { kg: number; reps: number };
  'review.strength.note': Empty;
  'review.health.heading': Empty;
  'review.food.entryDays': { entryDays: number; days: number };
  'review.food.meals': { eaten: number; planned: number };
  'review.weight.trend': { startKg: number; endKg: number };
  'review.weight.tooFew': Empty;
  /** Gesundheitsangaben nicht eingeschlossen (Standard) – ohne zu sagen, was es gäbe. */
  'review.health.excluded': Empty;
  'review.empty': Empty;
  'review.notice.title': Empty;
  'review.notice.text': Empty;
}

const empty = z.strictObject({});
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const countSchema = z.number().int().min(0).max(10_000);
const kgSchema = z
  .number()
  .finite()
  .min(BODY_METRIC_LIMITS.weightKg.min)
  .max(BODY_METRIC_LIMITS.weightKg.max);

export const MONTH_REVIEW_PARAM_SCHEMAS = {
  'review.doc.title': z.strictObject({ month: monthSchema }),
  'review.doc.footer': empty,
  'review.cover.heading': empty,
  'review.label.month': empty,
  'review.label.period': empty,
  'review.value.month': z.strictObject({ month: monthSchema }),
  'review.value.period': z.strictObject({
    from: isoDateSchema,
    to: isoDateSchema,
    running: z.boolean(),
  }),
  'review.training.heading': empty,
  'review.training.done': z.strictObject({ done: countSchema, planned: countSchema }),
  'review.training.missed': z.strictObject({ count: countSchema }),
  'review.training.open': z.strictObject({ count: countSchema }),
  'review.training.free': z.strictObject({ count: countSchema }),
  'review.training.none': empty,
  'review.distance.heading': empty,
  'review.col.sport': empty,
  'review.col.km': empty,
  'review.sport': z.strictObject({ modality: z.enum(ENDURANCE_MODALITIES) }),
  'review.value.km': z.strictObject({ km: z.number().finite().min(0).max(100_000) }),
  'review.strength.heading': empty,
  'review.col.exercise': empty,
  'review.col.before': empty,
  'review.col.best': empty,
  'review.value.set': z.strictObject({
    kg: z.number().finite().min(0).max(1000),
    reps: z.number().int().min(1).max(100),
  }),
  'review.strength.note': empty,
  'review.health.heading': empty,
  'review.food.entryDays': z.strictObject({ entryDays: countSchema, days: countSchema }),
  'review.food.meals': z.strictObject({ eaten: countSchema, planned: countSchema }),
  'review.weight.trend': z.strictObject({ startKg: kgSchema, endKg: kgSchema }),
  'review.weight.tooFew': empty,
  'review.health.excluded': empty,
  'review.empty': empty,
  'review.notice.title': empty,
  'review.notice.text': empty,
} satisfies { [K in keyof MonthReviewPrintTextParams]: z.ZodType<MonthReviewPrintTextParams[K]> };

/** Codes mit Gesundheitsbezug – nur im Rückblick und nur mit ausdrücklicher Zustimmung. */
export const MONTH_REVIEW_HEALTH_CODES = [
  'review.health.heading',
  'review.food.entryDays',
  'review.food.meals',
  'review.weight.trend',
  'review.weight.tooFew',
] as const satisfies readonly (keyof MonthReviewPrintTextParams)[];

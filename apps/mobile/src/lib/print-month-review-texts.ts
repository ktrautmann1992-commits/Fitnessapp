import type { MonthReviewPrintTextParams } from '@fitnessapp/core';

import { t } from '@/i18n';
import { monthName } from '@/i18n/de-review';

import { formatDateDe, formatDecimal, formatKg } from './format';

/**
 * Druck-Texte des Monatsrückblicks (Codes aus packages/core/src/export/month-review-print-texts.ts). Nur Formulierung.
 */
const r = t.monthReview;

type Translators = {
  readonly [K in keyof MonthReviewPrintTextParams]: (
    params: MonthReviewPrintTextParams[K],
  ) => string;
};

export const MONTH_REVIEW_PRINT_TEXTS: Translators = {
  'review.doc.title': ({ month }) => r.doc.title(monthName(month)),
  'review.doc.footer': () => r.doc.footer,
  'review.cover.heading': () => r.doc.heading,
  'review.label.month': () => r.doc.labelMonth,
  'review.label.period': () => r.doc.labelPeriod,
  'review.value.month': ({ month }) => monthName(month),
  'review.value.period': ({ from, to, running }) =>
    r.doc.period(formatDateDe(from), formatDateDe(to), running),
  'review.training.heading': () => r.trainingTitle,
  'review.training.done': ({ done, planned }) => r.trainingDone(done, planned),
  'review.training.missed': ({ count }) => r.trainingMissed(count),
  'review.training.open': ({ count }) => r.trainingOpen(count),
  'review.training.free': ({ count }) => r.trainingFree(count),
  'review.training.none': () => r.trainingNone,
  'review.distance.heading': () => r.distanceTitle,
  'review.col.sport': () => r.doc.colSport,
  'review.col.km': () => r.doc.colKm,
  'review.sport': ({ modality }) => t.print.modalities[modality],
  'review.value.km': ({ km }) => r.km(formatDecimal(km)),
  'review.strength.heading': () => r.strengthTitle,
  'review.col.exercise': () => r.doc.colExercise,
  'review.col.before': () => r.doc.colBefore,
  'review.col.best': () => r.doc.colBest,
  'review.value.set': ({ kg, reps }) => r.set(formatKg(kg), reps),
  'review.strength.note': () => r.strengthNote,
  'review.health.heading': () => r.doc.healthHeading,
  'review.food.entryDays': ({ entryDays, days }) => r.foodEntryDays(entryDays, days),
  'review.food.meals': ({ eaten, planned }) => r.foodMeals(eaten, planned),
  'review.weight.trend': ({ startDate, startKg, endDate, endKg }) =>
    r.weightTrend(
      formatDateDe(startDate),
      formatDecimal(startKg),
      formatDateDe(endDate),
      formatDecimal(endKg),
    ),
  'review.weight.tooFew': () => r.weightTooFew,
  'review.health.excluded': () => r.doc.healthExcluded,
  'review.empty': () => r.empty,
  'review.notice.title': () => r.doc.noticeTitle,
  'review.notice.text': () => r.doc.noticeText,
};

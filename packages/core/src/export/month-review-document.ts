import { z } from 'zod';

import { isoDateSchema } from '../age';
import type { MonthReview } from '../review/month-review';
import {
  type PrintBlock,
  type PrintDocument,
  type PrintText,
  printData,
  printDate,
  printDocumentSchema,
  printLabel,
  printText,
} from './document';
import { cleanPrintContent } from './print-values';

/**
 * Monatsrückblick als PDF (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 3.4) im Alpha5-Layout – gleicher Weg wie Trainings-
 * und Essensplan (Dokumentmodell → Übersetzung → HTML → Druckdialog). Nur auf dem Gerät, kein Teilen, kein Upload.
 *
 * Gesundheitsangaben (Essen, Gewicht) nur mit `includeHealthData` = true (Standard false, eigener Schalter in der
 * Druckansicht, docs/PLAN-PDF-EXPORT.md §4). Ohne den Schalter steht nur ein neutraler Satz im Dokument. Nie:
 * Wunschgewicht, Prognose, Tempo, Ziele, Zyklus, Schwangerschaft, Name.
 */

export const monthReviewPrintOptionsSchema = z.strictObject({
  onDate: isoDateSchema,
  includeHealthData: z.boolean().default(false),
});
export type MonthReviewPrintOptionsInput = z.input<typeof monthReviewPrintOptionsSchema>;

export type MonthReviewDocumentResult =
  | { readonly ok: true; readonly document: PrintDocument }
  | { readonly ok: false; readonly error: 'invalid_options' | 'future' };

const text = printText;
const label = printLabel;

function trainingBlocks(review: MonthReview): PrintBlock[] {
  const t = review.training;
  const blocks: PrintBlock[] = [
    { type: 'heading', level: 2, text: label('review.training.heading') },
  ];
  if (t.planned === 0 && t.free === 0) {
    blocks.push({ type: 'paragraph', text: label('review.training.none') });
    return blocks;
  }
  if (t.planned > 0) {
    blocks.push({
      type: 'paragraph',
      text: text('review.training.done', { done: t.done, planned: t.planned }),
    });
  }
  if (t.missed > 0) {
    blocks.push({ type: 'paragraph', text: text('review.training.missed', { count: t.missed }) });
  }
  if (t.open > 0) {
    blocks.push({ type: 'paragraph', text: text('review.training.open', { count: t.open }) });
  }
  if (t.free > 0) {
    blocks.push({ type: 'paragraph', text: text('review.training.free', { count: t.free }) });
  }
  return blocks;
}

function distanceBlocks(review: MonthReview): PrintBlock[] {
  if (review.distances.length === 0) return [];
  return [
    {
      type: 'table',
      caption: label('review.distance.heading'),
      captionLevel: 2,
      columns: [
        { header: label('review.col.sport'), role: 'label' },
        { header: label('review.col.km'), role: 'value' },
      ],
      rows: review.distances.map((d) => ({
        header: [text('review.sport', { modality: d.modality })],
        cells: [[text('review.value.km', { km: d.km })]],
      })),
    },
  ];
}

function strengthBlocks(review: MonthReview): PrintBlock[] {
  if (review.strength.length === 0) return [];
  return [
    {
      type: 'table',
      caption: label('review.strength.heading'),
      captionLevel: 2,
      columns: [
        { header: label('review.col.exercise'), role: 'label' },
        { header: label('review.col.before'), role: 'value' },
        { header: label('review.col.best'), role: 'value' },
      ],
      rows: review.strength.map((s) => ({
        header: [printData(cleanPrintContent(s.exerciseName))],
        cells: [
          [text('review.value.set', { kg: s.before.weightKg, reps: s.before.reps })],
          [text('review.value.set', { kg: s.best.weightKg, reps: s.best.reps })],
        ],
      })),
    },
    { type: 'paragraph', text: label('review.strength.note'), muted: true },
  ];
}

function healthBlocks(review: MonthReview, include: boolean): PrintBlock[] {
  const hasFood = review.food.kind === 'counts';
  const hasWeight = review.weight.kind !== 'hidden';
  if (!hasFood && !hasWeight) return [];
  if (!include) {
    return [{ type: 'paragraph', text: label('review.health.excluded'), muted: true }];
  }
  const blocks: PrintBlock[] = [
    { type: 'heading', level: 2, text: label('review.health.heading') },
  ];
  if (review.food.kind === 'counts') {
    blocks.push({
      type: 'paragraph',
      text: text('review.food.entryDays', {
        entryDays: review.food.entryDays,
        days: review.food.days,
      }),
    });
    if (review.food.meals !== null) {
      blocks.push({
        type: 'paragraph',
        text: text('review.food.meals', {
          eaten: review.food.meals.eaten,
          planned: review.food.meals.planned,
        }),
      });
    }
  }
  if (review.weight.kind === 'trend') {
    blocks.push({
      type: 'paragraph',
      text: text('review.weight.trend', {
        startKg: Math.round(review.weight.startKg * 10) / 10,
        endKg: Math.round(review.weight.endKg * 10) / 10,
      }),
    });
  } else if (review.weight.kind === 'too_few') {
    blocks.push({ type: 'paragraph', text: label('review.weight.tooFew'), muted: true });
  }
  return blocks;
}

export function buildMonthReviewDocument(
  review: MonthReview,
  rawOptions: MonthReviewPrintOptionsInput,
): MonthReviewDocumentResult {
  const parsed = monthReviewPrintOptionsSchema.safeParse(rawOptions);
  if (!parsed.success) return { ok: false, error: 'invalid_options' };
  const options = parsed.data;
  if (review.timing === 'future') return { ok: false, error: 'future' };
  const running = review.timing === 'current';
  const to = running && options.onDate < review.last ? options.onDate : review.last;
  const cover: { label: PrintText; value: PrintText }[] = [
    {
      label: label('review.label.month'),
      value: text('review.value.month', { month: review.month }),
    },
    {
      label: label('review.label.period'),
      value: text('review.value.period', { from: review.first, to, running }),
    },
    { label: label('cover.label.asOf'), value: printDate(options.onDate) },
  ];
  const sections: PrintBlock[] = [
    { type: 'heading', level: 1, text: label('review.cover.heading') },
    { type: 'keyValue', items: cover },
  ];
  if (review.empty) sections.push({ type: 'paragraph', text: label('review.empty') });
  sections.push(
    ...trainingBlocks(review),
    ...distanceBlocks(review),
    ...strengthBlocks(review),
    ...healthBlocks(review, options.includeHealthData),
    { type: 'notice', title: label('review.notice.title'), text: label('review.notice.text') },
  );
  const document: PrintDocument = {
    meta: {
      kind: 'month_review',
      title: text('review.doc.title', { month: review.month }),
      fileName: `alpha5-monatsrueckblick-${review.month}`,
      footer: label('review.doc.footer'),
      createdOn: options.onDate,
      includesHealthData: options.includeHealthData,
    },
    sections,
  };
  return { ok: true, document: printDocumentSchema.parse(document) };
}

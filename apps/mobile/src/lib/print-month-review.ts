import { buildMonthReviewDocument, type MonthReview } from '@fitnessapp/core';
import { renderPrintHtml } from '@fitnessapp/ui/print';

import { translatePrintDocument } from './print-document';

/**
 * Monatsrückblick als PDF (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 3.4): Dokumentmodell (packages/core) → Übersetzung →
 * HTML (packages/ui). Keine Fachlogik. Ergebnis bleibt im Speicher – nie loggen, speichern oder hochladen.
 */
export type MonthReviewPrintResult =
  | { readonly ok: true; readonly html: string; readonly title: string }
  | { readonly ok: false; readonly error: 'future' | 'failed' };

export function buildMonthReviewPrint(input: {
  readonly review: MonthReview;
  readonly today: string;
  readonly includeHealthData: boolean;
}): MonthReviewPrintResult {
  try {
    const result = buildMonthReviewDocument(input.review, {
      onDate: input.today,
      includeHealthData: input.includeHealthData,
    });
    if (!result.ok) return { ok: false, error: result.error === 'future' ? 'future' : 'failed' };
    const translated = translatePrintDocument(result.document);
    return { ok: true, html: renderPrintHtml(translated), title: translated.title };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

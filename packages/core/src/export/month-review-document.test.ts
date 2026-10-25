import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import { monthReview, type MonthReview } from '../review/month-review';
import { printDocumentSchema, printDocumentTexts, printText, type PrintDocument } from './document';
import { buildMonthReviewDocument } from './month-review-document';
import { MONTH_REVIEW_HEALTH_CODES } from './month-review-print-texts';

const weight = Array.from({ length: 40 }, (_, i) => ({
  date: addDays('2026-09-25', i),
  weightKg: 80 - i * 0.05,
}));

function review(extra: Partial<Parameters<typeof monthReview>[0]> = {}): MonthReview {
  return monthReview({
    month: '2026-10',
    today: '2026-11-01',
    sessions: [
      {
        id: 's1',
        scheduled_on: '2026-10-05',
        original_date: null,
        status: 'planned',
        kind: 'strength',
        name_de: 'Ganzkörper A',
        plan_active: true,
      },
    ],
    logs: [],
    cardio: [{ date: '2026-10-10', modality: 'run', distanceM: 7500 }],
    sets: [
      {
        date: '2026-09-01',
        exerciseId: 'sq',
        exerciseName: 'Kniebeuge',
        weightKg: 60,
        reps: 8,
        done: true,
      },
      {
        date: '2026-10-20',
        exerciseId: 'sq',
        exerciseName: 'Kniebeuge',
        weightKg: 65,
        reps: 8,
        done: true,
      },
    ],
    food: { entries: [], planDays: [] },
    weight,
    ...extra,
  });
}

const codes = (doc: PrintDocument) =>
  printDocumentTexts(doc).flatMap((v) => (v.kind === 'text' ? [v.code] : []));

describe('buildMonthReviewDocument', () => {
  it('Standard: ohne Gesundheitsangaben – nur ein neutraler Satz, kein Gewicht, kein Essen', () => {
    const result = buildMonthReviewDocument(review(), { onDate: '2026-11-01' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const used = codes(result.document);
    expect(used).toContain('review.health.excluded');
    for (const code of MONTH_REVIEW_HEALTH_CODES) expect(used).not.toContain(code);
    expect(result.document.meta).toMatchObject({
      kind: 'month_review',
      fileName: 'alpha5-monatsrueckblick-2026-10',
      includesHealthData: false,
    });
    expect(used).toEqual(
      expect.arrayContaining(['review.training.done', 'review.sport', 'review.value.set']),
    );
  });

  it('mit Schalter: Essen und Gewichtstrend (gerundet auf 0,1 kg)', () => {
    const result = buildMonthReviewDocument(review(), {
      onDate: '2026-11-01',
      includeHealthData: true,
    });
    if (!result.ok) throw new Error('erwartet ok');
    const used = codes(result.document);
    expect(used).toContain('review.health.heading');
    expect(used).toContain('review.food.entryDays');
    expect(used).toContain('review.weight.trend');
    expect(used).not.toContain('review.health.excluded');
    const trend = printDocumentTexts(result.document).find(
      (v) => v.kind === 'text' && v.code === 'review.weight.trend',
    );
    expect(trend?.kind === 'text' && trend.params).toEqual({
      startDate: '2026-10-01',
      startKg: expect.any(Number),
      endDate: '2026-10-31',
      endKg: expect.any(Number),
    });
  });

  it('ohne Einwilligung (Gewicht/Essen nicht übergeben): kein Gesundheits-Satz', () => {
    const result = buildMonthReviewDocument(review({ weight: null, food: null }), {
      onDate: '2026-11-01',
      includeHealthData: true,
    });
    if (!result.ok) throw new Error('erwartet ok');
    const used = codes(result.document);
    for (const code of MONTH_REVIEW_HEALTH_CODES) expect(used).not.toContain(code);
    expect(used).not.toContain('review.health.excluded');
  });

  it('Zukunft und ungültige Optionen: Fehler statt Dokument', () => {
    expect(
      buildMonthReviewDocument(review({ month: '2026-12' }), { onDate: '2026-11-01' }),
    ).toEqual({
      ok: false,
      error: 'future',
    });
    expect(buildMonthReviewDocument(review(), { onDate: 'heute' })).toEqual({
      ok: false,
      error: 'invalid_options',
    });
  });

  it('laufender Monat: Zeitraum bis heute, Hinweis „läuft noch“', () => {
    const result = buildMonthReviewDocument(review({ today: '2026-10-20' }), {
      onDate: '2026-10-20',
    });
    if (!result.ok) throw new Error('erwartet ok');
    const period = printDocumentTexts(result.document).find(
      (v) => v.kind === 'text' && v.code === 'review.value.period',
    );
    expect(period?.kind === 'text' && period.params).toEqual({
      from: '2026-10-01',
      to: '2026-10-20',
      running: true,
    });
  });

  it('Schema (zweite Schutzschicht): Gesundheits-Codes in anderen Dokumenten oder ohne Zustimmung → ungültig', () => {
    const result = buildMonthReviewDocument(review(), {
      onDate: '2026-11-01',
      includeHealthData: true,
    });
    if (!result.ok) throw new Error('erwartet ok');
    const withoutConsent = {
      ...result.document,
      meta: { ...result.document.meta, includesHealthData: false },
    };
    expect(printDocumentSchema.safeParse(withoutConsent).success).toBe(false);
    const asTrainingPlan = {
      ...result.document,
      meta: { ...result.document.meta, kind: 'training_plan' as const },
    };
    expect(printDocumentSchema.safeParse(asTrainingPlan).success).toBe(false);
    const sneaky: PrintDocument = {
      ...result.document,
      meta: { ...result.document.meta, includesHealthData: false },
      sections: [
        {
          type: 'paragraph',
          text: printText('review.weight.trend', {
            startDate: '2026-10-01',
            startKg: 80,
            endDate: '2026-10-31',
            endKg: 79,
          }),
        },
      ],
    };
    expect(printDocumentSchema.safeParse(sneaky).success).toBe(false);
  });

  it('nie Wunschgewicht, Prognose oder Tempo im Dokument (keine solchen Codes)', () => {
    const result = buildMonthReviewDocument(review(), {
      onDate: '2026-11-01',
      includeHealthData: true,
    });
    if (!result.ok) throw new Error('erwartet ok');
    const json = JSON.stringify(result.document);
    expect(json).not.toMatch(/target|forecast|perWeek|goal|pregnan|cycle/i);
  });
});

import { addDays, monthReview, MONTH_REVIEW_PARAM_SCHEMAS } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { MONTH_REVIEW_PRINT_TEXTS } from './print-month-review-texts';
import { buildMonthReviewPrint } from './print-month-review';

const review = monthReview({
  month: '2026-10',
  today: '2026-11-02',
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
  logs: [
    {
      id: 'l1',
      planned_session_id: 's1',
      performed_on: '2026-10-05',
      kind: 'strength',
      status: 'completed',
      name_de: 'Ganzkörper A',
      done_sets: 12,
      cardio_duration_s: null,
      cardio_distance_m: null,
    },
  ],
  cardio: [{ date: '2026-10-11', modality: 'run', distanceM: 12_340 }],
  sets: [
    {
      date: '2026-09-02',
      exerciseId: 'sq',
      exerciseName: 'Kniebeuge <b>',
      weightKg: 60,
      reps: 8,
      done: true,
    },
    {
      date: '2026-10-05',
      exerciseId: 'sq',
      exerciseName: 'Kniebeuge <b>',
      weightKg: 62.5,
      reps: 8,
      done: true,
    },
  ],
  food: { entries: [], planDays: [] },
  weight: Array.from({ length: 40 }, (_, i) => ({
    date: addDays('2026-09-25', i),
    weightKg: 82.4 - i * 0.04,
  })),
});

describe('Monatsrückblick als PDF', () => {
  it('jeder Code hat einen deutschen Text', () => {
    expect(Object.keys(MONTH_REVIEW_PRINT_TEXTS).sort()).toEqual(
      Object.keys(MONTH_REVIEW_PARAM_SCHEMAS).sort(),
    );
  });

  it('Standard: Training, Kilometer, Kraft – kein Gewicht, kein Essen; Name der Übung sicher escapt', () => {
    const result = buildMonthReviewPrint({ review, today: '2026-11-02', includeHealthData: false });
    if (!result.ok) throw new Error('erwartet ok');
    expect(result.title).toBe('Alpha5 Monatsrückblick Oktober 2026');
    expect(result.html).toContain('1 von 1 geplanten Einheit gemacht');
    expect(result.html).toContain('12,3 km');
    expect(result.html).toContain('62,5 kg × 8');
    expect(result.html).toContain('Kniebeuge &lt;b&gt;');
    expect(result.html).toContain('Essen und Gewicht sind nicht enthalten');
    expect(result.html).not.toMatch(/Trend am 01.10.2026|eingetragen/);
  });

  it('mit Schalter: Essen als Anzahl und Gewichtstrend mit deutschem Komma', () => {
    const result = buildMonthReviewPrint({ review, today: '2026-11-02', includeHealthData: true });
    if (!result.ok) throw new Error('erwartet ok');
    expect(result.html).toContain('Essen und Gewicht');
    expect(result.html).toMatch(/Trend am 01\.10\.2026: \d+,\d kg, am 31\.10\.2026: \d+,\d kg/);
    expect(result.html).toContain('An 0 von 31 Tagen etwas eingetragen');
    expect(result.html).not.toMatch(/Wunschgewicht|pro Woche|kcal/);
  });
});

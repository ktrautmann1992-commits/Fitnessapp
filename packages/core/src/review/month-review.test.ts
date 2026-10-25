import { describe, expect, it } from 'vitest';

import { MONTH_REVIEW } from '../constants';
import { addDays } from '../dates';
import type { SummaryLog, SummarySession } from '../log/summary';
import {
  monthBounds,
  monthOf,
  monthReview,
  monthReviewOffer,
  type MonthReviewInput,
  type MonthReviewSet,
  shiftMonth,
} from './month-review';

function session(id: string, date: string, extra: Partial<SummarySession> = {}): SummarySession {
  return {
    id,
    scheduled_on: date,
    original_date: null,
    status: 'planned',
    kind: 'strength',
    name_de: 'Ganzkörper A',
    plan_active: true,
    ...extra,
  };
}

function log(id: string, sessionId: string | null, date: string, extra: Partial<SummaryLog> = {}) {
  return {
    id,
    planned_session_id: sessionId,
    performed_on: date,
    kind: 'strength',
    status: 'completed',
    name_de: 'Ganzkörper A',
    done_sets: 10,
    cardio_duration_s: null,
    cardio_distance_m: null,
    ...extra,
  } satisfies SummaryLog;
}

const empty: Omit<MonthReviewInput, 'month' | 'today'> = {
  sessions: [],
  logs: [],
  cardio: [],
  sets: [],
  food: null,
  weight: null,
};

function set(
  date: string,
  exerciseId: string,
  weightKg: number | null,
  reps: number | null,
  done = true,
): MonthReviewSet {
  return { date, exerciseId, exerciseName: `Übung ${exerciseId}`, weightKg, reps, done };
}

describe('Monate', () => {
  it('monthBounds: Februar im Schaltjahr und sonst, 31-Tage-Monate, Dezember', () => {
    expect(monthBounds('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' });
    expect(monthBounds('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' });
    expect(monthBounds('2026-10')).toEqual({ first: '2026-10-01', last: '2026-10-31' });
    expect(monthBounds('2026-12')).toEqual({ first: '2026-12-01', last: '2026-12-31' });
    expect(() => monthBounds('2026-13')).toThrow();
  });

  it('shiftMonth über den Jahreswechsel', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-10', -13)).toBe('2025-09');
    expect(monthOf('2026-10-25')).toBe('2026-10');
  });

  it('monthReviewOffer: am 1. bis 7. für den Vormonat, bis er geöffnet wurde', () => {
    expect(monthReviewOffer('2026-11-01', null)).toBe('2026-10');
    expect(monthReviewOffer(`2026-11-0${MONTH_REVIEW.offerDays}`, '2026-09')).toBe('2026-10');
    expect(monthReviewOffer('2026-11-08', null)).toBeNull();
    expect(monthReviewOffer('2026-11-03', '2026-10')).toBeNull();
    expect(monthReviewOffer('2027-01-01', null)).toBe('2026-12');
  });
});

describe('monthReview – Training', () => {
  const sessions = [
    session('a', '2026-10-05'),
    session('b', '2026-10-07'),
    session('c', '2026-10-09'), // verpasst
    session('d', '2026-10-12', { status: 'skipped' }), // gestrichen: zählt nicht
    session('e', '2026-10-28'), // noch offen
    session('f', '2026-09-30'), // Vormonat
    session('g', '2026-10-14', { plan_active: false }), // entfallen (alter Plan)
  ];
  const logs = [
    log('l1', 'a', '2026-10-05'),
    log('l2', 'b', '2026-10-07', { status: 'partial' }),
    log('l3', null, '2026-10-10', { is_free: true }),
    log('l4', 'f', '2026-09-30'),
  ];

  it('gemacht, geplant, verpasst, offen und frei – nur Tage des Monats', () => {
    const review = monthReview({ ...empty, month: '2026-10', today: '2026-10-25', sessions, logs });
    expect(review.timing).toBe('current');
    expect(review.training).toEqual({ done: 2, planned: 4, missed: 1, open: 1, free: 1 });
    expect(review.empty).toBe(false);
  });

  it('vergangener Monat: offene Einheiten sind verpasst', () => {
    const review = monthReview({ ...empty, month: '2026-10', today: '2026-11-02', sessions, logs });
    expect(review.timing).toBe('past');
    expect(review.training).toMatchObject({ done: 2, planned: 4, missed: 2, open: 0 });
  });

  it('Monat in der Zukunft: nichts gezählt', () => {
    const review = monthReview({ ...empty, month: '2026-12', today: '2026-10-25', sessions, logs });
    expect(review.timing).toBe('future');
    expect(review.training.planned).toBe(0);
    expect(review.empty).toBe(true);
  });

  it('ganz ohne Daten: leer', () => {
    expect(monthReview({ ...empty, month: '2026-10', today: '2026-10-25' }).empty).toBe(true);
  });

  it('1 Trainingstag vs. 7 Trainingstage je Woche', () => {
    const one = [session('x', '2026-10-06')];
    const seven = Array.from({ length: 7 }, (_, i) => session(`s${i}`, addDays('2026-10-05', i)));
    expect(
      monthReview({ ...empty, month: '2026-10', today: '2026-11-01', sessions: one }).training
        .planned,
    ).toBe(1);
    const review = monthReview({
      ...empty,
      month: '2026-10',
      today: '2026-11-01',
      sessions: seven,
      logs: seven.map((s, i) => log(`l${i}`, s.id, s.scheduled_on)),
    });
    expect(review.training).toMatchObject({ done: 7, planned: 7, missed: 0 });
  });
});

describe('monthReview – Kilometer je Sportart', () => {
  it('summiert je Sportart, rundet auf 0,1 km, sortiert absteigend, ohne Null und außerhalb des Monats', () => {
    const review = monthReview({
      ...empty,
      month: '2026-10',
      today: '2026-10-25',
      cardio: [
        { date: '2026-10-02', modality: 'run', distanceM: 5040 },
        { date: '2026-10-09', modality: 'run', distanceM: 10_000 },
        { date: '2026-10-10', modality: 'bike', distanceM: 32_449 },
        { date: '2026-10-11', modality: 'swim', distanceM: null },
        { date: '2026-10-12', modality: 'walk', distanceM: 0 },
        { date: '2026-09-30', modality: 'run', distanceM: 8000 },
      ],
    });
    expect(review.distances).toEqual([
      { modality: 'bike', km: 32.4 },
      { modality: 'run', km: 15 },
    ]);
  });
});

describe('monthReview – Kraft', () => {
  it('Top-Steigerungen gegenüber früheren Einträgen (geschätztes Maximum), höchstens 3', () => {
    const sets = [
      set('2026-09-10', 'squat', 60, 8),
      set('2026-10-20', 'squat', 65, 8), // +8 %
      set('2026-09-10', 'bench', 40, 8),
      set('2026-10-20', 'bench', 40, 10), // +5 %
      set('2026-09-10', 'row', 50, 8),
      set('2026-10-20', 'row', 52.5, 8), // +5 %
      set('2026-09-10', 'press', 30, 8),
      set('2026-10-20', 'press', 31, 8), // +3,3 %
      set('2026-09-10', 'curl', 12, 10),
      set('2026-10-20', 'curl', 12, 10), // gleich
    ];
    const review = monthReview({ ...empty, month: '2026-10', today: '2026-10-25', sets });
    expect(review.strength.map((s) => s.exerciseId)).toEqual(['squat', 'bench', 'row']);
    expect(review.strength[0]).toMatchObject({
      before: { weightKg: 60, reps: 8 },
      best: { weightKg: 65, reps: 8 },
    });
  });

  it('ohne frühere Einträge, ohne Gewicht, über 12 Wdh. oder nicht abgehakt: keine Steigerung', () => {
    const sets = [
      set('2026-10-01', 'new', 50, 8),
      set('2026-09-01', 'bw', null, 12),
      set('2026-10-01', 'bw', null, 15),
      set('2026-09-01', 'high', 20, 10),
      set('2026-10-01', 'high', 20, 20),
      set('2026-09-01', 'undone', 20, 8),
      set('2026-10-01', 'undone', 30, 8, false),
      set('2026-09-01', 'later', 20, 8),
      set('2026-11-01', 'later', 30, 8),
    ];
    expect(monthReview({ ...empty, month: '2026-10', today: '2026-11-05', sets }).strength).toEqual(
      [],
    );
  });

  it('unter 1 % zählt nicht', () => {
    const sets = [set('2026-09-01', 'x', 100, 5), set('2026-10-01', 'x', 100.5, 5)];
    expect(monthReview({ ...empty, month: '2026-10', today: '2026-10-25', sets }).strength).toEqual(
      [],
    );
  });
});

describe('monthReview – Essen (nur Anzahlen)', () => {
  it('Tage mit Einträgen und abgehakte Mahlzeiten nur über vergangene Tage', () => {
    const review = monthReview({
      ...empty,
      month: '2026-10',
      today: '2026-10-04',
      food: {
        entries: [
          {
            date: '2026-10-01',
            kcal: 500,
            protein_g: 20,
            carbs_g: 50,
            fat_g: 10,
            source: 'plan_item',
            slot: 'breakfast',
          },
          {
            date: '2026-10-01',
            kcal: 300,
            protein_g: 20,
            carbs_g: 50,
            fat_g: 10,
            source: 'quick',
            slot: 'lunch',
          },
          {
            date: '2026-10-03',
            kcal: 400,
            protein_g: 20,
            carbs_g: 50,
            fat_g: 10,
            source: 'plan_item',
            slot: 'dinner',
          },
          {
            date: '2026-10-04',
            kcal: 400,
            protein_g: 20,
            carbs_g: 50,
            fat_g: 10,
            source: 'plan_item',
            slot: 'dinner',
          },
        ],
        planDays: [
          { date: '2026-10-01', slots: ['breakfast', 'lunch', 'dinner'] },
          { date: '2026-10-02', slots: ['breakfast', 'lunch', 'dinner'] },
          { date: '2026-10-04', slots: ['dinner'] },
        ],
      },
    });
    expect(review.food).toEqual({
      kind: 'counts',
      days: 3,
      entryDays: 2,
      meals: { eaten: 1, planned: 6 },
    });
    expect(JSON.stringify(review.food)).not.toContain('kcal');
  });

  it('ohne Tagebuch: nicht verfügbar', () => {
    expect(monthReview({ ...empty, month: '2026-10', today: '2026-10-25' }).food).toEqual({
      kind: 'unavailable',
    });
  });

  it('ohne Essensplan: keine Mahlzeiten-Zahl', () => {
    const review = monthReview({
      ...empty,
      month: '2026-10',
      today: '2026-10-25',
      food: { entries: [], planDays: [] },
    });
    expect(review.food).toMatchObject({ kind: 'counts', entryDays: 0, meals: null });
  });
});

describe('monthReview – Gewicht', () => {
  it('ohne Freigabe (null): ausgeblendet', () => {
    expect(monthReview({ ...empty, month: '2026-10', today: '2026-10-25' }).weight).toEqual({
      kind: 'hidden',
    });
  });

  it('Trend am Anfang und Ende des Monats', () => {
    const weight = Array.from({ length: 40 }, (_, i) => ({
      date: addDays('2026-09-20', i),
      weightKg: 80 - i * 0.05,
    }));
    const review = monthReview({ ...empty, month: '2026-10', today: '2026-11-03', weight });
    expect(review.weight.kind).toBe('trend');
    if (review.weight.kind !== 'trend') return;
    expect(review.weight.changeKg).toBeLessThan(0);
    expect(review.weight.values).toBe(29);
  });

  it('ein Wert im Monat bzw. Neustart im Monat: zu wenige Werte', () => {
    expect(
      monthReview({
        ...empty,
        month: '2026-10',
        today: '2026-10-25',
        weight: [{ date: '2026-10-05', weightKg: 70 }],
      }).weight,
    ).toEqual({ kind: 'too_few' });
    expect(
      monthReview({
        ...empty,
        month: '2026-10',
        today: '2026-10-31',
        weight: [
          { date: '2026-10-01', weightKg: 72 },
          { date: '2026-10-31', weightKg: 70 },
        ],
      }).weight,
    ).toEqual({ kind: 'too_few' });
  });
});

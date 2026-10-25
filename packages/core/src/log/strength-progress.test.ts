/**
 * Kraft-Entwicklung je Übung (Gründer-Freigabe 25.10.2026, KONZEPT 11.4): Kennzahlen je Einheit, Zeiträume,
 * Vergleich „gegenüber vor 4 Wochen“, Übersicht. Grenzfälle: leerer Verlauf, eine Einheit, Erholungswochen, Wechsel der
 * Belastungsart, eigenes Körpergewicht, Halteübung, mehrere Einheiten an einem Tag, ungültige Werte, Zukunft.
 */
import { describe, expect, it } from 'vitest';

import { STRENGTH_PROGRESS } from '../constants';
import { addDays } from '../dates';
import type { LoadType } from '../enums';
import {
  defaultStrengthMetric,
  type StrengthLogEntry,
  strengthComparison,
  strengthMetricsAvailable,
  strengthOverview,
  strengthRangeStart,
  strengthSeries,
  strengthSessionIndex,
  strengthSessions,
  strengthSparkline,
} from './strength-progress';
import type { LoggedSet } from './types';

const TODAY = '2026-10-25';

function set(
  reps: number | null,
  weightKg: number | null,
  done = true,
  durationS: number | null = null,
): LoggedSet {
  return { reps, weightKg, durationS, rpe: null, done };
}

function entry(
  performedOn: string,
  sets: LoggedSet[],
  extra: Partial<StrengthLogEntry> = {},
): StrengthLogEntry {
  return {
    exerciseId: 'kniebeuge',
    performedOn,
    loggedAt: `${performedOn}T18:00:00.000Z`,
    status: 'done',
    loadType: 'weight',
    isDeload: false,
    sets,
    ...extra,
  };
}

/** Kniebeuge jede Woche +2,5 kg (3 × 8), Woche 5 Erholungswoche (−20 %). */
function squatHistory(weeks: number): StrengthLogEntry[] {
  return Array.from({ length: weeks }, (_, i) => {
    const deload = i === 4;
    const kg = deload ? 48 : 60 + 2.5 * i;
    return entry(addDays(TODAY, -7 * (weeks - 1 - i)), [set(8, kg), set(8, kg), set(8, kg)], {
      isDeload: deload,
    });
  });
}

describe('strengthSessions: Kennzahlen je Einheit', () => {
  it('leerer Verlauf → keine Einheiten, keine Kennzahl, kein Vergleich, leere Kurve', () => {
    const sessions = strengthSessions('kniebeuge', []);
    expect(sessions).toEqual([]);
    expect(strengthMetricsAvailable(sessions)).toEqual([]);
    expect(defaultStrengthMetric(sessions)).toBeNull();
    expect(strengthComparison(sessions, 0)).toEqual({ kind: 'none' });
    const series = strengthSeries(sessions, 'weight', 'all', TODAY);
    expect(series).toEqual({ metric: 'weight', points: [], min: null, max: null });
    expect(strengthSparkline(series)).toEqual([]);
  });

  it('schwerster Satz (bei Gleichstand mehr Wdh.), Volumen und Wdh. nur aus abgehakten Sätzen', () => {
    const [s] = strengthSessions('kniebeuge', [
      entry(TODAY, [set(10, 50), set(8, 60), set(9, 60), set(12, 80, false), set(5, 0)]),
    ]);
    expect(s).toMatchObject({
      sets: 4,
      topWeightKg: 60,
      topReps: 9,
      volumeKg: 10 * 50 + 8 * 60 + 9 * 60,
      totalReps: 10 + 8 + 9 + 5,
      longestHoldS: null,
    });
  });

  it('übersprungen, ohne abgehakten Satz oder andere Übung → kein Punkt; ungültige Werte zählen nicht', () => {
    const sessions = strengthSessions('kniebeuge', [
      entry(TODAY, [set(8, 60)], { status: 'skipped' }),
      entry(TODAY, [set(8, 60, false)]),
      entry(TODAY, [set(8, 60)], { exerciseId: 'bankdruecken' }),
      entry(TODAY, [set(Number.NaN, 60), set(8, -5), set(8, Number.POSITIVE_INFINITY)]),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ topWeightKg: null, volumeKg: null, totalReps: 16 });
  });

  it('chronologisch (Datum, dann Uhrzeit) – nie nach Wert; zwei Einheiten am selben Tag bleiben getrennt', () => {
    const sessions = strengthSessions('kniebeuge', [
      entry('2026-10-20', [set(5, 100)], { loggedAt: '2026-10-20T19:00:00.000Z' }),
      entry('2026-10-20', [set(5, 40)], { loggedAt: '2026-10-20T07:00:00.000Z' }),
      entry('2026-10-01', [set(5, 120)]),
    ]);
    expect(sessions.map((s) => s.topWeightKg)).toEqual([120, 40, 100]);
    expect(
      strengthSessionIndex(sessions, {
        performedOn: '2026-10-20',
        loggedAt: '2026-10-20T19:00:00.000Z',
      }),
    ).toBe(2);
    expect(strengthSessionIndex(sessions, { performedOn: '2026-10-21', loggedAt: 'x' })).toBe(-1);
  });

  it('eigenes Körpergewicht: Wiederholungen statt Gewicht (kein Gewicht, kein Volumen)', () => {
    const pushups = [
      entry('2026-10-01', [set(10, null), set(8, null)], { loadType: 'bodyweight' }),
      entry('2026-10-22', [set(14, null), set(12, null)], { loadType: 'bodyweight' }),
    ];
    const sessions = strengthSessions('kniebeuge', pushups);
    expect(strengthMetricsAvailable(sessions)).toEqual(['reps']);
    expect(defaultStrengthMetric(sessions)).toBe('reps');
    expect(strengthComparison(sessions, 1)).toMatchObject({
      kind: 'change',
      metric: 'reps',
      current: 26,
      reference: 18,
      delta: 8,
      weeksAgo: 3,
    });
  });

  it('Halteübung: längste Haltezeit', () => {
    const plank = [
      entry('2026-10-01', [set(null, null, true, 30), set(null, null, true, 40)], {
        loadType: 'time',
      }),
      entry('2026-10-15', [set(null, null, true, 45)], { loadType: 'time' }),
    ];
    const sessions = strengthSessions('kniebeuge', plank);
    expect(defaultStrengthMetric(sessions)).toBe('time');
    expect(strengthSeries(sessions, 'time', 'all', TODAY).points.map((p) => p.value)).toEqual([
      40, 45,
    ]);
  });
});

describe('strengthSeries: Zeiträume 4W / 3M / Alles', () => {
  const sessions = strengthSessions('kniebeuge', squatHistory(20));

  it('Grenzen tagesgenau einschließlich heute; Zukunft nie', () => {
    expect(strengthRangeStart('4w', TODAY)).toBe(addDays(TODAY, -27));
    expect(strengthRangeStart('3m', TODAY)).toBe(addDays(TODAY, -90));
    expect(strengthRangeStart('all', TODAY)).toBeNull();
    expect(strengthSeries(sessions, 'weight', '4w', TODAY).points).toHaveLength(4);
    expect(strengthSeries(sessions, 'weight', '3m', TODAY).points).toHaveLength(13);
    expect(strengthSeries(sessions, 'weight', 'all', TODAY).points).toHaveLength(20);
    const future = strengthSessions('kniebeuge', [entry(addDays(TODAY, 1), [set(5, 200)])]);
    expect(strengthSeries(future, 'weight', 'all', TODAY).points).toEqual([]);
    expect(STRENGTH_PROGRESS.rangeDays).toEqual({ '4w': 28, '3m': 91 });
  });

  it('Erholungswoche bleibt sichtbar (gekennzeichnet); min/max und Mini-Kurve 0–1', () => {
    const series = strengthSeries(sessions, 'weight', 'all', TODAY);
    expect(series.points.filter((p) => p.isDeload)).toHaveLength(1);
    expect(series.min).toBe(48);
    expect(series.max).toBe(60 + 2.5 * 19);
    const spark = strengthSparkline(series);
    expect(Math.min(...spark)).toBe(0);
    expect(Math.max(...spark)).toBe(1);
    // Gleicher Wert überall → Mitte.
    const flat = strengthSessions('kniebeuge', [
      entry('2026-10-01', [set(5, 50)]),
      entry('2026-10-08', [set(5, 50)]),
    ]);
    expect(strengthSparkline(strengthSeries(flat, 'weight', 'all', TODAY))).toEqual([0.5, 0.5]);
  });

  it('Wechsel der Belastungsart beginnt ein neues Teilstück', () => {
    const mixed = strengthSessions('kniebeuge', [
      entry('2026-09-01', [set(12, null)], { loadType: 'bodyweight' }),
      entry('2026-09-08', [set(10, 20)]),
      entry('2026-09-15', [set(10, 22)]),
    ]);
    const reps = strengthSeries(mixed, 'reps', 'all', TODAY);
    expect(reps.points.map((p) => p.startsSegment)).toEqual([false, true, false]);
    // Gewicht gibt es erst ab der zweiten Einheit – kein künstlicher Bruch davor.
    expect(
      strengthSeries(mixed, 'weight', 'all', TODAY).points.map((p) => p.startsSegment),
    ).toEqual([false, false]);
    expect(defaultStrengthMetric(mixed)).toBe('weight');
  });
});

describe('strengthComparison: „gegenüber vor 4 Wochen“ – neutral, nur eigene Werte', () => {
  it('Bezug = letzte Einheit, die mindestens 4 Wochen zurückliegt', () => {
    const sessions = strengthSessions('kniebeuge', squatHistory(10));
    const last = sessions.length - 1;
    expect(strengthComparison(sessions, last)).toEqual({
      kind: 'change',
      metric: 'weight',
      current: 60 + 2.5 * 9,
      reference: 60 + 2.5 * 5,
      referenceOn: addDays(TODAY, -28),
      delta: 10,
      weeksAgo: 4,
    });
    expect(strengthComparison(sessions, last, 'volume')).toMatchObject({ delta: 240 });
  });

  it('eine Einheit → kein Vergleich; erst nach 7 Tagen die früheste als Bezug', () => {
    const one = strengthSessions('kniebeuge', [entry(TODAY, [set(5, 60)])]);
    expect(strengthComparison(one, 0)).toEqual({ kind: 'none' });
    const close = strengthSessions('kniebeuge', [
      entry(addDays(TODAY, -6), [set(5, 55)]),
      entry(TODAY, [set(5, 60)]),
    ]);
    expect(strengthComparison(close, 1)).toEqual({ kind: 'none' });
    const week = strengthSessions('kniebeuge', [
      entry(addDays(TODAY, -14), [set(5, 55)]),
      entry(TODAY, [set(5, 60)]),
    ]);
    expect(strengthComparison(week, 1)).toMatchObject({ kind: 'change', delta: 5, weeksAgo: 2 });
    expect(strengthComparison(week, 5)).toEqual({ kind: 'none' });
  });

  it('Erholungswoche: selbst „bewusst leichter“, nie Bezug für spätere Einheiten', () => {
    const sessions = strengthSessions('kniebeuge', [
      entry('2026-09-20', [set(5, 60)], { isDeload: true }),
      entry('2026-09-27', [set(5, 70)]),
      entry('2026-10-25', [set(5, 72.5)]),
      entry('2026-10-26', [set(5, 50)], { isDeload: true }),
    ]);
    expect(strengthComparison(sessions, 3)).toEqual({ kind: 'deload' });
    expect(strengthComparison(sessions, 2)).toMatchObject({ reference: 70, delta: 2.5 });
  });

  it('andere Belastungsart ist kein Bezug; weniger als vorher heißt „−“, gleich heißt 0', () => {
    const sessions = strengthSessions('kniebeuge', [
      entry('2026-09-01', [set(15, null)], { loadType: 'band' as LoadType }),
      entry('2026-10-01', [set(8, 40)]),
      entry('2026-10-25', [set(8, 37.5)]),
    ]);
    expect(strengthComparison(sessions, 1)).toEqual({ kind: 'none' });
    expect(strengthComparison(sessions, 2)).toMatchObject({ delta: -2.5 });
    const same = strengthSessions('kniebeuge', [
      entry('2026-09-01', [set(8, 40)]),
      entry('2026-10-01', [set(8, 40)]),
    ]);
    expect(strengthComparison(same, 1)).toMatchObject({ delta: 0 });
  });

  it('Kennzahl ohne Wert in der Einheit → kein Vergleich', () => {
    const sessions = strengthSessions('kniebeuge', squatHistory(6));
    expect(strengthComparison(sessions, 5, 'time')).toEqual({ kind: 'none' });
    expect(strengthComparison(sessions, 5, null)).toEqual({ kind: 'none' });
  });
});

describe('strengthOverview: Kachel „Kraft-Entwicklung“', () => {
  it('häufigste Übungen der letzten 3 Monate, mindestens 2 Einheiten, höchstens 3, deterministisch', () => {
    const entries: StrengthLogEntry[] = [
      ...squatHistory(8),
      ...squatHistory(3).map((e) => ({ ...e, exerciseId: 'bankdruecken' })),
      ...squatHistory(3).map((e) => ({ ...e, exerciseId: 'rudern' })),
      ...squatHistory(5).map((e) => ({ ...e, exerciseId: 'kreuzheben' })),
      ...squatHistory(1).map((e) => ({ ...e, exerciseId: 'einmal' })),
      // Alt (vor 3 Monaten) zählt nicht.
      entry('2026-01-05', [set(5, 50)], { exerciseId: 'alt' }),
      entry('2026-01-12', [set(5, 50)], { exerciseId: 'alt' }),
      {
        ...entry('2026-10-01', [set(12, null)], { loadType: 'bodyweight' }),
        exerciseId: 'liegestuetz',
      },
      {
        ...entry('2026-10-20', [set(15, null)], { loadType: 'bodyweight' }),
        exerciseId: 'liegestuetz',
      },
    ];
    const items = strengthOverview(entries, TODAY);
    expect(items.map((i) => i.exerciseId)).toEqual(['kniebeuge', 'kreuzheben', 'bankdruecken']);
    expect(items[0]).toMatchObject({ metric: 'weight', sessions: 8 });
    expect(strengthOverview([...entries].reverse(), TODAY)).toEqual(items);
    const all = strengthOverview(entries, TODAY, { limit: 10 });
    expect(all.map((i) => i.exerciseId)).toEqual([
      'kniebeuge',
      'kreuzheben',
      'bankdruecken',
      'rudern',
      'liegestuetz',
    ]);
    expect(all.find((i) => i.exerciseId === 'liegestuetz')).toMatchObject({
      metric: 'reps',
      comparison: { kind: 'change', delta: 3 },
    });
    expect(strengthOverview([], TODAY)).toEqual([]);
  });
});

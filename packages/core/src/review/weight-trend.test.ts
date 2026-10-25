import { describe, expect, it } from 'vitest';

import { MAX_WEEKLY_WEIGHT_LOSS_FRACTION, WEIGHT_TREND } from '../constants';
import { addDays } from '../dates';
import { type WeightEntry, weightTrend, weightTrendSeries } from './weight-trend';

const TODAY = '2026-10-25';

/** Täglich ein Wert über `days` Tage bis heute, linear mit `kgPerWeek`, optional mit ±`noise` im Wechsel. */
function linear(start: number, kgPerWeek: number, days: number, noise = 0): WeightEntry[] {
  return Array.from({ length: days }, (_, i) => ({
    date: addDays(TODAY, i - days + 1),
    weightKg: start + (kgPerWeek / 7) * i + (i % 2 === 0 ? noise : -noise),
  }));
}

const base = { today: TODAY, goal: null, pregnancy: false } as const;

describe('weightTrendSeries', () => {
  it('erster Wert = Trend; danach 10 % je Tag zum neuen Wert', () => {
    const series = weightTrendSeries(
      [
        { date: '2026-10-01', weightKg: 80 },
        { date: '2026-10-02', weightKg: 70 },
      ],
      TODAY,
    );
    expect(series[0]?.trendKg).toBe(80);
    expect(series[1]?.trendKg).toBeCloseTo(79, 10);
  });

  it('Lücke von 3 Tagen wirkt wie drei Tage Glättung (α = 1 − 0,9³)', () => {
    const series = weightTrendSeries(
      [
        { date: '2026-10-01', weightKg: 80 },
        { date: '2026-10-04', weightKg: 70 },
      ],
      TODAY,
    );
    expect(series[1]?.trendKg).toBeCloseTo(80 - 10 * (1 - 0.9 ** 3), 10);
  });

  it('nach mehr als 28 Tagen Lücke beginnt der Trend neu (neuer Abschnitt)', () => {
    const series = weightTrendSeries(
      [
        { date: '2026-08-01', weightKg: 90 },
        { date: addDays('2026-08-01', WEIGHT_TREND.resetAfterGapDays + 1), weightKg: 80 },
      ],
      TODAY,
    );
    expect(series[1]).toMatchObject({ trendKg: 80, segment: 1 });
  });

  it('genau 28 Tage Lücke: noch derselbe Abschnitt', () => {
    const series = weightTrendSeries(
      [
        { date: '2026-08-01', weightKg: 90 },
        { date: addDays('2026-08-01', WEIGHT_TREND.resetAfterGapDays), weightKg: 80 },
      ],
      TODAY,
    );
    expect(series[1]?.segment).toBe(0);
  });

  it('unsortiert und doppelt: sortiert, je Tag der letzte Wert; Werte nach heute zählen nicht', () => {
    const series = weightTrendSeries(
      [
        { date: '2026-10-03', weightKg: 70 },
        { date: '2026-10-01', weightKg: 71 },
        { date: '2026-10-03', weightKg: 72 },
        { date: '2026-10-26', weightKg: 60 },
      ],
      TODAY,
    );
    expect(series.map((p) => [p.date, p.weightKg])).toEqual([
      ['2026-10-01', 71],
      ['2026-10-03', 72],
    ]);
  });

  it('wirft bei Werten außerhalb 30–300 kg oder ungültigem Datum', () => {
    expect(() => weightTrendSeries([{ date: '2026-10-01', weightKg: 20 }], TODAY)).toThrow();
    expect(() => weightTrendSeries([{ date: '2026-10-01', weightKg: 301 }], TODAY)).toThrow();
    expect(() => weightTrendSeries([{ date: '2026-13-01', weightKg: 70 }], TODAY)).toThrow();
  });
});

describe('weightTrend', () => {
  it('ohne Werte: leer, keine Prognose', () => {
    expect(weightTrend({ ...base, entries: [] })).toMatchObject({
      status: 'empty',
      latest: null,
      rate: null,
      tooFast: false,
      forecast: { kind: 'none', reason: 'no_goal' },
    });
    expect(weightTrend({ ...base, entries: [], goal: { targetWeightKg: 70 } }).forecast).toEqual({
      kind: 'none',
      reason: 'too_few_values',
    });
  });

  it('ein einzelner Wert: Punkt ohne Linie, kein Tempo', () => {
    const trend = weightTrend({ ...base, entries: [{ date: TODAY, weightKg: 75 }] });
    expect(trend.status).toBe('single');
    expect(trend.rate).toBeNull();
  });

  it('nur Werte im Fenster der letzten 90 Tage werden gezeigt; ältere schwingen den Trend ein', () => {
    const entries = [
      { date: addDays(TODAY, -200), weightKg: 90 },
      { date: addDays(TODAY, -60), weightKg: 80 },
      { date: addDays(TODAY, -50), weightKg: 80 },
    ];
    const trend = weightTrend({ ...base, entries });
    expect(trend.points.map((p) => p.date)).toEqual([addDays(TODAY, -60), addDays(TODAY, -50)]);
    // −200 → −60 sind 140 Tage Lücke: Neustart, aber vor dem Fenster → nicht „neu begonnen“.
    expect(trend.restarted).toBe(false);
  });

  it('zu wenige Werte für ein Tempo (4 in 14 Tagen)', () => {
    const entries = linear(80, -0.5, 30).filter((_, i) => i < 10 || i % 4 === 0);
    const trend = weightTrend({ ...base, entries });
    expect(trend.rate).toBeNull();
  });

  it('Abschnitt jünger als 14 Tage: noch kein Tempo (Glättung schwingt ein)', () => {
    const trend = weightTrend({ ...base, entries: linear(80, -0.5, 10) });
    expect(trend.rate).toBeNull();
  });

  it('gleichmäßig −0,5 kg/Woche: Tempo etwa −0,5, Richtung „sinkt“', () => {
    const trend = weightTrend({ ...base, entries: linear(80, -0.5, 60) });
    expect(trend.rate?.direction).toBe('down');
    expect(trend.rate?.kgPerWeek).toBeCloseTo(-0.5, 1);
    expect(trend.tooFast).toBe(false);
  });

  it('Schwankung ±1 kg von Tag zu Tag: Trend glättet, Tempo bleibt nahe der wahren Steigung', () => {
    const trend = weightTrend({ ...base, entries: linear(80, -0.4, 60, 1) });
    expect(trend.rate?.kgPerWeek).toBeGreaterThan(-0.7);
    expect(trend.rate?.kgPerWeek).toBeLessThan(-0.1);
  });

  it('gleichbleibend: „etwa gleich“', () => {
    const trend = weightTrend({ ...base, entries: linear(70, 0, 40) });
    expect(trend.rate?.direction).toBe('stable');
  });

  it('steigend: Richtung „steigt“', () => {
    const trend = weightTrend({ ...base, entries: linear(70, 0.3, 40) });
    expect(trend.rate?.direction).toBe('up');
  });

  it('Prognose bei Wunschgewicht, sinkendem Trend und erlaubtem Tempo', () => {
    const trend = weightTrend({
      ...base,
      entries: linear(80, -0.5, 60),
      goal: { targetWeightKg: 72 },
    });
    expect(trend.forecast.kind).toBe('date');
    if (trend.forecast.kind !== 'date') return;
    expect(trend.forecast.date > TODAY).toBe(true);
    // Trend ~76 kg, 0,5 kg/Woche → etwa 8 Wochen (Glättung hinkt etwas hinterher).
    expect(trend.forecast.weeks).toBeGreaterThan(6);
    expect(trend.forecast.weeks).toBeLessThan(11);
  });

  it('schneller als 1 %/Woche: Hinweis „zu schnell“ und KEINE Prognose', () => {
    const trend = weightTrend({
      ...base,
      entries: linear(80, -1.5, 40),
      goal: { targetWeightKg: 65 },
    });
    expect(-(trend.rate?.fractionPerWeek ?? 0)).toBeGreaterThan(MAX_WEEKLY_WEIGHT_LOSS_FRACTION);
    expect(trend.tooFast).toBe(true);
    expect(trend.forecast).toEqual({ kind: 'none', reason: 'too_fast' });
  });

  it('„zu schnell“ auch ohne Wunschgewicht', () => {
    const trend = weightTrend({ ...base, entries: linear(80, -1.5, 40) });
    expect(trend.tooFast).toBe(true);
    expect(trend.forecast).toEqual({ kind: 'none', reason: 'no_goal' });
  });

  it('Fit im Alter: strengere Grenze 0,5 % → 0,6 kg/Woche bei 75 kg ist schon „zu schnell“', () => {
    const entries = linear(78, -0.6, 40);
    expect(weightTrend({ ...base, entries }).tooFast).toBe(false);
    expect(weightTrend({ ...base, entries, maxWeeklyLossFraction: 0.005 }).tooFast).toBe(true);
  });

  it('lockerere Grenze als 1 % wird abgelehnt', () => {
    expect(() =>
      weightTrend({ ...base, entries: linear(80, -0.5, 40), maxWeeklyLossFraction: 0.02 }),
    ).toThrow();
  });

  it('Richtung passt nicht (steigt trotz Abnehm-Ziel): keine Prognose', () => {
    const trend = weightTrend({
      ...base,
      entries: linear(80, 0.3, 40),
      goal: { targetWeightKg: 75 },
    });
    expect(trend.forecast).toEqual({ kind: 'none', reason: 'direction_mismatch' });
  });

  it('zu langsam bzw. gleichbleibend: keine Prognose', () => {
    const trend = weightTrend({
      ...base,
      entries: linear(80, 0, 40),
      goal: { targetWeightKg: 75 },
    });
    expect(trend.forecast).toEqual({ kind: 'none', reason: 'too_slow' });
  });

  it('weiter als ein Jahr: keine Prognose', () => {
    const trend = weightTrend({
      ...base,
      entries: linear(120, -0.15, 40),
      goal: { targetWeightKg: 70 },
    });
    expect(trend.forecast).toEqual({ kind: 'none', reason: 'too_far' });
  });

  it('Trend am oder unter dem Wunschgewicht: „erreicht“, keine Prognose', () => {
    const trend = weightTrend({
      ...base,
      entries: linear(70, -0.3, 40),
      goal: { targetWeightKg: 72 },
    });
    expect(trend.forecast).toEqual({ kind: 'none', reason: 'reached' });
  });

  it('Schwangerschaft: kein Tempo, kein „zu schnell“, nie eine Prognose', () => {
    const trend = weightTrend({
      ...base,
      entries: linear(80, -1.5, 40),
      goal: { targetWeightKg: 70 },
      pregnancy: true,
    });
    expect(trend.rate).toBeNull();
    expect(trend.tooFast).toBe(false);
    expect(trend.forecast).toEqual({ kind: 'none', reason: 'pregnancy' });
    expect(trend.status).toBe('ready');
  });

  it('letzter Wert älter als 14 Tage: veraltet, kein Tempo, keine Prognose', () => {
    const entries = linear(80, -0.5, 40).map((e) => ({ ...e, date: addDays(e.date, -20) }));
    const trend = weightTrend({ ...base, entries, goal: { targetWeightKg: 70 } });
    expect(trend.stale).toBe(true);
    expect(trend.rate).toBeNull();
    expect(trend.forecast).toEqual({ kind: 'none', reason: 'stale' });
  });

  it('Neustart im Fenster wird gemeldet; Tempo nur aus dem neuen Abschnitt', () => {
    const old = [
      { date: addDays(TODAY, -80), weightKg: 95 },
      { date: addDays(TODAY, -79), weightKg: 95 },
    ];
    const trend = weightTrend({ ...base, entries: [...old, ...linear(80, -0.5, 30)] });
    expect(trend.restarted).toBe(true);
    expect(trend.rate?.kgPerWeek).toBeCloseTo(-0.5, 0);
  });

  it('sehr leicht (40 kg) und sehr schwer (250 kg): Tempo relativ zum Körpergewicht', () => {
    // 0,5 kg/Woche sind bei 40 kg 1,25 % → zu schnell; bei 250 kg 0,2 % → in Ordnung.
    expect(weightTrend({ ...base, entries: linear(42, -0.5, 40) }).tooFast).toBe(true);
    expect(weightTrend({ ...base, entries: linear(250, -0.5, 40) }).tooFast).toBe(false);
  });
});

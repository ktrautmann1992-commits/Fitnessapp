import { describe, expect, it } from 'vitest';

import { DAILY_METRIC_LIMITS } from '../constants';
import { aggregateDailyMetrics } from './daily';
import { dailyMetricImportSchema } from './schema';

describe('aggregateDailyMetrics', () => {
  it('leer → keine Tage', () => {
    expect(aggregateDailyMetrics({})).toEqual([]);
  });

  it('Ruhepuls: Median je Tag (Europe/Berlin), unplausible Werte verworfen', () => {
    const days = aggregateDailyMetrics({
      restingHeartRates: [
        { time: '2026-10-20T04:00:00Z', beatsPerMinute: 52 },
        { time: '2026-10-20T10:00:00Z', beatsPerMinute: 55 },
        { time: '2026-10-20T12:00:00Z', beatsPerMinute: 60 },
        { time: '2026-10-20T13:00:00Z', beatsPerMinute: 200 },
        { time: '2026-10-20T22:30:00Z', beatsPerMinute: 48 }, // = 21.10. in Berlin
      ],
    });
    expect(days).toEqual([
      { day: '2026-10-20', resting_hr_bpm: 55, sleep_min: null, steps: null, hrv_rmssd_ms: null },
      { day: '2026-10-21', resting_hr_bpm: 48, sleep_min: null, steps: null, hrv_rmssd_ms: null },
    ]);
  });

  it('Schlaf: ohne Wachphasen, dem Aufwachtag zugeordnet, Überlappung zählt einmal', () => {
    const days = aggregateDailyMetrics({
      sleepSessions: [
        {
          startTime: '2026-10-19T21:00:00Z',
          endTime: '2026-10-20T05:00:00Z',
          stages: [
            { startTime: '2026-10-19T21:00:00Z', endTime: '2026-10-20T01:00:00Z', stage: 4 },
            { startTime: '2026-10-20T01:00:00Z', endTime: '2026-10-20T01:30:00Z', stage: 1 },
            { startTime: '2026-10-20T01:30:00Z', endTime: '2026-10-20T05:00:00Z', stage: 5 },
          ],
        },
        // gleiche Nacht von einer zweiten Quelle (ohne Phasen) – überlappt fast ganz
        { startTime: '2026-10-19T21:30:00Z', endTime: '2026-10-20T05:00:00Z' },
      ],
    });
    // 21:00–05:00 = 480 min; die Wachphase 01:00–01:30 ist durch die zweite Quelle als Schlaf gedeckt.
    expect(days).toEqual([
      { day: '2026-10-20', resting_hr_bpm: null, sleep_min: 480, steps: null, hrv_rmssd_ms: null },
    ]);
  });

  it('Schlaf nur mit einer Quelle: Wachphasen abgezogen; höchstens 1.440 min', () => {
    const days = aggregateDailyMetrics({
      sleepSessions: [
        {
          startTime: '2026-10-19T21:00:00Z',
          endTime: '2026-10-20T05:00:00Z',
          stages: [
            { startTime: '2026-10-19T21:00:00Z', endTime: '2026-10-20T01:00:00Z', stage: 4 },
            { startTime: '2026-10-20T01:00:00Z', endTime: '2026-10-20T01:30:00Z', stage: 1 },
            { startTime: '2026-10-20T01:30:00Z', endTime: '2026-10-20T05:00:00Z', stage: 3 },
          ],
        },
        { startTime: '2026-10-20T06:00:00Z', endTime: '2026-10-22T06:00:00Z' },
      ],
    });
    expect(days).toEqual([
      { day: '2026-10-20', resting_hr_bpm: null, sleep_min: 240, steps: null, hrv_rmssd_ms: null },
      {
        day: '2026-10-22',
        resting_hr_bpm: null,
        sleep_min: DAILY_METRIC_LIMITS.sleepMin.max,
        steps: null,
        hrv_rmssd_ms: null,
      },
    ]);
  });

  it('Schritte: Aggregat je Tag, unplausibel verworfen; Zeitraum begrenzt; Ergebnis passt zum Schema', () => {
    const days = aggregateDailyMetrics({
      steps: [
        { day: '2026-10-18', count: 4000 },
        { day: '2026-10-19', count: 8123.4 },
        { day: '2026-10-20', count: 150_000 },
        { day: '2026-10-21', count: 0 },
      ],
      restingHeartRates: [{ time: '2026-10-20T10:00:00Z', beatsPerMinute: 58 }],
      from: '2026-10-19',
      to: '2026-10-21',
    });
    expect(days).toEqual([
      { day: '2026-10-19', resting_hr_bpm: null, sleep_min: null, steps: 8123, hrv_rmssd_ms: null },
      { day: '2026-10-20', resting_hr_bpm: 58, sleep_min: null, steps: null, hrv_rmssd_ms: null },
      { day: '2026-10-21', resting_hr_bpm: null, sleep_min: null, steps: 0, hrv_rmssd_ms: null },
    ]);
    for (const d of days) expect(dailyMetricImportSchema.safeParse(d).success).toBe(true);
  });

  it('Tag ohne Werte ist ungültig (Schema)', () => {
    expect(
      dailyMetricImportSchema.safeParse({
        day: '2026-10-20',
        resting_hr_bpm: null,
        sleep_min: null,
        steps: null,
        hrv_rmssd_ms: null,
      }).success,
    ).toBe(false);
    // HRV allein reicht (seit 25.10.2026); außerhalb 5–300 ms ungültig.
    const hrvOnly = { day: '2026-10-20', resting_hr_bpm: null, sleep_min: null, steps: null };
    expect(dailyMetricImportSchema.safeParse({ ...hrvOnly, hrv_rmssd_ms: 42 }).success).toBe(true);
    expect(dailyMetricImportSchema.safeParse({ ...hrvOnly, hrv_rmssd_ms: 4 }).success).toBe(false);
    expect(dailyMetricImportSchema.safeParse({ ...hrvOnly, hrv_rmssd_ms: 301 }).success).toBe(
      false,
    );
  });
});

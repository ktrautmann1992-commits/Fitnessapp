import { describe, expect, it } from 'vitest';

import {
  dailyParts,
  originLabel,
  recentDailyLines,
  thousands,
  zoneMinutes,
} from './wearable-format';

describe('Anzeige der Smartwatch-Daten', () => {
  it('Tausenderpunkt, Herkunft, Zonen in Minuten', () => {
    expect(thousands(8123)).toBe('8.123');
    expect(thousands(123456)).toBe('123.456');
    expect(thousands(12)).toBe('12');
    expect(originLabel('samsung_health')).toBe('Samsung Health');
    expect(originLabel('unbekannt')).toBe('einer Uhr-App');
    expect(zoneMinutes([0, 29, 31, 600, -5])).toEqual([0, 0, 1, 10, 0]);
  });

  it('Tageswerte: nur vorhandene Werte, die letzten 7 Tage, neueste zuerst', () => {
    expect(dailyParts({ steps: 9000, sleep_min: 425, resting_hr_bpm: 52 })).toBe(
      '9.000 Schritte · 7 h 05 min Schlaf · Ruhepuls 52/min',
    );
    expect(dailyParts({ steps: null, sleep_min: null, resting_hr_bpm: 60 })).toBe(
      'Ruhepuls 60/min',
    );
    // HRV (25.10.2026); ältere Zeilen ohne Feld bleiben wie bisher.
    expect(dailyParts({ steps: null, sleep_min: 420, resting_hr_bpm: 55, hrv_rmssd_ms: 61 })).toBe(
      '7 h 00 min Schlaf · Ruhepuls 55/min · HRV 61 ms',
    );
    const row = (day: string) => ({
      user_id: 'u',
      day,
      provider: 'health_connect' as const,
      resting_hr_bpm: null,
      sleep_min: null,
      steps: 100,
      hrv_rmssd_ms: null,
      updated_at: '2026-10-21T00:00:00Z',
    });
    const lines = recentDailyLines(
      [row('2026-10-14'), row('2026-10-15'), row('2026-10-21')],
      '2026-10-21',
    );
    expect(lines.map((l) => l.day)).toEqual(['2026-10-21', '2026-10-15']);
    expect(lines[0]?.text).toBe('21.10.2026: 100 Schritte');
  });
});

import { describe, expect, it } from 'vitest';

import { HEART_RATE_LIMITS, HR_MAX_FORMULA, HR_ZONE_PERCENTS } from '../constants';
import { hrZones, maxHeartRate, summarizeHeartRate, zoneIndex } from './heart-rate';
import { heartRateSummarySchema } from './schema';

const at = (s: number) => new Date(Date.UTC(2026, 9, 20, 7, 0, s)).toISOString();
const window = (seconds: number) => ({ from: at(0), to: at(seconds) });

describe('maxHeartRate (Tanaka 2001)', () => {
  it('Formel 208 − 0,7 × Alter mit Quelle in constants.ts', () => {
    expect(HR_MAX_FORMULA).toEqual({ intercept: 208, ageFactor: 0.7 });
    expect(maxHeartRate(40)).toBe(180);
  });

  it('Grenzfälle Alter: 16 und 90 Jahre (gerundet)', () => {
    expect(maxHeartRate(16)).toBe(197); // 196,8
    expect(maxHeartRate(90)).toBe(145); // 145,0
    expect(maxHeartRate(33)).toBe(185); // 184,9
  });

  it('eigener Wert hat Vorrang, nur im erlaubten Bereich 120–230', () => {
    expect(maxHeartRate(40, 195)).toBe(195);
    expect(maxHeartRate(40, HEART_RATE_LIMITS.maxOverrideBpm.min)).toBe(120);
    expect(maxHeartRate(40, HEART_RATE_LIMITS.maxOverrideBpm.max)).toBe(230);
    expect(maxHeartRate(40, 119)).toBe(180);
    expect(maxHeartRate(40, 231)).toBe(180);
    expect(maxHeartRate(40, 190.5)).toBe(180);
    expect(maxHeartRate(40, null)).toBe(180);
  });

  it('Schätzung bleibt im erlaubten Bereich (sehr alt)', () => {
    expect(maxHeartRate(130)).toBe(120);
  });
});

describe('hrZones / zoneIndex', () => {
  it('fünf Zonen 50–60–70–80–90–100 % HFmax', () => {
    expect(HR_ZONE_PERCENTS).toEqual([50, 60, 70, 80, 90, 100]);
    expect(hrZones(200).bounds).toEqual([100, 120, 140, 160, 180, 200]);
  });

  it('unter 50 % keine Zone, über HFmax Zone 5', () => {
    const zones = hrZones(200);
    expect(zoneIndex(99, zones)).toBeNull();
    expect(zoneIndex(100, zones)).toBe(0);
    expect(zoneIndex(119, zones)).toBe(0);
    expect(zoneIndex(120, zones)).toBe(1);
    expect(zoneIndex(179, zones)).toBe(3);
    expect(zoneIndex(180, zones)).toBe(4);
    expect(zoneIndex(215, zones)).toBe(4);
  });
});

describe('summarizeHeartRate', () => {
  const zones = hrZones(200);

  it('keine Messwerte → null', () => {
    expect(summarizeHeartRate([], zones, window(600))).toBeNull();
  });

  it('ein Messwert: Ø = Max, keine Zeit in Zonen', () => {
    const s = summarizeHeartRate([{ time: at(10), beatsPerMinute: 130 }], zones, window(600));
    expect(s).toEqual({ avg_bpm: 130, max_bpm: 130, zone_s: [0, 0, 0, 0, 0], hf_max_used: 200 });
  });

  it('Zeit je Zone bis zum nächsten Wert; Ø und Max; Ergebnis passt zum Schema', () => {
    const samples = [
      { time: at(0), beatsPerMinute: 110 },
      { time: at(10), beatsPerMinute: 130 },
      { time: at(20), beatsPerMinute: 150 },
      { time: at(30), beatsPerMinute: 170 },
      { time: at(40), beatsPerMinute: 190 },
      { time: at(50), beatsPerMinute: 190 },
    ];
    const s = summarizeHeartRate(samples, zones, window(60));
    expect(s).toEqual({
      avg_bpm: 157,
      max_bpm: 190,
      zone_s: [10, 10, 10, 10, 10],
      hf_max_used: 200,
    });
    expect(heartRateSummarySchema.safeParse(s).success).toBe(true);
  });

  it('Lücken über 30 s zählen nicht; unplausible Werte und Werte außerhalb der Einheit verworfen', () => {
    const samples = [
      { time: at(-5), beatsPerMinute: 150 }, // vor der Einheit
      { time: at(0), beatsPerMinute: 150 },
      { time: at(30), beatsPerMinute: 150 }, // 30 s Lücke zählt noch
      { time: at(61), beatsPerMinute: 150 }, // 31 s Lücke zählt nicht
      { time: at(65), beatsPerMinute: 20 }, // unplausibel
      { time: at(66), beatsPerMinute: 250 }, // unplausibel
      { time: at(70), beatsPerMinute: 150 },
      { time: at(200), beatsPerMinute: 150 }, // nach der Einheit
    ];
    const s = summarizeHeartRate(samples, zones, window(100));
    expect(s?.zone_s).toEqual([0, 0, 39, 0, 0]);
    expect(s?.max_bpm).toBe(150);
  });

  it('Werte nur unterhalb der Zonen: Ø/Max, aber 0 s in allen Zonen', () => {
    const samples = Array.from({ length: 10 }, (_, i) => ({ time: at(i * 5), beatsPerMinute: 80 }));
    const s = summarizeHeartRate(samples, zones, window(60));
    expect(s).toEqual({ avg_bpm: 80, max_bpm: 80, zone_s: [0, 0, 0, 0, 0], hf_max_used: 200 });
  });

  it('12-h-Einheit mit Messwert jede Sekunde: Summe der Zonen nie länger als die Einheit', () => {
    const seconds = 12 * 60 * 60;
    const samples = Array.from({ length: seconds / 7 }, (_, i) => ({
      time: new Date(Date.parse(at(0)) + i * 7000 + 300).toISOString(),
      beatsPerMinute: 100 + (i % 100),
    }));
    const s = summarizeHeartRate(samples, zones, window(seconds));
    expect(s).not.toBeNull();
    const total = (s?.zone_s ?? []).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(seconds);
    expect(heartRateSummarySchema.safeParse(s).success).toBe(true);
  });
});

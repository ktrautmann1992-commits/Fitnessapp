import { describe, expect, it } from 'vitest';

import { HR_RESERVE_ZONES } from '../constants';
import { hrZones, summarizeHeartRate } from '../wearables/heart-rate';
import {
  DEFAULT_PULSE_ZONE_SETTINGS,
  parsePulseZoneSettings,
  pulseZoneRows,
  pulseZonesFor,
  reserveZones,
  restingHeartRateFor,
  zonesForSummary,
} from './heart-zones';

describe('reserveZones (Karvonen)', () => {
  it('Ruhepuls + % der Reserve: HFmax 190, Ruhe 60 → 125/138/151/164/177/190', () => {
    expect(reserveZones(190, 60)).toEqual({ hfMax: 190, bounds: [125, 138, 151, 164, 177, 190] });
  });

  it('Reserve unter 60 /min oder Ruhepuls außerhalb 30–120 → null (dann % HFmax)', () => {
    expect(HR_RESERVE_ZONES.minReserveBpm).toBe(60);
    expect(reserveZones(150, 95)).toBeNull();
    expect(reserveZones(150, 90)).not.toBeNull();
    expect(reserveZones(190, 29)).toBeNull();
    expect(reserveZones(190, 121)).toBeNull();
    expect(reserveZones(190, Number.NaN)).toBeNull();
  });
});

describe('pulseZonesFor', () => {
  it('Standard: Alter 40 → HFmax 180, mit Ruhepuls nach Karvonen', () => {
    const z = pulseZonesFor({ age: 40, settings: DEFAULT_PULSE_ZONE_SETTINGS, restingBpm: 55 });
    expect(z.method).toBe('reserve');
    expect(z.hfMax).toBe(180);
    expect(z.restingBpm).toBe(55);
    expect(z.hfMaxOwn).toBe(false);
    expect(z.bounds[0]).toBe(118); // 55 + 0,5 × 125 = 117,5 → 118
  });

  it('ohne Ruhepuls oder abgeschaltet: % HFmax', () => {
    expect(
      pulseZonesFor({ age: 40, settings: DEFAULT_PULSE_ZONE_SETTINGS, restingBpm: null }),
    ).toEqual({ ...hrZones(180), method: 'hf_max', restingBpm: null, hfMaxOwn: false });
    const off = { hfMaxOverride: null, useRestingHr: false };
    expect(pulseZonesFor({ age: 40, settings: off, restingBpm: 55 }).method).toBe('hf_max');
  });

  it('eigener HFmax hat Vorrang (auch bei 16 und 90 Jahren)', () => {
    const own = { hfMaxOverride: 201, useRestingHr: false };
    expect(pulseZonesFor({ age: 16, settings: own, restingBpm: null })).toMatchObject({
      hfMax: 201,
      hfMaxOwn: true,
    });
    expect(pulseZonesFor({ age: 90, settings: own, restingBpm: null }).hfMax).toBe(201);
    expect(
      pulseZonesFor({ age: 90, settings: DEFAULT_PULSE_ZONE_SETTINGS, restingBpm: null }).hfMax,
    ).toBe(145);
  });

  it('sehr alt mit hohem Ruhepuls: Reserve zu klein → % HFmax', () => {
    // Alter 90 → HFmax 145, Ruhepuls 90 → Reserve 55 < 60.
    expect(
      pulseZonesFor({ age: 90, settings: DEFAULT_PULSE_ZONE_SETTINGS, restingBpm: 90 }).method,
    ).toBe('hf_max');
  });

  it('Zeit je Zone nach Karvonen aus Messwerten (summarizeHeartRate mit den Grenzen)', () => {
    const zones = pulseZonesFor({ age: 40, settings: DEFAULT_PULSE_ZONE_SETTINGS, restingBpm: 60 });
    // Grenzen 120/132/144/156/168/180; 130 /min → Zone 1, 150 → Zone 3.
    const at = (s: number) => new Date(Date.UTC(2026, 9, 20, 7, 0, s)).toISOString();
    const samples = [
      { time: at(0), beatsPerMinute: 130 },
      { time: at(10), beatsPerMinute: 150 },
      { time: at(20), beatsPerMinute: 150 },
    ];
    const summary = summarizeHeartRate(samples, zones, { from: at(0), to: at(30) });
    expect(summary?.zone_s).toEqual([10, 0, 10, 0, 0]);
    expect(summary?.hf_max_used).toBe(180);
  });
});

describe('restingHeartRateFor', () => {
  const today = '2026-10-25';
  const day = (d: string, v: number | null) => ({ day: d, resting_hr_bpm: v });

  it('Median der Uhr-Werte der letzten 14 Tage (mind. 3)', () => {
    expect(
      restingHeartRateFor({
        daily: [
          day('2026-10-25', 52),
          day('2026-10-20', 58),
          day('2026-10-12', 55),
          day('2026-10-11', 90),
        ],
        bodyMetricBpm: 70,
        today,
      }),
    ).toBe(55);
    // Gerade Anzahl: Mittel der beiden mittleren Werte.
    expect(
      restingHeartRateFor({
        daily: [
          day('2026-10-25', 50),
          day('2026-10-24', 52),
          day('2026-10-23', 55),
          day('2026-10-22', 57),
        ],
        bodyMetricBpm: null,
        today,
      }),
    ).toBe(54);
  });

  it('zu wenige Uhr-Werte → Körperdaten, sonst null; unplausible Werte zählen nicht', () => {
    expect(
      restingHeartRateFor({
        daily: [day('2026-10-25', 52), day('2026-10-24', null), day('2026-10-23', 10)],
        bodyMetricBpm: 64,
        today,
      }),
    ).toBe(64);
    expect(restingHeartRateFor({ daily: [], bodyMetricBpm: null, today })).toBeNull();
    expect(restingHeartRateFor({ daily: [], bodyMetricBpm: 200, today })).toBeNull();
  });

  it('Werte nach heute zählen nicht', () => {
    expect(
      restingHeartRateFor({
        daily: [day('2026-10-26', 40), day('2026-10-27', 40), day('2026-10-28', 40)],
        bodyMetricBpm: 61,
        today,
      }),
    ).toBe(61);
  });
});

describe('pulseZoneRows und zonesForSummary', () => {
  it('Tabelle mit Bereichen und Anteilen', () => {
    const rows = pulseZoneRows(hrZones(200), [60, 0, 120, 60, 0]);
    expect(rows[0]).toEqual({ zone: 1, fromBpm: 100, toBpm: 120, seconds: 60, share: 0.25 });
    expect(rows[4]).toEqual({ zone: 5, fromBpm: 180, toBpm: 200, seconds: 0, share: 0 });
  });

  it('ohne Zeit: alle Anteile 0; ungültige Sekunden zählen 0', () => {
    expect(pulseZoneRows(hrZones(180), [0, 0, 0, 0, 0]).every((r) => r.share === 0)).toBe(true);
    expect(pulseZoneRows(hrZones(180), [Number.NaN, -5, 10, 0, 0])[2]?.share).toBe(1);
  });

  it('gespeicherter HFmax + heutiger Ruhepuls', () => {
    const z = zonesForSummary({
      hfMaxUsed: 186,
      settings: DEFAULT_PULSE_ZONE_SETTINGS,
      restingBpm: 56,
    });
    expect(z.method).toBe('reserve');
    expect(z.hfMax).toBe(186);
    expect(
      zonesForSummary({ hfMaxUsed: 186, settings: DEFAULT_PULSE_ZONE_SETTINGS, restingBpm: null })
        .method,
    ).toBe('hf_max');
    expect(
      zonesForSummary({
        hfMaxUsed: 186,
        settings: { hfMaxOverride: 186, useRestingHr: false },
        restingBpm: 56,
      }),
    ).toMatchObject({ method: 'hf_max', hfMaxOwn: true });
  });
});

describe('parsePulseZoneSettings', () => {
  it('gültig → übernommen, kaputt → Standard', () => {
    expect(parsePulseZoneSettings({ hfMaxOverride: 190, useRestingHr: false })).toEqual({
      hfMaxOverride: 190,
      useRestingHr: false,
    });
    expect(parsePulseZoneSettings({ hfMaxOverride: 300, useRestingHr: true })).toEqual(
      DEFAULT_PULSE_ZONE_SETTINGS,
    );
    expect(parsePulseZoneSettings({ hfMaxOverride: 190.5, useRestingHr: true })).toEqual(
      DEFAULT_PULSE_ZONE_SETTINGS,
    );
    expect(parsePulseZoneSettings(null)).toEqual(DEFAULT_PULSE_ZONE_SETTINGS);
    expect(parsePulseZoneSettings({ hfMaxOverride: null, useRestingHr: true, x: 1 })).toEqual(
      DEFAULT_PULSE_ZONE_SETTINGS,
    );
  });
});

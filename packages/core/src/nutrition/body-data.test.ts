import { describe, expect, it } from 'vitest';

import { bodyMassIndex, latestBodyValues } from './body-data';

describe('Neueste Körperdaten je Feld (S6, W6)', () => {
  it('neueste Zeile nur Gewicht, Größe vor 2 Jahren → beide mit eigenem Datum', () => {
    const latest = latestBodyValues([
      { measuredOn: '2024-10-01', heightCm: 172, weightKg: 70, bodyFatPct: 25 },
      { measuredOn: '2026-10-01', weightKg: 68 },
    ]);
    expect(latest.height).toEqual({ value: 172, measuredOn: '2024-10-01' });
    expect(latest.weight).toEqual({ value: 68, measuredOn: '2026-10-01' });
    expect(latest.bodyFat).toEqual({ value: 25, measuredOn: '2024-10-01' });
  });

  it('Reihenfolge der Zeilen egal; bei gleichem Datum gewinnt die spätere Zeile', () => {
    const latest = latestBodyValues([
      { measuredOn: '2026-10-01', weightKg: 68 },
      { measuredOn: '2025-01-01', weightKg: 75, heightCm: 170 },
      { measuredOn: '2026-10-01', weightKg: 69 },
    ]);
    expect(latest.weight).toEqual({ value: 69, measuredOn: '2026-10-01' });
    expect(latest.height?.value).toBe(170);
  });

  it('mit Stichtag: Zeilen nach dem Stichtag zählen nicht (K3)', () => {
    const latest = latestBodyValues(
      [
        { measuredOn: '2026-10-01', heightCm: 180, weightKg: 80 },
        { measuredOn: '2030-01-01', weightKg: 300 },
      ],
      '2026-10-12',
    );
    expect(latest.weight).toEqual({ value: 80, measuredOn: '2026-10-01' });
  });

  it('leer → alles null; ungültige Zeilen werden abgelehnt', () => {
    expect(latestBodyValues([])).toEqual({ height: null, weight: null, bodyFat: null });
    expect(() => latestBodyValues([{ measuredOn: '2026-10-01' }])).toThrow();
    expect(() => latestBodyValues([{ measuredOn: '2026-10-01', weightKg: 29 }])).toThrow();
    expect(() => latestBodyValues([{ measuredOn: '2026-10-01', bodyFatPct: 61 }])).toThrow();
  });
});

describe('BMI', () => {
  it('kg / m²', () => {
    expect(bodyMassIndex(100, 170)).toBeCloseTo(34.602, 3);
  });
});

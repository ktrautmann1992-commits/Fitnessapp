import { describe, expect, it } from 'vitest';

import { CADENCE } from '../constants';
import { averageCadence, cadenceHint, parseCadenceStore } from './cadence';

describe('averageCadence', () => {
  it('Schritte ÷ Minuten, gerundet', () => {
    expect(averageCadence({ steps: 5100, durationS: 1800, sport: 'run' })).toBe(170);
    expect(averageCadence({ steps: 3333, durationS: 1800, sport: 'walk' })).toBe(111);
  });

  it('unplausibel, zu kurz oder ohne Schritte → null', () => {
    expect(CADENCE.minDurationS).toBe(300);
    expect(averageCadence({ steps: 900, durationS: 299, sport: 'run' })).toBeNull();
    expect(averageCadence({ steps: null, durationS: 1800, sport: 'run' })).toBeNull();
    expect(averageCadence({ steps: 0, durationS: 1800, sport: 'run' })).toBeNull();
    // 50 Schritte/min beim Laufen = Uhr abgelegt bzw. Pausen.
    expect(averageCadence({ steps: 1500, durationS: 1800, sport: 'run' })).toBeNull();
    expect(averageCadence({ steps: 7200, durationS: 1800, sport: 'run' })).toBeNull();
    expect(averageCadence({ steps: 6000, durationS: 1800, sport: 'walk' })).toBeNull();
    expect(averageCadence({ steps: 5000, durationS: Number.NaN, sport: 'run' })).toBeNull();
  });
});

describe('cadenceHint', () => {
  it('Laufen: niedrig unter 150, hoch über 185, sonst üblich; Gehen ohne Bewertung', () => {
    expect(cadenceHint(149, 'run')).toBe('low');
    expect(cadenceHint(150, 'run')).toBe('typical');
    expect(cadenceHint(185, 'run')).toBe('typical');
    expect(cadenceHint(186, 'run')).toBe('high');
    expect(cadenceHint(120, 'walk')).toBeNull();
    expect(cadenceHint(Number.NaN, 'run')).toBeNull();
  });
});

describe('parseCadenceStore', () => {
  it('nur gültige Einträge bleiben', () => {
    expect(parseCadenceStore({ a: 170, b: 'x', c: 10, d: 171.5, e: 120 })).toEqual({
      a: 170,
      e: 120,
    });
    expect(parseCadenceStore(null)).toEqual({});
    expect(parseCadenceStore([170])).toEqual({});
  });
});

import { describe, expect, it } from 'vitest';

import {
  cardioPlausibility,
  formatDuration,
  loggedEnduranceMinutes,
  paceSecondsPer100m,
  paceSecondsPerKm,
  speedKmh,
} from './cardio';

describe('Pace und Geschwindigkeit (Abschnitt 5.3)', () => {
  it('5 km in 30 min → 6:00 min/km, 10 km/h', () => {
    expect(paceSecondsPerKm(1800, 5000)).toBe(360);
    expect(formatDuration(360)).toBe('6:00');
    expect(speedKmh(1800, 5000)).toBe(10);
  });

  it('Distanz 0 oder fehlend → null', () => {
    expect(paceSecondsPerKm(1800, 0)).toBeNull();
    expect(paceSecondsPerKm(1800, null)).toBeNull();
    expect(speedKmh(1800, 0)).toBeNull();
    expect(paceSecondsPer100m(1800, null)).toBeNull();
  });

  it('Grenzen: 1 min und 12 h', () => {
    expect(paceSecondsPerKm(60, 200)).toBe(300);
    expect(speedKmh(12 * 3600, 500_000)).toBe(41.7);
    expect(formatDuration(12 * 3600)).toBe('12:00:00');
  });

  it('Schwimmen je 100 m: 1000 m in 20 min → 2:00', () => {
    expect(paceSecondsPer100m(1200, 1000)).toBe(120);
    expect(formatDuration(120)).toBe('2:00');
  });

  it('Warnung knapp über/unter der Grenze (ungerundete Geschwindigkeit)', () => {
    // Laufen 25 km/h: 25 km in 3600 s genau an der Grenze → ok; 1 s schneller → prüfen
    expect(cardioPlausibility('run', 3600, 25_000)).toBe('ok');
    expect(cardioPlausibility('run', 3599, 25_000)).toBe('check_speed');
    expect(cardioPlausibility('walk', 3600, 10_001)).toBe('check_speed');
    expect(cardioPlausibility('bike', 3600, 70_000)).toBe('ok');
    expect(cardioPlausibility('swim', 3600, 8_001)).toBe('check_speed');
    expect(cardioPlausibility('swim', 3600, null)).toBe('ok');
  });
});

describe('loggedEnduranceMinutes (10-%-Bezug mit echten Einträgen)', () => {
  it('ganze Minuten je geplanter Einheit; verwaiste Einträge zählen nicht (H-a)', () => {
    const map = loggedEnduranceMinutes([
      { plannedSessionId: 'a', durationS: 1799 },
      { plannedSessionId: null, durationS: 3600 },
      { plannedSessionId: 'b', durationS: 600 },
    ]);
    expect([...map.entries()]).toEqual([
      ['a', 29],
      ['b', 10],
    ]);
  });

  it('ohne Einträge leer', () => {
    expect(loggedEnduranceMinutes([]).size).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';

import { COMPETITION_PACE, RACE_PREDICTION } from '../constants';
import { addDays } from '../dates';
import { riegelTime } from '../plan/intensity';
import { predictRaceTimes, raceEfforts, raceUncertainty } from './race-prediction';

const today = '2026-10-25';
const run = (daysAgo: number, km: number, paceS: number) => ({
  day: addDays(today, -daysAgo),
  distanceM: km * 1000,
  movingS: km * paceS,
});

describe('Riegel (gemeinsame Formel)', () => {
  it('Exponent 1,06 wie die Wettkampf-Pace; 5 km in 25:00 → 10 km ca. 52:07', () => {
    expect(COMPETITION_PACE.riegelExponent).toBe(1.06);
    expect(Math.round(riegelTime(1500, 5000, 10_000))).toBe(3127);
  });
});

describe('raceEfforts', () => {
  it('nur letzte 8 Wochen, ab 3 km, plausible Pace', () => {
    const efforts = [
      run(0, 5, 300),
      run(55, 5, 300), // Tag 56 von 56 – zählt
      run(56, 5, 300), // davor
      run(3, 2.9, 300), // zu kurz
      run(4, 6, 800), // Gehen (13:20 min/km)
      run(5, 6, 140), // unplausibel schnell
      run(-1, 5, 300), // Zukunft
      { day: today, distanceM: 5000, movingS: 0 },
    ];
    expect(RACE_PREDICTION.windowDays).toBe(56);
    expect(raceEfforts(efforts, today)).toHaveLength(2);
  });
});

describe('raceUncertainty', () => {
  it('3 % bei gleicher Distanz, +4 % je Verdopplung, +2 % bei weniger als 4 Läufen', () => {
    expect(raceUncertainty(1, 5)).toBe(0.03);
    expect(raceUncertainty(2, 5)).toBe(0.07);
    expect(raceUncertainty(0.5, 5)).toBe(0.07);
    expect(raceUncertainty(1, 2)).toBe(0.05);
  });
});

describe('predictRaceTimes', () => {
  it('weniger als 2 Läufe ab 3 km → keine Prognose', () => {
    expect(predictRaceTimes({ efforts: [run(1, 10, 330)], today })).toEqual({
      kind: 'insufficient',
      efforts: 1,
    });
    expect(predictRaceTimes({ efforts: [], today })).toEqual({ kind: 'insufficient', efforts: 0 });
  });

  it('schnellste Prognose zählt; Bereich mit Unsicherheit; gerundet', () => {
    const r = predictRaceTimes({
      efforts: [run(2, 5, 300), run(9, 5, 330), run(16, 8, 320)],
      today,
    });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    const five = r.targets[0];
    expect(five).toMatchObject({ kind: 'ok' });
    if (five?.kind !== 'ok') return;
    // Bester 5-km-Lauf 25:00 → Prognose 25:00 ± 5 % (3 Läufe → +2 %).
    expect(five.prediction).toMatchObject({ target: '5k', seconds: 1500, uncertainty: 0.05 });
    expect(five.prediction.lowS).toBe(1425);
    expect(five.prediction.highS).toBe(1575);
    // 10 km: aus dem 5-km-Lauf 3127 s (auf 10 s gerundet 3130) – schneller als aus 8 km in 42:40.
    const ten = r.targets[1];
    expect(ten?.kind === 'ok' && ten.prediction.seconds).toBe(3130);
    expect(ten?.kind === 'ok' && ten.prediction.basedOn.distanceM).toBe(5000);
  });

  it('Marathon erst ab einem Lauf über 10,5 km (Faktor 4)', () => {
    const short = predictRaceTimes({ efforts: [run(2, 5, 300), run(9, 10, 320)], today });
    expect(short.kind === 'ok' && short.targets[3]).toEqual({
      kind: 'too_short',
      target: 'marathon',
      minEffortM: 10_600,
    });
    const long = predictRaceTimes({ efforts: [run(2, 5, 300), run(9, 12, 330)], today });
    const marathon = long.kind === 'ok' ? long.targets[3] : null;
    expect(marathon?.kind).toBe('ok');
    if (marathon?.kind === 'ok') {
      // Breiter Bereich: 3 % + 4 % × log2(42,195/12) ≈ 10,3 % + 2 % (wenige Läufe).
      expect(marathon.prediction.uncertainty).toBeGreaterThan(0.1);
      expect(marathon.prediction.seconds % 60).toBe(0);
    }
  });

  it('sehr langer Lauf: 5-km-Prognose aus einem Marathon nur bis Faktor 4', () => {
    const r = predictRaceTimes({ efforts: [run(2, 42.195, 360), run(20, 30, 350)], today });
    expect(r.kind === 'ok' && r.targets[0]?.kind).toBe('too_short');
    expect(r.kind === 'ok' && r.targets[3]?.kind).toBe('ok');
  });
});

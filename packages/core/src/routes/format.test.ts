import { describe, expect, it } from 'vitest';

import {
  averagePaceOrSpeedText,
  distanceText,
  durationText,
  paceText,
  speedText,
  splitBars,
  usesSpeed,
} from './format';

describe('Anzeige-Werte einer Strecke', () => {
  it('paceText: min/km, ohne Wert „–“', () => {
    expect(paceText(323)).toBe('5:23 min/km');
    expect(paceText(3600 + 5)).toBe('1:00:05 min/km');
    expect(paceText(null)).toBe('–');
    expect(paceText(0)).toBe('–');
    expect(paceText(Number.NaN)).toBe('–');
  });

  it('speedText: eine Nachkommastelle mit Komma', () => {
    expect(speedText(12.34)).toBe('12,3 km/h');
    expect(speedText(0)).toBe('0,0 km/h');
    expect(speedText(null)).toBe('–');
    expect(speedText(-1)).toBe('–');
  });

  it('distanceText: zwei Nachkommastellen, abgerundet; 0 und ungültig → 0,00 km', () => {
    expect(distanceText(5_239)).toBe('5,23 km');
    expect(distanceText(999)).toBe('0,99 km');
    expect(distanceText(0)).toBe('0,00 km');
    expect(distanceText(Number.NaN)).toBe('0,00 km');
    expect(distanceText(500_000)).toBe('500,00 km');
  });

  it('durationText wie das Tagebuch', () => {
    expect(durationText(59)).toBe('0:59');
    expect(durationText(43_200)).toBe('12:00:00');
  });

  it('Rad in km/h, Laufen und Gehen als Pace', () => {
    expect(usesSpeed('bike')).toBe(true);
    expect(usesSpeed('run')).toBe(false);
    expect(averagePaceOrSpeedText('bike', 3600, 25_000)).toBe('25,0 km/h');
    expect(averagePaceOrSpeedText('run', 1800, 6_000)).toBe('5:00 min/km');
    expect(averagePaceOrSpeedText('walk', 1800, 0)).toBe('–');
  });

  it('splitBars: langsamster Kilometer = 100 %, leer ohne Zeiten, ungültige Werte leer', () => {
    expect(splitBars([])).toEqual([]);
    expect(splitBars([300, 330, 315])).toEqual([
      { km: 1, seconds: 300, share: 300 / 330 },
      { km: 2, seconds: 330, share: 1 },
      { km: 3, seconds: 315, share: 315 / 330 },
    ]);
    expect(splitBars([300, Number.NaN, 0])).toEqual([
      { km: 1, seconds: 300, share: 1 },
      { km: 2, seconds: 0, share: 0 },
      { km: 3, seconds: 0, share: 0 },
    ]);
    expect(splitBars([Number.NaN])).toEqual([{ km: 1, seconds: 0, share: 0 }]);
  });
});

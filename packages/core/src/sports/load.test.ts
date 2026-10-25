import { describe, expect, it } from 'vitest';

import { SPORT_CATALOGUE, SPORT_LOAD } from '../constants';
import { SPORT_IDS } from '../enums';
import { effectiveEffort, sessionTrainingLoad, weeklyTrainingLoad } from './load';

describe('sessionTrainingLoad – Minuten × Anstrengung (Session-RPE)', () => {
  it('Padel 60 min, Anstrengung 6 → 360 Punkte', () => {
    expect(sessionTrainingLoad({ durationS: 3600, effort: 6, sport: 'padel' })).toBe(360);
  });

  it.each(SPORT_IDS)('%s: ohne Angabe übliche Anstrengung der Sportart', (sport) => {
    expect(sessionTrainingLoad({ durationS: 600, effort: null, sport })).toBe(
      10 * SPORT_CATALOGUE[sport].typicalEffort,
    );
  });

  it('Kraft/Ausdauer ohne Angabe → fallbackEffort', () => {
    expect(sessionTrainingLoad({ durationS: 1800, effort: null, sport: null })).toBe(
      30 * SPORT_LOAD.fallbackEffort,
    );
  });

  it('Grenzfälle: ohne Dauer null, Anstrengung 0 → 0, Werte geklemmt, Deckel', () => {
    expect(sessionTrainingLoad({ durationS: null, effort: 5, sport: 'tennis' })).toBeNull();
    expect(sessionTrainingLoad({ durationS: 0, effort: 5, sport: 'tennis' })).toBeNull();
    expect(sessionTrainingLoad({ durationS: -60, effort: 5, sport: 'tennis' })).toBeNull();
    expect(sessionTrainingLoad({ durationS: Number.NaN, effort: 5, sport: 'tennis' })).toBeNull();
    expect(sessionTrainingLoad({ durationS: 3600, effort: 0, sport: 'tennis' })).toBe(0);
    expect(sessionTrainingLoad({ durationS: 60, effort: 15, sport: 'tennis' })).toBe(10);
    expect(sessionTrainingLoad({ durationS: 60, effort: -3, sport: 'tennis' })).toBe(0);
    expect(sessionTrainingLoad({ durationS: 12 * 3600, effort: 10, sport: 'tennis' })).toBe(
      SPORT_LOAD.maxPointsPerSession,
    );
    // 90 s × 5 = 7,5 → 8 (gerundet)
    expect(sessionTrainingLoad({ durationS: 90, effort: 5, sport: null })).toBe(8);
  });

  it('effectiveEffort rundet und klemmt', () => {
    expect(effectiveEffort({ effort: 6.6, sport: null })).toBe(7);
    expect(effectiveEffort({ effort: Number.POSITIVE_INFINITY, sport: 'hiit' })).toBe(
      SPORT_CATALOGUE.hiit.typicalEffort,
    );
  });
});

describe('weeklyTrainingLoad', () => {
  it('Summe; Einheiten ohne Dauer zählen nicht; leere Woche 0', () => {
    expect(
      weeklyTrainingLoad([
        { durationS: 3600, effort: 6, sport: 'padel' },
        { durationS: 1800, effort: 4, sport: null },
        { durationS: null, effort: 9, sport: 'football' },
      ]),
    ).toBe(360 + 120);
    expect(weeklyTrainingLoad([])).toBe(0);
  });

  it('1 vs. 7 Einheiten je Woche: linear', () => {
    const one = { durationS: 2700, effort: 5, sport: 'football' as const };
    expect(weeklyTrainingLoad(Array.from({ length: 7 }, () => one))).toBe(
      7 * weeklyTrainingLoad([one]),
    );
  });
});

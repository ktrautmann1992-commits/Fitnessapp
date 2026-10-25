import { describe, expect, it } from 'vitest';

import { SPORT_CATALOGUE, SPORT_INTENSITY, TRACKED_ROUTE_LIMITS } from '../constants';
import { SPORT_CATEGORIES, SPORT_IDS, TRACKED_ROUTE_SPORTS } from '../enums';
import {
  gpsSports,
  isSportId,
  normalizeSportQuery,
  recentSports,
  searchSports,
  sportByName,
  sportMet,
  sportName,
  sportsByCategory,
} from './catalogue';

describe('SPORT_CATALOGUE', () => {
  it('jede Sportart ist beschrieben, Namen eindeutig, Gruppe gültig', () => {
    expect(Object.keys(SPORT_CATALOGUE).sort()).toEqual([...SPORT_IDS].sort());
    const names = SPORT_IDS.map(sportName);
    expect(new Set(names).size).toBe(names.length);
    for (const id of SPORT_IDS) {
      expect(SPORT_CATEGORIES, id).toContain(SPORT_CATALOGUE[id].category);
    }
  });

  it.each(SPORT_IDS)('%s: MET plausibel (2–13, niedrig ≤ hoch), übliche Anstrengung 0–10', (id) => {
    const def = SPORT_CATALOGUE[id];
    expect(def.met.low).toBeGreaterThanOrEqual(2);
    expect(def.met.high).toBeLessThanOrEqual(13);
    expect(def.met.low).toBeLessThanOrEqual(def.met.high);
    expect(def.typicalEffort).toBeGreaterThanOrEqual(0);
    expect(def.typicalEffort).toBeLessThanOrEqual(10);
    expect(Number.isInteger(def.typicalEffort)).toBe(true);
    expect(def.searchTerms.every((t) => t === t.toLowerCase())).toBe(true);
  });

  it('genau die freigegebenen GPS-Sportarten; GPS-Profil nur und immer bei GPS', () => {
    expect(gpsSports()).toEqual([
      'cross_country_skiing',
      'ski_touring',
      'inline_skating',
      'sup',
      'kayaking',
    ]);
    for (const id of SPORT_IDS) {
      const def = SPORT_CATALOGUE[id];
      if (def.gps) expect(TRACKED_ROUTE_SPORTS, id).toContain(def.gpsProfile);
      else expect(def.gpsProfile, id).toBeNull();
    }
    expect(TRACKED_ROUTE_LIMITS).toBeDefined();
  });

  it('Mannschafts- und Rückschlagsportarten mit Sprints haben hohe Beinbelastung', () => {
    for (const id of [
      'football',
      'handball',
      'basketball',
      'tennis',
      'padel',
      'badminton',
    ] as const) {
      expect(SPORT_CATALOGUE[id].legLoad, id).toBe('high');
    }
    for (const id of ['climbing', 'sup', 'kayaking', 'other'] as const) {
      expect(SPORT_CATALOGUE[id].legLoad, id).toBe('low');
    }
  });

  it('Schwimmen ist KEINE Sportart (bleibt Ausdauer-Art)', () => {
    expect(isSportId('swim')).toBe(false);
    expect(sportByName('Schwimmen')).toBeNull();
  });
});

describe('isSportId / sportByName', () => {
  it('erkennt nur Katalog-Werte', () => {
    expect(isSportId('padel')).toBe(true);
    expect(isSportId('Padel')).toBe(false);
    expect(isSportId(null)).toBe(false);
    expect(isSportId(3)).toBe(false);
  });

  it('Name ↔ Sportart (feste Liste)', () => {
    for (const id of SPORT_IDS) expect(sportByName(sportName(id))).toBe(id);
    expect(sportByName('padel')).toBeNull();
    expect(sportByName('')).toBeNull();
  });
});

describe('searchSports', () => {
  it('leere Suche → alle (Katalog-Reihenfolge)', () => {
    expect(searchSports('')).toEqual([...SPORT_IDS]);
    expect(searchSports('   ')).toEqual([...SPORT_IDS]);
  });

  it('ß, Umlaute und Großschreibung egal', () => {
    expect(searchSports('fuss')[0]).toBe('football');
    expect(searchSports('FUSSBALL')).toEqual(['football']);
    expect(searchSports('Fußball')).toEqual(['football']);
    expect(normalizeSportQuery('  Kajak/Kanu ')).toBe('kajak kanu');
  });

  it('Suchbegriffe: Langlauf, BJJ, Indoor-Cycling, Zumba, Ping Pong', () => {
    expect(searchSports('langlauf')).toEqual(['cross_country_skiing']);
    expect(searchSports('bjj')).toEqual(['judo_bjj']);
    expect(searchSports('indoor')).toEqual(['indoor_cycling']);
    expect(searchSports('zumba')).toEqual(['dancing']);
    expect(searchSports('ping pong')).toEqual(['table_tennis']);
  });

  it('Treffer am Namensanfang vor Treffern im Namen bzw. in Suchbegriffen', () => {
    const tennis = searchSports('tennis');
    expect(tennis[0]).toBe('tennis');
    expect(tennis).toContain('table_tennis');
    expect(tennis).toContain('padel');
    expect(tennis.indexOf('table_tennis')).toBeGreaterThan(0);
  });

  it('nur GPS-Sportarten; kein Treffer → leer', () => {
    expect(searchSports('', { onlyGps: true })).toEqual(gpsSports());
    expect(searchSports('paddeln', { onlyGps: true })).toEqual(['sup', 'kayaking']);
    expect(searchSports('fußball', { onlyGps: true })).toEqual([]);
    expect(searchSports('xyzzy')).toEqual([]);
  });
});

describe('sportsByCategory', () => {
  it('Gruppen in fester Reihenfolge, jede Sportart genau einmal', () => {
    const groups = sportsByCategory();
    expect(groups.map((g) => g.category)).toEqual([...SPORT_CATEGORIES]);
    expect(groups.flatMap((g) => g.sports).sort()).toEqual([...SPORT_IDS].sort());
  });

  it('nur die übergebenen Sportarten; leere Gruppen fehlen', () => {
    expect(sportsByCategory(['padel', 'football', 'sup'])).toEqual([
      { category: 'ball', sports: ['football'] },
      { category: 'racket', sports: ['padel'] },
      { category: 'water', sports: ['sup'] },
    ]);
    expect(sportsByCategory([])).toEqual([]);
  });
});

describe('recentSports', () => {
  const logs = [
    { sport: 'padel' as const, performed_on: '2026-10-20', created_at: '2026-10-20T18:00:00Z' },
    { sport: null, performed_on: '2026-10-24', created_at: '2026-10-24T18:00:00Z' },
    { sport: 'football' as const, performed_on: '2026-10-22', created_at: '2026-10-22T18:00:00Z' },
    { sport: 'padel' as const, performed_on: '2026-10-23', created_at: '2026-10-23T18:00:00Z' },
    { sport: 'sup' as const, performed_on: '2026-10-23', created_at: '2026-10-23T19:00:00Z' },
  ];

  it('neueste zuerst, jede einmal, ohne Kraft/Ausdauer', () => {
    expect(recentSports(logs)).toEqual(['sup', 'padel', 'football']);
  });

  it('Grenze und nur GPS', () => {
    expect(recentSports(logs, { limit: 1 })).toEqual(['sup']);
    expect(recentSports(logs, { onlyGps: true })).toEqual(['sup']);
    expect(recentSports([])).toEqual([]);
  });
});

describe('sportMet – Anstrengung 0–10 → MET', () => {
  it.each(SPORT_IDS)('%s: Grenzen, linear, ohne Angabe hoch, steigend', (id) => {
    const { low, high } = SPORT_CATALOGUE[id].met;
    expect(sportMet(id, 0)).toBe(low);
    expect(sportMet(id, SPORT_INTENSITY.lowEffortMax)).toBe(low);
    expect(sportMet(id, SPORT_INTENSITY.highEffortMin)).toBe(high);
    expect(sportMet(id, 10)).toBe(high);
    expect(sportMet(id, null)).toBe(high);
    let previous = 0;
    for (let effort = 0; effort <= 10; effort++) {
      const met = sportMet(id, effort);
      expect(met).toBeGreaterThanOrEqual(previous);
      expect(met).toBeGreaterThanOrEqual(low);
      expect(met).toBeLessThanOrEqual(high);
      previous = met;
    }
  });

  it('Fußball Anstrengung 5,5 → Mitte 7,0–10,0 = 8,5; NaN → hoch', () => {
    expect(sportMet('football', 5.5)).toBe(8.5);
    expect(sportMet('football', Number.NaN)).toBe(10);
  });
});

import { describe, expect, it } from 'vitest';

import { ENDURANCE_EFFORT, TALK_TEST_BANDS } from '../constants';
import {
  cardioDurationS,
  cardioLogFromInput,
  cardioPlausibility,
  cardioSpeed,
  cardioSpeedKind,
  splitDuration,
  talkTestLevel,
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

describe('Ausdauer-Eintrag im Trainingsmodus (Etappe C2)', () => {
  const input = (overrides: Partial<Parameters<typeof cardioLogFromInput>[0]> = {}) => ({
    modality: 'run' as const,
    hours: 0,
    minutes: 30,
    distanceKm: 5,
    elevationM: null,
    ...overrides,
  });

  it('Live-Anzeige: Laufen/Gehen Pace je km, Rad km/h, Schwimmen je 100 m', () => {
    expect(cardioSpeedKind('run')).toBe('per_km');
    expect(cardioSpeedKind('walk')).toBe('per_km');
    expect(cardioSpeedKind('bike')).toBe('kmh');
    expect(cardioSpeedKind('swim')).toBe('per_100m');
    expect(cardioSpeed('run', 1800, 5000)).toEqual({
      kind: 'per_km',
      paceS: 360,
      kmh: 10,
      check: false,
    });
    expect(cardioSpeed('bike', 3600, 25_300)).toEqual({
      kind: 'kmh',
      paceS: null,
      kmh: 25.3,
      check: false,
    });
    expect(cardioSpeed('swim', 1500, 1000)?.paceS).toBe(150);
  });

  it('ohne Distanz oder Dauer keine Anzeige; zu schnell → nur Warnung', () => {
    expect(cardioSpeed('run', 1800, null)).toBeNull();
    expect(cardioSpeed('run', null, 5000)).toBeNull();
    expect(cardioSpeed('walk', 1800, 6000)?.check).toBe(true);
    expect(cardioSpeed('walk', 1800, 4000)?.check).toBe(false);
  });

  it('Eingabe → cardio-Teil von save_session_log (Komma-Distanz, 0 km = ohne Distanz)', () => {
    expect(
      cardioLogFromInput(input({ hours: 1, minutes: 5, distanceKm: 10.55, elevationM: 120 })),
    ).toEqual({
      ok: true,
      cardio: { modality: 'run', duration_s: 3900, distance_m: 10_550, elevation_m: 120 },
    });
    expect(cardioLogFromInput(input({ distanceKm: 0 }))).toMatchObject({
      ok: true,
      cardio: { distance_m: null },
    });
    expect(cardioLogFromInput(input({ hours: null, minutes: 45, distanceKm: null }))).toMatchObject(
      {
        ok: true,
        cardio: { duration_s: 2700, distance_m: null, elevation_m: null },
      },
    );
  });

  it('Dauer ist Pflicht und liegt zwischen 1 Minute und 12 Stunden', () => {
    expect(cardioLogFromInput(input({ hours: null, minutes: null }))).toEqual({
      ok: false,
      errors: { duration: 'duration_missing' },
    });
    expect(cardioLogFromInput(input({ hours: 0, minutes: 0 }))).toMatchObject({
      errors: { duration: 'duration_range' },
    });
    expect(cardioLogFromInput(input({ hours: 0, minutes: 1 })).ok).toBe(true);
    expect(cardioLogFromInput(input({ hours: 12, minutes: 0 })).ok).toBe(true);
    expect(cardioLogFromInput(input({ hours: 12, minutes: 1 }))).toMatchObject({
      errors: { duration: 'duration_range' },
    });
    expect(cardioLogFromInput(input({ hours: 1, minutes: 60 }))).toMatchObject({
      errors: { duration: 'duration_invalid' },
    });
    expect(cardioLogFromInput(input({ minutes: 1.5 }))).toMatchObject({
      errors: { duration: 'duration_invalid' },
    });
    expect(cardioLogFromInput(input({ minutes: Number.NaN }))).toMatchObject({
      errors: { duration: 'duration_invalid' },
    });
    // Nur Minuten über 59 ohne Stunden: erlaubt (90 Minuten).
    expect(cardioDurationS({ hours: null, minutes: 90 })).toBe(5400);
  });

  it('Distanz und Höhenmeter: unlesbar, negativ oder zu groß → Fehler je Feld', () => {
    expect(cardioLogFromInput(input({ distanceKm: Number.NaN }))).toMatchObject({
      errors: { distance: 'distance_invalid' },
    });
    expect(cardioLogFromInput(input({ distanceKm: -1 }))).toMatchObject({
      errors: { distance: 'distance_invalid' },
    });
    expect(cardioLogFromInput(input({ distanceKm: 500 })).ok).toBe(true);
    expect(cardioLogFromInput(input({ distanceKm: 500.001 }))).toMatchObject({
      errors: { distance: 'distance_range' },
    });
    expect(cardioLogFromInput(input({ elevationM: 10_000 })).ok).toBe(true);
    expect(cardioLogFromInput(input({ elevationM: 10_001 }))).toMatchObject({
      errors: { elevation: 'elevation_range' },
    });
    expect(cardioLogFromInput(input({ elevationM: 12.5 }))).toMatchObject({
      errors: { elevation: 'elevation_invalid' },
    });
  });

  it('Dauer aufteilen (Vorbelegung aus der geplanten Einheit)', () => {
    expect(splitDuration(30 * 60)).toEqual({ hours: 0, minutes: 30 });
    expect(splitDuration(95 * 60)).toEqual({ hours: 1, minutes: 35 });
    expect(splitDuration(0)).toEqual({ hours: 0, minutes: 0 });
  });

  it('Gesprächstest: lockere Ausdauer (bis ENDURANCE_EFFORT.easyMax) heißt „ganze Sätze“', () => {
    expect(TALK_TEST_BANDS.fullSentencesMax).toBeGreaterThanOrEqual(ENDURANCE_EFFORT.easyMax);
    expect(talkTestLevel(0)).toBe('rest');
    expect(talkTestLevel(1)).toBe('full_sentences');
    expect(talkTestLevel(ENDURANCE_EFFORT.easyMax)).toBe('full_sentences');
    expect(talkTestLevel(5)).toBe('short_sentences');
    expect(talkTestLevel(6)).toBe('short_sentences');
    expect(talkTestLevel(7)).toBe('few_words');
    expect(talkTestLevel(8)).toBe('few_words');
    expect(talkTestLevel(9)).toBe('no_talking');
    expect(talkTestLevel(10)).toBe('no_talking');
  });
});

import { describe, expect, it } from 'vitest';

import { STORY_CARD } from '../constants';
import { offset, START } from '../routes/test-helpers';
import {
  enduranceStoryCard,
  extraLoadVolumeKg,
  groupedNumber,
  STORY_CARD_FIELDS,
  STORY_STAT_KEYS,
  strengthStoryCard,
  type StrengthStoryExercise,
} from './story-card';

const on = { showLine: true, showDate: true };
const route = Array.from({ length: 101 }, (_, i) => offset(START, i * 20, 0)); // 2 km

/** Werte, die nie im Bild landen dürfen (Puls, Körpergewicht, Notiz, kcal, Uhrzeit …). */
const SECRET = {
  heartRateBpm: 171,
  bodyWeightKg: 83.4,
  note: 'GEHEIME-NOTIZ',
  notes: 'GEHEIME-NOTIZ',
  kcal: 987,
  cycleDay: 12,
  goalWeightKg: 71,
  placeName: 'Hauptstraße 5',
  userId: 'user-geheim',
};

function deepKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => deepKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      deepKeys(v, out);
    }
  }
  return out;
}

describe('Story-Bild Ausdauer', () => {
  const input = {
    sport: 'run' as const,
    startedAt: '2026-10-19T05:30:00Z',
    day: '2026-10-19',
    durationS: 1_830,
    movingS: 1_800,
    distanceM: 6_000,
    elevationM: 45,
    points: route,
  };

  it('Phase 8: Einheit mit Puls-Zusammenfassung der Uhr – kein Puls, keine Zonen, keine kcal im Bild', () => {
    const watch = {
      avg_bpm: 163,
      max_bpm: 187,
      zone_s: [61, 302, 903, 404, 45],
      hf_max_used: 186,
      kcal: 777,
      heart_rate: { avg_bpm: 163, max_bpm: 187 },
      origin: 'samsung_health',
    };
    const card = enduranceStoryCard({ ...input, ...watch } as typeof input, on);
    const allowed = new Set<string>([...STORY_CARD_FIELDS, 'key', 'value', 'lat', 'lng']);
    for (const key of deepKeys(card)) expect(allowed.has(key), key).toBe(true);
    const json = JSON.stringify({ ...card, line: null });
    for (const secret of ['163', '187', '186', '903', '777', 'samsung', 'bpm', 'zone']) {
      expect(json).not.toContain(secret);
    }
  });

  it('Positivliste: nur erlaubte Felder, keine Uhrzeit, keine fremden Werte', () => {
    const card = enduranceStoryCard({ ...input, ...SECRET } as typeof input, on);
    const allowed = new Set<string>([...STORY_CARD_FIELDS, 'key', 'value', 'lat', 'lng']);
    for (const key of deepKeys(card)) expect(allowed.has(key), key).toBe(true);
    const json = JSON.stringify({ ...card, line: null });
    for (const secret of [
      'GEHEIME',
      'Hauptstraße',
      'user-geheim',
      '171',
      '83,4',
      '83.4',
      '987',
      '05:30',
      '07:30',
    ]) {
      expect(json).not.toContain(secret);
    }
    expect(card.stats.every((s) => (STORY_STAT_KEYS as readonly string[]).includes(s.key))).toBe(
      true,
    );
  });

  it('Werte: Dauer, Pace, Distanz, Höhenmeter mit „ca.“, Datum ohne Uhrzeit (Berlin)', () => {
    const card = enduranceStoryCard(input, on);
    expect(card.date).toBe('2026-10-19');
    expect(card.stats).toEqual([
      { key: 'duration', value: '30:30' },
      { key: 'distance', value: '6,00 km' },
      { key: 'pace', value: '5:00 min/km' },
      { key: 'elevation', value: 'ca. 45 m' },
    ]);
    expect(card.lineState).toBe('shown');
    // Privatzone: erster Punkt der Linie liegt 200 m nach dem Start.
    expect(card.line?.[0]?.lat).toBeCloseTo(offset(START, 200, 0).lat, 6);
  });

  it('Bewegungszeit nur bei mindestens 1 min Unterschied; Rad in km/h', () => {
    const card = enduranceStoryCard(
      { ...input, sport: 'bike', durationS: 3_700, movingS: 3_600, distanceM: 30_000 },
      on,
    );
    expect(card.stats.map((s) => s.key)).toEqual([
      'duration',
      'moving',
      'distance',
      'speed',
      'elevation',
    ]);
    expect(card.stats.find((s) => s.key === 'speed')?.value).toBe('30,0 km/h');
  });

  it('Schalter: ohne Linie, ohne Datum; zu kurz; ohne GPS', () => {
    const hidden = enduranceStoryCard(input, { showLine: false, showDate: false });
    expect(hidden).toMatchObject({ line: null, lineState: 'hidden', date: null });
    const short = enduranceStoryCard({ ...input, points: route.slice(0, 20) }, on);
    expect(short).toMatchObject({ line: null, lineState: 'too_short' });
    const noGps = enduranceStoryCard(
      { ...input, points: null, startedAt: null, distanceM: null, elevationM: null },
      on,
    );
    expect(noGps).toMatchObject({ line: null, lineState: 'none', date: '2026-10-19' });
    expect(noGps.stats.map((s) => s.key)).toEqual(['duration']);
  });
});

describe('Story-Bild Kraft', () => {
  const exercises: StrengthStoryExercise[] = [
    {
      nameDe: 'Kniebeuge',
      loadType: 'weight',
      skipped: false,
      sets: [
        { reps: 8, weightKg: 60, done: true },
        { reps: 8, weightKg: 60, done: true },
        { reps: 8, weightKg: 60, done: false },
      ],
    },
    {
      nameDe: 'Liegestütz',
      loadType: 'bodyweight',
      skipped: false,
      sets: [{ reps: 15, weightKg: null, done: true }],
    },
    {
      nameDe: 'Unterarmstütz',
      loadType: 'time',
      skipped: false,
      sets: [{ reps: null, weightKg: null, done: true }],
    },
    { nameDe: 'Rudern', loadType: 'weight', skipped: true, sets: [] },
  ];

  it('Volumen nur aus Zusatzlast (Gewichtsübungen, abgehakte Sätze) – nie Körpergewicht', () => {
    expect(extraLoadVolumeKg(exercises)).toBe(960);
    expect(extraLoadVolumeKg([{ ...(exercises[1] as StrengthStoryExercise) }])).toBe(0);
    expect(extraLoadVolumeKg([])).toBe(0);
  });

  it('Inhalt: Name, Datum, Dauer, Übungen, Sätze, Volumen; Positivliste', () => {
    const card = strengthStoryCard(
      {
        nameDe: 'Ganzkörper A',
        performedOn: '2026-10-20',
        startedAt: '2026-10-20T16:00:00Z',
        finishedAt: '2026-10-20T16:52:30Z',
        exercises,
        ...SECRET,
      } as Parameters<typeof strengthStoryCard>[0],
      on,
    );
    expect(card).toEqual({
      kind: 'strength',
      title: 'Ganzkörper A',
      date: '2026-10-20',
      stats: [
        { key: 'duration', value: '52:30' },
        { key: 'exercises', value: '3' },
        { key: 'sets', value: '4' },
        { key: 'volume', value: '960 kg' },
      ],
      exerciseNames: ['Kniebeuge', 'Liegestütz', 'Unterarmstütz'],
      moreExercises: 0,
    });
    const allowed = new Set<string>([...STORY_CARD_FIELDS, 'key', 'value']);
    for (const key of deepKeys(card)) expect(allowed.has(key), key).toBe(true);
    expect(JSON.stringify(card)).not.toMatch(/GEHEIME|83|171|987|16:00|18:00/);
  });

  it(`höchstens ${STORY_CARD.maxExerciseNames} Namen, ohne Dauer/Volumen, ohne Datum`, () => {
    const many = Array.from({ length: 8 }, (_, i): StrengthStoryExercise => ({
      nameDe: `Übung ${i + 1}`,
      loadType: 'bodyweight',
      skipped: false,
      sets: [{ reps: 10, weightKg: null, done: true }],
    }));
    const card = strengthStoryCard(
      {
        nameDe: 'Frei',
        performedOn: '2026-10-20',
        startedAt: null,
        finishedAt: null,
        exercises: many,
      },
      { showLine: true, showDate: false },
    );
    expect(card.exerciseNames).toHaveLength(5);
    expect(card.moreExercises).toBe(3);
    expect(card.date).toBeNull();
    expect(card.stats.map((s) => s.key)).toEqual(['exercises', 'sets']);
  });

  it('Tausenderpunkt ohne Intl', () => {
    expect(groupedNumber(0)).toBe('0');
    expect(groupedNumber(12_345)).toBe('12.345');
    expect(groupedNumber(1_234_567.4)).toBe('1.234.567');
    expect(groupedNumber(-5)).toBe('0');
  });
});

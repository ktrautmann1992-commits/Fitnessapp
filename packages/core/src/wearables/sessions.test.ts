import { describe, expect, it } from 'vitest';

import { FREE_SESSION, WEARABLE_SYNC } from '../constants';
import { mapExerciseType, OTHER_TITLE, WEARABLE_OTHER_TITLES } from './exercise-types';
import {
  originFromPackage,
  WEARABLE_NAME_PATTERN,
  wearableImportBatchSchema,
  wearableSessionImportSchema,
  type WearableSessionImport,
} from './schema';
import { assignDuplicates, chunkImportBatches, sessionFromHc } from './sessions';

const record = (over: Partial<Parameters<typeof sessionFromHc>[0]> = {}) => ({
  id: 'hc-1',
  exerciseType: 56,
  startTime: '2026-10-20T05:30:00.000Z',
  endTime: '2026-10-20T06:10:00.000Z',
  dataOrigin: 'com.sec.android.app.shealth',
  ...over,
});

describe('mapExerciseType', () => {
  it('Laufen/Laufband → run, Gehen → walk, Rad/Ergometer → bike, Schwimmen → swim', () => {
    expect(mapExerciseType(56)).toEqual({ group: 'run', nameDe: FREE_SESSION.names.endurance.run });
    expect(mapExerciseType(57).group).toBe('run');
    expect(mapExerciseType(79)).toEqual({ group: 'walk', nameDe: 'Spaziergang' });
    expect(mapExerciseType(8).group).toBe('bike');
    expect(mapExerciseType(9).group).toBe('bike');
    expect(mapExerciseType(73).group).toBe('swim');
    expect(mapExerciseType(74).group).toBe('swim');
  });

  it('Kraft (Krafttraining, Gewichtheben, Calisthenics, Einzelübungen) → freie Kraft-Einheit', () => {
    for (const type of [70, 81, 13, 6, 17, 67]) {
      expect(mapExerciseType(type)).toEqual({
        group: 'strength',
        nameDe: FREE_SESSION.names.strength,
      });
    }
  });

  it('Rest → Sonstige mit deutschem Titel; unbekannte Arten nie verworfen', () => {
    expect(mapExerciseType(83)).toEqual({ group: 'other', nameDe: 'Yoga' });
    expect(mapExerciseType(37)).toEqual({ group: 'other', nameDe: 'Wandern' });
    expect(mapExerciseType(76)).toEqual({ group: 'other', nameDe: 'Tennis' });
    expect(mapExerciseType(0)).toEqual({ group: 'other', nameDe: OTHER_TITLE });
    expect(mapExerciseType(999)).toEqual({ group: 'other', nameDe: OTHER_TITLE });
    expect(mapExerciseType(-1).group).toBe('other');
  });
});

describe('Titel der Einheiten', () => {
  it('alle Titel passen zu WEARABLE_NAME_PATTERN (gleiche Regel in import_wearable_batch)', () => {
    const pattern = new RegExp(WEARABLE_NAME_PATTERN);
    const names = [
      ...Object.values(WEARABLE_OTHER_TITLES),
      OTHER_TITLE,
      FREE_SESSION.names.strength,
      ...Object.values(FREE_SESSION.names.endurance),
    ];
    for (const name of names) {
      expect(name, name).toMatch(pattern);
      expect([...name].length).toBeLessThanOrEqual(WEARABLE_SYNC.nameMaxLength);
    }
    expect('Lauf <script>').not.toMatch(pattern);
    expect(' Lauf').not.toMatch(pattern);
  });
});

describe('originFromPackage', () => {
  it('Samsung Health und andere bekannte Apps, sonst other', () => {
    expect(originFromPackage('com.sec.android.app.shealth')).toBe('samsung_health');
    expect(originFromPackage('com.google.android.apps.fitness')).toBe('google_fit');
    expect(originFromPackage('com.example.app')).toBe('other');
    expect(originFromPackage(null)).toBe('other');
    expect(originFromPackage(undefined)).toBe('other');
  });
});

describe('sessionFromHc', () => {
  it('Lauf mit Distanz, kcal und Puls → gültiger Import-Datensatz', () => {
    const result = sessionFromHc(
      record(),
      {
        distanceM: 6123.6,
        kcal: 412.4,
        heartRateSamples: [
          { time: '2026-10-20T05:30:00Z', beatsPerMinute: 140 },
          { time: '2026-10-20T05:30:10Z', beatsPerMinute: 150 },
        ],
      },
      { hfMax: 190 },
    );
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.session).toMatchObject({
      external_id: 'hc-1',
      origin: 'samsung_health',
      group: 'run',
      name_de: 'Lauf',
      performed_on: '2026-10-20',
      duration_s: 2400,
      distance_m: 6124,
      kcal: 412,
    });
    expect(result.session.heart_rate).toMatchObject({
      avg_bpm: 145,
      max_bpm: 150,
      hf_max_used: 190,
    });
    expect(
      wearableSessionImportSchema.safeParse({
        ...result.session,
        merge_into: null,
        possible_duplicate_of: null,
      }).success,
    ).toBe(true);
  });

  it('Tag = Beginn in Europe/Berlin (kurz vor Mitternacht UTC)', () => {
    const result = sessionFromHc(
      record({ startTime: '2026-10-20T22:30:00Z', endTime: '2026-10-20T23:30:00Z' }),
      {},
      { hfMax: null },
    );
    expect(result.kind === 'ok' && result.session.performed_on).toBe('2026-10-21');
  });

  it('Grenzen: unter 1 min bzw. über 12 h überspringen, genau 1 min und 12 h übernehmen', () => {
    const start = Date.parse('2026-10-20T05:00:00Z');
    const end = (s: number) => new Date(start + s * 1000).toISOString();
    const go = (s: number) =>
      sessionFromHc(record({ startTime: end(0), endTime: end(s) }), {}, { hfMax: null }).kind;
    expect(go(59)).toBe('skip');
    expect(go(60)).toBe('ok');
    expect(go(WEARABLE_SYNC.durationS.max)).toBe('ok');
    expect(go(WEARABLE_SYNC.durationS.max + 1)).toBe('skip');
    expect(sessionFromHc(record({ endTime: 'kaputt' }), {}, { hfMax: null })).toEqual({
      kind: 'skip',
      reason: 'invalid',
    });
    expect(sessionFromHc(record({ id: '' }), {}, { hfMax: null }).kind).toBe('skip');
  });

  it('Kraft und Sonstige ohne Distanz; unplausible Distanz/kcal werden leer', () => {
    const strength = sessionFromHc(
      record({ exerciseType: 70 }),
      { distanceM: 100 },
      { hfMax: null },
    );
    expect(strength.kind === 'ok' && strength.session.distance_m).toBeNull();
    const run = sessionFromHc(record(), { distanceM: 600_000, kcal: -3 }, { hfMax: null });
    expect(run.kind === 'ok' && run.session.distance_m).toBeNull();
    expect(run.kind === 'ok' && run.session.kcal).toBeNull();
  });

  it('ohne HFmax (kein Alter) keine Puls-Zusammenfassung', () => {
    const result = sessionFromHc(
      record(),
      { heartRateSamples: [{ time: '2026-10-20T05:31:00Z', beatsPerMinute: 140 }] },
      { hfMax: null },
    );
    expect(result.kind === 'ok' && result.session.heart_rate).toBeNull();
  });
});

describe('assignDuplicates', () => {
  const base = (id: string, start: string, end: string) => {
    const r = sessionFromHc(record({ id, startTime: start, endTime: end }), {}, { hfMax: null });
    if (r.kind !== 'ok') throw new Error('skip');
    return r.session;
  };

  it('App-Lauf + Uhr-Lauf gleichzeitig → zusammenführen; bekannte external_id nie verknüpfen', () => {
    const a = base('a', '2026-10-20T05:30:00Z', '2026-10-20T06:10:00Z');
    const b = base('b', '2026-10-20T05:31:00Z', '2026-10-20T06:09:00Z');
    const candidate = {
      id: '00000000-0000-4000-8000-000000000001',
      group: 'run' as const,
      performedOn: '2026-10-20',
      startedAt: '2026-10-20T05:30:30Z',
      finishedAt: '2026-10-20T06:10:00Z',
      durationS: 2370,
      linked: false,
    };
    const out = assignDuplicates([a, b], [candidate], new Set(['b']));
    expect(out.find((s) => s.external_id === 'a')?.merge_into).toBe(candidate.id);
    expect(out.find((s) => s.external_id === 'b')).toMatchObject({
      merge_into: null,
      possible_duplicate_of: null,
    });
  });

  it('ein Eintrag wird höchstens einer Uhr-Einheit zugeordnet', () => {
    const a = base('a', '2026-10-20T05:30:00Z', '2026-10-20T06:10:00Z');
    const b = base('b', '2026-10-20T05:31:00Z', '2026-10-20T06:09:00Z');
    const candidate = {
      id: '00000000-0000-4000-8000-000000000001',
      group: 'run' as const,
      performedOn: '2026-10-20',
      startedAt: '2026-10-20T05:30:00Z',
      finishedAt: '2026-10-20T06:10:00Z',
      durationS: 2400,
      linked: false,
    };
    const out = assignDuplicates([a, b], [candidate], new Set());
    const linked = out.filter((s) => s.merge_into !== null || s.possible_duplicate_of !== null);
    expect(linked).toHaveLength(1);
    expect(linked[0]?.external_id).toBe('a');
  });

  it('Batch-Schema: höchstens 500 Einheiten, keine doppelten IDs/Tage/Typen', () => {
    const s: WearableSessionImport = {
      ...base('a', '2026-10-20T05:30:00Z', '2026-10-20T06:10:00Z'),
      merge_into: null,
      possible_duplicate_of: null,
    };
    const ok = { provider: 'health_connect', granted_types: ['exercise'], sessions: [s], days: [] };
    expect(wearableImportBatchSchema.safeParse(ok).success).toBe(true);
    expect(wearableImportBatchSchema.safeParse({ ...ok, sessions: [s, s] }).success).toBe(false);
    expect(
      wearableImportBatchSchema.safeParse({ ...ok, granted_types: ['exercise', 'exercise'] })
        .success,
    ).toBe(false);
    const many = Array.from({ length: WEARABLE_SYNC.maxSessionsPerBatch + 1 }, (_, i) => ({
      ...s,
      external_id: `id-${i}`,
    }));
    expect(wearableImportBatchSchema.safeParse({ ...ok, sessions: many }).success).toBe(false);
    expect(
      wearableImportBatchSchema.safeParse({ ...ok, sessions: many.slice(0, 500) }).success,
    ).toBe(true);
    expect(wearableImportBatchSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });

  it('Import-Schema lehnt Unstimmigkeiten ab (Dauer, Tag, Distanz bei Kraft, Zonen, beide Verweise)', () => {
    const s: WearableSessionImport = {
      ...base('a', '2026-10-20T05:30:00Z', '2026-10-20T06:10:00Z'),
      merge_into: null,
      possible_duplicate_of: null,
    };
    const parse = (over: Partial<WearableSessionImport>) =>
      wearableSessionImportSchema.safeParse({ ...s, ...over }).success;
    expect(parse({})).toBe(true);
    expect(parse({ duration_s: 2399 })).toBe(false);
    expect(parse({ performed_on: '2026-10-19' })).toBe(false);
    expect(parse({ group: 'strength', distance_m: 10 })).toBe(false);
    expect(
      parse({
        heart_rate: { avg_bpm: 140, max_bpm: 150, zone_s: [2400, 1, 0, 0, 0], hf_max_used: 190 },
      }),
    ).toBe(false);
    expect(
      parse({
        heart_rate: { avg_bpm: 160, max_bpm: 150, zone_s: [0, 0, 0, 0, 0], hf_max_used: 190 },
      }),
    ).toBe(false);
    const id = '00000000-0000-4000-8000-000000000001';
    expect(parse({ merge_into: id, possible_duplicate_of: id })).toBe(false);
    expect(parse({ merge_into: 'kein-uuid' })).toBe(false);
  });
});

describe('chunkImportBatches', () => {
  it('leer → ein Aufruf; > 500 Einheiten bzw. > 62 Tage → mehrere', () => {
    expect(chunkImportBatches(['steps'], [], [])).toEqual([
      { provider: 'health_connect', granted_types: ['steps'], sessions: [], days: [] },
    ]);
    const r = sessionFromHc(record(), {}, { hfMax: null });
    if (r.kind !== 'ok') throw new Error('skip');
    const one = { ...r.session, merge_into: null, possible_duplicate_of: null };
    const sessions = Array.from({ length: 1001 }, (_, i) => ({ ...one, external_id: `x${i}` }));
    const days = Array.from({ length: 70 }, (_, i) => ({
      day: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
      resting_hr_bpm: null,
      sleep_min: null,
      steps: i,
      hrv_rmssd_ms: null,
    }));
    const batches = chunkImportBatches(['exercise'], sessions, days);
    expect(batches.map((b) => [b.sessions.length, b.days.length])).toEqual([
      [500, 62],
      [500, 8],
      [1, 0],
    ]);
  });
});

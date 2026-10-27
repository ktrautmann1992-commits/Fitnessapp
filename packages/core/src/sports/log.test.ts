import { describe, expect, it } from 'vitest';

import { FREE_SESSION, SPORT_CATALOGUE } from '../constants';
import { SPORT_IDS } from '../enums';
import { freeSessionPayloadIssue } from '../log/free-session';
import { sessionLogPayloadSchema } from '../log/schemas';
import { OTHER_TITLE } from '../wearables/exercise-types';
import {
  type SportEntryInput,
  sportForLog,
  sportLogDurationS,
  sportSessionLogFromInput,
} from './log';

const TODAY = '2026-10-25';
const ID = '6f1c1e9e-6d0b-4b8a-9a43-6a3f2b1c0d01';
const WRITE = '6f1c1e9e-6d0b-4b8a-9a43-6a3f2b1c0d02';

const PADEL: SportEntryInput = {
  id: ID,
  writeId: WRITE,
  sport: 'padel',
  performedOn: TODAY,
  today: TODAY,
  hours: 1,
  minutes: 0,
  distanceKm: null,
  effort: 6,
  notes: '',
  now: '2026-10-25T18:00:00.000Z',
};

describe('sportSessionLogFromInput', () => {
  it('Padel 60 min → freie Einheit „strength“ ohne Übungen mit Sportart, Zod-gültig', () => {
    const result = sportSessionLogFromInput(PADEL);
    if (!result.ok) throw new Error(result.errors.join());
    expect(result.payload).toMatchObject({
      kind: 'strength',
      name_de: 'Padel',
      is_free: true,
      status: 'completed',
      source: 'manual',
      session_rpe: 6,
      exercises: [],
      cardio: null,
      planned_session_id: null,
      planned_date: TODAY,
      sport: { sport: 'padel', duration_s: 3600, distance_m: null },
    });
    expect(sessionLogPayloadSchema.safeParse(result.payload).success).toBe(true);
    expect(freeSessionPayloadIssue(result.payload, TODAY)).toBeNull();
  });

  it.each(SPORT_IDS)('%s: gültiger Eintrag mit Name aus dem Katalog', (sport) => {
    const gps = SPORT_CATALOGUE[sport].gps;
    const result = sportSessionLogFromInput({ ...PADEL, sport, distanceKm: gps ? 12.3 : null });
    if (!result.ok) throw new Error(result.errors.join());
    expect(result.payload.name_de).toBe(SPORT_CATALOGUE[sport].nameDe);
    expect(result.payload.sport?.distance_m).toBe(gps ? 12_300 : null);
  });

  it('ohne Anstrengung und mit Notiz', () => {
    const result = sportSessionLogFromInput({
      ...PADEL,
      effort: null,
      notes: '  Doppel mit Tom  ',
    });
    expect(result.ok && result.payload.session_rpe).toBeNull();
    expect(result.ok && result.payload.notes).toBe('Doppel mit Tom');
  });

  it('Distanz nur bei GPS-Sportarten; 0 km = ohne Distanz', () => {
    expect(sportSessionLogFromInput({ ...PADEL, distanceKm: 5 })).toEqual({
      ok: false,
      errors: ['distance_not_allowed'],
    });
    const zero = sportSessionLogFromInput({ ...PADEL, sport: 'sup', distanceKm: 0 });
    expect(zero.ok && zero.payload.sport?.distance_m).toBeNull();
    expect(sportSessionLogFromInput({ ...PADEL, sport: 'sup', distanceKm: Number.NaN })).toEqual({
      ok: false,
      errors: ['distance_invalid'],
    });
    expect(sportSessionLogFromInput({ ...PADEL, sport: 'sup', distanceKm: 501 })).toEqual({
      ok: false,
      errors: ['distance_range'],
    });
  });

  it('Dauer: fehlt, ungültig, unter 1 min, über 12 h; Grenzen 1 min und 12 h gültig', () => {
    const errs = (hours: number | null, minutes: number | null) => {
      const r = sportSessionLogFromInput({ ...PADEL, hours, minutes });
      return r.ok ? [] : r.errors;
    };
    expect(errs(null, null)).toEqual(['duration_missing']);
    expect(errs(0, 0)).toEqual(['duration_range']);
    expect(errs(1, 75)).toEqual(['duration_invalid']);
    expect(errs(Number.NaN, 10)).toEqual(['duration_invalid']);
    expect(errs(12, 1)).toEqual(['duration_range']);
    expect(errs(0, 1)).toEqual([]);
    expect(errs(12, 0)).toEqual([]);
    expect(errs(null, 90)).toEqual([]);
  });

  it('Anstrengung nur ganze Zahl 0–10', () => {
    for (const effort of [-1, 11, 2.5, Number.NaN]) {
      expect(sportSessionLogFromInput({ ...PADEL, effort })).toEqual({
        ok: false,
        errors: ['effort_invalid'],
      });
    }
    expect(sportSessionLogFromInput({ ...PADEL, effort: 0 }).ok).toBe(true);
    expect(sportSessionLogFromInput({ ...PADEL, effort: 10 }).ok).toBe(true);
  });

  it('Datum: heute bis 14 Tage zurück, nie in der Zukunft', () => {
    expect(sportSessionLogFromInput({ ...PADEL, performedOn: '2026-10-26' })).toEqual({
      ok: false,
      errors: ['date_future'],
    });
    expect(sportSessionLogFromInput({ ...PADEL, performedOn: '2026-10-10' })).toEqual({
      ok: false,
      errors: ['date_too_old'],
    });
    expect(sportSessionLogFromInput({ ...PADEL, performedOn: '2026-10-11' }).ok).toBe(true);
  });

  it('Notiz höchstens 280 Zeichen; mehrere Fehler gleichzeitig', () => {
    const result = sportSessionLogFromInput({
      ...PADEL,
      notes: 'x'.repeat(281),
      hours: null,
      minutes: null,
      performedOn: '2026-10-30',
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && [...result.errors].sort()).toEqual(
      ['date_future', 'duration_missing', 'notes_too_long'].sort(),
    );
  });

  it('unbekannte Sportart → invalid', () => {
    expect(sportSessionLogFromInput({ ...PADEL, sport: 'curling' as unknown as 'padel' })).toEqual({
      ok: false,
      errors: ['invalid'],
    });
  });

  it('GPS-Aufzeichnung: Beginn und Ende werden übernommen', () => {
    const result = sportSessionLogFromInput({
      ...PADEL,
      sport: 'cross_country_skiing',
      distanceKm: 15,
      startedAt: '2026-10-25T09:00:00.000Z',
      finishedAt: '2026-10-25T10:00:00.000Z',
    });
    expect(result.ok && [result.payload.started_at, result.payload.finished_at]).toEqual([
      '2026-10-25T09:00:00.000Z',
      '2026-10-25T10:00:00.000Z',
    ]);
  });
});

describe('Eintrags-Schema mit Sportart (wie save_session_log)', () => {
  const ok = sportSessionLogFromInput(PADEL);
  if (!ok.ok) throw new Error('Padel ungültig');
  const base = ok.payload;

  it('Sportart nur ohne Übungen/Ausdauer, nur Art strength, nur frei, nur erledigt, nur von Hand', () => {
    const bad = [
      { ...base, kind: 'endurance' as const },
      {
        ...base,
        cardio: { modality: 'run' as const, duration_s: 600, distance_m: null, elevation_m: null },
      },
      { ...base, is_free: false },
      { ...base, is_free: undefined },
      { ...base, status: 'partial' as const },
      { ...base, source: 'health_connect' as const },
      { ...base, sport: { ...base.sport!, distance_m: 100 } },
      { ...base, sport: { ...base.sport!, duration_s: 59 } },
      { ...base, sport: { ...base.sport!, duration_s: 43_201 } },
    ];
    for (const payload of bad)
      expect(sessionLogPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('freie Kraft ohne Sportart braucht weiter Übungen; älterer Eintrag ohne Feld gültig', () => {
    const withoutSport = Object.fromEntries(
      Object.entries(base).filter(([key]) => key !== 'sport'),
    );
    expect(sessionLogPayloadSchema.safeParse(withoutSport).success).toBe(false);
    expect(sessionLogPayloadSchema.safeParse({ ...base, sport: null }).success).toBe(false);
  });

  it('falscher Name → freeSessionPayloadIssue „invalid“', () => {
    expect(freeSessionPayloadIssue({ ...base, name_de: 'Tennis' }, TODAY)).toBe('invalid');
    expect(freeSessionPayloadIssue({ ...base, name_de: FREE_SESSION.names.strength }, TODAY)).toBe(
      'invalid',
    );
  });
});

describe('sportForLog', () => {
  const row = {
    kind: 'strength' as const,
    name_de: 'Padel',
    source: 'manual' as const,
    sport: 'padel' as const,
  };

  it('Spalte sport gilt', () => {
    expect(sportForLog(row)).toBe('padel');
  });

  it('Uhr-Einheit „Sonstige“: Sportart aus dem Titel, frühere Titel, sonst „other“', () => {
    const watch = { kind: 'strength' as const, source: 'health_connect' as const, sport: null };
    expect(sportForLog({ ...watch, name_de: 'Tennis' })).toBe('tennis');
    expect(sportForLog({ ...watch, name_de: 'Fußball' })).toBe('football');
    expect(sportForLog({ ...watch, name_de: 'Paddeln' })).toBe('kayaking');
    expect(sportForLog({ ...watch, name_de: 'Skifahren' })).toBe('alpine_skiing');
    expect(sportForLog({ ...watch, name_de: 'Sonstiges Training' })).toBe('other');
    expect(sportForLog({ ...watch, name_de: OTHER_TITLE })).toBe('other');
    // Sportarten Stufe 1 (Etappe Y): Yoga hat seit Stufe 1 eine eigene Sportart.
    expect(sportForLog({ ...watch, name_de: 'Yoga' })).toBe('yoga');
    expect(sportForLog({ ...watch, name_de: 'Pilates' })).toBe('pilates');
    expect(sportForLog({ ...watch, name_de: 'Dehnen' })).toBe('other');
    expect(sportForLog({ ...watch, name_de: FREE_SESSION.names.strength })).toBeNull();
  });

  it('Kraft und Ausdauer ohne Sportart → null (auch ältere Zeilen ohne Feld)', () => {
    expect(sportForLog({ kind: 'strength', name_de: 'Ganzkörper A', source: 'manual' })).toBeNull();
    expect(
      sportForLog({ kind: 'endurance', name_de: 'Tennis', source: 'health_connect', sport: null }),
    ).toBeNull();
    expect(sportForLog({ kind: 'strength', name_de: 'Tennis', source: 'manual' })).toBeNull();
    expect(
      sportForLog({ ...row, sport: 'curling' as unknown as 'padel', source: 'manual' }),
    ).toBeNull();
  });
});

describe('sportLogDurationS', () => {
  it('erfasste Dauer, sonst Ende − Beginn, sonst null', () => {
    expect(sportLogDurationS({ sport_duration_s: 3600 })).toBe(3600);
    expect(
      sportLogDurationS({
        sport_duration_s: null,
        started_at: '2026-10-25T09:00:00Z',
        finished_at: '2026-10-25T10:30:00Z',
      }),
    ).toBe(5400);
    expect(
      sportLogDurationS({
        started_at: '2026-10-25T10:00:00Z',
        finished_at: '2026-10-25T09:00:00Z',
      }),
    ).toBeNull();
    expect(sportLogDurationS({ sport_duration_s: 0 })).toBeNull();
    expect(sportLogDurationS({})).toBeNull();
  });
});

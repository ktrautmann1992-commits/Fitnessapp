import { describe, expect, it } from 'vitest';

import { type SportEntryInput, sportEntryFromRecording, sportSessionLogFromInput } from './log';

const PADEL: SportEntryInput = {
  id: '6f1c1e9e-6d0b-4b8a-9a43-6a3f2b1c0d01',
  writeId: '6f1c1e9e-6d0b-4b8a-9a43-6a3f2b1c0d02',
  sport: 'padel',
  performedOn: '2026-10-25',
  today: '2026-10-25',
  hours: 1,
  minutes: 0,
  distanceKm: null,
  effort: 6,
  notes: '',
  now: '2026-10-25T18:00:00.000Z',
};

describe('sportEntryFromRecording (GPS-Sportarten)', () => {
  it('Bewegungszeit in ganzen Minuten, Distanz in km, Beginn und Ende', () => {
    expect(
      sportEntryFromRecording({
        startedAt: '2026-10-25T09:00:00.000Z',
        durationS: 4000,
        movingS: 3690,
        distanceM: 15_432.7,
      }),
    ).toEqual({
      hours: 1,
      minutes: 2,
      distanceKm: 15.432,
      startedAt: '2026-10-25T09:00:00.000Z',
      finishedAt: '2026-10-25T10:06:40.000Z',
    });
  });

  it('ohne Bewegung Gesamtdauer; mindestens 1 min; höchstens 12 h; Distanz gedeckelt', () => {
    const base = { startedAt: '2026-10-25T09:00:00Z', distanceM: 0 };
    expect(sportEntryFromRecording({ ...base, durationS: 20, movingS: 0 })).toMatchObject({
      hours: 0,
      minutes: 1,
      distanceKm: null,
    });
    expect(
      sportEntryFromRecording({ ...base, durationS: 14 * 3600, movingS: 13 * 3600 }),
    ).toMatchObject({ hours: 12, minutes: 0 });
    expect(
      sportEntryFromRecording({ ...base, durationS: 3600, movingS: 3600, distanceM: 900_000 })
        ?.distanceKm,
    ).toBe(500);
  });

  it('ohne Beginn bzw. Dauer → null; Eintrag daraus gültig', () => {
    expect(
      sportEntryFromRecording({ startedAt: null, durationS: 60, movingS: 60, distanceM: 0 }),
    ).toBeNull();
    expect(
      sportEntryFromRecording({
        startedAt: '2026-10-25T09:00:00Z',
        durationS: 0,
        movingS: 0,
        distanceM: 0,
      }),
    ).toBeNull();
    expect(
      sportEntryFromRecording({ startedAt: 'kaputt', durationS: 60, movingS: 60, distanceM: 0 }),
    ).toBeNull();
    const values = sportEntryFromRecording({
      startedAt: '2026-10-25T09:00:00Z',
      durationS: 3600,
      movingS: 3500,
      distanceM: 9000,
    });
    if (!values) throw new Error('null');
    const result = sportSessionLogFromInput({ ...PADEL, sport: 'sup', effort: null, ...values });
    expect(result.ok && result.payload.sport).toEqual({
      sport: 'sup',
      duration_s: 3480,
      distance_m: 9000,
    });
  });
});

import { describe, expect, it } from 'vitest';

import {
  wallClockInTimeZone,
  addDays,
  createMeasuredOnSchema,
  daysBetween,
  isoDateInTimeZone,
  isoWeekday,
  isoWeekNumber,
  startOfIsoWeek,
} from './dates';

describe('addDays', () => {
  it('über Monats-, Jahres- und Schaltjahresgrenzen', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-03', 0)).toBe('2026-10-03');
    expect(addDays('2026-10-03', -3)).toBe('2026-09-30');
  });

  it('lehnt ungültige Daten ab', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow();
  });
});

describe('createMeasuredOnSchema', () => {
  const schema = createMeasuredOnSchema('2026-12-31');

  it('erlaubt bis einen Tag nach heute (auch über den Jahreswechsel)', () => {
    expect(schema.safeParse('2026-12-31').success).toBe(true);
    expect(schema.safeParse('2027-01-01').success).toBe(true);
    expect(schema.safeParse('2027-01-02').success).toBe(false);
  });

  it('erlaubt die Vergangenheit ab 1900', () => {
    expect(schema.safeParse('1900-01-01').success).toBe(true);
    expect(schema.safeParse('1899-12-31').success).toBe(false);
  });
});

describe('ISO-Woche (Plan-Engine)', () => {
  it('isoWeekday: Montag = 1, Sonntag = 7', () => {
    expect(isoWeekday('2026-10-05')).toBe(1);
    expect(isoWeekday('2026-10-11')).toBe(7);
    expect(isoWeekday('2024-02-29')).toBe(4);
  });

  it('startOfIsoWeek über Monats- und Jahreswechsel', () => {
    expect(startOfIsoWeek('2026-10-11')).toBe('2026-10-05');
    expect(startOfIsoWeek('2026-10-05')).toBe('2026-10-05');
    expect(startOfIsoWeek('2027-01-01')).toBe('2026-12-28');
    // Sommerzeit-Ende (25.10.2026) ändert nichts an der Kalenderrechnung.
    expect(startOfIsoWeek('2026-10-27')).toBe('2026-10-26');
  });

  it('isoWeekNumber: Kalenderwoche nach ISO 8601, auch über den Jahreswechsel', () => {
    expect(isoWeekNumber('2026-10-12')).toBe(42);
    expect(isoWeekNumber('2026-10-18')).toBe(42);
    expect(isoWeekNumber('2026-01-01')).toBe(1);
    // 1.1.2021 (Freitag) gehört zur KW 53 von 2020.
    expect(isoWeekNumber('2021-01-01')).toBe(53);
    expect(isoWeekNumber('2021-01-04')).toBe(1);
    // 31.12.2024 (Dienstag) ist schon KW 1 von 2025.
    expect(isoWeekNumber('2024-12-31')).toBe(1);
    expect(isoWeekNumber('2026-12-31')).toBe(53);
    expect(() => isoWeekNumber('2026-13-01')).toThrow();
  });

  it('daysBetween', () => {
    expect(daysBetween('2026-10-05', '2026-10-12')).toBe(7);
    expect(daysBetween('2026-10-12', '2026-10-05')).toBe(-7);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });
});

describe('isoDateInTimeZone', () => {
  it('rechnet Zeitstempel in das Berliner Kalenderdatum um (Sommer- und Winterzeit)', () => {
    expect(isoDateInTimeZone('2026-10-04T21:59:59.000Z')).toBe('2026-10-04');
    expect(isoDateInTimeZone('2026-10-04T22:00:00.000Z')).toBe('2026-10-05');
    expect(isoDateInTimeZone('2026-12-31T22:59:00.000Z')).toBe('2026-12-31');
    expect(isoDateInTimeZone('2026-12-31T23:00:00.000Z')).toBe('2027-01-01');
    expect(isoDateInTimeZone('2026-10-05T10:00:00+02:00')).toBe('2026-10-05');
  });

  it('andere Zeitzone und ungültiger Zeitstempel', () => {
    expect(isoDateInTimeZone('2026-10-04T23:30:00.000Z', 'UTC')).toBe('2026-10-04');
    expect(() => isoDateInTimeZone('kein Datum')).toThrow(RangeError);
  });
});

describe('wallClockInTimeZone (Essen nach dem Training)', () => {
  it('Sommer- und Winterzeit Europe/Berlin', () => {
    expect(wallClockInTimeZone('2026-07-01T16:30:00Z')).toEqual({
      date: '2026-07-01',
      minutes: 18 * 60 + 30,
    });
    expect(wallClockInTimeZone('2026-12-01T16:30:00Z')).toEqual({
      date: '2026-12-01',
      minutes: 17 * 60 + 30,
    });
  });

  it('Umstellung: 29.03.2026 (02→03 Uhr) und 25.10.2026 (03→02 Uhr)', () => {
    expect(wallClockInTimeZone('2026-03-29T00:59:00Z').minutes).toBe(1 * 60 + 59);
    expect(wallClockInTimeZone('2026-03-29T01:00:00Z').minutes).toBe(3 * 60);
    expect(wallClockInTimeZone('2026-10-25T00:30:00Z').minutes).toBe(2 * 60 + 30);
    expect(wallClockInTimeZone('2026-10-25T01:30:00Z').minutes).toBe(2 * 60 + 30);
  });

  it('Mitternacht und Tageswechsel; Millisekunden; andere Zone', () => {
    expect(wallClockInTimeZone('2026-10-14T22:00:00Z')).toEqual({ date: '2026-10-15', minutes: 0 });
    expect(wallClockInTimeZone('2026-10-14T21:59:00Z')).toEqual({
      date: '2026-10-14',
      minutes: 1439,
    });
    expect(wallClockInTimeZone(Date.parse('2026-10-14T10:00:00Z'))).toEqual({
      date: '2026-10-14',
      minutes: 12 * 60,
    });
    expect(wallClockInTimeZone('2026-10-14T10:00:00Z', 'UTC').minutes).toBe(10 * 60);
  });

  it('ungültig → RangeError', () => {
    expect(() => wallClockInTimeZone('kein Datum')).toThrow(RangeError);
    expect(() => wallClockInTimeZone(Number.NaN)).toThrow(RangeError);
  });
});

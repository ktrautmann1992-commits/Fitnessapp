import { describe, expect, it } from 'vitest';

import {
  datePartsFromIso,
  formatDateDe,
  formatDecimal,
  isoFromDateParts,
  parseDecimal,
  todayIso,
} from './format';

describe('Datumseingabe TT.MM.JJJJ', () => {
  it('setzt drei Felder zu einem ISO-Datum zusammen (mit führenden Nullen)', () => {
    expect(isoFromDateParts('5', '3', '1990')).toBe('1990-03-05');
    expect(isoFromDateParts(' 15 ', '05', '1990')).toBe('1990-05-15');
  });

  it('liefert null bei fehlenden oder nicht-numerischen Teilen', () => {
    expect(isoFromDateParts('', '05', '1990')).toBeNull();
    expect(isoFromDateParts('15', '05', '90')).toBeNull();
    expect(isoFromDateParts('1a', '05', '1990')).toBeNull();
  });

  it('zerlegt ISO-Daten wieder in Felder und formatiert deutsch', () => {
    expect(datePartsFromIso('1990-05-15')).toEqual({ day: '15', month: '05', year: '1990' });
    expect(datePartsFromIso(null)).toEqual({ day: '', month: '', year: '' });
    expect(formatDateDe('2026-10-03')).toBe('03.10.2026');
    expect(formatDateDe('2026-10-03T12:00:00Z')).toBe('03.10.2026');
  });

  it('todayIso nutzt die lokale Gerätezeit', () => {
    expect(todayIso(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02');
  });
});

describe('Zahlen mit deutschem Komma', () => {
  it('liest Komma und Punkt', () => {
    expect(parseDecimal('72,5')).toBe(72.5);
    expect(parseDecimal('72.5')).toBe(72.5);
    expect(parseDecimal(' 180 ')).toBe(180);
  });

  it('leer = nicht angegeben, Unsinn = NaN (Zod meldet dann den Fehler)', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('1,2,3')).toBeNaN();
  });

  it('formatiert für Textfelder mit Komma', () => {
    expect(formatDecimal(1.25)).toBe('1,25');
    expect(formatDecimal(null)).toBe('');
    expect(formatDecimal(undefined)).toBe('');
  });
});

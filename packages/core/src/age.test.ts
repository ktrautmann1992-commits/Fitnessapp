import { describe, expect, it } from 'vitest';

import { ageInYears, meetsMinimumAge } from './age';

describe('ageInYears', () => {
  it('zählt den Geburtstag selbst als vollendetes Jahr', () => {
    expect(ageInYears('2000-06-15', '2016-06-15')).toBe(16);
  });

  it('zieht ein Jahr ab, solange der Geburtstag noch aussteht', () => {
    expect(ageInYears('2000-06-15', '2016-06-14')).toBe(15);
    expect(ageInYears('2000-06-15', '2016-05-31')).toBe(15);
  });

  it('ist 0 am Tag der Geburt', () => {
    expect(ageInYears('2024-01-01', '2024-01-01')).toBe(0);
  });

  it('behandelt den 29. Februar in Nicht-Schaltjahren korrekt', () => {
    expect(ageInYears('2008-02-29', '2024-02-28')).toBe(15);
    expect(ageInYears('2008-02-29', '2024-02-29')).toBe(16);
    expect(ageInYears('2008-02-29', '2025-02-28')).toBe(16);
    expect(ageInYears('2008-02-29', '2025-03-01')).toBe(17);
  });

  it('funktioniert für sehr alte Menschen', () => {
    expect(ageInYears('1920-12-31', '2026-10-02')).toBe(105);
  });

  it('lehnt ein Geburtsdatum in der Zukunft ab', () => {
    expect(() => ageInYears('2030-01-01', '2026-10-02')).toThrow(RangeError);
  });

  it('lehnt ungültige Datumsangaben ab', () => {
    expect(() => ageInYears('2000-13-01', '2026-10-02')).toThrow();
    expect(() => ageInYears('15.06.2000', '2026-10-02')).toThrow();
  });
});

describe('meetsMinimumAge', () => {
  it('erlaubt die Nutzung ab dem 16. Geburtstag', () => {
    expect(meetsMinimumAge('2010-10-02', '2026-10-02')).toBe(true);
  });

  it('verweigert die Nutzung einen Tag vor dem 16. Geburtstag', () => {
    expect(meetsMinimumAge('2010-10-03', '2026-10-02')).toBe(false);
  });

  it('erlaubt Erwachsene jeden Alters', () => {
    expect(meetsMinimumAge('1940-01-01', '2026-10-02')).toBe(true);
  });
});

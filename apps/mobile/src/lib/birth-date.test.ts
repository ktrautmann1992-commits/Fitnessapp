import { describe, expect, it } from 'vitest';

import { checkBirthDate } from './birth-date';

const today = '2026-10-03';
const parts = (iso: string) => {
  const [year = '', month = '', day = ''] = iso.split('-');
  return { day, month, year };
};

describe('Schritt „Alter“', () => {
  it('genau 16 Jahre am Stichtag → ok', () => {
    expect(checkBirthDate(parts('2010-10-03'), today)).toEqual({
      kind: 'ok',
      birthDate: '2010-10-03',
    });
  });

  it('einen Tag zu jung → Stopp-Seite', () => {
    expect(checkBirthDate(parts('2010-10-04'), today)).toEqual({ kind: 'too_young' });
  });

  it('sehr alt (ab 1900) ist erlaubt, davor ungültig', () => {
    expect(checkBirthDate(parts('1900-01-01'), today).kind).toBe('ok');
    expect(checkBirthDate(parts('1899-12-31'), today).kind).toBe('invalid');
  });

  it('Zukunft, ungültiger Tag und unvollständige Eingabe', () => {
    expect(checkBirthDate(parts('2030-01-01'), today)).toEqual({
      kind: 'invalid',
      message: 'Das Geburtsdatum liegt in der Zukunft.',
    });
    expect(checkBirthDate({ day: '31', month: '02', year: '1990' }, today).kind).toBe('invalid');
    expect(checkBirthDate({ day: '', month: '02', year: '1990' }, today)).toEqual({
      kind: 'incomplete',
    });
  });
});

import { describe, expect, it } from 'vitest';

import { initialsFromEmail } from './initials';

describe('initialsFromEmail', () => {
  it('nimmt die Anfangsbuchstaben der Teile vor dem @', () => {
    expect(initialsFromEmail('k.trautmann1992@example.com')).toBe('KT');
    expect(initialsFromEmail('anna_maria-schulz@example.de')).toBe('AS');
    expect(initialsFromEmail('jonas@example.de')).toBe('J');
    expect(initialsFromEmail('öztürk@example.de')).toBe('Ö');
  });

  it('liefert null ohne Adresse oder ohne Buchstaben', () => {
    expect(initialsFromEmail(null)).toBeNull();
    expect(initialsFromEmail('')).toBeNull();
    expect(initialsFromEmail('1234@example.de')).toBeNull();
  });
});

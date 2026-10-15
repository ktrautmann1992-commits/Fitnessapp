import { describe, expect, it } from 'vitest';

import { decodeRouteParam, isoDateParam } from './route-param';

describe('decodeRouteParam', () => {
  it('dekodiert gültige Werte, kaputte Prozent-Folgen → leer statt Fehler', () => {
    expect(decodeRouteParam('kniebeuge-langhantel')).toBe('kniebeuge-langhantel');
    expect(decodeRouteParam('a%20b')).toBe('a b');
    expect(decodeRouteParam('%')).toBe('');
    expect(decodeRouteParam('%E0%A4%A')).toBe('');
    expect(decodeRouteParam(undefined)).toBe('');
    expect(decodeRouteParam(['x', 'y'])).toBe('x');
  });
});

describe('isoDateParam (Etappe A1b)', () => {
  it('gültige Tage, sonst null', () => {
    expect(isoDateParam('2026-10-15')).toBe('2026-10-15');
    expect(isoDateParam(['2026-02-28', 'x'])).toBe('2026-02-28');
    expect(isoDateParam('2026-02-30')).toBeNull();
    expect(isoDateParam('15.10.2026')).toBeNull();
    expect(isoDateParam('%')).toBeNull();
    expect(isoDateParam(undefined)).toBeNull();
  });
});

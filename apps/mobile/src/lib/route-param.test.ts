import { describe, expect, it } from 'vitest';

import { decodeRouteParam } from './route-param';

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

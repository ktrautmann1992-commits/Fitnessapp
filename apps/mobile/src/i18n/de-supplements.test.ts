import { checkSupplementText } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { deSupplements } from './de-supplements';

/**
 * Plan 3.8 Nr. 5: Alle App-Texte des Supplement-Bereichs gegen die Textregeln (keine Heilversprechen, keine
 * Wirkaussagen, keine Zahlen im Freitext). Funktionen werden mit Platzhaltern aufgerufen (Werte füllt der Core).
 * `consent` ist Datenschutz-Wortlaut („Einwilligung Gesundheitsdaten“) – dort nur keine Zahlen.
 */
function texts(value: unknown, path: string): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') return [[path, (value as (x: string) => string)('{dose}')]];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => texts(child, `${path}.${key}`));
  }
  return [];
}

describe('Texte Supplemente (de-supplements.ts)', () => {
  const { consent, ...rest } = deSupplements;

  it.each(texts(rest, 'supplements'))(
    '%s: keine verbotenen Wörter, keine Zahlen',
    (_path, text) => {
      expect(checkSupplementText(text)).toEqual([]);
    },
  );

  it.each(texts(consent, 'supplements.consent'))('%s: keine Zahlen', (_path, text) => {
    expect(checkSupplementText(text).filter((hit) => hit.kind === 'number')).toEqual([]);
  });

  it('Altersangabe nur über Platzhalter', () => {
    expect(deSupplements.groups.adult_only('{age}')).toBe('Ab {age} Jahren');
  });
});

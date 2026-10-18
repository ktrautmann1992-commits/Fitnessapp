import { describe, expect, it } from 'vitest';

import { findTextRuleHits } from '../content/text-rules';
import { ADJUSTMENT_HINT_CODES, EXPLAIN_KEYS } from './explain';
import { ADJUST_EXPLAIN_DE, ADJUST_HINTS_DE } from './texts-de';

/** Begriffe über Körper und Gesundheit – in Erklärungen verboten (nur Aussagen über das Training, Plan 5.5). */
const FORBIDDEN = [
  'krankheit',
  'schmerz',
  'verletz',
  'gesund',
  'körper',
  'gewicht verlier',
  'abnehm',
  'arzt',
  'zyklus',
];

describe('Erklärtexte (Plan 5.5)', () => {
  it('jeder Schlüssel (auch reservierte Regeln) und jeder Hinweis-Code hat einen Text', () => {
    expect(Object.keys(ADJUST_EXPLAIN_DE).sort()).toEqual([...EXPLAIN_KEYS].sort());
    expect(Object.keys(ADJUST_HINTS_DE).sort()).toEqual([...ADJUSTMENT_HINT_CODES].sort());
  });

  it('kein Text enthält verbotene Wörter (Textregeln Ü6, Körper-/Gesundheitsbegriffe)', () => {
    for (const text of [...Object.values(ADJUST_EXPLAIN_DE), ...Object.values(ADJUST_HINTS_DE)]) {
      expect(findTextRuleHits(text)).toEqual([]);
      for (const word of FORBIDDEN)
        expect(text.toLowerCase().includes(word), `${word}: ${text}`).toBe(false);
    }
  });
});

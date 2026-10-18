import { ADJUSTMENT_HINT_CODES, EXPLAIN_KEYS, findTextRuleHits } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { t } from '@/i18n';

import { ADJUST_EXPLAIN_DE, ADJUST_HINTS_DE } from './de-adjust';

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

/**
 * Erklärtexte der Live-Anpassung (Etappe D): Sie liegen NUR hier in der App (packages/core kennt nur die Schlüssel) –
 * jeder Schlüssel und jeder Hinweis-Code hat einen Text, keiner enthält verbotene Wörter.
 */
describe('Live-Anpassung: Erklärtexte (Plan 5.5)', () => {
  it('jeder Schlüssel aus packages/core (auch reservierte Regeln) und jeder Hinweis hat einen Text', () => {
    for (const key of EXPLAIN_KEYS) expect(t.adjust.explain[key]?.length).toBeGreaterThan(10);
    for (const code of ADJUSTMENT_HINT_CODES)
      expect(t.adjust.hints[code]?.length).toBeGreaterThan(10);
    expect(Object.keys(ADJUST_EXPLAIN_DE).sort()).toEqual([...EXPLAIN_KEYS].sort());
  });

  it('kein Text enthält verbotene Wörter (Textregeln Ü6 und Körper-/Gesundheitsbegriffe)', () => {
    const texts = [
      ...Object.values(ADJUST_EXPLAIN_DE),
      ...Object.values(ADJUST_HINTS_DE),
      t.adjust.empty,
      t.adjust.revertNotPossible,
      t.adjust.proposalExpired,
      t.adjust.fewerNewPlan,
      t.adjust.settingsText,
    ];
    for (const text of texts) {
      expect(findTextRuleHits(text)).toEqual([]);
      for (const word of FORBIDDEN)
        expect(text.toLowerCase().includes(word), `${word}: ${text}`).toBe(false);
    }
  });

  it('Zustände aus 8.4 wörtlich wie im Plan', () => {
    expect(t.adjust.empty).toBe('Noch keine Anpassungen – dein Plan läuft wie geplant.');
    expect(t.adjust.proposalExpired).toBe('Dieser Vorschlag ist nicht mehr aktuell.');
    expect(t.adjust.revertNotPossible).toBe(
      'Nicht mehr rückgängig machbar, weil du schon trainiert hast.',
    );
    expect(t.adjust.offline).toBe('Dafür brauchst du kurz Verbindung.');
    expect(t.adjust.premiumEnded).toBe('Neue Anpassungen gibt es mit Premium.');
  });
});

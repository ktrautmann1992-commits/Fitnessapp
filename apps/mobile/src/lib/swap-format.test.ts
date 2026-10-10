import { describe, expect, it } from 'vitest';

import { t } from '@/i18n';

import { keyPatternTexts, markText, placeText } from './swap-format';

describe('Texte zum Übungstausch (Etappe T2)', () => {
  it('Kennzeichen: Sicherheits-Ersatz und deine Wahl getrennt (D-4), nie nur Farbe', () => {
    expect(markText('adjusted', false)).toBe(t.plan.adjusted);
    expect(markText('equipment_swap', false)).toBe(t.plan.substituted);
    expect(markText('preference', false)).toBe('getauscht (deine Wahl)');
    expect(markText('day_swap', false)).toBe('heute getauscht');
    expect(markText('day_swap', true)).toBe('für dieses Training getauscht');
    expect(markText(null, false)).toBeNull();
  });

  it('Orte und fehlende Grundbausteine', () => {
    expect(placeText('home')).toBe('zu Hause');
    expect(placeText('gym')).toBe('im Studio');
    expect(keyPatternTexts(undefined)).toEqual([]);
    expect(keyPatternTexts(['horizontal_pull', 'vertical_pull'])).toEqual([
      t.swap.keyPatternMissing.pull,
    ]);
    expect(keyPatternTexts(['hinge', 'horizontal_pull'])).toEqual([
      t.swap.keyPatternMissing.pull,
      t.swap.keyPatternMissing.hinge,
    ]);
  });

  it('keine Gesundheits- oder Fähigkeits-Begriffe in den Tausch-Texten (D-1)', () => {
    const texts = JSON.stringify({ ...t.swap, ...t.exclusions }, (_key, value: unknown) =>
      typeof value === 'function' ? (value as (...a: string[]) => string)('X', 'Y') : value,
    ).toLowerCase();
    for (const word of ['verboten', 'kann ich nicht', 'verletzung', 'schmerzen beim']) {
      expect(texts).not.toContain(word);
    }
    // Einziger Gesundheitsbezug: der feste Verweis auf den Gesundheits-Check (D-2).
    expect(t.swap.healthHint).toContain('Gesundheits-Check');
  });
});

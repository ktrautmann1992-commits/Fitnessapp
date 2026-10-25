import { describe, expect, it } from 'vitest';

import { strengthComparisonText, strengthNumber, strengthValueText } from './strength-format';

describe('Kraft-Entwicklung: Texte (neutral, Komma, Einheiten ausgeschrieben)', () => {
  it('Zahlen je Kennzahl', () => {
    expect(strengthNumber('weight', 62.5)).toBe('62,5');
    expect(strengthNumber('weight', 1.257)).toBe('1,26');
    expect(strengthNumber('volume', 14805.4)).toBe('14.805');
    expect(strengthNumber('reps', 26)).toBe('26');
    expect(strengthNumber('time', 45.4)).toBe('45');
    expect(strengthValueText('weight', 62.5)).toEqual({ text: '62,5 kg', a11y: '62,5 Kilogramm' });
    expect(strengthValueText('reps', 26)).toEqual({ text: '26 Wdh.', a11y: '26 Wiederholungen' });
  });

  it('Vergleich: plus, minus (echtes Minuszeichen), gleich, Erholungswoche, keiner', () => {
    const base = { kind: 'change' as const, current: 0, reference: 0, referenceOn: '2026-09-27' };
    expect(strengthComparisonText({ ...base, metric: 'weight', delta: 5, weeksAgo: 4 })).toEqual({
      text: '+5 kg gegenüber vor 4 Wochen',
      a11y: '5 Kilogramm mehr als vor 4 Wochen',
    });
    expect(
      strengthComparisonText({ ...base, metric: 'weight', delta: -2.5, weeksAgo: 1 })?.text,
    ).toBe('−2,5 kg gegenüber vor 1 Woche');
    expect(strengthComparisonText({ ...base, metric: 'reps', delta: 0, weeksAgo: 4 })?.text).toBe(
      'gleich wie vor 4 Wochen',
    );
    expect(strengthComparisonText({ kind: 'deload' })?.text).toBe(
      'Erholungswoche – bewusst leichter.',
    );
    expect(strengthComparisonText({ kind: 'none' })).toBeNull();
  });
});

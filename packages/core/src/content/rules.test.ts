import { describe, expect, it } from 'vitest';

import { CONTENT_RULES, isBlockingIssue, makeIssue } from './rules';

describe('Regeltabelle (Plan Abschnitt 7)', () => {
  it('Stufen exakt wie im Plan', () => {
    const red = Object.entries(CONTENT_RULES)
      .filter(([, rule]) => rule.severity === 'error')
      .map(([id]) => id);
    const yellow = Object.entries(CONTENT_RULES)
      .filter(([, rule]) => rule.severity === 'warning')
      .map(([id]) => id);
    expect(red).toEqual([
      'DATEI',
      'VERSION',
      'PROBELAUF',
      'Ü1',
      'Ü2',
      'Ü3',
      'Ü4',
      'Ü6',
      'V1',
      'V2',
      'V3',
      'V4',
      'V8',
      'V9',
      'V10',
      'V12',
    ]);
    expect(yellow).toEqual(['Ü5', 'V5', 'V6', 'V7', 'V11']);
  });
});

describe('isBlockingIssue', () => {
  const at = (status: 'draft' | 'published' | 'archived' | null) => ({
    kind: 'exercise' as const,
    id: 'x-y-z',
    status,
  });

  it('Schema-, Datei- und Versionsfehler blockieren immer – auch bei Entwürfen', () => {
    expect(isBlockingIssue(makeIssue('Ü1', at('draft'), 'x'))).toBe(true);
    expect(isBlockingIssue(makeIssue('DATEI', at(null), 'x'))).toBe(true);
    expect(isBlockingIssue(makeIssue('VERSION', at('draft'), 'x'))).toBe(true);
  });

  it('andere rote Fehler blockieren nur freigegebene Inhalte', () => {
    expect(isBlockingIssue(makeIssue('Ü2', at('published'), 'x'))).toBe(true);
    expect(isBlockingIssue(makeIssue('Ü2', at('draft'), 'x'))).toBe(false);
    expect(isBlockingIssue(makeIssue('V9', at('archived'), 'x'))).toBe(false);
  });

  it('gelbe Hinweise blockieren nie', () => {
    expect(isBlockingIssue(makeIssue('V5', at('published'), 'x'))).toBe(false);
    expect(isBlockingIssue(makeIssue('Ü5', at(null), 'x'))).toBe(false);
  });

  it('makeIssue übernimmt die Stufe aus der Tabelle und lässt leeren Pfad weg', () => {
    const issue = makeIssue('V7', at('draft'), 'Hinweis');
    expect(issue.severity).toBe('warning');
    expect('path' in issue).toBe(false);
    expect(makeIssue('V4', at('draft'), 'x', 'sets').path).toBe('sets');
  });
});

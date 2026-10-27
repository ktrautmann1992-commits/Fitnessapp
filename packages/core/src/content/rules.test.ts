import { describe, expect, it } from 'vitest';

import { CONTENT_RULES, isBlockingIssue, makeIssue } from './rules';

describe('Regeltabelle (Plan Abschnitt 7, Phase 5 Abschnitte 5.3, 19.4 und 19.7)', () => {
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
      'R1',
      'R2',
      'R3',
      'R4',
      'R6',
      'R7',
      'R8',
      'R9',
      'R10',
      'R12',
      'R13',
      'R14',
      'R15',
      'R17',
      'R18',
      'R19',
      'R20',
      'R21',
      'R23',
      'R24',
      'SK1',
      'SK2',
      'SK3',
      'SK4',
      'SK5',
      'SK6',
      'SK7',
      'W1',
      'W2',
      'W3',
      'W4',
      'W5',
      'W7',
    ]);
    expect(yellow).toEqual([
      'Ü5',
      'V5',
      'V6',
      'V7',
      'V11',
      'V13',
      'R5',
      'R11',
      'R16',
      'R18H',
      'R20H',
      'R21H',
      'R22',
      'R22T',
      'R23H',
      'SK7H',
      'W6',
    ]);
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
    expect(isBlockingIssue(makeIssue('R1', at('draft'), 'x'))).toBe(true);
    expect(isBlockingIssue(makeIssue('R15', at('draft'), 'x'))).toBe(true);
    expect(isBlockingIssue(makeIssue('DATEI', at(null), 'x'))).toBe(true);
    expect(isBlockingIssue(makeIssue('VERSION', at('draft'), 'x'))).toBe(true);
    expect(isBlockingIssue(makeIssue('W1', at('draft'), 'x'))).toBe(true);
    expect(isBlockingIssue(makeIssue('W2', at('draft'), 'x'))).toBe(false);
    expect(isBlockingIssue(makeIssue('SK1', at('draft'), 'x'))).toBe(true);
    expect(isBlockingIssue(makeIssue('SK3', at('draft'), 'x'))).toBe(false);
    expect(isBlockingIssue(makeIssue('SK3', at('published'), 'x'))).toBe(true);
  });

  it('andere rote Fehler blockieren nur freigegebene Inhalte', () => {
    expect(isBlockingIssue(makeIssue('Ü2', at('published'), 'x'))).toBe(true);
    expect(isBlockingIssue(makeIssue('Ü2', at('draft'), 'x'))).toBe(false);
    expect(isBlockingIssue(makeIssue('V9', at('archived'), 'x'))).toBe(false);
    expect(isBlockingIssue(makeIssue('R18', at('draft'), 'x'))).toBe(false);
    expect(isBlockingIssue(makeIssue('R18', at('published'), 'x'))).toBe(true);
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

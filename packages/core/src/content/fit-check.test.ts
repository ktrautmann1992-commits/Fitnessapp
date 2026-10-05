import { describe, expect, it } from 'vitest';

import { repoLibrary } from '../plan/test-library';
import { isBodyweightTemplate } from './checks';
import { checkTemplateFitsMinimum } from './fit-check';
import { makeTemplate } from './test-fixtures';

const library = repoLibrary();

describe('V13 – Vorlage passt gekürzt in minutes_min (gelb)', () => {
  it('Inhaltsstand: keine Hinweise (bestehende 24 und 18 Körpergewicht-Vorlagen)', () => {
    for (const template of library.templates) {
      expect(checkTemplateFitsMinimum(template, library.exercises), template.id).toEqual([]);
    }
  });

  it('Mindestfassung länger als minutes_min → gelber Hinweis', () => {
    const studio = library.templates.find((t) => t.id === 'muskelaufbau-fortgeschritten-4t-studio');
    if (!studio) throw new Error('Vorlage fehlt');
    const issues = checkTemplateFitsMinimum({ ...studio, minutes_min: 10 }, library.exercises);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.rule === 'V13' && i.severity === 'warning')).toBe(true);
    expect(issues[0]?.message).toContain('passt auch gekürzt nicht');
  });

  it('Körpergewicht: fehlt nach dem Kürzen das Ziehen, gibt es einen Hinweis', () => {
    const template = library.templates.find((t) => t.id === 'fitness-einsteiger-2t-koerpergewicht');
    if (!template || !isBodyweightTemplate(template)) throw new Error('Vorlage fehlt');
    const withoutRow = {
      ...template,
      sessions: template.sessions.map((s) => ({
        ...s,
        exercises: s.exercises.filter(
          (e) => library.exercises.get(e.exercise_id)?.movement_pattern !== 'horizontal_pull',
        ),
      })),
    };
    const issues = checkTemplateFitsMinimum(withoutRow, library.exercises);
    expect(issues.map((i) => i.message).join(' ')).toContain('fehlt Ziehen');
  });

  it('unbekannte Übungen meldet V1 – V13 schweigt', () => {
    expect(checkTemplateFitsMinimum(makeTemplate(), new Map())).toEqual([]);
  });
});

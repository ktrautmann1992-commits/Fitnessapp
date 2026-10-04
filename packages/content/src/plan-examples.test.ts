import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EXAMPLE_PERSONS,
  exampleLibrary,
  PLAN_NOTE_TEXTS_DE,
  renderPlanExamples,
  todayInBerlin,
} from './plan-examples';
import { loadContentFiles } from './validate';

const contentDir = join(import.meta.dirname, '../../../content');

describe('Beispielpläne', () => {
  const library = exampleLibrary(loadContentFiles(contentDir).files);

  it('erzeugt für jede Test-Person einen Plan', () => {
    const markdown = renderPlanExamples(library, '2026-10-05');
    for (const person of EXAMPLE_PERSONS) {
      expect(markdown).toContain(`### ${person.name}`);
    }
    expect(markdown).not.toContain('Kein Plan');
    expect(markdown).toContain('Muskelaufbau · Einsteiger · 3 Tage · Studio (passt genau)');
    expect(markdown).toContain('Arzt-Hinweis vor jeder Einheit');
    expect(markdown).toContain(PLAN_NOTE_TEXTS_DE.no_pull_exercise);
    expect(markdown).toContain(PLAN_NOTE_TEXTS_DE.goal_endurance_not_yet);
  });

  it('deterministisch für ein festes Datum', () => {
    expect(renderPlanExamples(library, '2026-10-09')).toBe(
      renderPlanExamples(library, '2026-10-09'),
    );
  });

  it('ohne Inhalte: verständliche Meldung statt Absturz', () => {
    expect(renderPlanExamples(exampleLibrary([]), '2026-10-05')).toContain(
      'Kein Plan: keine passende Vorlage',
    );
  });

  it('Datum in Europe/Berlin', () => {
    expect(todayInBerlin(new Date('2026-10-04T22:30:00Z'))).toBe('2026-10-05');
  });
});

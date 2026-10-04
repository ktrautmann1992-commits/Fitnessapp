import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EXAMPLE_PERSONS,
  exampleLibrary,
  PLAN_NOTE_TEXTS_DE,
  renderPlanExamples,
  todayInBerlin,
} from './plan-examples';
import { generateTrainingPlan } from '@fitnessapp/core';

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
    // Etappe B3: nur Laufen, gemischt, Mo 20 / Sa 90, Schwangerschaft, ab 65, ohne Check
    expect(markdown).toContain('**Vorlage:** keine (nur Ausdauer)');
    expect(markdown).toContain('Ausdauer-Minuten je Woche');
    expect(markdown).toContain('Ergometer locker');
    expect(markdown).toContain('Zügiges Gehen');
    expect(markdown).toContain('Geh-Lauf-Wechsel');
    expect(markdown).toContain(PLAN_NOTE_TEXTS_DE.endurance_walk);
    expect(markdown).toContain(PLAN_NOTE_TEXTS_DE.minutes_shortened);
    expect(markdown).not.toMatch(/Lockere Radeinheit[^|]*\| [^|]*\|[^\n]*Lena/);
  });

  it('Lena (Schwangerschaft): nie Rad im Freien, nie Laufen', () => {
    const lena = EXAMPLE_PERSONS.find((p) => p.name === 'Lena');
    if (!lena) throw new Error('Lena fehlt');
    const result = generateTrainingPlan(lena.inputs, library, '2026-10-05');
    if (!result.ok) throw new Error(result.error);
    const modalities = new Set(
      result.plan.sessions.filter((s) => s.kind === 'endurance').map((s) => s.name_de),
    );
    expect(
      [...modalities].every((name) => ['Ergometer locker', 'Zügiges Gehen'].includes(name)),
    ).toBe(true);
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

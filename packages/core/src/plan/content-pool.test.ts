import { describe, expect, it } from 'vitest';

import { makeExercise, makeTemplate, META } from '../content/test-fixtures';
import { validateContent } from '../content/validate';
import { planLibraryFromContent, selectPlanContent } from './content-pool';
import { loadRepoContentFiles, repoLibrary } from './test-library';

describe('selectPlanContent', () => {
  it('Startbestand (alle draft): nur mit allowDrafts nutzbar', () => {
    const result = validateContent(loadRepoContentFiles());
    const live = selectPlanContent(result, { allowDrafts: false });
    expect(live.templates).toHaveLength(0);
    expect(live.exercises.size).toBe(0);
    const test = repoLibrary();
    expect(test.templates).toHaveLength(24);
    expect(test.exercises.size).toBe(79); // 52 Startbestand + 27 Körpergewicht (K1)
    expect(test.containsDrafts).toBe(true);
  });

  it('archived nie, Probelauf nie, roter Befund nie', () => {
    const published = { ...META, reviewed_by: 'kt', reviewed_at: '2026-10-04' };
    const ok = makeExercise({ id: 'ok-uebung', status: 'published', meta: published });
    const archived = makeExercise({ id: 'alt-uebung', status: 'archived' });
    const dryRun = makeExercise({ id: 'probelauf-uebung', status: 'draft' });
    const red = makeExercise({ id: 'rot-uebung', status: 'draft' });
    const library = selectPlanContent(
      {
        exercises: [ok, archived, dryRun, red],
        templates: [],
        issues: [
          {
            rule: 'Ü2',
            severity: 'error',
            kind: 'exercise',
            id: 'rot-uebung',
            status: 'draft',
            message: 'x',
          },
        ],
      },
      { allowDrafts: true },
    );
    expect([...library.exercises.keys()]).toEqual(['ok-uebung']);
  });

  it('Vorlage nur, wenn alle Übungen ausgewählt sind', () => {
    const template = makeTemplate();
    const library = planLibraryFromContent([], [{ ...template, status: 'published' }]);
    expect(library.templates).toHaveLength(0);
  });
});

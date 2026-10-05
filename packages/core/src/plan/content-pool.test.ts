import { describe, expect, it } from 'vitest';

import { BODYWEIGHT_TEMPLATE_ID_SUFFIX } from '../constants';
import { isBodyweightTemplate } from '../content/checks';

import { makeExercise, makeTemplate, META } from '../content/test-fixtures';
import { validateContent } from '../content/validate';
import { isBodyweightTemplateId, planLibraryFromContent, selectPlanContent } from './content-pool';
import { loadRepoContentFiles, repoLibrary } from './test-library';

describe('selectPlanContent', () => {
  it('Startbestand (alle draft): nur mit allowDrafts nutzbar', () => {
    const result = validateContent(loadRepoContentFiles());
    const live = selectPlanContent(result, { allowDrafts: false });
    expect(live.templates).toHaveLength(0);
    expect(live.exercises.size).toBe(0);
    const test = repoLibrary();
    expect(test.templates).toHaveLength(42); // 24 Startbestand + 18 Körpergewicht (K2)
    expect(test.exercises.size).toBe(80); // 52 Startbestand + 27 Körpergewicht (K1) + Handtuch-Latziehen (K2)
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

  it('isBodyweightTemplateId: nur Körpergewicht-Vorlagen der Bibliothek, sonst false', () => {
    const lib = repoLibrary();
    expect(isBodyweightTemplateId(lib, 'fitness-einsteiger-2t-koerpergewicht')).toBe(true);
    expect(isBodyweightTemplateId(lib, 'fitness-einsteiger-3t-zuhause')).toBe(false);
    expect(isBodyweightTemplateId(lib, 'gibt-es-nicht')).toBe(false);
    expect(isBodyweightTemplateId(lib, null)).toBe(false);
    // N3: Bibliothek aus dem Zwischenspeicher (ohne Vorlagen) bzw. Vorlage archiviert → ID-Konvention.
    const empty = { templates: [] };
    expect(isBodyweightTemplateId(empty, 'fitness-einsteiger-2t-koerpergewicht')).toBe(true);
    expect(isBodyweightTemplateId(empty, 'fitness-einsteiger-3t-zuhause')).toBe(false);
    expect(isBodyweightTemplateId(empty, null)).toBe(false);
    // Steht die Vorlage in der Bibliothek, entscheidet ihr Kennzeichen – nicht die ID.
    expect(
      isBodyweightTemplateId(
        { templates: [makeTemplate({ id: 'x-koerpergewicht', location: 'gym' })] },
        'x-koerpergewicht',
      ),
    ).toBe(false);
  });

  it('ID-Endung „-koerpergewicht“ ⇔ Körpergewicht-Kennzeichen im Inhaltsstand (Rückfall N3 ist verlässlich)', () => {
    for (const template of repoLibrary().templates) {
      expect(template.id.endsWith(BODYWEIGHT_TEMPLATE_ID_SUFFIX), template.id).toBe(
        isBodyweightTemplate(template),
      );
    }
  });
});

import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ADJUST_EXAMPLE_PERSONS, renderAdjustExamples } from './adjust-examples';
import { exampleLibrary } from './plan-examples';
import { loadContentFiles } from './validate';

const contentDir = join(import.meta.dirname, '../../../content');

describe('Beispiel-Anpassungen (CI-Zusammenfassung, Plan 4b Etappe A)', () => {
  const library = exampleLibrary(loadContentFiles(contentDir).files);
  const markdown = renderAdjustExamples(library);

  it('je Test-Person ein Abschnitt mit Anpassung und Erklärsatz', () => {
    for (const person of ADJUST_EXAMPLE_PERSONS) expect(markdown).toContain(`### ${person.name}`);
    expect(markdown).not.toContain('Keine Anpassung.');
    expect(markdown).toContain('nächstes Mal 54 kg statt 60 kg');
    expect(markdown).toContain('**Erholungswoche vorgezogen**');
    expect(markdown).toContain('Wochen-Übersicht vorher/nachher');
    expect(markdown).toContain('**Übung getauscht**');
    expect(markdown).toContain('Möchtest du auf 2 Tage umstellen?');
  });

  it('stabil (feste Daten, kein „heute“)', () => {
    expect(renderAdjustExamples(library)).toBe(markdown);
  });
});

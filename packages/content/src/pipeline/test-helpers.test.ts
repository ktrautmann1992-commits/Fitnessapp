import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTempRepo, setContentStatus, type TempRepo } from './test-helpers';

const repos: TempRepo[] = [];
afterEach(() => {
  while (repos.length > 0) {
    repos.pop()!.cleanup();
  }
});

const FILES = [
  'content/exercises/goblet-kniebeuge.json',
  'content/plan-templates/fitness-einsteiger-3t-zuhause.json',
];

function read(r: TempRepo, path: string) {
  return JSON.parse(readFileSync(join(r.root, path), 'utf8')) as {
    status: string;
    meta: { reviewed_by: string | null; reviewed_at: string | null };
  };
}

describe('createTempRepo: Freigabe-Status unabhängig vom echten Bestand', () => {
  it('Standard: alles Entwurf ohne Prüfer; Arbeitsordner sauber', () => {
    const r = createTempRepo();
    repos.push(r);
    for (const path of FILES) {
      const file = read(r, path);
      expect(file.status, path).toBe('draft');
      expect(file.meta.reviewed_by, path).toBeNull();
      expect(file.meta.reviewed_at, path).toBeNull();
    }
    expect(r.git(['status', '--porcelain'])).toBe('');
  });

  it('published: alles freigegeben mit Prüfer und Datum', () => {
    const r = createTempRepo({ contentStatus: 'published' });
    repos.push(r);
    for (const path of FILES) {
      const file = read(r, path);
      expect(file.status, path).toBe('published');
      expect(file.meta.reviewed_by, path).toBe('Test');
      expect(file.meta.reviewed_at, path).toBe('2026-10-03');
    }
  });

  it('setContentStatus: ändert nur Status und Prüfvermerk, Formatierung bleibt', () => {
    const draft = [
      '{',
      '  "status": "draft",',
      '  "aliases_de": ["A"],',
      '  "meta": {',
      '    "reviewed_by": null,',
      '    "reviewed_at": null,',
      '    "review_note": null',
      '  }',
      '}',
      '',
    ].join('\n');
    const published = setContentStatus(draft, 'published');
    expect(published).toBe(
      draft
        .replace('"status": "draft"', '"status": "published"')
        .replace('"reviewed_by": null', '"reviewed_by": "Test"')
        .replace('"reviewed_at": null', '"reviewed_at": "2026-10-03"'),
    );
    expect(setContentStatus(published, 'draft')).toBe(draft);
    expect(() => setContentStatus('{ "status": "draft" }', 'draft')).toThrow(/reviewed_by/);
  });
});

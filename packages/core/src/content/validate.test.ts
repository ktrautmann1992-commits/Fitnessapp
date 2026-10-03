import { describe, expect, it } from 'vitest';

import type { ContentFile } from './validate';
import { canonicalJson, checkVersionChange, validateContent } from './validate';
import { LIBRARY, makeExercise, makeTemplate, META } from './test-fixtures';

const exerciseFiles = (): ContentFile[] =>
  LIBRARY.map((exercise) => ({
    kind: 'exercise',
    fileName: `${exercise.id}.json`,
    data: exercise,
  }));
const templateFile = (data: unknown = makeTemplate()): ContentFile => ({
  kind: 'plan_template',
  fileName: 'fitness-einsteiger-3t-test.json',
  data,
});
const reviewed = { ...META, reviewed_by: 'KT', reviewed_at: '2026-10-03' };

describe('validateContent', () => {
  it('stimmiger Stand: keine Befunde', () => {
    const result = validateContent([...exerciseFiles(), templateFile()]);
    expect(result.issues).toEqual([]);
    expect(result.blocking).toEqual([]);
    expect(result.exercises).toHaveLength(LIBRARY.length);
    expect(result.templates).toHaveLength(1);
  });

  it('kein gültiges JSON → DATEI, blockiert', () => {
    const result = validateContent([
      { kind: 'exercise', fileName: 'kaputt.json', jsonError: 'Unexpected token' },
    ]);
    expect(result.issues).toMatchObject([{ rule: 'DATEI', id: 'kaputt.json', status: null }]);
    expect(result.blocking).toHaveLength(1);
  });

  it('Schemafehler (Ü1) blockieren auch bei Entwürfen und nennen Feld und ID', () => {
    const result = validateContent([
      {
        kind: 'exercise',
        fileName: 'x.json',
        data: { ...makeExercise({ id: 'x-y-z' }), difficulty: 9 },
      },
    ]);
    expect(result.issues).toMatchObject([
      { rule: 'Ü1', id: 'x-y-z', status: 'draft', path: 'difficulty' },
    ]);
    expect(result.blocking).toHaveLength(1);
    expect(result.exercises).toEqual([]);
  });

  it('Schemafehler ohne lesbare ID/Status: Dateiname und Status null', () => {
    const result = validateContent([{ kind: 'plan_template', fileName: 'leer.json', data: null }]);
    expect(result.issues[0]).toMatchObject({ rule: 'Ü1', id: 'leer.json', status: null });
    expect(result.issues[0]?.path).toBeUndefined();
  });

  it('Dateiname ≠ ID und doppelte ID → DATEI', () => {
    const result = validateContent([
      { kind: 'exercise', fileName: 'falsch.json', data: makeExercise() },
      { kind: 'exercise', fileName: 'kniebeuge-test.json', data: makeExercise() },
    ]);
    expect(result.issues.map((i) => i.rule)).toEqual(['DATEI', 'DATEI', 'Ü5']);
    expect(result.issues[1]?.message).toContain('doppelt');
    expect(result.exercises).toHaveLength(1);
    expect(result.blocking).toHaveLength(2);
  });

  it('rote Fehler an Entwürfen blockieren nicht, an freigegebenen schon', () => {
    const draft = makeExercise({ equipment_ids: ['hovercraft'] });
    const draftResult = validateContent([
      { kind: 'exercise', fileName: 'kniebeuge-test.json', data: draft },
    ]);
    expect(draftResult.issues.map((i) => i.rule)).toEqual(['Ü2', 'Ü5']);
    expect(draftResult.blocking).toEqual([]);

    const published = { ...draft, status: 'published', meta: reviewed };
    const publishedResult = validateContent([
      { kind: 'exercise', fileName: 'kniebeuge-test.json', data: published },
    ]);
    expect(publishedResult.blocking.map((i) => i.rule)).toEqual(['Ü2']);
  });

  it('Vorlagen werden gegen die Übungen geprüft (V1 bei fehlender Übung)', () => {
    const result = validateContent([templateFile()]);
    expect(new Set(result.issues.map((i) => i.rule))).toContain('V1');
    expect(result.blocking).toEqual([]);
  });

  it('Übung und Vorlage dürfen dieselbe ID haben (verschiedene Ordner)', () => {
    const result = validateContent([
      ...exerciseFiles(),
      templateFile(),
      {
        kind: 'exercise',
        fileName: 'fitness-einsteiger-3t-test.json',
        data: makeExercise({ id: 'fitness-einsteiger-3t-test' }),
      },
    ]);
    expect(result.issues.filter((i) => i.rule === 'DATEI')).toEqual([]);
  });

  it('Versionsregel über previous', () => {
    const previous = { ...makeExercise({ status: 'published', meta: reviewed }) };
    const changed = { ...previous, name_de: 'Kniebeuge neu' };
    const result = validateContent([
      { kind: 'exercise', fileName: 'kniebeuge-test.json', data: changed, previous },
    ]);
    expect(result.blocking.map((i) => i.rule)).toEqual(['VERSION']);
  });
});

describe('checkVersionChange', () => {
  const published = makeExercise({ status: 'published', meta: reviewed });

  it('freigegeben + geändert + gleiche Version → rot', () => {
    const issues = checkVersionChange('exercise', published, {
      ...published,
      name_de: 'Neu',
    } as never);
    expect(issues).toMatchObject([{ rule: 'VERSION', severity: 'error' }]);
    expect(issues[0]?.message).toContain('auf 2 erhöhen');
  });

  it('Version erhöht → in Ordnung', () => {
    expect(checkVersionChange('exercise', published, { ...published, version: 2 })).toEqual([]);
  });

  it('nur Status/Meta geändert (z. B. Zurückziehen) → keine neue Version nötig', () => {
    expect(checkVersionChange('exercise', published, { ...published, status: 'archived' })).toEqual(
      [],
    );
    const withNote = { ...published, meta: { ...reviewed, review_note: 'geprüft' } };
    expect(checkVersionChange('exercise', published, withNote)).toEqual([]);
  });

  it('vorher Entwurf → Änderung ohne neue Version erlaubt', () => {
    const draft = makeExercise();
    expect(checkVersionChange('exercise', draft, makeExercise({ name_de: 'Neu' }))).toEqual([]);
  });

  it('Version darf nie sinken', () => {
    const v3 = makeExercise({ version: 3 });
    expect(checkVersionChange('exercise', v3, makeExercise({ version: 2 }))).toMatchObject([
      { rule: 'VERSION' },
    ]);
  });

  it('kein oder unlesbarer Vorstand → nichts zu prüfen', () => {
    expect(checkVersionChange('exercise', undefined, published)).toEqual([]);
    expect(checkVersionChange('exercise', 'kaputt', published)).toEqual([]);
    expect(checkVersionChange('exercise', { status: 'published' }, published)).toEqual([]);
  });
});

describe('canonicalJson', () => {
  it('Reihenfolge der Schlüssel egal, undefined ignoriert', () => {
    expect(canonicalJson({ b: 1, a: [1, { d: 2, c: null }] })).toBe(
      canonicalJson({ a: [1, { c: null, d: 2 }], b: 1, x: undefined }),
    );
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
    expect(canonicalJson('x')).toBe('"x"');
  });
});

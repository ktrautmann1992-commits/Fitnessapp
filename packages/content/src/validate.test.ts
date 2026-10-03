import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  formatMarkdownSummary,
  formatReport,
  gitPreviousReader,
  loadContentFiles,
  parseArgs,
  runValidate,
} from './validate';

const META = {
  origin: 'claude_session',
  model: 'claude-opus-5-5',
  batch_id: null,
  created_on: '2026-10-03',
  expert_reviewed: false,
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
};
const REVIEWED = { ...META, reviewed_by: 'KT', reviewed_at: '2026-10-03' };

function exercise(overrides: Record<string, unknown> = {}) {
  return {
    id: 'kniebeuge-test',
    version: 1,
    status: 'draft',
    name_de: 'Kniebeuge',
    name_en: 'Squat',
    aliases_de: [],
    movement_pattern: 'squat',
    primary_muscles: ['quadriceps', 'glutes'],
    secondary_muscles: [],
    equipment_ids: [],
    mechanics: 'compound',
    load_type: 'bodyweight',
    unilateral: false,
    difficulty: 1,
    caution_tags: [],
    description_de: 'Grundübung für die Beine: Hüfte und Knie beugen, dann wieder aufrichten.',
    steps_de: ['Füße etwa schulterbreit aufstellen.', 'In die Hocke gehen und wieder aufstehen.'],
    tips_de: ['Knie zeigen in Richtung der Fußspitzen.'],
    common_mistakes_de: ['Fersen heben vom Boden ab.'],
    safety_note_de: 'Nur so tief gehen, wie die Technik sauber bleibt.',
    alternatives: [],
    meta: META,
    ...overrides,
  };
}

const dirs: string[] = [];
function contentDir(files: Record<string, string | object>): string {
  const dir = mkdtempSync(join(tmpdir(), 'content-validate-'));
  dirs.push(dir);
  for (const [path, value] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  }
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('parseArgs', () => {
  it('liest --content und --base, ignoriert „--“', () => {
    expect(parseArgs(['--', '--content', 'x', '--base', 'origin/main'])).toEqual({
      contentDir: 'x',
      base: 'origin/main',
    });
    expect(parseArgs([])).toEqual({});
  });

  it('unbekannte oder unvollständige Argumente → Fehler', () => {
    expect(() => parseArgs(['--fix'])).toThrow('Unbekanntes Argument: --fix');
    expect(() => parseArgs(['--base'])).toThrow('Unbekanntes Argument');
    expect(() => parseArgs(['--content', '--base', 'x'])).toThrow('Unbekanntes Argument');
  });
});

describe('loadContentFiles', () => {
  it('liest beide Ordner, meldet kaputtes JSON und fremde Dateien, ignoriert versteckte', () => {
    const dir = contentDir({
      'exercises/kniebeuge-test.json': exercise(),
      'exercises/kaputt.json': '{ "id": ',
      'exercises/notiz.txt': 'x',
      'exercises/.gitkeep': '',
      'plan-templates/leer.json': '{}',
    });
    const { files, strayFiles } = loadContentFiles(dir);
    expect(files.map((f) => [f.kind, f.fileName, f.jsonError === undefined])).toEqual([
      ['exercise', 'kaputt.json', false],
      ['exercise', 'kniebeuge-test.json', true],
      ['plan_template', 'leer.json', true],
    ]);
    expect(strayFiles).toEqual(['exercises/notiz.txt']);
  });

  it('fehlende Ordner = keine Inhalte', () => {
    expect(loadContentFiles(contentDir({})).files).toEqual([]);
  });

  it('Vergleichsstand je Datei über readPrevious (kaputter Vorstand wird ignoriert)', () => {
    const dir = contentDir({
      'exercises/kniebeuge-test.json': exercise(),
      'exercises/zweite-uebung.json': exercise({ id: 'zweite-uebung' }),
    });
    const { files } = loadContentFiles(dir, {
      repoRoot: dir,
      readPrevious: (path) =>
        path === join('exercises', 'kniebeuge-test.json') ? '{"version": 1}' : '{kaputt',
    });
    expect(files[0]?.previous).toEqual({ version: 1 });
    expect('previous' in (files[1] ?? {})).toBe(false);
  });
});

describe('runValidate', () => {
  it('Entwurf mit rotem Fehler: Bericht, aber Exit 0', () => {
    const dir = contentDir({
      'exercises/kniebeuge-test.json': exercise({ equipment_ids: ['hovercraft'] }),
    });
    const result = runValidate(['--content', dir], dir);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('ROT  Ü2');
    expect(result.output).toContain('(Entwurf)');
    expect(result.output).toContain('✔ Bestanden.');
    expect(result.output).toContain('Versionen: nicht geprüft');
  });

  it('freigegebener Inhalt mit rotem Fehler: Exit 1', () => {
    const dir = contentDir({
      'exercises/kniebeuge-test.json': exercise({
        status: 'published',
        meta: REVIEWED,
        tips_de: ['Diese Übung heilt alles.'],
      }),
    });
    const result = runValidate(['--content', dir], dir);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('ROT  Ü6');
    expect(result.output).toContain('[blockiert]');
    expect(result.output).toContain('✘ Nicht bestanden');
  });

  it('Schemafehler auch bei Entwürfen: Exit 1', () => {
    const dir = contentDir({ 'exercises/kniebeuge-test.json': exercise({ difficulty: 5 }) });
    expect(runValidate(['--content', dir], dir).exitCode).toBe(1);
  });

  it('fremde Datei im Inhaltsordner: Exit 1', () => {
    const dir = contentDir({ 'plan-templates/vorlage.yaml': 'x: 1' });
    const result = runValidate(['--content', dir], dir);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('plan-templates/vorlage.yaml: keine JSON-Datei');
  });

  it('gelbe Hinweise allein: Exit 0', () => {
    const dir = contentDir({
      'exercises/kniebeuge-test.json': exercise({ equipment_ids: ['barbell'] }),
    });
    const result = runValidate(['--content', dir], dir);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('GELB Ü5');
    expect(result.output).toContain('1 gelbe Hinweise');
  });

  it('nicht vorhandener Vergleichsstand: Hinweis statt Fehler', () => {
    const dir = contentDir({ 'exercises/kniebeuge-test.json': exercise() });
    const result = runValidate(['--content', dir, '--base', 'gibt-es-nicht/xyz'], dir);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Vergleichsstand „gibt-es-nicht/xyz“ nicht verfügbar');
  });
});

describe('Versionsregel mit git', () => {
  function git(dir: string, ...args: string[]) {
    execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.test', ...args], {
      cwd: dir,
      stdio: 'ignore',
    });
  }

  it('geänderter freigegebener Inhalt ohne höhere Version → Exit 1; mit höherer Version → Exit 0', () => {
    const published = exercise({ status: 'published', meta: REVIEWED });
    const dir = contentDir({ 'content/exercises/kniebeuge-test.json': published });
    git(dir, 'init', '-q');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'Stand');
    const file = join(dir, 'content/exercises/kniebeuge-test.json');

    writeFileSync(file, JSON.stringify({ ...published, name_de: 'Kniebeuge (neu)' }));
    const changed = runValidate(['--base', 'HEAD'], dir);
    expect(changed.output).toContain('Versionen: Vergleich mit HEAD');
    expect(changed.output).toContain('VERSION');
    expect(changed.exitCode).toBe(1);

    writeFileSync(file, JSON.stringify({ ...published, name_de: 'Kniebeuge (neu)', version: 2 }));
    expect(runValidate(['--base', 'HEAD'], dir).exitCode).toBe(0);

    expect(
      gitPreviousReader(dir, 'HEAD')?.('content/exercises/gibt-es-nicht.json'),
    ).toBeUndefined();
  });
});

describe('Berichte', () => {
  it('Markdown-Zusammenfassung mit Tabelle bzw. „Keine Befunde“', () => {
    const empty = {
      result: { exercises: [], templates: [], issues: [], blocking: [] },
      strayFiles: [],
      versionNote: 'nicht geprüft',
    };
    expect(formatMarkdownSummary(empty)).toContain('### ✅ Inhalte geprüft');
    expect(formatMarkdownSummary(empty)).toContain('Keine Befunde.');
    expect(formatReport(empty)).toContain('Keine Befunde.');

    const issue = {
      rule: 'Ü1' as const,
      severity: 'error' as const,
      kind: 'exercise' as const,
      id: 'x-y-z',
      status: null,
      message: 'Text mit | Strich',
    };
    const failing = {
      ...empty,
      result: { ...empty.result, issues: [issue], blocking: [issue] },
      strayFiles: ['exercises/a.txt'],
    };
    const markdown = formatMarkdownSummary(failing);
    expect(markdown).toContain('### ❌ Inhalte: blockierende Fehler');
    expect(markdown).toContain('| 🔴 Ü1 | Übung `x-y-z` | – | Text mit \\| Strich |');
    expect(markdown).toContain('Keine JSON-Dateien: exercises/a.txt');
    expect(formatReport(failing)).toContain('Ergebnis: 2 blockierende Fehler');
  });
});

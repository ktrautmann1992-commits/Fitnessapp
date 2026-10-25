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

  it('Probelauf-Inhalt als Entwurf: Exit 0; freigegeben: Exit 1 (Regel PROBELAUF)', () => {
    const dryMeta = {
      ...META,
      origin: 'batch',
      model: 'probelauf-ohne-ki',
      batch_id: 'probelauf_a1b2c3',
    };
    const draftDir = contentDir({
      'exercises/probelauf-wandsitzen.json': exercise({
        id: 'probelauf-wandsitzen',
        meta: dryMeta,
      }),
    });
    expect(runValidate(['--content', draftDir], draftDir).exitCode).toBe(0);

    const publishedDir = contentDir({
      'exercises/probelauf-wandsitzen.json': exercise({
        id: 'probelauf-wandsitzen',
        status: 'published',
        meta: { ...dryMeta, reviewed_by: 'KT', reviewed_at: '2026-10-03' },
      }),
    });
    const result = runValidate(['--content', publishedDir], publishedDir);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('ROT  PROBELAUF');
    expect(result.output).toContain('[blockiert]');
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

  it('Übungsbilder: Bild ohne Lizenz = blockierender Fehler; mit Lizenz und Bilddatei Exit 0', () => {
    const image = {
      kind: 'start_position',
      file: 'kniebeuge-test-start.webp',
      alt_de: 'Person steht aufrecht, Füße schulterbreit, Arme vor der Brust.',
      origin: 'commissioned',
      license: { name: 'Werkvertrag Illustration vom 01.11.2026', attribution_de: null },
      source: { creator: 'Beispiel-Illustratorin', obtained_on: '2026-11-01' },
      reviewed_by: null,
    };
    const withoutLicense = Object.fromEntries(
      Object.entries(image).filter(([key]) => key !== 'license'),
    );
    const root = contentDir({
      'content/exercises/kniebeuge-test.json': exercise(),
      'content/exercise-media/kniebeuge-test.json': {
        exercise_id: 'kniebeuge-test',
        images: [withoutLicense],
      },
      'apps/mobile/assets/exercise-media/kniebeuge-test-start.webp': 'x',
    });
    const failing = runValidate(['--content', join(root, 'content')], root);
    expect(failing.exitCode).toBe(1);
    expect(failing.output).toContain(
      'exercise-media/kniebeuge-test.json: images.0.license: Lizenzangabe fehlt',
    );

    const ok = contentDir({
      'content/exercises/kniebeuge-test.json': exercise(),
      'content/exercise-media/kniebeuge-test.json': {
        exercise_id: 'kniebeuge-test',
        images: [image],
      },
      'apps/mobile/assets/exercise-media/kniebeuge-test-start.webp': 'x',
    });
    expect(runValidate(['--content', join(ok, 'content')], ok).exitCode).toBe(0);

    // Bilddatei fehlt → blockierend.
    const missing = contentDir({
      'content/exercises/kniebeuge-test.json': exercise(),
      'content/exercise-media/kniebeuge-test.json': {
        exercise_id: 'kniebeuge-test',
        images: [image],
      },
    });
    const missingResult = runValidate(['--content', join(missing, 'content')], missing);
    expect(missingResult.exitCode).toBe(1);
    expect(missingResult.output).toContain('kniebeuge-test-start.webp fehlt');
  });

  it('Supplemente (SU2): Ordner supplements/ wird geprüft – Entwurf mit SK3 Exit 0, Schemafehler (SK1) und fremde Datei Exit 1', () => {
    const supplement = {
      id: 'bcaa',
      version: 1,
      status: 'draft',
      name_de: 'BCAA',
      evidence_level: 'c',
      category: 'sport',
      summary_de: 'BCAA sind Aminosäuren, die in eiweißhaltigen Lebensmitteln stecken.',
      how_to_de: null,
      claim_ids: [],
      sources: [],
      not_recommended_reason_de: 'Das steigert nichts, deshalb keine Empfehlung.',
      meta: META,
    };
    const draft = runValidate(
      ['--content', contentDir({ 'supplements/bcaa.json': supplement })],
      tmpdir(),
    );
    expect(draft.exitCode).toBe(0);
    expect(draft.output).toContain('Supplemente: 1 (1 Entwürfe');
    expect(draft.output).toContain('ROT  SK3     Supplement bcaa (Entwurf)');
    const schema = runValidate(
      ['--content', contentDir({ 'supplements/bcaa.json': { ...supplement, dose_g: 5 } })],
      tmpdir(),
    );
    expect(schema.exitCode).toBe(1);
    expect(schema.output).toContain('SK1');
    const stray = runValidate(
      ['--content', contentDir({ 'supplements/notiz.txt': 'x' })],
      tmpdir(),
    );
    expect(stray.exitCode).toBe(1);
    expect(stray.output).toContain('supplements/notiz.txt: keine JSON-Datei');
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

  it('--content in einem anderen Repo: Bilddateien werden in dessen Checkout gesucht (sources-integrity)', () => {
    const image = {
      kind: 'start_position',
      file: 'kniebeuge-test-start.svg',
      alt_de: 'Person steht aufrecht, Füße schulterbreit, Arme vor der Brust.',
      origin: 'own_work',
      license: { name: 'eigene Illustration', attribution_de: null },
      source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
      reviewed_by: null,
    };
    // „main“-Checkout (Code) ohne die neue Bilddatei.
    const codeRoot = contentDir({ 'content/exercises/.keep': '' });
    git(codeRoot, 'init', '-q');
    // PR-Stand als Daten: Inhalt und Bilddatei.
    const dataRoot = contentDir({
      'content/exercises/kniebeuge-test.json': exercise(),
      'content/exercise-media/kniebeuge-test.json': {
        exercise_id: 'kniebeuge-test',
        images: [image],
      },
      'apps/mobile/assets/exercise-media/kniebeuge-test-start.svg': '<svg/>',
    });
    git(dataRoot, 'init', '-q');
    const result = runValidate(['--content', join(dataRoot, 'content')], codeRoot);
    expect(result.output).not.toContain('kniebeuge-test-start.svg fehlt');
    expect(result.exitCode).toBe(0);
  });

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
      result: {
        exercises: [],
        templates: [],
        foods: [],
        recipes: [],
        mealPrepPlans: [],
        guides: [],
        substitutions: [],
        packageSizes: [],
        supplements: [],
        workouts: [],
        issues: [],
        blocking: [],
      },
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
    expect(markdown).toContain('Datei-Fehler: exercises/a.txt');
    expect(formatReport(failing)).toContain('Ergebnis: 2 blockierende Fehler');
  });
});

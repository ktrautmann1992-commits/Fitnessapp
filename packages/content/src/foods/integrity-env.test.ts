import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  findSymlinks,
  integrityDepsFromEnv,
  loadSourcesFromRef,
  SOURCES_TS_PATH,
} from './integrity-env';
import { SOURCES } from './sources';

const dirs: string[] = [];

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'integrity-env-'));
  dirs.push(dir);
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.org');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  return dir;
}

function write(dir: string, path: string, text: string) {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
}

function git(dir: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const realSources = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'sources.ts'),
  'utf8',
);

describe('Allowlist aus main laden', () => {
  it('liest sources.ts aus dem git-Stand von main, nicht aus dem Arbeitsstand', async () => {
    const dir = repo();
    write(dir, SOURCES_TS_PATH, realSources);
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'main');
    git(dir, 'checkout', '-q', '-b', 'pr');
    write(
      dir,
      SOURCES_TS_PATH,
      realSources.replace(/https:\/\/www\.openagrar\.de[^']*/, 'https://example.com/boese.xlsx'),
    );
    git(dir, 'commit', '-q', '-am', 'URL umgebogen');
    const loaded = await loadSourcesFromRef(dir, 'main');
    expect(loaded?.map((s) => s.url)).toEqual(SOURCES.map((s) => s.url));
    const fromPr = await loadSourcesFromRef(dir, 'pr');
    expect(fromPr?.[0]?.url).toBe('https://example.com/boese.xlsx');
  });

  it('fehlt sources.ts auf main → null; Imports in sources.ts → Fehler', async () => {
    const dir = repo();
    write(dir, 'README.md', 'x');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'leer');
    expect(await loadSourcesFromRef(dir, 'main')).toBeNull();
    write(dir, SOURCES_TS_PATH, `import { X } from './andere';\n${realSources}`);
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'mit import');
    await expect(loadSourcesFromRef(dir, 'main')).rejects.toThrow(/keine Imports/);
  });
});

describe('integrityDepsFromEnv', () => {
  it('Branch: geänderte Pfade und Commits gegen main; ohne Token ist kein Commit verifiziert', async () => {
    const dir = repo();
    write(dir, 'README.md', 'x');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'start');
    git(dir, 'checkout', '-q', '-b', 'foods-import/1');
    write(dir, 'content/sources/bls/4.0/extract.csv', 'a\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'auszug');
    const sha = git(dir, 'rev-parse', 'HEAD').trim();
    const deps = integrityDepsFromEnv(dir, {
      INTEGRITY_BASE: 'main',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_HEAD_REF: 'foods-import/1',
      GITHUB_REPOSITORY: 'owner/repo',
      PR_HEAD_REPO: 'owner/repo',
    });
    expect(deps.headIsFork).toBe(false);
    expect(await deps.importRunProvenance('1')).toMatchObject({ ok: false });
    expect(deps.branch).toBe('foods-import/1');
    expect(deps.changedPaths()).toEqual(['content/sources/bls/4.0/extract.csv']);
    expect(deps.commitsTouching(['content/sources/'])).toEqual([sha]);
    expect(deps.listSourceDirs()).toEqual(['content/sources/bls/4.0']);
    expect(deps.listFiles('content/sources/bls/4.0')).toEqual(['extract.csv']);
    expect(deps.readFile('content/sources/bls/4.0/extract.csv')?.toString()).toBe('a\n');
    expect(await deps.commitProvenance(sha)).toEqual({
      ok: false,
      reason: 'kein GITHUB_TOKEN – Herkunft nicht prüfbar',
    });
  });

  it('PR-Modus über das Ereignis: Fork-PR vom Branch „main“ wird verglichen und als Fork erkannt (S1)', () => {
    const dir = repo();
    write(dir, 'README.md', 'x');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'start');
    const deps = integrityDepsFromEnv(dir, {
      INTEGRITY_BASE: 'main',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_HEAD_REF: 'main',
      GITHUB_REF_NAME: '42/merge',
      GITHUB_REPOSITORY: 'owner/repo',
      PR_HEAD_REPO: 'angreifer/repo',
    });
    expect(deps.branch).toBe('main');
    expect(deps.changedPaths()).toEqual([]);
    expect(deps.headIsFork).toBe(true);
    // Fehlt das Kopf-Repository im PR, gilt vorsichtig „Fork“.
    expect(
      integrityDepsFromEnv(dir, { GITHUB_EVENT_NAME: 'pull_request_target', GITHUB_HEAD_REF: 'x' })
        .headIsFork,
    ).toBe(true);
  });

  it('main bzw. wöchentlich: kein Vergleich (volle Prüfung)', () => {
    const dir = repo();
    expect(integrityDepsFromEnv(dir, { GITHUB_REF_NAME: 'main' }).changedPaths()).toBeNull();
    expect(
      integrityDepsFromEnv(dir, {
        GITHUB_REF_NAME: 'x',
        GITHUB_EVENT_NAME: 'schedule',
      }).changedPaths(),
    ).toBeNull();
    expect(integrityDepsFromEnv(dir, {}).listSourceDirs()).toEqual([]);
  });
});

describe('symbolische Links (GK2)', () => {
  it('findet Links unter content/sources, content/foods, content/food-mapping – auch verschachtelt', () => {
    const dir = repo();
    write(dir, 'content/foods/apfel.json', '{}');
    write(dir, 'content/sources/bls/4.0/extract.csv', 'a\n');
    write(dir, 'content/exercises/x.json', '{}');
    symlinkSync('/etc/hostname', join(dir, 'content/foods/fremd.json'));
    symlinkSync('../../../exercises', join(dir, 'content/sources/bls/4.0/ordner'));
    mkdirSync(join(dir, 'content/food-mapping'), { recursive: true });
    symlinkSync('../foods', join(dir, 'content/food-mapping/link'));
    symlinkSync('/etc/hostname', join(dir, 'content/exercises/egal.json'));
    expect(findSymlinks(dir)).toEqual([
      'content/sources/bls/4.0/ordner',
      'content/foods/fremd.json',
      'content/food-mapping/link',
    ]);
    expect(integrityDepsFromEnv(dir, {}).symlinks()).toHaveLength(3);
  });
});

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Strukturtest der Import-Sperre (docs/PLAN-PHASE-6.md 5 und 9.3, Wächter S1) – Teil aus SU1:
 * 1. `supplement-ids.ts` ist ein Blatt ohne Importe.
 * 2. Kein `index.ts` (keine Barrel-Datei) in `supplements/`.
 * 3. Importe in `supplements/**` nur mit direktem Dateipfad: kein Ordner (`..`, `.`), kein `index`, nicht der eigene
 *    Paketname, `import()` nur mit festem Text; außerhalb des Pakets nur `zod`.
 * 4. Transitiver Importgraph (TypeScript-Auflösung, auch `export … from`, `import()` und `require()`): Kein
 *    erreichbares Ziel liegt in `affiliate/**` oder `retail/**` (Händler-Anbindung) – die Empfehlung erreicht nie
 *    Affiliate-Code.
 * 5. Test des Tests: Eine absichtlich verbotene Datei unter `__fixtures__` wird erkannt.
 * Den vollständigen Test über Core, `apps/mobile` und `apps/web` (einziger Treffpunkt `compose.ts`) bringt SU5.
 */

const SRC = join(import.meta.dirname, '..');
const SUPPLEMENTS = join(SRC, 'supplements');
const FIXTURES = join(SUPPLEMENTS, '__fixtures__');
const FORBIDDEN_DIRS = ['affiliate', 'retail'].map((name) => join(SRC, name) + sep);
const ALLOWED_PACKAGES = new Set(['zod']);
/** Tests dürfen zusätzlich das Test-Werkzeug importieren. */
const ALLOWED_TEST_PACKAGES = new Set(['zod', 'vitest']);

const compilerOptions: ts.CompilerOptions = {
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
};

function sourceFiles(dir: string, { tests }: { tests: boolean }): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__fixtures__') continue;
      files.push(...sourceFiles(path, { tests }));
    } else if (/\.tsx?$/.test(entry.name) && (tests || !/\.test\.tsx?$/.test(entry.name))) {
      files.push(path);
    }
  }
  return files;
}

/**
 * `import()`/`require()` nur mit festem Text: eine Variable oder ein Template-Literal mit `${…}` wird gemeldet
 * (Wächter SU1, Befund 9).
 */
function hasDynamicImport(text: string): boolean {
  return (
    /\b(?:import|require)\s*\(\s*[^'"`\s)]/.test(text) ||
    /\b(?:import|require)\s*\(\s*`[^`]*\$\{/.test(text)
  );
}

interface ImportRef {
  readonly specifier: string;
  readonly resolved: string | null;
}

function importsOf(file: string): ImportRef[] {
  const text = readFileSync(file, 'utf8');
  const info = ts.preProcessFile(text, true, true);
  const refs = info.importedFiles.map((ref) => ref.fileName);
  if (hasDynamicImport(text)) {
    refs.push('<dynamic>');
  }
  return refs.map((specifier) => ({
    specifier,
    resolved:
      specifier === '<dynamic>'
        ? null
        : (ts.resolveModuleName(specifier, file, compilerOptions, ts.sys).resolvedModule
            ?.resolvedFileName ?? null),
  }));
}

/** Verstöße gegen Regel 3 für eine Datei. */
function directPathViolations(file: string): string[] {
  const problems: string[] = [];
  for (const { specifier, resolved } of importsOf(file)) {
    const where = `${relative(SRC, file)}: ${specifier}`;
    if (specifier === '<dynamic>') {
      problems.push(`${where} (import() ohne festen Text)`);
      continue;
    }
    if (!specifier.startsWith('.')) {
      const allowed = /\.test\.tsx?$/.test(file) ? ALLOWED_TEST_PACKAGES : ALLOWED_PACKAGES;
      if (!allowed.has(specifier)) {
        problems.push(`${where} (Paket)`);
      }
      continue;
    }
    if (/(^|\/)\.{1,2}$/.test(specifier) || /(^|\/)index(\.tsx?)?$/.test(specifier)) {
      problems.push(`${where} (Ordner/index)`);
      continue;
    }
    if (resolved === null) {
      problems.push(`${where} (nicht auflösbar)`);
      continue;
    }
    const target = join(dirname(file), specifier);
    if (existsSync(target) && statSync(target).isDirectory()) {
      problems.push(`${where} (Ordner)`);
    }
  }
  return problems;
}

/** Alle transitiv erreichbaren Dateien im Paket (Regel 4). */
function reachable(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const { resolved } of importsOf(file)) {
      if (resolved && !resolved.includes(`${sep}node_modules${sep}`)) queue.push(resolved);
    }
  }
  return seen;
}

function forbiddenTargets(files: Iterable<string>): string[] {
  return [...files]
    .filter((file) => FORBIDDEN_DIRS.some((dir) => file.startsWith(dir)))
    .map((file) => relative(SRC, file));
}

describe('Strukturtest Supplement-Modul (Wächter S1, SU1-Teil)', () => {
  const files = sourceFiles(SUPPLEMENTS, { tests: false });

  it('findet die Supplement-Dateien (sonst prüft der Test nichts)', () => {
    const names = files.map((file) => relative(SUPPLEMENTS, file)).sort();
    for (const name of [
      'claims.ts',
      'dosage.ts',
      'eligibility.ts',
      'inputs.ts',
      'notices.ts',
      'protein-gap.ts',
      'schedule.ts',
      'screening.ts',
      'text-rules.ts',
    ]) {
      expect(names).toContain(name);
    }
  });

  it('supplement-ids.ts ist ein Blatt ohne Importe', () => {
    const leaf = join(SRC, 'supplement-ids.ts');
    expect(importsOf(leaf)).toEqual([]);
    expect(readFileSync(leaf, 'utf8')).not.toMatch(/\b(import|require)\b\s*[({'"]/);
  });

  it('kein index.ts in supplements/', () => {
    expect(readdirSync(SUPPLEMENTS).filter((name) => /^index\.tsx?$/.test(name))).toEqual([]);
  });

  it('Importe nur mit direktem Dateipfad (auch in Tests), außerhalb des Pakets nur zod', () => {
    const problems = sourceFiles(SUPPLEMENTS, { tests: true })
      .filter((file) => !file.endsWith('structure.test.ts'))
      .flatMap(directPathViolations);
    expect(problems).toEqual([]);
  });

  it('kein erreichbares Ziel in affiliate/** oder retail/** (transitiv)', () => {
    const graph = reachable(files);
    expect(graph.size).toBeGreaterThan(files.length);
    expect(forbiddenTargets(graph)).toEqual([]);
  });

  it('Test des Tests: Kette A → B → retail/provider.ts wird nur transitiv erkannt', () => {
    const chainA = join(FIXTURES, 'chain-a.ts');
    expect(directPathViolations(chainA)).toEqual([]);
    const graph = reachable([chainA]);
    expect(graph.has(join(FIXTURES, 'chain-b.ts'))).toBe(true);
    expect(forbiddenTargets(graph)).toContain(join('retail', 'provider.ts'));
  });

  it('Test des Tests: dynamische Importe (Variable, Template-Literal mit ${…}) werden gemeldet', () => {
    expect(hasDynamicImport("const m = await import('./claims');")).toBe(false);
    expect(hasDynamicImport('const m = await import(`./claims`);')).toBe(false);
    expect(hasDynamicImport('const m = await import(name);')).toBe(true);
    expect(hasDynamicImport('const m = await import(`../${dir}/provider`);')).toBe(true);
    expect(hasDynamicImport('const m = require(`./${name}`);')).toBe(true);
  });

  it('Test des Tests: die verbotene Fixture wird erkannt (Ordner-Import und transitiv retail/)', () => {
    const fixture = join(FIXTURES, 'forbidden-import.ts');
    expect(existsSync(fixture)).toBe(true);
    expect(directPathViolations(fixture).length).toBeGreaterThan(0);
    expect(forbiddenTargets(reachable([fixture])).length).toBeGreaterThan(0);
  });
});

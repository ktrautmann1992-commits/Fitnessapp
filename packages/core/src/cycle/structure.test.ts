import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Strukturtest „nie geteilt“ (docs/PLAN-PHASE-9.md 7.3 Punkt 6 und 7.6):
 * - kein console.* in packages/core/src/cycle und in den Zyklus-Dateien der App (keine Zyklusdaten in Logs),
 * - apps/web und packages/content rufen weder cycle_*-Funktionen noch das Zyklus-Modul auf,
 * - PDF-Bausteine (export/, print-*) und KI-Prompts kennen keine Zyklusdaten.
 */
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

function files(dir: string, filter: (path: string) => boolean): string[] {
  const result: string[] = [];
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return result;
  }
  for (const name of names) {
    if (name === 'node_modules' || name.startsWith('.') || name === 'dist') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) result.push(...files(path, filter));
    else if (filter(path)) result.push(path);
  }
  return result;
}

/** Quelltext ohne Kommentarzeilen (Kommentare dürfen „Zyklusdaten nie“ erwähnen). */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .join('\n');
}

const isSource = (path: string) => /\.(ts|tsx|mjs|js)$/.test(path) && !/\.test\./.test(path);

describe('Zyklusdaten: keine Logs, kein Teilen (Plan 7.6)', () => {
  it('kein console.* im Zyklus-Modul (Core und App)', () => {
    const cycleFiles = [
      ...files(join(ROOT, 'packages/core/src/cycle'), isSource),
      ...files(
        join(ROOT, 'apps/mobile/src'),
        (p) => isSource(p) && /cycle|zyklus/i.test(relative(ROOT, p)),
      ),
    ];
    expect(cycleFiles.length).toBeGreaterThan(5);
    for (const path of cycleFiles) {
      expect(code(path), relative(ROOT, path)).not.toMatch(/console\./);
    }
  });

  it('apps/web und packages/content nutzen keine Zyklus-Funktionen', () => {
    const forbidden =
      /cycle_entries|cycle_settings|save_cycle|get_cycle|export_my_cycle|cycleWarnings|cycleDayAssessment|derivePeriods|CycleEntry\b|from ['"].*\/cycle['"/]/;
    for (const base of ['apps/web', 'packages/content']) {
      for (const path of files(join(ROOT, base), isSource)) {
        expect(code(path), relative(ROOT, path)).not.toMatch(forbidden);
      }
    }
  });

  it('PDF-Bausteine und Druck kennen keine Zyklusdaten (B11)', () => {
    const printFiles = [
      ...files(join(ROOT, 'packages/core/src/export'), isSource),
      ...files(
        join(ROOT, 'apps/mobile/src/lib'),
        (p) => isSource(p) && /print/.test(relative(ROOT, p)),
      ),
    ];
    expect(printFiles.length).toBeGreaterThan(3);
    for (const path of printFiles) {
      expect(code(path), relative(ROOT, path)).not.toMatch(/cycle|zyklus/i);
    }
  });
});

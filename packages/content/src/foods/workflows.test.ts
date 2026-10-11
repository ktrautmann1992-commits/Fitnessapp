/**
 * Struktur der Prüf-Workflows (Wächter N2b, S2/S3/GB1/GK1): Pflicht-Check-Namen stimmen mit docs/SETUP.md J2
 * überein, sources-integrity-main führt nur Code von main aus und ist für foods-import-Branches per Hand startbar.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REAL_REPO_ROOT } from '../pipeline/test-helpers';
import { CHECK_WORKFLOWS } from './foods-import';

const read = (path: string) => readFileSync(join(REAL_REPO_ROOT, path), 'utf8');
const main = read('.github/workflows/sources-integrity-main.yml');
const ci = read('.github/workflows/ci.yml');
const setup = read('docs/SETUP.md');

describe('sources-integrity-main.yml', () => {
  it('läuft bei pull_request_target und per workflow_dispatch (foods-import startet ihn, GB1)', () => {
    expect(main).toMatch(/^ {2}pull_request_target:/m);
    expect(main).toMatch(/^ {2}workflow_dispatch:/m);
    expect(main).toContain("startsWith(github.ref, 'refs/heads/foods-import/')");
    expect(CHECK_WORKFLOWS).toEqual(['ci.yml', 'sources-integrity-main.yml']);
  });

  it('Code nur von main (Basis-SHA bzw. refs/heads/main), PR-Stand nur als Daten nach der Installation (GK1)', () => {
    expect(main).toContain(
      "ref: ${{ github.event_name == 'pull_request_target' && github.event.pull_request.base.sha || 'refs/heads/main' }}",
    );
    const install = main.indexOf('pnpm install --frozen-lockfile');
    const data = main.indexOf('path: pr-daten');
    expect(install).toBeGreaterThan(0);
    expect(data).toBeGreaterThan(install);
    expect(main).not.toMatch(/^\s+cache:/m);
    expect(main).not.toContain('secrets.');
    expect(main.match(/persist-credentials: false/g)).toHaveLength(2);
    expect(main).toMatch(/permissions:\n {2}contents: read\n {2}actions: read\n/);
    // Alle Actions auf Commit-SHA gepinnt.
    for (const line of main.split('\n').filter((l) => l.includes('uses:'))) {
      expect(line).toMatch(/@[0-9a-f]{40} # v\d+/);
    }
  });

  it('Pflicht-Check-Namen in docs/SETUP.md J2 stimmen exakt mit den Job-Namen überein (S3)', () => {
    expect(main).toContain('name: sources-integrity (Code von main)');
    expect(ci).toContain('name: Lint, Typen, Tests, Build');
    expect(ci).toMatch(/^ {4}name: sources-integrity$/m);
    for (const check of [
      'Lint, Typen, Tests, Build',
      'sources-integrity',
      'sources-integrity (Code von main)',
    ]) {
      expect(setup).toContain(`   - \`${check}\``);
    }
  });
});

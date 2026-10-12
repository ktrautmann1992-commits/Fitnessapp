/**
 * Aufruf: `pnpm content:import-alpha5` (Bericht, schreibt nichts), `-- --modus schreiben` (Dateien schreiben) bzw.
 * im Workflow `alpha5-import` `-- --modus pull-request`. Logik in import/alpha5.ts und import/alpha5-run.ts
 * (docs/PLAN-PHASE-5.md 19.2).
 */
import { main, repoRootOrFail, writeReport } from './cli';
import { githubApi } from './foods/github-api';
import { ALPHA5_MODES, type Alpha5Mode, runAlpha5Import } from './import/alpha5-run';

function modeArg(): Alpha5Mode {
  const index = process.argv.indexOf('--modus');
  if (index < 0) {
    return 'bericht';
  }
  const value = process.argv[index + 1];
  if (!(ALPHA5_MODES as readonly string[]).includes(value ?? '')) {
    throw new Error(`Modus: ${ALPHA5_MODES.map((m) => `„${m}“`).join(', ')}.`);
  }
  return value as Alpha5Mode;
}

void main('content:import-alpha5', async () => {
  const token = process.env.GITHUB_TOKEN?.trim();
  const repository = process.env.GITHUB_REPOSITORY?.trim();
  const result = await runAlpha5Import(modeArg(), {
    repoRoot: repoRootOrFail(),
    runId: process.env.GITHUB_RUN_ID ?? '0',
    refName: process.env.GITHUB_REF_NAME ?? '',
    ...(process.env.GITHUB_SHA ? { baseSha: process.env.GITHUB_SHA } : {}),
    ...(token && repository ? { api: githubApi(token, repository) } : {}),
  });
  writeReport(result.markdown);
  return result.exitCode;
});

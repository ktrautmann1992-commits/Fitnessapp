/**
 * Aufruf im Workflow `foods-import` (manuell, „Run workflow“): `pnpm --filter @fitnessapp/content foods:import
 * -- --source bls --version 4.0 --mode import|kandidaten`. Logik in foods/foods-import.ts.
 */
import { main, repoRootOrFail, writeReport } from './cli';
import { fetchSourceOriginal } from './foods/download';
import { runFoodsImport } from './foods/foods-import';
import { githubApi } from './foods/github-api';

function arg(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Argument --${name} fehlt.`);
  }
  return value;
}

void main('foods-import', async () => {
  const mode = arg('mode');
  if (mode !== 'import' && mode !== 'kandidaten') {
    throw new Error('Modus: „import“ oder „kandidaten“.');
  }
  const token = process.env.GITHUB_TOKEN?.trim();
  const repository = process.env.GITHUB_REPOSITORY?.trim();
  const result = await runFoodsImport(
    { source: arg('source'), version: arg('version'), mode },
    {
      repoRoot: repoRootOrFail(),
      runId: process.env.GITHUB_RUN_ID ?? '0',
      refName: process.env.GITHUB_REF_NAME ?? '',
      now: () => new Date(),
      download: (def) => fetchSourceOriginal(def),
      ...(token && repository ? { api: githubApi(token, repository) } : {}),
    },
  );
  writeReport(result.markdown);
  return result.exitCode;
});

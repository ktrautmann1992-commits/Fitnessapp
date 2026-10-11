/**
 * CI-Prüfung `sources-integrity` (ci.yml, Job sources-integrity): `pnpm --filter @fitnessapp/content
 * sources:integrity`. Logik in foods/integrity.ts, Anbindung an git/GitHub in foods/integrity-env.ts.
 */
import { main, repoRootOrFail, writeReport } from './cli';
import { checkSourcesIntegrity, formatIntegrityResult } from './foods/integrity';
import { integrityDepsFromEnv } from './foods/integrity-env';

void main('sources-integrity', async () => {
  // INTEGRITY_REPO_ROOT: PR-Stand als reine Daten (Workflow sources-integrity-main, pull_request_target) –
  // geprüft wird dann mit dem Code dieses Checkouts (main).
  const root = process.env.INTEGRITY_REPO_ROOT?.trim() || repoRootOrFail();
  const deps = integrityDepsFromEnv(root, process.env);
  const result = await checkSourcesIntegrity(deps);
  writeReport(formatIntegrityResult(result));
  return result.errors.length > 0 ? 1 : 0;
});

/**
 * Aufruf: `pnpm --filter @fitnessapp/content collect` (Workflow content-collect, alle 3 Stunden + per Hand).
 * ANTHROPIC_API_KEY ist nur für echte Läufe nötig; Probeläufe gehen ohne.
 */
import { apiClientFromEnv, main, repoRootOrFail, writeReport } from './cli';
import { runCollect } from './pipeline/collect';
import { systemTools } from './pipeline/tools';

void main('content-collect', async () => {
  const repoRoot = repoRootOrFail();
  const client = apiClientFromEnv();
  const result = await runCollect({
    repoRoot,
    tools: systemTools(repoRoot),
    now: () => new Date(),
    ...(client ? { client } : {}),
  });
  writeReport(result.markdown);
  return result.exitCode;
});

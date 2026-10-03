/**
 * Aufruf: `pnpm --filter @fitnessapp/content generate` (Workflow content-generate).
 * Eingaben über Umgebungsvariablen: CONTENT_KIND, CONTENT_SELECTION, CONTENT_COUNT, CONTENT_DRY_RUN,
 * dazu CONTENT_MODEL, CONTENT_EFFORT, CONTENT_MAX_USD (GitHub Variables) und ANTHROPIC_API_KEY (Secret).
 */
import { apiClientFromEnv, main, repoRootOrFail, writeReport } from './cli';
import { parseBooleanFlag, readPipelineSettings } from './pipeline/config';
import { runGenerate } from './pipeline/generate';
import { systemTools } from './pipeline/tools';

void main('content-generate', async () => {
  const repoRoot = repoRootOrFail();
  const dryRun = parseBooleanFlag(process.env.CONTENT_DRY_RUN);
  const client = dryRun ? undefined : apiClientFromEnv();
  const result = await runGenerate(
    {
      kind: process.env.CONTENT_KIND ?? '',
      selection: process.env.CONTENT_SELECTION ?? 'alle',
      count: Number(process.env.CONTENT_COUNT?.trim() || '10'),
      dryRun,
      settings: readPipelineSettings(process.env),
    },
    {
      repoRoot,
      tools: systemTools(repoRoot),
      now: () => new Date(),
      ...(client ? { client } : {}),
    },
  );
  writeReport(result.markdown);
  return result.status === 'cap_exceeded' ? 1 : 0;
});

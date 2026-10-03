/**
 * Aufruf: `pnpm --filter @fitnessapp/content seed` (Workflow content-seed).
 * Prüft immer zuerst alle Inhalte; spielt nur mit SUPABASE_URL + SUPABASE_SECRET_KEY ein.
 */
import { main, repoRootOrFail, writeReport } from './cli';
import { runSeed } from './pipeline/seed';

void main('content-seed', async () => {
  const result = await runSeed({
    repoRoot: repoRootOrFail(),
    env: {
      ...(process.env.SUPABASE_URL ? { url: process.env.SUPABASE_URL } : {}),
      ...(process.env.SUPABASE_SECRET_KEY ? { secretKey: process.env.SUPABASE_SECRET_KEY } : {}),
    },
  });
  writeReport(result.markdown);
  return result.exitCode;
});

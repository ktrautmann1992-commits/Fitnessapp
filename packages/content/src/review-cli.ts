/**
 * Aufruf: `pnpm --filter @fitnessapp/content review` (Workflow content-review).
 * Eingaben: REVIEW_IDS, REVIEW_STATUS (published|archived|draft), REVIEW_REVIEWER.
 */
import { main, repoRootOrFail, writeReport } from './cli';
import { runReview } from './pipeline/review';
import { systemTools } from './pipeline/tools';

void main('content-review', async () => {
  const repoRoot = repoRootOrFail();
  const result = await runReview(
    {
      ids: process.env.REVIEW_IDS ?? '',
      status: process.env.REVIEW_STATUS ?? '',
      reviewer: process.env.REVIEW_REVIEWER ?? '',
    },
    { repoRoot, tools: systemTools(repoRoot), now: () => new Date() },
  );
  writeReport(result.markdown);
  return result.exitCode;
});

/**
 * Aufruf: `pnpm --filter @fitnessapp/content review` (Workflow content-review).
 * Eingaben: REVIEW_KIND (`ids` = Inhalte per ID: Übungen/Vorlagen oder Rezepte/Meal-Prep-Pläne/Ratgeber,
 * `recipe` = Sammelfreigabe Rezepte pro Kategorie), REVIEW_IDS, REVIEW_STATUS (published|archived|draft),
 * REVIEW_REVIEWER, REVIEW_CATEGORY, REVIEW_EXPERT_REVIEWED und REVIEW_CONFIRM_ASSUMPTIONS (`true`/`false`).
 * Verteilung und Hinweise zu Eingaben ohne Wirkung: pipeline/review-ids.ts.
 */
import { main, repoRootOrFail, writeReport } from './cli';
import { runContentReview } from './pipeline/review-ids';
import { systemTools } from './pipeline/tools';

void main('content-review', async () => {
  const repoRoot = repoRootOrFail();
  const deps = { repoRoot, tools: systemTools(repoRoot), now: () => new Date() };
  const result = await runContentReview(
    {
      kind: process.env.REVIEW_KIND ?? 'ids',
      ids: process.env.REVIEW_IDS ?? '',
      status: process.env.REVIEW_STATUS ?? '',
      reviewer: process.env.REVIEW_REVIEWER ?? '',
      category: process.env.REVIEW_CATEGORY ?? '',
      expertReviewed: process.env.REVIEW_EXPERT_REVIEWED ?? 'false',
      confirmAssumptions: process.env.REVIEW_CONFIRM_ASSUMPTIONS ?? 'false',
    },
    deps,
  );
  writeReport(result.markdown);
  return result.exitCode;
});

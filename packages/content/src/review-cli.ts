/**
 * Aufruf: `pnpm --filter @fitnessapp/content review` (Workflow content-review).
 * Eingaben: REVIEW_KIND (`ids` = Inhalte per ID: Übungen/Vorlagen, Rezepte/Meal-Prep-Pläne/Ratgeber oder Supplemente,
 * `recipe` = Sammelfreigabe Rezepte pro Kategorie, `katalog` = „Katalog geprüft“ für Lebensmittel), REVIEW_IDS, REVIEW_STATUS (published|archived|draft),
 * REVIEW_REVIEWER, REVIEW_CATEGORY, REVIEW_EXPERT_REVIEWED und REVIEW_CONFIRM_ASSUMPTIONS (`true`/`false`).
 * Verteilung und Hinweise zu Eingaben ohne Wirkung: pipeline/review-ids.ts. Art `katalog` braucht zusätzlich
 * GITHUB_TOKEN, GITHUB_REPOSITORY und GITHUB_RUN_ID (verifizierter Commit über die GitHub-API).
 */
import { main, repoRootOrFail, writeReport } from './cli';
import { githubApi } from './foods/github-api';
import { runContentReview } from './pipeline/review-ids';
import { systemTools } from './pipeline/tools';

void main('content-review', async () => {
  const repoRoot = repoRootOrFail();
  const token = process.env.GITHUB_TOKEN?.trim();
  const repository = process.env.GITHUB_REPOSITORY?.trim();
  const deps = {
    repoRoot,
    tools: systemTools(repoRoot),
    now: () => new Date(),
    ...(token && repository ? { api: githubApi(token, repository) } : {}),
    ...(process.env.GITHUB_RUN_ID ? { runId: process.env.GITHUB_RUN_ID } : {}),
  };
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

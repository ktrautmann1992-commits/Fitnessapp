/**
 * Aufruf: `pnpm plan:examples` (im Hauptordner) bzw. als Schritt in `ci`. Schreibt die Beispielpläne in die
 * Zusammenfassung des Laufs (GITHUB_STEP_SUMMARY) und auf die Konsole. Logik in plan-examples.ts (getestet).
 */
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

import { exampleLibrary, renderPlanExamples, todayInBerlin } from './plan-examples';
import { gitRepoRoot, loadContentFiles } from './validate';

try {
  const root = gitRepoRoot(process.cwd()) ?? process.cwd();
  const { files } = loadContentFiles(join(root, 'content'));
  const markdown = renderPlanExamples(exampleLibrary(files), todayInBerlin());
  process.stdout.write(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  }
} catch (error) {
  console.error(`plan:examples: ${(error as Error).message}`);
  process.exitCode = 1;
}

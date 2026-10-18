/**
 * Aufruf: `pnpm adjust:examples` (im Hauptordner) bzw. als Schritt in `ci`. Schreibt die Tabelle
 * „Beispiel-Anpassungen“ (Live-Anpassung, Phase 4b) in die Zusammenfassung des Laufs (GITHUB_STEP_SUMMARY) und auf die
 * Konsole. Logik in adjust-examples.ts (getestet).
 */
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderAdjustExamples } from './adjust-examples';
import { exampleLibrary } from './plan-examples';
import { gitRepoRoot, loadContentFiles } from './validate';

try {
  const root = gitRepoRoot(process.cwd()) ?? process.cwd();
  const { files } = loadContentFiles(join(root, 'content'));
  const markdown = renderAdjustExamples(exampleLibrary(files));
  process.stdout.write(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  }
} catch (error) {
  console.error(`adjust:examples: ${(error as Error).message}`);
  process.exitCode = 1;
}

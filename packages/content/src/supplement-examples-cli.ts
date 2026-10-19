/**
 * Aufruf: `pnpm supplements:examples` (im Hauptordner) bzw. als Schritt in `ci`. Schreibt die Tabelle
 * „Beispiel-Empfehlungen (Supplemente)“ in die Zusammenfassung des Laufs (GITHUB_STEP_SUMMARY) und auf die Konsole.
 * Logik in supplement-examples.ts (getestet).
 */
import { appendFileSync } from 'node:fs';

import { renderSupplementExamples } from './supplement-examples';

try {
  const markdown = renderSupplementExamples();
  process.stdout.write(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  }
} catch (error) {
  console.error(`supplements:examples: ${(error as Error).message}`);
  process.exitCode = 1;
}

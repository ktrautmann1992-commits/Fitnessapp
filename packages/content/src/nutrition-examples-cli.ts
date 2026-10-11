/**
 * Aufruf: `pnpm nutrition:examples` (im Hauptordner) bzw. als Schritt in `ci`. Schreibt die Tabelle
 * „Beispiel-Ernährung“ in die Zusammenfassung des Laufs (GITHUB_STEP_SUMMARY) und auf die Konsole.
 * Logik in nutrition-examples.ts (getestet).
 */
import { appendFileSync } from 'node:fs';

import { renderNutritionExamples } from './nutrition-examples';

try {
  const markdown = renderNutritionExamples();
  process.stdout.write(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  }
} catch (error) {
  console.error(`nutrition:examples: ${(error as Error).message}`);
  process.exitCode = 1;
}

/**
 * Aufruf: `pnpm content:validate` (im Hauptordner) bzw. in GitHub Actions als Schritt in `ci`.
 * Logik in validate.ts (getestet in validate.test.ts).
 */
import { appendFileSync } from 'node:fs';

import { runValidate } from './validate';

try {
  const { exitCode, output, markdown } = runValidate(process.argv.slice(2), process.cwd());
  // Ausgabe für Menschen; enthält nur Inhalts-IDs und Regeln, keine Nutzerdaten.
  process.stdout.write(`${output}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  }
  process.exitCode = exitCode;
} catch (error) {
  console.error(`content:validate: ${(error as Error).message}`);
  process.exitCode = 1;
}

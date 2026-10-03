/**
 * Gemeinsames für die Kommandozeilen-Skripte der Pipeline (Aufruf aus GitHub Actions).
 */
import { appendFileSync } from 'node:fs';

import Anthropic from '@anthropic-ai/sdk';

import { gitRepoRoot } from './validate';
import type { ContentApiClient } from './pipeline/requests';

/** Bericht in die Konsole und – in GitHub Actions – in die Zusammenfassung des Laufs. */
export function writeReport(markdown: string): void {
  process.stdout.write(`${markdown}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  }
}

/** Anthropic-Client nur, wenn ANTHROPIC_API_KEY gesetzt ist (sonst undefined). */
export function apiClientFromEnv(): ContentApiClient | undefined {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return undefined;
  }
  return new Anthropic({ apiKey: key, maxRetries: 4 });
}

export function repoRootOrFail(): string {
  const root = gitRepoRoot(process.cwd());
  if (!root) {
    throw new Error('Kein git-Repository gefunden.');
  }
  return root;
}

/** Führt ein Skript aus und setzt den Exit-Code; Fehler landen verständlich in der Zusammenfassung. */
export async function main(name: string, run: () => Promise<number>): Promise<void> {
  try {
    process.exitCode = await run();
  } catch (error) {
    writeReport(`### ❌ ${name} fehlgeschlagen\n\n${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}

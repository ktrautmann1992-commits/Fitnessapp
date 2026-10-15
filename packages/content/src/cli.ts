/**
 * Gemeinsames für die Kommandozeilen-Skripte der Pipeline (Aufruf aus GitHub Actions).
 */
import { appendFileSync } from 'node:fs';

import { createGeminiClient, redactSecret } from './pipeline/provider/gemini';
import type { ContentApiClient } from './pipeline/requests';
import { gitRepoRoot } from './validate';

/**
 * Bericht in die Konsole und – in GitHub Actions – in die Zusammenfassung des Laufs. Der Gemini-Schlüssel wird
 * vorsichtshalber geschwärzt (GitHub maskiert Secrets zusätzlich selbst).
 */
export function writeReport(markdown: string): void {
  const text = redactSecret(markdown, process.env.GEMINI_API_KEY?.trim());
  process.stdout.write(`${text}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  }
}

/**
 * Gemini-Client nur, wenn GEMINI_API_KEY gesetzt ist (sonst undefined). Der Schlüssel geht nur an den Client –
 * nie in Merkdateien, Entwürfe, Pull Requests oder Logs.
 */
export function apiClientFromEnv(): ContentApiClient | undefined {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return undefined;
  }
  return createGeminiClient({ apiKey: key });
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

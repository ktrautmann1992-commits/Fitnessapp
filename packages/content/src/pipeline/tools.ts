/**
 * Zugriff auf git, GitHub-CLI (gh) und die Typprüfung – austauschbar für Tests.
 * Befehle laufen ohne Shell (execFileSync mit Argument-Liste): Eingaben aus Workflows können so keine
 * Befehle einschleusen.
 */
import { execFileSync } from 'node:child_process';

export interface PipelineTools {
  /** git-Befehl im Repository; liefert stdout, wirft bei Fehlern. */
  git(args: readonly string[]): string;
  /** gh-Befehl im Repository; liefert stdout, wirft bei Fehlern. */
  gh(args: readonly string[]): string;
  /** Typprüfung des Pakets packages/content; wirft bei Fehlern. */
  typecheck(): void;
}

function run(command: string, args: readonly string[], cwd: string): string {
  try {
    return execFileSync(command, [...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new Error(`${command} ${args.join(' ')} fehlgeschlagen${stderr ? `: ${stderr}` : ''}`, {
      cause: error,
    });
  }
}

export function systemTools(repoRoot: string): PipelineTools {
  return {
    git: (args) => run('git', args, repoRoot),
    gh: (args) => run('gh', args, repoRoot),
    typecheck: () => {
      run('pnpm', ['--filter', '@fitnessapp/content', 'typecheck'], repoRoot);
    },
  };
}

/** Bot-Identität für Commits aus Workflows (falls nicht schon gesetzt). */
export function ensureGitIdentity(tools: PipelineTools): void {
  let name: string;
  try {
    name = tools.git(['config', 'user.name']).trim();
  } catch {
    name = ''; // nicht gesetzt: git config liefert dann Exit-Code 1
  }
  if (name === '') {
    tools.git(['config', 'user.name', 'github-actions[bot]']);
    tools.git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  }
}

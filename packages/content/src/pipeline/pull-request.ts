/**
 * Prüfen und Pull Request öffnen – gemeinsam für content-collect und content-review
 * (docs/PLAN-PHASE-2.md Abschnitte 4 und 7):
 * 1. `content:validate` über ALLE Inhalte (mit Versionsregel gegen origin/main),
 * 2. Prettier-Prüfung der geänderten Dateien, 3. Typprüfung von packages/content.
 * Nur wenn alles grün ist: Commit, Push, Pull Request (gh pr create) und danach `ci` ausdrücklich starten
 * (Pull Requests mit dem GITHUB_TOKEN starten ci nicht von selbst). Workflows genehmigen NIE Pull Requests.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ContentIssue } from '@fitnessapp/core';

import {
  blockingCount,
  formatMarkdownSummary,
  type ReportInput,
  validateRepository,
} from '../validate';
import { BASE_BRANCH } from './config';
import { prettierUnformatted } from './files';
import type { PipelineTools } from './tools';

export interface PrChecks {
  readonly ok: boolean;
  readonly report: ReportInput;
  readonly unformatted: string[];
  readonly typecheckError: string | null;
  /** Markdown-Abschnitt „Prüfbericht“ für Pull Request und Zusammenfassung. */
  readonly markdown: string;
}

/** GitHub begrenzt den Pull-Request-Text auf 65.536 Zeichen. */
const MAX_BODY = 60_000;

export async function runPrChecks(
  repoRoot: string,
  changedPaths: readonly string[],
  tools: PipelineTools,
): Promise<PrChecks> {
  const report = validateRepository({ cwd: repoRoot, base: `origin/${BASE_BRANCH}` });
  const unformatted = await prettierUnformatted(repoRoot, changedPaths, (path) =>
    readFileSync(join(repoRoot, path), 'utf8'),
  );
  let typecheckError: string | null = null;
  try {
    tools.typecheck();
  } catch (error) {
    typecheckError = (error as Error).message.slice(0, 2000);
  }
  const blocking = blockingCount(report);
  const ok = blocking === 0 && unformatted.length === 0 && typecheckError === null;
  const markdown = [
    '#### Prüfungen vor dem Pull Request',
    '',
    `- content:validate: ${blocking === 0 ? '✅ keine blockierenden Fehler' : `❌ ${blocking} blockierende Fehler`}`,
    `- Formatierung (Prettier) der geänderten Dateien: ${
      unformatted.length === 0 ? '✅' : `❌ nicht formatiert: ${unformatted.join(', ')}`
    }`,
    `- Typprüfung (packages/content): ${typecheckError === null ? '✅' : `❌ ${typecheckError}`}`,
    '',
    formatMarkdownSummary(report),
  ].join('\n');
  return { ok, report, unformatted, typecheckError, markdown };
}

/** Befunde (rot/gelb) zu bestimmten Inhalten, z. B. den neuen Entwürfen. */
export function issuesFor(report: ReportInput, ids: ReadonlySet<string>): ContentIssue[] {
  return report.result.issues.filter((issue) => ids.has(issue.id));
}

export function truncateBody(body: string): string {
  return body.length <= MAX_BODY
    ? body
    : `${body.slice(0, MAX_BODY)}\n\n… (gekürzt – vollständiger Bericht in der Zusammenfassung des Workflow-Laufs)\n`;
}

/** Abschnitt „So testest du es am Handy“ (CLAUDE.md: Pflicht in jedem Pull-Request-Text). */
export const PHONE_TEST_SECTION = [
  '### So testest du es am Handy',
  '',
  '1. Unten im Pull Request auf den **Vercel-Vorschau-Link der Website** tippen (Kommentar von Vercel).',
  '2. Dort `/admin` öffnen (sobald der Redaktionsbereich da ist) und die Inhalte ansehen. Bis dahin: im Tab **Files changed** die JSON-Dateien lesen.',
  '3. Warten, bis der Haken **ci** grün ist (läuft automatisch an, der Workflow hat ihn gestartet).',
  '4. Passt alles: **Merge pull request**. Merge = Freigabe durch einen Menschen; Workflows genehmigen nie.',
].join('\n');

export interface OpenPrInput {
  readonly branch: string;
  readonly title: string;
  readonly body: string;
  readonly commitMessage: string;
  readonly paths: readonly string[];
}

export interface OpenPrResult {
  readonly url: string;
  /** null = ci gestartet; sonst Warnung. */
  readonly ciWarning: string | null;
}

/** Commit, Push, Pull Request, ci starten. */
export function commitPushAndOpenPr(tools: PipelineTools, input: OpenPrInput): OpenPrResult {
  tools.git(['add', '--', ...input.paths]);
  tools.git(['commit', '-m', input.commitMessage]);
  tools.git(['push', 'origin', `HEAD:refs/heads/${input.branch}`]);
  const dir = mkdtempSync(join(tmpdir(), 'content-pr-'));
  let url: string;
  try {
    const bodyFile = join(dir, 'body.md');
    writeFileSync(bodyFile, truncateBody(input.body));
    url = tools
      .gh([
        'pr',
        'create',
        '--base',
        BASE_BRANCH,
        '--head',
        input.branch,
        '--title',
        input.title,
        '--body-file',
        bodyFile,
      ])
      .trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  let ciWarning: string | null = null;
  try {
    tools.gh(['workflow', 'run', 'ci.yml', '--ref', input.branch]);
  } catch (error) {
    ciWarning = `ci konnte nicht gestartet werden (${(error as Error).message}). Bitte in Actions → ci → Run workflow den Branch ${input.branch} wählen.`;
  }
  return { url, ciWarning };
}

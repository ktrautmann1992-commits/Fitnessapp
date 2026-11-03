/**
 * Prüfen und Pull Request öffnen – gemeinsam für content-collect und content-review
 * (docs/PLAN-PHASE-2.md Abschnitte 4 und 7):
 * 1. `content:validate` über ALLE Inhalte (mit Versionsregel gegen origin/main),
 * 2. Prettier-Prüfung der geänderten Dateien, 3. Typprüfung von packages/content.
 * Nur wenn alles grün ist: Commit, Push, Pull Request (gh pr create) – mit BOT_PR_TOKEN startet ci von selbst, sonst
 * wird `ci` ausdrücklich gestartet (Pull Requests mit dem GITHUB_TOKEN brauchen „Approve and run“). Workflows
 * genehmigen NIE Pull Requests.
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

/**
 * `gh pr create` mit den Argumenten `createArgs` (ohne „pr create“) und danach dafür sorgen, dass ci läuft
 * (docs/SETUP.md Teil P):
 * - Mit BOT_PR_TOKEN (`tools.ghPr`): Pull Request im Namen der Token-Person – ci startet von selbst (pull_request),
 *   ohne „Approve and run“; kein zusätzlicher Start per workflow_dispatch (sonst doppelte Läufe).
 * - Ohne Token oder wenn er abgelehnt wird: Pull Request mit dem GITHUB_TOKEN und ci per workflow_dispatch starten.
 * Commit und Push laufen immer vorher mit dem GITHUB_TOKEN des Workflows.
 */
export function createPrAndStartCi(
  tools: PipelineTools,
  createArgs: readonly string[],
  branch: string,
): OpenPrResult {
  const warnings: string[] = [];
  if (tools.ghPr !== undefined) {
    try {
      const url = tools.ghPr(['pr', 'create', ...createArgs]).trim();
      return { url, ciWarning: null };
    } catch (error) {
      warnings.push(
        `BOT_PR_TOKEN wurde abgelehnt (${(error as Error).message}) – Pull Request mit dem GITHUB_TOKEN geöffnet. Token prüfen bzw. erneuern: docs/SETUP.md Teil P.`,
      );
    }
  }
  const url = tools.gh(['pr', 'create', ...createArgs]).trim();
  try {
    tools.gh(['workflow', 'run', 'ci.yml', '--ref', branch]);
  } catch (error) {
    warnings.push(
      `ci konnte nicht gestartet werden (${(error as Error).message}). Bitte in Actions → ci → Run workflow den Branch ${branch} wählen.`,
    );
  }
  return { url, ciWarning: warnings.length === 0 ? null : warnings.join(' ') };
}

/** Commit, Push, Pull Request, ci starten. */
export function commitPushAndOpenPr(tools: PipelineTools, input: OpenPrInput): OpenPrResult {
  tools.git(['add', '--', ...input.paths]);
  tools.git(['commit', '-m', input.commitMessage]);
  tools.git(['push', 'origin', `HEAD:refs/heads/${input.branch}`]);
  const dir = mkdtempSync(join(tmpdir(), 'content-pr-'));
  try {
    const bodyFile = join(dir, 'body.md');
    writeFileSync(bodyFile, truncateBody(input.body));
    return createPrAndStartCi(
      tools,
      [
        '--base',
        BASE_BRANCH,
        '--head',
        input.branch,
        '--title',
        input.title,
        '--body-file',
        bodyFile,
      ],
      input.branch,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

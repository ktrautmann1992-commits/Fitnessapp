/**
 * `content-collect` (docs/PLAN-PHASE-2.md Abschnitt 4, Schritt 2): findet offene Batch-Branches über ihre
 * Merkdatei, holt fertige Ergebnisse ab, schreibt gültige Antworten als Entwürfe, prüft alles und öffnet
 * einen Pull Request mit Prüfbericht und Kosten. Ohne offenen Lauf endet es sofort; Probeläufe brauchen
 * keinen Schlüssel.
 */
import type { ContentFileKind, ContentIssue } from '@fitnessapp/core';

import { CONTENT_FOLDERS } from '../validate';

import {
  batchRecordPath,
  type BatchRecord,
  batchRecordSchema,
  runNameFromBranch,
} from './batch-record';
import { BASE_BRANCH, BATCH_BRANCH_PREFIX, isoDateBerlin, zodMessage } from './config';
import { dryRunResults } from './dry-run';
import { contentPath, loadLibrary, writeJsonFile } from './files';
import { findKind, type LibraryContext } from './kinds';
import { actualCostUsd, formatUsd } from './pricing';
import { commitPushAndOpenPr, issuesFor, PHONE_TEST_SECTION, runPrChecks } from './pull-request';
import type { ContentApiClient } from './requests';
import { type BatchResult, NOT_SAVED_DE, processResults } from './results';
import { ensureGitIdentity, type PipelineTools } from './tools';

export interface CollectDeps {
  readonly repoRoot: string;
  readonly tools: PipelineTools;
  /** undefined = kein ANTHROPIC_API_KEY (echte Läufe werden dann übersprungen). */
  readonly client?: ContentApiClient;
  readonly now: () => Date;
}

export type BranchStatus =
  'pending' | 'no_key' | 'already_collected' | 'pr_opened' | 'blocked' | 'error';

export interface BranchOutcome {
  readonly branch: string;
  readonly status: BranchStatus;
  readonly markdown: string;
  readonly prUrl?: string;
  readonly saved?: readonly string[];
}

export interface CollectResult {
  /** 1 = mindestens ein Lauf wurde blockiert oder ist fehlgeschlagen. */
  readonly exitCode: number;
  readonly markdown: string;
  readonly outcomes: readonly BranchOutcome[];
}

/**
 * IDs, die inzwischen in main dazugekommen sind, gelten ebenfalls als belegt – so überschreibt ein später
 * abgeholter Batch keinen Inhalt, der nach dem Absenden in main gelandet ist.
 */
function withIdsFromMain(context: LibraryContext, tools: PipelineTools): LibraryContext {
  const takenIds = { ...context.takenIds };
  for (const kind of Object.keys(CONTENT_FOLDERS) as ContentFileKind[]) {
    const listing = tools.git([
      'ls-tree',
      '--name-only',
      `origin/${BASE_BRANCH}`,
      `content/${CONTENT_FOLDERS[kind]}/`,
    ]);
    const ids = new Set(takenIds[kind]);
    for (const line of listing.split('\n')) {
      const match = /\/([^/]+)\.json$/.exec(line.trim());
      if (match?.[1]) {
        ids.add(match[1]);
      }
    }
    takenIds[kind] = ids;
  }
  return { ...context, takenIds };
}

/** Batch-Branches auf origin (`git ls-remote`). */
export function listBatchBranches(tools: PipelineTools): string[] {
  const output = tools.git([
    'ls-remote',
    '--heads',
    'origin',
    `refs/heads/${BATCH_BRANCH_PREFIX}*`,
  ]);
  return output
    .split('\n')
    .map((line) => line.split('\t')[1]?.trim())
    .filter((ref): ref is string => ref !== undefined && ref.startsWith('refs/heads/'))
    .map((ref) => ref.slice('refs/heads/'.length))
    .sort();
}

function issueCell(issues: readonly ContentIssue[]): string {
  const red = issues.filter((issue) => issue.severity === 'error').length;
  const yellow = issues.length - red;
  if (issues.length === 0) {
    return '✅ keine Befunde';
  }
  const rules = [...new Set(issues.map((issue) => issue.rule))].join(', ');
  return `${red > 0 ? `🔴 ${red}` : ''}${red > 0 && yellow > 0 ? ' · ' : ''}${yellow > 0 ? `🟡 ${yellow}` : ''} (${rules})`;
}

async function fetchResults(
  record: BatchRecord,
  deps: CollectDeps,
): Promise<{ status: 'ended'; results: BatchResult[] } | { status: 'pending'; info: string }> {
  if (record.dry_run) {
    return { status: 'ended', results: dryRunResults(findKind(record.kind).dryRunFixtures()) };
  }
  const client = deps.client!;
  const batch = await client.messages.batches.retrieve(record.batch_id);
  if (batch.processing_status !== 'ended') {
    const c = batch.request_counts;
    return {
      status: 'pending',
      info: `Status ${batch.processing_status}: ${c.processing} in Arbeit, ${c.succeeded} fertig, ${c.errored} Fehler.`,
    };
  }
  const results: BatchResult[] = [];
  for await (const result of await client.messages.batches.results(record.batch_id)) {
    results.push(result);
  }
  return { status: 'ended', results };
}

/**
 * Lauf ist abgeholt, aber es gibt (z. B. nach einem Fehler von gh) keinen Pull Request: nachholen.
 * Geschlossene Pull Requests zählen als erledigt.
 */
function repairMissingPr(branch: string, record: BatchRecord, tools: PipelineTools): BranchOutcome {
  const count = tools
    .gh(['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number', '--jq', 'length'])
    .trim();
  if (count !== '0') {
    return {
      branch,
      status: 'already_collected',
      markdown: `- ⏭️ \`${branch}\`: schon abgeholt (Pull Request offen oder erledigt).`,
    };
  }
  const kind = findKind(record.kind);
  const url = tools
    .gh([
      'pr',
      'create',
      '--base',
      BASE_BRANCH,
      '--head',
      branch,
      '--title',
      record.dry_run
        ? `Probelauf: Neue Entwürfe (${kind.labelDe}) – nicht mergen`
        : `Neue Entwürfe: ${record.collected?.saved.length ?? 0} ${kind.labelDe}`,
      '--body',
      [
        `Nachgeholter Pull Request für Batch \`${record.batch_id}\` (der erste Versuch ist fehlgeschlagen).`,
        `Gespeichert: ${record.collected?.saved.join(', ') || 'nichts'}. Den Prüfbericht zeigt der ci-Lauf.`,
        '',
        PHONE_TEST_SECTION,
      ].join('\n'),
    ])
    .trim();
  let ciNote = '';
  try {
    tools.gh(['workflow', 'run', 'ci.yml', '--ref', branch]);
  } catch {
    ciNote = ' ⚠️ ci bitte von Hand starten.';
  }
  return {
    branch,
    status: 'pr_opened',
    prUrl: url,
    markdown: `- ✅ \`${branch}\`: Pull Request nachgeholt: ${url}.${ciNote}`,
  };
}

async function collectBranch(branch: string, deps: CollectDeps): Promise<BranchOutcome> {
  const { tools, repoRoot } = deps;
  const name = runNameFromBranch(branch);
  if (name === undefined) {
    return {
      branch,
      status: 'error',
      markdown: `- ❌ \`${branch}\`: Branch-Name passt nicht zum Schema \`content/batch-<Datum>-<kurz>\`.`,
    };
  }
  const recordPath = batchRecordPath(name);
  tools.git([
    'fetch',
    '--no-tags',
    'origin',
    `+refs/heads/${branch}:refs/remotes/origin/${branch}`,
  ]);
  let record: BatchRecord;
  try {
    const parsed = batchRecordSchema.safeParse(
      JSON.parse(tools.git(['show', `origin/${branch}:${recordPath}`])),
    );
    if (!parsed.success) {
      throw new Error(zodMessage(parsed.error));
    }
    record = parsed.data;
  } catch (error) {
    return {
      branch,
      status: 'error',
      markdown: `- ❌ \`${branch}\`: Merkdatei \`${recordPath}\` fehlt oder ist ungültig (${(error as Error).message}).`,
    };
  }
  if (record.status === 'collected') {
    return repairMissingPr(branch, record, tools);
  }
  if (!record.dry_run && deps.client === undefined) {
    return {
      branch,
      status: 'no_key',
      markdown: `- ⏭️ \`${branch}\`: übersprungen – GitHub-Secret ANTHROPIC_API_KEY fehlt (docs/SETUP.md Teil E).`,
    };
  }

  const fetched = await fetchResults(record, deps);
  if (fetched.status === 'pending') {
    return {
      branch,
      status: 'pending',
      markdown: `- ⏳ \`${branch}\`: Batch \`${record.batch_id}\` läuft noch. ${fetched.info} Nächster Versuch beim nächsten Lauf.`,
    };
  }

  const kind = findKind(record.kind);
  tools.git(['checkout', '-B', branch, `origin/${branch}`]);
  const context = withIdsFromMain(loadLibrary(repoRoot), tools);
  const today = isoDateBerlin(deps.now());
  const processed = processResults({ kind, record, results: fetched.results, context, today });

  const changed: string[] = [];
  for (const draft of processed.drafts) {
    const path = contentPath(kind.kind, draft.id);
    await writeJsonFile(repoRoot, path, draft.content);
    changed.push(path);
  }
  const costUsd = record.dry_run ? 0 : actualCostUsd(record.model, processed.usage);
  const updated: BatchRecord = {
    ...record,
    status: 'collected',
    collected: {
      at: deps.now().toISOString(),
      saved: processed.drafts.map((draft) => draft.id),
      not_saved: processed.notSaved.length,
      input_tokens:
        processed.usage.inputTokens +
        processed.usage.cacheWriteTokens +
        processed.usage.cacheReadTokens,
      output_tokens: processed.usage.outputTokens,
      actual_usd: Math.round(costUsd * 10000) / 10000,
    },
  };
  await writeJsonFile(repoRoot, recordPath, updated);
  changed.push(recordPath);

  const checks = await runPrChecks(repoRoot, changed, tools);
  const draftIds = new Set(processed.drafts.map((draft) => draft.id));
  const savedRows = processed.drafts.map(
    (draft) =>
      `| \`${draft.customId}\` | \`${draft.id}\` | ${issueCell(issuesFor(checks.report, new Set([draft.id])))} |`,
  );
  const notSavedRows = processed.notSaved.map(
    (item) =>
      `| \`${item.customId}\` | ${NOT_SAVED_DE[item.reason]} | ${item.detail.replace(/\|/g, '\\|') || '–'} |`,
  );
  const costLines = record.dry_run
    ? ['- Probelauf: keine KI, keine Kosten.']
    : [
        `- Geschätzt (schlimmster Fall): ${formatUsd(record.estimate.worst_case_usd)} · Deckel ${formatUsd(record.estimate.max_usd)}`,
        `- **Tatsächlich: ${formatUsd(costUsd)}** (Eingabe ${updated.collected!.input_tokens.toLocaleString('de-DE')} Token, Ausgabe inkl. Denken ${processed.usage.outputTokens.toLocaleString('de-DE')} Token, Batch-Preis ${record.model})`,
      ];
  const report = [
    `## ${record.dry_run ? 'Probelauf – ' : ''}Neue Entwürfe: ${kind.labelDe}`,
    '',
    record.dry_run
      ? '> **Probelauf ohne KI:** Beispiel-Antworten zum Testen der Pipeline (eine absichtlich ungültig, eine abgelehnt). **Bitte NICHT mergen** – ansehen und den Pull Request danach schließen.'
      : '> KI-Entwurf – fachlich prüfen. Alle Inhalte sind `draft`; freigeben geht danach mit **Actions → content-review**.',
    '',
    `Batch \`${record.batch_id}\` · Modell ${record.model} · Denktiefe ${record.effort} · ${record.requests.length} Anfragen · Auswahl „${record.selection}“`,
    '',
    `### Gespeichert (${processed.drafts.length})`,
    '',
    ...(savedRows.length > 0
      ? ['| custom_id | Datei-ID | Prüfung |', '| --- | --- | --- |', ...savedRows]
      : ['Keine gültigen Antworten.']),
    '',
    `### Nicht gespeichert (${processed.notSaved.length})`,
    '',
    ...(notSavedRows.length > 0
      ? ['| custom_id | Grund | Details |', '| --- | --- | --- |', ...notSavedRows]
      : ['Alles gespeichert.']),
    '',
    'Abgelehnte, abgeschnittene oder fehlerhafte Anfragen lassen sich mit einem neuen Lauf von content-generate wiederholen.',
    '',
    '### Kosten',
    '',
    ...costLines,
    '',
    checks.markdown,
  ].join('\n');

  if (!checks.ok) {
    tools.git(['reset', '--hard', `origin/${branch}`]);
    tools.git(['clean', '-fd', '--', 'content']);
    tools.git(['checkout', '--detach', `origin/${BASE_BRANCH}`]);
    return {
      branch,
      status: 'blocked',
      markdown: [
        `- ❌ \`${branch}\`: Prüfung rot – **kein Pull Request**. Meist hat ein freigegebener Inhalt in main einen roten Fehler; zuerst den beheben.`,
        '',
        report,
      ].join('\n'),
    };
  }

  const title = record.dry_run
    ? `Probelauf: Neue Entwürfe (${kind.labelDe}) – nicht mergen`
    : `Neue Entwürfe: ${processed.drafts.length} ${kind.labelDe} (${name})`;
  const body = [
    report,
    '',
    PHONE_TEST_SECTION,
    '',
    '---',
    'Automatisch erstellt von content-collect. Dieser Workflow öffnet nur Pull Requests und genehmigt nie.',
  ].join('\n');
  const pr = commitPushAndOpenPr(tools, {
    branch,
    title,
    body,
    commitMessage: `${record.dry_run ? 'Probelauf: ' : ''}Entwürfe aus Batch ${record.batch_id} (${processed.drafts.length} gespeichert, ${processed.notSaved.length} nicht gespeichert)`,
    paths: changed,
  });
  tools.git(['checkout', '--detach', `origin/${BASE_BRANCH}`]);
  return {
    branch,
    status: 'pr_opened',
    prUrl: pr.url,
    saved: [...draftIds],
    markdown: [
      `- ✅ \`${branch}\`: Pull Request ${pr.url} (${processed.drafts.length} Entwürfe, ${processed.notSaved.length} nicht gespeichert).${
        pr.ciWarning ? ` ⚠️ ${pr.ciWarning}` : ''
      }`,
      '',
      report,
    ].join('\n'),
  };
}

export async function runCollect(deps: CollectDeps): Promise<CollectResult> {
  const { tools } = deps;
  const branches = listBatchBranches(tools);
  if (branches.length === 0) {
    return {
      exitCode: 0,
      outcomes: [],
      markdown: '### ⏭️ content-collect: keine offenen Batch-Läufe\n\nNichts zu tun.\n',
    };
  }
  ensureGitIdentity(tools);
  tools.git([
    'fetch',
    '--no-tags',
    'origin',
    `+refs/heads/${BASE_BRANCH}:refs/remotes/origin/${BASE_BRANCH}`,
  ]);
  const outcomes: BranchOutcome[] = [];
  for (const branch of branches) {
    try {
      outcomes.push(await collectBranch(branch, deps));
    } catch (error) {
      try {
        tools.git(['reset', '--hard']);
        tools.git(['checkout', '--detach', `origin/${BASE_BRANCH}`]);
      } catch {
        // Aufräumen ist nur ein Versuch; der Fehler unten zählt.
      }
      outcomes.push({
        branch,
        status: 'error',
        markdown: `- ❌ \`${branch}\`: ${(error as Error).message}`,
      });
    }
  }
  const failed = outcomes.some(
    (outcome) => outcome.status === 'blocked' || outcome.status === 'error',
  );
  return {
    exitCode: failed ? 1 : 0,
    outcomes,
    markdown: ['### content-collect', '', ...outcomes.map((outcome) => outcome.markdown), ''].join(
      '\n',
    ),
  };
}

/**
 * `content-generate` (docs/PLAN-PHASE-2.md Abschnitt 4, Schritt 1): Anfragen bauen, Kosten schätzen,
 * Batch absenden, Arbeits-Branch mit Merkdatei anlegen – und sofort enden (kein Warten).
 *
 * Reihenfolge der Sicherungen: Auswahl prüfen → höchstens 200 Anfragen → Kostenschätzung (schlimmster Fall)
 * gegen CONTENT_MAX_USD → erst dann absenden. Bei Überschreitung wird NICHTS gesendet.
 */
import { randomBytes } from 'node:crypto';

import {
  batchBranch,
  batchRecordPath,
  type BatchRecord,
  batchRecordSchema,
  runName,
  shortId,
} from './batch-record';
import { BASE_BRANCH, isoDateBerlin, MAX_REQUESTS_PER_RUN, type PipelineSettings } from './config';
import { loadLibrary, writeJsonFile } from './files';
import { type ContentKindDefinition, findKind, type GenerationCell } from './kinds';
import { type CostEstimate, formatUsd } from './pricing';
import { buildBatchRequests, type ContentApiClient, estimateRun } from './requests';
import { parseSelection, planCells } from './selection';
import { ensureGitIdentity, type PipelineTools } from './tools';

export interface GenerateOptions {
  /** `exercises` oder `plan-templates`. */
  readonly kind: string;
  /** Matrix-Auswahl, z. B. `alle` oder `muscle_gain, 30-45`. */
  readonly selection: string;
  /** Höchstzahl der Anfragen (1–200). */
  readonly count: number;
  readonly dryRun: boolean;
  readonly settings: PipelineSettings;
}

export interface GenerateDeps {
  readonly repoRoot: string;
  readonly tools: PipelineTools;
  /** Nur ohne Probelauf nötig. */
  readonly client?: ContentApiClient;
  readonly now: () => Date;
  /** Zufällige Kurzkennung für Probeläufe (Test: fest). */
  readonly randomShort?: () => string;
}

export type GenerateResult =
  | { readonly status: 'nothing'; readonly markdown: string }
  | { readonly status: 'cap_exceeded'; readonly markdown: string; readonly estimate: CostEstimate }
  | {
      readonly status: 'submitted';
      readonly markdown: string;
      readonly branch: string;
      readonly record: BatchRecord;
    };

function describeEstimate(estimate: CostEstimate): string[] {
  return [
    `- Anfragen: ${estimate.requests} · max_tokens je Anfrage: ${estimate.maxTokensPerRequest.toLocaleString('de-DE')}`,
    `- Eingabe-Token (gezählt): ${estimate.inputTokens.toLocaleString('de-DE')} → ${formatUsd(estimate.inputUsd)}`,
    `- Ausgabe im schlimmsten Fall: ${formatUsd(estimate.worstCaseOutputUsd)}`,
    `- **Schlimmster Fall gesamt: ${formatUsd(estimate.worstCaseUsd)}** (Deckel CONTENT_MAX_USD: ${formatUsd(estimate.maxUsd)})`,
  ];
}

function validateCount(count: number): number {
  if (!Number.isInteger(count) || count < 1 || count > MAX_REQUESTS_PER_RUN) {
    throw new Error(
      `Anzahl: ganze Zahl von 1 bis ${MAX_REQUESTS_PER_RUN} erwartet (war: ${count}).`,
    );
  }
  return count;
}

function cellsToRecord(cells: readonly GenerationCell[]): BatchRecord['requests'] {
  return cells.map((cell) => ({
    custom_id: cell.customId,
    target_id: cell.targetId,
    label: cell.label,
    values: { ...cell.values },
  }));
}

export async function runGenerate(
  options: GenerateOptions,
  deps: GenerateDeps,
): Promise<GenerateResult> {
  const kind: ContentKindDefinition = findKind(options.kind);
  const count = validateCount(options.count);
  const selection = parseSelection(kind, options.selection);
  const { settings, dryRun } = options;
  const tools = deps.tools;
  if (!dryRun && !deps.client) {
    throw new Error('ANTHROPIC_API_KEY fehlt – ohne Schlüssel geht nur der Probelauf.');
  }

  // Immer auf dem aktuellen Stand von main aufsetzen (egal, von welchem Branch der Workflow startet).
  tools.git(['fetch', '--no-tags', 'origin', BASE_BRANCH]);
  tools.git(['checkout', '--detach', `origin/${BASE_BRANCH}`]);
  const context = loadLibrary(deps.repoRoot);

  let cells: GenerationCell[];
  const header: string[] = [];
  if (dryRun) {
    cells = kind.dryRunFixtures().map((fixture) => fixture.cell);
    header.push(
      `Probelauf (ohne KI, kostenlos): ${cells.length} feste Beispiel-Anfragen. Auswahl und Anzahl gelten nur für echte Läufe.`,
    );
  } else {
    const planned = planCells(kind, context, selection, count);
    cells = planned.cells;
    if (planned.present.length > 0) {
      header.push(
        `Übersprungen (existiert schon): ${planned.present.map((cell) => cell.targetId ?? cell.customId).join(', ')}`,
      );
    }
    if (planned.deferred > 0) {
      header.push(`Nicht angefragt wegen „Anzahl“ (${count}): ${planned.deferred} weitere Zellen.`);
    }
  }

  if (cells.length === 0) {
    return {
      status: 'nothing',
      markdown: [
        `### ⏭️ content-generate: nichts zu tun (${kind.labelDe})`,
        '',
        'Für diese Auswahl gibt es schon alle Inhalte.',
        ...header.map((line) => `- ${line}`),
        '',
      ].join('\n'),
    };
  }

  const requests = buildBatchRequests(kind, cells, context, settings);

  let estimate: CostEstimate;
  if (dryRun) {
    // Probelauf: keine API, keine Kosten.
    estimate = {
      requests: requests.length,
      inputTokens: 0,
      maxTokensPerRequest: kind.maxTokens,
      inputUsd: 0,
      worstCaseOutputUsd: 0,
      worstCaseUsd: 0,
      maxUsd: settings.maxUsd,
      withinCap: true,
    };
  } else {
    estimate = await estimateRun(deps.client!, kind, requests, settings);
    if (!estimate.withinCap) {
      return {
        status: 'cap_exceeded',
        estimate,
        markdown: [
          `### ❌ content-generate abgebrochen – Kostendeckel überschritten (${kind.labelDe})`,
          '',
          'Es wurde **nichts** an die API gesendet.',
          '',
          ...describeEstimate(estimate),
          '',
          'Weniger Anfragen wählen (Eingabe „Anzahl“ oder „Auswahl“) oder den Deckel über die GitHub-Variable `CONTENT_MAX_USD` anheben (docs/SETUP.md Teil E).',
          '',
        ].join('\n'),
      };
    }
  }

  const today = isoDateBerlin(deps.now());
  ensureGitIdentity(tools);

  let batchId: string;
  if (dryRun) {
    const random = deps.randomShort?.() ?? randomBytes(3).toString('hex');
    batchId = `probelauf_${random}`;
  } else {
    // Ab hier entstehen Kosten. Die Batch-ID steht sofort im Protokoll, falls danach etwas schiefgeht.
    const batch = await deps.client!.messages.batches.create({ requests });
    batchId = batch.id;
    console.warn(`content-generate: Batch ${batchId} angelegt.`);
  }

  const name = runName(today, shortId(batchId));
  const branch = batchBranch(name);
  const record = batchRecordSchema.parse({
    record_version: 1,
    status: 'submitted',
    dry_run: dryRun,
    batch_id: batchId,
    kind: kind.kind,
    model: dryRun ? 'probelauf-ohne-ki' : settings.model,
    effort: settings.effort,
    selection: options.selection.trim() || 'alle',
    count,
    created_at: deps.now().toISOString(),
    branch,
    estimate: {
      input_tokens: estimate.inputTokens,
      max_tokens_per_request: estimate.maxTokensPerRequest,
      worst_case_usd: Math.round(estimate.worstCaseUsd * 100) / 100,
      max_usd: settings.maxUsd,
    },
    requests: cellsToRecord(cells),
    collected: null,
  } satisfies BatchRecord);

  const recordPath = batchRecordPath(name);
  tools.git(['checkout', '-b', branch]);
  await writeJsonFile(deps.repoRoot, recordPath, record);
  tools.git(['add', '--', recordPath]);
  tools.git([
    'commit',
    '-m',
    `${dryRun ? 'Probelauf' : 'Batch'} ${kind.labelDe}: ${cells.length} Anfragen (${batchId})`,
  ]);
  try {
    tools.git(['push', '--set-upstream', 'origin', branch]);
  } catch (error) {
    throw new Error(
      `Branch ${branch} konnte nicht hochgeladen werden (${(error as Error).message}). ` +
        `Batch-ID ${batchId} – content-collect findet den Lauf so nicht; bitte Claude mit dieser ID um Hilfe bitten.`,
      { cause: error },
    );
  }

  return {
    status: 'submitted',
    branch,
    record,
    markdown: [
      dryRun
        ? `### ✅ Probelauf angelegt (${kind.labelDe}) – ohne KI, kostenlos`
        : `### ✅ Batch abgeschickt (${kind.labelDe})`,
      '',
      `- Batch: \`${batchId}\` · Modell: ${record.model} · Denktiefe: ${settings.effort}`,
      `- Arbeits-Branch: \`${branch}\` (Merkdatei \`${recordPath}\`)`,
      ...header.map((line) => `- ${line}`),
      ...(dryRun ? [] : describeEstimate(estimate)),
      '',
      '**Wie geht es weiter?** `content-collect` holt die Ergebnisse automatisch ab (alle 3 Stunden) und öffnet einen Pull Request. Schneller: **Actions → content-collect → Run workflow**.',
      '',
      '| custom_id | Inhalt |',
      '| --- | --- |',
      ...cells.map((cell) => `| \`${cell.customId}\` | ${cell.label} |`),
      '',
    ].join('\n'),
  };
}

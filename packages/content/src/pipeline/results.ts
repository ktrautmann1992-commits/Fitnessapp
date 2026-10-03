/**
 * Batch-Ergebnisse verarbeiten (docs/PLAN-PHASE-2.md Abschnitt 4, Schritt 2):
 * - Zuordnung NUR über `custom_id`, nie über die Reihenfolge.
 * - `succeeded` mit Stopp-Grund `end_turn` → JSON lesen → Antwort-Schema (Zod, inkl. Grenzen) → Datei-Schema
 *   (Ü1) → Entwurf. `errored`, `expired`, `canceled` → „erneut versuchen“. Stopp-Grund `refusal`
 *   (Ablehnung) oder `max_tokens` (abgeschnitten) → nicht gespeichert. Alles steht im Bericht.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';

import type { BatchRecord } from './batch-record';
import { DRY_RUN_MODEL } from './dry-run';
import type { ContentKindDefinition, GenerationCell, LibraryContext } from './kinds';
import { addUsage, emptyUsage, type UsageTotals } from './pricing';

export type BatchResult = Anthropic.Messages.Batches.MessageBatchIndividualResponse;

export type NotSavedReason =
  | 'errored'
  | 'expired'
  | 'canceled'
  | 'refusal'
  | 'max_tokens'
  | 'stop_reason'
  | 'no_json'
  | 'invalid'
  | 'id_taken'
  | 'duplicate_id'
  | 'duplicate_result'
  | 'unknown_custom_id'
  | 'missing';

export const NOT_SAVED_DE: Record<NotSavedReason, string> = {
  errored: 'Fehler bei der API – erneut versuchen',
  expired: 'abgelaufen (nicht in 24 Stunden bearbeitet) – erneut versuchen',
  canceled: 'abgebrochen – erneut versuchen',
  refusal: 'abgelehnt (refusal)',
  max_tokens: 'abgeschnitten (max_tokens erreicht)',
  stop_reason: 'unerwarteter Stopp-Grund',
  no_json: 'kein gültiges JSON',
  invalid: 'ungültig (Schema/Grenzen)',
  id_taken: 'ID existiert bereits – nicht überschrieben',
  duplicate_id: 'ID doppelt in diesem Lauf',
  duplicate_result: 'Ergebnis doppelt geliefert',
  unknown_custom_id: 'unbekannte custom_id',
  missing: 'kein Ergebnis geliefert',
};

export interface SavedDraft {
  readonly customId: string;
  readonly label: string;
  readonly id: string;
  readonly content: Record<string, unknown>;
}

export interface NotSaved {
  readonly customId: string;
  readonly label: string;
  readonly reason: NotSavedReason;
  readonly detail: string;
}

export interface ProcessedResults {
  readonly drafts: SavedDraft[];
  readonly notSaved: NotSaved[];
  readonly usage: UsageTotals;
}

function zodDetail(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''}${issue.message}`)
    .join(' · ');
}

function messageText(message: Anthropic.Messages.Message): string {
  return message.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

export interface ProcessInput {
  readonly kind: ContentKindDefinition;
  readonly record: BatchRecord;
  readonly results: readonly BatchResult[];
  readonly context: LibraryContext;
  /** Erstelldatum der Entwürfe (JJJJ-MM-TT). */
  readonly today: string;
}

/** Herkunft eines Batch-Entwurfs (Plan Abschnitt 5, Punkt 7). */
export function draftMeta(record: BatchRecord, today: string): Record<string, unknown> {
  return {
    origin: 'batch',
    model: record.dry_run ? DRY_RUN_MODEL : record.model,
    batch_id: record.batch_id,
    created_on: today,
    expert_reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    review_note: record.dry_run ? 'Probelauf – Beispiel ohne KI, nicht freigeben.' : null,
  };
}

export function processResults(input: ProcessInput): ProcessedResults {
  const { kind, record, context } = input;
  const cells = new Map<string, GenerationCell>(
    record.requests.map((request) => [
      request.custom_id,
      {
        customId: request.custom_id,
        targetId: request.target_id,
        label: request.label,
        values: request.values,
      },
    ]),
  );
  const drafts: SavedDraft[] = [];
  const notSaved: NotSaved[] = [];
  const usage = emptyUsage();
  const seenResults = new Set<string>();
  const newIds = new Set<string>();
  const meta = draftMeta(record, input.today);

  for (const result of input.results) {
    const customId = result.custom_id;
    const cell = cells.get(customId);
    if (result.result.type === 'succeeded') {
      // Abgerechnet wird jede erfolgreiche Antwort – auch abgelehnte oder ungültige.
      addUsage(usage, result.result.message.usage);
    }
    const label = cell?.label ?? customId;
    const skip = (reason: NotSavedReason, detail = '') =>
      notSaved.push({ customId, label, reason, detail });

    if (cell === undefined) {
      skip('unknown_custom_id', 'gehört nicht zu diesem Lauf');
      continue;
    }
    if (seenResults.has(customId)) {
      skip('duplicate_result');
      continue;
    }
    seenResults.add(customId);

    const outcome = result.result;
    if (outcome.type === 'errored') {
      skip('errored', outcome.error.error.type);
      continue;
    }
    if (outcome.type === 'expired' || outcome.type === 'canceled') {
      skip(outcome.type);
      continue;
    }
    const message = outcome.message;
    if (message.stop_reason === 'refusal') {
      const category = message.stop_details?.category;
      skip('refusal', category ? `Kategorie: ${category}` : '');
      continue;
    }
    if (message.stop_reason === 'max_tokens') {
      skip('max_tokens', `max_tokens = ${kind.maxTokens}`);
      continue;
    }
    if (message.stop_reason !== 'end_turn') {
      skip('stop_reason', String(message.stop_reason));
      continue;
    }

    let data: unknown;
    try {
      data = JSON.parse(messageText(message));
    } catch (error) {
      skip('no_json', (error as Error).message);
      continue;
    }

    let output: unknown;
    try {
      const parsed = kind.outputSchema(cell, context).safeParse(data);
      if (!parsed.success) {
        skip('invalid', zodDetail(parsed.error));
        continue;
      }
      output = parsed.data;
    } catch (error) {
      skip('invalid', (error as Error).message);
      continue;
    }

    const { id, content } = kind.toContent(output, cell, meta);
    const full = kind.contentSchema.safeParse(content);
    if (!full.success) {
      skip('invalid', zodDetail(full.error));
      continue;
    }
    if (context.takenIds[kind.kind].has(id)) {
      skip('id_taken', id);
      continue;
    }
    if (newIds.has(id)) {
      skip('duplicate_id', id);
      continue;
    }
    newIds.add(id);
    drafts.push({ customId, label, id, content });
  }

  for (const [customId, cell] of cells) {
    if (!seenResults.has(customId)) {
      notSaved.push({ customId, label: cell.label, reason: 'missing', detail: '' });
    }
  }
  return { drafts, notSaved, usage };
}

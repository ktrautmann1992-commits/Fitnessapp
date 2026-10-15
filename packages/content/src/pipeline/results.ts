/**
 * Batch-Ergebnisse verarbeiten (docs/PLAN-PHASE-2.md Abschnitt 4, Schritt 2; anbieter-neutral seit
 * docs/PLAN-PHASE-5.md N8):
 * - Zuordnung NUR über `custom_id` (bei Gemini `metadata.key`), nie über die Reihenfolge.
 * - `succeeded` mit normalem Ende (`stop`) → JSON lesen → Antwort-Schema (Zod, inkl. Grenzen) → Datei-Schema
 *   (Ü1) → Entwurf. `errored`, `expired`, `canceled` → „erneut versuchen“. Ablehnung/Sicherheitsfilter
 *   (`refusal`) oder abgeschnitten (`max_tokens`) → nicht gespeichert. Alles steht im Bericht.
 */
import type { z } from 'zod';

import type { BatchRecord } from './batch-record';
import { DRY_RUN_MODEL } from './dry-run';
import type { ContentKindDefinition, GenerationCell, LibraryContext } from './kinds';
import { addUsage, emptyUsage, type UsageTotals } from './pricing';
import type { BatchResult } from './provider/types';

export type { BatchResult } from './provider/types';

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
  | 'missing'
  /** Gültige, aber leere Antwort (z. B. „keine sinnvolle Alternative“ bei der Austausch-Tabelle). */
  | 'no_content';

export const NOT_SAVED_DE: Record<NotSavedReason, string> = {
  errored: 'Fehler bei der API – erneut versuchen',
  expired: 'abgelaufen (nicht in 24 Stunden bearbeitet) – erneut versuchen',
  canceled: 'abgebrochen – erneut versuchen',
  refusal: 'abgelehnt bzw. vom Sicherheitsfilter blockiert (refusal)',
  max_tokens: 'abgeschnitten (Höchstzahl Ausgabe-Token erreicht)',
  stop_reason: 'unerwarteter Stopp-Grund',
  no_json: 'kein gültiges JSON',
  invalid: 'ungültig (Schema/Grenzen)',
  id_taken: 'ID existiert bereits – nicht überschrieben',
  duplicate_id: 'ID doppelt in diesem Lauf',
  duplicate_result: 'Ergebnis doppelt geliefert',
  unknown_custom_id: 'unbekannte custom_id',
  missing: 'kein Ergebnis geliefert',
  no_content:
    'keine Inhalte vorgeschlagen (z. B. keine sinnvolle Alternative) – nicht erneut anfragen',
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
      // Abgerechnet wird jede gelieferte Antwort – auch abgelehnte oder ungültige.
      addUsage(usage, result.result.usage);
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
      skip('errored', outcome.detail);
      continue;
    }
    if (outcome.type === 'expired' || outcome.type === 'canceled') {
      skip(outcome.type);
      continue;
    }
    if (outcome.finish === 'refusal') {
      skip('refusal', outcome.finishDetail);
      continue;
    }
    if (outcome.finish === 'max_tokens') {
      skip('max_tokens', `Höchstzahl = ${kind.maxTokens}`);
      continue;
    }
    if (outcome.finish !== 'stop') {
      skip('stop_reason', outcome.finishDetail);
      continue;
    }

    let data: unknown;
    try {
      data = JSON.parse(outcome.text);
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

    let contents: { id: string; content: Record<string, unknown> }[];
    try {
      contents = kind.toContents(output, cell, meta);
    } catch (error) {
      skip('invalid', (error as Error).message);
      continue;
    }
    if (contents.length === 0) {
      skip('no_content');
      continue;
    }
    for (const { id, content } of contents) {
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
  }

  for (const [customId, cell] of cells) {
    if (!seenResults.has(customId)) {
      notSaved.push({ customId, label: cell.label, reason: 'missing', detail: '' });
    }
  }
  return { drafts, notSaved, usage };
}

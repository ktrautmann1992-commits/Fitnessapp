/**
 * Anfragen für die Message Batches API bauen und die Kosten vorab schätzen (docs/PLAN-PHASE-2.md
 * Abschnitte 4 und 10). Structured Outputs erzwingen das JSON-Format; `fallbacks` gibt es in der Batch-API
 * nicht – Ablehnungen werden nur gemeldet.
 */
import type Anthropic from '@anthropic-ai/sdk';

import type { ContentEffort } from './config';
import { toOutputJsonSchema } from './json-schema';
import type { ContentKindDefinition, GenerationCell, LibraryContext } from './kinds';
import { type CostEstimate, estimateWorstCase } from './pricing';

/** Der Teil des Anthropic-Clients, den die Pipeline nutzt (im Test ersetzbar). */
export interface ContentApiClient {
  messages: {
    countTokens: Anthropic['messages']['countTokens'];
    batches: Pick<Anthropic['messages']['batches'], 'create' | 'retrieve' | 'results'>;
  };
}

export const CUSTOM_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export interface RequestSettings {
  readonly model: string;
  readonly effort: ContentEffort;
}

export type BatchRequest = Anthropic.Messages.Batches.BatchCreateParams.Request;

/** Eine Anfrage je Zelle. Der System-Text ist für alle Anfragen gleich. */
export function buildBatchRequests(
  kind: ContentKindDefinition,
  cells: readonly GenerationCell[],
  context: LibraryContext,
  settings: RequestSettings,
): BatchRequest[] {
  const system = kind.systemPrompt(context);
  const seen = new Set<string>();
  return cells.map((cell) => {
    if (!CUSTOM_ID_PATTERN.test(cell.customId) || seen.has(cell.customId)) {
      throw new Error(`Ungültige oder doppelte custom_id: ${cell.customId}`);
    }
    seen.add(cell.customId);
    return {
      custom_id: cell.customId,
      params: {
        model: settings.model,
        max_tokens: kind.maxTokens,
        system,
        messages: [{ role: 'user', content: kind.userPrompt(cell, context) }],
        output_config: {
          effort: settings.effort,
          format: {
            type: 'json_schema',
            schema: toOutputJsonSchema(kind.outputSchema(cell, context)),
          },
        },
      },
    };
  });
}

/** Zählt die Eingabe-Token aller Anfragen (kostenlose Token-Zähl-Funktion), höchstens 4 gleichzeitig. */
export async function countInputTokens(
  client: ContentApiClient,
  requests: readonly BatchRequest[],
): Promise<number> {
  let total = 0;
  const queue = [...requests];
  const worker = async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const { model, system, messages, output_config } = next.params;
      const counted = await client.messages.countTokens({
        model,
        messages,
        ...(system === undefined ? {} : { system }),
        ...(output_config === undefined ? {} : { output_config }),
      });
      total += counted.input_tokens;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, requests.length) }, worker));
  return total;
}

/** Kostenschätzung (schlimmster Fall) für einen Lauf. */
export async function estimateRun(
  client: ContentApiClient,
  kind: ContentKindDefinition,
  requests: readonly BatchRequest[],
  settings: RequestSettings & { maxUsd: number },
): Promise<CostEstimate> {
  const inputTokens = await countInputTokens(client, requests);
  return estimateWorstCase({
    model: settings.model,
    requests: requests.length,
    inputTokens,
    maxTokensPerRequest: kind.maxTokens,
    maxUsd: settings.maxUsd,
  });
}

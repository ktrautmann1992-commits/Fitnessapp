/**
 * Anfragen für den Batch bauen und die Kosten vorab schätzen (docs/PLAN-PHASE-2.md Abschnitte 4 und 10; Anbieter
 * Gemini seit docs/PLAN-PHASE-5.md N8). Die strukturierte Ausgabe (JSON-Schema) erzwingt das Format; Ablehnungen
 * und Sicherheitsfilter werden nur gemeldet.
 *
 * Datenschutz: Die Anfragen enthalten nur Inhalts-Prompts (Regeln, Katalog, Matrix-Werte) – nie Nutzerdaten.
 */
import type { ContentEffort } from './config';
import { toOutputJsonSchema } from './json-schema';
import type { ContentKindDefinition, GenerationCell, LibraryContext } from './kinds';
import { type CostEstimate, estimateWorstCase } from './pricing';
import type { BatchRequest, ContentApiClient } from './provider/types';

export type { BatchRequest, ContentApiClient } from './provider/types';

export const CUSTOM_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export interface RequestSettings {
  readonly model: string;
  readonly effort: ContentEffort;
}

/** Eine Anfrage je Zelle. Der System-Text ist für alle Anfragen gleich. */
export function buildBatchRequests(
  kind: ContentKindDefinition,
  cells: readonly GenerationCell[],
  context: LibraryContext,
  settings: RequestSettings,
): BatchRequest[] {
  const systemInstruction = kind.systemPrompt(context);
  const seen = new Set<string>();
  return cells.map((cell) => {
    if (!CUSTOM_ID_PATTERN.test(cell.customId) || seen.has(cell.customId)) {
      throw new Error(`Ungültige oder doppelte custom_id: ${cell.customId}`);
    }
    seen.add(cell.customId);
    return {
      customId: cell.customId,
      systemInstruction,
      userText: kind.userPrompt(cell, context),
      responseJsonSchema: toOutputJsonSchema(kind.outputSchema(cell, context)),
      maxOutputTokens: kind.maxTokens,
      effort: settings.effort,
    };
  });
}

/** Zählt die Eingabe-Token aller Anfragen (kostenlose Token-Zähl-Funktion), höchstens 4 gleichzeitig. */
export async function countInputTokens(
  client: ContentApiClient,
  model: string,
  requests: readonly BatchRequest[],
): Promise<number> {
  let total = 0;
  const queue = [...requests];
  const worker = async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      // Erst warten, dann addieren (sonst liest `total += await …` einen veralteten Stand).
      const counted = await client.countTokens(model, next);
      total += counted;
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
  // Ohne Preis kein Lauf – vor dem ersten API-Aufruf prüfen.
  estimateWorstCase({
    model: settings.model,
    requests: 0,
    inputTokens: 0,
    maxTokensPerRequest: kind.maxTokens,
    maxUsd: settings.maxUsd,
  });
  const inputTokens = await countInputTokens(client, settings.model, requests);
  return estimateWorstCase({
    model: settings.model,
    requests: requests.length,
    inputTokens,
    maxTokensPerRequest: kind.maxTokens,
    maxUsd: settings.maxUsd,
  });
}

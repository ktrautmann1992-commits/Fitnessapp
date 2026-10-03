/**
 * Kosten der Batch-Läufe (docs/PLAN-PHASE-2.md Abschnitt 10).
 *
 * Quelle: Anthropic-Preisliste, Stand 25.09.2026 (Normalpreis je 1 Mio. Token); die Message Batches API kostet
 * die Hälfte. Denk-Token zählen als Ausgabe. Für ein Modell ohne hinterlegten Preis wird NICHT geschätzt,
 * sondern abgebrochen – der Kostendeckel soll nie stillschweigend ausfallen.
 */
import type Anthropic from '@anthropic-ai/sdk';

export interface BatchPrice {
  /** US-Dollar je 1 Mio. Eingabe-Token (Batch-Preis). */
  readonly inputPerMTok: number;
  /** US-Dollar je 1 Mio. Ausgabe-Token inkl. Denk-Token (Batch-Preis). */
  readonly outputPerMTok: number;
}

/**
 * Batch-Preise = 50 % des Normalpreises. Nur Modelle mit Structured Outputs und Denktiefe (`effort`);
 * ein anderes Modell braucht hier erst einen Eintrag.
 */
export const BATCH_PRICES_USD: Readonly<Record<string, BatchPrice>> = {
  'claude-opus-5-5': { inputPerMTok: 2, outputPerMTok: 10 }, // normal 4 $ / 20 $
  'claude-sonnet-5-5': { inputPerMTok: 1, outputPerMTok: 5 }, // normal 2 $ / 10 $
  'claude-opus-5': { inputPerMTok: 2.5, outputPerMTok: 12.5 }, // normal 5 $ / 25 $
  'claude-fable-5-1': { inputPerMTok: 5, outputPerMTok: 25 }, // normal 10 $ / 50 $
};

/** Zuschläge für Prompt-Caching (relativ zum Eingabepreis), falls die API sie meldet. */
const CACHE_WRITE_FACTOR = 1.25;
const CACHE_READ_FACTOR = 0.1;

export function batchPriceFor(model: string): BatchPrice {
  const price = BATCH_PRICES_USD[model];
  if (price === undefined) {
    throw new Error(
      `Für das Modell „${model}“ ist kein Preis hinterlegt – die Kosten lassen sich nicht schätzen. ` +
        `Erlaubt: ${Object.keys(BATCH_PRICES_USD).join(', ')} (packages/content/src/pipeline/pricing.ts).`,
    );
  }
  return price;
}

export interface CostEstimate {
  readonly requests: number;
  /** Summe der Eingabe-Token aller Anfragen (Token-Zähl-Funktion der API). */
  readonly inputTokens: number;
  /** max_tokens je Anfrage (fest je Inhaltsart). */
  readonly maxTokensPerRequest: number;
  readonly inputUsd: number;
  /** Schlimmster Fall: jede Antwort schöpft max_tokens voll aus. */
  readonly worstCaseOutputUsd: number;
  readonly worstCaseUsd: number;
  readonly maxUsd: number;
  readonly withinCap: boolean;
}

/** Schlimmster Fall wie in der Tabelle in Abschnitt 10: Eingabe + Anfragen × max_tokens × Ausgabepreis. */
export function estimateWorstCase(input: {
  model: string;
  requests: number;
  inputTokens: number;
  maxTokensPerRequest: number;
  maxUsd: number;
}): CostEstimate {
  const price = batchPriceFor(input.model);
  const inputUsd = (input.inputTokens * price.inputPerMTok) / 1_000_000;
  const worstCaseOutputUsd =
    (input.requests * input.maxTokensPerRequest * price.outputPerMTok) / 1_000_000;
  const worstCaseUsd = inputUsd + worstCaseOutputUsd;
  return {
    requests: input.requests,
    inputTokens: input.inputTokens,
    maxTokensPerRequest: input.maxTokensPerRequest,
    inputUsd,
    worstCaseOutputUsd,
    worstCaseUsd,
    maxUsd: input.maxUsd,
    withinCap: worstCaseUsd <= input.maxUsd,
  };
}

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

export function emptyUsage(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };
}

/** Addiert die Token einer Antwort (nur `succeeded`-Ergebnisse werden berechnet). */
export function addUsage(total: UsageTotals, usage: Anthropic.Messages.Usage): void {
  total.inputTokens += usage.input_tokens;
  total.outputTokens += usage.output_tokens;
  total.cacheWriteTokens += usage.cache_creation_input_tokens ?? 0;
  total.cacheReadTokens += usage.cache_read_input_tokens ?? 0;
}

/** Tatsächliche Kosten eines Laufs aus den gemeldeten Token. */
export function actualCostUsd(model: string, usage: UsageTotals): number {
  const price = batchPriceFor(model);
  return (
    (usage.inputTokens * price.inputPerMTok +
      usage.cacheWriteTokens * price.inputPerMTok * CACHE_WRITE_FACTOR +
      usage.cacheReadTokens * price.inputPerMTok * CACHE_READ_FACTOR +
      usage.outputTokens * price.outputPerMTok) /
    1_000_000
  );
}

/** „6,15 $“ – deutsche Schreibweise. */
export function formatUsd(value: number): string {
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

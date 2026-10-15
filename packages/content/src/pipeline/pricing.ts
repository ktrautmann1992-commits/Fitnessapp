/**
 * Kosten der Batch-Läufe (docs/PLAN-PHASE-2.md Abschnitt 10, Anbieter Gemini seit docs/PLAN-PHASE-5.md N8).
 *
 * Die Gemini Batch API kostet die Hälfte des Normalpreises (Google Gemini Cookbook, `quickstarts/Batch_mode.ipynb`:
 * „Batches are priced at a 50% discount compared to the standard API“). Denk-Token zählen als Ausgabe.
 *
 * Preis-Stand (15.10.2026): Die offizielle Preisseite (ai.google.dev/gemini-api/docs/pricing) war aus der
 * Umsetzungs-Sitzung nicht erreichbar. Mehrere Preisvergleichsseiten nennen für `gemini-3.8-flash` einen
 * Einführungspreis von 0,75 $ / 3,75 $ je 1 Mio. Token (Batch 0,375 $ / 1,875 $) bis 31.12.2026 und danach
 * 1,50 $ / 7,50 $. Hinterlegt ist VORSICHTIG der höhere Preis (Batch 0,75 $ / 3,75 $): Der Kostendeckel schätzt so
 * eher zu hoch als zu niedrig. Gründer-Aufgabe: Preis auf der offiziellen Seite prüfen (docs/SETUP.md Teil E).
 *
 * Für ein Modell ohne hinterlegten Preis wird NICHT geschätzt, sondern abgebrochen – der Kostendeckel soll nie
 * stillschweigend ausfallen.
 */

export interface BatchPrice {
  /** US-Dollar je 1 Mio. Eingabe-Token (Batch-Preis). */
  readonly inputPerMTok: number;
  /** US-Dollar je 1 Mio. Ausgabe-Token inkl. Denk-Token (Batch-Preis). */
  readonly outputPerMTok: number;
}

/**
 * Batch-Preise (Normalpreis × 0,5); ein anderes Modell braucht hier erst einen Eintrag. Alle Werte VORSICHTIG (eher zu
 * hoch), weil die offizielle Preisseite aus der Sitzung nicht erreichbar war (Stand 15.10.2026, Drittanbieter-Seiten):
 * - `gemini-3.8-flash`: s. o. – hinterlegt der Preis ab 01.01.2027 (Batch 0,75 $ / 3,75 $).
 * - `gemini-3.5-flash-lite`: Normalpreis laut Preisvergleichsseiten 0,30 $ / 2,50 $; hinterlegt OHNE Batch-Rabatt
 *   (0,30 $ / 2,50 $). In der Batch-Anleitung des Cookbooks ausdrücklich als Batch-Modell genannt.
 * - `gemini-3.1-flash-lite`: Normalpreis laut Preisvergleichsseiten 0,25 $ / 1,50 $ (Batch dort 0,125 $ / 0,75 $);
 *   hinterlegt OHNE Batch-Rabatt. Batch-Unterstützung nicht in der Cookbook-Liste bestätigt – nur als Option
 *   (Workflow-Eingabe „modell“); lehnt die API das Modell ab, scheitert der Lauf kostenlos beim Zählen/Anlegen.
 */
export const BATCH_PRICES_USD: Readonly<Record<string, BatchPrice>> = {
  'gemini-3.8-flash': { inputPerMTok: 0.75, outputPerMTok: 3.75 },
  'gemini-3.5-flash-lite': { inputPerMTok: 0.3, outputPerMTok: 2.5 },
  'gemini-3.1-flash-lite': { inputPerMTok: 0.25, outputPerMTok: 1.5 },
};

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
  /** Höchstzahl Ausgabe-Token je Anfrage (fest je Inhaltsart, inkl. Denken). */
  readonly maxTokensPerRequest: number;
  readonly inputUsd: number;
  /** Schlimmster Fall: jede Antwort schöpft die Höchstzahl voll aus. */
  readonly worstCaseOutputUsd: number;
  readonly worstCaseUsd: number;
  readonly maxUsd: number;
  readonly withinCap: boolean;
}

/** Schlimmster Fall wie in der Tabelle in Abschnitt 10: Eingabe + Anfragen × Höchstzahl × Ausgabepreis. */
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

/** Gemeldete Token eines Laufs (anbieter-neutral). */
export interface UsageTotals {
  /** Eingabe-Token (Gemini: `promptTokenCount`, inkl. zwischengespeicherter Token – vorsichtig voll berechnet). */
  inputTokens: number;
  /** Ausgabe-Token inkl. Denken (Gemini: `candidatesTokenCount` + `thoughtsTokenCount`). */
  outputTokens: number;
}

/** Token einer einzelnen Antwort. */
export interface ResponseUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export function emptyUsage(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0 };
}

/** Addiert die Token einer Antwort (nur gelieferte Antworten werden berechnet). */
export function addUsage(total: UsageTotals, usage: ResponseUsage): void {
  total.inputTokens += usage.inputTokens;
  total.outputTokens += usage.outputTokens;
}

/** Tatsächliche Kosten eines Laufs aus den gemeldeten Token. */
export function actualCostUsd(model: string, usage: UsageTotals): number {
  const price = batchPriceFor(model);
  return (
    (usage.inputTokens * price.inputPerMTok + usage.outputTokens * price.outputPerMTok) / 1_000_000
  );
}

/** „6,15 $“ – deutsche Schreibweise. */
export function formatUsd(value: number): string {
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

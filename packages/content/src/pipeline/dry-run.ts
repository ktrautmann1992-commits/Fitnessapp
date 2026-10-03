/**
 * Probelauf ohne KI (docs/PLAN-PHASE-2.md Abschnitt 4, „Probelauf ohne KI“): feste Beispiel-Antworten statt
 * API, im Format echter Batch-Ergebnisse – inkl. einer absichtlich ungültigen und einer abgelehnten Antwort.
 * Die Ergebnisse kommen absichtlich in umgekehrter Reihenfolge (Zuordnung nur über `custom_id`).
 */
import type Anthropic from '@anthropic-ai/sdk';
import { DRY_RUN_MODEL_ID } from '@fitnessapp/core';

import type { DryRunFixture, DryRunResponse } from './kinds';
import type { BatchResult } from './results';

/** Modell-Kennung der Probelauf-Entwürfe – content:validate lehnt sie als „published“ ab (Regel PROBELAUF). */
export const DRY_RUN_MODEL = DRY_RUN_MODEL_ID;

function message(
  response: Exclude<DryRunResponse, { kind: 'errored' }>,
  index: number,
): Anthropic.Messages.Message {
  const text = response.kind === 'json' ? JSON.stringify(response.data) : '';
  return {
    id: `msg_probelauf_${index}`,
    type: 'message',
    role: 'assistant',
    model: DRY_RUN_MODEL,
    container: null,
    diagnostics: null,
    content: text === '' ? [] : [{ type: 'text', text, citations: null }],
    stop_reason:
      response.kind === 'json'
        ? 'end_turn'
        : response.kind === 'refusal'
          ? 'refusal'
          : 'max_tokens',
    stop_details:
      response.kind === 'refusal'
        ? { type: 'refusal', category: null, explanation: 'Probelauf: absichtlich abgelehnt.' }
        : null,
    stop_sequence: null,
    usage: {
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      inference_geo: null,
      input_tokens: 0,
      output_tokens: 0,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: 'batch',
    },
  };
}

/** Feste Ergebnisse für die Anfragen eines Probelaufs (gleiche custom_ids wie die Beispiel-Antworten). */
export function dryRunResults(fixtures: readonly DryRunFixture[]): BatchResult[] {
  const results = fixtures.map((fixture, index): BatchResult => {
    if (fixture.response.kind === 'errored') {
      return {
        custom_id: fixture.cell.customId,
        result: {
          type: 'errored',
          error: {
            type: 'error',
            request_id: null,
            error: { type: 'api_error', message: 'Probelauf: absichtlicher Fehler.' },
          },
        },
      };
    }
    return {
      custom_id: fixture.cell.customId,
      result: { type: 'succeeded', message: message(fixture.response, index) },
    };
  });
  return results.reverse();
}

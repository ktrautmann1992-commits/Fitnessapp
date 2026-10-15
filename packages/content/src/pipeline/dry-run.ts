/**
 * Probelauf ohne KI (docs/PLAN-PHASE-2.md Abschnitt 4, „Probelauf ohne KI“): feste Beispiel-Antworten statt
 * API, im anbieter-neutralen Ergebnis-Format – inkl. einer absichtlich ungültigen und einer abgelehnten Antwort.
 * Die Ergebnisse kommen absichtlich in umgekehrter Reihenfolge (Zuordnung nur über `custom_id`).
 * Kein Schlüssel, kein Netz, keine Kosten.
 */
import { DRY_RUN_MODEL_ID } from '@fitnessapp/core';

import type { DryRunFixture } from './kinds';
import type { BatchResult } from './results';

/** Modell-Kennung der Probelauf-Entwürfe – content:validate lehnt sie als „published“ ab (Regel PROBELAUF). */
export const DRY_RUN_MODEL = DRY_RUN_MODEL_ID;

const NO_USAGE = { inputTokens: 0, outputTokens: 0 } as const;

/** Feste Ergebnisse für die Anfragen eines Probelaufs (gleiche custom_ids wie die Beispiel-Antworten). */
export function dryRunResults(fixtures: readonly DryRunFixture[]): BatchResult[] {
  const results = fixtures.map((fixture): BatchResult => {
    const customId = fixture.cell.customId;
    switch (fixture.response.kind) {
      case 'errored':
        return {
          custom_id: customId,
          result: { type: 'errored', detail: 'Probelauf: absichtlicher Fehler.' },
        };
      case 'refusal':
        return {
          custom_id: customId,
          result: {
            type: 'succeeded',
            text: '',
            finish: 'refusal',
            finishDetail: 'Probelauf: absichtlich abgelehnt.',
            usage: NO_USAGE,
          },
        };
      case 'max_tokens':
        return {
          custom_id: customId,
          result: {
            type: 'succeeded',
            text: '',
            finish: 'max_tokens',
            finishDetail: 'MAX_TOKENS',
            usage: NO_USAGE,
          },
        };
      case 'json':
        return {
          custom_id: customId,
          result: {
            type: 'succeeded',
            text: JSON.stringify(fixture.response.data),
            finish: 'stop',
            finishDetail: '',
            usage: NO_USAGE,
          },
        };
    }
  });
  return results.reverse();
}

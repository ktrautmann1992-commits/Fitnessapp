import {
  AI_FOOD_PHOTO,
  DEFAULT_PHOTO_LIMITS,
  hasValidConsent,
  photoLimitState,
  type AiUsageStatus,
  type FoodPhotoFinish,
  type FoodPhotoReserve,
  type PhotoLimitState,
} from '@fitnessapp/core';

import { consentRecordsFromRows, type ConsentVersions } from './mapping';
import type { UserRows } from './types';

/**
 * Gericht per Foto im TESTMODUS (Etappe E3): dieselben Regeln wie `public.ai_food_photo_reserve`/`finish` in der
 * Datenbank, aber auf dem Gerät und immer mit der Attrappe (keine echte KI, keine Kosten). Gespeichert werden nur
 * Metadaten wie in `ai_usage` (Zeitpunkt, Status, Modell, Token, Kosten) – nie das Foto, die Info oder die Antwort.
 */

/** Eine Zeile wie public.ai_usage (Export, Limit). */
export interface LocalAiUsageRow {
  id: string;
  user_id: string;
  feature: typeof AI_FOOD_PHOTO.feature;
  status: AiUsageStatus;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_eur: number | null;
  created_at: string;
  finished_at: string | null;
}

/** Aufbewahrung wie in der Datenbank (retention_days). */
const RETENTION_DAYS = 400;

/** Foto-Einwilligung und Gesundheits-Einwilligung gültig (aktuelle Version)? */
export function photoConsentsValid(rows: UserRows, versions: ConsentVersions): boolean {
  const records = consentRecordsFromRows(rows.consents);
  return (
    hasValidConsent(records, 'ai_food_photo', versions.ai_food_photo) &&
    hasValidConsent(records, 'health_data', versions.health_data)
  );
}

export function localPhotoLimit(usage: readonly LocalAiUsageRow[], now: string): PhotoLimitState {
  return photoLimitState(usage, DEFAULT_PHOTO_LIMITS, now);
}

/** Reservieren wie die Datenbank: Einwilligungen → Limits → neue Zeile. Testmodus = immer „freigeschaltet“. */
export function reserveLocal(
  usage: readonly LocalAiUsageRow[],
  input: { rows: UserRows; versions: ConsentVersions; now: string; id: string; userId: string },
): { result: FoodPhotoReserve; usage: LocalAiUsageRow[] } {
  const cutoff = Date.parse(input.now) - RETENTION_DAYS * 86_400_000;
  const kept = usage.filter((row) => Date.parse(row.created_at) >= cutoff);
  if (!photoConsentsValid(input.rows, input.versions)) {
    return { result: { result: 'no_consent' }, usage: kept };
  }
  const limit = localPhotoLimit(kept, input.now);
  if (limit.blocked !== null && limit.availableFrom !== null) {
    return {
      result: { result: 'limit', scope: limit.blocked, availableFrom: limit.availableFrom },
      usage: kept,
    };
  }
  const row: LocalAiUsageRow = {
    id: input.id,
    user_id: input.userId,
    feature: AI_FOOD_PHOTO.feature,
    status: 'reserved',
    model: null,
    input_tokens: null,
    output_tokens: null,
    cost_eur: null,
    created_at: input.now,
    finished_at: null,
  };
  return {
    result: {
      result: 'reserved',
      id: input.id,
      remainingMonth: limit.remainingMonth - 1,
      remainingToday: limit.remainingToday - 1,
    },
    usage: [...kept, row],
  };
}

/** Abschluss: nur eine noch laufende Reservierung; fehlgeschlagen zählt nicht gegen das Limit. */
export function finishLocal(
  usage: readonly LocalAiUsageRow[],
  params: FoodPhotoFinish,
  now: string,
): LocalAiUsageRow[] {
  return usage.map((row) =>
    row.id === params.id && row.status === 'reserved'
      ? {
          ...row,
          status: params.status,
          model: params.model,
          input_tokens: params.inputTokens,
          output_tokens: params.outputTokens,
          cost_eur: params.costEur,
          finished_at: now,
        }
      : row,
  );
}

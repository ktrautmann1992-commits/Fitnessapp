/**
 * Supabase-Zugriff der Foto-Auswertung (Etappe E3) per REST, ohne zusätzliches Paket:
 * - `verifyUser`: Login-Token bei Supabase Auth prüfen (`GET /auth/v1/user`) → nur die Nutzer-ID.
 * - `reserve`/`finish`: Datenbank-Funktionen ai_food_photo_reserve/finish mit dem geheimen service_role-Schlüssel
 *   (Migration 20261016160100_ai_food_photo.sql). Der Schlüssel verlässt den Server nie.
 * Fehler nur mit HTTP-Status (keine Antwort-Inhalte, keine Token).
 */
import type { FoodPhotoReserve } from '@fitnessapp/core';
import { z } from 'zod';

import type { FoodPhotoConfig } from './config';

export type ReserveResult = FoodPhotoReserve;

export interface FinishParams {
  readonly id: string;
  readonly userId: string;
  readonly status: 'succeeded' | 'failed';
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costEur: number;
}

export interface FoodPhotoStore {
  /** null = Token ungültig/abgelaufen. */
  verifyUser(accessToken: string): Promise<string | null>;
  /** `minConsentVersion`: echter Anbieter nur mit neuer Einwilligungsfassung (Wächter E3 M3). */
  reserve(userId: string, minConsentVersion: number): Promise<ReserveResult>;
  finish(params: FinishParams): Promise<void>;
}

export class FoodPhotoStoreError extends Error {
  constructor(status: number) {
    super(`Supabase-Aufruf fehlgeschlagen (HTTP ${status}).`);
    this.name = 'FoodPhotoStoreError';
  }
}

const reserveSchema = z.union([
  z.object({
    result: z.literal('reserved'),
    id: z.uuid(),
    remaining_month: z.number().int().min(0),
    remaining_today: z.number().int().min(0),
  }),
  z.object({ result: z.enum(['flag_off', 'no_entitlement', 'no_consent', 'not_configured']) }),
  z.object({
    result: z.literal('limit'),
    scope: z.enum(['month', 'day']),
    available_from: z.iso.date(),
  }),
]);

const userSchema = z.object({ id: z.uuid() });

type FetchFn = typeof fetch;

export function createSupabaseFoodPhotoStore(
  config: Pick<FoodPhotoConfig, 'supabaseUrl' | 'supabasePublishableKey' | 'supabaseServiceKey'>,
  fetchFn: FetchFn = fetch,
): FoodPhotoStore {
  const serviceHeaders = (): Record<string, string> => ({
    apikey: config.supabaseServiceKey,
    'Content-Type': 'application/json',
    // Alter service_role-Schlüssel (JWT) gehört zusätzlich in Authorization.
    ...(config.supabaseServiceKey.startsWith('eyJ')
      ? { Authorization: `Bearer ${config.supabaseServiceKey}` }
      : {}),
  });
  const rpc = async (name: string, body: unknown): Promise<unknown> => {
    const response = await fetchFn(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: serviceHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new FoodPhotoStoreError(response.status);
    return response.json();
  };
  return {
    async verifyUser(accessToken) {
      const response = await fetchFn(`${config.supabaseUrl}/auth/v1/user`, {
        headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) throw new FoodPhotoStoreError(response.status);
      const parsed = userSchema.safeParse(await response.json());
      return parsed.success ? parsed.data.id : null;
    },
    async reserve(userId, minConsentVersion) {
      const parsed = reserveSchema.safeParse(
        await rpc('ai_food_photo_reserve', {
          p_user_id: userId,
          p_min_consent_version: minConsentVersion,
        }),
      );
      if (!parsed.success) throw new FoodPhotoStoreError(500);
      const r = parsed.data;
      if (r.result === 'reserved') {
        return {
          result: 'reserved',
          id: r.id,
          remainingMonth: r.remaining_month,
          remainingToday: r.remaining_today,
        };
      }
      if (r.result === 'limit') {
        return { result: 'limit', scope: r.scope, availableFrom: r.available_from };
      }
      return { result: r.result };
    },
    async finish(params) {
      await rpc('ai_food_photo_finish', {
        p_id: params.id,
        p_user_id: params.userId,
        p_status: params.status,
        p_model: params.model,
        p_input_tokens: params.inputTokens,
        p_output_tokens: params.outputTokens,
        p_cost_eur: params.costEur,
      });
    },
  };
}

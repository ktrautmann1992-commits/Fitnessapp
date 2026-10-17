/**
 * Supabase-Zugriff der Produktabfrage (Etappe E4a) per REST, ohne zusätzliches Paket:
 * - `verifyUser`: Login-Token bei Supabase Auth prüfen (`GET /auth/v1/user`) → nur die Nutzer-ID,
 * - `begin`/`upsert`/`backoff`: Datenbank-Funktionen food_product_lookup/food_product_upsert/food_product_off_backoff
 *   mit dem geheimen service_role-Schlüssel (Migration 20261017100000_food_products.sql). Der Schlüssel verlässt den
 *   Server nie. Antworten an der Grenze mit Zod geprüft. Fehler nur mit HTTP-Status (keine Inhalte, keine Token).
 */
import {
  FOOD_PRODUCT_LOOKUP_LIMITS,
  type FoodProductRecord,
  foodProductRecordSchema,
  type ProductLookupBegin,
} from '@fitnessapp/core';
import { z } from 'zod';

import type { FoodProductConfig } from './config';

export interface FoodProductStore {
  /** null = Token ungültig/abgelaufen. */
  verifyUser(accessToken: string): Promise<string | null>;
  begin(userId: string, code: string): Promise<ProductLookupBegin>;
  upsert(record: FoodProductRecord): Promise<void>;
  backoff(): Promise<void>;
}

export class FoodProductStoreError extends Error {
  constructor(status: number) {
    super(`Supabase-Aufruf fehlgeschlagen (HTTP ${status}).`);
    this.name = 'FoodProductStoreError';
  }
}

const beginSchema = z.union([
  z.strictObject({ result: z.enum(['flag_off', 'no_consent', 'unavailable']) }),
  z.strictObject({ result: z.literal('rate_limited'), scope: z.enum(['hour', 'day']) }),
  z.strictObject({
    result: z.literal('cached'),
    stale: z.boolean(),
    record: foodProductRecordSchema,
  }),
  z.strictObject({ result: z.literal('fetch'), record: foodProductRecordSchema.nullable() }),
]);

const userSchema = z.object({ id: z.uuid() });

type FetchFn = typeof fetch;

export function createSupabaseFoodProductStore(
  config: Pick<FoodProductConfig, 'supabaseUrl' | 'supabasePublishableKey' | 'supabaseServiceKey'>,
  fetchFn: FetchFn = fetch,
): FoodProductStore {
  const serviceHeaders = (): Record<string, string> => ({
    apikey: config.supabaseServiceKey,
    'Content-Type': 'application/json',
    ...(config.supabaseServiceKey.startsWith('eyJ')
      ? { Authorization: `Bearer ${config.supabaseServiceKey}` }
      : {}),
  });
  const rpc = async (name: string, body: unknown): Promise<unknown> => {
    const response = await fetchFn(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: serviceHeaders(),
      body: JSON.stringify(body),
      // Wächter N2: hängende Datenbank darf die Route nicht bis zum Vercel-Limit blockieren.
      signal: AbortSignal.timeout(FOOD_PRODUCT_LOOKUP_LIMITS.supabaseTimeoutMs),
    });
    if (!response.ok) throw new FoodProductStoreError(response.status);
    return response.json();
  };
  return {
    async verifyUser(accessToken) {
      const response = await fetchFn(`${config.supabaseUrl}/auth/v1/user`, {
        headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(FOOD_PRODUCT_LOOKUP_LIMITS.supabaseTimeoutMs),
      });
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) throw new FoodProductStoreError(response.status);
      const parsed = userSchema.safeParse(await response.json());
      return parsed.success ? parsed.data.id : null;
    },
    async begin(userId, code) {
      const parsed = beginSchema.safeParse(
        await rpc('food_product_lookup', { p_user_id: userId, p_code: code }),
      );
      if (!parsed.success) throw new FoodProductStoreError(500);
      return parsed.data;
    },
    async upsert(record) {
      await rpc('food_product_upsert', { p: record });
    },
    async backoff() {
      await rpc('food_product_off_backoff', {});
    },
  };
}

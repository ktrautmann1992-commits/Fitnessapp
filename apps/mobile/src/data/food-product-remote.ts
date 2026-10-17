import { productLookupResponseSchema, type ProductLookupResponse } from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';

import { BackendError } from './backend';

/**
 * Produktabfrage im SUPABASE-MODUS (Etappe E4a, docs/PLAN-E4.md 3.2): POST /api/ernaehrung/produkt in apps/web mit dem
 * Login-Token als Bearer. Die Nummer steht nur im Körper (`{ "code": … }`), nie in der Adresse. Die App lädt NICHTS
 * direkt von Open Food Facts (keine Bilder, keine IP-Adresse der Person an OFF). Antwort Zod-geprüft; Fehler ohne
 * Inhalte (nie Nummer, Name oder Marke).
 */

const NETWORK = /failed to fetch|fetch failed|network request failed|networkerror|load failed/i;

export function createRemoteFoodProduct(options: {
  client: AppSupabaseClient;
  /** Adresse von apps/web (EXPO_PUBLIC_WEB_URL); null = nicht eingerichtet. */
  webUrl: string | null;
  fetchFn?: typeof fetch;
}): { lookupFoodProduct(code: string): Promise<ProductLookupResponse> } {
  const fetchFn = options.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  return {
    async lookupFoodProduct(code) {
      if (options.webUrl === null) return { code: 'not_configured' };
      const { data, error } = await options.client.auth.getSession();
      const token = data.session?.access_token;
      if (error || !token) throw new BackendError('not_signed_in');
      let response: Response;
      try {
        response = await fetchFn(`${options.webUrl}/api/ernaehrung/produkt`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
      } catch (cause) {
        throw new BackendError(
          cause instanceof TypeError || NETWORK.test((cause as Error | undefined)?.message ?? '')
            ? 'network'
            : 'unknown',
          { sensitive: true },
        );
      }
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new BackendError(response.status >= 500 ? 'temporary' : 'unknown', {
          sensitive: true,
        });
      }
      const parsed = productLookupResponseSchema.safeParse(json);
      if (!parsed.success) throw new BackendError('unknown', { sensitive: true });
      return parsed.data;
    },
  };
}

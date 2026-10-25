import {
  LOOP_ROUTE,
  type LoopRequest,
  type LoopResponse,
  loopRequestSchema,
  loopResponseSchema,
  mockLoopCandidates,
  rankLoops,
  roundStartPoint,
} from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';

import { BackendError } from './backend';

/**
 * Rundkurs-Vorschlag (docs/PLAN-RUNDKURS.md) – Datenzugriff der App.
 *
 * SUPABASE-MODUS: POST /api/strecken/rundkurs in apps/web mit dem Login-Token als Bearer. Der Startpunkt wird VOR dem
 * Senden auf 50 m gerundet und steht nur im Körper, nie in der Adresse. Die App spricht den Routing-Dienst nie direkt
 * an (Schlüssel bleibt auf dem Server). Antwort Zod-geprüft; Fehler ohne Inhalte (nie Koordinaten).
 *
 * TESTMODUS: dieselbe Bewertung mit der Attrappe (ausgedachte Runden, kein Netz).
 */

const NETWORK = /failed to fetch|fetch failed|network request failed|networkerror|load failed/i;

/** Anfrage mit gerundetem Startpunkt (Datenminimierung schon auf dem Gerät). */
export function minimizedLoopRequest(request: LoopRequest): LoopRequest {
  const start = roundStartPoint(request);
  return { ...request, lat: start.lat, lng: start.lng };
}

export function createRemoteLoopRouting(options: {
  client: AppSupabaseClient;
  /** Adresse von apps/web (EXPO_PUBLIC_WEB_URL); null = nicht eingerichtet. */
  webUrl: string | null;
  fetchFn?: typeof fetch;
}): { planLoopRoutes(request: LoopRequest): Promise<LoopResponse> } {
  const fetchFn = options.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  return {
    async planLoopRoutes(request) {
      if (options.webUrl === null) return { code: 'not_configured' };
      const parsedRequest = loopRequestSchema.safeParse(request);
      if (!parsedRequest.success) return { code: 'invalid_request' };
      const { data, error } = await options.client.auth.getSession();
      const token = data.session?.access_token;
      if (error || !token) throw new BackendError('not_signed_in');
      let response: Response;
      try {
        response = await fetchFn(`${options.webUrl}/api/strecken/rundkurs`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(minimizedLoopRequest(parsedRequest.data)),
          signal: AbortSignal.timeout(LOOP_ROUTE.timeoutMs.client),
        });
      } catch (cause) {
        const name = (cause as Error | undefined)?.name;
        if (name === 'TimeoutError' || name === 'AbortError') return { code: 'unavailable' };
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
        return { code: 'unavailable' };
      }
      const parsed = loopResponseSchema.safeParse(json);
      return parsed.success ? parsed.data : { code: 'unavailable' };
    },
  };
}

/** Testmodus: Attrappe + dieselbe Bewertung wie der Server. */
export async function localLoopRoutes(request: LoopRequest): Promise<LoopResponse> {
  const parsed = loopRequestSchema.safeParse(request);
  if (!parsed.success) return { code: 'invalid_request' };
  const r = minimizedLoopRequest(parsed.data);
  const routes = rankLoops(
    mockLoopCandidates({
      start: { lat: r.lat, lng: r.lng },
      distanceKm: r.distance_km,
      surface: r.surface,
      variant: r.variant,
    }),
    { distanceKm: r.distance_km, surface: r.surface },
  );
  return routes.length > 0 ? { code: 'ok', routes } : { code: 'no_routes' };
}

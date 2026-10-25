/**
 * POST /api/strecken/rundkurs – Rundkurs-Vorschlag (Gründer-Freigabe 25.10.2026, docs/PLAN-RUNDKURS.md). Ablauf ohne
 * Next-Abhängigkeit (die Route übersetzt nur), damit alles per Unit-Test prüfbar ist:
 * 1. Herkunft (CORS): nur die eigene App bzw. ohne Origin (native App) – wie die Produktabfrage.
 * 2. Konfiguration (Supabase-Adresse/-Schlüssel, ORS_API_KEY bzw. Attrappe) – sonst 503 `not_configured`.
 * 3. Login: Bearer-Token (Supabase-JWT) bei Supabase Auth prüfen – sonst 401. ERST DANACH wird der Körper gelesen.
 * 4. Körper: höchstens 256 Byte, JSON strikt nach `loopRequestSchema` – Koordinaten stehen NIE in der Adresse
 *    (Vercel-Logs speichern Pfad und Abfrage).
 * 5. Bremse je Person und gesamt (rate-limit.ts) → 429 `rate_limited`.
 * 6. Startpunkt noch einmal auf 50 m runden, 4 Runden beim Dienst anfragen (verschiedene Zufallswerte), bewerten und
 *    die besten 2–3 zurückgeben (`rankLoops`, packages/core).
 *
 * Datenschutz: Nichts wird gespeichert. In Logs stehen nur feste Codes – nie Koordinaten, Distanz, Nutzer-ID oder
 * Token. Kein Analytics.
 */
import {
  LOOP_ROUTE,
  type LoopCandidate,
  type LoopResponse,
  loopRequestSchema,
  loopSeeds,
  mockLoopCandidates,
  rankLoops,
  roundStartPoint,
} from '@fitnessapp/core';
import { z } from 'zod';

import { isAllowedAppOrigin } from '../food-photo/config';
import { type LoopRoutingConfig, readLoopRoutingConfig } from './config';
import { createOrsClient, type OrsResult } from './ors-client';
import { type LoopRateLimiter, sharedLoopRateLimiter } from './rate-limit';

type Env = Readonly<Record<string, string | undefined>>;

export interface HeaderReader {
  get(name: string): string | null;
}

export interface LoopRoutingDeps {
  /** null = Token ungültig/abgelaufen. */
  readonly verifyUser: (accessToken: string) => Promise<string | null>;
  readonly fetchRoundTrip: (
    input: Parameters<ReturnType<typeof createOrsClient>>[0],
  ) => Promise<OrsResult>;
  readonly limiter: LoopRateLimiter;
  readonly now: () => number;
}

export type LoopRoutingDepsFactory = (config: LoopRoutingConfig) => LoopRoutingDeps;

const userSchema = z.object({ id: z.uuid() });

export function supabaseVerifyUser(
  config: Pick<LoopRoutingConfig, 'supabaseUrl' | 'supabasePublishableKey'>,
  fetchFn: typeof fetch = fetch,
) {
  return async (accessToken: string): Promise<string | null> => {
    const response = await fetchFn(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new Error(`auth ${response.status}`);
    const parsed = userSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.id : null;
  };
}

export const defaultLoopRoutingDeps: LoopRoutingDepsFactory = (config) => ({
  verifyUser: supabaseVerifyUser(config),
  fetchRoundTrip:
    config.provider === 'ors' && config.orsApiKey
      ? createOrsClient({ apiKey: config.orsApiKey })
      : async () => ({ kind: 'failed' }),
  limiter: sharedLoopRateLimiter,
  now: () => Date.now(),
});

export interface LoopRoutingResult {
  readonly status: number;
  readonly body: LoopResponse;
  readonly headers: Readonly<Record<string, string>>;
}

/** Feste Codes ins Server-Log (nie Inhalte). */
const report = (code: string) => {
  console.error(`Rundkurs: ${code}`);
};

const TOKEN = /^Bearer ([A-Za-z0-9._-]{20,4096})$/;

/** CORS-Kopfzeilen nur für erlaubte Herkunft; keine Cookies (kein Allow-Credentials). */
export function corsHeaders(headers: HeaderReader, env: Env): Record<string, string> {
  const origin = headers.get('origin');
  const base: Record<string, string> = { Vary: 'Origin', 'Cache-Control': 'no-store' };
  if (origin === null || !isAllowedAppOrigin(origin, env)) return base;
  return {
    ...base,
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
  };
}

export async function handleLoopRouting(input: {
  env: Env;
  headers: HeaderReader;
  /** Liest den Körper als Text (null = nicht lesbar bzw. zu groß). Erst NACH Herkunft, Konfiguration und Login. */
  readBody: () => Promise<string | null>;
  deps?: LoopRoutingDepsFactory;
}): Promise<LoopRoutingResult> {
  const headers = corsHeaders(input.headers, input.env);
  const result = (status: number, body: LoopResponse): LoopRoutingResult => ({
    status,
    body,
    headers,
  });
  const origin = input.headers.get('origin');
  if (origin !== null && !isAllowedAppOrigin(origin, input.env)) {
    return result(403, { code: 'forbidden_origin' });
  }
  const configResult = readLoopRoutingConfig(input.env);
  if (configResult.status !== 'ok') return result(503, { code: 'not_configured' });
  const token = TOKEN.exec(input.headers.get('authorization') ?? '')?.[1];
  if (!token) return result(401, { code: 'unauthorized' });
  const length = input.headers.get('content-length');
  if (length !== null && !(Number(length) > 0 && Number(length) <= LOOP_ROUTE.maxBodyBytes)) {
    return result(400, { code: 'invalid_request' });
  }
  if (!/^application\/json\b/i.test(input.headers.get('content-type') ?? '')) {
    return result(400, { code: 'invalid_request' });
  }

  const config = configResult.config;
  const deps = (input.deps ?? defaultLoopRoutingDeps)(config);
  try {
    const userId = await deps.verifyUser(token);
    if (userId === null) return result(401, { code: 'unauthorized' });
    const text = await input.readBody();
    if (text === null) return result(400, { code: 'invalid_request' });
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return result(400, { code: 'invalid_request' });
    }
    const request = loopRequestSchema.safeParse(json);
    if (!request.success) return result(400, { code: 'invalid_request' });
    const decision = deps.limiter.take(userId, deps.now());
    if (decision !== 'ok') {
      report(decision);
      return result(429, { code: 'rate_limited' });
    }
    const { distance_km: distanceKm, surface, variant } = request.data;
    const start = roundStartPoint(request.data);

    let candidates: LoopCandidate[];
    if (config.provider === 'attrappe') {
      candidates = mockLoopCandidates({ start, distanceKm, surface, variant });
    } else {
      const results = await Promise.all(
        loopSeeds(variant).map((seed) =>
          deps
            .fetchRoundTrip({ start, distanceKm, surface, seed })
            .catch((): OrsResult => ({ kind: 'failed' })),
        ),
      );
      candidates = results.flatMap((r) => (r.kind === 'ok' ? [r.candidate] : []));
      if (candidates.length === 0) {
        if (results.some((r) => r.kind === 'rate_limited')) {
          report('provider_rate_limited');
          return result(429, { code: 'rate_limited' });
        }
        if (results.every((r) => r.kind === 'no_route')) return result(200, { code: 'no_routes' });
        report('provider_failed');
        return result(502, { code: 'unavailable' });
      }
    }
    const routes = rankLoops(candidates, { distanceKm, surface });
    if (routes.length === 0) return result(200, { code: 'no_routes' });
    return result(200, { code: 'ok', routes });
  } catch (error) {
    report(`failed (${(error as Error).name})`);
    return result(502, { code: 'unavailable' });
  }
}

/**
 * POST /api/begleitung – Ansicht der Live-Begleitung für die Vertrauensperson (docs/PLAN-PHASE-10.md 21.3).
 *
 * Ablauf: Token aus dem JSON-Körper (die Seite liest es aus dem Link-Fragment #t=…, nie aus Adresse oder Kopfzeilen)
 * → SHA-256 der 32 Token-Bytes (wie start_live_session) → Datenbank-Funktion get_live_view mit dem geheimen
 * service_role-Schlüssel und einem HMAC-Prüfwert der IP (Ratenbremse; die IP selbst wird nie gespeichert).
 *
 * Datenschutz (CLAUDE.md, Pflicht): kein Logging von Körper, Token, IP oder Koordinaten; Antwort nur mit den Feldern
 * aus liveViewSchema (Zod) – keine Gesundheitsdaten, keine Pace, keine Spur. Falsches, abgelaufenes und unbekanntes
 * Token geben dieselbe Antwort ({state: "invalid"}). Kopfzeilen: no-store, noindex, no-referrer, keine Cookies.
 */
import { createHash, createHmac } from 'node:crypto';

import { liveTokenBytes, liveViewSchema, type LiveView } from '@fitnessapp/core';

import { clientIp, rateLimitIpKey } from '@/lib/waitlist/tokens';

/** Mindestlänge des Schlüssels für den IP-Prüfwert. */
export const LIVE_SECRET_MIN_LENGTH = 32;
/** Größere Anfragen werden nicht gelesen (Token = 43 Zeichen). */
export const LIVE_MAX_BODY_BYTES = 256;

type Env = Readonly<Record<string, string | undefined>>;

export interface LiveConfig {
  readonly supabaseUrl: string;
  readonly supabaseServiceKey: string;
  readonly ipSecret: string;
}

const clean = (value: string | undefined) => value?.trim() ?? '';

/**
 * Einstellungen (Vercel-Projekt „Web“): Supabase-Adresse und Secret key wie die Warteliste; Schlüssel für den
 * IP-Prüfwert LIVE_VIEW_SECRET, ersatzweise WAITLIST_TOKEN_SECRET (beide mindestens 32 Zeichen). null = nicht
 * eingerichtet (Antwort 503, die Seite zeigt „gerade nicht verfügbar“).
 */
export function readLiveConfig(env: Env): LiveConfig | null {
  const supabaseUrl = (clean(env.SUPABASE_URL) || clean(env.NEXT_PUBLIC_SUPABASE_URL)).replace(
    /\/+$/,
    '',
  );
  const supabaseServiceKey = clean(env.SUPABASE_SERVICE_ROLE_KEY) || clean(env.SUPABASE_SECRET_KEY);
  const own = clean(env.LIVE_VIEW_SECRET);
  const ipSecret = own.length >= LIVE_SECRET_MIN_LENGTH ? own : clean(env.WAITLIST_TOKEN_SECRET);
  if (!/^https:\/\/[^\s/]+$/.test(supabaseUrl)) return null;
  if (!supabaseServiceKey) return null;
  if (ipSecret.length < LIVE_SECRET_MIN_LENGTH) return null;
  return { supabaseUrl, supabaseServiceKey, ipSecret };
}

/** SHA-256 (Hex) der Token-Bytes – derselbe Wert wie token_hash in der Datenbank. null = Token ungültig. */
export function liveTokenHash(token: string): string | null {
  const bytes = liveTokenBytes(token);
  return bytes ? createHash('sha256').update(bytes).digest('hex') : null;
}

/** HMAC-Prüfwert der IP (IPv6 auf /64 gekürzt) mit eigenem Zweck – nicht vergleichbar mit der Warteliste. */
export function liveIpHash(secret: string, ip: string): string {
  return createHmac('sha256', secret)
    .update(`alpha5-live:ip\u0000${rateLimitIpKey(ip)}`)
    .digest('hex');
}

/** Antwort an die Seite: Ansicht der Datenbank oder eigener Zustand bei fehlender Einrichtung/Fehler. */
export type LiveApiBody = LiveView | { state: 'unavailable' } | { state: 'error' };

export interface LiveApiResponse {
  readonly status: number;
  readonly body: LiveApiBody;
  readonly headers: Record<string, string>;
}

/** Kopfzeilen jeder Antwort (auch Fehler): nie zwischenspeichern, nie indexieren, keinen Referer weitergeben. */
export const LIVE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

const respond = (status: number, body: LiveApiBody): LiveApiResponse => ({
  status,
  body,
  headers: LIVE_HEADERS,
});

type FetchFn = typeof fetch;

export async function handleLiveView(input: {
  env: Env;
  headers: { get(name: string): string | null };
  /** Roher Körper (höchstens LIVE_MAX_BODY_BYTES) oder null. */
  body: string | null;
  fetchFn?: FetchFn;
}): Promise<LiveApiResponse> {
  const config = readLiveConfig(input.env);
  if (!config) return respond(503, { state: 'unavailable' });

  let token: unknown;
  try {
    token = input.body ? (JSON.parse(input.body) as { token?: unknown } | null)?.token : null;
  } catch {
    token = null;
  }
  const tokenHash = typeof token === 'string' ? liveTokenHash(token) : null;
  // Kaputtes Token: gleiche Antwort wie ein unbekanntes (kein Datenbank-Aufruf nötig).
  if (!tokenHash) return respond(200, { state: 'invalid' });

  const headers: Record<string, string> = {
    apikey: config.supabaseServiceKey,
    'Content-Type': 'application/json',
  };
  // Alter service_role-Schlüssel ist ein JWT und gehört zusätzlich in Authorization; der neue sb_secret_… nicht.
  if (config.supabaseServiceKey.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${config.supabaseServiceKey}`;
  }
  try {
    const response = await (input.fetchFn ?? fetch)(
      `${config.supabaseUrl}/rest/v1/rpc/get_live_view`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_token_hash: tokenHash,
          p_ip_hash: liveIpHash(config.ipSecret, clientIp(input.headers)),
        }),
        cache: 'no-store',
      },
    );
    if (!response.ok) return respond(502, { state: 'error' });
    const parsed = liveViewSchema.safeParse(await response.json());
    if (!parsed.success) return respond(502, { state: 'error' });
    return respond(parsed.data.state === 'rate_limited' ? 429 : 200, parsed.data);
  } catch {
    // Bewusst ohne Details (keine Inhalte in Logs).
    return respond(502, { state: 'error' });
  }
}

/**
 * POST /api/ernaehrung/produkt – Produktabfrage per Barcode-Nummer (Etappe E4a, docs/PLAN-E4.md 3.2). Ablauf ohne
 * Next-Abhängigkeit (die Route übersetzt nur), damit alles per Unit-Test prüfbar ist:
 * 1. Herkunft (CORS): nur die eigene App bzw. ohne Origin (native App) – wie E3.
 * 2. Konfiguration (Supabase-Schlüssel, OFF_CONTACT_EMAIL) – sonst 503 `not_configured`.
 * 3. Login: Bearer-Token (Supabase-JWT) bei Supabase Auth prüfen – sonst 401. ERST DANACH wird der Körper gelesen.
 * 4. Körper: höchstens 256 Byte, JSON strikt `{ "code": "…" }` – die Nummer steht NIE in der Adresse (Vercel-Logs
 *    speichern Pfad und Abfrage); Abfrage-Parameter liest die Route gar nicht.
 * 5. `runProductLookup` (packages/core): Nummer prüfen → Datenbank (Flag, Einwilligung health_data, Limits je Person,
 *    Speicher, globaler Deckel) → OFF (nur User-Agent + Accept) → normalisieren/prüfen → speichern.
 *
 * Datenschutz: In Logs stehen nur feste Codes – nie Nummer, Produktname, Nutzer-ID oder Token. Kein Analytics.
 */
import {
  FOOD_PRODUCT_LOOKUP_LIMITS,
  type OffFetchResult,
  type ProductLookupResponse,
  productLookupRequestSchema,
  runProductLookup,
} from '@fitnessapp/core';

import { isAllowedAppOrigin } from '../food-photo/config';
import { type FoodProductConfig, readFoodProductConfig } from './config';
import { createOffClient } from './off-client';
import { createSupabaseFoodProductStore, type FoodProductStore } from './store';

type Env = Readonly<Record<string, string | undefined>>;

export interface HeaderReader {
  get(name: string): string | null;
}

export interface FoodProductDeps {
  readonly store: FoodProductStore;
  readonly fetchOff: (code: string) => Promise<OffFetchResult>;
  readonly now: () => string;
}

export type FoodProductDepsFactory = (config: FoodProductConfig) => FoodProductDeps;

export const defaultFoodProductDeps: FoodProductDepsFactory = (config) => ({
  store: createSupabaseFoodProductStore(config),
  fetchOff: createOffClient({ userAgent: config.userAgent }),
  now: () => new Date().toISOString(),
});

export interface FoodProductResult {
  readonly status: number;
  readonly body: ProductLookupResponse;
  readonly headers: Readonly<Record<string, string>>;
}

/** Feste Codes ins Server-Log (nie Inhalte). */
const report = (code: string) => {
  console.error(`Produktabfrage: ${code}`);
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

export async function handleFoodProduct(input: {
  env: Env;
  headers: HeaderReader;
  /**
   * Liest den Körper als Text (null = nicht lesbar bzw. größer als 256 Byte). Wird erst NACH Herkunft, Konfiguration
   * und Login aufgerufen – ohne Login liest der Server den Körper nie (wie E3 M2).
   */
  readBody: () => Promise<string | null>;
  deps?: FoodProductDepsFactory;
}): Promise<FoodProductResult> {
  const headers = corsHeaders(input.headers, input.env);
  const result = (status: number, body: ProductLookupResponse): FoodProductResult => ({
    status,
    body,
    headers,
  });
  const origin = input.headers.get('origin');
  if (origin !== null && !isAllowedAppOrigin(origin, input.env)) {
    return result(403, { code: 'forbidden_origin' });
  }
  const configResult = readFoodProductConfig(input.env);
  if (configResult.status !== 'ok') return result(503, { code: 'not_configured' });
  const token = TOKEN.exec(input.headers.get('authorization') ?? '')?.[1];
  if (!token) return result(401, { code: 'unauthorized' });
  const length = input.headers.get('content-length');
  if (
    length !== null &&
    !(Number(length) > 0 && Number(length) <= FOOD_PRODUCT_LOOKUP_LIMITS.maxBodyBytes)
  ) {
    return result(400, { code: 'invalid_request' });
  }
  if (!/^application\/json\b/i.test(input.headers.get('content-type') ?? '')) {
    return result(400, { code: 'invalid_request' });
  }

  const deps = (input.deps ?? defaultFoodProductDeps)(configResult.config);
  try {
    const userId = await deps.store.verifyUser(token);
    if (userId === null) return result(401, { code: 'unauthorized' });
    const text = await input.readBody();
    if (text === null) return result(400, { code: 'invalid_request' });
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return result(400, { code: 'invalid_request' });
    }
    const request = productLookupRequestSchema.safeParse(json);
    if (!request.success) return result(400, { code: 'invalid_request' });
    const run = await runProductLookup(
      { code: request.data.code },
      {
        begin: (code) => deps.store.begin(userId, code),
        fetchOff: deps.fetchOff,
        store: (record) => deps.store.upsert(record),
        backoff: () => deps.store.backoff(),
        now: deps.now,
        mock: false,
        report,
      },
    );
    return result(run.status, run.body);
  } catch (error) {
    // Nur der Fehlername (z. B. FoodProductStoreError mit HTTP-Status) – keine Inhalte.
    report(`failed (${(error as Error).name})`);
    return result(502, { code: 'failed' });
  }
}

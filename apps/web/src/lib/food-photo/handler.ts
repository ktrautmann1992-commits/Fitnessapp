/**
 * POST /api/ernaehrung/foto – Gericht per Foto (Etappe E3, docs/PLAN-AUSWERTUNG.md Abschnitt 9). Ablauf ohne
 * Next-Abhängigkeit (die Route übersetzt nur), damit alles per Unit-Test prüfbar ist:
 * 1. Herkunft (CORS): nur die eigene App bzw. ohne Origin (native App).
 * 2. Konfiguration (Supabase-Schlüssel) – sonst 503 `not_configured`.
 * 3. Login: Bearer-Token (Supabase-JWT) bei Supabase Auth prüfen – sonst 401.
 * 4. Eingabe: nur die Felder `image` und optional `note` (strikt).
 * 5. `runFoodPhotoAnalysis` (packages/core): Info + Bild prüfen, reservieren (Premium/Flag/Einwilligungen/Limits
 *    serverseitig und atomar in der Datenbank), Anbieter (Standard: Attrappe), Abschluss in ai_usage.
 *
 * Datenschutz: Das Foto bleibt nur im Arbeitsspeicher dieser Anfrage (kein Storage, A-G18). In Logs stehen nur feste
 * Codes – nie Foto, Info, Antwort, Token oder Nutzer-ID.
 */
import {
  createMockFoodPhotoProvider,
  runFoodPhotoAnalysis,
  type FoodPhotoProvider,
  type FoodPhotoResponse,
} from '@fitnessapp/core';

import { type FoodPhotoConfig, isAllowedAppOrigin, readFoodPhotoConfig } from './config';
import { createGeminiProvider } from './provider';
import { createSupabaseFoodPhotoStore, type FoodPhotoStore } from './store';

type Env = Readonly<Record<string, string | undefined>>;

export interface HeaderReader {
  get(name: string): string | null;
}

/** Eingabe nach dem Lesen des Formulars (die Route übersetzt FormData). */
export interface FoodPhotoForm {
  readonly image: Uint8Array | null;
  readonly note: string | null;
  /** true = unbekannte Felder oder doppelte Felder → ungültig. */
  readonly unexpectedFields: boolean;
}

export interface FoodPhotoDeps {
  readonly store: FoodPhotoStore;
  readonly provider: FoodPhotoProvider;
}

export type FoodPhotoDepsFactory = (config: FoodPhotoConfig) => FoodPhotoDeps;

export const defaultFoodPhotoDeps: FoodPhotoDepsFactory = (config) => ({
  store: createSupabaseFoodPhotoStore(config),
  provider:
    config.provider === 'gemini' && config.geminiApiKey !== null
      ? createGeminiProvider({ apiKey: config.geminiApiKey, model: config.geminiModel })
      : createMockFoodPhotoProvider(),
});

export interface FoodPhotoResult {
  readonly status: number;
  readonly body: FoodPhotoResponse;
  readonly headers: Readonly<Record<string, string>>;
}

/** Feste Codes ins Server-Log (nie Inhalte). */
const report = (code: string) => {
  console.error(`Foto-KI: ${code}`);
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

export async function handleFoodPhoto(input: {
  env: Env;
  headers: HeaderReader;
  /** null = Formular nicht lesbar bzw. zu groß. */
  form: FoodPhotoForm | null;
  deps?: FoodPhotoDepsFactory;
}): Promise<FoodPhotoResult> {
  const headers = corsHeaders(input.headers, input.env);
  const result = (status: number, body: FoodPhotoResponse): FoodPhotoResult => ({
    status,
    body,
    headers,
  });
  const origin = input.headers.get('origin');
  if (origin !== null && !isAllowedAppOrigin(origin, input.env)) {
    return result(403, { code: 'forbidden_origin' });
  }
  const configResult = readFoodPhotoConfig(input.env);
  if (configResult.status !== 'ok') return result(503, { code: 'not_configured' });
  const token = TOKEN.exec(input.headers.get('authorization') ?? '')?.[1];
  if (!token) return result(401, { code: 'unauthorized' });

  const { store, provider } = (input.deps ?? defaultFoodPhotoDeps)(configResult.config);
  try {
    const userId = await store.verifyUser(token);
    if (userId === null) return result(401, { code: 'unauthorized' });
    const form = input.form;
    if (form === null || form.unexpectedFields || form.image === null) {
      return result(400, { code: 'invalid_request' });
    }
    const run = await runFoodPhotoAnalysis(
      { note: form.note, image: form.image },
      {
        provider,
        reserve: () => store.reserve(userId),
        finish: (params) => store.finish({ ...params, userId }),
        report,
      },
    );
    if (run.status >= 500) report(run.body.code);
    return result(run.status, run.body);
  } catch (error) {
    // Nur der Fehlername (z. B. FoodPhotoStoreError mit HTTP-Status) – keine Inhalte.
    report(`failed (${(error as Error).name})`);
    return result(502, { code: 'failed' });
  }
}

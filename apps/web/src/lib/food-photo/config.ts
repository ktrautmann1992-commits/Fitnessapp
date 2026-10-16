/**
 * Einstellungen der Foto-Auswertung (Etappe E3, docs/PLAN-AUSWERTUNG.md Abschnitt 9; docs/SETUP.md Teil „Gericht per
 * Foto“) aus den Umgebungsvariablen des Vercel-Projekts „Web“. Gründe nennen nur Variablennamen, nie Werte.
 *
 * Anbieter (Gründer-Entscheidung 16.10.2026 „Testversion ohne echte KI“):
 * - Standard ist IMMER die Attrappe (feste Beispielantworten, keine Kosten, kein Netz).
 * - Der echte Gemini-Adapter wird nur benutzt, wenn BEIDES gilt: `FOOD_PHOTO_PROVIDER=gemini` (ausdrücklich
 *   eingeschaltet) UND `GEMINI_API_KEY` gesetzt. Fehlt eins, bleibt es bei der Attrappe.
 * - In Tests/CI ist `fetch` ersetzt – es gibt nie echte Netzaufrufe.
 */
import { AI_FOOD_PHOTO } from '@fitnessapp/core';

type Env = Readonly<Record<string, string | undefined>>;

export type FoodPhotoProviderKind = 'attrappe' | 'gemini';

export interface FoodPhotoConfig {
  readonly supabaseUrl: string;
  /** Öffentlicher Schlüssel – nur, um das Login-Token bei Supabase prüfen zu lassen. */
  readonly supabasePublishableKey: string;
  /** Geheimer Schlüssel (service_role) – nur für reserve/finish. Nie im Browser. */
  readonly supabaseServiceKey: string;
  readonly provider: FoodPhotoProviderKind;
  /** Nur bei provider = gemini gesetzt. */
  readonly geminiApiKey: string | null;
  readonly geminiModel: string;
}

export type FoodPhotoConfigResult =
  | { readonly status: 'ok'; readonly config: FoodPhotoConfig }
  | { readonly status: 'disabled'; readonly reasons: readonly string[] };

const clean = (value: string | undefined) => value?.trim() ?? '';

/** Modellnamen wie in ai_usage.model erlaubt (nur [a-z0-9.-]) und mit hinterlegtem Preis. */
function modelFrom(env: Env): string {
  const wanted = clean(env.GEMINI_FOOD_PHOTO_MODEL);
  return wanted !== '' && wanted in AI_FOOD_PHOTO.pricesEurPerMTok
    ? wanted
    : AI_FOOD_PHOTO.defaultModel;
}

export function readFoodPhotoConfig(env: Env): FoodPhotoConfigResult {
  const supabaseUrl = clean(env.SUPABASE_URL) || clean(env.NEXT_PUBLIC_SUPABASE_URL);
  const supabasePublishableKey = clean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const supabaseServiceKey = clean(env.SUPABASE_SERVICE_ROLE_KEY) || clean(env.SUPABASE_SECRET_KEY);
  const reasons: string[] = [];
  if (!/^https:\/\/[^\s/]+/.test(supabaseUrl)) {
    reasons.push('SUPABASE_URL bzw. NEXT_PUBLIC_SUPABASE_URL fehlt (https://…).');
  }
  if (!supabasePublishableKey) reasons.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlt.');
  if (!supabaseServiceKey) reasons.push('SUPABASE_SERVICE_ROLE_KEY fehlt.');
  if (reasons.length > 0) return { status: 'disabled', reasons };

  const geminiApiKey = clean(env.GEMINI_API_KEY);
  const provider: FoodPhotoProviderKind =
    clean(env.FOOD_PHOTO_PROVIDER).toLowerCase() === 'gemini' && geminiApiKey !== ''
      ? 'gemini'
      : 'attrappe';
  return {
    status: 'ok',
    config: {
      supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
      supabasePublishableKey,
      supabaseServiceKey,
      provider,
      geminiApiKey: provider === 'gemini' ? geminiApiKey : null,
      geminiModel: modelFrom(env),
    },
  };
}

/** Feste Vorschau-Adressen der App (Projekt „fitnessapp“) – nur mit Team-Kürzel aus APP_PREVIEW_TEAM. */
const DEFAULT_APP_ORIGIN = 'https://fitnessapp-alpha-five.vercel.app';

/**
 * Erlaubte Herkünfte für CORS (Web-Export der App ruft die Route aus einem anderen Vercel-Projekt auf,
 * PLAN-PHASE-4B 6.1 S4): APP_WEB_ORIGIN, die Produktionsadresse der App und – nur wenn APP_PREVIEW_TEAM gesetzt ist –
 * deren Vorschauen `https://fitnessapp-<…>-<team>.vercel.app`. Keine Cookies; die native App sendet keinen Origin.
 */
export function isAllowedAppOrigin(origin: string, env: Env): boolean {
  const fixed = [clean(env.APP_WEB_ORIGIN), DEFAULT_APP_ORIGIN]
    .filter((o) => o !== '')
    .map((o) => o.replace(/\/+$/, ''));
  if (fixed.includes(origin)) return true;
  const team = clean(env.APP_PREVIEW_TEAM);
  if (!/^[a-z0-9-]{1,60}$/.test(team)) return false;
  return new RegExp(`^https://fitnessapp-[a-z0-9-]{1,80}-${team}\\.vercel\\.app$`).test(origin);
}

/**
 * Einstellungen des Rundkurs-Vorschlags (Gründer-Freigabe 25.10.2026, docs/PLAN-RUNDKURS.md; Klick-Schritte in
 * docs/HANDY-ANLEITUNG.md „Rundkurs-Vorschlag einschalten“) aus den Umgebungsvariablen des Vercel-Projekts „Web“.
 * Gründe nennen nur Variablennamen, nie Werte.
 *
 * Anbieter:
 * - `ors` (openrouteservice, HeiGIT Heidelberg): nur wenn `ORS_API_KEY` gesetzt ist. Standard, sobald der Schlüssel da ist.
 * - `attrappe`: ausgedachte Runden ohne Netz (zum Testen der Vercel-Vorschau ohne Schlüssel) – nur, wenn
 *   `LOOP_ROUTING_PROVIDER=attrappe` ausdrücklich gesetzt ist.
 * - sonst: nicht eingerichtet → die App zeigt „Rundkurs-Vorschläge sind gerade nicht verfügbar“.
 */

type Env = Readonly<Record<string, string | undefined>>;

export type LoopProviderKind = 'ors' | 'attrappe';

export interface LoopRoutingConfig {
  readonly supabaseUrl: string;
  /** Öffentlicher Schlüssel – nur, um das Login-Token bei Supabase prüfen zu lassen. */
  readonly supabasePublishableKey: string;
  readonly provider: LoopProviderKind;
  /** Nur bei provider = ors gesetzt. GEHEIM, verlässt den Server nie. */
  readonly orsApiKey: string | null;
}

export type LoopRoutingConfigResult =
  | { readonly status: 'ok'; readonly config: LoopRoutingConfig }
  | { readonly status: 'disabled'; readonly reasons: readonly string[] };

const clean = (value: string | undefined) => value?.trim() ?? '';

/** Schlüssel ohne Leer-/Steuerzeichen, plausibel lang (ORS-Schlüssel sind ca. 56 Zeichen bzw. JWT-ähnlich). */
const KEY = /^[A-Za-z0-9=._-]{20,400}$/;

export function readLoopRoutingConfig(env: Env): LoopRoutingConfigResult {
  const supabaseUrl = clean(env.SUPABASE_URL) || clean(env.NEXT_PUBLIC_SUPABASE_URL);
  const supabasePublishableKey = clean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const orsApiKey = clean(env.ORS_API_KEY);
  const wanted = clean(env.LOOP_ROUTING_PROVIDER).toLowerCase();
  const reasons: string[] = [];
  if (!/^https:\/\/[^\s/]+/.test(supabaseUrl)) {
    reasons.push('SUPABASE_URL bzw. NEXT_PUBLIC_SUPABASE_URL fehlt (https://…).');
  }
  if (!supabasePublishableKey) reasons.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlt.');
  let provider: LoopProviderKind | null = null;
  if (wanted === 'attrappe') provider = 'attrappe';
  else if (wanted === '' || wanted === 'ors') {
    if (KEY.test(orsApiKey)) provider = 'ors';
    else reasons.push('ORS_API_KEY fehlt bzw. ist ungültig.');
  } else {
    reasons.push('LOOP_ROUTING_PROVIDER ist weder leer noch „ors“ noch „attrappe“.');
  }
  if (reasons.length > 0 || provider === null) return { status: 'disabled', reasons };
  return {
    status: 'ok',
    config: {
      supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
      supabasePublishableKey,
      provider,
      orsApiKey: provider === 'ors' ? orsApiKey : null,
    },
  };
}

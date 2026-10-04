/**
 * Einstellungen der Warteliste aus den Umgebungsvariablen des Vercel-Projekts „Web“ (docs/SETUP.md Teil I).
 * Fehlt etwas, ist die Warteliste „bald aktiv“: Die API antwortet 503, das Formular zeigt einen freundlichen Hinweis.
 * Gründe nennen nur Variablennamen, nie Werte.
 */

/** Mindestlänge des Schlüssels für Token- und IP-Hashes (HMAC). */
export const WAITLIST_TOKEN_SECRET_MIN_LENGTH = 32;

export interface WaitlistConfig {
  readonly resendApiKey: string;
  readonly fromEmail: string;
  readonly tokenSecret: string;
  readonly supabaseUrl: string;
  readonly supabaseServiceKey: string;
}

export type WaitlistConfigResult =
  | { readonly status: 'ok'; readonly config: WaitlistConfig }
  | { readonly status: 'disabled'; readonly reasons: readonly string[] };

type Env = Readonly<Record<string, string | undefined>>;

const clean = (value: string | undefined) => value?.trim() ?? '';

export function readWaitlistConfig(env: Env): WaitlistConfigResult {
  const resendApiKey = clean(env.RESEND_API_KEY);
  const fromEmail = clean(env.WAITLIST_FROM_EMAIL);
  const tokenSecret = clean(env.WAITLIST_TOKEN_SECRET);
  const supabaseUrl = clean(env.SUPABASE_URL) || clean(env.NEXT_PUBLIC_SUPABASE_URL);
  // Neuer „Secret key“ (sb_secret_…) oder alter „service_role“-Schlüssel – beides hat service_role-Rechte.
  const supabaseServiceKey = clean(env.SUPABASE_SERVICE_ROLE_KEY) || clean(env.SUPABASE_SECRET_KEY);

  const reasons: string[] = [];
  if (!resendApiKey) reasons.push('RESEND_API_KEY fehlt.');
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(fromEmail.replace(/^.*<(.+)>$/, '$1'))) {
    reasons.push('WAITLIST_FROM_EMAIL fehlt oder ist keine E-Mail-Adresse.');
  }
  if (tokenSecret.length < WAITLIST_TOKEN_SECRET_MIN_LENGTH) {
    reasons.push(
      `WAITLIST_TOKEN_SECRET fehlt oder ist kürzer als ${WAITLIST_TOKEN_SECRET_MIN_LENGTH} Zeichen.`,
    );
  }
  if (!/^https:\/\/[^\s/]+/.test(supabaseUrl)) {
    reasons.push('SUPABASE_URL bzw. NEXT_PUBLIC_SUPABASE_URL fehlt (https://…).');
  }
  if (!supabaseServiceKey) reasons.push('SUPABASE_SERVICE_ROLE_KEY fehlt.');

  return reasons.length > 0
    ? { status: 'disabled', reasons }
    : {
        status: 'ok',
        config: {
          resendApiKey,
          fromEmail,
          tokenSecret,
          supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
          supabaseServiceKey,
        },
      };
}

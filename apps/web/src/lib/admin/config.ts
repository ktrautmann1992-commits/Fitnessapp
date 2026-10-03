/**
 * Zugang zum Redaktionsbereich, Stufe A (docs/PLAN-PHASE-2.md Abschnitt 6, „Wer darf hinein?“):
 * Passwort und Sitzungs-Schlüssel kommen ausschließlich aus Umgebungsvariablen des Vercel-Projekts „Web“
 * (docs/SETUP.md Teil G). Fehlt einer der Werte oder ist er zu kurz, ist `/admin` gesperrt – sicherer Standard.
 */

/** Mindestlänge des Passworts (zufällige Zeichen aus dem Passwort-Manager). */
export const ADMIN_PASSWORD_MIN_LENGTH = 20;
/** Mindestlänge des Schlüssels, mit dem die Sitzungs-Cookies signiert werden. */
export const ADMIN_SESSION_SECRET_MIN_LENGTH = 32;
/** Höchstlänge beider Werte (schützt vor versehentlich eingefügten Riesentexten). */
export const ADMIN_SECRET_MAX_LENGTH = 512;

export interface AdminCredentials {
  readonly password: string;
  readonly sessionSecret: string;
}

export type AdminConfig =
  | { readonly status: 'ok'; readonly credentials: AdminCredentials }
  | { readonly status: 'disabled'; readonly reasons: readonly string[] };

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Liest ADMIN_PASSWORD und ADMIN_SESSION_SECRET. Leerzeichen/Zeilenumbrüche am Rand (z. B. beim Kopieren am
 * Handy) werden entfernt; gezählt wird danach. Die Gründe nennen nur Namen und Mindestlängen, nie Werte.
 */
export function readAdminConfig(env: Env): AdminConfig {
  const password = env.ADMIN_PASSWORD?.trim() ?? '';
  const sessionSecret = env.ADMIN_SESSION_SECRET?.trim() ?? '';
  const reasons: string[] = [];
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    reasons.push(`ADMIN_PASSWORD fehlt oder ist kürzer als ${ADMIN_PASSWORD_MIN_LENGTH} Zeichen.`);
  }
  if (sessionSecret.length < ADMIN_SESSION_SECRET_MIN_LENGTH) {
    reasons.push(
      `ADMIN_SESSION_SECRET fehlt oder ist kürzer als ${ADMIN_SESSION_SECRET_MIN_LENGTH} Zeichen.`,
    );
  }
  if (password.length > ADMIN_SECRET_MAX_LENGTH || sessionSecret.length > ADMIN_SECRET_MAX_LENGTH) {
    reasons.push(
      `ADMIN_PASSWORD und ADMIN_SESSION_SECRET: höchstens ${ADMIN_SECRET_MAX_LENGTH} Zeichen.`,
    );
  }
  if (reasons.length === 0 && password === sessionSecret) {
    reasons.push('ADMIN_PASSWORD und ADMIN_SESSION_SECRET müssen verschieden sein.');
  }
  return reasons.length > 0
    ? { status: 'disabled', reasons }
    : { status: 'ok', credentials: { password, sessionSecret } };
}

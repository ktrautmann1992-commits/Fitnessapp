/**
 * Ablauf von Anmelden und Abmelden (Stufe A) ohne Next-Abhängigkeit – die Route Handler unter
 * `app/admin/api/*` übersetzen das Ergebnis nur in eine HTTP-Antwort. So ist alles per Unit-Test prüfbar.
 */
import { readAdminConfig } from './config';
import { type HeaderReader, isSameOriginRequest } from './origin';
import { FAILED_LOGIN_DELAY_MS, verifyAdminPassword } from './password';
import { clearSessionCookieHeader, createSessionToken, sessionCookieHeader } from './session';

export type AdminActionResult =
  | { readonly kind: 'redirect'; readonly location: string; readonly setCookie?: string }
  | { readonly kind: 'forbidden'; readonly message: string };

export interface LoginInput {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly headers: HeaderReader;
  readonly password: unknown;
  readonly now: number;
  readonly sleep: (ms: number) => Promise<void>;
}

const FORBIDDEN_ORIGIN: AdminActionResult = {
  kind: 'forbidden',
  message: 'Anfrage abgelehnt: Sie kam nicht von dieser Website.',
};

/** Login: Herkunft prüfen, Passwort in konstanter Zeit vergleichen, bei Fehlversuch ca. 1 s warten. */
export async function handleLogin(input: LoginInput): Promise<AdminActionResult> {
  const config = readAdminConfig(input.env);
  if (config.status !== 'ok') {
    // Nicht eingerichtet → die Übersicht zeigt „Redaktionsbereich nicht eingerichtet“.
    return { kind: 'redirect', location: '/admin' };
  }
  if (!isSameOriginRequest(input.headers)) {
    return FORBIDDEN_ORIGIN;
  }
  if (!verifyAdminPassword(config.credentials, input.password)) {
    await input.sleep(FAILED_LOGIN_DELAY_MS);
    return { kind: 'redirect', location: '/admin/login?fehler=1' };
  }
  const { token } = createSessionToken(config.credentials, input.now);
  return { kind: 'redirect', location: '/admin', setCookie: sessionCookieHeader(token) };
}

/** Abmelden: Herkunft prüfen, Cookie löschen. */
export function handleLogout(headers: HeaderReader): AdminActionResult {
  if (!isSameOriginRequest(headers)) {
    return FORBIDDEN_ORIGIN;
  }
  return {
    kind: 'redirect',
    location: '/admin/login?abgemeldet=1',
    setCookie: clearSessionCookieHeader(),
  };
}

/** HTTP-Antwort: 303 (nach POST immer GET) bzw. 403. Nie zwischenspeichern, nie indexieren. */
export function toResponse(result: AdminActionResult): Response {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  });
  if (result.kind === 'forbidden') {
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    return new Response(result.message, { status: 403, headers });
  }
  headers.set('Location', result.location);
  if (result.setCookie) {
    headers.append('Set-Cookie', result.setCookie);
  }
  return new Response(null, { status: 303, headers });
}

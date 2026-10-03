/**
 * Zugriffszustand aus Umgebung + Sitzungs-Cookie – rein, ohne Next-Abhängigkeit (für Proxy, Seiten, Tests).
 */
import { readAdminConfig } from './config';
import { verifySessionToken } from './session';

export type AdminAccess =
  | { readonly state: 'disabled'; readonly reasons: readonly string[] }
  | { readonly state: 'anonymous' }
  | { readonly state: 'ok'; readonly expiresAt: number };

export function adminAccessFor(
  env: Readonly<Record<string, string | undefined>>,
  token: string | undefined,
  now: number,
): AdminAccess {
  const config = readAdminConfig(env);
  if (config.status !== 'ok') {
    return { state: 'disabled', reasons: config.reasons };
  }
  const check = verifySessionToken(config.credentials, token, now);
  return check.valid ? { state: 'ok', expiresAt: check.expiresAt } : { state: 'anonymous' };
}

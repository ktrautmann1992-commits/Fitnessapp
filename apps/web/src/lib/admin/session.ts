/**
 * Sitzungs-Cookie des Redaktionsbereichs (Stufe A, docs/PLAN-PHASE-2.md Abschnitt 6):
 * - Inhalt `v1.<Ablauf in ms>.<Zufallswert>.<Signatur>`, die Ablaufzeit steht IM signierten Inhalt (8 Stunden).
 * - Signatur: HMAC-SHA256 mit einem Schlüssel, der aus ADMIN_SESSION_SECRET UND dem Passwort abgeleitet ist.
 *   Wird einer der beiden Werte geändert (und neu deployt), sind alle Sitzungen sofort ungültig.
 * - Vergleich der Signatur in konstanter Zeit (timingSafeEqual).
 * - Cookie: HttpOnly, Secure, SameSite=Strict, Path=/admin; Präfix `__Secure-` (Browser akzeptieren es nur mit
 *   Secure).
 * Reine Funktionen (Zeit wird übergeben) – getestet in session.test.ts.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { AdminCredentials } from './config';

export const ADMIN_SESSION_COOKIE = '__Secure-fitnessapp-admin';
export const ADMIN_COOKIE_PATH = '/admin';
/** Gültigkeit einer Sitzung: 8 Stunden. */
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** Erlaubte Uhren-Abweichung zwischen Servern beim Prüfen der Höchstdauer. */
const CLOCK_SKEW_MS = 60 * 1000;

const TOKEN_VERSION = 'v1';
const TOKEN_PATTERN = /^v1\.(\d{13})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/;

/** Schlüssel für die Sitzungs-Signatur – getrennt vom Schlüssel für den Passwortvergleich. */
function sessionKey(credentials: AdminCredentials): Buffer {
  return createHmac('sha256', credentials.sessionSecret)
    .update('fitnessapp-admin-session-v1\u0000')
    .update(credentials.password)
    .digest();
}

function sign(credentials: AdminCredentials, payload: string): string {
  return createHmac('sha256', sessionKey(credentials)).update(payload).digest('base64url');
}

/** Neues Sitzungs-Token, gültig bis `now + 8 h`. */
export function createSessionToken(
  credentials: AdminCredentials,
  now: number,
  nonce: string = randomBytes(16).toString('base64url'),
): { token: string; expiresAt: number } {
  const expiresAt = now + ADMIN_SESSION_TTL_MS;
  const payload = `${TOKEN_VERSION}.${expiresAt}.${nonce}`;
  return { token: `${payload}.${sign(credentials, payload)}`, expiresAt };
}

export type SessionCheck =
  | { readonly valid: true; readonly expiresAt: number }
  | { readonly valid: false; readonly reason: 'missing' | 'malformed' | 'signature' | 'expired' };

/** Prüft ein Token: Format, Signatur (konstante Zeit), Ablauf und Höchstdauer. */
export function verifySessionToken(
  credentials: AdminCredentials,
  token: string | undefined | null,
  now: number,
): SessionCheck {
  if (token === undefined || token === null || token === '') {
    return { valid: false, reason: 'missing' };
  }
  const match = TOKEN_PATTERN.exec(token);
  if (!match) {
    return { valid: false, reason: 'malformed' };
  }
  const [, expiresRaw, nonce, signature] = match as unknown as [string, string, string, string];
  const expected = Buffer.from(sign(credentials, `${TOKEN_VERSION}.${expiresRaw}.${nonce}`));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { valid: false, reason: 'signature' };
  }
  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) {
    return { valid: false, reason: 'expired' };
  }
  // Ein Token darf nie länger als 8 Stunden (+ kleine Uhren-Abweichung) gelten.
  if (expiresAt - now > ADMIN_SESSION_TTL_MS + CLOCK_SKEW_MS) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, expiresAt };
}

/** Set-Cookie-Kopfzeile für eine neue Sitzung. */
export function sessionCookieHeader(token: string): string {
  return [
    `${ADMIN_SESSION_COOKIE}=${token}`,
    `Path=${ADMIN_COOKIE_PATH}`,
    `Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ].join('; ');
}

/** Set-Cookie-Kopfzeile zum Abmelden (Cookie sofort löschen, gleiche Attribute). */
export function clearSessionCookieHeader(): string {
  return [
    `${ADMIN_SESSION_COOKIE}=`,
    `Path=${ADMIN_COOKIE_PATH}`,
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ].join('; ');
}

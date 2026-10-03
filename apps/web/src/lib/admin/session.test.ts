import { describe, expect, it } from 'vitest';

import { type AdminCredentials, readAdminConfig } from './config';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_MS,
  clearSessionCookieHeader,
  createSessionToken,
  sessionCookieHeader,
  verifySessionToken,
} from './session';
import { adminAccessFor } from './state';

// Nur Testwerte – echte Werte stehen ausschließlich in Vercel (docs/SETUP.md Teil G).
const CREDS: AdminCredentials = {
  password: 'test-passwort-1234567890',
  sessionSecret: 'test-sitzungs-schluessel-0123456789abcdef',
};
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);
const NONCE = 'AAAAAAAAAAAAAAAAAAAAAA';

describe('Konfiguration (ADMIN_PASSWORD / ADMIN_SESSION_SECRET)', () => {
  const env = (password?: string, secret?: string) => ({
    ADMIN_PASSWORD: password,
    ADMIN_SESSION_SECRET: secret,
  });

  it('gültig ab 20 bzw. 32 Zeichen', () => {
    const config = readAdminConfig(env('a'.repeat(20), 'b'.repeat(32)));
    expect(config.status).toBe('ok');
  });

  it('fehlende oder zu kurze Werte → gesperrt, mit Grund (ohne Werte zu nennen)', () => {
    expect(readAdminConfig({})).toMatchObject({ status: 'disabled' });
    const shortPassword = readAdminConfig(env('a'.repeat(19), 'b'.repeat(32)));
    expect(shortPassword).toMatchObject({ status: 'disabled' });
    expect(JSON.stringify(shortPassword)).toContain('ADMIN_PASSWORD');
    expect(JSON.stringify(shortPassword)).not.toContain('aaaa');
    const shortSecret = readAdminConfig(env('a'.repeat(20), 'b'.repeat(31)));
    expect(shortSecret).toMatchObject({ status: 'disabled' });
    expect(JSON.stringify(shortSecret)).toContain('ADMIN_SESSION_SECRET');
  });

  it('Leerzeichen am Rand zählen nicht mit', () => {
    expect(readAdminConfig(env(`  ${'a'.repeat(19)}  `, 'b'.repeat(32))).status).toBe('disabled');
    const trimmed = readAdminConfig(env(`${'a'.repeat(20)}\n`, ` ${'b'.repeat(32)} `));
    expect(trimmed).toEqual({
      status: 'ok',
      credentials: { password: 'a'.repeat(20), sessionSecret: 'b'.repeat(32) },
    });
  });

  it('Passwort = Schlüssel oder Riesenwerte → gesperrt', () => {
    expect(readAdminConfig(env('x'.repeat(40), 'x'.repeat(40))).status).toBe('disabled');
    expect(readAdminConfig(env('a'.repeat(600), 'b'.repeat(32))).status).toBe('disabled');
  });
});

describe('Sitzungs-Token', () => {
  it('signieren und prüfen: gültig bis genau 8 Stunden', () => {
    const { token, expiresAt } = createSessionToken(CREDS, NOW, NONCE);
    expect(expiresAt).toBe(NOW + ADMIN_SESSION_TTL_MS);
    expect(token).toMatch(/^v1\.\d{13}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/);
    expect(verifySessionToken(CREDS, token, NOW)).toEqual({ valid: true, expiresAt });
    expect(verifySessionToken(CREDS, token, expiresAt - 1).valid).toBe(true);
  });

  it('abgelaufen → ungültig', () => {
    const { token, expiresAt } = createSessionToken(CREDS, NOW, NONCE);
    expect(verifySessionToken(CREDS, token, expiresAt)).toEqual({
      valid: false,
      reason: 'expired',
    });
    expect(verifySessionToken(CREDS, token, expiresAt + 1000).valid).toBe(false);
  });

  it('zufälliger Teil macht jedes Token einzigartig', () => {
    const a = createSessionToken(CREDS, NOW).token;
    const b = createSessionToken(CREDS, NOW).token;
    expect(a).not.toBe(b);
    expect(verifySessionToken(CREDS, a, NOW).valid).toBe(true);
    expect(verifySessionToken(CREDS, b, NOW).valid).toBe(true);
  });

  it('Manipulation: Ablaufzeit verlängert, Signatur oder Zufallsteil geändert → ungültig', () => {
    const { token } = createSessionToken(CREDS, NOW, NONCE);
    const [version, expires, nonce, signature] = token.split('.') as [
      string,
      string,
      string,
      string,
    ];
    const later = String(Number(expires) + 60 * 60 * 1000);
    expect(verifySessionToken(CREDS, [version, later, nonce, signature].join('.'), NOW)).toEqual({
      valid: false,
      reason: 'signature',
    });
    const flipped = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
    expect(verifySessionToken(CREDS, [version, expires, nonce, flipped].join('.'), NOW).valid).toBe(
      false,
    );
    const otherNonce = 'B' + nonce.slice(1);
    expect(
      verifySessionToken(CREDS, [version, expires, otherNonce, signature].join('.'), NOW).valid,
    ).toBe(false);
  });

  it('kaputtes Format oder leer → ungültig', () => {
    for (const bad of [
      '',
      'abc',
      'v2.1.2.3',
      `${createSessionToken(CREDS, NOW, NONCE).token}x`,
      'v1..',
    ]) {
      expect(verifySessionToken(CREDS, bad, NOW).valid).toBe(false);
    }
    expect(verifySessionToken(CREDS, undefined, NOW)).toEqual({ valid: false, reason: 'missing' });
  });

  it('falsches Secret oder geändertes Passwort → ungültig (Rotation meldet alle ab)', () => {
    const { token } = createSessionToken(CREDS, NOW, NONCE);
    expect(
      verifySessionToken({ ...CREDS, sessionSecret: `${CREDS.sessionSecret}x` }, token, NOW).valid,
    ).toBe(false);
    expect(verifySessionToken({ ...CREDS, password: `${CREDS.password}x` }, token, NOW).valid).toBe(
      false,
    );
  });

  it('Token mit Ablauf weiter als 8 h in der Zukunft wird nie akzeptiert', () => {
    // Selbst korrekt signiert (z. B. Server mit falsch gestellter Uhr): höchstens 8 h + 1 min.
    const { token } = createSessionToken(CREDS, NOW + 2 * 60 * 60 * 1000, NONCE);
    expect(verifySessionToken(CREDS, token, NOW)).toEqual({ valid: false, reason: 'expired' });
  });

  it('Cookie-Flags: HttpOnly, Secure, SameSite=Strict, Path=/admin, 8 h', () => {
    const header = sessionCookieHeader('v1.x');
    expect(header.startsWith(`${ADMIN_SESSION_COOKIE}=v1.x;`)).toBe(true);
    expect(ADMIN_SESSION_COOKIE.startsWith('__Secure-')).toBe(true);
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/admin', 'Max-Age=28800']) {
      expect(header.split('; ')).toContain(flag);
    }
    const cleared = clearSessionCookieHeader().split('; ');
    expect(cleared).toEqual(
      expect.arrayContaining(['Max-Age=0', 'Path=/admin', 'HttpOnly', 'Secure']),
    );
  });
});

describe('Zugriffszustand', () => {
  const env = { ADMIN_PASSWORD: CREDS.password, ADMIN_SESSION_SECRET: CREDS.sessionSecret };

  it('zu kurze Secrets → gesperrt, auch mit (früher) gültigem Token', () => {
    const { token } = createSessionToken(CREDS, NOW, NONCE);
    expect(adminAccessFor({ ...env, ADMIN_PASSWORD: 'kurz' }, token, NOW).state).toBe('disabled');
    expect(adminAccessFor({ ...env, ADMIN_SESSION_SECRET: 'zu-kurz' }, token, NOW).state).toBe(
      'disabled',
    );
    expect(adminAccessFor({}, token, NOW).state).toBe('disabled');
  });

  it('ohne oder mit ungültigem Cookie → anonym, mit gültigem → ok', () => {
    const { token } = createSessionToken(CREDS, NOW, NONCE);
    expect(adminAccessFor(env, undefined, NOW).state).toBe('anonymous');
    expect(adminAccessFor(env, 'v1.kaputt', NOW).state).toBe('anonymous');
    expect(adminAccessFor(env, token, NOW).state).toBe('ok');
  });
});

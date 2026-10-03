import { describe, expect, it, vi } from 'vitest';

import { handleLogin, handleLogout, toResponse } from './login';
import { isSameOriginRequest } from './origin';
import { FAILED_LOGIN_DELAY_MS, verifyAdminPassword } from './password';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from './session';

// Nur Testwerte – echte Werte stehen ausschließlich in Vercel (docs/SETUP.md Teil G).
const PASSWORD = 'test-passwort-1234567890';
const SECRET = 'test-sitzungs-schluessel-0123456789abcdef';
const CREDS = { password: PASSWORD, sessionSecret: SECRET };
const ENV = { ADMIN_PASSWORD: PASSWORD, ADMIN_SESSION_SECRET: SECRET };
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);

const headers = (values: Record<string, string>) => new Headers(values);
const sameOrigin = headers({ origin: 'https://admin.example.de', host: 'admin.example.de' });

describe('Passwortprüfung', () => {
  it('nur das exakte Passwort passt', () => {
    expect(verifyAdminPassword(CREDS, PASSWORD)).toBe(true);
    expect(verifyAdminPassword(CREDS, `${PASSWORD} `)).toBe(false);
    expect(verifyAdminPassword(CREDS, PASSWORD.slice(0, -1))).toBe(false);
    expect(verifyAdminPassword(CREDS, PASSWORD.toUpperCase())).toBe(false);
    expect(verifyAdminPassword(CREDS, '')).toBe(false);
  });

  it('keine Zeichenkette oder zu lang → falsch (ohne Fehler)', () => {
    expect(verifyAdminPassword(CREDS, null)).toBe(false);
    expect(verifyAdminPassword(CREDS, undefined)).toBe(false);
    expect(verifyAdminPassword(CREDS, 42)).toBe(false);
    expect(verifyAdminPassword(CREDS, PASSWORD + 'x'.repeat(2000))).toBe(false);
  });
});

describe('Herkunftsprüfung (Origin/Host)', () => {
  it('gleiche Adresse → erlaubt', () => {
    expect(isSameOriginRequest(sameOrigin)).toBe(true);
    expect(
      isSameOriginRequest(
        headers({
          origin: 'http://127.0.0.1:3100',
          host: '127.0.0.1:3100',
          'sec-fetch-site': 'same-origin',
        }),
      ),
    ).toBe(true);
    // Hinter einem Proxy zählt auch X-Forwarded-Host (erster Wert).
    expect(
      isSameOriginRequest(
        headers({
          origin: 'https://web.vercel.app',
          host: 'intern:3000',
          'x-forwarded-host': 'web.vercel.app, intern',
        }),
      ),
    ).toBe(true);
  });

  it('fremde Adresse, fehlender oder „null“-Origin, anderer Port → abgelehnt', () => {
    expect(
      isSameOriginRequest(headers({ origin: 'https://boese.example', host: 'admin.example.de' })),
    ).toBe(false);
    expect(isSameOriginRequest(headers({ host: 'admin.example.de' }))).toBe(false);
    expect(isSameOriginRequest(headers({ origin: 'null', host: 'admin.example.de' }))).toBe(false);
    expect(
      isSameOriginRequest(
        headers({ origin: 'https://admin.example.de:8443', host: 'admin.example.de' }),
      ),
    ).toBe(false);
    expect(isSameOriginRequest(headers({ origin: 'kein url', host: 'admin.example.de' }))).toBe(
      false,
    );
    expect(isSameOriginRequest(headers({ origin: 'https://admin.example.de' }))).toBe(false);
  });

  it('Sec-Fetch-Site muss same-origin sein, wenn vorhanden', () => {
    expect(
      isSameOriginRequest(
        headers({
          origin: 'https://admin.example.de',
          host: 'admin.example.de',
          'sec-fetch-site': 'cross-site',
        }),
      ),
    ).toBe(false);
  });
});

describe('Login', () => {
  it('richtiges Passwort → Weiterleitung /admin mit signiertem Cookie, ohne Verzögerung', async () => {
    const sleep = vi.fn(async () => undefined);
    const result = await handleLogin({
      env: ENV,
      headers: sameOrigin,
      password: PASSWORD,
      now: NOW,
      sleep,
    });
    expect(result).toMatchObject({ kind: 'redirect', location: '/admin' });
    expect(sleep).not.toHaveBeenCalled();
    if (result.kind !== 'redirect') return;
    const token = /=([^;]+);/.exec(result.setCookie ?? '')![1];
    expect(result.setCookie?.startsWith(`${ADMIN_SESSION_COOKIE}=`)).toBe(true);
    expect(verifySessionToken(CREDS, token, NOW).valid).toBe(true);
  });

  it('falsches Passwort → ca. 1 s warten, kein Cookie, zurück zum Login mit Fehler', async () => {
    const sleep = vi.fn(async () => undefined);
    const result = await handleLogin({
      env: ENV,
      headers: sameOrigin,
      password: 'falsch',
      now: NOW,
      sleep,
    });
    expect(result).toEqual({ kind: 'redirect', location: '/admin/login?fehler=1' });
    expect(sleep).toHaveBeenCalledWith(FAILED_LOGIN_DELAY_MS);
    expect(FAILED_LOGIN_DELAY_MS).toBeGreaterThanOrEqual(1000);
  });

  it('fremde Herkunft → 403, Passwort wird gar nicht geprüft', async () => {
    const sleep = vi.fn(async () => undefined);
    const result = await handleLogin({
      env: ENV,
      headers: headers({ origin: 'https://boese.example', host: 'admin.example.de' }),
      password: PASSWORD,
      now: NOW,
      sleep,
    });
    expect(result.kind).toBe('forbidden');
    const response = toResponse(result);
    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('nicht eingerichtet (zu kurze Werte) → kein Login möglich', async () => {
    const result = await handleLogin({
      env: { ADMIN_PASSWORD: 'kurz', ADMIN_SESSION_SECRET: SECRET },
      headers: sameOrigin,
      password: 'kurz',
      now: NOW,
      sleep: async () => undefined,
    });
    expect(result).toEqual({ kind: 'redirect', location: '/admin' });
  });

  it('Antwort: 303, nicht zwischenspeichern, nicht indexieren', async () => {
    const result = await handleLogin({
      env: ENV,
      headers: sameOrigin,
      password: PASSWORD,
      now: NOW,
      sleep: async () => undefined,
    });
    const response = toResponse(result);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/admin');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  });
});

describe('Abmelden', () => {
  it('löscht das Cookie und führt zum Login', () => {
    const result = handleLogout(sameOrigin);
    expect(result).toMatchObject({ kind: 'redirect', location: '/admin/login?abgemeldet=1' });
    if (result.kind === 'redirect') {
      expect(result.setCookie).toContain('Max-Age=0');
    }
  });

  it('fremde Herkunft → 403', () => {
    expect(
      handleLogout(headers({ origin: 'https://boese.example', host: 'admin.example.de' })).kind,
    ).toBe('forbidden');
  });
});

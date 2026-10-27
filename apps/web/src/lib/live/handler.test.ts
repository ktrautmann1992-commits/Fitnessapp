import { createHash, createHmac } from 'node:crypto';

import { liveTokenFromBytes } from '@fitnessapp/core';
import { describe, expect, it, vi } from 'vitest';

import {
  derivedIpSecret,
  handleLiveView,
  LIVE_HEADERS,
  liveIpHash,
  liveTokenHash,
  readLiveConfig,
} from './handler';

const SECRET = 's'.repeat(32);
const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://projekt.supabase.co/',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc',
  WAITLIST_TOKEN_SECRET: SECRET,
};
const BYTES = new Uint8Array(32).map((_, i) => i * 7);
const TOKEN = liveTokenFromBytes(BYTES);
const headers = (ip = '203.0.113.7') => new Headers({ 'x-forwarded-for': `${ip}, 10.0.0.1` });

const ACTIVE = {
  state: 'active',
  display_name: 'Karsten',
  sport: 'run',
  started_at: '2026-10-27T17:00:00+00:00',
  server_time: '2026-10-27T17:20:00+00:00',
  position: {
    lat: 50.94133,
    lon: 6.95828,
    accuracy_m: 8,
    recorded_at: '2026-10-27T17:19:40+00:00',
  },
};

function fakeFetch(answer: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(answer), { status }));
}

describe('readLiveConfig', () => {
  it('Supabase + Secret key + Schlüssel (eigener oder der der Warteliste)', () => {
    expect(readLiveConfig(ENV)).toEqual({
      supabaseUrl: 'https://projekt.supabase.co',
      supabaseServiceKey: 'sb_secret_abc',
      ipSecret: SECRET,
    });
    expect(readLiveConfig({ ...ENV, LIVE_VIEW_SECRET: 'l'.repeat(40) })?.ipSecret).toBe(
      'l'.repeat(40),
    );
    // zu kurzer eigener Schlüssel → Ersatz
    expect(readLiveConfig({ ...ENV, LIVE_VIEW_SECRET: 'kurz' })?.ipSecret).toBe(SECRET);
  });

  it('ohne eigenes Secret: IP-Schlüssel aus dem Secret key abgeleitet (kein Pflicht-Secret)', () => {
    const derived = createHmac('sha256', 'sb_secret_abc')
      .update('alpha5-live-view-ip-v1')
      .digest('hex');
    expect(derivedIpSecret('sb_secret_abc')).toBe(derived);
    expect(readLiveConfig({ ...ENV, WAITLIST_TOKEN_SECRET: undefined })?.ipSecret).toBe(derived);
    expect(readLiveConfig({ ...ENV, WAITLIST_TOKEN_SECRET: 'kurz' })?.ipSecret).toBe(derived);
    expect(
      readLiveConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'https://projekt.supabase.co',
        SUPABASE_SECRET_KEY: 'sb_secret_abc',
      })?.ipSecret,
    ).toBe(derived);
    // nicht der Key selbst
    expect(derived).not.toContain('sb_secret_abc');
  });

  it('fehlt Supabase → null', () => {
    expect(readLiveConfig({ ...ENV, SUPABASE_SERVICE_ROLE_KEY: '' })).toBeNull();
    expect(readLiveConfig({ ...ENV, NEXT_PUBLIC_SUPABASE_URL: 'http://x' })).toBeNull();
    expect(readLiveConfig({})).toBeNull();
  });
});

describe('Hashes', () => {
  it('Token-Hash = SHA-256 der 32 Bytes (wie die Datenbank)', () => {
    expect(liveTokenHash(TOKEN)).toBe(createHash('sha256').update(BYTES).digest('hex'));
    expect(liveTokenHash('kaputt')).toBeNull();
  });

  it('IP-Prüfwert: HMAC, IPv6 auf /64 gekürzt, nie die IP selbst', () => {
    const a = liveIpHash(SECRET, '2001:db8:1:2:3:4:5:6');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(liveIpHash(SECRET, '2001:db8:1:2:ffff::1')).toBe(a);
    expect(liveIpHash(SECRET, '203.0.113.7')).not.toBe(liveIpHash(SECRET, '203.0.113.8'));
    expect(liveIpHash('x'.repeat(32), '203.0.113.7')).not.toBe(liveIpHash(SECRET, '203.0.113.7'));
  });
});

describe('handleLiveView', () => {
  it('nicht eingerichtet → 503 „unavailable“, ohne Abfrage', async () => {
    const fetchFn = fakeFetch(ACTIVE);
    const res = await handleLiveView({ env: {}, headers: headers(), body: '{}', fetchFn });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ state: 'unavailable' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('kaputtes oder fehlendes Token → „invalid“ ohne Datenbank (gleiche Antwort wie unbekannt)', async () => {
    const fetchFn = fakeFetch(ACTIVE);
    for (const body of [
      null,
      '',
      'kein json',
      '{"token": 5}',
      '{"token": "abc"}',
      `{"token":"${TOKEN}x"}`,
    ]) {
      const res = await handleLiveView({ env: ENV, headers: headers(), body, fetchFn });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ state: 'invalid' });
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('gültiges Token: get_live_view mit Hash und IP-Prüfwert, service-Schlüssel, Antwort geprüft', async () => {
    const fetchFn = fakeFetch(ACTIVE);
    const res = await handleLiveView({
      env: ENV,
      headers: headers(),
      body: JSON.stringify({ token: TOKEN }),
      fetchFn,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(ACTIVE);
    expect(res.headers).toEqual(LIVE_HEADERS);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://projekt.supabase.co/rest/v1/rpc/get_live_view');
    const sent = JSON.parse(String(init.body)) as Record<string, string>;
    expect(sent).toEqual({
      p_token_hash: liveTokenHash(TOKEN),
      p_ip_hash: liveIpHash(SECRET, '203.0.113.7'),
    });
    // Weder Token noch IP im Klartext an die Datenbank.
    expect(String(init.body)).not.toContain(TOKEN);
    expect(String(init.body)).not.toContain('203.0.113.7');
    expect((init.headers as Record<string, string>).apikey).toBe('sb_secret_abc');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('alter JWT-Schlüssel zusätzlich als Bearer', async () => {
    const fetchFn = fakeFetch(ACTIVE);
    await handleLiveView({
      env: { ...ENV, SUPABASE_SERVICE_ROLE_KEY: 'eyJabc' },
      headers: headers(),
      body: JSON.stringify({ token: TOKEN }),
      fetchFn,
    });
    const init = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer eyJabc');
  });

  it('Zusatzfelder der Datenbank (z. B. Gesundheitswerte) werden NICHT durchgereicht → Fehler', async () => {
    const res = await handleLiveView({
      env: ENV,
      headers: headers(),
      body: JSON.stringify({ token: TOKEN }),
      fetchFn: fakeFetch({ ...ACTIVE, heart_rate: 150 }),
    });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ state: 'error' });
  });

  it('abgeschlossen mit Koordinaten → Fehler (darf nie vorkommen)', async () => {
    const { position, ...rest } = ACTIVE;
    const res = await handleLiveView({
      env: ENV,
      headers: headers(),
      body: JSON.stringify({ token: TOKEN }),
      fetchFn: fakeFetch({ ...rest, state: 'arrived', ended_at: rest.server_time, position }),
    });
    expect(res.body).toEqual({ state: 'error' });
  });

  it('gebremst → 429; Datenbank-Fehler → 502 ohne Details', async () => {
    const limited = await handleLiveView({
      env: ENV,
      headers: headers(),
      body: JSON.stringify({ token: TOKEN }),
      fetchFn: fakeFetch({ state: 'rate_limited' }),
    });
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ state: 'rate_limited' });
    const failed = await handleLiveView({
      env: ENV,
      headers: headers(),
      body: JSON.stringify({ token: TOKEN }),
      fetchFn: fakeFetch({ message: 'boom 50.9' }, 500),
    });
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ state: 'error' });
    const thrown = await handleLiveView({
      env: ENV,
      headers: headers(),
      body: JSON.stringify({ token: TOKEN }),
      fetchFn: vi.fn(async () => {
        throw new Error('netz');
      }),
    });
    expect(thrown.body).toEqual({ state: 'error' });
  });

  it('kein Logging (console bleibt still)', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((m) => vi.spyOn(console, m));
    await handleLiveView({
      env: ENV,
      headers: headers(),
      body: JSON.stringify({ token: TOKEN }),
      fetchFn: fakeFetch({ message: 'x' }, 500),
    });
    await handleLiveView({
      env: ENV,
      headers: headers(),
      body: JSON.stringify({ token: TOKEN }),
      fetchFn: fakeFetch(ACTIVE),
    });
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });

  it('Kopfzeilen: no-store, noindex, no-referrer', () => {
    expect(LIVE_HEADERS['Cache-Control']).toContain('no-store');
    expect(LIVE_HEADERS['X-Robots-Tag']).toBe('noindex, nofollow');
    expect(LIVE_HEADERS['Referrer-Policy']).toBe('no-referrer');
  });
});

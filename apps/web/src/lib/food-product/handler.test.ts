import { readFileSync } from 'node:fs';

import {
  FOOD_PRODUCT_LOOKUP_LIMITS,
  type FoodProductRecord,
  MOCK_PRODUCT_CASES,
  mockOffFetch,
  OPEN_FOOD_FACTS,
  type OffFetchResult,
  type ProductLookupBegin,
  productLookupResponseSchema,
} from '@fitnessapp/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readFoodProductBody } from './body';
import { APP_VERSION, readFoodProductConfig } from './config';
import { handleFoodProduct } from './handler';
import { createOffClient, offProductUrl } from './off-client';
import { createSupabaseFoodProductStore, type FoodProductStore } from './store';

/**
 * Etappe E4a (docs/PLAN-E4.md 3.2, 8.2/8.3): Route ohne Netz – globales fetch ist gesperrt, OFF und Supabase sind
 * Attrappen. Alle Produktwerte sind ausgedachte Testwerte.
 */

const USER = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMTEifQ.signatur-abc';
const CONTACT = 'kontakt@alpha5.example';
const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://projekt.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x',
  APP_WEB_ORIGIN: 'https://app.example.test',
  OFF_CONTACT_EMAIL: CONTACT,
};
const CODE = MOCK_PRODUCT_CASES[0].code;
const NAME = 'Testprodukt Müsli';

const headers = (h: Record<string, string>) => ({
  get: (name: string) => h[name.toLowerCase()] ?? null,
});
const auth = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' };

function fakeStore(begin: ProductLookupBegin = { result: 'fetch', record: null }) {
  const stored: FoodProductRecord[] = [];
  const store: FoodProductStore = {
    verifyUser: vi.fn((token: string) => Promise.resolve(token === TOKEN ? USER : null)),
    begin: vi.fn(() => Promise.resolve(begin)),
    upsert: vi.fn((r: FoodProductRecord) => {
      stored.push(r);
      return Promise.resolve();
    }),
    backoff: vi.fn(() => Promise.resolve()),
  };
  return { store, stored };
}

async function call(
  opts: {
    store?: FoodProductStore;
    fetchOff?: (code: string) => Promise<OffFetchResult>;
    body?: string | null;
    h?: Record<string, string>;
    env?: Record<string, string>;
    readBody?: () => Promise<string | null>;
  } = {},
) {
  const store = opts.store ?? fakeStore().store;
  return handleFoodProduct({
    env: opts.env ?? ENV,
    headers: headers(opts.h ?? auth),
    readBody:
      opts.readBody ??
      (() => Promise.resolve(opts.body === undefined ? JSON.stringify({ code: CODE }) : opts.body)),
    deps: () => ({
      store,
      fetchOff: opts.fetchOff ?? vi.fn(mockOffFetch),
      now: () => '2026-10-17T10:00:00.000Z',
    }),
  });
}

let errors: string[] = [];
let netFetch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  errors = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  // Kein echtes Netz in Tests (CI): jeder unerwartete fetch schlägt fehl.
  netFetch = vi.fn(() => Promise.reject(new Error('kein Netz in Tests')));
  vi.stubGlobal('fetch', netFetch);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Konfiguration (OFF_CONTACT_EMAIL Pflicht, Plan 1.2)', () => {
  it('ohne bzw. mit ungültiger Kontaktadresse → aus (not_configured), nie eine Abfrage', async () => {
    for (const contact of [undefined, '', 'keine-mail', 'a@b']) {
      const env = { ...ENV, OFF_CONTACT_EMAIL: contact as string };
      expect(readFoodProductConfig(env).status).toBe('disabled');
      const fetchOff = vi.fn(mockOffFetch);
      const r = await call({ env, fetchOff });
      expect(r).toMatchObject({ status: 503, body: { code: 'not_configured' } });
      expect(fetchOff).not.toHaveBeenCalled();
    }
  });

  it('User-Agent = Alpha5/<Version> (<Kontakt>); Version = package.json; Gründe ohne Werte', () => {
    const r = readFoodProductConfig(ENV);
    expect(r.status === 'ok' && r.config.userAgent).toBe(`Alpha5/${APP_VERSION} (${CONTACT})`);
    const pkg = JSON.parse(
      readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
    const off = readFoodProductConfig({ ...ENV, OFF_CONTACT_EMAIL: 'x' });
    expect(JSON.stringify(off)).not.toContain('"x"');
  });
});

describe('Herkunft, Login, Körper (Plan 3.2 Nr. 1–4)', () => {
  it('fremde Herkunft → 403, eigene App erlaubt (CORS-Kopfzeilen)', async () => {
    const r = await call({ h: { ...auth, origin: 'https://boese.example' } });
    expect(r).toMatchObject({ status: 403, body: { code: 'forbidden_origin' } });
    const ok = await call({ h: { ...auth, origin: 'https://app.example.test' } });
    expect(ok.headers['Access-Control-Allow-Origin']).toBe('https://app.example.test');
    expect(ok.headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  it('Login VOR dem Lesen des Körpers: ohne/ungültiges Token wird der Körper nie gelesen', async () => {
    for (const h of [
      { 'content-type': 'application/json' },
      { ...auth, authorization: 'Bearer kurz' },
      { ...auth, authorization: `Bearer ${TOKEN}x` },
    ]) {
      const readBody = vi.fn(() => Promise.resolve(JSON.stringify({ code: CODE })));
      const r = await call({ h, readBody });
      expect(r).toMatchObject({ status: 401, body: { code: 'unauthorized' } });
      expect(readBody).not.toHaveBeenCalled();
    }
  });

  it('Körper > 256 Byte, falscher Typ, kaputtes JSON, Zusatzfelder → invalid_request', async () => {
    const readBody = vi.fn(() => Promise.resolve('{}'));
    expect(await call({ h: { ...auth, 'content-length': '257' }, readBody })).toMatchObject({
      status: 400,
    });
    expect(readBody).not.toHaveBeenCalled();
    expect((await call({ h: { ...auth, 'content-type': 'text/plain' } })).status).toBe(400);
    for (const body of [
      null,
      '{kaputt',
      '[]',
      JSON.stringify({ code: CODE, user: 'x' }),
      '{"code": 4006381333931}',
    ]) {
      expect((await call({ body })).body).toEqual({ code: 'invalid_request' });
    }
  });

  it('readFoodProductBody: höchstens 256 Byte (gestreamt), sonst null', async () => {
    const small = new Request('https://x.test/api', { method: 'POST', body: '{"code":"1"}' });
    expect(await readFoodProductBody(small)).toBe('{"code":"1"}');
    const big = new Request('https://x.test/api', { method: 'POST', body: 'x'.repeat(257) });
    expect(await readFoodProductBody(big)).toBeNull();
  });

  it('ungültige Nummer bzw. Ladencode: keine Datenbank-Zählung, keine OFF-Abfrage', async () => {
    const { store } = fakeStore();
    const fetchOff = vi.fn(mockOffFetch);
    expect((await call({ store, fetchOff, body: '{"code":"4006381333932"}' })).body).toEqual({
      code: 'invalid_code',
    });
    expect((await call({ store, fetchOff, body: '{"code":"2012345678903"}' })).body).toEqual({
      code: 'not_food_code',
    });
    expect(store.begin).not.toHaveBeenCalled();
    expect(fetchOff).not.toHaveBeenCalled();
  });
});

describe('Kette über die Datenbank (Plan 3.2 Nr. 5–11)', () => {
  it.each([
    [{ result: 'flag_off' } as const, 503, 'not_configured'],
    [{ result: 'no_consent' } as const, 403, 'no_consent'],
    [{ result: 'rate_limited', scope: 'hour' } as const, 429, 'rate_limited'],
    [{ result: 'unavailable' } as const, 503, 'unavailable'],
  ])('%j → %s %s (ohne OFF)', async (begin, status, code) => {
    const fetchOff = vi.fn(mockOffFetch);
    const r = await call({ store: fakeStore(begin).store, fetchOff });
    expect(r.status).toBe(status);
    expect(r.body.code).toBe(code);
    expect(fetchOff).not.toHaveBeenCalled();
  });

  it('gefunden: Antwort nach Schema, Speicher-Zeile geschrieben, Nutzer-ID nur an die Datenbank', async () => {
    const { store, stored } = fakeStore();
    const r = await call({ store });
    expect(r.status).toBe(200);
    expect(productLookupResponseSchema.safeParse(r.body).success).toBe(true);
    expect(r.body).toMatchObject({ code: 'found', mock: false, stale: false });
    expect(store.begin).toHaveBeenCalledWith(USER, CODE);
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored[0])).not.toContain(USER);
  });

  it('Speicher frisch → keine OFF-Abfrage', async () => {
    const { store, stored } = fakeStore();
    await call({ store });
    const cached = fakeStore({
      result: 'cached',
      stale: false,
      record: stored[0] as FoodProductRecord,
    });
    const fetchOff = vi.fn(mockOffFetch);
    const r = await call({ store: cached.store, fetchOff });
    expect(r.body).toMatchObject({ code: 'found', stale: false });
    expect(fetchOff).not.toHaveBeenCalled();
    expect(errors).toEqual(['Produktabfrage: cache_hit']);
  });

  it('429/503 → Sperre 5 Minuten (backoff), Fehler nicht wiederholt', async () => {
    const { store } = fakeStore();
    const fetchOff = vi.fn(() => Promise.resolve({ kind: 'overloaded' } as const));
    const r = await call({ store, fetchOff });
    expect(r).toMatchObject({ status: 503, body: { code: 'unavailable' } });
    expect(store.backoff).toHaveBeenCalledTimes(1);
    expect(fetchOff).toHaveBeenCalledTimes(1);
  });

  it('Datenbank-Fehler → 502 failed, Log nur mit festem Code', async () => {
    const { store } = fakeStore();
    store.begin = vi.fn(() => Promise.reject(new TypeError('boom 4006381333931')));
    const r = await call({ store });
    expect(r).toMatchObject({ status: 502, body: { code: 'failed' } });
    expect(errors).toEqual(['Produktabfrage: failed (TypeError)']);
  });

  it('Logs ohne Nummer, Produktname, Nutzer-ID oder Token', async () => {
    for (const fetchOff of [
      vi.fn(mockOffFetch),
      vi.fn(() => Promise.resolve({ kind: 'timeout' } as const)),
      vi.fn(() => Promise.resolve({ kind: 'overloaded' } as const)),
    ]) {
      await call({ fetchOff });
    }
    const all = errors.join('\n');
    for (const secret of [CODE, NAME, USER, TOKEN, CONTACT]) expect(all).not.toContain(secret);
  });
});

describe('OFF-Client (Plan 3.2 Nr. 9) – Ersatz-fetch', () => {
  const okResponse = (body: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      ...init,
    });

  it('genau User-Agent + Accept, GET, keine Weiterleitung, keine Nutzerdaten; Nummer nur im Pfad', async () => {
    const fetchFn = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(okResponse({ status: 1, product: { product_name: 'x' } })),
    );
    const client = createOffClient({ userAgent: `Alpha5/0.1.0 (${CONTACT})`, fetchFn });
    expect(await client(CODE)).toEqual({
      kind: 'answer',
      body: { status: 1, product: { product_name: 'x' } },
    });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe(
      `https://world.openfoodfacts.org/api/v2/product/${CODE}?fields=${OPEN_FOOD_FACTS.fields.join(',')}`,
    );
    expect(init?.method).toBe('GET');
    expect(init?.redirect).toBe('error');
    expect(init?.credentials).toBe('omit');
    expect(init?.headers).toEqual({
      'User-Agent': `Alpha5/0.1.0 (${CONTACT})`,
      Accept: 'application/json',
    });
    expect(JSON.stringify(init)).not.toMatch(
      /Authorization|Cookie|X-Forwarded-For|Referer|11111111/i,
    );
    expect(url).not.toMatch(/image|ingredients|nutriscore|nova/);
  });

  it('Nummer mit Fremdzeichen kann die Adresse nicht verändern', () => {
    expect(() => offProductUrl('123/../x')).toThrow();
    expect(() => offProductUrl('4006381333931?a=b')).toThrow();
  });

  it.each([
    [404, 'not_found'],
    [429, 'overloaded'],
    [503, 'overloaded'],
    [500, 'failed'],
    [301, 'failed'],
  ])('HTTP %s → %s', async (status, kind) => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        new Response('{}', { status, headers: { 'content-type': 'application/json' } }),
      ),
    );
    expect(await createOffClient({ userAgent: 'x', fetchFn })(CODE)).toEqual({ kind });
  });

  it('Weiterleitung (redirect: error → fetch wirft) → failed', async () => {
    const fetchFn = vi.fn(() => Promise.reject(new TypeError('redirect mode is set to error')));
    expect(await createOffClient({ userAgent: 'x', fetchFn })(CODE)).toEqual({ kind: 'failed' });
  });

  it('falscher Content-Type, kaputtes JSON, Antwort > 512 KB → failed', async () => {
    const html = vi.fn(() =>
      Promise.resolve(
        new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      ),
    );
    expect(await createOffClient({ userAgent: 'x', fetchFn: html })(CODE)).toEqual({
      kind: 'failed',
    });
    const broken = vi.fn(() =>
      Promise.resolve(new Response('{kaputt', { headers: { 'content-type': 'application/json' } })),
    );
    expect(await createOffClient({ userAgent: 'x', fetchFn: broken })(CODE)).toEqual({
      kind: 'failed',
    });
    const huge = vi.fn(() =>
      Promise.resolve(
        new Response(`{"x":"${'a'.repeat(OPEN_FOOD_FACTS.maxResponseBytes)}"}`, {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    expect(await createOffClient({ userAgent: 'x', fetchFn: huge })(CODE)).toEqual({
      kind: 'failed',
    });
  });

  it('Zeitlimit 6 s: hängende Antwort → timeout', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('abgebrochen')));
        }),
    );
    const pending = createOffClient({ userAgent: 'x', fetchFn })(CODE);
    await vi.advanceTimersByTimeAsync(OPEN_FOOD_FACTS.timeoutMs - 1);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(await pending).toEqual({ kind: 'timeout' });
  });

  it('die Route nutzt den OFF-Client nie ohne Kontaktadresse und das globale fetch nie in Tests', async () => {
    await call({ env: { ...ENV, OFF_CONTACT_EMAIL: '' } });
    expect(netFetch).not.toHaveBeenCalled();
  });
});

describe('Supabase-Zugriff (store.ts) – Ersatz-fetch', () => {
  it('begin: RPC mit service_role, Antwort mit Zod geprüft; Token nur an /auth/v1/user', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/auth/v1/user')) {
        return Promise.resolve(new Response(JSON.stringify({ id: USER }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ result: 'fetch', record: null })));
    }) as unknown as typeof fetch;
    const store = createSupabaseFoodProductStore(
      {
        supabaseUrl: 'https://p.supabase.co',
        supabasePublishableKey: 'pub',
        supabaseServiceKey: 'sec',
      },
      fetchFn,
    );
    expect(await store.verifyUser(TOKEN)).toBe(USER);
    expect(await store.begin(USER, CODE)).toEqual({ result: 'fetch', record: null });
    expect(calls[1]?.url).toBe('https://p.supabase.co/rest/v1/rpc/food_product_lookup');
    expect(JSON.parse(String(calls[1]?.init.body))).toEqual({ p_user_id: USER, p_code: CODE });
    expect(JSON.stringify(calls[1]?.init.headers)).not.toContain(TOKEN);
    expect(JSON.stringify(calls[0]?.init.headers)).not.toContain('sec');
  });

  it('Wächter N2: jeder Supabase-Aufruf mit Zeitlimit 5 s – hängende Datenbank → Fehler statt Warten', async () => {
    // AbortSignal.timeout wird ersetzt: das Signal löst sofort aus (statt 5 s echter Wartezeit im Test).
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const c = new AbortController();
      queueMicrotask(() => c.abort(new DOMException('Zeitlimit', 'TimeoutError')));
      return c.signal;
    });
    const fetchFn = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason as Error));
        }),
    ) as unknown as typeof fetch;
    const store = createSupabaseFoodProductStore(
      {
        supabaseUrl: 'https://p.supabase.co',
        supabasePublishableKey: 'pub',
        supabaseServiceKey: 'sec',
      },
      fetchFn,
    );
    try {
      await expect(store.verifyUser(TOKEN)).rejects.toThrow('Zeitlimit');
      await expect(store.begin(USER, CODE)).rejects.toThrow('Zeitlimit');
      await expect(store.upsert({} as never)).rejects.toThrow('Zeitlimit');
      await expect(store.backoff()).rejects.toThrow('Zeitlimit');
      expect(timeout.mock.calls).toEqual(
        Array.from({ length: 4 }, () => [FOOD_PRODUCT_LOOKUP_LIMITS.supabaseTimeoutMs]),
      );
      expect(FOOD_PRODUCT_LOOKUP_LIMITS.supabaseTimeoutMs).toBe(5_000);
    } finally {
      timeout.mockRestore();
    }
  });

  it('unerwartete Antwort der Datenbank → Fehler (kein ungeprüftes Weiterreichen)', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ result: 'cached', record: { user_id: USER } })),
      ),
    ) as unknown as typeof fetch;
    const store = createSupabaseFoodProductStore(
      {
        supabaseUrl: 'https://p.supabase.co',
        supabasePublishableKey: 'pub',
        supabaseServiceKey: 'sec',
      },
      fetchFn,
    );
    await expect(store.begin(USER, CODE)).rejects.toThrow('HTTP 500');
  });
});

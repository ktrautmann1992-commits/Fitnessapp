import {
  LOOP_ROUTE,
  type LoopCandidate,
  loopResponseSchema,
  mockLoopCandidates,
  roundStartPoint,
} from '@fitnessapp/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readLoopRoutingConfig } from './config';
import { handleLoopRouting, type LoopRoutingDeps } from './handler';
import {
  createOrsClient,
  ORS_BASE_URL,
  orsProfile,
  orsRoundTripBody,
  parseOrsRoundTrip,
  surfaceShares,
} from './ors-client';
import { createLoopRateLimiter } from './rate-limit';

/**
 * Rundkurs-Vorschlag (docs/PLAN-RUNDKURS.md): Route ohne Netz – globales fetch ist gesperrt, ORS und Supabase sind
 * Attrappen. Startpunkt: Kölner Dom (öffentlicher Ort, keine echten Nutzerdaten).
 */

const USER = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMTEifQ.signatur-abc';
const ORS_KEY = '5b3ce3597851110001cf6248aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://projekt.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  APP_WEB_ORIGIN: 'https://app.example.test',
  ORS_API_KEY: ORS_KEY,
};
const LAT = 50.941312;
const LNG = 6.958271;
const BODY = { lat: LAT, lng: LNG, distance_km: 5, surface: 'any', variant: 0 };

const headers = (h: Record<string, string>) => ({
  get: (name: string) => h[name.toLowerCase()] ?? null,
});
const auth = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' };

/** ORS-ähnliche Antwort aus einer Attrappen-Runde. */
function orsJson(c: LoopCandidate) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: c.points.map((p) => [p.lng, p.lat, 55.5]) },
        properties: {
          summary: { distance: c.distanceM, duration: 1800 },
          ascent: c.ascentM,
          descent: c.ascentM,
          extras: {
            surface: {
              values: [[0, 10, 3]],
              summary: [
                { value: 3, distance: 3000, amount: 60 },
                { value: 11, distance: 1800, amount: 36 },
                { value: 0, distance: 200, amount: 4 },
              ],
            },
          },
        },
      },
    ],
  };
}

function deps(over: Partial<LoopRoutingDeps> = {}) {
  const calls: unknown[] = [];
  const mock = mockLoopCandidates({
    start: roundStartPoint({ lat: LAT, lng: LNG }),
    distanceKm: 5,
    surface: 'any',
    variant: 0,
  });
  const d: LoopRoutingDeps = {
    verifyUser: vi.fn((t: string) => Promise.resolve(t === TOKEN ? USER : null)),
    fetchRoundTrip: vi.fn((input) => {
      calls.push(input);
      const c = mock[input.seed % mock.length] as LoopCandidate;
      return Promise.resolve({ kind: 'ok' as const, candidate: { ...c, id: `ors-${input.seed}` } });
    }),
    limiter: createLoopRateLimiter(),
    now: () => Date.parse('2026-10-25T10:00:00Z'),
    ...over,
  };
  return { d, calls };
}

async function call(opts: {
  env?: Record<string, string>;
  h?: Record<string, string>;
  body?: unknown;
  d?: LoopRoutingDeps;
}) {
  const d = opts.d ?? deps().d;
  const readBody = vi.fn(() =>
    Promise.resolve(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body ?? BODY)),
  );
  const res = await handleLoopRouting({
    env: opts.env ?? ENV,
    headers: headers(opts.h ?? auth),
    readBody,
    deps: () => d,
  });
  return { res, readBody };
}

let errorSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('Kein Netz im Test'))),
  );
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  // Datenschutz: Keine Koordinate (auch nicht gerundet), kein Token, keine Nutzer-ID in Logs.
  const logged = [...errorSpy.mock.calls, ...logSpy.mock.calls, ...warnSpy.mock.calls]
    .flat()
    .map(String)
    .join('\n');
  for (const secret of ['50.94', '6.95', '6.96', TOKEN, USER, ORS_KEY]) {
    expect(logged).not.toContain(secret);
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Konfiguration', () => {
  it('ohne ORS_API_KEY nicht eingerichtet; Attrappe nur ausdrücklich', () => {
    expect(readLoopRoutingConfig({ ...ENV, ORS_API_KEY: '' }).status).toBe('disabled');
    const mock = readLoopRoutingConfig({
      ...ENV,
      ORS_API_KEY: '',
      LOOP_ROUTING_PROVIDER: 'attrappe',
    });
    expect(mock.status === 'ok' && mock.config.provider).toBe('attrappe');
    const ors = readLoopRoutingConfig(ENV);
    expect(ors.status === 'ok' && ors.config.provider).toBe('ors');
    expect(readLoopRoutingConfig({ ...ENV, LOOP_ROUTING_PROVIDER: 'google' }).status).toBe(
      'disabled',
    );
  });

  it('Gründe nennen nie den Schlüssel selbst', () => {
    const r = readLoopRoutingConfig({ ...ENV, ORS_API_KEY: 'zu kurz!' });
    expect(r.status === 'disabled' && r.reasons.join(' ')).not.toContain('zu kurz');
  });
});

describe('Route POST /api/strecken/rundkurs', () => {
  it('liefert 2–3 bewertete Runden; an den Dienst geht nur der gerundete Start', async () => {
    const { d, calls } = deps();
    const { res } = await call({ d });
    expect(res.status).toBe(200);
    const body = loopResponseSchema.parse(res.body);
    expect(body.code).toBe('ok');
    if (body.code === 'ok') {
      expect(body.routes.length).toBeGreaterThanOrEqual(2);
      expect(body.routes.length).toBeLessThanOrEqual(3);
    }
    expect(calls).toHaveLength(LOOP_ROUTE.providerCandidates);
    const rounded = roundStartPoint({ lat: LAT, lng: LNG });
    for (const c of calls) {
      expect(c).toEqual(expect.objectContaining({ start: rounded, distanceKm: 5, surface: 'any' }));
      expect(JSON.stringify(c)).not.toContain(USER);
    }
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('ohne Schlüssel: 503 not_configured, Körper wird nie gelesen', async () => {
    const { res, readBody } = await call({ env: { ...ENV, ORS_API_KEY: '' } });
    expect(res).toMatchObject({ status: 503, body: { code: 'not_configured' } });
    expect(readBody).not.toHaveBeenCalled();
  });

  it('Attrappe (LOOP_ROUTING_PROVIDER=attrappe) ohne Schlüssel und ohne Dienst', async () => {
    const { d } = deps();
    const { res } = await call({
      env: { ...ENV, ORS_API_KEY: '', LOOP_ROUTING_PROVIDER: 'attrappe' },
      d,
    });
    expect(res.body.code).toBe('ok');
    expect(d.fetchRoundTrip).not.toHaveBeenCalled();
  });

  it('ohne bzw. mit falschem Login: 401, Körper nie gelesen', async () => {
    const a = await call({ h: { 'content-type': 'application/json' } });
    expect(a.res).toMatchObject({ status: 401, body: { code: 'unauthorized' } });
    expect(a.readBody).not.toHaveBeenCalled();
    const b = await call({
      h: { ...auth, authorization: 'Bearer eyJfalsch.falsch.falsch-falsch-falsch' },
    });
    expect(b.res.status).toBe(401);
    expect(b.readBody).not.toHaveBeenCalled();
  });

  it('fremde Herkunft: 403; eigene App: CORS-Kopfzeilen', async () => {
    const bad = await call({ h: { ...auth, origin: 'https://boese.example' } });
    expect(bad.res).toMatchObject({ status: 403, body: { code: 'forbidden_origin' } });
    const good = await call({ h: { ...auth, origin: 'https://app.example.test' } });
    expect(good.res.headers['Access-Control-Allow-Origin']).toBe('https://app.example.test');
  });

  it('ungültige Körper: 400', async () => {
    for (const body of [
      'kein json',
      { ...BODY, distance_km: 50 },
      { ...BODY, extra: 1 },
      { ...BODY, lat: 'x' },
    ]) {
      const { res } = await call({ body });
      expect(res).toMatchObject({ status: 400, body: { code: 'invalid_request' } });
    }
    const big = await call({ h: { ...auth, 'content-length': '5000' } });
    expect(big.res.status).toBe(400);
    const text = await call({ h: { ...auth, 'content-type': 'text/plain' } });
    expect(text.res.status).toBe(400);
  });

  it('Bremse: ab der 7. Anfrage in 10 Minuten 429', async () => {
    const { d } = deps();
    for (let i = 0; i < LOOP_ROUTE.rateLimit.perUserWindow; i += 1) {
      expect((await call({ d })).res.status).toBe(200);
    }
    expect((await call({ d })).res).toMatchObject({ status: 429, body: { code: 'rate_limited' } });
  });

  it('Dienst: alle ohne Weg → no_routes; alle kaputt → 502 unavailable; 429 → rate_limited', async () => {
    const none = deps({ fetchRoundTrip: () => Promise.resolve({ kind: 'no_route' }) }).d;
    expect((await call({ d: none })).res.body).toEqual({ code: 'no_routes' });
    const broken = deps({ fetchRoundTrip: () => Promise.reject(new Error('x')) }).d;
    expect((await call({ d: broken })).res).toMatchObject({
      status: 502,
      body: { code: 'unavailable' },
    });
    const limited = deps({ fetchRoundTrip: () => Promise.resolve({ kind: 'rate_limited' }) }).d;
    expect((await call({ d: limited })).res.status).toBe(429);
  });

  it('nur untaugliche Runden (hin und zurück) → no_routes', async () => {
    const mock = mockLoopCandidates({
      start: roundStartPoint({ lat: LAT, lng: LNG }),
      distanceKm: 5,
      surface: 'any',
      variant: 0,
    });
    const outAndBack = mock.find((c) => c.id === 'mock-3') as LoopCandidate;
    const d = deps({
      fetchRoundTrip: () => Promise.resolve({ kind: 'ok', candidate: outAndBack }),
    }).d;
    expect((await call({ d })).res.body).toEqual({ code: 'no_routes' });
  });

  it('Supabase-Ausfall beim Login → 502 ohne Inhalte', async () => {
    const d = deps({ verifyUser: () => Promise.reject(new Error('down')) }).d;
    expect((await call({ d })).res).toMatchObject({ status: 502, body: { code: 'unavailable' } });
  });
});

describe('ORS-Anbindung', () => {
  const start = roundStartPoint({ lat: LAT, lng: LNG });

  it('Körper: Rundkurs mit Länge, Stützpunkten, seed; Höhe und Untergrund; keine Personendaten', () => {
    const body = orsRoundTripBody({ start, distanceKm: 10, seed: 7 });
    expect(body).toEqual({
      coordinates: [[start.lng, start.lat]],
      options: { round_trip: { length: 9200, points: LOOP_ROUTE.roundTripPoints, seed: 7 } },
      elevation: true,
      extra_info: ['surface'],
      instructions: false,
    });
    expect(orsProfile('unpaved')).toBe('foot-hiking');
    expect(orsProfile('paved')).toBe('foot-walking');
    expect(orsProfile('any')).toBe('foot-walking');
  });

  it('Untergrund-Anteile aus der Zusammenfassung', () => {
    expect(
      surfaceShares([
        { value: 3, distance: 600 },
        { value: 11, distance: 300 },
        { value: 0, distance: 100 },
      ]),
    ).toEqual({ paved: 0.6, unpaved: 0.3, unknown: 0.1 });
    expect(surfaceShares([])).toBeNull();
    expect(surfaceShares(undefined)).toBeNull();
  });

  it('Antwort lesen: Linie, Distanz, Höhenmeter; Unsinn → null', () => {
    const c = mockLoopCandidates({
      start,
      distanceKm: 5,
      surface: 'any',
      variant: 0,
    })[0] as LoopCandidate;
    const parsed = parseOrsRoundTrip(orsJson(c), 'ors-0');
    expect(parsed?.points.length).toBe(c.points.length);
    expect(parsed?.distanceM).toBe(c.distanceM);
    expect(parsed?.ascentM).toBe(c.ascentM);
    expect(parsed?.surface).toEqual({ paved: 0.6, unpaved: 0.36, unknown: 0.04 });
    expect(parseOrsRoundTrip({ features: [] }, 'x')).toBeNull();
    expect(parseOrsRoundTrip({ error: { code: 2010 } }, 'x')).toBeNull();
  });

  it('Client: Schlüssel im Header (nie in der Adresse), Profil im Pfad, Fehlercodes', async () => {
    const c = mockLoopCandidates({
      start,
      distanceKm: 5,
      surface: 'any',
      variant: 0,
    })[0] as LoopCandidate;
    const fetchFn = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify(orsJson(c)), { status: 200 })),
    );
    const client = createOrsClient({
      apiKey: ORS_KEY,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const r = await client({ start, distanceKm: 5, surface: 'unpaved', seed: 2 });
    expect(r.kind).toBe('ok');
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ORS_BASE_URL}/foot-hiking/geojson`);
    expect(url).not.toContain(ORS_KEY);
    expect((init.headers as Record<string, string>).Authorization).toBe(ORS_KEY);

    const status = (s: number) =>
      createOrsClient({
        apiKey: ORS_KEY,
        fetchFn: (() =>
          Promise.resolve(new Response('{}', { status: s }))) as unknown as typeof fetch,
      })({ start, distanceKm: 5, surface: 'any', seed: 0 });
    expect((await status(429)).kind).toBe('rate_limited');
    expect((await status(404)).kind).toBe('no_route');
    expect((await status(500)).kind).toBe('failed');
    const offline = createOrsClient({
      apiKey: ORS_KEY,
      fetchFn: (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch,
    });
    expect((await offline({ start, distanceKm: 5, surface: 'any', seed: 0 })).kind).toBe('failed');
  });
});

describe('Bremse', () => {
  it('Tageslimit je Person und gemeinsamer Minuten-Deckel', () => {
    const limiter = createLoopRateLimiter({
      perUserWindowMs: 1,
      perUserWindow: 100,
      perUserDay: 3,
      globalPerMinute: 4,
    });
    let t = 0;
    for (let i = 0; i < 3; i += 1) expect(limiter.take('a', (t += 1000))).toBe('ok');
    expect(limiter.take('a', (t += 1000))).toBe('user_limit');
    expect(limiter.take('b', (t += 1))).toBe('ok');
    expect(limiter.take('c', (t += 1))).toBe('global_limit');
    // Nach einer Minute wieder frei.
    expect(limiter.take('c', t + 61_000)).toBe('ok');
  });
});

import {
  createMockFoodPhotoProvider,
  FOOD_PHOTO_INSTRUCTION,
  FoodPhotoProviderError,
} from '@fitnessapp/core';
import type { FoodPhotoProvider, FoodPhotoProviderRequest } from '@fitnessapp/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isAllowedAppOrigin, readFoodPhotoConfig } from './config';
import { FOOD_PHOTO_MAX_BODY_BYTES, readFoodPhotoForm } from './form';
import { handleFoodPhoto, type FoodPhotoForm } from './handler';
import { createGeminiProvider, geminiRequestBody } from './provider';
import {
  createSupabaseFoodPhotoStore,
  type FinishParams,
  type FoodPhotoStore,
  type ReserveResult,
} from './store';

const USER = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMTEifQ.signatur-abc';
const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://projekt.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x',
  APP_WEB_ORIGIN: 'https://app.example.test',
};

const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
/** Kleines JPEG mit EXIF/GPS (wird auf dem Server entfernt). */
function jpeg(width = 640, height = 480): Uint8Array {
  const exif = [...'Exif\0\0GPSLatitude 52.52'].map((c) => c.charCodeAt(0));
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xe1,
    ...be16(exif.length + 2),
    ...exif,
    0xff,
    0xc0,
    ...be16(11),
    8,
    ...be16(height),
    ...be16(width),
    1,
    1,
    0x11,
    0,
    0xff,
    0xda,
    ...be16(8),
    1,
    1,
    0,
    0,
    0x3f,
    0,
    0x12,
    0x34,
    0xff,
    0xd9,
  ]);
}

const headers = (h: Record<string, string>) => ({
  get: (name: string) => h[name.toLowerCase()] ?? null,
});
const form = (over: Partial<FoodPhotoForm> = {}): FoodPhotoForm => ({
  image: jpeg(),
  note: null,
  unexpectedFields: false,
  ...over,
});

function fakeStore(
  reserve: ReserveResult = { result: 'reserved', id: 'r1', remainingMonth: 22, remainingToday: 5 },
) {
  const finished: FinishParams[] = [];
  const store: FoodPhotoStore = {
    verifyUser: vi.fn((token: string) => Promise.resolve(token === TOKEN ? USER : null)),
    reserve: vi.fn(() => Promise.resolve(reserve)),
    finish: vi.fn((p: FinishParams) => {
      finished.push(p);
      return Promise.resolve();
    }),
  };
  return { store, finished };
}

async function call(
  opts: {
    store?: FoodPhotoStore;
    provider?: FoodPhotoProvider;
    form?: FoodPhotoForm | null;
    h?: Record<string, string>;
    env?: Record<string, string>;
    readForm?: () => Promise<FoodPhotoForm | null>;
  } = {},
) {
  const store = opts.store ?? fakeStore().store;
  const provider = opts.provider ?? createMockFoodPhotoProvider();
  return handleFoodPhoto({
    env: opts.env ?? ENV,
    headers: headers(opts.h ?? { authorization: `Bearer ${TOKEN}` }),
    readForm:
      opts.readForm ?? (() => Promise.resolve(opts.form === undefined ? form() : opts.form)),
    deps: () => ({ store, provider }),
  });
}

let errors: string[] = [];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  // Kein echtes Netz in Tests (CI): jeder unerwartete fetch schlägt fehl.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('kein Netz in Tests'))),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Konfiguration: Attrappe ist Standard, Gemini nur mit Flag UND Schlüssel', () => {
  it.each([
    [{}, 'attrappe'],
    [{ GEMINI_API_KEY: 'AIza-x' }, 'attrappe'],
    [{ FOOD_PHOTO_PROVIDER: 'gemini' }, 'attrappe'],
    [{ FOOD_PHOTO_PROVIDER: 'gemini', GEMINI_API_KEY: 'AIza-x' }, 'gemini'],
    [{ FOOD_PHOTO_PROVIDER: 'GEMINI', GEMINI_API_KEY: ' AIza-x ' }, 'gemini'],
  ])('%j → %s', (extra, provider) => {
    const r = readFoodPhotoConfig({ ...ENV, ...extra });
    expect(r.status === 'ok' && r.config.provider).toBe(provider);
  });

  it('unbekanntes Modell → Standardmodell (nur Modelle mit Preis)', () => {
    const r = readFoodPhotoConfig({ ...ENV, GEMINI_FOOD_PHOTO_MODEL: 'gemini-ultra-teuer' });
    expect(r.status === 'ok' && r.config.geminiModel).toBe('gemini-3.5-flash-lite');
  });

  it('ohne Supabase-Schlüssel → 503, Gründe ohne Werte', async () => {
    const r = readFoodPhotoConfig({ GEMINI_API_KEY: 'AIza-geheim' });
    expect(r.status).toBe('disabled');
    expect(JSON.stringify(r)).not.toContain('AIza-geheim');
    expect((await call({ env: {} })).body).toEqual({ code: 'not_configured' });
  });
});

describe('CORS und Login', () => {
  it('erlaubte Herkunft bekommt CORS-Kopfzeilen, fremde 403 ohne', async () => {
    const ok = await call({
      h: { authorization: `Bearer ${TOKEN}`, origin: 'https://app.example.test' },
    });
    expect(ok.headers['Access-Control-Allow-Origin']).toBe('https://app.example.test');
    expect(ok.headers['Access-Control-Allow-Credentials']).toBeUndefined();
    const bad = await call({
      h: { authorization: `Bearer ${TOKEN}`, origin: 'https://boese.example' },
    });
    expect(bad.status).toBe(403);
    expect(bad.body).toEqual({ code: 'forbidden_origin' });
    expect(bad.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('Vorschau-Herkunft nur mit Team-Kürzel', () => {
    const o = 'https://fitnessapp-git-e3-meinteam.vercel.app';
    expect(isAllowedAppOrigin(o, ENV)).toBe(false);
    expect(isAllowedAppOrigin(o, { ...ENV, APP_PREVIEW_TEAM: 'meinteam' })).toBe(true);
    expect(isAllowedAppOrigin('https://fitnessapp-git-xyz-meinteam.vercel.app', ENV)).toBe(false);
    expect(
      isAllowedAppOrigin('https://fitnessapp-x-andere.vercel.app', {
        ...ENV,
        APP_PREVIEW_TEAM: 'meinteam',
      }),
    ).toBe(false);
    expect(isAllowedAppOrigin('https://fitnessapp-alpha-five.vercel.app', {})).toBe(true);
  });

  it('ohne bzw. mit falschem Token → 401, keine Reservierung', async () => {
    const { store } = fakeStore();
    expect((await call({ store, h: {} })).status).toBe(401);
    expect((await call({ store, h: { authorization: 'Bearer kurz' } })).status).toBe(401);
    expect((await call({ store, h: { authorization: `Bearer ${TOKEN}x` } })).status).toBe(401);
    expect(store.reserve).not.toHaveBeenCalled();
  });
});

describe('Eingabe prüfen (vor der Reservierung)', () => {
  it.each([
    [null, 'invalid_request'],
    [form({ unexpectedFields: true }), 'invalid_request'],
    [form({ image: null }), 'invalid_request'],
    [form({ note: 'x'.repeat(121) }), 'note_too_long'],
    [form({ image: new TextEncoder().encode('<svg onload=alert(1)>') }), 'image_type'],
    [form({ image: jpeg(2000, 1500) }), 'image_too_large_px'],
    [form({ image: jpeg().slice(0, 20) }), 'image_broken'],
  ] as const)('%# → %s', async (f, code) => {
    const { store } = fakeStore();
    const r = await call({ store, form: f });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ code });
    expect(store.reserve).not.toHaveBeenCalled();
  });
});

describe('Premium, Einwilligung und Limit serverseitig (Reservierung)', () => {
  it.each([
    [{ result: 'flag_off' } as const, 403, { code: 'flag_off' }],
    [{ result: 'no_entitlement' } as const, 403, { code: 'no_entitlement' }],
    [{ result: 'no_consent' } as const, 403, { code: 'no_consent' }],
    [
      { result: 'limit', scope: 'month', availableFrom: '2026-11-01' } as const,
      429,
      { code: 'limit', scope: 'month', available_from: '2026-11-01' },
    ],
  ])('%j → %s', async (reserve, status, body) => {
    const { store, finished } = fakeStore(reserve);
    const provider = { ...createMockFoodPhotoProvider(), analyze: vi.fn() };
    const r = await call({ store, provider });
    expect(r.status).toBe(status);
    expect(r.body).toEqual(body);
    expect(provider.analyze).not.toHaveBeenCalled();
    expect(finished).toEqual([]);
  });
});

describe('Ablauf mit der Attrappe', () => {
  it('Beispielantwort, Abschluss succeeded mit Kosten 0, Bild ohne EXIF an den Anbieter', async () => {
    const { store, finished } = fakeStore();
    const seen: FoodPhotoProviderRequest[] = [];
    const mock = createMockFoodPhotoProvider();
    const provider: FoodPhotoProvider = {
      ...mock,
      analyze: (req) => {
        seen.push(req);
        return mock.analyze(req);
      },
    };
    const r = await call({ store, provider, form: form({ note: 'halbe Portion' }) });
    expect(r.status).toBe(200);
    expect(r.body.code).toBe('ok');
    expect(r.body).toMatchObject({ remaining_month: 22, remaining_today: 5, mock: true });
    expect(finished).toEqual([
      {
        id: 'r1',
        userId: USER,
        status: 'succeeded',
        model: 'attrappe',
        inputTokens: 1200,
        outputTokens: 180,
        costEur: 0,
      },
    ]);
    expect(String.fromCharCode(...(seen[0]?.image ?? []))).not.toContain('GPS');
    expect(seen[0]?.prompt.userText).toContain('"halbe Portion"');
    expect(store.reserve).toHaveBeenCalledWith(USER, 1);
  });

  it('kein Essen → no_food (zählt, Antwort war gültig)', async () => {
    const { store, finished } = fakeStore();
    const r = await call({ store, form: form({ note: 'test:leer' }) });
    expect(r.body).toMatchObject({ code: 'no_food' });
    expect(finished[0]?.status).toBe('succeeded');
  });

  it.each(['test:viele', 'test:menge0', 'test:kcal', 'test:kaputt'])(
    '%s → einmal neu versucht, dann invalid_answer; zählt nicht (failed)',
    async (note) => {
      const { store, finished } = fakeStore();
      const mock = createMockFoodPhotoProvider();
      const provider = { ...mock, analyze: vi.fn(mock.analyze) };
      const r = await call({ store, provider, form: form({ note }) });
      expect(r.status).toBe(502);
      expect(r.body).toEqual({ code: 'invalid_answer' });
      expect(provider.analyze).toHaveBeenCalledTimes(2);
      expect(finished[0]).toMatchObject({ status: 'failed', inputTokens: 2400, outputTokens: 360 });
    },
  );

  it('Zeitlimit → 504 timeout, failed', async () => {
    const { store, finished } = fakeStore();
    const r = await call({ store, form: form({ note: 'test:zeitlimit' }) });
    expect(r.status).toBe(504);
    expect(r.body).toEqual({ code: 'timeout' });
    expect(finished[0]?.status).toBe('failed');
  });

  it('bösartige Antwort: nur bereinigte Bezeichnungen, kein Markup in der Antwort', async () => {
    const r = await call({ form: form({ note: 'test:boese' }) });
    expect(r.body.code).toBe('ok');
    const text = JSON.stringify(r.body);
    expect(text).not.toMatch(/<script|https?:|\\u202e/i);
  });

  it('Anbieter nicht erreichbar → 502, Fehler der Datenbank → 502 failed; Logs ohne Inhalte', async () => {
    const provider: FoodPhotoProvider = {
      model: 'gemini-3.5-flash-lite',
      isMock: false,
      analyze: () => Promise.reject(new FoodPhotoProviderError('unavailable')),
    };
    const a = await call({ provider, form: form({ note: 'Essanfall nach Streit' }) });
    expect(a.body).toEqual({ code: 'provider_failed' });
    const { store } = fakeStore();
    store.reserve = () => Promise.reject(new Error(`Antwort mit ${USER}`));
    const b = await call({ store, form: form({ note: 'Essanfall nach Streit' }) });
    expect(b.body).toEqual({ code: 'failed' });
    const logs = errors.join('\n');
    expect(logs).not.toContain('Essanfall');
    expect(logs).not.toContain(USER);
    expect(logs).not.toContain(TOKEN);
    expect(logs).toContain('Foto-KI:');
  });

  it('Abschluss scheitert → Antwort bleibt, nur fester Code im Log', async () => {
    const { store } = fakeStore();
    store.finish = () => Promise.reject(new Error('HTTP 500'));
    const r = await call({ store });
    expect(r.body.code).toBe('ok');
    expect(errors.join('\n')).toContain('finish_failed');
  });
});

describe('Gemini-Adapter (vorbereitet, nur mit Ersatz-fetch getestet)', () => {
  const request: FoodPhotoProviderRequest = {
    prompt: { instruction: FOOD_PHOTO_INSTRUCTION, userText: 'Hinweis' },
    image: Uint8Array.from([1, 2, 3]),
    mimeType: 'image/jpeg',
    note: 'halbe Portion',
  };

  it('sendet nur Anweisung, Info und Bild – keine Werkzeuge, keine Nutzerdaten', () => {
    const body = geminiRequestBody(request);
    expect(Object.keys(body).sort()).toEqual(['contents', 'generationConfig', 'systemInstruction']);
    expect(body).not.toHaveProperty('tools');
    expect(body.contents[0]?.parts).toEqual([
      { text: 'Hinweis' },
      { inlineData: { mimeType: 'image/jpeg', data: 'AQID' } },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/user_id|userId|1111/);
  });

  it('Antwort und Token; Schlüssel nur im Kopf x-goog-api-key', async () => {
    const fetchFn = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
      );
      expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('AIza-test');
      expect(String(init?.body)).not.toContain('AIza-test');
      return Promise.resolve(
        Response.json({
          candidates: [{ content: { parts: [{ text: '{"items":' }, { text: '[]}' }] } }],
          usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 20, thoughtsTokenCount: 5 },
        }),
      );
    });
    const p = createGeminiProvider({
      apiKey: 'AIza-test',
      model: 'gemini-3.5-flash-lite',
      fetchFn,
    });
    expect(await p.analyze(request)).toEqual({
      text: '{"items":[]}',
      inputTokens: 900,
      outputTokens: 25,
    });
  });

  it('HTTP-Fehler → unavailable, Abbruch nach Zeitlimit → timeout', async () => {
    const down = createGeminiProvider({
      apiKey: 'k',
      model: 'm',
      fetchFn: () => Promise.resolve(new Response('Quota mit Inhalt', { status: 429 })),
    });
    await expect(down.analyze(request)).rejects.toMatchObject({ code: 'unavailable' });
    const slow = createGeminiProvider({
      apiKey: 'k',
      model: 'm',
      timeoutMs: 5,
      fetchFn: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('abgebrochen')));
        }),
    });
    await expect(slow.analyze(request)).rejects.toMatchObject({ code: 'timeout' });
  });
});

describe('Supabase-Zugriff (Ersatz-fetch)', () => {
  const config = {
    supabaseUrl: 'https://projekt.supabase.co',
    supabasePublishableKey: 'sb_publishable_x',
    supabaseServiceKey: 'sb_secret_x',
  };

  it('verifyUser: 200 → id, 401 → null; reserve/finish mit service_role', async () => {
    const calls: { url: string; headers: Record<string, string>; body?: string }[] = [];
    const fetchFn = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: String(url),
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: init?.body as string,
      });
      if (String(url).endsWith('/auth/v1/user')) {
        const auth = (init?.headers as Record<string, string>).Authorization;
        return Promise.resolve(
          auth === `Bearer ${TOKEN}`
            ? Response.json({ id: USER })
            : new Response('', { status: 401 }),
        );
      }
      if (String(url).endsWith('/rpc/ai_food_photo_reserve')) {
        return Promise.resolve(
          Response.json({ result: 'limit', scope: 'day', available_from: '2026-10-17' }),
        );
      }
      return Promise.resolve(Response.json({ result: 'ok' }));
    });
    const store = createSupabaseFoodPhotoStore(config, fetchFn);
    expect(await store.verifyUser(TOKEN)).toBe(USER);
    expect(await store.verifyUser('falsch')).toBeNull();
    expect(await store.reserve(USER, 1)).toEqual({
      result: 'limit',
      scope: 'day',
      availableFrom: '2026-10-17',
    });
    await store.finish({
      id: 'r1',
      userId: USER,
      status: 'failed',
      model: 'attrappe',
      inputTokens: 1,
      outputTokens: 2,
      costEur: 0,
    });
    expect(calls[0]?.headers.apikey).toBe('sb_publishable_x');
    expect(calls[2]?.headers.apikey).toBe('sb_secret_x');
    expect(JSON.parse(calls[2]?.body ?? '{}')).toEqual({
      p_user_id: USER,
      p_min_consent_version: 1,
    });
    expect(JSON.parse(calls[3]?.body ?? '{}')).toEqual({
      p_id: 'r1',
      p_user_id: USER,
      p_status: 'failed',
      p_model: 'attrappe',
      p_input_tokens: 1,
      p_output_tokens: 2,
      p_cost_eur: 0,
    });
  });

  it('unerwartete Antwort der Datenbank → Fehler ohne Inhalte', async () => {
    const store = createSupabaseFoodPhotoStore(config, () =>
      Promise.resolve(Response.json({ result: 'reserved', id: 'keine-uuid' })),
    );
    await expect(store.reserve(USER, 1)).rejects.toThrow('HTTP 500');
  });
});

describe('Wächter E3 M2/N2: Körper erst nach Herkunft und Login lesen, hartes Byte-Limit', () => {
  it('ohne bzw. mit ungültigem Login, fremder Herkunft oder zu großer Länge wird der Körper nie gelesen', async () => {
    const cases: Record<string, string>[] = [
      {},
      { authorization: 'Bearer kurz' },
      { authorization: `Bearer ${TOKEN}x` },
      { authorization: `Bearer ${TOKEN}`, origin: 'https://boese.example' },
      { authorization: `Bearer ${TOKEN}`, 'content-length': String(FOOD_PHOTO_MAX_BODY_BYTES + 1) },
      { authorization: `Bearer ${TOKEN}`, 'content-length': '0' },
    ];
    for (const h of cases) {
      const readForm = vi.fn(() => Promise.resolve(form()));
      const r = await call({ h, readForm });
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(readForm).not.toHaveBeenCalled();
    }
    const readForm = vi.fn(() => Promise.resolve(form()));
    expect((await call({ readForm })).status).toBe(200);
    expect(readForm).toHaveBeenCalledTimes(1);
  });

  const multipart = (image: Uint8Array) => {
    const boundary = 'xGRENZEx';
    const head = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="f"\r\nContent-Type: image/jpeg\r\n\r\n`;
    const tail = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="note"\r\n\r\nhalbe Portion\r\n--${boundary}--\r\n`;
    const enc = new TextEncoder();
    return {
      type: `multipart/form-data; boundary=${boundary}`,
      parts: [enc.encode(head), image, enc.encode(tail)],
    };
  };
  const streamed = (parts: Uint8Array[], type: string) =>
    new Request('https://web.example/api/ernaehrung/foto', {
      method: 'POST',
      headers: { 'content-type': type },
      body: new ReadableStream({
        start(controller) {
          for (const p of parts) controller.enqueue(p);
          controller.close();
        },
      }),
      duplex: 'half',
    } as RequestInit);

  it('ohne Content-Length (chunked) gestreamt gelesen; über dem Limit abgebrochen', async () => {
    const ok = multipart(jpeg());
    const form1 = await readFoodPhotoForm(streamed(ok.parts, ok.type));
    expect(form1?.note).toBe('halbe Portion');
    expect(form1?.image?.length).toBe(jpeg().length);
    const big = multipart(new Uint8Array(2000));
    expect(await readFoodPhotoForm(streamed(big.parts, big.type), 1000)).toBeNull();
    expect(await readFoodPhotoForm(streamed(ok.parts, 'text/plain'))).toBeNull();
  });
});

describe('Wächter E3 M3: echter Anbieter nur mit neuer Einwilligungsfassung', () => {
  it('Attrappe reserviert mit Mindest-Fassung 1, echter Anbieter mit 2; ohne v2 → 503 not_configured', async () => {
    const mock = fakeStore();
    await call({ store: mock.store });
    expect(mock.store.reserve).toHaveBeenCalledWith(USER, 1);
    const real = fakeStore({ result: 'not_configured' });
    const provider: FoodPhotoProvider = {
      model: 'gemini-3.5-flash-lite',
      isMock: false,
      analyze: vi.fn(),
    };
    const r = await call({ store: real.store, provider });
    expect(real.store.reserve).toHaveBeenCalledWith(USER, 2);
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ code: 'not_configured' });
    expect(provider.analyze).not.toHaveBeenCalled();
  });
});

describe('Wächter E3 N1: CORS nur für die eigenen Vorschau-Adressen', () => {
  const env = { ...ENV, APP_PREVIEW_TEAM: 'meinteam' };
  it.each([
    ['https://fitnessapp-git-e3-e4-meinteam.vercel.app', true],
    ['https://fitnessapp-a1b2c3d4e-meinteam.vercel.app', true],
    ['https://fitnessapp-web-meinteam.vercel.app', false],
    ['https://fitnessapp-x-meinteam.vercel.app', false],
    ['https://fitnessapp-evil-a1b2c3d4e-meinteam.vercel.app', false],
    ['https://fitnessappx-git-a-meinteam.vercel.app', false],
    ['https://fitnessapp-git-a-meinteam.vercel.app.evil.example', false],
    ['http://fitnessapp-git-a-meinteam.vercel.app', false],
  ])('%s → %s', (origin, allowed) => {
    expect(isAllowedAppOrigin(origin, env)).toBe(allowed);
  });
});

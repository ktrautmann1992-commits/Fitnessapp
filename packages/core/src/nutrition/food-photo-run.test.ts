import { describe, expect, it, vi } from 'vitest';

import {
  createMockFoodPhotoProvider,
  FoodPhotoProviderError,
  runFoodPhotoAnalysis,
  type FoodPhotoFinish,
  type FoodPhotoProvider,
  type FoodPhotoReserve,
} from './food-photo-run';

const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const jpeg = (w = 100, h = 100) =>
  Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xe1,
    ...be16(8),
    ...[...'GPS123'].map((c) => c.charCodeAt(0)),
    0xff,
    0xc0,
    ...be16(11),
    8,
    ...be16(h),
    ...be16(w),
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
    0x01,
    0xff,
    0xd9,
  ]);

function deps(
  reserve: FoodPhotoReserve = { result: 'reserved', id: 'r', remainingMonth: 3, remainingToday: 2 },
  provider: FoodPhotoProvider = createMockFoodPhotoProvider(),
) {
  const finished: FoodPhotoFinish[] = [];
  return {
    finished,
    deps: {
      provider,
      reserve: vi.fn(() => Promise.resolve(reserve)),
      finish: (p: FoodPhotoFinish) => {
        finished.push(p);
        return Promise.resolve();
      },
    },
  };
}

describe('runFoodPhotoAnalysis', () => {
  it('Beispiel: 200, Bestandteile, Abschluss succeeded', async () => {
    const d = deps();
    const r = await runFoodPhotoAnalysis({ note: null, image: jpeg() }, d.deps);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      code: 'ok',
      remaining_month: 3,
      remaining_today: 2,
      mock: true,
    });
    expect(d.finished).toEqual([
      {
        id: 'r',
        status: 'succeeded',
        model: 'attrappe',
        inputTokens: 1200,
        outputTokens: 180,
        costEur: 0,
      },
    ]);
  });

  it('Info 121 Zeichen und kaputtes Bild → 400 ohne Reservierung', async () => {
    const d = deps();
    expect(
      (await runFoodPhotoAnalysis({ note: 'x'.repeat(121), image: jpeg() }, d.deps)).body,
    ).toEqual({
      code: 'note_too_long',
    });
    expect(
      (await runFoodPhotoAnalysis({ note: null, image: new Uint8Array(3) }, d.deps)).body,
    ).toEqual({
      code: 'image_type',
    });
    expect(d.deps.reserve).not.toHaveBeenCalled();
  });

  it('Limit und fehlende Rechte ohne Anbieter-Aufruf', async () => {
    const analyze = vi.fn();
    const provider = { ...createMockFoodPhotoProvider(), analyze };
    const limit = deps({ result: 'limit', scope: 'day', availableFrom: '2026-10-17' }, provider);
    expect((await runFoodPhotoAnalysis({ note: null, image: jpeg() }, limit.deps)).status).toBe(
      429,
    );
    const none = deps({ result: 'no_consent' }, provider);
    expect((await runFoodPhotoAnalysis({ note: null, image: jpeg() }, none.deps)).body).toEqual({
      code: 'no_consent',
    });
    expect(analyze).not.toHaveBeenCalled();
  });

  it('ungültig, dann gültig → zweiter Versuch zählt, Token summiert', async () => {
    const answers = ['kaputt', '{"items":[]}'];
    const provider: FoodPhotoProvider = {
      model: 'gemini-3.5-flash-lite',
      isMock: false,
      analyze: () =>
        Promise.resolve({ text: answers.shift() ?? '', inputTokens: 1000, outputTokens: 100 }),
    };
    const d = deps(undefined, provider);
    const r = await runFoodPhotoAnalysis({ note: null, image: jpeg() }, d.deps);
    expect(r.body).toMatchObject({ code: 'no_food', mock: false });
    expect(d.finished[0]).toMatchObject({
      status: 'succeeded',
      inputTokens: 2000,
      outputTokens: 200,
      costEur: 0.0011,
    });
  });

  it('unbekannter Fehler des Anbieters → provider_failed, failed', async () => {
    const provider: FoodPhotoProvider = {
      model: 'x',
      isMock: false,
      analyze: () => Promise.reject(new Error('irgendwas')),
    };
    const d = deps(undefined, provider);
    expect((await runFoodPhotoAnalysis({ note: null, image: jpeg() }, d.deps)).body).toEqual({
      code: 'provider_failed',
    });
    expect(d.finished[0]?.status).toBe('failed');
    const t = deps(undefined, {
      ...provider,
      analyze: () => Promise.reject(new FoodPhotoProviderError('timeout')),
    });
    expect((await runFoodPhotoAnalysis({ note: null, image: jpeg() }, t.deps)).status).toBe(504);
  });

  it('Abschluss scheitert einmal → wiederholt; zweimal → Antwort bleibt, Reservierung offen (fail closed)', async () => {
    let calls = 0;
    const codes: string[] = [];
    const flaky = {
      provider: createMockFoodPhotoProvider(),
      reserve: () =>
        Promise.resolve({
          result: 'reserved',
          id: 'r',
          remainingMonth: 1,
          remainingToday: 1,
        } as const),
      finish: () => {
        calls += 1;
        return calls === 1 ? Promise.reject(new Error('HTTP 500')) : Promise.resolve();
      },
      report: (c: string) => codes.push(c),
    };
    expect((await runFoodPhotoAnalysis({ note: null, image: jpeg() }, flaky)).status).toBe(200);
    expect(calls).toBe(2);
    expect(codes).toEqual(['finish_retry']);
    calls = 0;
    codes.length = 0;
    const down = { ...flaky, finish: () => (calls++, Promise.reject(new Error('HTTP 500'))) };
    expect((await runFoodPhotoAnalysis({ note: null, image: jpeg() }, down)).status).toBe(200);
    expect(calls).toBe(2);
    expect(codes).toEqual(['finish_retry', 'finish_failed']);
  });

  it('Token und Kosten des Anbieters werden auf den Bereich von ai_usage begrenzt', async () => {
    const provider: FoodPhotoProvider = {
      model: 'gemini-3.8-flash',
      isMock: false,
      analyze: () => Promise.resolve({ text: '{"items":[]}', inputTokens: 5e9, outputTokens: -3 }),
    };
    const d = deps(undefined, provider);
    await runFoodPhotoAnalysis({ note: null, image: jpeg() }, d.deps);
    expect(d.finished[0]).toMatchObject({ inputTokens: 1_000_000, outputTokens: 0 });
    expect(d.finished[0]?.costEur).toBeLessThanOrEqual(99);
  });
});

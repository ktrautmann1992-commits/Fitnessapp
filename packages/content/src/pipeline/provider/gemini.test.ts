/**
 * Gemini-Anbindung mit gefälschtem SDK – keine echten Netzaufrufe, kein Schlüssel (docs/PLAN-PHASE-5.md N8).
 */
import { inspect } from 'node:util';

import type { BatchJob, CreateBatchJobParameters, InlinedResponse } from '@google/genai';
import { describe, expect, it } from 'vitest';

import type { BatchRecord } from '../batch-record';
import { loadLibrary } from '../files';
import { exerciseKind } from '../kinds/exercise';
import { processResults } from '../results';
import { REAL_REPO_ROOT } from '../test-helpers';
import {
  convertBatchJob,
  convertInlinedResponse,
  createGeminiClient,
  type GeminiSdk,
  MAX_INLINE_BATCH_BYTES,
  redactSecret,
  REQUEST_TIMEOUT_MS,
  toInlinedRequest,
} from './gemini';
import type { BatchRequest } from './types';

const KEY = 'AIzaTEST-geheimer-schluessel-1234567890';

const request: BatchRequest = {
  customId: 'ex-squat-band',
  systemInstruction: 'System-Text',
  userText: 'Anfrage-Text',
  responseJsonSchema: { type: 'object', properties: { id: { type: 'string' } } },
  maxOutputTokens: 12_000,
  effort: 'high',
};

class FakeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface FakeSdk extends GeminiSdk {
  readonly createCalls: CreateBatchJobParameters[];
  readonly countCalls: unknown[];
  getCalls: number;
}

/** Gefälschtes SDK: Antworten bzw. Fehler je Aufruf der Reihe nach. */
function fakeSdk(script: {
  count?: (number | Error)[];
  create?: (BatchJob | Error)[];
  get?: (BatchJob | Error)[];
}): FakeSdk {
  const next = <T>(list: (T | Error)[] | undefined, fallback: T): T => {
    const item = list && list.length > 0 ? list.shift()! : fallback;
    if (item instanceof Error) {
      throw item;
    }
    return item;
  };
  const sdk: FakeSdk = {
    createCalls: [],
    countCalls: [],
    getCalls: 0,
    models: {
      countTokens: async (params) => {
        sdk.countCalls.push(params);
        return { totalTokens: next(script.count, 100) };
      },
    },
    batches: {
      create: async (params) => {
        sdk.createCalls.push(params);
        return next(script.create, { name: 'batches/abc123' });
      },
      get: async () => {
        sdk.getCalls += 1;
        return next(script.get, { name: 'batches/abc123', state: 'JOB_STATE_RUNNING' } as BatchJob);
      },
    },
  };
  return sdk;
}

function client(sdk: GeminiSdk, sleeps: number[] = []) {
  return createGeminiClient({
    apiKey: KEY,
    sdk,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
}

function answer(
  key: string | undefined,
  text: string,
  finishReason = 'STOP',
  extra: Partial<InlinedResponse> = {},
): InlinedResponse {
  return {
    ...(key === undefined ? {} : { metadata: { key } }),
    response: {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: 'Gedanke', thought: true }, { text }],
          },
          finishReason,
        },
      ],
      usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 300, thoughtsTokenCount: 700 },
    } as InlinedResponse['response'],
    ...extra,
  } as InlinedResponse;
}

describe('Gemini: Anfrage-Format', () => {
  it('eingebettete Anfrage mit metadata.key, JSON-Ausgabe, Schema, Höchstzahl Token und Denkstufe', () => {
    expect(toInlinedRequest(request)).toEqual({
      contents: [{ role: 'user', parts: [{ text: 'Anfrage-Text' }] }],
      metadata: { key: 'ex-squat-band' },
      config: {
        systemInstruction: 'System-Text',
        responseMimeType: 'application/json',
        responseJsonSchema: request.responseJsonSchema,
        maxOutputTokens: 12_000,
        thinkingConfig: { thinkingLevel: 'HIGH' },
      },
    });
    expect(toInlinedRequest({ ...request, effort: 'minimal' }).config?.thinkingConfig).toEqual({
      thinkingLevel: 'MINIMAL',
    });
  });

  it('enthält nur Inhalts-Prompts – keine weiteren Felder (Datenschutz: nie Nutzerdaten)', () => {
    const inlined = toInlinedRequest(request);
    expect(Object.keys(inlined).sort()).toEqual(['config', 'contents', 'metadata']);
    expect(Object.keys(inlined.config!).sort()).toEqual([
      'maxOutputTokens',
      'responseJsonSchema',
      'responseMimeType',
      'systemInstruction',
      'thinkingConfig',
    ]);
    expect(JSON.stringify(inlined)).not.toContain(KEY);
  });
});

describe('Gemini: Token zählen, Batch anlegen, Rate-Limit', () => {
  it('zählt System-Text, Anfrage und Schema (Näherung)', async () => {
    const sdk = fakeSdk({ count: [4321] });
    expect(await client(sdk).countTokens('gemini-3.8-flash', request)).toBe(4321);
    expect(sdk.countCalls[0]).toEqual({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'System-Text' },
            { text: 'Anfrage-Text' },
            { text: JSON.stringify(request.responseJsonSchema) },
          ],
        },
      ],
    });
  });

  it('Rate-Limit (429): wiederholt mit wachsender Pause und gelingt dann', async () => {
    const sleeps: number[] = [];
    const sdk = fakeSdk({
      count: [new FakeApiError('Resource exhausted', 429), new FakeApiError('busy', 503), 77],
    });
    expect(await client(sdk, sleeps).countTokens('gemini-3.8-flash', request)).toBe(77);
    expect(sdk.countCalls).toHaveLength(3);
    expect(sleeps).toEqual([2000, 4000]);
  });

  it('Rate-Limit dauerhaft: verständlicher Abbruch nach 5 Versuchen, kein Batch angelegt', async () => {
    const sleeps: number[] = [];
    const sdk = fakeSdk({
      create: Array.from({ length: 6 }, () => new FakeApiError('Resource exhausted', 429)),
    });
    await expect(
      client(sdk, sleeps).createBatch('gemini-3.8-flash', [request], 'test'),
    ).rejects.toThrow(/HTTP 429.*nach 5 Versuchen.*Rate-Limit/);
    expect(sdk.createCalls).toHaveLength(5);
    expect(sleeps).toEqual([2000, 4000, 8000, 16000]);
  });

  it('Batch anlegen: Server-Fehler 500 und 503 werden NICHT wiederholt, Ausgang unklar (Wächter N8 S3)', async () => {
    for (const status of [500, 503]) {
      const sdk = fakeSdk({
        create: [new FakeApiError('unavailable', status), { name: 'batches/zwei' }],
      });
      const error = await client(sdk)
        .createBatch('gemini-3.8-flash', [request], 'alpha5-recipes-2026-10-15-a1b2c3')
        .catch((e: Error) => e);
      expect((error as Error).message).toContain(`HTTP ${status}`);
      expect((error as Error).message).toContain('AUSGANG UNKLAR');
      expect(sdk.createCalls).toHaveLength(1); // kein zweiter, doppelt bezahlter Batch
    }
  });

  it('Batch anlegen: Netzfehler ohne Status bzw. Zeitlimit → „evtl. trotzdem angelegt“ mit Anzeigename (Wächter N8 S2)', async () => {
    const timeout = Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
    for (const failure of [new TypeError('fetch failed'), timeout]) {
      const sdk = fakeSdk({ create: [failure] });
      const error = await client(sdk)
        .createBatch('gemini-3.8-flash', [request], 'alpha5-recipes-2026-10-15-a1b2c3')
        .catch((e: Error) => e);
      const message = (error as Error).message;
      expect(message).toContain('AUSGANG UNKLAR');
      expect(message).toContain('evtl. trotzdem angelegt');
      expect(message).toContain('„alpha5-recipes-2026-10-15-a1b2c3“');
      expect(message).toContain('Google AI Studio');
      expect(message).toContain('NICHT sofort neu starten');
      expect(sdk.createCalls).toHaveLength(1);
    }
    expect(REQUEST_TIMEOUT_MS).toBe(120_000);
  });

  it('Batch anlegen: sicher abgewiesene Fehler (z. B. 400) ohne „Ausgang unklar“', async () => {
    const sdk = fakeSdk({ create: [new FakeApiError('Invalid JSON payload', 400)] });
    const error = await client(sdk)
      .createBatch('m', [request], 't')
      .catch((e: Error) => e);
    expect((error as Error).message).toContain('HTTP 400');
    expect((error as Error).message).not.toContain('AUSGANG UNKLAR');
    expect((error as Error).message).not.toContain('GEMINI_API_KEY');
  });

  it('Batch anlegen: Modell, eingebettete Anfragen und Anzeigename; liefert die Batch-Kennung', async () => {
    const sdk = fakeSdk({ create: [{ name: 'batches/xyz987' }] });
    const created = await client(sdk).createBatch('gemini-3.8-flash', [request], 'alpha5-test');
    expect(created).toEqual({ id: 'batches/xyz987' });
    expect(sdk.createCalls[0]).toEqual({
      model: 'gemini-3.8-flash',
      src: [toInlinedRequest(request)],
      config: { displayName: 'alpha5-test' },
    });
  });

  it('ohne Batch-Kennung oder Token-Zahl: Fehler statt stiller Annahme', async () => {
    await expect(
      client(fakeSdk({ create: [{} as BatchJob] })).createBatch('m', [request], 't'),
    ).rejects.toThrow(/keine Batch-Kennung/);
    const sdk: GeminiSdk = {
      ...fakeSdk({}),
      models: { countTokens: async () => ({}) },
    };
    await expect(client(sdk).countTokens('m', request)).rejects.toThrow(/keine Token-Zahl/);
  });

  it('zu großer Batch: Abbruch VOR dem Senden', async () => {
    const sdk = fakeSdk({});
    const huge = { ...request, systemInstruction: 'x'.repeat(MAX_INLINE_BATCH_BYTES) };
    await expect(client(sdk).createBatch('m', [huge], 't')).rejects.toThrow(/Batch zu groß/);
    expect(sdk.createCalls).toHaveLength(0);
  });

  it('Schlüssel ungültig (realistisch: HTTP 400 „API key not valid“, API_KEY_INVALID): Hinweis auf GEMINI_API_KEY (Wächter N8 S1)', async () => {
    const body =
      'got status: 400 Bad Request. {"error":{"code":400,"message":"API key not valid. Please pass a valid API key.",' +
      '"status":"INVALID_ARGUMENT","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"API_KEY_INVALID",' +
      '"domain":"googleapis.com","metadata":{"service":"generativelanguage.googleapis.com"}}]}}';
    const sdk = fakeSdk({ count: [new FakeApiError(body, 400)] });
    const error = await client(sdk)
      .countTokens('gemini-3.8-flash', request)
      .catch((e: Error) => e);
    expect((error as Error).message).toContain('HTTP 400');
    expect((error as Error).message).toContain('GitHub-Secret GEMINI_API_KEY prüfen');
    expect(sdk.countCalls).toHaveLength(1); // nicht wiederholt
  });

  it('Schlüssel steht in keiner Fehlerkette (kein ungeschwärztes `cause`, Wächter N8 H1)', async () => {
    const sdk = fakeSdk({
      count: [new FakeApiError(`API key ${KEY} not valid`, 400)],
      create: [new TypeError(`fetch failed for ${KEY}`)],
    });
    const errors = [
      await client(sdk)
        .countTokens('m', request)
        .catch((e: Error) => e),
      await client(sdk)
        .createBatch('m', [request], 't')
        .catch((e: Error) => e),
    ];
    for (const error of errors) {
      expect((error as Error).cause).toBeUndefined();
      expect(inspect(error, { depth: 10 })).not.toContain(KEY);
      expect(JSON.stringify(error)).not.toContain(KEY);
    }
  });

  it('Schlüssel ungültig (401): Hinweis auf GEMINI_API_KEY, Schlüssel geschwärzt', async () => {
    const sdk = fakeSdk({ count: [new FakeApiError(`API key ${KEY} not valid`, 401)] });
    const error = await client(sdk)
      .countTokens('m', request)
      .catch((e: Error) => e);
    expect((error as Error).message).toContain('GEMINI_API_KEY');
    expect((error as Error).message).not.toContain(KEY);
    expect((error as Error).message).toContain('***');
  });

  it('Abbruch (AbortError): sofort Ende, keine Wiederholung', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const sdk = fakeSdk({ get: [abort] });
    await expect(client(sdk).getBatch('batches/abc123', ['a'])).rejects.toThrow(/abgebrochen/);
    expect(sdk.getCalls).toBe(1);
  });

  it('redactSecret schwärzt nur echte Schlüssel', () => {
    expect(redactSecret(`x ${KEY} y ${KEY}`, KEY)).toBe('x *** y ***');
    expect(redactSecret('kurz', 'ab')).toBe('kurz');
    expect(redactSecret('ohne', undefined)).toBe('ohne');
  });
});

describe('Gemini: Batch-Stand und Antworten', () => {
  it('läuft noch → pending (inkl. QUEUED/PENDING/PAUSED)', async () => {
    for (const state of [
      'JOB_STATE_PENDING',
      'JOB_STATE_RUNNING',
      'JOB_STATE_QUEUED',
      'JOB_STATE_PAUSED',
    ]) {
      expect(convertBatchJob({ state } as BatchJob, ['a']).state).toBe('pending');
    }
    const sdk = fakeSdk({
      get: [new FakeApiError('slow down', 429), { state: 'JOB_STATE_RUNNING' } as BatchJob],
    });
    const status = await client(sdk).getBatch('batches/abc123', ['a']);
    expect(status).toEqual({ state: 'pending', info: 'Status JOB_STATE_RUNNING.' });
    expect(sdk.getCalls).toBe(2);
  });

  it('fertig: Zuordnung über metadata.key, Denk-Teile weg, Token inkl. Denken', () => {
    const status = convertBatchJob(
      {
        state: 'JOB_STATE_SUCCEEDED',
        dest: { inlinedResponses: [answer('b', '{"x":2}'), answer('a', '{"x":1}')] },
      } as BatchJob,
      ['a', 'b'],
    );
    expect(status.state).toBe('ended');
    if (status.state !== 'ended') return;
    expect(status.results.map((r) => r.custom_id)).toEqual(['b', 'a']);
    expect(status.results[1]!.result).toEqual({
      type: 'succeeded',
      text: '{"x":1}',
      finish: 'stop',
      finishDetail: '',
      usage: { inputTokens: 1000, outputTokens: 1000 },
    });
  });

  it('ohne metadata.key: Reihenfolge der Anfragen (laut API gleich) als Rückfall', () => {
    const status = convertBatchJob(
      {
        state: 'JOB_STATE_SUCCEEDED',
        dest: { inlinedResponses: [answer(undefined, '{}'), answer(undefined, '{}')] },
      } as BatchJob,
      ['erste', 'zweite'],
    );
    expect(status.state === 'ended' && status.results.map((r) => r.custom_id)).toEqual([
      'erste',
      'zweite',
    ]);
  });

  it('gemischte Kennungen: kein Positions-Rückfall, fehlende als Lücke (Wächter N8 H2)', () => {
    const status = convertBatchJob(
      {
        state: 'JOB_STATE_SUCCEEDED',
        dest: { inlinedResponses: [answer(undefined, '{}'), answer('r2', '{}')] },
      } as BatchJob,
      ['r1', 'r2'],
    );
    if (status.state !== 'ended') throw new Error('erwartet: ended');
    expect(status.results.map((r) => r.custom_id)).toEqual(['ohne-kennung-1', 'r2']);
    // results.ts meldet dann: „ohne-kennung-1“ = unbekannte custom_id, „r1“ = kein Ergebnis (Lücke), nie doppelt r2.
    expect(status.results.filter((r) => r.custom_id === 'r2')).toHaveLength(1);
  });

  it('Ende-Gründe: abgeschnitten, Sicherheitsfilter, blockierte Anfrage, Fehler, Sonstiges', () => {
    expect(convertInlinedResponse(answer('a', '{"x', 'MAX_TOKENS'))).toMatchObject({
      finish: 'max_tokens',
    });
    expect(convertInlinedResponse(answer('a', '', 'SAFETY'))).toMatchObject({
      finish: 'refusal',
      finishDetail: 'SAFETY',
    });
    expect(convertInlinedResponse(answer('a', '', 'PROHIBITED_CONTENT'))).toMatchObject({
      finish: 'refusal',
    });
    expect(convertInlinedResponse(answer('a', '{}', 'MALFORMED_FUNCTION_CALL'))).toMatchObject({
      finish: 'other',
      finishDetail: 'MALFORMED_FUNCTION_CALL',
    });
    expect(
      convertInlinedResponse({
        metadata: { key: 'a' },
        response: { promptFeedback: { blockReason: 'SAFETY' } },
      } as unknown as InlinedResponse),
    ).toMatchObject({
      type: 'succeeded',
      finish: 'refusal',
      finishDetail: 'Anfrage blockiert: SAFETY',
    });
    expect(
      convertInlinedResponse({ metadata: { key: 'a' }, error: { code: 429, message: 'quota' } }),
    ).toEqual({ type: 'errored', detail: '429: quota' });
    expect(convertInlinedResponse({ metadata: { key: 'a' } } as InlinedResponse)).toEqual({
      type: 'errored',
      detail: 'leere Antwort',
    });
  });

  it('Teilergebnisse: abgebrochen, abgelaufen, fehlgeschlagen – fehlende Anfragen „erneut versuchen“', () => {
    const partial = { inlinedResponses: [answer('a', '{}')] };
    const cancelled = convertBatchJob({ state: 'JOB_STATE_CANCELLED', dest: partial } as BatchJob, [
      'a',
      'b',
    ]);
    expect(
      cancelled.state === 'ended' && cancelled.results.map((r) => [r.custom_id, r.result.type]),
    ).toEqual([
      ['a', 'succeeded'],
      ['b', 'canceled'],
    ]);
    const expired = convertBatchJob({ state: 'JOB_STATE_EXPIRED' } as BatchJob, ['a']);
    expect(expired.state === 'ended' && expired.results[0]?.result.type).toBe('expired');
    const failed = convertBatchJob(
      { state: 'JOB_STATE_FAILED', error: { message: 'Kontingent erschöpft' } } as BatchJob,
      ['a'],
    );
    expect(failed.state === 'ended' && failed.results[0]?.result).toEqual({
      type: 'errored',
      detail: 'Kontingent erschöpft',
    });
    // Erfolgreich, aber eine Antwort fehlt: results.ts meldet „kein Ergebnis geliefert“.
    const succeeded = convertBatchJob({ state: 'JOB_STATE_SUCCEEDED', dest: partial } as BatchJob, [
      'a',
      'b',
    ]);
    expect(succeeded.state === 'ended' && succeeded.results).toHaveLength(1);
  });

  it('Ergebnis als Datei statt eingebettet: klarer Fehler', () => {
    expect(() =>
      convertBatchJob(
        {
          name: 'batches/x',
          state: 'JOB_STATE_SUCCEEDED',
          dest: { fileName: 'files/1' },
        } as BatchJob,
        ['a'],
      ),
    ).toThrow(/Ergebnis als Datei/);
  });

  it('Ende-zu-Ende bis zur Verarbeitung: ungültiges JSON, Sicherheitsfilter, Teilergebnis, gültiger Entwurf', () => {
    const context = loadLibrary(REAL_REPO_ROOT);
    const [valid, second] = exerciseKind.dryRunFixtures();
    const cells = [valid!.cell, second!.cell, exerciseKind.cells(context)[0]!];
    const job = {
      state: 'JOB_STATE_CANCELLED',
      dest: {
        inlinedResponses: [
          answer(cells[1]!.customId, '{"id": "kaputt'),
          answer(cells[0]!.customId, JSON.stringify((valid!.response as { data: unknown }).data)),
        ],
      },
    } as BatchJob;
    const status = convertBatchJob(
      job,
      cells.map((cell) => cell.customId),
    );
    if (status.state !== 'ended') throw new Error('erwartet: ended');
    const record: BatchRecord = {
      record_version: 2,
      provider: 'gemini',
      status: 'submitted',
      dry_run: false,
      batch_id: 'batches/abc123',
      kind: 'exercise',
      model: 'gemini-3.8-flash',
      effort: 'high',
      selection: 'alle',
      count: 3,
      created_at: '2026-10-15T10:00:00.000Z',
      branch: 'content/batch-2026-10-15-abc123',
      estimate: { input_tokens: 0, max_tokens_per_request: 12000, worst_case_usd: 1, max_usd: 15 },
      requests: cells.map((cell) => ({
        custom_id: cell.customId,
        target_id: cell.targetId,
        label: cell.label,
        values: { ...cell.values },
      })),
      collected: null,
    };
    const processed = processResults({
      kind: exerciseKind,
      record,
      results: status.results,
      context,
      today: '2026-10-15',
    });
    expect(processed.drafts.map((d) => d.id)).toEqual(['probelauf-wandsitzen']);
    expect(Object.fromEntries(processed.notSaved.map((n) => [n.customId, n.reason]))).toEqual({
      [cells[1]!.customId]: 'no_json',
      [cells[2]!.customId]: 'canceled',
    });
    expect(processed.drafts[0]!.content.meta).toMatchObject({
      origin: 'batch',
      model: 'gemini-3.8-flash',
      batch_id: 'batches/abc123',
      expert_reviewed: false,
    });
    expect(processed.usage).toEqual({ inputTokens: 2000, outputTokens: 2000 });
  });
});

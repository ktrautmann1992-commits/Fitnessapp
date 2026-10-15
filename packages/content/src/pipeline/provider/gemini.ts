/**
 * Google Gemini als KI-Anbieter der Offline-Content-Pipeline (Gründer-Entscheidung 14.10.2026, docs/PLAN-PHASE-5.md
 * N8). Nur für die Offline-Erzeugung von Entwürfen – keine Echtzeit-KI in der App.
 *
 * API-Form (offizielles SDK `@google/genai`, Gemini Developer API; Google Gemini Cookbook
 * `quickstarts/Batch_mode.ipynb`):
 * - Batch mit eingebetteten Anfragen: `batches.create({ model, src: InlinedRequest[] })` →
 *   `POST /v1beta/models/{model}:batchGenerateContent`; jede Anfrage trägt `metadata.key` = custom_id.
 * - Stand: `batches.get({ name })`; fertig bei `JOB_STATE_SUCCEEDED` (auch `…_PARTIALLY_SUCCEEDED`, `…_FAILED`,
 *   `…_CANCELLED`, `…_EXPIRED`). Die Antworten stehen in `dest.inlinedResponses` – in der Reihenfolge der Anfragen.
 * - Strukturierte Ausgabe: `responseMimeType: "application/json"` + `responseJsonSchema`; Denktiefe über
 *   `thinkingConfig.thinkingLevel`; `maxOutputTokens` zählt bei Gemini 3 Denken und Antwort zusammen.
 * - Token zählen: `models.countTokens` (kostenlos). Die Developer API zählt dort keinen System-Text und keine
 *   Konfiguration – deshalb werden System-Text, Anfrage und Schema als Text gezählt (Näherung, eher zu hoch).
 *
 * Rate-Limit: 429 und vorübergehende Server-Fehler werden mit wachsender Pause wiederholt (höchstens
 * `maxAttempts`). Das Anlegen des Batches wird NUR bei 429 wiederholt (Anfrage sicher abgewiesen) – bei 503 oder
 * anderen Fehlern könnte das Backend den Batch schon angenommen haben, ein zweiter Versuch wäre doppelt bezahlt
 * (Wächter N8 S3). Jeder Aufruf hat ein Zeitlimit (`REQUEST_TIMEOUT_MS`); endet das Anlegen ohne HTTP-Status
 * (Netzfehler, Zeitlimit), ist der Ausgang unklar – die Meldung nennt den eindeutigen Anzeigenamen, unter dem man
 * den Batch in Google AI Studio findet (Wächter N8 S2).
 *
 * Schlüssel: kommt nur als Parameter (aus GEMINI_API_KEY in `cli.ts`), wird vom SDK im Kopf `x-goog-api-key`
 * gesendet und erscheint in keiner Meldung (Fehlertexte werden zusätzlich geschwärzt, `redactSecret`).
 */
import {
  type BatchJob,
  type CreateBatchJobParameters,
  type GenerateContentResponse,
  GoogleGenAI,
  type InlinedRequest,
  type InlinedResponse,
  ThinkingLevel,
} from '@google/genai';

import type { ContentEffort } from '../config';
import type { BatchRequest, BatchResult, BatchStatus, ContentApiClient, FinishKind } from './types';

/** Der Teil des SDK, den die Pipeline nutzt (im Test ersetzbar – keine echten Netzaufrufe). */
export interface GeminiSdk {
  models: {
    countTokens(params: {
      model: string;
      contents: { role: string; parts: { text: string }[] }[];
    }): Promise<{ totalTokens?: number | undefined }>;
  };
  batches: {
    create(params: CreateBatchJobParameters): Promise<BatchJob>;
    get(params: { name: string }): Promise<BatchJob>;
  };
}

export interface GeminiClientOptions {
  readonly apiKey: string;
  /** Ersatz-SDK (Tests). */
  readonly sdk?: GeminiSdk;
  /** Pause zwischen Versuchen (Tests: sofort). */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Höchstzahl Versuche je Aufruf (Standard 5). */
  readonly maxAttempts?: number;
  /** Erste Pause in ms (verdoppelt sich je Versuch, Standard 2.000). */
  readonly initialDelayMs?: number;
}

/** Inline-Batches sind laut API auf 20 MB begrenzt; mit Reserve. */
export const MAX_INLINE_BATCH_BYTES = 19_000_000;

const THINKING_LEVELS: Record<ContentEffort, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/** Wiederholbar: Rate-Limit und vorübergehende Server-Fehler. */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
/** Beim Anlegen nur, wenn die API die Anfrage sicher abgewiesen hat (429 = Rate-Limit, nichts angelegt). */
const RETRYABLE_STATUS_CREATE = new Set([429]);

/** Zeitlimit je API-Aufruf (SDK `httpOptions.timeout`). Ein Batch-Anlegen dauert normal Sekunden. */
export const REQUEST_TIMEOUT_MS = 120_000;

/** Antwort der API auf einen falschen oder widerrufenen Schlüssel (HTTP 400, Wächter N8 S1). */
const INVALID_KEY_PATTERN = /API_KEY_INVALID|API key not valid|API key expired/i;

const FINISHED_STATES = new Set([
  'JOB_STATE_SUCCEEDED',
  'JOB_STATE_PARTIALLY_SUCCEEDED',
  'JOB_STATE_FAILED',
  'JOB_STATE_CANCELLED',
  'JOB_STATE_EXPIRED',
]);

/** Gründe, die als Ablehnung/Sicherheitsfilter zählen (FinishReason des SDK). */
const REFUSAL_REASONS = new Set([
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  'IMAGE_RECITATION',
]);

/** Ersetzt den Schlüssel in Texten durch „***“ (Meldungen, Berichte). */
export function redactSecret(text: string, secret: string | undefined): string {
  return secret !== undefined && secret.length >= 8 ? text.split(secret).join('***') : text;
}

function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : undefined;
}

function isAbort(error: unknown): boolean {
  return (error as { name?: unknown } | null)?.name === 'AbortError';
}

/**
 * Fehler der API mit verständlicher Meldung (Schlüssel geschwärzt). Bewusst OHNE `cause`: Die Original-Meldung des
 * SDK ist ungeschwärzt und könnte über `console.error`/`util.inspect` im Log landen (Wächter N8 H1).
 */
export class GeminiApiError extends Error {
  readonly status: number | undefined;
  /** true = Fehler ohne HTTP-Status (Netzfehler, Zeitlimit, Abbruch) – Ausgang auf dem Server unbekannt. */
  readonly outcomeUnknown: boolean;
  constructor(message: string, status: number | undefined, outcomeUnknown = false) {
    super(message);
    this.name = 'GeminiApiError';
    this.status = status;
    this.outcomeUnknown = outcomeUnknown;
  }
}

/** Führt einen API-Aufruf aus und wiederholt ihn bei Rate-Limit/Server-Fehlern mit wachsender Pause. */
export async function withRetry<T>(
  what: string,
  call: () => Promise<T>,
  options: {
    readonly retryable: ReadonlySet<number>;
    readonly maxAttempts: number;
    readonly initialDelayMs: number;
    readonly sleep: (ms: number) => Promise<void>;
    readonly secret: string;
  },
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      const status = statusOf(error);
      const message = redactSecret(String((error as Error)?.message ?? error), options.secret);
      if (isAbort(error)) {
        throw new GeminiApiError(
          `Gemini-API (${what}): abgebrochen (Zeitlimit oder Abbruch).`,
          status,
          true,
        );
      }
      const retry =
        status !== undefined && options.retryable.has(status) && attempt < options.maxAttempts;
      if (!retry) {
        const hint =
          status === 429
            ? ' Rate-Limit bzw. Kontingent erschöpft – später erneut starten (docs/SETUP.md Teil E).'
            : status === 401 ||
                status === 403 ||
                (status === 400 && INVALID_KEY_PATTERN.test(message))
              ? ' Schlüssel ungültig oder ohne Berechtigung – GitHub-Secret GEMINI_API_KEY prüfen (docs/SETUP.md Teil E).'
              : '';
        throw new GeminiApiError(
          `Gemini-API (${what}) fehlgeschlagen${status === undefined ? '' : ` (HTTP ${status})`}` +
            `${attempt > 1 ? ` nach ${attempt} Versuchen` : ''}: ${message}.${hint}`,
          status,
          status === undefined,
        );
      }
      await options.sleep(options.initialDelayMs * 2 ** (attempt - 1));
    }
  }
}

/** Anfrage → Gemini-InlinedRequest (Kennung in `metadata.key`). */
export function toInlinedRequest(request: BatchRequest): InlinedRequest {
  return {
    contents: [{ role: 'user', parts: [{ text: request.userText }] }],
    metadata: { key: request.customId },
    config: {
      systemInstruction: request.systemInstruction,
      responseMimeType: 'application/json',
      responseJsonSchema: request.responseJsonSchema,
      maxOutputTokens: request.maxOutputTokens,
      thinkingConfig: { thinkingLevel: THINKING_LEVELS[request.effort] },
    },
  };
}

/** Inhalt für die Token-Zählung: System-Text, Anfrage und Schema als Text (Näherung, s. o.). */
export function countTokensContents(request: BatchRequest) {
  return [
    {
      role: 'user',
      parts: [
        { text: request.systemInstruction },
        { text: request.userText },
        { text: JSON.stringify(request.responseJsonSchema) },
      ],
    },
  ];
}

function finishKind(reason: string | undefined): FinishKind {
  if (reason === 'STOP') {
    return 'stop';
  }
  if (reason === 'MAX_TOKENS') {
    return 'max_tokens';
  }
  return reason !== undefined && REFUSAL_REASONS.has(reason) ? 'refusal' : 'other';
}

/** Eine Gemini-Antwort → anbieter-neutrales Ergebnis. */
export function convertInlinedResponse(response: InlinedResponse): BatchResult['result'] {
  if (response.error) {
    const { code, message } = response.error;
    return {
      type: 'errored',
      detail:
        [code, message].filter((part) => part !== undefined && part !== '').join(': ') || 'Fehler',
    };
  }
  const answer: GenerateContentResponse | undefined = response.response;
  if (answer === undefined) {
    return { type: 'errored', detail: 'leere Antwort' };
  }
  const meta = answer.usageMetadata;
  const usage = {
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
  };
  const candidate = answer.candidates?.[0];
  if (candidate === undefined) {
    const blocked = answer.promptFeedback?.blockReason;
    return {
      type: 'succeeded',
      text: '',
      finish: blocked ? 'refusal' : 'other',
      finishDetail: blocked ? `Anfrage blockiert: ${blocked}` : 'keine Antwort geliefert',
      usage,
    };
  }
  const text = (candidate.content?.parts ?? [])
    .filter((part) => part.thought !== true && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
  const reason = candidate.finishReason as string | undefined;
  const finish = finishKind(reason);
  return {
    type: 'succeeded',
    text,
    finish,
    finishDetail: finish === 'stop' ? '' : (reason ?? 'unbekannt'),
    usage,
  };
}

/** Stand eines Gemini-Batches → anbieter-neutraler Stand (inkl. Teilergebnissen bei Abbruch/Fehler). */
export function convertBatchJob(job: BatchJob, customIds: readonly string[]): BatchStatus {
  const state = String(job.state ?? 'JOB_STATE_UNSPECIFIED');
  if (!FINISHED_STATES.has(state)) {
    return { state: 'pending', info: `Status ${state}.` };
  }
  if (job.dest?.fileName) {
    throw new GeminiApiError(
      `Batch ${job.name ?? '?'}: Ergebnis als Datei (${job.dest.fileName}) – erwartet waren eingebettete Antworten.`,
      undefined,
    );
  }
  const responses = job.dest?.inlinedResponses ?? [];
  // Rückfall über die Position NUR, wenn KEINE Antwort eine Kennung trägt (laut API gleiche Reihenfolge). Fehlt sie
  // nur bei einzelnen, wird nicht geraten: die Antwort zählt als „unbekannte custom_id“, die Anfrage als Lücke
  // (Wächter N8 H2).
  const byPosition = responses.every((response) => response.metadata?.key === undefined);
  const results: BatchResult[] = responses.map((response, index) => ({
    custom_id:
      response.metadata?.key ??
      (byPosition ? customIds[index] : undefined) ??
      `ohne-kennung-${index + 1}`,
    result: convertInlinedResponse(response),
  }));
  // Ohne Antwort gebliebene Anfragen: je nach Endzustand erneut versuchen.
  const answered = new Set(results.map((result) => result.custom_id));
  const missingAs: BatchResult['result'] | undefined =
    state === 'JOB_STATE_CANCELLED'
      ? { type: 'canceled' }
      : state === 'JOB_STATE_EXPIRED'
        ? { type: 'expired' }
        : state === 'JOB_STATE_FAILED'
          ? { type: 'errored', detail: job.error?.message ?? 'Batch fehlgeschlagen' }
          : undefined; // SUCCEEDED: fehlende Antworten meldet results.ts als „kein Ergebnis“
  if (missingAs !== undefined) {
    for (const customId of customIds) {
      if (!answered.has(customId)) {
        results.push({ custom_id: customId, result: missingAs });
      }
    }
  }
  return {
    state: 'ended',
    info: `Status ${state}: ${results.length} von ${customIds.length} Antworten.`,
    results,
  };
}

/** Gemini-Client der Pipeline. */
export function createGeminiClient(options: GeminiClientOptions): ContentApiClient {
  const sdk: GeminiSdk =
    options.sdk ??
    (new GoogleGenAI({
      apiKey: options.apiKey,
      // Wiederholungen macht `withRetry` selbst (nachvollziehbar und testbar).
      httpOptions: { retryOptions: { attempts: 1 }, timeout: REQUEST_TIMEOUT_MS },
    }) as unknown as GeminiSdk);
  const base = {
    maxAttempts: options.maxAttempts ?? 5,
    initialDelayMs: options.initialDelayMs ?? 2000,
    sleep: options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms))),
    secret: options.apiKey,
  };
  return {
    provider: 'gemini',
    countTokens: async (model, request) => {
      const counted = await withRetry(
        'Token zählen',
        () => sdk.models.countTokens({ model, contents: countTokensContents(request) }),
        { ...base, retryable: RETRYABLE_STATUS },
      );
      if (typeof counted.totalTokens !== 'number') {
        throw new GeminiApiError(
          'Gemini-API (Token zählen): keine Token-Zahl geliefert.',
          undefined,
        );
      }
      return counted.totalTokens;
    },
    createBatch: async (model, requests, displayName) => {
      const src = requests.map(toInlinedRequest);
      const bytes = Buffer.byteLength(JSON.stringify(src), 'utf8');
      if (bytes > MAX_INLINE_BATCH_BYTES) {
        throw new GeminiApiError(
          `Batch zu groß (${Math.round(bytes / 1_000_000)} MB, erlaubt ${MAX_INLINE_BATCH_BYTES / 1_000_000} MB) – bitte weniger Anfragen („Anzahl“).`,
          undefined,
        );
      }
      let job: BatchJob;
      try {
        job = await withRetry(
          'Batch anlegen',
          () => sdk.batches.create({ model, src, config: { displayName } }),
          { ...base, retryable: RETRYABLE_STATUS_CREATE },
        );
      } catch (error) {
        // Unklar: kein HTTP-Status (Netzfehler, Zeitlimit) oder Server-Fehler (5xx/408) – das Backend kann den Batch
        // trotzdem angenommen haben. Sicher abgewiesen sind nur 4xx (außer 408), z. B. 400/401/403/404/429.
        const unclear =
          error instanceof GeminiApiError &&
          (error.outcomeUnknown ||
            (error.status !== undefined && (error.status >= 500 || error.status === 408)));
        if (error instanceof GeminiApiError && unclear) {
          throw new GeminiApiError(
            `${error.message} AUSGANG UNKLAR: Der Batch wurde evtl. trotzdem angelegt (und kostet). Bitte in Google AI ` +
              `Studio unter „Batches“ nach dem Anzeigenamen „${displayName}“ sehen und NICHT sofort neu starten – ` +
              'content-collect findet diesen Batch nicht (keine Merkdatei). Im Zweifel dort abbrechen und Claude Bescheid geben.',
            undefined,
            true,
          );
        }
        throw error;
      }
      if (!job.name) {
        throw new GeminiApiError(
          'Gemini-API (Batch anlegen): keine Batch-Kennung geliefert.',
          undefined,
        );
      }
      return { id: job.name };
    },
    getBatch: async (id, customIds) => {
      const job = await withRetry('Batch abfragen', () => sdk.batches.get({ name: id }), {
        ...base,
        retryable: RETRYABLE_STATUS,
      });
      return convertBatchJob(job, customIds);
    },
  };
}

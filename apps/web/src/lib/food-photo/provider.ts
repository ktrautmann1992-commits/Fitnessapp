/**
 * KI-Anbieter der Foto-Auswertung (Etappe E3). Schnittstelle und Attrappe liegen in packages/core
 * (`FoodPhotoProvider`, `createMockFoodPhotoProvider` – Standard). Hier nur der vorbereitete echte Adapter:
 *
 * `createGeminiProvider` – Google Gemini (Bildeingabe, strukturierte Antwort nach JSON-Schema). Nur aktiv mit
 * FOOD_PHOTO_PROVIDER=gemini UND GEMINI_API_KEY (config.ts). An Gemini gehen NUR die feste Anweisung, der markierte
 * Info-Text und das bereinigte Bild – keine Nutzer-ID, kein Name, keine Körperdaten, keine Ziele, keine Flags. Keine
 * Werkzeuge (tools), keine Websuche. Zeitlimit 20 s. Fehler tragen nur feste Codes (nie Inhalte, nie den Schlüssel).
 */
import {
  AI_FOOD_PHOTO,
  FOOD_PHOTO_RESPONSE_JSON_SCHEMA,
  FoodPhotoProviderError,
  type FoodPhotoProvider,
  type FoodPhotoProviderRequest,
} from '@fitnessapp/core';

type FetchFn = typeof fetch;

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
}

/** Anfrage-Körper an Gemini – exportiert, damit Tests prüfen können, dass NUR Anweisung, Info und Bild darin sind. */
export function geminiRequestBody(request: FoodPhotoProviderRequest) {
  return {
    systemInstruction: { parts: [{ text: request.prompt.instruction }] },
    contents: [
      {
        role: 'user',
        parts: [
          { text: request.prompt.userText },
          { inlineData: { mimeType: request.mimeType, data: base64(request.image) } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: FOOD_PHOTO_RESPONSE_JSON_SCHEMA,
      maxOutputTokens: AI_FOOD_PHOTO.maxOutputTokens,
      temperature: 0,
    },
  };
}

interface GeminiAnswer {
  candidates?: { content?: { parts?: { text?: unknown }[] } }[];
  usageMetadata?: {
    promptTokenCount?: unknown;
    candidatesTokenCount?: unknown;
    thoughtsTokenCount?: unknown;
  };
}

const tokens = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;

export function createGeminiProvider(options: {
  apiKey: string;
  model: string;
  fetchFn?: FetchFn;
  timeoutMs?: number;
}): FoodPhotoProvider {
  const fetchFn = options.fetchFn ?? fetch;
  return {
    model: options.model,
    isMock: false,
    async analyze(request) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        options.timeoutMs ?? AI_FOOD_PHOTO.timeoutMs,
      );
      try {
        let response: Response;
        try {
          response = await fetchFn(
            `${GEMINI_BASE}/${encodeURIComponent(options.model)}:generateContent`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
              body: JSON.stringify(geminiRequestBody(request)),
              signal: controller.signal,
            },
          );
        } catch {
          throw new FoodPhotoProviderError(controller.signal.aborted ? 'timeout' : 'unavailable');
        }
        if (!response.ok) throw new FoodPhotoProviderError('unavailable');
        let json: GeminiAnswer;
        try {
          json = (await response.json()) as GeminiAnswer;
        } catch {
          throw new FoodPhotoProviderError(controller.signal.aborted ? 'timeout' : 'unavailable');
        }
        const text = (json.candidates?.[0]?.content?.parts ?? [])
          .map((part) => (typeof part.text === 'string' ? part.text : ''))
          .join('');
        const meta = json.usageMetadata;
        return {
          text,
          inputTokens: tokens(meta?.promptTokenCount),
          outputTokens: tokens(meta?.candidatesTokenCount) + tokens(meta?.thoughtsTokenCount),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

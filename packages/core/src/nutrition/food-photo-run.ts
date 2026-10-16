import { AI_FOOD_PHOTO } from '../constants';
import { checkPhotoImage, type PhotoMimeType } from './food-photo-image';
import {
  aiFoodPhotoCostEur,
  buildFoodPhotoPrompt,
  FOOD_PHOTO_MOCK_MODEL,
  mockFoodPhotoAnswer,
  parsePhotoResult,
  sanitizeFoodNote,
  type FoodPhotoPrompt,
  type FoodPhotoResponse,
} from './food-photo';

/**
 * Ablauf EINER Foto-Auswertung (Etappe E3, Plan 9) – gleich auf dem Server (apps/web, Route POST
 * /api/ernaehrung/foto) und im Testmodus der App (Attrappe auf dem Gerät). Reihenfolge:
 * 1. Info prüfen/bereinigen (≤ 120 Zeichen), 2. Bild prüfen + Metadaten entfernen, 3. Reservieren (Flag, Premium,
 * Einwilligungen, Tages-/Monatslimit – atomar beim Aufrufer), 4. KI-Anbieter (Attrappe bzw. Gemini) mit fester
 * Anweisung + markierter Info + bereinigtem Bild; ungültige Antwort → einmal neu, 5. Abschluss in ai_usage (nur
 * Token/Kosten/Status; fehlgeschlagen zählt nicht gegen das Limit), 6. Antwort nur mit geprüften Bestandteilen.
 * Das Foto lebt nur in dieser Funktion (Arbeitsspeicher) und wird nie gespeichert (A-G18).
 */

export type FoodPhotoProviderErrorCode = 'timeout' | 'unavailable';

export class FoodPhotoProviderError extends Error {
  readonly code: FoodPhotoProviderErrorCode;
  constructor(code: FoodPhotoProviderErrorCode) {
    super(`KI-Anbieter: ${code}`);
    this.name = 'FoodPhotoProviderError';
    this.code = code;
  }
}

export interface FoodPhotoProviderRequest {
  readonly prompt: FoodPhotoPrompt;
  /** Bereinigtes Bild (ohne Metadaten). */
  readonly image: Uint8Array;
  readonly mimeType: PhotoMimeType;
  /** Nur für die Attrappe (wählt den Testfall); der echte Anbieter bekommt die Info nur über `prompt`. */
  readonly note: string | null;
}

export interface FoodPhotoProviderAnswer {
  readonly text: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface FoodPhotoProvider {
  /** Modellname für ai_usage (z. B. „attrappe“, „gemini-3.5-flash-lite“). */
  readonly model: string;
  readonly isMock: boolean;
  analyze(request: FoodPhotoProviderRequest): Promise<FoodPhotoProviderAnswer>;
}

/** Die Attrappe als Anbieter: feste Antworten (`mockFoodPhotoAnswer`), kein Netz, keine Kosten. */
export function createMockFoodPhotoProvider(): FoodPhotoProvider {
  return {
    model: FOOD_PHOTO_MOCK_MODEL,
    isMock: true,
    analyze(request) {
      const answer = mockFoodPhotoAnswer(request.note);
      if (answer.kind === 'timeout') return Promise.reject(new FoodPhotoProviderError('timeout'));
      return Promise.resolve({
        text: answer.text,
        inputTokens: answer.inputTokens,
        outputTokens: answer.outputTokens,
      });
    },
  };
}

export type FoodPhotoReserve =
  | {
      readonly result: 'reserved';
      readonly id: string;
      readonly remainingMonth: number;
      readonly remainingToday: number;
    }
  | { readonly result: 'flag_off' | 'no_entitlement' | 'no_consent' }
  | { readonly result: 'limit'; readonly scope: 'month' | 'day'; readonly availableFrom: string };

export interface FoodPhotoFinish {
  readonly id: string;
  readonly status: 'succeeded' | 'failed';
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costEur: number;
}

export interface FoodPhotoRunDeps {
  readonly provider: FoodPhotoProvider;
  reserve(): Promise<FoodPhotoReserve>;
  finish(params: FoodPhotoFinish): Promise<void>;
  /** Fester Code bei Fehlern im Abschluss (nie Inhalte) – z. B. console.error auf dem Server. */
  readonly report?: (code: string) => void;
}

export interface FoodPhotoRunResult {
  readonly status: number;
  readonly body: FoodPhotoResponse;
}

const fail = (status: number, code: Extract<FoodPhotoResponse, { code: string }>['code']) =>
  ({ status, body: { code } }) as FoodPhotoRunResult;

export async function runFoodPhotoAnalysis(
  input: { readonly note: string | null | undefined; readonly image: Uint8Array },
  deps: FoodPhotoRunDeps,
): Promise<FoodPhotoRunResult> {
  const note = sanitizeFoodNote(input.note);
  if (!note.ok) return fail(400, 'note_too_long');
  const image = checkPhotoImage(input.image);
  if (!image.ok) {
    const code = {
      type: 'image_type',
      too_big: 'image_too_big',
      too_large_px: 'image_too_large_px',
      broken: 'image_broken',
    } as const;
    return fail(400, code[image.reason]);
  }

  const reserved = await deps.reserve();
  if (reserved.result === 'limit') {
    return {
      status: 429,
      body: { code: 'limit', scope: reserved.scope, available_from: reserved.availableFrom },
    };
  }
  if (reserved.result !== 'reserved') return fail(403, reserved.result);

  const { provider } = deps;
  const request: FoodPhotoProviderRequest = {
    prompt: buildFoodPhotoPrompt(note.note),
    image: image.bytes,
    mimeType: image.mimeType,
    note: note.note,
  };
  let inputTokens = 0;
  let outputTokens = 0;
  let outcome: FoodPhotoRunResult | null = null;
  let succeeded = false;
  for (
    let attempt = 0;
    attempt <= AI_FOOD_PHOTO.retriesOnInvalid && outcome === null;
    attempt += 1
  ) {
    let answer: FoodPhotoProviderAnswer;
    try {
      answer = await provider.analyze(request);
    } catch (error) {
      const code = error instanceof FoodPhotoProviderError ? error.code : 'unavailable';
      outcome = code === 'timeout' ? fail(504, 'timeout') : fail(502, 'provider_failed');
      break;
    }
    inputTokens += answer.inputTokens;
    outputTokens += answer.outputTokens;
    const parsed = parsePhotoResult(answer.text);
    if (parsed.kind === 'invalid') continue;
    succeeded = true;
    const remaining = {
      remaining_month: reserved.remainingMonth,
      remaining_today: reserved.remainingToday,
      mock: provider.isMock,
    };
    outcome = {
      status: 200,
      body:
        parsed.kind === 'no_food'
          ? { code: 'no_food', ...remaining }
          : { code: 'ok', items: [...parsed.items], ...remaining },
    };
  }
  outcome ??= fail(502, 'invalid_answer');

  try {
    await deps.finish({
      id: reserved.id,
      status: succeeded ? 'succeeded' : 'failed',
      model: provider.model,
      inputTokens,
      outputTokens,
      costEur: aiFoodPhotoCostEur(provider.model, inputTokens, outputTokens) ?? 0,
    });
  } catch {
    // Die Reservierung läuft nach 5 Minuten von selbst ab; die Antwort bleibt gültig.
    deps.report?.('finish_failed');
  }
  return outcome;
}

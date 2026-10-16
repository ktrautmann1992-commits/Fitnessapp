/**
 * Formular der Route POST /api/ernaehrung/foto lesen (Etappe E3) – erst NACH Herkunfts-, Konfigurations- und
 * Login-Prüfung (Wächter E3 M2: ohne Login wird der Körper nie gelesen). Mit Content-Length wird die Grenze vorher
 * geprüft (handler.ts); ohne Content-Length (chunked) wird gestreamt mit hartem Byte-Limit gelesen und bei
 * Überschreitung abgebrochen (Wächter E3 N2). Das Foto bleibt nur im Arbeitsspeicher.
 */
import { AI_FOOD_PHOTO } from '@fitnessapp/core';

import type { FoodPhotoForm } from './handler';

/** Bild + Info + Formular-Rahmen; größere Anfragen werden nicht gelesen. */
export const FOOD_PHOTO_MAX_BODY_BYTES = AI_FOOD_PHOTO.maxImageBytes + 16_384;

/** Körper höchstens `limit` Bytes lesen; mehr → null (Lesen abgebrochen). */
export async function readBodyLimited(request: Request, limit: number): Promise<Uint8Array | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

export async function readFoodPhotoForm(
  request: Request,
  limit: number = FOOD_PHOTO_MAX_BODY_BYTES,
): Promise<FoodPhotoForm | null> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.startsWith('multipart/form-data')) return null;
  const body = await readBodyLimited(request, limit);
  if (body === null || body.byteLength === 0) return null;
  let data: FormData;
  try {
    data = await new Response(body as BodyInit, { headers: { 'content-type': type } }).formData();
  } catch {
    return null;
  }
  const keys = [...data.keys()];
  const unexpectedFields =
    keys.some((k) => k !== 'image' && k !== 'note') ||
    data.getAll('image').length !== 1 ||
    data.getAll('note').length > 1;
  const image = data.get('image');
  const note = data.get('note');
  return {
    image: image instanceof Blob ? new Uint8Array(await image.arrayBuffer()) : null,
    note: typeof note === 'string' ? note : null,
    unexpectedFields: unexpectedFields || (note !== null && typeof note !== 'string'),
  };
}

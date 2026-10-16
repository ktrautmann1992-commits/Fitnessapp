/**
 * POST /api/ernaehrung/foto – Gericht per Foto (Etappe E3). Ablauf: src/lib/food-photo/handler.ts.
 * Erwartet multipart/form-data mit `image` (JPEG/PNG/WebP, auf dem Gerät auf 1.024 px verkleinert) und optional
 * `note` (≤ 120 Zeichen) sowie `Authorization: Bearer <Supabase-JWT>`. Das Foto wird nur im Arbeitsspeicher
 * verarbeitet und nie gespeichert (A-G18).
 */
import { AI_FOOD_PHOTO } from '@fitnessapp/core';

import { corsHeaders, type FoodPhotoForm, handleFoodPhoto } from '@/lib/food-photo/handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// EU-Region (Frankfurt) wie die Datenbank.
export const preferredRegion = 'fra1';
// Zeitlimit des Anbieters 20 s, ggf. ein zweiter Versuch.
export const maxDuration = 60;

/** Bild + Info + Formular-Rahmen; größere Anfragen werden nicht gelesen. */
const MAX_BODY_BYTES = AI_FOOD_PHOTO.maxImageBytes + 16_384;

async function readForm(request: Request): Promise<FoodPhotoForm | null> {
  const length = Number(request.headers.get('content-length') ?? 'NaN');
  if (!Number.isFinite(length) || length <= 0 || length > MAX_BODY_BYTES) return null;
  if (!(request.headers.get('content-type') ?? '').startsWith('multipart/form-data')) return null;
  let data: FormData;
  try {
    data = await request.formData();
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

export async function POST(request: Request) {
  const res = await handleFoodPhoto({
    env: process.env,
    headers: request.headers,
    form: await readForm(request),
  });
  return Response.json(res.body, { status: res.status, headers: res.headers });
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers, process.env) });
}

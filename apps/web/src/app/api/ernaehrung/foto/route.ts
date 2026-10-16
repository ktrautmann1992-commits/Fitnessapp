/**
 * POST /api/ernaehrung/foto – Gericht per Foto (Etappe E3). Ablauf: src/lib/food-photo/handler.ts.
 * Erwartet multipart/form-data mit `image` (JPEG/PNG/WebP, auf dem Gerät auf 1.024 px verkleinert) und optional
 * `note` (≤ 120 Zeichen) sowie `Authorization: Bearer <Supabase-JWT>`. Das Foto wird nur im Arbeitsspeicher
 * verarbeitet und nie gespeichert (A-G18). Der Körper wird erst NACH Herkunft und Login gelesen (Wächter E3 M2).
 */
import { corsHeaders, handleFoodPhoto } from '@/lib/food-photo/handler';
import { readFoodPhotoForm } from '@/lib/food-photo/form';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// EU-Region (Frankfurt) wie die Datenbank.
export const preferredRegion = 'fra1';
// Zeitlimit des Anbieters 20 s, ggf. ein zweiter Versuch.
export const maxDuration = 60;

export async function POST(request: Request) {
  const res = await handleFoodPhoto({
    env: process.env,
    headers: request.headers,
    readForm: () => readFoodPhotoForm(request),
  });
  return Response.json(res.body, { status: res.status, headers: res.headers });
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers, process.env) });
}

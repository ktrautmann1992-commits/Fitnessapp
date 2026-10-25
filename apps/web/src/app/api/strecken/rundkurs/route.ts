/**
 * POST /api/strecken/rundkurs – Rundkurs-Vorschlag (docs/PLAN-RUNDKURS.md). Ablauf: src/lib/loop-routing/handler.ts.
 * Erwartet `Content-Type: application/json` mit `{ lat, lng, distance_km, surface, variant }` (höchstens 256 Byte) und
 * `Authorization: Bearer <Supabase-JWT>`. Koordinaten stehen nie in der Adresse (Abfrage-Parameter werden nicht
 * gelesen). Der Körper wird erst NACH Herkunft und Login gelesen. Nichts wird gespeichert oder geloggt.
 */
import { LOOP_ROUTE } from '@fitnessapp/core';

import { readBodyLimited } from '@/lib/food-photo/form';
import { corsHeaders, handleLoopRouting } from '@/lib/loop-routing/handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// EU-Region (Frankfurt) wie die Datenbank; der Routing-Dienst steht in Heidelberg.
export const preferredRegion = 'fra1';
// 4 Runden parallel, je höchstens 8 s.
export const maxDuration = 15;

async function readBody(request: Request): Promise<string | null> {
  const body = await readBodyLimited(request, LOOP_ROUTE.maxBodyBytes);
  if (body === null || body.byteLength === 0) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const res = await handleLoopRouting({
    env: process.env,
    headers: request.headers,
    readBody: () => readBody(request),
  });
  return Response.json(res.body, { status: res.status, headers: res.headers });
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers, process.env) });
}

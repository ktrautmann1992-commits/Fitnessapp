/**
 * POST /api/ernaehrung/produkt – Produktabfrage per Barcode-Nummer über Open Food Facts (Etappe E4a,
 * docs/PLAN-E4.md 3.2). Ablauf: src/lib/food-product/handler.ts. Erwartet `Content-Type: application/json` mit genau
 * `{ "code": "<8–14 Ziffern>" }` (höchstens 256 Byte) und `Authorization: Bearer <Supabase-JWT>`. Die Nummer steht nie
 * in der Adresse (Abfrage-Parameter werden nicht gelesen). Der Körper wird erst NACH Herkunft und Login gelesen.
 */
import { readFoodProductBody } from '@/lib/food-product/body';
import { corsHeaders, handleFoodProduct } from '@/lib/food-product/handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// EU-Region (Frankfurt) wie die Datenbank.
export const preferredRegion = 'fra1';
// OFF-Zeitlimit 6 s + Datenbank.
export const maxDuration = 15;

export async function POST(request: Request) {
  const res = await handleFoodProduct({
    env: process.env,
    headers: request.headers,
    readBody: () => readFoodProductBody(request),
  });
  return Response.json(res.body, { status: res.status, headers: res.headers });
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers, process.env) });
}

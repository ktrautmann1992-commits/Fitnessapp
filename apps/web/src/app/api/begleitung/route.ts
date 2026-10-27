/**
 * POST /api/begleitung – Ansicht der Live-Begleitung (docs/PLAN-PHASE-10.md 21.3). Ablauf: src/lib/live/handler.ts.
 * Erwartet JSON `{ token }` (höchstens 256 Byte) – das Token steht nie in der Adresse (Abfrage-Parameter werden nicht
 * gelesen). Nichts wird geloggt; keine Cookies.
 */
import { readBodyLimited } from '@/lib/food-photo/form';
import { handleLiveView, LIVE_HEADERS, LIVE_MAX_BODY_BYTES } from '@/lib/live/handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// EU-Region (Frankfurt) wie die Datenbank.
export const preferredRegion = 'fra1';
export const maxDuration = 10;

async function readBody(request: Request): Promise<string | null> {
  const body = await readBodyLimited(request, LIVE_MAX_BODY_BYTES).catch(() => null);
  if (body === null || body.byteLength === 0) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const res = await handleLiveView({
    env: process.env,
    headers: request.headers,
    body: await readBody(request),
  });
  return Response.json(res.body, { status: res.status, headers: res.headers });
}

/** Nur POST – andere Methoden ohne Inhalt. */
export function GET() {
  return new Response(null, { status: 405, headers: { ...LIVE_HEADERS, Allow: 'POST' } });
}

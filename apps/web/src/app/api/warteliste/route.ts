/**
 * POST /api/warteliste – Eintragen in die Warteliste (Double-Opt-in). Ablauf: src/lib/waitlist/handler.ts.
 * Erwartet JSON { email, consent, website (Honeypot) }. Die Bestätigungs-Mail geht per after() NACH der Antwort raus.
 */
import { after } from 'next/server';

import { handleSignup, toJsonResponse } from '@/lib/waitlist/handler';

export const dynamic = 'force-dynamic';

/** Größere Anfragen werden nicht gelesen. */
const MAX_BODY_BYTES = 2048;

export async function POST(request: Request) {
  let body: unknown = null;
  const text = await request.text().catch(() => '');
  if (text.length <= MAX_BODY_BYTES) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  return toJsonResponse(
    await handleSignup({
      env: process.env,
      headers: request.headers,
      body,
      now: Date.now(),
      // Mail erst nach der Antwort senden: gleiche Antwortzeit mit und ohne Mail.
      schedule: (task) => after(task),
    }),
  );
}

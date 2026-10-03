/**
 * POST /admin/api/login – Anmelden (Stufe A). Ablauf und Prüfungen in src/lib/admin/login.ts:
 * Herkunft (Origin/Host), Passwort in konstanter Zeit, ca. 1 s Verzögerung bei Fehlversuch, signiertes Cookie.
 */
import { handleLogin, toResponse } from '@/lib/admin/login';

export const dynamic = 'force-dynamic';

/** Größere Formulare werden nicht gelesen. */
const MAX_BODY_BYTES = 4096;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  let password: unknown = '';
  const length = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(length) && length <= MAX_BODY_BYTES) {
    try {
      password = (await request.formData()).get('password');
    } catch {
      password = '';
    }
  }
  return toResponse(
    await handleLogin({
      env: process.env,
      headers: request.headers,
      password,
      now: Date.now(),
      sleep,
    }),
  );
}

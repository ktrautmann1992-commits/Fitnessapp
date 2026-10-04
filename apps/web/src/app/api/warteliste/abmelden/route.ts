/**
 * POST /api/warteliste/abmelden – Formular der Seite /warteliste/abmelden (Token aus dem Mail-Link).
 * Bewusst POST statt Klick auf den Link allein: Mail-Programme rufen Links teils automatisch auf (Virenscanner).
 */
import { handleLinkAction, toLinkResponse } from '@/lib/waitlist/handler';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token: unknown = await request
    .formData()
    .then((form) => form.get('token'))
    .catch(() => null);
  return toLinkResponse(
    await handleLinkAction('abmelden', { env: process.env, headers: request.headers, token }),
  );
}

/**
 * POST /api/gratis-rezepte/abmelden – Formular der Seite /gratis-rezepte/abmelden (Token aus dem Mail-Link).
 * Löscht den Eintrag (Gratis-Rezepte und ggf. Newsletter) vollständig.
 */
import { handleLinkAction, toLinkResponse } from '@/lib/waitlist/handler';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token: unknown = await request
    .formData()
    .then((form) => form.get('token'))
    .catch(() => null);
  return toLinkResponse(
    await handleLinkAction('abmelden', {
      env: process.env,
      headers: request.headers,
      token,
      source: 'lead-magnet',
    }),
  );
}

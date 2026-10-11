/**
 * POST /api/gratis-rezepte/bestaetigen – Formular der Seite /gratis-rezepte/bestaetigen (Token aus dem Mail-Link).
 * Beim ersten Bestätigen geht per after() die Mail mit dem Download-Link raus.
 * Bewusst POST statt Klick auf den Link allein: Mail-Programme rufen Links teils automatisch auf (Virenscanner).
 */
import { after } from 'next/server';

import { handleLinkAction, toLinkResponse } from '@/lib/waitlist/handler';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token: unknown = await request
    .formData()
    .then((form) => form.get('token'))
    .catch(() => null);
  return toLinkResponse(
    await handleLinkAction('bestaetigen', {
      env: process.env,
      headers: request.headers,
      token,
      source: 'lead-magnet',
      schedule: (task) => after(task),
    }),
  );
}

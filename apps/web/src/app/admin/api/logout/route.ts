/** POST /admin/api/logout – Abmelden: Herkunft prüfen, Sitzungs-Cookie löschen, zurück zum Login. */
import { handleLogout, toResponse } from '@/lib/admin/login';

export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return toResponse(handleLogout(request.headers));
}

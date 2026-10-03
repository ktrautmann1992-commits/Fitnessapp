/**
 * Proxy (früher „Middleware“, ab Next.js 16 `proxy.ts`): erste Schutzschicht für den Redaktionsbereich.
 * Läuft auf dem Server vor jeder Anfrage unter /admin (Node.js-Laufzeit, Standard in Next 16).
 * - Nicht eingerichtet (ADMIN_PASSWORD/ADMIN_SESSION_SECRET fehlen oder zu kurz) → nur /admin (Hinweisseite)
 *   und /admin/login sind erreichbar, alles andere leitet auf /admin.
 * - Ohne gültige Sitzung → Login. Login-Seite und Login/Logout-Aktionen selbst sind ohne Sitzung erreichbar
 *   (die Aktionen prüfen Herkunft und Passwort selbst).
 * - Immer: nicht indexieren, nicht zwischenspeichern.
 * Jede Admin-Seite prüft die Sitzung zusätzlich selbst (Defense in depth, src/lib/admin/access.ts).
 */
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE } from '@/lib/admin/session';
import { adminAccessFor } from '@/lib/admin/state';

const OPEN_PATHS = new Set(['/admin/login', '/admin/api/login', '/admin/api/logout']);

function withAdminHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'no-store');
  // „same-origin“ statt „no-referrer“: Bei „no-referrer“ schicken Browser bei Formularen `Origin: null` –
  // dann würde die Herkunftsprüfung von Login/Abmelden jede Anfrage ablehnen.
  response.headers.set('Referrer-Policy', 'same-origin');
  return response;
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/+$/, '') || '/';
  const access = adminAccessFor(
    process.env,
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    Date.now(),
  );

  if (OPEN_PATHS.has(path)) {
    return withAdminHeaders(NextResponse.next());
  }
  if (access.state === 'disabled') {
    return withAdminHeaders(
      path === '/admin'
        ? NextResponse.next()
        : NextResponse.redirect(new URL('/admin', request.url), 303),
    );
  }
  if (access.state !== 'ok') {
    return withAdminHeaders(NextResponse.redirect(new URL('/admin/login', request.url), 303));
  }
  return withAdminHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};

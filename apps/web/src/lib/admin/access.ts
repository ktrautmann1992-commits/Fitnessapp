/**
 * Zugriffsprüfung auf dem Server – in JEDER Admin-Seite (zusätzlich zur Prüfung in `src/proxy.ts`,
 * Defense in depth). Die reine Prüfung steht in `state.ts`.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ADMIN_SESSION_COOKIE } from './session';
import { type AdminAccess, adminAccessFor } from './state';

export type { AdminAccess };

/** Zugriff für die aktuelle Anfrage (liest das Sitzungs-Cookie). */
export async function getAdminAccess(): Promise<AdminAccess> {
  const store = await cookies();
  return adminAccessFor(process.env, store.get(ADMIN_SESSION_COOKIE)?.value, Date.now());
}

/**
 * Für geschützte Unterseiten: nur mit gültiger Sitzung weiter. Nicht eingerichtet → Übersicht (zeigt den
 * Hinweis), nicht angemeldet → Login.
 */
export async function requireAdmin(): Promise<void> {
  const access = await getAdminAccess();
  if (access.state === 'disabled') {
    redirect('/admin');
  }
  if (access.state !== 'ok') {
    redirect('/admin/login');
  }
}

import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { appNotifications } from '@/lib/app-notifications';
import { useApp } from '@/state/app-state';

/**
 * Antippen einer lokalen Benachrichtigung (Etappe E): Die Mess-Erinnerung öffnet die Messung. Gewartet wird, bis der
 * Stand geladen ist; ohne Anmeldung oder mitten im Onboarding wird nichts geöffnet (der Startpunkt entscheidet).
 * Im Browser gibt es keine Benachrichtigungen (No-op).
 */
export function NotificationRouter() {
  const app = useApp();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => appNotifications.onOpen((route) => setPending(route)), []);

  const ready = app.status.kind === 'ready';
  const completed = app.session !== null && app.rows?.profile?.onboarding_completed_at != null;
  useEffect(() => {
    if (!pending || !ready) return;
    const route = pending;
    // Erst nach dem Zeichnen (der Startpunkt leitet beim Laden selbst weiter).
    const id = setTimeout(() => {
      setPending(null);
      if (completed) router.push(route as Href);
    }, 0);
    return () => clearTimeout(id);
  }, [pending, ready, completed]);

  return null;
}

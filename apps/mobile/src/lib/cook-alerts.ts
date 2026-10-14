import { t } from '@/i18n';

/**
 * Hinweis, wenn beim Kochtag ein neuer Schritt beginnt (Etappe N5b, docs/PLAN-PHASE-5.md 19.6) – BROWSER (Web-Export):
 * Mitteilung über die Notification-API, wenn erlaubt und die Seite im Hintergrund ist, sonst nur Vibration (falls
 * vorhanden) und der sichtbare Hinweis mit aria-live. Mitteilungen kommen nur, solange die Seite geöffnet ist; die
 * Timer selbst rechnen mit Zeitstempeln und laufen nach dem Neuladen richtig weiter. Kein Inhalt außer dem
 * Schritt-Text (keine Gesundheitsdaten).
 */
export type CookAlertMode = 'notify' | 'in_app';

interface BrowserNotification {
  permission: 'default' | 'denied' | 'granted';
  requestPermission(): Promise<'default' | 'denied' | 'granted'>;
}

function notificationApi():
  (BrowserNotification & (new (title: string, options?: { body?: string }) => unknown)) | null {
  const api = (globalThis as { Notification?: unknown }).Notification;
  return typeof api === 'function'
    ? (api as BrowserNotification & (new (title: string, options?: { body?: string }) => unknown))
    : null;
}

/** Beim Start des Kochtags: um Erlaubnis bitten (nur nach Tippen auf „Kochtag starten“). */
export async function prepareCookAlerts(): Promise<CookAlertMode> {
  const api = notificationApi();
  if (api === null) return 'in_app';
  try {
    const permission =
      api.permission === 'default' ? await api.requestPermission() : api.permission;
    return permission === 'granted' ? 'notify' : 'in_app';
  } catch {
    return 'in_app';
  }
}

/** Aktueller Stand ohne Nachfrage (z. B. nach dem Neuladen). */
export function currentCookAlertMode(): CookAlertMode {
  return notificationApi()?.permission === 'granted' ? 'notify' : 'in_app';
}

/** Ein Schritt beginnt. */
export function alertCookStep(text: string): void {
  const nav = (globalThis as { navigator?: { vibrate?: (pattern: number[]) => boolean } })
    .navigator;
  try {
    nav?.vibrate?.([200, 100, 200]);
  } catch {
    // Vibration ist optional.
  }
  const api = notificationApi();
  const hidden = (globalThis as { document?: { hidden?: boolean } }).document?.hidden === true;
  if (api !== null && api.permission === 'granted' && hidden) {
    try {
      new api(t.nutrition.cookDay.notifyTitle, { body: text });
    } catch {
      // Manche Browser erlauben Mitteilungen nur über einen Service Worker – dann bleibt der sichtbare Hinweis.
    }
  }
}

/** Hinweistext zur Art der Erinnerung. */
export function cookAlertNote(mode: CookAlertMode): string {
  return mode === 'notify' ? t.nutrition.cookDay.notifyWeb : t.nutrition.cookDay.notifyOff;
}

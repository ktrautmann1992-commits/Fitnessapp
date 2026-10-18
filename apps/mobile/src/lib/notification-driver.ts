/**
 * Plattform-Schicht für lokale Benachrichtigungen (docs/PLAN-PHASE-4B.md Abschnitt 7, Etappe E).
 *
 * BROWSER (diese Datei): keine Benachrichtigungen – alles ist ein No-op, die App zeigt stattdessen einen Hinweis
 * (Einstellungen) und die sichtbare Pausen-Leiste. iPhone/Android: notification-driver.native.ts (expo-notifications,
 * nur lokal, ohne Push-Token).
 */
export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

/** Fester Text ohne Werte (DSGVO Art. 9) und optional ein App-Pfad, der beim Antippen geöffnet wird. */
export interface NotificationContent {
  readonly title: string;
  readonly body: string | null;
  readonly route: string | null;
}

export interface NotificationDriver {
  /** false = Browser: keine Benachrichtigungen möglich. */
  readonly supported: boolean;
  /** Aktuelle Erlaubnis – fragt NIE nach. */
  permission(): Promise<NotificationPermission>;
  /** Fragt die System-Erlaubnis ab (nur nach einer ausdrücklichen Nutzer-Aktion aufrufen). */
  requestPermission(): Promise<NotificationPermission>;
  /** Plant (bzw. ersetzt) die Benachrichtigung `id` zum Zeitpunkt `atMs`. */
  schedule(id: string, content: NotificationContent, atMs: number): Promise<void>;
  cancel(id: string): Promise<void>;
  /** Eine schon angezeigte Benachrichtigung aus der Mitteilungszentrale entfernen. */
  dismiss(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  /** Antippen einer Benachrichtigung (auch Kaltstart): liefert den hinterlegten App-Pfad. */
  onOpen(listener: (route: string) => void): () => void;
}

export const notificationDriver: NotificationDriver = {
  supported: false,
  permission: async () => 'denied',
  requestPermission: async () => 'denied',
  schedule: async () => undefined,
  cancel: async () => undefined,
  dismiss: async () => undefined,
  cancelAll: async () => undefined,
  onOpen: () => () => undefined,
};

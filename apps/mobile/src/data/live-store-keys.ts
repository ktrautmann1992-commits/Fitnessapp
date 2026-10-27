/**
 * Daten- und Schlüssel-Namen der geschützten Speicher der Live-Begleitung (live-store.ts / .native.ts):
 * - `contacts`: Notfallkontakte (Daten Dritter!) und Einstellungen – NUR auf diesem Gerät (CLAUDE.md, F1), nie auf dem
 *   Server, nie in einer Sync-Warteschlange.
 * - `session`: laufende Begleitung (id und Link der Person), damit sie nach einem Neustart der App beendet werden kann.
 */
export const LIVE_STORE_KEYS = {
  contacts: {
    dataKey: 'fitnessapp.live-contacts.v1',
    keyName: 'fitnessapp.live-contacts-key.v1',
  },
  session: {
    dataKey: 'fitnessapp.live-session.v1',
    keyName: 'fitnessapp.live-session-key.v1',
  },
} as const;

export type LiveStoreName = keyof typeof LIVE_STORE_KEYS;

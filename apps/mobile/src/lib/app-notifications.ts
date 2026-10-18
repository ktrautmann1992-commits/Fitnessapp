import { useCallback, useEffect, useState } from 'react';

import { deviceStore } from '@/data/create-backend';

import { notificationDriver, type NotificationPermission } from './notification-driver';
import {
  createNotifications,
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from './notifications';

/**
 * Eine Instanz für die ganze App (Browser: No-op-Treiber, iPhone/Android: expo-notifications). Logik und Tests:
 * lib/notifications.ts; Zeitrechnung: packages/core/src/notifications.ts.
 */
export const appNotifications = createNotifications(notificationDriver, deviceStore);

export interface NotificationPrefsState {
  readonly supported: boolean;
  readonly loaded: boolean;
  readonly prefs: NotificationPrefs;
  readonly permission: NotificationPermission | null;
  reload: () => Promise<void>;
}

/** Geräte-Einstellung und Erlaubnis (nur gelesen – fragt nie nach). */
export function useNotificationPrefs(): NotificationPrefsState {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    const [nextPrefs, nextPermission] = await Promise.all([
      appNotifications.loadPrefs(),
      appNotifications.permission().catch(() => 'denied' as const),
    ]);
    setPrefs(nextPrefs);
    setPermission(nextPermission);
    setLoaded(true);
  }, []);
  useEffect(() => {
    let alive = true;
    void Promise.all([
      appNotifications.loadPrefs(),
      appNotifications.permission().catch(() => 'denied' as const),
    ])
      .then(([nextPrefs, nextPermission]) => {
        if (!alive) return;
        setPrefs(nextPrefs);
        setPermission(nextPermission);
        setLoaded(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return { supported: appNotifications.supported, loaded, prefs, permission, reload };
}

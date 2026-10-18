import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type {
  NotificationContent,
  NotificationDriver,
  NotificationPermission,
} from './notification-driver';

export type { NotificationContent, NotificationDriver, NotificationPermission };

/**
 * iPhone/Android: lokale Benachrichtigungen über expo-notifications (docs/PLAN-PHASE-4B.md Abschnitt 7).
 * - Nur auf dem Gerät geplant: kein Push-Token, kein Server, kein Versand über Expo, Apple oder Google.
 * - Android: ein Kanal „Erinnerungen“ (Mess-Erinnerung und Pausenende), angelegt vor der Erlaubnis-Abfrage
 *   (Android 13+ zeigt die Abfrage erst, wenn ein Kanal existiert) und vor jedem Planen.
 * - Die Erlaubnis wird nur in `requestPermission()` abgefragt – nie beim Import oder App-Start.
 */
export const ANDROID_CHANNEL_ID = 'erinnerungen';
export const ANDROID_CHANNEL_NAME = 'Erinnerungen';

// Auch bei geöffneter App anzeigen (z. B. Mess-Erinnerung um 08:00, während jemand die App nutzt).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelReady: Promise<void> | null = null;

function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: ANDROID_CHANNEL_NAME,
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    showBadge: false,
  }).then(
    () => undefined,
    (error: unknown) => {
      channelReady = null;
      throw error;
    },
  );
  return channelReady;
}

function toPermission(status: { status: string; granted: boolean }): NotificationPermission {
  if (status.granted) return 'granted';
  return status.status === 'undetermined' ? 'undetermined' : 'denied';
}

function routeOf(response: Notifications.NotificationResponse | null): string | null {
  const route: unknown = response?.notification.request.content.data?.route;
  return typeof route === 'string' && route !== '' ? route : null;
}

export const notificationDriver: NotificationDriver = {
  supported: true,
  permission: async () => toPermission(await Notifications.getPermissionsAsync()),
  requestPermission: async () => {
    await ensureChannel();
    return toPermission(
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      }),
    );
  },
  schedule: async (id, content, atMs) => {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: content.title,
        body: content.body,
        data: content.route ? { route: content.route } : {},
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: atMs,
        channelId: ANDROID_CHANNEL_ID,
      },
    });
  },
  cancel: (id) => Notifications.cancelScheduledNotificationAsync(id),
  dismiss: (id) => Notifications.dismissNotificationAsync(id),
  cancelAll: () => Notifications.cancelAllScheduledNotificationsAsync(),
  onOpen: (listener) => {
    // Kaltstart: Die App wurde durch Antippen geöffnet.
    const initial = routeOf(Notifications.getLastNotificationResponse());
    if (initial) {
      Notifications.clearLastNotificationResponse();
      listener(initial);
    }
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = routeOf(response);
      if (!route) return;
      Notifications.clearLastNotificationResponse();
      listener(route);
    });
    return () => subscription.remove();
  },
};

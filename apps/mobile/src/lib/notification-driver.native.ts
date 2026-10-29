import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type {
  NotificationChannel,
  NotificationContent,
  NotificationDriver,
  NotificationPermission,
} from './notification-driver';

export type {
  NotificationChannel,
  NotificationContent,
  NotificationDriver,
  NotificationPermission,
};

/**
 * iPhone/Android: lokale Benachrichtigungen über expo-notifications (docs/PLAN-PHASE-4B.md Abschnitt 7).
 * - Nur auf dem Gerät geplant: kein Push-Token, kein Server, kein Versand über Expo, Apple oder Google.
 * - Android: Kanal „Erinnerungen“ (Mess-Erinnerung und Pausenende) sowie je ein Kanal „Training“, „Essen“ und
 *   „Trinken“ (docs/PLAN-ERINNERUNGEN.md – einzeln in den System-Einstellungen abschaltbar). „Erinnerungen“ wird vor der
 *   Erlaubnis-Abfrage angelegt (Android 13+ zeigt die Abfrage erst, wenn ein Kanal existiert), jeder Kanal vor dem
 *   ersten Planen.
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

/** Android-Kanäle: Kennung, Name in den System-Einstellungen, Wichtigkeit (Trinken leiser: ohne Ton-Vorrang). */
export const ANDROID_CHANNELS: Readonly<
  Record<NotificationChannel, { id: string; name: string; quiet: boolean }>
> = {
  reminders: { id: ANDROID_CHANNEL_ID, name: ANDROID_CHANNEL_NAME, quiet: false },
  training: { id: 'erinnerung-training', name: 'Training', quiet: false },
  meals: { id: 'erinnerung-essen', name: 'Essen', quiet: false },
  drink: { id: 'erinnerung-trinken', name: 'Trinken', quiet: true },
};

const channelReady = new Map<NotificationChannel, Promise<void>>();

function ensureChannel(channel: NotificationChannel = 'reminders'): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  const existing = channelReady.get(channel);
  if (existing) return existing;
  const spec = ANDROID_CHANNELS[channel];
  const ready = Notifications.setNotificationChannelAsync(spec.id, {
    name: spec.name,
    importance: spec.quiet
      ? Notifications.AndroidImportance.DEFAULT
      : Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    showBadge: false,
  }).then(
    () => undefined,
    (error: unknown) => {
      channelReady.delete(channel);
      throw error;
    },
  );
  channelReady.set(channel, ready);
  return ready;
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
    const channel = content.channel ?? 'reminders';
    await ensureChannel(channel);
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
        channelId: ANDROID_CHANNELS[channel].id,
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

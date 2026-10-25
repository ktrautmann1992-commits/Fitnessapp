import {
  CalendarAccessLevel,
  createCalendar,
  EntityTypes,
  ExpoCalendar,
  ExpoCalendarEvent,
  getCalendarPermissions,
  getCalendars,
  getDefaultCalendarSync,
  requestCalendarPermissions,
  SourceType,
  type PermissionResponse,
} from 'expo-calendar';
import { Platform } from 'react-native';

import type { CalendarDriver, CalendarEventDetails, CalendarPermission } from './calendar-driver';

/**
 * „Trainings im Handy-Kalender“ auf iPhone/Android (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 4) über expo-calendar:
 * ein EIGENER Kalender „Alpha5 Training“ (Android: lokales Konto, nicht synchronisiert; iOS: in der Quelle des
 * Standard-Kalenders, damit er sichtbar ist). Die App liest keine fremden Termine – sie sucht nur ihren eigenen
 * Kalender per Kennung. Termine: nur Titel, Beginn, Ende. Fehlermeldungen ohne Inhalte (nie loggen).
 */

function toPermission(response: PermissionResponse): CalendarPermission {
  if (response.granted) return 'granted';
  return response.canAskAgain ? 'undetermined' : 'denied';
}

function eventFields(details: CalendarEventDetails) {
  return {
    title: details.title,
    startDate: details.start,
    endDate: details.end,
    allDay: false,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

async function findCalendar(id: string): Promise<ExpoCalendar | null> {
  const calendars = await getCalendars(EntityTypes.EVENT);
  return calendars.find((c) => c.id === id) ?? null;
}

export const calendarDriver: CalendarDriver = {
  supported: true,
  permission: async () => toPermission(await getCalendarPermissions()),
  requestPermission: async () => toPermission(await requestCalendarPermissions()),
  ensureCalendar: async (knownId, name, color) => {
    if (knownId !== null && (await findCalendar(knownId)) !== null) return knownId;
    const calendar =
      Platform.OS === 'ios'
        ? await createCalendar({
            title: name,
            color,
            entityType: EntityTypes.EVENT,
            sourceId: getDefaultCalendarSync().source.id,
          })
        : await createCalendar({
            title: name,
            name,
            color,
            entityType: EntityTypes.EVENT,
            accessLevel: CalendarAccessLevel.OWNER,
            ownerAccount: 'Alpha5',
            source: { isLocalAccount: true, name: 'Alpha5', type: SourceType.LOCAL },
          });
    return calendar.id;
  },
  removeCalendar: async (calendarId) => {
    const calendar = await findCalendar(calendarId);
    if (calendar) await calendar.delete();
  },
  createEvent: async (calendarId, details) => {
    const calendar = await ExpoCalendar.get(calendarId);
    const event = await calendar.createEvent(eventFields(details));
    return event.id;
  },
  updateEvent: async (eventId, details) => {
    const event = await ExpoCalendarEvent.get(eventId);
    await event.update(eventFields(details));
  },
  deleteEvent: async (eventId) => {
    try {
      const event = await ExpoCalendarEvent.get(eventId);
      await event.delete();
    } catch {
      // Schon gelöscht (z. B. von Hand im Kalender) – nichts zu tun.
    }
  },
};

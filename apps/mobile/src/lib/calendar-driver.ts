/**
 * Plattform-Schicht „Trainings im Handy-Kalender“ (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 4).
 *
 * BROWSER (diese Datei): kein Zugriff auf einen Gerätekalender – `supported: false`; die App bietet stattdessen eine
 * .ics-Datei zum Herunterladen an. iPhone/Android: calendar-driver.native.ts (expo-calendar, eigener Kalender
 * „Alpha5 Training“, nur Schreiben eigener Termine).
 */
export type CalendarPermission = 'granted' | 'denied' | 'undetermined';

/** Termin in Gerätezeit – nur Titel, Beginn und Ende (keine Notizen, kein Ort). */
export interface CalendarEventDetails {
  readonly title: string;
  readonly start: Date;
  readonly end: Date;
}

export interface CalendarDriver {
  readonly supported: boolean;
  /** Aktuelle Erlaubnis – fragt NIE nach. */
  permission(): Promise<CalendarPermission>;
  /** Fragt die System-Erlaubnis ab (nur nach ausdrücklicher Nutzer-Aktion). */
  requestPermission(): Promise<CalendarPermission>;
  /** Eigenen Kalender sicherstellen (vorhandene Kennung prüfen, sonst neu anlegen) → Kennung. */
  ensureCalendar(knownId: string | null, name: string, color: string): Promise<string>;
  /** Eigenen Kalender samt aller Termine entfernen (fehlt er schon, ist das in Ordnung). */
  removeCalendar(calendarId: string): Promise<void>;
  createEvent(calendarId: string, details: CalendarEventDetails): Promise<string>;
  updateEvent(eventId: string, details: CalendarEventDetails): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
}

export const calendarDriver: CalendarDriver = {
  supported: false,
  permission: async () => 'denied',
  requestPermission: async () => 'denied',
  ensureCalendar: async () => {
    throw new Error('calendar_unsupported');
  },
  removeCalendar: async () => undefined,
  createEvent: async () => {
    throw new Error('calendar_unsupported');
  },
  updateEvent: async () => undefined,
  deleteEvent: async () => undefined,
};

import {
  calendarEventFingerprint,
  diffCalendarEvents,
  type StoredCalendarEvent,
  type TrainingCalendarEvent,
} from '@fitnessapp/core';

import { readJson, writeJson, type KeyValueStore } from '@/data/kv';

import type { CalendarDriver, CalendarEventDetails, CalendarPermission } from './calendar-driver';

/**
 * Trainings im Handy-Kalender (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 4): Einstellung und Abgleich – nur auf diesem
 * Gerät (Schlüssel `STORE_KEY`), nie auf dem Server. Welche Termine es gibt, rechnet packages/core
 * (`trainingCalendarEvents`, `diffCalendarEvents`); hier werden sie nur angelegt, geändert und gelöscht.
 *
 * Datenschutz: Im Speicher stehen nur Kalender-Kennung, Termin-Kennungen und Fingerabdrücke (Titel, Datum, Uhrzeit,
 * Dauer). Fehler werden nie mit Inhalten geloggt.
 */
export const DEVICE_CALENDAR_STORE_KEY = 'fitnessapp.device-calendar.v1';

/** Markenblau (packages/ui, --brand-blau). */
const CALENDAR_COLOR = '#1F5BFF';

export interface DeviceCalendarPrefs {
  readonly enabled: boolean;
  /** Gewählte Uhrzeit in Minuten nach Mitternacht; null = wie die Trainingszeit (sonst 18:00). */
  readonly startMinutes: number | null;
  readonly calendarId: string | null;
  readonly events: Readonly<Record<string, StoredCalendarEvent>>;
}

export const DEFAULT_DEVICE_CALENDAR_PREFS: DeviceCalendarPrefs = {
  enabled: false,
  startMinutes: null,
  calendarId: null,
  events: {},
};

/** Termin → Beginn/Ende in Ortszeit des Geräts. */
export function eventDetails(event: TrainingCalendarEvent): CalendarEventDetails {
  const [y, m, d] = event.date.split('-').map(Number) as [number, number, number];
  const start = new Date(y, m - 1, d, 0, event.startMinutes);
  const end = new Date(y, m - 1, d, 0, event.startMinutes + event.durationMinutes);
  return { title: event.title, start, end };
}

export type EnableOutcome = 'enabled' | 'denied' | 'unsupported';

export interface DeviceCalendar {
  readonly supported: boolean;
  loadPrefs(): Promise<DeviceCalendarPrefs>;
  permission(): Promise<CalendarPermission>;
  /** Erlaubnis abfragen (nach dem Erklär-Dialog) und einschalten; die Termine trägt `sync` ein. */
  enable(): Promise<EnableOutcome>;
  /** Ausschalten: eigenen Kalender samt Terminen entfernen, Einstellung zurücksetzen (Uhrzeit bleibt). */
  disable(): Promise<void>;
  setStartMinutes(minutes: number | null): Promise<void>;
  /** Termine abgleichen (nur wenn eingeschaltet und erlaubt) → Anzahl der Termine bzw. null = nichts getan. */
  sync(events: readonly TrainingCalendarEvent[]): Promise<number | null>;
}

export function createDeviceCalendar(driver: CalendarDriver, store: KeyValueStore): DeviceCalendar {
  async function loadPrefs(): Promise<DeviceCalendarPrefs> {
    const stored = await readJson<Partial<DeviceCalendarPrefs>>(store, DEVICE_CALENDAR_STORE_KEY);
    return {
      enabled: stored?.enabled === true,
      startMinutes: typeof stored?.startMinutes === 'number' ? stored.startMinutes : null,
      calendarId: typeof stored?.calendarId === 'string' ? stored.calendarId : null,
      events: stored?.events && typeof stored.events === 'object' ? stored.events : {},
    };
  }
  const save = (prefs: DeviceCalendarPrefs) => writeJson(store, DEVICE_CALENDAR_STORE_KEY, prefs);

  // Abgleiche nacheinander (nie zwei gleichzeitig – sonst doppelte Termine).
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(run: () => Promise<T>): Promise<T> {
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  }

  async function runSync(events: readonly TrainingCalendarEvent[]): Promise<number | null> {
    const prefs = await loadPrefs();
    if (!driver.supported || !prefs.enabled) return null;
    if ((await driver.permission()) !== 'granted') return null;
    const calendarId = await driver.ensureCalendar(
      prefs.calendarId,
      'Alpha5 Training',
      CALENDAR_COLOR,
    );
    // Neuer Kalender (z. B. von Hand gelöscht): alte Kennungen gelten nicht mehr.
    const known = calendarId === prefs.calendarId ? prefs.events : {};
    const diff = diffCalendarEvents(events, known);
    const next: Record<string, StoredCalendarEvent> = {};
    for (const key of diff.unchanged) {
      const value = known[key];
      if (value) next[key] = value;
    }
    for (const { eventId } of diff.remove) await driver.deleteEvent(eventId);
    for (const { eventId, event } of diff.update) {
      let id = eventId;
      try {
        await driver.updateEvent(eventId, eventDetails(event));
      } catch {
        // Termin gibt es nicht mehr (von Hand gelöscht) – neu anlegen.
        id = await driver.createEvent(calendarId, eventDetails(event));
      }
      next[event.key] = { eventId: id, fingerprint: calendarEventFingerprint(event) };
    }
    for (const event of diff.create) {
      const id = await driver.createEvent(calendarId, eventDetails(event));
      next[event.key] = { eventId: id, fingerprint: calendarEventFingerprint(event) };
      // Zwischenstand sichern: bricht der Abgleich ab, entstehen beim nächsten Mal keine Doppelten.
      await save({ ...prefs, calendarId, events: { ...known, ...next } });
    }
    await save({ ...prefs, calendarId, events: next });
    return events.length;
  }

  return {
    supported: driver.supported,
    loadPrefs,
    permission: () => (driver.supported ? driver.permission() : Promise.resolve('denied')),
    enable: () =>
      serial(async () => {
        if (!driver.supported) return 'unsupported' as const;
        const permission = await driver.requestPermission();
        if (permission !== 'granted') return 'denied' as const;
        await save({ ...(await loadPrefs()), enabled: true });
        return 'enabled' as const;
      }),
    disable: () =>
      serial(async () => {
        const prefs = await loadPrefs();
        if (prefs.calendarId !== null && driver.supported) {
          await driver.removeCalendar(prefs.calendarId);
        }
        await save({ ...DEFAULT_DEVICE_CALENDAR_PREFS, startMinutes: prefs.startMinutes });
      }),
    setStartMinutes: (minutes) =>
      serial(async () => {
        await save({ ...(await loadPrefs()), startMinutes: minutes });
      }),
    sync: (events) => serial(() => runSync(events)),
  };
}

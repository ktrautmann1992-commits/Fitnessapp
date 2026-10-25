import type { TrainingCalendarEvent } from '@fitnessapp/core';
import { describe, expect, it, vi } from 'vitest';

import { createMemoryStore } from '@/data/kv';

import type { CalendarDriver, CalendarPermission } from './calendar-driver';
import { createDeviceCalendar, DEVICE_CALENDAR_STORE_KEY, eventDetails } from './device-calendar';

function fakeDriver(permission: CalendarPermission = 'granted') {
  let next = 0;
  const events = new Map<string, { title: string; start: Date; end: Date }>();
  const calendars = new Set<string>();
  const driver: CalendarDriver = {
    supported: true,
    permission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => permission),
    ensureCalendar: vi.fn(async (known: string | null) => {
      if (known !== null && calendars.has(known)) return known;
      const id = `cal-${++next}`;
      calendars.add(id);
      return id;
    }),
    removeCalendar: vi.fn(async (id: string) => {
      calendars.delete(id);
      events.clear();
    }),
    createEvent: vi.fn(async (_cal: string, details) => {
      const id = `ev-${++next}`;
      events.set(id, details);
      return id;
    }),
    updateEvent: vi.fn(async (id: string, details) => {
      if (!events.has(id)) throw new Error('missing');
      events.set(id, details);
    }),
    deleteEvent: vi.fn(async (id: string) => {
      events.delete(id);
    }),
  };
  return { driver, events, calendars };
}

const ev = (key: string, date: string, title = 'Alpha5: Ganzkörper A'): TrainingCalendarEvent => ({
  key,
  title,
  date,
  startMinutes: 1080,
  durationMinutes: 60,
});

describe('createDeviceCalendar', () => {
  it('aus: sync tut nichts; einschalten fragt die Erlaubnis und trägt danach ein', async () => {
    const { driver, events } = fakeDriver();
    const calendar = createDeviceCalendar(driver, createMemoryStore());
    expect(await calendar.sync([ev('a', '2026-10-27')])).toBeNull();
    expect(driver.requestPermission).not.toHaveBeenCalled();
    expect(await calendar.enable()).toBe('enabled');
    expect(await calendar.sync([ev('a', '2026-10-27'), ev('b', '2026-10-29')])).toBe(2);
    expect([...events.values()].map((e) => e.title)).toEqual([
      'Alpha5: Ganzkörper A',
      'Alpha5: Ganzkörper A',
    ]);
  });

  it('abgelehnte Erlaubnis: bleibt aus', async () => {
    const { driver } = fakeDriver('denied');
    const store = createMemoryStore();
    const calendar = createDeviceCalendar(driver, store);
    expect(await calendar.enable()).toBe('denied');
    expect((await calendar.loadPrefs()).enabled).toBe(false);
  });

  it('Tausch/Verschieben ändert den Termin, Entfallenes wird gelöscht, nichts doppelt', async () => {
    const { driver, events } = fakeDriver();
    const calendar = createDeviceCalendar(driver, createMemoryStore());
    await calendar.enable();
    await calendar.sync([ev('a', '2026-10-27'), ev('b', '2026-10-29')]);
    await calendar.sync([ev('a', '2026-10-28', 'Alpha5: Ganzkörper B')]);
    expect(events.size).toBe(1);
    expect([...events.values()][0]?.title).toBe('Alpha5: Ganzkörper B');
    expect(driver.updateEvent).toHaveBeenCalledTimes(1);
    expect(driver.deleteEvent).toHaveBeenCalledTimes(1);
    // Gleicher Stand: keine Änderung.
    await calendar.sync([ev('a', '2026-10-28', 'Alpha5: Ganzkörper B')]);
    expect(driver.createEvent).toHaveBeenCalledTimes(2);
    expect(driver.updateEvent).toHaveBeenCalledTimes(1);
  });

  it('von Hand gelöschter Termin wird beim Ändern neu angelegt', async () => {
    const { driver, events } = fakeDriver();
    const calendar = createDeviceCalendar(driver, createMemoryStore());
    await calendar.enable();
    await calendar.sync([ev('a', '2026-10-27')]);
    events.clear();
    await calendar.sync([ev('a', '2026-10-28')]);
    expect(events.size).toBe(1);
  });

  it('gleichzeitige Abgleiche laufen nacheinander (keine doppelten Termine)', async () => {
    const { driver, events } = fakeDriver();
    const calendar = createDeviceCalendar(driver, createMemoryStore());
    await calendar.enable();
    await Promise.all([
      calendar.sync([ev('a', '2026-10-27')]),
      calendar.sync([ev('a', '2026-10-27')]),
    ]);
    expect(events.size).toBe(1);
  });

  it('ausschalten entfernt den Kalender samt Terminen, die Uhrzeit bleibt', async () => {
    const { driver, events, calendars } = fakeDriver();
    const store = createMemoryStore();
    const calendar = createDeviceCalendar(driver, store);
    await calendar.setStartMinutes(420);
    await calendar.enable();
    await calendar.sync([ev('a', '2026-10-27')]);
    await calendar.disable();
    expect(calendars.size).toBe(0);
    expect(events.size).toBe(0);
    expect(await calendar.loadPrefs()).toEqual({
      enabled: false,
      startMinutes: 420,
      calendarId: null,
      events: {},
    });
  });

  it('gespeichert werden nur Kennungen und Fingerabdrücke – kein Gesundheitsdatum', async () => {
    const { driver } = fakeDriver();
    const store = createMemoryStore();
    const calendar = createDeviceCalendar(driver, store);
    await calendar.enable();
    await calendar.sync([ev('a', '2026-10-27')]);
    const stored = JSON.parse(store.dump()[DEVICE_CALENDAR_STORE_KEY] ?? '{}');
    expect(Object.keys(stored).sort()).toEqual(['calendarId', 'enabled', 'events', 'startMinutes']);
  });

  it('Browser: nicht unterstützt', async () => {
    const { driver } = fakeDriver();
    const calendar = createDeviceCalendar({ ...driver, supported: false }, createMemoryStore());
    expect(await calendar.enable()).toBe('unsupported');
  });
});

describe('eventDetails', () => {
  it('Ortszeit: Datum + Minuten, Ende = Beginn + Dauer', () => {
    const details = eventDetails(ev('a', '2026-10-27'));
    expect(details.start.getFullYear()).toBe(2026);
    expect(details.start.getMonth()).toBe(9);
    expect(details.start.getDate()).toBe(27);
    expect(details.start.getHours()).toBe(18);
    expect(details.end.getTime() - details.start.getTime()).toBe(60 * 60 * 1000);
  });
});

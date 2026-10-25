import { describe, expect, it } from 'vitest';

import { DEVICE_CALENDAR } from '../constants';
import { addDays } from '../dates';
import {
  type CalendarSessionInput,
  calendarEventFingerprint,
  diffCalendarEvents,
  trainingCalendarEvents,
  trainingCalendarIcs,
  trainingEventKey,
  trainingStartMinutes,
} from './calendar-events';

const TODAY = '2026-10-26';

function s(
  id: string,
  date: string,
  extra: Partial<CalendarSessionInput> = {},
): CalendarSessionInput {
  return {
    id,
    scheduledOn: date,
    status: 'planned',
    kind: 'strength',
    nameDe: 'Ganzkörper A',
    estimatedMinutes: 55,
    ...extra,
  };
}

describe('trainingStartMinutes', () => {
  it('Trainingszeit aus dem Setup, „wechselnd“/keine → 18:00, gewählte Uhrzeit gewinnt', () => {
    expect(trainingStartMinutes('morning')).toBe(570);
    expect(trainingStartMinutes('varies')).toBe(DEVICE_CALENDAR.defaultStartMinutes);
    expect(trainingStartMinutes(null)).toBe(1080);
    expect(trainingStartMinutes('morning', 420)).toBe(420);
    expect(() => trainingStartMinutes(null, 1440)).toThrow();
  });
});

describe('trainingCalendarEvents', () => {
  it('nur offene Einheiten von heute bis +28 Tage; Titel „Alpha5: …“, ohne Gesundheitsangaben', () => {
    const events = trainingCalendarEvents({
      today: TODAY,
      startMinutes: 1080,
      sessions: [
        s('past', addDays(TODAY, -1)),
        s('today', TODAY),
        s('done', addDays(TODAY, 1), { status: 'completed' }),
        s('skip', addDays(TODAY, 2), { status: 'skipped' }),
        s('run', addDays(TODAY, 3), {
          kind: 'endurance',
          nameDe: 'Lockerer Dauerlauf',
          estimatedMinutes: 40,
        }),
        s('edge', addDays(TODAY, DEVICE_CALENDAR.horizonDays)),
        s('far', addDays(TODAY, DEVICE_CALENDAR.horizonDays + 1)),
        s('logged', addDays(TODAY, 4)),
      ],
      loggedSessionIds: new Set(['logged']),
    });
    expect(events.map((e) => e.key)).toEqual([
      trainingEventKey('today'),
      trainingEventKey('run'),
      trainingEventKey('edge'),
    ]);
    expect(events[0]).toEqual({
      key: 'alpha5-session-today',
      title: 'Alpha5: Ganzkörper A',
      date: TODAY,
      startMinutes: 1080,
      durationMinutes: 55,
    });
    expect(events[1]?.title).toBe('Alpha5: Lockerer Dauerlauf');
    for (const event of events) {
      expect(Object.keys(event).sort()).toEqual([
        'date',
        'durationMinutes',
        'key',
        'startMinutes',
        'title',
      ]);
    }
  });

  it('Dauer begrenzt (15–300 min, nicht über Mitternacht); leerer bzw. langer Name', () => {
    const [short, long, late, unnamed, longName] = trainingCalendarEvents({
      today: TODAY,
      startMinutes: 1380,
      sessions: [
        s('a', TODAY, { estimatedMinutes: 5 }),
        s('b', addDays(TODAY, 1), { estimatedMinutes: 600 }),
        s('c', addDays(TODAY, 2), { estimatedMinutes: null }),
        s('d', addDays(TODAY, 3), { nameDe: ' \n ', kind: 'endurance' }),
        s('e', addDays(TODAY, 4), { nameDe: 'X'.repeat(200) }),
      ],
    });
    expect(short?.durationMinutes).toBe(15);
    expect(long?.durationMinutes).toBe(60); // 23:00 + höchstens bis Mitternacht
    expect(late?.durationMinutes).toBe(60);
    expect(unnamed?.title).toBe('Alpha5: Ausdauer');
    expect(longName?.title.length).toBe(DEVICE_CALENDAR.titleMaxLength);
  });

  it('ohne Einheiten (kein Plan, 1 bzw. 7 Tage)', () => {
    expect(trainingCalendarEvents({ today: TODAY, startMinutes: 600, sessions: [] })).toEqual([]);
    const seven = Array.from({ length: 7 }, (_, i) => s(`d${i}`, addDays(TODAY, i)));
    expect(
      trainingCalendarEvents({ today: TODAY, startMinutes: 600, sessions: seven }),
    ).toHaveLength(7);
  });
});

describe('diffCalendarEvents', () => {
  const [a, b, c] = trainingCalendarEvents({
    today: TODAY,
    startMinutes: 1080,
    sessions: [s('a', TODAY), s('b', addDays(TODAY, 2)), s('c', addDays(TODAY, 4))],
  });

  it('erstes Einschalten: alles anlegen', () => {
    const diff = diffCalendarEvents([a!, b!], {});
    expect(diff.create).toHaveLength(2);
    expect(diff.update).toEqual([]);
    expect(diff.remove).toEqual([]);
  });

  it('Tausch/Verschieben ändert, Entfallenes wird gelöscht, Gleiches bleibt', () => {
    const moved = { ...b!, date: addDays(b!.date, 1) };
    const diff = diffCalendarEvents([a!, moved], {
      [a!.key]: { eventId: 'e-a', fingerprint: calendarEventFingerprint(a!) },
      [b!.key]: { eventId: 'e-b', fingerprint: calendarEventFingerprint(b!) },
      [c!.key]: { eventId: 'e-c', fingerprint: calendarEventFingerprint(c!) },
    });
    expect(diff.unchanged).toEqual([a!.key]);
    expect(diff.update).toEqual([{ eventId: 'e-b', event: moved }]);
    expect(diff.remove).toEqual([{ key: c!.key, eventId: 'e-c' }]);
    expect(diff.create).toEqual([]);
  });

  it('Ausschalten (keine gewünschten Termine): alles löschen', () => {
    const diff = diffCalendarEvents([], {
      [a!.key]: { eventId: 'e-a', fingerprint: 'x' },
    });
    expect(diff.remove).toEqual([{ key: a!.key, eventId: 'e-a' }]);
  });
});

describe('trainingCalendarIcs', () => {
  it('gültige VCALENDAR-Datei mit CRLF, Ortszeit, UID und maskiertem Titel', () => {
    const ics = trainingCalendarIcs(
      [
        {
          key: 'alpha5-session-1',
          title: 'Alpha5: Kraft, Teil; A\\B',
          date: '2026-10-27',
          startMinutes: 1080,
          durationMinutes: 75,
        },
      ],
      { stamp: '2026-10-25T10:00:00Z', name: 'Alpha5 Training' },
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:alpha5-session-1@alpha5.app\r\n');
    expect(ics).toContain('DTSTAMP:20261025T100000Z\r\n');
    expect(ics).toContain('DTSTART:20261027T180000\r\n');
    expect(ics).toContain('DTEND:20261027T191500\r\n');
    expect(ics).toContain('SUMMARY:Alpha5: Kraft\\, Teil\\; A\\\\B\r\n');
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
      true,
    );
  });

  it('faltet lange Zeilen (UTF-8, ohne Zeichen zu teilen)', () => {
    const ics = trainingCalendarIcs(
      [
        {
          key: 'k',
          title: `Alpha5: ${'Übung '.repeat(20)}`,
          date: '2026-10-27',
          startMinutes: 0,
          durationMinutes: 30,
        },
      ],
      { stamp: '2026-10-25T10:00:00Z', name: 'Alpha5 Training' },
    );
    const lines = ics.split('\r\n');
    expect(lines.some((line) => line.startsWith(' '))).toBe(true);
    expect(lines.every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain(`SUMMARY:Alpha5: ${'Übung '.repeat(20)}`);
  });

  it('ohne Termine: leerer Kalender; ungültiger Zeitstempel wirft', () => {
    expect(trainingCalendarIcs([], { stamp: '2026-10-25T10:00:00Z', name: 'A' })).not.toContain(
      'VEVENT',
    );
    expect(() => trainingCalendarIcs([], { stamp: 'gestern', name: 'A' })).toThrow();
  });
});

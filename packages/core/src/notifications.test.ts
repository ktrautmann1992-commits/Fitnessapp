import { describe, expect, it } from 'vitest';

import { MEASUREMENT_REMINDER_INTERVAL_DAYS, NOTIFICATIONS } from './constants';
import { nextMeasurementDue } from './body-measurements';
import { adjustRest, startRest } from './log/rest-timer';
import {
  daysUntilMeasurement,
  notificationSchedule,
  restEndNotificationAt,
  zonedTimeToUtcMs,
} from './notifications';

const BERLIN = 'Europe/Berlin';
const at = (iso: string) => Date.parse(iso);
const on = (date: string) => ({ enabled: true, next_due_on: date });

describe('zonedTimeToUtcMs', () => {
  it('Winterzeit (MEZ, UTC+1) und Sommerzeit (MESZ, UTC+2)', () => {
    expect(zonedTimeToUtcMs('2026-01-15', 8, 0, BERLIN)).toBe(at('2026-01-15T07:00:00Z'));
    expect(zonedTimeToUtcMs('2026-07-15', 8, 0, BERLIN)).toBe(at('2026-07-15T06:00:00Z'));
  });

  it('andere Zeitzonen (Ortszeit des Geräts)', () => {
    expect(zonedTimeToUtcMs('2026-07-15', 8, 0, 'UTC')).toBe(at('2026-07-15T08:00:00Z'));
    expect(zonedTimeToUtcMs('2026-07-15', 8, 0, 'America/New_York')).toBe(
      at('2026-07-15T12:00:00Z'),
    );
    expect(zonedTimeToUtcMs('2026-07-15', 8, 0, 'Pacific/Kiritimati')).toBe(
      at('2026-07-14T18:00:00Z'),
    );
  });

  it('Zeitumstellung: Lücke → eine Stunde später, doppelte Stunde → zweites Vorkommen (Winterzeit)', () => {
    expect(zonedTimeToUtcMs('2026-03-29', 2, 30, BERLIN)).toBe(at('2026-03-29T01:30:00Z'));
    expect(zonedTimeToUtcMs('2026-10-25', 2, 30, BERLIN)).toBe(at('2026-10-25T01:30:00Z'));
  });

  it('Jahre unter 100 werden nicht als 19xx gedeutet', () => {
    expect(new Date(zonedTimeToUtcMs('0050-06-01', 8, 0, 'UTC')).getUTCFullYear()).toBe(50);
  });

  it('Stunde 0–23, Minute 0–59', () => {
    expect(() => zonedTimeToUtcMs('2026-07-15', 24, 0, BERLIN)).toThrow();
    expect(() => zonedTimeToUtcMs('2026-07-15', 8, 60, BERLIN)).toThrow();
    expect(() => zonedTimeToUtcMs('2026-07-15', -1, 0, BERLIN)).toThrow();
    expect(() => zonedTimeToUtcMs('2026-07-15', 8.5, 0, BERLIN)).toThrow();
    expect(zonedTimeToUtcMs('2026-07-15', 23, 59, BERLIN)).toBe(at('2026-07-15T21:59:00Z'));
  });

  it('ungültiges Datum oder Zeitzone → Fehler', () => {
    expect(() => zonedTimeToUtcMs('2026-02-30', 8, 0, BERLIN)).toThrow();
    expect(() => zonedTimeToUtcMs('2026-07-15', 8, 0, 'Mars/Olympus')).toThrow(RangeError);
  });
});

describe('notificationSchedule – Mess-Erinnerung (PLAN-PHASE-4B Abschnitt 7)', () => {
  const now = at('2026-10-18T10:00:00Z');

  it('Fälligkeitstag um 08:00 Ortszeit', () => {
    expect(notificationSchedule(on('2026-11-15'), now, BERLIN, true)).toBe(
      at('2026-11-15T07:00:00Z'),
    );
    expect(NOTIFICATIONS.measurementHour).toBe(8);
  });

  it('Sommerzeit: Umstellung März (29.03.2026) – 08:00 MESZ = 06:00 UTC', () => {
    const before = at('2026-03-20T09:00:00Z');
    expect(notificationSchedule(on('2026-03-28'), before, BERLIN, true)).toBe(
      at('2026-03-28T07:00:00Z'),
    );
    expect(notificationSchedule(on('2026-03-29'), before, BERLIN, true)).toBe(
      at('2026-03-29T06:00:00Z'),
    );
    expect(notificationSchedule(on('2026-03-30'), before, BERLIN, true)).toBe(
      at('2026-03-30T06:00:00Z'),
    );
  });

  it('Sommerzeit: Umstellung Oktober (25.10.2026) – 08:00 MEZ = 07:00 UTC', () => {
    expect(notificationSchedule(on('2026-10-24'), now, BERLIN, true)).toBe(
      at('2026-10-24T06:00:00Z'),
    );
    expect(notificationSchedule(on('2026-10-25'), now, BERLIN, true)).toBe(
      at('2026-10-25T07:00:00Z'),
    );
  });

  it('heute fällig und noch vor 08:00 → heute 08:00', () => {
    const early = at('2026-10-18T05:59:00Z'); // 07:59 MESZ
    expect(notificationSchedule(on('2026-10-18'), early, BERLIN, true)).toBe(
      at('2026-10-18T06:00:00Z'),
    );
  });

  it('Festlegung: heute fällig, 08:00 schon vorbei → einmalig nächster Morgen 08:00 (nicht sofort)', () => {
    const exactly = at('2026-10-18T06:00:00Z'); // genau 08:00 → gilt als vorbei
    expect(notificationSchedule(on('2026-10-18'), exactly, BERLIN, true)).toBe(
      at('2026-10-19T06:00:00Z'),
    );
    expect(notificationSchedule(on('2026-10-18'), now, BERLIN, true)).toBe(
      at('2026-10-19T06:00:00Z'),
    );
    // Tag danach vor 08:00 (z. B. Neustart): dieselbe Nachhol-Erinnerung bleibt geplant.
    expect(notificationSchedule(on('2026-10-17'), at('2026-10-18T05:00:00Z'), BERLIN, true)).toBe(
      at('2026-10-18T06:00:00Z'),
    );
  });

  it('je Termin höchstens EINE Benachrichtigung – unabhängig vom Kaltstart (Wächter M2)', () => {
    const due = '2026-10-18';
    const dueAt = at('2026-10-18T06:00:00Z');
    // Start vor 08:00 → 08:00 geplant und gemerkt.
    expect(notificationSchedule(on(due), at('2026-10-18T05:00:00Z'), BERLIN, true)).toBe(dueAt);
    // Neustart um 12:00 nach der Zustellung → KEINE Nachhol-Erinnerung mehr.
    expect(
      notificationSchedule(on(due), now, BERLIN, true, { dueOn: due, atMs: dueAt }),
    ).toBeNull();
    // Noch nicht zugestellt → derselbe Zeitpunkt bleibt.
    expect(
      notificationSchedule(on(due), at('2026-10-18T05:30:00Z'), BERLIN, true, {
        dueOn: due,
        atMs: dueAt,
      }),
    ).toBe(dueAt);
    // Geplante Nachhol-Erinnerung bleibt beim Start am Folgetag vor 08:00 erhalten.
    const lateAt = at('2026-10-19T06:00:00Z');
    expect(
      notificationSchedule(on(due), at('2026-10-19T05:00:00Z'), BERLIN, true, {
        dueOn: due,
        atMs: lateAt,
      }),
    ).toBe(lateAt);
    // Neuer Termin (neue Messung) → gemerkter alter Termin zählt nicht.
    expect(
      notificationSchedule(on('2026-11-15'), now, BERLIN, true, { dueOn: due, atMs: dueAt }),
    ).toBe(at('2026-11-15T07:00:00Z'));
    // Ohne Einwilligung bleibt es null, auch mit gemerktem Termin.
    expect(
      notificationSchedule(on('2026-11-15'), now, BERLIN, false, {
        dueOn: '2026-11-15',
        atMs: at('2026-11-15T07:00:00Z'),
      }),
    ).toBeNull();
  });

  it('länger überfällig → keine Benachrichtigung (Hinweis auf „Heute“ bleibt)', () => {
    expect(notificationSchedule(on('2026-10-17'), now, BERLIN, true)).toBeNull();
    expect(notificationSchedule(on('2026-09-01'), now, BERLIN, true)).toBeNull();
  });

  it('enabled = false → null', () => {
    expect(
      notificationSchedule({ enabled: false, next_due_on: '2026-11-15' }, now, BERLIN, true),
    ).toBeNull();
  });

  it('ohne gültige health_data-Einwilligung → null (Wächter S5), auch wenn enabled', () => {
    expect(notificationSchedule(on('2026-11-15'), now, BERLIN, false)).toBeNull();
  });

  it('ohne Erinnerung oder ohne Termin (noch keine Messung) → null', () => {
    expect(notificationSchedule(null, now, BERLIN, true)).toBeNull();
    expect(
      notificationSchedule({ enabled: true, next_due_on: null }, now, BERLIN, true),
    ).toBeNull();
  });

  it('Abstand 7 bzw. 90 Tage ab Messung', () => {
    const { min, max } = MEASUREMENT_REMINDER_INTERVAL_DAYS;
    expect(min).toBe(7);
    expect(max).toBe(90);
    expect(notificationSchedule(on(nextMeasurementDue('2026-10-18', min)), now, BERLIN, true)).toBe(
      at('2026-10-25T07:00:00Z'),
    ); // nach der Umstellung: MEZ
    expect(notificationSchedule(on(nextMeasurementDue('2026-10-18', max)), now, BERLIN, true)).toBe(
      at('2027-01-16T07:00:00Z'),
    );
  });

  it('Jahreswechsel und Schaltjahr', () => {
    expect(notificationSchedule(on('2027-01-01'), now, BERLIN, true)).toBe(
      at('2027-01-01T07:00:00Z'),
    );
    expect(notificationSchedule(on('2028-02-29'), now, BERLIN, true)).toBe(
      at('2028-02-29T07:00:00Z'),
    );
  });

  it('ungültige Eingaben → Fehler (Zod an der Grenze)', () => {
    expect(() =>
      notificationSchedule({ enabled: true, next_due_on: '18.10.2026' }, now, BERLIN, true),
    ).toThrow();
    expect(() => notificationSchedule(on('2026-11-15'), Number.NaN, BERLIN, true)).toThrow();
    expect(() => notificationSchedule(on('2026-11-15'), now, 'Nirgendwo', true)).toThrow(
      RangeError,
    );
  });
});

describe('restEndNotificationAt – Pausenende', () => {
  it('Ende der laufenden Pause (Start + Dauer)', () => {
    const timer = startRest(90, 1_000_000);
    expect(restEndNotificationAt(timer, 1_000_000)).toBe(1_090_000);
    expect(restEndNotificationAt(timer, 1_030_000)).toBe(1_090_000);
  });

  it('±15 s verschiebt das Ende', () => {
    const timer = startRest(90, 0);
    expect(restEndNotificationAt(adjustRest(timer, 15), 10_000)).toBe(105_000);
    expect(restEndNotificationAt(adjustRest(timer, -15), 10_000)).toBe(75_000);
  });

  it('Pause schon vorbei bzw. 0 s → null', () => {
    const timer = startRest(90, 0);
    expect(restEndNotificationAt(timer, 90_000)).toBeNull();
    expect(restEndNotificationAt(timer, 600_000)).toBeNull();
    expect(restEndNotificationAt(startRest(0, 0), 0)).toBeNull();
    expect(restEndNotificationAt(adjustRest(timer, -90), 1_000)).toBeNull();
  });

  it('weniger als die Mindest-Vorlaufzeit übrig → null', () => {
    const timer = startRest(15, 0);
    expect(restEndNotificationAt(timer, 15_000 - NOTIFICATIONS.restEndMinLeadMs)).toBe(15_000);
    expect(restEndNotificationAt(timer, 15_000 - NOTIFICATIONS.restEndMinLeadMs + 1)).toBeNull();
  });

  it('längste Pause (600 s)', () => {
    expect(restEndNotificationAt(startRest(900, 0), 0)).toBe(600_000);
  });

  it('ungültiger Zeitpunkt → Fehler', () => {
    expect(() => restEndNotificationAt(startRest(60, 0), Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe('daysUntilMeasurement – Angebot „in N Tagen“', () => {
  it('Tage bis zum Termin, sonst null', () => {
    expect(daysUntilMeasurement('2026-11-15', '2026-10-18')).toBe(28);
    expect(daysUntilMeasurement('2026-10-25', '2026-10-18')).toBe(7);
    expect(daysUntilMeasurement('2026-10-19', '2026-10-18')).toBe(1);
    expect(daysUntilMeasurement('2026-10-18', '2026-10-18')).toBeNull();
    expect(daysUntilMeasurement('2026-10-01', '2026-10-18')).toBeNull();
    expect(daysUntilMeasurement(null, '2026-10-18')).toBeNull();
  });
});

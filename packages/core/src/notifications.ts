import { z } from 'zod';

import { isoDateSchema } from './age';
import { NOTIFICATIONS } from './constants';
import { addDays, daysBetween } from './dates';
import { remainingSeconds, type RestTimer } from './log/rest-timer';

/**
 * Lokale Benachrichtigungen (docs/PLAN-PHASE-4B.md Abschnitt 7, Etappe E): nur die Zeitrechnung – WANN eine
 * Benachrichtigung kommt. Planen und Stornieren übernimmt die App (expo-notifications, im Browser nichts).
 * Texte stehen fest in der App und enthalten nie Werte (DSGVO Art. 9).
 */

/** Teil von `measurement_reminders`, der für die Benachrichtigung zählt. */
export const measurementReminderScheduleSchema = z.object({
  enabled: z.boolean(),
  next_due_on: isoDateSchema.nullable(),
});

export type MeasurementReminderSchedule = z.infer<typeof measurementReminderScheduleSchema>;

const nowSchema = z.number().finite();

/** Prüft eine IANA-Zeitzone (z. B. „Europe/Berlin“); ungültig → RangeError. */
function assertTimeZone(timeZone: string): void {
  if (timeZone.trim() === '') throw new RangeError('Zeitzone fehlt.');
  // Wirft RangeError bei unbekannter Zeitzone.
  new Intl.DateTimeFormat('en-US', { timeZone });
}

/** Abstand der Zeitzone zu UTC in Millisekunden zum Zeitpunkt `utcMs` (Sommerzeit inklusive). */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = utcWallMs(
    get('year'),
    get('month'),
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wanduhr-Zeit als UTC-ms. `setUTCFullYear`, weil `Date.UTC` die Jahre 0–99 als 1900–1999 deutet. */
function utcWallMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
}

const hourSchema = z.number().int().min(0).max(23);
const minuteSchema = z.number().int().min(0).max(59);

/**
 * Zeitpunkt (ms seit 1970, UTC) einer Uhrzeit an einem Kalendertag in einer Zeitzone. Zwei Durchläufe, damit der
 * Abstand an Tagen mit Zeitumstellung stimmt. Stunde 0–23, Minute 0–59 (Zod).
 * Zeitumstellung: Eine NICHT existierende Uhrzeit (Lücke, Europe/Berlin Ende März 02:00–02:59) ergibt den Zeitpunkt
 * eine Stunde später (03:xx Sommerzeit); eine DOPPELTE Uhrzeit (Ende Oktober 02:00–02:59) ergibt das zweite
 * Vorkommen (Winterzeit). Für die Mess-Erinnerung um 08:00 spielt beides keine Rolle.
 */
export function zonedTimeToUtcMs(
  date: string,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const [y, m, d] = isoDateSchema.parse(date).split('-').map(Number) as [number, number, number];
  hourSchema.parse(hour);
  minuteSchema.parse(minute);
  assertTimeZone(timeZone);
  const wall = utcWallMs(y, m, d, hour, minute);
  const first = wall - zoneOffsetMs(wall, timeZone);
  return wall - zoneOffsetMs(first, timeZone);
}

/** Zuletzt geplante Mess-Erinnerung (auf dem Gerät gemerkt): für welchen Termin und zu welchem Zeitpunkt. */
export const scheduledMeasurementSchema = z.object({
  dueOn: isoDateSchema,
  atMs: z.number().finite(),
});

export type ScheduledMeasurement = z.infer<typeof scheduledMeasurementSchema>;

/**
 * Zeitpunkt der Mess-Erinnerung (ms) oder null = keine planen (bzw. eine geplante stornieren).
 *
 * - `null` ohne Erinnerung, bei `enabled = false`, ohne Fälligkeitsdatum und **ohne gültige `health_data`-
 *   Einwilligung** (Wächter S5: ohne Einwilligung kann man nicht messen).
 * - Wurde für DIESEN Termin schon einmal geplant (`alreadyScheduled.dueOn === next_due_on`): derselbe Zeitpunkt,
 *   solange er bevorsteht, sonst null. So hängt die Nachhol-Erinnerung nicht davon ab, wann die App startet – je Termin
 *   gibt es höchstens EINE Benachrichtigung (Wächter E, M2).
 * - Sonst (erstes Planen für diesen Termin) der Fälligkeitstag um 08:00 Ortszeit (`timeZone`), wenn das noch bevorsteht.
 * - Fälligkeit heute, aber 08:00 schon vorbei (oder gestern fällig und heute noch vor 08:00): einmalig am nächsten
 *   Morgen um 08:00 (NOTIFICATIONS.measurementLateDays). Nicht „sofort“ – wer gerade die App öffnet, sieht den Hinweis
 *   auf „Heute“ ohnehin.
 * - Noch länger überfällig: null (kein tägliches Nachhaken; der Hinweis auf „Heute“ bleibt).
 *
 * `nowMs` ist der aktuelle Zeitpunkt (statt nur „heute“), weil „08:00 schon vorbei?“ die Uhrzeit braucht.
 */
export function notificationSchedule(
  reminder: MeasurementReminderSchedule | null,
  nowMs: number,
  timeZone: string,
  healthConsentValid: boolean,
  alreadyScheduled: ScheduledMeasurement | null = null,
): number | null {
  nowSchema.parse(nowMs);
  assertTimeZone(timeZone);
  if (!healthConsentValid || reminder === null) return null;
  const parsed = measurementReminderScheduleSchema.parse(reminder);
  if (!parsed.enabled || parsed.next_due_on === null) return null;
  const previous = alreadyScheduled ? scheduledMeasurementSchema.parse(alreadyScheduled) : null;
  if (previous && previous.dueOn === parsed.next_due_on) {
    return previous.atMs > nowMs ? previous.atMs : null;
  }
  for (let late = 0; late <= NOTIFICATIONS.measurementLateDays; late += 1) {
    const at = zonedTimeToUtcMs(
      addDays(parsed.next_due_on, late),
      NOTIFICATIONS.measurementHour,
      NOTIFICATIONS.measurementMinute,
      timeZone,
    );
    if (at > nowMs) return at;
  }
  return null;
}

/**
 * Tage bis zur nächsten Messung (für das Angebot „Sollen wir dich in N Tagen erinnern?“), null ohne Termin oder wenn
 * er heute oder schon vorbei ist.
 */
export function daysUntilMeasurement(nextDueOn: string | null, today: string): number | null {
  if (nextDueOn === null) return null;
  const days = daysBetween(today, nextDueOn);
  return days > 0 ? days : null;
}

/**
 * Zeitpunkt (ms) der Benachrichtigung „Pause vorbei“ für eine laufende Pause, oder null, wenn die Pause schon vorbei
 * ist bzw. weniger als NOTIFICATIONS.restEndMinLeadMs übrig sind. Grundlage sind die Zeitstempel aus `rest-timer.ts`
 * (Start + Dauer), d. h. nach „±15 s“ einfach neu aufrufen.
 */
export function restEndNotificationAt(timer: RestTimer, nowMs: number): number | null {
  nowSchema.parse(nowMs);
  if (remainingSeconds(timer, nowMs) === 0) return null;
  const endMs = timer.startedAtMs + timer.durationS * 1000;
  return endMs - nowMs >= NOTIFICATIONS.restEndMinLeadMs ? endMs : null;
}

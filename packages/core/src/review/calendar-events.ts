import { z } from 'zod';

import { isoDateSchema } from '../age';
import { DEVICE_CALENDAR, TRAINING_TIME_START_MINUTES } from '../constants';
import { addDays } from '../dates';
import type { PlannedSessionKind, PlannedSessionStatus, TrainingTime } from '../enums';

/**
 * Trainings im Handy-Kalender (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 4, Gründer-Freigabe 25.10.2026, opt-in).
 * Reine Funktionen: geplante Einheiten → Kalender-Termine, Abgleich mit den schon eingetragenen Terminen und eine
 * .ics-Datei für den Browser.
 *
 * Datenschutz: Ein Termin enthält NUR „Alpha5: <Name der Einheit>“, Datum, Uhrzeit und Dauer – keine Gesundheitsangaben,
 * keine Gründe, keine Hinweise, keine Notizen, keine Orte (der Kalender kann mit anderen Diensten synchronisiert werden).
 */

export interface CalendarSessionInput {
  readonly id: string;
  readonly scheduledOn: string;
  readonly status: PlannedSessionStatus | 'completed';
  readonly kind: PlannedSessionKind;
  readonly nameDe: string;
  readonly estimatedMinutes: number | null;
}

export interface TrainingCalendarEvent {
  /** Stabiler Schlüssel je Einheit (Abgleich, UID der .ics-Datei). */
  readonly key: string;
  readonly title: string;
  readonly date: string;
  /** Beginn in Minuten nach Mitternacht (Ortszeit des Geräts). */
  readonly startMinutes: number;
  readonly durationMinutes: number;
}

const minutesSchema = z
  .number()
  .int()
  .min(0)
  .max(24 * 60 - 1);

/** Beginn: Trainingszeit aus dem Ernährungs-Setup; „wechselnd“ bzw. keine Angabe → gewählte Uhrzeit (Standard 18:00). */
export function trainingStartMinutes(
  trainingTime: TrainingTime | null,
  chosen: number | null = null,
): number {
  if (chosen !== null) return minutesSchema.parse(chosen);
  if (trainingTime === null || trainingTime === 'varies')
    return DEVICE_CALENDAR.defaultStartMinutes;
  return TRAINING_TIME_START_MINUTES[trainingTime];
}

/** Steuerzeichen raus, Leerraum zusammenfassen, Länge begrenzen. */
function cleanName(name: string, kind: PlannedSessionKind): string {
  const cleaned = name
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const base = cleaned === '' ? (kind === 'strength' ? 'Krafttraining' : 'Ausdauer') : cleaned;
  const max = DEVICE_CALENDAR.titleMaxLength - DEVICE_CALENDAR.titlePrefix.length;
  return base.length > max ? `${base.slice(0, max - 1)}…` : base;
}

export function trainingEventKey(sessionId: string): string {
  return `alpha5-session-${sessionId}`;
}

/**
 * Termine aus den Einheiten des AKTIVEN Plans: nur offene (`planned`) Einheiten von heute bis heute +
 * DEVICE_CALENDAR.horizonDays; erledigte und gestrichene fallen weg (werden beim Abgleich entfernt). Sortiert nach
 * Datum, dann Schlüssel.
 */
export function trainingCalendarEvents(input: {
  readonly sessions: readonly CalendarSessionInput[];
  readonly today: string;
  readonly startMinutes: number;
  /** Einheiten mit Eintrag (auch wenn der Status noch `planned` ist) – nicht mehr in den Kalender. */
  readonly loggedSessionIds?: ReadonlySet<string>;
}): TrainingCalendarEvent[] {
  const today = isoDateSchema.parse(input.today);
  const start = minutesSchema.parse(input.startMinutes);
  const until = addDays(today, DEVICE_CALENDAR.horizonDays);
  return input.sessions
    .filter(
      (s) =>
        s.status === 'planned' &&
        s.scheduledOn >= today &&
        s.scheduledOn <= until &&
        !input.loggedSessionIds?.has(s.id),
    )
    .map((s) => {
      const estimated = s.estimatedMinutes ?? 60;
      const duration = Math.min(
        DEVICE_CALENDAR.maxDurationMinutes,
        Math.max(DEVICE_CALENDAR.minDurationMinutes, Math.round(estimated)),
        // Nicht über Mitternacht hinaus.
        24 * 60 - start,
      );
      return {
        key: trainingEventKey(s.id),
        title: `${DEVICE_CALENDAR.titlePrefix}${cleanName(s.nameDe, s.kind)}`,
        date: isoDateSchema.parse(s.scheduledOn),
        startMinutes: start,
        durationMinutes: Math.max(1, duration),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

/** Fingerabdruck eines Termins: ändert er sich, wird der Termin im Kalender aktualisiert. */
export function calendarEventFingerprint(event: TrainingCalendarEvent): string {
  return [event.title, event.date, event.startMinutes, event.durationMinutes].join('|');
}

export interface StoredCalendarEvent {
  /** Kennung des Termins im Kalender des Geräts. */
  readonly eventId: string;
  readonly fingerprint: string;
}

export interface CalendarEventDiff {
  readonly create: readonly TrainingCalendarEvent[];
  readonly update: readonly { readonly eventId: string; readonly event: TrainingCalendarEvent }[];
  readonly remove: readonly { readonly key: string; readonly eventId: string }[];
  readonly unchanged: readonly string[];
}

/** Abgleich: neue Termine anlegen, geänderte (Tausch, Verschieben, Name) ändern, entfallene löschen. */
export function diffCalendarEvents(
  desired: readonly TrainingCalendarEvent[],
  stored: Readonly<Record<string, StoredCalendarEvent>>,
): CalendarEventDiff {
  const create: TrainingCalendarEvent[] = [];
  const update: { eventId: string; event: TrainingCalendarEvent }[] = [];
  const unchanged: string[] = [];
  const wanted = new Set<string>();
  for (const event of desired) {
    wanted.add(event.key);
    const existing = stored[event.key];
    if (!existing) create.push(event);
    else if (existing.fingerprint !== calendarEventFingerprint(event)) {
      update.push({ eventId: existing.eventId, event });
    } else unchanged.push(event.key);
  }
  const remove = Object.entries(stored)
    .filter(([key]) => !wanted.has(key))
    .map(([key, value]) => ({ key, eventId: value.eventId }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return { create, update, remove, unchanged };
}

// ---------------------------------------------------------------------------------------------------------
// .ics (RFC 5545) für den Browser
// ---------------------------------------------------------------------------------------------------------

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Zeilen über 75 Byte (UTF-8) falten: CRLF + Leerzeichen (RFC 5545 3.1); Zeichen werden nie zerteilt. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function localDateTime(date: string, minutes: number): string {
  const day = addDays(date, Math.floor(minutes / (24 * 60)));
  const rest = minutes % (24 * 60);
  const hh = String(Math.floor(rest / 60)).padStart(2, '0');
  const mm = String(rest % 60).padStart(2, '0');
  return `${day.replace(/-/g, '')}T${hh}${mm}00`;
}

/**
 * Kalender-Datei mit den Terminen (Ortszeit ohne Zeitzone = „floating“, gilt in der Zeitzone des Kalenders – passend
 * zu Trainings, die man vor Ort um 18 Uhr macht). `stamp` = Erstellzeitpunkt (ISO), `name` = Kalendername.
 */
export function trainingCalendarIcs(
  events: readonly TrainingCalendarEvent[],
  options: { readonly stamp: string; readonly name: string },
): string {
  const stamp = new Date(options.stamp);
  if (Number.isNaN(stamp.getTime())) throw new RangeError('Ungültiger Zeitstempel.');
  const dtstamp = `${stamp.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Alpha5//Training//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(options.name)}`,
  ];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.key}@alpha5.app`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${localDateTime(event.date, event.startMinutes)}`,
      `DTEND:${localDateTime(event.date, event.startMinutes + event.durationMinutes)}`,
      `SUMMARY:${icsEscape(event.title)}`,
      'TRANSP:OPAQUE',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

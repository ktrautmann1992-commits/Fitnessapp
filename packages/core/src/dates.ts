import { isoDateSchema } from './age';
import { AGE_CHECK_TIME_ZONE, BIRTH_DATE_MIN, MEASURED_ON_MAX_DAYS_AHEAD } from './constants';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** ISO-Datum + n Tage (kalendarisch in UTC, daher unabhängig von Sommerzeit). */
export function addDays(date: string, days: number): string {
  const start = Date.parse(`${isoDateSchema.parse(date)}T00:00:00Z`);
  return new Date(start + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Messdatum: gültiges Datum ab 1900, höchstens MEASURED_ON_MAX_DAYS_AHEAD Tag(e) nach `today`
 * (gleiche Regel wie der Datenbank-Trigger private.check_measured_on).
 */
export function createMeasuredOnSchema(today: string) {
  const latest = addDays(today, MEASURED_ON_MAX_DAYS_AHEAD);
  return isoDateSchema
    .refine((date) => date >= BIRTH_DATE_MIN, 'Bitte ein gültiges Datum eingeben.')
    .refine((date) => date <= latest, 'Das Messdatum liegt in der Zukunft.');
}

/** Wochentag nach ISO 8601: 1 = Montag … 7 = Sonntag. */
export function isoWeekday(date: string): number {
  const day = new Date(`${isoDateSchema.parse(date)}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Montag der ISO-Woche, in der `date` liegt. */
export function startOfIsoWeek(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

/**
 * Kalenderwoche nach ISO 8601 (Woche mit dem ersten Donnerstag des Jahres = KW 1; Montag ist Wochenbeginn) – so wie
 * in Deutschland, Österreich und der Schweiz üblich. Beispiel: 2026-10-12 → 42, 2021-01-03 → 53 (Woche aus 2020).
 */
export function isoWeekNumber(date: string): number {
  const thursday = addDays(date, 4 - isoWeekday(date));
  const yearStart = `${thursday.slice(0, 4)}-01-01`;
  return Math.floor(daysBetween(yearStart, thursday) / 7) + 1;
}

/** Tage von `from` bis `to` (negativ, wenn `to` davor liegt). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${isoDateSchema.parse(from)}T00:00:00Z`);
  const b = Date.parse(`${isoDateSchema.parse(to)}T00:00:00Z`);
  return Math.round((b - a) / MS_PER_DAY);
}

/**
 * Kalenderdatum (JJJJ-MM-TT) eines Zeitstempels in einer Zeitzone – Standard Europe/Berlin
 * (AGE_CHECK_TIME_ZONE, wie der Stichtag der Datenbank). Ungültige Zeitstempel → RangeError.
 */
export function isoDateInTimeZone(
  timestamp: string,
  timeZone: string = AGE_CHECK_TIME_ZONE,
): string {
  const time = Date.parse(timestamp);
  if (Number.isNaN(time)) {
    throw new RangeError('Ungültiger Zeitstempel.');
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(time));
  const part = (type: 'year' | 'month' | 'day') => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * Wanduhr eines Zeitpunkts in einer Zeitzone (Standard Europe/Berlin, Sommerzeit inklusive): Kalenderdatum und
 * Minuten nach Mitternacht (0–1439). `timestamp` als ISO-Zeitstempel oder Millisekunden. Ungültig → RangeError.
 */
export function wallClockInTimeZone(
  timestamp: string | number,
  timeZone: string = AGE_CHECK_TIME_ZONE,
): { readonly date: string; readonly minutes: number } {
  const time = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp);
  if (!Number.isFinite(time)) {
    throw new RangeError('Ungültiger Zeitstempel.');
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(time));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  // Manche Laufzeiten liefern um Mitternacht „24“ statt „00“ – auf 0 abbilden.
  const hour = Number(part('hour')) % 24;
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    minutes: hour * 60 + Number(part('minute')),
  };
}

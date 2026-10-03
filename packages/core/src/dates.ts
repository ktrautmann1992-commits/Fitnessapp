import { isoDateSchema } from './age';
import { BIRTH_DATE_MIN, MEASURED_ON_MAX_DAYS_AHEAD } from './constants';

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

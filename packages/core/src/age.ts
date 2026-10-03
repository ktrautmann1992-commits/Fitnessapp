import { z } from 'zod';

import { MIN_AGE_YEARS } from './constants';

/** ISO-Datum im Format JJJJ-MM-TT, z. B. „1990-05-17“. */
export const isoDateSchema = z.iso.date();

function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const parsed = isoDateSchema.parse(value);
  const [year, month, day] = parsed.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

/**
 * Alter in vollendeten Jahren an einem Stichtag.
 * Rein kalendarisch (ohne Zeitzonen), damit das Ergebnis überall gleich ist.
 * Wer am 29. Februar geboren ist, wird in Nicht-Schaltjahren am 1. März ein Jahr älter.
 */
export function ageInYears(birthDate: string, onDate: string): number {
  const birth = parseIsoDate(birthDate);
  const today = parseIsoDate(onDate);
  if (onDate < birthDate) {
    throw new RangeError('Das Geburtsdatum liegt nach dem Stichtag.');
  }
  let age = today.year - birth.year;
  const hadBirthdayThisYear =
    today.month > birth.month || (today.month === birth.month && today.day >= birth.day);
  if (!hadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}

/** Prüft das Mindestalter aus `constants.ts` (nicht abschaltbar). */
export function meetsMinimumAge(birthDate: string, onDate: string): boolean {
  return ageInYears(birthDate, onDate) >= MIN_AGE_YEARS;
}

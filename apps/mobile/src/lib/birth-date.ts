import { ageInYears, createBirthDateSchema, isoDateSchema, MIN_AGE_YEARS } from '@fitnessapp/core';

import { isoFromDateParts } from './format';

export type BirthDateCheck =
  | { kind: 'ok'; birthDate: string }
  | { kind: 'too_young' }
  | { kind: 'incomplete' }
  | { kind: 'invalid'; message: string };

/**
 * Prüft die Eingabe im Schritt „Alter“ mit createBirthDateSchema aus packages/core.
 * „too_young“ führt zur Stopp-Seite – dabei wird nichts gespeichert.
 */
export function checkBirthDate(
  parts: { day: string; month: string; year: string },
  today: string,
): BirthDateCheck {
  const iso = isoFromDateParts(parts.day, parts.month, parts.year);
  if (iso === null) {
    return { kind: 'incomplete' };
  }
  const result = createBirthDateSchema(today).safeParse(iso);
  if (result.success) {
    return { kind: 'ok', birthDate: result.data };
  }
  if (!isoDateSchema.safeParse(iso).success) {
    return { kind: 'invalid', message: 'Bitte ein gültiges Datum eingeben.' };
  }
  if (iso <= today && ageInYears(iso, today) < MIN_AGE_YEARS) {
    return { kind: 'too_young' };
  }
  return {
    kind: 'invalid',
    message: result.error.issues[0]?.message ?? 'Bitte ein gültiges Datum eingeben.',
  };
}

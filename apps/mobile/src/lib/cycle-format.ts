import { CycleError } from '@/data/cycle-backend';
import { deCycle as C } from '@/i18n/de-cycle';

/** Fester Fehlertext des Zyklus-Moduls (nie Inhalte). */
export function cycleErrorText(error: unknown): string {
  const code = error instanceof CycleError ? error.code : 'unknown';
  return C.errors[code];
}

/** „21.10.“ – kurzes Datum für den Verlauf (ohne Jahr). */
export function shortDateDe(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}.${month}.`;
}

import { LIVE_ADJUSTMENT } from '../../constants';
import { addDays, daysBetween } from '../../dates';
import { entriesForExercise, isCountingEntry } from '../../log/progression';
import type { LiveExerciseEntry } from '../inputs';
import type { ActiveAdjustmentRule, StoredAdjustment } from '../types';

/** Gemeinsame Helfer der Regeln (docs/PLAN-PHASE-4B.md 5.2 „Allgemein für alle Regeln“). */

/** Wirksame Anpassungen (angewandt bzw. bestätigt). */
export const isEffective = (a: Pick<StoredAdjustment, 'status'>) =>
  a.status === 'applied' || a.status === 'confirmed';

/** Datum (ISO) eines Zeitstempels. */
export const dateOf = (timestamp: string) => timestamp.slice(0, 10);

/**
 * Ruhezeit nach „Rückgängig“ (LIVE_ADJUSTMENT.cooldownDaysAfterRevert): dieselbe Regel feuert für dieselbe Übung bzw.
 * Einheit 14 Tage nicht erneut.
 */
export function inRevertCooldown(
  adjustments: readonly StoredAdjustment[],
  rule: ActiveAdjustmentRule,
  today: string,
  match: (a: StoredAdjustment) => boolean,
): boolean {
  return adjustments.some(
    (a) =>
      a.rule === rule &&
      a.status === 'reverted' &&
      match(a) &&
      daysBetween(dateOf(a.decidedAt ?? a.createdAt), today) <
        LIVE_ADJUSTMENT.cooldownDaysAfterRevert,
  );
}

/** Zählende Einträge einer Übung (ohne Einstiegs-/Erholungswoche, Wiedereinstieg, freie Einheit), älteste zuerst. */
export function countingEntriesFor(
  exerciseId: string,
  entries: readonly LiveExerciseEntry[],
): LiveExerciseEntry[] {
  return (entriesForExercise(exerciseId, entries) as LiveExerciseEntry[]).filter(isCountingEntry);
}

/** ID der Einheit des neuesten zählenden Eintrags einer Übung (Basis einer Zustands-Vorgabe); null = keiner. */
export function latestCountingSessionLogId(
  exerciseId: string,
  entries: readonly LiveExerciseEntry[],
): string | null {
  return countingEntriesFor(exerciseId, entries).at(-1)?.sessionLogId ?? null;
}

/** Fenster der letzten `days` Tage bis heute (einschließlich). */
export const withinDays = (date: string, today: string, days: number) =>
  date <= today && date > addDays(today, -days);

import type { MealPlanWeek, ShoppingListChanges, TrainingAdaptation } from '@fitnessapp/core';
import { useSyncExternalStore } from 'react';

/**
 * Nährstoff-Timing (docs/PLAN-NAEHRSTOFF-TIMING.md 6): Rückmeldung „Mahlzeiten an dein Training angepasst ·
 * Rückgängig“. Nach dem Speichern ist der angepasste Plan der gespeicherte – was getauscht wurde und der Plan davor (für
 * „Rückgängig“) stehen deshalb hier, NUR im Arbeitsspeicher (nie gespeichert, nie geloggt), je Woche höchstens ein
 * Eintrag. „Verstanden“, „Rückgängig“ oder ein Neustart der App entfernen ihn.
 */
export interface TrainingAdjustmentEntry {
  readonly weekStart: string;
  readonly previous: MealPlanWeek;
  readonly adaptation: TrainingAdaptation;
  readonly shopping: ShoppingListChanges | null;
}

let entries: ReadonlyMap<string, TrainingAdjustmentEntry> = new Map();
const listeners = new Set<() => void>();

function emit(next: ReadonlyMap<string, TrainingAdjustmentEntry>) {
  entries = next;
  listeners.forEach((l) => l());
}

export function setTrainingAdjustment(entry: TrainingAdjustmentEntry): void {
  const next = new Map(entries);
  next.set(entry.weekStart, entry);
  emit(next);
}

export function clearTrainingAdjustment(weekStart: string): void {
  if (!entries.has(weekStart)) return;
  const next = new Map(entries);
  next.delete(weekStart);
  emit(next);
}

export function useTrainingAdjustment(weekStart: string | null): TrainingAdjustmentEntry | null {
  const all = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => entries,
    () => entries,
  );
  return weekStart === null ? null : (all.get(weekStart) ?? null);
}

/** Nur Tests. */
export function resetTrainingAdjustmentsForTests(): void {
  entries = new Map();
}

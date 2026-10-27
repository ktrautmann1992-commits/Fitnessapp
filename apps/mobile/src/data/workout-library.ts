import {
  type ContentFile,
  validateContent,
  type Workout,
  type WorkoutContentFile,
  WORKOUT_LIST_DRAFT_CATEGORIES,
  workoutSchema,
} from '@fitnessapp/core';

import type { UserRows } from './types';

/**
 * Workout-Bibliothek in der App (docs/PLAN-WORKOUTS.md Abschnitt 4): Quellen abbilden und prüfen – Regeln und
 * Rechnen liegen in packages/core. Rein und getestet (workout-library.test.ts).
 */

/**
 * Testmodus: Workouts aus dem Bündel, geprüft mit denselben Regeln wie content:validate (gegen die gebündelten
 * Übungen). Nur freigegebene ohne blockierenden Befund – wie der Seed, der nur so etwas einspielt. Ausnahme: Entwürfe
 * der Kategorie „Lauf-Kraft“ (docs/PLAN-CALISTHENICS-SCHLINGE.md 4) – sie hängen am Laufplan und sollen im Testmodus
 * prüfbar sein; die App kennzeichnet sie als „Testinhalt“ (wie Übungs-Entwürfe). Ebenso Entwürfe aus
 * WORKOUT_LIST_DRAFT_CATEGORIES (Etappe R: Rudern) – sie stehen dann auch in der Liste. Im Supabase-Modus nie (RLS).
 */
export function workoutsFromBundle(
  files: readonly ContentFile[],
  workoutFiles: readonly WorkoutContentFile[],
): Workout[] {
  const exerciseFiles = files.filter((file) => file.kind === 'exercise');
  const result = validateContent([...exerciseFiles, ...workoutFiles]);
  const blocked = new Set(
    result.blocking.filter((issue) => issue.kind === 'workout').map((issue) => issue.id),
  );
  return result.workouts.filter(
    (w) =>
      (w.status === 'published' ||
        (w.status === 'draft' &&
          (w.category === 'run_strength' || WORKOUT_LIST_DRAFT_CATEGORIES.includes(w.category)))) &&
      !blocked.has(w.id),
  );
}

/** Supabase: Zeilen der Tabelle `workouts` (RLS: nur freigegebene) → Workouts; ungültige werden übergangen. */
export function workoutsFromDbRows(rows: readonly { readonly data: unknown }[]): Workout[] {
  return rows.flatMap((row) => {
    const parsed = workoutSchema.safeParse(row.data);
    return parsed.success && parsed.data.status === 'published' ? [parsed.data] : [];
  });
}

/**
 * Testmodus (wie mark_session_log_workout): Herkunft „workout“ an einer eigenen freien Kraft-Einheit. Andere Einträge
 * bleiben unverändert (dann kommt dieselbe Zeilen-Liste zurück).
 */
export function markWorkoutSource<T extends Pick<UserRows, 'sessionLogs'>>(
  rows: T,
  logId: string,
): T {
  const log = rows.sessionLogs.find((l) => l.id === logId);
  if (
    !log ||
    log.is_free !== true ||
    log.kind !== 'strength' ||
    (log.source !== 'manual' && log.source !== 'workout') ||
    log.source === 'workout'
  ) {
    return rows;
  }
  return {
    ...rows,
    sessionLogs: rows.sessionLogs.map((l) => (l.id === logId ? { ...l, source: 'workout' } : l)),
  };
}

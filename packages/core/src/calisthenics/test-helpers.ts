/** Nur für Tests: Tagebuch-Einträge für die Skill-Pfade. */
import { addDays } from '../dates';
import type { ExerciseLogEntry, LoggedSet } from '../log/types';

export const TODAY = '2026-10-26';

/** Sätze mit Wiederholungen (RPE optional). */
export function repSets(reps: readonly number[], rpe: number | null = null): LoggedSet[] {
  return reps.map((r) => ({ reps: r, weightKg: null, durationS: null, rpe, done: true }));
}

/** Haltesätze in Sekunden. */
export function holdSets(seconds: readonly number[], rpe: number | null = null): LoggedSet[] {
  return seconds.map((s) => ({ reps: null, weightKg: null, durationS: s, rpe, done: true }));
}

/** Eintrag `daysAgo` Tage vor TODAY. */
export function entry(
  exerciseId: string,
  daysAgo: number,
  sets: LoggedSet[],
  extra: Partial<ExerciseLogEntry> = {},
): ExerciseLogEntry {
  const performedOn = addDays(TODAY, -daysAgo);
  return {
    exerciseId,
    performedOn,
    loggedAt: `${performedOn}T18:00:00Z`,
    status: 'done',
    loadType:
      sets[0]?.durationS !== null && sets[0]?.durationS !== undefined ? 'time' : 'bodyweight',
    isIntroWeek: false,
    isDeload: false,
    targetSets: sets.length,
    targetWeightKg: null,
    targetReps: null,
    targetExtraSet: null,
    targetRpe: null,
    state: null,
    weightConfirmed: false,
    sets,
    ...extra,
  };
}

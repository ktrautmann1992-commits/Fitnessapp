import {
  PUSH_PULL_TOLERANCE,
  SESSION_DURATION_ESTIMATE,
  WEEKLY_SET_CONTRIBUTION,
  WEEKLY_SETS_PER_MUSCLE,
} from '../constants';
import { MUSCLE_GROUPS, type MovementPattern, type MuscleGroup } from '../enums';
import type { Exercise, PlanTemplate, TemplateExercise, TemplateSession } from './schemas';

/**
 * Kennzahlen einer Plan-Vorlage: Wochensätze pro Muskelgruppe, geschätzte Dauer je Einheit,
 * Drücken/Ziehen. Reine Funktionen; die Regeln dazu stehen in checks.ts, die Grenzwerte in constants.ts.
 */

/** Übungen nach ID (für Nachschlagen in Vorlagen). */
export type ExerciseLookup = ReadonlyMap<string, Exercise>;

/** Wochensätze je Muskelgruppe: Hauptmuskel 1,0 und Nebenmuskel 0,5 je Satz. Unbekannte Übungen zählen nicht. */
export function weeklySetsByMuscle(
  template: Pick<PlanTemplate, 'sessions'>,
  exercises: ExerciseLookup,
): Record<MuscleGroup, number> {
  const result = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0])) as Record<
    MuscleGroup,
    number
  >;
  for (const session of template.sessions) {
    for (const item of session.exercises) {
      const exercise = exercises.get(item.exercise_id);
      if (!exercise) {
        continue;
      }
      for (const muscle of exercise.primary_muscles) {
        result[muscle] += item.sets * WEEKLY_SET_CONTRIBUTION.primary;
      }
      for (const muscle of exercise.secondary_muscles) {
        result[muscle] += item.sets * WEEKLY_SET_CONTRIBUTION.secondary;
      }
    }
  }
  return result;
}

/** Zielbereich Wochensätze für Ziel und Level einer Vorlage. */
export function weeklySetRange(template: Pick<PlanTemplate, 'goal_type' | 'experience_level'>): {
  min: number;
  max: number;
} {
  return WEEKLY_SETS_PER_MUSCLE[template.goal_type][template.experience_level];
}

/** Arbeitszeit eines Satzes in Sekunden: Dauer bzw. mittlere Wiederholungszahl × Sekunden je Wiederholung. */
function workSecondsPerSet(item: TemplateExercise): number {
  if (item.duration_s !== null) {
    return item.duration_s;
  }
  const reps = ((item.reps_min ?? 0) + (item.reps_max ?? 0)) / 2;
  return reps * SESSION_DURATION_ESTIMATE.secondsPerRep;
}

/**
 * Geschätzte Dauer einer Einheit in Minuten (gerundet auf ganze Minuten):
 * Aufwärmen + Σ (Sätze × Arbeitszeit) + Pausen + Wechsel je Übung.
 * - Einzelübung: Pause zwischen den Sätzen, also (Sätze − 1) × Pause.
 * - Supersatz (gleiche `superset_group`): Die Übungen werden im Wechsel gemacht. Je Runde zählen die Pausen
 *   aller Übungen der Gruppe; Anzahl Runden = größte Satzzahl der Gruppe; nach der letzten Runde keine Pause.
 */
export function estimateSessionMinutes(session: Pick<TemplateSession, 'exercises'>): number {
  const { warmupMinutes, transitionSecondsPerExercise } = SESSION_DURATION_ESTIMATE;
  let seconds = warmupMinutes * 60;
  const groups = new Map<string, TemplateExercise[]>();
  for (const item of session.exercises) {
    seconds += item.sets * workSecondsPerSet(item) + transitionSecondsPerExercise;
    if (item.superset_group === null) {
      seconds += Math.max(0, item.sets - 1) * item.rest_s;
    } else {
      const group = groups.get(item.superset_group) ?? [];
      group.push(item);
      groups.set(item.superset_group, group);
    }
  }
  for (const group of groups.values()) {
    const rounds = Math.max(...group.map((item) => item.sets));
    const restPerRound = group.reduce((sum, item) => sum + item.rest_s, 0);
    seconds += Math.max(0, rounds - 1) * restPerRound;
  }
  return Math.round(seconds / 60);
}

/** Erlaubte Spanne der geschätzten Dauer: Minuten-Spanne der Vorlage ± Toleranz (V6). */
export function sessionDurationWindow(
  template: Pick<PlanTemplate, 'minutes_min' | 'minutes_max'>,
): {
  min: number;
  max: number;
} {
  const { tolerance } = SESSION_DURATION_ESTIMATE;
  return {
    min: template.minutes_min * (1 - tolerance),
    max: template.minutes_max * (1 + tolerance),
  };
}

const PUSH_PATTERNS: readonly MovementPattern[] = ['horizontal_push', 'vertical_push'];
const PULL_PATTERNS: readonly MovementPattern[] = ['horizontal_pull', 'vertical_pull'];

/** Sätze pro Woche mit Drück- bzw. Zugmuster. */
export function pushPullSets(
  template: Pick<PlanTemplate, 'sessions'>,
  exercises: ExerciseLookup,
): { push: number; pull: number } {
  let push = 0;
  let pull = 0;
  for (const session of template.sessions) {
    for (const item of session.exercises) {
      const pattern = exercises.get(item.exercise_id)?.movement_pattern;
      if (pattern && PUSH_PATTERNS.includes(pattern)) {
        push += item.sets;
      } else if (pattern && PULL_PATTERNS.includes(pattern)) {
        pull += item.sets;
      }
    }
  }
  return { push, pull };
}

/**
 * true, wenn Drücken und Ziehen ausgewogen sind: die größere Seite liegt höchstens 30 % über der kleineren.
 * Keine Drück- und keine Zugsätze gelten als ausgewogen.
 */
export function isPushPullBalanced({ push, pull }: { push: number; pull: number }): boolean {
  if (push === 0 && pull === 0) {
    return true;
  }
  const larger = Math.max(push, pull);
  const smaller = Math.min(push, pull);
  return larger <= smaller * (1 + PUSH_PULL_TOLERANCE);
}

import { RECOVERY_ROUTINE } from '../constants';
import { addDays, startOfIsoWeek } from '../dates';
import { type EnduranceModality, MUSCLE_GROUPS, type MuscleGroup } from '../enums';
import { type FlowExercise, type FlowSafetyInput, prepareFlowWorkout } from './flow';
import type { Workout } from './schema';

/**
 * Vorschlag „Erholungstag: Mobility“ auf „Heute“ (Sportarten Stufe 1 · Etappe Y, docs/PLAN-SPORTARTEN-STUFE-1.md 2.4,
 * Entscheidung 13, RECOVERY_ROUTINE): nur ein Vorschlag aus festen Regeln, KEINE geplante Einheit – zählt nicht für
 * die Planerfüllung und nicht für die 10-%-Regel; erledigt wird er als freie Einheit (Quelle „workout“). Rein und
 * deterministisch.
 */

/** Warum heute ein Vorschlag passt: trainingsfreier Tag bzw. Erholungswoche nach erledigter Einheit. */
export type RecoveryDay = 'rest' | 'deload';

/** Angaben einer geplanten Einheit, die der Vorschlag braucht. */
export interface RecoveryPlanSession {
  readonly scheduled_on: string;
  readonly status: 'planned' | 'skipped' | 'completed';
  readonly is_deload: boolean;
}

/**
 * Passt heute ein Vorschlag? Ohne Plan nie (dann zeigt „Heute“ „Plan erstellen“). Keine bzw. nur gestrichene Einheit
 * heute → `rest`. Einheit(en) heute alle erledigt und die Woche ist eine Erholungswoche → `deload`. Sonst null (heute
 * ist Training dran).
 */
export function recoveryRoutineDay(
  sessions: readonly RecoveryPlanSession[] | null,
  today: string,
): RecoveryDay | null {
  if (sessions === null || sessions.length === 0) return null;
  const onDay = sessions.filter((s) => s.scheduled_on === today && s.status !== 'skipped');
  if (onDay.length === 0) return 'rest';
  if (!onDay.every((s) => s.status === 'completed')) return null;
  const weekStart = startOfIsoWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const deload = sessions.some(
    (s) => s.is_deload && s.scheduled_on >= weekStart && s.scheduled_on <= weekEnd,
  );
  return deload ? 'deload' : null;
}

/** Eingetragene Aktivität (Tagebuch): Kraft mit Übungen bzw. Ausdauer mit Art. */
export interface RecentActivity {
  readonly performedOn: string;
  readonly exerciseIds: readonly string[];
  readonly enduranceModality: EnduranceModality | null;
}

/**
 * Hauptmuskeln der letzten RECOVERY_ROUTINE.lookbackDays Tage (bis einschließlich heute): Kraft-Übungen zählen mit
 * ihren Hauptmuskeln (2) und Nebenmuskeln (1), Ausdauer mit RECOVERY_ROUTINE.enduranceMuscles (2). Die meisten Punkte
 * zuerst (Gleichstand: Reihenfolge MUSCLE_GROUPS), höchstens RECOVERY_ROUTINE.mainMuscles.
 */
export function recentMainMuscles(
  activities: readonly RecentActivity[],
  exercises: ReadonlyMap<
    string,
    Pick<FlowExercise, 'primary_muscles'> & { readonly secondary_muscles: readonly MuscleGroup[] }
  >,
  today: string,
): MuscleGroup[] {
  const from = addDays(today, -RECOVERY_ROUTINE.lookbackDays);
  const score = new Map<MuscleGroup, number>();
  const add = (m: MuscleGroup, n: number) => score.set(m, (score.get(m) ?? 0) + n);
  for (const a of activities) {
    if (a.performedOn < from || a.performedOn > today) continue;
    for (const id of a.exerciseIds) {
      const exercise = exercises.get(id);
      exercise?.primary_muscles.forEach((m) => add(m, 2));
      exercise?.secondary_muscles.forEach((m) => add(m, 1));
    }
    if (a.enduranceModality !== null) {
      RECOVERY_ROUTINE.enduranceMuscles[a.enduranceModality].forEach((m) => add(m, 2));
    }
  }
  return MUSCLE_GROUPS.filter((m) => (score.get(m) ?? 0) > 0)
    .sort(
      (a, b) =>
        (score.get(b) ?? 0) - (score.get(a) ?? 0) ||
        MUSCLE_GROUPS.indexOf(a) - MUSCLE_GROUPS.indexOf(b),
    )
    .slice(0, RECOVERY_ROUTINE.mainMuscles);
}

/** Kommt diese Routine als Erholungs-Routine in Frage (Kategorie, Format, Dauer, Sterne)? */
export function isRecoveryRoutineCandidate(
  workout: Pick<Workout, 'category' | 'format' | 'minutes' | 'difficulty'>,
): boolean {
  return (
    workout.category === 'mobility' &&
    workout.format === 'flow' &&
    workout.minutes >= RECOVERY_ROUTINE.minutes.min &&
    workout.minutes <= RECOVERY_ROUTINE.minutes.max &&
    workout.difficulty <= RECOVERY_ROUTINE.maxStars
  );
}

export interface RecoveryRoutineSuggestion {
  readonly day: RecoveryDay;
  /** Vorgeschlagene Routine (ID wie in der Bibliothek). */
  readonly workoutId: string;
  readonly title: string;
  /** Minuten nach dem Sicherheitsfilter. */
  readonly minutes: number;
  /** Hauptmuskeln der letzten Tage, die die Routine trifft (für den Text „für Beine und Po“). */
  readonly muscles: readonly MuscleGroup[];
}

export interface RecoveryRoutineInput {
  /** Einstellung „Erholungs-Routine vorschlagen“ (app_layout_settings.recovery_routine, Standard an). */
  readonly enabled: boolean;
  readonly day: RecoveryDay | null;
  /** Heute schon ein Workout eingetragen (Quelle „workout“) → kein Vorschlag mehr. */
  readonly workoutDoneToday: boolean;
  readonly workouts: readonly Workout[];
  readonly exercises: ReadonlyMap<
    string,
    FlowExercise & { readonly secondary_muscles: readonly MuscleGroup[] }
  >;
  readonly safety: FlowSafetyInput;
  /** recentMainMuscles(…) */
  readonly muscles: readonly MuscleGroup[];
}

/**
 * Vorschlag für heute oder null: Einstellung an, passender Tag, heute noch kein Workout; aus den Kandidaten
 * (isRecoveryRoutineCandidate), die der Sicherheitsfilter zeigt, die mit den meisten Treffern auf die Hauptmuskeln
 * der letzten Tage (Hauptmuskel der Pose 2, Nebenmuskel 1), dann am nächsten an RECOVERY_ROUTINE.targetMinutes,
 * dann nach ID.
 */
export function suggestRecoveryRoutine(
  input: RecoveryRoutineInput,
): RecoveryRoutineSuggestion | null {
  if (!input.enabled || input.day === null || input.workoutDoneToday) return null;
  const target = new Set(input.muscles);
  const scored = input.workouts
    .filter(isRecoveryRoutineCandidate)
    .flatMap((workout) => {
      const prepared = prepareFlowWorkout(workout, input.safety, input.exercises);
      if (prepared.hidden) return [];
      const hit = new Set<MuscleGroup>();
      let score = 0;
      for (const item of prepared.workout.exercises) {
        const exercise = input.exercises.get(item.exercise_id);
        exercise?.primary_muscles.forEach((m) => {
          if (target.has(m)) {
            score += 2;
            hit.add(m);
          }
        });
        exercise?.secondary_muscles.forEach((m) => {
          if (target.has(m)) {
            score += 1;
            hit.add(m);
          }
        });
      }
      return [{ workout, prepared, score, hit }];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        Math.abs(a.prepared.minutes - RECOVERY_ROUTINE.targetMinutes) -
          Math.abs(b.prepared.minutes - RECOVERY_ROUTINE.targetMinutes) ||
        (a.workout.id < b.workout.id ? -1 : a.workout.id > b.workout.id ? 1 : 0),
    );
  const best = scored[0];
  if (!best) return null;
  return {
    day: input.day,
    workoutId: best.workout.id,
    title: best.workout.title_de,
    minutes: best.prepared.minutes,
    muscles: input.muscles.filter((m) => best.hit.has(m)),
  };
}

/** Einstellung „Erholungs-Routine vorschlagen“ aus der gespeicherten Anordnung (fehlt = an). */
export function recoveryRoutineEnabled(
  stored: { readonly recovery_routine?: boolean } | null,
): boolean {
  return stored?.recovery_routine ?? true;
}

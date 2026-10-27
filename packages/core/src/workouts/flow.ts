import { FLOW_RULES, FLOW_SAFETY, WORKOUT_LIMITS } from '../constants';
import type { Exercise } from '../content/schemas';
import type { CautionTag } from '../enums';
import { isBlockedByPain, type PainEffect } from '../modes/pain';
import type { Workout, WorkoutContentItem } from './schema';
import { estimateWorkoutSeconds, type WorkoutTimerStep } from './timer';

/**
 * Yoga-, Pilates- und Mobility-Routinen im Format `flow` (Sportarten Stufe 1 · Etappe Y, docs/PLAN-SPORTARTEN-STUFE-1.md
 * 2.4, Entscheidung 11): Pose für Pose nach Zeit OHNE Pausen-Bildschirm, mit Seitenwechsel („rechts / links“), und der
 * Sicherheitsfilter für Posen. Rein und deterministisch, ohne KI – die App bildet nur ab.
 */

/** Seite einer Pose mit Seitenwechsel (`side: 'both'`): erst rechts, dann links. */
export const FLOW_SIDES = ['right', 'left'] as const;
export type FlowSide = (typeof FLOW_SIDES)[number];

/**
 * Ablaufplan einer Flow-Routine: Vorbereitung, dann je Runde jede Pose nach Zeit; `side: 'both'` ergibt zwei Schritte
 * (rechts, dann links, je `duration_s`). Keine Pausen-Schritte (Flow hat `rest_s` = 0); eine Pose ohne Sekunden (nur
 * in ungültigen Inhalten möglich) zählt mit FLOW_RULES.poseS.min.
 */
export function buildFlowTimerSteps(
  workout: Pick<Workout, 'rounds' | 'exercises'>,
): WorkoutTimerStep[] {
  const steps: WorkoutTimerStep[] = [{ kind: 'prepare', seconds: WORKOUT_LIMITS.prepareS }];
  for (let round = 1; round <= workout.rounds; round += 1) {
    workout.exercises.forEach((item, itemIndex) => {
      const seconds = item.duration_s ?? FLOW_RULES.poseS.min;
      const sides: readonly (FlowSide | null)[] = item.side === 'both' ? FLOW_SIDES : [null];
      for (const side of sides) {
        steps.push({
          kind: 'work',
          itemIndex,
          exerciseId: item.exercise_id,
          pass: round,
          passes: workout.rounds,
          round,
          seconds,
          reps: null,
          ...(side === null ? {} : { side }),
        });
      }
    });
  }
  return steps;
}

// ---------------------------------------------------------------------------------------------------------
// Sicherheitsfilter
// ---------------------------------------------------------------------------------------------------------

/** Angaben einer Pose aus der Übungsbibliothek, die der Filter braucht. */
export type FlowExercise = Pick<
  Exercise,
  'id' | 'movement_pattern' | 'primary_muscles' | 'caution_tags' | 'load_type' | 'alternatives'
>;

export interface FlowSafetyInput {
  /** Ausgeschlossene Merkmale (PlanSafetyRules.excludedCautionTags: Schwangerschaft, vorsichtig, Fit im Alter …). */
  readonly excludedCautionTags: readonly CautionTag[];
  /** Schon-Modus am Tag (painEffectOn) oder null. */
  readonly pain: PainEffect | null;
  /** Halteposen kürzen (ab 65 bzw. „Fit im Alter“, flowHoldCap). */
  readonly holdCap: boolean;
}

/** Halteposen kürzen? Ab FLOW_SAFETY.holdCapFromAge Jahren oder beim Ziel „Fit im Alter“. */
export function flowHoldCap(input: {
  readonly age: number;
  readonly activeAging: boolean;
}): boolean {
  return input.activeAging || input.age >= FLOW_SAFETY.holdCapFromAge;
}

/** Ist die Pose für diese Person erlaubt (kein ausgeschlossenes Merkmal, im Schon-Modus nicht gesperrt)? */
export function isPoseAllowed(exercise: FlowExercise | undefined, input: FlowSafetyInput): boolean {
  if (!exercise) return false;
  if (exercise.caution_tags.some((tag) => input.excludedCautionTags.includes(tag))) return false;
  return !(input.pain !== null && isBlockedByPain(exercise, input.pain));
}

export interface FlowSwap {
  readonly itemIndex: number;
  readonly fromId: string;
  readonly toId: string;
}

export interface PreparedFlow {
  /** Routine für diese Person: gesperrte Posen getauscht bzw. entfallen, Halteposen ggf. gekürzt. */
  readonly workout: Workout;
  /** Zu wenige erlaubte Posen (unter FLOW_RULES.minAllowedShare) bzw. keine Pose übrig → nicht anzeigen. */
  readonly hidden: boolean;
  /** Anteil der Posen, die ohne Tausch erlaubt sind (0–1). */
  readonly allowedShare: number;
  readonly swapped: readonly FlowSwap[];
  /** Entfallene Posen (Index im Original). */
  readonly removed: readonly { readonly itemIndex: number; readonly exerciseId: string }[];
  /** Anzahl gekürzter Halteposen. */
  readonly shortened: number;
  /** Geschätzte Minuten der angepassten Routine (mindestens 1). */
  readonly minutes: number;
}

/** Erlaubte Alternative einer gesperrten Pose: Reihenfolge FLOW_SAFETY.swapReasons, dann Priorität, dann ID. */
function swapFor(
  exercise: FlowExercise | undefined,
  input: FlowSafetyInput,
  exercises: ReadonlyMap<string, FlowExercise>,
): FlowExercise | null {
  if (!exercise) return null;
  const order: readonly string[] = FLOW_SAFETY.swapReasons;
  const candidates = exercise.alternatives
    .filter((a) => order.includes(a.reason))
    .sort(
      (a, b) =>
        order.indexOf(a.reason) - order.indexOf(b.reason) ||
        a.priority - b.priority ||
        (a.alternative_id < b.alternative_id ? -1 : a.alternative_id > b.alternative_id ? 1 : 0),
    );
  for (const candidate of candidates) {
    const other = exercises.get(candidate.alternative_id);
    if (other && isPoseAllowed(other, input)) return other;
  }
  return null;
}

/**
 * Sicherheitsfilter einer Flow-Routine (Plan 2.4): Posen mit ausgeschlossenem Merkmal bzw. im Schon-Modus gesperrt
 * werden gegen eine erlaubte Alternative (Stuhl-/Wand-Variante) getauscht oder entfallen. Sind weniger als
 * FLOW_RULES.minAllowedShare der Posen ohne Tausch erlaubt, wird die Routine nicht angezeigt (`hidden`). Ab 65 bzw.
 * „Fit im Alter“ werden Halteposen (Belastungsart Zeit) auf FLOW_RULES.seniorHoldMaxS gekürzt. Andere Formate kommen
 * unverändert zurück (dort gilt workoutSafetyHints).
 */
export function prepareFlowWorkout(
  workout: Workout,
  input: FlowSafetyInput,
  exercises: ReadonlyMap<string, FlowExercise>,
): PreparedFlow {
  if (workout.format !== 'flow') {
    return {
      workout,
      hidden: false,
      allowedShare: 1,
      swapped: [],
      removed: [],
      shortened: 0,
      minutes: workout.minutes,
    };
  }
  const swapped: FlowSwap[] = [];
  const removed: { itemIndex: number; exerciseId: string }[] = [];
  let allowed = 0;
  let shortened = 0;
  const items: WorkoutContentItem[] = [];
  workout.exercises.forEach((item, itemIndex) => {
    const exercise = exercises.get(item.exercise_id);
    let chosen: FlowExercise | null;
    if (isPoseAllowed(exercise, input)) {
      allowed += 1;
      chosen = exercise ?? null;
    } else {
      chosen = swapFor(exercise, input, exercises);
      if (chosen) swapped.push({ itemIndex, fromId: item.exercise_id, toId: chosen.id });
      else removed.push({ itemIndex, exerciseId: item.exercise_id });
    }
    if (!chosen) return;
    let duration = item.duration_s;
    if (
      input.holdCap &&
      chosen.load_type === 'time' &&
      duration !== null &&
      duration > FLOW_RULES.seniorHoldMaxS
    ) {
      duration = FLOW_RULES.seniorHoldMaxS;
      shortened += 1;
    }
    items.push({ ...item, exercise_id: chosen.id, duration_s: duration });
  });
  const total = workout.exercises.length;
  const allowedShare = total === 0 ? 0 : allowed / total;
  const changed = swapped.length + removed.length + shortened > 0;
  const adjusted: Workout = changed ? { ...workout, exercises: items } : workout;
  const estimatedS = estimateWorkoutSeconds(buildFlowTimerSteps(adjusted));
  return {
    workout: adjusted,
    hidden: items.length === 0 || allowedShare < FLOW_RULES.minAllowedShare,
    allowedShare,
    swapped,
    removed,
    shortened,
    minutes: changed ? Math.max(1, Math.round(estimatedS / 60)) : workout.minutes,
  };
}

/** Flow-Routinen, die nach dem Sicherheitsfilter angezeigt werden; andere Formate unverändert. */
export function visibleWorkouts<W extends Workout>(
  workouts: readonly W[],
  input: FlowSafetyInput,
  exercises: ReadonlyMap<string, FlowExercise>,
): W[] {
  return workouts.filter((w) => !prepareFlowWorkout(w, input, exercises).hidden);
}

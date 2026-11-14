import { WORKOUT_PLAYER } from '../constants';
import type { Workout } from './schema';
import type { WorkoutRunView, WorkoutTimerStep, WorkoutWorkStep } from './timer';
import { wodTimerPlan } from './wod';

/**
 * Workout-Player (Gründer-Feedback 14.11.2026, docs/PLAN-WORKOUTS.md Abschnitt 4 „Workout-Player“): Power-Workouts
 * laufen komplett nach Zeit – Countdown mit der ersten Übung, dann Übung → Pause → Übung ohne Tippen.
 *
 * Entscheidungen:
 * - „Power-Workout“ = Format `circuit`, `interval` oder `sets_reps`: HIIT, Tabata, Zirkel, Rumpf, Calisthenics-/Hyrox-
 *   Zirkel, Rudern-Intervalle, alle WOD-Formen (AMRAP, EMOM, For Time, Chipper) und Sätze × Wiederholungen. Gründer-
 *   Vorgabe: im normalen Ablauf NIE „Weiter“ tippen müssen – deshalb auch Kraftsätze mit Zeitfenster (Satzpausen liefen
 *   schon automatisch). Nicht `flow` (Yoga/Pilates/Mobility): eigene ruhige Ansicht, läuft schon komplett nach Zeit.
 * - Übungen nach Wiederholungen bekommen ein Zeitfenster (repTimeBoxS, WORKOUT_PLAYER.timeBox); „Fertig“ geht früher
 *   weiter und bleibt freiwillig.
 * - AMRAP: Zeitfenster sind das Tempo; wer schneller ist, tippt „Fertig“ und schafft mehr Runden – das Zeitlimit
 *   (wod.ts) beendet den Lauf wie bisher, gezählt werden erledigte Runden/Übungen.
 * - For Time/Chipper: Zeitfenster als Obergrenze je Übung; die Zeit ist die aktive Zeit bis zum letzten Schritt
 *   (mit „Fertig“ schneller), das Zeitlimit bleibt.
 * - EMOM: schon nach Zeit (jede Übung samt Pause eine Minute) – unverändert.
 */

/** Läuft dieses Workout komplett nach Zeit (Zeitfenster für Wiederholungen)? */
export function isPowerWorkout(workout: Pick<Workout, 'format'>): boolean {
  return (
    workout.format === 'circuit' || workout.format === 'interval' || workout.format === 'sets_reps'
  );
}

/** Zeitfenster für eine Übung nach Wiederholungen (Sekunden). */
export function repTimeBoxS(reps: number, unilateral = false): number {
  const { secondsPerRep, minS, maxS, roundToS } = WORKOUT_PLAYER.timeBox;
  const raw = Math.max(0, reps) * secondsPerRep * (unilateral ? 2 : 1);
  const rounded = Math.ceil(raw / roundToS) * roundToS;
  return Math.min(maxS, Math.max(minS, rounded));
}

/** Übungs-Schritte nach Wiederholungen mit Zeitfenster versehen (alle anderen Schritte unverändert). */
export function timeBoxSteps(
  steps: readonly WorkoutTimerStep[],
  unilateral: (exerciseId: string) => boolean = () => false,
): WorkoutTimerStep[] {
  return steps.map((step) =>
    step.kind === 'work' && step.seconds === null && step.reps !== null
      ? { ...step, seconds: repTimeBoxS(step.reps, unilateral(step.exerciseId)), timeBoxed: true }
      : step,
  );
}

/**
 * Ablaufplan für den Player: wie wodTimerPlan (AMRAP mit Höchstzahl Runden), bei Power-Workouts mit Zeitfenstern.
 */
export function workoutPlayerPlan(
  workout: Parameters<typeof wodTimerPlan>[0],
  unilateral: (exerciseId: string) => boolean = () => false,
): WorkoutTimerStep[] {
  const steps = wodTimerPlan(workout);
  return isPowerWorkout(workout) ? timeBoxSteps(steps, unilateral) : steps;
}

/** Was der Player groß zeigt: die laufende Übung bzw. (Countdown, Pause) die kommende, dazu „Als Nächstes“. */
export interface PlayerFocus {
  /** Übung im großen Bild; null = keine mehr. */
  readonly exercise: WorkoutWorkStep | null;
  /** true = Countdown oder Pause: das große Bild zeigt die KOMMENDE Übung. */
  readonly upcoming: boolean;
  /** Kleine Vorschau „Als Nächstes“ während einer Übung; null in Countdown/Pause (dort ist das große Bild die nächste). */
  readonly next: WorkoutWorkStep | null;
}

export function playerFocus(view: Pick<WorkoutRunView, 'step' | 'nextWork'>): PlayerFocus {
  const step = view.step;
  if (step?.kind === 'work') return { exercise: step, upcoming: false, next: view.nextWork };
  return { exercise: view.nextWork, upcoming: step !== null, next: null };
}

/**
 * 3-2-1-Signal: in den letzten WORKOUT_PLAYER.cueSeconds Sekunden eines Zeit-Schritts (nicht pausiert) ein Ton je
 * Sekunde. `key` ist je Schritt und Sekunde eindeutig – die App spielt jeden Schlüssel genau einmal.
 */
export function countdownCue(
  view: Pick<WorkoutRunView, 'finished' | 'paused' | 'step' | 'index' | 'remainingS'>,
): { readonly key: string; readonly secondsLeft: number } | null {
  if (view.finished || view.paused || view.step === null || view.remainingS === null) return null;
  if (view.remainingS < 1 || view.remainingS > WORKOUT_PLAYER.cueSeconds) return null;
  return { key: `${view.index}:${view.remainingS}`, secondsLeft: view.remainingS };
}

/** Kurze Ausführung für den Countdown: die ersten `max` Schritte der Übungsbeschreibung. */
export function howToLines(
  exercise: { readonly steps_de?: readonly string[] } | null | undefined,
  max = 2,
): string[] {
  return (exercise?.steps_de ?? []).slice(0, Math.max(0, max));
}

import { WORKOUT_LIMITS, WORKOUT_THEME_RULES } from '../constants';
import type { Workout } from './schema';
import {
  advanceWorkoutRun,
  buildWorkoutTimerPlan,
  endWorkoutRun,
  type WorkoutRun,
  type WorkoutRunSummary,
  type WorkoutTimerStep,
} from './timer';

/**
 * Funktionelle Workouts im WOD-Stil („CrossFit-Stil / Functional Fitness“, Gründer-Wunsch 29.10.2026,
 * docs/PLAN-WORKOUTS.md Abschnitt 6) – OHNE neues Inhaltsfeld: Die Trainingsform steht am Titelanfang
 * (WORKOUT_THEME_RULES.wodTitlePrefixes) und muss zum Ablauf passen:
 * - AMRAP („so viele Runden wie möglich“): Zirkel; der Timer läuft bis zum Zeitlimit (`minutes`) mit bis zu
 *   WORKOUT_LIMITS.rounds.max Runden – `rounds` im Inhalt ist der Richtwert für die Dauer-Schätzung (W6).
 * - EMOM („jede Minute“): Intervall; jede Übung samt Pause genau eine Minute (WORKOUT_THEME_RULES.emomSlotS).
 * - For Time / Chipper: Zirkel (Chipper: eine Runde) so schnell wie möglich, Zeitlimit `minutes`.
 * Reine Zeitrechnung wie timer.ts – die App bildet nur ab.
 */

export const WOD_STYLES = ['amrap', 'emom', 'for_time', 'chipper'] as const;
export type WodStyle = (typeof WOD_STYLES)[number];

type WodInput = Pick<Workout, 'title_de' | 'format' | 'rounds' | 'round_rest_s' | 'exercises'>;

function titleStyle(title: string): WodStyle | null {
  const lower = title.toLocaleLowerCase('de');
  for (const style of WOD_STYLES) {
    const prefix = WORKOUT_THEME_RULES.wodTitlePrefixes[style].toLocaleLowerCase('de');
    if (!lower.startsWith(prefix)) continue;
    const next = lower.charAt(prefix.length);
    // Ganzes Wort: „AMRAP 12“, „EMOM: …“, „For Time – …“ – nicht „Chippers“.
    if (!/\p{L}/u.test(next)) return style;
  }
  return null;
}

/** Jede Übung samt Pause genau eine Minute (die letzte einer Runde mit der Rundenpause; ganz am Ende höchstens). */
function isEmomShaped(workout: WodInput): boolean {
  const slot = WORKOUT_THEME_RULES.emomSlotS;
  const items = workout.exercises;
  return items.every((item, i) => {
    if (item.duration_s === null) return false;
    const last = i === items.length - 1;
    if (!last) return item.duration_s + item.rest_s === slot;
    return workout.rounds > 1
      ? item.duration_s + workout.round_rest_s === slot
      : item.duration_s <= slot;
  });
}

/** Trainingsform eines Workouts (Titelanfang + passender Ablauf), sonst null. */
export function wodStyle(workout: WodInput): WodStyle | null {
  const style = titleStyle(workout.title_de);
  if (style === null) return null;
  if (style === 'emom')
    return workout.format === 'interval' && isEmomShaped(workout) ? style : null;
  if (workout.format !== 'circuit') return null;
  if (style === 'chipper' && workout.rounds !== 1) return null;
  return style;
}

/** Zeitlimit in Sekunden (AMRAP, For Time, Chipper = `minutes`); EMOM und andere Workouts: null. */
export function wodTimeCapS(workout: WodInput & Pick<Workout, 'minutes'>): number | null {
  const style = wodStyle(workout);
  return style === null || style === 'emom' ? null : workout.minutes * 60;
}

/**
 * Ablaufplan für den Timer: AMRAP mit WORKOUT_LIMITS.rounds.max Runden (das Zeitlimit beendet den Lauf), alles andere
 * wie buildWorkoutTimerPlan.
 */
export function wodTimerPlan(workout: WodInput & Pick<Workout, 'minutes'>): WorkoutTimerStep[] {
  if (wodStyle(workout) === 'amrap') {
    return buildWorkoutTimerPlan({ ...workout, rounds: WORKOUT_LIMITS.rounds.max });
  }
  return buildWorkoutTimerPlan(workout);
}

/** Aktive Millisekunden (ohne Timer-Pausen) bis `atMs`. */
function activeMs(run: WorkoutRun, atMs: number): number {
  const end = run.finishedAtMs ?? run.pausedAtMs ?? atMs;
  const runningPause = run.pausedAtMs === null ? 0 : Math.max(0, end - run.pausedAtMs);
  return Math.max(0, end - run.startedAtMs - run.totalPausedMs - runningPause);
}

/** Zeitpunkt, an dem die aktive Zeit das Limit erreicht (laufend) – pausiert unter dem Limit: nie. */
function capAtMs(run: WorkoutRun, capS: number): number {
  const capMs = capS * 1000;
  if (run.pausedAtMs === null) return run.startedAtMs + run.totalPausedMs + capMs;
  const frozen = activeMs(run, run.pausedAtMs);
  return frozen >= capMs ? run.pausedAtMs - (frozen - capMs) : Number.POSITIVE_INFINITY;
}

/**
 * Lauf mit Zeitlimit weiterrechnen: Ist das Limit (aktive Zeit, ohne Pausen) erreicht, endet der Lauf GENAU am
 * Limit – die laufende Übung zählt nicht (wie „Beenden“). Ohne Limit (null) oder schon beendet wie advanceWorkoutRun.
 */
export function capWorkoutRun(
  steps: readonly WorkoutTimerStep[],
  run: WorkoutRun,
  nowMs: number,
  capS: number | null,
): WorkoutRun {
  if (capS === null || run.finishedAtMs !== null) return advanceWorkoutRun(steps, run, nowMs);
  const at = capAtMs(run, capS);
  if (nowMs < at) return advanceWorkoutRun(steps, run, nowMs);
  return endWorkoutRun(steps, run, at);
}

/** Restsekunden bis zum Zeitlimit (aufgerundet, mindestens 0); ohne Limit null. */
export function wodCapRemainingS(
  run: WorkoutRun,
  nowMs: number,
  capS: number | null,
): number | null {
  if (capS === null) return null;
  return Math.max(0, Math.ceil(capS - activeMs(run, nowMs) / 1000));
}

/** Hat das Zeitlimit den Lauf beendet (aktive Zeit am Ende ≥ Limit)? */
export function wodCapReached(run: WorkoutRun, capS: number | null): boolean {
  if (capS === null || run.finishedAtMs === null) return false;
  return activeMs(run, run.finishedAtMs) >= capS * 1000;
}

/** AMRAP-Ergebnis: volle Runden plus erledigte Übungen der angefangenen Runde. */
export function amrapScore(summary: Pick<WorkoutRunSummary, 'items' | 'roundsCompleted'>): {
  readonly rounds: number;
  readonly extra: number;
} {
  const partial = summary.roundsCompleted + 1;
  const extra = summary.items.reduce(
    (sum, item) => sum + item.done.filter((d) => d.pass === partial).length,
    0,
  );
  return { rounds: summary.roundsCompleted, extra };
}

import { WORKOUT_LIMITS } from '../constants';
import { buildFlowTimerSteps, type FlowSide } from './flow';
import type { Workout } from './schema';

/**
 * Timer-Modus eines Workouts (docs/PLAN-WORKOUTS.md Abschnitt 4): Ablaufplan aus dem Workout und ein Lauf als reine
 * Zeitrechnung über Millisekunden-Zeitpunkte (die App übergibt `Date.now()`). Kein Zähler, der im Hintergrund stehen
 * bleibt: Restzeit, Übergänge und Pausen ergeben sich immer aus „jetzt“ – offline, nach einem Neuzeichnen oder nach
 * der Bildschirmsperre derselbe Stand. Übungen nach Zeit laufen automatisch weiter, Übungen nach Wiederholungen
 * (und jeder Satz bei Sätze × Wdh.) warten auf „Erledigt“.
 */

/** Ein Schritt des Ablaufs. */
export type WorkoutTimerStep =
  /** „Gleich geht's los“ vor der ersten Übung (WORKOUT_LIMITS.prepareS). */
  | { readonly kind: 'prepare'; readonly seconds: number }
  | {
      readonly kind: 'work';
      /** Index der Übung im Workout (`exercises`). */
      readonly itemIndex: number;
      readonly exerciseId: string;
      /** Durchgang dieser Übung: Runde (Zirkel/Intervall) bzw. Satz (Sätze × Wdh.), 1-basiert. */
      readonly pass: number;
      readonly passes: number;
      /** Runde des Workouts (Sätze × Wdh.: immer 1). */
      readonly round: number;
      /** Sekunden (nach Zeit) oder null (nach Wiederholungen – wartet auf „Erledigt“). */
      readonly seconds: number | null;
      readonly reps: number | null;
      /** Nur im Format `flow` mit Seitenwechsel (Sportarten Stufe 1): diese Seite – sonst fehlt das Feld. */
      readonly side?: FlowSide;
    }
  | {
      readonly kind: 'rest';
      readonly seconds: number;
      /** Pause nach einer Übung, zwischen Runden oder zwischen Sätzen derselben Übung. */
      readonly after: 'exercise' | 'round' | 'set';
    };

export type WorkoutWorkStep = Extract<WorkoutTimerStep, { kind: 'work' }>;

/** Ablaufplan: Vorbereitung, dann Übungen und Pausen. Pausen von 0 s entfallen, nach dem letzten Schritt keine. */
export function buildWorkoutTimerPlan(
  workout: Pick<Workout, 'format' | 'rounds' | 'round_rest_s' | 'exercises'>,
): WorkoutTimerStep[] {
  const steps: WorkoutTimerStep[] = [{ kind: 'prepare', seconds: WORKOUT_LIMITS.prepareS }];
  const pushRest = (seconds: number, after: 'exercise' | 'round' | 'set') => {
    if (seconds > 0) steps.push({ kind: 'rest', seconds, after });
  };
  const items = workout.exercises;
  // Flow (Sportarten Stufe 1, Yoga/Pilates/Mobility): Pose für Pose ohne Pausen, Seitenwechsel (flow.ts).
  if (workout.format === 'flow') return buildFlowTimerSteps(workout);
  if (workout.format === 'sets_reps') {
    items.forEach((item, itemIndex) => {
      const sets = item.sets ?? 1;
      for (let set = 1; set <= sets; set += 1) {
        steps.push({
          kind: 'work',
          itemIndex,
          exerciseId: item.exercise_id,
          pass: set,
          passes: sets,
          round: 1,
          seconds: item.duration_s,
          reps: item.reps,
        });
        const lastSet = set === sets;
        const lastItem = itemIndex === items.length - 1;
        if (!(lastSet && lastItem)) pushRest(item.rest_s, lastSet ? 'exercise' : 'set');
      }
    });
    return steps;
  }
  for (let round = 1; round <= workout.rounds; round += 1) {
    items.forEach((item, itemIndex) => {
      steps.push({
        kind: 'work',
        itemIndex,
        exerciseId: item.exercise_id,
        pass: round,
        passes: workout.rounds,
        round,
        seconds: item.duration_s,
        reps: item.reps,
      });
      const lastItem = itemIndex === items.length - 1;
      if (!lastItem) pushRest(item.rest_s, 'exercise');
      else if (round < workout.rounds) pushRest(workout.round_rest_s, 'round');
    });
  }
  return steps;
}

/**
 * Geschätzte Dauer in Sekunden (Regel W6 und Anzeige): Zeit-Schritte wie geplant, Wiederholungen mit
 * WORKOUT_LIMITS.secondsPerRep (einseitige Übungen doppelt, `unilateral(id)`); ohne die Vorbereitung.
 */
export function estimateWorkoutSeconds(
  steps: readonly WorkoutTimerStep[],
  unilateral: (exerciseId: string) => boolean = () => false,
): number {
  return steps.reduce((sum, step) => {
    if (step.kind === 'prepare') return sum;
    if (step.kind === 'rest') return sum + step.seconds;
    if (step.seconds !== null) return sum + step.seconds;
    const sides = unilateral(step.exerciseId) ? 2 : 1;
    return sum + (step.reps ?? 0) * WORKOUT_LIMITS.secondsPerRep * sides;
  }, 0);
}

// ---------------------------------------------------------------------------------------------------------
// Lauf
// ---------------------------------------------------------------------------------------------------------

/** Ergebnis eines Übungs-Schritts: erledigt (mit Sekunden) oder übersprungen. */
export interface WorkoutStepResult {
  readonly status: 'done' | 'skipped';
  /** Tatsächliche Sekunden des Schritts (ohne Pausen des Timers). */
  readonly seconds: number;
}

export interface WorkoutRun {
  /** Laufender Schritt; = Anzahl Schritte, wenn alle durchlaufen sind. */
  readonly index: number;
  readonly startedAtMs: number;
  /** Beginn des laufenden Schritts. */
  readonly stepStartedAtMs: number;
  /** Gesetzt = gerade pausiert (seit diesem Zeitpunkt). */
  readonly pausedAtMs: number | null;
  /** Summe abgeschlossener Pausen im laufenden Schritt bzw. im ganzen Lauf. */
  readonly stepPausedMs: number;
  readonly totalPausedMs: number;
  /** Je Schritt (gleicher Index wie der Plan): Ergebnis eines Übungs-Schritts, sonst null. */
  readonly results: readonly (WorkoutStepResult | null)[];
  /** Ende des Laufs (alle Schritte durch oder „Beenden“); null = läuft noch. */
  readonly finishedAtMs: number | null;
}

export function startWorkoutRun(steps: readonly WorkoutTimerStep[], nowMs: number): WorkoutRun {
  if (steps.length === 0) throw new RangeError('Ein Workout braucht mindestens einen Schritt.');
  return {
    index: 0,
    startedAtMs: nowMs,
    stepStartedAtMs: nowMs,
    pausedAtMs: null,
    stepPausedMs: 0,
    totalPausedMs: 0,
    results: steps.map(() => null),
    finishedAtMs: null,
  };
}

/** Gelaufene Millisekunden im laufenden Schritt (ohne Pausen, nie negativ – auch wenn die Uhr zurückspringt). */
function stepElapsedMs(run: WorkoutRun, nowMs: number): number {
  const until = run.pausedAtMs ?? nowMs;
  return Math.max(0, until - run.stepStartedAtMs - run.stepPausedMs);
}

function stepSeconds(step: WorkoutTimerStep): number | null {
  return step.kind === 'work' ? step.seconds : step.seconds;
}

/** Schritt `run.index` beenden (Ergebnis bei Übungen) und den nächsten ab `atMs` starten. */
function moveOn(
  steps: readonly WorkoutTimerStep[],
  run: WorkoutRun,
  status: 'done' | 'skipped',
  seconds: number,
  atMs: number,
): WorkoutRun {
  const step = steps[run.index];
  const results =
    step?.kind === 'work'
      ? run.results.map((r, i) =>
          i === run.index ? { status, seconds: Math.max(0, Math.round(seconds)) } : r,
        )
      : run.results;
  const index = run.index + 1;
  return {
    ...run,
    index,
    stepStartedAtMs: atMs,
    stepPausedMs: 0,
    results,
    finishedAtMs: index >= steps.length ? atMs : run.finishedAtMs,
  };
}

/**
 * Zeit-Schritte, deren Ende erreicht ist, abschließen (Übungen nach Zeit = erledigt). Der nächste Schritt beginnt am
 * ENDE des vorigen – so stimmt der Stand auch nach langer Zeit im Hintergrund. Pausiert, beendet oder ein Schritt nach
 * Wiederholungen: unverändert.
 */
export function advanceWorkoutRun(
  steps: readonly WorkoutTimerStep[],
  run: WorkoutRun,
  nowMs: number,
): WorkoutRun {
  let current = run;
  while (current.finishedAtMs === null && current.pausedAtMs === null) {
    const step = steps[current.index];
    if (!step) break;
    const seconds = stepSeconds(step);
    if (seconds === null) break;
    const endMs = current.stepStartedAtMs + current.stepPausedMs + seconds * 1000;
    if (nowMs < endMs) break;
    current = moveOn(steps, current, 'done', seconds, endMs);
  }
  return current;
}

/** „Erledigt“ (Übung nach Wiederholungen, Satz abhaken) bzw. „Weiter“ (Pause/Vorbereitung vorzeitig beenden). */
export function completeWorkoutStep(
  steps: readonly WorkoutTimerStep[],
  run: WorkoutRun,
  nowMs: number,
): WorkoutRun {
  const current = advanceWorkoutRun(steps, run, nowMs);
  if (current.finishedAtMs !== null) return current;
  const resumed = resumeWorkoutRun(current, nowMs);
  return moveOn(steps, resumed, 'done', stepElapsedMs(resumed, nowMs) / 1000, nowMs);
}

/** „Überspringen“: Übung zählt nicht; bei Pause/Vorbereitung wie „Weiter“. */
export function skipWorkoutStep(
  steps: readonly WorkoutTimerStep[],
  run: WorkoutRun,
  nowMs: number,
): WorkoutRun {
  const current = advanceWorkoutRun(steps, run, nowMs);
  if (current.finishedAtMs !== null) return current;
  const resumed = resumeWorkoutRun(current, nowMs);
  return moveOn(steps, resumed, 'skipped', stepElapsedMs(resumed, nowMs) / 1000, nowMs);
}

export function pauseWorkoutRun(
  steps: readonly WorkoutTimerStep[],
  run: WorkoutRun,
  nowMs: number,
): WorkoutRun {
  const current = advanceWorkoutRun(steps, run, nowMs);
  if (current.finishedAtMs !== null || current.pausedAtMs !== null) return current;
  return { ...current, pausedAtMs: Math.max(nowMs, current.stepStartedAtMs) };
}

export function resumeWorkoutRun(run: WorkoutRun, nowMs: number): WorkoutRun {
  if (run.pausedAtMs === null) return run;
  const paused = Math.max(0, nowMs - run.pausedAtMs);
  return {
    ...run,
    pausedAtMs: null,
    stepPausedMs: run.stepPausedMs + paused,
    totalPausedMs: run.totalPausedMs + paused,
  };
}

/** „Beenden“: Lauf vorzeitig abschließen. Die laufende Übung zählt nicht (nur Erledigtes wird gespeichert). */
export function endWorkoutRun(
  steps: readonly WorkoutTimerStep[],
  run: WorkoutRun,
  nowMs: number,
): WorkoutRun {
  const current = resumeWorkoutRun(advanceWorkoutRun(steps, run, nowMs), nowMs);
  if (current.finishedAtMs !== null) return current;
  return { ...current, finishedAtMs: Math.max(nowMs, current.stepStartedAtMs) };
}

export interface WorkoutRunView {
  readonly finished: boolean;
  readonly paused: boolean;
  /** Laufender Schritt (null = fertig). */
  readonly step: WorkoutTimerStep | null;
  readonly index: number;
  /** Restsekunden des Zeit-Schritts (aufgerundet); null = nach Wiederholungen oder fertig. */
  readonly remainingS: number | null;
  readonly stepElapsedS: number;
  /** Nächster Übungs-Schritt („Als Nächstes“, auch während einer Pause); null = keiner mehr. */
  readonly nextWork: WorkoutWorkStep | null;
  /** Aktive Zeit seit dem Start ohne Pausen des Timers. */
  readonly activeS: number;
  readonly workDone: number;
  readonly workSkipped: number;
  readonly workTotal: number;
  /** Runde, in der der Lauf steht (bei Pausen: die kommende), und Runden insgesamt. */
  readonly round: number;
  readonly rounds: number;
}

/** Anzeige-Stand nach `nowMs` (rechnet abgelaufene Zeit-Schritte vorher weiter). */
export function workoutRunView(
  steps: readonly WorkoutTimerStep[],
  input: WorkoutRun,
  nowMs: number,
): { run: WorkoutRun; view: WorkoutRunView } {
  const run = advanceWorkoutRun(steps, input, nowMs);
  const finished = run.finishedAtMs !== null;
  const step = finished ? null : (steps[run.index] ?? null);
  const elapsedMs = finished ? 0 : stepElapsedMs(run, nowMs);
  const seconds = step === null ? null : stepSeconds(step);
  const works = steps.filter((s): s is WorkoutWorkStep => s.kind === 'work');
  const nextWork =
    (steps.slice(run.index + (step?.kind === 'work' ? 1 : 0)).find((s) => s.kind === 'work') as
      WorkoutWorkStep | undefined) ?? null;
  const roundSource = step?.kind === 'work' ? step : nextWork;
  const rounds = works.reduce((max, s) => Math.max(max, s.round), 1);
  const endMs = run.finishedAtMs ?? run.pausedAtMs ?? nowMs;
  return {
    run,
    view: {
      finished,
      paused: run.pausedAtMs !== null,
      step,
      index: run.index,
      remainingS: seconds === null ? null : Math.max(0, Math.ceil(seconds - elapsedMs / 1000)),
      stepElapsedS: Math.floor(elapsedMs / 1000),
      nextWork: finished ? null : nextWork,
      activeS: Math.max(0, Math.floor((endMs - run.startedAtMs - pausedTotal(run, endMs)) / 1000)),
      workDone: run.results.filter((r) => r?.status === 'done').length,
      workSkipped: run.results.filter((r) => r?.status === 'skipped').length,
      workTotal: works.length,
      round: roundSource?.round ?? rounds,
      rounds,
    },
  };
}

/** Pausen insgesamt bis `atMs` (eine laufende Pause zählt bis dahin mit). */
function pausedTotal(run: WorkoutRun, atMs: number): number {
  return run.totalPausedMs + (run.pausedAtMs === null ? 0 : Math.max(0, atMs - run.pausedAtMs));
}

/** Zusammenfassung je Übung (für den Tagebuch-Eintrag). */
export interface WorkoutItemSummary {
  readonly itemIndex: number;
  readonly exerciseId: string;
  /** Erledigte Durchgänge (Runden bzw. Sätze) mit ihren Sekunden. */
  readonly done: readonly { readonly pass: number; readonly seconds: number }[];
  readonly skipped: number;
  readonly total: number;
}

export interface WorkoutRunSummary {
  readonly items: readonly WorkoutItemSummary[];
  /** Runden, in denen jede Übung erledigt wurde (Sätze × Wdh.: 1, wenn alles erledigt). */
  readonly roundsCompleted: number;
  readonly rounds: number;
  readonly workDone: number;
  readonly workTotal: number;
  /** Alles erledigt (nichts übersprungen, nicht vorzeitig beendet). */
  readonly complete: boolean;
  /** Aktive Zeit ohne Pausen des Timers, in Sekunden. */
  readonly activeS: number;
}

export function workoutRunSummary(
  steps: readonly WorkoutTimerStep[],
  run: WorkoutRun,
  nowMs: number,
): WorkoutRunSummary {
  const { view } = workoutRunView(steps, run, nowMs);
  const works = steps
    .map((step, index) => ({ step, result: run.results[index] ?? null }))
    .filter(
      (x): x is { step: WorkoutWorkStep; result: WorkoutStepResult | null } =>
        x.step.kind === 'work',
    );
  const itemIndexes = [...new Set(works.map((w) => w.step.itemIndex))].sort((a, b) => a - b);
  const items = itemIndexes.map((itemIndex): WorkoutItemSummary => {
    const own = works.filter((w) => w.step.itemIndex === itemIndex);
    return {
      itemIndex,
      exerciseId: own[0]?.step.exerciseId ?? '',
      done: own
        .filter((w) => w.result?.status === 'done')
        .map((w) => ({ pass: w.step.pass, seconds: w.result?.seconds ?? 0 })),
      skipped: own.filter((w) => w.result?.status === 'skipped').length,
      total: own.length,
    };
  });
  const rounds = view.rounds;
  let roundsCompleted = 0;
  for (let round = 1; round <= rounds; round += 1) {
    const inRound = works.filter((w) => w.step.round === round);
    if (inRound.length > 0 && inRound.every((w) => w.result?.status === 'done')) {
      roundsCompleted += 1;
    }
  }
  return {
    items,
    roundsCompleted,
    rounds,
    workDone: view.workDone,
    workTotal: view.workTotal,
    complete: view.workDone === view.workTotal,
    activeS: view.activeS,
  };
}

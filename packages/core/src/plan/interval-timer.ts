import type { WorkoutStep } from './intensity';

/**
 * Intervall-Timer im Trainingsmodus (docs/PLAN-PHASE-10.md Abschnitt 8, Etappe WP4): Schritt für Schritt aus den
 * gespeicherten Schritten einer Einheit (`workout_steps`, WP2/WP3) – Aufwärmen → Hauptteil (z. B. 6 × 3 min zügig /
 * 2 min locker) → Abwärmen. Reine Funktionen über Millisekunden-Zeitpunkte (die App übergibt `Date.now()`), damit der
 * Timer offline läuft, Pause/Weiter kennt und nach einem Neuzeichnen denselben Stand zeigt. Keine KI, keine Regeln zur
 * Dosierung – die stehen in den Schritten (endurance-workouts.ts).
 */

/** Uhr des Timers: Start, laufende Pause und Summe der Pausen (alles in ms). */
export interface IntervalClock {
  /** null = noch nicht gestartet. */
  readonly startedAtMs: number | null;
  /** Gesetzt = gerade pausiert (seit diesem Zeitpunkt). */
  readonly pausedAtMs: number | null;
  /** Summe abgeschlossener Pausen. */
  readonly pausedMs: number;
}

export const INTERVAL_CLOCK_IDLE: IntervalClock = {
  startedAtMs: null,
  pausedAtMs: null,
  pausedMs: 0,
};

export function clockStart(nowMs: number): IntervalClock {
  return { startedAtMs: nowMs, pausedAtMs: null, pausedMs: 0 };
}

export function clockPause(clock: IntervalClock, nowMs: number): IntervalClock {
  if (clock.startedAtMs === null || clock.pausedAtMs !== null) return clock;
  return { ...clock, pausedAtMs: Math.max(nowMs, clock.startedAtMs) };
}

export function clockResume(clock: IntervalClock, nowMs: number): IntervalClock {
  if (clock.startedAtMs === null || clock.pausedAtMs === null) return clock;
  return {
    ...clock,
    pausedAtMs: null,
    pausedMs: clock.pausedMs + Math.max(0, nowMs - clock.pausedAtMs),
  };
}

/** Gelaufene Sekunden ohne Pausen (ganze Sekunden, nie negativ – auch wenn die Geräte-Uhr zurückspringt). */
export function clockElapsedS(clock: IntervalClock, nowMs: number): number {
  if (clock.startedAtMs === null) return 0;
  const until = clock.pausedAtMs ?? nowMs;
  return Math.max(0, Math.floor((until - clock.startedAtMs - clock.pausedMs) / 1000));
}

/** Stand im Ablauf der Schritte. */
export interface IntervalPosition {
  /** Index des laufenden Schritts (am Ende: der letzte). */
  readonly index: number;
  readonly step: WorkoutStep;
  /** Nächster Schritt (null = letzter). */
  readonly next: WorkoutStep | null;
  readonly stepElapsedS: number;
  readonly stepRemainingS: number;
  readonly elapsedS: number;
  readonly totalS: number;
  readonly remainingS: number;
  readonly finished: boolean;
  /** „Teile geschafft“ (Plan 3.6): vollständig absolvierte Belastungs-Abschnitte im Hauptteil … */
  readonly workDone: number;
  /** … von allen Belastungs-Abschnitten. */
  readonly workTotal: number;
  /** Nummer des laufenden Belastungs-Abschnitts (1-basiert), null = gerade kein Belastungs-Abschnitt. */
  readonly workNo: number | null;
}

export function intervalTotalS(steps: readonly WorkoutStep[]): number {
  return steps.reduce((sum, s) => sum + s.seconds, 0);
}

/** Stand nach `elapsedS` gelaufenen Sekunden. Leere Liste ist ein Programmierfehler (Schema: 1–40 Schritte). */
export function intervalPosition(
  steps: readonly WorkoutStep[],
  elapsedS: number,
): IntervalPosition {
  if (steps.length === 0) throw new RangeError('Ein Timer braucht mindestens einen Schritt.');
  const totalS = intervalTotalS(steps);
  const elapsed = Math.min(Math.max(0, Math.floor(elapsedS)), totalS);
  const isWork = (s: WorkoutStep) => s.part === 'main' && s.kind === 'work';
  const workTotal = steps.filter(isWork).length;
  let start = 0;
  let workDone = 0;
  let workSeen = 0;
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i] as WorkoutStep;
    const end = start + step.seconds;
    if (isWork(step)) workSeen += 1;
    const last = i === steps.length - 1;
    if (elapsed < end || last) {
      const finished = elapsed >= totalS;
      if (finished && isWork(step)) workDone += 1;
      return {
        index: i,
        step,
        next: steps[i + 1] ?? null,
        stepElapsedS: elapsed - start,
        stepRemainingS: Math.max(0, end - elapsed),
        elapsedS: elapsed,
        totalS,
        remainingS: totalS - elapsed,
        finished,
        workDone,
        workTotal,
        workNo: isWork(step) && !finished ? workSeen : null,
      };
    }
    if (isWork(step)) workDone += 1;
    start = end;
  }
  // Unerreichbar (die Schleife endet spätestens beim letzten Schritt).
  throw new RangeError('Timer-Stand nicht bestimmbar.');
}

/**
 * Minuten für „Abbrechen und eintragen“ bzw. nach dem Ende: gelaufene Zeit auf ganze Minuten gerundet, mindestens 1
 * (Tagebuch: Dauer ab 1 min), höchstens die geplante Dauer der Schritte (der Timer läuft nie darüber hinaus).
 */
export function intervalLoggedMinutes(steps: readonly WorkoutStep[], elapsedS: number): number {
  const elapsed = Math.min(Math.max(0, elapsedS), intervalTotalS(steps));
  return Math.max(1, Math.round(elapsed / 60));
}

/**
 * Übersicht der Schritte (nur Anzeige, z. B. „6 × 3 min zügig, dazwischen 2 min locker“): einzelne Abschnitte oder eine
 * Wiederholung gleicher Belastungs-Abschnitte mit gleicher Pause dazwischen (eine Pause direkt nach der letzten
 * Belastung gehört dazu, z. B. bei Steigerungen).
 */
export type IntervalBlock =
  | { readonly kind: 'single'; readonly step: WorkoutStep }
  | {
      readonly kind: 'repeat';
      readonly work: WorkoutStep;
      /** Pause zwischen den Wiederholungen (null = direkt hintereinander). */
      readonly rest: WorkoutStep | null;
      readonly repeats: number;
    };

const sameStep = (a: WorkoutStep | undefined, b: WorkoutStep | undefined): boolean =>
  a !== undefined &&
  b !== undefined &&
  a.part === b.part &&
  a.kind === b.kind &&
  a.seconds === b.seconds &&
  a.effort === b.effort;

export function intervalBlocks(steps: readonly WorkoutStep[]): IntervalBlock[] {
  const blocks: IntervalBlock[] = [];
  let i = 0;
  while (i < steps.length) {
    const work = steps[i] as WorkoutStep;
    if (work.kind !== 'work') {
      blocks.push({ kind: 'single', step: work });
      i += 1;
      continue;
    }
    let repeats = 1;
    let rest: WorkoutStep | null = null;
    let j = i + 1;
    for (;;) {
      const between = steps[j];
      if (sameStep(steps[j], work)) {
        if (rest !== null) break;
        repeats += 1;
        j += 1;
        continue;
      }
      if (
        between !== undefined &&
        between.kind !== 'work' &&
        between.part === work.part &&
        (rest === null ? repeats === 1 : sameStep(between, rest)) &&
        sameStep(steps[j + 1], work)
      ) {
        rest = between;
        repeats += 1;
        j += 2;
        continue;
      }
      break;
    }
    if (repeats === 1) {
      blocks.push({ kind: 'single', step: work });
      i += 1;
      continue;
    }
    blocks.push({ kind: 'repeat', work, rest, repeats });
    // Pause direkt nach der letzten Belastung (Steigerungen) gehört zur Wiederholung.
    if (rest !== null && sameStep(steps[j], rest)) j += 1;
    i = j;
  }
  return blocks;
}

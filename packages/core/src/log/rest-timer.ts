import { REST_TIMER } from '../constants';

/**
 * Pausentimer als reine Zeitrechnung mit Zeitstempeln (docs/PLAN-PHASE-4.md Abschnitt 5.5): kein Zähler, der im
 * Hintergrund oder bei Bildschirmsperre stehen bleibt – die Restzeit ergibt sich immer aus „jetzt“.
 */
export interface RestTimer {
  readonly startedAtMs: number;
  /** Gesamtdauer der Pause in Sekunden (0–600). */
  readonly durationS: number;
}

function clampRest(seconds: number): number {
  return Math.min(REST_TIMER.maxS, Math.max(REST_TIMER.minS, Math.round(seconds)));
}

export function startRest(restS: number, nowMs: number): RestTimer {
  return { startedAtMs: nowMs, durationS: clampRest(restS) };
}

/** Restzeit in ganzen Sekunden (aufgerundet, nie negativ). */
export function remainingSeconds(timer: RestTimer, nowMs: number): number {
  const leftMs = timer.startedAtMs + timer.durationS * 1000 - nowMs;
  return leftMs <= 0 ? 0 : Math.ceil(leftMs / 1000);
}

export function isRestOver(timer: RestTimer, nowMs: number): boolean {
  return remainingSeconds(timer, nowMs) === 0;
}

/** −15 s / +15 s (beliebige Sekunden möglich): Gesamtdauer bleibt in 0–600 s. */
export function adjustRest(timer: RestTimer, deltaS: number): RestTimer {
  return { ...timer, durationS: clampRest(timer.durationS + deltaS) };
}

/** Eine Übung im Trainingsmodus (planned_exercises). */
export interface RestExercise {
  readonly order_no: number;
  readonly rest_s: number;
  readonly superset_group: string | null;
}

/**
 * Pause nach einem Satz: `next` = Übung des nächsten Satzes (null = Training zu Ende → keine Pause). Innerhalb
 * eines Supersatzes (gleiche `superset_group`) keine Pause, solange die nächste Übung der Gruppe in der Reihenfolge
 * danach kommt; nach der letzten Übung der Gruppe (nächste Runde beginnt wieder vorne) die geplante Pause.
 */
export function restAfterSet(current: RestExercise, next: RestExercise | null): number {
  if (next === null) return 0;
  if (
    current.superset_group !== null &&
    next.superset_group === current.superset_group &&
    next.order_no > current.order_no
  ) {
    return 0;
  }
  return clampRest(current.rest_s);
}

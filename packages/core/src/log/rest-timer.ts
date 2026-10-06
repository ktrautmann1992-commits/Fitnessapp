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

/** Eine Übung im Trainingsmodus mit ihren Sätzen (für die Reihenfolge der Sätze). */
export interface RestSetExercise extends RestExercise {
  /** Anzahl der Satz-Zeilen. */
  readonly setCount: number;
  /** „Nicht gemacht“ – zählt in der Reihenfolge nicht. */
  readonly skipped: boolean;
}

/**
 * Übung des NÄCHSTEN Satzes nach Satz `setIndex` der Übung `index` – Reihenfolge wie im Trainingsmodus: ohne
 * Supersatz Satz für Satz, dann die nächste Übung; im Supersatz (gleiche `superset_group`) in Runden (A1, A2, A1, …),
 * nach der letzten Runde die erste Übung nach der Gruppe. null = Training zu Ende.
 */
export function nextSetExercise(
  exercises: readonly RestSetExercise[],
  index: number,
  setIndex: number,
): RestSetExercise | null {
  const current = exercises[index];
  if (!current) return null;
  const active = exercises.filter((e) => !e.skipped);
  const after = (orderNo: number, exclude: string | null) =>
    active
      .filter((e) => e.order_no > orderNo && (exclude === null || e.superset_group !== exclude))
      .sort((a, b) => a.order_no - b.order_no)[0] ?? null;
  if (current.superset_group === null) {
    if (setIndex + 1 < current.setCount) return current;
    return after(current.order_no, null);
  }
  const group = current.superset_group;
  const members = active
    .filter((e) => e.superset_group === group)
    .sort((a, b) => a.order_no - b.order_no);
  const sameRound = members.find((e) => e.order_no > current.order_no && e.setCount > setIndex);
  if (sameRound) return sameRound;
  const nextRound = members.find((e) => e.setCount > setIndex + 1);
  if (nextRound) return nextRound;
  const last = Math.max(current.order_no, ...members.map((e) => e.order_no));
  return after(last, group);
}

/** Pause nach dem Abhaken eines Satzes (0 = keine Pause: im Supersatz weiter bzw. Training zu Ende). */
export function restAfterCheckedSet(
  exercises: readonly RestSetExercise[],
  index: number,
  setIndex: number,
): number {
  const current = exercises[index];
  if (!current) return 0;
  return restAfterSet(current, nextSetExercise(exercises, index, setIndex));
}

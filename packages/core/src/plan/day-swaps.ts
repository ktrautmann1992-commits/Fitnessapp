import { z } from 'zod';

import { isoDateSchema } from '../age';
import { DAY_SWAP_LIMITS } from '../constants';
import { contentIdSchema } from '../content/schemas';
import type { PlannedSessionKind, PlannedSessionStatus } from '../enums';
import { canCatchUp } from '../log/summary';
import {
  type ExercisePair,
  type PreferenceContext,
  replaceShownExercise,
  swapCandidates,
  type SwapRecord,
} from './preferences';
import type { ReschedulableSession } from './reschedule';

/**
 * „Nur heute“ vor dem Training (Day-Swaps, docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 5.1/7.2, Wächter B3/S5, N1/N2).
 * Gespeichert nur im Gerätespeicher der App (`fitnessapp.day-swaps.v1`, kein Gesundheitsdatum, nicht
 * geräteübergreifend); hier liegt die GESAMTE Fachlogik: Prüfen beim Lesen (Zod, Konto), Anwenden bei JEDER Anzeige
 * mit erneuter Prüfung gegen die aktuellen Regeln und Aufräumen. Das PDF wendet Day-Swaps nie an.
 */

const timestamp = z.iso.datetime({ offset: true });

export const daySwapSchema = z
  .strictObject({
    /** Konto (wie Entwürfe, R5) – gelesen wird nur das eigene. */
    ownerUserId: z.uuid(),
    planId: z.uuid(),
    /** planned_sessions.id – bleibt beim Verschieben gleich. */
    sessionId: z.uuid(),
    /** Datum beim Tausch (nur zur Info; Verfall am AKTUELLEN scheduled_on). */
    scheduledOn: isoDateSchema,
    storedOrderNo: z.number().int().min(1).max(DAY_SWAP_LIMITS.maxStoredOrderNo),
    /** Gespeicherte Übung S – wird beim Anwenden verglichen. */
    storedExerciseId: contentIdSchema,
    alternativeId: contentIdSchema,
    createdAt: timestamp,
  })
  .refine((s) => s.alternativeId !== s.storedExerciseId, {
    path: ['alternativeId'],
    message: 'Die Alternative muss eine andere Übung sein.',
  });

export type DaySwap = z.output<typeof daySwapSchema>;

/**
 * Day-Swaps aus dem (nicht vertrauenswürdigen) Gerätespeicher lesen: ungültiges JSON bzw. kein Array → leer;
 * jeder Eintrag einzeln mit daySwapSchema geprüft (kaputte verworfen, nie angezeigt); nur Einträge des Kontos.
 */
export function parseStoredDaySwaps(raw: string | null, ownerUserId: string): DaySwap[] {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const parsed = daySwapSchema.safeParse(item);
    return parsed.success && parsed.data.ownerUserId === ownerUserId ? [parsed.data] : [];
  });
}

const sameSlot = (a: DaySwap, b: Pick<DaySwap, 'ownerUserId' | 'sessionId' | 'storedOrderNo'>) =>
  a.ownerUserId === b.ownerUserId &&
  a.sessionId === b.sessionId &&
  a.storedOrderNo === b.storedOrderNo;

/**
 * Day-Swap anlegen bzw. ersetzen (je Konto, Einheit und gespeicherter Übung höchstens einer). Über
 * DAY_SWAP_LIMITS.maxEntries fallen die ältesten Einträge weg.
 */
export function upsertDaySwap(list: readonly DaySwap[], swap: DaySwap): DaySwap[] {
  const next = [...list.filter((s) => !sameSlot(s, swap)), swap];
  if (next.length <= DAY_SWAP_LIMITS.maxEntries) return next;
  const sorted = [...next].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const drop = new Set(sorted.slice(0, next.length - DAY_SWAP_LIMITS.maxEntries));
  return next.filter((s) => !drop.has(s));
}

export function removeDaySwap(
  list: readonly DaySwap[],
  slot: Pick<DaySwap, 'ownerUserId' | 'sessionId' | 'storedOrderNo'>,
): DaySwap[] {
  return list.filter((s) => !sameSlot(s, slot));
}

/** Einheit, für die Day-Swaps gelten (die angezeigte, gespeicherte Einheit). */
export interface DaySwapSession {
  readonly id: string;
  readonly kind: PlannedSessionKind;
  readonly status: PlannedSessionStatus;
  /** AKTUELLES Datum (nach Verschieben). */
  readonly scheduled_on: string;
}

export interface DaySwapContext extends PreferenceContext {
  /** Plan, zu dem die Einheit gehört. */
  readonly planId: string;
  /** Angemeldetes Konto (Wächter T1-K2): Swaps anderer Konten gelten nie, auch wenn die Liste ungefiltert ist. */
  readonly ownerUserId: string;
  readonly today: string;
  /**
   * Darf die Einheit heute nachgeholt werden (canCatchUp, Wächter N1)? Dann gilt der Swap auch, wenn ihr aktuelles
   * Datum in der Vergangenheit liegt.
   */
  readonly catchUpToday?: boolean;
}

export interface DaySwapLayerResult {
  readonly pairs: readonly ExercisePair[];
  readonly daySwapped: readonly SwapRecord[];
  /** Ungültige bzw. verfallene Swaps dieser Einheit – die App räumt sie aus dem Speicher. */
  readonly droppedDaySwaps: readonly DaySwap[];
}

/**
 * Day-Swaps einer Einheit anwenden (läuft INNERHALB von prepareSessionForDisplay nach den Präferenzen, bei JEDER
 * Anzeige). Ein Swap gilt nur, wenn: Einheit und Plan passen, die Einheit `planned` ist, ihr AKTUELLES Datum heute
 * oder später liegt (oder sie heute nachgeholt werden darf, N1), die gespeicherte Übung an `storedOrderNo` noch
 * `storedExerciseId` ist und die Alternative für dieses Paar ein Kandidat nach swapCandidates('today') ist – mit den
 * aktuellen Regeln, dem Ort, den Präferenzen und der Einheit VOR dem Einsetzen dieses Swaps (N2: sonst machte sich
 * der Ersatz über S-6 selbst ungültig). Mehrere Swaps einer Einheit laufen der Reihe nach (`storedOrderNo`), jeder
 * sieht die früheren. Swaps anderer Einheiten werden ignoriert (nicht gemeldet). Ungültige fallen still weg und
 * stehen in `droppedDaySwaps`. `kind !== 'strength'` → unverändert.
 */
export function applyDaySwaps(
  pairs: readonly ExercisePair[],
  session: DaySwapSession,
  swaps: readonly DaySwap[],
  ctx: DaySwapContext,
): DaySwapLayerResult {
  const own = swaps
    .filter((s) => s.sessionId === session.id)
    .sort((a, b) => a.storedOrderNo - b.storedOrderNo || (a.createdAt < b.createdAt ? -1 : 1));
  if (session.kind !== 'strength' || own.length === 0) {
    return { pairs, daySwapped: [], droppedDaySwaps: [] };
  }
  const lookup = ctx.lookup ?? ctx.library;
  const result = [...pairs];
  const daySwapped: SwapRecord[] = [];
  const dropped: DaySwap[] = [];
  const active =
    session.status === 'planned' &&
    (session.scheduled_on >= ctx.today || (ctx.catchUpToday ?? false));
  const done = new Set<number>();
  for (const swap of own) {
    const index = result.findIndex((p) => p.storedOrderNo === swap.storedOrderNo);
    const pair = index === -1 ? undefined : result[index];
    if (
      !active ||
      swap.ownerUserId !== ctx.ownerUserId ||
      swap.planId !== ctx.planId ||
      pair === undefined ||
      done.has(swap.storedOrderNo) ||
      pair.stored.exercise_id !== swap.storedExerciseId
    ) {
      dropped.push(swap);
      continue;
    }
    const found = swapCandidates(pair, {
      ...ctx,
      inSession: new Set(result.map((p) => p.shown.exercise_id)),
      mode: 'today',
    });
    const chosen = found.candidates.find((c) => c.id === swap.alternativeId);
    if (!chosen) {
      dropped.push(swap);
      continue;
    }
    done.add(swap.storedOrderNo);
    result[index] = {
      ...pair,
      shown: replaceShownExercise(pair.shown, lookup.get(pair.shown.exercise_id), chosen),
    };
    daySwapped.push({
      storedOrderNo: pair.storedOrderNo,
      from: pair.shown.exercise_id,
      to: chosen.id,
    });
  }
  return { pairs: result, daySwapped, droppedDaySwaps: dropped };
}

/**
 * Day-Swaps aufräumen (beim Laden der App; rein): verworfen werden Einträge, deren Einheit fehlt, nicht mehr
 * `planned` ist (erledigt/gestrichen), deren AKTUELLES Datum vor heute liegt und die heute nicht nachgeholt werden
 * darf (canCatchUp, N1), oder deren Plan ersetzt wurde (`activePlanId`; ohne aktiven Plan alle).
 */
export function pruneDaySwaps(
  swaps: readonly DaySwap[],
  sessions: readonly ReschedulableSession[],
  options: { readonly today: string; readonly activePlanId: string | null },
): DaySwap[] {
  return swaps.filter((swap) => {
    if (options.activePlanId === null || swap.planId !== options.activePlanId) return false;
    const session = sessions.find((s) => s.id === swap.sessionId);
    if (!session || session.status !== 'planned') return false;
    return session.scheduled_on >= options.today || canCatchUp(sessions, session.id, options.today);
  });
}

import { z } from 'zod';

import { isoDateSchema } from '../age';
import { addDays, startOfIsoWeek } from '../dates';
import type { SessionFocus } from '../enums';
import { isHardWorkoutType } from './intensity';
import type { ReschedulableSession } from './reschedule';

/**
 * Trainingskalender – Verschieben mit frei gewähltem Ziel-Tag und Tauschen (docs/PLAN-AUSWERTUNG.md 2.6 und 3, Etappe
 * A1a; Gründer-Entscheidung A-G4: Tauschen JA). Dieselben Regeln wie `rescheduleSession()` – beide nutzen
 * `moveBlockReason()` (eine Regel, eine Stelle):
 *
 * - nur ab heute und nur in derselben ISO-Woche wie `coalesce(original_date, scheduled_on)` (Datenbank-Trigger
 *   private.planned_sessions_before_update bzw. public.swap_planned_sessions),
 * - Erholungswoche: nur streichen,
 * - nie zwei Einheiten am Tag (gestrichene belegen keinen Tag; erledigte KONSERVATIV schon, siehe reschedule.ts),
 * - 48 h zwischen Kraft-Einheiten mit gleichen Muskeln (Ganzkörper trifft alles); lockere Ausdauer ist nie ein Konflikt,
 * - Wettkampfplan (Phase 10 WP2): harte Ausdauer nie neben Kraft mit Beinen, harter Ausdauer oder dem langen Lauf,
 * - erledigte, gestrichene Einheiten und Einheiten ersetzter Pläne sind fest.
 *
 * Alle Gründe sind HARTE Sperren, keine Warnungen. Die 48-h-Regel prüft nur der Core – die Datenbank verhindert das
 * Stapeln und prüft Datum/Woche/Erholungswoche/aktiven Plan (Präzisierung A1a, docs/PLAN-AUSWERTUNG.md Umsetzungsstand).
 */
export interface MovableSession extends ReschedulableSession {
  /**
   * Gehört die Einheit zum AKTIVEN Plan? Nur solche Einheiten sind änderbar (Trigger „Nur Einheiten des aktiven Plans“).
   * Fehlt = ja (Aufrufer ohne Plan-Bezug, z. B. Tests von rescheduleSession).
   */
  readonly in_active_plan?: boolean;
}

/**
 * Gründe, warum ein Tag nicht geht:
 * - `not_found`: Einheit unbekannt,
 * - `not_planned`: erledigt, gestrichen oder aus einem ersetzten Plan (fest),
 * - `deload_skip_only`: Erholungswoche – nur streichen,
 * - `past`: vor heute (auch: Woche ist vorbei),
 * - `other_week`: andere ISO-Woche als der ursprüngliche Termin,
 * - `current`: die Einheit liegt schon an diesem Tag,
 * - `occupied`: belegt (und Tauschen geht nicht, weil die andere Einheit fest ist),
 * - `recovery_48h`: Kraft-Einheit mit gleichen Muskeln am Nachbartag,
 * - `hard_endurance_48h` (Phase 10 WP2): harte Ausdauer (Fahrtspiel, Tempo, Intervalle, Renntempo) neben Kraft mit
 *   Beinen (Ganzkörper/Unterkörper), neben einer anderen harten Einheit oder neben dem langen Lauf.
 */
export type MoveBlockReason =
  | 'not_found'
  | 'not_planned'
  | 'deload_skip_only'
  | 'past'
  | 'other_week'
  | 'current'
  | 'occupied'
  | 'recovery_48h'
  | 'hard_endurance_48h';

/** Nachbar-Einheit, die die 48-h-Regel verletzen würde (für den Text „Zu nah an deiner … am Mittwoch“). */
export interface RecoveryConflict {
  readonly sessionId: string;
  readonly date: string;
}

export type MoveCheck =
  | { readonly ok: true; readonly kind: 'move' }
  /** Ziel-Tag ist belegt, beide Einheiten erfüllen nach dem Tausch alle Regeln. */
  | { readonly ok: true; readonly kind: 'swap'; readonly otherSessionId: string }
  | {
      readonly ok: false;
      readonly reason: MoveBlockReason;
      /** Gesetzt, wenn der Tag belegt ist: mit dieser Einheit wäre getauscht worden. */
      readonly otherSessionId?: string;
      /** Der Grund betrifft die ANDERE Einheit (Tausch): z. B. sie käme in die Vergangenheit. */
      readonly partner?: boolean;
      readonly conflict?: RecoveryConflict;
    };

export type SwapCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: MoveBlockReason;
      /** Der Grund betrifft die zweite Einheit (`b`). */
      readonly partner: boolean;
      readonly conflict?: RecoveryConflict;
    };

/** Ein Tag der Woche im Kalender: erlaubt (verschieben oder tauschen) oder gesperrt mit Grund. */
export interface MoveTarget {
  readonly date: string;
  readonly allowed: boolean;
  /** Nur bei erlaubt: einfach verschieben oder mit der Einheit am Ziel-Tag tauschen. */
  readonly kind?: 'move' | 'swap';
  readonly reason?: MoveBlockReason;
  readonly otherSessionId?: string;
  readonly partner?: boolean;
  readonly conflict?: RecoveryConflict;
}

/**
 * Würden zwei Einheiten an Nachbartagen dieselben Muskeln ohne 48 h Pause treffen? Nur Kraft gegen Kraft – lockere
 * Ausdauer ist nie ein Konflikt (PRODUKTENTSCHEIDUNG, Erweiterungsplan 5.4). `null` = Ausdauer bzw. kein Nachbar.
 * Auch von `rescheduleSession` (reschedule.ts) genutzt – eine Regel, eine Stelle.
 */
export function recoveryConflict(a: SessionFocus | null, b: SessionFocus | null): boolean {
  if (a === null || b === null) return false;
  return a === 'full_body' || b === 'full_body' || a === b;
}

/** Schwerpunkt für die 48-h-Regel: Kraft → `focus`, Ausdauer → null (nie ein Konflikt). */
export function recoveryFocus(
  s: Pick<ReschedulableSession, 'kind' | 'focus'>,
): SessionFocus | null {
  return (s.kind ?? 'strength') === 'strength' ? s.focus : null;
}

/** Belastungs-Merkmale einer Einheit für die erweiterte 48-h-Regel (Plan 3.5/6). */
interface Load {
  readonly focus: SessionFocus | null;
  readonly hard: boolean;
  readonly long: boolean;
  readonly legs: boolean;
}

function loadOf(s: Pick<ReschedulableSession, 'kind' | 'focus' | 'workout_type'>): Load {
  const strength = (s.kind ?? 'strength') === 'strength';
  return {
    focus: recoveryFocus(s),
    hard: !strength && isHardWorkoutType(s.workout_type),
    long: !strength && s.workout_type === 'long',
    legs: strength && (s.focus === 'full_body' || s.focus === 'lower'),
  };
}

/**
 * Erweiterte 48-h-Regel (Phase 10 WP2): harte Ausdauer ↔ Kraft mit Beinen, harte ↔ harte Ausdauer, harte Ausdauer ↔
 * langer Lauf. Ohne Wettkampf-Arten nie ein Konflikt (bestehendes Verhalten).
 */
export function hardEnduranceConflict(a: Load, b: Load): boolean {
  if (a.hard) return b.hard || b.legs || b.long;
  if (b.hard) return a.legs || a.long;
  return false;
}

/** Montag der ISO-Woche, in der die Einheit verschoben werden darf (Woche des URSPRÜNGLICHEN Tages). */
export function moveWeekStart(
  session: Pick<ReschedulableSession, 'original_date' | 'scheduled_on'>,
) {
  return startOfIsoWeek(session.original_date ?? session.scheduled_on);
}

/** Belegt die Einheit ihren Tag? Gestrichene nicht; erledigte konservativ schon (nie zwei Trainings am Tag). */
function occupies(s: ReschedulableSession): boolean {
  return s.status !== 'skipped';
}

/** Ist die Einheit selbst änderbar? Sonst Grund für ALLE Tage. */
function sessionBlockReason(session: MovableSession): MoveBlockReason | null {
  if (session.status !== 'planned' || session.in_active_plan === false) return 'not_planned';
  if (session.is_deload) return 'deload_skip_only';
  return null;
}

/** Datum allein (Woche, Vergangenheit, gleicher Tag) – wie der Trigger plus „schon dort“. */
function dateBlockReason(
  session: ReschedulableSession,
  date: string,
  today: string,
): MoveBlockReason | null {
  if (startOfIsoWeek(date) !== moveWeekStart(session)) return 'other_week';
  if (date < today) return 'past';
  if (date === session.scheduled_on) return 'current';
  return null;
}

/**
 * 48-h-Regel für `focus` an `date` gegen die Einheiten `placed` (Stand NACH dem Verschieben/Tauschen). Jede Einheit
 * an einem Nachbartag zählt (auch mehrere, z. B. erledigte des alten Plans neben einer geplanten).
 */
function recoveryBlock(
  load: Load,
  date: string,
  placed: readonly {
    readonly id: string;
    readonly date: string;
    readonly load: Load;
  }[],
): {
  readonly reason: 'recovery_48h' | 'hard_endurance_48h';
  readonly conflict: RecoveryConflict;
} | null {
  const neighbours = new Set([addDays(date, -1), addDays(date, 1)]);
  const near = placed.filter((p) => neighbours.has(p.date));
  const strength = near.find((p) => recoveryConflict(p.load.focus, load.focus));
  if (strength) {
    return { reason: 'recovery_48h', conflict: { sessionId: strength.id, date: strength.date } };
  }
  const hard = near.find((p) => hardEnduranceConflict(load, p.load));
  return hard
    ? { reason: 'hard_endurance_48h', conflict: { sessionId: hard.id, date: hard.date } }
    : null;
}

/** Einheiten, die ihren Tag belegen, als (id, Tag, Schwerpunkt) – ohne die übergebenen Ausnahmen. */
function placedSessions(sessions: readonly ReschedulableSession[], without: readonly string[]) {
  return sessions
    .filter((s) => occupies(s) && !without.includes(s.id))
    .map((s) => ({ id: s.id, date: s.scheduled_on, load: loadOf(s) }));
}

/**
 * Sperrgrund für das reine VERSCHIEBEN von `session` auf `date` (Ziel-Tag frei) oder null. Grundlage von
 * `rescheduleSession()` und `validateMove()`.
 */
export function moveBlockReason(
  sessions: readonly MovableSession[],
  session: MovableSession,
  date: string,
  today: string,
): { readonly reason: MoveBlockReason; readonly conflict?: RecoveryConflict } | null {
  const own = sessionBlockReason(session);
  if (own) return { reason: own };
  const byDate = dateBlockReason(session, date, today);
  if (byDate) return { reason: byDate };
  const placed = placedSessions(sessions, [session.id]);
  if (placed.some((p) => p.date === date)) return { reason: 'occupied' };
  return recoveryBlock(loadOf(session), date, placed);
}

/**
 * Tauschen (A-G4): `a` kommt auf den Tag von `b` und umgekehrt – nur, wenn BEIDE Einheiten danach alle Regeln
 * erfüllen (dieselben wie beim Verschieben). Die Datenbank prüft dasselbe ohne 48-h-Regel (swap_planned_sessions).
 */
export function validateSwap(
  sessions: readonly MovableSession[],
  aId: string,
  bId: string,
  today: string,
): SwapCheck {
  const a = sessions.find((s) => s.id === aId);
  const b = sessions.find((s) => s.id === bId);
  if (!a) return { ok: false, reason: 'not_found', partner: false };
  if (!b) return { ok: false, reason: 'not_found', partner: true };
  if (a.id === b.id) return { ok: false, reason: 'current', partner: false };
  for (const [session, date, partner] of [
    [a, b.scheduled_on, false],
    [b, a.scheduled_on, true],
  ] as const) {
    const own = sessionBlockReason(session);
    // Die andere Einheit ist fest (erledigt, gestrichen, alter Plan) → der Tag ist einfach belegt.
    if (own)
      return { ok: false, reason: partner && own === 'not_planned' ? 'occupied' : own, partner };
    const byDate = dateBlockReason(session, date, today);
    if (byDate) return { ok: false, reason: byDate, partner };
  }
  // Stand nach dem Tausch: alle anderen bleiben, a und b wechseln die Tage.
  const placed = [
    ...placedSessions(sessions, [a.id, b.id]),
    { id: a.id, date: b.scheduled_on, load: loadOf(a) },
    { id: b.id, date: a.scheduled_on, load: loadOf(b) },
  ];
  for (const [session, date, partner] of [
    [a, b.scheduled_on, false],
    [b, a.scheduled_on, true],
  ] as const) {
    // Keine weitere Einheit am neuen Tag (z. B. erledigte des alten Plans neben der geplanten).
    if (
      placed.some((p) => p.date === date && p.id !== session.id && p.id !== a.id && p.id !== b.id)
    ) {
      return { ok: false, reason: 'occupied', partner };
    }
    const blocked = recoveryBlock(
      loadOf(session),
      date,
      placed.filter((p) => p.id !== session.id),
    );
    if (blocked) return { ok: false, reason: blocked.reason, partner, conflict: blocked.conflict };
  }
  return { ok: true };
}

/**
 * Darf `sessionId` auf `targetDate`? Freier Tag → verschieben; belegter Tag → tauschen, wenn `validateSwap` es erlaubt
 * (A-G4). Für das Ablegen beim Ziehen, das Menü „Verschieben …“ und als Vorprüfung vor dem Senden an den Server.
 */
export function validateMove(
  sessions: readonly MovableSession[],
  sessionId: string,
  targetDate: string,
  today: string,
): MoveCheck {
  const date = isoDateSchema.parse(targetDate);
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return { ok: false, reason: 'not_found' };
  const own = sessionBlockReason(session);
  if (own) return { ok: false, reason: own };
  const byDate = dateBlockReason(session, date, today);
  if (byDate) return { ok: false, reason: byDate };
  const occupants = sessions.filter(
    (s) => s.id !== session.id && occupies(s) && s.scheduled_on === date,
  );
  if (occupants.length > 0) {
    // Mehr als eine Einheit am Ziel-Tag (z. B. erledigte + geplante) oder eine feste → kein Tausch.
    const other = occupants.find((s) => s.status === 'planned') ?? occupants[0];
    if (occupants.length > 1 || !other) {
      return other
        ? { ok: false, reason: 'occupied', otherSessionId: other.id }
        : { ok: false, reason: 'occupied' };
    }
    const swap = validateSwap(sessions, session.id, other.id, today);
    if (swap.ok) return { ok: true, kind: 'swap', otherSessionId: other.id };
    return {
      ok: false,
      reason: swap.reason,
      otherSessionId: other.id,
      partner: swap.partner,
      ...(swap.conflict ? { conflict: swap.conflict } : {}),
    };
  }
  const blocked = moveBlockReason(sessions, session, date, today);
  if (blocked) return { ok: false, ...blocked };
  return { ok: true, kind: 'move' };
}

/**
 * Für JEDEN Tag der Woche (Mo–So, Woche des ursprünglichen Termins): erlaubt (verschieben/tauschen) oder Grund.
 * Unbekannte Einheit → leere Liste.
 */
export function moveTargets(
  sessions: readonly MovableSession[],
  sessionId: string,
  today: string,
): MoveTarget[] {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return [];
  const monday = moveWeekStart(session);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const check = validateMove(sessions, sessionId, date, today);
    if (check.ok) {
      return check.kind === 'swap'
        ? { date, allowed: true, kind: 'swap', otherSessionId: check.otherSessionId }
        : { date, allowed: true, kind: 'move' };
    }
    return {
      date,
      allowed: false,
      reason: check.reason,
      ...(check.otherSessionId !== undefined ? { otherSessionId: check.otherSessionId } : {}),
      ...(check.partner !== undefined ? { partner: check.partner } : {}),
      ...(check.conflict !== undefined ? { conflict: check.conflict } : {}),
    };
  });
}

/** Erster erlaubter Tag zum reinen Verschieben (ohne Tausch) – genau der Tag, den `rescheduleSession` wählt. */
export function firstMoveDay(targets: readonly MoveTarget[]): string | null {
  return targets.find((t) => t.allowed && t.kind === 'move')?.date ?? null;
}

// ---------------------------------------------------------------------------------------------------------
// Zod an der Grenze (App → Server, Warteschlange): Einheit verschieben bzw. zwei Einheiten tauschen.
// ---------------------------------------------------------------------------------------------------------
export const moveRequestSchema = z
  .object({
    sessionId: z.uuid(),
    targetDate: isoDateSchema,
  })
  .strict();
export type MoveRequest = z.infer<typeof moveRequestSchema>;

export const swapRequestSchema = z
  .object({
    sessionId: z.uuid(),
    otherSessionId: z.uuid(),
    /** Tage, an denen beide Einheiten laut geprüftem Stand liegen (Server tauscht nur, wenn sie noch stimmen). */
    sessionOn: isoDateSchema,
    otherSessionOn: isoDateSchema,
  })
  .strict()
  .refine((value) => value.sessionId !== value.otherSessionId, {
    message: 'Eine Einheit lässt sich nicht mit sich selbst tauschen.',
    path: ['otherSessionId'],
  });
export type SwapRequest = z.infer<typeof swapRequestSchema>;

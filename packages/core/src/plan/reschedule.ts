import { addDays, startOfIsoWeek } from '../dates';
import type { PlannedSessionKind, PlannedSessionStatus, SessionFocus } from '../enums';

/**
 * Verpasste Einheiten neu planen – „verschieben oder streichen, nie stapeln“ (docs/PLAN-PHASE-3.md 5.11).
 * Die Datenbank prüft zusätzlich die Grundregeln als harte Grenze (Trigger private.planned_sessions_before_update:
 * ab heute, dieselbe ISO-Woche, Erholungseinheiten nur streichen, nie stapeln); die 48-h-Erholungsregel
 * zwischen Nachbartagen prüft nur diese Funktion.
 */
export interface ReschedulableSession {
  readonly id: string;
  readonly scheduled_on: string;
  /** Ursprünglicher Tag, gesetzt beim ersten Verschieben. */
  readonly original_date: string | null;
  /**
   * `completed` (Phase 4) belegt den Tag hier wie `planned` – bewusst KONSERVATIV: In der Datenbank belegt eine
   * erledigte Einheit ihren Tag nicht mehr (PLAN-PHASE-4 Umsetzungsstand B, Festlegung 1; Wächter S4), die App bietet
   * das Verschieben auf einen Tag mit erledigter Einheit trotzdem nicht an (nie zwei Einheiten an einem Tag
   * trainieren).
   */
  readonly status: PlannedSessionStatus | 'completed';
  /** Kraft oder Ausdauer (Erweiterungsplan 5.4); fehlt = Kraft (Pläne der Engine-Version 1). */
  readonly kind?: PlannedSessionKind;
  /** Kraft: Schwerpunkt; Ausdauer: null. */
  readonly focus: SessionFocus | null;
  readonly is_deload: boolean;
}

export type RescheduleResult =
  | { readonly kind: 'moved'; readonly date: string; readonly originalDate: string }
  | { readonly kind: 'skipped' }
  | { readonly kind: 'not_allowed'; readonly reason: 'not_found' | 'not_planned' };

/**
 * Würden zwei Einheiten an Nachbartagen dieselben Muskeln ohne 48 h Pause treffen? Nur Kraft gegen Kraft – lockere
 * Ausdauer ist nie ein Konflikt (PRODUKTENTSCHEIDUNG, Erweiterungsplan 5.4).
 */
function conflicts(a: SessionFocus | null, b: SessionFocus | null): boolean {
  if (a === null || b === null) return false;
  return a === 'full_body' || b === 'full_body' || a === b;
}

/**
 * Sucht den nächsten freien Tag ab heute in derselben ISO-Woche wie der ursprünglich geplante Tag
 * (`coalesce(original_date, scheduled_on)`), der die Erholungsregel einhält (Kraft nur gegen Kraft-Nachbarn;
 * Ausdauer darf auf jeden freien Tag); sonst streichen. Nie zwei Einheiten am Tag.
 * In der Erholungswoche wird immer gestrichen. `sessions` = alle Einheiten der Person (auch anderer Pläne).
 */
export function rescheduleSession(
  sessions: readonly ReschedulableSession[],
  sessionId: string,
  today: string,
): RescheduleResult {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return { kind: 'not_allowed', reason: 'not_found' };
  if (session.status !== 'planned') return { kind: 'not_allowed', reason: 'not_planned' };
  if (session.is_deload) return { kind: 'skipped' };
  const originalDate = session.original_date ?? session.scheduled_on;
  const weekStart = startOfIsoWeek(originalDate);
  const sunday = addDays(weekStart, 6);
  const others = sessions.filter((s) => s.id !== session.id && s.status !== 'skipped');
  const focusOf = (s: ReschedulableSession) =>
    (s.kind ?? 'strength') === 'strength' ? s.focus : null;
  const occupied = new Map(others.map((s) => [s.scheduled_on, focusOf(s)] as const));
  const own = focusOf(session);
  const start = today > weekStart ? today : weekStart;
  for (let date = start; date <= sunday; date = addDays(date, 1)) {
    if (date === session.scheduled_on || occupied.has(date)) continue;
    const before = occupied.get(addDays(date, -1));
    const after = occupied.get(addDays(date, 1));
    if (conflicts(before ?? null, own) || conflicts(after ?? null, own)) {
      continue;
    }
    return { kind: 'moved', date, originalDate };
  }
  return { kind: 'skipped' };
}

/** Liegt `date` in derselben ISO-Woche wie `reference`? (Regel des Datenbank-Triggers.) */
export function isSameIsoWeek(date: string, reference: string): boolean {
  return startOfIsoWeek(date) === startOfIsoWeek(reference);
}

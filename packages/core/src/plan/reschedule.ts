import { addDays, startOfIsoWeek } from '../dates';
import type { PlannedSessionStatus, SessionFocus } from '../enums';

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
  readonly status: PlannedSessionStatus;
  readonly focus: SessionFocus;
  readonly is_deload: boolean;
}

export type RescheduleResult =
  | { readonly kind: 'moved'; readonly date: string; readonly originalDate: string }
  | { readonly kind: 'skipped' }
  | { readonly kind: 'not_allowed'; readonly reason: 'not_found' | 'not_planned' };

/** Würden zwei Einheiten an Nachbartagen dieselben Muskeln ohne 48 h Pause treffen? */
function conflicts(a: SessionFocus, b: SessionFocus): boolean {
  return a === 'full_body' || b === 'full_body' || a === b;
}

/**
 * Sucht den nächsten freien Tag ab heute in derselben ISO-Woche wie der ursprünglich geplante Tag
 * (`coalesce(original_date, scheduled_on)`), der die Erholungsregel einhält; sonst streichen.
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
  const occupied = new Map(others.map((s) => [s.scheduled_on, s.focus] as const));
  const start = today > weekStart ? today : weekStart;
  for (let date = start; date <= sunday; date = addDays(date, 1)) {
    if (date === session.scheduled_on || occupied.has(date)) continue;
    const before = occupied.get(addDays(date, -1));
    const after = occupied.get(addDays(date, 1));
    if (
      (before && conflicts(before, session.focus)) ||
      (after && conflicts(after, session.focus))
    ) {
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

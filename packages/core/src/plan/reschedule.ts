import { addDays, startOfIsoWeek } from '../dates';
import type { PlannedSessionKind, PlannedSessionStatus, SessionFocus } from '../enums';
import type { WorkoutType } from './intensity';
import { moveBlockReason } from './move';

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
  /**
   * Nur Wettkampfplan (Phase 10 WP2): Art der Ausdauer-Einheit – harte Arten und der lange Lauf zählen für die
   * erweiterte 48-h-Regel (`hard_endurance_48h`). Fehlt → wie bisher (lockere Ausdauer, nie ein Konflikt).
   */
  readonly workout_type?: WorkoutType | null;
}

export type RescheduleResult =
  | { readonly kind: 'moved'; readonly date: string; readonly originalDate: string }
  | { readonly kind: 'skipped' }
  | { readonly kind: 'not_allowed'; readonly reason: 'not_found' | 'not_planned' };

/**
 * Sucht den nächsten freien Tag ab heute in derselben ISO-Woche wie der ursprünglich geplante Tag
 * (`coalesce(original_date, scheduled_on)`), der die Erholungsregel einhält (Kraft nur gegen Kraft-Nachbarn;
 * lockere Ausdauer darf auf jeden freien Tag; harte Ausdauer des Wettkampfplans nie neben Kraft mit Beinen, harter
 * Ausdauer oder dem langen Lauf – Phase 10 WP2); sonst streichen (verpasste harte Einheit: „streichen statt stapeln“). Nie zwei Einheiten am Tag. Seit Etappe A1a über
 * `moveBlockReason()` (move.ts) – dieselbe Regel wie der Kalender; an einem Nachbartag zählt JEDE Einheit (vorher nur
 * eine je Tag, konservativer).
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
  // Dieselbe Prüfung wie der Kalender (move.ts, Etappe A1a): erster Tag ohne Sperrgrund, ab Montag der Woche –
  // Tage vor heute und der eigene Tag sind dort gesperrt.
  for (let index = 0; index < 7; index += 1) {
    const date = addDays(weekStart, index);
    if (moveBlockReason(sessions, session, date, today) === null) {
      return { kind: 'moved', date, originalDate };
    }
  }
  return { kind: 'skipped' };
}

/** Liegt `date` in derselben ISO-Woche wie `reference`? (Regel des Datenbank-Triggers.) */
export function isSameIsoWeek(date: string, reference: string): boolean {
  return startOfIsoWeek(date) === startOfIsoWeek(reference);
}

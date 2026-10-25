import {
  type LogRows,
  logEntriesFromRows,
  type StrengthComparison,
  strengthComparison,
  strengthOverview,
  type StrengthOverviewItem,
  type StrengthSession,
  strengthSessionIndex,
  strengthSessions,
} from '@fitnessapp/core';

import { historyExercises } from './log-summary';

/**
 * Kraft-Entwicklung in der App (Gründer-Freigabe 25.10.2026): nur Zusammensetzen aus den Tagebuch-Zeilen – die Regeln
 * (Kennzahlen, Zeiträume, Vergleich) stehen in packages/core (`log/strength-progress.ts`). Grundlage wie im Verlauf:
 * der geladene Zeitraum (Supabase: 12 Wochen) plus online nachgeladene ältere Einträge. Nie loggen.
 */

/** Einheiten einer Übung, älteste zuerst. */
export function exerciseStrengthSessions(rows: LogRows, exerciseId: string): StrengthSession[] {
  return strengthSessions(exerciseId, logEntriesFromRows(rows));
}

/**
 * Vergleich je Übung eines Eintrags („Kniebeuge: +5 kg gegenüber vor 4 Wochen“), Schlüssel = `exercise_logs.id`.
 * Übersprungene Übungen und Übungen ohne Wert fehlen.
 */
export function logStrengthComparisons(
  rows: LogRows,
  logId: string,
): Map<string, StrengthComparison> {
  const log = rows.sessionLogs.find((l) => l.id === logId);
  const result = new Map<string, StrengthComparison>();
  if (!log) return result;
  const entries = logEntriesFromRows(rows);
  const at = { performedOn: log.performed_on, loggedAt: log.finished_at ?? log.client_updated_at };
  for (const e of rows.exerciseLogs.filter((x) => x.session_log_id === logId)) {
    if (e.status === 'skipped') continue;
    const sessions = strengthSessions(e.exercise_id, entries);
    const index = strengthSessionIndex(sessions, at);
    if (index < 0) continue;
    result.set(e.id, strengthComparison(sessions, index));
  }
  return result;
}

export interface StrengthTileItem extends StrengthOverviewItem {
  /** Name aus dem neuesten Eintrag (wie „Verlauf je Übung“). */
  readonly name: string;
}

/** Kachel „Kraft-Entwicklung“: höchstens 3 Übungen mit Namen (packages/core `strengthOverview`). */
export function strengthTileItems(rows: LogRows, today: string): StrengthTileItem[] {
  const names = new Map(historyExercises(rows).map((e) => [e.exerciseId, e.name] as const));
  return strengthOverview(logEntriesFromRows(rows), today).map((item) => ({
    ...item,
    name: names.get(item.exerciseId) ?? item.exerciseId,
  }));
}

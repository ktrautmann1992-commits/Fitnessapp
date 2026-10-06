import type { SummaryLog, SummarySession } from '@fitnessapp/core';

import { type LogRows, mergeLogRows } from './log-rows';
import type {
  CardioLogRow,
  ExerciseLogRow,
  PlannedSessionRow,
  SessionLogRow,
  SetLogRow,
  UserRows,
} from './types';

/**
 * Woche und Verlauf (docs/PLAN-PHASE-4.md 5.6, 6.1 Punkte 4–5, Etappe D): Abbildung der Zeilen auf die Eingaben von
 * weekLogSummary()/historyByWeek()/exerciseHistory() aus packages/core. Nur Abbildung, keine Regeln. Rein, getestet.
 */

/** Geplante Einheiten und Tagebuch-Einträge als Eingabe der Wochenübersicht. */
export function summaryInputs(
  rows: Pick<
    UserRows,
    'plans' | 'plannedSessions' | 'sessionLogs' | 'exerciseLogs' | 'setLogs' | 'cardioLogs'
  >,
): { sessions: SummarySession[]; logs: SummaryLog[] } {
  const activePlans = new Set(rows.plans.filter((p) => p.status === 'active').map((p) => p.id));
  const sessions = rows.plannedSessions.map((s: PlannedSessionRow): SummarySession => ({
    id: s.id,
    scheduled_on: s.scheduled_on,
    original_date: s.original_date,
    status: s.status,
    kind: s.kind,
    focus: s.focus,
    name_de: s.name_de,
    plan_active: activePlans.has(s.plan_id),
  }));
  return { sessions, logs: summaryLogs(rows) };
}

/** Einträge mit abgehakten Kraft-Sätzen und Ausdauer-Summen. */
export function summaryLogs(rows: LogRows): SummaryLog[] {
  const exerciseOf = new Map(rows.exerciseLogs.map((e) => [e.id, e.session_log_id] as const));
  const doneSets = new Map<string, number>();
  for (const set of rows.setLogs) {
    const logId = exerciseOf.get(set.exercise_log_id);
    if (logId !== undefined && set.done) doneSets.set(logId, (doneSets.get(logId) ?? 0) + 1);
  }
  const cardio = new Map(rows.cardioLogs.map((c) => [c.session_log_id, c] as const));
  return rows.sessionLogs.map((l) => ({
    id: l.id,
    planned_session_id: l.planned_session_id,
    performed_on: l.performed_on,
    kind: l.kind,
    status: l.status,
    name_de: l.name_de,
    done_sets: doneSets.get(l.id) ?? 0,
    cardio_duration_s: cardio.get(l.id)?.duration_s ?? null,
    cardio_distance_m: cardio.get(l.id)?.distance_m ?? null,
  }));
}

/** Nur die Einträge ab `since` (samt Übungen, Sätzen, Ausdauer). */
export function logRowsSince(rows: LogRows, since: string): LogRows {
  const keep = new Set(rows.sessionLogs.filter((l) => l.performed_on >= since).map((l) => l.id));
  const exercises = rows.exerciseLogs.filter((e) => keep.has(e.session_log_id));
  const exerciseIds = new Set(exercises.map((e) => e.id));
  return {
    sessionLogs: rows.sessionLogs.filter((l) => keep.has(l.id)),
    exerciseLogs: exercises,
    setLogs: rows.setLogs.filter((s) => exerciseIds.has(s.exercise_log_id)),
    cardioLogs: rows.cardioLogs.filter((c) => keep.has(c.session_log_id)),
  };
}

/**
 * Einträge für den Verlauf: aus dem Gerätespeicher nur der VOLLSTÄNDIG geladene Zeitraum (`since`; Supabase: die
 * letzten LOG_CACHE_WEEKS Wochen – ältere Einheiten aus recent_exercise_logs() enthalten nur einzelne Übungen),
 * dazu online nachgeladene ältere Einträge.
 */
export function historyLogRows(rows: LogRows, older: LogRows, since: string | null): LogRows {
  return mergeLogRows(since === null ? rows : logRowsSince(rows, since), older);
}

/** Ein Eintrag mit allem, was die Detailansicht zeigt. */
export interface LogDetail {
  log: SessionLogRow;
  exercises: { row: ExerciseLogRow; sets: SetLogRow[] }[];
  cardio: CardioLogRow | null;
}

export function logDetail(rows: LogRows, logId: string): LogDetail | null {
  const log = rows.sessionLogs.find((l) => l.id === logId);
  if (!log) return null;
  const exercises = rows.exerciseLogs
    .filter((e) => e.session_log_id === logId)
    .sort((a, b) => a.order_no - b.order_no)
    .map((row) => ({
      row,
      sets: rows.setLogs
        .filter((s) => s.exercise_log_id === row.id)
        .sort((a, b) => a.set_no - b.set_no),
    }));
  return {
    log,
    exercises,
    cardio: rows.cardioLogs.find((c) => c.session_log_id === logId) ?? null,
  };
}

/** Übungen im Verlauf (für „Verlauf je Übung“): Name des neuesten Eintrags, Zahl der Einträge, alphabetisch. */
export interface HistoryExercise {
  exerciseId: string;
  name: string;
  count: number;
  lastOn: string;
}

export function historyExercises(rows: LogRows): HistoryExercise[] {
  const dates = new Map(rows.sessionLogs.map((l) => [l.id, l.performed_on] as const));
  const byExercise = new Map<string, HistoryExercise>();
  for (const e of rows.exerciseLogs) {
    const date = dates.get(e.session_log_id);
    if (date === undefined || e.status === 'skipped') continue;
    const current = byExercise.get(e.exercise_id);
    if (!current) {
      byExercise.set(e.exercise_id, {
        exerciseId: e.exercise_id,
        name: e.exercise_name_de,
        count: 1,
        lastOn: date,
      });
    } else {
      current.count += 1;
      if (date >= current.lastOn) {
        current.lastOn = date;
        current.name = e.exercise_name_de;
      }
    }
  }
  return [...byExercise.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

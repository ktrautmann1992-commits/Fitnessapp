import {
  type DayItem,
  type EquipmentLocation,
  incrementKindFor,
  type PlanLibrary,
  planSnapshot,
  profilesFor,
  type SessionAchievementInput,
  sessionLocationInfo,
  weekLogSummary,
  weightStepsFor,
} from '@fitnessapp/core';

import { summaryInputs } from './log-summary';
import type { UserRows } from './types';

/**
 * „Dein Tag“ (docs/PLAN-AUSWERTUNG.md Abschnitt 6, Etappe A2): Abbildung der Zeilen auf die Eingaben von
 * `dayEvaluation()`/`sessionAchievement()` aus packages/core – Einheiten des Tages (`weekLogSummary`), Vorgaben aus dem
 * Schnappschuss des Eintrags (`exercise_logs.target_*`), Sätze, Ausdauer und Gewichtsstufen. Nur Abbildung, keine
 * Regeln, rein und getestet. Nie loggen.
 */

/** Einheiten und Einträge eines Tages (wie in „Woche“). */
export function dayTrainingItems(rows: UserRows, date: string, today: string): DayItem[] {
  const { sessions, logs } = summaryInputs(rows);
  const summary = weekLogSummary(sessions, logs, date, today);
  return [...(summary.days.find((d) => d.date === date)?.items ?? [])];
}

/**
 * Eingaben des Erfüllungsgrads je Eintrag des Tages. `library` = Übungs-Bibliothek (für die Art der Gewichtssteigerung
 * und eigene Gewichtsstufen); null = nicht geladen → ohne Stufe darunter (nur die Vorgabe zählt, sichere Richtung).
 */
export function dayAchievementInputs(
  rows: UserRows,
  date: string,
  library: PlanLibrary | null,
): Map<string, SessionAchievementInput> {
  const result = new Map<string, SessionAchievementInput>();
  const logs = rows.sessionLogs.filter((l) => l.performed_on === date);
  const lookup = library ? (library.displayExercises ?? library.exercises) : null;
  for (const log of logs) {
    const planned = log.planned_session_id
      ? (rows.plannedSessions.find((s) => s.id === log.planned_session_id) ?? null)
      : null;
    const easyWeek = log.is_deload ? 'recovery' : log.is_intro_week ? 'intro' : null;
    const isFree = log.is_free === true;
    if (log.kind === 'endurance') {
      const cardio = rows.cardioLogs.find((c) => c.session_log_id === log.id) ?? null;
      result.set(log.id, {
        kind: 'endurance',
        isFree,
        easyWeek,
        plannedMinutes: planned?.estimated_minutes ?? null,
        effortTarget: planned?.effort_target ?? null,
        durationS: cardio?.duration_s ?? null,
        distanceM: cardio?.distance_m ?? null,
        sessionRpe: log.session_rpe,
      });
      continue;
    }
    // Gewichtsstufen am Ort der Einheit (Geräte aus den Angaben des Plans).
    const plan = planned ? rows.plans.find((p) => p.id === planned.plan_id) : undefined;
    const snapshot = plan ? planSnapshot(plan) : null;
    const location: EquipmentLocation | null = planned
      ? sessionLocationInfo(planned, snapshot?.schedule ?? null).location
      : null;
    const profile = location ? profilesFor(snapshot).get(location) : undefined;
    const exercises = rows.exerciseLogs
      .filter((e) => e.session_log_id === log.id)
      .sort((a, b) => a.order_no - b.order_no)
      .map((e) => {
        const exercise = lookup?.get(e.exercise_id);
        return {
          status: e.status,
          loadType: e.load_type,
          targetSets: e.target_sets,
          repsMin: e.reps_min,
          targetReps: e.target_reps,
          targetWeightKg: e.target_weight_kg,
          targetDurationS: e.target_duration_s,
          incrementKind: exercise ? incrementKindFor(exercise) : null,
          steps: exercise && profile ? [...weightStepsFor(exercise, profile)] : [],
          sets: rows.setLogs
            .filter((s) => s.exercise_log_id === e.id)
            .sort((a, b) => a.set_no - b.set_no)
            .map((s) => ({
              done: s.done,
              reps: s.reps,
              weightKg: s.weight_kg,
              durationS: s.duration_s,
            })),
        };
      });
    result.set(log.id, { kind: 'strength', isFree, easyWeek, exercises });
  }
  return result;
}

/** Namen der Übungen eines Eintrags (für „3/3 Sätze“), Reihenfolge wie `dayAchievementInputs`. */
export function dayExerciseNames(rows: UserRows, logId: string): string[] {
  return rows.exerciseLogs
    .filter((e) => e.session_log_id === logId)
    .sort((a, b) => a.order_no - b.order_no)
    .map((e) => e.exercise_name_de);
}

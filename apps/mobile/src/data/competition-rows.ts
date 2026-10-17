import {
  type CompetitionCheck,
  checkCancelCompetition,
  checkCompleteCompetition,
  checkSaveCompetition,
  competitionDistanceM,
  type SaveCompetitionPayload,
} from '@fitnessapp/core';

import { healthPlanBasis, healthScreeningForPlan } from './training-plan';
import type { ConsentVersions } from './mapping';
import type { CompetitionRow, UserRows } from './types';

/**
 * Wettkämpfe im TESTMODUS (Etappe WP4) – dieselben Regeln wie die Datenbank-Funktionen save_competition,
 * cancel_competition, complete_competition und delete_competition (20261016140200_competition_rpcs.sql). Die Prüfungen
 * selbst stehen in packages/core (competition-rules.ts); hier nur das Anwenden auf die Zeilen. Rein und getestet
 * (competition-rows.test.ts).
 */

export function checkSaveInRows(
  rows: UserRows,
  payload: SaveCompetitionPayload,
  ctx: { today: string; versions: ConsentVersions },
): CompetitionCheck {
  if (!rows.profile) return { ok: false, reason: 'invalid' };
  const basis = healthPlanBasis(rows, ctx.versions);
  const screening = healthScreeningForPlan(rows, ctx.versions);
  return checkSaveCompetition(payload, {
    today: ctx.today,
    birthDate: rows.profile.birth_date,
    usesHealthData: basis.usesHealthData,
    medicalNotice: basis.medicalNotice,
    pregnancy: screening?.flags.includes('pregnancy') ?? false,
    existing: rows.competitions,
  });
}

/** Zieldatum des Ausdauer-Ziels mitführen (Abwärtskompatibilität wie save/cancel/delete_competition). */
function withTargetDate(rows: UserRows, date: string | null, onlyIf?: string): UserRows {
  const goals = rows.goals;
  if (!goals || goals.goal_type !== 'endurance') return rows;
  if (onlyIf !== undefined && goals.target_date !== onlyIf) return rows;
  if (goals.target_date === date) return rows;
  return { ...rows, goals: { ...goals, target_date: date } };
}

/** Anlegen bzw. ganz ersetzen (nach checkSaveInRows). Liefert neue Zeilen und die ID. */
export function applySaveCompetition(
  rows: UserRows,
  payload: SaveCompetitionPayload,
  ctx: { userId: string; now: string; newId: () => string },
): { rows: UserRows; id: string } {
  const existing = payload.id ? rows.competitions.find((c) => c.id === payload.id) : undefined;
  const id = existing?.id ?? ctx.newId();
  const row: CompetitionRow = {
    id,
    user_id: ctx.userId,
    name: payload.name,
    discipline: payload.discipline,
    distance_m: competitionDistanceM(payload.discipline),
    race_date: payload.race_date,
    goal_kind: payload.goal_kind,
    target_time_s: payload.target_time_s,
    reference_discipline: payload.reference_discipline,
    reference_time_s: payload.reference_time_s,
    reference_date: payload.reference_date,
    long_run_weekday: payload.long_run_weekday,
    status: 'planned',
    result_session_log_id: null,
    own_start_weekly_minutes: payload.own_start_weekly_minutes,
    start_reference_volume: payload.start_reference_volume,
    start_reference_session_cap: payload.start_reference_session_cap,
    start_reference_start_group: payload.start_reference_start_group,
    effective_goal: payload.effective_goal,
    uses_health_data: payload.effective_goal !== null,
    created_at: existing?.created_at ?? ctx.now,
    updated_at: ctx.now,
  };
  const competitions = existing
    ? rows.competitions.map((c) => (c.id === id ? row : c))
    : [...rows.competitions, row];
  return { rows: withTargetDate({ ...rows, competitions }, payload.race_date), id };
}

export function cancelInRows(
  rows: UserRows,
  id: string,
  now: string,
): { ok: true; rows: UserRows } | Extract<CompetitionCheck, { ok: false }> {
  const check = checkCancelCompetition(id, rows.competitions);
  if (!check.ok) return check;
  const row = rows.competitions.find((c) => c.id === id) as CompetitionRow;
  const next = {
    ...rows,
    competitions: rows.competitions.map((c) =>
      c.id === id ? { ...c, status: 'cancelled' as const, updated_at: now } : c,
    ),
  };
  return { ok: true, rows: withTargetDate(next, null, row.race_date) };
}

export function completeInRows(
  rows: UserRows,
  id: string,
  logId: string | null,
  ctx: { today: string; now: string },
): { ok: true; rows: UserRows } | Extract<CompetitionCheck, { ok: false }> {
  const check = checkCompleteCompetition(id, logId, {
    today: ctx.today,
    existing: rows.competitions,
    logs: rows.sessionLogs,
  });
  if (!check.ok) return check;
  return {
    ok: true,
    rows: {
      ...rows,
      competitions: rows.competitions.map((c) =>
        c.id === id
          ? { ...c, status: 'done' as const, result_session_log_id: logId, updated_at: ctx.now }
          : c,
      ),
    },
  };
}

export function deleteInRows(
  rows: UserRows,
  id: string,
): { ok: true; rows: UserRows } | { ok: false; reason: 'not_found' } {
  const row = rows.competitions.find((c) => c.id === id);
  if (!row) return { ok: false, reason: 'not_found' };
  const next = { ...rows, competitions: rows.competitions.filter((c) => c.id !== id) };
  return {
    ok: true,
    rows: row.status === 'planned' ? withTargetDate(next, null, row.race_date) : next,
  };
}

/** Wird ein Tagebuch-Eintrag gelöscht, bleibt der Wettkampf erledigt, nur der Verweis wird leer (on delete set null). */
export function detachResultLog(rows: UserRows, logId: string): UserRows {
  if (!rows.competitions.some((c) => c.result_session_log_id === logId)) return rows;
  return {
    ...rows,
    competitions: rows.competitions.map((c) =>
      c.result_session_log_id === logId ? { ...c, result_session_log_id: null } : c,
    ),
  };
}

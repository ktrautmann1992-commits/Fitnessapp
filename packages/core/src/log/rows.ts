import { addDays, startOfIsoWeek } from '../dates';
import type {
  EnduranceModality,
  ExerciseLogStatus,
  LoadType,
  LogSource,
  PlannedSessionKind,
  SessionLogStatus,
} from '../enums';
import type { PlannedSessionRow, PlanRowRef } from '../plan/rows';
import type { SessionLogPayload } from './schemas';
import type { ExerciseLogEntry, ExerciseProgress, LoggedSet } from './types';
import { neutralSessionName } from './workout';

/**
 * Trainingstagebuch als Zeilen (docs/PLAN-PHASE-4.md 3.2, 4.6; umgezogen aus der App in Etappe A0 von
 * docs/PLAN-PHASE-4B.md 5.1): Abbildung zwischen dem Eintrag (save_session_log-Payload) und den Tabellen
 * session_logs/exercise_logs/set_logs/cardio_logs sowie Zeilen → Eingaben der Progression – EINE Abbildung für
 * App (Testmodus mit gleicher Wirkung wie die Datenbank-Funktionen, Anzeige noch nicht gesendeter Einträge) und
 * Server. Nur Abbildung, keine Regeln (die prüft der Testmodus der App bzw. die Datenbank). Rein, ohne Speicher-
 * oder Netzzugriff.
 *
 * Die Zeilen-Typen spiegeln die Spalten der Datenbank (packages/db/src/database.types.ts); dass beide gleich
 * bleiben, prüft apps/mobile/src/data/row-types.test.ts zur Übersetzungszeit.
 */

/** Zeile aus session_logs. */
export interface SessionLogRow {
  id: string;
  user_id: string;
  planned_session_id: string | null;
  kind: PlannedSessionKind;
  performed_on: string;
  started_at: string | null;
  finished_at: string | null;
  status: SessionLogStatus;
  session_rpe: number | null;
  notes: string | null;
  name_de: string;
  is_intro_week: boolean;
  is_deload: boolean;
  from_health_plan: boolean;
  revision: number;
  last_write_id: string;
  source: LogSource;
  client_updated_at: string;
  created_at: string;
  updated_at: string;
}

/** Zeile aus exercise_logs. */
export interface ExerciseLogRow {
  id: string;
  session_log_id: string;
  user_id: string;
  order_no: number;
  planned_exercise_id: string | null;
  exercise_id: string;
  exercise_name_de: string;
  load_type: LoadType;
  status: ExerciseLogStatus;
  target_sets: number | null;
  reps_min: number | null;
  reps_max: number | null;
  target_reps: number | null;
  target_extra_set: boolean | null;
  target_weight_kg: number | null;
  target_duration_s: number | null;
  target_rpe: number | null;
  state_weight_kg: number | null;
  state_target_reps: number | null;
  state_extra_set: boolean | null;
  state_duration_s: number | null;
  weight_confirmed: boolean;
  is_return: boolean;
}

/** Zeile aus set_logs. */
export interface SetLogRow {
  exercise_log_id: string;
  user_id: string;
  set_no: number;
  reps: number | null;
  weight_kg: number | null;
  duration_s: number | null;
  rpe: number | null;
  done: boolean;
}

/** Zeile aus cardio_logs. */
export interface CardioLogRow {
  session_log_id: string;
  user_id: string;
  modality: EnduranceModality;
  duration_s: number;
  distance_m: number | null;
  elevation_m: number | null;
}

/** Zeile aus exercise_start_weights. */
export interface StartWeightRow {
  exercise_id: string;
  user_id: string;
  weight_kg: number;
  updated_at: string;
}

/** Nur die Tagebuch-Zeilen (z. B. für den geschützten Tagebuch-Zwischenspeicher der App). */
export interface LogRows {
  sessionLogs: SessionLogRow[];
  exerciseLogs: ExerciseLogRow[];
  setLogs: SetLogRow[];
  cardioLogs: CardioLogRow[];
}

/** Tagebuch-Zeilen samt geplanter Einheiten (Erledigt-Status beim Speichern). */
export type LogAndSessionRows = LogRows & { plannedSessions: PlannedSessionRow[] };

/** Tagebuch-Zeilen samt Plänen und geplanter Einheiten (Löschen, verpasste Einheiten). */
export type LogAndPlanRows = LogAndSessionRows & { plans: PlanRowRef[] };

export interface ApplyLogMeta {
  userId: string;
  /** Eintrag gehört zu einer (noch) bekannten geplanten Einheit; sonst verwaist (planned_session_id = null). */
  linked: boolean;
  /** Vorgaben und Zustand übernehmen (sonst neutral wie beim Widerruf, S1/B4). */
  keepTargets: boolean;
  fromHealthPlan: boolean;
  /** Gespeicherte id (beim Ersetzen über planned_session_id die bestehende). */
  id: string;
  revision: number;
  now: string;
  /** Server-Wahrheit bei bekannter Einheit (Festlegung 3); sonst aus dem Eintrag. */
  isIntroWeek: boolean;
  isDeload: boolean;
}

/** Ersetzt den Eintrag (gleiche id) bzw. legt ihn neu an – samt Übungen, Sätzen und Ausdauer. */
export function applySessionLog<T extends LogAndSessionRows>(
  rows: T,
  payload: SessionLogPayload,
  meta: ApplyLogMeta,
): T {
  const without = removeSessionLog(rows, meta.id);
  const previous = rows.sessionLogs.find((log) => log.id === meta.id);
  const sessionLog: SessionLogRow = {
    id: meta.id,
    user_id: meta.userId,
    planned_session_id: meta.linked ? payload.planned_session_id : null,
    kind: payload.kind,
    performed_on: payload.performed_on,
    started_at: payload.started_at,
    finished_at: payload.finished_at,
    status: payload.status,
    session_rpe: payload.session_rpe,
    notes: payload.notes,
    name_de: meta.keepTargets ? payload.name_de : neutralSessionName(payload.kind),
    is_intro_week: meta.isIntroWeek,
    is_deload: meta.isDeload,
    from_health_plan: meta.fromHealthPlan,
    revision: meta.revision,
    last_write_id: payload.write_id,
    source: payload.source,
    client_updated_at: payload.client_updated_at < meta.now ? payload.client_updated_at : meta.now,
    created_at: previous?.created_at ?? meta.now,
    updated_at: meta.now,
  };
  const exerciseLogs: ExerciseLogRow[] = [];
  const setLogs: SetLogRow[] = [];
  for (const e of payload.exercises) {
    exerciseLogs.push({
      id: e.id,
      session_log_id: meta.id,
      user_id: meta.userId,
      order_no: e.order_no,
      planned_exercise_id: meta.linked ? e.planned_exercise_id : null,
      exercise_id: e.exercise_id,
      exercise_name_de: e.exercise_name_de,
      load_type: e.load_type,
      status: e.status,
      target_sets: meta.keepTargets ? e.target_sets : null,
      reps_min: meta.keepTargets ? e.reps_min : null,
      reps_max: meta.keepTargets ? e.reps_max : null,
      target_reps: meta.keepTargets ? e.target_reps : null,
      target_extra_set: meta.keepTargets ? e.target_extra_set : null,
      target_weight_kg: meta.keepTargets ? e.target_weight_kg : null,
      target_duration_s: meta.keepTargets ? e.target_duration_s : null,
      target_rpe: meta.keepTargets ? e.target_rpe : null,
      state_weight_kg: meta.keepTargets ? e.state_weight_kg : null,
      state_target_reps: meta.keepTargets ? e.state_target_reps : null,
      state_extra_set: meta.keepTargets ? e.state_extra_set : null,
      state_duration_s: meta.keepTargets ? e.state_duration_s : null,
      weight_confirmed: e.weight_confirmed,
      is_return: e.is_return,
    });
    for (const s of e.sets) {
      setLogs.push({
        exercise_log_id: e.id,
        user_id: meta.userId,
        set_no: s.set_no,
        reps: s.reps,
        weight_kg: s.weight_kg,
        duration_s: s.duration_s,
        rpe: s.rpe,
        done: s.done,
      });
    }
  }
  const cardioLogs: CardioLogRow[] = payload.cardio
    ? [
        {
          session_log_id: meta.id,
          user_id: meta.userId,
          modality: payload.cardio.modality,
          duration_s: payload.cardio.duration_s,
          distance_m: payload.cardio.distance_m,
          elevation_m: payload.cardio.elevation_m,
        },
      ]
    : [];
  return {
    ...without,
    sessionLogs: [...without.sessionLogs, sessionLog],
    exerciseLogs: [...without.exerciseLogs, ...exerciseLogs],
    setLogs: [...without.setLogs, ...setLogs],
    cardioLogs: [...without.cardioLogs, ...cardioLogs],
    // Geplante Einheit erledigt (auch skipped → completed, W8).
    plannedSessions: meta.linked
      ? rows.plannedSessions.map((s) =>
          s.id === payload.planned_session_id ? { ...s, status: 'completed' as const } : s,
        )
      : rows.plannedSessions,
  };
}

/** Eintrag samt Übungen, Sätzen und Ausdauer entfernen (Kaskade wie in der Datenbank). */
export function removeSessionLog<T extends LogRows>(rows: T, id: string): T {
  const exerciseIds = new Set(
    rows.exerciseLogs.filter((e) => e.session_log_id === id).map((e) => e.id),
  );
  return {
    ...rows,
    sessionLogs: rows.sessionLogs.filter((log) => log.id !== id),
    exerciseLogs: rows.exerciseLogs.filter((e) => e.session_log_id !== id),
    setLogs: rows.setLogs.filter((s) => !exerciseIds.has(s.exercise_log_id)),
    cardioLogs: rows.cardioLogs.filter((c) => c.session_log_id !== id),
  };
}

/**
 * Wie delete_session_log: Eintrag weg; die geplante Einheit wird wieder `planned`, wenn ihr Plan aktiv ist, ihre
 * Woche läuft und an ihrem Tag keine andere geplante Einheit liegt – sonst `skipped`.
 */
export function deleteSessionLogRows<T extends LogAndPlanRows>(
  rows: T,
  id: string,
  today: string,
): T {
  const log = rows.sessionLogs.find((l) => l.id === id);
  if (!log) return rows;
  const next = removeSessionLog(rows, id);
  const session = log.planned_session_id
    ? rows.plannedSessions.find((s) => s.id === log.planned_session_id)
    : undefined;
  if (!session) return next;
  const plan = rows.plans.find((p) => p.id === session.plan_id);
  const weekRuns =
    addDays(startOfIsoWeek(session.original_date ?? session.scheduled_on), 6) >= today;
  const dayFree = !rows.plannedSessions.some(
    (s) => s.id !== session.id && s.status === 'planned' && s.scheduled_on === session.scheduled_on,
  );
  const status = plan?.status === 'active' && weekRuns && dayFree ? 'planned' : 'skipped';
  return {
    ...next,
    plannedSessions: next.plannedSessions.map((s) => (s.id === session.id ? { ...s, status } : s)),
  };
}

/**
 * Verweise auf nicht mehr vorhandene geplante Einheiten/Übungen leeren – wie `on delete set null (spalte)` (B2):
 * der Eintrag bleibt, nur der Verweis wird `null`.
 */
export function detachLogs<T extends LogAndSessionRows & { plannedExercises: { id: string }[] }>(
  rows: T,
): T {
  const sessions = new Set(rows.plannedSessions.map((s) => s.id));
  const exercises = new Set(rows.plannedExercises.map((e) => e.id));
  return {
    ...rows,
    sessionLogs: rows.sessionLogs.map((log) =>
      log.planned_session_id !== null && !sessions.has(log.planned_session_id)
        ? { ...log, planned_session_id: null }
        : log,
    ),
    exerciseLogs: rows.exerciseLogs.map((e) =>
      e.planned_exercise_id !== null && !exercises.has(e.planned_exercise_id)
        ? { ...e, planned_exercise_id: null }
        : e,
    ),
  };
}

/**
 * Einträge aus Plänen mit Gesundheits-Check neutralisieren (S1, wie private.neutralize_health_plan_logs): alle
 * target_* und state_* leer, Name neutral, Kennzeichen false. Ist-Werte bleiben.
 */
export function neutralizeHealthPlanLogRows<T extends LogRows>(rows: T): T {
  const health = new Set(rows.sessionLogs.filter((l) => l.from_health_plan).map((l) => l.id));
  if (health.size === 0) return rows;
  return {
    ...rows,
    sessionLogs: rows.sessionLogs.map((l) =>
      health.has(l.id) ? { ...l, name_de: neutralSessionName(l.kind), from_health_plan: false } : l,
    ),
    exerciseLogs: rows.exerciseLogs.map((e) =>
      health.has(e.session_log_id)
        ? {
            ...e,
            target_sets: null,
            reps_min: null,
            reps_max: null,
            target_reps: null,
            target_extra_set: null,
            target_weight_kg: null,
            target_duration_s: null,
            target_rpe: null,
            state_weight_kg: null,
            state_target_reps: null,
            state_extra_set: null,
            state_duration_s: null,
          }
        : e,
    ),
  };
}

/** Einträge aus Plänen mit Gesundheits-Check löschen (Widerruf „auch löschen“, revoke_health_data(true)). */
export function deleteHealthPlanLogRows<T extends LogRows>(rows: T): T {
  return rows.sessionLogs
    .filter((l) => l.from_health_plan)
    .reduce((next, log) => removeSessionLog(next, log.id), rows);
}

/**
 * Wie close_missed_sessions(): eigene Einheiten des AKTIVEN Plans, die noch `planned` sind und deren ISO-Woche
 * (coalesce(original_date, scheduled_on)) vorbei ist → `skipped`.
 */
export function closeMissedSessionRows<
  T extends { plans: PlanRowRef[]; plannedSessions: PlannedSessionRow[] },
>(rows: T, today: string): T {
  const active = rows.plans.find((p) => p.status === 'active');
  if (!active) return rows;
  let changed = false;
  const plannedSessions = rows.plannedSessions.map((s) => {
    if (
      s.plan_id === active.id &&
      s.status === 'planned' &&
      addDays(startOfIsoWeek(s.original_date ?? s.scheduled_on), 6) < today
    ) {
      changed = true;
      return { ...s, status: 'skipped' as const };
    }
    return s;
  });
  return changed ? { ...rows, plannedSessions } : rows;
}

// ---------------------------------------------------------------------------------------------------------
// Zeilen → Eingaben der Progression (packages/core)
// ---------------------------------------------------------------------------------------------------------

function stateOf(e: ExerciseLogRow): ExerciseProgress | null {
  if (
    e.state_weight_kg === null &&
    e.state_target_reps === null &&
    e.state_extra_set === null &&
    e.state_duration_s === null
  ) {
    return null;
  }
  return {
    weightKg: e.state_weight_kg,
    targetReps: e.state_target_reps,
    extraSet: e.state_extra_set ?? false,
    durationS: e.state_duration_s,
  };
}

/**
 * Alle Übungs-Einträge als Eingabe für progressFromLogs(); `excludeLogId` = Eintrag, der gerade geändert wird
 * (dessen Zustand ist der VOR der Einheit). Reihenfolge innerhalb eines Tages: finished_at bzw. client_updated_at.
 */
export function logEntriesFromRows(
  rows: Pick<LogRows, 'sessionLogs' | 'exerciseLogs' | 'setLogs'>,
  excludeLogId: string | null = null,
): ExerciseLogEntry[] {
  const sessions = new Map(rows.sessionLogs.map((l) => [l.id, l] as const));
  const setsByExercise = new Map<string, SetLogRow[]>();
  for (const set of rows.setLogs) {
    setsByExercise.set(set.exercise_log_id, [
      ...(setsByExercise.get(set.exercise_log_id) ?? []),
      set,
    ]);
  }
  return rows.exerciseLogs.flatMap((e) => {
    const log = sessions.get(e.session_log_id);
    if (!log || log.id === excludeLogId) return [];
    const sets: LoggedSet[] = (setsByExercise.get(e.id) ?? [])
      .sort((a, b) => a.set_no - b.set_no)
      .map((s) => ({
        reps: s.reps,
        weightKg: s.weight_kg,
        durationS: s.duration_s,
        rpe: s.rpe,
        done: s.done,
      }));
    return [
      {
        exerciseId: e.exercise_id,
        performedOn: log.performed_on,
        loggedAt: log.finished_at ?? log.client_updated_at,
        status: e.status,
        loadType: e.load_type,
        isIntroWeek: log.is_intro_week,
        isDeload: log.is_deload,
        isReturn: e.is_return,
        targetSets: e.target_sets,
        targetWeightKg: e.target_weight_kg,
        targetReps: e.target_reps,
        targetExtraSet: e.target_extra_set,
        targetRpe: e.target_rpe,
        state: stateOf(e),
        weightConfirmed: e.weight_confirmed,
        sets,
      },
    ];
  });
}

/** Startgewichte je Übung (exercise_start_weights). */
export function startWeightsFromRows(rows: {
  startWeights: StartWeightRow[];
}): Map<string, number> {
  return new Map(rows.startWeights.map((row) => [row.exercise_id, row.weight_kg] as const));
}

/** Eintrag zu einer geplanten Einheit (eindeutig je planned_session_id). */
export function logForSession(
  rows: Pick<LogRows, 'sessionLogs'>,
  plannedSessionId: string,
): SessionLogRow | null {
  return rows.sessionLogs.find((l) => l.planned_session_id === plannedSessionId) ?? null;
}

/** Nur die Tagebuch-Zeilen aus einem größeren Zeilen-Stand (ohne weitere Tabellen). */
export function logRowsOf(rows: LogRows): LogRows {
  return {
    sessionLogs: rows.sessionLogs,
    exerciseLogs: rows.exerciseLogs,
    setLogs: rows.setLogs,
    cardioLogs: rows.cardioLogs,
  };
}

export const EMPTY_LOG_ROWS: LogRows = {
  sessionLogs: [],
  exerciseLogs: [],
  setLogs: [],
  cardioLogs: [],
};

/** Zwei Tagebuch-Stände zusammenführen (z. B. 12-Wochen-Fenster + recent_exercise_logs), ohne Dubletten. */
export function mergeLogRows(a: LogRows, b: LogRows): LogRows {
  const sessionIds = new Set(a.sessionLogs.map((l) => l.id));
  const exerciseIds = new Set(a.exerciseLogs.map((e) => e.id));
  const setKeys = new Set(a.setLogs.map((s) => `${s.exercise_log_id}:${s.set_no}`));
  const cardioIds = new Set(a.cardioLogs.map((c) => c.session_log_id));
  return {
    sessionLogs: [...a.sessionLogs, ...b.sessionLogs.filter((l) => !sessionIds.has(l.id))],
    exerciseLogs: [...a.exerciseLogs, ...b.exerciseLogs.filter((e) => !exerciseIds.has(e.id))],
    setLogs: [
      ...a.setLogs,
      ...b.setLogs.filter((s) => !setKeys.has(`${s.exercise_log_id}:${s.set_no}`)),
    ],
    cardioLogs: [...a.cardioLogs, ...b.cardioLogs.filter((c) => !cardioIds.has(c.session_log_id))],
  };
}

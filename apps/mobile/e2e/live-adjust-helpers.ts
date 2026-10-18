/**
 * Testdaten der Live-Anpassung (Phase 4b, Etappe D) für die E2E-Tests im Testmodus: ausgedachte Tagebuch-Einträge
 * direkt im Gerätespeicher (`fitnessapp.local.v1`) – so wie save_session_log sie speichern würde. Die Funktion
 * `seedTrainingLogs` hat keine Importe und keine äußeren Variablen, damit Playwright sie im Browser ausführen kann
 * (page.evaluate). Keine echten Nutzerdaten.
 */

export interface SeedExercise {
  id: string;
  loadType: 'weight' | 'reps' | 'time';
  weightKg: number;
  reps: number[];
  /** Zustand VOR der Einheit (state_*), wie ihn die App gespeichert hätte. */
  stateWeightKg: number;
  stateTargetReps: number;
}

export interface SeedSession {
  /** Tag der geplanten Einheit (aktiver Plan). */
  date: string;
  /** Belastung der Einheit (0–10); null = ohne Angabe. */
  sessionRpe: number | null;
  exercises: SeedExercise[];
}

interface SeedDb {
  session: { userId: string };
  rows: {
    plans: { id: string; status: string }[];
    plannedSessions: {
      id: string;
      plan_id: string;
      scheduled_on: string;
      kind: string;
      name_de: string;
      is_intro_week: boolean;
      is_deload: boolean;
      status: string;
    }[];
    plannedExercises: {
      id: string;
      session_id: string;
      exercise_id: string;
      exercise_name_de: string;
      order_no: number;
      sets: number;
      reps_min: number | null;
      reps_max: number | null;
      rpe_target: number;
    }[];
    sessionLogs: Record<string, unknown>[];
    exerciseLogs: Record<string, unknown>[];
    setLogs: Record<string, unknown>[];
  };
}

/** Trägt Einheiten ein (localStorage-Text rein, neuer Text raus). Im Browser über page.evaluate nutzbar. */
export function seedTrainingLogs(raw: string, sessions: SeedSession[]): string {
  const db = JSON.parse(raw) as SeedDb;
  const rows = db.rows;
  const userId = db.session.userId;
  const active = rows.plans.find((p) => p.status === 'active');
  if (!active) throw new Error('Kein aktiver Plan');
  let n = rows.sessionLogs.length;
  for (const spec of sessions) {
    const planned = rows.plannedSessions.find(
      (s) => s.plan_id === active.id && s.scheduled_on === spec.date && s.kind === 'strength',
    );
    if (!planned) throw new Error(`Keine Einheit am ${spec.date}`);
    n += 1;
    const logId = `seed-log-${n}`;
    const at = `${spec.date}T18:00:00.000Z`;
    rows.sessionLogs.push({
      id: logId,
      user_id: userId,
      planned_session_id: planned.id,
      kind: 'strength',
      performed_on: spec.date,
      started_at: null,
      finished_at: at,
      status: 'completed',
      session_rpe: spec.sessionRpe,
      notes: null,
      name_de: planned.name_de,
      is_intro_week: planned.is_intro_week,
      is_deload: planned.is_deload,
      from_health_plan: false,
      is_free: false,
      revision: 1,
      last_write_id: `seed-write-${n}`,
      source: 'manual',
      client_updated_at: at,
      created_at: at,
      updated_at: at,
    });
    planned.status = 'completed';
    spec.exercises.forEach((e, i) => {
      const plannedExercise = rows.plannedExercises.find(
        (p) => p.session_id === planned.id && p.exercise_id === e.id,
      );
      const exerciseLogId = `${logId}-ex-${i + 1}`;
      rows.exerciseLogs.push({
        id: exerciseLogId,
        session_log_id: logId,
        user_id: userId,
        order_no: i + 1,
        planned_exercise_id: plannedExercise ? plannedExercise.id : null,
        exercise_id: e.id,
        exercise_name_de: plannedExercise ? plannedExercise.exercise_name_de : e.id,
        load_type: e.loadType,
        status: 'done',
        target_sets: e.reps.length,
        reps_min: plannedExercise ? plannedExercise.reps_min : 8,
        reps_max: plannedExercise ? plannedExercise.reps_max : 12,
        target_reps: e.stateTargetReps,
        target_extra_set: false,
        target_weight_kg: e.stateWeightKg,
        target_duration_s: null,
        target_rpe: plannedExercise ? plannedExercise.rpe_target : 8,
        state_weight_kg: e.stateWeightKg,
        state_target_reps: e.stateTargetReps,
        state_extra_set: false,
        state_duration_s: null,
        weight_confirmed: false,
        is_return: false,
      });
      e.reps.forEach((reps, setIndex) => {
        rows.setLogs.push({
          exercise_log_id: exerciseLogId,
          user_id: userId,
          set_no: setIndex + 1,
          reps,
          weight_kg: e.weightKg,
          duration_s: null,
          rpe: null,
          done: true,
        });
      });
    });
  }
  return JSON.stringify(db);
}

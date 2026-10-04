import type { GeneratedPlan } from './generate';

/**
 * Was die App an `save_training_plan` schickt (Etappe B): NUR die Spalten aus docs/PLAN-PHASE-3.md Abschnitt 8.
 * Nie die wirksamen Sicherheitsregeln, nie Hinweise zur Schwangerschaft, nie Gesundheits-Check oder
 * Geburtsdatum. `uses_health_data`/`medical_notice` sind nur Vorschläge – die Datenbank bestimmt sie selbst
 * (Abschnitt 8.1). `user_id` setzt die Datenbank aus dem Login.
 */
export interface SavePlanExercise {
  readonly order_no: number;
  readonly exercise_id: string;
  readonly source_exercise_id: string;
  readonly exercise_name_de: string;
  readonly sets: number;
  readonly reps_min: number | null;
  readonly reps_max: number | null;
  readonly duration_s: number | null;
  readonly rest_s: number;
  readonly rpe_target: number;
  readonly superset_group: string | null;
  readonly notes_de: string | null;
  readonly target_weight_kg: number | null;
}

export interface SavePlanSession {
  readonly block_no: number;
  readonly week_no: number;
  readonly is_intro_week: boolean;
  readonly is_deload: boolean;
  readonly template_day_index: number;
  readonly scheduled_on: string;
  readonly name_de: string;
  readonly focus: string;
  readonly estimated_minutes: number;
  readonly warmup_de: string;
  readonly cooldown_de: string;
  readonly exercises: readonly SavePlanExercise[];
}

export interface SavePlanPayload {
  readonly template_id: string;
  readonly template_title_de: string;
  readonly template_version: number;
  readonly engine_version: number;
  readonly match_quality: string;
  readonly notes: readonly string[];
  readonly uses_health_data: boolean;
  readonly medical_notice: boolean;
  readonly inputs: GeneratedPlan['inputs'];
  readonly start_date: string;
  readonly sessions: readonly SavePlanSession[];
}

export function toSavePlanPayload(plan: GeneratedPlan): SavePlanPayload {
  return {
    template_id: plan.template_id,
    template_title_de: plan.template_title_de,
    template_version: plan.template_version,
    engine_version: plan.engine_version,
    match_quality: plan.match_quality,
    notes: [...plan.notes],
    uses_health_data: plan.uses_health_data,
    medical_notice: plan.medical_notice,
    inputs: {
      goalType: plan.inputs.goalType,
      discipline: plan.inputs.discipline,
      experienceLevel: plan.inputs.experienceLevel,
      sessionsPerWeek: plan.inputs.sessionsPerWeek,
      minutesPerSession: plan.inputs.minutesPerSession,
      preferredDays: [...plan.inputs.preferredDays],
      trainingLocation: plan.inputs.trainingLocation,
      homeEquipment: plan.inputs.homeEquipment.map((e) => ({
        equipmentId: e.equipmentId,
        weightsKg: [...e.weightsKg],
      })),
    },
    start_date: plan.start_date,
    sessions: plan.sessions.map((s) => ({
      block_no: s.block_no,
      week_no: s.week_no,
      is_intro_week: s.is_intro_week,
      is_deload: s.is_deload,
      template_day_index: s.template_day_index,
      scheduled_on: s.scheduled_on,
      name_de: s.name_de,
      focus: s.focus,
      estimated_minutes: s.estimated_minutes,
      warmup_de: s.warmup_de,
      cooldown_de: s.cooldown_de,
      exercises: s.exercises.map((e) => ({
        order_no: e.order_no,
        exercise_id: e.exercise_id,
        source_exercise_id: e.source_exercise_id,
        exercise_name_de: e.exercise_name_de,
        sets: e.sets,
        reps_min: e.reps_min,
        reps_max: e.reps_max,
        duration_s: e.duration_s,
        rest_s: e.rest_s,
        rpe_target: e.rpe_target,
        superset_group: e.superset_group,
        notes_de: e.notes_de,
        target_weight_kg: e.target_weight_kg,
      })),
    })),
  };
}

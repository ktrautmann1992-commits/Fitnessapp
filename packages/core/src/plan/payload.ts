import { z } from 'zod';

import {
  EQUIPMENT_LIMITS,
  PLAN_BLOCK_LIMITS,
  PLAN_SAVE_LIMITS,
  TRAINING_LIMITS,
} from '../constants';
import { PLAN_MATCH_QUALITIES, PLAN_NOTES, SESSION_FOCUSES } from '../enums';
import { equipmentIdSchema } from '../equipment';
import {
  enduranceDisciplineSchema,
  experienceLevelSchema,
  goalTypeSchema,
  trainingLocationSchema,
  weekdaySchema,
  weightStepKgSchema,
} from '../validation';
import type { GeneratedPlan } from './generate';
import type { GeneratedSession } from './schedule';

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

/** Eine Einheit mit genau den Spalten von planned_sessions/planned_exercises. */
export function toSavePlanSession(s: GeneratedSession): SavePlanSession {
  return {
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
  };
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
    sessions: plan.sessions.map(toSavePlanSession),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Zod-Schemas der Funktions-Eingabe (.strict(): unbekannte Felder werden abgelehnt – wie
// private.assert_json_keys() in supabase/migrations/20261004120100_training_plan_rpcs.sql).
// Die Angaben (inputs) prüfen Zod und private.assert_plan_inputs() nach denselben Werten; die übrigen
// fachlichen Grenzen prüfen generatedPlanSchema und die CHECK-Bedingungen der Datenbank.
// ---------------------------------------------------------------------------------------------------------

function utf8Bytes(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * Länge eines JSON-Werts in Bytes, so wie Postgres ihn als Text schreibt (`jsonb::text`: „, “ zwischen Elementen,
 * „: “ nach Schlüsseln). Grundlage der Grenze PLAN_SAVE_LIMITS.inputsMaxBytes (CHECK auf user_plans.inputs).
 */
export function jsonbTextBytes(value: unknown): number {
  if (value === null || value === undefined) return 4;
  if (typeof value === 'boolean') return value ? 4 : 5;
  if (typeof value === 'number') return String(value).length;
  if (typeof value === 'string') return utf8Bytes(JSON.stringify(value));
  if (Array.isArray(value)) {
    const items = value.map((item) => jsonbTextBytes(item));
    return 2 + items.reduce((sum, n) => sum + n, 0) + Math.max(0, items.length - 1) * 2;
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => v !== undefined,
  );
  const sizes = entries.map(([key, v]) => utf8Bytes(JSON.stringify(key)) + 2 + jsonbTextBytes(v));
  return 2 + sizes.reduce((sum, n) => sum + n, 0) + Math.max(0, sizes.length - 1) * 2;
}

function distinct<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

const isoDate = z.iso.date();

export const savePlanExerciseSchema = z.strictObject({
  order_no: z.number().int(),
  exercise_id: z.string().min(1),
  source_exercise_id: z.string().min(1),
  exercise_name_de: z.string().min(1),
  sets: z.number().int(),
  reps_min: z.number().int().nullable(),
  reps_max: z.number().int().nullable(),
  duration_s: z.number().int().nullable(),
  rest_s: z.number().int(),
  rpe_target: z.number(),
  superset_group: z.string().nullable(),
  notes_de: z.string().nullable(),
  target_weight_kg: z.number().nullable(),
});

export const savePlanSessionSchema = z.strictObject({
  block_no: z.number().int().min(1),
  week_no: z.number().int(),
  is_intro_week: z.boolean(),
  is_deload: z.boolean(),
  template_day_index: z.number().int(),
  scheduled_on: isoDate,
  name_de: z.string().min(1),
  focus: z.enum(SESSION_FOCUSES),
  estimated_minutes: z.number().int(),
  warmup_de: z.string(),
  cooldown_de: z.string(),
  exercises: z.array(savePlanExerciseSchema).min(1).max(PLAN_BLOCK_LIMITS.exercisesPerSession),
});

/** Ein Gerät zu Hause in den Angaben (= equipment_keys in private.assert_plan_inputs()). */
export const savePlanHomeEquipmentSchema = z.strictObject({
  equipmentId: equipmentIdSchema,
  weightsKg: z.array(weightStepKgSchema).max(EQUIPMENT_LIMITS.maxWeightSteps),
});

/** Angaben ohne Gesundheitsdaten – dieselben Werte prüft private.assert_plan_inputs() in der Datenbank. */
export const savePlanInputsSchema = z
  .strictObject({
    goalType: goalTypeSchema,
    discipline: enduranceDisciplineSchema.nullable(),
    experienceLevel: experienceLevelSchema,
    sessionsPerWeek: z
      .number()
      .int()
      .min(TRAINING_LIMITS.sessionsPerWeek.min)
      .max(TRAINING_LIMITS.sessionsPerWeek.max),
    minutesPerSession: z
      .number()
      .int()
      .min(TRAINING_LIMITS.minutesPerSession.min)
      .max(TRAINING_LIMITS.minutesPerSession.max),
    preferredDays: z.array(weekdaySchema).max(7).refine(distinct, 'Jeder Wochentag nur einmal.'),
    trainingLocation: trainingLocationSchema,
    homeEquipment: z
      .array(savePlanHomeEquipmentSchema)
      .refine((items) => distinct(items.map((i) => i.equipmentId)), 'Jedes Gerät nur einmal.'),
  })
  .refine(
    (inputs) => jsonbTextBytes(inputs) <= PLAN_SAVE_LIMITS.inputsMaxBytes,
    'Die Angaben sind zu umfangreich.',
  );

/** Eingabe von save_training_plan. */
export const savePlanPayloadSchema = z.strictObject({
  template_id: z.string().min(1),
  template_title_de: z.string().min(1),
  template_version: z.number().int().min(1),
  engine_version: z.number().int().min(1),
  match_quality: z.enum(PLAN_MATCH_QUALITIES),
  notes: z.array(z.enum(PLAN_NOTES)),
  uses_health_data: z.boolean(),
  medical_notice: z.boolean(),
  inputs: savePlanInputsSchema,
  start_date: isoDate,
  sessions: z
    .array(savePlanSessionSchema)
    .min(1)
    .max(PLAN_BLOCK_LIMITS.sessionsPerWeek * (PLAN_BLOCK_LIMITS.weekNo.max + 1)),
});

/** Eingabe von append_plan_block (Einheiten des Folgeblocks). */
export const appendPlanBlockSchema = z
  .array(savePlanSessionSchema)
  .min(1)
  .max(PLAN_BLOCK_LIMITS.sessionsPerWeek * (PLAN_BLOCK_LIMITS.weekNo.max + 1));

/** Folgeblock (nextPlanBlock) im Format von append_plan_block. */
export function toAppendBlockPayload(sessions: readonly GeneratedSession[]): SavePlanSession[] {
  return sessions.map(toSavePlanSession);
}

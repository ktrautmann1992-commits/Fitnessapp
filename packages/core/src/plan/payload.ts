import { z } from 'zod';

import {
  BARBELL_PLATE_MAX_KG,
  COMPETITION_EFFORT_LIMITS,
  COMPETITION_PACE,
  COMPETITION_RECORD_LIMITS,
  EQUIPMENT_LIMITS,
  PLAN_BLOCK_LIMITS,
  PLAN_SAVE_LIMITS,
  TRAINING_LIMITS,
} from '../constants';
import {
  ENDURANCE_MODALITIES,
  PLAN_MATCH_QUALITIES,
  PLAN_NOTES,
  PLANNED_SESSION_KINDS,
  SESSION_FOCUSES,
  TRAINING_SLOT_KINDS,
} from '../enums';
import { BARBELL_ID, equipmentIdSchema } from '../equipment';
import { isAllowedGoalPair } from '../goals/profile';
import { COMPETITION_PHASES } from './competition-schema';
import { ENDURANCE_EFFORT_LIMITS } from './generate';
import {
  isHardSession,
  isHardWorkoutType,
  stepsFitWorkoutType,
  type WorkoutStep,
  WORKOUT_TYPES,
  workoutStepsSchema,
} from './intensity';
import {
  barbellBarKgSchema,
  enduranceDisciplineSchema,
  experienceLevelSchema,
  goalTypeSchema,
  trainingLocationSchema,
  weekdaySchema,
  weightStepKgSchema,
} from '../validation';
import type { GeneratedPlan } from './generate';
import { secondaryGoalEntry } from './inputs';
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
  readonly kind: string;
  readonly template_day_index: number | null;
  readonly scheduled_on: string;
  readonly name_de: string;
  readonly focus: string | null;
  readonly endurance_modality: string | null;
  readonly effort_target: number | null;
  readonly estimated_minutes: number;
  readonly warmup_de: string;
  readonly cooldown_de: string;
  readonly exercises: readonly SavePlanExercise[];
  /**
   * NUR im Wettkampfplan (Phase 10, Spalten seit WP3): Art, Phase der Woche, Schritte, Distanz-Richtwert. Ohne
   * Wettkampf fehlen die Schlüssel – die Eingabe bleibt byte-gleich zu vorher.
   */
  readonly workout_type?: string | null;
  readonly training_phase?: string | null;
  readonly workout_steps?: readonly WorkoutStep[] | null;
  readonly target_distance_m?: number | null;
}

export interface SavePlanPayload {
  /** null = reiner Ausdauer-Plan (alle drei leer). */
  readonly template_id: string | null;
  readonly template_title_de: string | null;
  readonly template_version: number | null;
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
    kind: s.kind,
    template_day_index: s.template_day_index,
    scheduled_on: s.scheduled_on,
    name_de: s.name_de,
    focus: s.focus,
    endurance_modality: s.endurance_modality,
    effort_target: s.effort_target,
    estimated_minutes: s.estimated_minutes,
    warmup_de: s.warmup_de,
    cooldown_de: s.cooldown_de,
    // Wettkampfplan (WP3): nur wenn die Engine die Felder gesetzt hat – sonst keine neuen Schlüssel.
    ...(s.workout_type === undefined && s.training_phase === undefined
      ? {}
      : {
          workout_type: s.workout_type ?? null,
          training_phase: s.training_phase ?? null,
          workout_steps:
            s.workout_steps === undefined || s.workout_steps === null
              ? null
              : s.workout_steps.map((st) => ({
                  part: st.part,
                  kind: st.kind,
                  seconds: st.seconds,
                  effort: st.effort,
                })),
          target_distance_m: s.target_distance_m ?? null,
        }),
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
      // Nur bei gesetztem Nebenziel (Wächter B1): ohne Nebenziel genau die Schlüssel von vorher.
      ...secondaryGoalEntry(plan.inputs.secondaryGoalType),
      discipline: plan.inputs.discipline,
      experienceLevel: plan.inputs.experienceLevel,
      schedule:
        plan.inputs.schedule.mode === 'fixed'
          ? {
              mode: 'fixed',
              slots: plan.inputs.schedule.slots.map((slot) => ({
                weekday: slot.weekday,
                kind: slot.kind,
                minutes: slot.minutes,
              })),
            }
          : {
              mode: 'flex',
              slots: plan.inputs.schedule.slots.map((slot) => ({
                kind: slot.kind,
                minutes: slot.minutes,
              })),
            },
      trainingLocation: plan.inputs.trainingLocation,
      homeEquipment: plan.inputs.homeEquipment.map((e) => ({
        equipmentId: e.equipmentId,
        weightsKg: [...e.weightsKg],
        barKg: e.barKg,
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

/** Größe eines JSON-Werts wie `jsonb::text` (Grenze COMPETITION_RECORD_LIMITS.workoutStepsMaxBytes). */
function withinStepBytes(steps: unknown): boolean {
  return jsonbTextBytes(steps) <= COMPETITION_RECORD_LIMITS.workoutStepsMaxBytes;
}

/**
 * Eine Einheit: Kraft mit Schwerpunkt, Vorlagen-Einheit und 1–8 Übungen; Ausdauer mit Modalität und Anstrengung,
 * ohne Übungen (gleiche Regeln wie die CHECKs von planned_sessions und private.insert_plan_sessions()).
 *
 * Wettkampfplan (Phase 10, WP3 – CHECK planned_sessions_workout_fields): optionale Felder `workout_type`,
 * `training_phase`, `workout_steps`, `target_distance_m`. Ohne Art (alle null/fehlend) Anstrengung 1–4 wie bisher;
 * mit Art nur Ausdauer, Art + Phase + Schritte zusammen (Summe = Dauer, Größe begrenzt), Anstrengung 1–8 und über 4 nur
 * bei harter Art, harte Art in einer Erholungswoche nur im Tapering, Distanz nur mit Art. Die Regeln je Person (unter
 * 18 ≤ 7, ab 65 ≤ 6, Gesundheits-Flag ohne harte Einheiten, Zahl harter Einheiten je Woche) prüft der Server
 * zusätzlich mit dem Plan (private.insert_plan_sessions).
 */
export const savePlanSessionSchema = z
  .strictObject({
    block_no: z.number().int().min(1),
    week_no: z.number().int(),
    is_intro_week: z.boolean(),
    is_deload: z.boolean(),
    kind: z.enum(PLANNED_SESSION_KINDS),
    template_day_index: z.number().int().nullable(),
    scheduled_on: isoDate,
    name_de: z.string().min(1),
    focus: z.enum(SESSION_FOCUSES).nullable(),
    endurance_modality: z.enum(ENDURANCE_MODALITIES).nullable(),
    effort_target: z
      .number()
      .int()
      .min(COMPETITION_EFFORT_LIMITS.min)
      .max(COMPETITION_EFFORT_LIMITS.max)
      .nullable(),
    estimated_minutes: z.number().int(),
    warmup_de: z.string(),
    cooldown_de: z.string(),
    exercises: z.array(savePlanExerciseSchema).max(PLAN_BLOCK_LIMITS.exercisesPerSession),
    workout_type: z.enum(WORKOUT_TYPES).nullable().optional(),
    training_phase: z.enum(COMPETITION_PHASES).nullable().optional(),
    workout_steps: workoutStepsSchema.nullable().optional(),
    target_distance_m: z
      .number()
      .int()
      .min(COMPETITION_PACE.distanceM.min)
      .max(COMPETITION_PACE.distanceM.max)
      .nullable()
      .optional(),
  })
  .refine(
    (s) =>
      s.kind === 'strength'
        ? s.focus !== null &&
          s.template_day_index !== null &&
          s.exercises.length >= 1 &&
          s.endurance_modality === null &&
          s.effort_target === null
        : s.focus === null &&
          s.template_day_index === null &&
          s.exercises.length === 0 &&
          s.endurance_modality !== null &&
          s.effort_target !== null,
    'Kraft: Schwerpunkt und Übungen; Ausdauer: Modalität und Anstrengung, keine Übungen.',
  )
  .refine((s) => {
    const type = s.workout_type ?? null;
    const phase = s.training_phase ?? null;
    const steps = s.workout_steps ?? null;
    const distance = s.target_distance_m ?? null;
    if (type === null && phase === null && steps === null && distance === null) {
      return s.effort_target === null || s.effort_target <= ENDURANCE_EFFORT_LIMITS.max;
    }
    return (
      s.kind === 'endurance' &&
      type !== null &&
      phase !== null &&
      steps !== null &&
      (s.effort_target ?? 0) >= ENDURANCE_EFFORT_LIMITS.min &&
      ((s.effort_target ?? 0) <= COMPETITION_EFFORT_LIMITS.easyMax || isHardWorkoutType(type)) &&
      (!s.is_deload || !isHardWorkoutType(type) || phase === 'taper') &&
      stepsFitWorkoutType(type, steps) &&
      (!s.is_deload || phase === 'taper' || !isHardSession(type, steps)) &&
      steps.reduce((sum, st) => sum + st.seconds, 0) === s.estimated_minutes * 60 &&
      withinStepBytes(steps)
    );
  }, 'Wettkampf-Einheit: Art, Phase und Schritte zusammen; Anstrengung über 4 nur bei harter Art.');

/** Ein Gerät zu Hause in den Angaben (= equipment_keys in private.assert_plan_inputs()). */
export const savePlanHomeEquipmentSchema = z
  .strictObject({
    equipmentId: equipmentIdSchema,
    weightsKg: z.array(weightStepKgSchema).max(EQUIPMENT_LIMITS.maxWeightSteps),
    barKg: barbellBarKgSchema.nullable(),
  })
  .refine((item) => item.barKg === null || item.equipmentId === BARBELL_ID, {
    path: ['barKg'],
    message: 'Eine Stange gibt es nur bei der Langhantel.',
  })
  .refine(
    (item) =>
      item.equipmentId !== BARBELL_ID || item.weightsKg.every((kg) => kg <= BARBELL_PLATE_MAX_KG),
    { path: ['weightsKg'], message: 'Hantelscheiben höchstens 25 kg.' },
  );

const slotMinutes = z
  .number()
  .int()
  .min(TRAINING_LIMITS.minutesPerSession.min)
  .max(TRAINING_LIMITS.minutesPerSession.max);

/** Trainingstag mit festem Wochentag (= fixed_slot_keys in private.assert_plan_inputs()). */
export const savePlanFixedSlotSchema = z.strictObject({
  weekday: weekdaySchema,
  kind: z.enum(TRAINING_SLOT_KINDS),
  minutes: slotMinutes,
});

/** Trainingstag „Tag egal“ (= flex_slot_keys). */
export const savePlanFlexSlotSchema = z.strictObject({
  kind: z.enum(TRAINING_SLOT_KINDS),
  minutes: slotMinutes,
});

const slotCount = (schema: z.ZodType) =>
  z.array(schema).min(TRAINING_LIMITS.sessionsPerWeek.min).max(TRAINING_LIMITS.sessionsPerWeek.max);

/** Zeitplan in den Angaben (= schedule_keys): genau `mode` und `slots`. */
export const savePlanScheduleFixedSchema = z.strictObject({
  mode: z.literal('fixed'),
  slots: slotCount(savePlanFixedSlotSchema).refine(
    (slots) => distinct(slots.map((s) => (s as { weekday: number }).weekday)),
    'Jeder Wochentag nur einmal.',
  ),
});
export const savePlanScheduleFlexSchema = z.strictObject({
  mode: z.literal('flex'),
  slots: slotCount(savePlanFlexSlotSchema),
});
export const savePlanScheduleSchema = z.discriminatedUnion('mode', [
  savePlanScheduleFixedSchema,
  savePlanScheduleFlexSchema,
]);

/**
 * Angaben ohne Gesundheitsdaten – dieselben Werte prüft private.assert_plan_inputs() in der Datenbank
 * (letzte Fassung: *_plan_inputs_secondary_goal.sql). `secondaryGoalType` ist optional: fehlend und `null` heißen
 * „kein Nebenziel“ (docs/PLAN-ZIELE.md 5.1); ein gesetztes Nebenziel muss ein erlaubtes Paar ergeben
 * (= private.goal_pair_allowed).
 */
export const savePlanInputsSchema = z
  .strictObject({
    goalType: goalTypeSchema,
    secondaryGoalType: goalTypeSchema.nullable().optional(),
    discipline: enduranceDisciplineSchema.nullable(),
    experienceLevel: experienceLevelSchema,
    schedule: savePlanScheduleSchema,
    /** Abgeleitet (deriveTrainingLocation); null = nur Ausdauer. */
    trainingLocation: trainingLocationSchema.nullable(),
    homeEquipment: z
      .array(savePlanHomeEquipmentSchema)
      .refine((items) => distinct(items.map((i) => i.equipmentId)), 'Jedes Gerät nur einmal.'),
  })
  .refine((inputs) => isAllowedGoalPair(inputs.goalType, inputs.secondaryGoalType), {
    path: ['secondaryGoalType'],
    message: 'Diese Kombination von Zielen ist nicht möglich.',
  })
  .refine(
    (inputs) => jsonbTextBytes(inputs) <= PLAN_SAVE_LIMITS.inputsMaxBytes,
    'Die Angaben sind zu umfangreich.',
  );

/** Eingabe von save_training_plan. */
export const savePlanPayloadSchema = z.strictObject({
  template_id: z.string().min(1).nullable(),
  template_title_de: z.string().min(1).nullable(),
  template_version: z.number().int().min(1).nullable(),
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

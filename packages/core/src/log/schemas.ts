import { z } from 'zod';

import {
  CARDIO_LOG_LIMITS,
  PLANNED_LOAD_LIMITS,
  SESSION_LOG_LIMITS,
  SESSION_RPE_LIMITS,
  SET_RPE_LIMITS,
  TEMPLATE_DOSAGE_LIMITS,
} from '../constants';
import {
  ENDURANCE_MODALITIES,
  EXERCISE_LOG_STATUSES,
  LOAD_TYPES,
  LOG_SOURCES,
  PLANNED_SESSION_KINDS,
  SESSION_LOG_STATUSES,
} from '../enums';

/**
 * Zod-Schemas für `save_session_log(p_log jsonb)` (docs/PLAN-PHASE-4.md Abschnitte 3.2, 3.6, 5.4): strikt und
 * verschachtelt (Einheit → Übungen → Sätze, Ausdauer) – entspricht private.assert_json_keys in der Datenbank
 * (Abgleich der Feldlisten in db-sync.test.ts ab Etappe B). NICHT erlaubt: `user_id` (immer auth.uid()),
 * `from_health_plan` (setzt nur der Server, S1), `revision` (Server), Gründe für „nicht gemacht“ (S3).
 * Das Datumsfenster hängt von „heute“ ab und steht in isWithinLogDateWindow() (summary.ts).
 */

/** Zeichen in Code-Points zählen – wie char_length() in Postgres (nicht UTF-16-Einheiten wie String.length). */
export function codePointLength(text: string): number {
  return [...text].length;
}

const hasAtMostTwoDecimals = (value: number) =>
  Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
const isoDate = z.iso.date();
const timestamp = z.iso.datetime({ offset: true });
const uuid = z.uuid();

export const setLogSchema = z.strictObject({
  set_no: z.number().int().min(1).max(SESSION_LOG_LIMITS.setsPerExercise.max),
  reps: z
    .number()
    .int()
    .min(SESSION_LOG_LIMITS.reps.min)
    .max(SESSION_LOG_LIMITS.reps.max)
    .nullable(),
  weight_kg: z
    .number()
    .min(SESSION_LOG_LIMITS.weightKg.min)
    .max(SESSION_LOG_LIMITS.weightKg.max)
    .refine(hasAtMostTwoDecimals, 'Höchstens zwei Nachkommastellen.')
    .nullable(),
  duration_s: z
    .number()
    .int()
    .min(SESSION_LOG_LIMITS.durationS.min)
    .max(SESSION_LOG_LIMITS.durationS.max)
    .nullable(),
  rpe: z
    .number()
    .min(SET_RPE_LIMITS.min)
    .max(SET_RPE_LIMITS.max)
    .multipleOf(SET_RPE_LIMITS.step)
    .nullable(),
  done: z.boolean(),
});

const targetWeight = z
  .number()
  .min(PLANNED_LOAD_LIMITS.targetWeightKg.min)
  .max(PLANNED_LOAD_LIMITS.targetWeightKg.max)
  .refine(hasAtMostTwoDecimals, 'Höchstens zwei Nachkommastellen.');
const reps = z
  .number()
  .int()
  .min(TEMPLATE_DOSAGE_LIMITS.reps.min)
  .max(TEMPLATE_DOSAGE_LIMITS.reps.max);
const holdS = z
  .number()
  .int()
  .min(TEMPLATE_DOSAGE_LIMITS.durationS.min)
  .max(TEMPLATE_DOSAGE_LIMITS.durationS.max);

export const exerciseLogSchema = z
  .strictObject({
    id: uuid,
    order_no: z.number().int().min(1).max(SESSION_LOG_LIMITS.exercisesPerSession.max),
    planned_exercise_id: uuid.nullable(),
    exercise_id: z.string().min(1).max(100),
    exercise_name_de: z.string().min(1).max(200),
    load_type: z.enum(LOAD_TYPES),
    status: z.enum(EXERCISE_LOG_STATUSES),
    // Vorgabe beim Training (Anzeige-Schnappschuss, 3.3)
    target_sets: z.number().int().min(1).max(TEMPLATE_DOSAGE_LIMITS.sets.max).nullable(),
    reps_min: reps.nullable(),
    reps_max: reps.nullable(),
    target_reps: reps.nullable(),
    target_extra_set: z.boolean().nullable(),
    target_weight_kg: targetWeight.nullable(),
    target_duration_s: holdS.nullable(),
    target_rpe: z
      .number()
      .min(TEMPLATE_DOSAGE_LIMITS.rpe.min)
      .max(TEMPLATE_DOSAGE_LIMITS.rpe.max)
      .multipleOf(0.5)
      .nullable(),
    // Progressions-Zustand VOR der Einheit (roh, W4)
    state_weight_kg: targetWeight.nullable(),
    state_target_reps: reps.nullable(),
    state_extra_set: z.boolean().nullable(),
    state_duration_s: holdS.nullable(),
    weight_confirmed: z.boolean(),
    /** Wiedereinstieg nach Pause (Anzeige-Regel RETURN_AFTER_PAUSE) – zählt nicht für die Progression. */
    is_return: z.boolean(),
    sets: z.array(setLogSchema).max(SESSION_LOG_LIMITS.setsPerExercise.max),
  })
  .refine(
    (e) =>
      e.status === 'skipped'
        ? e.sets.length === 0
        : e.sets.length >= SESSION_LOG_LIMITS.setsPerExercise.min,
    { message: '„Nicht gemacht“ ohne Sätze, sonst mindestens ein Satz.', path: ['sets'] },
  )
  .refine((e) => new Set(e.sets.map((s) => s.set_no)).size === e.sets.length, {
    message: 'Satznummern doppelt.',
    path: ['sets'],
  })
  .refine(
    (e) =>
      e.sets.every((s) =>
        e.load_type === 'weight'
          ? s.duration_s === null
          : e.load_type === 'time'
            ? s.weight_kg === null && (!s.done || s.duration_s !== null)
            : s.weight_kg === null && s.duration_s === null,
      ),
    { message: 'Gewicht nur bei Gewichtsübungen, Dauer nur bei Halteübungen.', path: ['sets'] },
  )
  // Gewichtsübung: ein abgehakter Satz braucht Wiederholungen.
  .refine((e) => e.load_type !== 'weight' || e.sets.every((s) => !s.done || s.reps !== null), {
    message: 'Abgehakter Satz ohne Wiederholungen.',
    path: ['sets'],
  })
  // R2: Bei einer Alternative sind Vorgabe und Zustand die der ALTERNATIV-Übung (eigener Verlauf, eigene Anzeige);
  // verboten ist nur die Übernahme der geplanten Übung – das prüft der Client beim Bauen (buildExerciseLogEntry),
  // ein Schema kann die Herkunft nicht sehen.
  .refine(
    (e) =>
      e.state_weight_kg === null &&
      e.state_target_reps === null &&
      e.state_extra_set === null &&
      e.state_duration_s === null
        ? true
        : e.state_extra_set !== null,
    { message: 'Zustand unvollständig.', path: ['state_extra_set'] },
  )
  .refine((e) => e.reps_min === null || e.reps_max === null || e.reps_min <= e.reps_max, {
    message: 'Wdh.-Bereich ungültig.',
    path: ['reps_max'],
  });

export const cardioLogSchema = z.strictObject({
  modality: z.enum(ENDURANCE_MODALITIES),
  duration_s: z
    .number()
    .int()
    .min(CARDIO_LOG_LIMITS.durationS.min)
    .max(CARDIO_LOG_LIMITS.durationS.max),
  distance_m: z
    .number()
    .int()
    .min(CARDIO_LOG_LIMITS.distanceM.min)
    .max(CARDIO_LOG_LIMITS.distanceM.max)
    .nullable(),
  elevation_m: z
    .number()
    .int()
    .min(CARDIO_LOG_LIMITS.elevationM.min)
    .max(CARDIO_LOG_LIMITS.elevationM.max)
    .nullable(),
});

export const sessionLogPayloadSchema = z
  .strictObject({
    id: uuid,
    /** Idempotenz-Schlüssel dieser Fassung (R4); Neuversuche senden dieselbe. */
    write_id: uuid,
    /** Revision der zuletzt bestätigten Fassung; null = neuer Eintrag (W3). */
    base_revision: z.number().int().min(1).nullable(),
    planned_session_id: uuid.nullable(),
    /** coalesce(original_date, scheduled_on) der geplanten Einheit – Datumsfenster auch für verwaiste Einträge (B4). */
    planned_date: isoDate,
    kind: z.enum(PLANNED_SESSION_KINDS),
    performed_on: isoDate,
    started_at: timestamp.nullable(),
    finished_at: timestamp.nullable(),
    status: z.enum(SESSION_LOG_STATUSES),
    session_rpe: z
      .number()
      .int()
      .min(SESSION_RPE_LIMITS.min)
      .max(SESSION_RPE_LIMITS.max)
      .nullable(),
    notes: z
      .string()
      .refine((t) => codePointLength(t) <= SESSION_LOG_LIMITS.notesMaxChars, {
        message: `Höchstens ${SESSION_LOG_LIMITS.notesMaxChars} Zeichen.`,
      })
      .nullable(),
    name_de: z.string().min(1).max(200),
    is_intro_week: z.boolean(),
    is_deload: z.boolean(),
    source: z.enum(LOG_SOURCES),
    client_updated_at: timestamp,
    exercises: z.array(exerciseLogSchema).max(SESSION_LOG_LIMITS.exercisesPerSession.max),
    cardio: cardioLogSchema.nullable(),
  })
  .refine(
    (s) =>
      s.kind === 'strength'
        ? s.exercises.length >= SESSION_LOG_LIMITS.exercisesPerSession.min && s.cardio === null
        : s.exercises.length === 0 && s.cardio !== null,
    {
      message: 'Kraft: Übungen ohne Ausdauer; Ausdauer: Ausdauer ohne Übungen.',
      path: ['exercises'],
    },
  )
  .refine((s) => new Set(s.exercises.map((e) => e.order_no)).size === s.exercises.length, {
    message: 'Reihenfolge doppelt.',
    path: ['exercises'],
  })
  .refine((s) => new Set(s.exercises.map((e) => e.id)).size === s.exercises.length, {
    message: 'Übungs-IDs doppelt.',
    path: ['exercises'],
  })
  .refine(
    (s) =>
      s.started_at === null ||
      s.finished_at === null ||
      Date.parse(s.started_at) <= Date.parse(s.finished_at),
    { message: 'Ende vor Beginn.', path: ['finished_at'] },
  );

export type SessionLogPayload = z.infer<typeof sessionLogPayloadSchema>;
export type ExerciseLogPayload = z.infer<typeof exerciseLogSchema>;
export type SetLogPayload = z.infer<typeof setLogSchema>;
export type CardioLogPayload = z.infer<typeof cardioLogSchema>;

/** Eigenes Startgewicht (`exercise_start_weights`, direkt per PostgREST – bewusste Ausnahme W14). */
export const exerciseStartWeightSchema = z.strictObject({
  exercise_id: z.string().min(1).max(100),
  weight_kg: targetWeight,
});
export type ExerciseStartWeight = z.infer<typeof exerciseStartWeightSchema>;

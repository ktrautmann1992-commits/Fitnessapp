import { z } from 'zod';

import { isoDateSchema } from '../age';
import { CONTENT_SCHEMA_LIMITS, TRAINING_LIMITS } from '../constants';
import {
  ALTERNATIVE_REASONS,
  CAUTION_TAGS,
  CONTENT_ORIGINS,
  CONTENT_STATUSES,
  EQUIPMENT_LOCATIONS,
  EXERCISE_MECHANICS,
  LOAD_TYPES,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  SESSION_FOCUSES,
  SEX_OPTIONS,
  TEMPLATE_EXPERIENCE_LEVELS,
  TEMPLATE_GOAL_TYPES,
} from '../enums';

/**
 * Zod-Schemas für Inhalte (Übungen und Plan-Vorlagen) – Regel Ü1 („Schema korrekt“, rot auch bei Entwürfen).
 * Format der JSON-Dateien in `content/exercises/*.json` und `content/plan-templates/*.json`.
 * Feldnamen in snake_case = Spaltennamen der Datenbank (supabase/migrations/20261003130300/…130400).
 * Fachliche Grenzen (z. B. RPE 5–9) prüfen die Plausibilitäts-Checks (checks.ts), nicht dieses Schema.
 */

/** Lesbarer Schlüssel eines Inhalts = Dateiname ohne `.json`, z. B. `kniebeuge-langhantel`. */
export const CONTENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const contentIdSchema = z
  .string()
  .min(3, 'ID: mindestens 3 Zeichen.')
  .max(80, 'ID: höchstens 80 Zeichen.')
  .regex(
    CONTENT_ID_PATTERN,
    'ID: nur Kleinbuchstaben, Ziffern und Bindestriche (z. B. „kniebeuge-langhantel“).',
  );

/** Geräte-ID im Format des Katalogs. Ob das Gerät existiert, prüft Regel Ü2 bzw. V2 (nicht das Schema). */
export const equipmentSlugSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{1,49}$/, 'Geräte-ID im Format „kurzhantel_xyz“ erwartet.');

/** Text ohne Leerraum am Anfang/Ende, Länge in Zeichen. */
function text(min: number, max: number) {
  return z
    .string()
    .min(min, `Mindestens ${min} Zeichen.`)
    .max(max, `Höchstens ${max} Zeichen.`)
    .refine((value) => value === value.trim(), 'Kein Leerzeichen am Anfang oder Ende.');
}

function intIn(limits: { min: number; max: number }) {
  return z.number().int('Ganze Zahl erwartet.').min(limits.min).max(limits.max);
}

/** Liste ohne doppelte Einträge. */
function distinct<T extends z.ZodType>(item: T, max: number, min = 0) {
  return z
    .array(item)
    .min(min)
    .max(max)
    .refine((values) => new Set(values).size === values.length, 'Doppelte Einträge.');
}

/**
 * Herkunft und Prüfung (Plan Abschnitt 5, Punkt 7). „KI-Entwurf“ = origin `claude_session` oder `batch`.
 * - `reviewed_by`/`reviewed_at`: wer hat freigegeben (Kürzel) und wann – Pflicht bei `published`.
 * - `expert_reviewed`: fachlich von einer qualifizierten Person geprüft (vor dem öffentlichen Start).
 */
export const contentMetaSchema = z
  .strictObject({
    origin: z.enum(CONTENT_ORIGINS),
    model: text(1, 100).nullable(),
    batch_id: text(1, 200).nullable(),
    created_on: isoDateSchema,
    expert_reviewed: z.boolean(),
    reviewed_by: text(1, 100).nullable(),
    reviewed_at: isoDateSchema.nullable(),
    review_note: text(1, 1000).nullable(),
  })
  .superRefine((meta, ctx) => {
    if (meta.origin !== 'manual' && meta.model === null) {
      ctx.addIssue({ code: 'custom', path: ['model'], message: 'KI-Entwurf: Modell angeben.' });
    }
    if ((meta.origin === 'batch') !== (meta.batch_id !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['batch_id'],
        message: 'Batch-Nummer genau dann, wenn die Herkunft „batch“ ist.',
      });
    }
    if ((meta.reviewed_by === null) !== (meta.reviewed_at === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['reviewed_at'],
        message: 'Prüfer und Prüfdatum nur gemeinsam angeben.',
      });
    }
  });
export type ContentMeta = z.infer<typeof contentMetaSchema>;

/** true = KI-Entwurf ohne fachliche Prüfung → Kennzeichnung „KI-Entwurf – fachlich prüfen“. */
export function needsExpertReviewLabel(meta: ContentMeta): boolean {
  return meta.origin !== 'manual' && !meta.expert_reviewed;
}

/** Freigegebene Inhalte brauchen einen eingetragenen Prüfer (Plan Abschnitt 4, Schritt 3). */
function requireReviewerWhenPublished(
  value: { status: string; meta: ContentMeta },
  ctx: z.RefinementCtx,
) {
  if (value.status === 'published' && value.meta.reviewed_by === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['meta', 'reviewed_by'],
      message: 'Freigegeben ohne Prüfer: bitte „reviewed_by“ und „reviewed_at“ eintragen.',
    });
  }
}

const L = CONTENT_SCHEMA_LIMITS;

// ---------------------------------------------------------------------------------------------------------
// Übung
// ---------------------------------------------------------------------------------------------------------
export const exerciseAlternativeSchema = z.strictObject({
  alternative_id: contentIdSchema,
  reason: z.enum(ALTERNATIVE_REASONS),
  priority: intIn(L.alternativePriority),
});
export type ExerciseAlternative = z.infer<typeof exerciseAlternativeSchema>;

const muscleList = (max: number, min = 0) => distinct(z.enum(MUSCLE_GROUPS), max, min);

export const exerciseSchema = z
  .strictObject({
    id: contentIdSchema,
    version: intIn(L.version),
    status: z.enum(CONTENT_STATUSES),
    name_de: text(2, 100),
    name_en: text(2, 100),
    aliases_de: distinct(text(2, 100), 5),
    movement_pattern: z.enum(MOVEMENT_PATTERNS),
    primary_muscles: muscleList(4, 1),
    secondary_muscles: muscleList(6),
    equipment_ids: distinct(equipmentSlugSchema, 4),
    mechanics: z.enum(EXERCISE_MECHANICS),
    load_type: z.enum(LOAD_TYPES),
    unilateral: z.boolean(),
    difficulty: intIn(L.difficulty),
    caution_tags: distinct(z.enum(CAUTION_TAGS), CAUTION_TAGS.length),
    description_de: text(30, 600),
    steps_de: z.array(text(10, 300)).min(2).max(8),
    tips_de: z.array(text(10, 300)).min(1).max(6),
    common_mistakes_de: z.array(text(10, 300)).min(1).max(6),
    safety_note_de: text(20, 400),
    alternatives: z.array(exerciseAlternativeSchema).max(10),
    meta: contentMetaSchema,
  })
  .superRefine((exercise, ctx) => {
    const overlap = exercise.primary_muscles.filter((m) => exercise.secondary_muscles.includes(m));
    if (overlap.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['secondary_muscles'],
        message: `Muskel gleichzeitig Haupt- und Nebenmuskel: ${overlap.join(', ')}.`,
      });
    }
    requireReviewerWhenPublished(exercise, ctx);
  });
export type Exercise = z.infer<typeof exerciseSchema>;

// ---------------------------------------------------------------------------------------------------------
// Plan-Vorlage mit Einheiten und Übungen
// ---------------------------------------------------------------------------------------------------------
export const templateExerciseSchema = z
  .strictObject({
    order_no: intIn(L.orderNo),
    exercise_id: contentIdSchema,
    sets: intIn(L.sets),
    reps_min: intIn(L.reps).nullable(),
    reps_max: intIn(L.reps).nullable(),
    duration_s: intIn(L.durationS).nullable(),
    rest_s: intIn(L.restS),
    rpe_target: z.number().min(L.rpe.min).max(L.rpe.max).multipleOf(0.5, 'RPE in 0,5er-Schritten.'),
    superset_group: z
      .string()
      .regex(/^[A-Z]$/, 'Supersatz-Gruppe: ein Großbuchstabe (A–Z).')
      .nullable(),
    notes_de: text(3, 300).nullable(),
  })
  .superRefine((item, ctx) => {
    const hasReps = item.reps_min !== null && item.reps_max !== null;
    const noReps = item.reps_min === null && item.reps_max === null;
    if (!((hasReps && item.duration_s === null) || (noReps && item.duration_s !== null))) {
      ctx.addIssue({
        code: 'custom',
        path: ['duration_s'],
        message: 'Entweder Wiederholungen (reps_min und reps_max) oder Dauer (duration_s) angeben.',
      });
    }
    if (hasReps && (item.reps_min as number) > (item.reps_max as number)) {
      ctx.addIssue({
        code: 'custom',
        path: ['reps_max'],
        message: 'reps_max muss mindestens reps_min sein.',
      });
    }
  });
export type TemplateExercise = z.infer<typeof templateExerciseSchema>;

export const templateSessionSchema = z
  .strictObject({
    day_index: intIn(TRAINING_LIMITS.sessionsPerWeek),
    name_de: text(2, 60),
    focus: z.enum(SESSION_FOCUSES),
    warmup_de: text(10, 400),
    cooldown_de: text(10, 400),
    exercises: z
      .array(templateExerciseSchema)
      .min(L.exercisesPerSession.min)
      .max(L.exercisesPerSession.max),
  })
  .superRefine((session, ctx) => {
    const orders = session.exercises.map((e) => e.order_no);
    if (new Set(orders).size !== orders.length) {
      ctx.addIssue({ code: 'custom', path: ['exercises'], message: 'order_no doppelt.' });
    }
  });
export type TemplateSession = z.infer<typeof templateSessionSchema>;

export const planTemplateSchema = z
  .strictObject({
    id: contentIdSchema,
    version: intIn(L.version),
    status: z.enum(CONTENT_STATUSES),
    title_de: text(5, 100),
    description_de: text(30, 800),
    goal_type: z.enum(TEMPLATE_GOAL_TYPES),
    experience_level: z.enum(TEMPLATE_EXPERIENCE_LEVELS),
    sessions_per_week: intIn(TRAINING_LIMITS.sessionsPerWeek),
    minutes_min: intIn(TRAINING_LIMITS.minutesPerSession),
    minutes_max: intIn(TRAINING_LIMITS.minutesPerSession),
    location: z.enum(EQUIPMENT_LOCATIONS),
    required_equipment_ids: distinct(equipmentSlugSchema, 20),
    optional_equipment_ids: distinct(equipmentSlugSchema, 20),
    sex: z.enum(SEX_OPTIONS).nullable(),
    sessions: z.array(templateSessionSchema).min(1).max(TRAINING_LIMITS.sessionsPerWeek.max),
    meta: contentMetaSchema,
  })
  .superRefine((template, ctx) => {
    if (template.minutes_min > template.minutes_max) {
      ctx.addIssue({
        code: 'custom',
        path: ['minutes_max'],
        message: 'minutes_max muss mindestens minutes_min sein.',
      });
    }
    const both = template.required_equipment_ids.filter((id) =>
      template.optional_equipment_ids.includes(id),
    );
    if (both.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['optional_equipment_ids'],
        message: `Gerät gleichzeitig Pflicht und optional: ${both.join(', ')}.`,
      });
    }
    requireReviewerWhenPublished(template, ctx);
  });
export type PlanTemplate = z.infer<typeof planTemplateSchema>;

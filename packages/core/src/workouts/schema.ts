import { z } from 'zod';

import { CONTENT_SCHEMA_LIMITS, FLOW_RULES, WORKOUT_LIMITS } from '../constants';
import { contentIdSchema, contentMetaSchema, equipmentSlugSchema } from '../content/schemas';
import { CONTENT_STATUSES } from '../enums';

/**
 * Workout-Inhalte `content/workouts/<id>.json` (docs/PLAN-WORKOUTS.md, Gründer-Wunsch 20.10.2026): vorab erstellte,
 * geprüfte Workouts mit Schwierigkeit in Sternen (1 leicht – 5 sehr schwer), Dauer, Equipment, Format und einer
 * Übungsliste aus der vorhandenen Übungsbibliothek. Regel W1 (Schema, rot, blockiert immer); W2–W7 in `checks.ts`.
 * Feldnamen in snake_case wie die übrigen Inhalte; in der Datenbank steht die Datei unverändert in `workouts.data`.
 */

/** Ziel/Kategorie (Liste und Filter). */
export const WORKOUT_CATEGORIES = [
  'full_body',
  'core',
  'upper_body',
  'legs_glutes',
  'hiit_cardio',
  'mobility',
  'back_fit',
  // Lauf-Kraft & Lauf-ABC (15-min-Einheiten zum Laufplan, docs/PLAN-CALISTHENICS-SCHLINGE.md 4; Datenbank per
  // `alter type … add value` in 20261026120000_calisthenics_enums.sql).
  'run_strength',
  // Sportarten Stufe 1 (docs/PLAN-SPORTARTEN-STUFE-1.md 2.3/2.4; Datenbank per `alter type … add value` in
  // 20261027100000_sportarten_stufe1_enums.sql): Yoga- und Pilates-Routinen, Rudern-Workouts am Rudergerät.
  'yoga',
  'pilates',
  'rowing',
] as const;
export type WorkoutCategory = (typeof WORKOUT_CATEGORIES)[number];

/**
 * Ablauf:
 * - `circuit`: Zirkel – alle Übungen nacheinander (je Wiederholungen ODER Sekunden), dann die nächste Runde.
 * - `interval`: Intervall – wie Zirkel, aber jede Übung nach Zeit (Belastung `duration_s`, Pause `rest_s`).
 * - `sets_reps`: Sätze × Wiederholungen – Übung für Übung, je Übung `sets` Sätze mit Pause `rest_s`, abhaken.
 * - `flow` (Sportarten Stufe 1, Yoga/Pilates/Mobility, Entscheidung 11): Pose für Pose nach Zeit OHNE Pausen-Bildschirm
 *   (`rest_s` und `round_rest_s` = 0), je Pose FLOW_RULES.poseS Sekunden, optional mit Seitenwechsel (`side`); Dauer
 *   höchstens FLOW_RULES.minutes. Datenbank per `alter type … add value` (20261027100000).
 */
export const WORKOUT_FORMATS = ['circuit', 'interval', 'sets_reps', 'flow'] as const;
export type WorkoutFormat = (typeof WORKOUT_FORMATS)[number];

const L = WORKOUT_LIMITS;

function text(min: number, max: number) {
  return z
    .string()
    .min(min, `Mindestens ${min} Zeichen.`)
    .max(max, `Höchstens ${max} Zeichen.`)
    .refine((value) => value === value.trim(), 'Kein Leerzeichen am Anfang oder Ende.');
}

function intIn(limits: { readonly min: number; readonly max: number }) {
  return z.number().int('Ganze Zahl erwartet.').min(limits.min).max(limits.max);
}

/** Seitenwechsel einer Pose (Format `flow`, Sportarten Stufe 1): `both` = erst rechts, dann links, je `duration_s`. */
export const WORKOUT_ITEM_SIDES = ['both'] as const;
export type WorkoutItemSide = (typeof WORKOUT_ITEM_SIDES)[number];

/**
 * Eine Übung im Workout. Genau eines von `reps` (Wiederholungen, einseitig: je Seite) und `duration_s`. `duration_s`
 * höchstens WORKOUT_LIMITS.workS.max – nur im Format `flow` bis FLOW_RULES.poseS.max (Prüfung im Workout).
 */
export const workoutItemSchema = z
  .strictObject({
    exercise_id: contentIdSchema,
    reps: intIn(L.reps).nullable(),
    duration_s: intIn({ min: L.workS.min, max: FLOW_RULES.poseS.max }).nullable(),
    /** Nur bei `sets_reps`: Sätze dieser Übung. */
    sets: intIn(L.sets).nullable(),
    /** Pause nach der Übung (Zirkel/Intervall) bzw. zwischen den Sätzen (Sätze × Wdh.). */
    rest_s: intIn(L.restS),
    note_de: text(3, 200).nullable(),
    /**
     * Seitenwechsel (Sportarten Stufe 1): `both` = die Pose je Seite `duration_s` Sekunden („rechts / links“). Optional
     * (fehlt = null = kein Seitenwechsel), damit vorhandene Inhalte gültig bleiben; nur mit `duration_s`.
     */
    side: z.enum(WORKOUT_ITEM_SIDES).nullable().optional(),
  })
  .superRefine((item, ctx) => {
    if ((item.reps === null) === (item.duration_s === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['duration_s'],
        message: 'Entweder Wiederholungen (reps) oder Sekunden (duration_s) angeben.',
      });
    }
    if (item.side != null && item.duration_s === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['side'],
        message: 'Seitenwechsel nur nach Zeit (duration_s).',
      });
    }
  });
export type WorkoutContentItem = z.infer<typeof workoutItemSchema>;

export const workoutSchema = z
  .strictObject({
    id: contentIdSchema,
    version: intIn(CONTENT_SCHEMA_LIMITS.version),
    status: z.enum(CONTENT_STATUSES),
    title_de: text(3, 60),
    summary_de: text(20, 300),
    category: z.enum(WORKOUT_CATEGORIES),
    /** Sterne 1–5 (1 leicht … 5 sehr schwer). */
    difficulty: intIn(L.stars),
    /** Dauer des Timers in Minuten (ohne Aufwärmen). */
    minutes: intIn(L.minutes),
    format: z.enum(WORKOUT_FORMATS),
    /** Runden (Zirkel/Intervall); bei Sätze × Wdh. immer 1. */
    rounds: intIn(L.rounds),
    /** Pause zwischen zwei Runden (ersetzt die Pause nach der letzten Übung einer Runde). */
    round_rest_s: intIn(L.roundRestS),
    /** Alle Geräte der Übungen (Regel W3: genau die Vereinigung); leer = ohne Geräte. */
    equipment_ids: z
      .array(equipmentSlugSchema)
      .max(8)
      .refine((values) => new Set(values).size === values.length, 'Doppelte Einträge.'),
    warmup_de: text(20, 400),
    cooldown_de: text(10, 400),
    exercises: z.array(workoutItemSchema).min(L.exercises.min).max(L.exercises.max),
    meta: contentMetaSchema,
  })
  .superRefine((workout, ctx) => {
    const ids = workout.exercises.map((item) => item.exercise_id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['exercises'],
        message: 'Jede Übung höchstens einmal je Workout (ein Tagebuch-Eintrag je Übung).',
      });
    }
    workout.exercises.forEach((item, i) => {
      if (workout.format === 'sets_reps' && item.sets === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['exercises', i, 'sets'],
          message: 'Sätze × Wdh.: „sets“ angeben.',
        });
      }
      if (workout.format !== 'sets_reps' && item.sets !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['exercises', i, 'sets'],
          message: 'Zirkel/Intervall: Runden statt Sätze – „sets“ leer lassen.',
        });
      }
      if (workout.format === 'interval' && item.duration_s === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['exercises', i, 'duration_s'],
          message: 'Intervall: jede Übung nach Zeit (duration_s).',
        });
      }
      if (workout.format === 'flow') {
        const { min, max } = FLOW_RULES.poseS;
        if (item.duration_s === null || item.duration_s < min || item.duration_s > max) {
          ctx.addIssue({
            code: 'custom',
            path: ['exercises', i, 'duration_s'],
            message: `Flow: jede Pose nach Zeit, ${min}–${max} s (duration_s).`,
          });
        }
        if (item.rest_s !== 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['exercises', i, 'rest_s'],
            message: 'Flow: ohne Pausen – „rest_s“ = 0.',
          });
        }
      } else if (item.duration_s !== null && item.duration_s > L.workS.max) {
        ctx.addIssue({
          code: 'custom',
          path: ['exercises', i, 'duration_s'],
          message: `Höchstens ${L.workS.max} s je Übung (länger nur im Format „flow“).`,
        });
      }
    });
    if (workout.format === 'flow') {
      if (workout.round_rest_s !== 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['round_rest_s'],
          message: 'Flow: ohne Pausen – „round_rest_s“ = 0.',
        });
      }
      if (workout.minutes < FLOW_RULES.minutes.min || workout.minutes > FLOW_RULES.minutes.max) {
        ctx.addIssue({
          code: 'custom',
          path: ['minutes'],
          message: `Flow: ${FLOW_RULES.minutes.min}–${FLOW_RULES.minutes.max} Minuten.`,
        });
      }
    }
    if (workout.format === 'sets_reps' && (workout.rounds !== 1 || workout.round_rest_s !== 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['rounds'],
        message: 'Sätze × Wdh.: „rounds“ = 1 und „round_rest_s“ = 0.',
      });
    }
    if (workout.status === 'published' && workout.meta.reviewed_by === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['meta', 'reviewed_by'],
        message: 'Freigegeben ohne Prüfer: bitte „reviewed_by“ und „reviewed_at“ eintragen.',
      });
    }
  });
export type Workout = z.infer<typeof workoutSchema>;

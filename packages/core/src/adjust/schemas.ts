import { z } from 'zod';

import { LIVE_ADJUSTMENT, PLANNED_LOAD_LIMITS, TEMPLATE_DOSAGE_LIMITS } from '../constants';
import { workoutStepSchema } from '../plan/intensity';
import { ACTIVE_ADJUSTMENT_RULES, ADJUSTMENT_KINDS, ADJUSTMENT_STATUSES, RULE_KIND } from './types';

/**
 * Zod-Schemas der Live-Anpassung (docs/PLAN-PHASE-4B.md 5.7) = Feldliste von apply_plan_adjustments (Etappe B prüft
 * dieselben Schlüssel mit private.assert_json_keys; Abgleich in db-sync.test.ts). Strikt: unbekannte Schlüssel sind
 * Fehler. `explain_params` nur Zahlen, Datumsangaben und Übungs-IDs – kein Freitext.
 */

const isoDate = z.iso.date();
const D = TEMPLATE_DOSAGE_LIMITS;

/** Zustands-Vorgabe = ExerciseProgress (gleiche Grenzen wie state_* in exercise_logs). */
export const stateOverrideSchema = z.strictObject({
  weightKg: z
    .number()
    .min(PLANNED_LOAD_LIMITS.targetWeightKg.min)
    .max(PLANNED_LOAD_LIMITS.targetWeightKg.max)
    .nullable(),
  targetReps: z.number().int().min(D.reps.min).max(D.reps.max).nullable(),
  extraSet: z.boolean(),
  durationS: z.number().int().min(D.durationS.min).max(D.durationS.max).nullable(),
});

const exerciseChangeSchema = z.strictObject({
  order_no: z.number().int().min(1).max(8),
  sets: z.number().int().min(D.sets.min).max(D.sets.max).optional(),
  rpe_target: z.number().min(D.rpe.min).max(D.rpe.max).multipleOf(0.5).optional(),
  exercise_id: z.string().min(1).max(100).optional(),
  exercise_name_de: z.string().min(1).max(100).optional(),
});

const sessionChangeSchema = z.strictObject({
  id: z.string().min(1),
  is_deload: z.boolean().optional(),
  estimated_minutes: z.number().int().min(1).max(600).optional(),
  workout_steps: z.array(workoutStepSchema).min(1).max(40).optional(),
  target_distance_m: z.number().int().positive().nullable().optional(),
  exercises: z.array(exerciseChangeSchema).max(8).optional(),
});

export const planChangeSchema = z.strictObject({
  sessions: z.array(sessionChangeSchema).max(LIVE_ADJUSTMENT.maxPlannedSessionsPerAdjustment),
});

export const fewerDaysChangeSchema = z.strictObject({
  days: z.number().int().min(1).max(7),
  drop_weekday: z.number().int().min(1).max(7).optional(),
});

/** Erklär-Parameter: nur Zahlen, ISO-Datum und Übungs-IDs (Kleinbuchstaben, Ziffern, Bindestrich, Unterstrich). */
export const explainParamsSchema = z.record(
  z.string().regex(/^[a-z][a-z_]{0,30}$/),
  z.union([z.number().finite(), isoDate, z.string().regex(/^[a-z0-9][a-z0-9_-]{0,99}$/)]),
);

const baseFields = {
  requiresConfirmation: z.boolean(),
  exerciseId: z.string().min(1).max(100).nullable(),
  plannedSessionIds: z
    .array(z.string().min(1))
    .max(LIVE_ADJUSTMENT.maxPlannedSessionsPerAdjustment),
  basisSessionLogId: z.string().min(1).nullable(),
  basisPerformedOn: isoDate.nullable(),
  explainParams: explainParamsSchema,
  effectiveFrom: isoDate,
  expiresOn: isoDate.nullable(),
  inputFingerprint: z.string().regex(/^[a-z_]+:[0-9a-f]{16}$/),
  engineVersion: z.number().int().min(1),
  ruleVersion: z.number().int().min(1),
  usesBodyData: z.boolean(),
  fromHealthPlan: z.boolean(),
};

const stateRule = <R extends 'fast_increase' | 'load_reduce'>(rule: R) =>
  z.strictObject({
    ...baseFields,
    rule: z.literal(rule),
    kind: z.literal('state_override'),
    exerciseId: z.string().min(1).max(100),
    stateBefore: stateOverrideSchema,
    stateAfter: stateOverrideSchema,
    changeBefore: z.null(),
    changeAfter: z.null(),
  });

const planRule = <
  R extends 'volume_reduce' | 'deload_forward' | 'endurance_reduce' | 'stagnation_variation',
>(
  rule: R,
) =>
  z.strictObject({
    ...baseFields,
    rule: z.literal(rule),
    kind: z.literal('plan_change'),
    stateBefore: z.null(),
    stateAfter: z.null(),
    changeBefore: planChangeSchema,
    changeAfter: planChangeSchema,
  });

/** Ein Vorschlag der Engine, je Regel ein eigener Typ (diskriminiert über `rule`). */
export const adjustmentProposalSchema = z
  .discriminatedUnion('rule', [
    stateRule('fast_increase'),
    stateRule('load_reduce'),
    planRule('volume_reduce'),
    planRule('deload_forward'),
    planRule('endurance_reduce'),
    planRule('stagnation_variation'),
    z.strictObject({
      ...baseFields,
      rule: z.literal('fewer_days'),
      kind: z.literal('proposal'),
      requiresConfirmation: z.literal(true),
      stateBefore: z.null(),
      stateAfter: z.null(),
      changeBefore: fewerDaysChangeSchema,
      changeAfter: fewerDaysChangeSchema,
      expiresOn: isoDate,
    }),
  ])
  .refine((p) => p.kind === RULE_KIND[p.rule], 'Art passt nicht zur Regel.')
  .refine(
    (p) => p.rule === 'fewer_days' || !p.requiresConfirmation,
    'Nur „weniger Trainingstage“ braucht eine Bestätigung.',
  )
  .refine(
    (p) =>
      p.kind !== 'plan_change' ||
      (p.changeAfter !== null &&
        'sessions' in p.changeAfter &&
        p.changeAfter.sessions.every((s) => p.plannedSessionIds.includes(s.id))),
    'Jede geänderte Einheit steht in planned_session_ids.',
  );

/** Gespeicherte Anpassung (plan_adjustments) – für Eingaben der Engine. */
export const storedAdjustmentSchema = z.looseObject({
  id: z.string().min(1),
  rule: z.enum(ACTIVE_ADJUSTMENT_RULES),
  kind: z.enum(ADJUSTMENT_KINDS),
  status: z.enum(ADJUSTMENT_STATUSES),
  createdAt: z.iso.datetime({ offset: true }),
  decidedAt: z.iso.datetime({ offset: true }).nullable(),
  exerciseId: z.string().nullable(),
  plannedSessionIds: z.array(z.string()),
  basisSessionLogId: z.string().nullable(),
  effectiveFrom: isoDate,
  stateAfter: stateOverrideSchema.nullable(),
  changeBefore: z.union([planChangeSchema, fewerDaysChangeSchema]).nullable(),
  changeAfter: z.union([planChangeSchema, fewerDaysChangeSchema]).nullable(),
});

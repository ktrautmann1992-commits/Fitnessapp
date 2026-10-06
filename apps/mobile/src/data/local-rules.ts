import {
  bodyMetricsStepSchema,
  cookingStepSchema,
  createBodyMeasurementsInputSchema,
  createMeasuredOnSchema,
  dietTypeSchema,
  enduranceDisciplineSchema,
  equipmentStepSchema,
  experienceLevelSchema,
  foodPreferenceSchema,
  goalTypeSchema,
  isoDateSchema,
  MEASUREMENT_SITES,
  measurementReminderIntervalSchema,
  nutritionStepSchema,
  onboardingStepSchema,
  sexSchema,
  trainingLocationSchema,
  trainingSlotsSchema,
  addDays,
  appendPlanBlockSchema,
  generatedSessionSchema,
  PLAN_SAVE_LIMITS,
  type PlanLibrary,
  type SavePlanSession,
  savePlanPayloadSchema,
  startOfIsoWeek,
  exerciseStartWeightSchema,
  isWithinLogDateWindow,
  SESSION_LOG_LIMITS,
  type Exercise,
  type SessionLogPayload,
  sessionLogPayloadSchema,
} from '@fitnessapp/core';

import type { ConsentVersions } from './mapping';
import { healthPlanBasis } from './training-plan';
import type { PlannedSessionRow, ProfileRow, UserRows } from './types';
import type { LogRejectReason } from './workout-draft';
import { kindsForScope, type WriteOp } from './write-ops';

/**
 * Testmodus: Prüft jeden Schreib-Vorgang wie die CHECK-Bedingungen und Trigger der Datenbank – mit den
 * Zod-Schemas und Grenzen aus packages/core (constants.ts). So kann auch im Testmodus kein Wert gespeichert
 * werden, den die echte Datenbank ablehnen würde (z. B. Größe 500 cm, Messdatum übermorgen).
 * Gibt true zurück, wenn der Vorgang gültig ist. Rein und getestet (local-rules.test.ts).
 */
export function isValidOp(op: WriteOp, context: { today: string; profile: ProfileRow }): boolean {
  switch (op.kind) {
    case 'update_profile': {
      const { patch } = op;
      const sex = patch.sex !== undefined ? patch.sex : context.profile.sex;
      const cycle =
        patch.cycle_module_interest !== undefined
          ? patch.cycle_module_interest
          : context.profile.cycle_module_interest;
      return (
        (patch.sex == null || sexSchema.safeParse(patch.sex).success) &&
        // Zyklus-Modul nur bei „weiblich“ (CHECK in profiles).
        (cycle == null || sex === 'female') &&
        (patch.experience_level == null ||
          experienceLevelSchema.safeParse(patch.experience_level).success) &&
        (patch.onboarding_step == null ||
          onboardingStepSchema.safeParse(patch.onboarding_step).success)
      );
    }
    case 'grant_consent':
      return true;
    case 'upsert_goals': {
      const row = op.row;
      return (
        goalTypeSchema.safeParse(row.goal_type).success &&
        (row.discipline === null ||
          (row.goal_type === 'endurance' &&
            enduranceDisciplineSchema.safeParse(row.discipline).success)) &&
        (row.target_date === null ||
          (isoDateSchema.safeParse(row.target_date).success && row.target_date >= '2000-01-01')) &&
        (row.training_location === null ||
          trainingLocationSchema.safeParse(row.training_location).success)
      );
    }
    // Gleiche Regeln wie public.replace_training_slots (1–7, lückenlos, fest ODER „Tag egal“, Grenzen).
    case 'replace_training_slots':
      return (
        op.rows.every((row) => row.user_id === context.profile.user_id) &&
        trainingSlotsSchema.safeParse(
          op.rows.map(({ slot_no, weekday, kind, minutes }) => ({
            slot_no,
            weekday,
            kind,
            minutes,
          })),
        ).success
      );
    case 'replace_user_equipment':
      return (
        op.rows.every((row) => row.location === op.location) &&
        equipmentStepSchema.safeParse({
          items: op.rows.map((row) => ({
            equipmentId: row.equipment_id,
            location: row.location,
            weightsKg: row.weights_kg,
            note: row.note,
            barKg: row.bar_kg,
          })),
        }).success
      );
    case 'upsert_nutrition_prefs': {
      const row = op.row;
      const cookingOk =
        row.cooking_mode === null
          ? row.mealprep_days === null
          : cookingStepSchema.safeParse(
              row.cooking_mode === 'meal_prep'
                ? { cookingMode: row.cooking_mode, mealprepDays: row.mealprep_days }
                : { cookingMode: row.cooking_mode },
            ).success &&
            (row.cooking_mode === 'meal_prep' || row.mealprep_days === null);
      const prefsOk =
        row.meals_per_day === null
          ? dietTypeSchema.safeParse(row.diet_type).success &&
            (row.diet_type === 'omnivore' || row.eats_pork !== true)
          : nutritionStepSchema.safeParse({
              dietType: row.diet_type,
              eatsPork: row.eats_pork,
              mealsPerDay: row.meals_per_day,
              foodPreferences: [],
            }).success;
      return prefsOk && cookingOk;
    }
    case 'replace_food_preferences': {
      const kinds = kindsForScope(op.scope);
      const prefs = op.rows.map((row) => ({ foodGroup: row.food_group, kind: row.kind }));
      return (
        op.rows.every((row) => kinds.includes(row.kind)) &&
        prefs.every((pref) => foodPreferenceSchema.safeParse(pref).success) &&
        // Doppelte Einträge und „mag“ + „mag nicht“ derselben Gruppe – gleiche Regel wie im Schritt.
        nutritionStepSchema.safeParse({
          dietType: 'omnivore',
          mealsPerDay: 1,
          foodPreferences: prefs,
        }).success
      );
    }
    case 'upsert_body_metrics': {
      const row = op.row;
      return (
        createMeasuredOnSchema(context.today).safeParse(row.measured_on).success &&
        bodyMetricsStepSchema.safeParse({
          heightCm: row.height_cm,
          weightKg: row.weight_kg,
          bodyFatPct: row.body_fat_pct,
          restingHeartRateBpm: row.resting_heart_rate_bpm,
        }).success
      );
    }
    case 'upsert_body_measurements': {
      const input: Record<string, unknown> = { measuredOn: op.row.measured_on };
      for (const site of MEASUREMENT_SITES) {
        input[site.id] = op.row[site.column];
      }
      return createBodyMeasurementsInputSchema(context.today).safeParse(input).success;
    }
    case 'insert_health_screening':
      // Antworten und Arzt-Hinweis prüft local-backend.ts (Flags wie der Datenbank-Trigger).
      return true;
    case 'upsert_measurement_reminder':
      return (
        measurementReminderIntervalSchema.safeParse(op.row.interval_days).success &&
        (op.row.next_due_on === null || isoDateSchema.safeParse(op.row.next_due_on).success)
      );
    // Eigenes Startgewicht: CHECK 0,5–500 kg (exerciseStartWeightSchema), Profil-Pflicht prüft der Aufrufer.
    case 'set_exercise_start_weight':
      return (
        op.weightKg === null ||
        exerciseStartWeightSchema.safeParse({ exercise_id: op.exerciseId, weight_kg: op.weightKg })
          .success
      );
    // Pläne brauchen mehr Zusammenhang (Bibliothek, alle Zeilen) → isValidPlanOp.
    case 'save_training_plan':
    case 'append_plan_block':
    case 'update_planned_session':
      return false;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Trainingspläne (Testmodus): dieselben Regeln wie save_training_plan, append_plan_block und der Trigger
// private.planned_sessions_before_update (supabase/migrations/2026100412*, 20261005130100_plan_session_kinds.sql).
// ---------------------------------------------------------------------------------------------------------

export interface PlanRuleContext {
  /** Heute (Europe/Berlin). */
  today: string;
  rows: UserRows;
  versions: ConsentVersions;
  /** Inhalte, die der Testmodus nutzen darf (statt „published“ in der Datenbank). */
  library: Pick<PlanLibrary, 'exercises' | 'templates'>;
}

/** Datenbank-Grenzen der Einheiten: generatedSessionSchema (= CHECKs) + Übungen aus der Bibliothek. */
function sessionsValid(
  sessions: readonly SavePlanSession[],
  ctx: PlanRuleContext,
  frame: { blockNo: number; earliest: string; latest: string },
): boolean {
  return sessions.every(
    (s) =>
      generatedSessionSchema.safeParse(s).success &&
      s.block_no === frame.blockNo &&
      s.scheduled_on >= frame.earliest &&
      s.scheduled_on <= frame.latest &&
      (frame.blockNo === 1 || (s.week_no >= 1 && !s.is_intro_week)) &&
      s.exercises.every(
        (e) =>
          ctx.library.exercises.has(e.exercise_id) &&
          ctx.library.exercises.has(e.source_exercise_id),
      ),
  );
}

/**
 * Nie zwei geplante Einheiten an einem Tag – auch über Pläne hinweg (eindeutiger Index). Wie in der Datenbank seit
 * Phase 4 (Etappe B, Festlegung 1) belegen nur `planned`-Einheiten ihren Tag; eine erledigte nicht mehr (sonst wäre
 * ein neuer Plan mit einer Einheit am Tag eines heute erledigten Trainings nicht speicherbar). Die App selbst bietet
 * das Verschieben auf einen erledigten Tag weiterhin nicht an (rescheduleSession, konservativ – Wächter S4).
 */
function noCollisions(existing: readonly PlannedSessionRow[], dates: readonly string[]): boolean {
  const taken = new Set(existing.filter((s) => s.status === 'planned').map((s) => s.scheduled_on));
  return new Set(dates).size === dates.length && dates.every((d) => !taken.has(d));
}

export function isValidPlanOp(op: WriteOp, ctx: PlanRuleContext): boolean {
  const { rows, today } = ctx;
  if (!rows.profile) return false;
  const yesterday = addDays(today, -PLAN_SAVE_LIMITS.pastToleranceDays);
  switch (op.kind) {
    case 'save_training_plan': {
      const parsed = savePlanPayloadSchema.safeParse(op.payload);
      if (!parsed.success) return false;
      const plan = op.payload;
      if (plan.template_id === null) {
        if (plan.sessions.some((s) => s.kind !== 'endurance')) return false;
      } else if (
        !ctx.library.templates.some(
          (t) => t.id === plan.template_id && t.version === plan.template_version,
        )
      ) {
        return false;
      }
      // uses_health_data / medical_notice bestimmt die Regel selbst – abweichende Eingabe wird abgelehnt.
      const basis = healthPlanBasis(rows, ctx.versions);
      if (
        plan.uses_health_data !== basis.usesHealthData ||
        plan.medical_notice !== basis.medicalNotice
      ) {
        return false;
      }
      if (
        plan.start_date < yesterday ||
        plan.start_date > addDays(today, PLAN_SAVE_LIMITS.startDateMaxDaysAhead) ||
        plan.sessions.some((s) => s.scheduled_on < plan.start_date)
      ) {
        return false;
      }
      if (
        !sessionsValid(plan.sessions, ctx, {
          blockNo: 1,
          earliest: yesterday,
          latest: addDays(today, PLAN_SAVE_LIMITS.scheduleMaxDaysAhead),
        })
      ) {
        return false;
      }
      // Der bisherige aktive Plan verliert seine geplanten Einheiten ab gestern.
      const old = rows.plans.find((p) => p.status === 'active');
      const remaining = rows.plannedSessions.filter(
        (s) => !(s.plan_id === old?.id && s.status === 'planned' && s.scheduled_on >= yesterday),
      );
      return noCollisions(
        remaining,
        plan.sessions.map((s) => s.scheduled_on),
      );
    }
    case 'append_plan_block': {
      const plan = rows.plans.find((p) => p.id === op.planId && p.status === 'active');
      if (!plan || !appendPlanBlockSchema.safeParse(op.sessions).success) return false;
      if (plan.template_id === null && op.sessions.some((s) => s.kind !== 'endurance')) {
        return false;
      }
      const basis = healthPlanBasis(rows, ctx.versions);
      if (
        basis.usesHealthData !== plan.uses_health_data ||
        basis.medicalNotice !== plan.medical_notice ||
        op.usesHealthData !== plan.uses_health_data
      ) {
        return false;
      }
      const own = rows.plannedSessions.filter((s) => s.plan_id === plan.id);
      const lastBlock = Math.max(0, ...own.map((s) => s.block_no));
      const lastDate =
        own
          .map((s) => s.scheduled_on)
          .sort()
          .at(-1) ?? today;
      const earliest = [yesterday, addDays(lastDate, 1)].sort().at(-1) as string;
      const latest = addDays(
        [lastDate, today].sort().at(-1) as string,
        PLAN_SAVE_LIMITS.scheduleMaxDaysAhead,
      );
      return (
        sessionsValid(op.sessions, ctx, { blockNo: lastBlock + 1, earliest, latest }) &&
        noCollisions(
          rows.plannedSessions,
          op.sessions.map((s) => s.scheduled_on),
        )
      );
    }
    case 'update_planned_session': {
      const session = rows.plannedSessions.find((s) => s.id === op.sessionId);
      if (!session || session.plan_id !== op.planId) return false;
      const plan = rows.plans.find((p) => p.id === session.plan_id);
      if (!plan || plan.status !== 'active' || plan.uses_health_data !== op.usesHealthData) {
        return false;
      }
      if (session.status !== 'planned') return false;
      const reference = session.original_date ?? session.scheduled_on;
      const weekStart = startOfIsoWeek(reference);
      if (addDays(weekStart, 6) < today) return false;
      if (op.scheduledOn !== session.scheduled_on) {
        if (session.is_deload) return false;
        if (op.scheduledOn < today || startOfIsoWeek(op.scheduledOn) !== weekStart) return false;
      }
      if (op.status === 'skipped') return true;
      return noCollisions(
        rows.plannedSessions.filter((s) => s.id !== session.id),
        [op.scheduledOn],
      );
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Trainingstagebuch (Testmodus): dieselben Regeln wie public.save_session_log
// (supabase/migrations/20261006120200_training_log_rpcs.sql, docs/PLAN-PHASE-4.md 3.6 Punkt 1, 4.6).
// ---------------------------------------------------------------------------------------------------------

export interface LogRuleContext {
  /** Heute (Europe/Berlin). */
  today: string;
  rows: UserRows;
  /** Übungen, die der Testmodus kennt (statt „published bzw. archiviert und eigen“ in der Datenbank). */
  exercises: ReadonlyMap<string, Pick<Exercise, 'load_type'>>;
  /** Gültige Einwilligung health_data (has_valid_consent). */
  healthConsentValid: boolean;
  /** Heute schon neu angelegte Einträge (Tageslimit, K1). */
  createdToday: number;
}

export type LogCheck =
  /** Gleiche write_id erneut gesendet (R4) – ok ohne erneutes Ersetzen. */
  | { kind: 'repeat'; result: 'ok' | 'orphaned'; id: string; revision: number }
  | { kind: 'conflict'; id: string | null; revision: number | null }
  | { kind: 'reject'; reason: LogRejectReason }
  | {
      kind: 'write';
      result: 'ok' | 'orphaned';
      id: string;
      revision: number;
      linked: boolean;
      keepTargets: boolean;
      fromHealthPlan: boolean;
      isIntroWeek: boolean;
      isDeload: boolean;
      isNew: boolean;
    };

/**
 * Prüft einen Eintrag wie save_session_log (Reihenfolge wie dort: Idempotenz und Konflikt VOR Art und Datum, S3):
 * Zod-Schema (= Feldliste), verwaist (B4/H-a), Revision (W3), write_id (R4), Art, Datumsfenster (W2), Tageslimit,
 * nie stapeln, Übungen bekannt mit passender Belastungsart, planned_exercise_id gehört zur Einheit, `alternative` ⇔
 * andere Übung, Vorgaben aus Gesundheits-Plänen nur mit gültiger Einwilligung (S1/H-c, Festlegung 4).
 */
export function checkSessionLog(payload: SessionLogPayload, ctx: LogRuleContext): LogCheck {
  if (!sessionLogPayloadSchema.safeParse(payload).success) {
    return { kind: 'reject', reason: 'invalid' };
  }
  const { rows } = ctx;
  const planned = payload.planned_session_id
    ? rows.plannedSessions.find((s) => s.id === payload.planned_session_id)
    : undefined;
  const linked = planned !== undefined;
  const plan = planned ? rows.plans.find((p) => p.id === planned.plan_id) : undefined;
  const keepTargets = linked && (!(plan?.uses_health_data ?? false) || ctx.healthConsentValid);
  const fromHealthPlan = keepTargets && (plan?.uses_health_data ?? false);
  const result = payload.planned_session_id !== null && !linked ? 'orphaned' : 'ok';

  const existing = linked
    ? rows.sessionLogs.find((l) => l.planned_session_id === planned.id)
    : rows.sessionLogs.find((l) => l.id === payload.id);
  if (!linked && existing && existing.planned_session_id !== null) {
    return { kind: 'reject', reason: 'invalid' };
  }
  if (existing && existing.last_write_id === payload.write_id) {
    return {
      kind: 'repeat',
      result:
        payload.planned_session_id !== null && existing.planned_session_id === null
          ? 'orphaned'
          : 'ok',
      id: existing.id,
      revision: existing.revision,
    };
  }
  if (existing && payload.base_revision !== existing.revision) {
    return { kind: 'conflict', id: existing.id, revision: existing.revision };
  }
  if (!existing && payload.base_revision !== null) {
    return { kind: 'conflict', id: null, revision: null };
  }

  if (linked && planned.kind !== payload.kind) return { kind: 'reject', reason: 'invalid' };
  const reference = planned
    ? (planned.original_date ?? planned.scheduled_on)
    : payload.planned_date;
  if (!isWithinLogDateWindow(payload.performed_on, reference, ctx.today)) {
    return { kind: 'reject', reason: 'date_window' };
  }
  if (!existing && ctx.createdToday >= SESSION_LOG_LIMITS.maxLogsPerDay) {
    return { kind: 'reject', reason: 'daily_limit' };
  }
  if (
    linked &&
    rows.sessionLogs.some(
      (l) =>
        l.performed_on === payload.performed_on &&
        l.planned_session_id !== null &&
        l.planned_session_id !== planned.id,
    )
  ) {
    return { kind: 'reject', reason: 'day_taken' };
  }
  const plannedIds = payload.exercises
    .map((e) => e.planned_exercise_id)
    .filter((id): id is string => id !== null);
  if (new Set(plannedIds).size !== plannedIds.length) return { kind: 'reject', reason: 'invalid' };
  for (const e of payload.exercises) {
    if (ctx.exercises.get(e.exercise_id)?.load_type !== e.load_type) {
      return { kind: 'reject', reason: 'invalid' };
    }
    if (linked && e.planned_exercise_id !== null) {
      const plannedExercise = rows.plannedExercises.find(
        (p) => p.id === e.planned_exercise_id && p.session_id === planned.id,
      );
      if (
        !plannedExercise ||
        (e.status === 'alternative') === (plannedExercise.exercise_id === e.exercise_id)
      ) {
        return { kind: 'reject', reason: 'invalid' };
      }
    } else if (linked && e.status === 'alternative') {
      return { kind: 'reject', reason: 'invalid' };
    }
  }
  return {
    kind: 'write',
    result,
    id: existing?.id ?? payload.id,
    revision: (existing?.revision ?? 0) + 1,
    linked,
    keepTargets,
    fromHealthPlan,
    isIntroWeek: planned ? planned.is_intro_week : payload.is_intro_week,
    isDeload: planned ? planned.is_deload : payload.is_deload,
    isNew: !existing,
  };
}

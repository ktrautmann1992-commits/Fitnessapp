import { z } from 'zod';

import { ageInYears, isoDateSchema } from '../age';
import {
  CONTENT_SCHEMA_LIMITS,
  MIN_AGE_YEARS,
  PLAN_BLOCK_LIMITS,
  PLAN_ENGINE_VERSION,
  PLANNED_LOAD_LIMITS,
  TEMPLATE_DOSAGE_LIMITS,
} from '../constants';
import { startOfIsoWeek } from '../dates';
import {
  PLAN_MATCH_QUALITIES,
  PLAN_NOTES,
  type PlanMatchQuality,
  type PlanNote,
  SESSION_FOCUSES,
} from '../enums';
import { adaptTemplate } from './adapt';
import type { PlanLibrary } from './content-pool';
import { loadWeeksBeforeDeload } from './deload';
import { equipmentProfile } from './equipment-profile';
import {
  type PlanInputs,
  type PlanInputsInput,
  planInputsSchema,
  planInputsSnapshot,
} from './inputs';
import { matchTemplate, plannedSessionsPerWeek } from './match';
import { type PlanSafetyRules, planSafetyRules } from './safety';
import {
  buildPlanBlock,
  chooseTrainingDays,
  type GeneratedSession,
  hasBackToBackSessions,
} from './schedule';

/**
 * Hauptfunktion der Plan-Engine (docs/PLAN-PHASE-3.md Abschnitt 5): Angaben prüfen → Sicherheitsregeln →
 * Vorlage wählen → anpassen → Tage wählen → ersten Plan-Block bauen. Rein und deterministisch; das Datum wird
 * übergeben. Keine KI.
 */

const D = TEMPLATE_DOSAGE_LIMITS;

const rpeSchema = z
  .number()
  .min(D.rpe.min)
  .max(D.rpe.max)
  .refine((v) => Number.isInteger(v * 2), 'RPE in 0,5er-Schritten.');

/** Grenzen einer geplanten Übung = CHECK-Bedingungen von planned_exercises (Etappe B). */
export const generatedExerciseSchema = z
  .object({
    order_no: z.number().int().min(1).max(PLAN_BLOCK_LIMITS.exercisesPerSession),
    exercise_id: z.string().min(1),
    source_exercise_id: z.string().min(1),
    exercise_name_de: z.string().min(2).max(100),
    sets: z.number().int().min(D.sets.min).max(D.sets.max),
    reps_min: z.number().int().min(D.reps.min).max(D.reps.max).nullable(),
    reps_max: z.number().int().min(D.reps.min).max(D.reps.max).nullable(),
    duration_s: z.number().int().min(D.durationS.min).max(D.durationS.max).nullable(),
    rest_s: z
      .number()
      .int()
      .min(CONTENT_SCHEMA_LIMITS.restS.min)
      .max(CONTENT_SCHEMA_LIMITS.restS.max),
    rpe_target: rpeSchema,
    superset_group: z
      .string()
      .regex(/^[A-Z]$/)
      .nullable(),
    notes_de: z.string().nullable(),
    target_weight_kg: z
      .number()
      .min(PLANNED_LOAD_LIMITS.targetWeightKg.min)
      .max(PLANNED_LOAD_LIMITS.targetWeightKg.max)
      .nullable(),
  })
  .refine(
    (e) =>
      (e.reps_min !== null &&
        e.reps_max !== null &&
        e.duration_s === null &&
        e.reps_min <= e.reps_max) ||
      (e.reps_min === null && e.reps_max === null && e.duration_s !== null),
    'Entweder Wiederholungen oder Dauer.',
  );

export const generatedSessionSchema = z
  .object({
    block_no: z
      .number()
      .int()
      .min(PLAN_BLOCK_LIMITS.blockNo.min)
      .max(PLAN_BLOCK_LIMITS.blockNo.max),
    week_no: z.number().int().min(PLAN_BLOCK_LIMITS.weekNo.min).max(PLAN_BLOCK_LIMITS.weekNo.max),
    is_intro_week: z.boolean(),
    is_deload: z.boolean(),
    template_day_index: z.number().int().min(1).max(7),
    scheduled_on: isoDateSchema,
    name_de: z.string().min(2).max(60),
    focus: z.enum(SESSION_FOCUSES),
    estimated_minutes: z.number().int().min(1).max(600),
    warmup_de: z.string(),
    cooldown_de: z.string(),
    exercises: z.array(generatedExerciseSchema).min(1).max(PLAN_BLOCK_LIMITS.exercisesPerSession),
  })
  .refine(
    (s) => !(s.is_intro_week && s.is_deload),
    'Einstiegs- und Erholungswoche schließen sich aus.',
  )
  .refine(
    (s) => new Set(s.exercises.map((e) => e.order_no)).size === s.exercises.length,
    'order_no doppelt.',
  );

export const generatedPlanSchema = z
  .object({
    template_id: z.string().min(3),
    template_title_de: z.string().min(5).max(100),
    template_version: z.number().int().min(1),
    engine_version: z.literal(PLAN_ENGINE_VERSION),
    match_quality: z.enum(PLAN_MATCH_QUALITIES),
    notes: z.array(z.enum(PLAN_NOTES)),
    uses_health_data: z.boolean(),
    medical_notice: z.boolean(),
    start_date: isoDateSchema,
    sessions: z.array(generatedSessionSchema).min(1),
  })
  .refine((p) => !p.medical_notice || p.uses_health_data, {
    path: ['medical_notice'],
    message: 'Arzt-Hinweis nur zusammen mit Gesundheitsdaten.',
  })
  .refine(
    (p) => new Set(p.sessions.map((s) => s.scheduled_on)).size === p.sessions.length,
    'Nie zwei Einheiten an einem Tag.',
  )
  .refine((p) => {
    const perWeek = new Map<string, number>();
    for (const s of p.sessions) {
      const key = `${s.block_no}:${startOfIsoWeek(s.scheduled_on)}`;
      perWeek.set(key, (perWeek.get(key) ?? 0) + 1);
    }
    return [...perWeek.values()].every((n) => n <= PLAN_BLOCK_LIMITS.sessionsPerWeek);
  }, 'Zu viele Einheiten in einer Woche.');

export interface GeneratedPlan {
  readonly template_id: string;
  readonly template_title_de: string;
  readonly template_version: number;
  readonly engine_version: number;
  readonly match_quality: PlanMatchQuality;
  /** Hinweis-Codes ohne Gesundheitsbezug (sortiert wie PLAN_NOTES). */
  readonly notes: readonly PlanNote[];
  /** Vorschlag der Engine – verbindlich bestimmt ihn die Datenbank (Abschnitt 8.1). */
  readonly uses_health_data: boolean;
  readonly medical_notice: boolean;
  /** Angaben ohne Gesundheitsdaten (user_plans.inputs). */
  readonly inputs: ReturnType<typeof planInputsSnapshot>;
  readonly start_date: string;
  readonly sessions: readonly GeneratedSession[];
  /** Gewählte Trainingstage (für den Folgeblock). */
  readonly training_days: readonly number[];
  /** Belastungswochen je Block (für den Folgeblock). */
  readonly load_weeks: number;
  /** Wirksame Sicherheitsregeln – NICHT speichern (nur Zwischenspeicher nach Frage 14). */
  readonly safety_rules: PlanSafetyRules;
  /** Plan enthält Entwurfs-Inhalte (nur Testmodus) → Kennzeichnung „Testinhalte“. */
  readonly uses_draft_content: boolean;
}

export type GeneratePlanResult =
  | { readonly ok: true; readonly plan: GeneratedPlan }
  | { readonly ok: false; readonly error: 'invalid_inputs' | 'no_template' };

/** Erzeugt den ersten Plan-Block. `today` = ISO-Datum (Europe/Berlin), `library` aus selectPlanContent(). */
export function generateTrainingPlan(
  rawInputs: PlanInputsInput,
  library: PlanLibrary,
  today: string,
): GeneratePlanResult {
  const parsed = planInputsSchema.safeParse(rawInputs);
  if (!parsed.success || !isoDateSchema.safeParse(today).success) {
    return { ok: false, error: 'invalid_inputs' };
  }
  const inputs: PlanInputs = parsed.data;
  // Mindestalter 16 (nicht abschaltbar) – auch hier, nicht nur im Onboarding.
  if (inputs.birthDate > today || ageInYears(inputs.birthDate, today) < MIN_AGE_YEARS) {
    return { ok: false, error: 'invalid_inputs' };
  }
  const rules = planSafetyRules(inputs, today);
  const profile = equipmentProfile(inputs.trainingLocation, inputs.homeEquipment);
  const match = matchTemplate(inputs, { library, profile, rules });
  if (!match) {
    return { ok: false, error: 'no_template' };
  }
  const adapted = adaptTemplate(match.template, {
    library: library.exercises,
    profile,
    rules,
    minutesPerSession: inputs.minutesPerSession,
  });
  if (adapted.sessions.length === 0) {
    return { ok: false, error: 'no_template' };
  }
  const notes = new Set<PlanNote>([...match.notes, ...adapted.notes]);
  const perWeek = Math.min(plannedSessionsPerWeek(inputs.sessionsPerWeek), adapted.sessions.length);
  const chosen = chooseTrainingDays(perWeek, inputs.preferredDays);
  if (chosen.added) notes.add('days_added');
  const loadWeeks = loadWeeksBeforeDeload(inputs.experienceLevel, rules.cautious);
  const sessions = buildPlanBlock({
    sessions: adapted.sessions,
    trainingDays: chosen.days,
    today,
    loadWeeks,
    rules,
  });
  if (hasBackToBackSessions(sessions)) notes.add('back_to_back_sessions');
  const quality: PlanMatchQuality =
    match.quality === 'exact' && !adapted.unchanged ? 'close' : match.quality;
  const usesDrafts =
    match.template.status === 'draft' ||
    sessions.some((s) =>
      s.exercises.some((e) => library.exercises.get(e.exercise_id)?.status === 'draft'),
    );
  const plan: GeneratedPlan = {
    template_id: match.template.id,
    template_title_de: match.template.title_de,
    template_version: match.template.version,
    engine_version: PLAN_ENGINE_VERSION,
    match_quality: quality,
    notes: PLAN_NOTES.filter((note) => notes.has(note)),
    uses_health_data: rules.usesHealthData,
    medical_notice: rules.medicalNotice,
    inputs: planInputsSnapshot(inputs),
    start_date: today,
    sessions,
    training_days: chosen.days,
    load_weeks: loadWeeks,
    safety_rules: rules,
    uses_draft_content: usesDrafts,
  };
  return { ok: true, plan };
}

/** Wiederverwendbar für Tests und App: ist der Plan innerhalb der Datenbank-Grenzen? */
export function isPlanWithinLimits(plan: GeneratedPlan): boolean {
  return generatedPlanSchema.safeParse(plan).success;
}

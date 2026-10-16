import { z } from 'zod';

import { ageInYears, isoDateSchema } from '../age';
import {
  COMPETITION_EFFORT_LIMITS,
  COMPETITION_PACE,
  CONTENT_SCHEMA_LIMITS,
  ENDURANCE_EFFORT,
  ENDURANCE_SESSION_LIMITS,
  TRAINING_LIMITS,
  MIN_AGE_YEARS,
  PLAN_BLOCK_LIMITS,
  PLAN_ENGINE_VERSION,
  PLANNED_LOAD_LIMITS,
  TEMPLATE_DOSAGE_LIMITS,
} from '../constants';
import { startOfIsoWeek } from '../dates';
import {
  ENDURANCE_MODALITIES,
  type EquipmentLocation,
  PLAN_MATCH_QUALITIES,
  PLAN_NOTES,
  PLANNED_SESSION_KINDS,
  type PlanMatchQuality,
  type PlanNote,
  SESSION_FOCUSES,
  type TrainingLocation,
} from '../enums';
import { isBodyweightTemplate } from '../content/checks';
import { adaptTemplate, type AdaptedSession, isVolumeReduced } from './adapt';
import {
  type CompetitionBlockSetup,
  type CompetitionFeasibility,
  competitionPlanSetup,
  type CompetitionRequest,
  type CompetitionWeekInfo,
} from './competition';
import { COMPETITION_PHASES } from './competition-schema';
import { isHardWorkoutType, WORKOUT_TYPES, workoutStepsSchema } from './intensity';
import type { PlanLibrary } from './content-pool';
import { loadWeeksBeforeDeload } from './deload';
import { equipmentProfile, isBodyweightOnly } from './equipment-profile';
import {
  type PlanInputs,
  type PlanInputsInput,
  planInputsSchema,
  planInputsSnapshot,
} from './inputs';
import { matchTemplate } from './match';
import type { MacroCycle } from './periodization';
import { type PlanSafetyRules, planSafetyRules } from './safety';
import {
  buildPlanBlock,
  type GeneratedSession,
  hasBackToBackSessions,
  isStrengthKind,
  locationOfKind,
  type PlannedDay,
  resolveTrainingWeek,
  spreadSubset,
} from './schedule';

/**
 * Hauptfunktion der Plan-Engine (docs/PLAN-PHASE-3.md Abschnitt 5; Engine-Version 2: docs/PLAN-PHASE-3-ERWEITERUNG.md
 * Abschnitt 5; Engine-Version 3 – aktuell, PLAN_ENGINE_VERSION: docs/PLAN-KOERPERGEWICHT.md §5): Angaben prüfen →
 * Sicherheitsregeln → Woche auflösen → bei Kraft-Tagen Vorlage + Anpassung je Ort → Plan-Block mit gemischten Tagen (Kraft je Termin gekürzt, Ausdauer nach
 * 10-%-Regel) → Hinweise. Rein und deterministisch; das Datum wird übergeben. Keine KI.
 */

const D = TEMPLATE_DOSAGE_LIMITS;

/**
 * Anstrengung einer Ausdauer-Einheit (= CHECK effort_target): in Phase 3 nur locker, 1 bis ENDURANCE_EFFORT.easyMax.
 */
export const ENDURANCE_EFFORT_LIMITS = { min: 1, max: ENDURANCE_EFFORT.easyMax } as const;

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

/**
 * Schema einer geplanten Einheit. `competition` = Wettkampfplan (Phase 10 WP2): Anstrengung bis
 * COMPETITION_EFFORT_LIMITS.max (Vorlage für den CHECK aus WP3, heute 1–4) und die Felder Art/Phase/Schritte/Distanz.
 */
function sessionSchema(effortMax: number) {
  // Felder des Wettkampfplans (optional; ohne Wettkampf fehlen sie – Prüfung unverändert).
  const extra = {
    workout_type: z.enum(WORKOUT_TYPES).nullable().optional(),
    training_phase: z.enum(COMPETITION_PHASES).optional(),
    workout_steps: workoutStepsSchema.nullable().optional(),
    target_distance_m: z
      .number()
      .int()
      .min(COMPETITION_PACE.distanceM.min)
      .max(COMPETITION_PACE.distanceM.max)
      .nullable()
      .optional(),
  };
  return z
    .object({
      ...extra,
      block_no: z
        .number()
        .int()
        .min(PLAN_BLOCK_LIMITS.blockNo.min)
        .max(PLAN_BLOCK_LIMITS.blockNo.max),
      week_no: z.number().int().min(PLAN_BLOCK_LIMITS.weekNo.min).max(PLAN_BLOCK_LIMITS.weekNo.max),
      is_intro_week: z.boolean(),
      is_deload: z.boolean(),
      kind: z.enum(PLANNED_SESSION_KINDS),
      template_day_index: z.number().int().min(1).max(7).nullable(),
      scheduled_on: isoDateSchema,
      name_de: z.string().min(2).max(60),
      focus: z.enum(SESSION_FOCUSES).nullable(),
      endurance_modality: z.enum(ENDURANCE_MODALITIES).nullable(),
      effort_target: z.number().int().min(ENDURANCE_EFFORT_LIMITS.min).max(effortMax).nullable(),
      estimated_minutes: z.number().int().min(1).max(600),
      warmup_de: z.string(),
      cooldown_de: z.string(),
      exercises: z.array(generatedExerciseSchema).max(PLAN_BLOCK_LIMITS.exercisesPerSession),
    })
    .refine(
      (s) => !(s.is_intro_week && s.is_deload),
      'Einstiegs- und Erholungswoche schließen sich aus.',
    )
    .refine(
      (s) => new Set(s.exercises.map((e) => e.order_no)).size === s.exercises.length,
      'order_no doppelt.',
    )
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
            s.effort_target !== null &&
            s.estimated_minutes >= ENDURANCE_SESSION_LIMITS.minSessionMinutes &&
            s.estimated_minutes <= TRAINING_LIMITS.minutesPerSession.max,
      'Kraft: Schwerpunkt und 1–8 Übungen; Ausdauer: Modalität, Anstrengung, keine Übungen.',
    );
}

export const generatedSessionSchema = sessionSchema(ENDURANCE_EFFORT_LIMITS.max);

/**
 * Einheit eines Wettkampfplans (WP2, Vorlage für die Server-Prüfung in WP3): wie generatedSessionSchema, dazu
 * Anstrengung > 4 nur bei harter Art, harte Arten nie in einer Erholungswoche (Tapering ausgenommen: „Intensität
 * bleibt“, Plan 3.1), Schritte ergeben genau die geplanten Minuten, Ausdauer immer mit Art und Phase.
 */
export const generatedCompetitionSessionSchema = sessionSchema(COMPETITION_EFFORT_LIMITS.max)
  .refine(
    (s) =>
      s.kind !== 'endurance' ||
      (s.effort_target ?? 0) <= COMPETITION_EFFORT_LIMITS.easyMax ||
      isHardWorkoutType(s.workout_type),
    'Anstrengung über 4 nur bei harter Art.',
  )
  .refine(
    (s) => !isHardWorkoutType(s.workout_type) || !s.is_deload || s.training_phase === 'taper',
    'Keine harte Einheit in einer Erholungswoche.',
  )
  .refine(
    (s) =>
      s.kind !== 'endurance' ||
      (s.workout_type != null &&
        s.training_phase !== undefined &&
        s.workout_steps != null &&
        s.workout_steps.reduce((sum, st) => sum + st.seconds, 0) === s.estimated_minutes * 60),
    'Ausdauer im Wettkampfplan: Art, Phase und Schritte (Summe = Dauer).',
  );

function planSchema<
  S extends z.ZodType<{ scheduled_on: string; block_no: number; kind: 'strength' | 'endurance' }>,
>(session: S) {
  return z
    .object({
      template_id: z.string().min(3).nullable(),
      template_title_de: z.string().min(5).max(100).nullable(),
      template_version: z.number().int().min(1).nullable(),
      engine_version: z.literal(PLAN_ENGINE_VERSION),
      match_quality: z.enum(PLAN_MATCH_QUALITIES),
      notes: z.array(z.enum(PLAN_NOTES)),
      uses_health_data: z.boolean(),
      medical_notice: z.boolean(),
      start_date: isoDateSchema,
      sessions: z.array(session).min(1),
    })
    .refine((p) => !p.medical_notice || p.uses_health_data, {
      path: ['medical_notice'],
      message: 'Arzt-Hinweis nur zusammen mit Gesundheitsdaten.',
    })
    .refine(
      (p) =>
        (p.template_id === null) === (p.template_title_de === null) &&
        (p.template_id === null) === (p.template_version === null),
      'Vorlage: alle drei Angaben oder keine.',
    )
    .refine(
      (p) => p.template_id !== null || p.sessions.every((s) => s.kind === 'endurance'),
      'Ohne Vorlage keine Kraft-Einheit.',
    )
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
}

export const generatedPlanSchema = planSchema(generatedSessionSchema);
/** Wettkampfplan (WP2) – Einheiten nach generatedCompetitionSessionSchema. */
export const generatedCompetitionPlanSchema = planSchema(generatedCompetitionSessionSchema);

export interface GeneratedPlan {
  /** null = reiner Ausdauer-Plan (keine Vorlage). */
  readonly template_id: string | null;
  readonly template_title_de: string | null;
  readonly template_version: number | null;
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
  /** Geplante Woche (Anzeige); der Folgeblock liest Tage und Arten aus den gespeicherten Einheiten. */
  readonly training_week: readonly PlannedDay[];
  /** Belastungswochen je Block (für den Folgeblock). */
  readonly load_weeks: number;
  /** Wirksame Sicherheitsregeln – NICHT speichern (nur Zwischenspeicher nach Frage 14). */
  readonly safety_rules: PlanSafetyRules;
  /** Plan enthält Entwurfs-Inhalte (nur Testmodus) → Kennzeichnung „Testinhalte“. */
  readonly uses_draft_content: boolean;
  /**
   * NUR beim Wettkampfplan (generateCompetitionPlan, Phase 10 WP1) – ohne Wettkampf fehlt der Schlüssel (Plan
   * byte-gleich zu vorher). Wird nicht gespeichert (keine Spalte bis WP3); Folgeblöcke rechnen neu.
   */
  readonly competition?: CompetitionPlanInfo;
}

/** Wettkampf-Teil eines Plans (Anzeige; nicht gespeichert). */
export interface CompetitionPlanInfo {
  readonly feasibility: CompetitionFeasibility;
  readonly cycle: MacroCycle;
  /** Plateau des Wochenumfangs (Spitzenumfang des wirksamen Ziels, gedeckelt durch den Wunsch). */
  readonly peak_target_minutes: number;
  /** Phase je Woche des ersten Blocks. */
  readonly block_weeks: readonly CompetitionWeekInfo[];
}

export type GeneratePlanResult =
  | { readonly ok: true; readonly plan: GeneratedPlan }
  | { readonly ok: false; readonly error: 'invalid_inputs' | 'no_template' };

export type GenerateCompetitionPlanResult =
  | GeneratePlanResult
  | {
      readonly ok: false;
      readonly error: 'competition_not_feasible';
      readonly feasibility: CompetitionFeasibility;
    };

/** Abgeleiteter Ort der Kraft-Tage (beide Orte → „beides“). */
function strengthLocation(days: readonly PlannedDay[]): TrainingLocation {
  const locations = new Set(days.map((d) => locationOfKind(d.kind)));
  return locations.size > 1 ? 'both' : locations.has('home') ? 'home' : 'gym';
}

/** Erzeugt den ersten Plan-Block. `today` = ISO-Datum (Europe/Berlin), `library` aus selectPlanContent(). */
export function generateTrainingPlan(
  rawInputs: PlanInputsInput,
  library: PlanLibrary,
  today: string,
): GeneratePlanResult {
  return generatePlan(rawInputs, library, today, null);
}

/**
 * Erster Block eines Wettkampfplans (docs/PLAN-PHASE-10.md Abschnitt 5, Etappe WP1): Ampel (competitionFeasibility) →
 * bei „passt“ oder „knapp“ derselbe Ablauf wie generateTrainingPlan, aber die Wochen des Blocks (Woche 0, Belastung,
 * Erholung, Tapering, Rennwoche, Erholung nach dem Rennen) kommen aus dem Makrozyklus (periodization.ts). „Zu kurz“ und
 * „nicht möglich“ erzeugen NIE einen Plan (`competition_not_feasible` mit Ampel und Vorschlägen). Folgeblöcke:
 * competitionFollowUpBlock() + nextPlanBlock(`competitionWeeks`).
 */
export function generateCompetitionPlan(
  rawInputs: PlanInputsInput,
  library: PlanLibrary,
  today: string,
  request: CompetitionRequest,
): GenerateCompetitionPlanResult {
  const setup = competitionPlanSetup(rawInputs, request, today);
  if (!setup.ok) return setup;
  const result = generatePlan(rawInputs, library, today, setup.firstBlock);
  if (!result.ok) return result;
  return {
    ok: true,
    plan: {
      ...result.plan,
      // Der Wettkampfplan IST der angekündigte Plan (WP2) – Hinweis „kommt später“ entfällt.
      notes: result.plan.notes.filter((note) => note !== 'endurance_basic_only'),
      competition: {
        feasibility: setup.feasibility,
        cycle: setup.cycle,
        peak_target_minutes: setup.peakTarget,
        block_weeks: setup.firstBlock.weeks,
      },
    },
  };
}

function generatePlan(
  rawInputs: PlanInputsInput,
  library: PlanLibrary,
  today: string,
  competition: CompetitionBlockSetup | null,
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
  const resolved = resolveTrainingWeek(inputs.schedule, rules.enduranceStartGroup);
  const notes = new Set<PlanNote>(resolved.notes);
  let days = [...resolved.days];
  const strengthDays = days.filter((d) => isStrengthKind(d.kind));

  let template: GeneratedPlan['template_id'] = null;
  let templateMeta: { title: string; version: number; status: string } | null = null;
  let quality: PlanMatchQuality = 'exact';
  let strength: Parameters<typeof buildPlanBlock>[0]['context']['strength'] = null;
  let templateForVolume: Parameters<typeof isVolumeReduced>[0] | null = null;

  if (strengthDays.length > 0) {
    const locations = strengthDays.map((d) => locationOfKind(d.kind));
    const homeCount = locations.filter((l) => l === 'home').length;
    // Vorlagen-Ort = Mehrheit der Kraft-Tage, Gleichstand Studio (Frage 5). Gemischte Woche mit Zuhause OHNE
    // Kraft-Geräte → immer Studio-Vorlage; die Zuhause-Tage tauschen auf Übungen ohne Geräte (Hinweis
    // `location_mismatch`). Eigenes Matching je Ort ist eine offene Verbesserung (PLAN-KOERPERGEWICHT A2, Frage 7).
    const mixedWithoutHomeEquipment =
      homeCount > 0 &&
      homeCount < locations.length &&
      isBodyweightOnly(equipmentProfile('home', inputs.homeEquipment));
    const primary: EquipmentLocation =
      !mixedWithoutHomeEquipment && homeCount > locations.length - homeCount ? 'home' : 'gym';
    const wishedStrength = inputs.schedule.slots.filter((s) => isStrengthKind(s.kind));
    const match = matchTemplate(
      {
        goalType: inputs.goalType,
        secondaryGoalType: inputs.secondaryGoalType,
        experienceLevel: inputs.experienceLevel,
        sessionsPerWeek: wishedStrength.length,
        minutesPerSession: Math.max(...strengthDays.map((d) => d.minutes)),
        trainingLocation: strengthLocation(strengthDays),
        sex: inputs.sex,
      },
      { library, profile: equipmentProfile(primary, inputs.homeEquipment), rules },
    );
    if (!match) {
      return { ok: false, error: 'no_template' };
    }
    match.notes.forEach((note) => notes.add(note));
    const versions = new Map<EquipmentLocation, readonly AdaptedSession[]>();
    let unchanged = true;
    for (const location of new Set<EquipmentLocation>([primary, ...locations])) {
      const adapted = adaptTemplate(match.template, {
        library: library.exercises,
        profile: equipmentProfile(location, inputs.homeEquipment),
        rules,
      });
      if (location !== match.template.location) notes.add('location_mismatch');
      if (locations.includes(location)) {
        adapted.notes.forEach((note) => notes.add(note));
        if (!adapted.unchanged) unchanged = false;
      }
      versions.set(location, adapted.sessions);
    }
    const primarySessions = versions.get(primary) ?? [];
    if (primarySessions.length === 0) {
      return { ok: false, error: 'no_template' };
    }
    // Mehr Kraft-Tage als Vorlagen-Einheiten → übrige Tage werden Ruhetage (größter Abstand bleibt).
    if (strengthDays.length > primarySessions.length) {
      const keep = spreadSubset(
        strengthDays.map((d) => d.weekday),
        primarySessions.length,
      );
      days = days.filter((d) => !isStrengthKind(d.kind) || keep.includes(d.weekday));
      notes.add('days_capped');
    }
    template = match.template.id;
    templateMeta = {
      title: match.template.title_de,
      version: match.template.version,
      status: match.template.status,
    };
    quality = match.quality === 'exact' && !unchanged ? 'close' : match.quality;
    strength = {
      primary,
      versions,
      library: library.exercises,
      protectLastCore: isBodyweightTemplate(match.template),
    };
    templateForVolume = match.template;
  }

  const enduranceDays = days.filter((d) => d.kind === 'endurance');
  // Ausdauer als Haupt- ODER Nebenziel (docs/PLAN-ZIELE.md 4.3): Wettkampfplan folgt mit Phase 10.
  if (inputs.goalType === 'endurance' || inputs.secondaryGoalType === 'endurance') {
    notes.add(enduranceDays.length > 0 ? 'endurance_basic_only' : 'goal_endurance_not_yet');
  }
  const loadWeeks = loadWeeksBeforeDeload(inputs.experienceLevel, rules.cautious);
  const block = buildPlanBlock({
    days,
    today,
    loadWeeks,
    context: {
      strength,
      endurance: {
        goalType: inputs.goalType,
        discipline: inputs.discipline,
        experienceLevel: inputs.experienceLevel,
        rules,
      },
      rules,
      enduranceWishWeekly: enduranceDays.reduce((sum, d) => sum + d.minutes, 0),
      ...(competition
        ? {
            enduranceReference: competition.reference,
            ...(competition.stricterGroup ? { enduranceStricterGroup: true } : {}),
            ...(competition.startMinutes === undefined
              ? {}
              : { enduranceStartMinutes: competition.startMinutes }),
          }
        : {}),
    },
    ...(competition ? { weeks: competition.specs } : {}),
  });
  block.notes.forEach((note) => notes.add(note));
  const sessions = block.sessions;
  if (sessions.length === 0) {
    return { ok: false, error: 'no_template' };
  }
  if (hasBackToBackSessions(sessions)) notes.add('back_to_back_sessions');
  if (templateForVolume) {
    // Kürzeste Fassung je Vorlagen-Einheit aus den Belastungswochen (vorsichtige Schätzung des Wochenumfangs).
    const shortest = new Map<number, GeneratedSession>();
    const sets = (s: GeneratedSession) => s.exercises.reduce((sum, e) => sum + e.sets, 0);
    for (const s of sessions) {
      if (s.kind !== 'strength' || s.is_deload || s.template_day_index === null) continue;
      const current = shortest.get(s.template_day_index);
      if (!current || sets(s) < sets(current)) shortest.set(s.template_day_index, s);
    }
    const picked = [...shortest.values()].map((s) => ({
      template_day_index: s.template_day_index as number,
      name_de: s.name_de,
      focus: s.focus ?? 'full_body',
      warmup_de: s.warmup_de,
      cooldown_de: s.cooldown_de,
      exercises: s.exercises,
    }));
    if (isVolumeReduced(templateForVolume, picked, library.exercises)) notes.add('volume_reduced');
  }
  const usesDrafts =
    templateMeta?.status === 'draft' ||
    sessions.some((s) =>
      s.exercises.some((e) => library.exercises.get(e.exercise_id)?.status === 'draft'),
    );
  const plan: GeneratedPlan = {
    template_id: template,
    template_title_de: templateMeta?.title ?? null,
    template_version: templateMeta?.version ?? null,
    engine_version: PLAN_ENGINE_VERSION,
    match_quality: quality,
    notes: PLAN_NOTES.filter((note) => notes.has(note)),
    uses_health_data: rules.usesHealthData,
    medical_notice: rules.medicalNotice,
    inputs: planInputsSnapshot(inputs),
    start_date: today,
    sessions,
    training_week: days,
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

/**
 * Wettkampfplan im Rahmen (WP2): Einheiten nach generatedCompetitionSessionSchema. Achtung: Bis WP3 erlaubt die
 * Datenbank nur Anstrengung 1–4 – ein Wettkampfplan mit harten Einheiten lässt sich erst danach speichern.
 */
export function isCompetitionPlanWithinLimits(plan: GeneratedPlan): boolean {
  return generatedCompetitionPlanSchema.safeParse(plan).success;
}

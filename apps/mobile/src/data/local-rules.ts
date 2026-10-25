import {
  bodyMetricsStepSchema,
  contentIdSchema,
  cookingStepSchema,
  createBodyMeasurementsInputSchema,
  createMeasuredOnSchema,
  dietTypeSchema,
  enduranceDisciplineSchema,
  equipmentStepSchema,
  experienceLevelSchema,
  foodPreferenceSchema,
  goalTypeSchema,
  isAllowedGoalPair,
  isoDateSchema,
  MEASUREMENT_SITES,
  measurementReminderIntervalSchema,
  nutritionSetupColumnsSchema,
  nutritionStepSchema,
  onboardingStepSchema,
  sexSchema,
  trainingLocationSchema,
  trainingSlotsSchema,
  addDays,
  appendPlanBlockSchema,
  generatedSessionSchema,
  generatedCompetitionSessionSchema,
  checkCompetitionSessions,
  type PersonRuleSession,
  workoutStepsSchema,
  WORKOUT_TYPES,
  PLAN_SAVE_LIMITS,
  type PlanLibrary,
  type SavePlanSession,
  savePlanPayloadSchema,
  startOfIsoWeek,
  type AdjustSession,
  checkWeekInvariants,
  loadWeeksBeforeDeload,
  exerciseStartWeightSchema,
  freeSessionPayloadIssue,
  isWithinLogDateWindow,
  SESSION_LOG_LIMITS,
  type Exercise,
  type SessionLogPayload,
  sessionLogPayloadSchema,
  canExclude,
  type EquipmentLocation,
  type EquipmentProfile,
  type ExercisePair,
  exercisePreferenceSchema,
  type PlanSafetyRules,
  preferenceLimitReached,
  weightGoalSchema,
  normalizeLayout,
  storedAppLayoutSchema,
  toStoredLayout,
} from '@fitnessapp/core';

import { validRecipePreferenceRow } from './recipe-preference-rows';

import type { ConsentVersions } from './mapping';
import { preferencesFromRows } from './exercise-swap';
import { healthPlanBasis, healthScreeningForPlan, planSnapshot } from './training-plan';
import type { GoalsRow, PlannedSessionRow, ProfileRow, UserPlanRow, UserRows } from './types';
import type { LogRejectReason } from './workout-draft';
import { kindsForScope, type WriteOp } from './write-ops';

/**
 * Testmodus: Prüft jeden Schreib-Vorgang wie die CHECK-Bedingungen und Trigger der Datenbank – mit den
 * Zod-Schemas und Grenzen aus packages/core (constants.ts). So kann auch im Testmodus kein Wert gespeichert
 * werden, den die echte Datenbank ablehnen würde (z. B. Größe 500 cm, Messdatum übermorgen).
 * Gibt true zurück, wenn der Vorgang gültig ist. Rein und getestet (local-rules.test.ts).
 */
export function isValidOp(
  op: WriteOp,
  context: {
    today: string;
    profile: ProfileRow;
    /** Aktuelle goals-Zeile (Wunschgewicht nur mit Abnehmziel, Trigger weight_goals_require_fat_loss). */
    goals?: GoalsRow | null;
  },
): boolean {
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
        // Zyklus-Interesse nicht bei „männlich“ und nicht ohne Geschlecht (CHECK in profiles, Phase 9 ZY-G4).
        (cycle == null || (sex != null && sex !== 'male')) &&
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
      // Ältere Aufrufer ohne Spalte (vor Etappe Z3): kein Nebenziel.
      const secondary = row.secondary_goal_type ?? null;
      return (
        goalTypeSchema.safeParse(row.goal_type).success &&
        // Paar-CHECK (private.goal_pair_allowed = GOAL_COMBINATIONS) und Disziplin-CHECK (Ausdauer Haupt- oder Nebenziel).
        (secondary === null ||
          (goalTypeSchema.safeParse(secondary).success &&
            isAllowedGoalPair(row.goal_type, secondary))) &&
        (row.discipline === null ||
          ((row.goal_type === 'endurance' || secondary === 'endurance') &&
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
    // Schritt nutrition_setup (Etappe N4): Werte wie die künftigen nutrition_prefs-Spalten (N7), nur eigenes Konto.
    case 'upsert_nutrition_setup': {
      const { user_id: userId, ...columns } = op.row;
      return (
        userId === context.profile.user_id && nutritionSetupColumnsSchema.safeParse(columns).success
      );
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
    // Wunschgewicht (Etappe Z3): eigene Zeile, CHECKs = weightGoalSchema, nur mit Abnehmziel (Wächter S13).
    case 'upsert_weight_goal': {
      const { row } = op;
      const goals = context.goals ?? null;
      return (
        row.user_id === context.profile.user_id &&
        goals !== null &&
        (goals.goal_type === 'fat_loss' || goals.secondary_goal_type === 'fat_loss') &&
        weightGoalSchema.safeParse({
          targetWeightKg: row.target_weight_kg,
          startDate: row.start_date,
          targetDate: row.target_date,
          amountMode: row.amount_mode,
          timeMode: row.time_mode,
        }).success
      );
    }
    case 'delete_weight_goal':
      return true;
    // Anordnung (Etappe E2): Form wie storedAppLayoutSchema, Regeln wie save_app_layout (Übersicht links, Mehr rechts,
    // nur bekannte IDs, keine Doppel) – die normalisierte Form erfüllt sie.
    case 'save_app_layout': {
      // Schrittziel (optional): 1.000–30.000 je 500 wie die Funktion (stepGoalSchema).
      const stored = {
        dashboard_tiles: op.row.dashboard_tiles,
        tab_bar: op.row.tab_bar,
        ...(op.row.step_goal === undefined || op.row.step_goal === null
          ? {}
          : { step_goal: op.row.step_goal }),
      };
      return (
        storedAppLayoutSchema.safeParse(stored).success &&
        JSON.stringify(toStoredLayout(normalizeLayout(stored), stored.step_goal)) ===
          JSON.stringify(stored)
      );
    }
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
    // Rezept-Favoriten (25.10.2026): wie CHECK/Trigger von recipe_preferences – eigene Zeile, gültige Art und ID,
    // Datum höchstens heute + 1 Tag.
    case 'set_recipe_preference':
      return op.row === null
        ? contentIdSchema.safeParse(op.recipeId).success
        : op.row.recipe_id === op.recipeId &&
            op.row.user_id === context.profile.user_id &&
            validRecipePreferenceRow(op.row) &&
            op.row.set_on <= addDays(context.today, 1);
    // Präferenzen und Pläne brauchen mehr Zusammenhang (Bibliothek, Einheit) → checkExercisePreference / isValidPlanOp.
    case 'upsert_exercise_preference':
    case 'delete_exercise_preference':
    case 'save_training_plan':
    case 'append_plan_block':
    case 'update_planned_session':
    case 'swap_planned_sessions':
      return false;
    // Ernährung (Etappe N7 Teil 2): nur im Supabase-Modus als Vorgang; der Testmodus hat eigene Wege
    // (meal-plan-rows.ts, food-log-rows.ts).
    case 'set_shopping_item_checked':
    case 'set_cook_day_start':
    case 'upsert_food_log_favorite':
    case 'delete_food_log_favorite':
      return false;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Übungs-Präferenzen (Testmodus, Etappe T2): dieselben Regeln wie später die RLS-Policies und der Limit-Trigger von
// exercise_preferences (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 5.2/9) plus canExclude wie im Tausch-Dialog.
// ---------------------------------------------------------------------------------------------------------

export interface PreferenceRuleContext {
  rows: UserRows;
  /**
   * Gebündelte Bibliothek des Testmodus: Ersatz nur aus `exercises` (Entwürfe ohne roten Befund bzw. freigegeben,
   * Wächter S7), die Übung selbst auch aus `displayExercises` (archiviert im eigenen Plan).
   */
  library: Pick<PlanLibrary, 'exercises' | 'displayExercises'>;
  /** Paar (gespeichert, angezeigt) der Einheit, an der getauscht wurde; null = Einheit unbekannt. */
  pair: Pick<ExercisePair, 'stored' | 'shown'> | null;
  inSession: ReadonlySet<string>;
  ambiguousLocation: boolean;
  /** displaySwapRules(Plan, Geburtsdatum, aktuelle Regeln); null = Angaben unvollständig. */
  swapRules: PlanSafetyRules | null;
  profiles: ReadonlyMap<EquipmentLocation, Pick<EquipmentProfile, 'available'>>;
}

/**
 * Präferenz-Vorgang gültig? Entfernen: eigenes Profil genügt. Anlegen/Ändern: eigene Zeile (user_id), strikt nach
 * exercisePreferenceSchema (Enum, Ersatz ≠ Übung, kein Freitext), Übung lesbar, Ersatz nur aus der angebotenen
 * Bibliothek, Obergrenze, und canExclude() für das Paar der Einheit (Kandidat vorhanden, Ersatz ist Kandidat).
 */
export function isValidPreferenceOp(op: WriteOp, ctx: PreferenceRuleContext): boolean {
  const profile = ctx.rows.profile;
  if (!profile) return false;
  if (op.kind === 'delete_exercise_preference') return true;
  if (op.kind !== 'upsert_exercise_preference') return false;
  const { user_id: userId, ...row } = op.row;
  const parsed = exercisePreferenceSchema.safeParse(row);
  if (userId !== profile.user_id || !parsed.success) return false;
  const pref = parsed.data;
  const readable = ctx.library.displayExercises ?? ctx.library.exercises;
  if (!readable.has(pref.exercise_id)) return false;
  if (
    pref.replacement_exercise_id !== null &&
    !ctx.library.exercises.has(pref.replacement_exercise_id)
  ) {
    return false;
  }
  const preferences = preferencesFromRows(ctx.rows);
  if (preferenceLimitReached(preferences, pref.exercise_id, pref.location)) return false;
  if (!ctx.pair || !ctx.swapRules || ctx.pair.shown.exercise_id !== pref.exercise_id) return false;
  return canExclude(ctx.pair, pref, {
    library: ctx.library.exercises,
    lookup: readable,
    profiles: ctx.profiles,
    swapRules: ctx.swapRules,
    preferences,
    ambiguousLocation: ctx.ambiguousLocation,
    inSession: ctx.inSession,
  }).ok;
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
      // Wettkampf-Einheiten (WP3): Anstrengung bis 8 nur mit harter Art usw. (= CHECK planned_sessions_workout_fields).
      (s.workout_type
        ? generatedCompetitionSessionSchema.safeParse(s).success
        : generatedSessionSchema.safeParse(s).success) &&
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

/** Einheit für die Regeln je Person (Schritte aus der Zeile gelesen wie die Datenbank). */
function personSession(s: {
  kind: string;
  scheduled_on: string;
  status: string;
  estimated_minutes: number;
  effort_target: number | null;
  workout_type?: string | null;
  workout_steps?: unknown;
}): PersonRuleSession {
  const steps = workoutStepsSchema.safeParse(s.workout_steps);
  const type = WORKOUT_TYPES.find((w) => w === s.workout_type) ?? null;
  return {
    kind: s.kind,
    scheduled_on: s.scheduled_on,
    status: s.status,
    estimated_minutes: s.estimated_minutes,
    effort_target: s.effort_target,
    // Unbekannte Art: wie „mit Art“ behandeln (die Schema-Prüfung lehnt sie ohnehin ab).
    workout_type: s.workout_type && !type ? 'intervals' : type,
    workout_steps: steps.success ? steps.data : null,
  };
}

/** Felder, die die Belastungswochen-Regel braucht (Plan-Zeile bzw. Einheit des Folgeblocks). */
interface LoadWeekSession {
  block_no: number;
  week_no: number;
  scheduled_on: string;
  is_deload: boolean;
  is_intro_week: boolean;
  kind: string;
  estimated_minutes: number;
}

/**
 * Wie public.append_plan_block seit 4b Etappe B (Wächter B2/S-n1, Auflage 4): höchstens L = loadWeeksBeforeDeload
 * Belastungswochen in Folge – auch über die Blockgrenze (Woche 0 zählt nicht). L wie private.plan_load_weeks:
 * vorsichtig = ohne Gesundheitsbezug oder mit Arzt-Hinweis. Gemeldet nur ab dem neuen Block.
 */
export function appendKeepsLoadWeeks(
  plan: Pick<UserPlanRow, 'inputs' | 'uses_health_data' | 'medical_notice' | 'start_date'>,
  own: readonly LoadWeekSession[],
  added: readonly LoadWeekSession[],
): boolean {
  const inputs = plan.inputs as { experienceLevel?: unknown } | null;
  const maxLoadWeeks = loadWeeksBeforeDeload(
    inputs?.experienceLevel === 'beginner' ? 'beginner' : 'advanced',
    !plan.uses_health_data || plan.medical_notice,
  );
  const first = added.map((s) => s.scheduled_on).sort()[0];
  if (first === undefined) return true;
  const slim = (s: LoadWeekSession) =>
    ({
      block_no: s.block_no,
      week_no: s.week_no,
      scheduled_on: s.scheduled_on,
      is_deload: s.is_deload,
      is_intro_week: s.is_intro_week,
      kind: s.kind,
      estimated_minutes: s.estimated_minutes,
      exercises: [],
    }) as unknown as AdjustSession;
  return !checkWeekInvariants([...own, ...added].map(slim), {
    maxLoadWeeks,
    planStart: plan.start_date,
    fromMonday: startOfIsoWeek(first),
  }).some((v) => v.code === 'too_many_load_weeks');
}

/**
 * Regeln je Person für Wettkampf-Einheiten wie private.insert_plan_sessions (WP3, Wächter M1/M2): Check, keine
 * Schwangerschaft, eigener geplanter Wettkampf mit Plan-Bezug, gleiche Disziplin, Deckel je Alter, Arzt-Hinweis,
 * harte Einheiten je Kalenderwoche über den ganzen Plan.
 */
function competitionSessionsAllowed(
  block: readonly SavePlanSession[],
  planSessions: readonly PersonRuleSession[],
  plan: { usesHealthData: boolean; medicalNotice: boolean; inputs: unknown },
  ctx: PlanRuleContext,
): boolean {
  const { rows } = ctx;
  if (!rows.profile) return false;
  const snapshot = planSnapshot({ inputs: plan.inputs });
  const competition = rows.competitions.find((c) => c.status === 'planned') ?? null;
  const profileLevel = experienceLevelSchema.safeParse(rows.profile.experience_level);
  return checkCompetitionSessions(
    block.map((s) => personSession({ ...s, status: 'planned' })),
    planSessions,
    {
      today: ctx.today,
      birthDate: rows.profile.birth_date,
      plan: {
        usesHealthData: plan.usesHealthData,
        medicalNotice: plan.medicalNotice,
        level: snapshot?.experienceLevel ?? null,
        discipline: snapshot?.discipline ?? null,
      },
      profileLevel: profileLevel.success ? profileLevel.data : null,
      pregnancy: healthScreeningForPlan(rows, ctx.versions)?.flags.includes('pregnancy') ?? false,
      competition: competition
        ? {
            discipline: competition.discipline,
            distanceM: competition.distance_m,
            usesHealthData: competition.uses_health_data,
          }
        : null,
    },
  ).ok;
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
      if (
        !competitionSessionsAllowed(
          plan.sessions,
          plan.sessions.map((s) => personSession({ ...s, status: 'planned' })),
          {
            usesHealthData: plan.uses_health_data,
            medicalNotice: plan.medical_notice,
            inputs: plan.inputs,
          },
          ctx,
        )
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
      const planSessions = [
        ...own.map(personSession),
        ...op.sessions.map((s) => personSession({ ...s, status: 'planned' })),
      ];
      return (
        sessionsValid(op.sessions, ctx, { blockNo: lastBlock + 1, earliest, latest }) &&
        competitionSessionsAllowed(
          op.sessions,
          planSessions,
          {
            usesHealthData: plan.uses_health_data,
            medicalNotice: plan.medical_notice,
            inputs: plan.inputs,
          },
          ctx,
        ) &&
        noCollisions(
          rows.plannedSessions,
          op.sessions.map((s) => s.scheduled_on),
        ) &&
        appendKeepsLoadWeeks(plan, own, op.sessions)
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
    // Wie public.swap_planned_sessions (supabase/migrations/20261015120000_swap_planned_sessions.sql): beide eigene
    // Einheiten geplant, im aktiven Plan, keine Erholungswoche, Woche nicht vorbei, jeder neue Tag ab heute und in der
    // Woche des eigenen Ursprungstags. Die 48-h-Regel prüft (wie dort) nur der Core vorher (validateSwap).
    case 'swap_planned_sessions': {
      if (op.sessionId === op.otherSessionId) return false;
      const a = rows.plannedSessions.find((s) => s.id === op.sessionId);
      const b = rows.plannedSessions.find((s) => s.id === op.otherSessionId);
      if (!a || !b || a.plan_id !== op.planId) return false;
      // An den geprüften Stand gebunden (S1): beide liegen noch an den erwarteten Tagen.
      if (a.scheduled_on !== op.sessionOn || b.scheduled_on !== op.otherSessionOn) return false;
      const plan = rows.plans.find((p) => p.id === a.plan_id);
      if (!plan || plan.status !== 'active' || plan.uses_health_data !== op.usesHealthData) {
        return false;
      }
      if (b.plan_id !== a.plan_id) return false;
      for (const [session, date] of [
        [a, b.scheduled_on],
        [b, a.scheduled_on],
      ] as const) {
        if (session.status !== 'planned' || session.is_deload) return false;
        const weekStart = startOfIsoWeek(session.original_date ?? session.scheduled_on);
        if (addDays(weekStart, 6) < today) return false;
        if (date < today || startOfIsoWeek(date) !== weekStart) return false;
      }
      return true;
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
  /** Freigegebene Übungen (freie Einheit, A1b); fehlt = wie `exercises`. */
  publishedExercises?: ReadonlyMap<string, Pick<Exercise, 'load_type'>>;
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

  // Freie Einheit (A1b, wie save_session_log in 20261015140000_free_session_logs.sql): frei bleibt frei, Datum heute
  // bis 14 Tage zurück, Name aus fester Liste, keine Vorgaben, nur abgehakte Sätze; nur freigegebene Übungen (den
  // Übungsnamen übernimmt das Speichern aus der Bibliothek, Wächter S1).
  const isFree = payload.is_free === true;
  if (existing && (existing.is_free === true) !== isFree) {
    return { kind: 'reject', reason: 'invalid' };
  }
  const freeIssue = freeSessionPayloadIssue(payload, ctx.today);
  if (freeIssue !== null) return { kind: 'reject', reason: freeIssue };
  if (
    isFree &&
    payload.exercises.some((e) => !(ctx.publishedExercises ?? ctx.exercises).has(e.exercise_id))
  ) {
    return { kind: 'reject', reason: 'invalid' };
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

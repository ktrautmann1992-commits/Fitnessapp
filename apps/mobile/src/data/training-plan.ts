import {
  type EquipmentLocation,
  equipmentIdSchema,
  equipmentProfile,
  experienceLevelSchema,
  type GeneratePlanResult,
  generateTrainingPlan,
  HEALTH_FLAGS,
  type HealthFlag,
  isoDateInTimeZone,
  loadWeeksBeforeDeload,
  nextPlanBlock,
  type PlanInputsInput,
  type PlanInputsSnapshot,
  type PlanLibrary,
  type PlanSafetyRules,
  planSafetyRules,
  planStartGroup,
  type PlanUpdateOffer,
  planUpdateOffer,
  rescheduleSession,
  type RescheduleResult,
  type SavePlanSession,
  scheduleFromSlots,
  type StoredSession,
  toAppendBlockPayload,
  dropPastSessions,
  savePlanInputsSchema,
  planInputsSchema,
  planInputsSnapshot,
} from '@fitnessapp/core';

import { healthConsentStatus } from '../state/flow';
import type { ConsentVersions } from './mapping';
import type { PlannedSessionRow, UserPlanRow, UserRows } from './types';

/**
 * Trainingsplan in der App (docs/PLAN-PHASE-3.md Abschnitt 10): Angaben aus den Zeilen → Plan-Engine
 * (packages/core) → gespeicherte Zeilen → Anzeige. Nur Abbildung und Zusammensetzen; alle Regeln stehen in
 * packages/core. Rein und getestet (training-plan.test.ts). Achtung Namensähnlichkeit: plan-save.ts plant das
 * Speichern eines Onboarding-Schritts.
 */

// ---------------------------------------------------------------------------------------------------------
// Gesundheitsbezug – dieselbe Regel wie private.plan_health_basis() der Datenbank
// ---------------------------------------------------------------------------------------------------------

function latestScreening(rows: UserRows) {
  return [...rows.healthScreenings].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

const isHealthFlag = (flag: string): flag is HealthFlag =>
  (HEALTH_FLAGS as readonly string[]).includes(flag);

/**
 * Gesundheits-Check für die Plan-Engine: nur mit GÜLTIGER Einwilligung (aktuelle Version) und vorhandenem Check,
 * dann die Flags des neuesten Checks; sonst null = „ohne Gesundheits-Check“ (vorsichtige Standardregeln).
 * Veraltete Einwilligung zählt wie keine (has_valid_consent ist dann false).
 */
export function healthScreeningForPlan(
  rows: UserRows,
  versions: ConsentVersions,
): { flags: HealthFlag[] } | null {
  if (healthConsentStatus(rows, versions) !== 'valid') return null;
  const latest = latestScreening(rows);
  return latest ? { flags: latest.flags.filter(isHealthFlag) } : null;
}

/** uses_health_data / medical_notice, wie die Datenbank sie beim Speichern selbst bestimmt. */
export function healthPlanBasis(
  rows: UserRows,
  versions: ConsentVersions,
): { usesHealthData: boolean; medicalNotice: boolean } {
  const screening = healthScreeningForPlan(rows, versions);
  return {
    usesHealthData: screening !== null,
    medicalNotice: screening !== null && screening.flags.length > 0,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Angaben → Plan-Engine
// ---------------------------------------------------------------------------------------------------------

/** Angaben aus den Zeilen (Abschnitt 10.1); null = Onboarding unvollständig (kein Ziel, Level, Tage …). */
export function planInputsFromRows(
  rows: UserRows,
  versions: ConsentVersions,
): PlanInputsInput | null {
  const profile = rows.profile;
  const level = experienceLevelSchema.safeParse(profile?.experience_level);
  const schedule = scheduleFromSlots(rows.trainingSlots);
  if (!profile || !level.success || !rows.goals || !schedule) return null;
  return {
    goalType: rows.goals.goal_type,
    discipline: rows.goals.goal_type === 'endurance' ? rows.goals.discipline : null,
    experienceLevel: level.data,
    schedule,
    homeEquipment: rows.userEquipment
      .filter((row) => row.location === 'home')
      .flatMap((row) => {
        const id = equipmentIdSchema.safeParse(row.equipment_id);
        return id.success
          ? [{ equipmentId: id.data, weightsKg: [...row.weights_kg], barKg: row.bar_kg }]
          : [];
      }),
    birthDate: profile.birth_date,
    sex: profile.sex,
    healthScreening: healthScreeningForPlan(rows, versions),
  };
}

/** Wirksame AKTUELLE Sicherheitsregeln (Gesundheits-Check + Alter heute); null = Angaben unvollständig. */
export function effectiveSafetyRules(
  rows: UserRows,
  versions: ConsentVersions,
  today: string,
): PlanSafetyRules | null {
  const level = experienceLevelSchema.safeParse(rows.profile?.experience_level);
  if (!rows.profile || !level.success) return null;
  return planSafetyRules(
    {
      experienceLevel: level.data,
      birthDate: rows.profile.birth_date,
      healthScreening: healthScreeningForPlan(rows, versions),
    },
    today,
  );
}

export type CreatePlanResult = GeneratePlanResult | { ok: false; error: 'incomplete' };

/** Neuen Plan erzeugen (Engine aus packages/core). Speichern macht das Backend (save_training_plan). */
export function generatePlanFromRows(
  rows: UserRows,
  versions: ConsentVersions,
  library: PlanLibrary,
  today: string,
): CreatePlanResult {
  const inputs = planInputsFromRows(rows, versions);
  if (!inputs) return { ok: false, error: 'incomplete' };
  return generateTrainingPlan(inputs, library, today);
}

// ---------------------------------------------------------------------------------------------------------
// Gespeicherter Plan
// ---------------------------------------------------------------------------------------------------------

export interface ActivePlan {
  plan: UserPlanRow;
  /** Einheiten des aktiven Plans (nach Datum), Übungen nach order_no. */
  sessions: StoredSession[];
}

function toStoredSession(rows: UserRows, s: PlannedSessionRow): StoredSession {
  return {
    id: s.id,
    status: s.status,
    original_date: s.original_date,
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
    exercises: rows.plannedExercises
      .filter((e) => e.session_id === s.id)
      .sort((a, b) => a.order_no - b.order_no)
      .map((e) => ({
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

const byDate = (a: { scheduled_on: string }, b: { scheduled_on: string }) =>
  a.scheduled_on.localeCompare(b.scheduled_on);

export function activePlan(rows: UserRows): ActivePlan | null {
  const plan = rows.plans.find((p) => p.status === 'active');
  if (!plan) return null;
  return {
    plan,
    sessions: rows.plannedSessions
      .filter((s) => s.plan_id === plan.id)
      .sort(byDate)
      .map((s) => toStoredSession(rows, s)),
  };
}

/** Angaben, mit denen der Plan erstellt wurde (user_plans.inputs); null = unlesbar. */
export function planSnapshot(plan: UserPlanRow): PlanInputsSnapshot | null {
  const parsed = savePlanInputsSchema.safeParse(plan.inputs);
  return parsed.success ? (parsed.data as PlanInputsSnapshot) : null;
}

/** Aktueller Stand der Angaben im Format von user_plans.inputs (für planNeedsUpdate), Zod an der Grenze. */
export function currentSnapshot(
  rows: UserRows,
  versions: ConsentVersions,
): PlanInputsSnapshot | null {
  const inputs = planInputsFromRows(rows, versions);
  const parsed = inputs ? planInputsSchema.safeParse(inputs) : null;
  return parsed?.success ? planInputsSnapshot(parsed.data) : null;
}

/** „Plan neu erstellen?“ (Abschnitt 10.4) – geänderte Angaben, neuer Check, Altersgrenze, strengere Regeln. */
export function planOffer(
  rows: UserRows,
  versions: ConsentVersions,
  active: ActivePlan,
  rules: PlanSafetyRules,
  today: string,
  currentTemplateVersion?: number,
): PlanUpdateOffer | null {
  const snapshot = planSnapshot(active.plan);
  const current = currentSnapshot(rows, versions);
  if (!snapshot || !current || !rows.profile) return null;
  const latest = latestScreening(rows);
  return planUpdateOffer(
    {
      ...active.plan,
      inputs: snapshot,
      created_on: isoDateInTimeZone(active.plan.created_at),
    },
    {
      inputs: current,
      birthDate: rows.profile.birth_date,
      latestScreeningAt:
        healthConsentStatus(rows, versions) === 'valid' ? (latest?.created_at ?? null) : null,
      healthConsentValid: healthConsentStatus(rows, versions) === 'valid',
      ...(currentTemplateVersion !== undefined ? { currentTemplateVersion } : {}),
    },
    rules,
    today,
  );
}

/** Startgruppe des gespeicherten Plans – AUSSCHLIESSLICH über planStartGroup() aus packages/core. */
export function startGroupOf(active: ActivePlan, birthDate: string) {
  return planStartGroup(active.plan, birthDate);
}

/** Geräte-Profile je Ort aus den Angaben des Plans (Ersatz in Anzeige und Folgeblock). */
export function profilesFor(snapshot: PlanInputsSnapshot | null) {
  const home = (snapshot?.homeEquipment ?? []).flatMap((item) => {
    const id = equipmentIdSchema.safeParse(item.equipmentId);
    return id.success
      ? [{ equipmentId: id.data, weightsKg: item.weightsKg, barKg: item.barKg }]
      : [];
  });
  return new Map<EquipmentLocation, ReturnType<typeof equipmentProfile>>([
    ['gym', equipmentProfile('gym', home)],
    ['home', equipmentProfile('home', home)],
  ]);
}

/**
 * Folgeblock (Abschnitt 5.10) aus dem SCHNAPPSCHUSS des Plans plus den AKTUELLEN Sicherheitsregeln. Die
 * Startgruppe beim Erstellen kommt ausschließlich aus planStartGroup() (nach dem Neuladen gibt es keine
 * safety_rules). Einheiten vor heute entfallen (die Datenbank nimmt sie nicht an). null = nichts anzuhängen.
 */
export function nextBlockFromRows(
  rows: UserRows,
  active: ActivePlan,
  rules: PlanSafetyRules,
  library: PlanLibrary,
  today: string,
): SavePlanSession[] | null {
  const snapshot = planSnapshot(active.plan);
  if (!snapshot || !rows.profile || active.sessions.length === 0) return null;
  const loadWeeksBefore = [...new Set(active.sessions.map((s) => s.block_no))].reduce(
    (sum, block) =>
      sum +
      new Set(
        active.sessions
          .filter((s) => s.block_no === block && s.week_no >= 1 && !s.is_deload)
          .map((s) => s.week_no),
      ).size,
    0,
  );
  const sessions = nextPlanBlock(active.sessions, {
    schedule: snapshot.schedule,
    loadWeeks: loadWeeksBeforeDeload(snapshot.experienceLevel, rules.cautious),
    rules,
    library: library.exercises,
    profiles: profilesFor(snapshot),
    endurance: {
      goalType: snapshot.goalType,
      discipline: snapshot.discipline,
      experienceLevel: snapshot.experienceLevel,
    },
    loadWeeksBefore,
    previousStartGroup: startGroupOf(active, rows.profile.birth_date),
  });
  const upcoming = dropPastSessions(sessions, today);
  return upcoming.length > 0 ? toAppendBlockPayload(upcoming) : null;
}

/** Alle Einheiten der Person (auch früherer Pläne) – für „nie stapeln“ beim Verschieben. */
export function allSessions(rows: UserRows): StoredSession[] {
  return [...rows.plannedSessions].sort(byDate).map((s) => toStoredSession(rows, s));
}

/** Einheit verschieben (5.11): nächster freier Tag dieser ISO-Woche ab heute, sonst streichen. */
export function rescheduleInRows(
  rows: UserRows,
  sessionId: string,
  today: string,
): RescheduleResult {
  return rescheduleSession(allSessions(rows), sessionId, today);
}

import {
  type ActivePlanRows,
  activePlan,
  allSessions,
  equipmentIdSchema,
  experienceLevelSchema,
  type GeneratePlanResult,
  generateTrainingPlan,
  HEALTH_FLAGS,
  type HealthFlag,
  isBodyweightTemplateId,
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
  planSnapshot,
  planUpdateOffer,
  profilesFor,
  rescheduleSession,
  type RescheduleResult,
  type SavePlanSession,
  scheduleFromSlots,
  toAppendBlockPayload,
  dropPastSessions,
  planInputsSchema,
  planInputsSnapshot,
} from '@fitnessapp/core';

import { healthConsentStatus } from '../state/flow';
import type { ConsentVersions } from './mapping';
import type { UserPlanRow, UserRows } from './types';

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

/** Aktiver Plan: Zeile aus user_plans plus Einheiten (nach Datum), Übungen nach order_no. */
export type ActivePlan = ActivePlanRows<UserPlanRow>;

/**
 * Abbildung der Plan-Zeilen auf die Engine (aktiver Plan, alle Einheiten, Schnappschuss der Angaben, Geräte-Profile)
 * liegt seit Etappe A0 (docs/PLAN-PHASE-4B.md 5.1) in packages/core/src/plan/rows.ts – hier nur weitergereicht.
 */
export { activePlan, allSessions, planSnapshot, profilesFor };

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
    // Körpergewicht-Vorlage: beim Kürzen bleibt die letzte Rumpf-Übung (wie beim Erstellen, Engine-Version 3).
    protectLastCore: isBodyweightTemplateId(library, active.plan.template_id),
  });
  const upcoming = dropPastSessions(sessions, today);
  return upcoming.length > 0 ? toAppendBlockPayload(upcoming) : null;
}

/** Einheit verschieben (5.11): nächster freier Tag dieser ISO-Woche ab heute, sonst streichen. */
export function rescheduleInRows(
  rows: UserRows,
  sessionId: string,
  today: string,
): RescheduleResult {
  return rescheduleSession(allSessions(rows), sessionId, today);
}

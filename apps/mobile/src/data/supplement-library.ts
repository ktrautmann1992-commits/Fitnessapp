import {
  addDays,
  experienceLevelSchema,
  nutritionTargetsForWeek,
  startOfIsoWeek,
  type SupplementContent,
  type SupplementContentFile,
  supplementContentSchema,
  type SupplementProfileSource,
  validateContent,
} from '@fitnessapp/core';

import { healthConsentStatus } from '../state/flow';
import type { ConsentVersions } from './mapping';
import { nutritionInputsFromRows } from './nutrition-plan';
import { healthScreeningForPlan } from './training-plan';
import type { UserRows } from './types';

/**
 * Supplement-Bereich in der App (docs/PLAN-PHASE-6.md 8, Etappe SU4): Quellen abbilden – Regeln, Einordnung und Texte
 * kommen aus packages/core (`buildSupplementInputs`, `recommendSupplements`, `supplementOverview`). Rein und getestet
 * (supplement-library.test.ts). Nie loggen (Gesundheitsdaten).
 */

/**
 * Testmodus: Supplemente aus dem Bündel, geprüft wie content:validate. Entwürfe OHNE roten Befund sind erlaubt (wie die
 * Plan-Bibliothek des Testmodus, `allowDrafts`) – so lässt sich der Bereich in der Vorschau testen, bevor die Inhalte
 * freigegeben sind; die App kennzeichnet sie „Testphase – noch nicht fachlich geprüft“. Nie Probelauf-Einträge (SK2
 * rot), nie zurückgezogene.
 */
export function supplementsFromBundle(
  files: readonly SupplementContentFile[],
): SupplementContent[] {
  const result = validateContent(files);
  const red = new Set(
    result.issues
      .filter((issue) => issue.kind === 'supplement' && issue.severity === 'error')
      .map((issue) => issue.id),
  );
  return result.supplements.filter((entry) => entry.status !== 'archived' && !red.has(entry.id));
}

/** Supabase: Zeilen der Tabelle `supplements` (RLS: nur freigegebene) → Inhalte; ungültige werden übergangen. */
export function supplementsFromDbRows(
  rows: readonly { readonly data: unknown }[],
): SupplementContent[] {
  return rows.flatMap((row) => {
    const parsed = supplementContentSchema.safeParse(row.data);
    return parsed.success && parsed.data.status === 'published' ? [parsed.data] : [];
  });
}

/** Ausdauer-Einheiten mit Intervallen oder Sprints (Kreatin beim Ziel Ausdauer, Plan 3.2). */
const INTERVAL_WORKOUT_TYPES: readonly string[] = ['intervals', 'strides', 'fartlek'];

/**
 * Eiweißziel von heute aus der Ernährungs-Engine; `null` = keine Ziele (Modus `no_targets`, Angaben unvollständig oder
 * Fehler – sichere Richtung: dann gibt es kein „passt“ für Proteinpulver).
 */
function todayProteinTarget(
  rows: UserRows,
  versions: ConsentVersions,
  today: string,
): number | null {
  try {
    const weekStart = startOfIsoWeek(today);
    const inputs = nutritionInputsFromRows(rows, versions, today, weekStart);
    if (inputs === null) return null;
    const day = nutritionTargetsForWeek(inputs, weekStart).days.find((d) => d.date === today);
    return day && day.mode !== 'no_targets' && day.proteinG !== null && day.proteinG > 0
      ? day.proteinG
      : null;
  } catch {
    return null;
  }
}

/**
 * Angaben der Person für `buildSupplementInputs`; `null` = Angaben unvollständig (Profil, Ziel oder Erfahrung fehlt –
 * Onboarding nicht fertig). Gesundheitsdaten werden nur gelesen, wenn die Einwilligung gültig ist; welche davon in
 * die Einordnung dürfen (Fassung ≥ 2), entscheidet der Core.
 */
export function supplementSourceFromRows(
  rows: UserRows,
  versions: ConsentVersions,
  today: string,
  screening: SupplementProfileSource['screening'],
): SupplementProfileSource | null {
  const profile = rows.profile;
  const level = experienceLevelSchema.safeParse(profile?.experience_level);
  if (!profile || !rows.goals || !level.success) return null;
  const consentValid = healthConsentStatus(rows, versions) === 'valid';
  const weight =
    [...rows.bodyMetrics]
      .filter((row) => row.weight_kg !== null && row.measured_on <= addDays(today, 1))
      .sort((a, b) => b.measured_on.localeCompare(a.measured_on))[0]?.weight_kg ?? null;
  const activePlans = new Set(rows.plans.filter((p) => p.status === 'active').map((p) => p.id));
  const proteinTargetG = consentValid ? todayProteinTarget(rows, versions, today) : null;
  return {
    today,
    birthDate: profile.birth_date,
    sex: profile.sex,
    validHealthConsentVersion: consentValid ? versions.health_data : null,
    healthFlags: consentValid ? (healthScreeningForPlan(rows, versions)?.flags ?? null) : null,
    screening: consentValid ? screening : null,
    latestWeightKg: consentValid ? weight : null,
    goalType: rows.goals.goal_type,
    secondaryGoalType: rows.goals.secondary_goal_type ?? null,
    experienceLevel: level.data,
    hasIntervalSessions: rows.plannedSessions.some(
      (session) =>
        activePlans.has(session.plan_id) &&
        session.workout_type !== null &&
        INTERVAL_WORKOUT_TYPES.includes(session.workout_type),
    ),
    dietType: rows.nutritionPrefs?.diet_type ?? 'omnivore',
    foodPreferences: rows.foodPreferences.map((row) => ({ group: row.food_group, kind: row.kind })),
    trainingTime: rows.nutritionSetup?.training_time ?? null,
    foodLog: consentValid
      ? rows.foodLogEntries.map((entry) => ({
          eatenOn: entry.eaten_on,
          kcal: entry.kcal,
          proteinG: entry.protein_g,
        }))
      : [],
    proteinTargetG,
    hasNutritionTargets: proteinTargetG !== null,
    hasCompetition: rows.competitions.some((competition) => competition.status === 'planned'),
  };
}

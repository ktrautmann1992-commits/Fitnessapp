import {
  BARBELL_ID,
  exercisePreferenceSchema,
  nutritionSetupColumnsSchema,
  parseStoredMealPlanWeek,
  BARBELL_PLATE_MAX_KG,
  scheduleFromLegacyGoals,
  type TrainingLocation,
} from '@fitnessapp/core';

import { toTrainingSlotRows } from './mapping';
import type {
  ExercisePreferenceRow,
  GoalsRow,
  MealPlanRow,
  NutritionSetupRow,
  UserEquipmentRow,
  UserRows,
} from './types';

/**
 * Schritt nutrition_setup (Etappe N4): vorher gab es ihn nicht; der Gerätespeicher ist nicht vertrauenswürdig – nur
 * ein gültiger Eintrag (Zod, strikt) des eigenen Kontos bleibt, sonst null (Schritt wird erneut gefragt).
 */
function storedNutritionSetup(stored: UserRows): NutritionSetupRow | null {
  const value: unknown = (stored as { nutritionSetup?: unknown }).nutritionSetup;
  if (typeof value !== 'object' || value === null) return null;
  const { user_id: userId, ...rest } = value as Record<string, unknown>;
  const parsed = nutritionSetupColumnsSchema.safeParse(rest);
  const owner = stored.profile?.user_id;
  return parsed.success && typeof userId === 'string' && (owner === undefined || userId === owner)
    ? { ...parsed.data, user_id: userId }
    : null;
}

/**
 * Essenspläne (Etappe N5): vorher gab es keine; der Gerätespeicher ist nicht vertrauenswürdig – nur vollständige Pläne
 * der aktuellen Engine-Version (`parseStoredMealPlanWeek`, Zod strikt) des eigenen Kontos, je Woche höchstens einer.
 * Ein ungültiger Plan wird verworfen und beim Öffnen neu erstellt (sichere Richtung: der neue Plan nutzt die
 * aktuellen Angaben).
 */
function storedMealPlans(stored: UserRows): MealPlanRow[] {
  const list: unknown = (stored as { mealPlans?: unknown }).mealPlans;
  if (!Array.isArray(list)) return [];
  const owner = stored.profile?.user_id;
  const seen = new Set<string>();
  return list.flatMap((item: unknown): MealPlanRow[] => {
    if (typeof item !== 'object' || item === null) return [];
    const row = item as Record<string, unknown>;
    const plan = parseStoredMealPlanWeek(row.plan);
    if (
      plan === null ||
      typeof row.id !== 'string' ||
      typeof row.user_id !== 'string' ||
      (owner !== undefined && row.user_id !== owner) ||
      row.week_start !== plan.weekStart ||
      seen.has(plan.weekStart) ||
      typeof row.created_at !== 'string' ||
      typeof row.auto_adjusted !== 'boolean'
    ) {
      return [];
    }
    seen.add(plan.weekStart);
    return [
      {
        id: row.id,
        user_id: row.user_id,
        week_start: plan.weekStart,
        // Gesundheitsbezug steht im Plan selbst (die Zeile kann ihn nicht abschwächen).
        uses_health_data: plan.usesHealthData,
        created_at: row.created_at,
        auto_adjusted: row.auto_adjusted,
        plan,
      },
    ];
  });
}

function storedPreferences(stored: UserRows): ExercisePreferenceRow[] {
  const list: unknown = (stored as { exercisePreferences?: unknown }).exercisePreferences;
  if (!Array.isArray(list)) return [];
  const owner = stored.profile?.user_id;
  return list.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return [];
    const { user_id: userId, ...rest } = item as Record<string, unknown>;
    const parsed = exercisePreferenceSchema.safeParse(rest);
    return parsed.success && typeof userId === 'string' && (owner === undefined || userId === owner)
      ? [{ ...parsed.data, user_id: userId }]
      : [];
  });
}

/** goals-Felder des Gerätespeichers aus App-Versionen vor Etappe B2. */
interface LegacyGoalsFields {
  sessions_per_week?: number | null;
  minutes_per_session?: number | null;
  preferred_days?: number[] | null;
}

/**
 * Auf dem Gerät gespeicherte Zeilen älterer App-Versionen (vor Etappe B2) auf das neue Format bringen – der
 * Gerätespeicher des Testmodus und der Offline-Zwischenspeicher des Supabase-Modus – dieselben Regeln wie die
 * Migration 20261005120000_training_slots.sql (Erweiterungsplan 4.2/4.3):
 * - altes Zeitbudget in goals → Trainingstage (scheduleFromLegacyGoals), die alten Felder entfallen,
 * - Langhantel: Werte über 25 kg (früher wohl Gesamtgewichte) entfernen, bar_kg ergänzen (leer = 20 kg).
 * Rein und getestet (legacy-rows.test.ts); bereits neue Stände bleiben unverändert.
 */
export function upgradeStoredRows(stored: UserRows): UserRows {
  const rows: UserRows = {
    ...stored,
    trainingSlots: stored.trainingSlots ?? [],
    // Vor Etappe C gab es keine Pläne im Gerätespeicher.
    plans: stored.plans ?? [],
    plannedSessions: stored.plannedSessions ?? [],
    plannedExercises: stored.plannedExercises ?? [],
    // Vor Phase 4 Etappe C gab es kein Tagebuch.
    sessionLogs: stored.sessionLogs ?? [],
    exerciseLogs: stored.exerciseLogs ?? [],
    setLogs: stored.setLogs ?? [],
    cardioLogs: stored.cardioLogs ?? [],
    startWeights: stored.startWeights ?? [],
    // Vor Etappe T2 gab es keine Übungs-Präferenzen; der Gerätespeicher ist nicht vertrauenswürdig – nur gültige
    // Einträge (Zod, strikt) des eigenen Kontos bleiben (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 9).
    exercisePreferences: storedPreferences(stored),
    nutritionSetup: storedNutritionSetup(stored),
    mealPlans: storedMealPlans(stored),
  };
  const goals = stored.goals as (GoalsRow & LegacyGoalsFields) | null;
  if (
    goals &&
    ('sessions_per_week' in goals || 'minutes_per_session' in goals || 'preferred_days' in goals)
  ) {
    const { sessions_per_week, minutes_per_session, preferred_days, ...current } = goals;
    rows.goals = current;
    const schedule = scheduleFromLegacyGoals({
      sessions_per_week,
      minutes_per_session,
      preferred_days,
      training_location: current.training_location as TrainingLocation | null,
    });
    if (schedule && rows.trainingSlots.length === 0) {
      rows.trainingSlots = toTrainingSlotRows(current.user_id, schedule);
    }
  }
  rows.userEquipment = stored.userEquipment.map((row): UserEquipmentRow => ({
    ...row,
    bar_kg: row.bar_kg ?? null,
    weights_kg:
      row.equipment_id === BARBELL_ID
        ? row.weights_kg.filter((kg) => kg <= BARBELL_PLATE_MAX_KG)
        : row.weights_kg,
  }));
  return rows;
}

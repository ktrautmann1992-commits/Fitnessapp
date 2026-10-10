import {
  BARBELL_ID,
  exercisePreferenceSchema,
  BARBELL_PLATE_MAX_KG,
  scheduleFromLegacyGoals,
  type TrainingLocation,
} from '@fitnessapp/core';

import { toTrainingSlotRows } from './mapping';
import type { ExercisePreferenceRow, GoalsRow, UserEquipmentRow, UserRows } from './types';

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

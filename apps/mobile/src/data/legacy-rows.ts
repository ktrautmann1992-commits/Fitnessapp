import {
  BARBELL_ID,
  BARBELL_PLATE_MAX_KG,
  scheduleFromLegacyGoals,
  type TrainingLocation,
} from '@fitnessapp/core';

import { toTrainingSlotRows } from './mapping';
import type { GoalsRow, UserEquipmentRow, UserRows } from './types';

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
  const rows: UserRows = { ...stored, trainingSlots: stored.trainingSlots ?? [] };
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

import {
  DATA_EXPORT_FORMAT_VERSION,
  type DataExportTable,
  type PendingDbExportTable,
} from '@fitnessapp/core';

import type { UserRows } from './types';

/**
 * Testmodus: Datenexport aus dem Gerätespeicher in DERSELBEN Form wie export_my_data() (docs/PLAN-PHASE-4.md 3.7) –
 * gleiche Tabellen-Schlüssel (der Typ erzwingt alle aus DATA_EXPORT_TABLES und PENDING_DB_EXPORT_TABLES), Zeilen wie
 * gespeichert. Danach prüft
 * buildDataExportFile() (packages/core) beide Wege gleich. Nur Abbildung.
 */
export function localDataExport(
  rows: UserRows,
  userId: string,
  exportedAt: string,
): {
  format_version: number;
  exported_at: string;
  user_id: string;
  data: Record<DataExportTable | PendingDbExportTable, unknown[]>;
} {
  const one = <T>(row: T | null): T[] => (row === null ? [] : [row]);
  const data: Record<DataExportTable | PendingDbExportTable, unknown[]> = {
    profiles: one(rows.profile),
    consents: [...rows.consents].sort((a, b) => a.granted_at.localeCompare(b.granted_at)),
    body_metrics: rows.bodyMetrics,
    body_measurements: rows.bodyMeasurements,
    measurement_reminders: one(rows.reminder),
    health_screening: rows.healthScreenings,
    goals: one(rows.goals),
    user_equipment: rows.userEquipment,
    training_slots: rows.trainingSlots,
    // Testmodus (Etappe N4): Antworten des Schritts nutrition_setup als Spalten von nutrition_prefs – genau so, wie
    // export_my_data() sie ab Etappe N7 liefert (docs/PLAN-PHASE-5.md 7.3). Essenspläne werden in N4 nicht gespeichert
    // (bei jedem Öffnen neu berechnet) – Tabellen meal_plans/shopping_lists kommen mit N5/N7.
    nutrition_prefs: nutritionPrefsExport(rows),
    food_preferences: rows.foodPreferences,
    // Im Testmodus gibt es keine Redaktions-Rechte.
    admin_users: [],
    user_plans: rows.plans,
    planned_sessions: rows.plannedSessions,
    planned_exercises: rows.plannedExercises,
    session_logs: [...rows.sessionLogs].sort((a, b) =>
      a.performed_on.localeCompare(b.performed_on),
    ),
    exercise_logs: rows.exerciseLogs,
    set_logs: rows.setLogs,
    cardio_logs: rows.cardioLogs,
    exercise_start_weights: rows.startWeights,
    // Übungs-Präferenzen (Etappe T2) – in export_my_data() erst mit Etappe T3 (PENDING_DB_EXPORT_TABLES).
    exercise_preferences: rows.exercisePreferences,
  };
  return {
    format_version: DATA_EXPORT_FORMAT_VERSION,
    exported_at: exportedAt,
    user_id: userId,
    data,
  };
}

function nutritionPrefsExport(rows: UserRows): unknown[] {
  const setup = rows.nutritionSetup;
  if (rows.nutritionPrefs === null) {
    return setup === null ? [] : [setup];
  }
  if (setup === null) return [rows.nutritionPrefs];
  return [
    {
      ...rows.nutritionPrefs,
      activity_level: setup.activity_level,
      training_time: setup.training_time,
      mealprep_slots: setup.mealprep_slots,
      show_energy_numbers: setup.show_energy_numbers,
    },
  ];
}

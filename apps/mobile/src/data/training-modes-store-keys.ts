/**
 * Daten- und Schlüssel-Name des geschützten Speichers der Trainings-Modi (training-modes-store.ts / .native.ts):
 * Testmodus = alle Einträge, Supabase = Zwischenspeicher für offline. Enthält Schmerz-Einträge (Gesundheitsdaten).
 */
export const TRAINING_MODES_STORE_KEYS = {
  dataKey: 'fitnessapp.training-modes.v1',
  keyName: 'fitnessapp.training-modes-key.v1',
} as const;

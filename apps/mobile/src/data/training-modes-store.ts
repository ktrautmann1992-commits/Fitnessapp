import { createSessionProtectedStore, type ProtectedStore } from './protected-store';
import { TRAINING_MODES_STORE_KEYS } from './training-modes-store-keys';

/**
 * Geschützter Speicher der Trainings-Modi (docs/PLAN-TRAINING-MODI.md 7) – Browser (diese Datei): nur sessionStorage,
 * endet mit dem Tab (Schmerz-Einträge sind Gesundheitsdaten, wie das Zyklus-Modul auch im Testmodus).
 * iPhone/Android: training-modes-store.native.ts (AES-256-GCM, Schlüssel im Keychain/Keystore).
 */
export function createTrainingModesStore(): ProtectedStore {
  return createSessionProtectedStore(browserSessionStorage(), TRAINING_MODES_STORE_KEYS.dataKey, {
    strict: true,
  });
}

function browserSessionStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

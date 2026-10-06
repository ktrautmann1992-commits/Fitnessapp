import {
  createSessionProtectedStore,
  PROTECTED_STORE_KEYS,
  type ProtectedStore,
  type ProtectedStoreName,
  type ProtectedStores,
  type SessionStorageLike,
} from './protected-store';

/**
 * Browser (Web-Export): geschützte Speicher nur in sessionStorage – enden mit dem Tab, nie localStorage
 * (Gründer-Entscheidungen Frage 14 und Phase 4 Frage 3). iPhone/Android: device-protected-store.native.ts
 * (verschlüsselt).
 */
export function createDeviceProtectedStore(
  name: ProtectedStoreName = 'healthPlan',
): ProtectedStore {
  return createSessionProtectedStore(browserSessionStorage(), PROTECTED_STORE_KEYS[name].dataKey, {
    // Entwurf und Warteschlange: Schreibfehler melden (nie stilles Verwerfen).
    strict: name === 'workoutDraft' || name === 'logQueue',
  });
}

export function createDeviceProtectedStores(): ProtectedStores {
  return {
    healthPlan: createDeviceProtectedStore('healthPlan'),
    workoutDraft: createDeviceProtectedStore('workoutDraft'),
    logQueue: createDeviceProtectedStore('logQueue'),
    logCache: createDeviceProtectedStore('logCache'),
  };
}

function browserSessionStorage(): SessionStorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    // Zugriff gesperrt (z. B. strenge Datenschutz-Einstellungen) → kein Offline-Speicher.
    return null;
  }
}

import { STORAGE_KEYS } from './kv';
import {
  createSessionProtectedStore,
  type ProtectedStore,
  type SessionStorageLike,
} from './protected-store';

/**
 * Browser (Web-Export): geschützter Zwischenspeicher nur in sessionStorage – endet mit dem Tab, nie localStorage
 * (Gründer-Entscheidung Frage 14). iPhone/Android: device-protected-store.native.ts (verschlüsselt).
 */
export function createDeviceProtectedStore(): ProtectedStore {
  return createSessionProtectedStore(browserSessionStorage(), STORAGE_KEYS.healthPlanCache);
}

function browserSessionStorage(): SessionStorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    // Zugriff gesperrt (z. B. strenge Datenschutz-Einstellungen) → kein Offline-Plan.
    return null;
  }
}

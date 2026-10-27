import { LIVE_STORE_KEYS, type LiveStoreName } from './live-store-keys';
import { createSessionProtectedStore, type ProtectedStore } from './protected-store';

/**
 * Geschützte Speicher der Live-Begleitung – Browser (diese Datei): nur sessionStorage, endet mit dem Tab (Kontakte
 * sind Daten Dritter). iPhone/Android: live-store.native.ts (AES-256-GCM, Schlüssel im Keychain/Keystore).
 */
export function createLiveStore(name: LiveStoreName): ProtectedStore {
  return createSessionProtectedStore(browserSessionStorage(), LIVE_STORE_KEYS[name].dataKey, {
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

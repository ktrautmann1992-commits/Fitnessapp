import { CYCLE_STORE_KEYS, type CycleStores } from './cycle-store-keys';
import { createSessionProtectedStore } from './protected-store';

export { CYCLE_STORE_KEYS, type CycleStoreName, type CycleStores } from './cycle-store-keys';

/**
 * Geschützte Speicher des Zyklus-Moduls (docs/PLAN-PHASE-9.md 7.4) – je mit eigenem Daten- und Schlüssel-Namen:
 * - `cycleCache`: Einstellungen und Einträge der letzten 120 Tage (Testmodus: alle Zyklusdaten),
 * - `cycleQueue`: offline erfasste Einträge bis zum Senden (mit Zeitpunkt der Einwilligung, S5).
 * Browser (diese Datei): nur sessionStorage – endet mit dem Tab, auch im Testmodus (strenger als der übrige
 * Testmodus mit localStorage). iPhone/Android: cycle-device-store.native.ts (AES-256-GCM, Schlüssel im
 * Keychain/Keystore). Geleert bei Widerruf, Modul beenden, Abmelden, Konto löschen und Kontowechsel.
 * Der Speicher `dayVariant` (Tageswahl „leichter“) kommt mit Phase 8b/ZY5.
 */
export function createCycleDeviceStores(): CycleStores {
  const storage = browserSessionStorage();
  return {
    cycleCache: createSessionProtectedStore(storage, CYCLE_STORE_KEYS.cycleCache.dataKey, {
      strict: true,
    }),
    cycleQueue: createSessionProtectedStore(storage, CYCLE_STORE_KEYS.cycleQueue.dataKey, {
      strict: true,
    }),
  };
}

function browserSessionStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

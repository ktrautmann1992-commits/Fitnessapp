import type { ProtectedStore } from './protected-store';

/** Daten- und Schlüssel-Namen der Zyklus-Speicher (cycle-device-store.ts / .native.ts). */
export const CYCLE_STORE_KEYS = {
  cycleCache: { dataKey: 'fitnessapp.cycle-cache.v1', keyName: 'fitnessapp.cycle-cache-key.v1' },
  cycleQueue: { dataKey: 'fitnessapp.cycle-queue.v1', keyName: 'fitnessapp.cycle-queue-key.v1' },
} as const;
export type CycleStoreName = keyof typeof CYCLE_STORE_KEYS;
export type CycleStores = Record<CycleStoreName, ProtectedStore>;

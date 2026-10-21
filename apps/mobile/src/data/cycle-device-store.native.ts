import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { CYCLE_STORE_KEYS, type CycleStoreName, type CycleStores } from './cycle-store-keys';
import { cipher } from './device-protected-store.native';
import { createEncryptedProtectedStore, type ProtectedStore } from './protected-store';

export { CYCLE_STORE_KEYS, type CycleStoreName, type CycleStores } from './cycle-store-keys';

/**
 * iPhone/Android: Zyklus-Speicher verschlüsselt (AES-256-GCM), je mit eigenem Schlüssel im Keychain/Keystore (nur
 * dieses Gerät, nicht im Backup). Siehe cycle-device-store.ts.
 */
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function store(name: CycleStoreName): ProtectedStore {
  return createEncryptedProtectedStore({
    secrets: {
      get: (key) => SecureStore.getItemAsync(key, SECURE_OPTIONS),
      set: (key, value) => SecureStore.setItemAsync(key, value, SECURE_OPTIONS),
      remove: (key) => SecureStore.deleteItemAsync(key, SECURE_OPTIONS),
    },
    data: AsyncStorage,
    cipher,
    keyName: CYCLE_STORE_KEYS[name].keyName,
    dataKey: CYCLE_STORE_KEYS[name].dataKey,
  });
}

export function createCycleDeviceStores(): CycleStores {
  return { cycleCache: store('cycleCache'), cycleQueue: store('cycleQueue') };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { cipher } from './device-protected-store.native';
import { createEncryptedProtectedStore, type ProtectedStore } from './protected-store';
import { TRAINING_MODES_STORE_KEYS } from './training-modes-store-keys';

/**
 * iPhone/Android: Speicher der Trainings-Modi verschlüsselt (AES-256-GCM), eigener Schlüssel im Keychain/Keystore (nur
 * dieses Gerät, nicht im Backup). Siehe training-modes-store.ts.
 */
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export function createTrainingModesStore(): ProtectedStore {
  return createEncryptedProtectedStore({
    secrets: {
      get: (key) => SecureStore.getItemAsync(key, SECURE_OPTIONS),
      set: (key, value) => SecureStore.setItemAsync(key, value, SECURE_OPTIONS),
      remove: (key) => SecureStore.deleteItemAsync(key, SECURE_OPTIONS),
    },
    data: AsyncStorage,
    cipher,
    keyName: TRAINING_MODES_STORE_KEYS.keyName,
    dataKey: TRAINING_MODES_STORE_KEYS.dataKey,
  });
}

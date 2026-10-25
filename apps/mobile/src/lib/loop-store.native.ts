import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { cipher } from '@/data/device-protected-store.native';
import { createEncryptedProtectedStore } from '@/data/protected-store';

import { createLoopStore, type LoopStore } from './loop-store.types';

export * from './loop-store.types';

/**
 * iPhone/Android: gemerkte Runden verschlüsselt (AES-256-GCM, EIGENER Schlüssel im sicheren Schlüsselspeicher, nur
 * dieses Gerät, nicht im Backup) – wie die Strecken-Warteschlange.
 */
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const loopStore: LoopStore = createLoopStore(
  createEncryptedProtectedStore({
    secrets: {
      get: (name) => SecureStore.getItemAsync(name, SECURE_OPTIONS),
      set: (name, value) => SecureStore.setItemAsync(name, value, SECURE_OPTIONS),
      remove: (name) => SecureStore.deleteItemAsync(name, SECURE_OPTIONS),
    },
    data: AsyncStorage,
    cipher,
    keyName: 'fitnessapp.saved-loops-key.v1',
    dataKey: 'fitnessapp.saved-loops.v1',
  }),
);

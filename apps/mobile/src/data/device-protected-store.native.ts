import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AESEncryptionKey,
  AESKeySize,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import {
  type AeadCipher,
  createEncryptedProtectedStore,
  PROTECTED_STORE_KEYS,
  type ProtectedStore,
  type ProtectedStoreName,
  type ProtectedStores,
} from './protected-store';

/**
 * iPhone/Android: Plan mit Gesundheitsbezug (Frage 14) sowie Entwurf, Tagebuch-Warteschlange und
 * Tagebuch-Zwischenspeicher (Phase 4 Frage 3) verschlüsselt – je mit EIGENEM Schlüssel (AES-256-GCM, expo-crypto). Der Schlüssel liegt im
 * sicheren Schlüsselspeicher (Keychain/Keystore über expo-secure-store, nur auf diesem Gerät, nicht im Backup),
 * die verschlüsselten Daten in AsyncStorage – SecureStore ist für große Werte nicht gedacht (ca. 2 KB).
 */
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const cipher: AeadCipher = {
  generateKey: async () => (await AESEncryptionKey.generate(AESKeySize.AES256)).encoded('base64'),
  seal: async (keyBase64, plaintextBase64) => {
    const key = await AESEncryptionKey.import(keyBase64, 'base64');
    const sealed = await aesEncryptAsync(plaintextBase64, key);
    return (await sealed.combined('base64')) as string;
  },
  open: async (keyBase64, sealedBase64) => {
    const key = await AESEncryptionKey.import(keyBase64, 'base64');
    return aesDecryptAsync(AESSealedData.fromCombined(sealedBase64), key, { output: 'base64' });
  },
};

export function createDeviceProtectedStore(
  name: ProtectedStoreName = 'healthPlan',
): ProtectedStore {
  return createEncryptedProtectedStore({
    secrets: {
      get: (name) => SecureStore.getItemAsync(name, SECURE_OPTIONS),
      set: (name, value) => SecureStore.setItemAsync(name, value, SECURE_OPTIONS),
      remove: (name) => SecureStore.deleteItemAsync(name, SECURE_OPTIONS),
    },
    data: AsyncStorage,
    cipher,
    keyName: PROTECTED_STORE_KEYS[name].keyName,
    dataKey: PROTECTED_STORE_KEYS[name].dataKey,
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

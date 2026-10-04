import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AESEncryptionKey,
  AESKeySize,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { STORAGE_KEYS } from './kv';
import {
  type AeadCipher,
  createEncryptedProtectedStore,
  type ProtectedStore,
} from './protected-store';

/**
 * iPhone/Android: Plan mit Gesundheitsbezug verschlüsselt (AES-256-GCM, expo-crypto). Der Schlüssel liegt im
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

export function createDeviceProtectedStore(): ProtectedStore {
  return createEncryptedProtectedStore({
    secrets: {
      get: (name) => SecureStore.getItemAsync(name, SECURE_OPTIONS),
      set: (name, value) => SecureStore.setItemAsync(name, value, SECURE_OPTIONS),
      remove: (name) => SecureStore.deleteItemAsync(name, SECURE_OPTIONS),
    },
    data: AsyncStorage,
    cipher,
    keyName: STORAGE_KEYS.healthPlanKey,
    dataKey: STORAGE_KEYS.healthPlanCache,
  });
}

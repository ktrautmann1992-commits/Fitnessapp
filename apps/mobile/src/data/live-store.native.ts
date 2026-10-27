import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { cipher } from './device-protected-store.native';
import { LIVE_STORE_KEYS, type LiveStoreName } from './live-store-keys';
import { createEncryptedProtectedStore, type ProtectedStore } from './protected-store';

/**
 * iPhone/Android: Speicher der Live-Begleitung verschlüsselt (AES-256-GCM), eigener Schlüssel im Keychain/Keystore
 * (nur dieses Gerät, nicht im Backup). Notfallkontakte verlassen das Gerät nie. Siehe live-store.ts.
 */
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export function createLiveStore(name: LiveStoreName): ProtectedStore {
  return createEncryptedProtectedStore({
    secrets: {
      get: (key) => SecureStore.getItemAsync(key, SECURE_OPTIONS),
      set: (key, value) => SecureStore.setItemAsync(key, value, SECURE_OPTIONS),
      remove: (key) => SecureStore.deleteItemAsync(key, SECURE_OPTIONS),
    },
    data: AsyncStorage,
    cipher,
    keyName: LIVE_STORE_KEYS[name].keyName,
    dataKey: LIVE_STORE_KEYS[name].dataKey,
  });
}

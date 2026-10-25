import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { cipher } from '@/data/device-protected-store.native';
import { STORAGE_KEYS } from '@/data/kv';
import { createEncryptedProtectedStore } from '@/data/protected-store';

import type { WidgetSnapshotStore } from './widget-store';

/**
 * Android: Widget-Stand verschlüsselt wie die übrigen geschützten Speicher (AES-256-GCM über expo-crypto, EIGENER
 * Schlüssel im Android-Keystore über expo-secure-store, Geheimtext in AsyncStorage). Das Widget liest ihn in der
 * Hintergrund-Aufgabe der App (gleiche App, gleicher Speicher – keine Freigabe an andere Apps). `clear()` löscht
 * Daten und Schlüssel.
 */
export const widgetSnapshotStore: WidgetSnapshotStore = createEncryptedProtectedStore({
  secrets: {
    get: (name) => SecureStore.getItemAsync(name),
    set: (name, value) => SecureStore.setItemAsync(name, value),
    remove: (name) => SecureStore.deleteItemAsync(name),
  },
  data: AsyncStorage,
  cipher,
  keyName: STORAGE_KEYS.widgetSnapshotKey,
  dataKey: STORAGE_KEYS.widgetSnapshot,
});

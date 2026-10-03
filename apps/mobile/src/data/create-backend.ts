// supabase-js braucht ein vollständiges URL-Objekt; auf iOS/Android ergänzt das der Polyfill (im Web ohne Wirkung).
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSupabaseClient } from '@fitnessapp/db';
import { Platform } from 'react-native';

import { supabaseConfig } from '../lib/supabase';
import { todayIso } from '../lib/format';
import type { Backend } from './backend';
import type { KeyValueStore } from './kv';
import { createLocalBackend } from './local-backend';
import { createSupabaseBackend } from './supabase-backend';
import type { ConsentPlatform } from './types';

/** Gerätespeicher: AsyncStorage (im Browser localStorage). */
export const deviceStore: KeyValueStore = AsyncStorage;

export function consentPlatform(): ConsentPlatform {
  return Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
}

function newId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  // Fallback (ältere Umgebungen): zufällige UUID v4 – nur für den Testmodus relevant.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

/**
 * Wählt die Betriebsart: Supabase, wenn EXPO_PUBLIC_SUPABASE_URL und …_PUBLISHABLE_KEY gültig gesetzt sind,
 * sonst automatisch der lokale Testmodus.
 */
export function createBackend(): Backend {
  const platform = consentPlatform();
  const now = () => new Date().toISOString();
  if (supabaseConfig.status === 'ok') {
    const client = createSupabaseClient(supabaseConfig.config, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Login per Code – keine Weiterleitung mit Token in der Adresse nötig (auf iOS/Android ohnehin nicht).
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
    return createSupabaseBackend({ client, store: deviceStore, platform, now, newId });
  }
  return createLocalBackend(deviceStore, { platform, today: () => todayIso(), now, newId });
}

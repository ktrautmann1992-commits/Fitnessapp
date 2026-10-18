// supabase-js braucht ein vollständiges URL-Objekt; auf iOS/Android ergänzt das der Polyfill (im Web ohne Wirkung).
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSupabaseClient } from '@fitnessapp/db';
import { Platform } from 'react-native';

import { supabaseConfig } from '../lib/supabase';
import { todayIso } from '../lib/format';
import type { Backend } from './backend';
import { createDeviceProtectedStores } from './device-protected-store';
import type { KeyValueStore } from './kv';
import { createLocalBackend } from './local-backend';
import { readWebUrl } from './food-photo-remote';
import { createSupabaseBackend } from './supabase-backend';
import type { ConsentPlatform } from './types';

/** Gerätespeicher: AsyncStorage (im Browser localStorage). */
export const deviceStore: KeyValueStore = AsyncStorage;

export function consentPlatform(): ConsentPlatform {
  return Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
}

export function newId(): string {
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
  // Sechs eigene geschützte Speicher (Plan mit Gesundheitsbezug, Entwurf, Tagebuch-Warteschlange, -Zwischenspeicher,
  // Ernährungs-Zeilen und -Warteschlange, Etappe N7 Teil 2).
  const stores = createDeviceProtectedStores();
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
    return createSupabaseBackend({
      client,
      store: deviceStore,
      platform,
      now,
      newId,
      // Pläne mit Gesundheitsbezug (Frage 14) und Tagebuch (Phase 4 Frage 3): App verschlüsselt, Browser nur
      // sessionStorage.
      protectedStore: stores.healthPlan,
      workoutDraftStore: stores.workoutDraft,
      logQueueStore: stores.logQueue,
      logCacheStore: stores.logCache,
      // Etappe N7 Teil 2: Ernährungs-Zeilen und -Warteschlange (Tagebuch, eigene Gerichte) – ebenso geschützt.
      nutritionCacheStore: stores.nutritionCache,
      nutritionQueueStore: stores.nutritionQueue,
      // Etappe E3: Gericht per Foto über apps/web (fehlt die Adresse, ist „Per Foto“ nicht verfügbar).
      webUrl: readWebUrl(process.env.EXPO_PUBLIC_WEB_URL),
    });
  }
  // Testmodus: einzige Stelle, an der die Plan-Engine Entwürfe nutzen darf (allowDrafts in createLocalBackend).
  return createLocalBackend(deviceStore, {
    platform,
    today: () => todayIso(),
    now,
    newId,
    draftStore: stores.workoutDraft,
    // Live-Anpassung (Phase 4b, Etappe D, 8.3): Anpassungen nur im eigenen geschützten Speicher.
    liveAdjustStore: stores.liveAdjust,
  });
}

// supabase-js braucht ein vollständiges URL-Objekt; auf iOS/Android ergänzt das der Polyfill (im Web ohne Wirkung).
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSupabaseClient } from '@fitnessapp/db';
import { Platform } from 'react-native';

import { supabaseConfig } from '../lib/supabase';
import { todayIso } from '../lib/format';
import type { Backend } from './backend';
import { attachCycle } from './cycle-backend';
import { createCycleDeviceStores } from './cycle-device-store';
import { createLocalCycle } from './cycle-local';
import { createRemoteCycle } from './cycle-remote';
import { createDeviceProtectedStores } from './device-protected-store';
import type { KeyValueStore } from './kv';
import { createLocalBackend } from './local-backend';
import { readWebUrl } from './food-photo-remote';
import { attachShoes, createLocalShoes, createRemoteShoes } from './shoes';
import { attachHydration, createLocalHydration, createRemoteHydration } from './hydration';
import {
  attachLive,
  createDemoLive,
  createRemoteLive,
  DEFAULT_LIVE_WEB_URL,
} from './live-companion';
import { createLiveStore } from './live-store';
import { createSupabaseBackend } from './supabase-backend';
import {
  attachTrainingModes,
  createLocalTrainingModes,
  createRemoteTrainingModes,
} from './training-modes';
import { createTrainingModesStore } from './training-modes-store';
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

let shared: Backend | null = null;

/**
 * Die EINE Backend-Instanz der App (Ansichten und Hintergrund-Abgleich, docs/PLAN-PHASE-8.md 13.6): Läuft der
 * Hintergrund-Abgleich ohne geöffnete App und öffnet die Person die App danach im selben JS-Prozess, teilen sich beide
 * Warteschlangen und Zwischenspeicher – nie zwei Instanzen, die dieselben Speicher gleichzeitig schreiben.
 */
export function sharedBackend(): Backend {
  shared ??= createBackend();
  return shared;
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
  // Phase 9: eigene geschützte Speicher des Zyklus-Moduls (Browser nur sessionStorage, auch im Testmodus).
  const cycleStores = createCycleDeviceStores();
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
    const backend = createSupabaseBackend({
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
      // Etappe E4: Strecken-Warteschlange und laufende Aufzeichnung (Standortdaten) – ebenso geschützt.
      routeQueueStore: stores.routeQueue,
      routeRecordingStore: stores.routeRecording,
      // Phase 8: Smartwatch-Abgleiche (Gesundheitsdaten) – ebenso geschützt.
      wearableQueueStore: stores.wearableQueue,
      // Etappe E3: Gericht per Foto über apps/web (fehlt die Adresse, ist „Per Foto“ nicht verfügbar).
      webUrl: readWebUrl(process.env.EXPO_PUBLIC_WEB_URL),
    });
    // Schuh-Kilometerzähler (docs/PLAN-PHASE-10.md 22): eigene Schnittstelle wie das Zyklus-Modul.
    attachShoes(
      backend,
      createRemoteShoes({
        client,
        store: deviceStore,
        backend,
        logWindowStart: () => backend.logHistoryStart() ?? todayIso(),
      }),
    );
    attachHydration(
      backend,
      createRemoteHydration({
        client,
        store: deviceStore,
        userId: async () => (await backend.getSession())?.userId ?? null,
        now,
      }),
    );
    // Live-Begleitung (docs/PLAN-PHASE-10.md 21): Datenbank-Funktionen; Kontakte nur verschlüsselt auf dem Gerät.
    attachLive(backend, {
      live: createRemoteLive({ client }),
      contactsStore: createLiveStore('contacts'),
      sessionStore: createLiveStore('session'),
      webUrl: readWebUrl(process.env.EXPO_PUBLIC_WEB_URL) ?? DEFAULT_LIVE_WEB_URL,
    });
    // Trainings-Modi (docs/PLAN-TRAINING-MODI.md 7): Tabellen pain_episodes/travel_modes, eigener geschützter Speicher.
    return attachTrainingModes(
      attachCycle(backend, createRemoteCycle({ client, stores: cycleStores })),
      createRemoteTrainingModes({ client, store: createTrainingModesStore(), newId }),
    );
  }
  // Testmodus: einzige Stelle, an der die Plan-Engine Entwürfe nutzen darf (allowDrafts in createLocalBackend).
  const local = createLocalBackend(deviceStore, {
    platform,
    today: () => todayIso(),
    now,
    newId,
    draftStore: stores.workoutDraft,
    // Live-Anpassung (Phase 4b, Etappe D, 8.3): Anpassungen nur im eigenen geschützten Speicher.
    liveAdjustStore: stores.liveAdjust,
    // Etappe E4: laufende Aufzeichnung (Standortdaten) im eigenen geschützten Speicher.
    routeRecordingStore: stores.routeRecording,
  });
  attachShoes(local, createLocalShoes(deviceStore, local));
  attachHydration(
    local,
    createLocalHydration({
      store: deviceStore,
      userId: async () => (await local.getSession())?.userId ?? null,
      now,
      today: () => todayIso(),
    }),
  );
  // Live-Begleitung im Testmodus: Demo ohne Server (Link zur Demo-Begleit-Seite).
  attachLive(local, {
    live: createDemoLive({ newId, now: () => Date.now() }),
    contactsStore: createLiveStore('contacts'),
    sessionStore: createLiveStore('session'),
    webUrl: readWebUrl(process.env.EXPO_PUBLIC_WEB_URL) ?? DEFAULT_LIVE_WEB_URL,
  });
  return attachTrainingModes(
    attachCycle(local, createLocalCycle(cycleStores)),
    createLocalTrainingModes({ store: createTrainingModesStore(), now, newId }),
  );
}

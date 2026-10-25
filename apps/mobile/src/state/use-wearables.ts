import { hasValidConsent, shouldAutoSync } from '@fitnessapp/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import type { WearableLoadResult } from '@/data/backend';
import { deviceStore } from '@/data/create-backend';
import { STORAGE_KEYS } from '@/data/kv';
import { consentRecordsFromRows } from '@/data/mapping';
import { applyAutoMatches } from '@/data/route-match';
import { runWearableSync, type WearableSyncOutcome } from '@/data/wearable-sync';
import { todayIso } from '@/lib/format';
import { createDemoHealthConnectDriver } from '@/lib/health-connect-demo';
import { healthConnectDriver } from '@/lib/health-connect-driver';
import type { HealthConnectDriver } from '@/lib/health-connect-driver.types';
import { type AppContextValue, useApp } from '@/state/app-state';
import { forgetTrackedRoutes } from '@/state/use-tracked-routes';

/**
 * Smartwatch-Daten des Kontos (Phase 8): geladen über das Backend; der zuletzt geladene Stand bleibt im
 * Arbeitsspeicher (kein Flackern zwischen Einstellungen, Tagebuch und Auswertung). Abgleich beim App-Start und bei
 * Rückkehr in den Vordergrund (höchstens alle 15 min, W8-7) sowie über „Jetzt abgleichen“. Kein Hintergrund-Abgleich.
 */
export type WearablesState =
  { kind: 'loading' } | { kind: 'ready'; result: WearableLoadResult } | { kind: 'error' };

let memory: { userId: string; result: WearableLoadResult } | null = null;
const listeners = new Set<() => void>();
let running: Promise<WearableSyncOutcome | null> | null = null;

/**
 * Datenquelle: Android-App → Health Connect; sonst im Testmodus die Beispiel-Uhr (Browser/iPhone), im Supabase-Modus
 * nichts (Hinweis „nur in der Android-App“).
 */
export function wearableDriver(mode: 'local' | 'supabase'): HealthConnectDriver {
  if (healthConnectDriver.kind !== 'none') return healthConnectDriver;
  return mode === 'local' ? createDemoHealthConnectDriver(todayIso) : healthConnectDriver;
}

/** Einwilligungen für den Abgleich (wie der Server: wearable_data UND health_data). */
export function wearableConsentsValid(app: Pick<AppContextValue, 'rows' | 'versions'>): boolean {
  if (!app.rows) return false;
  const records = consentRecordsFromRows(app.rows.consents);
  return (
    hasValidConsent(records, 'wearable_data', app.versions.wearable_data) &&
    hasValidConsent(records, 'health_data', app.versions.health_data)
  );
}

/** Nach Verbinden/Abgleich/Trennen: Zwischenstand verwerfen und alle offenen Ansichten neu laden. */
export function forgetWearables(): void {
  memory = null;
  for (const listener of listeners) listener();
}

async function readAttempt(): Promise<string | null> {
  try {
    return await deviceStore.getItem(STORAGE_KEYS.wearableSyncAttempt);
  } catch {
    return null;
  }
}

async function readBackfill(): Promise<string | null> {
  try {
    return await deviceStore.getItem(STORAGE_KEYS.wearableRouteBackfill);
  } catch {
    return null;
  }
}

async function writeBackfill(userId: string): Promise<void> {
  try {
    await deviceStore.setItem(STORAGE_KEYS.wearableRouteBackfill, userId);
  } catch {
    // Ohne Speicher wird beim nächsten Abgleich erneut nachgeladen (ändert nur, legt nichts doppelt an).
  }
}

async function writeAttempt(at: string): Promise<void> {
  try {
    await deviceStore.setItem(STORAGE_KEYS.wearableSyncAttempt, at);
  } catch {
    // Nur für „höchstens alle 15 min“ – ohne Speicher gleicht die App eben öfter ab.
  }
}

/**
 * Einen Abgleich ausführen (nie zwei gleichzeitig). `auto` = App-Start/Vordergrund: nur mit Verbindung, gültigen
 * Einwilligungen und frühestens 15 min nach dem letzten Versuch. Ergebnis null = nichts getan.
 */
export function syncWearables(
  app: AppContextValue,
  options: { auto: boolean },
): Promise<WearableSyncOutcome | null> {
  if (running) return running;
  running = (async () => {
    if (!app.session || !app.rows || !wearableConsentsValid(app)) return null;
    const driver = wearableDriver(app.backend.mode);
    if (driver.kind === 'none') return null;
    const now = new Date().toISOString();
    if (options.auto && !shouldAutoSync(await readAttempt(), now)) return null;
    const loaded = await app.backend.wearables.load();
    if (!loaded.rows.connection) return null;
    await writeAttempt(now);
    // Gespeicherte Routen der Uhr (Distanz bleibt, wenn Health Connect die Route gerade nicht herausgibt).
    const tracked = await app.backend.loadTrackedRoutes().catch(() => null);
    const userId = app.session.userId;
    const routeBackfill = tracked !== null && (await readBackfill()) !== userId;
    const outcome = await runWearableSync({
      driver,
      backend: app.backend.wearables,
      rows: app.rows,
      wearable: loaded.rows,
      now,
      today: todayIso(),
      trackedRoutes: tracked?.routes ?? [],
      routeBackfill,
    });
    if (outcome.kind === 'imported' || outcome.kind === 'queued') {
      if (routeBackfill && outcome.kind === 'imported') await writeBackfill(userId);
      // „Meine Strecken“: Uhr-Läufe gleich nach dem Abgleich erkennen (auch ohne offene Ausdauer-Seite).
      if (outcome.kind === 'imported') {
        const after = await app.backend.loadTrackedRoutes().catch(() => null);
        if (after && !after.offline) await applyAutoMatches(app.backend, userId, after.routes);
      }
      await app.reload();
      forgetTrackedRoutes();
    }
    forgetWearables();
    return outcome;
  })().finally(() => {
    running = null;
  });
  return running;
}

export function useWearables(): { state: WearablesState; reload: () => Promise<void> } {
  const app = useApp();
  const userId = app.session?.userId ?? null;
  const backend = app.backend;
  const [state, setState] = useState<WearablesState>(() =>
    memory && memory.userId === userId
      ? { kind: 'ready', result: memory.result }
      : { kind: 'loading' },
  );
  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await backend.wearables.load();
      memory = { userId, result };
      setState({ kind: 'ready', result });
    } catch {
      setState((current) => (current.kind === 'ready' ? current : { kind: 'error' }));
    }
  }, [backend, userId]);
  useEffect(() => {
    const listener = () => void reload();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [reload]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  return { state, reload };
}

/**
 * Abgleich beim App-Start und bei Rückkehr in den Vordergrund (W8-7). Nur auf Android mit Health Connect – die
 * Beispiel-Uhr (Testmodus) gleicht nur auf Knopfdruck ab. Fehler bleiben still (Hinweis auf der Smartwatch-Seite).
 */
export function WearableAutoSync(): null {
  const app = useApp();
  const appRef = useRef(app);
  appRef.current = app;
  const ready = app.status.kind !== 'loading' && app.session !== null && app.rows !== null;
  useEffect(() => {
    if (Platform.OS !== 'android' || healthConnectDriver.kind !== 'native' || !ready) return;
    void syncWearables(appRef.current, { auto: true }).catch(() => undefined);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active')
        void syncWearables(appRef.current, { auto: true }).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [ready]);
  return null;
}

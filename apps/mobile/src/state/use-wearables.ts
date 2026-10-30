import {
  backgroundRunDecision,
  backgroundSyncPlan,
  type BackgroundSyncPlan,
  hasValidConsent,
  shouldAutoSync,
  WEARABLE_BACKGROUND_SYNC,
} from '@fitnessapp/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import type { WearableLoadResult } from '@/data/backend';
import { deviceStore, sharedBackend } from '@/data/create-backend';
import { STORAGE_KEYS } from '@/data/kv';
import { consentRecordsFromRows, versionsFromDocuments } from '@/data/mapping';
import { applyAutoMatches } from '@/data/route-match';
import { mergeCadence, mergeZoneBasis, readPulseZoneSettings } from '@/data/runner';
import { runWearableSync, type WearableSyncOutcome } from '@/data/wearable-sync';
import { defineWearableBackgroundTask, setWearableBackgroundTask } from '@/lib/background-task';
import { todayIso } from '@/lib/format';
import { createDemoHealthConnectDriver } from '@/lib/health-connect-demo';
import { healthConnectDriver } from '@/lib/health-connect-driver';
import type { HealthConnectDriver } from '@/lib/health-connect-driver.types';
import { type AppContextValue, useApp } from '@/state/app-state';
import { forgetTrackedRoutes } from '@/state/use-tracked-routes';

/**
 * Smartwatch-Daten des Kontos (Phase 8): geladen über das Backend; der zuletzt geladene Stand bleibt im
 * Arbeitsspeicher (kein Flackern zwischen Einstellungen, Tagebuch und Auswertung). Abgleich beim App-Start und bei
 * Rückkehr in den Vordergrund (höchstens alle 15 min, W8-7) sowie über „Jetzt abgleichen“. Seit 30.10.2026 zusätzlich
 * im Hintergrund (docs/PLAN-PHASE-8.md 13.6) – nur Android, nur mit dem Health-Connect-Recht „Daten im Hintergrund
 * lesen“, mit DERSELBEN Abgleich-Logik (syncWearables) und derselben Sperre „höchstens alle 15 min“.
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

/**
 * Was der Abgleich aus dem App-Zustand braucht. Vordergrund: der App-Zustand selbst; Hintergrund ohne geöffnete App:
 * selbst geladen (headlessContext).
 */
export type WearableSyncContext = Pick<
  AppContextValue,
  'backend' | 'session' | 'rows' | 'versions' | 'reload'
>;

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
  app: WearableSyncContext,
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
    // Lauf-Paket 2: Pulszonen dieses Geräts (eigener HFmax, Herzfrequenz-Reserve).
    const pulseZones = await readPulseZoneSettings(deviceStore, userId).catch(() => undefined);
    const outcome = await runWearableSync({
      driver,
      backend: app.backend.wearables,
      rows: app.rows,
      pulseZones,
      wearable: loaded.rows,
      now,
      today: todayIso(),
      trackedRoutes: tracked?.routes ?? [],
      routeBackfill,
    });
    if (outcome.kind === 'imported' || outcome.kind === 'queued') {
      // Lauf-Paket 2: Kadenz und Grundlage der Pulszonen je Uhr-Einheit nur auf diesem Gerät merken.
      if (outcome.zoneBasis)
        await mergeZoneBasis(deviceStore, userId, outcome.zoneBasis).catch(() => undefined);
      if (outcome.cadence)
        await mergeCadence(deviceStore, userId, outcome.cadence).catch(() => undefined);
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
    // Hintergrund-Aufgabe passend halten (z. B. „Zugriff fehlt“ → abmelden).
    await updateWearableBackgroundSync(app).catch(() => undefined);
    return outcome;
  })().finally(() => {
    running = null;
  });
  return running;
}

/**
 * Hintergrund-Aufgabe an- bzw. abmelden (Regel: backgroundSyncPlan in packages/core). Ohne Sitzung, Einwilligung,
 * Verbindung mit Schritten oder Hintergrund-Recht → abmelden; Health Connect wird dann nur im Vordergrund gelesen.
 * Lässt sich die Verbindung gerade nicht laden, bleibt alles, wie es ist (Ergebnis null).
 */
export async function updateWearableBackgroundSync(
  app: WearableSyncContext,
): Promise<BackgroundSyncPlan | null> {
  const driver = wearableDriver(app.backend.mode);
  const signedIn = app.session !== null && app.rows !== null;
  const consentsValid = wearableConsentsValid(app);
  let connection: WearableLoadResult['rows']['connection'] = null;
  let backgroundAccess = false;
  if (signedIn && consentsValid && driver.kind === 'native') {
    try {
      connection = (await app.backend.wearables.load()).rows.connection;
    } catch {
      return null;
    }
    backgroundAccess = await driver.backgroundAccess().catch(() => false);
  }
  const plan = backgroundSyncPlan({
    driverKind: driver.kind,
    signedIn,
    consentsValid,
    connection,
    backgroundAccess,
  });
  await setWearableBackgroundTask(
    plan.kind === 'register',
    WEARABLE_BACKGROUND_SYNC.minimumIntervalMin,
  );
  return plan;
}

/** Zustand der geöffneten App (React-Baum geladen) – der Hintergrund-Abgleich nutzt dann genau diesen. */
let liveApp: { current: WearableSyncContext } | null = null;

/** Hintergrund ohne geöffnete App: Sitzung, Einwilligungstexte und Daten selbst laden (gemeinsames Backend). */
async function headlessContext(): Promise<WearableSyncContext | null> {
  const backend = sharedBackend();
  const session = await backend.getSession();
  if (!session) return null;
  const [documents, loaded] = await Promise.all([
    backend.loadConsentDocuments(),
    backend.loadRows(),
  ]);
  return {
    backend,
    session,
    rows: loaded.rows,
    versions: versionsFromDocuments(documents),
    reload: async () => undefined,
  };
}

/**
 * Eine Ausführung der Hintergrund-Aufgabe (vom Betriebssystem gestartet, docs/PLAN-PHASE-8.md 13.6): Voraussetzungen
 * erneut prüfen (backgroundRunDecision), dann derselbe Abgleich wie im Vordergrund. Fehlt eine Voraussetzung
 * inzwischen (Widerruf, Abmelden, Recht entzogen), meldet sich die Aufgabe selbst ab. Keine Logs mit Werten.
 * Ergebnis: true = erledigt (auch „nichts zu tun“), false = fehlgeschlagen (Android versucht es später erneut).
 */
export async function runWearableBackgroundSync(): Promise<boolean> {
  const minutes = WEARABLE_BACKGROUND_SYNC.minimumIntervalMin;
  // Gerade erst abgeglichen (Vordergrund oder Hintergrund): nichts laden – spart Netz und Akku.
  if (!shouldAutoSync(await readAttempt(), new Date().toISOString())) return true;
  const app = liveApp?.current ?? (await headlessContext());
  if (!app || !app.session) {
    await setWearableBackgroundTask(false, minutes);
    return true;
  }
  // Geöffnete App lädt gerade bzw. konnte nicht laden: diesmal nichts tun (die App meldet passend an/ab).
  if (!app.rows) return true;
  const driver = wearableDriver(app.backend.mode);
  const consentsValid = wearableConsentsValid(app);
  const connection =
    consentsValid && driver.kind === 'native'
      ? (await app.backend.wearables.load()).rows.connection
      : null;
  const decision = backgroundRunDecision({
    driverKind: driver.kind,
    signedIn: true,
    consentsValid,
    connection,
    backgroundAccess: connection ? await driver.backgroundAccess().catch(() => false) : false,
    lastAttemptAt: await readAttempt(),
    now: new Date().toISOString(),
  });
  if (decision.kind === 'stop') {
    await setWearableBackgroundTask(false, minutes);
    return true;
  }
  if (decision.kind === 'skip') return true;
  const outcome = await syncWearables(app, { auto: true });
  return outcome === null || outcome.kind !== 'unavailable';
}

/** Beim Start des JS-Bündels (index.ts): Hintergrund-Aufgabe bekannt machen (Android; Browser/iPhone: nichts). */
export function defineWearableBackground(): void {
  defineWearableBackgroundTask(runWearableBackgroundSync);
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
 * Dazu (30.10.2026): Hintergrund-Aufgabe an-/abmelden, sobald sich Sitzung oder Einwilligungen ändern (Abmelden,
 * Widerruf → sofort abmelden), und der Hintergrund-Abgleich nutzt bei geladener App deren Zustand.
 */
export function WearableAutoSync(): null {
  const app = useApp();
  const appRef = useRef<WearableSyncContext>(app);
  appRef.current = app;
  const ready = app.status.kind !== 'loading' && app.session !== null && app.rows !== null;
  const loaded = app.status.kind !== 'loading';
  const userId = app.session?.userId ?? null;
  const consentsValid = wearableConsentsValid(app);
  useEffect(() => {
    liveApp = appRef;
    return () => {
      if (liveApp === appRef) liveApp = null;
    };
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'android' || healthConnectDriver.kind !== 'native' || !loaded) return;
    void updateWearableBackgroundSync(appRef.current).catch(() => undefined);
  }, [loaded, userId, consentsValid]);
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

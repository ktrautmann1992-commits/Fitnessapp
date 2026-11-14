import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { deviceStore } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson } from '@/data/kv';
import { holdWebWakeLock, type WebWakeLockEnv } from '@/lib/web-wake-lock';

/**
 * Bildschirm bleibt an, solange der Trainingsmodus offen ist (docs/PLAN-PHASE-4.md 6.2): App über expo-keep-awake,
 * Browser über die Wake-Lock-Schnittstelle (web-wake-lock.ts, mit erneutem Anfordern), wo verfügbar. Abschaltbar in den
 * Einstellungen (Akku, Risiko 8). Fehler (z. B. Browser ohne Wake-Lock, Akku-Sparmodus) bleiben folgenlos.
 */

const TAG = 'alpha5-workout';
/**
 * Eigener Tag für den Intervall-Timer (Wächter WP4 M5): Solange der Timer läuft, bleibt der Bildschirm IMMER an –
 * unabhängig von der Einstellung (ohne Bildschirm-an pausiert das Handy die App und es gäbe keine Ansage/Vibration beim
 * Schrittwechsel). Eigener Tag, damit das Freigeben nicht die Sperre des Trainingsmodus aufhebt.
 */
export const INTERVAL_TIMER_AWAKE_TAG = 'alpha5-interval-timer';

/** Einstellung „Bildschirm im Training anlassen“ (Standard: an), gespeichert nur auf diesem Gerät. */
export function useKeepAwakeSetting(): {
  enabled: boolean;
  loaded: boolean;
  setEnabled: (value: boolean) => Promise<void>;
} {
  const [enabled, setEnabledState] = useState(true);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    readJson<boolean>(deviceStore, STORAGE_KEYS.keepAwake)
      .catch(() => null)
      .then((value) => {
        if (!alive) return;
        setEnabledState(value !== false);
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  const setEnabled = useCallback(async (value: boolean) => {
    setEnabledState(value);
    await writeJson(deviceStore, STORAGE_KEYS.keepAwake, value);
  }, []);
  return { enabled, loaded, setEnabled };
}

/** Bildschirm an, solange `active`. Im Browser über holdWebWakeLock (erneutes Anfordern nach Freigabe). */
export function useScreenAwake(active: boolean, tag: string = TAG): void {
  useEffect(() => {
    if (!active) return;
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined' || typeof navigator === 'undefined') return;
      return holdWebWakeLock({
        wakeLock: (navigator as { wakeLock?: WebWakeLockEnv['wakeLock'] }).wakeLock,
        document,
        setInterval: (fn, ms) => setInterval(fn, ms),
        clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>),
      });
    }
    // App: expo-keep-awake (eine Sperre je Tag; die App gibt sie beim Verlassen frei).
    let held = false;
    let cancelled = false;
    activateKeepAwakeAsync(tag).then(
      () => {
        // Erst nach dem Verlassen angekommen → gleich wieder freigeben.
        if (cancelled) deactivateKeepAwake(tag).catch(() => undefined);
        else held = true;
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
      if (held) deactivateKeepAwake(tag).catch(() => undefined);
    };
  }, [active, tag]);
}

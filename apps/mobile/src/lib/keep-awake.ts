import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { deviceStore } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson } from '@/data/kv';

/**
 * Bildschirm bleibt an, solange der Trainingsmodus offen ist (docs/PLAN-PHASE-4.md 6.2): App über expo-keep-awake,
 * Browser über die Wake-Lock-Schnittstelle (macht expo-keep-awake im Web), wo verfügbar. Abschaltbar in den
 * Einstellungen (Akku, Risiko 8). Fehler (z. B. Browser ohne Wake-Lock, Akku-Sparmodus) bleiben folgenlos.
 */

const TAG = 'alpha5-workout';

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

/** Bildschirm an, solange `active`. Im Browser nach dem Zurückkehren in den Tab erneut anfordern. */
export function useScreenAwake(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let held = false;
    let cancelled = false;
    // Nie zwei Anfragen gleichzeitig (Wächter C2 K2): expo-keep-awake merkt sich je Tag nur EINE Sperre – eine
    // zweite würde die erste überschreiben, die dann nie freigegeben würde.
    let pending = false;
    const acquire = () => {
      if (pending) return;
      pending = true;
      activateKeepAwakeAsync(TAG).then(
        () => {
          pending = false;
          // Erst nach dem Verlassen angekommen → gleich wieder freigeben.
          if (cancelled) deactivateKeepAwake(TAG).catch(() => undefined);
          else held = true;
        },
        () => {
          pending = false;
        },
      );
    };
    acquire();
    const onVisible = () => {
      // Der Browser gibt die Sperre frei, sobald der Tab verdeckt ist.
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') acquire();
    };
    const web = Platform.OS === 'web' && typeof document !== 'undefined';
    if (web) document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (web) document.removeEventListener('visibilitychange', onVisible);
      if (held) deactivateKeepAwake(TAG).catch(() => undefined);
    };
  }, [active]);
}

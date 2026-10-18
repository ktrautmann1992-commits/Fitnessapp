import { adjustRest, remainingSeconds, type RestTimer, startRest } from '@fitnessapp/core';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform } from 'react-native';

import { t } from '@/i18n';

import { appNotifications } from './app-notifications';

/**
 * Pausentimer-Leiste (docs/PLAN-PHASE-4.md 5.5, 6.1): Die Restzeit rechnet packages/core aus Zeitstempeln
 * (Hintergrund und Bildschirmsperre verfälschen nichts); hier nur das Neuzeichnen und das Pausenende: Vibration in
 * der App (expo-haptics; im Browser nur sichtbar, 6.2) und Ansage für den Bildschirmleser (6.4; im Browser über den
 * sichtbaren Hinweis mit aria-live).
 *
 * Etappe E (docs/PLAN-PHASE-4B.md 7): Geht die App während einer laufenden Pause in den Hintergrund, plant sie eine
 * lokale Benachrichtigung „Pause vorbei – nächster Satz“ zum Endzeitpunkt (nur mit Opt-in und Erlaubnis); zurück im
 * Vordergrund, beim Überspringen, bei ±15 s und beim Verlassen des Trainingsmodus wird storniert bzw. neu geplant.
 */
export interface RestTimerState {
  /** Läuft bzw. ist abgelaufen und noch sichtbar. */
  active: boolean;
  remaining: number;
  over: boolean;
  start: (restS: number) => void;
  adjust: (deltaS: number) => void;
  stop: () => void;
}

const TICK_MS = 250;

export function useRestTimer(): RestTimerState {
  const [timer, setTimer] = useState<RestTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const notified = useRef(false);
  const remaining = timer ? remainingSeconds(timer, now) : 0;
  const over = timer !== null && remaining === 0;

  useEffect(() => {
    if (!timer || over) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [timer, over]);

  useEffect(() => {
    if (!over || notified.current) return;
    notified.current = true;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      AccessibilityInfo.announceForAccessibility(t.workout.rest.over);
    }
  }, [over]);

  const start = useCallback((restS: number) => {
    const at = Date.now();
    notified.current = false;
    setNow(at);
    setTimer(startRest(restS, at));
  }, []);
  const adjust = useCallback((deltaS: number) => {
    const at = Date.now();
    setNow(at);
    setTimer((current) => {
      if (!current) return current;
      // Schon abgelaufen: „+15 s“ = noch 15 Sekunden Pause ab jetzt.
      const next =
        remainingSeconds(current, at) === 0 && deltaS > 0
          ? startRest(deltaS, at)
          : adjustRest(current, deltaS);
      if (remainingSeconds(next, at) > 0) notified.current = false;
      return next;
    });
  }, []);
  const stop = useCallback(() => setTimer(null), []);

  // Pausenende als lokale Benachrichtigung (nur im Hintergrund; im Browser ein No-op).
  const timerRef = useRef<RestTimer | null>(null);
  useEffect(() => {
    timerRef.current = timer;
    void appNotifications
      .updateRestEnd({ timer, appActive: AppState.currentState === 'active', nowMs: Date.now() })
      .catch(() => undefined);
  }, [timer]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      void appNotifications
        .updateRestEnd({
          timer: timerRef.current,
          appActive: state === 'active',
          nowMs: Date.now(),
        })
        .catch(() => undefined);
    });
    return () => {
      subscription.remove();
      void appNotifications
        .updateRestEnd({ timer: null, appActive: true, nowMs: Date.now() })
        .catch(() => undefined);
    };
  }, []);

  return { active: timer !== null, remaining, over, start, adjust, stop };
}

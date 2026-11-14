import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { deviceStore } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson } from '@/data/kv';
import { playWorkoutSound } from '@/lib/workout-sound';

/**
 * Ton und Vibration im Workout-Timer (docs/PLAN-WORKOUTS.md Abschnitt 4, Workout-Player 14.11.2026): 3-2-1 vor jedem
 * Wechsel ein kurzer Ton (`tick`), beim Wechsel zu Übung bzw. Pause ein langer hoher Ton, am Ende ein Doppelton.
 * App: Ton über expo-audio (workout-sound.native.ts) plus Vibration (expo-haptics); Browser: Ton über die Web-Audio-
 * Schnittstelle (workout-sound.ts, ohne Vibration). Abschaltbar („Ton und Vibration“), gespeichert nur auf diesem
 * Gerät. Fehler (z. B. Browser ohne Ton) bleiben folgenlos.
 */
export type WorkoutSignal = 'tick' | 'work' | 'rest' | 'finish';

/** Signal ausgeben (Ton und – in der App – Vibration) – nur, wenn eingeschaltet. */
export function playWorkoutSignal(signal: WorkoutSignal, enabled: boolean): void {
  if (!enabled) return;
  try {
    playWorkoutSound(signal === 'tick' ? 'tick' : signal === 'finish' ? 'finish' : 'go');
    if (Platform.OS === 'web') return;
    if (signal === 'finish') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } else {
      void Haptics.impactAsync(
        signal === 'work'
          ? Haptics.ImpactFeedbackStyle.Heavy
          : signal === 'rest'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light,
      ).catch(() => undefined);
    }
  } catch {
    // Kein Ton/keine Vibration verfügbar – der sichtbare Wechsel reicht.
  }
}

/** Ansage für Bildschirmleser in der App (im Browser übernimmt die Live-Region der Seite). */
export function announceStep(text: string): void {
  if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(text);
}

/** Einstellung „Ton und Vibration“ (Standard: an). */
export function useWorkoutSignals(): { enabled: boolean; setEnabled: (value: boolean) => void } {
  const [enabled, setEnabledState] = useState(true);
  useEffect(() => {
    let alive = true;
    readJson<boolean>(deviceStore, STORAGE_KEYS.workoutSignals)
      .catch(() => null)
      .then((value) => {
        if (alive) setEnabledState(value !== false);
      });
    return () => {
      alive = false;
    };
  }, []);
  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    void writeJson(deviceStore, STORAGE_KEYS.workoutSignals, value).catch(() => undefined);
  }, []);
  return { enabled, setEnabled };
}

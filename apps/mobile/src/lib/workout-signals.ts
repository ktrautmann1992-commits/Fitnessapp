import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { deviceStore } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson } from '@/data/kv';

/**
 * Ton und Vibration im Workout-Timer (docs/PLAN-WORKOUTS.md Abschnitt 4): beim Wechsel zu einer Übung bzw. Pause und am
 * Ende. App: Vibration (expo-haptics); Browser: kurzer Ton über die Web-Audio-Schnittstelle (ohne Vibration).
 * Abschaltbar, gespeichert nur auf diesem Gerät. Fehler (z. B. Browser ohne Ton) bleiben folgenlos.
 */
export type WorkoutSignal = 'work' | 'rest' | 'finish';

type AudioContextLike = {
  currentTime: number;
  destination: unknown;
  createOscillator(): {
    frequency: { value: number };
    connect(node: unknown): void;
    start(at?: number): void;
    stop(at?: number): void;
  };
  createGain(): {
    gain: { value: number };
    connect(node: unknown): void;
  };
};

let audio: AudioContextLike | null = null;

function beep(signal: WorkoutSignal): void {
  const Ctor = (globalThis as { AudioContext?: new () => AudioContextLike }).AudioContext;
  if (!Ctor) return;
  audio ??= new Ctor();
  const tones = signal === 'finish' ? [660, 880] : signal === 'work' ? [880] : [520];
  tones.forEach((frequency, i) => {
    const ctx = audio as AudioContextLike;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = frequency;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const at = ctx.currentTime + i * 0.22;
    osc.start(at);
    osc.stop(at + 0.18);
  });
}

/** Signal ausgeben (Ton bzw. Vibration) – nur, wenn eingeschaltet. */
export function playWorkoutSignal(signal: WorkoutSignal, enabled: boolean): void {
  if (!enabled) return;
  try {
    if (Platform.OS === 'web') {
      beep(signal);
    } else if (signal === 'finish') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } else {
      void Haptics.impactAsync(
        signal === 'work' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light,
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

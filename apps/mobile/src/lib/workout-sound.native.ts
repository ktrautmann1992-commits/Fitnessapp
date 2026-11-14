/* eslint-disable @typescript-eslint/no-require-imports -- Metro bündelt Töne nur über require() */
import { type AudioPlayer, createAudioPlayer } from 'expo-audio';

/**
 * Töne des Workout-Players in der App (Gründer-Feedback 14.11.2026): kurze WAV-Signale aus dem Bundle über expo-audio
 * (schon Abhängigkeit für Sprachansagen, kein neues natives Modul). 3-2-1: kurzer Ton; Wechsel: langer hoher Ton;
 * Ende: Doppelton. Die Player entstehen beim ersten Ton und bleiben (kein Nachladen je Signal). Fehler still – die
 * Vibration (expo-haptics) kommt trotzdem. Browser: workout-sound.ts (Web Audio).
 */
export type WorkoutSound = 'tick' | 'go' | 'finish';

const SOURCES: Readonly<Record<WorkoutSound, number>> = {
  tick: require('../../assets/sounds/cue-tick.wav') as number,
  go: require('../../assets/sounds/cue-go.wav') as number,
  finish: require('../../assets/sounds/cue-finish.wav') as number,
};

const players: Partial<Record<WorkoutSound, AudioPlayer>> = {};

export function playWorkoutSound(sound: WorkoutSound): void {
  try {
    const player = (players[sound] ??= createAudioPlayer(SOURCES[sound]));
    void player
      .seekTo(0)
      .then(() => player.play())
      .catch(() => undefined);
  } catch {
    // Kein Ton verfügbar – Vibration und Anzeige reichen.
  }
}

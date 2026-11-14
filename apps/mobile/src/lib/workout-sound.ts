/**
 * Töne des Workout-Players im Browser (Gründer-Feedback 14.11.2026): Web-Audio-Schnittstelle, kein Download.
 * 3-2-1: kurzer Ton; Wechsel: langer hoher Ton; Ende: Doppelton. App: workout-sound.native.ts (expo-audio).
 * Fehler (Browser ohne Ton, Ton noch nicht freigegeben) bleiben folgenlos.
 */
export type WorkoutSound = 'tick' | 'go' | 'finish';

type AudioContextLike = {
  currentTime: number;
  destination: unknown;
  state?: string;
  resume?: () => Promise<void>;
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

/** Frequenz (Hz) und Dauer (s) je Ton. */
export const WORKOUT_SOUND_TONES: Readonly<
  Record<WorkoutSound, readonly { hz: number; s: number }[]>
> = {
  tick: [{ hz: 880, s: 0.12 }],
  go: [{ hz: 1320, s: 0.4 }],
  finish: [
    { hz: 990, s: 0.18 },
    { hz: 1320, s: 0.35 },
  ],
};

let audio: AudioContextLike | null = null;

export function playWorkoutSound(sound: WorkoutSound): void {
  try {
    const Ctor = (globalThis as { AudioContext?: new () => AudioContextLike }).AudioContext;
    if (!Ctor) return;
    audio ??= new Ctor();
    const ctx = audio;
    // Browser starten den Ton erst nach einer Berührung; der Start-Knopf des Workouts war eine.
    if (ctx.state === 'suspended') void ctx.resume?.().catch(() => undefined);
    let at = ctx.currentTime;
    for (const tone of WORKOUT_SOUND_TONES[sound]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = tone.hz;
      gain.gain.value = 0.1;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + tone.s);
      at += tone.s + 0.06;
    }
  } catch {
    // Kein Ton – Anzeige reicht.
  }
}

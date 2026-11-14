import { afterEach, describe, expect, it } from 'vitest';

import { playWorkoutSound, WORKOUT_SOUND_TONES } from './workout-sound';

const started: { hz: number; at: number; stop: number }[] = [];

class FakeAudioContext {
  currentTime = 1;
  destination = {};
  state = 'running';
  createOscillator() {
    const osc = {
      frequency: { value: 0 },
      connect: () => undefined,
      start: (at: number) => started.push({ hz: osc.frequency.value, at, stop: 0 }),
      stop: (at: number) => {
        started[started.length - 1]!.stop = at;
      },
    };
    return osc;
  }
  createGain() {
    return { gain: { value: 0 }, connect: () => undefined };
  }
}

afterEach(() => {
  started.length = 0;
});

describe('Töne im Browser (Web Audio)', () => {
  it('3-2-1 kurz, Wechsel lang und hoch, Ende als Doppelton', () => {
    (globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext;
    playWorkoutSound('tick');
    expect(started).toHaveLength(1);
    expect(started[0]!.hz).toBe(WORKOUT_SOUND_TONES.tick[0]!.hz);
    playWorkoutSound('go');
    expect(started[1]!.stop - started[1]!.at).toBeGreaterThan(started[0]!.stop - started[0]!.at);
    expect(started[1]!.hz).toBeGreaterThan(started[0]!.hz);
    playWorkoutSound('finish');
    expect(started).toHaveLength(4);
    expect(started[3]!.at).toBeGreaterThan(started[2]!.stop);
  });

  it('ohne Web Audio: kein Fehler', () => {
    delete (globalThis as { AudioContext?: unknown }).AudioContext;
    expect(() => playWorkoutSound('go')).not.toThrow();
  });
});

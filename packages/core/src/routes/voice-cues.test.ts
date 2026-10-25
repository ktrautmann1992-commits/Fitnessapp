import { describe, expect, it } from 'vitest';

import type { WorkoutStep } from '../plan/intensity';
import {
  DEFAULT_VOICE_CUE_SETTINGS,
  INITIAL_VOICE_CUE_STATE,
  intervalCue,
  parseVoiceCueSettings,
  spokenDuration,
  type VoiceCueSettings,
  voiceCue,
} from './voice-cues';

const ON: VoiceCueSettings = { ...DEFAULT_VOICE_CUE_SETTINGS, enabled: true };

describe('spokenDuration', () => {
  it('zum Sprechen: Minuten/Sekunden, Stunden, Einzahl', () => {
    expect(spokenDuration(324)).toBe('5 Minuten 24');
    expect(spokenDuration(60)).toBe('1 Minute');
    expect(spokenDuration(45)).toBe('45 Sekunden');
    expect(spokenDuration(1)).toBe('1 Sekunde');
    expect(spokenDuration(3780)).toBe('1 Stunde 3 Minuten');
    expect(spokenDuration(-5)).toBe('0 Sekunden');
  });
});

describe('parseVoiceCueSettings', () => {
  it('gültig übernommen, sonst Standard (aus)', () => {
    expect(parseVoiceCueSettings(ON)).toEqual(ON);
    expect(parseVoiceCueSettings({ enabled: true })).toEqual(DEFAULT_VOICE_CUE_SETTINGS);
    expect(parseVoiceCueSettings(null).enabled).toBe(false);
  });
});

describe('voiceCue', () => {
  it('aus → nie eine Ansage', () => {
    const r = voiceCue({
      settings: DEFAULT_VOICE_CUE_SETTINGS,
      sport: 'run',
      live: { distanceM: 5000, movingS: 1600, elapsedS: 1600 },
      state: INITIAL_VOICE_CUE_STATE,
    });
    expect(r.text).toBeNull();
  });

  it('je km: „Kilometer 1. Pace … Zeit …“, dann erst wieder am nächsten km', () => {
    let state = INITIAL_VOICE_CUE_STATE;
    const at = (distanceM: number, movingS: number) => {
      const r = voiceCue({
        settings: ON,
        sport: 'run',
        live: { distanceM, movingS, elapsedS: movingS },
        state,
      });
      state = r.state;
      return r.text;
    };
    expect(at(990, 330)).toBeNull();
    expect(at(1000, 324)).toBe('Kilometer 1. Pace 5 Minuten 24. Zeit 5 Minuten 24.');
    expect(at(1500, 490)).toBeNull();
    // Pace des Abschnitts (km 2), nicht des ganzen Laufs.
    expect(at(2000, 634)).toBe('Kilometer 2. Pace 5 Minuten 10. Zeit 10 Minuten 34.');
  });

  it('GPS-Sprung über zwei Marken → eine Ansage der neuesten', () => {
    const r = voiceCue({
      settings: ON,
      sport: 'run',
      live: { distanceM: 3100, movingS: 1000, elapsedS: 1000 },
      state: INITIAL_VOICE_CUE_STATE,
    });
    expect(r.text?.startsWith('Kilometer 3.')).toBe(true);
    expect(r.state.mark).toBe(3);
  });

  it('Rad: alle 5 km, Tempo in km/h; je 0,5 km beim Laufen', () => {
    const bike = voiceCue({
      settings: ON,
      sport: 'bike',
      live: { distanceM: 4900, movingS: 700, elapsedS: 700 },
      state: INITIAL_VOICE_CUE_STATE,
    });
    expect(bike.text).toBeNull();
    const bike5 = voiceCue({
      settings: { ...ON, time: false },
      sport: 'bike',
      live: { distanceM: 5000, movingS: 720, elapsedS: 720 },
      state: INITIAL_VOICE_CUE_STATE,
    });
    expect(bike5.text).toBe('Kilometer 5. Tempo 25,0 Kilometer pro Stunde.');
    const half = voiceCue({
      settings: { ...ON, interval: 'half_km', pace: false, time: false },
      sport: 'run',
      live: { distanceM: 2520, movingS: 800, elapsedS: 800 },
      state: INITIAL_VOICE_CUE_STATE,
    });
    expect(half.text).toBe('2,5 Kilometer.');
  });

  it('alle 5 Minuten: Zeit und Distanz', () => {
    const r = voiceCue({
      settings: { ...ON, interval: 'time' },
      sport: 'walk',
      live: { distanceM: 1020, movingS: 301, elapsedS: 320 },
      state: INITIAL_VOICE_CUE_STATE,
    });
    expect(r.text).toBe('5 Minuten. 1,02 Kilometer. Pace 4 Minuten 55.');
  });

  it('gleiche Strecke: Vergleich mit dem letzten Mal an vollen km (neutral)', () => {
    const prev = [330, 330, 330];
    const say = (movingS: number) =>
      voiceCue({
        settings: { ...ON, pace: false, time: false },
        sport: 'run',
        live: { distanceM: 2000, movingS, elapsedS: movingS },
        state: { ...INITIAL_VOICE_CUE_STATE, mark: 1, lastDistanceM: 1000, lastMovingS: 320 },
        previousSplitsS: prev,
      }).text;
    expect(say(650)).toBe('Kilometer 2. 10 Sekunden schneller als beim letzten Mal.');
    expect(say(725)).toBe('Kilometer 2. 1 Minute 5 Sekunden langsamer als beim letzten Mal.');
    expect(say(663)).toBe('Kilometer 2. Etwa gleich schnell wie beim letzten Mal.');
    // Letztes Mal kürzer (keine Zeit für km 4) → kein Vergleich.
    const r = voiceCue({
      settings: { ...ON, pace: false, time: false },
      sport: 'run',
      live: { distanceM: 4000, movingS: 1300, elapsedS: 1300 },
      state: { ...INITIAL_VOICE_CUE_STATE, mark: 3 },
      previousSplitsS: prev,
    });
    expect(r.text).toBe('Kilometer 4.');
  });

  it('Puls nur, wenn eingeschaltet UND ein Wert da ist', () => {
    const base = {
      sport: 'run' as const,
      live: { distanceM: 1000, movingS: 330, elapsedS: 330 },
      state: INITIAL_VOICE_CUE_STATE,
    };
    const s = { ...ON, pace: false, time: false, heartRate: true };
    expect(voiceCue({ ...base, settings: s, heartRateBpm: 151.6 }).text).toBe(
      'Kilometer 1. Puls 152.',
    );
    expect(voiceCue({ ...base, settings: s, heartRateBpm: null }).text).toBe('Kilometer 1.');
    expect(
      voiceCue({ ...base, settings: { ...s, heartRate: false }, heartRateBpm: 150 }).text,
    ).toBe('Kilometer 1.');
  });
});

describe('intervalCue', () => {
  const steps: WorkoutStep[] = [
    { part: 'warmup', kind: 'easy', seconds: 600, effort: 2 },
    { part: 'main', kind: 'work', seconds: 180, effort: 8 },
    { part: 'main', kind: 'rest', seconds: 120, effort: 2 },
    { part: 'cooldown', kind: 'easy', seconds: 300, effort: 2 },
  ];

  it('Wechsel in jeden Schritt einmal, am Ende „geschafft“', () => {
    expect(intervalCue(steps, 0, -1)).toEqual({ text: 'Einlaufen: 10 Minuten.', stepIndex: 0 });
    expect(intervalCue(steps, 300, 0)).toEqual({ text: null, stepIndex: 0 });
    expect(intervalCue(steps, 600, 0)).toEqual({ text: 'Belastung: 3 Minuten.', stepIndex: 1 });
    expect(intervalCue(steps, 790, 1)).toEqual({ text: 'Pause: 2 Minuten.', stepIndex: 2 });
    expect(intervalCue(steps, 900, 2)).toEqual({ text: 'Auslaufen: 5 Minuten.', stepIndex: 3 });
    expect(intervalCue(steps, 1300, 3).text).toBe('Einheit geschafft. Locker ausgehen.');
    expect(intervalCue(steps, 1400, 4).text).toBeNull();
  });

  it('ohne Intervalle (0–1 Schritt) nichts; in voiceCue mit km-Ansage kombiniert', () => {
    expect(intervalCue([steps[0] as WorkoutStep], 0, -1).text).toBeNull();
    const r = voiceCue({
      settings: { ...ON, pace: false, time: false },
      sport: 'run',
      live: { distanceM: 1000, movingS: 600, elapsedS: 600 },
      state: { ...INITIAL_VOICE_CUE_STATE, stepIndex: 0 },
      steps,
    });
    expect(r.text).toBe('Belastung: 3 Minuten. Kilometer 1.');
  });
});

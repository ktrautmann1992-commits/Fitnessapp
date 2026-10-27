import { z } from 'zod';

import { VOICE_CUES } from '../constants';
import type { TrackedRouteSport } from '../enums';
import type { WorkoutStep } from '../plan/intensity';

/**
 * Sprachansagen beim Aufzeichnen (Gründer-Freigabe 25.10.2026): Zeitpunkte und Texte – rein, ohne Gerät. Die App
 * ruft `voiceCue` bei jedem neuen Stand der Aufzeichnung auf und spricht den Text (expo-speech, offline). Neutral
 * (W-G16): Vergleich nur mit dem letzten eigenen Lauf auf derselben Strecke, „schneller“/„langsamer“ ohne Wertung.
 * Texte sind zum Sprechen geschrieben („5 Minuten 24“ statt „5:24“).
 */

export const VOICE_CUE_INTERVALS = ['km', 'half_km', 'time'] as const;
export type VoiceCueInterval = (typeof VOICE_CUE_INTERVALS)[number];

export const voiceCueSettingsSchema = z.strictObject({
  enabled: z.boolean(),
  interval: z.enum(VOICE_CUE_INTERVALS),
  pace: z.boolean(),
  time: z.boolean(),
  heartRate: z.boolean(),
});
export type VoiceCueSettings = z.infer<typeof voiceCueSettingsSchema>;

/** Standard: aus (Ansagen sind eine bewusste Wahl), sonst je km mit Pace und Zeit, Puls aus. */
export const DEFAULT_VOICE_CUE_SETTINGS: VoiceCueSettings = {
  enabled: false,
  interval: 'km',
  pace: true,
  time: true,
  heartRate: false,
};

/** Gespeicherte Einstellung lesen; Ungültiges → Standard. */
export function parseVoiceCueSettings(raw: unknown): VoiceCueSettings {
  const parsed = voiceCueSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_VOICE_CUE_SETTINGS;
}

export interface VoiceCueState {
  /** Zuletzt angesagte Marke (Anzahl Schritte: km, 0,5 km bzw. 5 min). */
  readonly mark: number;
  /** Stand bei der letzten Marke (für die Pace des Abschnitts). */
  readonly lastDistanceM: number;
  readonly lastMovingS: number;
  /** Index des zuletzt angesagten Intervall-Schritts (−1 = noch keiner). */
  readonly stepIndex: number;
}

export const INITIAL_VOICE_CUE_STATE: VoiceCueState = {
  mark: 0,
  lastDistanceM: 0,
  lastMovingS: 0,
  stepIndex: -1,
};

export interface VoiceCueLive {
  readonly distanceM: number;
  readonly movingS: number;
  /** Zeit seit Start ohne Pausen (für Intervalle). */
  readonly elapsedS: number;
}

export interface VoiceCueInput {
  readonly settings: VoiceCueSettings;
  readonly sport: TrackedRouteSport;
  readonly live: VoiceCueLive;
  readonly state: VoiceCueState;
  /** Kilometerzeiten des letzten vergleichbaren Laufs auf derselben „Meinen Strecke“ (sonst null). */
  readonly previousSplitsS?: readonly number[] | null;
  /** Schritte der geplanten Intervall-Einheit (workout_steps), sonst null. */
  readonly steps?: readonly WorkoutStep[] | null;
  /** Live-Puls (nur mit Einwilligung health_data; die App gibt sonst null). */
  readonly heartRateBpm?: number | null;
}

/** „5 Minuten 24“, „1 Stunde 3 Minuten“, „45 Sekunden“. */
export function spokenDuration(totalS: number): string {
  const s = Math.max(0, Math.round(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} ${h === 1 ? 'Stunde' : 'Stunden'} ${m} ${m === 1 ? 'Minute' : 'Minuten'}`;
  if (m === 0) return `${sec} ${sec === 1 ? 'Sekunde' : 'Sekunden'}`;
  return sec === 0
    ? `${m} ${m === 1 ? 'Minute' : 'Minuten'}`
    : `${m} ${m === 1 ? 'Minute' : 'Minuten'} ${sec}`;
}

/** Unterschied mit Einheit für „… schneller“: „10 Sekunden“, „1 Minute 5 Sekunden“. */
function spokenDiff(diffS: number): string {
  const s = Math.round(Math.abs(diffS));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec} ${sec === 1 ? 'Sekunde' : 'Sekunden'}`;
  return sec === 0
    ? `${m} ${m === 1 ? 'Minute' : 'Minuten'}`
    : `${m} ${m === 1 ? 'Minute' : 'Minuten'} ${sec} ${sec === 1 ? 'Sekunde' : 'Sekunden'}`;
}

const comma = (x: number, digits = 1) => x.toFixed(digits).replace('.', ',');

function spokenKm(meters: number): string {
  const km = meters / 1000;
  if (Number.isInteger(km)) return km === 1 ? 'Kilometer 1' : `Kilometer ${km}`;
  return `${comma(km)} Kilometer`;
}

function paceText(sport: TrackedRouteSport, distanceM: number, movingS: number): string | null {
  if (distanceM <= 0 || movingS <= 0) return null;
  if (sport === 'bike')
    return `Tempo ${comma(distanceM / 1000 / (movingS / 3600))} Kilometer pro Stunde`;
  return `Pace ${spokenDuration(movingS / (distanceM / 1000))}`;
}

const STEP_TEXT: Record<WorkoutStep['part'], Record<WorkoutStep['kind'], string>> = {
  warmup: { work: 'Einlaufen', easy: 'Einlaufen', rest: 'Einlaufen', station: 'Einlaufen' },
  // Stufe 1 (Hyrox-Kombi): Stations-Schritt – Name der Station folgt mit Etappe H.
  main: { work: 'Belastung', easy: 'Locker', rest: 'Pause', station: 'Station' },
  cooldown: { work: 'Auslaufen', easy: 'Auslaufen', rest: 'Auslaufen', station: 'Auslaufen' },
};

/** Intervall-Ansage beim Wechsel in einen neuen Schritt (oder „Einheit geschafft“ nach dem letzten). */
export function intervalCue(
  steps: readonly WorkoutStep[],
  elapsedS: number,
  stepIndex: number,
): { text: string | null; stepIndex: number } {
  if (steps.length < 2) return { text: null, stepIndex };
  let t = 0;
  let current = steps.length; // nach dem letzten Schritt
  for (let i = 0; i < steps.length; i += 1) {
    const end = t + (steps[i] as WorkoutStep).seconds;
    if (elapsedS < end) {
      current = i;
      break;
    }
    t = end;
  }
  if (current <= stepIndex) return { text: null, stepIndex };
  if (current >= steps.length)
    return { text: 'Einheit geschafft. Locker ausgehen.', stepIndex: current };
  const s = steps[current] as WorkoutStep;
  return {
    text: `${STEP_TEXT[s.part][s.kind]}: ${spokenDuration(s.seconds)}.`,
    stepIndex: current,
  };
}

/**
 * Nächste Ansage aus dem aktuellen Stand – oder `text: null`. Mehrere übersprungene Marken (GPS-Sprung, App kurz im
 * Hintergrund) ergeben EINE Ansage der neuesten Marke. Ausgeschaltet → nie eine Ansage.
 */
export function voiceCue(input: VoiceCueInput): { text: string | null; state: VoiceCueState } {
  const { settings, sport, live, state } = input;
  if (!settings.enabled) return { text: null, state };
  const parts: string[] = [];
  let next = state;

  if (input.steps && input.steps.length > 1) {
    const iv = intervalCue(input.steps, live.elapsedS, state.stepIndex);
    if (iv.text) parts.push(iv.text);
    next = { ...next, stepIndex: iv.stepIndex };
  }

  const interval = settings.interval;
  const byTime = interval === 'time';
  const step = interval === 'time' ? VOICE_CUES.timeStepS : VOICE_CUES.stepM[interval][sport];
  const value = byTime ? live.movingS : live.distanceM;
  const mark = Math.floor(value / step);
  if (mark > state.mark && mark >= 1) {
    const segDist = live.distanceM - state.lastDistanceM;
    const segTime = live.movingS - state.lastMovingS;
    const head = byTime
      ? `${spokenDuration(mark * step)}. ${comma(live.distanceM / 1000, 2)} Kilometer.`
      : `${spokenKm(mark * step)}.`;
    const bits = [head];
    if (settings.pace) {
      const p = paceText(sport, segDist, segTime);
      if (p) bits.push(`${p}.`);
    }
    if (settings.time && !byTime) bits.push(`Zeit ${spokenDuration(live.movingS)}.`);
    if (settings.heartRate && input.heartRateBpm != null && input.heartRateBpm > 0) {
      bits.push(`Puls ${Math.round(input.heartRateBpm)}.`);
    }
    // Gleiche Strecke: Vergleich an vollen Kilometern mit dem letzten Mal.
    const km = (mark * step) / 1000;
    const prev = input.previousSplitsS;
    if (!byTime && prev && Number.isInteger(km) && km >= 1 && prev.length >= km) {
      const before = prev.slice(0, km).reduce((a, b) => a + b, 0);
      const diff = live.movingS - before;
      bits.push(
        Math.abs(diff) <= VOICE_CUES.sameWithinS
          ? 'Etwa gleich schnell wie beim letzten Mal.'
          : `${spokenDiff(diff)} ${diff < 0 ? 'schneller' : 'langsamer'} als beim letzten Mal.`,
      );
    }
    parts.push(bits.join(' '));
    next = { ...next, mark, lastDistanceM: live.distanceM, lastMovingS: live.movingS };
  }
  return { text: parts.length > 0 ? parts.join(' ') : null, state: next };
}

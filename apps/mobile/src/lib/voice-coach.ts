import {
  compareAttempts,
  INITIAL_VOICE_CUE_STATE,
  parseVoiceCueSettings,
  READ_ALOUD,
  recordingLiveStats,
  type TrackedRouteRow,
  type VoiceCueSettings,
  type VoiceCueState,
  voiceCue,
  type WorkoutStep,
} from '@fitnessapp/core';

import { readJson, STORAGE_KEYS, type KeyValueStore, writeJson } from '@/data/kv';

import { recordingSession } from './recording-session';
import { readAloudVoice, speak, stopSpeaking } from './speech';
import { disableCueAudio, enableCueAudio } from './voice-audio';

/**
 * Sprachansagen während der Aufzeichnung (25.10.2026): hört auf neue Punkte der laufenden Aufzeichnung (kommen auch
 * im Hintergrund über den Standort-Dienst) und spricht die Ansage aus packages/core (`voiceCue`) über die
 * Sprachausgabe des Geräts (offline, Deutsch). Rechnet höchstens alle `MIN_GAP_MS` (Akku). Nie Koordinaten in Logs.
 */

const MIN_GAP_MS = 3000;

type Stored = Record<string, unknown>;

/** Einstellung je Konto auf diesem Gerät (Standard: aus). */
export async function readVoiceSettings(
  store: KeyValueStore,
  userId: string,
): Promise<VoiceCueSettings> {
  const raw = await readJson<Stored>(store, STORAGE_KEYS.voiceCues).catch(() => null);
  return parseVoiceCueSettings(raw && typeof raw === 'object' ? raw[userId] : null);
}

export async function writeVoiceSettings(
  store: KeyValueStore,
  userId: string,
  settings: VoiceCueSettings,
): Promise<void> {
  const raw = await readJson<Stored>(store, STORAGE_KEYS.voiceCues).catch(() => null);
  const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  await writeJson(store, STORAGE_KEYS.voiceCues, { ...base, [userId]: settings });
}

/**
 * Kilometerzeiten des letzten vergleichbaren Laufs auf der „Meinen Strecke“ (für „… schneller als beim letzten
 * Mal“); null ohne Strecke oder ohne vergleichbaren Lauf.
 */
export function previousSplitsFor(
  baseRouteId: string | null,
  routes: readonly TrackedRouteRow[],
): number[] | null {
  if (!baseRouteId) return null;
  const favorite = routes.find((r) => r.id === baseRouteId && r.is_favorite);
  if (!favorite) return null;
  const last = [...compareAttempts(favorite, routes)]
    .reverse()
    .find((a) => a.code !== 'not_comparable');
  const row = last ? routes.find((r) => r.id === last.routeId) : null;
  return row && row.km_splits.length > 0 ? [...row.km_splits] : null;
}

interface CoachConfig {
  readonly recordingId: string;
  readonly settings: VoiceCueSettings;
  readonly previousSplitsS: readonly number[] | null;
  readonly steps: readonly WorkoutStep[] | null;
}

let active: {
  config: CoachConfig;
  state: VoiceCueState;
  lastCheck: number;
  unsubscribe: () => void;
} | null = null;

/** Ansagen für die laufende Aufzeichnung starten (einmal je Aufzeichnung; ausgeschaltet → nichts). */
export async function startVoiceCoach(config: CoachConfig): Promise<void> {
  if (active?.config.recordingId === config.recordingId) return;
  stopVoiceCoach();
  if (!config.settings.enabled) return;
  const voice = await readAloudVoice();
  if (!voice) return;
  await enableCueAudio();
  const coach: NonNullable<typeof active> = {
    config,
    state: INITIAL_VOICE_CUE_STATE,
    lastCheck: 0,
    unsubscribe: () => undefined,
  };
  const check = () => {
    const current = recordingSession.get();
    if (!current || current.state.id !== config.recordingId) return;
    if (current.state.status !== 'recording') return;
    const now = recordingSession.now();
    if (now - coach.lastCheck < MIN_GAP_MS) return;
    coach.lastCheck = now;
    const live = recordingLiveStats(current.state, now);
    const result = voiceCue({
      settings: config.settings,
      sport: current.state.sport,
      live,
      state: coach.state,
      previousSplitsS: config.previousSplitsS,
      steps: config.steps,
      heartRateBpm: null,
    });
    coach.state = result.state;
    if (result.text) speak(result.text.slice(0, READ_ALOUD.maxChars), voice, () => undefined);
  };
  coach.unsubscribe = recordingSession.subscribe(check);
  active = coach;
}

/** Ansagen beenden (Stopp, Speichern, Verwerfen). */
export function stopVoiceCoach(): void {
  if (!active) return;
  active.unsubscribe();
  active = null;
  stopSpeaking();
  void disableCueAudio();
}

/** Nur für Tests. */
export function voiceCoachActive(): string | null {
  return active?.config.recordingId ?? null;
}

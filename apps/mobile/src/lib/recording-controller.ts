import {
  pauseRecording,
  resumeRecording,
  startRecording,
  stopRecording,
  type TrackedRouteSport,
} from '@fitnessapp/core';
import { AppState } from 'react-native';

import type { Backend } from '@/data/backend';
import { newId } from '@/data/create-backend';

import { DemoRun } from './demo-recording';
import { locationDriver } from './location-driver';
import { type PersistedRecording, recordingSession } from './recording-session';
import { stopVoiceCoach } from './voice-coach';

/**
 * Steuerung der Aufzeichnung (Etappe E4): verbindet Standort (iPhone/Android) bzw. Demo (Testmodus im Browser) mit dem
 * Aufzeichnungs-Zustand. Standort läuft NUR zwischen Start/Fortsetzen und Pause/Stopp. Fachlogik (Zustands-Übergänge,
 * Filter, Zahlen) liegt in packages/core.
 */

let demo: DemoRun | null = null;
let appStateHooked = false;

function hookAppState(): void {
  if (appStateHooked) return;
  appStateHooked = true;
  // Geht die App in den Hintergrund, sofort sichern (Absturz/Beenden durch das System → „Fortsetzen oder speichern?“).
  AppState.addEventListener('change', (next) => {
    if (next !== 'active') void recordingSession.persist(true);
  });
}

function persistVia(backend: Backend) {
  return (text: string | null) =>
    text === null ? backend.clearRecording() : backend.writeRecording(text);
}

export async function beginRecording(input: {
  backend: Backend;
  sport: TrackedRouteSport;
  ownerUserId: string;
  baseRouteId: string | null;
  mode: 'gps' | 'demo';
}): Promise<void> {
  hookAppState();
  demo?.pause();
  demo = null;
  if (input.mode === 'demo') {
    const run = new DemoRun(input.sport, (points) => recordingSession.addPoints(points));
    demo = run;
    recordingSession.begin(
      {
        mode: 'demo',
        diaryLogId: null,
        state: startRecording({
          id: newId(),
          ownerUserId: input.ownerUserId,
          sport: input.sport,
          baseRouteId: input.baseRouteId,
          now: run.now(),
        }),
      },
      persistVia(input.backend),
      () => run.now(),
    );
    run.start();
    await recordingSession.persist(true);
    return;
  }
  locationDriver.setListener((points) => recordingSession.addPoints(points));
  recordingSession.begin(
    {
      mode: 'gps',
      diaryLogId: null,
      state: startRecording({
        id: newId(),
        ownerUserId: input.ownerUserId,
        sport: input.sport,
        baseRouteId: input.baseRouteId,
        now: Date.now(),
      }),
    },
    persistVia(input.backend),
  );
  try {
    await locationDriver.start();
  } catch (error) {
    await recordingSession.reset();
    throw error;
  }
  await recordingSession.persist(true);
}

/** Nach Absturz/Neustart: gesicherten Stand übernehmen (pausiert bzw. beendet; Standort startet erst auf Tipp). */
export async function restoreRecording(backend: Backend, value: PersistedRecording): Promise<void> {
  hookAppState();
  if (recordingSession.get()?.state.id === value.state.id) return;
  await locationDriver.stop();
  locationDriver.setListener((points) => recordingSession.addPoints(points));
  // Demo nach Neustart: nur speichern oder verwerfen (die Zeitraffer-Uhr lässt sich nicht fortsetzen).
  const state =
    value.mode === 'demo' && value.state.status !== 'stopped'
      ? stopRecording(value.state, recordingSession.now())
      : value.state;
  recordingSession.begin({ ...value, state }, persistVia(backend));
}

export async function pauseActiveRecording(): Promise<void> {
  const current = recordingSession.get();
  if (!current || current.state.status !== 'recording') return;
  if (current.mode === 'demo') demo?.pause();
  else await locationDriver.stop();
  recordingSession.update((s) => pauseRecording(s, recordingSession.now()), true);
}

export async function resumeActiveRecording(): Promise<void> {
  const current = recordingSession.get();
  if (!current || current.state.status !== 'paused') return;
  if (current.mode === 'demo') {
    if (!demo) return;
    recordingSession.update((s) => resumeRecording(s, recordingSession.now()), true);
    demo.start();
    return;
  }
  await locationDriver.start();
  recordingSession.update((s) => resumeRecording(s, recordingSession.now()), true);
}

export async function stopActiveRecording(): Promise<void> {
  const current = recordingSession.get();
  if (!current) return;
  if (current.mode === 'demo') demo?.pause();
  else await locationDriver.stop();
  recordingSession.update((s) => stopRecording(s, recordingSession.now()), true);
}

/** Gespeichert oder verworfen: Standort aus, Sicherung löschen. */
export async function endRecording(): Promise<void> {
  stopVoiceCoach();
  demo?.pause();
  demo = null;
  await locationDriver.stop();
  locationDriver.setListener(null);
  await recordingSession.reset();
}

export function isDemoRecording(): boolean {
  return recordingSession.get()?.mode === 'demo';
}

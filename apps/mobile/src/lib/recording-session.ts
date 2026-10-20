import {
  addRecordingPoints,
  pauseRecording,
  type RecordingState,
  recordingStateSchema,
  ROUTE_RECORDING,
  type TrackPoint,
} from '@fitnessapp/core';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

/**
 * Laufende Aufzeichnung als EINZIGER Zustand der App (Etappe E4): lebt außerhalb der Bildschirme, damit die
 * Aufzeichnung beim Wechseln der Seiten und bei gesperrtem Handy weiterläuft (Punkte kommen aus der Hintergrund-
 * Aufgabe). Gesichert wird verschlüsselt über das Backend (geschützter Speicher `routeRecording`) – spätestens alle
 * ROUTE_RECORDING.checkpointIntervalS Sekunden sowie bei Pause, Stopp und wenn die App in den Hintergrund geht.
 * Keine Koordinaten in Logs.
 */

export type RecordingMode = 'gps' | 'demo';

/** Gesicherter Stand: Aufzeichnung + Fortschritt des Speicherns (Tagebuch-Eintrag schon angelegt → nie doppelt). */
const persistedSchema = z.strictObject({
  v: z.literal(1),
  mode: z.enum(['gps', 'demo']),
  /** id des schon angelegten Tagebuch-Eintrags (Speichern begonnen); null = noch keiner. */
  diaryLogId: z.uuid().nullable(),
  state: recordingStateSchema,
});

export interface PersistedRecording {
  mode: RecordingMode;
  diaryLogId: string | null;
  state: RecordingState;
}

/**
 * Gesicherten Stand prüfen (Zod): kaputt oder anderes Konto → null (nie anbieten). Eine beim Absturz laufende
 * Aufzeichnung wird beim letzten Punkt pausiert – „Fortsetzen“ startet den Standort erst auf Tipp neu.
 */
export function parsePersistedRecording(
  text: string | null,
  ownerUserId: string,
): PersistedRecording | null {
  if (!text) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = persistedSchema.safeParse(json);
  if (!parsed.success || parsed.data.state.ownerUserId !== ownerUserId) return null;
  const state = parsed.data.state as RecordingState;
  const current = state.segments.at(-1);
  const lastT = current?.points.at(-1)?.t ?? current?.startT ?? 0;
  return {
    mode: parsed.data.mode,
    diaryLogId: parsed.data.diaryLogId,
    state: state.status === 'recording' ? pauseRecording(state, lastT) : state,
  };
}

export function serializeRecording(value: PersistedRecording): string {
  return JSON.stringify({ v: 1, ...value });
}

type Persist = (text: string | null) => Promise<void>;

class RecordingSessionStore {
  private value: PersistedRecording | null = null;
  private listeners = new Set<() => void>();
  private persistFn: Persist | null = null;
  private lastPersistAt = 0;
  private clock: () => number = () => Date.now();

  get(): PersistedRecording | null {
    return this.value;
  }

  now(): number {
    return this.clock();
  }

  /** Neue bzw. wiederhergestellte Aufzeichnung übernehmen. */
  begin(value: PersistedRecording, persist: Persist, clock?: () => number): void {
    this.value = value;
    this.persistFn = persist;
    this.clock = clock ?? (() => Date.now());
    this.lastPersistAt = 0;
    this.notify();
  }

  /** Zustand ändern; `force` = sofort sichern (Pause, Stopp, Hintergrund). */
  update(change: (state: RecordingState) => RecordingState, force = false): void {
    if (!this.value) return;
    const next = change(this.value.state);
    if (next === this.value.state && !force) return;
    this.value = { ...this.value, state: next };
    this.notify();
    void this.persist(force);
  }

  addPoints(points: readonly TrackPoint[]): void {
    this.update((state) => addRecordingPoints(state, points));
  }

  async setDiaryLogId(id: string): Promise<void> {
    if (!this.value) return;
    this.value = { ...this.value, diaryLogId: id };
    await this.persist(true);
  }

  /** Sichern: höchstens alle checkpointIntervalS Sekunden, außer `force`. Fehler still (nächster Versuch folgt). */
  async persist(force = false): Promise<void> {
    if (!this.value || !this.persistFn) return;
    const now = Date.now();
    if (!force && now - this.lastPersistAt < ROUTE_RECORDING.checkpointIntervalS * 1000) return;
    this.lastPersistAt = now;
    try {
      await this.persistFn(serializeRecording(this.value));
    } catch {
      // Speicher gerade nicht beschreibbar – beim nächsten Punkt bzw. Pause erneut.
      this.lastPersistAt = 0;
    }
  }

  /** Aufzeichnung beenden (gespeichert oder verworfen) – Sicherung löschen. */
  async reset(): Promise<void> {
    const persist = this.persistFn;
    this.value = null;
    this.persistFn = null;
    this.clock = () => Date.now();
    this.notify();
    if (persist) await persist(null).catch(() => undefined);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const recordingSession = new RecordingSessionStore();

/** Aktuelle Aufzeichnung (für Bildschirme). */
export function useRecordingSession(): PersistedRecording | null {
  return useSyncExternalStore(
    recordingSession.subscribe,
    () => recordingSession.get(),
    () => recordingSession.get(),
  );
}

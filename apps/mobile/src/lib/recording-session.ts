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

/**
 * Gesicherter Stand (Format 2, kompakt): Punkte als Zahlen-Tupel [Breite × 1e6, Länge × 1e6, ms seit Beginn des
 * Teilstücks, Genauigkeit in m, Höhe in dm] – ca. 35 Bytes je Punkt. So bleibt auch eine 12-h-Aufzeichnung (bei 1
 * Punkt je 2 s) verschlüsselt deutlich unter 2 MB (Android-AsyncStorage liest größere Einträge nicht zuverlässig).
 */
const compactPointSchema = z.tuple([
  z.number().int(),
  z.number().int(),
  z.number().int().nonnegative(),
  z.number().nonnegative().nullable(),
  z.number().int().nullable(),
]);

const persistedSchema = z.strictObject({
  v: z.literal(2),
  mode: z.enum(['gps', 'demo']),
  /** id des schon angelegten Tagebuch-Eintrags (Speichern begonnen); null = noch keiner. */
  diaryLogId: z.uuid().nullable(),
  state: z.strictObject({
    format: z.literal(1),
    id: z.string(),
    ownerUserId: z.string(),
    sport: z.string(),
    baseRouteId: z.string().nullable(),
    status: z.string(),
    segments: z.array(
      z.strictObject({
        startT: z.number().int(),
        endT: z.number().int().nullable(),
        p: z.array(compactPointSchema),
      }),
    ),
  }),
});

export interface PersistedRecording {
  mode: RecordingMode;
  diaryLogId: string | null;
  state: RecordingState;
}

/**
 * Gesicherten Stand prüfen (Zod, danach recordingStateSchema): kaputt oder anderes Konto → null (nie anbieten). Eine
 * beim Absturz laufende Aufzeichnung wird beim letzten Punkt pausiert – „Fortsetzen“ startet den Standort erst auf Tipp.
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
  const outer = persistedSchema.safeParse(json);
  if (!outer.success) return null;
  const expanded = {
    ...outer.data.state,
    segments: outer.data.state.segments.map((segment) => ({
      startT: segment.startT,
      endT: segment.endT,
      points: segment.p.map(([lat, lng, dt, accuracy, altitude]) => ({
        lat: lat / 1e6,
        lng: lng / 1e6,
        t: segment.startT + dt,
        accuracyM: accuracy,
        altitudeM: altitude === null ? null : altitude / 10,
      })),
    })),
  };
  const parsed = recordingStateSchema.safeParse(expanded);
  if (!parsed.success || parsed.data.ownerUserId !== ownerUserId) return null;
  const state = parsed.data as RecordingState;
  const current = state.segments.at(-1);
  const lastT = current?.points.at(-1)?.t ?? current?.startT ?? 0;
  return {
    mode: outer.data.mode,
    diaryLogId: outer.data.diaryLogId,
    state: state.status === 'recording' ? pauseRecording(state, lastT) : state,
  };
}

export function serializeRecording(value: PersistedRecording): string {
  return JSON.stringify({
    v: 2,
    mode: value.mode,
    diaryLogId: value.diaryLogId,
    state: {
      ...value.state,
      segments: value.state.segments.map((segment) => ({
        startT: segment.startT,
        endT: segment.endT,
        p: segment.points.map((point) => [
          Math.round(point.lat * 1e6),
          Math.round(point.lng * 1e6),
          Math.max(0, Math.round(point.t - segment.startT)),
          point.accuracyM == null ? null : Math.round(point.accuracyM * 10) / 10,
          point.altitudeM == null || !Number.isFinite(point.altitudeM)
            ? null
            : Math.round(point.altitudeM * 10),
        ]),
      })),
    },
  });
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

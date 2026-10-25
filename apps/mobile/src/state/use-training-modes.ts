import {
  type PainEpisodeInput,
  type TrainingModesState,
  type TravelModeInput,
} from '@fitnessapp/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { deviceStore } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson } from '@/data/kv';
import {
  hasPainConsent,
  onTrainingModesCleared,
  TrainingModesError,
  trainingModesFor,
  type TrainingModesBackend,
} from '@/data/training-modes';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';

/**
 * Trainings-Modi in der App (docs/PLAN-TRAINING-MODI.md 7): lädt Schmerz-Einträge und Reise-Zeiträume über die eigene
 * Schnittstelle; alle Regeln (wirksam an einem Tag, Arzt-Hinweis, Banner) rechnet packages/core. Der zuletzt
 * geladene Stand bleibt nur im Arbeitsspeicher dieses Kontos (nie unverschlüsselt) und wird bei Kontowechsel,
 * Widerruf und „Gerätedaten löschen“ verworfen. Nie console.* mit Einträgen.
 */
export type TrainingModesLoad =
  | { kind: 'loading' }
  | { kind: 'ready'; state: TrainingModesState; offline: boolean }
  | { kind: 'error' };

let memory: { userId: string; load: Extract<TrainingModesLoad, { kind: 'ready' }> } | null = null;
const listeners = new Set<() => void>();

onTrainingModesCleared(() => {
  memory = null;
  for (const listener of listeners) listener();
});

/** Zuletzt geladener Stand dieses Kontos (Arbeitsspeicher) – null = noch nicht geladen. */
export function peekTrainingModes(userId: string | null): TrainingModesState | null {
  return memory && memory.userId === userId ? memory.load.state : null;
}

export interface TrainingModesView {
  readonly modes: TrainingModesBackend | null;
  readonly load: TrainingModesLoad;
  /** Geladener Stand (null = noch nicht da) – Eingabe für sessionDisplay/workoutView. */
  readonly state: TrainingModesState | null;
  readonly today: string;
  /** Schmerz-Einträge erlaubt (Einwilligung health_data Fassung ≥ 2)? */
  readonly painConsent: boolean;
  /** Fassung ≥ 2 gibt es (noch) nicht – rechtliche Prüfung läuft (Supabase-Modus). */
  readonly painConsentPending: boolean;
  reload(): Promise<void>;
  addPain(input: PainEpisodeInput): Promise<void>;
  endPain(id: string): Promise<void>;
  deleteAllPain(): Promise<void>;
  addTravel(input: TravelModeInput): Promise<void>;
  endTravel(id: string): Promise<void>;
}

export function useTrainingModes(): TrainingModesView {
  const app = useApp();
  const today = useToday();
  const userId = app.session?.userId ?? null;
  const modes = useMemo(() => trainingModesFor(app.backend), [app.backend]);
  const [load, setLoad] = useState<TrainingModesLoad>(() =>
    memory && memory.userId === userId ? memory.load : { kind: 'loading' },
  );

  const reload = useCallback(async () => {
    if (!modes || !userId) return;
    try {
      const snapshot = await modes.load(userId, today);
      const ready = { kind: 'ready' as const, state: snapshot.state, offline: snapshot.offline };
      memory = { userId, load: ready };
      setLoad(ready);
      // Andere offene Ansichten (z. B. „Heute“ unter dem Modus-Bildschirm) übernehmen den neuen Stand.
      for (const listener of listeners) listener();
    } catch {
      setLoad((current) => (current.kind === 'ready' ? current : { kind: 'error' }));
    }
  }, [modes, today, userId]);
  // Zuhörer: übernimmt den Stand aus dem Arbeitsspeicher (ohne selbst neu zu laden).
  const self = useMemo(
    () => () => {
      setLoad(memory && memory.userId === userId ? memory.load : { kind: 'loading' as const });
    },
    [userId],
  );
  useEffect(() => {
    listeners.add(self);
    return () => {
      listeners.delete(self);
    };
  }, [self]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const consents = app.rows?.consents ?? [];
  const painConsent = hasPainConsent(consents, app.versions.health_data);
  const painConsentPending = (app.versions.health_data ?? 0) < 2;

  const withUser = useCallback(
    async (action: (m: TrainingModesBackend, user: string) => Promise<void>) => {
      if (!modes || !userId) throw new TrainingModesError('not_signed_in');
      await action(modes, userId);
      await reload();
    },
    [modes, reload, userId],
  );

  return {
    modes,
    load,
    state: load.kind === 'ready' ? load.state : null,
    today,
    painConsent,
    painConsentPending,
    reload,
    addPain: (input) => withUser((m, u) => m.addPain(u, input, today, painConsent)),
    endPain: (id) => withUser((m, u) => m.endPain(u, id, today)),
    deleteAllPain: () => withUser((m, u) => m.deleteAllPain(u)),
    addTravel: (input) => withUser((m, u) => m.addTravel(u, input, today)),
    endTravel: (id) => withUser((m, u) => m.endTravel(u, id, today)),
  };
}

/** Einstellung „Aufwärmen & Dehnen“ (Standard: an), gespeichert nur auf diesem Gerät. */
export function useWarmupSetting(): {
  enabled: boolean;
  loaded: boolean;
  setEnabled: (value: boolean) => Promise<void>;
} {
  const [enabled, setEnabledState] = useState(true);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    readJson<boolean>(deviceStore, STORAGE_KEYS.warmupRoutine)
      .catch(() => null)
      .then((value) => {
        if (!alive) return;
        setEnabledState(value !== false);
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  const setEnabled = useCallback(async (value: boolean) => {
    setEnabledState(value);
    await writeJson(deviceStore, STORAGE_KEYS.warmupRoutine, value);
  }, []);
  return { enabled, loaded, setEnabled };
}

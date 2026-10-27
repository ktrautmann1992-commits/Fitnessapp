import { useSyncExternalStore } from 'react';
import { z } from 'zod';

import { deviceStore } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStore } from '@/data/kv';

/**
 * Nährstoff-Timing (docs/PLAN-NAEHRSTOFF-TIMING.md 7, Entscheidung 8): Geräte-Einstellung „Erinnerung vor dem
 * Training“ – Standard AUS, nur dieses Gerät, keine Nutzerdaten. Ein gemeinsamer Speicher im Arbeitsspeicher (wie
 * lib/shopping-prefs.ts), damit Zeitleiste und Einstellungen dieselbe Wahl sehen.
 */
export interface TrainingMealPrefs {
  loaded: boolean;
  reminder: boolean;
}

const DEFAULTS: TrainingMealPrefs = { loaded: false, reminder: false };

const storedSchema = z.object({ reminder: z.boolean().catch(false) });

/** Gespeicherten Wert lesen (ungültig → Standard aus). */
export function parseTrainingMealPrefs(value: unknown): Omit<TrainingMealPrefs, 'loaded'> {
  const parsed = storedSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : { reminder: false };
}

let state: TrainingMealPrefs = DEFAULTS;
let store: KeyValueStore = deviceStore;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: TrainingMealPrefs) {
  state = next;
  listeners.forEach((l) => l());
}

function load() {
  loading ??= readJson<unknown>(store, STORAGE_KEYS.trainingMealPrefs)
    .catch(() => null)
    .then((value) => emit({ ...parseTrainingMealPrefs(value), loaded: true }));
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => listeners.delete(listener);
}

/** Erinnerung an/aus (sofort sichtbar, dann gespeichert; Speicherfehler bleiben folgenlos). */
export function setTrainingMealReminder(reminder: boolean): void {
  emit({ ...state, reminder, loaded: true });
  void writeJson(store, STORAGE_KEYS.trainingMealPrefs, { reminder }).catch(() => undefined);
}

export function useTrainingMealPrefs(): TrainingMealPrefs {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

/** Nur Tests: eigener Speicher und Neustart. */
export function resetTrainingMealPrefsForTests(kv: KeyValueStore): void {
  store = kv;
  loading = null;
  state = DEFAULTS;
}

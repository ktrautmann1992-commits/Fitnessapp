import {
  DEFAULT_REMINDER_SETTINGS,
  parseReminderSettings,
  type ReminderSettings,
} from '@fitnessapp/core';
import { useSyncExternalStore } from 'react';

import { deviceStore } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStore } from '@/data/kv';

/**
 * Erinnerungen an Training, Essen und Trinken (docs/PLAN-ERINNERUNGEN.md): Geräte-Einstellung – Standard alles AUS,
 * nur dieses Gerät, keine Nutzerdaten. Ein gemeinsamer Speicher im Arbeitsspeicher (wie lib/training-meal-prefs.ts),
 * damit Einstellungen und das Planen im Hintergrund (ReminderScheduler) dieselbe Wahl sehen. Prüfen: packages/core
 * `parseReminderSettings` (ungültig → Standard des Bereichs).
 */
export interface ReminderPrefs {
  readonly loaded: boolean;
  readonly settings: ReminderSettings;
}

const DEFAULTS: ReminderPrefs = { loaded: false, settings: DEFAULT_REMINDER_SETTINGS };

let state: ReminderPrefs = DEFAULTS;
let store: KeyValueStore = deviceStore;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: ReminderPrefs) {
  state = next;
  listeners.forEach((l) => l());
}

/** Gespeicherte Einstellung laden (einmal; danach aus dem Arbeitsspeicher). */
export function loadReminderPrefs(): Promise<void> {
  loading ??= readJson<unknown>(store, STORAGE_KEYS.reminderPrefs)
    .catch(() => null)
    .then((value) => emit({ loaded: true, settings: parseReminderSettings(value) }));
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void loadReminderPrefs();
  return () => listeners.delete(listener);
}

/** Einen Bereich ändern (sofort sichtbar, dann gespeichert). Ungültige Werte → Standard dieses Bereichs. */
export async function updateReminderPrefs(
  change: Partial<{ [K in keyof ReminderSettings]: Partial<ReminderSettings[K]> }>,
): Promise<ReminderSettings> {
  await loadReminderPrefs();
  const current = state.settings;
  const settings = parseReminderSettings({
    training: { ...current.training, ...change.training },
    meals: { ...current.meals, ...change.meals },
    drink: { ...current.drink, ...change.drink },
  });
  emit({ loaded: true, settings });
  await writeJson(store, STORAGE_KEYS.reminderPrefs, settings).catch(() => undefined);
  return settings;
}

/** Abmelden/Konto löschen: alles aus (der gespeicherte Wert wird in lib/notifications.ts `reset` entfernt). */
export function forgetReminderPrefs(): void {
  loading = Promise.resolve();
  emit({ loaded: true, settings: DEFAULT_REMINDER_SETTINGS });
}

export function useReminderPrefs(): ReminderPrefs {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

/** Aktueller Stand ohne React (Planen). */
export function currentReminderPrefs(): ReminderPrefs {
  return state;
}

/** Nur Tests: eigener Speicher und Neustart. */
export function resetReminderPrefsForTests(kv: KeyValueStore): void {
  store = kv;
  loading = null;
  state = DEFAULTS;
  listeners.clear();
}

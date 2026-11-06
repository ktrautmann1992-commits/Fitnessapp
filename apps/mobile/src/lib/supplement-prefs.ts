import { useSyncExternalStore } from 'react';

import { deviceStore } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStore } from '@/data/kv';

import { parseSupplementPrefs } from './supplement-visibility';

export { parseSupplementPrefs, supplementsVisible } from './supplement-visibility';

/**
 * „Nahrungsergänzungsmittel anzeigen“ (Gründer-Entscheidung 06.11.2026, docs/PLAN-SUPPLEMENTE-TRAINING.md):
 * Geräte-Einstellung, keine Nutzerdaten, kein Gesundheitsdatum (wie lib/training-meal-prefs.ts). `null` = noch nicht
 * gewählt – dann gilt `supplementsVisible`: AUS für neue Nutzer, AN für alle, die den Bereich schon genutzt haben
 * (Supplement-Check oder „Meine Supplements“ gespeichert), damit niemandem etwas verschwindet.
 */
export interface SupplementPrefs {
  readonly loaded: boolean;
  /** `null` = noch nicht gewählt. */
  readonly visible: boolean | null;
}

const DEFAULTS: SupplementPrefs = { loaded: false, visible: null };

let state: SupplementPrefs = DEFAULTS;
let store: KeyValueStore = deviceStore;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: SupplementPrefs) {
  state = next;
  listeners.forEach((l) => l());
}

function load() {
  loading ??= readJson<unknown>(store, STORAGE_KEYS.supplementPrefs)
    .catch(() => null)
    .then((value) => emit({ ...parseSupplementPrefs(value), loaded: true }));
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => listeners.delete(listener);
}

/** An/aus (sofort sichtbar, dann gespeichert; Speicherfehler bleiben folgenlos). */
export function setSupplementsVisible(visible: boolean): void {
  emit({ visible, loaded: true });
  void writeJson(store, STORAGE_KEYS.supplementPrefs, { visible }).catch(() => undefined);
}

export function useSupplementPrefs(): SupplementPrefs {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

/** Nur Tests: eigener Speicher und Neustart. */
export function resetSupplementPrefsForTests(kv: KeyValueStore): void {
  store = kv;
  loading = null;
  state = DEFAULTS;
}

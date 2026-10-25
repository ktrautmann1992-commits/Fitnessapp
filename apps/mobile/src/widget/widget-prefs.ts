import { useSyncExternalStore } from 'react';

import { deviceStore } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStore } from '@/data/kv';

/**
 * Schalter „Widget auf dem Startbildschirm“ (docs/PLAN-WIDGET.md 3, Gründer-Entscheidung 25.10.2026): Standard AUS –
 * was das Widget zeigt, ist auf dem Startbildschirm für alle sichtbar, die das entsperrte Handy sehen. Nur dieses
 * Gerät, keine Nutzerdaten. Ein gemeinsamer Speicher im Arbeitsspeicher, damit Einstellungen und Abgleich dieselbe
 * Wahl sehen.
 */
export interface WidgetPrefs {
  readonly loaded: boolean;
  readonly enabled: boolean;
}

const DEFAULTS: WidgetPrefs = { loaded: false, enabled: false };

let state: WidgetPrefs = DEFAULTS;
let store: KeyValueStore = deviceStore;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: WidgetPrefs) {
  state = next;
  listeners.forEach((l) => l());
}

/** Gespeicherten Wert lesen: nur ein echtes `true` schaltet ein (alles andere = aus). */
export async function readWidgetEnabled(kv: KeyValueStore = store): Promise<boolean> {
  const value = await readJson<unknown>(kv, STORAGE_KEYS.widgetEnabled).catch(() => null);
  return value === true;
}

function load() {
  loading ??= readWidgetEnabled().then((enabled) => emit({ loaded: true, enabled }));
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => listeners.delete(listener);
}

/** Schalter setzen (sofort sichtbar, dann gespeichert). */
export async function setWidgetEnabled(enabled: boolean): Promise<void> {
  emit({ loaded: true, enabled });
  await writeJson(store, STORAGE_KEYS.widgetEnabled, enabled);
}

/** Abmelden/Konto löschen/Testdaten löschen: Schalter zurück auf aus. */
export async function resetWidgetPrefs(): Promise<void> {
  emit({ loaded: true, enabled: false });
  await store.removeItem(STORAGE_KEYS.widgetEnabled);
}

export function useWidgetPrefs(): WidgetPrefs {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

/** Nur Tests: eigener Speicher und Neustart. */
export function resetWidgetPrefsForTests(kv: KeyValueStore): void {
  store = kv;
  loading = null;
  state = DEFAULTS;
}

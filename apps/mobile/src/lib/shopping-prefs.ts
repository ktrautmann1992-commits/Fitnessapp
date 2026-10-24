import {
  addDays,
  isoDateSchema,
  SHOPPING_CATEGORIES,
  SHOPPING_RANGE_MODES,
  type ShoppingCategory,
  type ShoppingRangeMode,
} from '@fitnessapp/core';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

import { deviceStore } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStore } from '@/data/kv';

/**
 * Bedien-Einstellungen der Einkaufsliste (docs/PLAN-EINKAUFEN-AUSDAUER.md 3, Gründer-Entscheidung 23.10.2026): Wahl
 * „3 Tage | Ganze Woche“, Wochen mit „Eigener Zeitraum“, „Erledigte ausblenden“ (Standard: an) und zugeklappte
 * Abteilungen. Nur dieses Gerät, keine Nutzerdaten (nur Wochen-Daten und Abteilungsnamen). Ein gemeinsamer Speicher
 * im Arbeitsspeicher, damit Liste, Drucken, Weitergeben und Ernährung dieselbe Wahl sehen (sonst würden sie
 * abwechselnd verschiedene Zeiträume speichern).
 */
export interface ShoppingPrefs {
  /** Erst nach dem Laden gilt die Wahl – vorher bleibt der gespeicherte Zeitraum (kein voreiliges Speichern). */
  loaded: boolean;
  mode: ShoppingRangeMode;
  /** Wochen (Montag), für die die Person einen eigenen Zeitraum gewählt hat. */
  manualWeeks: readonly string[];
  hideChecked: boolean;
  collapsed: readonly ShoppingCategory[];
}

const DEFAULTS: ShoppingPrefs = {
  loaded: false,
  mode: 'days',
  manualWeeks: [],
  hideChecked: true,
  collapsed: [],
};

const storedSchema = z.object({
  mode: z.enum(SHOPPING_RANGE_MODES).catch('days'),
  manualWeeks: z.array(isoDateSchema).max(10).catch([]),
  hideChecked: z.boolean().catch(true),
  collapsed: z.array(z.enum(SHOPPING_CATEGORIES)).max(SHOPPING_CATEGORIES.length).catch([]),
});

/** Gespeicherten Wert lesen (ungültig → Standard). */
export function parseShoppingPrefs(value: unknown): Omit<ShoppingPrefs, 'loaded'> {
  const parsed = storedSchema.safeParse(value ?? {});
  if (!parsed.success) {
    const { mode, manualWeeks, hideChecked, collapsed } = DEFAULTS;
    return { mode, manualWeeks, hideChecked, collapsed };
  }
  return parsed.data;
}

let state: ShoppingPrefs = DEFAULTS;
let store: KeyValueStore = deviceStore;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: ShoppingPrefs) {
  state = next;
  listeners.forEach((l) => l());
}

function load() {
  loading ??= readJson<unknown>(store, STORAGE_KEYS.shoppingPrefs)
    .catch(() => null)
    .then((value) => emit({ ...parseShoppingPrefs(value), loaded: true }));
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => listeners.delete(listener);
}

/** Einstellung ändern (sofort sichtbar, dann gespeichert; Speicherfehler bleiben folgenlos). */
export function updateShoppingPrefs(
  change: (prefs: Omit<ShoppingPrefs, 'loaded'>) => Partial<Omit<ShoppingPrefs, 'loaded'>>,
): void {
  const next = { ...state, ...change(state), loaded: true };
  emit(next);
  const persisted = {
    mode: next.mode,
    manualWeeks: next.manualWeeks,
    hideChecked: next.hideChecked,
    collapsed: next.collapsed,
  };
  void writeJson(store, STORAGE_KEYS.shoppingPrefs, persisted).catch(() => undefined);
}

/** Woche mit eigenem Zeitraum merken bzw. vergessen; ältere Wochen (vor `today` − 7 Tage) fallen weg. */
export function setShoppingWeekManual(weekStart: string, manual: boolean, today: string): void {
  updateShoppingPrefs((prefs) => ({
    manualWeeks: [
      ...prefs.manualWeeks.filter((w) => w !== weekStart && w >= addDays(today, -7)),
      ...(manual ? [weekStart] : []),
    ],
  }));
}

export function useShoppingPrefs(): ShoppingPrefs {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

/** Nur Tests: eigener Speicher und Neustart. */
export function resetShoppingPrefsForTests(kv: KeyValueStore): void {
  store = kv;
  loading = null;
  state = DEFAULTS;
}

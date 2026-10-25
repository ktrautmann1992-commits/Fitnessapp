import {
  EMPTY_EATING_OUT_PICKS,
  type EatingOutPick,
  type EatingOutPicks,
  parseEatingOutPicks,
  toggleEatingOutFavorite,
  withEatingOutRecent,
} from '@fitnessapp/core';
import { useCallback, useEffect, useState } from 'react';

import { deviceStore } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStore } from '@/data/kv';

/**
 * Favoriten und „Zuletzt“ im Reiter „Unterwegs“ (Auswärts essen, 25.10.2026): nur auf diesem Gerät, je Konto, nur
 * Gericht-IDs und Portion – keine Uhrzeit, keine Werte, kein Freitext. Regeln (Reihenfolge, Grenzen) in packages/core
 * (`withEatingOutRecent`, `toggleEatingOutFavorite`). Ein Eintrag eines anderen Kontos wird ignoriert.
 */
let store: KeyValueStore = deviceStore;

export async function loadEatingOutPicks(userId: string): Promise<EatingOutPicks> {
  try {
    const raw = await readJson<{ userId?: unknown; picks?: unknown }>(
      store,
      STORAGE_KEYS.eatingOutPicks,
    );
    if (raw === null || raw.userId !== userId) return EMPTY_EATING_OUT_PICKS;
    return parseEatingOutPicks(raw.picks);
  } catch {
    return EMPTY_EATING_OUT_PICKS;
  }
}

export async function saveEatingOutPicks(userId: string, picks: EatingOutPicks): Promise<void> {
  await writeJson(store, STORAGE_KEYS.eatingOutPicks, { userId, picks }).catch(() => undefined);
}

/** Gemerkte Auswahl des Kontos; Änderungen sofort sichtbar, dann gespeichert. */
export function useEatingOutPicks(userId: string | null): {
  picks: EatingOutPicks;
  remember: (pick: EatingOutPick) => void;
  toggleFavorite: (dishId: string) => void;
} {
  const [picks, setPicks] = useState<EatingOutPicks>(EMPTY_EATING_OUT_PICKS);
  useEffect(() => {
    let active = true;
    if (userId === null) return;
    void loadEatingOutPicks(userId).then((loaded) => {
      if (active) setPicks(loaded);
    });
    return () => {
      active = false;
    };
  }, [userId]);
  const update = useCallback(
    (change: (current: EatingOutPicks) => EatingOutPicks) => {
      setPicks((current) => {
        const next = change(current);
        if (userId !== null) void saveEatingOutPicks(userId, next);
        return next;
      });
    },
    [userId],
  );
  return {
    picks,
    remember: (pick) => update((current) => withEatingOutRecent(current, pick)),
    toggleFavorite: (dishId) => update((current) => toggleEatingOutFavorite(current, dishId)),
  };
}

/** Nur Tests: eigener Speicher. */
export function setEatingOutPicksStoreForTests(kv: KeyValueStore): void {
  store = kv;
}

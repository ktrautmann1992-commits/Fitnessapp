import { recipeSwipeSeenFor, withRecipeSwipeSeen } from '@fitnessapp/core';
import { useCallback, useEffect, useState } from 'react';

import { deviceStore } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStore } from '@/data/kv';

/**
 * „Neutral“ gewischte Rezepte (Gerichte entdecken, 01.11.2026): nur auf diesem Gerät, je Konto und Woche, nur
 * Rezept-IDs – kein Gesundheitsdatum, keine Wirkung auf den Plan. Sie erscheinen in derselben Woche nicht noch einmal
 * im Stapel; ab der nächsten Woche wieder. Regeln (Woche, Obergrenze) in packages/core (`recipeSwipeSeenFor`,
 * `withRecipeSwipeSeen`). Ein Eintrag eines anderen Kontos wird ignoriert.
 */
let store: KeyValueStore = deviceStore;

export async function loadRecipeSwipeSeen(userId: string, weekStart: string): Promise<string[]> {
  try {
    const raw = await readJson<{ userId?: unknown; seen?: unknown }>(
      store,
      STORAGE_KEYS.recipeSwipeSeen,
    );
    if (raw === null || raw.userId !== userId) return [];
    return recipeSwipeSeenFor(raw.seen, weekStart);
  } catch {
    return [];
  }
}

export async function saveRecipeSwipeSeen(
  userId: string,
  weekStart: string,
  recipeIds: readonly string[],
): Promise<void> {
  await writeJson(store, STORAGE_KEYS.recipeSwipeSeen, {
    userId,
    seen: { weekStart, recipeIds },
  }).catch(() => undefined);
}

/** Gesehene Rezepte der Woche; `loaded` erst nach dem Lesen (der Stapel wartet darauf, kein Flackern). */
export function useRecipeSwipeSeen(
  userId: string | null,
  weekStart: string,
): { seen: string[]; loaded: boolean; mark: (recipeId: string, add: boolean) => void } {
  const [state, setState] = useState<{ key: string; seen: string[] } | null>(null);
  const key = `${userId ?? ''}|${weekStart}`;
  useEffect(() => {
    let active = true;
    if (userId === null) {
      setState({ key, seen: [] });
      return;
    }
    void loadRecipeSwipeSeen(userId, weekStart).then((seen) => {
      if (active) setState({ key, seen });
    });
    return () => {
      active = false;
    };
  }, [key, userId, weekStart]);
  const mark = useCallback(
    (recipeId: string, add: boolean) => {
      setState((current) => {
        const base = current?.key === key ? current.seen : [];
        const next = withRecipeSwipeSeen(base, recipeId, add);
        if (userId !== null) void saveRecipeSwipeSeen(userId, weekStart, next);
        return { key, seen: next };
      });
    },
    [key, userId, weekStart],
  );
  const loaded = state?.key === key;
  return { seen: loaded ? state.seen : [], loaded, mark };
}

/** Nur Tests: eigener Speicher. */
export function setRecipeSwipeSeenStoreForTests(kv: KeyValueStore): void {
  store = kv;
}

import { STORY_CARD, storyOwnerName } from '@fitnessapp/core';
import { useCallback, useEffect, useState } from 'react';

import { deviceStore } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson } from '@/data/kv';

import { STORY_THEMES, type StoryTheme } from './story-layout';

/**
 * Einstellungen fürs Teilen-Bild (04.11.2026), je Konto nur auf diesem Gerät: Standard-Design (beim nächsten Teilen
 * voreingestellt, jederzeit umschaltbar), „Uhrzeit zeigen“ und der Name fürs Bild. Kein Gesundheitsdatum.
 */
export interface StoryPrefs {
  readonly theme: StoryTheme;
  readonly showTime: boolean;
  readonly name: string;
}

export const DEFAULT_STORY_PREFS: StoryPrefs = { theme: 'neon', showTime: true, name: '' };

/** Gespeicherten Eintrag eines Kontos lesen; Unbekanntes → Standard. Rein. */
export function parseStoryPrefs(raw: unknown, userId: string): StoryPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_STORY_PREFS;
  const entry = (raw as Record<string, unknown>)[userId];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return DEFAULT_STORY_PREFS;
  const e = entry as Record<string, unknown>;
  const theme = (STORY_THEMES as readonly unknown[]).includes(e.theme)
    ? (e.theme as StoryTheme)
    : DEFAULT_STORY_PREFS.theme;
  const showTime = typeof e.showTime === 'boolean' ? e.showTime : DEFAULT_STORY_PREFS.showTime;
  const name =
    typeof e.name === 'string'
      ? (storyOwnerName(e.name.slice(0, STORY_CARD.maxNameLength * 4)) ?? '')
      : '';
  return { theme, showTime, name };
}

export function useStoryPrefs(userId: string | null): {
  loaded: boolean;
  prefs: StoryPrefs;
  save: (patch: Partial<StoryPrefs>) => void;
} {
  const [state, setState] = useState<{ loaded: boolean; prefs: StoryPrefs }>({
    loaded: false,
    prefs: DEFAULT_STORY_PREFS,
  });
  useEffect(() => {
    let alive = true;
    if (!userId) {
      setState({ loaded: true, prefs: DEFAULT_STORY_PREFS });
      return;
    }
    readJson<unknown>(deviceStore, STORAGE_KEYS.storyPrefs)
      .catch(() => null)
      .then((stored) => {
        if (alive) setState({ loaded: true, prefs: parseStoryPrefs(stored, userId) });
      });
    return () => {
      alive = false;
    };
  }, [userId]);
  const save = useCallback(
    (patch: Partial<StoryPrefs>) => {
      setState((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }));
      if (!userId) return;
      void readJson<unknown>(deviceStore, STORAGE_KEYS.storyPrefs)
        .catch(() => null)
        .then((stored) => {
          const all =
            stored && typeof stored === 'object' && !Array.isArray(stored)
              ? (stored as Record<string, unknown>)
              : {};
          const next = { ...parseStoryPrefs(all, userId), ...patch };
          return writeJson(deviceStore, STORAGE_KEYS.storyPrefs, { ...all, [userId]: next });
        })
        .catch(() => undefined);
    },
    [userId],
  );
  return { ...state, save };
}

/**
 * Gerichte entdecken (Wischen, 01.11.2026): Richtung der Geste und „neutral gesehen“ nur auf dem Gerät, je Konto und
 * Woche, nur Rezept-IDs.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/data/create-backend', () => ({ deviceStore: null }));

import { createMemoryStore, STORAGE_KEYS } from '@/data/kv';

import { SWIPE_THRESHOLD, swipeChoice } from './recipe-swipe-gesture';
import {
  loadRecipeSwipeSeen,
  saveRecipeSwipeSeen,
  setRecipeSwipeSeenStoreForTests,
} from './recipe-swipe-seen';

describe('Wisch-Richtung', () => {
  it('rechts = mag ich, links = mag ich nicht, oben = neutral, sonst nichts', () => {
    expect(swipeChoice(SWIPE_THRESHOLD, 0)).toBe('like');
    expect(swipeChoice(-SWIPE_THRESHOLD - 50, 30)).toBe('dislike');
    expect(swipeChoice(10, -SWIPE_THRESHOLD)).toBe('neutral');
    expect(swipeChoice(SWIPE_THRESHOLD - 1, 0)).toBeNull();
    expect(swipeChoice(0, SWIPE_THRESHOLD * 2)).toBeNull(); // nach unten: zurück
    // Schräg: die größere Richtung zählt.
    expect(swipeChoice(120, -200)).toBe('neutral');
    expect(swipeChoice(200, -120)).toBe('like');
    expect(swipeChoice(Number.NaN, -300)).toBeNull();
  });
});

describe('„Neutral gesehen“ (Gerät)', () => {
  it('je Konto und Woche; andere Woche, fremdes Konto oder kaputter Inhalt → leer', async () => {
    const store = createMemoryStore();
    setRecipeSwipeSeenStoreForTests(store);
    await saveRecipeSwipeSeen('konto-a', '2026-11-02', ['lachs-reis', 'banane-pur']);
    expect(await loadRecipeSwipeSeen('konto-a', '2026-11-04')).toEqual([
      'lachs-reis',
      'banane-pur',
    ]);
    expect(await loadRecipeSwipeSeen('konto-a', '2026-11-09')).toEqual([]);
    expect(await loadRecipeSwipeSeen('konto-b', '2026-11-02')).toEqual([]);
    expect(store.dump()[STORAGE_KEYS.recipeSwipeSeen]).not.toMatch(/kcal|T\d\d:/);
    await store.setItem(STORAGE_KEYS.recipeSwipeSeen, '{kaputt');
    expect(await loadRecipeSwipeSeen('konto-a', '2026-11-02')).toEqual([]);
  });
});

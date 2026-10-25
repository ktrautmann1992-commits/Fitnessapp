/**
 * Reiter „Unterwegs“ (25.10.2026): Favoriten/„Zuletzt“ nur auf dem Gerät, je Konto, nur IDs; „ca.“ an Schätzwerten im
 * Tagebuch („Auswärts gegessen“).
 */
import { EMPTY_EATING_OUT_PICKS } from '@fitnessapp/core';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/data/create-backend', () => ({ deviceStore: null }));

import { createMemoryStore, STORAGE_KEYS } from '@/data/kv';

import {
  loadEatingOutPicks,
  saveEatingOutPicks,
  setEatingOutPicksStoreForTests,
} from './eating-out-picks';
import { entryDetailText, isEstimateEntry } from './food-log-format';

describe('Favoriten und „Zuletzt“ (Gerät)', () => {
  it('je Konto gespeichert; fremdes Konto oder kaputter Inhalt → leer', async () => {
    const store = createMemoryStore();
    setEatingOutPicksStoreForTests(store);
    const picks = {
      recent: [{ dishId: 'auswaerts-pommes', portionId: 'large' }],
      favorites: ['auswaerts-espresso'],
    };
    await saveEatingOutPicks('konto-a', picks);
    expect(await loadEatingOutPicks('konto-a')).toEqual(picks);
    expect(await loadEatingOutPicks('konto-b')).toEqual(EMPTY_EATING_OUT_PICKS);
    // Nur IDs und Portion – keine Uhrzeit, keine Werte.
    expect(store.dump()[STORAGE_KEYS.eatingOutPicks]).not.toMatch(/kcal|T\d\d:/);
    await store.setItem(STORAGE_KEYS.eatingOutPicks, '{kaputt');
    expect(await loadEatingOutPicks('konto-a')).toEqual(EMPTY_EATING_OUT_PICKS);
  });
});

describe('„ca.“ im Tagebuch', () => {
  const base = { amount: null, unit: null, portion: null, kcal: 650 } as const;
  it('Schnelleintrag „Auswärts gegessen“ → „ca. 650 kcal“, andere ohne „ca.“; ohne Zahlen nichts', () => {
    expect(isEstimateEntry({ source: 'quick', title_de: 'Auswärts gegessen' })).toBe(true);
    expect(entryDetailText({ ...base, source: 'quick', title_de: 'Auswärts gegessen' }, true)).toBe(
      'ca. 650 kcal',
    );
    expect(entryDetailText({ ...base, source: 'quick', title_de: 'Snack' }, true)).toBe('650 kcal');
    expect(
      entryDetailText({ ...base, source: 'quick', title_de: 'Auswärts gegessen' }, false),
    ).toBe('');
  });
});

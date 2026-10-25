import { DEFAULT_VOICE_CUE_SETTINGS, type TrackedRouteRow } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { createMemoryStore, STORAGE_KEYS } from '@/data/kv';

import { previousSplitsFor, readVoiceSettings, writeVoiceSettings } from './voice-coach';

const row = (id: string, changes: Partial<TrackedRouteRow>): TrackedRouteRow =>
  ({
    id,
    user_id: 'me',
    sport: 'run',
    started_at: '2026-10-01T07:00:00Z',
    moving_s: 1800,
    distance_m: 5000,
    km_splits: [360, 360, 360, 360, 360],
    base_route_id: null,
    is_favorite: false,
    route_match: null,
    ...changes,
  }) as TrackedRouteRow;

describe('Sprachansagen: Einstellung je Konto', () => {
  it('Standard aus; gespeichert je Konto', async () => {
    const store = createMemoryStore();
    expect(STORAGE_KEYS.voiceCues).toBe('fitnessapp.voice-cues.v1');
    expect(await readVoiceSettings(store, 'a')).toEqual(DEFAULT_VOICE_CUE_SETTINGS);
    await writeVoiceSettings(store, 'a', { ...DEFAULT_VOICE_CUE_SETTINGS, enabled: true });
    expect((await readVoiceSettings(store, 'a')).enabled).toBe(true);
    expect((await readVoiceSettings(store, 'b')).enabled).toBe(false);
  });
});

describe('previousSplitsFor', () => {
  it('letzter vergleichbarer Lauf der Strecke; anders lange zählen nicht', () => {
    const fav = row('fav', { is_favorite: true });
    const a = row('a', {
      base_route_id: 'fav',
      started_at: '2026-10-08T07:00:00Z',
      km_splits: [350, 351, 352, 353, 354],
    });
    const short = row('short', {
      base_route_id: 'fav',
      started_at: '2026-10-09T07:00:00Z',
      distance_m: 3000,
      km_splits: [300, 300, 300],
    });
    expect(previousSplitsFor('fav', [fav, a, short])).toEqual([350, 351, 352, 353, 354]);
    expect(previousSplitsFor(null, [fav, a])).toBeNull();
    expect(previousSplitsFor('fav', [{ ...fav, is_favorite: false }, a])).toBeNull();
  });
});

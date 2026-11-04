import { describe, expect, it, vi } from 'vitest';

vi.mock('@/data/create-backend', () => ({ deviceStore: {} }));

import { DEFAULT_STORY_PREFS, parseStoryPrefs } from './story-prefs';

describe('Teilen-Bild: gemerkte Einstellungen', () => {
  it('je Konto; Unbekanntes → Standard', () => {
    const raw = { u1: { theme: 'topo', showTime: false, name: ' Karsten ' }, u2: { theme: 'x' } };
    expect(parseStoryPrefs(raw, 'u1')).toEqual({ theme: 'topo', showTime: false, name: 'Karsten' });
    expect(parseStoryPrefs(raw, 'u2')).toEqual(DEFAULT_STORY_PREFS);
    expect(parseStoryPrefs(raw, 'u3')).toEqual(DEFAULT_STORY_PREFS);
    expect(parseStoryPrefs(null, 'u1')).toEqual(DEFAULT_STORY_PREFS);
    expect(parseStoryPrefs([1], 'u1')).toEqual(DEFAULT_STORY_PREFS);
  });
});

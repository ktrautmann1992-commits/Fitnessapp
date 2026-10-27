import { enduranceStoryCard } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { storyLayout } from './story-layout';

/** Sportarten Stufe 1 · Wandern: Story-Bild heißt „Wanderung“/„Bergwanderung“ statt „Spaziergang“ – ohne Puls/kcal. */
describe('Story-Bild: Wanderung', () => {
  const base = {
    sport: 'walk' as const,
    startedAt: '2026-10-25T08:00:00Z',
    day: '2026-10-25',
    durationS: 9_000,
    movingS: 8_400,
    distanceM: 12_000,
    elevationM: 650,
    points: null,
  };
  const on = { showLine: true, showDate: true };

  it('Titel je Art; ohne Art wie bisher', () => {
    const title = (walkKind: 'walk' | 'hike' | 'mountain_hike' | null) =>
      storyLayout(enduranceStoryCard({ ...base, walkKind }, on)).texts[0]?.text;
    expect(title('hike')).toBe('Wanderung');
    expect(title('mountain_hike')).toBe('Bergwanderung');
    expect(title(null)).toBe(storyLayout(enduranceStoryCard(base, on)).texts[0]?.text);
    const all = storyLayout(enduranceStoryCard({ ...base, walkKind: 'mountain_hike' }, on))
      .texts.map((x) => x.text)
      .join(' ');
    expect(all).not.toMatch(/kcal|bpm|Puls/);
  });
});

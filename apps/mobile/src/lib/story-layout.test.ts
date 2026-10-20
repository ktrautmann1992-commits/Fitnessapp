import { enduranceStoryCard, strengthStoryCard } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { STORY_H, STORY_W, storyLayout } from './story-layout';

const line = Array.from({ length: 101 }, (_, i) => ({
  lat: 50.9 + i * 0.0002,
  lng: 6.95 + i * 0.0001,
}));

describe('Story-Bild: Aufbau (gleich für App und Browser)', () => {
  it('Ausdauer: Titel, Datum, Linie im Rahmen, Werte; nichts außerhalb des Bildes', () => {
    const card = enduranceStoryCard(
      {
        sport: 'run',
        startedAt: '2026-10-19T05:30:00Z',
        day: '2026-10-19',
        durationS: 1830,
        movingS: 1800,
        distanceM: 6000,
        elevationM: 45,
        points: line,
      },
      { showLine: true, showDate: true },
    );
    const layout = storyLayout(card);
    const texts = layout.texts.map((x) => x.text);
    expect(texts).toEqual(
      expect.arrayContaining(['Lauf', '19.10.2026', 'Distanz', '6,00 km', 'Ø-Pace', '5:00 min/km']),
    );
    expect(texts.join(' ')).not.toMatch(/05:30|07:30/);
    expect(layout.linePath.startsWith('M')).toBe(true);
    for (const t of layout.texts) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeLessThanOrEqual(STORY_H);
      expect(t.x).toBeLessThan(STORY_W);
    }
  });

  it('zu kurz für die Linie → Hinweis statt Linie; Kraft: Übungen und „weitere“', () => {
    const short = enduranceStoryCard(
      {
        sport: 'walk',
        startedAt: null,
        day: '2026-10-19',
        durationS: 600,
        movingS: 600,
        distanceM: 300,
        elevationM: null,
        points: line.slice(0, 10),
      },
      { showLine: true, showDate: false },
    );
    const layout = storyLayout(short);
    expect(layout.linePath).toBe('');
    expect(layout.texts.map((x) => x.text)).toContain('Strecke zu kurz für die Linie');
    const strength = strengthStoryCard(
      {
        nameDe: 'Ganzkörper A',
        performedOn: '2026-10-20',
        startedAt: null,
        finishedAt: null,
        exercises: Array.from({ length: 7 }, (_, i) => ({
          nameDe: `Übung ${i + 1}`,
          loadType: 'weight',
          skipped: false,
          sets: [{ reps: 10, weightKg: 20, done: true }],
        })),
      },
      { showLine: true, showDate: true },
    );
    const texts = storyLayout(strength).texts.map((x) => x.text);
    expect(texts).toEqual(
      expect.arrayContaining(['Ganzkörper A', 'Übung 5', 'und 2 weitere', '1.400 kg']),
    );
    expect(texts).not.toContain('Übung 6');
  });
});

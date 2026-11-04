import { enduranceStoryCard, strengthStoryCard } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import {
  contourPaths,
  estimateWidth,
  splitValue,
  STORY_H,
  STORY_PALETTES,
  STORY_THEMES,
  STORY_W,
  storyLayout,
  type StoryTheme,
} from './story-layout';

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
      expect.arrayContaining([
        'Lauf',
        '19.10.2026',
        'km · Distanz',
        '6,00',
        'Ø-Pace',
        '5:00',
        'min/km',
      ]),
    );
    expect(texts.join(' ')).not.toMatch(/05:30|07:30/);
    expect(layout.linePath.startsWith('M')).toBe(true);
    expect(layout.lineStart).not.toBeNull();
    expect(layout.lineEnd).not.toBeNull();
    // Werte-Kacheln überlappen sich nicht und bleiben im Bild.
    for (const [i, a] of layout.tiles.entries()) {
      expect(a.x + a.width).toBeLessThanOrEqual(STORY_W);
      expect(a.y + a.height).toBeLessThanOrEqual(STORY_H);
      for (const b of layout.tiles.slice(i + 1)) {
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y;
        expect(apart).toBe(true);
      }
    }
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
      expect.arrayContaining([
        'Ganzkörper A',
        'Übung 5',
        'und 2 weitere',
        '1.400',
        'kg · Volumen (Zusatzlast)',
      ]),
    );
    expect(texts).not.toContain('Übung 6');
  });

  it('Zahl und Einheit werden getrennt', () => {
    expect(splitValue('5,48 km')).toEqual({ number: '5,48', unit: 'km' });
    expect(splitValue('5:34 min/km')).toEqual({ number: '5:34', unit: 'min/km' });
    expect(splitValue('ca. 28 m')).toEqual({ number: 'ca. 28', unit: 'm' });
    expect(splitValue('30:30')).toEqual({ number: '30:30', unit: '' });
    expect(splitValue('7')).toEqual({ number: '7', unit: '' });
  });
});

describe('Story-Bild: Designs', () => {
  const card = enduranceStoryCard(
    {
      sport: 'run',
      startedAt: null,
      day: '2026-10-19',
      durationS: 1830,
      movingS: 1800,
      distanceM: 6000,
      elevationM: 45,
      points: line,
    },
    { showLine: true, showDate: true },
  );

  it('alle Designs: gleicher Inhalt, nur die Gestaltung ändert sich', () => {
    const front = (theme: StoryTheme) =>
      storyLayout(card, theme)
        .texts.filter((x) => x.layer === 'front')
        .map((x) => x.text);
    for (const theme of STORY_THEMES) {
      expect(front(theme)).toEqual(front('neon'));
      expect(storyLayout(card, theme).palette).toBe(STORY_PALETTES[theme]);
    }
  });

  it('Neon/Energie: riesige Zahl hinten, passt ins Bild; Topo: Höhenlinien statt Zahl', () => {
    for (const theme of ['neon', 'energie'] as const) {
      const ghost = storyLayout(card, theme).texts.filter((x) => x.layer === 'back');
      expect(ghost.map((x) => x.text)).toEqual(['6,00']);
      expect(estimateWidth('6,00', ghost[0]?.size ?? 0)).toBeLessThanOrEqual(1040);
    }
    const topo = storyLayout(card, 'topo');
    expect(topo.texts.some((x) => x.layer === 'back')).toBe(false);
    expect(topo.decor.length).toBeGreaterThan(10);
    expect(contourPaths()).toEqual(contourPaths());
  });
});

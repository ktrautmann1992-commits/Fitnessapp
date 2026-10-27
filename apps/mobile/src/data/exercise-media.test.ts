import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { exerciseMediaSchema } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import {
  EXERCISE_MEDIA,
  type ExerciseMediaEntry,
  exerciseMediaFor,
  illustrationXml,
} from './exercise-media';

/** Übungsbilder: Registry der App passt zu content/exercise-media; Anzeige nur, wenn ein Bild da ist. */

const mediaDir = fileURLToPath(new URL('../../../../content/exercise-media/', import.meta.url));

describe('EXERCISE_MEDIA', () => {
  it('stimmt mit content/exercise-media überein (gleiche Übungen, gleiche Angaben inkl. Lizenz)', () => {
    const files = existsSync(mediaDir)
      ? readdirSync(mediaDir).filter((name) => name.endsWith('.json'))
      : [];
    expect(Object.keys(EXERCISE_MEDIA).sort()).toEqual(
      files.map((name) => name.replace(/\.json$/, '')).sort(),
    );
    for (const name of files) {
      const data = exerciseMediaSchema.parse(
        JSON.parse(readFileSync(`${mediaDir}${name}`, 'utf8')),
      );
      const entry = EXERCISE_MEDIA[data.exercise_id];
      expect(entry?.media).toEqual(data);
      for (const image of data.images) expect(entry?.sources[image.kind]).toBeDefined();
    }
  });
});

const exercisesDir = fileURLToPath(new URL('../../../../content/exercises/', import.meta.url));

describe('eigene Illustrationen (Entscheidung B)', () => {
  const exerciseIds = readdirSync(exercisesDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''));

  it('jede Übung hat eine Ausgangsposition mit deutschem Alt-Text und Lizenz', () => {
    expect(exerciseIds.length).toBeGreaterThanOrEqual(80);
    for (const id of exerciseIds) {
      const found = exerciseMediaFor(id, 'start_position');
      expect(found, id).not.toBeNull();
      expect(found!.image.alt_de).toMatch(/^Ausgangsposition: /);
      expect(found!.image.origin).toBe('own_work');
      expect(found!.image.license.name).toBe('eigene Illustration Alpha5');
      expect(found!.source.kind).toBe('svg');
    }
  });

  it('illustrationXml setzt hell und dunkel alle Farbmarken ein, ohne externe Verweise', () => {
    const source = exerciseMediaFor('liegestuetz', 'start_position')!.source;
    if (source.kind !== 'svg') throw new Error('SVG erwartet');
    const light = illustrationXml(source.template, 'light');
    const dark = illustrationXml(source.template, 'dark');
    for (const xml of [light, dark]) {
      expect(xml).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 240 180"/);
      expect(xml).not.toMatch(/\{\w+\}/);
      expect(xml).not.toMatch(/href|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
    }
    expect(light).toContain('#262c3a');
    expect(dark).toContain('#e3ebff');
    expect(dark).not.toBe(light);
  });

  it('illustrationXml ersetzt einzelne Rollen (Rand in der Farbe der Fläche)', () => {
    const source = exerciseMediaFor('liegestuetz', 'start_position')!.source;
    if (source.kind !== 'svg') throw new Error('SVG erwartet');
    const xml = illustrationXml(source.template, 'dark', { gap: '#1c2a4d' });
    expect(xml).toContain('#1c2a4d');
    expect(xml).not.toContain('#151922');
    expect(xml).toContain('#e3ebff');
  });
});

describe('exerciseMediaFor', () => {
  const registry: Record<string, ExerciseMediaEntry> = {
    'kniebeuge-langhantel': {
      media: exerciseMediaSchema.parse({
        exercise_id: 'kniebeuge-langhantel',
        images: [
          {
            kind: 'start_position',
            file: 'kniebeuge-langhantel-start.webp',
            alt_de: 'Person steht mit Langhantel auf dem oberen Rücken.',
            origin: 'commissioned',
            license: { name: 'Werkvertrag vom 01.11.2026', attribution_de: null },
            source: { creator: 'Beispiel', obtained_on: '2026-11-01' },
            reviewed_by: null,
          },
        ],
      }),
      sources: { start_position: { kind: 'raster', source: 1 } },
    },
  };

  it('liefert Bild und Quelle, sonst null (keine Anzeige)', () => {
    expect(exerciseMediaFor('kniebeuge-langhantel', 'start_position', registry)?.image.file).toBe(
      'kniebeuge-langhantel-start.webp',
    );
    expect(exerciseMediaFor('liegestuetz', 'start_position', registry)).toBeNull();
    expect(exerciseMediaFor('toString', 'start_position', registry)).toBeNull();
    // Standard-Registry: eigene Illustration als SVG-Vorlage.
    expect(exerciseMediaFor('kniebeuge-langhantel', 'start_position')?.source.kind).toBe('svg');
  });

  it('Zuordnung ohne geladene Bildquelle → null', () => {
    const entry = registry['kniebeuge-langhantel']!;
    expect(
      exerciseMediaFor('kniebeuge-langhantel', 'start_position', {
        x: { media: entry.media, sources: {} },
        'kniebeuge-langhantel': { media: entry.media, sources: {} },
      }),
    ).toBeNull();
  });
});

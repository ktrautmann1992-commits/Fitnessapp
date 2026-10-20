import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { exerciseMediaSchema } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { EXERCISE_MEDIA, type ExerciseMediaEntry, exerciseMediaFor } from './exercise-media';

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
      sources: { start_position: 1 },
    },
  };

  it('liefert Bild und Quelle, sonst null (keine Anzeige)', () => {
    expect(exerciseMediaFor('kniebeuge-langhantel', 'start_position', registry)?.image.file).toBe(
      'kniebeuge-langhantel-start.webp',
    );
    expect(exerciseMediaFor('liegestuetz', 'start_position', registry)).toBeNull();
    expect(exerciseMediaFor('toString', 'start_position', registry)).toBeNull();
    expect(exerciseMediaFor('kniebeuge-langhantel', 'start_position')).toBeNull();
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

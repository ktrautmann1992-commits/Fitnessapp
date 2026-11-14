import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WORKOUT_MEDIA_SIZES, workoutMediaSchema } from '@fitnessapp/core';
import { describe, expect, it, vi } from 'vitest';

/**
 * Workout-Bilder (Barbell Burn, docs/PLAN-BARBELL-BURN.md): die require()-Liste workout-media-registry.ts passt zu
 * content/workout-media (gleiche Workouts, Alt-Text, KI-Hinweis), jede Bilddatei liegt im App-Bündel, hat die
 * erwartete Größe und bleibt klein. Die Liste nutzt require() für Metro und wird deshalb hier als Text geprüft (wie
 * recipe-media.test.ts).
 */
vi.mock('./workout-media-registry', () => ({
  WORKOUT_MEDIA: {
    'mit-bild': {
      alt_de: 'Foto: Mit Bild',
      ai_notice_de: 'KI-Bild, Higgsfield',
      thumbnail: 1,
      banner: 2,
    },
  },
}));

const here = dirname(fileURLToPath(import.meta.url));
const mediaDir = join(here, '../../../../content/workout-media');
const workoutDir = join(here, '../../../../content/workouts');
const assets = join(here, '../../assets/workout-media');
const registry = readFileSync(join(here, 'workout-media-registry.ts'), 'utf8');
const manifests = existsSync(mediaDir)
  ? readdirSync(mediaDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) =>
        workoutMediaSchema.parse(JSON.parse(readFileSync(join(mediaDir, name), 'utf8'))),
      )
  : [];

/** Breite und Höhe einer WebP-Datei (VP8/VP8L/VP8X-Kopf), ohne Zusatzpaket. */
function webpSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  expect(b.toString('ascii', 0, 4)).toBe('RIFF');
  expect(b.toString('ascii', 8, 12)).toBe('WEBP');
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  }
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  // VP8 (verlustbehaftet): Größe nach dem Startcode 9d 01 2a.
  return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
}

describe('WORKOUT_MEDIA (workout-media-registry.ts)', () => {
  it('enthält genau die Workouts aus content/workout-media – mindestens Barbell Burn 60 und 30', () => {
    const ids = [...registry.matchAll(/^ {2}'([a-z0-9-]+)': \{$/gm)].map((m) => m[1]);
    expect(ids.sort()).toEqual(manifests.map((m) => m.workout_id).sort());
    expect(ids).toEqual(expect.arrayContaining(['barbell-burn-60', 'barbell-burn-30']));
  });

  it('jedes zugeordnete Workout gibt es in content/workouts', () => {
    for (const media of manifests) {
      expect(existsSync(join(workoutDir, `${media.workout_id}.json`)), media.workout_id).toBe(true);
    }
  });

  it('je Workout Alt-Text, KI-Hinweis und beide Bilder (eigene Dateien, vorhanden, richtige Größe, klein)', () => {
    for (const media of manifests) {
      const entry = registry.slice(registry.indexOf(`'${media.workout_id}': {`));
      expect(entry).toContain(`'${media.alt_de}'`);
      expect(entry).toContain(`ai_notice_de: '${media.ai_notice_de}'`);
      for (const image of media.images) {
        // Jedes Workout zeigt SEIN Bild (60 → barbell-burn-60-*, 30 → barbell-burn-30-*).
        expect(image.file.startsWith(`${media.workout_id}-`)).toBe(true);
        const key = image.kind === 'thumbnail' ? 'thumbnail' : 'banner';
        expect(entry).toContain(`${key}: require('../../assets/workout-media/${image.file}')`);
        const file = join(assets, image.file);
        expect(existsSync(file), image.file).toBe(true);
        expect(webpSize(file), image.file).toEqual(WORKOUT_MEDIA_SIZES[image.kind]);
        const limit = image.kind === 'thumbnail' ? 30_000 : 120_000;
        expect(readFileSync(file).byteLength, image.file).toBeLessThan(limit);
      }
    }
  });

  it('keine Bilddatei ohne Zuordnung (sonst wächst das App-Bündel unbemerkt)', () => {
    const files = existsSync(assets) ? readdirSync(assets).filter((n) => !n.startsWith('.')) : [];
    const expected = manifests.flatMap((m) => m.images.map((i) => i.file));
    expect(files.sort()).toEqual(expected.sort());
  });
});

describe('workoutImageFor', () => {
  it('liefert das Bild oder null (dann zeigt die App das Workout-Symbol)', async () => {
    const { workoutImageFor } = await import('./workout-media');
    expect(workoutImageFor('mit-bild')?.alt_de).toBe('Foto: Mit Bild');
    expect(workoutImageFor('ohne-bild')).toBeNull();
    // Kein Zugriff über geerbte Eigenschaften.
    expect(workoutImageFor('toString')).toBeNull();
  });
});

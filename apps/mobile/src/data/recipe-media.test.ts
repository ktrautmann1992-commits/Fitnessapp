import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { recipeMediaSchema } from '@fitnessapp/core';
import { describe, expect, it, vi } from 'vitest';

/**
 * Rezeptfotos: das App-Modul recipe-media.generated.ts passt zu content/recipe-media (gleiche Rezepte, Alt-Text,
 * KI-Hinweis), jede Bilddatei liegt im App-Bündel und bleibt klein. Das Modul nutzt require() für Metro und wird
 * deshalb hier als Text geprüft (wie muscle-tiles.test.ts).
 */
vi.mock('./recipe-media.generated', () => ({
  GENERATED_RECIPE_MEDIA: {
    'mit-foto': {
      alt_de: 'Foto: Mit Foto',
      ai_notice_de: 'KI-Bild, Higgsfield',
      thumbnail: 1,
      banner: 2,
    },
  },
}));

const here = dirname(fileURLToPath(import.meta.url));
const mediaDir = join(here, '../../../../content/recipe-media');
const assets = join(here, '../../assets/recipe-media');
const generated = readFileSync(join(here, 'recipe-media.generated.ts'), 'utf8');
const manifests = existsSync(mediaDir)
  ? readdirSync(mediaDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) =>
        recipeMediaSchema.parse(JSON.parse(readFileSync(join(mediaDir, name), 'utf8'))),
      )
  : [];

describe('GENERATED_RECIPE_MEDIA', () => {
  it('enthält genau die Rezepte aus content/recipe-media', () => {
    const ids = [...generated.matchAll(/^ {2}'([a-z0-9-]+)': \{$/gm)].map((m) => m[1]);
    expect(ids.sort()).toEqual(manifests.map((m) => m.recipe_id).sort());
  });

  it('je Rezept Alt-Text, KI-Hinweis und beide Bilder (Datei vorhanden, klein)', () => {
    for (const media of manifests) {
      expect(generated).toContain(`alt_de: ${JSON.stringify(media.alt_de).replace(/"/g, "'")}`);
      expect(media.ai_notice_de).toBe('KI-Bild, Higgsfield');
      for (const image of media.images) {
        expect(generated).toContain(`require('../../assets/recipe-media/${image.file}')`);
        const file = join(assets, image.file);
        expect(existsSync(file), image.file).toBe(true);
        // Vorschaubild ≈ 5 KB, Banner ≈ 50 KB (App-Größe).
        const limit = image.kind === 'thumbnail' ? 20_000 : 120_000;
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

describe('recipeImageFor', () => {
  it('liefert das Foto oder null (dann zeigt die App das Rezept-Symbol)', async () => {
    const { recipeImageFor } = await import('./recipe-media');
    expect(recipeImageFor('mit-foto')?.alt_de).toBe('Foto: Mit Foto');
    expect(recipeImageFor('ohne-foto')).toBeNull();
    // Kein Zugriff über geerbte Eigenschaften.
    expect(recipeImageFor('toString')).toBeNull();
  });
});

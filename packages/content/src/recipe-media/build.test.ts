import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { recipeMediaSchema } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import {
  AI_NOTICE,
  parseAppSelection,
  photoFileByRecipe,
  RECIPE_MEDIA_MODULE,
  recipeMediaFor,
  recipeMediaModule,
  readRecipeMediaFolder,
} from './build';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('photoFileByRecipe (Rezeptbuch-Foto ↔ Rezept-ID)', () => {
  const orders = [
    { rezept: 'Chili sin Carne mit Reis', kapitel: 'vegan', datei: 'chili-sin-carne-mit-reis' },
    { rezept: 'Schoko-Proteinpudding', kapitel: 'vegan', datei: 'vegan-schoko-proteinpudding' },
    { rezept: 'Schoko-Proteinpudding', kapitel: 'fleisch', datei: 'fleisch-schoko-proteinpudding' },
  ];
  const files = new Set(orders.map((o) => o.datei));

  it('Datei = Rezept-ID; doppelter Titel → Datei mit Kapitel-Präfix', () => {
    const r = photoFileByRecipe(
      [
        { id: 'chili-sin-carne-mit-reis', name: 'Chili sin Carne mit Reis', kategorie: 'vegan' },
        { id: 'schoko-proteinpudding', name: 'Schoko-Proteinpudding', kategorie: 'vegan' },
        {
          id: 'schoko-proteinpudding-fleisch',
          name: 'Schoko-Proteinpudding',
          kategorie: 'fleisch',
        },
      ],
      orders,
      files,
    );
    expect(r.problems).toEqual([]);
    expect(Object.fromEntries(r.byRecipe)).toEqual({
      'chili-sin-carne-mit-reis': 'chili-sin-carne-mit-reis',
      'schoko-proteinpudding': 'vegan-schoko-proteinpudding',
      'schoko-proteinpudding-fleisch': 'fleisch-schoko-proteinpudding',
    });
  });

  it('nie raten: kein Foto, falscher Titel, doppelt vergeben → Befund', () => {
    const r = photoFileByRecipe(
      [
        { id: 'gibt-es-nicht', name: 'Neu', kategorie: 'vegan' },
        { id: 'chili-sin-carne-mit-reis', name: 'Anderer Titel', kategorie: 'vegan' },
        { id: 'pudding-a', name: 'Schoko-Proteinpudding', kategorie: 'vegan' },
        { id: 'pudding-b', name: 'Schoko-Proteinpudding', kategorie: 'vegan' },
      ],
      orders,
      files,
    );
    expect(r.problems).toEqual([
      'gibt-es-nicht: kein Foto gefunden.',
      'chili-sin-carne-mit-reis: Foto-Auftrag nennt „Chili sin Carne mit Reis“, Rezept heißt „Anderer Titel“.',
      'pudding-b: Foto „vegan-schoko-proteinpudding“ gehört schon zu pudding-a.',
    ]);
    expect([...r.byRecipe.keys()]).toEqual(['pudding-a']);
  });
});

describe('parseAppSelection', () => {
  it('Liste von IDs oder Objekt mit ids/rezepte (auch {id})', () => {
    expect(parseAppSelection(['a', 'b-c'])).toEqual(['a', 'b-c']);
    expect(parseAppSelection({ ids: ['a'] })).toEqual(['a']);
    expect(parseAppSelection({ rezepte: [{ id: 'x' }] })).toEqual(['x']);
    expect(parseAppSelection([])).toEqual([]);
  });

  it('ungültig → Fehler', () => {
    expect(() => parseAppSelection({})).toThrow('Liste von Rezept-IDs');
    expect(() => parseAppSelection(['Groß'])).toThrow('ungültiger Eintrag');
    expect(() => parseAppSelection(null)).toThrow();
  });
});

describe('recipeMediaFor', () => {
  it('KI-Bild mit Hinweis, Lizenz, Quelle (Rezeptbuch-Datei) und beiden Größen', () => {
    const media = recipeMediaFor(
      { id: 'schoko-proteinpudding', name: 'Schoko-Proteinpudding', kategorie: 'vegan' },
      'vegan-schoko-proteinpudding',
    );
    expect(recipeMediaSchema.parse(media)).toEqual(media);
    expect(media.ai_notice_de).toBe(AI_NOTICE);
    expect(media.source.file).toBe('content/rezeptbuch/fotos/vegan-schoko-proteinpudding.jpg');
    expect(media.images.map((i) => i.file)).toEqual([
      'schoko-proteinpudding-thumb.webp',
      'schoko-proteinpudding-banner.webp',
    ]);
  });
});

describe('eingecheckte Dateien', () => {
  it('App-Modul entspricht den Zuordnungen (sonst: pnpm recipe-media)', async () => {
    const media = readRecipeMediaFolder(repoRoot);
    const expected = await recipeMediaModule(repoRoot, media);
    const full = join(repoRoot, RECIPE_MEDIA_MODULE);
    expect(existsSync(full)).toBe(true);
    expect(readFileSync(full, 'utf8')).toBe(expected);
  });

  it('jede Zuordnung ist so, wie der Generator sie schreibt (Quelle Rezeptbuch, KI-Hinweis)', () => {
    for (const media of readRecipeMediaFolder(repoRoot)) {
      expect(media.ai_notice_de).toBe(AI_NOTICE);
      expect(media.source.file).toMatch(/^content\/rezeptbuch\/fotos\/[a-z0-9-]+\.jpg$/);
    }
  });
});

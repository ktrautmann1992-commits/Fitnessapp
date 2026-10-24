import { describe, expect, it } from 'vitest';

import {
  checkRecipeMediaFiles,
  RECIPE_MEDIA_KINDS,
  RECIPE_MEDIA_SIZES,
  recipeMediaFileName,
  recipeMediaImage,
  recipeMediaSchema,
  type RecipeMediaFile,
} from './recipe-media';

/** Rezeptfotos: Schema, Prüfregel (wie Übungsbilder: ohne Lizenz = blockierend) und Titel-Zuordnung. */

const ID = 'chili-sin-carne-mit-reis';

const media = (overrides: Record<string, unknown> = {}) => ({
  recipe_id: ID,
  alt_de: 'Foto: Chili sin Carne mit Reis',
  origin: 'ai_generated',
  ai_notice_de: 'KI-Bild, Higgsfield',
  license: { name: 'KI-Bild, erzeugt von den Gründern mit Higgsfield', attribution_de: null },
  source: {
    creator: 'Higgsfield (Gründer)',
    file: 'content/rezeptbuch/fotos/chili-sin-carne-mit-reis.jpg',
    obtained_on: '2026-10-23',
  },
  reviewed_by: null,
  images: [
    { kind: 'thumbnail', file: `${ID}-thumb.webp`, width: 160, height: 160 },
    { kind: 'banner', file: `${ID}-banner.webp`, width: 1080, height: 463 },
  ],
  ...overrides,
});

const without = (value: Record<string, unknown>, key: string) =>
  Object.fromEntries(Object.entries(value).filter(([k]) => k !== key));

const ctx = {
  recipeIds: new Set([ID]),
  assetExists: (file: string) => file.startsWith(`${ID}-`),
};
const file = (data: unknown, fileName = `${ID}.json`): RecipeMediaFile => ({ fileName, data });

describe('recipeMediaSchema', () => {
  it('akzeptiert ein KI-Bild mit Hinweis, Lizenz, Quelle und beiden Größen', () => {
    expect(recipeMediaSchema.safeParse(media()).success).toBe(true);
  });

  it('KI-Bild ohne sichtbaren Hinweis ist ein Fehler', () => {
    const r = recipeMediaSchema.safeParse(media({ ai_notice_de: null }));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain('ai_notice_de ist Pflicht');
    // Eigenes Werk braucht keinen KI-Hinweis.
    expect(
      recipeMediaSchema.safeParse(media({ origin: 'own_work', ai_notice_de: null })).success,
    ).toBe(true);
  });

  it('ohne Lizenz → klare Meldung', () => {
    const r = recipeMediaSchema.safeParse(without(media(), 'license'));
    expect(r.error?.issues.map((i) => i.message)).toContain(
      'Lizenzangabe fehlt – Pflicht für jedes Bild (blockierender Fehler).',
    );
  });

  it('beide Bildarten genau einmal, Dateiname aus der Rezept-ID, feste Größen', () => {
    const thumb = { kind: 'thumbnail', file: `${ID}-thumb.webp`, width: 160, height: 160 };
    expect(recipeMediaSchema.safeParse(media({ images: [thumb] })).success).toBe(false);
    expect(recipeMediaSchema.safeParse(media({ images: [thumb, thumb] })).success).toBe(false);
    const wrongName = recipeMediaSchema.safeParse(
      media({
        images: [
          { ...thumb, file: 'anderes-rezept-thumb.webp' },
          { kind: 'banner', file: `${ID}-banner.webp`, width: 1080, height: 463 },
        ],
      }),
    );
    expect(wrongName.error?.issues[0]?.message).toBe(`Dateiname muss „${ID}-thumb.webp“ sein.`);
    const wrongSize = recipeMediaSchema.safeParse(
      media({
        images: [thumb, { kind: 'banner', file: `${ID}-banner.webp`, width: 2688, height: 1152 }],
      }),
    );
    expect(wrongSize.error?.issues[0]?.message).toContain('1080 × 463 px');
    expect(
      recipeMediaSchema.safeParse(media({ images: [{ ...thumb, file: `${ID}-thumb.png` }, thumb] }))
        .success,
    ).toBe(false);
  });

  it('Zielgrößen: quadratisches Vorschaubild, Banner 21:9', () => {
    expect(RECIPE_MEDIA_SIZES.thumbnail.width).toBe(RECIPE_MEDIA_SIZES.thumbnail.height);
    expect(RECIPE_MEDIA_SIZES.banner.width / RECIPE_MEDIA_SIZES.banner.height).toBeCloseTo(
      21 / 9,
      2,
    );
    expect(RECIPE_MEDIA_KINDS.map((k) => recipeMediaFileName('x-y', k))).toEqual([
      'x-y-thumb.webp',
      'x-y-banner.webp',
    ]);
  });
});

describe('checkRecipeMediaFiles', () => {
  it('gültige Datei → keine Befunde', () => {
    expect(checkRecipeMediaFiles([file(media())], ctx)).toEqual([]);
  });

  it('kaputtes JSON, falscher Dateiname, unbekanntes Rezept, fehlende Bilddatei', () => {
    expect(checkRecipeMediaFiles([{ fileName: `${ID}.json`, jsonError: 'x' }], ctx)[0]).toContain(
      'kein gültiges JSON',
    );
    expect(checkRecipeMediaFiles([file(media(), 'falsch.json')], ctx)).toEqual([
      `recipe-media/falsch.json: Dateiname muss der Rezept-ID entsprechen („${ID}.json“).`,
    ]);
    expect(checkRecipeMediaFiles([file(media())], { recipeIds: new Set() })).toEqual([
      `recipe-media/${ID}.json: Rezept „${ID}“ gibt es nicht.`,
    ]);
    expect(
      checkRecipeMediaFiles([file(media())], {
        ...ctx,
        assetExists: (f) => f.endsWith('thumb.webp'),
      }),
    ).toEqual([
      `recipe-media/${ID}.json: Bilddatei apps/mobile/assets/recipe-media/${ID}-banner.webp fehlt.`,
    ]);
    expect(checkRecipeMediaFiles([file(without(media(), 'license'))], ctx)[0]).toContain(
      'license: Lizenzangabe fehlt',
    );
  });
});

describe('recipeMediaImage', () => {
  it('liefert die Bildart oder null (dann zeigt die App das Rezept-Symbol)', () => {
    const parsed = recipeMediaSchema.parse(media());
    expect(recipeMediaImage(parsed, 'banner')?.file).toBe(`${ID}-banner.webp`);
    expect(recipeMediaImage(null, 'thumbnail')).toBeNull();
    expect(recipeMediaImage(undefined, 'banner')).toBeNull();
  });
});

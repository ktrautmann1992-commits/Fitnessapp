import { describe, expect, it } from 'vitest';

import {
  checkWorkoutMediaFiles,
  WORKOUT_MEDIA_KINDS,
  WORKOUT_MEDIA_SIZES,
  workoutMediaFileName,
  workoutMediaSchema,
  type WorkoutMediaFile,
} from './workout-media';

/** Workout-Bilder (Barbell Burn, 14.11.2026): Schema und Prüfregel wie bei den Rezeptfotos. */

const ID = 'barbell-burn-60';

const media = (overrides: Record<string, unknown> = {}) => ({
  workout_id: ID,
  alt_de: 'Foto: Gruppe beim Training mit leichter Langhantel',
  origin: 'ai_generated',
  ai_notice_de: 'KI-Bild, Higgsfield',
  license: { name: 'KI-Bild, erzeugt von den Gründern mit Higgsfield', attribution_de: null },
  source: { creator: 'Higgsfield (Gründer)', obtained_on: '2026-11-14' },
  reviewed_by: null,
  images: [
    { kind: 'thumbnail', file: `${ID}-thumb.webp`, width: 320, height: 320 },
    { kind: 'banner', file: `${ID}-banner.webp`, width: 1080, height: 463 },
  ],
  ...overrides,
});

const ctx = {
  workoutIds: new Set([ID]),
  assetExists: (file: string) => file.startsWith(`${ID}-`),
};
const file = (data: unknown, fileName = `${ID}.json`): WorkoutMediaFile => ({ fileName, data });

describe('workoutMediaSchema', () => {
  it('akzeptiert ein KI-Bild mit Hinweis, Lizenz, Quelle und beiden Größen', () => {
    expect(workoutMediaSchema.safeParse(media()).success).toBe(true);
  });

  it('KI-Bild ohne sichtbaren Hinweis ist ein Fehler; eigenes Werk braucht keinen', () => {
    const r = workoutMediaSchema.safeParse(media({ ai_notice_de: null }));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain('ai_notice_de ist Pflicht');
    expect(
      workoutMediaSchema.safeParse(media({ origin: 'own_work', ai_notice_de: null })).success,
    ).toBe(true);
  });

  it('falscher Dateiname, falsche Größe und doppelte Bildart sind Fehler', () => {
    const wrongName = workoutMediaSchema.safeParse(
      media({
        images: [
          { kind: 'thumbnail', file: 'anderes-thumb.webp', width: 320, height: 320 },
          { kind: 'banner', file: `${ID}-banner.webp`, width: 1080, height: 463 },
        ],
      }),
    );
    expect(wrongName.error?.issues.map((i) => i.message)).toContain(
      `Dateiname muss „${ID}-thumb.webp“ sein.`,
    );
    const wrongSize = workoutMediaSchema.safeParse(
      media({
        images: [
          { kind: 'thumbnail', file: `${ID}-thumb.webp`, width: 160, height: 160 },
          { kind: 'banner', file: `${ID}-banner.webp`, width: 1080, height: 463 },
        ],
      }),
    );
    expect(wrongSize.success).toBe(false);
    const twice = workoutMediaSchema.safeParse(
      media({
        images: [
          { kind: 'banner', file: `${ID}-banner.webp`, width: 1080, height: 463 },
          { kind: 'banner', file: `${ID}-banner.webp`, width: 1080, height: 463 },
        ],
      }),
    );
    expect(twice.success).toBe(false);
  });

  it('Größen und Dateinamen je Bildart', () => {
    expect(WORKOUT_MEDIA_KINDS).toEqual(['thumbnail', 'banner']);
    expect(WORKOUT_MEDIA_SIZES.thumbnail).toEqual({ width: 320, height: 320 });
    expect(WORKOUT_MEDIA_SIZES.banner.width / WORKOUT_MEDIA_SIZES.banner.height).toBeCloseTo(
      21 / 9,
      1,
    );
    expect(workoutMediaFileName('barbell-burn-30', 'banner')).toBe('barbell-burn-30-banner.webp');
    expect(workoutMediaFileName('barbell-burn-30', 'thumbnail')).toBe('barbell-burn-30-thumb.webp');
  });
});

describe('checkWorkoutMediaFiles', () => {
  it('gültige Zuordnung → keine Befunde', () => {
    expect(checkWorkoutMediaFiles([file(media())], ctx)).toEqual([]);
  });

  it('kaputtes JSON, falscher Dateiname, unbekanntes Workout und fehlende Bilddatei werden gemeldet', () => {
    expect(checkWorkoutMediaFiles([{ fileName: 'x.json', jsonError: 'Unexpected' }], ctx)).toEqual([
      'workout-media/x.json: kein gültiges JSON (Unexpected).',
    ]);
    expect(checkWorkoutMediaFiles([file(media(), 'anders.json')], ctx)[0]).toContain(
      'Dateiname muss der Workout-ID entsprechen',
    );
    expect(
      checkWorkoutMediaFiles([file(media())], { ...ctx, workoutIds: new Set<string>() }),
    ).toEqual([`workout-media/${ID}.json: Workout „${ID}“ gibt es nicht.`]);
    expect(
      checkWorkoutMediaFiles([file(media())], { ...ctx, assetExists: () => false }),
    ).toHaveLength(2);
  });

  it('Schemafehler mit Pfad (z. B. fehlende Lizenz)', () => {
    const { license: _license, ...noLicense } = media();
    const problems = checkWorkoutMediaFiles([file(noLicense)], ctx);
    expect(problems.some((p) => p.startsWith(`workout-media/${ID}.json: license`))).toBe(true);
  });
});

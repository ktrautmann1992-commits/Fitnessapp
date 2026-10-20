import { describe, expect, it } from 'vitest';

import {
  checkExerciseMediaFiles,
  exerciseMediaImage,
  exerciseMediaSchema,
  type ExerciseMediaFile,
} from './exercise-media';

/** Übungsbilder „Ausgangsposition“: Schema und Prüfregel (Bild ohne Lizenz = blockierender Fehler). */

const image = (overrides: Record<string, unknown> = {}) => ({
  kind: 'start_position',
  file: 'kniebeuge-langhantel-start.webp',
  alt_de: 'Person steht mit Langhantel auf dem oberen Rücken, Füße schulterbreit.',
  origin: 'licensed_library',
  license: {
    name: 'Lizenzvertrag Beispielanbieter vom 01.11.2026',
    attribution_de: null,
  },
  source: { creator: 'Beispielanbieter', obtained_on: '2026-11-01' },
  reviewed_by: null,
  ...overrides,
});

/** Kopie ohne ein Feld. */
const without = (value: Record<string, unknown>, key: string) =>
  Object.fromEntries(Object.entries(value).filter(([k]) => k !== key));

const media = (images: unknown[] = [image()], id = 'kniebeuge-langhantel') => ({
  exercise_id: id,
  images,
});

const ctx = {
  exerciseIds: new Set(['kniebeuge-langhantel']),
  assetExists: (file: string) => file === 'kniebeuge-langhantel-start.webp',
};

const file = (data: unknown, fileName = 'kniebeuge-langhantel.json'): ExerciseMediaFile => ({
  fileName,
  data,
});

describe('exerciseMediaSchema', () => {
  it('akzeptiert ein vollständiges Bild mit Lizenz und Quelle', () => {
    expect(exerciseMediaSchema.safeParse(media()).success).toBe(true);
  });

  it('Bild ohne Lizenzangabe ist ein Fehler mit klarer Meldung', () => {
    const withoutLicense = without(image(), 'license');
    const result = exerciseMediaSchema.safeParse(media([withoutLicense]));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('Lizenzangabe fehlt');
  });

  it('leerer Lizenzname oder fehlende Quelle sind Fehler', () => {
    expect(
      exerciseMediaSchema.safeParse(media([image({ license: { name: '', attribution_de: null } })]))
        .success,
    ).toBe(false);
    const withoutSource = without(image(), 'source');
    expect(exerciseMediaSchema.safeParse(media([withoutSource])).success).toBe(false);
  });

  it('KI-Bild braucht eine fachliche Prüfung', () => {
    const result = exerciseMediaSchema.safeParse(media([image({ origin: 'ai_generated' })]));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('fachliche');
    expect(
      exerciseMediaSchema.safeParse(
        media([image({ origin: 'ai_generated', reviewed_by: 'Karsten' })]),
      ).success,
    ).toBe(true);
  });

  it('Bildart höchstens einmal, keine leere Liste, nur erlaubte Dateinamen und https-Links', () => {
    expect(exerciseMediaSchema.safeParse(media([image(), image()])).success).toBe(false);
    expect(exerciseMediaSchema.safeParse(media([])).success).toBe(false);
    expect(exerciseMediaSchema.safeParse(media([image({ file: 'Bild 1.gif' })])).success).toBe(
      false,
    );
    expect(
      exerciseMediaSchema.safeParse(
        media([
          image({
            license: { name: 'CC BY 4.0', url: 'http://example.org', attribution_de: null },
          }),
        ]),
      ).success,
    ).toBe(false);
  });
});

describe('checkExerciseMediaFiles', () => {
  it('keine Dateien → keine Befunde', () => {
    expect(checkExerciseMediaFiles([], ctx)).toEqual([]);
  });

  it('gültige Zuordnung → keine Befunde', () => {
    expect(checkExerciseMediaFiles([file(media())], ctx)).toEqual([]);
  });

  it('fehlende Lizenz → blockierender Befund mit Pfad', () => {
    const withoutLicense = without(image(), 'license');
    const problems = checkExerciseMediaFiles([file(media([withoutLicense]))], ctx);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(
      /^exercise-media\/kniebeuge-langhantel\.json: images\.0\.license: Lizenzangabe fehlt/,
    );
  });

  it('kaputtes JSON, falscher Dateiname, unbekannte Übung, fehlende Bilddatei', () => {
    expect(
      checkExerciseMediaFiles([{ fileName: 'x.json', jsonError: 'Unexpected token' }], ctx)[0],
    ).toContain('kein gültiges JSON');
    expect(checkExerciseMediaFiles([file(media(), 'anders.json')], ctx)[0]).toContain(
      'Dateiname muss der Übungs-ID entsprechen',
    );
    const unknown = checkExerciseMediaFiles(
      [file(media(undefined, 'gibt-es-nicht'), 'gibt-es-nicht.json')],
      ctx,
    );
    expect(unknown).toEqual([
      'exercise-media/gibt-es-nicht.json: Übung „gibt-es-nicht“ gibt es nicht.',
    ]);
    const missingAsset = checkExerciseMediaFiles(
      [file(media([image({ file: 'fehlt.webp' })]))],
      ctx,
    );
    expect(missingAsset[0]).toContain('apps/mobile/assets/exercise-media/fehlt.webp fehlt');
  });

  it('ohne assetExists wird die Bilddatei nicht geprüft', () => {
    expect(
      checkExerciseMediaFiles([file(media([image({ file: 'fehlt.webp' })]))], {
        exerciseIds: ctx.exerciseIds,
      }),
    ).toEqual([]);
  });
});

describe('exerciseMediaImage', () => {
  it('liefert das Bild der Art oder null', () => {
    const parsed = exerciseMediaSchema.parse(media());
    expect(exerciseMediaImage(parsed, 'start_position')?.file).toBe(
      'kniebeuge-langhantel-start.webp',
    );
    expect(exerciseMediaImage(null, 'start_position')).toBeNull();
    expect(exerciseMediaImage(undefined, 'start_position')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import {
  checkExercisePhotoManifest,
  EXERCISE_PHOTO_FORMAT,
  exercisePhotoManifestSchema,
} from './exercise-photos';

/** Übungsfotos (docs/UEBUNGSFOTOS.md): Manifest-Schema und Prüfregel. */

const entry = (overrides: Record<string, unknown> = {}) => ({
  start: 'https://cdn.example.com/a/start.png',
  end: 'https://cdn.example.com/a/end.png',
  job_start: '0f8fad5b-d9cb-469f-a165-70867728950e',
  job_end: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  ...overrides,
});
const ids = new Set(['liegestuetz', 'kniebeuge-koerpergewicht']);

describe('exercisePhotoManifestSchema', () => {
  it('akzeptiert ein leeres Manifest und gültige Einträge', () => {
    expect(exercisePhotoManifestSchema.safeParse({}).success).toBe(true);
    expect(exercisePhotoManifestSchema.safeParse({ liegestuetz: entry() }).success).toBe(true);
  });

  it('lehnt http, fehlende Felder, Zusatzfelder, kaputte UUIDs und ungültige IDs ab', () => {
    const bad = [
      { liegestuetz: entry({ start: 'http://cdn.example.com/a.png' }) },
      { liegestuetz: entry({ end: 'ftp://cdn.example.com/a.png' }) },
      { liegestuetz: entry({ end: 'keine adresse' }) },
      { liegestuetz: { start: entry().start, end: entry().end, job_start: entry().job_start } },
      { liegestuetz: entry({ extra: 1 }) },
      { liegestuetz: entry({ job_end: 'abc' }) },
      { 'Liegestütz!': entry() },
      [],
      null,
    ];
    for (const data of bad) expect(exercisePhotoManifestSchema.safeParse(data).success).toBe(false);
  });
});

describe('checkExercisePhotoManifest', () => {
  it('leer bei gültigem Manifest mit bekannten Übungen', () => {
    expect(checkExercisePhotoManifest({}, ids)).toEqual([]);
    expect(checkExercisePhotoManifest({ liegestuetz: entry() }, ids)).toEqual([]);
  });

  it('meldet unbekannte Übungen und gleiche Adressen', () => {
    const problems = checkExercisePhotoManifest(
      { 'gibt-es-nicht': entry(), liegestuetz: entry({ end: entry().start }) },
      ids,
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/„gibt-es-nicht“ gibt es nicht/);
    expect(problems[1]).toMatch(/liegestuetz: Start- und Endbild haben dieselbe Adresse/);
  });

  it('meldet Schemafehler mit Pfad', () => {
    const problems = checkExercisePhotoManifest(
      { liegestuetz: entry({ start: 'http://x.example.com/a.png' }) },
      ids,
    );
    expect(problems).toEqual([expect.stringMatching(/liegestuetz\.start: Adresse muss mit https/)]);
  });
});

describe('EXERCISE_PHOTO_FORMAT', () => {
  it('4:3, 640×480, höchstens 45 KB', () => {
    expect(EXERCISE_PHOTO_FORMAT.width / EXERCISE_PHOTO_FORMAT.height).toBeCloseTo(4 / 3);
    expect(EXERCISE_PHOTO_FORMAT.maxBytes).toBe(46080);
  });
});

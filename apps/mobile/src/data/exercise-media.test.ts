import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { exerciseMediaSchema } from '@fitnessapp/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { GENERATED_ILLUSTRATIONS } from './exercise-illustrations.generated';
import {
  type ExerciseMediaEntry,
  exerciseMediaFor,
  exerciseMediaRegistry,
  illustrationXml,
  loadExerciseMedia,
  registryFrom,
} from './exercise-media';
import { EXERCISE_PHOTOS } from './exercise-photo-registry.generated';

/** Foto (docs/UEBUNGSFOTOS.md) oder eigene Illustration – beides gilt als Übungsbild. */
const PICTURE = /^(svg|photo)$/;

/** Übungsbilder: Registry der App passt zu content/exercise-media; Anzeige nur, wenn ein Bild da ist. */

const mediaDir = fileURLToPath(new URL('../../../../content/exercise-media/', import.meta.url));

describe('Übungsbilder werden erst bei Bedarf geladen (Leistung)', () => {
  it('vor dem Laden: leere Registry, kein Bild', () => {
    expect(exerciseMediaRegistry()).toEqual({});
    expect(exerciseMediaFor('liegestuetz', 'start_position')).toBeNull();
  });

  it('nach dem Laden: alle Bilder; weitere Aufrufe laden nicht erneut', async () => {
    const first = loadExerciseMedia();
    expect(loadExerciseMedia()).toBe(first);
    const registry = await first;
    expect(exerciseMediaRegistry()).toBe(registry);
    expect(exerciseMediaFor('liegestuetz', 'start_position')?.source.kind).toMatch(PICTURE);
  });
});

describe('Registry', () => {
  beforeAll(loadExerciseMedia);
  const EXERCISE_MEDIA = () => exerciseMediaRegistry();

  it('stimmt mit content/exercise-media überein (gleiche Übungen, gleiche Angaben inkl. Lizenz)', () => {
    const files = existsSync(mediaDir)
      ? readdirSync(mediaDir).filter((name) => name.endsWith('.json'))
      : [];
    expect(Object.keys(EXERCISE_MEDIA()).sort()).toEqual(
      files.map((name) => name.replace(/\.json$/, '')).sort(),
    );
    for (const name of files) {
      const data = exerciseMediaSchema.parse(
        JSON.parse(readFileSync(`${mediaDir}${name}`, 'utf8')),
      );
      const entry = EXERCISE_MEDIA()[data.exercise_id];
      expect(entry?.media).toEqual(data);
      for (const image of data.images) expect(entry?.sources[image.kind]).toBeDefined();
    }
  });
});

const exercisesDir = fileURLToPath(new URL('../../../../content/exercises/', import.meta.url));

describe('eigene Illustrationen (Entscheidung B)', () => {
  beforeAll(loadExerciseMedia);
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
      // Foto, wo eins da ist, sonst die Illustration.
      expect(found!.source.kind, id).toBe(Object.hasOwn(EXERCISE_PHOTOS, id) ? 'photo' : 'svg');
    }
  });

  it('Endposition (Workout-Player): jede Übung eines Workouts hat Start- und Endbild', () => {
    const end = exerciseMediaFor('liegestuetz', 'end_position');
    expect(end?.image.alt_de).toMatch(/^Endposition: /);
    expect(end?.source.kind).toMatch(PICTURE);
    const workoutsDir = fileURLToPath(new URL('../../../../content/workouts/', import.meta.url));
    const used = new Set<string>();
    for (const name of readdirSync(workoutsDir).filter((n) => n.endsWith('.json'))) {
      const workout = JSON.parse(readFileSync(`${workoutsDir}${name}`, 'utf8')) as {
        exercises: { exercise_id: string }[];
      };
      for (const item of workout.exercises) used.add(item.exercise_id);
    }
    expect(used.size).toBeGreaterThan(100);
    // Endbild als Foto oder Illustration – aber immer dieselbe Art wie das Startbild.
    const missing = [...used].filter((id) => {
      const end = exerciseMediaFor(id, 'end_position');
      return (
        end === null || end.source.kind !== exerciseMediaFor(id, 'start_position')?.source.kind
      );
    });
    expect(missing).toEqual([]);
    // Übungen ohne Workout dürfen (noch) ohne Endbild sein → statisches Startbild.
    expect(exerciseMediaFor('bankdruecken-langhantel', 'end_position')).toBeNull();
  });

  // Vorlage direkt aus den Illustrationen (in der Registry kann ein Foto an ihrer Stelle stehen).
  const template = GENERATED_ILLUSTRATIONS['liegestuetz']!.templates.start_position;

  it('illustrationXml setzt hell und dunkel alle Farbmarken ein, ohne externe Verweise', () => {
    const light = illustrationXml(template, 'light');
    const dark = illustrationXml(template, 'dark');
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
    const xml = illustrationXml(template, 'dark', { gap: '#1c2a4d' });
    expect(xml).toContain('#1c2a4d');
    expect(xml).not.toContain('#151922');
    expect(xml).toContain('#e3ebff');
  });
});

describe('exerciseMediaFor', () => {
  beforeAll(loadExerciseMedia);
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
    // Standard-Registry: Foto oder eigene Illustration als SVG-Vorlage.
    expect(exerciseMediaFor('kniebeuge-langhantel', 'start_position')?.source.kind).toMatch(
      PICTURE,
    );
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

describe('Übungsfotos: Foto vor Illustration (docs/UEBUNGSFOTOS.md)', () => {
  const pick = <K extends string>(keys: readonly K[]) =>
    Object.fromEntries(keys.map((k) => [k, GENERATED_ILLUSTRATIONS[k]!]));
  // Liegestütz hat eine Endposition, Bankdrücken mit Langhantel (noch) nicht.
  const illustrations = pick(['liegestuetz', 'bankdruecken-langhantel', 'kniebeuge-langhantel']);
  const photos = {
    liegestuetz: { start: { uri: 'l-start.webp' }, end: { uri: 'l-end.webp' } },
    'bankdruecken-langhantel': { start: { uri: 'b-start.webp' }, end: { uri: 'b-end.webp' } },
    'gibt-es-nicht': { start: { uri: 'x-start.webp' }, end: { uri: 'x-end.webp' } },
  };
  const registry = registryFrom(illustrations, photos);

  it('Foto vorhanden → Start und Ende als Foto, Alt-Text aus der Illustration', () => {
    const start = exerciseMediaFor('liegestuetz', 'start_position', registry);
    expect(start?.source).toEqual({ kind: 'photo', source: { uri: 'l-start.webp' } });
    expect(start?.image.alt_de).toMatch(/^Ausgangsposition: /);
    expect(exerciseMediaFor('liegestuetz', 'end_position', registry)?.source).toEqual({
      kind: 'photo',
      source: { uri: 'l-end.webp' },
    });
  });

  it('kein Foto → Illustration (SVG) für Start und Ende', () => {
    expect(exerciseMediaFor('kniebeuge-langhantel', 'start_position', registry)?.source.kind).toBe(
      'svg',
    );
    expect(registryFrom(illustrations)['liegestuetz']?.sources.end_position?.kind).toBe('svg');
  });

  it('Übung ohne Endposition: nur das Startfoto (statisch), nie Foto und Strichfigur gemischt', () => {
    expect(
      exerciseMediaFor('bankdruecken-langhantel', 'start_position', registry)?.source.kind,
    ).toBe('photo');
    expect(exerciseMediaFor('bankdruecken-langhantel', 'end_position', registry)).toBeNull();
  });

  it('Foto ohne bekannte Übung wird ignoriert', () => {
    expect(Object.keys(registry).sort()).toEqual(Object.keys(illustrations).sort());
    expect(exerciseMediaFor('gibt-es-nicht', 'start_position', registry)).toBeNull();
  });
});

describe('Übungsfotos: Zuordnung passt zu den Dateien (exercise-photo-registry.generated.ts)', () => {
  const photoDir = fileURLToPath(new URL('../../assets/exercise-photos/', import.meta.url));

  it('jede Übung mit Start- und Endfoto steht in der Zuordnung und umgekehrt', () => {
    const files = existsSync(photoDir) ? readdirSync(photoDir) : [];
    const pairs = files
      .filter((name) => name.endsWith('-start.webp'))
      .map((name) => name.replace(/-start\.webp$/, ''))
      .filter((id) => files.includes(`${id}-end.webp`))
      .sort();
    expect(Object.keys(EXERCISE_PHOTOS).sort()).toEqual(pairs);
    for (const id of pairs) expect(Object.hasOwn(GENERATED_ILLUSTRATIONS, id), id).toBe(true);
  });

  it('die Fotos liegen nicht im Start-Bundle: nur exercise-media.ts lädt die Zuordnung per import()', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./exercise-media.ts', import.meta.url)),
      'utf8',
    );
    expect(source).toContain("import('./exercise-photo-registry.generated')");
    expect(source).not.toMatch(/^import \{[^}]*\} from '\.\/exercise-photo-registry\.generated'/m);
  });
});

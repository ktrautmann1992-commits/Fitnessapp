import { describe, expect, it } from 'vitest';

import { MUSCLE_GROUPS } from '../enums';
import type { PlanLibrary } from '../plan/content-pool';
import { repoLibrary } from '../plan/test-library';
import { glossarySearchOptionsSchema, searchExercises } from './glossary';
import {
  exerciseMuscleTiles,
  MUSCLE_TILE_IDS,
  MUSCLE_TILES,
  muscleTileRole,
  parseMuscleTileId,
  sessionMuscleTiles,
} from './muscle-tiles';
import { makeExercise } from './test-fixtures';

/** Muskelgruppen-Kacheln im Glossar (Gründer-Wunsch 22.10.2026). */

const lib = (...exercises: ReturnType<typeof makeExercise>[]): Pick<PlanLibrary, 'exercises'> => ({
  exercises: new Map(exercises.map((e) => [e.id, e])),
});

describe('MUSCLE_TILES', () => {
  it('jede Muskelgruppe gehört zu mindestens einer Kachel', () => {
    const covered = new Set(Object.values(MUSCLE_TILES).flat());
    for (const muscle of MUSCLE_GROUPS) expect(covered.has(muscle), muscle).toBe(true);
  });

  it('jede Kachel hat mindestens eine Muskelgruppe und eine eindeutige ID', () => {
    expect(new Set(MUSCLE_TILE_IDS).size).toBe(MUSCLE_TILE_IDS.length);
    for (const id of MUSCLE_TILE_IDS) expect(MUSCLE_TILES[id].length).toBeGreaterThan(0);
  });
});

describe('parseMuscleTileId', () => {
  it('akzeptiert nur bekannte IDs', () => {
    expect(parseMuscleTileId('brust')).toBe('brust');
    expect(parseMuscleTileId('unterer-ruecken')).toBe('unterer-ruecken');
    expect(parseMuscleTileId('Brust')).toBeNull();
    expect(parseMuscleTileId('')).toBeNull();
    expect(parseMuscleTileId(undefined)).toBeNull();
    expect(parseMuscleTileId(['brust'])).toBeNull();
    expect(parseMuscleTileId('__proto__')).toBeNull();
  });
});

describe('muscleTileRole', () => {
  const ex = makeExercise({
    primary_muscles: ['chest'],
    secondary_muscles: ['triceps', 'front_delts'],
  });

  it('Hauptmuskel → primary, Nebenmuskel → secondary, sonst null', () => {
    expect(muscleTileRole(ex, 'brust')).toBe('primary');
    expect(muscleTileRole(ex, 'trizeps')).toBe('secondary');
    expect(muscleTileRole(ex, 'schultern')).toBe('secondary');
    expect(muscleTileRole(ex, 'waden')).toBeNull();
  });

  it('Hauptmuskel hat Vorrang, wenn die Kachel Haupt- und Nebenmuskel trifft', () => {
    const row = makeExercise({ primary_muscles: ['lats'], secondary_muscles: ['upper_back'] });
    expect(muscleTileRole(row, 'ruecken-oben')).toBe('primary');
    expect(muscleTileRole(row, 'nacken')).toBe('secondary');
  });
});

describe('searchExercises mit Muskelgruppe', () => {
  const bank = makeExercise({
    id: 'bank',
    name_de: 'Bankdrücken',
    movement_pattern: 'horizontal_push',
    primary_muscles: ['chest'],
    secondary_muscles: ['triceps'],
  });
  const dips = makeExercise({
    id: 'dips',
    name_de: 'Dips',
    movement_pattern: 'elbow_extension',
    primary_muscles: ['triceps'],
    secondary_muscles: ['chest'],
  });
  const squat = makeExercise({ id: 'squat', name_de: 'Kniebeuge' });

  it('zeigt nur passende Übungen, Hauptmuskel vor „unterstützend“', () => {
    const hits = searchExercises(lib(squat, dips, bank), { muscleTile: 'trizeps' });
    expect(hits.map((h) => [h.exercise.id, h.muscleRole])).toEqual([
      ['dips', 'primary'],
      ['bank', 'secondary'],
    ]);
  });

  it('ohne Kachel bleibt alles wie bisher (muscleRole null)', () => {
    const hits = searchExercises(lib(squat, dips, bank), {});
    expect(hits).toHaveLength(3);
    expect(hits.every((h) => h.muscleRole === null)).toBe(true);
  });

  it('kombiniert mit Suchwort und weiteren Filtern', () => {
    expect(
      searchExercises(lib(squat, dips, bank), { muscleTile: 'brust', query: 'dips' }),
    ).toHaveLength(1);
    expect(
      searchExercises(lib(squat, dips, bank), { muscleTile: 'brust', groups: ['legs'] }),
    ).toHaveLength(0);
  });

  it('Kachel ohne passende Übung → leere Liste, keine Ausnahme', () => {
    expect(searchExercises(lib(squat), { muscleTile: 'unterarme' })).toEqual([]);
    expect(searchExercises(null, { muscleTile: 'brust' })).toEqual([]);
  });

  it('Schema lässt nur bekannte Kacheln zu', () => {
    expect(glossarySearchOptionsSchema.safeParse({ muscleTile: 'brust' }).success).toBe(true);
    expect(glossarySearchOptionsSchema.safeParse({ muscleTile: null }).success).toBe(true);
    expect(glossarySearchOptionsSchema.safeParse({ muscleTile: 'po' }).success).toBe(false);
  });
});

describe('echter Inhaltsstand', () => {
  it('jede Kachel findet mindestens eine Übung (Haupt- oder Nebenmuskel)', () => {
    const repo = repoLibrary();
    for (const tile of MUSCLE_TILE_IDS) {
      expect(searchExercises(repo, { muscleTile: tile }).length, tile).toBeGreaterThan(0);
    }
  });
});

describe('exerciseMuscleTiles (Übungsseite)', () => {
  it('Hauptmuskeln zuerst, dann unterstützend, in Kachel-Reihenfolge', () => {
    const ex = makeExercise({
      primary_muscles: ['triceps', 'chest'],
      secondary_muscles: ['front_delts', 'chest'],
    });
    expect(exerciseMuscleTiles(ex)).toEqual([
      { tile: 'brust', role: 'primary' },
      { tile: 'trizeps', role: 'primary' },
      { tile: 'schultern', role: 'secondary' },
    ]);
  });

  it('„Nacken“ entfällt neben „Oberer Rücken“ mit gleicher oder stärkerer Rolle', () => {
    expect(
      exerciseMuscleTiles(makeExercise({ primary_muscles: ['upper_back'], secondary_muscles: [] })),
    ).toEqual([{ tile: 'ruecken-oben', role: 'primary' }]);
    expect(
      exerciseMuscleTiles(
        makeExercise({ primary_muscles: ['lats'], secondary_muscles: ['upper_back'] }),
      ),
    ).toEqual([{ tile: 'ruecken-oben', role: 'primary' }]);
  });

  it('ohne Muskeln → leer', () => {
    expect(
      exerciseMuscleTiles(makeExercise({ primary_muscles: [], secondary_muscles: [] })),
    ).toEqual([]);
  });

  it('echter Inhaltsstand: jede Übung hat mindestens eine Kachel', () => {
    for (const ex of repoLibrary().exercises.values()) {
      expect(exerciseMuscleTiles(ex).length, ex.id).toBeGreaterThan(0);
    }
  });
});

describe('sessionMuscleTiles (Übungsliste der Einheit)', () => {
  const squat = makeExercise({
    id: 'squat',
    primary_muscles: ['quadriceps', 'glutes'],
    secondary_muscles: ['lower_back', 'adductors'],
  });
  const bench = makeExercise({
    id: 'bench',
    primary_muscles: ['chest'],
    secondary_muscles: ['front_delts', 'triceps'],
  });
  const pushdown = makeExercise({
    id: 'pushdown',
    primary_muscles: ['triceps'],
    secondary_muscles: [],
  });

  it('leere Einheit → leer', () => {
    expect(sessionMuscleTiles([])).toEqual([]);
  });

  it('unbekannte Übungen (null/undefined) werden übersprungen, kein Absturz', () => {
    expect(sessionMuscleTiles([null, undefined])).toEqual([]);
    expect(sessionMuscleTiles([null, pushdown, undefined])).toEqual([
      { tile: 'trizeps', role: 'primary' },
    ]);
  });

  it('Hauptmuskel gewinnt über unterstützend – egal in welcher Reihenfolge', () => {
    const expected = [
      { tile: 'brust', role: 'primary' },
      { tile: 'trizeps', role: 'primary' },
      { tile: 'schultern', role: 'secondary' },
    ];
    expect(sessionMuscleTiles([bench, pushdown])).toEqual(expected);
    expect(sessionMuscleTiles([pushdown, bench])).toEqual(expected);
  });

  it('doppelte Muskeln erscheinen nur einmal', () => {
    expect(sessionMuscleTiles([bench, bench, pushdown, pushdown])).toEqual(
      sessionMuscleTiles([bench, pushdown]),
    );
  });

  it('stabile Reihenfolge: Hauptmuskeln, dann unterstützend, je in Kachel-Reihenfolge', () => {
    expect(sessionMuscleTiles([squat, bench])).toEqual([
      { tile: 'brust', role: 'primary' },
      { tile: 'gesaess', role: 'primary' },
      { tile: 'oberschenkel-vorne', role: 'primary' },
      { tile: 'schultern', role: 'secondary' },
      { tile: 'unterer-ruecken', role: 'secondary' },
      { tile: 'trizeps', role: 'secondary' },
      { tile: 'adduktoren', role: 'secondary' },
    ]);
  });

  it('„Nacken“ entfällt auch über Übungen hinweg neben „Oberer Rücken“', () => {
    const shrug = makeExercise({ primary_muscles: ['upper_back'], secondary_muscles: [] });
    const row = makeExercise({ primary_muscles: ['lats'], secondary_muscles: [] });
    expect(sessionMuscleTiles([shrug, row])).toEqual([{ tile: 'ruecken-oben', role: 'primary' }]);
  });

  it('Übung ohne Muskeln trägt nichts bei', () => {
    const none = makeExercise({ primary_muscles: [], secondary_muscles: [] });
    expect(sessionMuscleTiles([none])).toEqual([]);
  });

  it('echter Inhaltsstand: alle Übungen zusammen ergeben jede Kachel höchstens einmal', () => {
    const tiles = sessionMuscleTiles([...repoLibrary().exercises.values()]);
    expect(new Set(tiles.map((t) => t.tile)).size).toBe(tiles.length);
    expect(tiles.length).toBeGreaterThan(0);
  });
});

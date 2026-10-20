import { describe, expect, it } from 'vitest';

import { MUSCLE_GROUPS } from '../enums';
import { loadRepoContentFiles } from '../plan/test-library';
import { muscleNameDe } from './checks';
import {
  MUSCLE_MAP_REGIONS,
  MUSCLE_MAP_VIEWS,
  muscleMapHighlights,
  muscleMapRegions,
} from './muscle-map';
import { exerciseSchema } from './schemas';

/** Muskelkarte (Nachtrag „Muskelkarte“ in docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md). */

describe('MUSCLE_MAP_REGIONS', () => {
  it('ordnet jede Muskelgruppe des Enums mindestens einer Ansicht zu', () => {
    expect(Object.keys(MUSCLE_MAP_REGIONS).sort()).toEqual([...MUSCLE_GROUPS].sort());
    for (const muscle of MUSCLE_GROUPS) {
      const views = MUSCLE_MAP_REGIONS[muscle];
      expect(views.length, muscle).toBeGreaterThan(0);
      expect(new Set(views).size, muscle).toBe(views.length);
      views.forEach((view) => expect(MUSCLE_MAP_VIEWS).toContain(view));
    }
  });

  it('jede Muskelgruppe hat einen deutschen Namen', () => {
    for (const muscle of MUSCLE_GROUPS) {
      expect(muscleNameDe(muscle), muscle).toMatch(/^[A-Za-zÄÖÜäöüß ]{3,}$/);
    }
  });

  it('muscleMapRegions: Vorder- und Rückansicht decken zusammen alle Muskelgruppen ab', () => {
    const front = muscleMapRegions('front');
    const back = muscleMapRegions('back');
    expect(front).toContain('chest');
    expect(front).not.toContain('glutes');
    expect(back).toContain('glutes');
    expect(back).not.toContain('chest');
    expect(new Set([...front, ...back]).size).toBe(MUSCLE_GROUPS.length);
  });
});

describe('muscleMapHighlights', () => {
  it('Bankdrücken: Brust primär, Trizeps und vordere Schulter mitbeteiligt, Rest neutral', () => {
    const result = muscleMapHighlights({
      primary_muscles: ['chest'],
      secondary_muscles: ['triceps', 'front_delts'],
    });
    expect(result.primary).toEqual(['chest']);
    expect(result.secondary).toEqual(['triceps', 'front_delts']);
    expect(result.regions.chest).toBe('primary');
    expect(result.regions.triceps).toBe('secondary');
    expect(result.regions.front_delts).toBe('secondary');
    expect(result.regions.glutes).toBe('none');
    expect(Object.keys(result.regions)).toHaveLength(MUSCLE_GROUPS.length);
    expect(result.activeViews).toEqual(['front', 'back']);
    expect(result.primaryNamesDe).toEqual(['Brust']);
    expect(result.secondaryNamesDe).toEqual(['Trizeps', 'vordere Schulter']);
  });

  it('primär schlägt sekundär (Muskel in beiden Listen gilt als Hauptmuskel)', () => {
    const result = muscleMapHighlights({
      primary_muscles: ['glutes'],
      secondary_muscles: ['glutes', 'hamstrings'],
    });
    expect(result.regions.glutes).toBe('primary');
    expect(result.secondary).toEqual(['hamstrings']);
    expect(result.secondaryNamesDe).toEqual(['Beinbeuger']);
  });

  it('entfernt Doppelte und behält die Reihenfolge der Übung', () => {
    const result = muscleMapHighlights({
      primary_muscles: ['quadriceps', 'glutes', 'quadriceps'],
      secondary_muscles: ['calves', 'adductors', 'calves'],
    });
    expect(result.primary).toEqual(['quadriceps', 'glutes']);
    expect(result.secondary).toEqual(['calves', 'adductors']);
  });

  it('leere Listen → alles neutral, keine aktive Ansicht', () => {
    const result = muscleMapHighlights({ primary_muscles: [], secondary_muscles: [] });
    expect(Object.values(result.regions).every((level) => level === 'none')).toBe(true);
    expect(result.primary).toEqual([]);
    expect(result.secondary).toEqual([]);
    expect(result.activeViews).toEqual([]);
    expect(result.primaryNamesDe).toEqual([]);
  });

  it('nur Rückansicht aktiv (Rückenstrecker)', () => {
    const result = muscleMapHighlights({
      primary_muscles: ['lower_back'],
      secondary_muscles: ['glutes'],
    });
    expect(result.activeViews).toEqual(['back']);
  });

  it.each(MUSCLE_GROUPS)(
    'Grenzfall: jede einzelne Muskelgruppe (%s) wird hervorgehoben',
    (muscle) => {
      const primary = muscleMapHighlights({ primary_muscles: [muscle], secondary_muscles: [] });
      expect(primary.regions[muscle]).toBe('primary');
      expect(primary.activeViews).toEqual(
        MUSCLE_MAP_VIEWS.filter((v) => MUSCLE_MAP_REGIONS[muscle].includes(v)),
      );
      const secondary = muscleMapHighlights({ primary_muscles: [], secondary_muscles: [muscle] });
      expect(secondary.regions[muscle]).toBe('secondary');
    },
  );

  it('alle Übungen des Inhaltsstands: mindestens ein Hauptmuskel sichtbar', () => {
    const files = loadRepoContentFiles().filter((file) => file.kind === 'exercise');
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const exercise = exerciseSchema.parse(file.data);
      const result = muscleMapHighlights(exercise);
      expect(result.primary.length, exercise.id).toBeGreaterThan(0);
      expect(result.activeViews.length, exercise.id).toBeGreaterThan(0);
    }
  });
});

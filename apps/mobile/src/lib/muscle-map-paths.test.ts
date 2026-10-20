import {
  MUSCLE_GROUPS,
  MUSCLE_MAP_REGIONS,
  MUSCLE_MAP_VIEWS,
  muscleMapHighlights,
  muscleMapRegions,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { muscleMapA11yLabel, muscleMapLegend, mirrorPath, shapePaths } from './muscle-map-format';
import {
  MUSCLE_MAP_BODY,
  MUSCLE_MAP_DETAILS,
  MUSCLE_MAP_HEIGHT,
  MUSCLE_MAP_PATHS,
  MUSCLE_MAP_WIDTH,
} from './muscle-map-paths';

/** Muskelkarte in der App: jede Region aus packages/core hat einen gezeichneten Umriss; Texte; Spiegeln. */

const ALLOWED_PATH = /^(?:[MLCZ]|\s|-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?)+$/;
const points = (d: string) =>
  [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])]);

describe('Umrisse', () => {
  it('jede Muskelgruppe des Enums ist in jeder ihrer Ansichten gezeichnet – und nur dort', () => {
    for (const view of MUSCLE_MAP_VIEWS) {
      const drawn = Object.keys(MUSCLE_MAP_PATHS[view]).sort();
      expect(drawn, view).toEqual([...muscleMapRegions(view)].sort());
    }
    for (const muscle of MUSCLE_GROUPS) {
      for (const view of MUSCLE_MAP_REGIONS[muscle]) {
        expect(
          shapePaths(MUSCLE_MAP_PATHS[view][muscle]).length,
          `${view}/${muscle}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('alle Pfade nutzen nur absolute Befehle M/L/C/Z und liegen im Raster', () => {
    const all = MUSCLE_MAP_VIEWS.flatMap((view) => [
      ...shapePaths(MUSCLE_MAP_BODY[view]),
      ...shapePaths(MUSCLE_MAP_DETAILS[view]),
      ...Object.values(MUSCLE_MAP_PATHS[view]).flatMap((shape) => shapePaths(shape)),
    ]);
    expect(all.length).toBeGreaterThan(40);
    for (const d of all) {
      expect(d, d).toMatch(ALLOWED_PATH);
      for (const [x, y] of points(d)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(MUSCLE_MAP_WIDTH);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(MUSCLE_MAP_HEIGHT);
      }
    }
  });

  it('Hälften liegen links der Körpermitte (Spiegeln ergibt die rechte Seite)', () => {
    for (const view of MUSCLE_MAP_VIEWS) {
      for (const shape of Object.values(MUSCLE_MAP_PATHS[view])) {
        for (const d of shape?.half ?? []) {
          for (const [x] of points(d)) expect(x, d).toBeLessThanOrEqual(MUSCLE_MAP_WIDTH / 2 + 1);
        }
      }
    }
  });

  it('mirrorPath spiegelt x an der Mitte und lässt y und Befehle gleich', () => {
    expect(mirrorPath('M60,80 C50,82 42.5,88 39,100 L100,120 Z')).toBe(
      'M140,80 C150,82 157.5,88 161,100 L100,120 Z',
    );
    expect(mirrorPath(mirrorPath('M1,2 L3,4'))).toBe('M1,2 L3,4');
    expect(shapePaths({ half: ['M10,10 L20,20 Z'], center: ['M100,1 Z'] })).toEqual([
      'M10,10 L20,20 Z',
      'M190,10 L180,20 Z',
      'M100,1 Z',
    ]);
    expect(shapePaths(undefined)).toEqual([]);
  });
});

describe('Texte', () => {
  it('Screenreader-Text nennt Haupt- und mitbeteiligte Muskeln in Worten', () => {
    const bench = muscleMapHighlights({
      primary_muscles: ['chest'],
      secondary_muscles: ['triceps', 'front_delts'],
    });
    expect(muscleMapA11yLabel(bench)).toBe(
      'Trainiert vor allem: Brust. Mitbeteiligt: Trizeps, vordere Schulter.',
    );
    expect(muscleMapLegend(bench)).toEqual([
      { level: 'primary', text: 'Hauptmuskeln: Brust' },
      { level: 'secondary', text: 'Mitbeteiligt: Trizeps, vordere Schulter' },
    ]);
  });

  it('ohne Mitbeteiligte entfällt die zweite Zeile; ohne Angaben ein neutraler Satz', () => {
    const plank = muscleMapHighlights({ primary_muscles: ['abs'], secondary_muscles: [] });
    expect(muscleMapA11yLabel(plank)).toBe('Trainiert vor allem: gerade Bauchmuskeln.');
    expect(muscleMapLegend(plank)).toHaveLength(1);
    const empty = muscleMapHighlights({ primary_muscles: [], secondary_muscles: [] });
    expect(muscleMapA11yLabel(empty)).toBe('Keine Angaben zu den beanspruchten Muskeln.');
    expect(muscleMapLegend(empty)).toEqual([]);
  });
});

import { MUSCLE_GROUPS, type MuscleGroup } from '../enums';
import { muscleNameDe } from './checks';
import type { Exercise } from './schemas';

/**
 * Muskelkarte (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md, Nachtrag „Muskelkarte“): Zuordnung jeder Muskelgruppe des Enums
 * `MUSCLE_GROUPS` zu den Ansichten der eigenen, stilisierten Körper-Silhouette (vorn/hinten) und die Hervorhebung je
 * Übung. Reine Daten und Funktionen – die gezeichneten Umrisse (SVG-Pfade) liegen in der App
 * (apps/mobile/src/lib/muscle-map-paths.ts), ein Test dort stellt sicher, dass jede Region hier einen Umriss hat.
 */

export const MUSCLE_MAP_VIEWS = ['front', 'back'] as const;
export type MuscleMapView = (typeof MUSCLE_MAP_VIEWS)[number];

/** Stufe einer Region: Hauptmuskel, mitbeteiligt oder nicht beansprucht. */
export type MuscleHighlight = 'primary' | 'secondary' | 'none';

/**
 * In welchen Ansichten eine Muskelgruppe als Region gezeichnet wird. Erste Ansicht = Hauptansicht (dort ist der
 * Muskel am besten zu sehen). Paarige Muskeln werden spiegelgleich auf beiden Körperseiten gezeichnet.
 */
export const MUSCLE_MAP_REGIONS: Readonly<Record<MuscleGroup, readonly MuscleMapView[]>> = {
  chest: ['front'],
  lats: ['back'],
  // Kapuzenmuskel (oberer Anteil) ist auch von vorn zwischen Hals und Schulter zu sehen.
  upper_back: ['back', 'front'],
  front_delts: ['front'],
  side_delts: ['front', 'back'],
  rear_delts: ['back'],
  biceps: ['front'],
  triceps: ['back'],
  forearms: ['front', 'back'],
  abs: ['front'],
  obliques: ['front'],
  lower_back: ['back'],
  glutes: ['back'],
  quadriceps: ['front'],
  hamstrings: ['back'],
  adductors: ['front', 'back'],
  calves: ['back', 'front'],
};

/** Muskelgruppen, die in einer Ansicht als Region vorkommen (Reihenfolge wie `MUSCLE_GROUPS`). */
export function muscleMapRegions(view: MuscleMapView): MuscleGroup[] {
  return MUSCLE_GROUPS.filter((muscle) => MUSCLE_MAP_REGIONS[muscle].includes(view));
}

export interface MuscleMapHighlights {
  /** Stufe je Muskelgruppe (alle Enum-Werte, nicht genannte = `none`). */
  readonly regions: Readonly<Record<MuscleGroup, MuscleHighlight>>;
  /** Hauptmuskeln ohne Doppelte, in der Reihenfolge der Übung. */
  readonly primary: readonly MuscleGroup[];
  /** Mitbeteiligte Muskeln ohne Doppelte und ohne Hauptmuskeln (primär schlägt sekundär). */
  readonly secondary: readonly MuscleGroup[];
  /** Ansichten mit mindestens einer hervorgehobenen Region. */
  readonly activeViews: readonly MuscleMapView[];
  /** Deutsche Namen (docs: muscleNameDe) für Legende und Screenreader. */
  readonly primaryNamesDe: readonly string[];
  readonly secondaryNamesDe: readonly string[];
}

const unique = (muscles: readonly MuscleGroup[]) => [...new Set(muscles)];

/**
 * Hervorhebung der Muskelkarte für eine Übung. Primär schlägt sekundär (steht ein Muskel in beiden Listen, gilt er
 * als Hauptmuskel); leere Listen ergeben eine neutrale Karte.
 */
export function muscleMapHighlights(
  exercise: Pick<Exercise, 'primary_muscles' | 'secondary_muscles'>,
): MuscleMapHighlights {
  const primary = unique(exercise.primary_muscles);
  const secondary = unique(exercise.secondary_muscles).filter((m) => !primary.includes(m));
  const regions = Object.fromEntries(
    MUSCLE_GROUPS.map((muscle): [MuscleGroup, MuscleHighlight] => [
      muscle,
      primary.includes(muscle) ? 'primary' : secondary.includes(muscle) ? 'secondary' : 'none',
    ]),
  ) as Record<MuscleGroup, MuscleHighlight>;
  const count = (view: MuscleMapView, list: readonly MuscleGroup[]) =>
    list.filter((m) => MUSCLE_MAP_REGIONS[m].includes(view)).length;
  const activeViews = MUSCLE_MAP_VIEWS.filter(
    (view) => count(view, primary) + count(view, secondary) > 0,
  );
  return {
    regions,
    primary,
    secondary,
    activeViews,
    primaryNamesDe: primary.map(muscleNameDe),
    secondaryNamesDe: secondary.map(muscleNameDe),
  };
}

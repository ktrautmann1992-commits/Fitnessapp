import type { MuscleGroup } from '../enums';
import type { Exercise } from './schemas';

/**
 * Muskelgruppen-Kacheln im Übungs-Glossar (Gründer-Wunsch 22.10.2026): Eine Kachel pro Körperbereich mit
 * anatomischem Bild; Tipp auf die Kachel zeigt die Übungen, die diesen Bereich trainieren.
 *
 * Eine Kachel fasst eine oder mehrere Muskelgruppen aus MUSCLE_GROUPS zusammen (z. B. Schultern = vordere, seitliche
 * und hintere Schulter). Jede Muskelgruppe gehört zu mindestens einer Kachel (Test). „Nacken“ und „Rücken oben“
 * teilen sich `upper_back` (Trapezmuskel), weil der Trapez beides abdeckt.
 *
 * Reihenfolge = Anzeige (oben → unten am Körper). Texte und Bilder stehen in der App (i18n, assets/muscle-groups).
 */
export const MUSCLE_TILE_IDS = [
  'brust',
  'schultern',
  'nacken',
  'ruecken-oben',
  'unterer-ruecken',
  'bizeps',
  'trizeps',
  'unterarme',
  'bauch',
  'seitliche-bauchmuskeln',
  'gesaess',
  'oberschenkel-vorne',
  'beinbeuger',
  'adduktoren',
  'waden',
] as const;
export type MuscleTileId = (typeof MUSCLE_TILE_IDS)[number];

export const MUSCLE_TILES: Readonly<Record<MuscleTileId, readonly MuscleGroup[]>> = {
  brust: ['chest'],
  schultern: ['front_delts', 'side_delts', 'rear_delts'],
  nacken: ['upper_back'],
  'ruecken-oben': ['lats', 'upper_back'],
  'unterer-ruecken': ['lower_back'],
  bizeps: ['biceps'],
  trizeps: ['triceps'],
  unterarme: ['forearms'],
  bauch: ['abs'],
  'seitliche-bauchmuskeln': ['obliques'],
  gesaess: ['glutes'],
  'oberschenkel-vorne': ['quadriceps'],
  beinbeuger: ['hamstrings'],
  adduktoren: ['adductors'],
  waden: ['calves'],
};

/** Gültige Kachel-ID (z. B. aus einem Link-Parameter); alles andere → null. */
export function parseMuscleTileId(value: unknown): MuscleTileId | null {
  return typeof value === 'string' && (MUSCLE_TILE_IDS as readonly string[]).includes(value)
    ? (value as MuscleTileId)
    : null;
}

/**
 * Wie stark trainiert eine Übung den Bereich der Kachel? `primary` = Hauptmuskel, `secondary` = unterstützend
 * beteiligt, null = gar nicht. Hauptmuskel hat Vorrang, wenn beides zutrifft.
 */
export type MuscleTileRole = 'primary' | 'secondary';

export function muscleTileRole(
  exercise: Pick<Exercise, 'primary_muscles' | 'secondary_muscles'>,
  tile: MuscleTileId,
): MuscleTileRole | null {
  const muscles = MUSCLE_TILES[tile];
  if (exercise.primary_muscles.some((m) => muscles.includes(m))) return 'primary';
  if (exercise.secondary_muscles.some((m) => muscles.includes(m))) return 'secondary';
  return null;
}

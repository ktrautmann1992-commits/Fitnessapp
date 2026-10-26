import type { MuscleGroup } from '../enums';

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
  exercise: {
    readonly primary_muscles: readonly MuscleGroup[];
    readonly secondary_muscles: readonly MuscleGroup[];
  },
  tile: MuscleTileId,
): MuscleTileRole | null {
  const muscles = MUSCLE_TILES[tile];
  if (exercise.primary_muscles.some((m) => muscles.includes(m))) return 'primary';
  if (exercise.secondary_muscles.some((m) => muscles.includes(m))) return 'secondary';
  return null;
}

export interface ExerciseMuscleTile {
  readonly tile: MuscleTileId;
  readonly role: MuscleTileRole;
}

/**
 * Muskelgruppen-Kacheln einer Übung (Übungsseite, Gründer-Wunsch 22.10.2026): erst die Hauptmuskeln, dann
 * „unterstützend beteiligt“, je in Kachel-Reihenfolge. Eine Kachel, deren Muskeln ganz in einer anderen gezeigten
 * Kachel mit mindestens gleicher Rolle stecken, entfällt (z. B. „Nacken“ neben „Oberer Rücken“) – keine Doppelung.
 */
export function exerciseMuscleTiles(exercise: MuscleSource): ExerciseMuscleTile[] {
  const hits = MUSCLE_TILE_IDS.flatMap((tile) => {
    const role = muscleTileRole(exercise, tile);
    return role === null ? [] : [{ tile, role }];
  });
  return withoutCovered(hits);
}

/** Haupt- und Nebenmuskeln einer Übung (Bibliothekseintrag). */
export interface MuscleSource {
  readonly primary_muscles: readonly MuscleGroup[];
  readonly secondary_muscles: readonly MuscleGroup[];
}

const roleRank = (role: MuscleTileRole) => (role === 'primary' ? 0 : 1);

/**
 * Entfernt Kacheln, deren Muskeln ganz in einer anderen gezeigten Kachel mit mindestens gleicher Rolle stecken, und
 * sortiert: erst Hauptmuskeln, dann unterstützend – innerhalb der Rolle in Kachel-Reihenfolge (stabil).
 */
function withoutCovered(hits: readonly ExerciseMuscleTile[]): ExerciseMuscleTile[] {
  const covered = (a: ExerciseMuscleTile, b: ExerciseMuscleTile) =>
    a.tile !== b.tile &&
    roleRank(b.role) <= roleRank(a.role) &&
    MUSCLE_TILES[a.tile].every((m) => MUSCLE_TILES[b.tile].includes(m)) &&
    MUSCLE_TILES[b.tile].length > MUSCLE_TILES[a.tile].length;
  return hits
    .filter((a) => !hits.some((b) => covered(a, b)))
    .sort(
      (a, b) =>
        roleRank(a.role) - roleRank(b.role) ||
        MUSCLE_TILE_IDS.indexOf(a.tile) - MUSCLE_TILE_IDS.indexOf(b.tile),
    );
}

/**
 * Muskelgruppen einer ganzen Einheit (Übungsliste „Training“, Entwurf B vom 26.10.2026): die Kacheln aller Übungen
 * zusammengeführt – jede Kachel nur einmal, Hauptmuskel gewinnt über „unterstützend“ (trainiert eine Übung die Brust als
 * Hauptmuskel und eine andere nur unterstützend, gilt Brust als Hauptmuskel). Reihenfolge: erst Hauptmuskeln, dann
 * unterstützend, je in Kachel-Reihenfolge (oben → unten am Körper) – unabhängig von der Reihenfolge der Übungen.
 * Unbekannte Übungen (`null`/`undefined`, z. B. Bibliothek nicht geladen) werden übersprungen; leere Einheit → [].
 */
export function sessionMuscleTiles(
  exercises: readonly (MuscleSource | null | undefined)[],
): ExerciseMuscleTile[] {
  const roles = new Map<MuscleTileId, MuscleTileRole>();
  for (const exercise of exercises) {
    if (!exercise) continue;
    for (const { tile, role } of exerciseMuscleTiles(exercise)) {
      if (role === 'primary' || !roles.has(tile)) roles.set(tile, role);
    }
  }
  return withoutCovered([...roles].map(([tile, role]) => ({ tile, role })));
}

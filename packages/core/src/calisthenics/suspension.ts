import { SUSPENSION_TRAINER_RULES } from '../constants';
import type { Exercise } from '../content/schemas';
import { SUSPENSION_TRAINER_ID } from '../plan/equipment-profile';
import { isExerciseAllowed, type PlanSafetyRules } from '../plan/safety';

/**
 * Schlingentrainer im normalen Krafttraining (docs/PLAN-CALISTHENICS-SCHLINGE.md 3).
 */

/** Übung braucht den Schlingentrainer. */
export function isSuspensionExercise(exercise: Pick<Exercise, 'equipment_ids'>): boolean {
  return exercise.equipment_ids.includes(SUSPENSION_TRAINER_ID);
}

/**
 * Hat die Bibliothek genug Schlingentrainer-Übungen, damit das Gerät als Kraft-Gerät zählt
 * (SUSPENSION_TRAINER_RULES.readyPatternGroups: je Gruppe mindestens eine Übung)? Die Bibliothek ist im
 * Supabase-Modus nur „freigegeben“, im Testmodus auch Entwürfe – so wirkt die Umstellung live erst nach der Freigabe.
 * Mit `rules` zählen nur erlaubte Übungen (z. B. ohne `long_supine`/`floor_transfer` bei „Fit im Alter“).
 */
export function suspensionTrainerReady(
  library: ReadonlyMap<string, Exercise>,
  rules?: Pick<PlanSafetyRules, 'excludedCautionTags'>,
): boolean {
  const usable = [...library.values()].filter(
    (e) => isSuspensionExercise(e) && (rules ? isExerciseAllowed(e, rules) : true),
  );
  return SUSPENSION_TRAINER_RULES.readyPatternGroups.every((group) =>
    usable.some((e) => (group as readonly string[]).includes(e.movement_pattern)),
  );
}

/**
 * Wie steht man am Schlingentrainer (Datenfeld zur Schwierigkeit über den Körperwinkel, Gründer-Vorgabe 25.10.2026):
 * - `facing_anchor`: Gesicht zum Anker, zurückgelehnt (Rudern, Curls, Y/T, Face Pull) – Füße weiter nach vorn
 *   (unter den Anker) = flacher = schwerer,
 * - `facing_away`: Rücken zum Anker, nach vorn gelehnt (Brustpresse, Trizeps, Fallout) – Füße weiter nach hinten
 *   = flacher = schwerer,
 * - `feet_in_straps`: Füße in den Schlaufen, Hände/Unterarme am Boden – Hände weiter vom Ankerpunkt weg = schwerer,
 * - `supine_heels`: Rückenlage, Fersen in den Schlaufen – Beine gestreckter bzw. einbeinig = schwerer,
 * - `assisted`: im Stand mit Halt an den Griffen – weniger mit den Armen ziehen = schwerer.
 * `angleDeg` = typischer Bereich der Körperneigung gegen die Senkrechte (leicht → schwer), nur bei `facing_*`.
 * Quelle: übliche Anleitungen für Schlingentrainer (Körperwinkel als Last) – PRODUKTENTSCHEIDUNG, fachlich zu prüfen.
 */
export const SUSPENSION_POSITIONS = [
  'facing_anchor',
  'facing_away',
  'feet_in_straps',
  'supine_heels',
  'assisted',
] as const;
export type SuspensionPosition = (typeof SUSPENSION_POSITIONS)[number];

export interface SuspensionSetup {
  readonly position: SuspensionPosition;
  /** Körperneigung gegen die Senkrechte in Grad: [leicht, schwer]; null ohne Winkel-Regel. */
  readonly angleDeg: readonly [number, number] | null;
}

const facingAnchor: SuspensionSetup = { position: 'facing_anchor', angleDeg: [20, 70] };
const facingAway: SuspensionSetup = { position: 'facing_away', angleDeg: [20, 60] };
const feet: SuspensionSetup = { position: 'feet_in_straps', angleDeg: null };
const supine: SuspensionSetup = { position: 'supine_heels', angleDeg: null };
const assisted: SuspensionSetup = { position: 'assisted', angleDeg: null };

/** Aufstellung je Schlingentrainer-Übung (Test: jede Übung mit dem Gerät hat genau einen Eintrag). */
export const SUSPENSION_SETUPS: Readonly<Record<string, SuspensionSetup>> = {
  'schlingentrainer-rudern': facingAnchor,
  'schlingentrainer-rudern-einarmig': facingAnchor,
  'schlingentrainer-bizepscurl': facingAnchor,
  'schlingentrainer-y-heben': { position: 'facing_anchor', angleDeg: [10, 45] },
  'schlingentrainer-t-heben': { position: 'facing_anchor', angleDeg: [10, 45] },
  'schlingentrainer-face-pull': facingAnchor,
  'schlingentrainer-brustpresse': facingAway,
  'schlingentrainer-fliegende': { position: 'facing_away', angleDeg: [15, 45] },
  'schlingentrainer-trizepsstrecken': facingAway,
  'schlingentrainer-fallout': { position: 'facing_away', angleDeg: [10, 40] },
  'schlingentrainer-liegestuetz': feet,
  'schlingentrainer-atomic-liegestuetz': feet,
  'schlingentrainer-unterarmstuetz': feet,
  'schlingentrainer-seitstuetz': feet,
  'schlingentrainer-pike': feet,
  'schlingentrainer-knie-zur-brust': feet,
  'schlingentrainer-bergsteiger': feet,
  'schlingentrainer-beinbeuger': supine,
  'schlingentrainer-hueftheben': supine,
  'schlingentrainer-kniebeuge': assisted,
  'schlingentrainer-einbeinige-kniebeuge': assisted,
  'schlingentrainer-ausfallschritt-assistiert': assisted,
  'schlingentrainer-ausfallschritt': { position: 'feet_in_straps', angleDeg: null },
};

/** Aufstellung einer Übung (null, wenn sie keine Schlingentrainer-Übung ist). */
export function suspensionSetupFor(exerciseId: string): SuspensionSetup | null {
  return SUSPENSION_SETUPS[exerciseId] ?? null;
}

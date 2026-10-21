import { FREE_SESSION } from '../constants';
import type { WearableSessionGroup } from './schema';

/**
 * Zuordnung Health-Connect-Trainingsart → Tagebuch (docs/PLAN-PHASE-8.md 5.1). Die Zahlen sind die Konstanten
 * `ExerciseSessionRecord.EXERCISE_TYPE_*` von Health Connect (androidx.health.connect.client, gleich in
 * react-native-health-connect 4.1.3 `ExerciseType`). Unbekannte Arten werden NIE verworfen, sondern „Sonstige“.
 * - Laufen, Laufband → run; Gehen → walk; Rad, Ergometer → bike; Schwimmen (Becken, offen) → swim,
 * - Krafttraining, Gewichtheben, Calisthenics und einzelne Kraftübungen (Bankdrücken, Kniebeuge …) → freie
 *   Kraft-Einheit (A1b) ohne Übungen,
 * - alles andere (Yoga, Wandern, Tennis, Rudern, Crosstrainer …) → freie Einheit „Sonstige“ mit deutschem Titel.
 */

const RUN = [56, 57];
const WALK = [79];
const BIKE = [8, 9];
const SWIM = [73, 74];
/** Krafttraining (70), Gewichtheben (81), Calisthenics (13) und einzelne Kraftübungen. */
const STRENGTH = [
  70, 81, 13, 1, 3, 6, 7, 15, 17, 18, 19, 20, 21, 22, 23, 24, 30, 42, 43, 49, 67, 77,
];

/** Deutsche Titel für „Sonstige“ (häufige Arten); sonst OTHER_TITLE. */
export const WEARABLE_OTHER_TITLES: Readonly<Record<number, string>> = {
  2: 'Badminton',
  4: 'Baseball',
  5: 'Basketball',
  10: 'Bootcamp',
  11: 'Boxen',
  12: 'Burpees',
  16: 'Tanzen',
  25: 'Crosstrainer',
  26: 'Fitnesskurs',
  27: 'Fechten',
  28: 'American Football',
  32: 'Golf',
  33: 'Atemübung',
  34: 'Turnen',
  35: 'Handball',
  36: 'HIIT',
  37: 'Wandern',
  38: 'Eishockey',
  39: 'Eislaufen',
  40: 'Hampelmann',
  41: 'Seilspringen',
  44: 'Kampfsport',
  46: 'Paddeln',
  48: 'Pilates',
  51: 'Klettern',
  53: 'Rudern',
  54: 'Rudergerät',
  55: 'Rugby',
  58: 'Segeln',
  60: 'Skaten',
  61: 'Skifahren',
  62: 'Snowboarden',
  63: 'Schneeschuhwandern',
  64: 'Fußball',
  66: 'Squash',
  68: 'Treppensteigen',
  69: 'Stepper',
  71: 'Dehnen',
  72: 'Surfen',
  75: 'Tischtennis',
  76: 'Tennis',
  78: 'Volleyball',
  82: 'Rollstuhl',
  83: 'Yoga',
};

/** Titel einer Einheit ohne bekannte Art (Health Connect „Sonstiges Training“ = 0 und neue Arten). */
export const OTHER_TITLE = 'Sonstiges Training';

export interface MappedExerciseType {
  readonly group: WearableSessionGroup;
  /** Name im Tagebuch: bei Ausdauer/Kraft der feste Name der freien Einheit (A1b), sonst der deutsche Titel. */
  readonly nameDe: string;
}

/** Health-Connect-Trainingsart → Gruppe und Name im Tagebuch. */
export function mapExerciseType(hcType: number): MappedExerciseType {
  const names = FREE_SESSION.names;
  if (RUN.includes(hcType)) return { group: 'run', nameDe: names.endurance.run };
  if (WALK.includes(hcType)) return { group: 'walk', nameDe: names.endurance.walk };
  if (BIKE.includes(hcType)) return { group: 'bike', nameDe: names.endurance.bike };
  if (SWIM.includes(hcType)) return { group: 'swim', nameDe: names.endurance.swim };
  if (STRENGTH.includes(hcType)) return { group: 'strength', nameDe: names.strength };
  return { group: 'other', nameDe: WEARABLE_OTHER_TITLES[hcType] ?? OTHER_TITLE };
}

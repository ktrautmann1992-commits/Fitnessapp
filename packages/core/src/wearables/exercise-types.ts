import { FREE_SESSION } from '../constants';
import type { SportId } from '../enums';
import type { WearableSessionGroup } from './schema';

/**
 * Zuordnung Health-Connect-Trainingsart → Tagebuch (docs/PLAN-PHASE-8.md 5.1). Die Zahlen sind die Konstanten
 * `ExerciseSessionRecord.EXERCISE_TYPE_*` von Health Connect (androidx.health.connect.client, gleich in
 * react-native-health-connect 4.1.3 `ExerciseType`). Unbekannte Arten werden NIE verworfen, sondern „Sonstige“.
 * - Laufen, Laufband → run; Gehen → walk; Rad, Ergometer → bike; Schwimmen (Becken, offen) → swim,
 * - Krafttraining, Gewichtheben, Calisthenics und einzelne Kraftübungen (Bankdrücken, Kniebeuge …) → freie
 *   Kraft-Einheit (A1b) ohne Übungen,
 * - Rudergerät (54, Sportarten Stufe 1 · Etappe R) → Ausdauer Rudern,
 * - alles andere (Yoga, Wandern, Tennis, Rudern im Boot, Crosstrainer …) → freie Einheit „Sonstige“ mit deutschem Titel.
 *   Sportarten Stufe 2 (docs/PLAN-SPORTARTEN.md): Arten aus dem Sportarten-Katalog bekommen ihre Sportart
 *   (WEARABLE_SPORT_TYPES, kcal/Belastung je Sportart); alle übrigen „Sonstigen“ zählen als „Sonstige Sportart“.
 */

const RUN = [56, 57];
const WALK = [79];
const BIKE = [8, 9];
const SWIM = [73, 74];
/** Sportarten Stufe 1 · Etappe R: Rudergerät (54) → Ausdauer Rudern; Rudern im Boot (53) bleibt „Sonstige“. */
const ROW = [54];
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
  60: 'Inline-Skaten',
  61: 'Ski alpin',
  62: 'Snowboard',
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
export const OTHER_TITLE = 'Sonstige Sportart';

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
  if (ROW.includes(hcType)) return { group: 'row', nameDe: names.endurance.row };
  if (STRENGTH.includes(hcType)) return { group: 'strength', nameDe: names.strength };
  return { group: 'other', nameDe: WEARABLE_OTHER_TITLES[hcType] ?? OTHER_TITLE };
}

// ---------------------------------------------------------------------------------------------------------
// Sportarten Stufe 2: Health-Connect-Art → Sportart (docs/PLAN-SPORTARTEN.md)
// ---------------------------------------------------------------------------------------------------------

/**
 * Health-Connect-Arten mit Sportart aus dem Katalog (EXERCISE_TYPE_*): Badminton 2, Basketball 5, Bootcamp 10 und
 * HIIT 36 → HIIT/Zirkel, Boxen 11, Tanzen 16, Crosstrainer 25 (ELLIPTICAL), Handball 35, Kampfsport 44
 * (MARTIAL_ARTS, ohne Unterart), Paddeln 46 → Kajak/Kanu (PADDLING umfasst auch SUP – Health Connect unterscheidet
 * nicht), Klettern 51 (ROCK_CLIMBING), Inline-Skaten 60 (SKATING), Ski alpin 61 (SKIING – Health Connect kennt
 * KEINE eigene Art für Skilanglauf), Snowboard 62, Fußball 64 (SOCCER), Tischtennis 75, Tennis 76, Volleyball 78.
 * Padel, Skitour, SUP, Judo/BJJ, Karate, Kickboxen und Spinning haben in Health Connect keine eigene Art. Alle
 * übrigen „Sonstigen“ → `other` („Sonstige Sportart“, Dauer und kcal laut Uhr).
 */
export const WEARABLE_SPORT_TYPES: Readonly<Record<number, SportId>> = {
  2: 'badminton',
  5: 'basketball',
  10: 'hiit',
  11: 'boxing',
  16: 'dancing',
  25: 'cross_trainer',
  35: 'handball',
  36: 'hiit',
  44: 'martial_arts',
  46: 'kayaking',
  51: 'climbing',
  60: 'inline_skating',
  61: 'alpine_skiing',
  62: 'snowboarding',
  64: 'football',
  75: 'table_tennis',
  76: 'tennis',
  78: 'volleyball',
};

/** Sportart einer Health-Connect-Art: Ausdauer/Kraft → null; Katalog-Art → Sportart; sonst `other`. */
export function sportForExerciseType(hcType: number): SportId | null {
  if (mapExerciseType(hcType).group !== 'other') return null;
  return WEARABLE_SPORT_TYPES[hcType] ?? 'other';
}

/** Titel früherer App-Fassungen (vor Sportarten Stufe 2) → Sportart. */
const LEGACY_WEARABLE_TITLES: Readonly<Record<string, SportId>> = {
  Skaten: 'inline_skating',
  Skifahren: 'alpine_skiing',
  Snowboarden: 'snowboarding',
  'Sonstiges Training': 'other',
};

/**
 * Sportart einer übernommenen Uhr-Einheit („Sonstige“, gespeichert ohne Health-Connect-Art) aus ihrem Titel: Titel
 * einer Katalog-Art → deren Sportart, frühere Titel ebenso, jeder andere Titel → `other`.
 */
export function sportFromWearableTitle(title: string): SportId {
  for (const [type, name] of Object.entries(WEARABLE_OTHER_TITLES)) {
    if (name === title) return WEARABLE_SPORT_TYPES[Number(type)] ?? 'other';
  }
  return LEGACY_WEARABLE_TITLES[title] ?? 'other';
}

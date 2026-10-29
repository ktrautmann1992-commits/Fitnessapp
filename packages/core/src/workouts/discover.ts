import {
  HYROX_ONLY_EXERCISE_IDS,
  HYROX_STATION_EXERCISES,
  WORKOUT_THEME_RULES,
} from '../constants';
import { SKILL_PATHS } from '../calisthenics/skill-paths';
import { GYM_OPTIONAL_EQUIPMENT_IDS, requiredEquipmentIds } from '../equipment';
import { equipmentProfile } from '../plan/equipment-profile';
import type { Workout } from './schema';
import { wodStyle } from './wod';

/**
 * Bereiche im Reiter „Workouts“ (Gründer-Wunsch 29.10.2026: „Yoga anzeigen lassen, Übungen zur Entspannung, mal was
 * Neues testen wie Hyrox oder Calisthenics“ und „CrossFit fehlt uns noch“; docs/PLAN-WORKOUTS.md Abschnitt 6). Für
 * JEDEN sichtbar, unabhängig von Ziel und Plan; Grundlage sind nur die Inhalte (Kategorie, Format, Übungen, Titel) –
 * kein neues Inhaltsfeld. Fehlende Geräte blenden nichts aus, sondern ergeben einen Hinweis (missingWorkoutEquipment).
 */

export const WORKOUT_THEMES = [
  'relax',
  'yoga_pilates',
  'hyrox',
  'calisthenics',
  'functional',
  'try_new',
] as const;
export type WorkoutTheme = (typeof WORKOUT_THEMES)[number];

/** Sportart/Trainingsform eines Workouts (Anzeige auf der Karte und Gruppen für „Neues ausprobieren“). */
export const WORKOUT_DISCIPLINES = [
  'yoga',
  'pilates',
  'mobility',
  'hyrox',
  'calisthenics',
  'functional',
  'rowing',
  'run_strength',
] as const;
export type WorkoutDiscipline = (typeof WORKOUT_DISCIPLINES)[number];

type ThemeInput = Pick<
  Workout,
  | 'category'
  | 'format'
  | 'difficulty'
  | 'title_de'
  | 'rounds'
  | 'round_rest_s'
  | 'exercises'
  | 'equipment_ids'
>;

const HYROX_IDS: ReadonlySet<string> = new Set([
  ...HYROX_ONLY_EXERCISE_IDS,
  ...Object.values(HYROX_STATION_EXERCISES).map((chain) => chain[0] as string),
]);
const CALISTHENICS_IDS: ReadonlySet<string> = new Set(
  SKILL_PATHS.flatMap((path) => path.stages.map((stage) => stage.exerciseId)),
);
const CALISTHENICS_EQUIPMENT: readonly string[] = WORKOUT_THEME_RULES.calisthenicsEquipment;

function share(workout: ThemeInput, ids: ReadonlySet<string>): { count: number; share: number } {
  const total = workout.exercises.length;
  const count = workout.exercises.filter((item) => ids.has(item.exercise_id)).length;
  return { count, share: total === 0 ? 0 : count / total };
}

/** Ruhige Flow-Routine (Yoga/Mobilität, höchstens WORKOUT_THEME_RULES.relaxMaxStars Sterne). */
export function isRelaxWorkout(workout: ThemeInput): boolean {
  return (
    workout.format === 'flow' &&
    (workout.category === 'yoga' || workout.category === 'mobility') &&
    workout.difficulty <= WORKOUT_THEME_RULES.relaxMaxStars
  );
}

/** Überwiegend Hyrox-Stationen bzw. ihre Hyrox-Ersatzübungen (WOD-Stil zählt nicht – eigener Bereich). */
export function isHyroxWorkout(workout: ThemeInput): boolean {
  if (wodStyle(workout) !== null) return false;
  const s = share(workout, HYROX_IDS);
  return (
    s.count >= WORKOUT_THEME_RULES.hyroxMinExercises && s.share >= WORKOUT_THEME_RULES.hyroxMinShare
  );
}

/** Überwiegend Übungen der Calisthenics-Skill-Pfade, nur mit Calisthenics-Geräten. */
export function isCalisthenicsWorkout(workout: ThemeInput): boolean {
  if (workout.format === 'flow' || wodStyle(workout) !== null) return false;
  const s = share(workout, CALISTHENICS_IDS);
  return (
    s.count >= WORKOUT_THEME_RULES.calisthenicsMinExercises &&
    s.share >= WORKOUT_THEME_RULES.calisthenicsMinShare &&
    workout.equipment_ids.every((id) => CALISTHENICS_EQUIPMENT.includes(id))
  );
}

/**
 * Sportart/Trainingsform: WOD-Stil vor Hyrox vor Calisthenics (Übungen bestimmen die Form), sonst die Kategorie
 * (Yoga, Pilates, Mobilität, Rudern, Lauf-Kraft); allgemeine Kraft-/HIIT-Workouts: null.
 */
export function workoutDiscipline(workout: ThemeInput): WorkoutDiscipline | null {
  if (wodStyle(workout) !== null) return 'functional';
  if (isHyroxWorkout(workout)) return 'hyrox';
  if (isCalisthenicsWorkout(workout)) return 'calisthenics';
  switch (workout.category) {
    case 'yoga':
    case 'pilates':
    case 'mobility':
    case 'rowing':
    case 'run_strength':
      return workout.category;
    default:
      return null;
  }
}

/** Gehört das Workout zum Bereich? („Neues ausprobieren“ wählt aus der ganzen Liste – workoutsForTheme.) */
export function workoutHasTheme(workout: ThemeInput, theme: WorkoutTheme): boolean {
  switch (theme) {
    case 'relax':
      return isRelaxWorkout(workout);
    case 'yoga_pilates':
      return workout.category === 'yoga' || workout.category === 'pilates';
    case 'hyrox':
      return isHyroxWorkout(workout);
    case 'calisthenics':
      return isCalisthenicsWorkout(workout);
    case 'functional':
      return wodStyle(workout) !== null;
    case 'try_new':
      return workoutDiscipline(workout) !== null;
  }
}

/**
 * Workouts eines Bereichs in der Reihenfolge der Eingabe. „Neues ausprobieren“: je Sportart/Trainingsform
 * (WORKOUT_DISCIPLINES) das leichteste Workout – Sterne, dann Dauer, dann Titel – zum Hineinschnuppern; Reihenfolge
 * wie WORKOUT_DISCIPLINES.
 */
export function workoutsForTheme<W extends ThemeInput & Pick<Workout, 'minutes'>>(
  workouts: readonly W[],
  theme: WorkoutTheme | null,
): W[] {
  if (theme === null) return [...workouts];
  if (theme !== 'try_new') return workouts.filter((w) => workoutHasTheme(w, theme));
  const best = new Map<WorkoutDiscipline, W>();
  for (const workout of workouts) {
    const discipline = workoutDiscipline(workout);
    if (discipline === null) continue;
    const current = best.get(discipline);
    const easier =
      !current ||
      (workout.difficulty - current.difficulty ||
        workout.minutes - current.minutes ||
        workout.title_de.localeCompare(current.title_de, 'de')) < 0;
    if (easier) best.set(discipline, workout);
  }
  return WORKOUT_DISCIPLINES.flatMap((d) => {
    const w = best.get(d);
    return w ? [w] : [];
  });
}

/** Anzahl je Bereich (für die Chips). */
export function workoutThemeCounts(
  workouts: readonly (ThemeInput & Pick<Workout, 'minutes'>)[],
): Record<WorkoutTheme, number> {
  return Object.fromEntries(
    WORKOUT_THEMES.map((theme) => [theme, workoutsForTheme(workouts, theme).length]),
  ) as Record<WorkoutTheme, number>;
}

// ---------------------------------------------------------------------------------------------------------
// Geräte-Hinweis (Hinweis statt Ausblenden)
// ---------------------------------------------------------------------------------------------------------

/** Eine Geräte-Zeile (user_equipment) und ein Trainings-Termin (training_slots) – nur, was der Hinweis braucht. */
export interface EquipmentRowForWorkouts {
  readonly equipment_id: string;
  readonly location: string;
}
export interface TrainingSlotForWorkouts {
  readonly kind: string;
}

/**
 * Geräte, die die Person laut Angaben hat: Zuhause (inkl. mitgebrachter Geräte, z. B. Park → Stange + Barren) und –
 * wenn sie im Studio trainiert (Termin „Studio“ oder Studio-Angaben) – das Studio (equipmentProfile, Hyrox-Geräte nur
 * mit „Hyrox-Geräte im Studio“) samt ausdrücklichen Studio-Angaben (z. B. Rudergerät).
 */
export function availableWorkoutEquipment(input: {
  readonly userEquipment: readonly EquipmentRowForWorkouts[];
  readonly trainingSlots: readonly TrainingSlotForWorkouts[];
}): Set<string> {
  const home = input.userEquipment
    .filter((row) => row.location === 'home')
    .map((row) => ({ equipmentId: row.equipment_id, weightsKg: [] }));
  const gymRows = input.userEquipment.filter((row) => row.location === 'gym');
  const out = new Set(equipmentProfile('home', home).available);
  const atGym =
    gymRows.length > 0 || input.trainingSlots.some((slot) => slot.kind === 'strength_gym');
  if (atGym) {
    const gymHyroxEquipment = gymRows.some((row) =>
      GYM_OPTIONAL_EQUIPMENT_IDS.includes(row.equipment_id),
    );
    for (const id of equipmentProfile('gym', [], { gymHyroxEquipment }).available) out.add(id);
    for (const row of gymRows) out.add(row.equipment_id);
  }
  return out;
}

/** Benötigte Geräte, die laut Angaben fehlen (ersetzbare Hilfsmittel wie Matte/Block nie); unbekannt (null) = keine. */
export function missingWorkoutEquipment(
  workout: Pick<Workout, 'equipment_ids'>,
  available: ReadonlySet<string> | null,
): string[] {
  if (available === null) return [];
  return requiredEquipmentIds(workout.equipment_ids).filter((id) => !available.has(id));
}

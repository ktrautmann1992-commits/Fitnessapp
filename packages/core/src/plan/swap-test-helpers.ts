/**
 * Testhilfe (nur in *.test.ts) für den Übungs-Tausch (Etappe T1): Termine, Einheiten, Präferenzen und Day-Swaps mit
 * den echten Inhalten aus `content/`.
 */
import type { Exercise } from '../content/schemas';
import type { EquipmentLocation, ExercisePreferenceKind } from '../enums';
import type { PlannedExerciseDraft } from './adapt';
import type { DaySwap } from './day-swaps';
import type { ExercisePreference } from './preferences';
import { MONDAY, repoLibrary } from './test-library';
import type { StoredSession } from './view';

export const LIB = repoLibrary();
export const EXERCISES = LIB.exercises;

export function ex(id: string): Exercise {
  const found = EXERCISES.get(id);
  if (!found) throw new Error(`Übung fehlt: ${id}`);
  return found;
}

export const USER_ID = '11111111-1111-4111-8111-111111111111';
export const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
export const PLAN_ID = '33333333-3333-4333-8333-333333333333';
export const SESSION_ID = '44444444-4444-4444-8444-444444444444';
export const TS = '2026-10-05T08:00:00Z';

export function planned(
  exerciseId: string,
  overrides: Partial<PlannedExerciseDraft> = {},
): PlannedExerciseDraft {
  return {
    order_no: 1,
    exercise_id: exerciseId,
    source_exercise_id: exerciseId,
    exercise_name_de: EXERCISES.get(exerciseId)?.name_de ?? exerciseId,
    sets: 3,
    reps_min: 8,
    reps_max: 12,
    duration_s: null,
    rest_s: 90,
    rpe_target: 8,
    superset_group: null,
    notes_de: null,
    target_weight_kg: null,
    ...overrides,
  };
}

/** Kraft-Einheit aus Übungs-IDs (order_no 1, 2, …). */
export function strengthSession(
  ids: readonly string[],
  overrides: Partial<StoredSession> = {},
): StoredSession {
  return {
    id: SESSION_ID,
    status: 'planned',
    original_date: null,
    block_no: 1,
    week_no: 1,
    is_intro_week: false,
    is_deload: false,
    kind: 'strength',
    template_day_index: 0,
    scheduled_on: MONDAY,
    name_de: 'Ganzkörper A',
    focus: 'full_body',
    endurance_modality: null,
    effort_target: null,
    estimated_minutes: 45,
    warmup_de: 'Aufwärmen',
    cooldown_de: 'Cool-down',
    exercises: ids.map((id, i) => planned(id, { order_no: i + 1 })),
    ...overrides,
  };
}

export function pref(
  exerciseId: string,
  location: EquipmentLocation,
  kind: ExercisePreferenceKind,
  replacement: string | null = null,
): ExercisePreference {
  return {
    exercise_id: exerciseId,
    location,
    kind,
    replacement_exercise_id: replacement,
    created_at: TS,
    updated_at: TS,
  };
}

export function daySwap(
  storedOrderNo: number,
  storedExerciseId: string,
  alternativeId: string,
  overrides: Partial<DaySwap> = {},
): DaySwap {
  return {
    ownerUserId: USER_ID,
    planId: PLAN_ID,
    sessionId: SESSION_ID,
    scheduledOn: MONDAY,
    storedOrderNo,
    storedExerciseId,
    alternativeId,
    createdAt: TS,
    ...overrides,
  };
}

/** Geräte-Profil aus IDs. */
export const devices = (...ids: string[]) => ({ available: new Set(ids) });
export const NOTHING = devices();
export const GYM_DEVICES = devices(
  'dumbbells',
  'barbell',
  'power_rack',
  'flat_bench',
  'incline_bench',
  'cable_station',
  'lat_pulldown',
  'leg_press',
  'leg_curl_machine',
  'leg_extension_machine',
  'machine_chest_press',
  'resistance_bands',
  'pull_up_bar',
  'kettlebells',
);

/** Übung mit geänderten Feldern (synthetische Grenzfälle). */
export function variantOf(id: string, overrides: Partial<Exercise>): Exercise {
  return { ...ex(id), ...overrides };
}

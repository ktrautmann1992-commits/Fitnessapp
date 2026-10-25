import { RUN_STRENGTH_RULES } from '../constants';
import type { Exercise } from '../content/schemas';
import { addDays, daysBetween, startOfIsoWeek } from '../dates';
import type { EnduranceModality, PlannedSessionKind } from '../enums';
import { isBlockedByPain, type PainEffect } from '../modes/pain';
import type { Workout } from '../workouts/schema';
import { type EquipmentProfile, isExerciseFeasible } from './equipment-profile';
import { isHardWorkoutType, type WorkoutType } from './intensity';
import { isExerciseAllowed, type PlanSafetyRules } from './safety';

/**
 * Lauf-Kraft & Lauf-ABC (docs/PLAN-CALISTHENICS-SCHLINGE.md 4, RUN_STRENGTH_RULES): 15-min-Einheiten an lockeren
 * Lauftagen von Ausdauer-/Laufplänen. Wie Aufwärmen & Dehnen eine ANZEIGE-Schicht: Der gespeicherte Plan bleibt
 * unverändert, die Zuordnung entsteht deterministisch aus den geplanten Einheiten (kein Speichern, keine Migration).
 */

/** Felder einer geplanten Einheit, die die Zuordnung braucht (GeneratedSession/StoredSession passen). */
export interface RunStrengthSessionInput {
  readonly scheduled_on: string;
  readonly kind: PlannedSessionKind;
  readonly endurance_modality: EnduranceModality | null;
  readonly workout_type?: WorkoutType | null;
  readonly estimated_minutes: number;
  readonly is_deload: boolean;
  readonly is_intro_week: boolean;
  readonly week_no: number;
  /** Ausgelassene Einheiten zählen nicht als Lauftag. */
  readonly status?: string;
}

export interface RunStrengthContext {
  /** Startgruppe der Ausdauer (planSafetyRules().enduranceStartGroup). */
  readonly rules: Pick<
    PlanSafetyRules,
    'enduranceStartGroup' | 'enduranceWalkOnly' | 'excludedCautionTags'
  >;
}

export interface RunStrengthAssignment {
  /** Lauftag, an den die Einheit angehängt wird. */
  readonly date: string;
  /** Workout-ID (content/workouts, Kategorie run_strength). */
  readonly workoutId: string;
  /** Fassung ohne Sprünge (Einstiegs-/Erholungswoche oder Sprünge laut Regeln ausgeschlossen). */
  readonly gentle: boolean;
}

const isRun = (s: RunStrengthSessionInput) =>
  s.kind === 'endurance' && s.endurance_modality === 'run' && s.status !== 'skipped';

/**
 * Schlüsseleinheiten einer Woche: harte Art (Fahrtspiel, Tempo, Intervalle, Renntempo), der lange Lauf (Art `long`)
 * und – in Grundlagenplänen ohne Art – der längste Lauf der Woche, sobald es mindestens zwei Läufe gibt.
 */
function keyDates(runs: readonly RunStrengthSessionInput[]): Set<string> {
  const keys = new Set<string>();
  for (const run of runs) {
    if (run.workout_type === 'long' || isHardWorkoutType(run.workout_type))
      keys.add(run.scheduled_on);
  }
  const typed = runs.some((r) => r.workout_type !== null && r.workout_type !== undefined);
  if (!typed && runs.length >= 2) {
    const longest = [...runs].sort(
      (a, b) =>
        b.estimated_minutes - a.estimated_minutes ||
        (a.scheduled_on < b.scheduled_on ? 1 : a.scheduled_on > b.scheduled_on ? -1 : 0),
    )[0];
    if (longest) keys.add(longest.scheduled_on);
  }
  return keys;
}

/**
 * Welche lockeren Läufe bekommen eine Lauf-Kraft-Einheit (RUN_STRENGTH_RULES)? Wochen nach ISO-Woche, chronologisch;
 * je Woche höchstens `perWeek[Startgruppe]`, in Einstiegs-/Erholungswochen (und Woche 0) höchstens `easyWeekMax` und
 * dann nur die Fassung ohne Sprünge, Steigerung höchstens `maxIncreasePerWeek` gegenüber der Vorwoche. Nie an einer
 * Schlüsseleinheit oder am Tag davor, zwei Einheiten mindestens `minDaysApart` Tage auseinander. Nur Laufen (nicht
 * bei „nur Gehen“).
 */
export function planRunStrength(
  sessions: readonly RunStrengthSessionInput[],
  ctx: RunStrengthContext,
): RunStrengthAssignment[] {
  if (ctx.rules.enduranceWalkOnly) return [];
  const R = RUN_STRENGTH_RULES;
  const noJumps = ctx.rules.excludedCautionTags.includes('high_impact');
  const byWeek = new Map<string, RunStrengthSessionInput[]>();
  for (const s of sessions) {
    if (s.kind !== 'endurance') continue;
    const week = startOfIsoWeek(s.scheduled_on);
    byWeek.set(week, [...(byWeek.get(week) ?? []), s]);
  }
  const weeks = [...byWeek.keys()].sort();
  const result: RunStrengthAssignment[] = [];
  let previous = 0;
  let unitCounter = 0;
  for (const week of weeks) {
    const all = (byWeek.get(week) ?? [])
      .slice()
      .sort((a, b) =>
        a.scheduled_on < b.scheduled_on ? -1 : a.scheduled_on > b.scheduled_on ? 1 : 0,
      );
    const runs = all.filter(isRun);
    const keys = keyDates(runs);
    const easyWeek = all.some((s) => s.is_deload || s.is_intro_week || s.week_no === 0);
    const cap = Math.min(
      easyWeek ? R.easyWeekMax : R.perWeek[ctx.rules.enduranceStartGroup],
      previous + R.maxIncreasePerWeek,
    );
    const chosen: string[] = [];
    for (const run of runs) {
      if (chosen.length >= cap) break;
      if (keys.has(run.scheduled_on) || isHardWorkoutType(run.workout_type)) continue;
      if (keys.has(addDays(run.scheduled_on, 1))) continue;
      if (chosen.some((d) => Math.abs(daysBetween(d, run.scheduled_on)) < R.minDaysApart)) continue;
      if (chosen.includes(run.scheduled_on)) continue;
      chosen.push(run.scheduled_on);
    }
    const gentle = easyWeek || noJumps;
    const perWeek = R.perWeek[ctx.rules.enduranceStartGroup];
    chosen.forEach((date, i) => {
      let workoutId: string;
      if (gentle) {
        workoutId = R.units.gentle;
      } else if (perWeek >= 2) {
        // Zwei pro Woche: erst Kraft (Waden/Füße bzw. Hüfte/Rumpf im Wochenwechsel), dann Lauf-ABC.
        workoutId =
          i === 0 ? (R.units.strength[unitCounter % 2] ?? R.units.gentle) : R.units.drills;
      } else {
        // Eine pro Woche: Waden/Füße → Hüfte/Rumpf → Lauf-ABC im Wechsel.
        const cycle = [...R.units.strength, R.units.drills];
        workoutId = cycle[unitCounter % cycle.length] ?? R.units.gentle;
      }
      result.push({ date, workoutId, gentle });
    });
    if (chosen.length > 0 && !gentle) unitCounter += 1;
    previous = chosen.length;
  }
  return result;
}

/** Zuordnung an einem Tag (oder null). */
export function runStrengthOn(
  assignments: readonly RunStrengthAssignment[],
  date: string,
): RunStrengthAssignment | null {
  return assignments.find((a) => a.date === date) ?? null;
}

export interface RunStrengthItemsContext {
  readonly library: ReadonlyMap<string, Exercise>;
  readonly rules: Pick<PlanSafetyRules, 'excludedCautionTags'>;
  /** Geräte am Ort bzw. auf Reisen; fehlt es, nur Übungen ohne Geräte. */
  readonly profile?: Pick<EquipmentProfile, 'available'> | null;
  readonly pain?: PainEffect | null;
}

export interface RunStrengthUnit {
  readonly workout: Workout;
  /** Übungen, die heute bleiben (erlaubt, machbar, im Schon-Modus nicht gesperrt). */
  readonly items: Workout['exercises'];
  /** Anzahl entfallener Übungen (Schon-Modus/Regeln). */
  readonly dropped: number;
}

/**
 * Übungen der Einheit für heute: nur erlaubte, machbare und im Schon-Modus nicht gesperrte. Bleiben weniger als
 * RUN_STRENGTH_RULES.minItems, entfällt die Einheit (null) – nie eine leere oder halbe Einheit.
 */
export function runStrengthUnit(
  workout: Workout | undefined,
  ctx: RunStrengthItemsContext,
): RunStrengthUnit | null {
  if (!workout) return null;
  const profile = ctx.profile ?? { available: new Set<string>() };
  const items = workout.exercises.filter((item) => {
    const exercise = ctx.library.get(item.exercise_id);
    return (
      exercise !== undefined &&
      isExerciseAllowed(exercise, ctx.rules) &&
      isExerciseFeasible(exercise, profile) &&
      !(ctx.pain ? isBlockedByPain(exercise, ctx.pain) : false)
    );
  });
  if (items.length < RUN_STRENGTH_RULES.minItems) return null;
  return { workout, items, dropped: workout.exercises.length - items.length };
}

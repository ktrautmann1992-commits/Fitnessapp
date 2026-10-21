import { ENDURANCE_EFFORT, LIGHTER_DAY } from '../constants';
import { isHardWorkoutType, type WorkoutStep, type WorkoutType } from './intensity';

/**
 * „Heute leichter“ (docs/PLAN-PHASE-9.md 3.3 und 6.4, gemeinsam mit Phase 8 „Tagesform“): eine leichtere Variante
 * der HEUTE geplanten Einheit – nie mehr als geplant. Gilt nur für diesen Tag; Wochenplan, Erholungswochen und
 * Wochenumfänge bleiben unverändert. Ohne Grund (Angebot aus dem Tages-Check, eigener Wunsch, später Readiness).
 *
 * Stand Phase 9 (ZY1): nur die reine Logik. Knopf für alle, Tageswahl im geschützten Speicher `dayVariant` und die
 * Spalte `session_logs.day_variant` kommen gemeinsam mit Phase 8b (Tagesform) in Etappe ZY5 – vorher wird nichts
 * geschrieben (Wächter B1).
 */
export const DAY_VARIANTS = ['lighter'] as const;
export type DayVariant = (typeof DAY_VARIANTS)[number];

/** Felder, die „leichter“ liest und ändert. Alle anderen Felder bleiben unverändert erhalten. */
export interface DayVariantExercise {
  readonly sets: number;
  readonly rpe_target: number;
}

export interface DayVariantSession {
  readonly kind: 'strength' | 'endurance';
  readonly exercises: readonly DayVariantExercise[];
  readonly estimated_minutes: number;
  readonly effort_target?: number | null;
  readonly workout_type?: WorkoutType | null;
  readonly workout_steps?: readonly WorkoutStep[] | null;
}

/** Kraft: 1 Satz weniger (mindestens 1), RPE −1 (mindestens 5) – nie über dem geplanten Wert. */
export function lighterExercise<T extends DayVariantExercise>(exercise: T): T {
  const sets = Math.min(
    exercise.sets,
    Math.max(LIGHTER_DAY.minSets, exercise.sets - LIGHTER_DAY.setsReduction),
  );
  const rpe = Math.min(
    exercise.rpe_target,
    Math.max(LIGHTER_DAY.minRpe, exercise.rpe_target - LIGHTER_DAY.rpeReduction),
  );
  return { ...exercise, sets, rpe_target: rpe };
}

/** Ausdauer: Dauer × 0,8, mindestens 10 min – nie über der geplanten Dauer. */
export function lighterMinutes(planned: number): number {
  const reduced = Math.floor(planned * LIGHTER_DAY.durationFactor);
  return Math.min(planned, Math.max(LIGHTER_DAY.minEnduranceMinutes, reduced));
}

/**
 * Leichtere Variante einer Einheit. Kraft: jede Übung leichter, Dauer geschätzt × 0,8. Ausdauer: harte Einheiten
 * (Intervall, Tempo, Fahrtspiel, Renntempo) werden locker (Art `easy`, ohne Schritte, Anstrengung höchstens
 * ENDURANCE_EFFORT.easyMax), lockere bleiben locker; Dauer × 0,8. Die Sicherheitsregeln (RPE-Deckel, Ausschlüsse)
 * laufen danach unverändert (applyCurrentSafetyRules / applyCurrentEnduranceRules).
 */
export function lighterSessionVariant<T extends DayVariantSession>(session: T): T {
  if (session.kind === 'strength') {
    return {
      ...session,
      exercises: session.exercises.map((exercise) => lighterExercise(exercise)),
      estimated_minutes: lighterMinutes(session.estimated_minutes),
    };
  }
  const hard = isHardWorkoutType(session.workout_type);
  const effort = session.effort_target ?? null;
  return {
    ...session,
    estimated_minutes: lighterMinutes(session.estimated_minutes),
    ...(effort !== null ? { effort_target: Math.min(effort, ENDURANCE_EFFORT.easyMax) } : {}),
    ...(hard ? { workout_type: 'easy' as const, workout_steps: null } : {}),
  };
}

/**
 * Angebote für einen Tag aus mehreren Quellen (Zyklus-Tages-Check, später Readiness aus Phase 8): EINE Stufe, nie
 * addiert. Rangfolge: Ruhetag vor Verschieben vor „leichter“ vor „wie geplant“ (Plan 3.3, S7).
 */
export const DAY_OFFERS = ['rest', 'move', 'lighter', 'as_planned'] as const;
export type DayOffer = (typeof DAY_OFFERS)[number];

export function combineDayOffers(offers: readonly DayOffer[]): DayOffer {
  let best: DayOffer = 'as_planned';
  for (const offer of offers) {
    if (DAY_OFFERS.indexOf(offer) < DAY_OFFERS.indexOf(best)) best = offer;
  }
  return best;
}

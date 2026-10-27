import { z } from 'zod';

import {
  COMPETITION_DISTANCE_M,
  COMPETITION_INTENSITY,
  COMPETITION_WORKOUTS,
  ENDURANCE_EFFORT,
  COMPETITION_PACE,
  ENDURANCE_OVERLOAD_RULE,
} from '../constants';
import { type ExperienceLevel, HYROX_STATIONS, type HyroxStation } from '../enums';
import {
  type CompetitionDiscipline,
  type CompetitionReference,
  isRunCompetitionDiscipline,
  type RunCompetitionDiscipline,
} from './competition-schema';
import type { PlanSafetyRules } from './safety';

/**
 * Intensität ohne Pulsuhr (docs/PLAN-PHASE-10.md Abschnitte 3.3, 3.4, 3.6 und 6, Etappe WP2): Einheiten-Arten, harte
 * Arten, 80/20-Zählung, Pace-Richtwerte nach Riegel, Distanz-Richtwert, Zielzeit-Plausibilität und die neue Fassung
 * der 4b-Regel `endurance_reduce`. Reine Funktionen, keine KI, kein Puls (W-G7).
 */

/**
 * Einheiten-Arten (Plan 3.4). WP5: `brick` = Koppeltraining Rad → Lauf als EINE Einheit mit zwei Teilen,
 * `technique` = Schwimmtechnik – beide locker (keine harten Arten). Sportarten Stufe 1 (Hyrox,
 * docs/PLAN-SPORTARTEN-STUFE-1.md 2.1): `hyrox_combo` = Kombi-Einheit „1 km + Station“ (Ausdauer-Art `run`, Schritte
 * mit Typ `station`) – gilt als HARTE Art. Reihenfolge = Postgres-Enum `workout_type`.
 */
export const WORKOUT_TYPES = [
  'easy',
  'recovery',
  'long',
  'strides',
  'fartlek',
  'tempo',
  'intervals',
  'race_pace',
  'brick',
  'technique',
  'hyrox_combo',
] as const;
export type WorkoutType = (typeof WORKOUT_TYPES)[number];

/**
 * Harte Arten (zählen für 48-h-Regel, Wochen-Deckel, „Erholungswoche ohne harte Einheit“). `hyrox_combo` (Sportarten
 * Stufe 1): die Hyrox-Kombi gilt immer als hart (80/20, hard_endurance_48h); die lockere „Technik-Kombi“ (Arzt-Hinweis)
 * ist eine Einheit der Art `easy` mit Stations-Schritten.
 */
export const HARD_WORKOUT_TYPES = [
  'fartlek',
  'tempo',
  'intervals',
  'race_pace',
  'hyrox_combo',
] as const;

export function isHardWorkoutType(type: WorkoutType | null | undefined): boolean {
  return (
    type !== null && type !== undefined && (HARD_WORKOUT_TYPES as readonly string[]).includes(type)
  );
}

/**
 * Schritt einer Einheit (Timer in WP4): Teil, Art, Dauer in Sekunden, Anstrengung 0–10. Sportarten Stufe 1 (Hyrox):
 * Art `station` = eine Hyrox-Station; dann (und nur dann) nennt `station` welche (HYROX_STATIONS). Stations-Schritte
 * gibt es nur in den Arten `hyrox_combo` und `easy` (Technik-Kombi) – wie private.workout_steps_fit_type.
 */
export interface WorkoutStep {
  readonly part: 'warmup' | 'main' | 'cooldown';
  readonly kind: 'work' | 'easy' | 'rest' | 'station';
  readonly seconds: number;
  readonly effort: number;
  readonly station?: HyroxStation;
}

/** Arten, in denen Stations-Schritte erlaubt sind (= private.workout_steps_fit_type). */
export const STATION_STEP_WORKOUT_TYPES = ['hyrox_combo', 'easy'] as const;

/**
 * Grenzen der Schritte (Vorlage für `workout_steps jsonb` in WP3): höchstens 40 Schritte, je 10 s bis 4 h,
 * Anstrengung 0–10 ganzzahlig.
 */
export const WORKOUT_STEP_LIMITS = { maxSteps: 40, seconds: { min: 10, max: 4 * 3600 } } as const;

export const workoutStepSchema = z
  .strictObject({
    part: z.enum(['warmup', 'main', 'cooldown']),
    kind: z.enum(['work', 'easy', 'rest', 'station']),
    seconds: z
      .number()
      .int()
      .min(WORKOUT_STEP_LIMITS.seconds.min)
      .max(WORKOUT_STEP_LIMITS.seconds.max),
    effort: z.number().int().min(0).max(10),
    /** Nur bei `kind = 'station'` (dort Pflicht): welche Hyrox-Station. */
    station: z.enum(HYROX_STATIONS).optional(),
  })
  .refine((step) => (step.kind === 'station') === (step.station !== undefined), {
    message: 'Station genau bei Schritt-Typ „station“.',
    path: ['station'],
  });
export const workoutStepsSchema = z
  .array(workoutStepSchema)
  .min(1)
  .max(WORKOUT_STEP_LIMITS.maxSteps);

/**
 * Passen die Schritte zur Art? (= private.workout_steps_fit_type, Wächter WP3 H1) Lockere Arten (easy, long, recovery)
 * nur mit Abschnitten bis zur lockeren Anstrengung (ENDURANCE_EFFORT.easyMax); Steigerungen nur mit Belastungs-
 * Abschnitten (`work`) von höchstens COMPETITION_WORKOUTS.strides.workS Sekunden, höchstens `count` Stück, sonst locker;
 * harte Arten frei (Deckel je Person prüft der Server mit dem Plan).
 */
export function stepsFitWorkoutType(type: WorkoutType, steps: readonly WorkoutStep[]): boolean {
  if (
    steps.some((st) => st.kind === 'station') &&
    !(STATION_STEP_WORKOUT_TYPES as readonly string[]).includes(type)
  ) {
    return false;
  }
  if (isHardWorkoutType(type)) return true;
  const easyMax = ENDURANCE_EFFORT.easyMax;
  const above = steps.filter((st) => st.effort > easyMax);
  if (type === 'strides') {
    const S = COMPETITION_WORKOUTS.strides;
    return (
      above.length <= S.count && above.every((st) => st.kind === 'work' && st.seconds <= S.workS)
    );
  }
  return above.length === 0;
}

/**
 * Zählt die Einheit als hart (Wochenzahl, Erholungswoche nur im Tapering; = private.workout_is_hard)? Harte Art oder –
 * unabhängig von der Art – ein Abschnitt ab COMPETITION_INTENSITY.hardEffortMin, der länger dauert als eine Steigerung.
 */
export function isHardSession(
  type: WorkoutType | null | undefined,
  steps: readonly WorkoutStep[] | null | undefined,
): boolean {
  if (isHardWorkoutType(type)) return true;
  return (steps ?? []).some(
    (st) =>
      st.effort >= COMPETITION_INTENSITY.hardEffortMin &&
      st.seconds > COMPETITION_WORKOUTS.strides.workS,
  );
}

/** Wie hart darf es für diese Person werden? `allowed` false → nur lockere Arten (Tabelle 3.3). */
export interface HardWorkoutLimits {
  readonly allowed: boolean;
  /** Höchste Anstrengung harter Abschnitte. */
  readonly effortCap: number;
  /** Höchstens so viele harte Einheiten je Woche. */
  readonly perWeek: number;
  /** 80/20: nur harte Abschnitte zählen (Einsteiger, vorsichtige Startgruppe) statt des ganzen Hauptteils. */
  readonly countWorkOnly: boolean;
}

/**
 * Grenzen harter Einheiten aus den wirksamen Sicherheitsregeln (strengste Regel gewinnt, Tabelle 3.3): Gesundheits-
 * Flag, Schwangerschaft, ohne Check und „nur Gehen“ (Flag, ab 65 – G7) → keine; vorsichtige Startgruppe sonst (= unter
 * 18) → Anstrengung ≤ 7 und höchstens 1/Woche; Einsteiger höchstens 1/Woche; sonst 2/Woche, Anstrengung ≤ 8.
 * Hergeleitet nur aus PlanSafetyRules (keine neuen Felder – Pläne ohne Wettkampf bleiben byte-gleich).
 */
export function hardWorkoutLimits(
  rules: Pick<
    PlanSafetyRules,
    | 'enduranceWalkOnly'
    | 'pregnancyNotice'
    | 'noHealthCheck'
    | 'medicalNotice'
    | 'enduranceStartGroup'
  >,
  level: ExperienceLevel,
): HardWorkoutLimits {
  const I = COMPETITION_INTENSITY;
  const blocked =
    rules.enduranceWalkOnly || rules.pregnancyNotice || rules.noHealthCheck || rules.medicalNotice;
  const strictGroup = rules.enduranceStartGroup === 'cautious';
  const strict = strictGroup || level === 'beginner';
  return {
    allowed: !blocked,
    effortCap: blocked ? 0 : strictGroup ? I.hardEffortCap.minor : I.hardEffortCap.general,
    perWeek: blocked ? 0 : strict ? I.hardSessionsPerWeek.strict : I.hardSessionsPerWeek.general,
    countWorkOnly: strict,
  };
}

/**
 * Höchste Anstrengung harter Abschnitte nach den AKTUELLEN Regeln (0 = keine harten Einheiten erlaubt) – auch für
 * gespeicherte Einheiten (apply-safety.ts, „Strengeres wirkt sofort“).
 */
export function hardEffortCapFor(
  rules: Pick<
    PlanSafetyRules,
    | 'enduranceWalkOnly'
    | 'pregnancyNotice'
    | 'noHealthCheck'
    | 'medicalNotice'
    | 'enduranceStartGroup'
  >,
): number {
  return hardWorkoutLimits(rules, 'advanced').effortCap;
}

/**
 * Harte Minuten einer Einheit für die 80/20-Regel (Plan 3.4): Zeit der Abschnitte mit Anstrengung ≥ 6; ohne
 * `workOnly` zählt bei einer harten Einheit der ganze Hauptteil vom ersten bis zum letzten harten Abschnitt (inkl.
 * Trabpausen dazwischen). Ergebnis in Sekunden.
 */
export function hardSeconds(steps: readonly WorkoutStep[], workOnly: boolean): number {
  const min = COMPETITION_INTENSITY.hardEffortMin;
  const hard = steps.map((s) => s.effort >= min);
  if (workOnly) return steps.reduce((sum, s, i) => sum + (hard[i] ? s.seconds : 0), 0);
  const first = hard.indexOf(true);
  const last = hard.lastIndexOf(true);
  if (first < 0) return 0;
  return steps.slice(first, last + 1).reduce((sum, s) => sum + s.seconds, 0);
}

/** 80/20-Budget einer Woche in Sekunden: floor(20 % der Wochenminuten) Minuten. */
export function weeklyHardBudgetSeconds(weekMinutes: number): number {
  return Math.floor(weekMinutes * COMPETITION_INTENSITY.hardShareMax) * 60;
}

// ---------------------------------------------------------------------------------------------------------
// Pace (Riegel) und Distanz-Richtwert
// ---------------------------------------------------------------------------------------------------------

/** Riegel-Formel T₂ = T₁ × (D₂/D₁)^1,06 (Riegel 1981). Sekunden. */
export function riegelTime(timeS: number, fromM: number, toM: number): number {
  if (!(timeS > 0 && fromM > 0 && toM > 0))
    throw new RangeError('Zeit und Distanzen müssen positiv sein.');
  return timeS * (toM / fromM) ** COMPETITION_PACE.riegelExponent;
}

/**
 * Darf Riegel von der Referenz auf diese Distanz hochgerechnet werden? Nur bis zum Faktor 4 in beide Richtungen
 * (COMPETITION_PACE.maxRiegelDistanceFactor, Wächter M3) – darüber zu optimistisch.
 */
export function riegelReliable(
  reference: CompetitionReference,
  discipline: CompetitionDiscipline,
): boolean {
  // Riegel nur für Laufen (WP5: Rad und Triathlon ohne Zielzeit und Pace).
  if (!isRunCompetitionDiscipline(discipline)) return false;
  const from = COMPETITION_DISTANCE_M[reference.discipline];
  const to = COMPETITION_DISTANCE_M[discipline];
  return Math.max(from / to, to / from) <= COMPETITION_PACE.maxRiegelDistanceFactor;
}

/** Vorhergesagte Zeit (s) für eine Wettkampf-Distanz aus der Referenzzeit. */
export function predictedTimeS(
  reference: CompetitionReference,
  discipline: RunCompetitionDiscipline,
): number {
  return riegelTime(
    reference.timeS,
    COMPETITION_DISTANCE_M[reference.discipline],
    COMPETITION_DISTANCE_M[discipline],
  );
}

/** Spanne in s/km: `fastSPerKm` (schnelles Ende) bis `slowSPerKm`; ganze Sekunden. */
export interface PaceSpan {
  readonly fastSPerKm: number;
  readonly slowSPerKm: number;
}

/** Basis für Pace-Richtwerte: Referenzzeit + Renn-Disziplin (null = keine Referenz → keine Pace). */
export interface PaceProfile {
  readonly reference: CompetitionReference;
  readonly discipline: RunCompetitionDiscipline;
}

/** Hinweis zu jeder Pace (Plan 3.4) – immer mit anzeigen. */
export const PACE_NOTICE_DE =
  'Die Anstrengung hat Vorrang – bei Hitze, Wind und Steigungen langsamer.';

/**
 * Pace-Spanne je Art (Plan 3.4): aus der Referenzzeit mit Riegel; Fahrtspiel und Steigerungen nach Gefühl (null);
 * null auch, wenn die Basis-Distanz mehr als Faktor 4 von der Referenz entfernt ist (riegelReliable).
 * Ohne Referenz immer null (W-G6: kein Maximaltest, keine geschätzte Pace).
 */
export function paceTargets(profile: PaceProfile | null, type: WorkoutType): PaceSpan | null {
  if (profile === null) return null;
  const spans: Readonly<Record<string, { base: string; fast: number; slow: number }>> =
    COMPETITION_PACE.spansSPerKm;
  const span = spans[type];
  if (!span) return null;
  const target: RunCompetitionDiscipline =
    span.base === 'race' ? profile.discipline : (span.base as RunCompetitionDiscipline);
  if (!riegelReliable(profile.reference, target)) return null;
  const perKm = predictedTimeS(profile.reference, target) / (COMPETITION_DISTANCE_M[target] / 1000);
  return { fastSPerKm: Math.round(perKm + span.fast), slowSPerKm: Math.round(perKm + span.slow) };
}

/**
 * Distanz-Richtwert (Plan 3.6): Dauer ÷ langsames Ende der Spanne, abgerundet auf 0,5 km (vorsichtig kürzer); unter
 * 0,1 km bzw. ohne Pace null, höchstens 60 km.
 */
export function distanceHint(minutes: number, pace: PaceSpan | null): number | null {
  if (pace === null || !(minutes > 0) || !(pace.slowSPerKm > 0)) return null;
  const P = COMPETITION_PACE;
  const meters = ((minutes * 60) / pace.slowSPerKm) * 1000;
  const rounded = Math.floor(meters / P.distanceRoundingM) * P.distanceRoundingM;
  if (rounded < P.distanceM.min) return null;
  return Math.min(rounded, P.distanceM.max);
}

/**
 * Zielzeit-Plausibilität gegen die Referenzzeit (Plan 3.2/3.4): plausibel, wenn die Zielzeit höchstens 5 % schneller
 * ist als die Riegel-Vorhersage. Ohne Referenz oder mit zu weit entfernter Referenz-Distanz (Faktor > 4) nie plausibel.
 */
export function goalTimePlausible(
  reference: CompetitionReference | null,
  discipline: CompetitionDiscipline,
  targetTimeS: number | null,
): boolean {
  if (reference === null || targetTimeS === null) return false;
  if (!isRunCompetitionDiscipline(discipline) || !riegelReliable(reference, discipline)) {
    return false;
  }
  const predicted = predictedTimeS(reference, discipline);
  return targetTimeS >= predicted * (1 - COMPETITION_PACE.goalTimeMaxImprovement);
}

// ---------------------------------------------------------------------------------------------------------
// 4b: neue Fassung `endurance_reduce` (Risiko 7)
// ---------------------------------------------------------------------------------------------------------

/**
 * Ab welcher eingetragenen Anstrengung ist ein Ausdauer-Eintrag „zu hart“ (Vorschlag für 4b R3)? Lockere Ziele (≤ 4)
 * und ohne Ziel: max(7, Ziel + 3) = 7 wie bisher; harte Ziele: Ziel + 2, höchstens 9 (Wächter N4).
 */
export function enduranceOverloadThreshold(effortTarget: number | null): number {
  const R = ENDURANCE_OVERLOAD_RULE;
  if (effortTarget === null || effortTarget <= R.easyTargetMax) {
    return Math.max(R.minEffort, (effortTarget ?? 0) + R.margin);
  }
  return Math.min(R.hardMaxEffort, Math.max(R.minEffort, effortTarget + R.hardMargin));
}

/** Zählt der Eintrag für `endurance_reduce`? (Vorschlag 4b, mit Abstand zum Ziel statt fester 7.) */
export function isEnduranceOverload(effortTarget: number | null, loggedEffort: number): boolean {
  return loggedEffort >= enduranceOverloadThreshold(effortTarget);
}

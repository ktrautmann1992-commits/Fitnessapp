import { z } from 'zod';

import {
  COMPETITION_DISTANCE_M,
  COMPETITION_INTENSITY,
  COMPETITION_PACE,
  ENDURANCE_OVERLOAD_RULE,
} from '../constants';
import type { ExperienceLevel } from '../enums';
import type { CompetitionDiscipline, CompetitionReference } from './competition-schema';
import type { PlanSafetyRules } from './safety';

/**
 * Intensität ohne Pulsuhr (docs/PLAN-PHASE-10.md Abschnitte 3.3, 3.4, 3.6 und 6, Etappe WP2): Einheiten-Arten, harte
 * Arten, 80/20-Zählung, Pace-Richtwerte nach Riegel, Distanz-Richtwert, Zielzeit-Plausibilität und die neue Fassung
 * der 4b-Regel `endurance_reduce`. Reine Funktionen, keine KI, kein Puls (W-G7).
 */

/** Einheiten-Arten (Plan 3.4; `brick`/`technique` folgen mit WP5). */
export const WORKOUT_TYPES = [
  'easy',
  'recovery',
  'long',
  'strides',
  'fartlek',
  'tempo',
  'intervals',
  'race_pace',
] as const;
export type WorkoutType = (typeof WORKOUT_TYPES)[number];

/** Harte Arten (zählen für 48-h-Regel, Wochen-Deckel, „Erholungswoche ohne harte Einheit“). */
export const HARD_WORKOUT_TYPES = ['fartlek', 'tempo', 'intervals', 'race_pace'] as const;

export function isHardWorkoutType(type: WorkoutType | null | undefined): boolean {
  return (
    type !== null && type !== undefined && (HARD_WORKOUT_TYPES as readonly string[]).includes(type)
  );
}

/** Schritt einer Einheit (Timer in WP4): Teil, Art, Dauer in Sekunden, Anstrengung 0–10. */
export interface WorkoutStep {
  readonly part: 'warmup' | 'main' | 'cooldown';
  readonly kind: 'work' | 'easy' | 'rest';
  readonly seconds: number;
  readonly effort: number;
}

/**
 * Grenzen der Schritte (Vorlage für `workout_steps jsonb` in WP3): höchstens 40 Schritte, je 10 s bis 4 h,
 * Anstrengung 0–10 ganzzahlig.
 */
export const WORKOUT_STEP_LIMITS = { maxSteps: 40, seconds: { min: 10, max: 4 * 3600 } } as const;

export const workoutStepSchema = z.strictObject({
  part: z.enum(['warmup', 'main', 'cooldown']),
  kind: z.enum(['work', 'easy', 'rest']),
  seconds: z
    .number()
    .int()
    .min(WORKOUT_STEP_LIMITS.seconds.min)
    .max(WORKOUT_STEP_LIMITS.seconds.max),
  effort: z.number().int().min(0).max(10),
});
export const workoutStepsSchema = z
  .array(workoutStepSchema)
  .min(1)
  .max(WORKOUT_STEP_LIMITS.maxSteps);

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

/** Vorhergesagte Zeit (s) für eine Wettkampf-Distanz aus der Referenzzeit. */
export function predictedTimeS(
  reference: CompetitionReference,
  discipline: CompetitionDiscipline,
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
  readonly discipline: CompetitionDiscipline;
}

/** Hinweis zu jeder Pace (Plan 3.4) – immer mit anzeigen. */
export const PACE_NOTICE_DE =
  'Die Anstrengung hat Vorrang – bei Hitze, Wind und Steigungen langsamer.';

/**
 * Pace-Spanne je Art (Plan 3.4): aus der Referenzzeit mit Riegel; Fahrtspiel und Steigerungen nach Gefühl (null).
 * Ohne Referenz immer null (W-G6: kein Maximaltest, keine geschätzte Pace).
 */
export function paceTargets(profile: PaceProfile | null, type: WorkoutType): PaceSpan | null {
  if (profile === null) return null;
  const spans: Readonly<Record<string, { base: string; fast: number; slow: number }>> =
    COMPETITION_PACE.spansSPerKm;
  const span = spans[type];
  if (!span) return null;
  const target: CompetitionDiscipline =
    span.base === 'race' ? profile.discipline : (span.base as CompetitionDiscipline);
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
 * ist als die Riegel-Vorhersage. Ohne Referenz nie plausibel (Zielzeit braucht eine Referenz, W-G6).
 */
export function goalTimePlausible(
  reference: CompetitionReference | null,
  discipline: CompetitionDiscipline,
  targetTimeS: number | null,
): boolean {
  if (reference === null || targetTimeS === null) return false;
  const predicted = predictedTimeS(reference, discipline);
  return targetTimeS >= predicted * (1 - COMPETITION_PACE.goalTimeMaxImprovement);
}

// ---------------------------------------------------------------------------------------------------------
// 4b: neue Fassung `endurance_reduce` (Risiko 7)
// ---------------------------------------------------------------------------------------------------------

/**
 * Ab welcher eingetragenen Anstrengung ist ein Ausdauer-Eintrag „zu hart“ (Vorschlag für 4b R3)? max(7, Ziel + 3),
 * höchstens 10. Lockere Ziele (≤ 4) → 7 wie bisher; ohne Ziel 7.
 */
export function enduranceOverloadThreshold(effortTarget: number | null): number {
  const R = ENDURANCE_OVERLOAD_RULE;
  if (effortTarget === null) return R.minEffort;
  return Math.min(R.maxEffort, Math.max(R.minEffort, effortTarget + R.margin));
}

/** Zählt der Eintrag für `endurance_reduce`? (Vorschlag 4b, mit Abstand zum Ziel statt fester 7.) */
export function isEnduranceOverload(effortTarget: number | null, loggedEffort: number): boolean {
  return loggedEffort >= enduranceOverloadThreshold(effortTarget);
}

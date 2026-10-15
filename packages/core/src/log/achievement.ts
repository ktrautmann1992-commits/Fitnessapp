import { z } from 'zod';

import { LOAD_PROGRESSION, SESSION_ACHIEVEMENT } from '../constants';
import { EXERCISE_LOG_STATUSES, LOAD_TYPES } from '../enums';
import type { IncrementKind } from '../plan/loads';

/**
 * „Trainingsziel erreicht“ (docs/PLAN-AUSWERTUNG.md 2.5, A-G11, Etappe A2): Erfüllungsgrad 0–100 % einer
 * eingetragenen Einheit, nach oben gekappt (mehr bringt keine Extra-Punkte). Rein, ohne Zugriff auf Plan oder Datenbank:
 * Die App gibt die Vorgaben aus dem Schnappschuss des Eintrags (`exercise_logs.target_*`) und die eingetragenen Sätze
 * bzw. Minuten hinein. Alle Schwellen stehen in `SESSION_ACHIEVEMENT` (constants.ts).
 *
 * - Kraft: Satz erfüllt = abgehakt UND Wdh. ≥ `reps_min` (sonst `target_reps`; Halteübung: Dauer ≥ 90 % der Vorgabe)
 *   UND Gewicht ≥ Vorgabe − eine Gewichtsstufe. Übung = erfüllte Sätze / Vorgabe-Sätze; ausgelassen = 0; Alternative
 *   gegen ihre eigene gespeicherte Vorgabe. Einheit = Mittel über alle Übungen MIT Vorgabe.
 * - Ohne Vorgabe (Kalibrierung ohne Satzvorgabe, freie Einheit): nur „gemacht“, kein Prozentwert.
 * - Ausdauer: eingetragene Minuten / geplante Minuten. Distanz nur Anzeige. Anstrengung deutlich über der Vorgabe und
 *   „länger als geplant“ sind Hinweise, nie „nicht erreicht“.
 * Erholungs- und Einstiegswoche: gleiche Rechnung, die App zeigt „Erholungswoche – leichter ist hier richtig“.
 * Keine Gesundheitsdaten (Trainingsheft, Plan 2.7); trotzdem nie loggen.
 */

const count = z.number().int().min(0);
const nonNegative = z.number().finite().min(0);

const achievementSetSchema = z.strictObject({
  done: z.boolean(),
  reps: count.nullable(),
  weightKg: nonNegative.nullable(),
  durationS: nonNegative.nullable(),
});

const incrementKindSchema = z.enum(['barbell', 'machine', 'free_weight', 'none']);

const achievementExerciseSchema = z.strictObject({
  status: z.enum(EXERCISE_LOG_STATUSES),
  loadType: z.enum(LOAD_TYPES),
  targetSets: count.nullable(),
  repsMin: count.nullable(),
  targetReps: count.nullable(),
  targetWeightKg: nonNegative.nullable(),
  targetDurationS: nonNegative.nullable(),
  /** Art der Gewichtssteigerung der Übung; null = unbekannt (dann zählt nur die Vorgabe selbst, ohne Stufe darunter). */
  incrementKind: incrementKindSchema.nullable(),
  /** Eigene Gewichtsstufen am Ort (weightStepsFor); leer = Standard-Schritte. */
  steps: z.array(nonNegative).readonly(),
  sets: z.array(achievementSetSchema).readonly(),
});

/** Erholungswoche (`is_deload`) bzw. Einstiegswoche (`is_intro_week`); null = normale Belastungswoche. */
const easyWeekSchema = z.enum(['recovery', 'intro']).nullable();

const sessionAchievementInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('strength'),
    isFree: z.boolean(),
    easyWeek: easyWeekSchema,
    exercises: z.array(achievementExerciseSchema).readonly(),
  }),
  z.strictObject({
    kind: z.literal('endurance'),
    isFree: z.boolean(),
    easyWeek: easyWeekSchema,
    /** Geplante Minuten (`planned_sessions.estimated_minutes`); null = ohne Vorgabe. */
    plannedMinutes: nonNegative.nullable(),
    /** Anstrengung laut Plan (0–10); null = ohne Vorgabe. */
    effortTarget: nonNegative.nullable(),
    durationS: nonNegative.nullable(),
    distanceM: nonNegative.nullable(),
    /** Eingetragene Anstrengung (0–10); null = ohne Angabe. */
    sessionRpe: nonNegative.nullable(),
  }),
]);

export type AchievementSetInput = z.input<typeof achievementSetSchema>;
export type AchievementExerciseInput = z.input<typeof achievementExerciseSchema>;
export type SessionAchievementInput = z.input<typeof sessionAchievementInputSchema>;

/**
 * Stufe (2.5): `reached` ≥ 90 %, `mostly` 60–89 %, `partly` 1–59 %, `none` = eingetragen, aber 0 % (z. B. alle Übungen
 * ausgelassen), `done` = ohne Vorgabe („gemacht“, kein Prozentwert), `logged` = geplante Ausdauer OHNE eingetragene Dauer
 * (nur „eingetragen“ – nie wie „erreicht“ dargestellt, Wächter A2 H4).
 */
export type AchievementLevel = 'reached' | 'mostly' | 'partly' | 'none' | 'done' | 'logged';

/** Hinweise, die nie „nicht erreicht“ bedeuten. */
export type AchievementHint = 'effort_above_plan' | 'longer_than_planned';

export interface ExerciseAchievement {
  readonly status: (typeof EXERCISE_LOG_STATUSES)[number];
  /** Vorgabe-Sätze; null = ohne Vorgabe (kein Prozentwert). */
  readonly targetSets: number | null;
  /** Erfüllte Sätze (höchstens `targetSets`). */
  readonly fulfilledSets: number;
  /** Abgehakte Sätze (unabhängig von der Vorgabe). */
  readonly doneSets: number;
  /** 0–100, null ohne Vorgabe. */
  readonly percent: number | null;
}

export interface SessionAchievement {
  readonly kind: 'strength' | 'endurance';
  /** 0–100 (abgerundet, gekappt), null = ohne Vorgabe. */
  readonly percent: number | null;
  readonly level: AchievementLevel;
  /** Erholungs- bzw. Einstiegswoche (Text „leichter ist hier richtig“); null = Belastungswoche. */
  readonly easyWeek: 'recovery' | 'intro' | null;
  readonly exercises: readonly ExerciseAchievement[];
  /** Nur Ausdauer: eingetragene und geplante Minuten (ganze Minuten, abgerundet) und Distanz in m. */
  readonly endurance: {
    readonly minutes: number;
    readonly plannedMinutes: number | null;
    readonly distanceM: number | null;
  } | null;
  readonly hints: readonly AchievementHint[];
}

const EPS = 1e-9;

/**
 * Kleinstes Gewicht, das noch als „Vorgabe erreicht“ zählt: Vorgabe − eine Gewichtsstufe. Langhantel/Maschine wie
 * LOAD_PROGRESSION, freie Gewichte: nächstkleinere eigene Stufe (gibt es keine, gilt die Vorgabe), ohne eigene Stufen
 * der Standard-Schritt. Unbekannte Übung (`null`) bzw. ohne Gewichtssteigerung: die Vorgabe selbst.
 */
export function achievementWeightFloorKg(
  targetKg: number,
  kind: IncrementKind | null,
  steps: readonly number[] = [],
): number {
  let floor = targetKg;
  if (kind === 'barbell') floor = targetKg - LOAD_PROGRESSION.barbellIncrementKg;
  else if (kind === 'machine') floor = targetKg - LOAD_PROGRESSION.machineIncrementKg;
  else if (kind === 'free_weight') {
    if (steps.length === 0) floor = targetKg - LOAD_PROGRESSION.defaultFreeWeightIncrementKg;
    else {
      const lower = steps.filter((s) => s < targetKg - EPS);
      floor = lower.length === 0 ? targetKg : Math.max(...lower);
    }
  }
  return Math.max(0, floor);
}

type ParsedExercise = z.output<typeof achievementExerciseSchema>;

function setFulfilled(exercise: ParsedExercise, set: ParsedExercise['sets'][number]): boolean {
  if (!set.done) return false;
  if (exercise.loadType === 'time') {
    if (exercise.targetDurationS === null) return true;
    return (
      (set.durationS ?? 0) + EPS >=
      exercise.targetDurationS * SESSION_ACHIEVEMENT.holdDurationFraction
    );
  }
  const repsThreshold = exercise.repsMin ?? exercise.targetReps;
  if (repsThreshold !== null && (set.reps ?? 0) < repsThreshold) return false;
  if (exercise.loadType === 'weight' && exercise.targetWeightKg !== null) {
    const floor = achievementWeightFloorKg(
      exercise.targetWeightKg,
      exercise.incrementKind,
      exercise.steps,
    );
    if (set.weightKg === null || set.weightKg + EPS < floor) return false;
  }
  return true;
}

function exerciseAchievement(exercise: ParsedExercise): ExerciseAchievement {
  const doneSets = exercise.sets.filter((s) => s.done).length;
  const target =
    exercise.targetSets !== null && exercise.targetSets > 0 ? exercise.targetSets : null;
  if (target === null) {
    return { status: exercise.status, targetSets: null, fulfilledSets: 0, doneSets, percent: null };
  }
  const fulfilled =
    exercise.status === 'skipped'
      ? 0
      : Math.min(target, exercise.sets.filter((s) => setFulfilled(exercise, s)).length);
  return {
    status: exercise.status,
    targetSets: target,
    fulfilledSets: fulfilled,
    doneSets,
    percent: toPercent(fulfilled / target),
  };
}

/** Anteil → ganze Prozent, abgerundet (89,9 % ist noch nicht „erreicht“), auf 0–100 gekappt. */
function toPercent(fraction: number): number {
  return Math.max(0, Math.min(100, Math.floor(fraction * 100 + EPS)));
}

/** Stufe zu einem Prozentwert (2.5). */
export function achievementLevel(percent: number | null): AchievementLevel {
  if (percent === null) return 'done';
  if (percent >= SESSION_ACHIEVEMENT.reachedMinPercent) return 'reached';
  if (percent >= SESSION_ACHIEVEMENT.mostlyMinPercent) return 'mostly';
  if (percent >= 1) return 'partly';
  return 'none';
}

/** Erfüllungsgrad einer eingetragenen Einheit (2.5). */
export function sessionAchievement(rawInput: SessionAchievementInput): SessionAchievement {
  const input = sessionAchievementInputSchema.parse(rawInput);
  if (input.kind === 'strength') {
    const exercises = input.exercises.map(exerciseAchievement);
    const targeted = exercises.filter((e) => e.targetSets !== null);
    let percent: number | null = null;
    if (!input.isFree && targeted.length > 0) {
      const sum = targeted.reduce(
        (total, e) => total + e.fulfilledSets / (e.targetSets as number),
        0,
      );
      percent = toPercent(sum / targeted.length);
    }
    return {
      kind: 'strength',
      percent,
      level: achievementLevel(percent),
      easyWeek: input.easyWeek,
      // Freie Einheit: keine Vorgabe je Übung – nur abgehakte Sätze.
      exercises: input.isFree
        ? exercises.map((e) => ({ ...e, targetSets: null, fulfilledSets: 0, percent: null }))
        : exercises,
      endurance: null,
      hints: [],
    };
  }
  const minutesExact = (input.durationS ?? 0) / 60;
  const planned =
    !input.isFree && input.plannedMinutes !== null && input.plannedMinutes > 0
      ? input.plannedMinutes
      : null;
  const percent =
    planned !== null && input.durationS !== null ? toPercent(minutesExact / planned) : null;
  const hints: AchievementHint[] = [];
  if (
    input.sessionRpe !== null &&
    input.effortTarget !== null &&
    !input.isFree &&
    input.sessionRpe > input.effortTarget + SESSION_ACHIEVEMENT.effortHintAboveTarget
  ) {
    hints.push('effort_above_plan');
  }
  if (
    planned !== null &&
    minutesExact > planned * SESSION_ACHIEVEMENT.longerThanPlannedFraction + EPS
  ) {
    hints.push('longer_than_planned');
  }
  return {
    kind: 'endurance',
    percent,
    level: planned !== null && input.durationS === null ? 'logged' : achievementLevel(percent),
    easyWeek: input.easyWeek,
    exercises: [],
    endurance: {
      minutes: Math.floor(minutesExact + EPS),
      plannedMinutes: planned,
      distanceM: input.distanceM,
    },
    hints,
  };
}

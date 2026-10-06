import {
  LOAD_PROGRESSION,
  PLANNED_LOAD_LIMITS,
  SESSION_LOG_LIMITS,
  SET_RPE_LIMITS,
  WEEKLY_SET_CONTRIBUTION,
} from '../constants';
import type { Exercise } from '../content/schemas';
import type {
  ExerciseLogStatus,
  ExperienceLevel,
  LoadType,
  PlannedSessionKind,
  SessionLogStatus,
} from '../enums';
import type { PlannedExerciseDraft } from '../plan/adapt';
import { type EquipmentProfile, isExerciseFeasible } from '../plan/equipment-profile';
import { type IncrementKind, incrementKindFor } from '../plan/loads';
import { isExerciseAllowed, type PlanSafetyRules } from '../plan/safety';
import type { DisplaySession, StoredSession } from '../plan/view';
import { type DisplayHint, progressHintForDisplay } from './harder-variant';
import {
  type Prescription,
  prescriptionForDisplay,
  progressFromLogs,
  type ProgressResult,
  stateToStore,
} from './progression';
import type { SessionLogPayload } from './schemas';
import type { ExerciseLogEntry, ExerciseProgress, LoggedSet, ProgressionContext } from './types';

/**
 * Trainingsmodus (docs/PLAN-PHASE-4.md Abschnitte 5.1, 6.1 Punkt 2, Etappe C): aus der ANGEZEIGTEN Einheit
 * (prepareSessionForDisplay mit den aktuellen Sicherheitsregeln) und dem Tagebuch je Übung die heutige Vorgabe, den
 * zu speichernden Zustand (`state_*`) und den Hinweis der Progression berechnen. Die App bildet nur ab.
 *
 * Reihenfolge (5.1): Progression zuerst, die Sicherheitsregeln wirken danach – prescriptionForDisplay() bekommt das
 * RPE der angezeigten Einheit (schon gedeckelt) und zusätzlich den aktuellen Deckel `rules.rpeMax`.
 */

const EPS = 1e-9;

// ---------------------------------------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------------------------------------

/**
 * Vorlagen-Satzzahl (W7) und RPE-Ziel einer Belastungswoche (ohne Einstiegs-/Erholungsabschlag) einer Übung im
 * Plan: längste Fassung = meiste Sätze in Einheiten ohne Erholungs- und Einstiegswoche; das RPE-Ziel aus derselben
 * Fassung. Kommt die Übung nur in Einstiegs-/Erholungswochen vor (z. B. Woche 0), gilt die heutige Vorgabe.
 */
export function referenceDosage(
  planSessions: readonly Pick<StoredSession, 'is_deload' | 'is_intro_week' | 'exercises'>[],
  exerciseId: string,
  today: Pick<PlannedExerciseDraft, 'sets' | 'rpe_target'>,
): { readonly templateSets: number; readonly rpeTarget: number } {
  let best: { sets: number; rpe: number } | null = null;
  for (const session of planSessions) {
    if (session.is_deload || session.is_intro_week) continue;
    for (const e of session.exercises) {
      if (e.exercise_id !== exerciseId) continue;
      if (best === null || e.sets > best.sets) best = { sets: e.sets, rpe: e.rpe_target };
    }
  }
  return {
    templateSets: Math.max(best?.sets ?? today.sets, today.sets),
    rpeTarget: best?.rpe ?? today.rpe_target,
  };
}

/**
 * Gewichtsstufen am Ort der Einheit für eine Gewichtsübung: zu Hause die eigenen Stufen des ersten Geräts der
 * Übung mit bekannten Stufen (Kurzhanteln/Kettlebells je Stück, Langhantel als Gesamtgewichte); im Studio keine
 * (0,5-kg-Raster, Studio-Geräte sind nicht erfasst). Keine Gewichtsübung → keine Stufen.
 */
export function weightStepsFor(
  exercise: Pick<Exercise, 'load_type' | 'equipment_ids'>,
  profile: Pick<EquipmentProfile, 'location' | 'weights'>,
): readonly number[] {
  if (exercise.load_type !== 'weight' || profile.location !== 'home') return [];
  for (const id of exercise.equipment_ids) {
    const steps = profile.weights.get(id);
    if (steps && steps.length > 0) return [...steps].sort((a, b) => a - b);
  }
  return [];
}

/**
 * Darf heute ein Zusatzsatz dazukommen (V9)? Nur, wenn +1 Satz dieser Übung die Wochensätze keiner ihrer
 * Hauptmuskeln über die Obergrenze der Vorlage (WEEKLY_SETS_PER_MUSCLE) hebt. Gezählt werden die nicht gestrichenen
 * Kraft-Einheiten der Woche (Hauptmuskel 1, Nebenmuskel 0,5 je Satz). Ohne Obergrenze (unbekannte Vorlage): nein.
 */
export function extraSetAllowed(
  exercise: Pick<Exercise, 'primary_muscles'>,
  weekSessions: readonly Pick<StoredSession, 'status' | 'kind' | 'exercises'>[],
  library: ReadonlyMap<string, Pick<Exercise, 'primary_muscles' | 'secondary_muscles'>>,
  weeklyMax: number | null,
): boolean {
  if (weeklyMax === null) return false;
  const sets = new Map<string, number>();
  for (const session of weekSessions) {
    if (session.status === 'skipped' || session.kind !== 'strength') continue;
    for (const item of session.exercises) {
      const ex = library.get(item.exercise_id);
      if (!ex) continue;
      for (const m of ex.primary_muscles) {
        sets.set(m, (sets.get(m) ?? 0) + item.sets * WEEKLY_SET_CONTRIBUTION.primary);
      }
      for (const m of ex.secondary_muscles) {
        sets.set(m, (sets.get(m) ?? 0) + item.sets * WEEKLY_SET_CONTRIBUTION.secondary);
      }
    }
  }
  return exercise.primary_muscles.every(
    (m) =>
      (sets.get(m) ?? 0) + WEEKLY_SET_CONTRIBUTION.primary * LOAD_PROGRESSION.extraSets <=
      weeklyMax + EPS,
  );
}

/** Progressions-Kontext einer Übung (die tatsächlich gemachte, bei einer Alternative deren Merkmale). */
export function progressionContextFor(params: {
  readonly exercise: Pick<Exercise, 'load_type' | 'equipment_ids'>;
  readonly planned: Pick<PlannedExerciseDraft, 'reps_min' | 'reps_max' | 'duration_s'>;
  readonly reference: { readonly templateSets: number; readonly rpeTarget: number };
  readonly steps: readonly number[];
  readonly allowExtraSet: boolean;
}): ProgressionContext {
  return {
    loadType: params.exercise.load_type,
    repsMin: params.planned.reps_min,
    repsMax: params.planned.reps_max,
    durationS: params.planned.duration_s,
    templateSets: params.reference.templateSets,
    rpeTarget: params.reference.rpeTarget,
    incrementKind: incrementKindFor(params.exercise),
    steps: params.steps,
    allowExtraSet: params.allowExtraSet,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Eine Übung planen
// ---------------------------------------------------------------------------------------------------------

/** Alles, was der Trainingsmodus für eine Übung (geplant oder Alternative) anzeigt und speichert. */
export interface WorkoutExercisePlan {
  readonly exerciseId: string;
  readonly nameDe: string;
  readonly loadType: LoadType;
  readonly incrementKind: IncrementKind;
  /** Geräte der Übung (Anzeige „je Hantel“/„je Kugel“). */
  readonly equipmentIds: readonly string[];
  /** Gewichtsstufen am Ort (−/+ und Warnungen). */
  readonly steps: readonly number[];
  readonly progress: ProgressResult;
  readonly prescription: Prescription;
  /** Zustand VOR dieser Einheit (`state_*`), null = ohne Zustand (stateToStore). */
  readonly state: ExerciseProgress | null;
  /** Hinweis nur über progressHintForDisplay() (Pflichtpunkt: `harder_variant` nie ohne Variantenname). */
  readonly hint: DisplayHint;
  /** Bezug der 10-%-Warnung: max(Zustand, angezeigtes Gewicht) (Etappe A, „für Etappe C festgehalten“). */
  readonly heavierReferenceKg: number | null;
  /** Bezug der Leichter-Warnung: der Zustand. */
  readonly lighterReferenceKg: number | null;
}

export interface PlanExerciseContext {
  /** Übungen mit Merkmalen (auch archivierte des laufenden Plans bzw. Tagebuchs). */
  readonly library: ReadonlyMap<string, Exercise>;
  /** Nur freigegebene Inhalte (Engine) – für Variante und Alternativen. */
  readonly engineLibrary: ReadonlyMap<string, Exercise>;
  readonly profile: EquipmentProfile;
  readonly rules: PlanSafetyRules;
  readonly experienceLevel: ExperienceLevel;
  /** Tagebuch-Einträge (ohne den Eintrag, der gerade geändert wird). */
  readonly entries: readonly ExerciseLogEntry[];
  /** Eigene Startgewichte (exercise_start_weights) je Übung. */
  readonly startWeights: ReadonlyMap<string, number>;
  readonly today: string;
  readonly isDeload: boolean;
  /** Woche der Einheit (für V9) und Obergrenze Wochensätze der Vorlage (null = unbekannt). */
  readonly weekSessions: readonly Pick<StoredSession, 'status' | 'kind' | 'exercises'>[];
  readonly weeklySetMax: number | null;
}

/**
 * Vorgabe und Zustand einer Übung für heute: `planned` ist die geplante (angezeigte) Übung des Termins; `exercise`
 * die tatsächlich gemachte (bei einer Alternative deren Merkmale – eigener Verlauf, R2). Dosierung (Sätze,
 * Wdh.-Bereich, Dauer, RPE) kommt immer aus dem Termin; das RPE des Termins ist schon nach den aktuellen
 * Sicherheitsregeln gedeckelt.
 */
export function planWorkoutExercise(
  exercise: Exercise,
  planned: PlannedExerciseDraft,
  reference: { readonly templateSets: number; readonly rpeTarget: number },
  ctx: PlanExerciseContext,
): WorkoutExercisePlan {
  const steps = weightStepsFor(exercise, ctx.profile);
  const allowExtraSet = extraSetAllowed(exercise, ctx.weekSessions, ctx.library, ctx.weeklySetMax);
  const progressionContext = progressionContextFor({
    exercise,
    planned,
    reference,
    steps,
    allowExtraSet,
  });
  const startWeight = ctx.startWeights.get(exercise.id) ?? null;
  const progress = progressFromLogs(exercise.id, ctx.entries, progressionContext, {
    today: ctx.today,
    startWeightKg: startWeight,
    // Ein gespeichertes Startgewicht über der absoluten Schwelle wurde beim Eintragen bestätigt (die App speichert
    // es erst nach der Bestätigung).
    startWeightConfirmed: startWeight !== null,
  });
  const prescription = prescriptionForDisplay(
    {
      sets: planned.sets,
      reps_min: planned.reps_min,
      reps_max: planned.reps_max,
      duration_s: planned.duration_s,
      rpe_target: planned.rpe_target,
    },
    progress,
    { isDeload: ctx.isDeload, steps, allowExtraSet, rpeMax: ctx.rules.rpeMax },
  );
  const state = stateToStore(progress);
  const hint = progressHintForDisplay(exercise.id, progress, {
    library: ctx.engineLibrary,
    profile: ctx.profile,
    rules: ctx.rules,
    experienceLevel: ctx.experienceLevel,
  });
  const stateWeight = state?.weightKg ?? null;
  const heavier =
    stateWeight === null && prescription.weightKg === null
      ? null
      : Math.max(stateWeight ?? 0, prescription.weightKg ?? 0);
  return {
    exerciseId: exercise.id,
    nameDe: exercise.name_de,
    loadType: exercise.load_type,
    incrementKind: progressionContext.incrementKind,
    equipmentIds: exercise.equipment_ids,
    steps,
    progress,
    prescription,
    state,
    hint,
    heavierReferenceKg: heavier,
    lighterReferenceKg: stateWeight,
  };
}

/**
 * Erlaubte Alternativen für „Alternative durchgeführt“ (6.1): Alternativen der Übung (exercise_alternatives), die
 * nach den AKTUELLEN Sicherheitsregeln erlaubt, am Ort machbar und nicht schwerer sind und nicht Wiederholungs- gegen
 * Halteübung tauschen – gleiche Regeln wie findSubstitute(). Zusätzlich die von progressHintForDisplay()
 * vorgeschlagene schwerere Variante (wer sie macht, trägt sie als Alternative ein, 5.1). Sortiert nach Priorität.
 */
export function allowedAlternatives(
  exercise: Exercise,
  ctx: {
    readonly library: ReadonlyMap<string, Exercise>;
    readonly profile: Pick<EquipmentProfile, 'available'>;
    readonly rules: Pick<PlanSafetyRules, 'excludedCautionTags' | 'cautious'>;
    /** Übungen, die schon in der Einheit vorkommen. */
    readonly exclude?: ReadonlySet<string>;
    readonly harderVariantId?: string | null;
  },
): Exercise[] {
  const isTime = exercise.load_type === 'time';
  const result: Exercise[] = [];
  const sorted = [...exercise.alternatives].sort(
    (a, b) => a.priority - b.priority || (a.alternative_id < b.alternative_id ? -1 : 1),
  );
  for (const alt of sorted) {
    const candidate = ctx.library.get(alt.alternative_id);
    if (
      candidate === undefined ||
      candidate.id === exercise.id ||
      (ctx.exclude?.has(candidate.id) ?? false) ||
      (candidate.load_type === 'time') !== isTime ||
      !isExerciseFeasible(candidate, ctx.profile) ||
      !isExerciseAllowed(candidate, ctx.rules)
    ) {
      continue;
    }
    const harder = candidate.difficulty > exercise.difficulty;
    if (harder && candidate.id !== ctx.harderVariantId) continue;
    result.push(candidate);
  }
  const variant = ctx.harderVariantId ? ctx.library.get(ctx.harderVariantId) : undefined;
  if (
    variant &&
    !result.some((e) => e.id === variant.id) &&
    !(ctx.exclude?.has(variant.id) ?? false) &&
    isExerciseFeasible(variant, ctx.profile) &&
    isExerciseAllowed(variant, ctx.rules)
  ) {
    result.push(variant);
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------
// Ganze Einheit planen
// ---------------------------------------------------------------------------------------------------------

export interface WorkoutItem {
  /** Übung des GESPEICHERTEN Termins (planned_exercises.order_no) – für planned_exercise_id. */
  readonly plannedOrderNo: number;
  /** Gespeicherte Übung des Termins (vor den aktuellen Sicherheitsregeln). */
  readonly storedExerciseId: string;
  /** Angezeigte Übung (nach den Sicherheitsregeln; ggf. ersetzt, RPE gedeckelt). */
  readonly shown: PlannedExerciseDraft;
  /** Vorlagen-Satzzahl und RPE der Belastungswoche (referenceDosage) – auch für Alternativen. */
  readonly reference: { readonly templateSets: number; readonly rpeTarget: number };
  /** null = Übung nicht in der Bibliothek (nicht prüfbar). */
  readonly plan: WorkoutExercisePlan | null;
  readonly alternatives: readonly Exercise[];
}

/**
 * Ordnet die angezeigten Übungen den gespeicherten zu: prepareSessionForDisplay() blendet nicht erlaubte Übungen ohne
 * Ersatz aus und nummeriert neu, die Reihenfolge bleibt. Die k-te angezeigte Übung ist also die k-te nicht
 * ausgeblendete gespeicherte.
 */
export function alignShownExercises(
  stored: Pick<StoredSession, 'exercises'>,
  shown: Pick<DisplaySession<StoredSession>, 'session' | 'hidden'>,
): { readonly stored: PlannedExerciseDraft; readonly shown: PlannedExerciseDraft }[] {
  const hidden = [...shown.hidden];
  const visible = stored.exercises.filter((e) => {
    const index = hidden.indexOf(e.exercise_id);
    if (index === -1) return true;
    hidden.splice(index, 1);
    return false;
  });
  return shown.session.exercises.flatMap((e, i) => {
    const original = visible[i];
    return original ? [{ stored: original, shown: e }] : [];
  });
}

export function planWorkout(
  stored: StoredSession,
  shown: DisplaySession<StoredSession>,
  planSessions: readonly StoredSession[],
  ctx: PlanExerciseContext,
): WorkoutItem[] {
  const inSession = new Set(shown.session.exercises.map((e) => e.exercise_id));
  return alignShownExercises(stored, shown).map(({ stored: original, shown: item }) => {
    const exercise = ctx.library.get(item.exercise_id);
    const reference = referenceDosage(planSessions, original.exercise_id, item);
    if (!exercise) {
      return {
        plannedOrderNo: original.order_no,
        storedExerciseId: original.exercise_id,
        shown: item,
        reference,
        plan: null,
        alternatives: [],
      };
    }
    const plan = planWorkoutExercise(exercise, item, reference, ctx);
    return {
      plannedOrderNo: original.order_no,
      storedExerciseId: original.exercise_id,
      shown: item,
      reference,
      plan,
      alternatives: allowedAlternatives(exercise, {
        library: ctx.engineLibrary,
        profile: ctx.profile,
        rules: ctx.rules,
        exclude: inSession,
        harderVariantId: plan.hint.harderVariant?.exerciseId ?? null,
      }),
    };
  });
}

// ---------------------------------------------------------------------------------------------------------
// Eingabe im Trainingsmodus
// ---------------------------------------------------------------------------------------------------------

/** Vorbelegte Satz-Zeilen aus der Vorgabe (noch nicht abgehakt). */
export function initialSets(prescription: Prescription, loadType: LoadType): LoggedSet[] {
  return Array.from({ length: prescription.sets }, () => ({
    reps: loadType === 'time' ? null : prescription.targetReps,
    weightKg: loadType === 'weight' ? prescription.weightKg : null,
    durationS: loadType === 'time' ? prescription.durationS : null,
    rpe: null,
    done: false,
  }));
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Gewicht −/+ im Trainingsmodus: nächste eigene Stufe (Kurzhanteln/Kettlebells bzw. Langhantel-Gesamtgewichte am
 * Ort); ohne Stufen 2,5 kg (Langhantel/Maschine wie LOAD_PROGRESSION, freie Gewichte ebenso 2,5 kg-Raster).
 * Bleibt in 0–500 kg; leer (null) startet bei der kleinsten Stufe bzw. 2,5 kg.
 */
export function adjustWeight(
  current: number | null,
  direction: 1 | -1,
  steps: readonly number[],
): number | null {
  const { max } = PLANNED_LOAD_LIMITS.targetWeightKg;
  const sorted = [...steps].sort((a, b) => a - b);
  if (current === null) {
    return direction === 1 ? (sorted[0] ?? LOAD_PROGRESSION.barbellIncrementKg) : null;
  }
  if (sorted.length > 0) {
    if (direction === 1) {
      const next = sorted.find((s) => s > current + EPS);
      return next !== undefined ? next : current;
    }
    const lower = [...sorted].reverse().find((s) => s < current - EPS);
    return lower ?? current;
  }
  const step = LOAD_PROGRESSION.barbellIncrementKg;
  const next = direction === 1 ? current + step : current - step;
  return Math.min(max, Math.max(0, round2(next)));
}

/** Wiederholungen −/+ (0–100, SESSION_LOG_LIMITS). */
export function adjustReps(current: number | null, direction: 1 | -1): number {
  const { min, max } = SESSION_LOG_LIMITS.reps;
  return Math.min(max, Math.max(min, (current ?? 0) + direction));
}

/** Auswahl „Wie viele Wiederholungen wären noch gegangen?“: 0 … 5 (5 = „5+“). */
export const RESERVE_CHOICES = [0, 1, 2, 3, 4, 5] as const;
export type ReserveChoice = (typeof RESERVE_CHOICES)[number];

/** Wiederholungen in Reserve → Satz-RPE (10 − Reserve, „5+“ = RPE 5, Zourdos et al. 2016). */
export function rpeFromReserve(reserve: ReserveChoice): number {
  return Math.max(SET_RPE_LIMITS.min, SET_RPE_LIMITS.max - reserve);
}

/** Satz-RPE → Wiederholungen in Reserve (abgerundet auf ganze; RPE 5 und darunter = „5+“). */
export function reserveFromRpe(rpe: number | null): ReserveChoice | null {
  if (rpe === null) return null;
  const reserve = Math.min(5, Math.max(0, Math.floor(SET_RPE_LIMITS.max - rpe)));
  return reserve as ReserveChoice;
}

/**
 * Status einer Übung im Eintrag: „nicht gemacht“ = `skipped` (ohne Grund, S3); sonst `alternative`, wenn die
 * tatsächlich gemachte Übung nicht die geplante (gespeicherte) Übung des Termins ist – auch wenn die App sie wegen
 * einer Sicherheitsregel ersetzt angezeigt hat (der Server verlangt: gleiche Übung ⇔ `done`).
 */
export function exerciseLogStatusFor(
  skipped: boolean,
  actualExerciseId: string,
  plannedExerciseId: string | null,
): ExerciseLogStatus {
  if (skipped) return 'skipped';
  return plannedExerciseId !== null && actualExerciseId !== plannedExerciseId
    ? 'alternative'
    : 'done';
}

/**
 * Status der Einheit: `completed`, wenn keine Übung ausgelassen und jeder Satz abgehakt ist; sonst `partial`
 * (Ausdauer: immer `completed`).
 */
export function sessionLogStatus(
  kind: PlannedSessionKind,
  exercises: readonly {
    readonly status: ExerciseLogStatus;
    readonly sets: readonly Pick<LoggedSet, 'done'>[];
  }[],
): SessionLogStatus {
  if (kind === 'endurance') return 'completed';
  return exercises.length > 0 &&
    exercises.every((e) => e.status !== 'skipped' && e.sets.every((s) => s.done))
    ? 'completed'
    : 'partial';
}

/** Hat der Entwurf schon etwas Eingetragenes (abgehakter Satz oder Übung ausgelassen/getauscht)? */
export function hasLoggedSomething(
  exercises: readonly {
    readonly status: ExerciseLogStatus;
    readonly sets: readonly Pick<LoggedSet, 'done'>[];
  }[],
): boolean {
  return exercises.some((e) => e.status !== 'done' || e.sets.some((s) => s.done));
}

// ---------------------------------------------------------------------------------------------------------
// Neutralisieren (S1) – wie private.neutral_session_name / neutralize_health_plan_logs in der Datenbank
// ---------------------------------------------------------------------------------------------------------

/** Neutraler Einheiten-Name nach Widerruf bzw. für verwaiste Einträge (gleich wie die Datenbank). */
export function neutralSessionName(kind: PlannedSessionKind): string {
  return kind === 'endurance' ? 'Ausdauer-Einheit' : 'Kraft-Einheit';
}

/**
 * Eintrag aus einem Plan mit Gesundheits-Check neutralisieren (S1, R3): alle Vorgaben (`target_*`, Wdh.-Bereich)
 * und alle Zustände (`state_*`) leer, Name neutral. Ist-Werte (Übung, Sätze, Gewicht, Wdh., RPE, Notiz) bleiben.
 */
export function neutralizeSessionLogPayload(payload: SessionLogPayload): SessionLogPayload {
  return {
    ...payload,
    name_de: neutralSessionName(payload.kind),
    exercises: payload.exercises.map((e) => ({
      ...e,
      target_sets: null,
      reps_min: null,
      reps_max: null,
      target_reps: null,
      target_extra_set: null,
      target_weight_kg: null,
      target_duration_s: null,
      target_rpe: null,
      state_weight_kg: null,
      state_target_reps: null,
      state_extra_set: null,
      state_duration_s: null,
    })),
  };
}

/** Gewicht innerhalb der Eingabegrenze eines Satzes (0–500 kg, 2 Nachkommastellen)? */
export function isValidSetWeight(weightKg: number): boolean {
  return (
    Number.isFinite(weightKg) &&
    weightKg >= 0 &&
    weightKg <= SESSION_LOG_LIMITS.weightKg.max &&
    Math.abs(Math.round(weightKg * 100) - weightKg * 100) < 1e-6
  );
}

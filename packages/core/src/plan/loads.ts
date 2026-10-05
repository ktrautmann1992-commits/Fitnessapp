import {
  E1RM_ESTIMATE,
  LOAD_PROGRESSION,
  PLANNED_LOAD_LIMITS,
  TEMPLATE_DOSAGE_LIMITS,
} from '../constants';
import type { Exercise } from '../content/schemas';
import { clampRpe } from './adapt';
import type { LoadType } from '../enums';

/**
 * Startlasten und doppelte Progression (docs/PLAN-PHASE-3.md Abschnitte 5.8 und 5.9). Reine Funktionen; ab
 * Phase 4 mit echten Tagebuch-Einträgen gefüttert. Nie Maximaltests, nie Körpergewicht als Eingabe.
 */

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Größte eigene Gewichtsstufe, die `weightKg` nicht überschreitet (abgerundet). Ohne Stufen: auf 0,5 kg
 * abgerundet. null = keine passende Stufe (dann „leichteste Stufe wählen“).
 */
export function snapToAvailableWeight(
  weightKg: number,
  steps: readonly number[] = [],
): number | null {
  if (steps.length === 0) {
    const rounded = Math.floor(weightKg * 2) / 2;
    return rounded >= PLANNED_LOAD_LIMITS.targetWeightKg.min ? rounded : null;
  }
  const fitting = steps.filter((s) => s <= weightKg + 1e-9);
  return fitting.length === 0 ? null : Math.max(...fitting);
}

export interface CalibrationSet {
  readonly weightKg: number;
  readonly reps: number;
  /** RPE 5–10 laut Eintrag (10 − RPE = Wiederholungen in Reserve). */
  readonly rpe: number;
}

/**
 * Arbeitsgewicht aus einem Eintrag: Epley mit Wiederholungen in Reserve, nur bis 12 Wdh. + Reserve (darüber
 * bleibt das eingetragene Gewicht), nie mehr als 10 % über dem eingetragenen Gewicht, auf Stufen abgerundet,
 * höchstens PLANNED_LOAD_LIMITS. null = kein sinnvolles Gewicht.
 */
export function estimateWorkingWeight(
  set: CalibrationSet,
  target: { readonly reps: number; readonly rpe: number },
  steps: readonly number[] = [],
): number | null {
  const reserve = Math.max(0, 10 - set.rpe);
  const total = set.reps + reserve;
  const cap = Math.min(
    set.weightKg * (1 + LOAD_PROGRESSION.maxIncreaseFraction),
    PLANNED_LOAD_LIMITS.targetWeightKg.max,
  );
  let working: number;
  if (total > E1RM_ESTIMATE.maxRepsPlusReserve) {
    working = set.weightKg;
  } else {
    const e1rm = set.weightKg * (1 + total / E1RM_ESTIMATE.epleyDivisor);
    const targetTotal = target.reps + Math.max(0, 10 - target.rpe);
    working = e1rm / (1 + targetTotal / E1RM_ESTIMATE.epleyDivisor);
  }
  return snapToAvailableWeight(Math.min(working, cap), steps);
}

/** Art der Gewichtssteigerung einer Übung. */
export type IncrementKind = 'barbell' | 'machine' | 'free_weight' | 'none';

const MACHINE_IDS = new Set([
  'cable_station',
  'lat_pulldown',
  'leg_press',
  'machine_chest_press',
  'leg_curl_machine',
  'leg_extension_machine',
]);

export function incrementKindFor(
  exercise: Pick<Exercise, 'equipment_ids' | 'load_type'>,
): IncrementKind {
  if (exercise.load_type !== 'weight') return 'none';
  if (exercise.equipment_ids.includes('barbell')) return 'barbell';
  if (exercise.equipment_ids.some((id) => MACHINE_IDS.has(id))) return 'machine';
  return 'free_weight';
}

/** Nächstes Gewicht: Langhantel/Maschine +2,5 kg, freie Gewichte nächste eigene Stufe (sonst +2 kg). */
export function nextWeightStep(
  weightKg: number,
  kind: IncrementKind,
  steps: readonly number[] = [],
): number | null {
  if (kind === 'barbell') return round2(weightKg + LOAD_PROGRESSION.barbellIncrementKg);
  if (kind === 'machine') return round2(weightKg + LOAD_PROGRESSION.machineIncrementKg);
  if (kind === 'free_weight') {
    if (steps.length === 0) return round2(weightKg + LOAD_PROGRESSION.defaultFreeWeightIncrementKg);
    const higher = steps.filter((s) => s > weightKg + 1e-9);
    return higher.length === 0 ? null : Math.min(...higher);
  }
  return null;
}

/** Steigerung einer Halteübung: min(5 s, max(1 s, floor(10 % der Dauer))). */
export function holdIncrementSeconds(durationS: number): number {
  const { min, max, fraction } = LOAD_PROGRESSION.holdIncrementS;
  return Math.min(max, Math.max(min, Math.floor(durationS * fraction)));
}

/** Aktueller Stand einer Übung in der Progression. */
export interface ProgressionState {
  readonly loadType: LoadType;
  readonly repsMin: number | null;
  readonly repsMax: number | null;
  /** Aktuelle Zielwiederholungen (zwischen reps_min und reps_max + Puffer). */
  readonly targetReps: number | null;
  /** Sätze laut Vorlage. */
  readonly templateSets: number;
  /** Aktuelle Sätze (Vorlage oder Vorlage + 1 im Puffer). */
  readonly sets: number;
  readonly durationS: number | null;
  readonly rpeTarget: number;
  readonly weightKg: number | null;
}

/** Eine eingetragene Einheit dieser Übung. */
export interface PerformedSession {
  /**
   * Geplante Satzzahl DIESER Fassung (Phase 4, PLAN-PHASE-4 Abschnitt 5.1): Ein kurzer Termin mit 2 Sätzen zählt
   * als geschafft, wenn beide Sätze das Ziel erreichen. Fehlt sie, gilt `state.sets` (Phase-3-Verhalten).
   */
  readonly plannedSets?: number;
  /** RPE-Ziel, das bei DIESER Einheit galt (z. B. RPE −1 nach großem Sprung); fehlt es, gilt `state.rpeTarget`. */
  readonly rpeTarget?: number;
  readonly sets: readonly {
    readonly reps?: number | null;
    readonly durationS?: number | null;
    readonly rpe?: number | null;
  }[];
}

export type ProgressionStep =
  | { readonly kind: 'keep' }
  | { readonly kind: 'add_rep'; readonly targetReps: number }
  | { readonly kind: 'add_set'; readonly sets: number }
  | {
      readonly kind: 'increase_weight';
      readonly weightKg: number;
      readonly targetReps: number;
      readonly sets: number;
      /** RPE-Ziel der ERSTEN Einheit mit dem neuen Gewicht (bei Sprung > 25 % einen Punkt niedriger). */
      readonly firstSessionRpeTarget: number;
    }
  /** Keine höhere eigene Gewichtsstufe: Hinweis „schwerere Gewichtsstufe eintragen oder schwerere Variante“. */
  | { readonly kind: 'no_heavier_weight' }
  | { readonly kind: 'increase_duration'; readonly durationS: number }
  | { readonly kind: 'harder_variant' }
  | { readonly kind: 'stronger_band' };

export interface NextLoadOptions {
  readonly incrementKind: IncrementKind;
  readonly steps?: readonly number[];
  /** false, wenn ein zusätzlicher Satz die Wochensatz-Obergrenze (V9) überschreiten würde. */
  readonly allowExtraSet?: boolean;
  /** Erholungswoche: keine Steigerung. */
  readonly isDeload?: boolean;
}

/** Hat die Einheit das Ziel erreicht (alle Sätze, RPE ≤ Ziel oder ohne Angabe)? */
export function sessionAchieved(state: ProgressionState, performed: PerformedSession): boolean {
  const required = Math.max(1, performed.plannedSets ?? state.sets);
  if (performed.sets.length < required) return false;
  const rpeTarget = performed.rpeTarget ?? state.rpeTarget;
  return performed.sets.every((set) => {
    const rpeOk = set.rpe == null || set.rpe <= rpeTarget;
    if (state.loadType === 'time') {
      return rpeOk && (set.durationS ?? 0) >= (state.durationS ?? Number.POSITIVE_INFINITY);
    }
    return rpeOk && (set.reps ?? 0) >= (state.targetReps ?? Number.POSITIVE_INFINITY);
  });
}

/**
 * Doppelte Progression (Gratis-Regel, Abschnitt 5.9):
 * - Unter reps_max: eine geschaffte Einheit → Ziel +1 Wiederholung.
 * - Ab reps_max: ZWEI geschaffte Einheiten in Folge → nächste Stufe:
 *   Gewicht: Schritt ≤ 10 % → Gewicht steigt (Wdh. auf reps_min, Sätze wie Vorlage). Größerer Sprung nie direkt,
 *   erst nach dem Puffer: Wdh. bis reps_max + 2 (≤ 30), dann +1 Satz (≤ 6, V9), danach der Gewichtsschritt (bei
 *   Sprung > 25 % erste Einheit RPE −1). Keine höhere Stufe → nach dem Puffer Hinweis `no_heavier_weight`.
 *   Körpergewicht (ab Engine-Version 3): derselbe Puffer – Wdh. bis reps_max + 2 (≤ 30), dann +1 Satz (≤ 6, V9),
 *   danach Hinweis „schwerere Variante“ (findHarderVariant über progressHintForDisplay() in log/harder-variant.ts).
 *   Band → stärkeres Band; Halteübung → +min(5, max(1, 10 %)) s bis 120 s.
 * Nie Last senken (Live-Anpassung, Phase 4b). `history`: älteste zuerst.
 * Phase 4 (W7): Gewichtssprung und Zusatzsatz nur, wenn mindestens eine der zwei Einheiten mindestens die
 * Vorlagen-Satzzahl hatte (`plannedSets ≥ templateSets`); zwei kurze Fassungen bringen nur +1 Wdh. (bis zum Puffer).
 */
export function nextLoad(
  state: ProgressionState,
  history: readonly PerformedSession[],
  options: NextLoadOptions,
): ProgressionStep {
  if (options.isDeload || history.length === 0) return { kind: 'keep' };
  const last = history.at(-1) as PerformedSession;
  const twoInRow =
    history.length >= LOAD_PROGRESSION.consecutiveSessionsForStep &&
    history
      .slice(-LOAD_PROGRESSION.consecutiveSessionsForStep)
      .every((h) => sessionAchieved(state, h));

  if (state.loadType === 'time') {
    const duration = state.durationS ?? TEMPLATE_DOSAGE_LIMITS.durationS.min;
    if (!twoInRow) return { kind: 'keep' };
    if (duration >= TEMPLATE_DOSAGE_LIMITS.durationS.max) return { kind: 'harder_variant' };
    return {
      kind: 'increase_duration',
      durationS: Math.min(
        TEMPLATE_DOSAGE_LIMITS.durationS.max,
        duration + holdIncrementSeconds(duration),
      ),
    };
  }

  const repsMin = state.repsMin ?? TEMPLATE_DOSAGE_LIMITS.reps.min;
  const repsMax = state.repsMax ?? repsMin;
  const target = state.targetReps ?? repsMin;
  if (target < repsMax) {
    return sessionAchieved(state, last)
      ? { kind: 'add_rep', targetReps: target + 1 }
      : { kind: 'keep' };
  }
  if (!twoInRow) return { kind: 'keep' };
  if (state.loadType === 'band') return { kind: 'stronger_band' };

  const repsCap = Math.min(
    repsMax + LOAD_PROGRESSION.extraRepsBuffer,
    TEMPLATE_DOSAGE_LIMITS.reps.max,
  );
  const fullVersion = history
    .slice(-LOAD_PROGRESSION.consecutiveSessionsForStep)
    .some((h) => (h.plannedSets ?? state.sets) >= state.templateSets);
  const setsCap = Math.min(
    state.templateSets + LOAD_PROGRESSION.extraSets,
    TEMPLATE_DOSAGE_LIMITS.sets.max,
  );

  // Körpergewicht (Engine-Version 3, docs/PLAN-KOERPERGEWICHT.md §5.5, A10): derselbe Puffer wie beim großen
  // Gewichtssprung – Wdh. bis reps_max + 2 (≤ 30), dann +1 Satz (≤ 6, V9), erst dann der Hinweis „schwerere
  // Variante“. Nur kurze Fassungen (W7): nur +Wdh. bis zum Puffer, kein Zusatzsatz und kein Variantenwechsel.
  if (state.loadType === 'bodyweight') {
    if (target < repsCap) return { kind: 'add_rep', targetReps: target + 1 };
    if (!fullVersion) return { kind: 'keep' };
    if ((options.allowExtraSet ?? true) && state.sets < setsCap) {
      return { kind: 'add_set', sets: state.sets + 1 };
    }
    return { kind: 'harder_variant' };
  }

  // Gewicht
  if (state.weightKg === null) return { kind: 'keep' };
  // Eine Stufe über der Plausibilitätsgrenze (500 kg) gibt es nicht → wie „keine höhere Stufe“.
  const step = nextWeightStep(state.weightKg, options.incrementKind, options.steps);
  const next = step !== null && step <= PLANNED_LOAD_LIMITS.targetWeightKg.max + 1e-9 ? step : null;
  const increase =
    next === null ? null : state.weightKg > 0 ? (next - state.weightKg) / state.weightKg : Infinity;
  if (!fullVersion) {
    // Nur kurze Fassungen: +Wdh. – über reps_max hinaus (Puffer) nur, wenn ohnehin kein direkter Schritt ≤ 10 %
    // möglich ist (der Puffer ist für große Sprünge da).
    const direct = increase !== null && increase <= LOAD_PROGRESSION.maxIncreaseFraction + 1e-9;
    const limit = direct ? repsMax : repsCap;
    return target < limit ? { kind: 'add_rep', targetReps: target + 1 } : { kind: 'keep' };
  }
  if (
    next !== null &&
    increase !== null &&
    increase <= LOAD_PROGRESSION.maxIncreaseFraction + 1e-9
  ) {
    return {
      kind: 'increase_weight',
      weightKg: next,
      targetReps: repsMin,
      sets: state.templateSets,
      firstSessionRpeTarget: state.rpeTarget,
    };
  }
  if (target < repsCap) {
    return { kind: 'add_rep', targetReps: target + 1 };
  }
  if ((options.allowExtraSet ?? true) && state.sets < setsCap) {
    return { kind: 'add_set', sets: state.sets + 1 };
  }
  if (next === null || increase === null) {
    return { kind: 'no_heavier_weight' };
  }
  const largeJump = increase > LOAD_PROGRESSION.largeJumpFraction + 1e-9;
  return {
    kind: 'increase_weight',
    weightKg: next,
    targetReps: repsMin,
    sets: state.templateSets,
    firstSessionRpeTarget: largeJump
      ? clampRpe(state.rpeTarget - LOAD_PROGRESSION.largeJumpRpeReduction, state.rpeTarget)
      : state.rpeTarget,
  };
}

import { PLANNED_LOAD_LIMITS, WEIGHT_CONFIRM_LIMITS } from '../constants';
import type { IncrementKind } from '../plan/loads';

/**
 * Tippfehler-Schutz (docs/PLAN-PHASE-4.md Abschnitte 5.1, 5.2, 5.4; Wächter W5): Ein deutlich schwereres Gewicht
 * zählt für die Progression nur nach ausdrücklicher Bestätigung. Reine Warnungen, nie ein Fehler – die harten
 * Grenzen prüft das Schema (SESSION_LOG_LIMITS).
 */

const EPS = 1e-9;

export type SetEntryWarning =
  /** mehr als 10 % über dem Progressions-Zustand → „Absichtlich deutlich schwerer als geplant?“ */
  | 'confirm_heavier'
  /** ohne Zustand über der absoluten Schwelle der Geräte-Art → Bestätigung */
  | 'confirm_absolute'
  /** unter 50 % des Zustands oder unter der kleinsten Stufe → „Absichtlich deutlich leichter?“ */
  | 'confirm_lighter'
  /** mehr als 3-mal so viele Wiederholungen wie geplant → „Tippfehler? Bitte prüfen“ */
  | 'check_reps';

/** Absolute Schwelle (kg) je Geräte-Art; null = keine (ohne Zusatzgewicht). */
export function absoluteWeightThreshold(kind: IncrementKind): number | null {
  return kind === 'none' ? null : WEIGHT_CONFIRM_LIMITS.absoluteKg[kind];
}

/**
 * Braucht `weightKg` eine Bestätigung? Mit Zustand: mehr als 10 % darüber. Ohne Zustand (erster Eintrag, eigenes
 * Startgewicht): über der absoluten Schwelle der Geräte-Art.
 */
export function needsWeightConfirmation(
  weightKg: number,
  stateWeightKg: number | null,
  kind: IncrementKind,
): boolean {
  if (stateWeightKg !== null && stateWeightKg > 0) {
    return weightKg > stateWeightKg * (1 + WEIGHT_CONFIRM_LIMITS.relativeIncrease) + EPS;
  }
  const threshold = absoluteWeightThreshold(kind);
  return threshold !== null && weightKg > threshold + EPS;
}

/**
 * Deutlich leichter als der Zustand (unter 50 %) oder unter der kleinsten eigenen Stufe (z. B. 2 statt 20 kg)?
 * Dann zählt das Gewicht als neuer Ausgangspunkt nur nach Bestätigung.
 */
export function needsLighterConfirmation(
  weightKg: number,
  stateWeightKg: number | null,
  steps: readonly number[] = [],
): boolean {
  if (stateWeightKg === null || stateWeightKg <= 0 || weightKg >= stateWeightKg - EPS) return false;
  if (weightKg < stateWeightKg * WEIGHT_CONFIRM_LIMITS.relativeDecrease - EPS) return true;
  return steps.length > 0 && weightKg < Math.min(...steps) - EPS;
}

/**
 * Warnungen zu einem Satz (Anzeige im Trainingsmodus). Für Etappe C: `stateWeightKg` = max(Zustand, angezeigtes
 * Gewicht) für die 10-%-Warnung; bei einer Alternative der Zustand der ALTERNATIV-Übung (deren eigener Verlauf).
 */
export function setEntryWarnings(
  set: { readonly weightKg: number | null; readonly reps: number | null },
  context: {
    readonly stateWeightKg: number | null;
    readonly plannedReps: number | null;
    readonly incrementKind: IncrementKind;
    /** Zustand für die Leichter-Warnung (Standard: stateWeightKg) und eigene Stufen am Ort. */
    readonly lighterReferenceKg?: number | null;
    readonly steps?: readonly number[];
  },
): SetEntryWarning[] {
  const warnings: SetEntryWarning[] = [];
  if (set.weightKg !== null && set.weightKg > 0) {
    if (
      needsLighterConfirmation(
        set.weightKg,
        context.lighterReferenceKg !== undefined
          ? context.lighterReferenceKg
          : context.stateWeightKg,
        context.steps,
      )
    ) {
      warnings.push('confirm_lighter');
    }
    if (needsWeightConfirmation(set.weightKg, context.stateWeightKg, context.incrementKind)) {
      warnings.push(
        context.stateWeightKg !== null && context.stateWeightKg > 0
          ? 'confirm_heavier'
          : 'confirm_absolute',
      );
    }
  }
  if (
    set.reps !== null &&
    context.plannedReps !== null &&
    context.plannedReps > 0 &&
    set.reps > context.plannedReps * WEIGHT_CONFIRM_LIMITS.repsTypoFactor
  ) {
    warnings.push('check_reps');
  }
  return warnings;
}

/** Gewicht innerhalb der harten Grenze für Ziel- und Startgewichte (0,5–500 kg)? */
export function isPlausibleTargetWeight(weightKg: number): boolean {
  return (
    Number.isFinite(weightKg) &&
    weightKg >= PLANNED_LOAD_LIMITS.targetWeightKg.min - EPS &&
    weightKg <= PLANNED_LOAD_LIMITS.targetWeightKg.max + EPS
  );
}

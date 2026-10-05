import { CALIBRATION_MISSING_RPE, PLANNED_LOAD_LIMITS, TEMPLATE_DOSAGE_LIMITS } from '../constants';
import { estimateWorkingWeight } from '../plan/loads';
import { needsWeightConfirmation } from './plausibility';
import type { ExerciseProgress, LoggedSet, ProgressionContext } from './types';

/**
 * Arbeitsgewicht aus dem ersten Eintrag und eigenes Startgewicht (docs/PLAN-PHASE-4.md Abschnitt 5.2).
 * Ergebnis ist ein ROHER Zustand (W4): Gewicht nur auf 0,5 kg abgerundet, nicht auf die Stufen eines Orts – das
 * macht erst die Anzeige (prescriptionForDisplay).
 */

export type CalibrationResult =
  | { readonly kind: 'calibrated'; readonly progress: ExerciseProgress }
  /** Gewicht über der absoluten Schwelle ohne Bestätigung → wird nicht übernommen (W5). */
  | { readonly kind: 'needs_confirmation' }
  /** Kein brauchbarer Satz (z. B. nichts geschafft) → weiter „Startgewicht finden“. */
  | { readonly kind: 'none' };

/** Startzustand ohne Verlauf: Ziel-Wdh. = reps_min, Dauer laut Plan, kein Gewicht. */
export function initialProgress(
  ctx: Pick<ProgressionContext, 'repsMin' | 'durationS'>,
): ExerciseProgress {
  return { weightKg: null, targetReps: ctx.repsMin, extraSet: false, durationS: ctx.durationS };
}

/**
 * Schwerster geschaffter Satz (bei Gleichstand der mit mehr Wiederholungen); nur Sätze mit Haken, Gewicht > 0 und
 * mindestens 1 Wiederholung.
 */
export function heaviestCompletedSet(
  sets: readonly LoggedSet[],
): (LoggedSet & { weightKg: number; reps: number }) | null {
  let best: (LoggedSet & { weightKg: number; reps: number }) | null = null;
  for (const set of sets) {
    if (!set.done || set.weightKg === null || set.weightKg <= 0 || set.reps === null) continue;
    if (set.reps < 1) continue;
    const candidate = { ...set, weightKg: set.weightKg, reps: set.reps };
    if (
      best === null ||
      candidate.weightKg > best.weightKg ||
      (candidate.weightKg === best.weightKg && candidate.reps > best.reps)
    ) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Zustand aus einem Eintrag ohne bisherigen Zustand: Gewichtsübung → estimateWorkingWeight() mit dem schwersten
 * geschafften Satz (ohne RPE gilt CALIBRATION_MISSING_RPE), Ziel = reps_min und RPE der Belastungswoche; über der
 * absoluten Schwelle nur mit Bestätigung. Halteübung → Dauer laut Plan (sonst kürzeste geschaffte, 10–120 s).
 * Körpergewicht/Band → Ziel-Wdh. = reps_min.
 */
export function calibrateFromSets(
  sets: readonly LoggedSet[],
  weightConfirmed: boolean,
  ctx: Pick<
    ProgressionContext,
    'loadType' | 'repsMin' | 'durationS' | 'rpeTarget' | 'incrementKind'
  >,
): CalibrationResult {
  const base = initialProgress(ctx);
  if (ctx.loadType === 'time') {
    if (ctx.durationS !== null) return { kind: 'calibrated', progress: base };
    const durations = sets
      .filter((s) => s.done && s.durationS !== null && s.durationS > 0)
      .map((s) => s.durationS as number);
    if (durations.length === 0) return { kind: 'none' };
    const { min, max } = TEMPLATE_DOSAGE_LIMITS.durationS;
    return {
      kind: 'calibrated',
      progress: { ...base, durationS: Math.min(max, Math.max(min, Math.min(...durations))) },
    };
  }
  if (ctx.loadType !== 'weight') return { kind: 'calibrated', progress: base };
  const heaviest = heaviestCompletedSet(sets);
  if (heaviest === null) return { kind: 'none' };
  if (!weightConfirmed && needsWeightConfirmation(heaviest.weightKg, null, ctx.incrementKind)) {
    return { kind: 'needs_confirmation' };
  }
  const repsTarget = ctx.repsMin ?? TEMPLATE_DOSAGE_LIMITS.reps.min;
  const working = estimateWorkingWeight(
    {
      weightKg: heaviest.weightKg,
      reps: heaviest.reps,
      rpe: heaviest.rpe ?? CALIBRATION_MISSING_RPE,
    },
    { reps: repsTarget, rpe: ctx.rpeTarget },
  );
  if (working === null) return { kind: 'none' };
  return { kind: 'calibrated', progress: { ...base, weightKg: working } };
}

export type StartWeightResult =
  | { readonly kind: 'ok'; readonly progress: ExerciseProgress }
  | { readonly kind: 'needs_confirmation' }
  /** außerhalb 0,5–500 kg oder keine Gewichtsübung */
  | { readonly kind: 'invalid' };

/**
 * Eigenes Startgewicht (gilt nur, solange es keinen Eintrag gibt): roher Zustand mit diesem Gewicht, auf 0,5 kg
 * abgerundet; über der absoluten Schwelle nur mit Bestätigung. Das Abrunden auf die Stufen des Orts (null →
 * „leichteste Stufe wählen“) macht die Anzeige.
 */
export function progressFromStartWeight(
  weightKg: number,
  confirmed: boolean,
  ctx: Pick<ProgressionContext, 'loadType' | 'repsMin' | 'durationS' | 'incrementKind'>,
): StartWeightResult {
  const { min, max } = PLANNED_LOAD_LIMITS.targetWeightKg;
  if (ctx.loadType !== 'weight' || !Number.isFinite(weightKg) || weightKg < min || weightKg > max) {
    return { kind: 'invalid' };
  }
  if (!confirmed && needsWeightConfirmation(weightKg, null, ctx.incrementKind)) {
    return { kind: 'needs_confirmation' };
  }
  return {
    kind: 'ok',
    progress: { ...initialProgress(ctx), weightKg: Math.floor(weightKg * 2) / 2 },
  };
}

import { SESSION_RPE_LIMITS, SPORT_CATALOGUE, SPORT_LOAD } from '../constants';
import type { SportId } from '../enums';

/**
 * Trainingsbelastung (Session-RPE-Methode, SPORT_LOAD; docs/PLAN-SPORTARTEN.md 4): Minuten × Anstrengung 0–10 =
 * Belastungspunkte je Einheit; die Woche ist die Summe. Ohne Anstrengung zählt die übliche Anstrengung der Sportart
 * (SPORT_CATALOGUE[…].typicalEffort), bei Kraft/Ausdauer SPORT_LOAD.fallbackEffort. Rein.
 */

export interface TrainingLoadInput {
  /** Dauer in Sekunden; null/≤ 0 = keine Belastung berechenbar. */
  readonly durationS: number | null;
  /** Anstrengung 0–10 (session_rpe); null = keine Angabe. */
  readonly effort: number | null;
  /** Sportart (Stufe 2) – bestimmt die übliche Anstrengung ohne Angabe; null = Kraft/Ausdauer. */
  readonly sport: SportId | null;
}

/** Genutzte Anstrengung: Angabe (auf 0–10 geklemmt, gerundet), sonst übliche der Sportart bzw. fallbackEffort. */
export function effectiveEffort(input: Pick<TrainingLoadInput, 'effort' | 'sport'>): number {
  if (input.effort !== null && Number.isFinite(input.effort)) {
    return Math.min(
      SESSION_RPE_LIMITS.max,
      Math.max(SESSION_RPE_LIMITS.min, Math.round(input.effort)),
    );
  }
  return input.sport !== null
    ? SPORT_CATALOGUE[input.sport].typicalEffort
    : SPORT_LOAD.fallbackEffort;
}

/** Belastungspunkte einer Einheit (ganzzahlig, höchstens SPORT_LOAD.maxPointsPerSession); null ohne Dauer. */
export function sessionTrainingLoad(input: TrainingLoadInput): number | null {
  if (input.durationS === null || !Number.isFinite(input.durationS) || input.durationS <= 0) {
    return null;
  }
  const minutes = input.durationS / 60;
  return Math.min(SPORT_LOAD.maxPointsPerSession, Math.round(minutes * effectiveEffort(input)));
}

/** Summe der Belastungspunkte (Einheiten ohne Dauer zählen nicht). */
export function weeklyTrainingLoad(inputs: readonly TrainingLoadInput[]): number {
  return inputs.reduce((sum, input) => sum + (sessionTrainingLoad(input) ?? 0), 0);
}

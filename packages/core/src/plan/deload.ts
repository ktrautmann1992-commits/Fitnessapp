import { DELOAD_DOSAGE, DELOAD_SCHEDULE, TEMPLATE_DOSAGE_LIMITS } from '../constants';
import type { ExperienceLevel } from '../enums';

/**
 * Feste Erholungswoche (Deload), docs/PLAN-PHASE-3.md Abschnitt 5.10.
 */

/** Belastungswochen vor der Erholungswoche: Einsteiger 5, sonst 4; vorsichtige Pläne 4. */
export function loadWeeksBeforeDeload(level: ExperienceLevel, cautious: boolean): number {
  if (cautious) {
    return DELOAD_SCHEDULE.cautious;
  }
  return level === 'beginner' ? DELOAD_SCHEDULE.beginner : DELOAD_SCHEDULE.advanced;
}

/** Dosierung in der Erholungswoche: Sätze halbiert (aufgerundet, mind. 1), RPE −2 (nie unter 5), Gewicht ×0,9. */
export function deloadDosage<
  T extends { sets: number; rpe_target: number; target_weight_kg: number | null },
>(item: T): T {
  return {
    ...item,
    sets: Math.max(1, Math.ceil(item.sets * DELOAD_DOSAGE.setsFactor)),
    rpe_target: Math.max(
      TEMPLATE_DOSAGE_LIMITS.rpe.min,
      item.rpe_target - DELOAD_DOSAGE.rpeReduction,
    ),
    target_weight_kg:
      item.target_weight_kg === null
        ? null
        : Math.floor(item.target_weight_kg * DELOAD_DOSAGE.loadFactor * 4) / 4,
  };
}

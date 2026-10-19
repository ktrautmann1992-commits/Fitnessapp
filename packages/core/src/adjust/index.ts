/**
 * Live-Anpassung des Trainingsplans (Phase 4b, Premium, OHNE KI) – docs/PLAN-PHASE-4B.md Abschnitt 5.
 * `trailingLoadWeeks()` (Belastungswochen am Planende für `carriedLoadWeeks`) kommt aus plan/periodization.ts.
 */
export * from './types';
export * from './weeks';
export * from './invariants';
export * from './plan-changes';
export * from './inputs';
export * from './schemas';
export * from './fingerprint';
export * from './engine';
export * from './apply';
export * from './explain';
export * from './texts-de';
export * from './contexts';
export * from './fewer-days-schedule';
export { latestCountingSessionLogId } from './rules/common';
export {
  clearlyMissed,
  FAST_INCREASE_EXCLUSIONS,
  type FastIncreaseExclusion,
  fastIncreaseExclusion,
  fastIncreaseExcluded,
  reducedState,
} from './rules/state-rules';
export { stagnationAlternative, stagnationStart } from './rules/stagnation';

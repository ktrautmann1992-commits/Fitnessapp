import { ageInYears } from '../age';
import { AGE_PLAN_RULES, PLAN_ENGINE_VERSION } from '../constants';
import { canonicalJson } from '../content/validate';
import type { PlanInputsSnapshot } from './inputs';

/**
 * Braucht der Plan ein Update? (docs/PLAN-PHASE-3.md Abschnitt 10.4) – die App fragt dann „Plan neu
 * erstellen?“, ersetzt aber nie still.
 */
export type PlanUpdateReason =
  | 'inputs_changed'
  | 'engine_version'
  | 'template_version'
  | 'health_check_newer'
  | 'health_consent_missing'
  | 'age_threshold';

export interface PlanForUpdate {
  readonly inputs: PlanInputsSnapshot;
  readonly engine_version: number;
  readonly template_id: string;
  readonly template_version: number;
  /** Erstellungszeitpunkt (ISO-Zeitstempel, user_plans.created_at). */
  readonly created_at: string;
  /** Erstellungsdatum in Europe/Berlin (für die Altersgrenzen). */
  readonly created_on: string;
  readonly uses_health_data: boolean;
}

export interface CurrentState {
  readonly inputs: PlanInputsSnapshot;
  readonly birthDate: string;
  /** Zeitpunkt des neuesten Gesundheits-Checks (ISO-Zeitstempel, health_screening.created_at) oder null. */
  readonly latestScreeningAt: string | null;
  /** Einwilligung health_data gültig (aktuelle Version)? */
  readonly healthConsentValid: boolean;
  /** Aktuell freigegebene Version der Vorlage (undefined = unbekannt/nicht mehr freigegeben). */
  readonly currentTemplateVersion?: number;
}

/** Wurde zwischen `from` (ausschließlich) und `to` (einschließlich) eine Altersgrenze (18, 65) erreicht? */
export function crossedAgeThreshold(birthDate: string, from: string, to: string): boolean {
  if (to <= from) return false;
  const before = ageInYears(birthDate, from);
  const after = ageInYears(birthDate, to);
  return [AGE_PLAN_RULES.minor.belowAge, AGE_PLAN_RULES.senior.fromAge].some(
    (limit) => before < limit && after >= limit,
  );
}

export function planNeedsUpdate(
  plan: PlanForUpdate,
  current: CurrentState,
  today: string,
): { readonly needsUpdate: boolean; readonly reasons: readonly PlanUpdateReason[] } {
  const reasons: PlanUpdateReason[] = [];
  if (canonicalJson(plan.inputs) !== canonicalJson(current.inputs)) reasons.push('inputs_changed');
  if (plan.engine_version !== PLAN_ENGINE_VERSION) reasons.push('engine_version');
  if (
    current.currentTemplateVersion !== undefined &&
    current.currentTemplateVersion > plan.template_version
  ) {
    reasons.push('template_version');
  }
  if (
    current.latestScreeningAt !== null &&
    Date.parse(current.latestScreeningAt) > Date.parse(plan.created_at)
  ) {
    reasons.push('health_check_newer');
  }
  if (plan.uses_health_data && !current.healthConsentValid) reasons.push('health_consent_missing');
  if (crossedAgeThreshold(current.birthDate, plan.created_on, today)) reasons.push('age_threshold');
  return { needsUpdate: reasons.length > 0, reasons };
}

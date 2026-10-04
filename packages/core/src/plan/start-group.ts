import { ageInYears } from '../age';
import { AGE_PLAN_RULES } from '../constants';
import { isoDateInTimeZone } from '../dates';
import { experienceLevelSchema } from '../validation';
import type { EnduranceStartGroup } from './safety';

/** Felder eines gespeicherten Plans (user_plans), aus denen die Startgruppe bestimmt wird. */
export interface PlanStartGroupSource {
  readonly uses_health_data: boolean;
  readonly medical_notice: boolean;
  /** Erstellungszeitpunkt (ISO-Zeitstempel, user_plans.created_at). */
  readonly created_at: string;
  /** user_plans.inputs (Angaben ohne Gesundheitsdaten, PlanInputsSnapshot). */
  readonly inputs: unknown;
}

/**
 * Startgruppe Ausdauer, mit der ein GESPEICHERTER Plan erstellt wurde – die einzige Quelle für
 * `previousStartGroup` (NextPlanBlockOptions in schedule.ts, applyCurrentEnduranceRules in apply-safety.ts),
 * sobald `safety_rules` nicht mehr vorliegen (z. B. nach dem Neuladen; sie werden nie gespeichert).
 *
 * Bestimmt nur aus Spalten des Plans und dem Geburtsdatum (wie planSafetyRules().enduranceStartGroup beim
 * Erstellen):
 * - `uses_health_data = false` → ohne Gesundheits-Check erstellt → 'cautious',
 * - `medical_notice = true` → jedes Gesundheits-Flag (auch Schwangerschaft) → 'cautious',
 * - Alter am Erstellungstag (Europe/Berlin) unter 18 oder ab 65 → 'cautious',
 * - sonst das Level aus `inputs.experienceLevel` ('beginner' | 'advanced' | 'competitive').
 * Unlesbare Angaben oder Datum → 'competitive' (LOCKERSTER Wert): Die Startgruppe dient nur als Vergleich „ist die
 * aktuelle Gruppe strenger?“ – mit dem lockersten Wert setzt jede strengere aktuelle Gruppe den Ausdauer-Umfang
 * sicher zurück (Wächter-Auflage Etappe C). Rein und deterministisch.
 */
export function planStartGroup(plan: PlanStartGroupSource, birthDate: string): EnduranceStartGroup {
  if (!plan.uses_health_data || plan.medical_notice) {
    return 'cautious';
  }
  let createdOn: string;
  let age: number;
  try {
    createdOn = isoDateInTimeZone(plan.created_at);
    age = ageInYears(birthDate, createdOn);
  } catch {
    return 'competitive';
  }
  if (age < AGE_PLAN_RULES.minor.belowAge || age >= AGE_PLAN_RULES.senior.fromAge) {
    return 'cautious';
  }
  const inputs = plan.inputs;
  const level =
    typeof inputs === 'object' && inputs !== null
      ? experienceLevelSchema.safeParse((inputs as { experienceLevel?: unknown }).experienceLevel)
      : null;
  return level?.success ? level.data : 'competitive';
}

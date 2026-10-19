import { z } from 'zod';

import { BODY_METRIC_LIMITS, CAFFEINE_LIMITS, SUPPLEMENT_RULES } from '../constants';
import type { CaffeineSafetyInfo, RatedSupplementResult } from './eligibility';
import { formatGermanNumber } from './notices';

/**
 * Dosis (docs/PLAN-PHASE-6.md 3.5). Persönliche Mengen gibt es NUR bei „passt zu dir“; Vitamin D bekommt als Info
 * einen allgemeinen Richtwert (SU-G15). „ab 18“ und „Nicht für dich“ haben nie eine Menge (Plan 3.3).
 */

export type SupplementDoseUnit = 'g' | 'mg' | 'ug';

export interface SupplementDose {
  /** Menge bzw. Spanne je Tag (Kreatin, Vitamin D, Omega-3) oder je Portion (Proteinpulver: Eiweiß der Portion). */
  readonly min: number;
  readonly max: number;
  readonly unit: SupplementDoseUnit;
  readonly per: 'day' | 'serving';
  /** true = allgemeiner Richtwert (keine persönliche Dosis), z. B. Vitamin D. */
  readonly general: boolean;
}

const range = (min: number, max: number, unit: SupplementDoseUnit, per: 'day' | 'serving') => ({
  min,
  max,
  unit,
  per,
  general: false,
});

/**
 * Dosis zu einer Einordnung, `null` = keine Menge anzeigen.
 * - Kreatin (`recommended`): 3 g täglich, ohne Ladephase, auch an Ruhetagen.
 * - Proteinpulver (`recommended`): 20–30 g Eiweiß je Portion (mit `proteinServingG` auf das Tagesziel begrenzen).
 * - Vitamin D (`info_only`): allgemeiner Richtwert 20 µg (800 IE) täglich.
 * - Omega-3 (`recommended`): 250–500 mg EPA+DHA täglich.
 */
export function supplementDose(item: RatedSupplementResult): SupplementDose | null {
  if (item.id === 'vitamin_d') {
    if (item.status !== 'info_only' && item.status !== 'recommended') return null;
    const ug = SUPPLEMENT_RULES.vitaminD.generalUg;
    return { min: ug, max: ug, unit: 'ug', per: 'day', general: true };
  }
  if (item.status !== 'recommended') return null;
  switch (item.id) {
    case 'creatine': {
      const g = SUPPLEMENT_RULES.creatine.dailyG;
      return range(g, g, 'g', 'day');
    }
    case 'protein_powder': {
      const { min, max } = SUPPLEMENT_RULES.proteinPowder.servingProteinG;
      return range(min, max, 'g', 'serving');
    }
    case 'omega3': {
      const { min, max } = SUPPLEMENT_RULES.omega3.epaDhaMgPerDay;
      return range(min, max, 'mg', 'day');
    }
  }
}

/**
 * Eiweiß einer Shake-Portion, höchstens so viel, wie bis zum Tagesziel fehlt (Plan 3.5): obere Grenze 30 g, auf 5 g
 * abgerundet. Ohne Angabe der Restmenge 20–30 g. Fehlen weniger als 5 g, `null` (heute kein Shake nötig).
 * @param remainingProteinG Eiweiß, das heute noch bis zum Ziel fehlt (g), `null` = unbekannt
 */
export function proteinServingG(
  remainingProteinG: number | null,
): { min: number; max: number } | null {
  const { min, max } = SUPPLEMENT_RULES.proteinPowder.servingProteinG;
  if (remainingProteinG === null) return { min, max };
  const remaining = z.number().finite().parse(remainingProteinG);
  const cap = Math.floor(Math.min(max, remaining) / 5) * 5;
  if (cap < 5) return null;
  return { min: Math.min(min, cap), max: cap };
}

/** Mikrogramm → Internationale Einheiten (Vitamin D: 1 µg = 40 IE). */
export function vitaminDUgToIu(ug: number): number {
  return z.number().finite().min(0).parse(ug) * SUPPLEMENT_RULES.vitaminD.iuPerUg;
}

/** Internationale Einheiten → Mikrogramm (Vitamin D). */
export function vitaminDIuToUg(iu: number): number {
  return z.number().finite().min(0).parse(iu) / SUPPLEMENT_RULES.vitaminD.iuPerUg;
}

/** Dosis als Text, z. B. „3 g“, „20–30 g Eiweiß“, „20 µg (800 IE)“, „250–500 mg EPA und DHA“. */
export function formatSupplementDose(dose: SupplementDose): string {
  const unit = dose.unit === 'ug' ? 'µg' : dose.unit;
  const amount =
    dose.min === dose.max
      ? `${formatGermanNumber(dose.min)} ${unit}`
      : `${formatGermanNumber(dose.min)}–${formatGermanNumber(dose.max)} ${unit}`;
  if (dose.unit === 'ug') {
    const iuMin = formatGermanNumber(vitaminDUgToIu(dose.min));
    const iuMax = formatGermanNumber(vitaminDUgToIu(dose.max));
    return `${amount} (${dose.min === dose.max ? iuMin : `${iuMin}–${iuMax}`} IE)`;
  }
  return amount;
}

/** Persönliche Koffein-Grenze je Einnahme: Zahl in mg oder – ohne Gewicht – der Tassen-Satz. */
export type CaffeineSingleLimit =
  | { readonly kind: 'mg'; readonly mg: number }
  | { readonly kind: 'cups'; readonly cups: { readonly min: number; readonly max: number } };

/**
 * Koffein-Grenze je Einnahme: min(3 mg/kg, 200 mg), auf 10 mg ABgerundet (sichere Richtung). Ohne Gewicht der Satz
 * „höchstens 1–2 Tassen Kaffee auf einmal“. Beispiele: 40 kg → 120 mg, 66,7 kg → 200 mg, 150 kg → 200 mg.
 */
export function caffeineSingleLimit(weightKg: number | null): CaffeineSingleLimit {
  if (weightKg === null) return { kind: 'cups', cups: CAFFEINE_LIMITS.generalCups };
  const weight = z
    .number()
    .finite()
    .min(BODY_METRIC_LIMITS.weightKg.min)
    .max(BODY_METRIC_LIMITS.weightKg.max)
    .parse(weightKg);
  const raw = Math.min(CAFFEINE_LIMITS.mgPerKg * weight, CAFFEINE_LIMITS.singleDoseMaxMg);
  // Kleine Toleranz gegen Gleitkomma-Rest (66,67 kg × 3 = 200,01 → 200; 40 × 3 = 120 bleibt 120).
  const mg = Math.floor((raw + 1e-9) / CAFFEINE_LIMITS.roundingMg) * CAFFEINE_LIMITS.roundingMg;
  return { kind: 'mg', mg };
}

/**
 * Persönliche Koffein-Tagesgrenze (alle Quellen): min(5,7 mg/kg, 400 mg), auf 10 mg ABgerundet. Beispiele: 30 kg →
 * 170 mg, 40 kg → 220 mg, 70 kg → 390 mg, 100 kg → 400 mg. Ohne Gewicht gilt der allgemeine Satz mit 400 mg.
 */
export function caffeineDailyLimitMg(weightKg: number): number {
  const weight = z
    .number()
    .finite()
    .min(BODY_METRIC_LIMITS.weightKg.min)
    .max(BODY_METRIC_LIMITS.weightKg.max)
    .parse(weightKg);
  const raw = Math.min(CAFFEINE_LIMITS.dailyMgPerKg * weight, CAFFEINE_LIMITS.dailyMaxMg);
  return Math.floor((raw + 1e-9) / CAFFEINE_LIMITS.roundingMg) * CAFFEINE_LIMITS.roundingMg;
}

/**
 * Persönliche Koffein-Tagesgrenze zur Einordnung: nur im Modus `personal` (mit Gewicht), sonst `null` (dann gilt der
 * allgemeine Satz „höchstens 400 mg am Tag“ bzw. der BfR- oder Arzt-Hinweis).
 */
export function caffeinePersonalDailyLimitMg(
  info: CaffeineSafetyInfo,
  weightKg: number | null,
): number | null {
  if (info.status !== 'safety_info' || info.mode !== 'personal' || weightKg === null) return null;
  return caffeineDailyLimitMg(weightKg);
}

/**
 * Persönliche Koffein-Grenze zur Einordnung: nur bei `safety_info` im Modus `personal` (mit Gewicht), sonst `null`
 * (die App zeigt dann nur die allgemeinen Sätze bzw. den BfR- oder Arzt-Hinweis).
 */
export function caffeinePersonalLimitMg(
  info: CaffeineSafetyInfo,
  weightKg: number | null,
): number | null {
  if (info.status !== 'safety_info' || info.mode !== 'personal' || weightKg === null) return null;
  const limit = caffeineSingleLimit(weightKg);
  return limit.kind === 'mg' ? limit.mg : null;
}

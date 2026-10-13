import { z } from 'zod';

import { isoDateSchema } from '../age';
import { FOOD_GROUP_IDS, type FoodGroupId, foodGroupSchema } from '../food-groups';
import type { NutritionWeekTargets } from './targets';

/**
 * Personenbezogene Regeln der Ernährung, die die App auf ihre gespeicherten Angaben anwendet (docs/PLAN-PHASE-5.md
 * 4.2, 6.1, 7.4, 8.2; Etappe N4, Wächter N4 S4/B1). Reine Funktionen – die App bildet nur ab.
 */

/** Stand der Einwilligung `health_data`: gültig, ältere Textversion (neu bestätigen) oder keine/widerrufen. */
export type HealthConsentState = 'valid' | 'outdated' | 'none';

export const healthConsentStateSchema = z.enum(['valid', 'outdated', 'none']);

/**
 * Körperdaten-Datum (Wächter N1 K3): Die Datenbank erlaubt ein Messdatum bis heute + 1 Tag (Zeitzonen); die Engine
 * zählt Zeilen nach `today` nicht. Ein solcher Wert gilt als heute gemessen, damit er nicht verschwindet. Ältere
 * Daten bleiben unverändert.
 */
export function measuredOnForEngine(measuredOn: string, today: string): string {
  const date = isoDateSchema.parse(measuredOn);
  const day = isoDateSchema.parse(today);
  return date > day ? day : date;
}

export type IntoleranceAccess =
  /** Unverträglichkeiten werden berücksichtigt (gültige Einwilligung) bzw. es gibt keine. */
  | { readonly kind: 'ok'; readonly intolerances: readonly FoodGroupId[] }
  /**
   * Gespeicherte Unverträglichkeiten, aber die Einwilligung ist nicht gültig (z. B. neue Textfassung, B1): Sie dürfen
   * nicht verwendet werden – und ohne sie gibt es keinen sicheren Plan. Deshalb KEIN Essensplan und KEINE
   * Rezeptansicht, sondern der Hinweis „Einwilligung bestätigen“ (sichere Richtung).
   */
  | { readonly kind: 'blocked'; readonly reason: IntoleranceBlockReason };

/**
 * Grund der Sperre (Wächter N4 NK1/NK2): `consent_outdated` = neue Textfassung bestätigen; `consent_missing` =
 * widerrufen bzw. nie erteilt – Einwilligung erteilen ODER die gespeicherten Unverträglichkeiten löschen (Recht auf
 * Löschung: geht immer, auch ohne Einwilligung).
 */
export type IntoleranceBlockReason = 'consent_outdated' | 'consent_missing';

/**
 * Welche Unverträglichkeiten der Essensplan berücksichtigen darf (6.1, Art. 9): nur mit gültiger Einwilligung. Sind
 * welche gespeichert, ohne dass die Einwilligung gültig ist, wird gesperrt statt still ignoriert (Wächter N4 B1).
 * Unbekannte Gruppen-IDs werden ignoriert.
 */
export function intoleranceAccess(input: {
  readonly consent: HealthConsentState;
  readonly storedIntolerances: readonly string[];
}): IntoleranceAccess {
  const consent = healthConsentStateSchema.parse(input.consent);
  const stored = new Set(
    input.storedIntolerances.flatMap((g) => {
      const parsed = foodGroupSchema.safeParse(g);
      return parsed.success ? [parsed.data] : [];
    }),
  );
  const groups = FOOD_GROUP_IDS.filter((group) => stored.has(group));
  if (consent === 'valid') return { kind: 'ok', intolerances: groups };
  if (groups.length === 0) return { kind: 'ok', intolerances: [] };
  return {
    kind: 'blocked',
    reason: consent === 'outdated' ? 'consent_outdated' : 'consent_missing',
  };
}

/**
 * Rezeptansicht ohne Tag (Deep-Link, Portionswähler): Schwangerschafts-Ausschluss, sobald er an IRGENDEINEM Tag der
 * Woche gilt (sichere Richtung).
 */
export function weekExcludesPregnancyCaution(week: Pick<NutritionWeekTargets, 'days'>): boolean {
  return week.days.some((day) => day.recipeExclusions.includes('pregnancy_caution'));
}

/**
 * Keine Energie-Zahlen in der ganzen Ernährung (auch Rezept per Deep-Link, Wächter N4 K1), sobald die Woche einen Tag
 * in Schwangerschaft/Stillzeit ohne Zahlen hat (B5). Ohne Einwilligung bleiben Nährwerte je Rezept sichtbar (4.9).
 */
export function weekHidesEnergyNumbers(week: Pick<NutritionWeekTargets, 'days'>): boolean {
  return week.days.some((day) => day.notices.includes('pregnancy_no_targets'));
}

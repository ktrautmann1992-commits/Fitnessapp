import { EMERGENCY_NUMBERS, HIKING_SAFETY } from '../constants';
import type { AppLocale, BodyRegion, WalkKind } from '../enums';
import { isHikeKind, sacGuidance } from './walk-kind';

/**
 * Bergwander-Hinweise (Sportarten Stufe 1 · Etappe W, docs/PLAN-SPORTARTEN-STUFE-1.md 2.2): welche Textbausteine
 * (HIKING_SAFETY_DE) die Karte vor dem Start bzw. in der Auswertung zeigt. Nie blockierend – es gibt keine Sperre,
 * auch nicht bei T4+, Schwangerschaft oder Arzt-Hinweis. Reihenfolge = Anzeige. Rein.
 */

export type HikingSafetyNoticeId =
  | 'sac_outside'
  | 'doctor'
  | 'weather'
  | 'turnaround'
  | 'altitude'
  | 'descent'
  | 'pain_joints'
  | 'live_companion'
  | 'emergency'
  | 'battery'
  | 'drink';

export interface HikingSafetyInput {
  /** `before` = Karte vor dem Start; `after` = Auswertung. */
  readonly phase: 'before' | 'after';
  readonly walkKind: WalkKind | null;
  /** Höchster Punkt in m (Auswertung bzw. gespeicherte Strecke beim „Erneut gehen“); null = unbekannt. */
  readonly maxAltitudeM: number | null;
  /** Abstieg in m; null = unbekannt. */
  readonly elevationLossM: number | null;
  /** Gewählte SAC-Stufe 1–6 (4–6 = „T4 oder schwerer“); null = keine Angabe. */
  readonly sacGrade: number | null;
  /** Aktive Regionen im Schon-Modus. */
  readonly painRegions: readonly BodyRegion[];
  /** Gesundheits-Check: Arzt-Hinweis (medical_clearance_recommended). */
  readonly medicalClearance: boolean;
  readonly pregnancy: boolean;
}

const high = (m: number | null) => m !== null && m >= HIKING_SAFETY.altitudeHintM;

export function hikingSafetyNotices(input: HikingSafetyInput): HikingSafetyNoticeId[] {
  if (!isHikeKind(input.walkKind)) return [];
  const mountain = input.walkKind === 'mountain_hike';
  const before = input.phase === 'before';
  const ids: HikingSafetyNoticeId[] = [];
  if (input.sacGrade !== null && sacGuidance(input.sacGrade) === 'outside_app') {
    ids.push('sac_outside');
  }
  // Arzt-Hinweis/Schwangerschaft: vor jeder Bergwanderung (Höhe vorab unbekannt) bzw. wenn es hoch hinaus geht.
  const healthNote = input.medicalClearance || input.pregnancy;
  if (healthNote && ((before && mountain) || high(input.maxAltitudeM))) ids.push('doctor');
  if (before && mountain) ids.push('weather', 'turnaround');
  if ((before && mountain) || high(input.maxAltitudeM)) ids.push('altitude');
  if (
    (before && mountain) ||
    (input.elevationLossM !== null && input.elevationLossM >= HIKING_SAFETY.descentHintM)
  ) {
    ids.push('descent');
  }
  if (input.painRegions.some((r) => r === 'knee' || r === 'ankle')) ids.push('pain_joints');
  if (before && mountain) ids.push('live_companion', 'emergency', 'battery', 'drink');
  return ids;
}

export type EmergencyCountry = keyof typeof EMERGENCY_NUMBERS;
export const EMERGENCY_COUNTRIES = [
  'DE',
  'AT',
  'CH',
  'IT',
] as const satisfies readonly EmergencyCountry[];

/** Notrufnummern aller vier Länder, das Land der Person (Sprache de-DE/de-AT/de-CH) zuerst. */
export function emergencyNumbersFor(locale: AppLocale | null): {
  readonly country: EmergencyCountry;
  readonly numbers: (typeof EMERGENCY_NUMBERS)[EmergencyCountry];
}[] {
  const own: EmergencyCountry | null =
    locale === 'de-AT' ? 'AT' : locale === 'de-CH' ? 'CH' : locale === 'de-DE' ? 'DE' : null;
  const order = own
    ? [own, ...EMERGENCY_COUNTRIES.filter((c) => c !== own)]
    : [...EMERGENCY_COUNTRIES];
  return order.map((country) => ({ country, numbers: EMERGENCY_NUMBERS[country] }));
}

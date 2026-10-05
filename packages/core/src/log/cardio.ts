import { CARDIO_PLAUSIBILITY_KMH } from '../constants';
import type { EnduranceModality } from '../enums';

/**
 * Ausdauer-Einträge (docs/PLAN-PHASE-4.md Abschnitt 5.3): Pace bzw. Geschwindigkeit werden ausgerechnet, nie
 * eingegeben. null bei fehlender Distanz oder Distanz 0.
 */

function validDistance(distanceM: number | null): distanceM is number {
  return distanceM !== null && Number.isFinite(distanceM) && distanceM > 0;
}

/** Sekunden je Kilometer (gerundet). */
export function paceSecondsPerKm(durationS: number, distanceM: number | null): number | null {
  if (!validDistance(distanceM) || durationS <= 0) return null;
  return Math.round(durationS / (distanceM / 1000));
}

/** Sekunden je 100 m (Schwimmen, gerundet). */
export function paceSecondsPer100m(durationS: number, distanceM: number | null): number | null {
  if (!validDistance(distanceM) || durationS <= 0) return null;
  return Math.round(durationS / (distanceM / 100));
}

/** Kilometer je Stunde (auf 0,1 gerundet). */
export function speedKmh(durationS: number, distanceM: number | null): number | null {
  if (!validDistance(distanceM) || durationS <= 0) return null;
  return Math.round((distanceM / 1000 / (durationS / 3600)) * 10) / 10;
}

/** „mm:ss“ bzw. „h:mm:ss“ für Pace und Dauer. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/**
 * Plausibilität: schneller als CARDIO_PLAUSIBILITY_KMH der Art → nur Warnung „Bitte prüfen“. Ohne Distanz ok.
 * Rechnet mit der UNGERUNDETEN Geschwindigkeit.
 */
export function cardioPlausibility(
  modality: EnduranceModality,
  durationS: number,
  distanceM: number | null,
): 'ok' | 'check_speed' {
  if (!validDistance(distanceM) || durationS <= 0) return 'ok';
  const kmh = distanceM / 1000 / (durationS / 3600);
  return kmh > CARDIO_PLAUSIBILITY_KMH[modality] ? 'check_speed' : 'ok';
}

/** Ein Ausdauer-Eintrag mit Bezug zur geplanten Einheit (null = verwaist, zählt nie). */
export interface CardioLogRef {
  readonly plannedSessionId: string | null;
  readonly durationS: number;
}

/**
 * Eingetragene Minuten je ID der geplanten Einheit – Eingabe für enduranceReferenceFromBlock() bzw.
 * nextPlanBlock({ loggedEnduranceMinutes }). Verwaiste Einträge (ohne geplante Einheit, B4/H-a) werden
 * ausgelassen und zählen damit nicht für den 10-%-Bezug.
 */
export function loggedEnduranceMinutes(logs: readonly CardioLogRef[]): Map<string, number> {
  const minutes = new Map<string, number>();
  for (const log of logs) {
    if (log.plannedSessionId === null) continue;
    const value = Math.floor(Math.max(0, log.durationS) / 60);
    minutes.set(log.plannedSessionId, Math.max(minutes.get(log.plannedSessionId) ?? 0, value));
  }
  return minutes;
}

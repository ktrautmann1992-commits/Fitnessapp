import { CARDIO_LOG_LIMITS, CARDIO_PLAUSIBILITY_KMH, TALK_TEST_BANDS } from '../constants';
import type { EnduranceModality } from '../enums';
import type { CardioLogPayload } from './schemas';

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

// ---------------------------------------------------------------------------------------------------------
// Ausdauer-Eintrag im Trainingsmodus (docs/PLAN-PHASE-4.md 6.1 Punkt 3, Etappe C2)
// ---------------------------------------------------------------------------------------------------------

/**
 * Welche Kennzahl die App live zeigt: Laufen/Gehen Pace je km (dazu km/h), Rad km/h, Schwimmen Pace je 100 m.
 */
export type CardioSpeedKind = 'per_km' | 'kmh' | 'per_100m';

export function cardioSpeedKind(modality: EnduranceModality): CardioSpeedKind {
  if (modality === 'bike') return 'kmh';
  if (modality === 'swim') return 'per_100m';
  return 'per_km';
}

/** Live-Anzeige von Pace bzw. Geschwindigkeit; null ohne Distanz oder ohne gültige Dauer. */
export interface CardioSpeed {
  readonly kind: CardioSpeedKind;
  /** Sekunden je km (per_km) bzw. je 100 m (per_100m); null bei kmh. */
  readonly paceS: number | null;
  readonly kmh: number;
  /** Schneller als CARDIO_PLAUSIBILITY_KMH der Art → „Bitte prüfen“ (nur Warnung). */
  readonly check: boolean;
}

export function cardioSpeed(
  modality: EnduranceModality,
  durationS: number | null,
  distanceM: number | null,
): CardioSpeed | null {
  if (durationS === null) return null;
  const kmh = speedKmh(durationS, distanceM);
  if (kmh === null) return null;
  const kind = cardioSpeedKind(modality);
  return {
    kind,
    paceS:
      kind === 'per_km'
        ? paceSecondsPerKm(durationS, distanceM)
        : kind === 'per_100m'
          ? paceSecondsPer100m(durationS, distanceM)
          : null,
    kmh,
    check: cardioPlausibility(modality, durationS, distanceM) === 'check_speed',
  };
}

/** Dauer in Stunden und Minuten (Vorbelegung der Eingabe). */
export function splitDuration(totalSeconds: number): { hours: number; minutes: number } {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

/**
 * Eingabe des Ausdauer-Eintrags. Zahlen schon gelesen (Komma → Punkt macht die App); `null` = leer, `NaN` = nicht
 * lesbar. Distanz in km, Höhenmeter in m.
 */
export interface CardioInput {
  readonly modality: EnduranceModality;
  readonly hours: number | null;
  readonly minutes: number | null;
  readonly distanceKm: number | null;
  readonly elevationM: number | null;
}

export type CardioInputField = 'duration' | 'distance' | 'elevation';
export type CardioInputError =
  /** Dauer fehlt (Pflicht). */
  | 'duration_missing'
  /** Stunden/Minuten keine ganzen Zahlen ≥ 0 bzw. Minuten über 59 bei Angabe von Stunden. */
  | 'duration_invalid'
  /** Unter 1 Minute oder über 12 Stunden (CARDIO_LOG_LIMITS). */
  | 'duration_range'
  | 'distance_invalid'
  | 'distance_range'
  | 'elevation_invalid'
  | 'elevation_range';

export type CardioInputResult =
  | { readonly ok: true; readonly cardio: CardioLogPayload }
  | { readonly ok: false; readonly errors: Partial<Record<CardioInputField, CardioInputError>> };

const isWholeNonNegative = (value: number) => Number.isInteger(value) && value >= 0;

/** Dauer in Sekunden aus der Eingabe; null = fehlt oder ungültig (ohne Grenzen-Prüfung). */
export function cardioDurationS(input: Pick<CardioInput, 'hours' | 'minutes'>): number | null {
  const { hours, minutes } = input;
  if (hours === null && minutes === null) return null;
  const h = hours ?? 0;
  const m = minutes ?? 0;
  if (!isWholeNonNegative(h) || !isWholeNonNegative(m)) return null;
  if (h > 0 && m > 59) return null;
  return h * 3600 + m * 60;
}

/** Distanz in Metern (gerundet); 0 bzw. leer = ohne Distanz (null); NaN/negativ = ungültig. */
function distanceMeters(km: number | null): number | null | 'invalid' {
  if (km === null) return null;
  if (!Number.isFinite(km) || km < 0) return 'invalid';
  const meters = Math.round(km * 1000);
  return meters === 0 ? null : meters;
}

/**
 * Eingabe prüfen und in den cardio-Teil von save_session_log umwandeln (Grenzen = CARDIO_LOG_LIMITS = Schema =
 * Datenbank). Pace/Geschwindigkeit werden nie gespeichert, nur berechnet.
 */
export function cardioLogFromInput(input: CardioInput): CardioInputResult {
  const errors: Partial<Record<CardioInputField, CardioInputError>> = {};
  const durationS = cardioDurationS(input);
  if (input.hours === null && input.minutes === null) {
    errors.duration = 'duration_missing';
  } else if (durationS === null) {
    errors.duration = 'duration_invalid';
  } else if (
    durationS < CARDIO_LOG_LIMITS.durationS.min ||
    durationS > CARDIO_LOG_LIMITS.durationS.max
  ) {
    errors.duration = 'duration_range';
  }
  const distance = distanceMeters(input.distanceKm);
  if (distance === 'invalid') {
    errors.distance = 'distance_invalid';
  } else if (distance !== null && distance > CARDIO_LOG_LIMITS.distanceM.max) {
    errors.distance = 'distance_range';
  }
  const elevation = input.elevationM;
  if (elevation !== null) {
    if (!Number.isFinite(elevation) || !isWholeNonNegative(elevation)) {
      errors.elevation = 'elevation_invalid';
    } else if (elevation > CARDIO_LOG_LIMITS.elevationM.max) {
      errors.elevation = 'elevation_range';
    }
  }
  if (Object.keys(errors).length > 0 || durationS === null || distance === 'invalid') {
    return { ok: false, errors };
  }
  return {
    ok: true,
    cardio: {
      modality: input.modality,
      duration_s: durationS,
      distance_m: distance,
      elevation_m: elevation,
    },
  };
}

/** Stufe des Gesprächstests zur Anstrengung 0–10 (TALK_TEST_BANDS). */
export type TalkTestLevel =
  'rest' | 'full_sentences' | 'short_sentences' | 'few_words' | 'no_talking';

export function talkTestLevel(effort: number): TalkTestLevel {
  if (effort <= 0) return 'rest';
  if (effort <= TALK_TEST_BANDS.fullSentencesMax) return 'full_sentences';
  if (effort <= TALK_TEST_BANDS.shortSentencesMax) return 'short_sentences';
  if (effort <= TALK_TEST_BANDS.fewWordsMax) return 'few_words';
  return 'no_talking';
}

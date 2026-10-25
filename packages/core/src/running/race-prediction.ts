import { COMPETITION_PACE, RACE_PREDICTION } from '../constants';
import { addDays } from '../dates';
import { riegelTime } from '../plan/intensity';

const MAX_RATIO = COMPETITION_PACE.maxRiegelDistanceFactor;

/**
 * Zeitprognose für 5 km, 10 km, Halbmarathon und Marathon (Lauf-Paket 2, docs/PLAN-LAUF-PAKET-2.md 4) nach Riegel
 * (t2 = t1 × (d2/d1)^1,06, dieselbe Funktion wie die Wettkampf-Pace) aus den eigenen Läufen ab 3 km der letzten 8 Wochen – mit Bereich (Unsicherheit) und ohne
 * Prognose bei zu wenig Daten. Kein Vergleich mit anderen, keine Bestenliste. Rein.
 */

export type RaceTargetId = (typeof RACE_PREDICTION.targets)[number]['id'];

export interface RaceEffort {
  /** Tag (JJJJ-MM-TT). */
  readonly day: string;
  readonly distanceM: number;
  /** Bewegungszeit in Sekunden. */
  readonly movingS: number;
}

export interface RacePrediction {
  readonly target: RaceTargetId;
  readonly distanceM: number;
  /** Prognose in Sekunden (gerundet auf RACE_PREDICTION.targets[].roundS). */
  readonly seconds: number;
  /** Bereich (gerundet). */
  readonly lowS: number;
  readonly highS: number;
  /** Unsicherheit als Anteil (0,07 = ± 7 %). */
  readonly uncertainty: number;
  /** Grundlage: der Lauf mit der schnellsten Prognose. */
  readonly basedOn: RaceEffort;
}

export type RaceTargetResult =
  | { readonly kind: 'ok'; readonly prediction: RacePrediction }
  /** Kein Lauf lang genug (höchstens COMPETITION_PACE.maxRiegelDistanceFactor-fache Distanz). */
  | { readonly kind: 'too_short'; readonly target: RaceTargetId; readonly minEffortM: number };

export type RacePredictionResult =
  | {
      readonly kind: 'insufficient';
      /** Gezählte Läufe ab 3 km in den letzten 8 Wochen. */
      readonly efforts: number;
    }
  | {
      readonly kind: 'ok';
      readonly efforts: number;
      readonly targets: readonly RaceTargetResult[];
    };

/** Läufe, die als Grundlage zählen: Zeitraum, Mindestdistanz, plausible Pace. */
export function raceEfforts(efforts: readonly RaceEffort[], today: string): RaceEffort[] {
  const from = addDays(today, -(RACE_PREDICTION.windowDays - 1));
  return efforts.filter((e) => {
    if (!(e.day >= from && e.day <= today)) return false;
    if (!Number.isFinite(e.distanceM) || !Number.isFinite(e.movingS) || e.movingS <= 0)
      return false;
    if (e.distanceM < RACE_PREDICTION.minEffortM) return false;
    const pace = (e.movingS / e.distanceM) * 1000;
    return pace >= RACE_PREDICTION.paceS.min && pace <= RACE_PREDICTION.paceS.max;
  });
}

/** ± Anteil: Basis + je Verdopplung der Distanz, mehr bei wenigen Läufen. */
export function raceUncertainty(ratio: number, effortCount: number): number {
  const doublings = Math.abs(Math.log2(ratio));
  const extra = effortCount < RACE_PREDICTION.fewEffortsBelow ? RACE_PREDICTION.fewEffortsExtra : 0;
  return (
    Math.round(
      (RACE_PREDICTION.baseUncertainty +
        RACE_PREDICTION.uncertaintyPerDoubling * doublings +
        extra) *
        1000,
    ) / 1000
  );
}

const roundTo = (s: number, step: number) => Math.round(s / step) * step;

/**
 * Prognosen für alle Ziel-Distanzen: je Ziel nur Läufe mit höchstens maxRiegelDistanceFactor-facher (bzw. ein Viertel) Distanz; davon
 * die schnellste Prognose (der beste Lauf). Weniger als RACE_PREDICTION.minEfforts Läufe → insufficient.
 */
export function predictRaceTimes(input: {
  readonly efforts: readonly RaceEffort[];
  readonly today: string;
}): RacePredictionResult {
  const efforts = raceEfforts(input.efforts, input.today);
  if (efforts.length < RACE_PREDICTION.minEfforts) {
    return { kind: 'insufficient', efforts: efforts.length };
  }
  const targets = RACE_PREDICTION.targets.map((target): RaceTargetResult => {
    let best: { seconds: number; effort: RaceEffort; ratio: number } | null = null;
    for (const effort of efforts) {
      const ratio = target.distanceM / effort.distanceM;
      if (ratio > MAX_RATIO || ratio < 1 / MAX_RATIO) continue;
      const seconds = riegelTime(effort.movingS, effort.distanceM, target.distanceM);
      if (!best || seconds < best.seconds) best = { seconds, effort, ratio };
    }
    if (!best) {
      return {
        kind: 'too_short',
        target: target.id,
        minEffortM: Math.ceil(target.distanceM / MAX_RATIO / 100) * 100,
      };
    }
    const uncertainty = raceUncertainty(best.ratio, efforts.length);
    return {
      kind: 'ok',
      prediction: {
        target: target.id,
        distanceM: target.distanceM,
        seconds: roundTo(best.seconds, target.roundS),
        lowS: roundTo(best.seconds * (1 - uncertainty), target.roundS),
        highS: roundTo(best.seconds * (1 + uncertainty), target.roundS),
        uncertainty,
        basedOn: best.effort,
      },
    };
  });
  return { kind: 'ok', efforts: efforts.length, targets };
}

import { z } from 'zod';

import { COMPETITION_DISTANCE_M, RACE_PACE_PLAN } from '../constants';
import type { ExperienceLevel } from '../enums';
import { raceFuelingPlan, type GramRange, type RaceFuelingStage } from '../nutrition/competition';
import type { ElevationProfilePoint } from '../routes/elevation-profile';
import {
  type CompetitionReference,
  isRunCompetitionDiscipline,
  type RunCompetitionDiscipline,
} from './competition-schema';
import { goalTimePlausible, predictedTimeS, riegelReliable } from './intensity';

/**
 * Renn-Pace-Plan (Gründer-Freigabe 25.10.2026, docs/PLAN-PHASE-10.md Abschnitt 21): aus Distanz und Zielzeit eines
 * Wettkampfs Zwischenzeiten je Kilometer (ab 25 km je 5 km) – gleichmäßig (Standard), „negativ“ (zweite Hälfte etwas
 * schneller) und, wenn eine gespeicherte Strecke mit Höhenprofil gewählt ist, nach Steigung verteilt. Dazu die
 * Verpflegungspunkte aus der Wettkampf-Ernährung (raceFuelingPlan, dieselben Mengen – keine neuen Aussagen).
 *
 * Grundsatz: Die Summe aller Abschnitte ist IMMER genau die Zielzeit; die Regeln verteilen nur um. Rein und
 * deterministisch, alle Zahlen in RACE_PACE_PLAN (constants.ts, VOR LIVEGANG FACHLICH PRÜFEN).
 *
 * Für die Sprach-Ansagen (Etappe „Sprache & Trinken“) gibt es `racePaceCheckpoint(plan, distanceM, elapsedS)`: Soll-Zeit
 * an der gelaufenen Distanz, Abweichung in Sekunden, „vor/im/hinter dem Plan“, Tempo des aktuellen Abschnitts und den
 * nächsten Verpflegungspunkt – nur Zahlen und Codes, die Sätze formuliert die App.
 */

export const RACE_PACE_STRATEGIES = ['even', 'negative'] as const;
export type RacePaceStrategy = (typeof RACE_PACE_STRATEGIES)[number];

const P = RACE_PACE_PLAN;

/** Eingaben (an der Grenze mit Zod geprüft). */
export const racePaceInputSchema = z
  .strictObject({
    /** Renn-Distanz in Metern (Lauf-Disziplin oder Laufteil eines Triathlons). */
    distanceM: z.number().min(P.distanceM.min).max(P.distanceM.max),
    targetTimeS: z.number().int().positive(),
    strategy: z.enum(RACE_PACE_STRATEGIES).default('even'),
    /** Höhenprofil einer gespeicherten Strecke (tracked_routes.elevation_profile); null = flach rechnen. */
    elevationProfile: z
      .array(z.tuple([z.number().min(0), z.number()]))
      .nullable()
      .default(null),
    /**
     * Verpflegung wie die Wettkampf-Ernährung: Level und „nur allgemein“ (unter 18, ohne Einwilligung). null = ohne
     * Verpflegungspunkte.
     */
    fueling: z
      .strictObject({
        level: z.enum(['beginner', 'advanced', 'competitive']),
        generalOnly: z.boolean(),
      })
      .nullable()
      .default(null),
    /** Für die Plausibilität der Zielzeit (wie im Plan): Disziplin und Referenzzeit. */
    discipline: z.string().nullable().default(null),
    reference: z
      .strictObject({
        discipline: z.enum(['5k', '10k', 'half_marathon', 'marathon']),
        timeS: z.number().int().positive(),
        date: z.string(),
      })
      .nullable()
      .default(null),
  })
  .refine(
    (input) => {
      const pace = input.targetTimeS / (input.distanceM / 1000);
      return pace >= P.paceSPerKm.min && pace <= P.paceSPerKm.max;
    },
    { path: ['targetTimeS'], message: 'pace_out_of_range' },
  );
export type RacePaceInput = z.input<typeof racePaceInputSchema>;

/** Ein Abschnitt der Tabelle. */
export interface RacePaceSplit {
  /** 1, 2, 3 … */
  readonly index: number;
  readonly fromM: number;
  readonly toM: number;
  readonly distanceM: number;
  /** Zeit des Abschnitts in ganzen Sekunden (Summe = Zielzeit). */
  readonly timeS: number;
  /** Uhrzeit seit dem Start am Ende des Abschnitts (ganze Sekunden). */
  readonly elapsedS: number;
  /** Tempo des Abschnitts in Sekunden je km (gerundet). */
  readonly paceSPerKm: number;
  /** Höhenmeter bergauf/bergab im Abschnitt (nur mit Höhenprofil, sonst null). */
  readonly climbM: number | null;
  readonly descentM: number | null;
  /** Verpflegungspunkte in diesem Abschnitt (Index in `fuelPoints`). */
  readonly fuel: readonly number[];
}

export interface RacePaceFuelPoint {
  /** Minute nach dem Start (aus raceFuelingPlan, alle 30 min). */
  readonly minute: number;
  /** Ungefähre Stelle auf der Strecke in Metern (auf 100 m gerundet). */
  readonly distanceM: number;
  /** Menge wie in der Wettkampf-Ernährung; null = ohne Mengenangabe. */
  readonly carbsG: GramRange | null;
}

export type RacePaceNotice =
  /** Höhenprofil genutzt, Strecke auf die Renn-Distanz gestreckt (Länge wich mehr als 1 % ab). */
  | 'course_scaled'
  /** Strecke passt nicht zur Distanz (mehr als 10 % Abweichung) – flach gerechnet. */
  | 'course_mismatch'
  /** Zielzeit schneller als die Plan-Regel erlaubt (goalTimePlausible) – wie die Ampel „passt nicht zur Referenzzeit“. */
  | 'target_not_plausible'
  /** Pace hat Vorrang der Anstrengung (immer). */
  | 'effort_first';

export interface RacePacePlan {
  readonly distanceM: number;
  readonly targetTimeS: number;
  readonly strategy: RacePaceStrategy;
  /** Höhenprofil wirklich genutzt? */
  readonly elevationUsed: boolean;
  /** Durchschnittstempo (s/km, gerundet). */
  readonly averagePaceSPerKm: number;
  /** Abschnittslänge der Tabelle (1000 bzw. 5000 m). */
  readonly splitEveryM: number;
  readonly splits: readonly RacePaceSplit[];
  readonly fuelPoints: readonly RacePaceFuelPoint[];
  /** Stufe der Verpflegung (raceFuelingPlan) bzw. null ohne Verpflegung. */
  readonly fuelingStage: RaceFuelingStage | null;
  readonly carbsGPerHour: GramRange | null;
  readonly drinkMlPerHour: GramRange | null;
  /** Plausibilität der Zielzeit gegen die Referenzzeit: `unknown` ohne (verlässliche) Referenz. */
  readonly plausibility: 'plausible' | 'not_plausible' | 'unknown';
  /** Vorhersage aus der Referenzzeit (Riegel) – nur bei Lauf-Disziplin mit verlässlicher Referenz. */
  readonly predictedTimeS: number | null;
  readonly notices: readonly RacePaceNotice[];
  /** Feine Schritte (für Ansagen und Grafik): Ende in m und Uhrzeit seit Start in s (ungerundet). */
  readonly steps: readonly { readonly toM: number; readonly elapsedS: number }[];
}

export type RacePacePlanResult =
  | { readonly ok: true; readonly plan: RacePacePlan }
  | { readonly ok: false; readonly error: 'invalid_inputs' | 'pace_out_of_range' };

/** Abschnittslänge: je km, ab 25 km je 5 km. */
export function racePaceSplitEveryM(distanceM: number): number {
  return distanceM > P.longRaceFromM ? P.longRaceSplitEveryM : P.splitEveryM;
}

/** Distanz in Metern einer Lauf-Disziplin bzw. des Laufteils eines Triathlons (Sprint 5 km, Olympisch 10 km). */
export function racePaceDistanceM(discipline: string): number | null {
  if (isRunCompetitionDiscipline(discipline)) return COMPETITION_DISTANCE_M[discipline];
  if (discipline === 'triathlon_sprint') return 5000;
  if (discipline === 'triathlon_olympic') return 10000;
  return null;
}

/** Höhe (m) an der Stelle `atM` des (gestreckten) Profils, linear zwischen den Stützpunkten. */
function heightAt(profile: readonly (readonly [number, number])[], atM: number): number {
  const first = profile[0] as readonly [number, number];
  if (atM <= first[0]) return first[1] / 10;
  for (let i = 1; i < profile.length; i += 1) {
    const b = profile[i] as readonly [number, number];
    if (atM <= b[0]) {
      const a = profile[i - 1] as readonly [number, number];
      const span = b[0] - a[0];
      const f = span > 0 ? (atM - a[0]) / span : 1;
      return (a[1] + (b[1] - a[1]) * f) / 10;
    }
  }
  return (profile[profile.length - 1] as readonly [number, number])[1] / 10;
}

/** Zeit-Faktor einer Steigung (Anteil, z. B. 0,04 = 4 %): bergauf mehr, bergab weniger und begrenzt. */
export function gradeTimeFactor(grade: number): number {
  if (!Number.isFinite(grade)) return 1;
  const g = Math.max(-P.maxGrade, Math.min(P.maxGrade, grade));
  if (g >= 0) return 1 + P.uphillPerPercent * g * 100;
  const down = Math.min(-g, P.downhillBenefitMaxGrade);
  return 1 - P.downhillPerPercent * down * 100;
}

/**
 * Pace-Plan zur Zielzeit. Fehler nur bei ungültigen Eingaben (Zod) bzw. unplausiblem Tempo (2:30–15:00 min/km).
 */
export function racePacePlan(raw: RacePaceInput): RacePacePlanResult {
  const parsed = racePaceInputSchema.safeParse(raw);
  if (!parsed.success) {
    const pace = parsed.error.issues.every((i) => i.message === 'pace_out_of_range');
    return { ok: false, error: pace ? 'pace_out_of_range' : 'invalid_inputs' };
  }
  const input = parsed.data;
  const { distanceM, targetTimeS, strategy } = input;
  const notices: RacePaceNotice[] = [];

  // Höhenprofil auf die Renn-Distanz strecken (nur bei passender Länge).
  let profile: [number, number][] | null = null;
  const rawProfile = input.elevationProfile;
  if (rawProfile !== null && rawProfile.length >= 2) {
    const length = (rawProfile[rawProfile.length - 1] as [number, number])[0];
    const sorted = rawProfile.every(
      (p, i) => i === 0 || p[0] >= (rawProfile[i - 1] as [number, number])[0],
    );
    const deviation = length > 0 ? Math.abs(length - distanceM) / distanceM : Infinity;
    if (sorted && deviation <= P.courseLengthTolerance) {
      const scale = distanceM / length;
      profile = rawProfile.map(([d, h]) => [d * scale, h]);
      if (deviation > 0.01) notices.push('course_scaled');
    } else {
      notices.push('course_mismatch');
    }
  }

  // Feine Schritte mit Gewicht = Länge × Steigungs-Faktor × Strategie-Faktor.
  const steps: { from: number; to: number; weight: number; climb: number; descent: number }[] = [];
  const half = distanceM / 2;
  for (let from = 0; from < distanceM - 1e-9; from += P.stepM) {
    const to = Math.min(distanceM, from + P.stepM);
    const len = to - from;
    let grade = 0;
    let climb = 0;
    let descent = 0;
    if (profile) {
      const dh = heightAt(profile, to) - heightAt(profile, from);
      grade = dh / len;
      if (dh > 0) climb = dh;
      else descent = -dh;
    }
    const mid = (from + to) / 2;
    const strategyFactor =
      strategy === 'negative'
        ? mid < half
          ? 1 + P.negativeSplitShare / 2
          : 1 - P.negativeSplitShare / 2
        : 1;
    steps.push({ from, to, weight: len * gradeTimeFactor(grade) * strategyFactor, climb, descent });
  }
  const total = steps.reduce((s, x) => s + x.weight, 0);
  let elapsed = 0;
  const fine = steps.map((s) => {
    elapsed += (targetTimeS * s.weight) / total;
    return { ...s, toM: s.to, elapsedS: elapsed };
  });

  // Verpflegung: dieselbe Rechnung wie die Wettkampf-Ernährung; Minute → Stelle auf der Strecke.
  const fuelPoints: RacePaceFuelPoint[] = [];
  let fuelingStage: RaceFuelingStage | null = null;
  let carbsGPerHour: GramRange | null = null;
  let drinkMlPerHour: GramRange | null = null;
  if (input.fueling) {
    const minutes = Math.max(1, Math.round(targetTimeS / 60));
    const fuelPlan = raceFuelingPlan(minutes, input.fueling.level as ExperienceLevel, {
      generalOnly: input.fueling.generalOnly,
      weightKg: null,
    });
    fuelingStage = fuelPlan.stage;
    carbsGPerHour = fuelPlan.carbsGPerHour;
    drinkMlPerHour = fuelPlan.drinkMlPerHour;
    for (const step of fuelPlan.steps) {
      if (step.kind !== 'fuel') continue;
      const at = distanceAtElapsed(fine, step.fromMinute * 60);
      if (at === null || at >= distanceM) continue;
      fuelPoints.push({
        minute: step.fromMinute,
        distanceM: Math.round(at / 100) * 100,
        carbsG: step.carbsG,
      });
    }
  }

  // Abschnitte der Tabelle; Uhrzeit auf ganze Sekunden, Abschnittszeit = Differenz (Summe = Zielzeit).
  const every = racePaceSplitEveryM(distanceM);
  const splits: RacePaceSplit[] = [];
  let previousElapsed = 0;
  for (let from = 0, index = 1; from < distanceM - 1e-9; from += every, index += 1) {
    const to = Math.min(distanceM, from + every);
    // Kurzer Rest unter 50 m (z. B. 5 km + Messfehler) gehört zum letzten Abschnitt.
    const last = to >= distanceM || distanceM - to < 50;
    const end = last ? distanceM : to;
    const inSplit = fine.filter((s) => s.to > from + 1e-9 && s.to <= end + 1e-9);
    const endElapsed = last ? targetTimeS : Math.round(elapsedAt(fine, end));
    const timeS = endElapsed - previousElapsed;
    const len = end - from;
    splits.push({
      index,
      fromM: from,
      toM: end,
      distanceM: len,
      timeS,
      elapsedS: endElapsed,
      paceSPerKm: Math.round(timeS / (len / 1000)),
      climbM: profile ? Math.round(inSplit.reduce((s, x) => s + x.climb, 0)) : null,
      descentM: profile ? Math.round(inSplit.reduce((s, x) => s + x.descent, 0)) : null,
      fuel: fuelPoints
        .map((f, i) => ({ f, i }))
        .filter(({ f }) => f.distanceM > from && f.distanceM <= end)
        .map(({ i }) => i),
    });
    previousElapsed = endElapsed;
    if (last) break;
  }

  // Plausibilität wie im Plan (nur Lauf-Disziplin mit verlässlicher Referenz).
  let plausibility: RacePacePlan['plausibility'] = 'unknown';
  let predicted: number | null = null;
  const discipline = input.discipline;
  if (
    input.reference !== null &&
    discipline !== null &&
    isRunCompetitionDiscipline(discipline) &&
    riegelReliable(input.reference as CompetitionReference, discipline)
  ) {
    predicted = Math.round(
      predictedTimeS(
        input.reference as CompetitionReference,
        discipline as RunCompetitionDiscipline,
      ),
    );
    plausibility = goalTimePlausible(
      input.reference as CompetitionReference,
      discipline,
      targetTimeS,
    )
      ? 'plausible'
      : 'not_plausible';
    if (plausibility === 'not_plausible') notices.push('target_not_plausible');
  }
  notices.push('effort_first');

  return {
    ok: true,
    plan: {
      distanceM,
      targetTimeS,
      strategy,
      elevationUsed: profile !== null,
      averagePaceSPerKm: Math.round(targetTimeS / (distanceM / 1000)),
      splitEveryM: every,
      splits,
      fuelPoints,
      fuelingStage,
      carbsGPerHour,
      drinkMlPerHour,
      plausibility,
      predictedTimeS: predicted,
      notices,
      steps: fine.map((s) => ({ toM: s.toM, elapsedS: s.elapsedS })),
    },
  };
}

/** Soll-Uhrzeit (s, ungerundet) an der Stelle `atM` – linear innerhalb der feinen Schritte. */
function elapsedAt(
  fine: readonly { readonly toM: number; readonly elapsedS: number }[],
  atM: number,
): number {
  let prevTo = 0;
  let prevElapsed = 0;
  for (const s of fine) {
    if (atM <= s.toM + 1e-9) {
      const span = s.toM - prevTo;
      const f = span > 0 ? (atM - prevTo) / span : 1;
      return prevElapsed + (s.elapsedS - prevElapsed) * Math.min(1, Math.max(0, f));
    }
    prevTo = s.toM;
    prevElapsed = s.elapsedS;
  }
  return prevElapsed;
}

/** Stelle (m) zur Uhrzeit `elapsedS` – null nach dem Ziel. */
function distanceAtElapsed(
  fine: readonly { readonly toM: number; readonly elapsedS: number }[],
  elapsedS: number,
): number | null {
  let prevTo = 0;
  let prevElapsed = 0;
  for (const s of fine) {
    if (elapsedS <= s.elapsedS + 1e-9) {
      const span = s.elapsedS - prevElapsed;
      const f = span > 0 ? (elapsedS - prevElapsed) / span : 1;
      return prevTo + (s.toM - prevTo) * f;
    }
    prevTo = s.toM;
    prevElapsed = s.elapsedS;
  }
  return null;
}

/** Stand im Rennen für eine Ansage: Soll an der gelaufenen Distanz und Abweichung. */
export interface RacePaceCheckpoint {
  /** Gelaufene Distanz (auf die Renn-Distanz begrenzt). */
  readonly distanceM: number;
  /** Soll-Uhrzeit seit dem Start an dieser Stelle (ganze Sekunden). */
  readonly targetElapsedS: number;
  /** Ist minus Soll in Sekunden: positiv = hinter dem Plan, negativ = vor dem Plan. */
  readonly deltaS: number;
  /** `on_target` bei höchstens RACE_PACE_PLAN.checkpointToleranceS Abweichung. */
  readonly status: 'ahead' | 'on_target' | 'behind';
  /** Abschnitt (1-basiert), in dem die Stelle liegt, und dessen Soll-Tempo (s/km). */
  readonly splitIndex: number;
  readonly splitPaceSPerKm: number;
  /** Nächster Verpflegungspunkt ab dieser Stelle (oder null). */
  readonly nextFuel: RacePaceFuelPoint | null;
  /** Rest-Distanz bis zum Ziel (m). */
  readonly remainingM: number;
}

/**
 * Für Sprach-Ansagen (Etappe „Sprache & Trinken“, docs/PLAN-PHASE-10.md Abschnitt 21): Wo stehe ich gegenüber dem
 * Pace-Plan? Rein – Eingaben: Plan aus `racePacePlan`, gelaufene Distanz (m) und verstrichene Zeit (s, Bewegungs- oder
 * Uhrzeit nach Wahl der App). Ungültige Werte (negativ, NaN) zählen als 0.
 */
export function racePaceCheckpoint(
  plan: RacePacePlan,
  rawDistanceM: number,
  rawElapsedS: number,
): RacePaceCheckpoint {
  const distanceM = Math.min(
    plan.distanceM,
    Number.isFinite(rawDistanceM) && rawDistanceM > 0 ? rawDistanceM : 0,
  );
  const elapsedS = Number.isFinite(rawElapsedS) && rawElapsedS > 0 ? rawElapsedS : 0;
  const target = Math.round(elapsedAt(plan.steps, distanceM));
  const deltaS = Math.round(elapsedS - target);
  const status =
    Math.abs(deltaS) <= P.checkpointToleranceS ? 'on_target' : deltaS > 0 ? 'behind' : 'ahead';
  const split =
    plan.splits.find((s) => distanceM < s.toM) ??
    (plan.splits[plan.splits.length - 1] as RacePaceSplit);
  return {
    distanceM,
    targetElapsedS: target,
    deltaS,
    status,
    splitIndex: split.index,
    splitPaceSPerKm: split.paceSPerKm,
    nextFuel: plan.fuelPoints.find((f) => f.distanceM > distanceM) ?? null,
    remainingM: Math.max(0, plan.distanceM - distanceM),
  };
}

/** Kleinster Typ-Helfer für die App: ein Höhenprofil aus einer gespeicherten Strecke (oder null). */
export function racePaceProfileOf(
  profile: readonly ElevationProfilePoint[] | null | undefined,
): [number, number][] | null {
  return profile && profile.length >= 2 ? profile.map(([d, h]) => [d, h]) : null;
}

import { z } from 'zod';

import { isoDateSchema } from '../age';
import { CARB_LOADING_DAYS, COMPETITION_NUTRITION } from '../constants';
import { addDays, daysBetween, startOfIsoWeek } from '../dates';
import type { ExperienceLevel } from '../enums';
import {
  COMPETITION_STATUSES,
  type CompetitionDiscipline,
  competitionDisciplineSchema,
  competitionReferenceSchema,
} from '../plan/competition-schema';
import { predictedTimeS, riegelReliable } from '../plan/intensity';
import type { NutritionSession } from './schemas';

/**
 * Wettkampf-Ernährung (docs/PLAN-PHASE-10.md Abschnitt 10, Etappe W1; PLAN-PHASE-5 19.7 W1, 19.8). Reine Regeln ohne
 * KI: welche Tage Carb-Loading, Vorabend, Renntag und „Nach dem Rennen“ sind, welche Tage ohne Defizit geplant werden
 * (Wettkampfwoche, Plan 10 1.6 Nr. 2), die erwartete Wettkampfdauer und der Gel-/Trinkplan als feste Bausteine (Codes,
 * Texte in der App). Die Energie und die Makros rechnet weiter `nutritionTargetsForWeek` – diese Datei liefert nur
 * Eingaben. Sie kennt keine Schutzgrenzen (Strukturtest K2 in limits.test.ts).
 *
 * Alle Zahlen stehen in `constants.ts` (`CARB_LOADING_DAYS`, `COMPETITION_NUTRITION`) – VOR LIVEGANG FACHLICH PRÜFEN.
 */

/** Höchstdauer eines Wettkampfs für die Ernährung (24 h, Plausibilität). */
const MAX_RACE_MINUTES = 24 * 60;

/**
 * Wettkampf als Eingabe der Ernährungs-Engine (aus der Tabelle `competitions`, kein Gesundheitsdatum). Nur Felder, die
 * die Ernährung braucht: Stand, Distanz, Renntag, Zielzeit bzw. Referenzzeit (für die erwartete Dauer) und der
 * Ergebnis-Eintrag (dann zählt der eingetragene Lauf statt der geschätzten Renn-Energie).
 */
export const nutritionCompetitionSchema = z.strictObject({
  id: z.string().min(1).max(100),
  status: z.enum(COMPETITION_STATUSES),
  discipline: competitionDisciplineSchema,
  raceDate: isoDateSchema,
  targetTimeS: z
    .number()
    .int()
    .positive()
    .max(MAX_RACE_MINUTES * 60)
    .nullable()
    .default(null),
  reference: competitionReferenceSchema.nullable().default(null),
  resultSessionLogId: z.string().min(1).max(100).nullable().default(null),
});
export type NutritionCompetition = z.infer<typeof nutritionCompetitionSchema>;
export type NutritionCompetitionInput = z.input<typeof nutritionCompetitionSchema>;

/** Liste der Wettkämpfe (höchstens ein geplanter laut W-G9; erledigte bleiben für die Tage danach). */
export const nutritionCompetitionsSchema = z
  .array(nutritionCompetitionSchema)
  .max(100)
  .default([])
  .refine(
    (list) => new Set(list.map((c) => c.id)).size === list.length,
    'Jeder Wettkampf nur einmal.',
  );

// ---------------------------------------------------------------------------------------------------------
// Erwartete Dauer und Carb-Loading
// ---------------------------------------------------------------------------------------------------------

/** Woher die erwartete Dauer kommt: Zielzeit, Referenzzeit (Riegel) oder vorsichtige Schätzung je Distanz und Level. */
export type ExpectedRaceMinutesSource = 'target_time' | 'reference' | 'estimate';

export interface ExpectedRaceMinutes {
  readonly minutes: number;
  readonly source: ExpectedRaceMinutesSource;
}

/**
 * Erwartete Wettkampfdauer in ganzen Minuten (Plan 10: „aus Distanz und Referenz-/Zielzeit, sonst vorsichtige Schätzung
 * je Distanz und Level“). Reihenfolge: Zielzeit → Referenzzeit mit Riegel (nur innerhalb Faktor 4, `riegelReliable`) →
 * `COMPETITION_NUTRITION.estimatedMinutes`.
 */
const raceDurationInputSchema = nutritionCompetitionSchema.pick({
  discipline: true,
  targetTimeS: true,
  reference: true,
});

export function expectedRaceMinutes(
  raw: z.input<typeof raceDurationInputSchema>,
  level: ExperienceLevel,
): ExpectedRaceMinutes {
  const competition = raceDurationInputSchema.parse({
    discipline: raw.discipline,
    targetTimeS: raw.targetTimeS,
    reference: raw.reference,
  });
  const clamp = (minutes: number) => Math.min(Math.max(Math.round(minutes), 1), MAX_RACE_MINUTES);
  if (competition.targetTimeS !== null) {
    return { minutes: clamp(competition.targetTimeS / 60), source: 'target_time' };
  }
  if (
    competition.reference !== null &&
    riegelReliable(competition.reference, competition.discipline)
  ) {
    return {
      minutes: clamp(predictedTimeS(competition.reference, competition.discipline) / 60),
      source: 'reference',
    };
  }
  return {
    minutes: COMPETITION_NUTRITION.estimatedMinutes[competition.discipline][level],
    source: 'estimate',
  };
}

/** Anzahl Carb-Loading-Tage vor dem Renntag: unter 90 min keiner, sonst 1 bzw. ab 150 min 2 (`CARB_LOADING_DAYS`). */
export function carbLoadingDayCount(expectedMinutes: number): number {
  if (!(expectedMinutes >= COMPETITION_NUTRITION.carbLoadingFromMinutes)) return 0;
  return expectedMinutes >= COMPETITION_NUTRITION.twoLoadingDaysFromMinutes
    ? CARB_LOADING_DAYS.max
    : CARB_LOADING_DAYS.min;
}

// ---------------------------------------------------------------------------------------------------------
// Tage rund um den Wettkampf
// ---------------------------------------------------------------------------------------------------------

export const COMPETITION_DAY_KINDS = [
  'carb_loading',
  'race_eve',
  'race_day',
  'post_race',
  'normal',
] as const;
export type CompetitionDayKind = (typeof COMPETITION_DAY_KINDS)[number];

/** Vorrang, wenn sich zwei Wettkämpfe überschneiden (z. B. „Nach dem Rennen“ und der Vorabend des nächsten). */
const KIND_PRIORITY: Readonly<Record<CompetitionDayKind, number>> = {
  race_day: 4,
  race_eve: 3,
  carb_loading: 2,
  post_race: 1,
  normal: 0,
};

export interface CompetitionDay {
  readonly date: string;
  readonly kind: CompetitionDayKind;
  /** Carb-Loading laut Regel (erwartete Dauer ≥ 90 min, 1–2 Tage direkt vor dem Renntag, inkl. Vorabend). */
  readonly carbLoading: boolean;
  /**
   * Tag ohne Defizit (Plan 10 1.6 Nr. 2): Kalenderwoche des Renntags, dazu Carb-Loading-Tage bzw. der Vorabend davor
   * und der Tag nach dem Rennen. Ein konkretes Abnehmziel ruht hier; danach kein Aufholen (Anpassung bleibt in
   * [Standard; 0], weight-goal.ts).
   */
  readonly noDeficit: boolean;
  /** Der Wettkampf, der diesen Tag bestimmt; null an normalen Tagen. */
  readonly competition: {
    readonly id: string;
    readonly discipline: CompetitionDiscipline;
    readonly raceDate: string;
    readonly expectedMinutes: number;
    readonly minutesSource: ExpectedRaceMinutesSource;
    readonly resultSessionLogId: string | null;
  } | null;
}

function dayForOne(
  competition: NutritionCompetition,
  date: string,
  level: ExperienceLevel,
): CompetitionDay | null {
  if (competition.status === 'cancelled') return null;
  const expected = expectedRaceMinutes(competition, level);
  const loadingDays = carbLoadingDayCount(expected.minutes);
  const race = competition.raceDate;
  const before = daysBetween(date, race);
  let kind: CompetitionDayKind = 'normal';
  if (before === 0) kind = 'race_day';
  else if (before === 1) kind = 'race_eve';
  else if (before > 1 && before <= loadingDays) kind = 'carb_loading';
  else if (before < 0 && -before <= COMPETITION_NUTRITION.noDeficitDaysAfterRace) {
    kind = 'post_race';
  }
  const raceWeek = startOfIsoWeek(race);
  const first = addDays(race, -Math.max(loadingDays, 1));
  const windowStart = first < raceWeek ? first : raceWeek;
  const afterRace = addDays(race, COMPETITION_NUTRITION.noDeficitDaysAfterRace);
  const sunday = addDays(raceWeek, 6);
  const windowEnd = afterRace > sunday ? afterRace : sunday;
  const noDeficit = date >= windowStart && date <= windowEnd;
  if (kind === 'normal' && !noDeficit) return null;
  return {
    date,
    kind,
    carbLoading: before >= 1 && before <= loadingDays,
    noDeficit,
    competition: {
      id: competition.id,
      discipline: competition.discipline,
      raceDate: race,
      expectedMinutes: expected.minutes,
      minutesSource: expected.source,
      resultSessionLogId: competition.resultSessionLogId,
    },
  };
}

/**
 * Art eines Tages rund um die Wettkämpfe. Abgesagte Wettkämpfe zählen nicht (Tage normal). Mehrere Wettkämpfe: der Tag
 * mit dem höchsten Vorrang gewinnt (Renntag > Vorabend > Carb-Loading > Nach dem Rennen); „ohne Defizit“ gilt, sobald
 * ein Wettkampf es verlangt.
 */
export function competitionDayFor(
  rawCompetitions: readonly NutritionCompetitionInput[],
  rawDate: string,
  level: ExperienceLevel,
): CompetitionDay {
  const competitions = nutritionCompetitionsSchema.parse(rawCompetitions);
  const date = isoDateSchema.parse(rawDate);
  let best: CompetitionDay | null = null;
  let noDeficit = false;
  // Stabile Reihenfolge: früherer Renntag, dann ID.
  const sorted = [...competitions].sort((a, b) =>
    a.raceDate === b.raceDate ? (a.id < b.id ? -1 : 1) : a.raceDate < b.raceDate ? -1 : 1,
  );
  for (const competition of sorted) {
    const day = dayForOne(competition, date, level);
    if (day === null) continue;
    noDeficit ||= day.noDeficit;
    if (best === null || KIND_PRIORITY[day.kind] > KIND_PRIORITY[best.kind]) best = day;
  }
  if (best === null) {
    return { date, kind: 'normal', carbLoading: false, noDeficit: false, competition: null };
  }
  return { ...best, noDeficit };
}

/** `competitionDays(competition, week)` (Plan 10): die sieben Tage der ISO-Woche ab `weekStart` (Montag). */
export function competitionDays(
  competitions: readonly NutritionCompetitionInput[],
  weekStart: string,
  level: ExperienceLevel,
): CompetitionDay[] {
  const monday = isoDateSchema.parse(weekStart);
  if (startOfIsoWeek(monday) !== monday) throw new RangeError('Die Woche beginnt am Montag.');
  return Array.from({ length: 7 }, (_, i) =>
    competitionDayFor(competitions, addDays(monday, i), level),
  );
}

/**
 * Geschätzte Renn-Einheit für die Trainingsenergie des Renntags (Plan 10 3.5: der Renntag ist keine geplante Einheit).
 * Nur als zusätzliche Eingabe der Energie (Laufen, Anstrengung unbekannt → Ersatz-MET); der Deckel
 * `TRAINING_KCAL_DAY_MAX` gilt wie immer. Gibt es schon einen Ergebnis-Eintrag, zählt dieser (freie Einheit) – dann
 * null, damit nichts doppelt zählt.
 */
export function raceDaySession(day: CompetitionDay): NutritionSession | null {
  if (day.kind !== 'race_day' || day.competition === null) return null;
  if (day.competition.resultSessionLogId !== null) return null;
  return {
    sessionId: `race:${day.competition.id}`,
    planId: 'competition',
    planStatus: 'active',
    scheduledOn: day.date,
    kind: 'endurance',
    enduranceModality: 'run',
    effortTarget: null,
    minutes: day.competition.expectedMinutes,
    isDeload: false,
    status: 'planned',
  };
}

/**
 * Kohlenhydrat-Richtwert in g/kg, den die Makros an diesem Tag anstreben (nur soweit die Energie es zulässt):
 * Carb-Loading-Tage den unteren Ratgeber-Wert (8 g/kg), sonst null (es gilt die normale Regel).
 */
export function competitionCarbsGPerKg(day: CompetitionDay): number | null {
  return day.carbLoading ? COMPETITION_NUTRITION.carbLoadingGPerKg.min : null;
}

// ---------------------------------------------------------------------------------------------------------
// Gel-/Trinkplan und Frühstück am Renntag (feste Bausteine, Texte in der App)
// ---------------------------------------------------------------------------------------------------------

export interface GramRange {
  readonly min: number;
  readonly max: number;
}

/** Stufe des Plans während des Rennens. `general` = nur allgemein (unter 18, `no_targets`), ohne Gramm. */
export type RaceFuelingStage = 'none' | 'general' | 'moderate' | 'high';

export const RACE_FUELING_NOTICES = [
  /** „Nichts Neues am Renntag“ – immer. */
  'nothing_new',
  /** Unter 60 min: während des Rennens nichts nötig. */
  'no_fuel_needed',
  /** Hohe Stufe (60–90 g/h) bzw. jeder Plan mit Portionen: vorher im langen Lauf testen. */
  'test_in_long_run',
  /** Über 150 min, aber Einsteiger: bleibt bei 30–60 g/h. */
  'beginner_moderate_only',
  /**
   * Nur allgemein („Kohlenhydrate in kleinen Mengen, z. B. Banane“): unter 18 (Plan 10) und ohne Ziele (`no_targets`:
   * keine Einwilligung, Schwangerschaft – Plan 10: „nur allgemeine Hinweise“).
   */
  'general_only',
  /** Trinken nach Durst (Richtwert), bei Hitze mehr und an Salz denken. */
  'heat_and_salt',
] as const;
export type RaceFuelingNotice = (typeof RACE_FUELING_NOTICES)[number];

export type RaceFuelingStepKind = 'breakfast' | 'start' | 'fuel' | 'finish' | 'recovery_meal';

/** Schritt der Zeitleiste in Minuten relativ zum Start (negativ = vorher). */
export interface RaceFuelingStep {
  readonly kind: RaceFuelingStepKind;
  readonly fromMinute: number;
  readonly toMinute: number;
  /** Kohlenhydrate in g für diesen Schritt; null = ohne Mengenangabe. */
  readonly carbsG: GramRange | null;
}

export interface RaceFuelingPlan {
  readonly expectedMinutes: number;
  readonly stage: RaceFuelingStage;
  readonly carbsGPerHour: GramRange | null;
  /** Richtwert Trinken; null unter 60 min (vorher normal trinken). */
  readonly drinkMlPerHour: GramRange | null;
  readonly steps: readonly RaceFuelingStep[];
  readonly notices: readonly RaceFuelingNotice[];
}

const fuelingOptionsSchema = z.strictObject({
  /** Nur allgemein, keine Gramm: unter 18 am Renntag oder Modus `no_targets`. */
  generalOnly: z.boolean(),
  /** Körpergewicht für die Frühstücks-Gramm (nur mit Einwilligung); null = ohne Gramm. */
  weightKg: z.number().positive().max(500).nullable().default(null),
});
export type RaceFuelingOptions = z.input<typeof fuelingOptionsSchema>;

const STEP_ROUND_G = 5;
const roundDown = (value: number) => Math.floor(value / STEP_ROUND_G) * STEP_ROUND_G;
const roundUp = (value: number) => Math.ceil(value / STEP_ROUND_G) * STEP_ROUND_G;

/** Kohlenhydrate fürs Frühstück 2–4 h vorher: 1–4 g/kg (Thomas 2016), auf 5 g nach innen gerundet. */
export function raceBreakfastCarbs(weightKg: number): GramRange {
  const w = z.number().positive().max(500).parse(weightKg);
  const { min, max } = COMPETITION_NUTRITION.raceBreakfast.carbsGPerKg;
  return { min: roundUp(min * w), max: Math.max(roundUp(min * w), roundDown(max * w)) };
}

/**
 * Gel-/Trinkplan (Plan 10 Abschnitt 10, Jeukendrup 2014): unter 60 min nichts nötig; 60–150 min ca. 30–60 g/h; darüber
 * 60–90 g/h nur für Fortgeschrittene/Leistungssport (mit „vorher im langen Lauf testen“), Einsteiger 30–60 g/h; unter 18
 * und ohne Ziele nur allgemein. Trinken nach Durst (400–800 ml/h). Zeitleiste: Frühstück 2–4 h vorher, Start, Portionen alle 30 min,
 * Ziel, Mahlzeit nach dem Rennen innerhalb 1–2 h. Keine Marken, kein Koffein.
 */
export function raceFuelingPlan(
  rawExpectedMinutes: number,
  level: ExperienceLevel,
  rawOptions: RaceFuelingOptions,
): RaceFuelingPlan {
  const expectedMinutes = z.number().int().min(1).max(MAX_RACE_MINUTES).parse(rawExpectedMinutes);
  const options = fuelingOptionsSchema.parse(rawOptions);
  const F = COMPETITION_NUTRITION.fueling;
  const notices: RaceFuelingNotice[] = ['nothing_new'];
  let stage: RaceFuelingStage;
  let perHour: GramRange | null = null;
  if (expectedMinutes < F.noneBelowMinutes) {
    stage = 'none';
    notices.push('no_fuel_needed');
  } else if (options.generalOnly) {
    stage = 'general';
    notices.push('general_only');
  } else if (expectedMinutes <= F.moderateUpToMinutes) {
    stage = 'moderate';
    perHour = F.moderateGPerHour;
  } else if ((F.highLevels as readonly ExperienceLevel[]).includes(level)) {
    stage = 'high';
    perHour = F.highGPerHour;
  } else {
    stage = 'moderate';
    perHour = F.moderateGPerHour;
    notices.push('beginner_moderate_only');
  }
  if (perHour !== null) notices.push('test_in_long_run');
  const drink = expectedMinutes >= F.noneBelowMinutes ? COMPETITION_NUTRITION.drinkMlPerHour : null;
  if (drink !== null) notices.push('heat_and_salt');

  const B = COMPETITION_NUTRITION.raceBreakfast;
  const steps: RaceFuelingStep[] = [
    {
      kind: 'breakfast',
      fromMinute: -B.hoursBefore.max * 60,
      toMinute: -B.hoursBefore.min * 60,
      carbsG:
        options.weightKg !== null && !options.generalOnly
          ? raceBreakfastCarbs(options.weightKg)
          : null,
    },
    { kind: 'start', fromMinute: 0, toMinute: 0, carbsG: null },
  ];
  if (perHour !== null) {
    const portion: GramRange = {
      min: roundUp((perHour.min * F.intervalMinutes) / 60),
      max: roundDown((perHour.max * F.intervalMinutes) / 60),
    };
    for (let at = F.intervalMinutes; at < expectedMinutes; at += F.intervalMinutes) {
      steps.push({ kind: 'fuel', fromMinute: at, toMinute: at, carbsG: portion });
    }
  }
  steps.push({
    kind: 'finish',
    fromMinute: expectedMinutes,
    toMinute: expectedMinutes,
    carbsG: null,
  });
  const R = COMPETITION_NUTRITION.recoveryMealWithinHours;
  steps.push({
    kind: 'recovery_meal',
    fromMinute: expectedMinutes + R.min * 60,
    toMinute: expectedMinutes + R.max * 60,
    carbsG: null,
  });
  return { expectedMinutes, stage, carbsGPerHour: perHour, drinkMlPerHour: drink, steps, notices };
}

/**
 * Ratgeber „Wettkampf-Ernährung“ für den Link in der App: der erste (bereits für die Person lesbare) Ratgeber, dessen ID
 * „wettkampf“ enthält; null, wenn es keinen gibt (dann kein Link).
 */
export function competitionGuideId(guides: readonly { readonly id: string }[]): string | null {
  return guides.find((g) => g.id.includes('wettkampf'))?.id ?? null;
}

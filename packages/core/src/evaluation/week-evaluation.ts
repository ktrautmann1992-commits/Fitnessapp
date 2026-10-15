import { isoDateSchema } from '../age';
import { WEEK_EVALUATION } from '../constants';
import { startOfIsoWeek } from '../dates';
import type { SessionAchievement, SessionAchievementInput } from '../log/achievement';
import {
  type DayItem,
  type SummaryLog,
  type SummarySession,
  weekLogSummary,
  type WeekSummary,
} from '../log/summary';
import type { NutritionNoticeCode } from '../nutrition/notices';
import { type DayEvaluation, type DayEvaluationInput, dayEvaluation } from './day-evaluation';
import { INTAKE_ZONE_IDS, type IntakeHidden, type IntakeZoneId } from './intake-zone';

/**
 * Wochenauswertung (docs/PLAN-AUSWERTUNG.md Abschnitt 8, Etappe A3; 2.1–2.5, A-G10, A-G13). Mo–So.
 *
 * Baut ausschließlich auf `weekLogSummary()` (Einheiten und Einträge je Tag, Summen) und `dayEvaluation()` (je Tag
 * Kalorienbalken und Erfüllungsgrad) auf – rechnet keine Ziele, keine Zonen und keine Grenzen selbst. Dadurch sind die
 * Wochenzahlen genau die Summe der Tagesansichten („Dein Tag“).
 *
 * - Essen: Zonen-Anzahl nur über VERGANGENE Tage mit Einträgen (heute zählt als „offen“, Tage ohne Eintrag zählen
 *   nicht). Durchschnitt je eingetragenem Tag gegen das Durchschnittsziel genau dieser Tage. KEINE Wochen-Bilanz in kcal,
 *   keine Summe, keine Prognose (2.4, PLAN-ZIELE F7). Muster-Hinweis ab `WEEK_EVALUATION.patternBelowFloorMinDays`
 *   vergangenen Tagen unter der Untergrenze (2.4, A-G13).
 * - Ohne Zahlen („Kalorienzahlen aus“ oder Schwangerschaft/Stillzeit an einem Tag der Woche): Essen nur als Anzahl
 *   (Tage mit Einträgen, Mahlzeiten „x von y“) – der Typ enthält dann keine kcal (2.3, A-G8).
 * - Training: je Einheit Tag, Stufe und Erfüllungsgrad (2.5); Summen Einheiten erledigt/geplant, Kraft-Sätze
 *   erfüllt/geplant, Ausdauer-Minuten gemacht/geplant, Distanz. Freie Einheiten getrennt.
 *
 * Ziele und Zonen werden nie gespeichert und nie geloggt (2.7).
 */

/** Ein Tag der Woche: wie `DayEvaluationInput`, ohne das, was die Woche selbst liefert (Training, heute, Zahlen). */
export type WeekEvaluationDayInput = Pick<
  DayEvaluationInput,
  'date' | 'targets' | 'foodLog' | 'mealPlan'
>;

/** Vorgaben einer geplanten Einheit (für „geplant“ bei Einheiten ohne Eintrag). */
export interface PlannedSessionTargets {
  /** Summe der Vorgabe-Sätze (`planned_exercises.sets`); null = keine Kraft-Einheit. */
  readonly strengthSets: number | null;
  /** Geplante Minuten (`estimated_minutes`) einer Ausdauer-Einheit; null = keine Ausdauer-Einheit. */
  readonly enduranceMinutes: number | null;
  /** Erholungs- bzw. Einstiegswoche (`is_deload` / `is_intro_week`). */
  readonly easyWeek: 'recovery' | 'intro' | null;
}

export interface WeekEvaluationInput {
  /** Montag der Woche (A-G10). */
  readonly weekStart: string;
  readonly today: string;
  /** Schalter „Kalorienzahlen anzeigen“ (Schwangerschaft prüft `dayEvaluation` je Tag zusätzlich). */
  readonly showNumbers: boolean;
  /** Genau die sieben Tage Mo–So in dieser Reihenfolge. */
  readonly days: readonly WeekEvaluationDayInput[];
  /** Eingaben von `weekLogSummary` (alle Einheiten und Einträge; die Funktion wählt die Woche selbst). */
  readonly sessions: readonly SummarySession[];
  readonly logs: readonly SummaryLog[];
  /** Eingaben des Erfüllungsgrads je Eintrag (`logId`). */
  readonly achievements: ReadonlyMap<string, SessionAchievementInput>;
  /** Vorgaben je geplanter Einheit (`sessionId`). */
  readonly plannedTargets: ReadonlyMap<string, PlannedSessionTargets>;
}

export type WeekTiming = 'past' | 'current' | 'future';

/** Tagesauswertung ohne Zahlen (Kalorienbalken `hidden`). */
export type DayEvaluationWithoutNumbers = Omit<DayEvaluation, 'showNumbers' | 'food'> & {
  readonly showNumbers: false;
  readonly food: Omit<DayEvaluation['food'], 'intake'> & { readonly intake: IntakeHidden };
};

export interface WeekTrainingItem {
  readonly date: string;
  readonly item: DayItem;
  readonly achievement: SessionAchievement | null;
}

export interface WeekTraining {
  /** Einheiten des Plans (auch offene, verpasste, gestrichene, entfallene) in Tagesfolge. */
  readonly items: readonly WeekTrainingItem[];
  /** Freie Einheiten (A1b) – extra aufgeführt, nicht in den Plan-Summen. */
  readonly free: readonly WeekTrainingItem[];
  /** Erledigt = Einträge ohne freie; geplant = Einheiten des aktiven Plans dieser Woche (`weekLogSummary`). */
  readonly sessions: { readonly done: number; readonly planned: number };
  /** Kraft-Sätze: erfüllt (2.5) und geplant (Vorgabe); `done` = abgehakt. */
  readonly strengthSets: {
    readonly fulfilled: number;
    readonly planned: number;
    readonly done: number;
  };
  /** Ausdauer-Minuten (ganze Minuten je Eintrag, abgerundet) gemacht und geplant. */
  readonly enduranceMinutes: { readonly done: number; readonly planned: number };
  /** Distanz in Metern (Anzeige; es gibt kein Distanz-Ziel). */
  readonly distanceM: number;
  readonly freeTotals: {
    readonly sessions: number;
    readonly strengthSets: number;
    readonly enduranceMinutes: number;
    readonly distanceM: number;
  };
}

/** Essen der Woche ohne Zahlen: nur Anzahlen, keine kcal, keine Farben, keine Bewertung (2.3, A-G8). */
export interface WeekFoodWithoutNumbers {
  readonly kind: 'hidden';
  readonly available: boolean;
  /** Vergangene Tage mit mindestens einem Eintrag. */
  readonly entryDays: number;
  /** Mahlzeiten „x von y abgehakt“ über die VERGANGENEN Tage mit verwendbarem Essensplan; null = keiner. */
  readonly meals: { readonly eaten: number; readonly planned: number } | null;
  /** Die Woche enthält heute – der Tag läuft noch und zählt nicht mit (auch nicht bei den Mahlzeiten). */
  readonly todayOpen: boolean;
  /**
   * Nur der feste Hilfe-Hinweis (PLAN-PHASE-5 4.9) – ohne Einleitung, ohne „Mindestbedarf“, ohne Zahl (Wächter A3 G1,
   * sichere Voreinstellung). Intern weiter gezählt: ab `patternBelowFloorMinDays` vergangenen Tagen unter der
   * Untergrenze. Nie bei Schwangerschaft/Stillzeit (dort gibt es keine Untergrenze, der Hinweis auf Ärztin/Arzt/Hebamme
   * bleibt).
   */
  readonly helpNotice: boolean;
}

export interface WeekFoodWithNumbers {
  readonly kind: 'numbers';
  readonly available: boolean;
  /** Vergangene Tage mit mindestens einem Eintrag. */
  readonly entryDays: number;
  /** Davon mit Kalorienbalken (Einträge mit kcal). */
  readonly valuedDays: number;
  /** Davon nur Einträge ohne Kalorienangabe (kein Balken, keine Zone). */
  readonly withoutValueDays: number;
  /** Davon ohne Tagesziel (keine Körperdaten u. Ä.): Einträge mit kcal, aber keine Zone (Wächter A3 S2). */
  readonly noTargetDays: number;
  /** Anzahl der vergangenen Tage je Zone (Summe = `valuedDays`). */
  readonly zoneCounts: Readonly<Record<IntakeZoneId, number>>;
  /** Ø je Tag mit Balken: gegessen gegen Ø-Tagesziel dieser Tage; null ohne solchen Tag. Keine Summe, keine Bilanz. */
  readonly average: { readonly eatenKcal: number; readonly targetKcal: number } | null;
  /** Vergangene Tage unter der Untergrenze (= `zoneCounts.below_floor`). */
  readonly belowFloorDays: number;
  /** Fester Hinweis mit Hilfe-Stellen (2.4, A-G13) – einmal je Woche. */
  readonly patternNotice: boolean;
  /**
   * Vergangene Tage, deren gespeicherter Essensplan selbst unter der Untergrenze liegt (Hinweis `plan_below_floor`).
   * Sie zählen weiter mit; die Woche nennt dazu den Plan-Hinweis (Wächter A3 G2), damit die Hilfe nicht wie ein
   * Vorwurf wirkt.
   */
  readonly planBelowFloorDays: number;
  readonly meals: { readonly eaten: number; readonly planned: number } | null;
  readonly todayOpen: boolean;
  /** Hinweis-Codes der Engine (Einladung Körperdaten/Einwilligung) – je Code einmal. */
  readonly targetNotices: readonly NutritionNoticeCode[];
}

interface WeekEvaluationBase {
  readonly weekStart: string;
  readonly timing: WeekTiming;
  /** Erholungs- bzw. Einstiegswoche – „leichter ist hier richtig“. */
  readonly easyWeek: 'recovery' | 'intro' | null;
  readonly training: WeekTraining;
}

export interface WeekEvaluationWithNumbers extends WeekEvaluationBase {
  readonly showNumbers: true;
  readonly days: readonly DayEvaluation[];
  readonly food: WeekFoodWithNumbers;
}

export interface WeekEvaluationWithoutNumbers extends WeekEvaluationBase {
  readonly showNumbers: false;
  readonly days: readonly DayEvaluationWithoutNumbers[];
  readonly food: WeekFoodWithoutNumbers;
}

export type WeekEvaluation = WeekEvaluationWithNumbers | WeekEvaluationWithoutNumbers;

/** Montag prüfen und die sieben Tage der Woche aus `weekLogSummary` (Mo–So) abgleichen. */
function checkedWeek(input: WeekEvaluationInput): WeekSummary {
  const weekStart = isoDateSchema.parse(input.weekStart);
  isoDateSchema.parse(input.today);
  if (startOfIsoWeek(weekStart) !== weekStart) {
    throw new RangeError('Die Woche beginnt am Montag.');
  }
  const summary = weekLogSummary(input.sessions, input.logs, weekStart, input.today);
  if (
    input.days.length !== summary.days.length ||
    input.days.some((d, i) => d.date !== summary.days[i]?.date)
  ) {
    throw new RangeError('Eine Woche hat genau die Tage Montag bis Sonntag.');
  }
  return summary;
}

function evaluateDays(
  input: WeekEvaluationInput,
  summary: WeekSummary,
  showNumbers: boolean,
): DayEvaluation[] {
  return input.days.map((day, i) =>
    dayEvaluation({
      ...day,
      today: input.today,
      showNumbers,
      trainingItems: summary.days[i]?.items ?? [],
      achievements: input.achievements,
    }),
  );
}

function trainingOf(
  input: WeekEvaluationInput,
  all: WeekSummary,
  days: readonly DayEvaluation[],
): WeekTraining {
  // Summen aus `weekLogSummary`: alle Einträge minus freie Einträge = Einheiten des Plans (auch verwaiste).
  const freeLogs = input.logs.filter((l) => l.is_free === true);
  const freeSummary = weekLogSummary([], freeLogs, all.weekStart, input.today);
  const logById = new Map(input.logs.map((l) => [l.id, l] as const));

  const items: WeekTrainingItem[] = [];
  const free: WeekTrainingItem[] = [];
  let fulfilledSets = 0;
  let plannedSets = 0;
  let plannedMinutes = 0;
  let distanceM = 0;
  let freeDistanceM = 0;
  for (const day of days) {
    for (const { item, achievement } of day.training.items) {
      const entry: WeekTrainingItem = { date: day.date, item, achievement };
      const log = item.logId === null ? undefined : logById.get(item.logId);
      if (item.free) {
        free.push(entry);
        freeDistanceM += log?.cardio_distance_m ?? 0;
        continue;
      }
      items.push(entry);
      const targets =
        item.sessionId === null ? undefined : input.plannedTargets.get(item.sessionId);
      if (log !== undefined) {
        distanceM += log.cardio_distance_m ?? 0;
        if (achievement !== null) {
          for (const exercise of achievement.exercises) {
            if (exercise.targetSets === null) continue;
            plannedSets += exercise.targetSets;
            fulfilledSets += exercise.fulfilledSets;
          }
          plannedMinutes += achievement.endurance?.plannedMinutes ?? 0;
        } else {
          plannedSets += targets?.strengthSets ?? 0;
          plannedMinutes += targets?.enduranceMinutes ?? 0;
        }
      } else if (item.status === 'missed' || item.status === 'planned') {
        // Offene bzw. verpasste Einheit des aktiven Plans: zählt zu „geplant“ (gestrichene und entfallene nicht).
        plannedSets += targets?.strengthSets ?? 0;
        plannedMinutes += targets?.enduranceMinutes ?? 0;
      }
    }
  }
  return {
    items,
    free,
    sessions: { done: all.sessionsDone - freeSummary.sessionsDone, planned: all.sessionsPlanned },
    strengthSets: {
      fulfilled: fulfilledSets,
      planned: plannedSets,
      done: all.strengthSets - freeSummary.strengthSets,
    },
    enduranceMinutes: {
      done: all.enduranceMinutes - freeSummary.enduranceMinutes,
      planned: plannedMinutes,
    },
    distanceM,
    freeTotals: {
      sessions: freeSummary.sessionsDone,
      strengthSets: freeSummary.strengthSets,
      enduranceMinutes: freeSummary.enduranceMinutes,
      distanceM: freeDistanceM,
    },
  };
}

function weekTiming(summary: WeekSummary, today: string): WeekTiming {
  if (today < summary.weekStart) return 'future';
  const weekEnd = summary.days.at(-1)?.date ?? summary.weekStart;
  return today > weekEnd ? 'past' : 'current';
}

function easyWeekOf(
  input: WeekEvaluationInput,
  training: WeekTraining,
): WeekEvaluationBase['easyWeek'] {
  const kinds = new Set<'recovery' | 'intro'>();
  for (const { item, achievement } of training.items) {
    if (achievement?.easyWeek) kinds.add(achievement.easyWeek);
    const planned = item.sessionId === null ? undefined : input.plannedTargets.get(item.sessionId);
    if (planned?.easyWeek) kinds.add(planned.easyWeek);
  }
  return kinds.has('recovery') ? 'recovery' : kinds.has('intro') ? 'intro' : null;
}

/** Mahlzeiten nur über vergangene Tage – heute läuft noch (Wächter A3 H1). */
function mealsOf(days: readonly DayEvaluation[]) {
  const withPlan = days.filter((d) => d.timing === 'past' && d.food.meals !== null);
  if (withPlan.length === 0) return null;
  return {
    eaten: withPlan.reduce((sum, d) => sum + (d.food.meals?.eaten ?? 0), 0),
    planned: withPlan.reduce((sum, d) => sum + (d.food.meals?.planned ?? 0), 0),
  };
}

function foodWithNumbers(days: readonly DayEvaluation[], todayOpen: boolean): WeekFoodWithNumbers {
  const past = days.filter((d) => d.timing === 'past');
  const zoneCounts = Object.fromEntries(INTAKE_ZONE_IDS.map((zone) => [zone, 0])) as Record<
    IntakeZoneId,
    number
  >;
  let eaten = 0;
  let target = 0;
  let valuedDays = 0;
  for (const day of past) {
    const intake = day.food.intake;
    if (intake.kind !== 'bar' || intake.zone === 'open') continue;
    zoneCounts[intake.zone] += 1;
    eaten += intake.eatenKcal;
    target += intake.targetKcal;
    valuedDays += 1;
  }
  const withEntries = past.filter((d) => d.food.entryCount > 0);
  const entryDays = withEntries.length;
  const belowFloorDays = zoneCounts.below_floor;
  return {
    kind: 'numbers',
    available: days.some((d) => d.food.available),
    entryDays,
    valuedDays,
    // Nur Tage, deren Einträge wirklich keine kcal haben (kein Balken trotz Ziel) – nicht Tage ohne Ziel (S2).
    withoutValueDays: withEntries.filter((d) => d.food.intake.kind === 'no_entries').length,
    noTargetDays: withEntries.filter((d) => d.food.intake.kind === 'no_target').length,
    zoneCounts,
    average:
      valuedDays === 0 ? null : { eatenKcal: eaten / valuedDays, targetKcal: target / valuedDays },
    belowFloorDays,
    patternNotice: belowFloorDays >= WEEK_EVALUATION.patternBelowFloorMinDays,
    planBelowFloorDays: past.filter((d) => d.notices.includes('plan_below_floor')).length,
    meals: mealsOf(days),
    todayOpen,
    targetNotices: [...new Set(days.flatMap((d) => d.food.targetNotices))],
  };
}

function withoutNumbers(day: DayEvaluation): DayEvaluationWithoutNumbers {
  if (day.showNumbers || day.food.intake.kind !== 'hidden') {
    throw new RangeError('Tag mit Zahlen in einer Woche ohne Zahlen.');
  }
  return { ...day, showNumbers: false, food: { ...day.food, intake: { kind: 'hidden' } } };
}

export function weekEvaluation(
  input: WeekEvaluationInput & { readonly showNumbers: false },
): WeekEvaluationWithoutNumbers;
export function weekEvaluation(input: WeekEvaluationInput): WeekEvaluation;
export function weekEvaluation(input: WeekEvaluationInput): WeekEvaluation {
  const summary = checkedWeek(input);
  let days = evaluateDays(input, summary, input.showNumbers);
  // Schwangerschaft/Stillzeit an EINEM Tag → die ganze Woche ohne Zahlen (wie `weekHidesEnergyNumbers`, 2.3).
  const showNumbers = input.showNumbers && days.every((d) => d.showNumbers);
  if (input.showNumbers && !showNumbers) days = evaluateDays(input, summary, false);
  const training = trainingOf(input, summary, days);
  const base = {
    weekStart: summary.weekStart,
    timing: weekTiming(summary, input.today),
    easyWeek: easyWeekOf(input, training),
    training,
  };
  const todayOpen = days.some((d) => d.timing === 'today');
  if (!showNumbers) {
    const past = days.filter((d) => d.timing === 'past');
    // G1: intern mit Zahlen weiterzählen (das Ergebnis enthält davon nur einen Wahrheitswert). dayEvaluation blendet
    // Schwangerschaft/Stillzeit selbst aus – dann nie ein Hilfe-Hinweis über die Untergrenze.
    const counted = input.showNumbers ? days : evaluateDays(input, summary, true);
    const pregnancy = counted.some((d) => !d.showNumbers);
    const belowFloor = counted.filter(
      (d) =>
        d.timing === 'past' && d.food.intake.kind === 'bar' && d.food.intake.zone === 'below_floor',
    ).length;
    return {
      ...base,
      showNumbers: false,
      days: days.map(withoutNumbers),
      food: {
        kind: 'hidden',
        available: days.some((d) => d.food.available),
        entryDays: past.filter((d) => d.food.entryCount > 0).length,
        meals: mealsOf(days),
        todayOpen,
        helpNotice: !pregnancy && belowFloor >= WEEK_EVALUATION.patternBelowFloorMinDays,
      },
    };
  }
  return { ...base, showNumbers: true, days, food: foodWithNumbers(days, todayOpen) };
}

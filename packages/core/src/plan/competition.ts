import { z } from 'zod';

import { ageInYears, isoDateSchema } from '../age';
import {
  AGE_PLAN_RULES,
  COMPETITION_GROUP_RULES,
  COMPETITION_LEAD_WEEKS,
  COMPETITION_LONG_RUN,
  COMPETITION_OWN_START,
  COMPETITION_PERIODIZATION,
  COMPETITION_REQUIRED_PEAK,
  COMPETITION_START_REFERENCE,
  ENDURANCE_START_RULES,
  MIN_AGE_YEARS,
} from '../constants';
import { addDays, daysBetween, startOfIsoWeek } from '../dates';
import type { ExperienceLevel } from '../enums';
import {
  type Competition,
  COMPETITION_DISCIPLINES,
  type CompetitionDiscipline,
  type CompetitionGoal,
  type CompetitionInput,
  competitionOwnStartSchema,
  type CompetitionPhase,
  type CompetitionReference,
  competitionWindowSchema,
  latestRaceDate,
  ownStartAllowedLevel,
} from './competition-schema';
import {
  type EnduranceReference,
  type EnduranceWeekInput,
  enduranceStartMinutes,
  enduranceWeekVolumes,
} from './endurance';
import { type PlanInputs, type PlanInputsInput, planInputsSchema } from './inputs';
import { goalTimePlausible, hardWorkoutLimits, riegelReliable } from './intensity';
import {
  type CompetitionBlock,
  competitionBlocks,
  type CompetitionWorkoutBase,
  type CycleRestart,
  isLoadWeek,
  type MacroCycle,
  macroCycle,
  nextCompetitionBlock,
  trailingLoadWeeks,
} from './periodization';
import {
  ENDURANCE_START_GROUPS,
  type EnduranceStartGroup,
  isStricterGroup,
  planSafetyRules,
  type PlanSafetyRules,
} from './safety';
import {
  blockWeekDays,
  type BlockWeekSpec,
  chooseLongRunIndex,
  competitionLongRun,
  enduranceReferenceFromBlock,
  enduranceReferenceFromMinutes,
  type PlannedDay,
  type PreviousSession,
  resolveTrainingWeek,
} from './schedule';

/**
 * Wettkampf: Mindestvorlauf, Spitzenumfang, Ampel (docs/PLAN-PHASE-10.md Abschnitte 3.2, 3.3 und 5, Etappe WP1).
 * Reine Funktionen, deterministisch (das Datum wird übergeben), keine KI. Die Ampel rechnet mit DERSELBEN Kette wie
 * der Plan: enduranceWeekVolumes (10-%-Regel über increasedMinutes) je Block, Bezug zwischen den Blöcken wie
 * enduranceReferenceFromBlock – nie gestaucht.
 */

/** Mindestvorlauf in Wochen (Tabelle 3.2). */
export function minimumLeadWeeks(
  discipline: CompetitionDiscipline,
  level: ExperienceLevel,
): number {
  return COMPETITION_LEAD_WEEKS.minimum[discipline][level];
}

/** Mindest-Spitzenumfang je Distanz und Ziel (Wochenminuten, Richtwert langer Lauf). */
export function requiredPeak(
  discipline: CompetitionDiscipline,
  goal: CompetitionGoal = 'finish',
): { readonly weeklyMinutes: number; readonly longRunMinutes: number } {
  return COMPETITION_REQUIRED_PEAK[goal][discipline];
}

/**
 * Geforderter langer Lauf (Gründer-Entscheidung G2, Präzisierung WP2): Richtwert aus COMPETITION_REQUIRED_PEAK, aber
 * höchstens 50 % des Spitzen-Wochenumfangs – mehr ist mit Plateau (G3) und 50-%-Regel (G2) nie erreichbar.
 */
export function requiredLongRun(
  discipline: CompetitionDiscipline,
  goal: CompetitionGoal = 'finish',
): number {
  const peak = requiredPeak(discipline, goal);
  return Math.min(
    peak.longRunMinutes,
    Math.floor(peak.weeklyMinutes * COMPETITION_LONG_RUN.maxShareOfWeek),
  );
}

/** Spalte für den Mindestvorlauf: vorsichtige Startgruppe wie Einsteiger (strengste Regel gewinnt). */
export function leadLevel(level: ExperienceLevel, group: EnduranceStartGroup): ExperienceLevel {
  return group === 'cautious' ? 'beginner' : level;
}

/** Frühester Renntag = heute + Mindestvorlauf (in ganzen Wochen). */
export function earliestRaceDate(
  today: string,
  discipline: CompetitionDiscipline,
  level: ExperienceLevel,
): string {
  return addDays(today, minimumLeadWeeks(discipline, level) * 7);
}

const R = COMPETITION_START_REFERENCE;

/**
 * Bezug aus dem Tagebuch (competitionStartReference: enduranceReferenceFromBlock mit eingetragenen Minuten) – Grenze
 * mit Zod (Wächter H2): Wochenumfang 0 oder 10–1.680 min, längste Einheit 10–240 min und nie über dem Wochenumfang,
 * Startgruppe des bisherigen Plans Pflicht (Wächter H1).
 */
export const competitionStartReferenceSchema = z
  .strictObject({
    volume: z.number().int().min(0).max(R.maxWeeklyMinutes),
    sessionCap: z.number().int().min(R.minMinutes).max(R.maxSessionMinutes).nullable(),
    startGroup: z.enum(ENDURANCE_START_GROUPS),
  })
  .refine((r) => r.volume === 0 || r.volume >= R.minMinutes, {
    path: ['volume'],
    message: 'Unter 10 Minuten zählt nicht als Bezug.',
  })
  .refine((r) => r.sessionCap === null || r.sessionCap <= r.volume, {
    path: ['sessionCap'],
    message: 'Die längste Einheit ist länger als die ganze Woche.',
  });
export type CompetitionStartReference = z.infer<typeof competitionStartReferenceSchema>;

/**
 * Bezug für den Start eines Wettkampfplans IN CORE aus dem bisherigen Plan gerechnet (bevorzugter Weg, Wächter H1):
 * letzte Belastungswoche ohne gestrichene Einheiten, mit Tagebuch nur min(geplant, eingetragen)
 * (enduranceReferenceFromBlock), dazu die Startgruppe, mit der dieser Plan erstellt wurde (planStartGroup bzw.
 * safety_rules). null = kein Bezug (unter 10 Minuten oder keine Belastungswoche).
 */
export function competitionStartReference(
  previous: readonly PreviousSession[],
  previousStartGroup: EnduranceStartGroup,
  loggedMinutes?: ReadonlyMap<string, number>,
): CompetitionStartReference | null {
  const reference = enduranceReferenceFromBlock(previous, loggedMinutes);
  if (reference.volume <= 0) return null;
  const volume = Math.min(reference.volume, R.maxWeeklyMinutes);
  const cap =
    reference.sessionCap === null
      ? null
      : Math.min(reference.sessionCap, volume, R.maxSessionMinutes);
  return { volume, sessionCap: cap, startGroup: previousStartGroup };
}

/** Zusatzangaben zum Wettkampf (W-G5): eigener Startumfang und Bezug aus dem Tagebuch, beide optional. */
export const competitionRequestSchema = z.strictObject({
  ownStart: competitionOwnStartSchema.nullable().default(null),
  startReference: competitionStartReferenceSchema.nullable().default(null),
  /** Wunsch-Tag des langen Laufs (ISO-Wochentag 1–7), null = automatisch (WP2, Plan 3.5). */
  longRunWeekday: z.number().int().min(1).max(7).nullable().default(null),
});

export interface CompetitionRequest {
  readonly competition: CompetitionInput;
  readonly ownStart?: z.input<typeof competitionOwnStartSchema> | null;
  /**
   * Bezug der letzten Belastungswoche aus dem Tagebuch (min(geplant, eingetragen)) samt Startgruppe des bisherigen
   * Plans – am besten über competitionStartReference() aus den gespeicherten Einheiten.
   */
  readonly startReference?: CompetitionStartReference | null;
  /** Wunsch-Tag des langen Laufs (1 = Montag … 7 = Sonntag); fehlt/null = automatisch (Standard: Wochenende). */
  readonly longRunWeekday?: number | null;
}

export type OwnStartNotice = 'own_start_capped' | 'own_start_ignored' | 'own_start_journal_used';

/**
 * Eigener Startumfang (W-G5): nur Fortgeschritten/Leistungssport außerhalb der vorsichtigen Startgruppe, nur bestätigt
 * (Schema), gedeckelt auf das Doppelte des Startumfangs der Gruppe. Mit Bezug aus dem Tagebuch gilt dieser, die eigene
 * Angabe wird nicht genutzt. `minutes` null = Startumfang der Gruppe.
 */
export function ownStartMinutes(
  own: { readonly weeklyMinutes: number } | null,
  level: ExperienceLevel,
  group: EnduranceStartGroup,
  hasJournalReference: boolean,
): { readonly minutes: number | null; readonly notice: OwnStartNotice | null } {
  if (own === null) return { minutes: null, notice: null };
  if (hasJournalReference) return { minutes: null, notice: 'own_start_journal_used' };
  if (!ownStartAllowedLevel(level) || group === 'cautious') {
    return { minutes: null, notice: 'own_start_ignored' };
  }
  const groupStart = ENDURANCE_START_RULES.startWeeklyMinutes[group];
  const cap = groupStart * COMPETITION_OWN_START.maxFactor;
  const minutes = Math.floor(own.weeklyMinutes);
  if (minutes > cap) return { minutes: cap, notice: 'own_start_capped' };
  return { minutes, notice: null };
}

export const FEASIBILITY_STATUSES = ['ok', 'tight', 'too_short', 'not_available'] as const;
export type FeasibilityStatus = (typeof FEASIBILITY_STATUSES)[number];

export const FEASIBILITY_REASONS = [
  'pregnancy',
  'health_check_required',
  'minor_distance_limit',
  'lead_time_below_minimum',
  // Vor den Umfangs-Gründen (Wächter N5): ist der Tag des langen Laufs zu kurz, ist er die Ursache.
  'long_run_day_too_short',
  'peak_not_reachable',
  'weekly_time_too_low',
  'peak_reached_late',
  'goal_time_not_allowed',
  'goal_time_not_reachable',
  'long_run_not_reachable',
] as const;
export type FeasibilityReason = (typeof FEASIBILITY_REASONS)[number];

export const FEASIBILITY_NOTICES = [
  'medical_clearance',
  'beginner_marathon',
  'minor_no_target_time',
  'own_start_capped',
  'own_start_ignored',
  'own_start_journal_used',
  'start_reference_capped',
  'walk_only_plan',
  'reference_distance_too_far',
  'long_run_day_not_endurance',
] as const;
export type FeasibilityNotice = (typeof FEASIBILITY_NOTICES)[number];

export type FeasibilitySuggestion =
  | { readonly kind: 'shorter_distance'; readonly discipline: CompetitionDiscipline }
  | { readonly kind: 'later_date'; readonly raceDate: string }
  | { readonly kind: 'more_training_time'; readonly weeklyMinutes: number }
  /** Am Tag des langen Laufs mehr Zeit einplanen (Minuten, WP2). */
  | { readonly kind: 'longer_long_run_day'; readonly minutes: number }
  | { readonly kind: 'health_check' }
  | { readonly kind: 'without_competition' };

export interface CompetitionFeasibility {
  /**
   * Ampel: `ok` Passt, `tight` Knapp (Plan, Ziel „Ankommen“), `too_short` Zu kurz (kein Plan), `not_available` kein
   * Wettkampfplan für diese Personengruppe bzw. Distanz (Tabelle 3.3; kein Plan).
   */
  readonly status: FeasibilityStatus;
  /** Wirksames Ziel: „Zielzeit“ nur bei `ok` mit erlaubter und erreichbarer Zielzeit. */
  readonly effectiveGoal: CompetitionGoal;
  readonly reasons: readonly FeasibilityReason[];
  readonly notices: readonly FeasibilityNotice[];
  readonly suggestions: readonly FeasibilitySuggestion[];
  readonly leadWeeks: number;
  readonly minimumLeadWeeks: number;
  readonly earliestRaceDate: string;
  /** Mindest-Spitzenumfang (Wochenminuten) des wirksamen Ziels. */
  readonly requiredWeeklyMinutes: number;
  /** Höchster geplanter Umfang einer Belastungswoche vor dem Tapering (0 = keine). */
  readonly plannedPeakMinutes: number;
  /** Startumfang der Kette (Gruppe, eigene Angabe oder null bei Bezug aus dem Tagebuch). */
  readonly startMinutes: number | null;
  /** Geforderter langer Lauf des wirksamen Ziels (requiredLongRun, WP2). */
  readonly requiredLongRunMinutes: number;
  /** Längste geplante Einheit einer Belastungswoche vor dem Tapering (0 = keine). */
  readonly plannedLongRunMinutes: number;
}

export type CompetitionFeasibilityResult =
  | { readonly ok: true; readonly feasibility: CompetitionFeasibility }
  | { readonly ok: false; readonly error: 'invalid_inputs' };

/** Alles, was Ampel und Plan aus den Eingaben ableiten (intern, gleiche Rechnung für beide). */
interface Context {
  readonly inputs: PlanInputs;
  readonly today: string;
  readonly rules: PlanSafetyRules;
  readonly level: ExperienceLevel;
  readonly group: EnduranceStartGroup;
  /** Aufgelöste Woche (resolveTrainingWeek) – Ausdauer-Tage für die Kette. */
  readonly days: readonly PlannedDay[];
  readonly wishWeekly: number;
  readonly startMinutes: number | undefined;
  readonly reference: EnduranceReference | null;
  /** Aktuelle Startgruppe strenger als die des Bezugs → Kette beginnt neu (stricterGroup). */
  readonly referenceStricter: boolean;
  readonly referenceCapped: boolean;
  readonly ownNotice: OwnStartNotice | null;
  readonly minor: boolean;
  readonly senior: boolean;
  /** Wunsch-Tag des langen Laufs (null = automatisch). */
  readonly longRunWeekday: number | null;
  /** Referenzzeit (Pace, Zielzeit-Plausibilität) und Zielzeit des Wettkampfs. */
  readonly raceReference: CompetitionReference | null;
  readonly targetTimeS: number | null;
}

function buildContext(
  inputs: PlanInputs,
  request: {
    ownStart: { weeklyMinutes: number } | null;
    startReference: CompetitionStartReference | null;
    longRunWeekday: number | null;
  },
  today: string,
  competition: Competition,
): Context {
  const rules = planSafetyRules(inputs, today);
  const group = rules.enduranceStartGroup;
  const days = resolveTrainingWeek(inputs.schedule, group).days;
  const wishWeekly = days
    .filter((d) => d.kind === 'endurance')
    .reduce((sum, d) => sum + d.minutes, 0);
  const raw =
    request.startReference && request.startReference.volume > 0 ? request.startReference : null;
  // Deckel wie W-G5 (Wächter H2): höchstens 2 × Startumfang der aktuellen Gruppe.
  const limit = R.maxFactor * ENDURANCE_START_RULES.startWeeklyMinutes[group];
  const reference: EnduranceReference | null = raw
    ? {
        volume: Math.min(raw.volume, limit),
        sessionCap: raw.sessionCap === null ? null : Math.min(raw.sessionCap, raw.volume, limit),
      }
    : null;
  const own = ownStartMinutes(request.ownStart, inputs.experienceLevel, group, reference !== null);
  const age = ageInYears(inputs.birthDate, today);
  return {
    inputs,
    today,
    rules,
    level: inputs.experienceLevel,
    group,
    days,
    wishWeekly,
    startMinutes: own.minutes ?? undefined,
    reference,
    referenceStricter: raw !== null && isStricterGroup(group, raw.startGroup),
    referenceCapped: raw !== null && raw.volume > limit,
    ownNotice: own.notice,
    minor: age < AGE_PLAN_RULES.minor.belowAge,
    senior: age >= AGE_PLAN_RULES.senior.fromAge,
    longRunWeekday: request.longRunWeekday,
    raceReference: competition.reference,
    targetTimeS: competition.targetTimeS,
  };
}

/** Wochenbau-Angaben für eine Disziplin (gleich in Ampel und Plan). */
function workoutBase(ctx: Context, discipline: CompetitionDiscipline): CompetitionWorkoutBase {
  return {
    discipline,
    level: ctx.level,
    limits: hardWorkoutLimits(ctx.rules, ctx.level),
    longRunWeekday: ctx.longRunWeekday,
    pace: ctx.raceReference ? { reference: ctx.raceReference, discipline } : null,
  };
}

/** Wunsch-Minuten des Tages, an dem der lange Lauf liegt (volle Woche). */
function longRunDayWish(ctx: Context): number {
  const endurance = ctx.days.filter((d) => d.kind === 'endurance');
  const index = chooseLongRunIndex(endurance, ctx.longRunWeekday);
  return index < 0 ? 0 : (endurance[index]?.minutes ?? 0);
}

/** Startumfang der Kette (wie enduranceWeekVolumes). */
function chainStart(ctx: Context): number {
  return ctx.startMinutes === undefined
    ? enduranceStartMinutes(ctx.group, ctx.wishWeekly)
    : Math.min(Math.floor(ctx.wishWeekly), ctx.startMinutes);
}

/**
 * Plateau des Wochenumfangs: bis zum Spitzenumfang des Ziels, nie unter dem Start (bzw. Bezug), nie über dem Wunsch.
 */
function peakTargetFor(
  ctx: Context,
  discipline: CompetitionDiscipline,
  goal: CompetitionGoal,
): number {
  const base = ctx.reference
    ? ctx.referenceStricter
      ? Math.min(ctx.reference.volume, ENDURANCE_START_RULES.startWeeklyMinutes[ctx.group])
      : ctx.reference.volume
    : chainStart(ctx);
  return Math.min(
    Math.floor(ctx.wishWeekly),
    Math.max(base, requiredPeak(discipline, goal).weeklyMinutes),
  );
}

function cycleFor(
  ctx: Context,
  discipline: CompetitionDiscipline,
  raceDate: string,
  planStart: string,
  restart?: CycleRestart,
) {
  return macroCycle(
    {
      discipline,
      raceDate,
      experienceLevel: ctx.level,
      group: ctx.group,
      cautious: ctx.rules.cautious,
    },
    planStart,
    restart,
  );
}

/** Ausdauer-Eingaben einer Block-Woche für enduranceWeekVolumes (dieselbe Tag-Auswahl wie der Plan). */
function enduranceInputs(
  specs: readonly BlockWeekSpec[],
  days: readonly PlannedDay[],
  from: string | null,
): EnduranceWeekInput[] {
  return specs.map((spec) => ({
    kind: spec.weekNo === 0 ? 'week0' : spec.kind,
    wishes: blockWeekDays(spec, days, from)
      .filter((d) => d.kind === 'endurance')
      .map((d) => d.minutes),
    ...(() => {
      const longRun = competitionLongRun(
        spec.workouts,
        spec.weekNo,
        blockWeekDays(spec, days, from),
      );
      return longRun ? { longRun } : {};
    })(),
    ...(spec.enduranceVolumeFactor === undefined
      ? {}
      : { volumeFactor: spec.enduranceVolumeFactor }),
    ...(spec.enduranceMaxBudget === undefined ? {} : { maxBudget: spec.enduranceMaxBudget }),
  }));
}

export interface SimulatedWeek {
  readonly index: number;
  readonly monday: string;
  readonly phase: CompetitionPhase;
  readonly load: boolean;
  /** Geplante Ausdauer-Minuten der Woche (Summe der Einheiten). */
  readonly minutes: number;
  /** Längste Ausdauer-Einheit der Woche (langer Lauf, WP2). */
  readonly longestMinutes: number;
}

/**
 * Wochenumfänge des ganzen Makrozyklus – Block für Block wie der Plan (erster Block ab `from`, Bezug der Folgeblöcke
 * aus der letzten Belastungswoche wie enduranceReferenceFromBlock). Wie nextPlanBlock übernimmt ein Folgeblock nur die
 * Ausdauer-Tage, die in der letzten Belastungswoche eine Einheit hatten (unter 10 Minuten gestrichene Tage fehlen danach
 * – bestehende Regel aus Phase 3), und rechnet den Wunsch-Umfang aus diesen Tagen.
 */
function simulate(
  ctx: Context,
  cycle: MacroCycle,
  peakTarget: number,
  discipline: CompetitionDiscipline = cycle.discipline,
): SimulatedWeek[] {
  const blocks = competitionBlocks(cycle, peakTarget, undefined, workoutBase(ctx, discipline));
  const result: SimulatedWeek[] = [];
  let reference: EnduranceReference | null = ctx.reference;
  let lastLoad: readonly number[] = [];
  let lastLoadWeekdays: readonly number[] = [];
  let days: readonly PlannedDay[] = ctx.days;
  for (const [b, block] of blocks.entries()) {
    const from = b === 0 ? ctx.today : null;
    const wishWeekly = days
      .filter((d) => d.kind === 'endurance')
      .reduce((sum, d) => sum + d.minutes, 0);
    // Eigener Startumfang und strengere Gruppe nur im ersten Block (Wächter M2/H1), wie im Plan.
    const volumes = enduranceWeekVolumes(enduranceInputs(block.specs, days, from), {
      group: ctx.group,
      wishWeekly,
      reference,
      ...(b === 0 && ctx.referenceStricter ? { stricterGroup: true } : {}),
      ...(b === 0 && ctx.startMinutes !== undefined ? { startMinutes: ctx.startMinutes } : {}),
    });
    for (const [k, spec] of block.specs.entries()) {
      const minutes = volumes.weeks[k]?.minutes ?? [];
      const week = block.weeks[k];
      if (!week) continue;
      if (spec.weekNo >= 1 && spec.kind !== 'deload') {
        lastLoad = minutes;
        lastLoadWeekdays = blockWeekDays(spec, days, from)
          .filter((d) => d.kind === 'endurance')
          .map((d) => d.weekday);
      }
      result.push({
        index: week.index,
        monday: week.monday,
        phase: week.phase,
        load: isLoadWeek(week),
        minutes: minutes.reduce((sum, m) => sum + m, 0),
        longestMinutes: Math.max(0, ...minutes),
      });
    }
    // Wie nextPlanBlock: Bezug = letzte Belastungswoche (enduranceReferenceFromBlock), Tage = Muster dieser Woche.
    reference = enduranceReferenceFromMinutes(lastLoad);
    const kept = new Set(lastLoadWeekdays.filter((_, i) => (lastLoad[i] ?? 0) > 0));
    const next = days.filter((d) => d.kind !== 'endurance' || kept.has(d.weekday));
    if (next.length > 0) days = next;
  }
  return result;
}

interface Evaluation {
  readonly status: FeasibilityStatus;
  readonly effectiveGoal: CompetitionGoal;
  readonly reasons: FeasibilityReason[];
  readonly plannedPeak: number;
  readonly plannedLongRun: number;
  readonly cycle: MacroCycle | null;
  readonly peakTarget: number;
}

function notAvailableReasons(ctx: Context, discipline: CompetitionDiscipline): FeasibilityReason[] {
  const reasons: FeasibilityReason[] = [];
  if (ctx.inputs.healthScreening?.flags.includes('pregnancy')) reasons.push('pregnancy');
  if (ctx.inputs.healthScreening === null) reasons.push('health_check_required');
  const maxIndex = COMPETITION_DISCIPLINES.indexOf(COMPETITION_GROUP_RULES.minorMaxDiscipline);
  if (ctx.minor && COMPETITION_DISCIPLINES.indexOf(discipline) > maxIndex) {
    reasons.push('minor_distance_limit');
  }
  return reasons;
}

/** Zielzeit erlaubt? Fortgeschritten/Leistungssport außerhalb der vorsichtigen Startgruppe (Flag, ab 65, unter 18). */
function timeGoalAllowed(ctx: Context): boolean {
  return (
    (COMPETITION_GROUP_RULES.timeGoalLevels as readonly ExperienceLevel[]).includes(ctx.level) &&
    ctx.group !== 'cautious'
  );
}

/** Ampel ohne Vorschläge (auch für die Suche nach Vorschlägen). */
function evaluate(
  ctx: Context,
  discipline: CompetitionDiscipline,
  raceDate: string,
  requestedGoal: CompetitionGoal,
): Evaluation {
  const finish = requiredPeak(discipline, 'finish').weeklyMinutes;
  const blocked = notAvailableReasons(ctx, discipline);
  if (blocked.length > 0) {
    return {
      status: 'not_available',
      effectiveGoal: 'finish',
      reasons: blocked,
      plannedPeak: 0,
      plannedLongRun: 0,
      cycle: null,
      peakTarget: 0,
    };
  }
  const reasons: FeasibilityReason[] = [];
  const allowed = timeGoalAllowed(ctx);
  if (requestedGoal === 'time' && !allowed) reasons.push('goal_time_not_allowed');
  // Zielzeit-Plausibilität gegen die Referenzzeit (Riegel, WP2): sonst „Ankommen“ (höchstens „knapp“).
  const plausible =
    requestedGoal !== 'time' || goalTimePlausible(ctx.raceReference, discipline, ctx.targetTimeS);
  if (requestedGoal === 'time' && allowed && !plausible) reasons.push('goal_time_not_reachable');
  const planGoal: CompetitionGoal =
    requestedGoal === 'time' && allowed && plausible ? 'time' : 'finish';
  const lead = Math.floor(daysBetween(ctx.today, raceDate) / 7);
  const minLead = minimumLeadWeeks(discipline, leadLevel(ctx.level, ctx.group));
  const tooLittleTime = ctx.wishWeekly < finish;
  const cycle = lead >= minLead ? cycleFor(ctx, discipline, raceDate, ctx.today) : null;
  if (cycle === null) {
    reasons.push('lead_time_below_minimum');
    if (tooLittleTime) reasons.push('weekly_time_too_low');
    return {
      status: 'too_short',
      effectiveGoal: 'finish',
      reasons,
      plannedPeak: 0,
      plannedLongRun: 0,
      cycle,
      peakTarget: 0,
    };
  }
  const weeks = simulate(ctx, cycle, peakTargetFor(ctx, discipline, planGoal), discipline).filter(
    (w) => w.load,
  );
  // Wochenumfang UND langer Lauf in derselben Belastungswoche (G2: die Ampel prüft den langen Lauf mit).
  const at = (minutes: number, long: number) =>
    weeks.filter((w) => w.minutes >= minutes && w.longestMinutes >= long).length;
  const okWeeks = COMPETITION_PERIODIZATION.okPeakWeeks;
  const finishLong = requiredLongRun(discipline, 'finish');
  const timeOk =
    planGoal === 'time' &&
    at(requiredPeak(discipline, 'time').weeklyMinutes, requiredLongRun(discipline, 'time')) >=
      okWeeks;
  if (planGoal === 'time' && !timeOk) reasons.push('goal_time_not_reachable');
  const effectiveGoal: CompetitionGoal = timeOk ? 'time' : 'finish';
  const finishWeeks = at(finish, finishLong);
  let status: FeasibilityStatus;
  if (timeOk || finishWeeks >= okWeeks) {
    status = 'ok';
  } else if (finishWeeks >= 1) {
    status = 'tight';
    reasons.push('peak_reached_late');
  } else {
    status = 'too_short';
    if (at(finish, 0) === 0) reasons.push('peak_not_reachable');
    else reasons.push('long_run_not_reachable');
    if (tooLittleTime) reasons.push('weekly_time_too_low');
    if (longRunDayWish(ctx) < finishLong) reasons.push('long_run_day_too_short');
  }
  // Gewünschte Zielzeit nicht möglich → höchstens „knapp“ (Ziel „Ankommen“, Plan 3.2).
  if (requestedGoal === 'time' && effectiveGoal === 'finish' && status === 'ok') status = 'tight';
  // G7: Lauf-Wettkampf, aber der Plan ist nur zügiges Gehen (Flag, ab 65) → höchstens „knapp“ (Hinweis walk_only_plan).
  if (ctx.rules.enduranceWalkOnly && status === 'ok') status = 'tight';
  const peakTarget = peakTargetFor(ctx, discipline, effectiveGoal);
  const planned =
    effectiveGoal === planGoal
      ? weeks
      : simulate(ctx, cycle, peakTarget, discipline).filter((w) => w.load);
  return {
    status,
    effectiveGoal,
    reasons,
    plannedPeak: planned.reduce((max, w) => Math.max(max, w.minutes), 0),
    plannedLongRun: planned.reduce((max, w) => Math.max(max, w.longestMinutes), 0),
    cycle,
    peakTarget,
  };
}

const usable = (status: FeasibilityStatus) => status === 'ok' || status === 'tight';

function suggestionsFor(
  ctx: Context,
  competition: Competition,
  evaluation: Evaluation,
): FeasibilitySuggestion[] {
  const out: FeasibilitySuggestion[] = [];
  const { status, reasons } = evaluation;
  if (status === 'ok') return out;
  if (reasons.includes('health_check_required')) out.push({ kind: 'health_check' });
  const blockedForGroup =
    reasons.includes('pregnancy') || reasons.includes('health_check_required');
  if (!blockedForGroup) {
    // Kürzere Distanz am selben Tag (längste, die passt bzw. knapp ist).
    const index = COMPETITION_DISCIPLINES.indexOf(competition.discipline);
    for (let i = index - 1; i >= 0; i -= 1) {
      const shorter = COMPETITION_DISCIPLINES[i] as CompetitionDiscipline;
      if (usable(evaluate(ctx, shorter, competition.raceDate, 'finish').status)) {
        out.push({ kind: 'shorter_distance', discipline: shorter });
        break;
      }
    }
    // Frühester späterer Renntag (bei „knapp“: frühester, der passt). Reicht die Wunsch-Zeit nie für den
    // Spitzenumfang, hilft kein Datum (der Umfang steigt nie über den Wunsch) – dann keine Suche.
    const goalForDate: CompetitionGoal = status === 'tight' ? competition.goal : 'finish';
    const reachable =
      ctx.wishWeekly >= requiredPeak(competition.discipline, goalForDate).weeklyMinutes &&
      longRunDayWish(ctx) >= requiredLongRun(competition.discipline, goalForDate) &&
      // G7: „nur Gehen“ bleibt höchstens „knapp“ – ein späteres Datum macht daraus nie „passt“.
      !(status === 'tight' && ctx.rules.enduranceWalkOnly);
    if (status !== 'not_available' && reachable) {
      const wanted = (s: FeasibilityStatus) => (status === 'tight' ? s === 'ok' : usable(s));
      const latest = latestRaceDate(ctx.today);
      for (let d = addDays(competition.raceDate, 1); d <= latest; d = addDays(d, 1)) {
        if (wanted(evaluate(ctx, competition.discipline, d, goalForDate).status)) {
          out.push({ kind: 'later_date', raceDate: d });
          break;
        }
      }
    }
    if (reasons.includes('weekly_time_too_low')) {
      out.push({
        kind: 'more_training_time',
        weeklyMinutes: requiredPeak(competition.discipline, 'finish').weeklyMinutes,
      });
    }
    if (reasons.includes('long_run_day_too_short')) {
      out.push({
        kind: 'longer_long_run_day',
        minutes: requiredLongRun(competition.discipline, 'finish'),
      });
    }
  }
  if (status === 'too_short' || status === 'not_available')
    out.push({ kind: 'without_competition' });
  return out;
}

function noticesFor(ctx: Context, competition: Competition): FeasibilityNotice[] {
  const notices = new Set<FeasibilityNotice>();
  if (ctx.rules.medicalNotice || ctx.senior) notices.add('medical_clearance');
  if (ctx.level === 'beginner' && competition.discipline === 'marathon') {
    notices.add('beginner_marathon');
  }
  if (ctx.minor) notices.add('minor_no_target_time');
  if (ctx.ownNotice) notices.add(ctx.ownNotice);
  if (ctx.referenceCapped) notices.add('start_reference_capped');
  if (ctx.rules.enduranceWalkOnly) notices.add('walk_only_plan');
  // Wächter M3: Referenz zu weit von der Renn-Distanz entfernt → keine Zielzeit/kein Renntempo aus Riegel.
  if (ctx.raceReference && !riegelReliable(ctx.raceReference, competition.discipline)) {
    notices.add('reference_distance_too_far');
  }
  // Wächter N6: Wunsch-Tag des langen Laufs ist kein Ausdauer-Tag → automatisch gewählt, mit Hinweis.
  if (
    ctx.longRunWeekday !== null &&
    !ctx.days.some((d) => d.kind === 'endurance' && d.weekday === ctx.longRunWeekday)
  ) {
    notices.add('long_run_day_not_endurance');
  }
  return FEASIBILITY_NOTICES.filter((n) => notices.has(n));
}

interface Parsed {
  readonly ctx: Context;
  readonly competition: Competition;
}

/**
 * Eingaben prüfen (Zod an der Grenze) und Kontext zum Stichtag `today` bauen; das Datumsfenster des Wettkampfs gilt ab
 * `windowFrom` (beim Erstellen = heute, beim Folgeblock = Planstart). null = ungültig.
 */
function parse(
  rawInputs: PlanInputsInput,
  request: CompetitionRequest,
  today: string,
  windowFrom: string = today,
): Parsed | null {
  if (!isoDateSchema.safeParse(today).success || !isoDateSchema.safeParse(windowFrom).success) {
    return null;
  }
  const inputs = planInputsSchema.safeParse(rawInputs);
  const competition = competitionWindowSchema(windowFrom).safeParse(request.competition);
  const extra = competitionRequestSchema.safeParse({
    ownStart: request.ownStart ?? null,
    startReference: request.startReference ?? null,
    longRunWeekday: request.longRunWeekday ?? null,
  });
  if (!inputs.success || !competition.success || !extra.success) return null;
  const plan = inputs.data;
  if (plan.birthDate > today || ageInYears(plan.birthDate, today) < MIN_AGE_YEARS) return null;
  // Wettkampfplan nur beim Hauptziel Ausdauer; die Disziplin des Ziels ist die des Wettkampfs.
  if (plan.goalType !== 'endurance' || plan.discipline !== competition.data.discipline) return null;
  return {
    ctx: buildContext(plan, extra.data, today, competition.data),
    competition: competition.data,
  };
}

function feasibilityOf(
  parsed: Parsed,
  withSuggestions = true,
): { feasibility: CompetitionFeasibility; evaluation: Evaluation } {
  const { ctx, competition } = parsed;
  const evaluation = evaluate(ctx, competition.discipline, competition.raceDate, competition.goal);
  const minLead = minimumLeadWeeks(competition.discipline, leadLevel(ctx.level, ctx.group));
  const feasibility: CompetitionFeasibility = {
    status: evaluation.status,
    effectiveGoal: evaluation.effectiveGoal,
    reasons: FEASIBILITY_REASONS.filter((r) => evaluation.reasons.includes(r)),
    notices: noticesFor(ctx, competition),
    suggestions: withSuggestions ? suggestionsFor(ctx, competition, evaluation) : [],
    leadWeeks: Math.floor(daysBetween(ctx.today, competition.raceDate) / 7),
    minimumLeadWeeks: minLead,
    earliestRaceDate: addDays(ctx.today, minLead * 7),
    requiredWeeklyMinutes: requiredPeak(competition.discipline, evaluation.effectiveGoal)
      .weeklyMinutes,
    plannedPeakMinutes: evaluation.plannedPeak,
    startMinutes: ctx.reference ? null : chainStart(ctx),
    requiredLongRunMinutes: requiredLongRun(competition.discipline, evaluation.effectiveGoal),
    plannedLongRunMinutes: evaluation.plannedLongRun,
  };
  return { feasibility, evaluation };
}

/**
 * Ampel für einen Wettkampf (Plan 3.2/3.3): `ok` | `tight` | `too_short` | `not_available` mit Gründen, Hinweisen und
 * Vorschlägen (kürzere Distanz, frühester späterer Renntag, mehr Trainingszeit, ohne Wettkampf weiter). `today` =
 * geplanter Planstart (Europe/Berlin). Zu kurz wird nie gestaucht – es gibt dann keinen Plan.
 */
export function competitionFeasibility(
  rawInputs: PlanInputsInput,
  request: CompetitionRequest,
  today: string,
): CompetitionFeasibilityResult {
  const parsed = parse(rawInputs, request, today);
  if (!parsed) return { ok: false, error: 'invalid_inputs' };
  return { ok: true, feasibility: feasibilityOf(parsed).feasibility };
}

/** Phase einer Plan-Woche (Anzeige, WP4) – wird nicht gespeichert. */
export interface CompetitionWeekInfo {
  readonly week_no: number;
  readonly monday: string;
  readonly phase: CompetitionPhase;
  /** Erholungswoche im Training (nicht Tapering/Erholung nach dem Rennen). */
  readonly is_recovery_week: boolean;
}

/** Vorgabe für einen Block des Wettkampfplans (buildPlanBlock `weeks` bzw. nextPlanBlock `competitionWeeks`). */
export interface CompetitionBlockSetup {
  readonly specs: readonly BlockWeekSpec[];
  readonly weeks: readonly CompetitionWeekInfo[];
  /** Nur erster Block: eigener Startumfang (W-G5); Folgeblöcke starten nie damit neu (Wächter M2). */
  readonly startMinutes: number | undefined;
  /** Nur erster Block: Bezug aus dem Tagebuch (gedeckelt) und ob die Kette wegen strengerer Gruppe neu beginnt. */
  readonly reference: EnduranceReference | null;
  readonly stricterGroup: boolean;
}

function setupOf(block: CompetitionBlock, ctx: Context, first: boolean): CompetitionBlockSetup {
  return {
    specs: block.specs,
    weeks: block.specs.map((spec, k) => ({
      week_no: spec.weekNo,
      monday: spec.monday,
      phase: block.weeks[k]?.phase ?? 'base',
      is_recovery_week: block.weeks[k]?.deload ?? false,
    })),
    startMinutes: first ? ctx.startMinutes : undefined,
    reference: first ? ctx.reference : null,
    stricterGroup: first && ctx.referenceStricter,
  };
}

export type CompetitionPlanSetupResult =
  | {
      readonly ok: true;
      readonly feasibility: CompetitionFeasibility;
      readonly cycle: MacroCycle;
      readonly peakTarget: number;
      readonly firstBlock: CompetitionBlockSetup;
    }
  | { readonly ok: false; readonly error: 'invalid_inputs' }
  | {
      readonly ok: false;
      readonly error: 'competition_not_feasible';
      readonly feasibility: CompetitionFeasibility;
    };

/** Ampel + Makrozyklus + erster Block (für generateCompetitionPlan). „Zu kurz“/„nicht möglich“ → kein Block. */
export function competitionPlanSetup(
  rawInputs: PlanInputsInput,
  request: CompetitionRequest,
  today: string,
): CompetitionPlanSetupResult {
  const parsed = parse(rawInputs, request, today);
  if (!parsed) return { ok: false, error: 'invalid_inputs' };
  const { feasibility, evaluation } = feasibilityOf(parsed);
  if (!usable(feasibility.status) || evaluation.cycle === null) {
    return { ok: false, error: 'competition_not_feasible', feasibility };
  }
  const first = competitionBlocks(
    evaluation.cycle,
    evaluation.peakTarget,
    undefined,
    workoutBase(parsed.ctx, parsed.competition.discipline),
  )[0];
  if (!first) return { ok: false, error: 'competition_not_feasible', feasibility };
  return {
    ok: true,
    feasibility,
    cycle: evaluation.cycle,
    peakTarget: evaluation.peakTarget,
    firstBlock: setupOf(first, parsed.ctx, true),
  };
}

export type CompetitionFollowUpResult =
  | { readonly ok: true; readonly block: CompetitionBlockSetup }
  | {
      readonly ok: false;
      readonly reason: 'invalid_inputs' | 'not_available' | 'cycle_finished';
    };

/**
 * Folgeblock eines Wettkampfplans (Plan 5: „bei jedem Folgeblock neu gerechnet“): Makrozyklus aus denselben Eingaben
 * und dem Planstart `planStart` (user_plans.start_date), Sicherheitsregeln und Startgruppe nach dem Stand von `today`
 * (strengere Regeln wirken sofort). Ohne neue Ampel für den Mindestvorlauf (der Plan läuft schon); gilt eine Regel aus
 * Tabelle 3.3 neu (Schwangerschaft, Widerruf der Einwilligung) → `not_available`, weiter mit dem Grundlagen-Plan.
 * `effectiveGoal` aus der Ampel beim Erstellen. Ergebnis für nextPlanBlock(`competitionWeeks`); eigener Startumfang und
 * Tagebuch-Bezug gelten nur im ersten Block (Wächter M2). Beginn immer am Montag nach der letzten Einheit (M1).
 */
export function competitionFollowUpBlock(
  rawInputs: PlanInputsInput,
  request: CompetitionRequest,
  options: {
    readonly planStart: string;
    readonly today: string;
    /** Bisher geplante Einheiten des Plans (alle Blöcke) – Beginn und Erholungsrhythmus des Folgeblocks. */
    readonly previous: readonly Pick<PreviousSession, 'scheduled_on' | 'week_no' | 'is_deload'>[];
    readonly effectiveGoal: CompetitionGoal;
  },
): CompetitionFollowUpResult {
  const { planStart, today } = options;
  const lastScheduledOn = options.previous
    .map((s) => s.scheduled_on)
    .sort()
    .at(-1);
  if (
    lastScheduledOn === undefined ||
    !isoDateSchema.safeParse(planStart).success ||
    !options.previous.every((s) => isoDateSchema.safeParse(s.scheduled_on).success)
  ) {
    return { ok: false, reason: 'invalid_inputs' };
  }
  // Datumsfenster wie beim Erstellen (bezogen auf den Planstart), Regeln nach dem Stand von heute.
  const now = today >= planStart ? parse(rawInputs, request, today, planStart) : null;
  if (!now) return { ok: false, reason: 'invalid_inputs' };
  const { ctx, competition } = now;
  if (notAvailableReasons(ctx, competition.discipline).length > 0) {
    return { ok: false, reason: 'not_available' };
  }
  const goal: CompetitionGoal =
    options.effectiveGoal === 'time' && timeGoalAllowed(ctx) ? 'time' : 'finish';
  // Neustart am Montag nach der letzten Einheit (Wächter M1): keine Woche ohne Plan, Rhythmus ab dort.
  const cycle = cycleFor(ctx, competition.discipline, competition.raceDate, planStart, {
    fromMonday: addDays(startOfIsoWeek(lastScheduledOn), 7),
    loadWeeksBefore: trailingLoadWeeks(options.previous),
  });
  if (!cycle) return { ok: false, reason: 'cycle_finished' };
  const peakTarget = peakTargetFor(ctx, competition.discipline, goal);
  const block = nextCompetitionBlock(
    cycle,
    peakTarget,
    lastScheduledOn,
    workoutBase(ctx, competition.discipline),
  );
  if (!block) return { ok: false, reason: 'cycle_finished' };
  return { ok: true, block: setupOf(block, ctx, false) };
}

/**
 * Wochenumfänge des ganzen Makrozyklus nach derselben Kette wie der Plan (für Tests und die spätere Anzeige
 * „So steigt dein Umfang“, WP4). null = ungültig bzw. kein Zyklus.
 */
export function competitionVolumePreview(
  rawInputs: PlanInputsInput,
  request: CompetitionRequest,
  today: string,
): readonly SimulatedWeek[] | null {
  const parsed = parse(rawInputs, request, today);
  if (!parsed) return null;
  const { evaluation } = feasibilityOf(parsed, false);
  if (!evaluation.cycle) return null;
  return simulate(parsed.ctx, evaluation.cycle, evaluation.peakTarget);
}

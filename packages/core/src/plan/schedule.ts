import {
  DEFAULT_TRAINING_DAYS,
  ENDURANCE_SESSION_LIMITS,
  INTRO_WEEK_RPE_REDUCTION,
  MAX_STRENGTH_SESSIONS_PER_WEEK,
  PARTIAL_START_WEEK_MIN_SHARE,
  WEEKLY_SESSION_LIMITS,
} from '../constants';
import type { Exercise } from '../content/schemas';
import { addDays, isoWeekday, startOfIsoWeek } from '../dates';
import type {
  EnduranceModality,
  EquipmentLocation,
  PlannedSessionKind,
  PlannedSessionStatus,
  PlanNote,
  SessionFocus,
  TrainingSlotKind,
} from '../enums';
import type { TrainingSchedule } from '../training-schedule';
import {
  adaptedSessionMinutes,
  type AdaptedSession,
  clampRpe,
  fitSessionToMinutes,
  type PlannedExerciseDraft,
  reAdaptExercises,
} from './adapt';
import { applyCurrentSafetyRules } from './apply-safety';
import { deloadDosage } from './deload';
import {
  ENDURANCE_TEXTS_DE,
  ENDURANCE_VARIANT_MODALITY,
  type EnduranceContext,
  enduranceEffort,
  type EnduranceReference,
  enduranceVariant,
  type EnduranceWeekKind,
  enduranceWeekVolumes,
  maxEnduranceSessions,
} from './endurance';
import type { EquipmentProfile } from './equipment-profile';
import { type EnduranceStartGroup, isStricterGroup, type PlanSafetyRules } from './safety';

/**
 * Wochenplanung (docs/PLAN-PHASE-3.md 5.7/5.10, Etappe B3: docs/PLAN-PHASE-3-ERWEITERUNG.md 5.2–5.5):
 * Trainingswoche auflösen (je Tag höchstens eine Einheit, Deckel), Kraft-Einheiten je Tag kürzen und in der
 * Fassung des Orts platzieren, Ausdauer-Tage mit 10-%-Regel, Plan-Block mit Woche 0/Einstiegswoche und fester
 * Erholungswoche, Folgeblock.
 */

/** Eine geplante Einheit (Spalten von planned_sessions + Übungen). */
export interface GeneratedSession {
  readonly block_no: number;
  /** 0 = Woche 0 (angebrochene Startwoche), 1 … Belastungswochen, letzte = Erholungswoche. */
  readonly week_no: number;
  readonly is_intro_week: boolean;
  readonly is_deload: boolean;
  readonly kind: PlannedSessionKind;
  /** Kraft: Vorlagen-Einheit; Ausdauer: null. */
  readonly template_day_index: number | null;
  readonly scheduled_on: string;
  readonly name_de: string;
  /** Kraft: Schwerpunkt; Ausdauer: null. */
  readonly focus: SessionFocus | null;
  /** Ausdauer: Modalität und Anstrengung (0–10); Kraft: null. */
  readonly endurance_modality: EnduranceModality | null;
  readonly effort_target: number | null;
  readonly estimated_minutes: number;
  readonly warmup_de: string;
  readonly cooldown_de: string;
  /** Kraft: 1–8 Übungen; Ausdauer: keine. */
  readonly exercises: readonly PlannedExerciseDraft[];
}

/** Ein Tag der aufgelösten Trainingswoche. */
export interface PlannedDay {
  readonly weekday: number;
  readonly kind: TrainingSlotKind;
  readonly minutes: number;
}

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export const isStrengthKind = (kind: TrainingSlotKind) => kind !== 'endurance';

/** Ort der Kraft-Fassung eines Tages. */
export function locationOfKind(kind: TrainingSlotKind): EquipmentLocation {
  return kind === 'strength_home' ? 'home' : 'gym';
}

/** Kleinster Abstand zwischen zwei Trainingstagen, Woche als Kreis (So → Mo = 1 Tag). */
export function cyclicMinGap(days: readonly number[]): number {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length <= 1) return 7;
  let min = 7;
  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i] as number;
    const next = i + 1 < sorted.length ? (sorted[i + 1] as number) : (sorted[0] as number) + 7;
    min = Math.min(min, next - current);
  }
  return min;
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  const result: T[][] = [];
  items.forEach((item, i) => {
    for (const rest of combinations(items.slice(i + 1), size - 1)) {
      result.push([item, ...rest]);
    }
  });
  return result;
}

/** Anzahl der Paare an aufeinanderfolgenden Tagen (Woche als Kreis). */
export function adjacentPairs(days: readonly number[]): number {
  const set = new Set(days);
  if (set.size <= 1) return 0;
  return [...set].filter((d) => set.has(d === 7 ? 1 : d + 1)).length;
}

/**
 * Auswahl mit dem größten Mindestabstand; Gleichstand: weniger Tage direkt hintereinander, dann lexikografisch
 * kleinste.
 */
function bestSpread(candidates: number[][]): number[] {
  let best: number[] = candidates[0] ?? [];
  let bestGap = -1;
  let bestPairs = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const gap = cyclicMinGap(candidate);
    const pairs = adjacentPairs(candidate);
    if (gap > bestGap || (gap === bestGap && pairs < bestPairs)) {
      best = candidate;
      bestGap = gap;
      bestPairs = pairs;
    }
  }
  return best;
}

/** Aus `days` die `count` Tage mit dem größten Abstand (Regel von chooseTrainingDays). */
export function spreadSubset(days: readonly number[], count: number): number[] {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (count >= sorted.length) return sorted;
  if (count <= 0) return [];
  return bestSpread(combinations(sorted, count));
}

export interface ChosenDays {
  /** Sortierte ISO-Wochentage. */
  readonly days: readonly number[];
  /** Wunsch-Tage wurden ergänzt (Hinweis `days_added`). */
  readonly added: boolean;
}

/**
 * Welche Wochentage (Abschnitt 5.7): gleich viele Wunsch-Tage → genau diese; mehr → größte Abstände; weniger →
 * Wunsch-Tage behalten und mit größtmöglichem Abstand ergänzen; keine → Standardmuster.
 */
export function chooseTrainingDays(count: number, preferred: readonly number[]): ChosenDays {
  const n = Math.max(1, Math.min(7, count));
  const wish = [...new Set(preferred)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (wish.length === n) {
    return { days: wish, added: false };
  }
  if (wish.length > n) {
    return { days: bestSpread(combinations(wish, n)), added: false };
  }
  if (wish.length === 0) {
    const standard = DEFAULT_TRAINING_DAYS[n];
    return {
      days: standard ? [...standard] : bestSpread(combinations([...ALL_DAYS], n)),
      added: false,
    };
  }
  const free = ALL_DAYS.filter((d) => !wish.includes(d));
  const extended = combinations(free, n - wish.length).map((extra) =>
    [...wish, ...extra].sort((a, b) => a - b),
  );
  return { days: bestSpread(extended), added: true };
}

// ---------------------------------------------------------------------------------------------------------
// Trainingswoche auflösen (Erweiterungsplan 5.2)
// ---------------------------------------------------------------------------------------------------------

export interface ResolvedWeek {
  /** Je Wochentag höchstens eine Einheit, sortiert Mo → So. */
  readonly days: readonly PlannedDay[];
  readonly notes: ReadonlySet<PlanNote>;
}

/** Gilt der Gesamt-Deckel (WEEKLY_SESSION_LIMITS)? Einsteiger und vorsichtig (Flag, ohne Check, < 18, ≥ 65). */
export function weeklySessionLimit(group: EnduranceStartGroup): number | null {
  return group === 'cautious' || group === 'beginner'
    ? WEEKLY_SESSION_LIMITS.cautiousMaxSessions
    : null;
}

/** Kürzeste zuerst entfernen, bei Gleichstand der spätere Tag (deterministisch). */
function dropShortest(days: PlannedDay[], count: number): PlannedDay[] {
  const removed = [...days]
    .sort((a, b) => a.minutes - b.minutes || b.weekday - a.weekday)
    .slice(0, count);
  return days.filter((d) => !removed.includes(d));
}

/** Tag mit größtmöglichem Abstand zu den anderen Ausdauer-Tagen; Gleichstand: nicht nach einem Krafttag. */
function chooseEnduranceDays(free: readonly number[], strength: readonly number[], n: number) {
  if (n <= 0) return [];
  const strengthSet = new Set(strength);
  let best: number[] = [];
  let bestKey: [number, number] | null = null;
  for (const candidate of combinations(
    [...free].sort((a, b) => a - b),
    n,
  )) {
    const gap = cyclicMinGap(candidate);
    const afterStrength = candidate.filter((d) => strengthSet.has(d === 1 ? 7 : d - 1)).length;
    if (
      bestKey === null ||
      gap > bestKey[0] ||
      (gap === bestKey[0] && afterStrength < bestKey[1])
    ) {
      best = candidate;
      bestKey = [gap, afterStrength];
    }
  }
  return best;
}

/**
 * Deckel einer Woche mit festen Tagen (Erweiterungsplan 5.2 Punkte 1–3) – gilt für den ersten Block UND jeden
 * Folgeblock (Tagesmuster aus dem bisherigen Plan, Gruppe nach den AKTUELLEN Regeln): höchstens 4 Kraft-Tage
 * (größter Abstand bleibt), Ausdauer-Deckel je Gruppe (kürzeste zuerst weg), Gesamt-Deckel 5 bei Einsteigern/
 * vorsichtig (zuerst kürzeste Ausdauer, dann Kraft nach Abstandsregel).
 */
export function capTrainingDays(
  days: readonly PlannedDay[],
  group: EnduranceStartGroup,
): ResolvedWeek {
  const notes = new Set<PlanNote>();
  const enduranceMax = maxEnduranceSessions(group);
  const totalMax = weeklySessionLimit(group);
  let strength: PlannedDay[] = days.filter((s) => isStrengthKind(s.kind));
  let endurance: PlannedDay[] = days.filter((s) => s.kind === 'endurance');
  if (strength.length > MAX_STRENGTH_SESSIONS_PER_WEEK) {
    const keep = spreadSubset(
      strength.map((s) => s.weekday),
      MAX_STRENGTH_SESSIONS_PER_WEEK,
    );
    strength = strength.filter((s) => keep.includes(s.weekday));
    notes.add('days_capped');
  }
  if (endurance.length > enduranceMax) {
    endurance = dropShortest(endurance, endurance.length - enduranceMax);
    notes.add('endurance_days_capped');
  }
  if (totalMax !== null && strength.length + endurance.length > totalMax) {
    notes.add('week_total_capped');
    const excess = strength.length + endurance.length - totalMax;
    const fromEndurance = Math.min(excess, endurance.length);
    endurance = dropShortest(endurance, fromEndurance);
    const fromStrength = excess - fromEndurance;
    if (fromStrength > 0) {
      const keep = spreadSubset(
        strength.map((s) => s.weekday),
        strength.length - fromStrength,
      );
      strength = strength.filter((s) => keep.includes(s.weekday));
    }
  }
  return {
    days: [...strength, ...endurance].sort((a, b) => a.weekday - b.weekday),
    notes,
  };
}

/**
 * Aus dem Wunsch-Zeitplan wird die geplante Woche (je Tag höchstens EINE Einheit – Frage 2):
 * 1. höchstens 4 Kraft-Tage (größter Abstand bleibt, `days_capped`),
 * 2. Ausdauer-Deckel je Gruppe (kürzeste zuerst weg, `endurance_days_capped`),
 * 3. Gesamt-Deckel 5 bei Einsteigern/vorsichtig (zuerst kürzeste Ausdauer, dann Kraft nach Abstandsregel,
 *    `week_total_capped`),
 * 4. „Tage egal“: Kraft-Tage nach Standardmuster, Ausdauer auf freie Tage mit größtem Abstand, bei Gleichstand
 *    nicht direkt nach einem Krafttag, dann lexikografisch kleinste Auswahl.
 */
export function resolveTrainingWeek(
  schedule: TrainingSchedule,
  group: EnduranceStartGroup,
): ResolvedWeek {
  const notes = new Set<PlanNote>();
  const enduranceMax = maxEnduranceSessions(group);
  const totalMax = weeklySessionLimit(group);

  if (schedule.mode === 'fixed') {
    return capTrainingDays(schedule.slots, group);
  }

  // „Tage egal“: Einträge sind nach Art und Dauer sortiert (längste zuerst je Art).
  let strength = schedule.slots.filter((s) => isStrengthKind(s.kind));
  let endurance = schedule.slots.filter((s) => s.kind === 'endurance');
  if (strength.length > MAX_STRENGTH_SESSIONS_PER_WEEK) {
    strength = [...strength]
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, MAX_STRENGTH_SESSIONS_PER_WEEK)
      .sort((a, b) => schedule.slots.indexOf(a) - schedule.slots.indexOf(b));
    notes.add('days_capped');
  }
  if (endurance.length > enduranceMax) {
    endurance = endurance.slice(0, enduranceMax);
    notes.add('endurance_days_capped');
  }
  if (totalMax !== null && strength.length + endurance.length > totalMax) {
    notes.add('week_total_capped');
    const excess = strength.length + endurance.length - totalMax;
    const fromEndurance = Math.min(excess, endurance.length);
    endurance = endurance.slice(0, endurance.length - fromEndurance);
    strength = strength.slice(0, strength.length - (excess - fromEndurance));
  }
  const strengthDays = strength.length > 0 ? [...chooseTrainingDays(strength.length, []).days] : [];
  const free = ALL_DAYS.filter((d) => !strengthDays.includes(d));
  const enduranceDays = chooseEnduranceDays(free, strengthDays, endurance.length);
  const days: PlannedDay[] = [
    ...strength.map((slot, i) => ({
      weekday: strengthDays[i] as number,
      kind: slot.kind,
      minutes: slot.minutes,
    })),
    ...endurance.map((slot, i) => ({
      weekday: enduranceDays[i] as number,
      kind: slot.kind,
      minutes: slot.minutes,
    })),
  ];
  return { days: days.sort((a, b) => a.weekday - b.weekday), notes };
}

// ---------------------------------------------------------------------------------------------------------
// Plan-Block
// ---------------------------------------------------------------------------------------------------------

type WeekKind = 'intro' | 'load' | 'deload';

/** Dosierung je Wochenart; RPE immer innerhalb des Deckels der Sicherheitsregeln. */
export function dosageForWeek(
  item: PlannedExerciseDraft,
  kind: WeekKind,
  rules: Pick<PlanSafetyRules, 'rpeMax'>,
): PlannedExerciseDraft {
  if (kind === 'deload') {
    const deloaded = deloadDosage(item);
    return { ...deloaded, rpe_target: clampRpe(deloaded.rpe_target, rules.rpeMax) };
  }
  const reduction = kind === 'intro' ? INTRO_WEEK_RPE_REDUCTION : 0;
  return { ...item, rpe_target: clampRpe(item.rpe_target - reduction, rules.rpeMax) };
}

/** Kraft-Fassungen je Ort (gleiche Vorlage), Rotation in der Reihenfolge der Haupt-Fassung. */
export interface StrengthVersions {
  /** Ort der Vorlage (Mehrheit der Kraft-Tage, Gleichstand Studio). */
  readonly primary: EquipmentLocation;
  readonly versions: ReadonlyMap<EquipmentLocation, readonly AdaptedSession[]>;
  readonly library: ReadonlyMap<string, Exercise>;
  /** Körpergewicht-Vorlage: beim Kürzen bleibt die letzte Rumpf-Übung (fitSessionToMinutes, Engine-Version 3). */
  readonly protectLastCore?: boolean;
}

export interface BlockContext {
  /** null = keine Kraft-Tage (reiner Ausdauer-Plan). */
  readonly strength: StrengthVersions | null;
  readonly endurance: EnduranceContext;
  readonly rules: Pick<PlanSafetyRules, 'rpeMax' | 'enduranceEffortMax' | 'enduranceStartGroup'>;
  /** Summe der Wunsch-Minuten der Ausdauer-Tage einer vollen Woche. */
  readonly enduranceWishWeekly: number;
  /** Folgeblock: Bezug aus der letzten Belastungswoche des bisherigen Plans. */
  readonly enduranceReference?: EnduranceReference | null;
  /** Folgeblock mit strengerer Startgruppe als der bisherige Plan. */
  readonly enduranceStricterGroup?: boolean;
  /** Belastungswochen vor diesem Block (für den Geh-Lauf-Wechsel der Einsteiger). */
  readonly loadWeeksBefore?: number;
}

interface WeekPlan {
  readonly weekNo: number;
  readonly monday: string;
  readonly days: readonly PlannedDay[];
  readonly kind: WeekKind;
}

export interface PlacedBlock {
  readonly sessions: GeneratedSession[];
  readonly notes: ReadonlySet<PlanNote>;
}

function strengthBaseFor(
  versions: StrengthVersions,
  location: EquipmentLocation,
  primaryBase: AdaptedSession,
  rotationIndex: number,
): AdaptedSession | null {
  const own = versions.versions.get(location) ?? [];
  if (own.length === 0) return null;
  return (
    own.find((s) => s.template_day_index === primaryBase.template_day_index) ??
    own[rotationIndex % own.length] ??
    null
  );
}

function placeWeeks(
  weeks: readonly WeekPlan[],
  ctx: BlockContext,
  blockNo: number,
  rotationStart: number,
): PlacedBlock {
  const notes = new Set<PlanNote>();
  const sessions: GeneratedSession[] = [];
  const rules = ctx.rules;

  // Ausdauer: Wochenumfänge für den ganzen Block vorab (10-%-Regel über die Wochen).
  const enduranceWeeks = weeks.map((week) => ({
    kind: (week.weekNo === 0 ? 'week0' : week.kind) as EnduranceWeekKind,
    wishes: week.days.filter((d) => d.kind === 'endurance').map((d) => d.minutes),
  }));
  const volumes = enduranceWeeks.some((w) => w.wishes.length > 0)
    ? enduranceWeekVolumes(enduranceWeeks, {
        group: rules.enduranceStartGroup,
        wishWeekly: ctx.enduranceWishWeekly,
        reference: ctx.enduranceReference ?? null,
        stricterGroup: ctx.enduranceStricterGroup ?? false,
      })
    : null;
  if (volumes?.ramped) notes.add('endurance_volume_ramped');
  if (volumes?.droppedDay) notes.add('rest_day_added');

  const primary = ctx.strength?.versions.get(ctx.strength.primary) ?? [];
  const fitted = new Map<string, ReturnType<typeof fitSessionToMinutes>>();
  let rotation = rotationStart;
  let loadWeek = ctx.loadWeeksBefore ?? 0;
  let enduranceIndex = 0;

  weeks.forEach((week, w) => {
    if (week.weekNo >= 1 && week.kind !== 'deload') loadWeek += 1;
    const easyWeek = week.weekNo === 0 || week.kind !== 'load';
    let enduranceSlot = 0;
    for (const day of week.days) {
      const date = addDays(week.monday, day.weekday - 1);
      const common = {
        block_no: blockNo,
        week_no: week.weekNo,
        is_intro_week: week.kind === 'intro',
        is_deload: week.kind === 'deload',
        scheduled_on: date,
      };
      if (day.kind === 'endurance') {
        const minutes = volumes?.weeks[w]?.minutes[enduranceSlot] ?? 0;
        enduranceSlot += 1;
        if (minutes <= 0) continue;
        const variant = enduranceVariant(ctx.endurance, loadWeek, enduranceIndex);
        enduranceIndex += 1;
        if (variant === 'brisk_walk') notes.add('endurance_walk');
        sessions.push({
          ...common,
          kind: 'endurance',
          template_day_index: null,
          name_de: ENDURANCE_TEXTS_DE.names[variant],
          focus: null,
          endurance_modality: ENDURANCE_VARIANT_MODALITY[variant],
          effort_target: enduranceEffort(rules, easyWeek),
          estimated_minutes: minutes,
          warmup_de: ENDURANCE_TEXTS_DE.warmup[variant],
          cooldown_de: ENDURANCE_TEXTS_DE.cooldown[variant],
          exercises: [],
        });
        continue;
      }
      if (!ctx.strength || primary.length === 0) continue;
      const primaryBase = primary[rotation % primary.length] as AdaptedSession;
      const location = locationOfKind(day.kind);
      const base = strengthBaseFor(ctx.strength, location, primaryBase, rotation);
      rotation += 1;
      if (!base) continue;
      const key = `${location}|${base.template_day_index}|${day.minutes}`;
      let fit = fitted.get(key);
      if (!fit) {
        fit = fitSessionToMinutes(base.exercises, day.minutes, ctx.strength.library, {
          protectLastCore: ctx.strength.protectLastCore ?? false,
        });
        fitted.set(key, fit);
      }
      if (fit.shortened) notes.add('minutes_shortened');
      if (fit.belowMinimum) notes.add('minutes_below_minimum');
      if (fit.exercises.length === 0) continue;
      const exercises = fit.exercises.map((e) => dosageForWeek(e, week.kind, rules));
      sessions.push({
        ...common,
        kind: 'strength',
        template_day_index: base.template_day_index,
        name_de: base.name_de,
        focus: base.focus,
        endurance_modality: null,
        effort_target: null,
        estimated_minutes: adaptedSessionMinutes({ exercises }),
        warmup_de: base.warmup_de,
        cooldown_de: base.cooldown_de,
        exercises,
      });
    }
  });
  return { sessions, notes };
}

export interface BuildPlanBlockOptions {
  /** Aufgelöste Trainingswoche (resolveTrainingWeek). */
  readonly days: readonly PlannedDay[];
  /** Erzeugungsdatum. Einheiten vor diesem Tag entfallen. */
  readonly today: string;
  readonly loadWeeks: number;
  readonly context: BlockContext;
}

/**
 * Erster Plan-Block (Abschnitt 5.7): Passt mindestens die Hälfte der Wochen-Einheiten in den Rest der aktuellen
 * Woche, ist sie Woche 1 (Einstiegswoche). Sonst laufen diese Einheiten als Woche 0 (= Einstiegswoche, zählt nicht
 * zum Block und nie als Bezug der 10-%-Regel) und Woche 1 beginnt am nächsten Montag (normale Belastungswoche).
 * Ist nichts mehr frei, beginnt Woche 1 am nächsten Montag als Einstiegswoche. Danach Belastungswochen bis
 * `loadWeeks`, dann die Erholungswoche.
 */
export function buildPlanBlock(options: BuildPlanBlockOptions): PlacedBlock {
  const { days, today, loadWeeks, context } = options;
  if (days.length === 0) return { sessions: [], notes: new Set() };
  const monday = startOfIsoWeek(today);
  const weekday = isoWeekday(today);
  const remaining = days.filter((d) => d.weekday >= weekday);
  const weeks: WeekPlan[] = [];
  let week1Monday: string;
  let week1Days: readonly PlannedDay[] = days;
  let introInWeekZero = false;
  if (remaining.length === 0) {
    week1Monday = addDays(monday, 7);
  } else if (remaining.length >= days.length * PARTIAL_START_WEEK_MIN_SHARE) {
    week1Monday = monday;
    week1Days = remaining;
  } else {
    weeks.push({ weekNo: 0, monday, days: remaining, kind: 'intro' });
    week1Monday = addDays(monday, 7);
    introInWeekZero = true;
  }
  for (let w = 1; w <= loadWeeks + 1; w += 1) {
    const kind: WeekKind =
      w === loadWeeks + 1 ? 'deload' : w === 1 && !introInWeekZero ? 'intro' : 'load';
    weeks.push({
      weekNo: w,
      monday: addDays(week1Monday, (w - 1) * 7),
      days: w === 1 ? week1Days : days,
      kind,
    });
  }
  return placeWeeks(weeks, context, 1, 0);
}

// ---------------------------------------------------------------------------------------------------------
// Folgeblock (Abschnitt 5.10; Erweiterungsplan 5.3/5.5 Punkt 5)
// ---------------------------------------------------------------------------------------------------------

/** Eine bisher geplante Einheit (aus planned_sessions; Status/Ursprungstag optional). */
export type PreviousSession = GeneratedSession & {
  /** ID der gespeicherten Einheit (für die eingetragenen Minuten, Phase 4). */
  readonly id?: string;
  readonly status?: PlannedSessionStatus;
  readonly original_date?: string | null;
};

/** Sessions der letzten Belastungswoche (nicht Woche 0, nicht Erholungswoche) – inkl. gestrichener. */
export function lastLoadWeekSessions(previous: readonly PreviousSession[]): PreviousSession[] {
  const load = previous.filter((s) => s.week_no >= 1 && !s.is_deload);
  if (load.length === 0) return [];
  const key = (s: PreviousSession) => s.block_no * 100 + s.week_no;
  const last = Math.max(...load.map(key));
  return load.filter((s) => key(s) === last);
}

/**
 * Bezug der 10-%-Regel für den Folgeblock: Summe der Ausdauer-Minuten der letzten Belastungswoche OHNE gestrichene
 * Einheiten (wer weniger geschafft hat, steigert nicht von einem Umfang, den es nie gab); Deckel je Einheit =
 * längste nicht gestrichene Ausdauer-Einheit dieser Woche.
 * Phase 4 (PLAN-PHASE-4 Abschnitt 5.3): Mit `loggedMinutes` (Minuten aus dem Tagebuch je ID der geplanten Einheit)
 * zählt je Einheit nur `min(geplant, eingetragen)`; ohne Eintrag zählt sie nicht. Verwaiste Einträge (ohne
 * geplante Einheit) stehen nicht in der Liste und zählen damit nie. Schutzregel, keine Live-Anpassung.
 */
export function enduranceReferenceFromBlock(
  previous: readonly PreviousSession[],
  loggedMinutes?: ReadonlyMap<string, number>,
): EnduranceReference {
  const minutes = lastLoadWeekSessions(previous)
    .filter((s) => s.kind === 'endurance' && s.status !== 'skipped')
    .map((s) => {
      if (!loggedMinutes) return s.estimated_minutes;
      const logged = s.id === undefined ? undefined : loggedMinutes.get(s.id);
      return logged === undefined
        ? 0
        : Math.max(0, Math.min(s.estimated_minutes, Math.floor(logged)));
    })
    .filter((m) => m > 0);
  const volume = minutes.reduce((sum, m) => sum + m, 0);
  const cap = minutes.length > 0 ? Math.max(...minutes) : null;
  // Unter dem Einheiten-Minimum (10 min) wie „ohne Bezug“: sonst würden alle Einheiten des Folgeblocks unter die
  // Mindestdauer fallen und gestrichen – für immer.
  const min = ENDURANCE_SESSION_LIMITS.minSessionMinutes;
  return {
    volume: volume < min ? 0 : volume,
    sessionCap: cap === null || cap < min ? null : cap,
  };
}

/**
 * Kraft-Einheiten, auf denen ein Folgeblock aufbaut: je Vorlagen-Einheit die längste Fassung (meiste Sätze) aus
 * einer Belastungswoche (sonst aus der Einstiegswoche – deren RPE ist niedriger und damit sicher), sortiert nach
 * Vorlagen-Index. Ausdauer-Einheiten zählen nicht.
 */
export function baseSessionsFromBlock(previous: readonly GeneratedSession[]): AdaptedSession[] {
  const pick = new Map<number, GeneratedSession>();
  const sets = (s: GeneratedSession) => s.exercises.reduce((sum, e) => sum + e.sets, 0);
  const ordered = [...previous]
    .filter((s) => s.kind === 'strength' && s.template_day_index !== null && !s.is_deload)
    .sort((a, b) => (a.scheduled_on < b.scheduled_on ? -1 : 1));
  for (const kind of ['intro', 'load'] as const) {
    for (const s of ordered) {
      if ((kind === 'intro') !== s.is_intro_week) continue;
      const index = s.template_day_index as number;
      const current = pick.get(index);
      if (!current || (kind === 'load' && current.is_intro_week) || sets(s) >= sets(current)) {
        pick.set(index, s);
      }
    }
  }
  return [...pick.values()]
    .sort((a, b) => (a.template_day_index as number) - (b.template_day_index as number))
    .map((s) => ({
      template_day_index: s.template_day_index as number,
      name_de: s.name_de,
      focus: s.focus as SessionFocus,
      warmup_de: s.warmup_de,
      cooldown_de: s.cooldown_de,
      exercises: s.exercises,
    }));
}

export interface NextPlanBlockOptions {
  /** Wunsch-Zeitplan aus inputs.schedule (Minuten je Art, Ort-Fassung je Art). */
  readonly schedule: TrainingSchedule;
  readonly loadWeeks: number;
  /** AKTUELLE Sicherheitsregeln (Flags und Alter zum Start des neuen Blocks). */
  readonly rules: Pick<
    PlanSafetyRules,
    | 'rpeMax'
    | 'excludedCautionTags'
    | 'cautious'
    | 'enduranceEffortMax'
    | 'enduranceWalkOnly'
    | 'enduranceStartGroup'
    | 'pregnancyNotice'
    | 'noHealthCheck'
  >;
  readonly library: ReadonlyMap<string, Exercise>;
  /** Geräte-Profile je Ort (für den Tausch in der Fassung des Tages). */
  readonly profiles: ReadonlyMap<EquipmentLocation, Pick<EquipmentProfile, 'available'>>;
  readonly endurance: Pick<EnduranceContext, 'goalType' | 'discipline' | 'experienceLevel'>;
  /** Belastungswochen aller bisherigen Blöcke (Geh-Lauf-Wechsel der Einsteiger). */
  readonly loadWeeksBefore?: number;
  /**
   * Startgruppe Ausdauer, mit der der bisherige Plan erstellt wurde (GeneratedPlan.safety_rules). Ist die aktuelle
   * strenger (z. B. 65. Geburtstag, neues Flag, Schwangerschaft), wird der Ausdauer-Bezug auf den Startumfang der
   * neuen Gruppe begrenzt und der Deckel je Einheit beginnt wieder beim Start-Deckel.
   * Bei einem GESPEICHERTEN Plan (nach dem Neuladen gibt es keine safety_rules) immer
   * `planStartGroup(plan, birthDate)` aus start-group.ts verwenden – nie selbst herleiten.
   */
  readonly previousStartGroup: EnduranceStartGroup;
  /**
   * Phase 4: eingetragene Ausdauer-Minuten je ID der geplanten Einheit (Tagebuch). Gesetzt → der 10-%-Bezug zählt
   * nur tatsächlich Trainiertes (enduranceReferenceFromBlock); weggelassen → geplante Minuten (Phase-3-Verhalten).
   */
  readonly loggedEnduranceMinutes?: ReadonlyMap<string, number>;
  /**
   * Plan aus einer Körpergewicht-Vorlage (isBodyweightTemplate der Vorlage des Plans): beim Kürzen bleibt die letzte
   * Rumpf-Übung. Weggelassen → Kürzen wie Engine-Version 2.
   */
  readonly protectLastCore?: boolean;
}

/**
 * Folgeblock: Wochentag und Art je Tag aus den Einheiten der LETZTEN BELASTUNGSWOCHE des Plans (auch bei „Tage
 * egal“; verschobene Einheiten zählen mit ihrem ursprünglichen Tag), Wunsch-Minuten und Ort-Fassung aus
 * `schedule`, Ausdauer-Bezug ohne gestrichene Einheiten. Beginnt am Montag nach der letzten Einheit, `block_no + 1`,
 * ohne Woche 0 und ohne Einstiegswoche; die Kraft-Rotation läuft ab der Einheit nach der letzten geplanten weiter.
 */
export function nextPlanBlock(
  previous: readonly PreviousSession[],
  options: NextPlanBlockOptions,
): GeneratedSession[] {
  if (previous.length === 0) return [];
  const blockNo = Math.max(...previous.map((s) => s.block_no)) + 1;
  const lastDate = previous
    .map((s) => s.scheduled_on)
    .sort()
    .at(-1) as string;
  const monday = addDays(startOfIsoWeek(lastDate), 7);
  const group = options.rules.enduranceStartGroup;
  const resolved = resolveTrainingWeek(options.schedule, group).days;
  const strengthSlots = options.schedule.slots.filter((s) => isStrengthKind(s.kind));
  const enduranceSlots = options.schedule.slots.filter((s) => s.kind === 'endurance');
  const countKind = (kind: TrainingSlotKind) => strengthSlots.filter((s) => s.kind === kind).length;
  const majorityKind: TrainingSlotKind =
    countKind('strength_home') > countKind('strength_gym') ? 'strength_home' : 'strength_gym';
  const maxMinutes = (slots: readonly { minutes: number }[], fallback: number) =>
    slots.length > 0 ? Math.max(...slots.map((s) => s.minutes)) : fallback;

  // Tage und Arten der letzten Belastungswoche.
  const pattern = new Map<number, PlannedDay>();
  for (const s of lastLoadWeekSessions(previous).sort((a, b) =>
    a.scheduled_on < b.scheduled_on ? -1 : 1,
  )) {
    const weekday = isoWeekday(s.original_date ?? s.scheduled_on);
    if (pattern.has(weekday)) continue;
    const same = resolved.find(
      (d) => d.weekday === weekday && isStrengthKind(d.kind) === (s.kind === 'strength'),
    );
    if (s.kind === 'endurance') {
      pattern.set(weekday, {
        weekday,
        kind: 'endurance',
        minutes: same?.minutes ?? maxMinutes(enduranceSlots, 30),
      });
    } else {
      pattern.set(weekday, {
        weekday,
        kind: same?.kind ?? majorityKind,
        minutes: same?.minutes ?? maxMinutes(strengthSlots, 60),
      });
    }
  }
  // Dieselben Deckel wie im ersten Block – mit der Gruppe nach den AKTUELLEN Regeln (z. B. ab 65, neues Flag).
  const days = [
    ...capTrainingDays(pattern.size > 0 ? [...pattern.values()] : [...resolved], group).days,
  ];

  // Ort einer bisherigen Kraft-Einheit: Art des Tages im Muster (ursprünglicher Wochentag).
  const locationOfSession = (s: PreviousSession): EquipmentLocation => {
    const weekday = isoWeekday(s.original_date ?? s.scheduled_on);
    const day =
      pattern.get(weekday) ?? resolved.find((d) => d.weekday === weekday && isStrengthKind(d.kind));
    return locationOfKind(day && isStrengthKind(day.kind) ? day.kind : majorityKind);
  };

  // Kraft: Basis je Ort aus der Fassung DESSELBEN Orts, sonst aus der Hauptfassung (alle Orte); dann mit den
  // aktuellen Regeln und den Geräten des Orts.
  const allBases = baseSessionsFromBlock(previous);
  const versions = new Map<EquipmentLocation, AdaptedSession[]>();
  for (const location of new Set(
    days.filter((d) => isStrengthKind(d.kind)).map((d) => locationOfKind(d.kind)),
  )) {
    const own = baseSessionsFromBlock(
      previous.filter((s) => s.kind === 'strength' && locationOfSession(s) === location),
    );
    const base = allBases.map(
      (b) => own.find((o) => o.template_day_index === b.template_day_index) ?? b,
    );
    const profile = options.profiles.get(location);
    const adapted = base
      .map((s) => {
        const safe = applyCurrentSafetyRules(s, options.rules, {
          library: options.library,
          ...(profile ? { profile } : {}),
        }).session;
        return profile
          ? {
              ...safe,
              exercises: reAdaptExercises(safe.exercises, {
                library: options.library,
                profile,
                rules: options.rules,
              }),
            }
          : safe;
      })
      .filter((s) => s.exercises.length > 0);
    versions.set(location, adapted);
  }
  const strengthLocations = days
    .filter((d) => isStrengthKind(d.kind))
    .map((d) => locationOfKind(d.kind));
  const homeCount = strengthLocations.filter((l) => l === 'home').length;
  const primary: EquipmentLocation =
    homeCount > strengthLocations.length - homeCount ? 'home' : 'gym';
  const primarySessions = versions.get(primary) ?? [];

  const weeks: WeekPlan[] = [];
  for (let w = 1; w <= options.loadWeeks + 1; w += 1) {
    weeks.push({
      weekNo: w,
      monday: addDays(monday, (w - 1) * 7),
      days,
      kind: w === options.loadWeeks + 1 ? 'deload' : 'load',
    });
  }
  // Rotation ab der Vorlagen-Einheit NACH der letzten geplanten Kraft-Einheit weiterzählen.
  const lastStrength = [...previous]
    .filter((s) => s.kind === 'strength')
    .sort((a, b) => (a.scheduled_on < b.scheduled_on ? -1 : 1))
    .at(-1);
  const lastIndex = primarySessions.findIndex(
    (s) => s.template_day_index === lastStrength?.template_day_index,
  );
  const enduranceWish = days
    .filter((d) => d.kind === 'endurance')
    .reduce((sum, d) => sum + d.minutes, 0);
  return placeWeeks(
    weeks,
    {
      strength:
        strengthLocations.length > 0 && primarySessions.length > 0
          ? {
              primary,
              versions,
              library: options.library,
              protectLastCore: options.protectLastCore ?? false,
            }
          : null,
      endurance: { ...options.endurance, rules: options.rules },
      rules: options.rules,
      enduranceWishWeekly: enduranceWish,
      enduranceReference: enduranceReferenceFromBlock(previous, options.loggedEnduranceMinutes),
      enduranceStricterGroup: isStricterGroup(group, options.previousStartGroup),
      loadWeeksBefore: options.loadWeeksBefore ?? 0,
    },
    blockNo,
    lastIndex + 1,
  ).sessions;
}

/**
 * Zwei KRAFT-Einheiten an aufeinanderfolgenden Tagen mit Ganzkörper bzw. gleichem Schwerpunkt (Hinweis
 * `back_to_back_sessions`, mind. 48 h Erholung für dieselben Muskeln). Lockere Ausdauer zählt nicht als Konflikt
 * – weder davor noch danach (PRODUKTENTSCHEIDUNG, Erweiterungsplan 5.4).
 */
export function hasBackToBackSessions(
  sessions: readonly Pick<GeneratedSession, 'scheduled_on' | 'focus'>[],
): boolean {
  const strength = sessions
    .filter((s): s is typeof s & { focus: SessionFocus } => s.focus !== null)
    .sort((a, b) => (a.scheduled_on < b.scheduled_on ? -1 : 1));
  for (let i = 1; i < strength.length; i += 1) {
    const a = strength[i - 1] as { scheduled_on: string; focus: SessionFocus };
    const b = strength[i] as { scheduled_on: string; focus: SessionFocus };
    if (addDays(a.scheduled_on, 1) === b.scheduled_on) {
      if (a.focus === 'full_body' || b.focus === 'full_body' || a.focus === b.focus) {
        return true;
      }
    }
  }
  return false;
}
